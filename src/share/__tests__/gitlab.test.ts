import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { base64UrlEncode, codeChallengeS256, randomVerifier } from '../providers/gitlab/pkce';
import { sha256 } from '../../security/sha256';
import {
  GITLAB_AUTH_KEY,
  GITLAB_FLOW_KEY,
  GITLAB_PENDING_OPEN_KEY,
  GITLAB_RESPONSE_KEY,
  GITLAB_SETTINGS_KEY,
  buildGitLabAppLink,
  gitLabAvailability,
  gitLabRedirectUri,
  isGitLabAuthResponseUrl,
  normalizeGitLabUrl,
  parseGitLabLinkParam,
  resolveGitLabConfig,
  stripGitLabLinkParam,
} from '../providers/gitlab/config';
import type { GitLabConfig } from '../providers/gitlab/config';
import { GitLabAuth, GitLabAuthRequiredError } from '../providers/gitlab/oauth';
import { runGitLabAuthBridge } from '../providers/gitlab/auth-bridge';
import {
  GitLabClient,
  GitLabConflictError,
  GitLabTooLargeError,
  base64ToUtf8,
  encodeFilePath,
  utf8ToBase64,
} from '../providers/gitlab/gitlab-client';
import { GitLabProvider, branchNameProblem, suggestBranchName } from '../providers/gitlab/gitlab-provider';
import type { GitLabFileRef } from '../providers/gitlab/gitlab-provider';
import { createGitLabDescriptor } from '../providers/gitlab';
import { PENDING_SIGNIN_KEY_NAME } from '../providers/pending';
import type { BrowseEntry, RemoteFileInfo, StorageProvider } from '../providers/types';

const CONFIG: GitLabConfig = { url: 'https://gitlab.example.com', urlValid: true, clientId: 'app123', defaultProject: null, staySignedIn: false };
const REDIRECT = 'http://localhost:3000/';
const POLISH = '<mxfile><diagram name="Łódź – zażółć gęślą jaźń"/></mxfile>';

type Route = (url: URL, init: RequestInit) => Response | undefined;

/** fetch mock: the first route that answers wins; every call is recorded. */
function fakeFetch(...routes: Route[]) {
  const calls: Array<{ method: string; url: URL; body: string | null; headers: Record<string, string> }> = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    calls.push({ method: init.method ?? 'GET', url, body: typeof init.body === 'string' ? init.body : null, headers: (init.headers ?? {}) as Record<string, string> });
    for (const route of routes) {
      const res = route(url, init);
      if (res) return res;
    }
    return json({ message: '404 Not found' }, 404);
  });
  return { fetch: fn as unknown as typeof fetch, calls };
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------------------------
describe('PKCE', () => {
  it('SHA-256 (fallback implementation) matches the FIPS test vectors', () => {
    const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    expect(hex(sha256(new TextEncoder().encode('abc')))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(hex(sha256(new Uint8Array()))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    // two blocks
    const long = new TextEncoder().encode('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq');
    expect(hex(sha256(long))).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  });

  it('S256 challenge = RFC 7636 appendix B, with and without crypto.subtle', async () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    expect(await codeChallengeS256(verifier)).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    // plain-http LAN page: no crypto.subtle
    expect(await codeChallengeS256(verifier, undefined)).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    expect(base64UrlEncode(new Uint8Array([251, 255]))).toBe('-_8');
  });

  it('verifier: 43..128 unreserved characters', () => {
    const v = randomVerifier();
    expect(v).toHaveLength(64);
    expect(v).toMatch(/^[A-Za-z0-9\-._~]+$/);
    expect(randomVerifier(43)).toHaveLength(43);
    expect(() => randomVerifier(42)).toThrow();
    // biased bytes (>= 198) are skipped
    const fixed = randomVerifier(43, (b) => b.fill(250).map((_, i) => (i % 2 ? 250 : 1)));
    expect(fixed).toBe('B'.repeat(43));
  });
});

// ---------------------------------------------------------------------------------------------
describe('GitLab configuration', () => {
  it('build-time env, runtime overrides, availability', () => {
    expect(resolveGitLabConfig({}, {})).toBeNull();
    expect(resolveGitLabConfig({ VITE_GITLAB_URL: 'https://gitlab.com' }, {})).toBeNull();
    expect(resolveGitLabConfig({ VITE_GITLAB_URL: 'https://gitlab.com/', VITE_GITLAB_CLIENT_ID: 'id' }, {})).toEqual({
      url: 'https://gitlab.com',
      urlValid: true,
      clientId: 'id',
      defaultProject: null,
      staySignedIn: false,
    });
    const lan = resolveGitLabConfig(
      { VITE_GITLAB_URL: 'https://gitlab.com', VITE_GITLAB_CLIENT_ID: 'id', VITE_GITLAB_DEFAULT_PROJECT: 'rail/ertms' },
      { url: 'http://gitlab.local/', clientId: 'lan', staySignedIn: true }
    );
    expect(lan).toMatchObject({ url: 'http://gitlab.local', clientId: 'lan', defaultProject: 'rail/ertms', staySignedIn: true });
    expect(resolveGitLabConfig({}, { url: 'x', clientId: 'id', defaultProject: 'bad project' })).toMatchObject({ urlValid: false, defaultProject: null });

    expect(gitLabAvailability(null, { protocol: 'https:', hostname: 'a' })).toMatchObject({ state: 'not-configured', helpUrl: expect.stringContaining('GITLAB.md') });
    expect(gitLabAvailability(resolveGitLabConfig({}, { url: 'ftp://x', clientId: 'id' }), { protocol: 'http:', hostname: 'a' }).state).toBe('unavailable');
    // LAN http deploy + LAN http GitLab works; https page + http GitLab is mixed content
    expect(gitLabAvailability(lan, { protocol: 'http:', hostname: '192.168.10.22' }).state).toBe('ready');
    expect(gitLabAvailability(lan, { protocol: 'https:', hostname: 'railwaydrawer.mksystemdesign.org' })).toMatchObject({
      state: 'unavailable',
      reason: expect.stringContaining('blocks requests to http://gitlab.local'),
    });
    expect(gitLabAvailability({ ...CONFIG }, { protocol: 'https:', hostname: 'x' }).state).toBe('ready');

    expect(normalizeGitLabUrl('https://host/gitlab/')).toBe('https://host/gitlab');
    expect(normalizeGitLabUrl('https://user:pw@host')).toBeNull();
    expect(normalizeGitLabUrl('javascript:alert(1)')).toBeNull();
    expect(gitLabRedirectUri({ origin: 'http://192.168.10.22', pathname: '/railway-drawer/index.html' })).toBe('http://192.168.10.22/railway-drawer/');
  });

  it('auth response detection only for this app\'s state prefix', () => {
    expect(isGitLabAuthResponseUrl({ search: '?code=abc&state=rdgl-xyz' })).toBe(true);
    expect(isGitLabAuthResponseUrl({ search: '?error=access_denied&state=rdgl-xyz' })).toBe(true);
    // Entra (SharePoint) answers have other states
    expect(isGitLabAuthResponseUrl({ search: '?code=abc&state=eyJpZCI6' })).toBe(false);
    expect(isGitLabAuthResponseUrl({ search: '?gitlab=a/b:main:x.drawio' })).toBe(false);
  });

  it('app links: build/parse round trip (Polish names, ":" in the path), strip', () => {
    const target = { project: 'rail/ertms.tools', branch: 'feature/łódź', path: 'docs/Stacja: Łódź.drawio' };
    const link = buildGitLabAppLink(target, 'https://rd.example/');
    expect(link.startsWith('https://rd.example/?gitlab=rail/ertms.tools:feature/')).toBe(true);
    expect(parseGitLabLinkParam(new URL(link).search)).toEqual(target);
    expect(parseGitLabLinkParam('?editor=legacy&gitlab=42::a.drawio')).toEqual({ project: '42', branch: '', path: 'a.drawio' });
    expect(parseGitLabLinkParam('?gitlab=noproject:main:a.drawio')).toBeNull();
    expect(parseGitLabLinkParam('?gitlab=a/b:main')).toBeNull();
    expect(parseGitLabLinkParam('?gitlab=a/b:main:../../etc')).toBeNull();

    const replaceState = vi.fn();
    stripGitLabLinkParam({
      location: { search: '?editor=legacy&gitlab=a/b:main:x.drawio', pathname: '/rd/', hash: '#k' } as Location,
      history: { replaceState, state: null } as unknown as History,
    });
    expect(replaceState).toHaveBeenCalledWith(null, '', '/rd/?editor=legacy#k');
  });
});

// ---------------------------------------------------------------------------------------------
function tokenRoute(handler: (params: URLSearchParams) => Response): Route {
  return (url, init) => (url.pathname === '/oauth/token' && init.method === 'POST' ? handler(new URLSearchParams(String(init.body))) : undefined);
}
const userRoute: Route = (url) => (url.pathname === '/api/v4/user' ? json({ name: 'Anna Nowak', username: 'anowak' }) : undefined);

function fakePopup() {
  return { location: { href: '' }, closed: false, close: vi.fn() };
}

function fakeChannel() {
  const listeners: Array<(evt: MessageEvent) => void> = [];
  return {
    listeners,
    postMessage: vi.fn(),
    addEventListener: (_type: 'message', listener: (evt: MessageEvent) => void) => listeners.push(listener),
    close: vi.fn(),
    deliver(data: unknown) {
      listeners.forEach((l) => l({ data } as MessageEvent));
    },
  };
}

describe('GitLab OAuth (PKCE public client)', () => {
  it('popup sign-in: authorize URL, code exchange with the verifier, tokens in sessionStorage', async () => {
    const popup = fakePopup();
    const channel = fakeChannel();
    let exchanged: URLSearchParams | null = null;
    const { fetch } = fakeFetch(
      tokenRoute((p) => {
        exchanged = p;
        return json({ access_token: 'at1', refresh_token: 'rt1', expires_in: 7200, token_type: 'Bearer', scope: 'api' });
      }),
      userRoute
    );
    const auth = new GitLabAuth({
      config: CONFIG,
      redirectUri: REDIRECT,
      fetch,
      openWindow: () => popup as unknown as Window,
      createChannel: () => channel,
      hasFocus: () => false,
    });
    const signing = auth.signIn();
    await vi.waitFor(() => expect(popup.location.href).toContain('/oauth/authorize'));
    const authorize = new URL(popup.location.href);
    expect(authorize.origin).toBe('https://gitlab.example.com');
    const q = authorize.searchParams;
    expect(q.get('client_id')).toBe('app123');
    expect(q.get('redirect_uri')).toBe(REDIRECT);
    expect(q.get('response_type')).toBe('code');
    expect(q.get('scope')).toBe('api');
    expect(q.get('code_challenge_method')).toBe('S256');
    expect(q.get('state')).toMatch(/^rdgl-/);

    // a message for another sign-in is ignored
    channel.deliver({ type: 'rd-gitlab-auth', response: { state: 'rdgl-other', code: 'nope' } });
    channel.deliver({ type: 'rd-gitlab-auth', response: { state: q.get('state'), code: 'code1' } });
    await expect(signing).resolves.toEqual({ name: 'Anna Nowak', username: 'anowak', webUrl: undefined });

    const params = exchanged as unknown as URLSearchParams;
    expect(params.get('grant_type')).toBe('authorization_code');
    expect(params.get('code')).toBe('code1');
    expect(params.get('client_id')).toBe('app123');
    expect(params.get('redirect_uri')).toBe(REDIRECT);
    // the challenge sent earlier is S256 of this verifier
    expect(await codeChallengeS256(params.get('code_verifier')!)).toBe(q.get('code_challenge'));
    expect(params.has('client_secret')).toBe(false);

    expect(JSON.parse(sessionStorage.getItem(GITLAB_AUTH_KEY)!).tokens.accessToken).toBe('at1');
    expect(localStorage.getItem(GITLAB_AUTH_KEY)).toBeNull();
    expect(auth.account()).toMatchObject({ name: 'Anna Nowak', username: 'anowak' });
    expect(await auth.getToken()).toBe('at1');
    expect(popup.close).toHaveBeenCalled();
  });

  it('GitLab error answer (access_denied) rejects; a closed popup rejects once the app has focus again', async () => {
    const channel = fakeChannel();
    const popup = fakePopup();
    const auth = new GitLabAuth({ config: CONFIG, redirectUri: REDIRECT, fetch: fakeFetch().fetch, openWindow: () => popup as unknown as Window, createChannel: () => channel, hasFocus: () => true, pollMs: 5 });
    const first = auth.signIn();
    await vi.waitFor(() => expect(popup.location.href).not.toBe(''));
    channel.deliver({ type: 'rd-gitlab-auth', response: { state: new URL(popup.location.href).searchParams.get('state'), error: 'access_denied' } });
    await expect(first).rejects.toThrow('GitLab sign-in was cancelled.');

    const popup2 = fakePopup();
    const auth2 = new GitLabAuth({ config: CONFIG, redirectUri: REDIRECT, fetch: fakeFetch().fetch, openWindow: () => popup2 as unknown as Window, createChannel: () => fakeChannel(), hasFocus: () => true, pollMs: 5, now: (() => { let t = 0; return () => (t += 1000); })() });
    const second = auth2.signIn();
    await vi.waitFor(() => expect(popup2.location.href).not.toBe(''));
    popup2.closed = true;
    await expect(second).rejects.toThrow('sign-in window was closed');
  });

  it('popup blocked -> full-page redirect; the reloaded app completes it (state checked)', async () => {
    const navigate = vi.fn();
    const beforeRedirect = vi.fn();
    const { fetch, calls } = fakeFetch(
      tokenRoute(() => json({ access_token: 'at2', refresh_token: 'rt2', expires_in: 7200 })),
      userRoute
    );
    const auth = new GitLabAuth({ config: CONFIG, redirectUri: REDIRECT, fetch, openWindow: () => null, navigate, beforeRedirect, currentUrl: () => 'http://localhost:3000/?editor=legacy' });
    void auth.signIn();
    await vi.waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(beforeRedirect).toHaveBeenCalled();
    const url = new URL(navigate.mock.calls[0][0] as string);
    const state = url.searchParams.get('state')!;
    const flow = JSON.parse(sessionStorage.getItem(GITLAB_FLOW_KEY)!);
    expect(flow).toMatchObject({ state, mode: 'redirect', returnUrl: 'http://localhost:3000/?editor=legacy' });
    expect(sessionStorage.getItem(PENDING_SIGNIN_KEY_NAME)).toBe('gitlab');

    // GitLab sends the browser back: the bridge stores the answer and returns to the app
    const replace = vi.fn();
    const win = {
      location: { search: `?code=c2&state=${state}`, replace, origin: 'http://localhost:3000', pathname: '/' },
      sessionStorage,
      document: { body: { textContent: '' } },
    } as unknown as Window;
    expect(runGitLabAuthBridge(win)).toBe('redirect');
    expect(replace).toHaveBeenCalledWith('http://localhost:3000/?editor=legacy');
    expect(JSON.parse(sessionStorage.getItem(GITLAB_RESPONSE_KEY)!)).toMatchObject({ state, code: 'c2' });

    const reloaded = new GitLabAuth({ config: CONFIG, redirectUri: REDIRECT, fetch });
    expect(await reloaded.completeRedirect()).toMatchObject({ username: 'anowak' });
    expect(new URLSearchParams(calls.find((c) => c.url.pathname === '/oauth/token')?.body ?? '').get('code_verifier')).toBe(flow.verifier);
    expect(sessionStorage.getItem(GITLAB_FLOW_KEY)).toBeNull();
    expect(sessionStorage.getItem(PENDING_SIGNIN_KEY_NAME)).toBeNull();
    expect(await reloaded.getToken()).toBe('at2');
    expect(await reloaded.completeRedirect()).toBeNull();

    // forged answer (other state) is refused
    sessionStorage.setItem(GITLAB_FLOW_KEY, JSON.stringify({ ...flow, state: 'rdgl-mine' }));
    sessionStorage.setItem(GITLAB_RESPONSE_KEY, JSON.stringify({ state: 'rdgl-attacker', code: 'x' }));
    await expect(reloaded.completeRedirect()).rejects.toThrow(/does not match/);
  });

  it('popup bridge: BroadcastChannel + opener.postMessage, then closes', () => {
    vi.useFakeTimers();
    const posted: unknown[] = [];
    const Original = globalThis.BroadcastChannel;
    globalThis.BroadcastChannel = class {
      postMessage(m: unknown) {
        posted.push(m);
      }
      close() {}
    } as unknown as typeof BroadcastChannel;
    try {
      const opener = { postMessage: vi.fn() };
      const close = vi.fn();
      const win = {
        location: { search: '?code=c3&state=rdgl-s', origin: 'http://localhost:3000', pathname: '/' },
        sessionStorage,
        document: { body: { textContent: '' } },
        history: { replaceState: vi.fn() },
        opener,
        close,
      } as unknown as Window;
      expect(runGitLabAuthBridge(win)).toBe('popup');
      const message = { type: 'rd-gitlab-auth', response: { state: 'rdgl-s', code: 'c3', error: undefined, errorDescription: undefined } };
      expect(posted).toEqual([message]);
      expect(opener.postMessage).toHaveBeenCalledWith(message, 'http://localhost:3000');
      vi.runAllTimers();
      expect(close).toHaveBeenCalled();
    } finally {
      globalThis.BroadcastChannel = Original;
    }
  });

  it('refresh: early refresh with the refresh token; failure clears and asks to sign in', async () => {
    let now = 1_000_000;
    const refreshes: URLSearchParams[] = [];
    let fail = false;
    const { fetch } = fakeFetch(
      tokenRoute((p) => {
        refreshes.push(p);
        return fail ? json({ error: 'invalid_grant', error_description: 'expired' }, 400) : json({ access_token: `at${refreshes.length + 1}`, refresh_token: `rt${refreshes.length + 1}`, expires_in: 7200 });
      })
    );
    const config = { ...CONFIG, staySignedIn: true };
    localStorage.setItem(
      GITLAB_AUTH_KEY,
      JSON.stringify({ url: config.url, clientId: config.clientId, user: { name: 'A', username: 'a' }, tokens: { accessToken: 'at1', refreshToken: 'rt1', expiresAt: now + 30_000, scope: 'api', codeVerifier: 'v1' } })
    );
    const auth = new GitLabAuth({ config, redirectUri: REDIRECT, fetch, now: () => now });
    // expires within the 60 s margin: refreshed (one request for two concurrent callers)
    const [a, b] = await Promise.all([auth.getToken(), auth.getToken()]);
    expect(a).toBe('at2');
    expect(b).toBe('at2');
    expect(refreshes).toHaveLength(1);
    expect(Object.fromEntries(refreshes[0])).toMatchObject({ grant_type: 'refresh_token', refresh_token: 'rt1', client_id: 'app123', redirect_uri: REDIRECT, code_verifier: 'v1' });
    expect(JSON.parse(localStorage.getItem(GITLAB_AUTH_KEY)!).tokens).toMatchObject({ accessToken: 'at2', refreshToken: 'rt2', expiresAt: now + 7_200_000 });
    expect(await auth.getToken()).toBe('at2');

    now += 7_200_000;
    fail = true;
    await expect(auth.getToken()).rejects.toBeInstanceOf(GitLabAuthRequiredError);
    expect(localStorage.getItem(GITLAB_AUTH_KEY)).toBeNull();
    expect(auth.account()).toBeNull();
    await expect(auth.getToken()).rejects.toThrow('Sign in to GitLab first.');
  });

  it('tokens of another GitLab/application are ignored; sign-out revokes', async () => {
    sessionStorage.setItem(GITLAB_AUTH_KEY, JSON.stringify({ url: 'https://other', clientId: 'app123', user: null, tokens: { accessToken: 'x', refreshToken: null, expiresAt: Date.now() + 1e7, scope: 'api' } }));
    const { fetch, calls } = fakeFetch((url) => (url.pathname === '/oauth/revoke' ? json({}) : undefined));
    const auth = new GitLabAuth({ config: CONFIG, redirectUri: REDIRECT, fetch });
    expect(auth.account()).toBeNull();
    sessionStorage.setItem(GITLAB_AUTH_KEY, JSON.stringify({ url: CONFIG.url, clientId: 'app123', user: null, tokens: { accessToken: 'tok', refreshToken: null, expiresAt: Date.now() + 1e7, scope: 'api' } }));
    expect(auth.account()).toEqual({ name: 'GitLab user', username: '' });
    await auth.signOut();
    expect(auth.account()).toBeNull();
    expect(calls[0].url.pathname).toBe('/oauth/revoke');
    expect(calls[0].body).toContain('token=tok');
  });
});

// ---------------------------------------------------------------------------------------------
function client(fetchImpl: typeof fetch, refresh?: () => Promise<string>) {
  return new GitLabClient({ baseUrl: 'https://gitlab.example.com/', getToken: async () => 'tok', refreshToken: refresh, fetch: fetchImpl });
}

describe('GitLabClient', () => {
  it('UTF-8 base64 round trip (Polish), path encoding', () => {
    const b64 = utf8ToBase64(POLISH);
    expect(base64ToUtf8(b64)).toBe(POLISH);
    // byte-exact UTF-8 (Ł = C5 81)
    expect(atob(utf8ToBase64('Ł'))).toBe('\xc5\x81');
    expect(base64ToUtf8('xYE=\n')).toBe('Ł');
    expect(encodeFilePath('docs/Plan stacji.drawio')).toBe('docs%2FPlan%20stacji%2Edrawio');
    // large content (chunked String.fromCharCode)
    const big = 'ż'.repeat(100_000);
    expect(base64ToUtf8(utf8ToBase64(big))).toBe(big);
  });

  it('pagination: X-Next-Page and Link rel=next; bearer token', async () => {
    const { fetch, calls } = fakeFetch((url) => {
      if (url.pathname.endsWith('/repository/branches')) {
        const page = url.searchParams.get('page') ?? '1';
        return json([{ name: `b${page}` }], 200, { 'X-Next-Page': page === '3' ? '' : String(Number(page) + 1) });
      }
      if (url.pathname.endsWith('/repository/tree')) {
        if (url.searchParams.get('page_token') === 'p2') return json([{ id: '2', name: 'b.drawio', type: 'blob', path: 'b.drawio' }]);
        return json([{ id: '1', name: 'a.drawio', type: 'blob', path: 'a.drawio' }], 200, {
          Link: '<https://gitlab.example.com/api/v4/projects/7/repository/tree?page_token=p2&per_page=100>; rel="next", <https://x>; rel="first"',
        });
      }
      return undefined;
    });
    const c = client(fetch);
    expect((await c.listBranches(7)).map((b) => b.name)).toEqual(['b1', 'b2', 'b3']);
    expect((await c.listTree(7, 'main', '')).map((e) => e.name)).toEqual(['a.drawio', 'b.drawio']);
    expect(calls[0].headers.Authorization).toBe('Bearer tok');
    expect(calls[0].url.searchParams.get('per_page')).toBe('100');
  });

  it('401 -> refresh once and retry; conflict / too-large / other errors', async () => {
    let first = true;
    const refresh = vi.fn(async () => 'fresh');
    const { fetch, calls } = fakeFetch((url, init) => {
      if (url.pathname.endsWith('/user')) {
        if (first) {
          first = false;
          return json({ message: '401 Unauthorized' }, 401);
        }
        return json({ id: 1, name: 'A', username: 'a' });
      }
      if (init.method === 'PUT' && url.pathname.includes('conflict')) {
        return json({ message: 'You are attempting to update a file that has changed since you started editing it.' }, 400);
      }
      if (init.method === 'PUT' && url.pathname.includes('big')) return new Response('Request Entity Too Large', { status: 413 });
      if (init.method === 'POST' && url.pathname.endsWith('/branches')) return json({ message: 'Branch already exists' }, 400);
      return undefined;
    });
    const c = client(fetch, refresh);
    expect((await c.currentUser()).username).toBe('a');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(calls[1].headers.Authorization).toBe('Bearer fresh');

    await expect(c.updateFile(7, 'conflict.drawio', { branch: 'main', content: 'x', commitMessage: 'm', lastCommitId: 'c1' })).rejects.toBeInstanceOf(GitLabConflictError);
    const put = calls.find((call) => call.method === 'PUT')!;
    expect(JSON.parse(put.body!)).toEqual({ branch: 'main', content: 'eA==', encoding: 'base64', commit_message: 'm', last_commit_id: 'c1' });
    await expect(c.updateFile(7, 'big.drawio', { branch: 'main', content: 'x', commitMessage: 'm' })).rejects.toBeInstanceOf(GitLabTooLargeError);
    await expect(c.createBranch(7, 'b', 'main')).rejects.toThrow('GitLab error 400: Branch already exists');
    await expect(c.getProject('missing/project')).rejects.toThrow(/Not found in GitLab \(404\)/);
  });
});

// ---------------------------------------------------------------------------------------------
/** In-memory GitLab: project 7 rail/ertms (default main), files per branch. */
function fakeGitLab() {
  const files = new Map<string, { content: string; commit: string }>([
    ['main:docs/Łódź.drawio', { content: POLISH, commit: 'c1' }],
    ['main:docs/notes.txt', { content: 'x', commit: 'c1' }],
  ]);
  const branches = new Set(['main', 'feature/x']);
  let seq = 1;
  const mrs: Array<{ source: string; target: string; title: string }> = [];
  const decode = (p: string) => decodeURIComponent(p);
  const project = { id: 7, name: 'ertms', name_with_namespace: 'Rail / ertms', path_with_namespace: 'rail/ertms', default_branch: 'main', web_url: 'https://gitlab.example.com/rail/ertms' };
  const routes = fakeFetch((url, init) => {
    const method = init.method ?? 'GET';
    const path = url.pathname.replace('/api/v4', '');
    const body = typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, string>) : {};
    if (path === '/projects' && url.searchParams.get('starred') === 'true') return json([{ ...project, id: 9, path_with_namespace: 'ops/signals' }]);
    if (path === '/projects') {
      return json(url.searchParams.get('search') ? [project] : [project, { ...project, id: 9, path_with_namespace: 'ops/signals' }]);
    }
    if (path === '/projects/rail%2Fertms' || path === '/projects/7') return json(project);
    if (path === '/projects/7/repository/branches' && method === 'GET') return json([...branches].map((name) => ({ name, protected: name === 'main' })));
    if (path === '/projects/7/repository/branches' && method === 'POST') {
      const name = url.searchParams.get('branch')!;
      if (branches.has(name)) return json({ message: 'Branch already exists' }, 400);
      const ref = url.searchParams.get('ref')!;
      branches.add(name);
      // a commit sha (c<n>) as ref: the files of main as they were at that commit
      const sha = /^c\d+$/.test(ref);
      for (const [key, value] of [...files]) {
        if (key.startsWith(`${sha ? 'main' : ref}:`)) files.set(`${name}:${key.slice(key.indexOf(':') + 1)}`, sha ? { content: 'old', commit: ref } : value);
      }
      return json({ name });
    }
    if (path === '/projects/7/repository/tree') {
      const ref = url.searchParams.get('ref');
      const dir = url.searchParams.get('path') ?? '';
      if (!dir) return json([{ id: 't', name: 'docs', type: 'tree', path: 'docs' }, { id: 'r', name: 'README.md', type: 'blob', path: 'README.md' }]);
      return json(
        [...files.keys()]
          .filter((k) => k.startsWith(`${ref}:${dir}/`))
          .map((k) => {
            const p = k.split(':')[1];
            return { id: p, name: p.split('/').pop(), type: 'blob', path: p };
          })
      );
    }
    const fileMatch = /^\/projects\/7\/repository\/files\/(.+)$/.exec(path);
    if (fileMatch) {
      const filePath = decode(fileMatch[1]);
      const ref = url.searchParams.get('ref') ?? body.branch;
      const key = `${ref}:${filePath}`;
      const existing = files.get(key);
      if (method === 'HEAD') return existing ? new Response(null, { status: 200, headers: { 'X-Gitlab-Last-Commit-Id': existing.commit } }) : new Response(null, { status: 404 });
      if (method === 'GET') {
        return existing
          ? json({ file_name: filePath.split('/').pop(), file_path: filePath, size: existing.content.length, encoding: 'base64', content: utf8ToBase64(existing.content), ref, blob_id: 'b', commit_id: 'h', last_commit_id: existing.commit })
          : json({ message: '404 File Not Found' }, 404);
      }
      if (method === 'PUT') {
        if (!existing) return json({ message: "A file with this name doesn't exist" }, 400);
        if (body.last_commit_id && body.last_commit_id !== existing.commit) {
          return json({ message: 'You are attempting to update a file that has changed since you started editing it.' }, 400);
        }
        files.set(key, { content: base64ToUtf8(body.content), commit: `c${++seq}` });
        return json({ file_path: filePath, branch: body.branch });
      }
      if (method === 'POST') {
        if (existing) return json({ message: 'A file with this name already exists' }, 400);
        files.set(key, { content: base64ToUtf8(body.content), commit: `c${++seq}` });
        return json({ file_path: filePath, branch: body.branch }, 201);
      }
    }
    if (path === '/projects/7/merge_requests' && method === 'POST') {
      if (mrs.some((m) => m.source === body.source_branch)) return json({ message: ['Another open merge request already exists for this source branch: !1'] }, 409);
      mrs.push({ source: body.source_branch, target: body.target_branch, title: body.title });
      return json({ id: 100 + mrs.length, iid: mrs.length, title: body.title, web_url: `https://gitlab.example.com/rail/ertms/-/merge_requests/${mrs.length}` }, 201);
    }
    if (path === '/projects/7/merge_requests' && method === 'GET') {
      return json(mrs.filter((m) => m.source === url.searchParams.get('source_branch')).map((m, i) => ({ id: 1, iid: i + 1, title: m.title, web_url: `https://gitlab.example.com/rail/ertms/-/merge_requests/${i + 1}` })));
    }
    return undefined;
  });
  const provider = new GitLabProvider({
    client: new GitLabClient({ baseUrl: 'https://gitlab.example.com', getToken: async () => 'tok', fetch: routes.fetch }),
    auth: { account: () => ({ name: 'Anna', username: 'anowak' }), signIn: vi.fn(), signOut: vi.fn(async () => undefined) },
    defaultProject: 'rail/ertms',
    appBaseUrl: () => 'https://rd.example/',
  });
  return { provider, files, branches, mrs, calls: routes.calls };
}

async function browseTo(p: GitLabProvider, ...names: string[]): Promise<{ path: BrowseEntry[]; entries: BrowseEntry[] }> {
  let path: BrowseEntry[] = [];
  let listing = await p.list(path);
  for (const name of names) {
    const entry = listing.entries.find((e) => e.name === name);
    if (!entry) throw new Error(`no ${name} in ${listing.entries.map((e) => e.name).join(',')}`);
    if (entry.kind === 'file') return { path, entries: [entry] };
    path = [...path, entry];
    listing = await p.list(path);
  }
  return { path, entries: listing.entries };
}

describe('GitLabProvider', () => {
  it('browse: projects (default, starred, member; deduplicated) -> branches (default first) -> folders/files', async () => {
    const { provider } = fakeGitLab();
    const top = await provider.list([]);
    expect(top.entries.map((e) => `${e.name}|${e.detail}`)).toEqual(['rail/ertms|Default project', 'ops/signals|★ Rail / ertms']);
    expect(top.searchable).toBe(true);
    expect((await provider.list([], { search: 'ert' })).heading).toBe('Projects matching "ert"');

    const branches = await browseTo(provider, 'rail/ertms');
    expect(branches.entries.map((e) => `${e.name}|${e.detail}`)).toEqual(['main|default branch · protected', 'feature/x|']);
    expect(provider.canSaveAt(branches.path)).toBe(false);
    const root = await browseTo(provider, 'rail/ertms', 'main');
    expect(provider.canSaveAt(root.path)).toBe(true);
    // README.md is not a diagram
    expect(root.entries.map((e) => `${e.kind}:${e.name}`)).toEqual(['folder:docs']);
    const docs = await browseTo(provider, 'rail/ertms', 'main', 'docs');
    expect(docs.entries.map((e) => `${e.kind}:${e.name}`)).toEqual(['file:Łódź.drawio']);
  });

  it('open: UTF-8 content, last_commit_id as version, location for the status bar', async () => {
    const { provider } = fakeGitLab();
    const docs = await browseTo(provider, 'rail/ertms', 'main', 'docs');
    const content = await provider.open(docs.path, docs.entries[0]);
    expect(content.xml).toBe(POLISH);
    expect(content.version).toBe('c1');
    expect(content.location).toBe('rail/ertms › main › docs/Łódź.drawio');
    expect(content.webUrl).toBe('https://gitlab.example.com/rail/ertms/-/blob/main/docs/%C5%81%C3%B3d%C5%BA.drawio');
    expect(content.parentPath.map((e) => e.name)).toEqual(['rail/ertms', 'main', 'docs']);
    expect(content.ref).toEqual({ projectId: 7, projectPath: 'rail/ertms', branch: 'main', path: 'docs/Łódź.drawio', defaultBranch: 'main' });
  });

  it('save: commit with last_commit_id; a stale version maps to the conflict result; overwrite without it', async () => {
    const { provider, files, calls } = fakeGitLab();
    const docs = await browseTo(provider, 'rail/ertms', 'main', 'docs');
    const opened = await provider.open(docs.path, docs.entries[0]);
    const fields = provider.saveFields({ kind: 'save', file: opened });
    expect(fields.map((f) => f.id)).toEqual(['commitMessage']);
    expect(fields[0].value).toBe('Update Łódź.drawio from Railway Drawer');

    const saved = await provider.save(opened, `${POLISH}<!--1-->`, opened.version, { commitMessage: 'Move signal S1' });
    expect(saved).toMatchObject({ ok: true, file: { version: 'c2' } });
    const put = calls.filter((c) => c.method === 'PUT').pop()!;
    expect(JSON.parse(put.body!)).toMatchObject({ branch: 'main', commit_message: 'Move signal S1', last_commit_id: 'c1', encoding: 'base64' });
    expect(files.get('main:docs/Łódź.drawio')?.content).toBe(`${POLISH}<!--1-->`);

    // someone else committed meanwhile (we still hold c1)
    const stale = await provider.save(opened, 'mine', 'c1');
    expect(stale).toMatchObject({ ok: false, reason: 'conflict', message: expect.stringContaining('was changed in GitLab (branch main)') });
    const forced = await provider.save(opened, 'mine', null);
    expect(forced.ok).toBe(true);
    expect(JSON.parse(calls.filter((c) => c.method === 'PUT').pop()!.body!)).not.toHaveProperty('last_commit_id');
    expect(JSON.parse(calls.filter((c) => c.method === 'PUT').pop()!.body!).commit_message).toBe('Update Łódź.drawio from Railway Drawer');
  });

  it('saveAs: exists -> "fail"/"rename"; new branch from the base + merge request link', async () => {
    const { provider, files, branches, mrs } = fakeGitLab();
    const docs = await browseTo(provider, 'rail/ertms', 'main', 'docs');
    expect(provider.saveFields({ kind: 'saveAs', path: docs.path }).map((f) => f.id)).toEqual(['commitMessage', 'newBranch', 'createMergeRequest']);
    expect(provider.saveFields({ kind: 'saveAs', path: docs.path.slice(0, 1) })).toEqual([]);

    expect(await provider.saveAs(docs.path, 'Łódź.drawio', 'x', 'fail')).toMatchObject({ ok: false, reason: 'exists' });
    const renamed = await provider.saveAs(docs.path, 'Łódź.drawio', 'x', 'rename');
    expect(renamed).toMatchObject({ ok: true, file: { name: 'Łódź (2).drawio' } });
    expect(files.has('main:docs/Łódź (2).drawio')).toBe(true);

    const result = await provider.saveAs(docs.path, 'Kraków.drawio', POLISH, 'fail', { newBranch: 'railway-drawer/krakow', commitMessage: '', createMergeRequest: true });
    expect(branches.has('railway-drawer/krakow')).toBe(true);
    expect(files.get('railway-drawer/krakow:docs/Kraków.drawio')?.content).toBe(POLISH);
    expect(files.has('main:docs/Kraków.drawio')).toBe(false);
    expect(mrs).toEqual([{ source: 'railway-drawer/krakow', target: 'main', title: 'Add Kraków.drawio from Railway Drawer' }]);
    expect(result).toMatchObject({
      ok: true,
      note: 'Merge request !1 created.',
      link: { url: 'https://gitlab.example.com/rail/ertms/-/merge_requests/1' },
      file: { location: 'rail/ertms › railway-drawer/krakow › docs/Kraków.drawio' },
    });
    // the bound file now offers a merge request on Ctrl+S (non-default branch)
    if (!result.ok) throw new Error('unreachable');
    expect(provider.saveFields({ kind: 'save', file: result.file }).map((f) => f.id)).toEqual(['commitMessage', 'createMergeRequest']);
    // a second MR for the same branch: the open one is reused
    const again = await provider.save(result.file, `${POLISH}!`, result.file.version, { createMergeRequest: true });
    expect(again).toMatchObject({ ok: true, note: expect.stringContaining('already open') });

    await expect(provider.saveAs(docs.path, 'a.drawio', 'x', 'fail', { newBranch: 'railway-drawer/krakow' })).rejects.toThrow(/already exists/);
    await expect(provider.saveAs(docs.path, 'a.drawio', 'x', 'fail', { newBranch: 'bad name' })).rejects.toThrow(/not a valid branch name/);
  });

  it('conflict action "Save to new branch": branch from the version you started from, then MR into the file\'s branch', async () => {
    const { provider, files, branches, mrs } = fakeGitLab();
    const docs = await browseTo(provider, 'rail/ertms', 'main', 'docs');
    const opened = await provider.open(docs.path, docs.entries[0]);
    await provider.save(opened, 'theirs', null); // someone else: c2
    const actions = provider.conflictActions(opened);
    expect(actions.map((a) => a.id)).toEqual(['new-branch']);
    expect(String(actions[0].fields?.[0].value)).toMatch(/^railway-drawer\/Łódź-\d{8}-\d{4}$|^railway-drawer\/-?\w*/);
    const result = await provider.resolveConflict(opened, 'mine', 'new-branch', { branch: 'rd/mine', commitMessage: 'My version', createMergeRequest: true });
    expect(branches.has('rd/mine')).toBe(true);
    expect(files.get('rd/mine:docs/Łódź.drawio')?.content).toBe('mine');
    expect(files.get('main:docs/Łódź.drawio')?.content).toBe('theirs');
    expect(mrs[0]).toEqual({ source: 'rd/mine', target: 'main', title: 'My version' });
    expect(result).toMatchObject({ ok: true, file: { location: 'rail/ertms › rd/mine › docs/Łódź.drawio' }, link: { url: expect.stringContaining('merge_requests/1') } });
  });

  it('share link: app link with ?gitlab= + GitLab URL; openRef opens it (default branch when empty)', async () => {
    const { provider } = fakeGitLab();
    const docs = await browseTo(provider, 'rail/ertms', 'main', 'docs');
    const opened = await provider.open(docs.path, docs.entries[0]);
    const link = await provider.createShareLink(opened, { type: 'app', audience: 'project' });
    expect(link.url).toBe('https://rd.example/?gitlab=rail/ertms:main:docs/%C5%81%C3%B3d%C5%BA.drawio');
    expect(link.note).toContain('https://gitlab.example.com/rail/ertms/-/blob/main/');
    expect(link.note).toContain('need access to the project');
    expect((await provider.createShareLink(opened, { type: 'gitlab', audience: 'project' })).url).toBe(opened.webUrl);

    const target = parseGitLabLinkParam(new URL(link.url).search)!;
    const viaLink = await provider.openRef({ ...target, branch: '' });
    expect(viaLink).toMatchObject({ xml: POLISH, version: 'c1', location: 'rail/ertms › main › docs/Łódź.drawio' });
    expect(viaLink.parentPath.map((e) => e.name)).toEqual(['rail/ertms', 'main', 'docs']);
    await expect(provider.openRef({ project: 'secret/project', branch: 'main', path: 'a.drawio' })).rejects.toThrow(/no access/);
  });

  it('size limit and helpers', async () => {
    const { provider } = fakeGitLab();
    const ref: GitLabFileRef = { projectId: 7, projectPath: 'rail/ertms', branch: 'main', path: 'docs/Łódź.drawio', defaultBranch: 'main' };
    const info: RemoteFileInfo = { providerId: 'gitlab', ref, version: 'c1', name: 'Łódź.drawio', location: '', parentPath: [] };
    await expect(provider.save(info, 'x'.repeat(50 * 1024 * 1024 + 1), 'c1')).rejects.toThrow(/saves files up to 50\.0 MB/);
    expect(branchNameProblem('feature/ok-1')).toBeNull();
    expect(branchNameProblem('a..b')).not.toBeNull();
    expect(branchNameProblem('x.lock')).not.toBeNull();
    expect(suggestBranchName('Plan stacji.drawio', new Date(2026, 9, 16, 9, 5))).toBe('railway-drawer/Plan-stacji-20261016-0905');
    expect(provider.getAccount()).toEqual({ name: 'Anna', username: '@anowak' });
  });
});

// ---------------------------------------------------------------------------------------------
describe('GitLab descriptor', () => {
  const loc = (search = '') => ({ protocol: 'http:', hostname: 'localhost', origin: 'http://localhost:3000', pathname: '/', search, hash: '' });

  it('not configured: nothing loads; runtime settings make it ready; reset goes back', async () => {
    const loadModule = vi.fn();
    const d = createGitLabDescriptor({ env: {}, location: loc(), loadModule });
    expect(d.availability()).toMatchObject({ state: 'not-configured' });
    await expect(d.load()).rejects.toThrow('not configured');
    expect(await d.resumePendingSignIn?.()).toBeNull();
    expect(loadModule).not.toHaveBeenCalled();

    expect(() => d.settings!.save({ url: 'gitlab.local', clientId: 'id' })).toThrow(/must start with https:\/\/ or http:\/\//);
    expect(() => d.settings!.save({ url: 'http://gitlab.local', clientId: 'id', defaultProject: 'no spaces allowed' })).toThrow(/group\/project/);
    d.settings!.save({ url: 'http://gitlab.local', clientId: 'lan-app', defaultProject: '', staySignedIn: false });
    expect(JSON.parse(localStorage.getItem(GITLAB_SETTINGS_KEY)!)).toEqual({ url: 'http://gitlab.local', clientId: 'lan-app' });
    expect(d.availability()).toEqual({ state: 'ready' });
    expect(d.settings!.values()).toEqual({ url: 'http://gitlab.local', clientId: 'lan-app', defaultProject: '', staySignedIn: false });
    expect(d.settings!.hint!()).toContain('http://localhost:3000/');

    const provider = { id: 'gitlab' } as StorageProvider;
    loadModule.mockResolvedValue({ createGitLabProvider: vi.fn(async (config: GitLabConfig) => ({ ...provider, config })) });
    const loaded = (await d.load()) as StorageProvider & { config: GitLabConfig };
    expect(loaded.config).toMatchObject({ url: 'http://gitlab.local', clientId: 'lan-app' });
    expect(await d.load()).toBe(loaded);
    // another application: a fresh provider, old tokens dropped
    sessionStorage.setItem(GITLAB_AUTH_KEY, '{}');
    d.settings!.save({ url: 'http://gitlab.local', clientId: 'other-app' });
    expect(sessionStorage.getItem(GITLAB_AUTH_KEY)).toBeNull();
    expect(await d.load()).not.toBe(loaded);

    d.settings!.reset();
    expect(localStorage.getItem(GITLAB_SETTINGS_KEY)).toBeNull();
    expect(d.availability().state).toBe('not-configured');
  });

  it('build-time defaults; only differences are stored; "stay signed in" moves the tokens', () => {
    const env = { VITE_GITLAB_URL: 'https://gitlab.com', VITE_GITLAB_CLIENT_ID: 'build-id' };
    const d = createGitLabDescriptor({ env, location: loc(), loadModule: vi.fn() });
    expect(d.availability().state).toBe('ready');
    sessionStorage.setItem(GITLAB_AUTH_KEY, '{"t":1}');
    d.settings!.save({ url: 'https://gitlab.com', clientId: 'build-id', staySignedIn: true });
    expect(JSON.parse(localStorage.getItem(GITLAB_SETTINGS_KEY)!)).toEqual({ staySignedIn: true });
    expect(localStorage.getItem(GITLAB_AUTH_KEY)).toBe('{"t":1}');
    expect(sessionStorage.getItem(GITLAB_AUTH_KEY)).toBeNull();
    d.settings!.save({ url: 'https://gitlab.com', clientId: 'build-id', staySignedIn: false });
    expect(sessionStorage.getItem(GITLAB_AUTH_KEY)).toBe('{"t":1}');
  });

  it('?gitlab= link: remembered for the tab, removed from the URL, cleared once handled', () => {
    const replaceState = vi.fn();
    const d = createGitLabDescriptor({
      env: {},
      location: loc('?gitlab=rail/ertms:main:docs/a.drawio'),
      history: { replaceState, state: null } as unknown as History,
      loadModule: vi.fn(),
    });
    expect(replaceState).toHaveBeenCalledWith(null, '', '/');
    expect(JSON.parse(sessionStorage.getItem(GITLAB_PENDING_OPEN_KEY)!)).toEqual({ project: 'rail/ertms', branch: 'main', path: 'docs/a.drawio' });
    expect(d.incomingLink?.()).toEqual({ ref: { project: 'rail/ertms', branch: 'main', path: 'docs/a.drawio' }, label: 'rail/ertms › main › docs/a.drawio' });
    d.clearIncomingLink?.();
    expect(d.incomingLink?.()).toBeNull();
  });
});
