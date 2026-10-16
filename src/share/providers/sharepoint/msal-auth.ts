/**
 * @file msal-auth.ts
 * @brief Microsoft Entra ID sign-in with @azure/msal-browser: SPA authorization code flow + PKCE,
 *        popup with a redirect fallback when the popup is blocked, delegated scopes requested
 *        incrementally (each Graph call asks for what it needs).
 *
 * Only reached through a dynamic import when SharePoint is configured (see ./index.ts), so the
 * library is in its own chunk and is never downloaded otherwise.
 *
 * The redirect URI is the app's own URL. When Entra answers, `main.ts` sees the auth response in
 * the URL (`isAuthResponseUrl`) and runs `broadcastResponseToMainFrame` (./auth-bridge.ts)
 * instead of starting the editor: in a popup it hands the response to the opener and closes; after
 * a full-page redirect it stores the response and returns to the app, where `handleRedirectPromise`
 * (in MsalAuth.create) completes the sign-in.
 */
import {
  BrowserAuthError,
  BrowserAuthErrorCodes,
  InteractionRequiredAuthError,
  createStandardPublicClientApplication,
} from '@azure/msal-browser';
import type { AccountInfo, AuthenticationResult, IPublicClientApplication } from '@azure/msal-browser';
import type { SharePointConfig } from './config';
import { PENDING_SIGNIN_KEY_NAME as PENDING_SIGNIN_KEY } from './pending';

/** Scopes of the plain sign-in; Graph scopes are added by the calls that need them. */
export const SIGN_IN_SCOPES = ['User.Read'];

export interface MsalAuthOptions {
  config: SharePointConfig;
  redirectUri: string;
  /** Called before the page navigates away for a redirect sign-in (flush unsaved state). */
  beforeRedirect?: () => void;
}

export class MsalAuth {
  private constructor(
    private readonly pca: IPublicClientApplication,
    private readonly opts: MsalAuthOptions
  ) {}

  static async create(opts: MsalAuthOptions): Promise<MsalAuth> {
    const pca = await createStandardPublicClientApplication({
      auth: {
        clientId: opts.config.clientId,
        authority: `https://login.microsoftonline.com/${encodeURIComponent(opts.config.tenantId)}`,
        redirectUri: opts.redirectUri,
        postLogoutRedirectUri: opts.redirectUri,
      },
      // Tokens survive a reload and are shared by the app's browser tabs
      cache: { cacheLocation: 'localStorage' },
    });
    let result: AuthenticationResult | null = null;
    try {
      result = await pca.handleRedirectPromise();
    } catch (err) {
      console.warn('[SharePoint] Redirect sign-in failed:', err);
    }
    try {
      sessionStorage.removeItem(PENDING_SIGNIN_KEY);
    } catch {
      // storage blocked
    }
    const auth = new MsalAuth(pca, opts);
    if (result?.account) pca.setActiveAccount(result.account);
    else if (!pca.getActiveAccount() && pca.getAllAccounts().length > 0) pca.setActiveAccount(pca.getAllAccounts()[0]);
    return auth;
  }

  account(): AccountInfo | null {
    return this.pca.getActiveAccount() ?? this.pca.getAllAccounts()[0] ?? null;
  }

  async signIn(): Promise<AccountInfo> {
    const result = await this.interactive(SIGN_IN_SCOPES, true);
    return result.account;
  }

  /** Removes the cached tokens of the account from this browser (does not end the Microsoft session). */
  async signOut(): Promise<void> {
    const account = this.account();
    if (account) await this.pca.clearCache({ account });
    this.pca.setActiveAccount(null);
  }

  /** Access token for Graph with `scopes`; asks the user (popup/redirect) only when needed. */
  async getToken(scopes: string[]): Promise<string> {
    const account = this.account();
    if (account) {
      try {
        const result = await this.pca.acquireTokenSilent({ scopes, account });
        return result.accessToken;
      } catch (err) {
        if (!(err instanceof InteractionRequiredAuthError)) {
          // Expired refresh token, network, ...: an interactive request usually fixes it
          console.warn('[SharePoint] Silent token request failed:', err);
        }
      }
    }
    return (await this.interactive(scopes, !account)).accessToken;
  }

  private async interactive(scopes: string[], selectAccount: boolean): Promise<AuthenticationResult> {
    const account = this.account() ?? undefined;
    try {
      const result = await this.pca.acquireTokenPopup({
        scopes,
        account,
        ...(selectAccount ? { prompt: 'select_account' } : {}),
      });
      this.pca.setActiveAccount(result.account);
      return result;
    } catch (err) {
      const blocked =
        err instanceof BrowserAuthError &&
        (err.errorCode === BrowserAuthErrorCodes.popupWindowError ||
          err.errorCode === BrowserAuthErrorCodes.emptyWindowError);
      if (!blocked) throw err;
      // Popup blocked: sign in with a full-page redirect (the page reloads afterwards)
      try {
        sessionStorage.setItem(PENDING_SIGNIN_KEY, 'sharepoint');
      } catch {
        // storage blocked: the sign-in still completes, without the confirmation message
      }
      this.opts.beforeRedirect?.();
      await this.pca.acquireTokenRedirect({ scopes, account });
      // The page is navigating away
      return new Promise<AuthenticationResult>(() => undefined);
    }
  }
}
