/**
 * @file snap-mode.ts
 * @brief Scoped modes of the railway snap to track (railway/snap.ts): suspended, or limited to
 *        track/km data. Kept in the core layer because the services layer (arrow-key nudges in
 *        graph-command-service.ts) sets them too.
 */

let suspended = 0;
let dataOnly = 0;

/** Runs `fn` with snapping limited to track/km data (no geometry change): arrow-key nudges. */
export function withSnapDataOnly<T>(fn: () => T): T {
  dataOnly++;
  try {
    return fn();
  } finally {
    dataOnly--;
  }
}

/**
 * Runs `fn` without snapping (for edits that place objects exactly, such as the Railway Script's
 * generated drawing: its km come from the script, not from the position).
 */
export function withSnapSuspended<T>(fn: () => T): T {
  suspended++;
  try {
    return fn();
  } finally {
    suspended--;
  }
}

/** True inside withSnapSuspended. */
export function isSnapSuspended(): boolean {
  return suspended > 0;
}

/** True inside withSnapDataOnly. */
export function isSnapDataOnly(): boolean {
  return dataOnly > 0;
}
