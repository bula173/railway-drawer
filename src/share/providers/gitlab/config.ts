/**
 * @file config.ts
 * @brief GitLab configuration: build-time Vite env (defaults) + runtime overrides stored in this
 *        browser (Share dialog > GitLab > Settings), availability, redirect URI, sign-in response
 *        detection and the `?gitlab=<project>:<branch>:<path>` app links.
 *
 * - VITE_GITLAB_URL: e.g. https://gitlab.com or http://gitlab.local (a relative URL root such as
 *   https://host/gitlab works too).
 * - VITE_GITLAB_CLIENT_ID: Application ID of a non-confidential GitLab OAuth application.
 * - VITE_GITLAB_DEFAULT_PROJECT: optional `group/project` (or numeric id), listed first.
 *
 * Unlike SharePoint, the GitLab chunk is always built (a LAN GitLab can be set up at runtime
 * without rebuilding); it is only downloaded once the provider is configured and used.
 * This module is in the main bundle and must stay small. See docs/GITLAB.md.
 */
import type { ProviderAvailability } from '../types';

export const GITLAB_PROVIDER_ID = 'gitlab';
export const GITLAB_DOCS_URL = 'https://github.com/bula173/railway-drawer/blob/main/docs/GITLAB.md';

/** localStorage: runtime overrides `{ url, clientId, defaultProject, staySignedIn }`. */
export const GITLAB_SETTINGS_KEY = 'rd.gitlab.settings';
/** Tokens (sessionStorage, or localStorage with "stay signed in"). */
export const GITLAB_AUTH_KEY = 'rd.gitlab.auth';
/** sessionStorage: a `?gitlab=` link still to be opened (survives a redirect sign-in). */
export const GITLAB_PENDING_OPEN_KEY = 'rd.gitlab.pendingOpen';
/** OAuth `state` values of this app start with this, so `main.ts` can route the response. */
export const GITLAB_STATE_PREFIX = 'rdgl-';
/** sessionStorage: the redirect sign-in in progress `{ state, verifier, returnUrl, mode }`. */
export const GITLAB_FLOW_KEY = 'rd.gitlab.oauth.flow';
/** sessionStorage: GitLab's answer to a redirect sign-in, kept for the reloaded app. */
export const GITLAB_RESPONSE_KEY = 'rd.gitlab.oauth.response';
/** BroadcastChannel on which the sign-in popup hands GitLab's answer to the app window. */
export const GITLAB_AUTH_CHANNEL = 'rd-gitlab-auth';
/** URL query parameter of app links to a GitLab file. */
export const GITLAB_LINK_PARAM = 'gitlab';

export interface GitLabEnv {
  VITE_GITLAB_URL?: string;
  VITE_GITLAB_CLIENT_ID?: string;
  VITE_GITLAB_DEFAULT_PROJECT?: string;
}

/** Runtime overrides (empty / missing = use the build-time value). */
export interface GitLabSettings {
  url?: string;
  clientId?: string;
  defaultProject?: string;
  staySignedIn?: boolean;
}

export interface GitLabConfig {
  /** Normalized base URL without trailing slash, or the raw value when invalid (see `urlValid`). */
  url: string;
  urlValid: boolean;
  clientId: string;
  /** `group/project` or numeric id, or null. */
  defaultProject: string | null;
  staySignedIn: boolean;
}

/** Build-time values. Each key is read literally so Vite can inline it (see vite.config.ts `define`). */
export function buildTimeGitLabEnv(): GitLabEnv {
  return {
    VITE_GITLAB_URL: import.meta.env.VITE_GITLAB_URL,
    VITE_GITLAB_CLIENT_ID: import.meta.env.VITE_GITLAB_CLIENT_ID,
    VITE_GITLAB_DEFAULT_PROJECT: import.meta.env.VITE_GITLAB_DEFAULT_PROJECT,
  };
}

/** `https://gitlab.com/` -> `https://gitlab.com`; null unless an http(s) URL without credentials. */
export function normalizeGitLabUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

const PROJECT_PATTERN = /^(\d+|[\w.-]+(\/[\w.-]+)+)$/;

export function isValidProjectRef(value: string): boolean {
  return PROJECT_PATTERN.test(value.trim());
}

function storage(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readGitLabSettings(store: Storage | null = storage('local')): GitLabSettings {
  try {
    const parsed = JSON.parse(store?.getItem(GITLAB_SETTINGS_KEY) ?? 'null') as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const s = parsed as Record<string, unknown>;
    const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
    return {
      url: str(s.url),
      clientId: str(s.clientId),
      defaultProject: str(s.defaultProject),
      staySignedIn: s.staySignedIn === true ? true : undefined,
    };
  } catch {
    return {};
  }
}

export function writeGitLabSettings(settings: GitLabSettings, store: Storage | null = storage('local')): void {
  const clean: GitLabSettings = {};
  if (settings.url?.trim()) clean.url = settings.url.trim();
  if (settings.clientId?.trim()) clean.clientId = settings.clientId.trim();
  if (settings.defaultProject?.trim()) clean.defaultProject = settings.defaultProject.trim();
  if (settings.staySignedIn) clean.staySignedIn = true;
  if (Object.keys(clean).length === 0) store?.removeItem(GITLAB_SETTINGS_KEY);
  else store?.setItem(GITLAB_SETTINGS_KEY, JSON.stringify(clean));
}

/** Build-time env overridden by runtime settings; null when URL or client id is missing. */
export function resolveGitLabConfig(env: GitLabEnv = buildTimeGitLabEnv(), settings: GitLabSettings = readGitLabSettings()): GitLabConfig | null {
  const rawUrl = (settings.url ?? env.VITE_GITLAB_URL ?? '').trim();
  const clientId = (settings.clientId ?? env.VITE_GITLAB_CLIENT_ID ?? '').trim();
  if (!rawUrl || !clientId) return null;
  const normalized = normalizeGitLabUrl(rawUrl);
  const project = (settings.defaultProject ?? env.VITE_GITLAB_DEFAULT_PROJECT ?? '').trim();
  let defaultProject: string | null = null;
  if (project) {
    if (isValidProjectRef(project)) defaultProject = project;
    else console.warn('[GitLab] Ignoring the default project, expected group/project or a numeric id:', project);
  }
  return {
    url: normalized ?? rawUrl,
    urlValid: normalized !== null,
    clientId,
    defaultProject,
    staySignedIn: settings.staySignedIn === true,
  };
}

function isLocalHost(hostname: string): boolean {
  return ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
}

export function gitLabAvailability(
  config: GitLabConfig | null,
  location: Pick<Location, 'protocol' | 'hostname'> = window.location
): ProviderAvailability {
  if (!config) {
    return {
      state: 'not-configured',
      reason: 'GitLab is not set up for this site. Enter your GitLab details under "GitLab settings", or ask your administrator.',
      details:
        'Create an OAuth application in GitLab and enter the GitLab URL and its Application ID ' +
        'under GitLab settings (or set VITE_GITLAB_URL and VITE_GITLAB_CLIENT_ID when building the app).',
      helpUrl: GITLAB_DOCS_URL,
    };
  }
  if (!config.urlValid) {
    return {
      state: 'unavailable',
      reason: `"${config.url}" is not a valid GitLab URL (expected https://… or http://…). Fix it under Settings below.`,
      helpUrl: GITLAB_DOCS_URL,
    };
  }
  const gitlab = new URL(config.url);
  if (location.protocol === 'https:' && gitlab.protocol === 'http:' && !isLocalHost(gitlab.hostname)) {
    return {
      state: 'unavailable',
      reason:
        `This page is HTTPS, so the browser blocks requests to ${gitlab.origin} (plain http). ` +
        'Use an https GitLab URL, or open Railway Drawer over http (e.g. the LAN deployment).',
      helpUrl: GITLAB_DOCS_URL,
    };
  }
  return { state: 'ready' };
}

/** Redirect URI registered in the GitLab application: the app's directory URL. */
export function gitLabRedirectUri(location: Pick<Location, 'origin' | 'pathname'> = window.location): string {
  return `${location.origin}${location.pathname.replace(/[^/]*$/, '')}`;
}

/** True when this page load is GitLab's answer to a sign-in started by this app (query `state` = rdgl-…). */
export function isGitLabAuthResponseUrl(location: Pick<Location, 'search'> = window.location): boolean {
  if (location.search.length < 2) return false;
  const params = new URLSearchParams(location.search.slice(1));
  return (params.get('state') ?? '').startsWith(GITLAB_STATE_PREFIX) && (params.has('code') || params.has('error'));
}

// ---- App links to a GitLab file -------------------------------------------------------------

export interface GitLabLinkTarget {
  /** `group/project` or numeric id. */
  project: string;
  /** Empty = the project's default branch. */
  branch: string;
  path: string;
}

const encodePart = (value: string): string => encodeURIComponent(value).replace(/%2F/gi, '/');

/** `https://app/?gitlab=group/project:main:docs/Station.drawio` (each part percent-encoded, `/` kept). */
export function buildGitLabAppLink(target: GitLabLinkTarget, baseUrl: string): string {
  return `${baseUrl}?${GITLAB_LINK_PARAM}=${encodePart(target.project)}:${encodePart(target.branch)}:${encodePart(target.path)}`;
}

/**
 * Reads `?gitlab=` from a query string. Parsed from the raw string (not URLSearchParams) because
 * the separators are literal `:` while a `:` inside a part is `%3A`. Git refs and project paths
 * cannot contain `:`, so everything after the second `:` is the path.
 */
export function parseGitLabLinkParam(search: string): GitLabLinkTarget | null {
  const match = new RegExp(`[?&]${GITLAB_LINK_PARAM}=([^&#]*)`).exec(search);
  if (!match) return null;
  const parts = match[1].replace(/\+/g, '%20').split(':');
  if (parts.length < 3) return null;
  try {
    const project = decodeURIComponent(parts[0]).trim();
    const branch = decodeURIComponent(parts[1]).trim();
    const path = decodeURIComponent(parts.slice(2).join(':')).replace(/^\/+/, '');
    if (!isValidProjectRef(project) || !path || path.split('/').some((seg) => seg === '..')) return null;
    return { project, branch, path };
  } catch {
    return null;
  }
}

/** Removes `?gitlab=` from the address bar (other parameters and the hash are kept). */
export function stripGitLabLinkParam(win: Pick<Window, 'location' | 'history'> = window): void {
  const search = win.location.search
    .slice(1)
    .split('&')
    .filter((part) => part && !part.startsWith(`${GITLAB_LINK_PARAM}=`))
    .join('&');
  const url = `${win.location.pathname}${search ? `?${search}` : ''}${win.location.hash}`;
  try {
    win.history.replaceState(win.history.state, '', url);
  } catch {
    // sandboxed: the link opens again on reload, which is harmless
  }
}

/** Moves stored tokens between sessionStorage and localStorage ("stay signed in" changed). */
export function moveGitLabTokens(staySignedIn: boolean): void {
  const from = storage(staySignedIn ? 'session' : 'local');
  const to = storage(staySignedIn ? 'local' : 'session');
  const value = from?.getItem(GITLAB_AUTH_KEY);
  if (value) to?.setItem(GITLAB_AUTH_KEY, value);
  from?.removeItem(GITLAB_AUTH_KEY);
}

/** Forgets the tokens in both storages (GitLab URL or application changed). */
export function clearGitLabTokens(): void {
  storage('local')?.removeItem(GITLAB_AUTH_KEY);
  storage('session')?.removeItem(GITLAB_AUTH_KEY);
}
