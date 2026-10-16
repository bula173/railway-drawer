import { isLegacyModelXml } from './drawio-xml';
import type { ScenarioData } from '../scenarios/scenario-model';

export interface CacheData {
  projectName: string;
  tabs: Array<{
    id: string;
    name: string;
    graphXml: string;
    /**
     * Pages 2..n of the file opened in the tab (serialized <diagram> elements) and the shown
     * page's <diagram> id, so a save after a reload still writes every page. Missing in
     * caches of earlier versions; ignored when malformed.
     */
    extraPages?: string[];
    pageId?: string | null;
    /** The tab's scenarios (steps hold full drawing snapshots). Missing when there are none; sanitized on restore. */
    scenarios?: ScenarioData[];
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

export class CacheService {
  private static readonly CACHE_KEY = 'railway-drawer-cache';
  /**
   * Set when a save fails, holding the time of the first failed save. The previous cache entry
   * stays in place (it is still the best copy there is), but it no longer matches the session,
   * so a later restore can tell the user that it is out of date.
   */
  private static readonly STALE_KEY = 'railway-drawer-cache-stale';
  /**
   * Not bumped for the switch to the draw.io format: a version mismatch drops the whole cache.
   * Tabs cached as <GraphDataModel> still load and are rewritten after a successful restore
   * (see isLegacyGraphXml / TabManager.restoreFromCache).
   */
  private static readonly VERSION = '1';

  /** True when a cached tab still holds the legacy maxGraph format and needs migrating. */
  static isLegacyGraphXml(graphXml: string): boolean {
    return isLegacyModelXml(graphXml);
  }

  /** True when any tab of the cached session is in the legacy maxGraph format. */
  static needsMigration(data: CacheData): boolean {
    return data.tabs.some((tab) => this.isLegacyGraphXml(tab.graphXml));
  }

  static save(data: CacheData): CacheSaveResult {
    try {
      const cacheObject = {
        version: this.VERSION,
        data,
      };
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheObject));
      localStorage.removeItem(this.STALE_KEY);
      console.log('[Cache] Saved to localStorage');
      return 'saved';
    } catch (error) {
      console.error('[Cache] Failed to save:', error);
      this.markStale(data.timestamp);
      return this.isQuotaExceeded(error) ? 'quota-exceeded' : 'failed';
    }
  }

  /**
   * Time of the first save that failed after the stored entry was written, or null when the
   * stored entry is the latest saved state. A non-null value means a restore is out of date.
   */
  static getStaleSince(): number | null {
    try {
      const value = localStorage.getItem(this.STALE_KEY);
      if (value === null) return null;
      const timestamp = Number(value);
      return Number.isFinite(timestamp) ? timestamp : Date.now();
    } catch {
      return null;
    }
  }

  /** Records the first failed save; the tiny marker usually fits even when the quota is full. */
  private static markStale(timestamp: number): void {
    try {
      if (localStorage.getItem(this.STALE_KEY) === null) {
        localStorage.setItem(this.STALE_KEY, String(timestamp));
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
      const item = localStorage.getItem(this.CACHE_KEY);
      if (!item) return null;

      const cacheObject: unknown = JSON.parse(item);
      if (!this.isRecord(cacheObject) || cacheObject.version !== this.VERSION) {
        console.warn('[Cache] Version mismatch, clearing cache');
        this.clear();
        return null;
      }

      if (!this.isCacheData(cacheObject.data)) {
        console.warn('[Cache] Invalid cache contents, clearing cache');
        this.clear();
        return null;
      }

      console.log('[Cache] Loaded from localStorage');
      return cacheObject.data;
    } catch (error) {
      console.error('[Cache] Failed to load:', error);
      this.clear();
      return null;
    }
  }

  static clear(): void {
    try {
      localStorage.removeItem(this.CACHE_KEY);
      localStorage.removeItem(this.STALE_KEY);
      console.log('[Cache] Cleared');
    } catch (error) {
      console.error('[Cache] Failed to clear:', error);
    }
  }

  static exists(): boolean {
    try {
      return localStorage.getItem(this.CACHE_KEY) !== null;
    } catch {
      return false;
    }
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
