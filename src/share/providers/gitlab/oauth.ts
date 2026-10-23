/**
 * @file oauth.ts
 * @brief GitLab sign-in: OAuth 2.0 authorization code flow with PKCE (S256) for a public client
 *        (no client secret), popup with a full-page redirect fallback, refresh tokens.
 *
 * - Authorize: `{GITLAB}/oauth/authorize?response_type=code&code_challenge_method=S256&scope=api…`;
 *   the redirect URI is the app's own URL. GitLab answers with `?code=…&state=rdgl-…`; `main.ts`
 *   sees that (`isGitLabAuthResponseUrl`) and runs `./auth-bridge.ts` instead of the editor.
 * - Popup: the app opens the window synchronously in the click (so it is not blocked), then sets
 *   its URL. GitLab's sign-in page sends `Cross-Origin-Opener-Policy: same-origin`, which severs
 *   `window.opener`, so the bridge posts the answer on a BroadcastChannel (same origin) instead.
 * - Redirect (popup blocked): the flow record (state + verifier + return URL) is kept in
 *   sessionStorage; the bridge stores GitLab's answer and returns to the app, where
 *   `completeRedirect()` (run when the provider loads) finishes the sign-in.
 * - Token endpoint: `POST {GITLAB}/oauth/token`, form-encoded (a CORS "simple" request). GitLab
 *   allows cross-origin requests to /oauth/token and /oauth/revoke since 13.9 (config/application.rb).
 * - Tokens expire after 2 h; `getToken()` refreshes 60 s early (single flight, re-reads the store
 *   first because another tab may have rotated the refresh token already).
 * - Storage: sessionStorage (this tab only) by default; localStorage with "Stay signed in".
 */
import { PENDING_SIGNIN_KEY_NAME } from '../pending';
import {
  GITLAB_AUTH_CHANNEL,
  GITLAB_AUTH_KEY,
  GITLAB_FLOW_KEY,
  GITLAB_PROVIDER_ID,
  GITLAB_RESPONSE_KEY,
  GITLAB_STATE_PREFIX,
} from './config';
import type { GitLabConfig } from './config';
import { codeChallengeS256, randomToken, randomVerifier } from './pkce';
import { getStorage } from '../../../core/safe-storage';

/**
 * `api` is the smallest GitLab scope that allows commits through the REST API (repository files)
 * and merge requests. `write_repository` only covers git-over-HTTP push, and `read_api` is
 * read-only, so neither (nor both together) can save a file or open a merge request.
 */
export const GITLAB_SCOPES = ['api'];

/** Tokens are refreshed this long before they expire. */
const REFRESH_MARGIN_MS = 60_000;
/** GitLab's access token lifetime when `expires_in` is missing. */
const DEFAULT_LIFETIME_S = 7200;

export interface GitLabUser {
  name: string;
  username: string;
  webUrl?: string;
}

export interface GitLabTokens {
  accessToken: string;
  refreshToken: string | null;
  /** Epoch ms. */
  expiresAt: number;
  scope: string;
  /** Sent again with refresh requests, as GitLab's PKCE documentation shows. */
  codeVerifier?: string;
}

interface StoredAuth {
  url: string;
  clientId: string;
  tokens: GitLabTokens;
  user: GitLabUser | null;
}

/** GitLab's answer on the redirect URI. */
export interface GitLabAuthResponse {
  state: string;
  code?: string;
  error?: string;
  errorDescription?: string;
}

interface FlowRecord {
  state: string;
  verifier: string;
  returnUrl: string;
  mode: 'redirect';
}

/** Not signed in, or the session expired (refresh failed): the UI offers "Sign in". */
export class GitLabAuthRequiredError extends Error {
  constructor(message = 'Sign in to GitLab first.') {
    super(message);
    this.name = 'GitLabAuthRequiredError';
  }
}

export class GitLabTokenError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = 'GitLabTokenError';
  }
}

interface ChannelLike {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (evt: MessageEvent) => void): void;
  close(): void;
}

export interface GitLabAuthOptions {
  config: GitLabConfig;
  redirectUri: string;
  /** Flush unsaved work before a redirect sign-in leaves the page. */
  beforeRedirect?: () => void;
  // ---- injectable for tests -----------------------------------------------------------------
  fetch?: typeof fetch;
  now?: () => number;
  local?: Storage | null;
  session?: Storage | null;
  openWindow?: (url: string, name: string, features: string) => Window | null;
  navigate?: (url: string) => void;
  currentUrl?: () => string;
  createChannel?: (name: string) => ChannelLike | null;
  hasFocus?: () => boolean;
  /** Give up waiting for the popup (default 10 min). */
  popupTimeoutMs?: number;
  /** Poll interval of the popup-closed check (default 500 ms). */
  pollMs?: number;
}

export class GitLabAuth {
  private readonly config: GitLabConfig;
  private readonly redirectUri: string;
  private readonly opts: GitLabAuthOptions;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly local: Storage | null;
  private readonly session: Storage | null;
  private refreshing: Promise<string> | null = null;
  private cancelWaiting: ((err: Error) => void) | null = null;

  constructor(opts: GitLabAuthOptions) {
    this.opts = opts;
    this.config = opts.config;
    this.redirectUri = opts.redirectUri;
    this.fetchImpl = opts.fetch ?? ((input, init) => fetch(input, init));
    this.now = opts.now ?? (() => Date.now());
    this.local = opts.local !== undefined ? opts.local : getStorage('local');
    this.session = opts.session !== undefined ? opts.session : getStorage('session');
  }

  // ---- token store --------------------------------------------------------------------------

  private preferred(): Storage | null {
    return this.config.staySignedIn ? this.local : this.session;
  }

  private other(): Storage | null {
    return this.config.staySignedIn ? this.session : this.local;
  }

  private read(): StoredAuth | null {
    for (const store of [this.preferred(), this.other()]) {
      try {
        const parsed = JSON.parse(store?.getItem(GITLAB_AUTH_KEY) ?? 'null') as StoredAuth | null;
        if (
          parsed &&
          parsed.url === this.config.url &&
          parsed.clientId === this.config.clientId &&
          typeof parsed.tokens?.accessToken === 'string'
        ) {
          return parsed;
        }
      } catch {
        // damaged entry: ignored
      }
    }
    return null;
  }

  private write(auth: StoredAuth): void {
    try {
      this.preferred()?.setItem(GITLAB_AUTH_KEY, JSON.stringify(auth));
      this.other()?.removeItem(GITLAB_AUTH_KEY);
    } catch (err) {
      console.warn('[GitLab] Could not store the sign-in:', err);
    }
  }

  private clear(): void {
    try {
      this.local?.removeItem(GITLAB_AUTH_KEY);
      this.session?.removeItem(GITLAB_AUTH_KEY);
    } catch {
      // storage blocked
    }
  }

  account(): GitLabUser | null {
    const stored = this.read();
    if (!stored) return null;
    return stored.user ?? { name: 'GitLab user', username: '' };
  }

  // ---- interactive sign-in ------------------------------------------------------------------

  authorizeUrl(state: string, challenge: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      state,
      scope: GITLAB_SCOPES.join(' '),
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    return `${this.config.url}/oauth/authorize?${params.toString()}`;
  }

  /** Must be called from a user gesture (click), so the popup is allowed. */
  async signIn(): Promise<GitLabUser> {
    this.cancelWaiting?.(new Error('Sign-in restarted'));
    const open = this.opts.openWindow ?? ((url, name, features) => window.open(url, name, features));
    // Open first (synchronously in the click), navigate once the challenge is ready
    let popup: Window | null = null;
    try {
      popup = open('', 'rd-gitlab-signin', 'popup,width=560,height=760');
    } catch {
      popup = null;
    }
    const state = `${GITLAB_STATE_PREFIX}${randomToken()}`;
    const verifier = randomVerifier();
    const url = this.authorizeUrl(state, await codeChallengeS256(verifier));
    if (popup) {
      try {
        popup.location.href = url;
      } catch {
        popup = null;
      }
    }
    if (!popup) return this.redirect(url, state, verifier);
    const response = await this.waitForPopup(popup, state);
    return this.finish(response, verifier);
  }

  private redirect(url: string, state: string, verifier: string): Promise<GitLabUser> {
    const record: FlowRecord = {
      state,
      verifier,
      returnUrl: (this.opts.currentUrl ?? (() => window.location.href))(),
      mode: 'redirect',
    };
    try {
      this.session?.setItem(GITLAB_FLOW_KEY, JSON.stringify(record));
      this.session?.setItem(PENDING_SIGNIN_KEY_NAME, GITLAB_PROVIDER_ID);
    } catch {
      return Promise.reject(new Error('Pop-ups are blocked and this browser blocks sessionStorage: allow pop-ups for this site to sign in to GitLab.'));
    }
    this.opts.beforeRedirect?.();
    (this.opts.navigate ?? ((target) => window.location.assign(target)))(url);
    // The page is navigating away
    return new Promise<GitLabUser>(() => undefined);
  }

  private waitForPopup(popup: Window, state: string): Promise<GitLabAuthResponse> {
    return new Promise<GitLabAuthResponse>((resolve, reject) => {
      const createChannel =
        this.opts.createChannel ??
        ((name: string): ChannelLike | null => (typeof BroadcastChannel === 'function' ? new BroadcastChannel(name) : null));
      const channel = createChannel(GITLAB_AUTH_CHANNEL);
      const hasFocus = this.opts.hasFocus ?? (() => document.hasFocus());
      let closedSince: number | null = null;
      let done = false;

      const finish = (fn: () => void): void => {
        if (done) return;
        done = true;
        clearInterval(poll);
        clearTimeout(timeout);
        channel?.close();
        window.removeEventListener('message', onWindowMessage);
        this.cancelWaiting = null;
        fn();
      };
      const accept = (data: unknown): void => {
        const msg = data as { type?: string; response?: GitLabAuthResponse } | null;
        if (msg?.type !== 'rd-gitlab-auth' || msg.response?.state !== state) return;
        const response = msg.response;
        finish(() => resolve(response));
        try {
          popup.close();
        } catch {
          // severed by COOP: the bridge closes itself
        }
      };
      const onWindowMessage = (evt: MessageEvent): void => {
        if (evt.origin === window.location.origin) accept(evt.data);
      };
      channel?.addEventListener('message', (evt) => accept(evt.data));
      window.addEventListener('message', onWindowMessage);

      // `popup.closed` is also true once COOP severed the popup, so "closed" only counts when this
      // window has the focus again (the user closed the popup and came back) for a moment.
      const poll = setInterval(() => {
        let closed = false;
        try {
          closed = popup.closed;
        } catch {
          closed = false;
        }
        if (closed && hasFocus()) {
          closedSince ??= this.now();
          if (this.now() - closedSince >= 1500) finish(() => reject(new Error('The GitLab sign-in window was closed.')));
        } else {
          closedSince = null;
        }
      }, this.opts.pollMs ?? 500);
      const timeout = setTimeout(
        () => finish(() => reject(new Error('The GitLab sign-in timed out. Try again.'))),
        this.opts.popupTimeoutMs ?? 10 * 60_000
      );
      this.cancelWaiting = (err) => finish(() => reject(err));
    });
  }

  /** After a redirect sign-in: finishes it from the stored answer. Null when none was pending. */
  async completeRedirect(): Promise<GitLabUser | null> {
    let raw: string | null = null;
    let flowRaw: string | null = null;
    try {
      raw = this.session?.getItem(GITLAB_RESPONSE_KEY) ?? null;
      flowRaw = this.session?.getItem(GITLAB_FLOW_KEY) ?? null;
      this.session?.removeItem(GITLAB_RESPONSE_KEY);
      if (raw) this.session?.removeItem(GITLAB_FLOW_KEY);
      if (this.session?.getItem(PENDING_SIGNIN_KEY_NAME) === GITLAB_PROVIDER_ID) this.session.removeItem(PENDING_SIGNIN_KEY_NAME);
    } catch {
      return null;
    }
    if (!raw) return null;
    const response = JSON.parse(raw) as GitLabAuthResponse;
    const flow = flowRaw ? (JSON.parse(flowRaw) as FlowRecord) : null;
    if (!flow || flow.state !== response.state) {
      throw new Error('The GitLab sign-in answer does not match the request (state). Try again.');
    }
    return this.finish(response, flow.verifier);
  }

  private async finish(response: GitLabAuthResponse, verifier: string): Promise<GitLabUser> {
    if (response.error || !response.code) {
      const why = response.errorDescription || response.error || 'no authorization code';
      throw new Error(response.error === 'access_denied' ? 'GitLab sign-in was cancelled.' : `GitLab sign-in failed: ${why}`);
    }
    const tokens = await this.tokenRequest({
      grant_type: 'authorization_code',
      code: response.code,
      redirect_uri: this.redirectUri,
      code_verifier: verifier,
    });
    tokens.codeVerifier = verifier;
    const user = await this.fetchUser(tokens.accessToken);
    this.write({ url: this.config.url, clientId: this.config.clientId, tokens, user });
    return user;
  }

  private async tokenRequest(params: Record<string, string>): Promise<GitLabTokens> {
    const endpoint = `${this.config.url}/oauth/token`;
    let res: Response;
    try {
      res = await this.fetchImpl(endpoint, {
        method: 'POST',
        // form-encoded without extra headers: a CORS "simple" request (no preflight)
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: this.config.clientId, ...params }).toString(),
      });
    } catch (err) {
      throw new Error(
        `Could not reach ${endpoint} (${err instanceof Error ? err.message : String(err)}). Check the GitLab URL and the network; ` +
          'GitLab versions before 13.9 do not allow this request from a browser (CORS), see docs/GITLAB.md.'
      );
    }
    let body: Record<string, unknown> = {};
    try {
      body = (await res.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }
    if (!res.ok || typeof body.access_token !== 'string') {
      const code = typeof body.error === 'string' ? body.error : undefined;
      const description = typeof body.error_description === 'string' ? body.error_description : undefined;
      throw new GitLabTokenError(`GitLab token request failed: ${description ?? code ?? `HTTP ${res.status}`}`, res.status, code);
    }
    const expiresIn = typeof body.expires_in === 'number' && body.expires_in > 0 ? body.expires_in : DEFAULT_LIFETIME_S;
    return {
      accessToken: body.access_token,
      refreshToken: typeof body.refresh_token === 'string' ? body.refresh_token : null,
      // our clock, not `created_at`: immune to clock skew between the PC and GitLab
      expiresAt: this.now() + expiresIn * 1000,
      scope: typeof body.scope === 'string' ? body.scope : GITLAB_SCOPES.join(' '),
    };
  }

  private async fetchUser(accessToken: string): Promise<GitLabUser> {
    const res = await this.fetchImpl(`${this.config.url}/api/v4/user`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`Signed in, but GitLab did not return the user (HTTP ${res.status}).`);
    const user = (await res.json()) as { name?: string; username?: string; web_url?: string };
    return { name: user.name || user.username || 'GitLab user', username: user.username ?? '', webUrl: user.web_url };
  }

  // ---- tokens for API calls -----------------------------------------------------------------

  /** A valid access token; refreshes when it expires within a minute. */
  async getToken(): Promise<string> {
    const stored = this.read();
    if (!stored) throw new GitLabAuthRequiredError();
    if (stored.tokens.expiresAt - REFRESH_MARGIN_MS > this.now()) return stored.tokens.accessToken;
    return this.refresh();
  }

  /** Refreshes now (also after a 401). Throws GitLabAuthRequiredError when the session is over. */
  refresh(): Promise<string> {
    this.refreshing ??= this.doRefresh().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async doRefresh(): Promise<string> {
    const stored = this.read();
    if (!stored) throw new GitLabAuthRequiredError();
    if (!stored.tokens.refreshToken) {
      this.clear();
      throw new GitLabAuthRequiredError('Your GitLab session expired. Sign in again.');
    }
    let tokens: GitLabTokens;
    try {
      tokens = await this.tokenRequest({
        grant_type: 'refresh_token',
        refresh_token: stored.tokens.refreshToken,
        redirect_uri: this.redirectUri,
        ...(stored.tokens.codeVerifier ? { code_verifier: stored.tokens.codeVerifier } : {}),
      });
    } catch (err) {
      if (err instanceof GitLabTokenError && (err.status === 400 || err.status === 401)) {
        // Another tab (localStorage) may have rotated the refresh token in the meantime
        const again = this.read();
        if (again && again.tokens.accessToken !== stored.tokens.accessToken && again.tokens.expiresAt - REFRESH_MARGIN_MS > this.now()) {
          return again.tokens.accessToken;
        }
        this.clear();
        throw new GitLabAuthRequiredError('Your GitLab session expired. Sign in again.');
      }
      throw err;
    }
    tokens.codeVerifier = stored.tokens.codeVerifier;
    this.write({ ...stored, tokens });
    return tokens.accessToken;
  }

  /** Forgets the tokens here and revokes them at GitLab (best effort; the GitLab web session stays). */
  async signOut(): Promise<void> {
    this.cancelWaiting?.(new Error('Signed out'));
    const stored = this.read();
    this.clear();
    if (!stored) return;
    try {
      await this.fetchImpl(`${this.config.url}/oauth/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: this.config.clientId, token: stored.tokens.accessToken }).toString(),
      });
    } catch {
      // offline: the token expires within 2 h anyway
    }
  }
}
