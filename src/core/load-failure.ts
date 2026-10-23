/**
 * @file load-failure.ts
 * @brief Tells a real lazy-load failure from one caused by leaving the page.
 *
 * Reloading or navigating away while palettes, stencils, templates, the shape search index or a
 * lazy module are still loading makes the browser cancel those requests: `fetch` rejects with
 * "Failed to fetch" (or an `AbortError`) and `import()` with "Failed to fetch dynamically imported
 * module". Those are not errors worth reporting. `reportLoadFailure` logs them at debug level and
 * returns false, so callers also skip their user-facing error (notification / error state), which
 * nobody would see anyway. Real failures are logged at the caller's level and return true.
 *
 * The page counts as unloading after `pagehide` (until a `pageshow` restores it from the
 * back/forward cache) and for a short window after `beforeunload` (the navigation may still be
 * cancelled, e.g. by an unsaved-changes prompt, so that flag expires on its own).
 */

import { logger } from '../drawio/logger';

/** How long after `beforeunload` a failure still counts as caused by the navigation. */
const BEFOREUNLOAD_WINDOW_MS = 5000;

let pageHidden = false;
let beforeUnloadAt = Number.NEGATIVE_INFINITY;
let tracking = false;

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/** Starts listening for page unload (idempotent; runs on import in a browser). */
export function trackPageUnload(target: Pick<Window, 'addEventListener'> | null = typeof window !== 'undefined' ? window : null): void {
  if (tracking || !target) return;
  tracking = true;
  target.addEventListener('beforeunload', () => {
    beforeUnloadAt = now();
  });
  target.addEventListener('pagehide', () => {
    pageHidden = true;
  });
  target.addEventListener('pageshow', () => {
    pageHidden = false;
    beforeUnloadAt = Number.NEGATIVE_INFINITY;
  });
}

trackPageUnload();

/** True while the page is being left (reload, navigation, tab close). */
export function isPageUnloading(): boolean {
  return pageHidden || now() - beforeUnloadAt < BEFOREUNLOAD_WINDOW_MS;
}

/** True for an `AbortError` (an `AbortController` cancelled the request). */
export function isAbortError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'AbortError';
}

/** True when a load failure is just the page going away (or an aborted request), not a real error. */
export function isUnloadAbort(err: unknown): boolean {
  return isAbortError(err) || isPageUnloading();
}

/** The message of an unknown thrown value. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Logs a failed lazy load. Returns true for a real failure (logged at `level`; the caller shows its
 * error state), false when the failure comes from leaving the page or an abort (debug log only).
 */
export function reportLoadFailure(
  level: 'warn' | 'error',
  category: string,
  message: string,
  err: unknown,
  data: Record<string, unknown> = {}
): boolean {
  const payload = { ...data, error: errorMessage(err) };
  if (isUnloadAbort(err)) {
    logger.debug(category, `${message} (page unloading or request aborted)`, payload);
    return false;
  }
  logger[level](category, message, payload);
  return true;
}

/** Test hook: forgets the unload state. */
export function resetPageUnloadForTests(): void {
  pageHidden = false;
  beforeUnloadAt = Number.NEGATIVE_INFINITY;
}
