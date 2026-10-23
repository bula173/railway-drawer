/**
 * @file autosave-cache.ts
 * @brief e2e access to the app's autosave (src/services/cache-service.ts): an index
 *        `rd.cache.index` plus one key `rd.cache.tab.<id>` per tab; single-key caches of earlier
 *        versions (`railway-drawer-cache`) are still read.
 */
import type { Page } from '@playwright/test';

/** A cached tab (CacheData['tabs'][number]). */
export interface AutosavedTab {
  id?: string;
  name?: string;
  graphXml?: string;
  scenarios?: unknown[];
  [key: string]: unknown;
}

/** The cached session in the shape of the former single-key cache: `{ version, data: { tabs } }`. */
export interface AutosaveCache {
  version?: string;
  data?: { tabs?: AutosavedTab[]; [key: string]: unknown };
}

/** Runs in the page: the cached session as JSON text ('' when there is none). */
function readAutosaveText(): string {
  try {
    const index = JSON.parse(localStorage.getItem('rd.cache.index') ?? 'null') as { version?: string; tabIds?: string[] } | null;
    if (index && Array.isArray(index.tabIds)) {
      const tabs = index.tabIds
        .map((id) => JSON.parse(localStorage.getItem(`rd.cache.tab.${id}`) ?? 'null') as unknown)
        .filter((t) => t !== null);
      return JSON.stringify({ version: index.version, data: { ...index, tabs } });
    }
    return localStorage.getItem('railway-drawer-cache') ?? '';
  } catch {
    return '';
  }
}

/** Runs in the page: removes the autosave (all layouts). */
function clearAutosaveInPage(): void {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && (key === 'rd.cache.index' || key.startsWith('rd.cache.tab.') || key === 'railway-drawer-cache')) {
      localStorage.removeItem(key);
    }
  }
}

/** The cached session as JSON text ('' when there is none); `toContain` checks see the stored strings. */
export function autosaveText(page: Page): Promise<string> {
  return page.evaluate(readAutosaveText);
}

/** The cached session, or null. */
export async function readAutosave(page: Page): Promise<AutosaveCache | null> {
  const text = await autosaveText(page);
  try {
    return text ? (JSON.parse(text) as AutosaveCache) : null;
  } catch {
    return null;
  }
}

/** The cached tabs ([] when there is no cache). */
export async function autosavedTabs(page: Page): Promise<AutosavedTab[]> {
  return (await readAutosave(page))?.data?.tabs ?? [];
}

/** The cached graph XML of every tab, joined by newlines. */
export async function autosavedXml(page: Page): Promise<string> {
  return (await autosavedTabs(page)).map((t) => t.graphXml ?? '').join('\n');
}

/** Removes the autosave, so the next one can be awaited. */
export async function clearAutosave(page: Page): Promise<void> {
  await page.evaluate(clearAutosaveInPage);
}
