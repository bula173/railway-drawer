import { isLegacyModelXml } from './drawio-xml';
import { logger } from '../drawio/logger';
import { listKeys, readItem, removeItem, writeItemOrThrow } from '../core/safe-storage';
import { STORAGE_KEYS } from '../core/storage-keys';

export interface CacheData {
  /** The active tab's project name (older versions kept only this one, for every tab). */
  projectName: string;
  tabs: Array<{
    id: string;
    /** The tab's label in the tab bar. */
    name: string;
    graphXml: string;
    /**
     * The tab's own project name (top-bar title, file name of Save/Export, `<diagram name>`).
     * Missing in caches of earlier versions: the active tab then gets the top-level projectName.
     */
    projectName?: string;
    /**
     * Pages 2..n of the file opened in the tab (serialized <diagram> elements) and the shown
     * page's <diagram> id, so a save after a reload still writes every page. Missing in
     * caches of earlier versions; ignored when malformed.
     */
    extraPages?: string[];
    pageId?: string | null;
    /** The tab's scenarios (ScenarioData[] of scenarios/scenario-model.ts; steps hold full drawing snapshots). Missing when there are none; sanitized on restore. */
    scenarios?: unknown[];
    /** The tab's Railway Script text (src/railway-script). Missing when there is none. */
    railwayScript?: string;
    /**
     * The tab's remote-file binding (SharePoint/GitLab: provider id, ref, version, ...; never a
     * token), in its own versioned format (`src/share/remote-binding.ts`). Opaque here; missing in
     * caches of earlier versions and for tabs not bound to a remote file.
     */
    remote?: unknown;
  }>;
  activeTabId: string;
  timestamp: number;
}

/** Outcome of a cache write, so callers can tell the user when autosave stops working. */
export type CacheSaveResult = 'saved' | 'quota-exceeded' | 'failed';

/** One tab of a session to write: its id and its cache entry already serialised as JSON. */
export interface CachedTabJson {
  id: string;
  /** JSON of a `CacheData['tabs'][number]` entry. */
  json: string;
}

/** The session-wide part of the cache (everything but the tabs). */
export interface CacheMeta {
  projectName: string;
  activeTabId: string;
  timestamp: number;
}

interface CacheIndex extends CacheMeta {
  version: string;
  tabIds: string[];
}

/**
 * Browser cache of the open tabs (autosave).
 *
 * Layout (version 2): a small index `rd.cache.index` (`{ version, projectName, activeTabId,
 * timestamp, tabIds }`) and one key per tab `rd.cache.tab.<id>` holding that tab's entry, so an
 * autosave writes only the tabs that changed. The index is written last: a reader sees the tab list
 * of the last complete save. Tab keys no longer listed are removed after the index.
 *
 * Version 1 (one key `railway-drawer-cache` = `{ version: '1', data: CacheData }`) is still read when
 * there is no index, and removed by the first successful version 2 save (migrated once).
 *
 * Writes skip tabs whose JSON equals what this page wrote last, as long as the stored index is the
 * one this page wrote (another window or a cleared storage invalidates that memo: everything is
 * written again, the last writer wins as before).
 */
export class CacheService {
  /** Version 1 single-key cache (read for migration only). */
  private static readonly LEGACY_KEY = STORAGE_KEYS.cache;
  private static readonly INDEX_KEY = STORAGE_KEYS.cacheIndex;
  private static readonly TAB_PREFIX = STORAGE_KEYS.cacheTabPrefix;
  /**
   * Set when a save fails, holding the time of the first failed save. The previous cache entry
   * stays in place (it is still the best copy there is), but it no longer matches the session,
   * so a later restore can tell the user that it is out of date.
   */
  private static readonly STALE_KEY = STORAGE_KEYS.cacheStale;
  /**
   * Version of the single-key layout. Not bumped for the switch to the draw.io format: a version
   * mismatch drops the whole cache. Tabs cached as <GraphDataModel> still load and are rewritten
   * after a successful restore (see isLegacyGraphXml / TabManager.restoreFromCache).
   */
  private static readonly LEGACY_VERSION = '1';
  /** Version of the index + per-tab layout. */
  private static readonly VERSION = '2';

  /** What this page last wrote: the index JSON and each tab's JSON (null = unknown, write all). */
  private static memo: { index: string; tabs: Map<string, string> } | null = null;

  /** The storage key of a tab's entry. */
  static tabKey(tabId: string): string {
    return `${this.TAB_PREFIX}${tabId}`;
  }

  /** True when a cached tab still holds the legacy maxGraph format and needs migrating. */
  static isLegacyGraphXml(graphXml: string): boolean {
    return isLegacyModelXml(graphXml);
  }

  /** True when any tab of the cached session is in the legacy maxGraph format. */
  static needsMigration(data: CacheData): boolean {
    return data.tabs.some((tab) => this.isLegacyGraphXml(tab.graphXml));
  }

  /** Writes a whole session (every tab). */
  static save(data: CacheData): CacheSaveResult {
    const { projectName, activeTabId, timestamp } = data;
    let tabs: CachedTabJson[];
    try {
      tabs = data.tabs.map((tab) => ({ id: tab.id, json: JSON.stringify(tab) }));
    } catch (error) {
      console.error('[Cache] Failed to save:', error);
      this.markStale(timestamp);
      return 'failed';
    }
    return this.saveSession({ projectName, activeTabId, timestamp }, tabs);
  }

  /**
   * Writes a session whose tab entries are already JSON; tabs unchanged since this page's last
   * write are not written again.
   */
  static saveSession(meta: CacheMeta, tabs: CachedTabJson[]): CacheSaveResult {
    try {
      const memo = this.validMemo();
      const written = new Map<string, string>();
      for (const tab of tabs) {
        if (memo?.tabs.get(tab.id) !== tab.json) writeItemOrThrow(this.tabKey(tab.id), tab.json);
        written.set(tab.id, tab.json);
      }
      const index: CacheIndex = { version: this.VERSION, ...meta, tabIds: tabs.map((t) => t.id) };
      const indexJson = JSON.stringify(index);
      writeItemOrThrow(this.INDEX_KEY, indexJson);
      this.memo = { index: indexJson, tabs: written };
      // Closed tabs, the version 1 key (migrated now) and the failure marker go
      for (const key of listKeys(this.TAB_PREFIX)) {
        if (!written.has(key.slice(this.TAB_PREFIX.length))) removeItem(key);
      }
      removeItem(this.LEGACY_KEY);
      removeItem(this.STALE_KEY);
      logger.debug('Cache', 'Saved to localStorage', [tabs.length - (memo ? tabs.filter((t) => memo.tabs.get(t.id) === t.json).length : 0), 'tab(s) written']);
      return 'saved';
    } catch (error) {
      console.error('[Cache] Failed to save:', error);
      // What was written is unknown now: the next save writes every tab again
      this.memo = null;
      this.markStale(meta.timestamp);
      return this.isQuotaExceeded(error) ? 'quota-exceeded' : 'failed';
    }
  }

  /** The memo of the last write, when the stored index is still the one this page wrote. */
  private static validMemo(): { index: string; tabs: Map<string, string> } | null {
    if (!this.memo) return null;
    if (readItem(this.INDEX_KEY) !== this.memo.index) this.memo = null;
    return this.memo;
  }

  /**
   * Time of the first save that failed after the stored entry was written, or null when the
   * stored entry is the latest saved state. A non-null value means a restore is out of date.
   */
  static getStaleSince(): number | null {
    const value = readItem(this.STALE_KEY);
    if (value === null) return null;
    const timestamp = Number(value);
    return Number.isFinite(timestamp) ? timestamp : Date.now();
  }

  /** Records the first failed save; the tiny marker usually fits even when the quota is full. */
  private static markStale(timestamp: number): void {
    try {
      if (readItem(this.STALE_KEY) === null) {
        writeItemOrThrow(this.STALE_KEY, String(timestamp));
      }
    } catch (error) {
      console.error('[Cache] Failed to mark cache as out of date:', error);
    }
  }

  /**
   * Loads the cached session. Returns null (and drops the stored entry) when the cache is missing,
   * unparsable, from another version, or does not have the expected shape, so callers can start fresh.
   */
  static load(): CacheData | null {
    try {
      const indexJson = readItem(this.INDEX_KEY);
      if (indexJson !== null) return this.loadIndexed(indexJson);
      return this.loadLegacy();
    } catch (error) {
      console.error('[Cache] Failed to load:', error);
      this.clear();
      return null;
    }
  }

  /** Version 2: the index and the tab keys it lists (tabs whose entry is missing or broken are skipped). */
  private static loadIndexed(indexJson: string): CacheData | null {
    const index: unknown = JSON.parse(indexJson);
    if (!this.isRecord(index) || index.version !== this.VERSION || !Array.isArray(index.tabIds)) {
      console.warn('[Cache] Version mismatch, clearing cache');
      this.clear();
      return null;
    }
    const tabs: CacheData['tabs'] = [];
    const memoTabs = new Map<string, string>();
    for (const id of index.tabIds) {
      if (typeof id !== 'string') continue;
      const json = readItem(this.tabKey(id));
      if (json === null) {
        console.warn('[Cache] Missing cached tab, skipped:', id);
        continue;
      }
      try {
        tabs.push(JSON.parse(json) as CacheData['tabs'][number]);
        memoTabs.set(id, json);
      } catch {
        console.warn('[Cache] Unreadable cached tab, skipped:', id);
      }
    }
    const data = {
      projectName: index.projectName,
      tabs,
      activeTabId: index.activeTabId,
      timestamp: index.timestamp,
    };
    if (!this.isCacheData(data)) {
      console.warn('[Cache] Invalid cache contents, clearing cache');
      this.clear();
      return null;
    }
    // What is stored now: unchanged tabs are not rewritten by the next save
    this.memo = { index: indexJson, tabs: memoTabs };
    logger.debug('Cache', 'Loaded from localStorage');
    return data;
  }

  /** Version 1 (single key), migrated by the next save. */
  private static loadLegacy(): CacheData | null {
    const item = readItem(this.LEGACY_KEY);
    if (!item) return null;

    const cacheObject: unknown = JSON.parse(item);
    if (!this.isRecord(cacheObject) || cacheObject.version !== this.LEGACY_VERSION) {
      console.warn('[Cache] Version mismatch, clearing cache');
      this.clear();
      return null;
    }

    if (!this.isCacheData(cacheObject.data)) {
      console.warn('[Cache] Invalid cache contents, clearing cache');
      this.clear();
      return null;
    }

    logger.debug('Cache', 'Loaded from localStorage (single-key cache, migrated on the next save)');
    return cacheObject.data;
  }

  static clear(): void {
    this.memo = null;
    for (const key of listKeys(this.TAB_PREFIX)) removeItem(key);
    removeItem(this.INDEX_KEY);
    removeItem(this.LEGACY_KEY);
    removeItem(this.STALE_KEY);
    logger.debug('Cache', 'Cleared');
  }

  static exists(): boolean {
    return readItem(this.INDEX_KEY) !== null || readItem(this.LEGACY_KEY) !== null;
  }

  private static isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  /** A usable cache has at least one tab, and every tab has string id, name and graph XML. */
  private static isCacheData(value: unknown): value is CacheData {
    if (!this.isRecord(value)) return false;
    if (typeof value.projectName !== 'string') return false;
    if (!Array.isArray(value.tabs) || value.tabs.length === 0) return false;
    return value.tabs.every(
      (tab: unknown) =>
        this.isRecord(tab) &&
        typeof tab.id === 'string' &&
        typeof tab.name === 'string' &&
        typeof tab.graphXml === 'string'
    );
  }

  private static isQuotaExceeded(error: unknown): boolean {
    if (!(error instanceof DOMException)) return false;
    // 22: legacy QUOTA_EXCEEDED_ERR; 1014: Firefox NS_ERROR_DOM_QUOTA_REACHED
    return (
      error.code === 22 ||
      error.code === 1014 ||
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    );
  }
}
