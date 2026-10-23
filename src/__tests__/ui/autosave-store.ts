/**
 * Test access to the stored autosave (CacheService layout: index `rd.cache.index` + one key per
 * tab `rd.cache.tab.<id>`), in the shape of the former single-key cache `{ version, data: { tabs } }`.
 */
const INDEX_KEY = 'rd.cache.index';
const TAB_PREFIX = 'rd.cache.tab.';
const LEGACY_KEY = 'railway-drawer-cache';

export interface StoredAutosave {
  version: string;
  data: { tabs: Array<Record<string, unknown>>; [key: string]: unknown };
}

/** True for every storage key the autosave writes (and the single key of earlier versions). */
export function isAutosaveKey(key: string): boolean {
  return key === INDEX_KEY || key.startsWith(TAB_PREFIX) || key === LEGACY_KEY;
}

/** The stored session, or null when there is none. */
export function storedAutosave(): StoredAutosave | null {
  const index = JSON.parse(localStorage.getItem(INDEX_KEY) ?? 'null') as { version: string; tabIds: string[] } | null;
  if (!index) return JSON.parse(localStorage.getItem(LEGACY_KEY) ?? 'null') as StoredAutosave | null;
  const tabs = index.tabIds
    .map((id) => JSON.parse(localStorage.getItem(`${TAB_PREFIX}${id}`) ?? 'null') as Record<string, unknown> | null)
    .filter((t): t is Record<string, unknown> => t !== null);
  return { version: index.version, data: { ...index, tabs } };
}

/** The stored session as JSON text ('' when there is none). */
export function storedAutosaveText(): string {
  const stored = storedAutosave();
  return stored ? JSON.stringify(stored) : '';
}

/** Overwrites a stored tab entry (tests that damage the cache on purpose). */
export function writeStoredAutosaveTab(tab: Record<string, unknown>): void {
  localStorage.setItem(`${TAB_PREFIX}${String(tab.id)}`, JSON.stringify(tab));
}
