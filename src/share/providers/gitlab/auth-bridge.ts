/**
 * @file auth-bridge.ts
 * @brief Page load that carries GitLab's sign-in answer (`?code=…&state=rdgl-…` on the app URL).
 *        The editor is not started on such a load (see main.ts).
 *
 * - Redirect sign-in (this tab started it: the flow record with the same state is in this tab's
 *   sessionStorage): stores the answer and returns to the app, which finishes the sign-in.
 * - Popup: hands the answer to the app window (BroadcastChannel, plus `opener.postMessage` when
 *   the opener survived GitLab's COOP) and closes.
 */
import { GITLAB_AUTH_CHANNEL, GITLAB_FLOW_KEY, GITLAB_RESPONSE_KEY } from './config';

export interface BridgeAnswer {
  state: string;
  code?: string;
  error?: string;
  errorDescription?: string;
}

function readAnswer(search: string): BridgeAnswer | null {
  const params = new URLSearchParams(search.slice(1));
  const state = params.get('state');
  if (!state) return null;
  return {
    state,
    code: params.get('code') ?? undefined,
    error: params.get('error') ?? undefined,
    errorDescription: params.get('error_description') ?? undefined,
  };
}

export function runGitLabAuthBridge(win: Window = window): 'redirect' | 'popup' | 'invalid' {
  const answer = readAnswer(win.location.search);
  if (!answer) return 'invalid';

  type Flow = { state?: string; returnUrl?: string; mode?: string };
  let flow: Flow | null = null;
  try {
    flow = JSON.parse(win.sessionStorage.getItem(GITLAB_FLOW_KEY) ?? 'null') as Flow | null;
  } catch {
    flow = null;
  }
  if (flow?.mode === 'redirect' && flow.state === answer.state && flow.returnUrl) {
    try {
      win.sessionStorage.setItem(GITLAB_RESPONSE_KEY, JSON.stringify(answer));
    } catch {
      // storage blocked: the app reports that no sign-in completed
    }
    win.document.body.textContent = 'Signing in to GitLab…';
    // replace(): the URL with the authorization code does not stay in the history
    win.location.replace(flow.returnUrl);
    return 'redirect';
  }

  const message = { type: 'rd-gitlab-auth', response: answer };
  try {
    const channel = new BroadcastChannel(GITLAB_AUTH_CHANNEL);
    channel.postMessage(message);
    channel.close();
  } catch {
    // no BroadcastChannel: the opener path below
  }
  try {
    win.opener?.postMessage(message, win.location.origin);
  } catch {
    // severed by COOP
  }
  win.document.body.textContent = answer.error
    ? 'The GitLab sign-in did not complete. You can close this window.'
    : 'Signed in to GitLab. You can close this window.';
  try {
    win.history.replaceState(null, '', win.location.pathname);
  } catch {
    // ignore
  }
  setTimeout(() => win.close(), 50);
  return 'popup';
}
