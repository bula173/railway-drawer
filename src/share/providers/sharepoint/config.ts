/**
 * @file config.ts
 * @brief SharePoint / OneDrive for Business configuration (build-time Vite env) and availability.
 *
 * - VITE_MSAL_CLIENT_ID: Application (client) id of the Entra app registration (SPA platform).
 *   Unset = the provider is "Not configured" and no Microsoft code is built or loaded.
 * - VITE_MSAL_TENANT_ID: tenant id or domain; default 'organizations' (any work/school account).
 * - VITE_SHAREPOINT_DEFAULT_SITE: optional `hostname:/sites/Name`, listed first in the browser.
 *
 * This module is in the main bundle; it must not import @azure/msal-browser.
 * See docs/SHAREPOINT.md.
 */
import type { ProviderAvailability } from '../types';

export const SHAREPOINT_DOCS_URL = 'https://github.com/bula173/railway-drawer/blob/main/docs/SHAREPOINT.md';

/** The HTTPS deployment, suggested on the plain-http LAN deploy. */
export const SHAREPOINT_HTTPS_URL = 'https://railwaydrawer.mksystemdesign.org';

export interface SharePointConfig {
  clientId: string;
  tenantId: string;
  /** `hostname:/sites/Name`, or null. */
  defaultSite: string | null;
}

export interface SharePointEnv {
  VITE_MSAL_CLIENT_ID?: string;
  VITE_MSAL_TENANT_ID?: string;
  VITE_SHAREPOINT_DEFAULT_SITE?: string;
}

/** Build-time values. Each key is read literally so Vite can inline it (see vite.config.ts `define`). */
export function buildTimeSharePointEnv(): SharePointEnv {
  return {
    VITE_MSAL_CLIENT_ID: import.meta.env.VITE_MSAL_CLIENT_ID,
    VITE_MSAL_TENANT_ID: import.meta.env.VITE_MSAL_TENANT_ID,
    VITE_SHAREPOINT_DEFAULT_SITE: import.meta.env.VITE_SHAREPOINT_DEFAULT_SITE,
  };
}

const DEFAULT_SITE_PATTERN = /^[a-z0-9.-]+\.[a-z]{2,}:\/sites\/[^/?#]+$/i;

/** Parsed configuration, or null when VITE_MSAL_CLIENT_ID is not set. */
export function readSharePointConfig(env: SharePointEnv = buildTimeSharePointEnv()): SharePointConfig | null {
  const clientId = (env.VITE_MSAL_CLIENT_ID ?? '').trim();
  if (!clientId) return null;
  const tenantId = (env.VITE_MSAL_TENANT_ID ?? '').trim() || 'organizations';
  const site = (env.VITE_SHAREPOINT_DEFAULT_SITE ?? '').trim();
  let defaultSite: string | null = null;
  if (site) {
    if (DEFAULT_SITE_PATTERN.test(site)) defaultSite = site;
    else console.warn('[SharePoint] Ignoring VITE_SHAREPOINT_DEFAULT_SITE, expected hostname:/sites/Name:', site);
  }
  return { clientId, tenantId, defaultSite };
}

/** Entra ID accepts http redirect URIs only for localhost. */
export function isSecureForEntra(location: Pick<Location, 'protocol' | 'hostname'>): boolean {
  if (location.protocol === 'https:') return true;
  return location.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
}

export function sharePointAvailability(
  config: SharePointConfig | null,
  location: Pick<Location, 'protocol' | 'hostname'> = window.location
): ProviderAvailability {
  if (!config) {
    return {
      state: 'not-configured',
      reason: 'SharePoint and OneDrive are not set up for this site. Ask your administrator.',
      details:
        'An administrator registers an app in Microsoft Entra ID and sets ' +
        'VITE_MSAL_CLIENT_ID (and optionally VITE_MSAL_TENANT_ID) when building the app.',
      helpUrl: SHAREPOINT_DOCS_URL,
    };
  }
  if (!isSecureForEntra(location)) {
    return {
      state: 'unavailable',
      reason: `SharePoint requires HTTPS — use ${SHAREPOINT_HTTPS_URL}`,
      helpUrl: SHAREPOINT_HTTPS_URL,
    };
  }
  return { state: 'ready' };
}

/** Redirect URI registered in Entra: the app's directory URL (`https://host/` or `http://localhost:3000/`). */
export function sharePointRedirectUri(location: Pick<Location, 'origin' | 'pathname'> = window.location): string {
  return `${location.origin}${location.pathname.replace(/[^/]*$/, '')}`;
}

/**
 * True when this page load is Entra's answer to a sign-in (popup or redirect): the URL hash or
 * query has `state` plus `code` or `error`. Such loads must not start the editor.
 */
export function isAuthResponseUrl(location: Pick<Location, 'hash' | 'search'> = window.location): boolean {
  const check = (raw: string): boolean => {
    if (raw.length < 2) return false;
    const params = new URLSearchParams(raw.slice(1));
    return params.has('state') && (params.has('code') || params.has('error'));
  };
  return check(location.hash) || check(location.search);
}
