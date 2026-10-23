/**
 * @file safe-storage.ts
 * @brief The only module that touches `localStorage` / `sessionStorage` directly.
 *
 * Web Storage can be missing (non-browser contexts), throw on access (blocked site data, some
 * private modes, sandboxed iframes) or throw on write (quota). Every read here returns a fallback
 * instead of throwing, every write reports whether it worked, and JSON reads are validated by the
 * caller's parser, so a hand-edited or outdated entry can never crash the app.
 *
 * Keys: `storage-keys.ts` (the registry of every key string). A unit test fails on raw Web Storage
 * use anywhere else in src.
 *
 * The storage object is looked up on every call (not cached), so tests that replace or spy on
 * `localStorage` keep working.
 */

/** Which Web Storage area: `local` (persistent) or `session` (this tab only). */
export type StorageArea = 'local' | 'session';

/** The Storage object of `area`, or null when it is unavailable or access throws. */
export function getStorage(area: StorageArea = 'local'): Storage | null {
  try {
    const store = area === 'local' ? globalThis.localStorage : globalThis.sessionStorage;
    return store ?? null;
  } catch {
    return null;
  }
}

/** The stored string, or null when missing or storage is unavailable. */
export function readItem(key: string, area: StorageArea = 'local'): string | null {
  try {
    return getStorage(area)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Outcome of a write: `error` is what the storage threw (e.g. a QuotaExceededError). */
export type WriteResult = { ok: true } | { ok: false; error: unknown };

/** Stores `value`; reports the error instead of throwing (quota, blocked storage). */
export function writeItemResult(key: string, value: string, area: StorageArea = 'local'): WriteResult {
  try {
    const store = getStorage(area);
    if (!store) return { ok: false, error: new Error('Web Storage is unavailable') };
    store.setItem(key, value);
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

/** Stores `value`; false when the browser refused (the value then applies for this page only). */
export function writeItem(key: string, value: string, area: StorageArea = 'local'): boolean {
  return writeItemResult(key, value, area).ok;
}

/** Removes `key`; false when storage is unavailable. */
export function removeItem(key: string, area: StorageArea = 'local'): boolean {
  try {
    const store = getStorage(area);
    if (!store) return false;
    store.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * The stored JSON value checked by `parse` (return null to reject it), or null when missing,
 * unparsable, rejected or storage is unavailable.
 */
export function readJson<T>(key: string, parse: (value: unknown) => T | null, area: StorageArea = 'local'): T | null {
  const raw = readItem(key, area);
  if (raw === null) return null;
  try {
    return parse(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

/** Stores `value` as JSON; false when it could not be serialised or stored. */
export function writeJson(key: string, value: unknown, area: StorageArea = 'local'): boolean {
  let text: string;
  try {
    text = JSON.stringify(value);
  } catch {
    return false;
  }
  return writeItem(key, text, area);
}

/** A '1'/'0' flag: true for '1', false for '0', `fallback` when missing, unreadable or anything else. */
export function readFlag(key: string, fallback: boolean, area: StorageArea = 'local'): boolean {
  const v = readItem(key, area);
  return v === '1' ? true : v === '0' ? false : fallback;
}

/** Stores a '1'/'0' flag; false when the browser refused. */
export function writeFlag(key: string, on: boolean, area: StorageArea = 'local'): boolean {
  return writeItem(key, on ? '1' : '0', area);
}

/** Parser for readJson: an array of strings (other entries dropped), else null. */
export function parseStringArray(value: unknown): string[] | null {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : null;
}

/** Parser for readJson: a plain object, else null. */
export function parseRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/**
 * Stores `value` and throws what the storage threw (or an Error when it is unavailable), for
 * callers whose error handling tells a full quota from other failures (autosave).
 */
export function writeItemOrThrow(key: string, value: string, area: StorageArea = 'local'): void {
  const result = writeItemResult(key, value, area);
  if (!result.ok) throw result.error;
}
