/**
 * @file access-identity.ts
 * @brief Top-bar user of Cloudflare Access: the logged-in email and a "Log out" button.
 *
 * Production runs behind Cloudflare Access (email OTP). Access answers same-origin
 * `/cdn-cgi/access/get-identity` at Cloudflare's edge (the Worker never sees `/cdn-cgi/*`:
 * wrangler.jsonc `run_worker_first` only covers /mcp and /api/ai-bridge) with the identity JSON,
 * and `/cdn-cgi/access/logout` ends the session. On boot, after the first paint, and only on an
 * https origin that is not localhost or a LAN IP (dev server, the LAN Apache copy: no Access),
 * the identity is fetched once; with an `email` the top bar shows it (truncated, full address in
 * the tooltip) and a Log out button (confirm first when tabs have changes not saved to their
 * remote provider). Anything else (network error, 404, HTML, no email) shows nothing and logs
 * nothing. Dev/e2e: localStorage `rd.accessProbe` = '1' forces the request on any origin (dev
 * builds only).
 */

import { setInlineIcon } from './toolbar';
import './access-identity.css';
import { readItem } from '../core/safe-storage';
import { STORAGE_KEYS } from '../core/storage-keys';

export const ACCESS_IDENTITY_URL = '/cdn-cgi/access/get-identity';
export const ACCESS_LOGOUT_URL = '/cdn-cgi/access/logout';
const PROBE_FLAG = STORAGE_KEYS.accessProbe;

export interface AccessIdentity {
  email: string;
  name?: string;
}

/** Whether `hostname` is localhost, a loopback/private/link-local IP or a .local name (no Access there). */
export function isLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === '' || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')) return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 127 || a === 10 || a === 0 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
  }
  if (h.includes(':')) return h === '::1' || /^f[cd]/.test(h) || /^fe[89ab]/.test(h);
  return false;
}

/** Whether the app may ask Cloudflare Access for the identity on this origin. */
export function shouldQueryAccess(loc: { protocol: string; hostname: string }, forced = false): boolean {
  if (forced) return true;
  return loc.protocol === 'https:' && !isLocalHost(loc.hostname);
}

/** The identity from a get-identity response, or null (not JSON, no email, error status). */
export function parseAccessIdentity(status: number, contentType: string | null, body: string): AccessIdentity | null {
  if (status < 200 || status >= 300) return null;
  if (!/\bjson\b/i.test(contentType ?? '')) return null;
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const { email, name } = data as { email?: unknown; name?: unknown };
  if (typeof email !== 'string') return null;
  const trimmed = email.trim();
  if (!/^[^\s@]+@[^\s@]+$/.test(trimmed) || trimmed.length > 320) return null;
  return typeof name === 'string' && name.trim() ? { email: trimmed, name: name.trim() } : { email: trimmed };
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Pick<Response, 'status' | 'headers' | 'text'>>;

/** Fetches the Access identity; never throws, never logs. */
export async function fetchAccessIdentity(fetchFn: FetchLike = (u, i) => fetch(u, i)): Promise<AccessIdentity | null> {
  try {
    const res = await fetchFn(ACCESS_IDENTITY_URL, { credentials: 'same-origin', headers: { Accept: 'application/json' }, cache: 'no-store' });
    return parseAccessIdentity(res.status, res.headers.get('content-type'), await res.text());
  } catch {
    return null;
  }
}

export interface AccessUserOptions {
  /** Number of tabs with changes not saved to their remote provider (SharePoint / GitLab). */
  unsavedRemoteTabs: () => number;
  /** Themed yes/no question (app-dialogs.ts confirmDialog). */
  confirm: (opts: { title: string; message: string; confirmLabel: string; danger: boolean; testId: string }) => Promise<boolean>;
  /** Called right before leaving with unsaved remote changes the user agreed to drop (skips the browser's leave prompt). */
  allowLeave?: () => void;
  /** Leaves the page (default: location.assign). */
  navigate?: (url: string) => void;
}

/** Builds the top-bar element for `identity` (not inserted). */
export function createAccessUser(identity: AccessIdentity, opts: AccessUserOptions): HTMLElement {
  const root = document.createElement('div');
  root.className = 'rd-access-user';
  root.dataset.testid = 'access-user';

  const who = document.createElement('span');
  who.className = 'rd-access-email';
  who.dataset.rdIcon = 'user';
  who.title = identity.name ? `Signed in as ${identity.name} <${identity.email}>` : `Signed in as ${identity.email}`;
  const text = document.createElement('span');
  text.className = 'rd-access-email-text';
  text.textContent = identity.email;
  who.append(text);
  setInlineIcon(who, 'user');
  who.querySelector('svg')?.setAttribute('aria-hidden', 'true');

  const logout = document.createElement('button');
  logout.type = 'button';
  logout.className = 'rd-access-logout';
  logout.setAttribute('aria-label', `Log out (${identity.email})`);
  logout.title = `Log out of Cloudflare Access (${identity.email})`;
  const label = document.createElement('span');
  label.className = 'rd-access-logout-text';
  label.textContent = 'Log out';
  logout.append(label);
  setInlineIcon(logout, 'logOut');
  logout.querySelector('svg')?.setAttribute('aria-hidden', 'true');

  const navigate = opts.navigate ?? ((url: string): void => window.location.assign(url));
  logout.addEventListener('click', () => {
    void (async (): Promise<void> => {
      const unsaved = opts.unsavedRemoteTabs();
      if (unsaved > 0) {
        const ok = await opts.confirm({
          title: 'Log out?',
          message: `${unsaved === 1 ? '1 diagram has' : `${unsaved} diagrams have`} changes not saved to their storage (SharePoint / GitLab). Logging out leaves the page and they are lost unless saved first (Ctrl+S).`,
          confirmLabel: 'Log out',
          danger: true,
          testId: 'access-logout-confirm',
        });
        if (!ok) return;
        opts.allowLeave?.();
      }
      navigate(ACCESS_LOGOUT_URL);
    })();
  });

  root.append(who, logout);
  return root;
}

export interface InstallAccessIdentityOptions extends AccessUserOptions {
  /** Where the element goes (prepended). */
  container: HTMLElement | null;
  fetchFn?: FetchLike;
  location?: { protocol: string; hostname: string };
}

function probeForced(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    return readItem(PROBE_FLAG) === '1';
  } catch {
    return false;
  }
}

/**
 * Asks Access for the identity (after the first paint) and shows the user in `container`.
 * Resolves with the element, or null when nothing is shown.
 */
export async function installAccessIdentity(opts: InstallAccessIdentityOptions): Promise<HTMLElement | null> {
  if (!opts.container || !shouldQueryAccess(opts.location ?? window.location, probeForced())) return null;
  // after the first paint: never delays the boot
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  const identity = await fetchAccessIdentity(opts.fetchFn);
  if (!identity || !opts.container.isConnected) return null;
  opts.container.querySelector(':scope > .rd-access-user')?.remove();
  const el = createAccessUser(identity, opts);
  opts.container.prepend(el);
  return el;
}
