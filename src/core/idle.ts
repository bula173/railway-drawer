/**
 * @file idle.ts
 * @brief Runs work when the browser is idle (requestIdleCallback), with a timeout so it always runs;
 *        falls back to a 0 ms timer where requestIdleCallback is missing (Safari, jsdom).
 */

type IdleWindow = typeof globalThis & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

/** Schedules `fn` for the next idle period (at the latest after `timeout` ms); returns the canceller. */
export function runWhenIdle(fn: () => void, timeout = 2000): () => void {
  const w = globalThis as IdleWindow;
  if (typeof w.requestIdleCallback === 'function' && typeof w.cancelIdleCallback === 'function') {
    const handle = w.requestIdleCallback(fn, { timeout });
    return () => w.cancelIdleCallback?.(handle);
  }
  const timer = setTimeout(fn, 0);
  return () => clearTimeout(timer);
}
