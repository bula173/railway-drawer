export interface CacheData {
  projectName: string;
  tabs: Array<{
    id: string;
    name: string;
    graphXml: string;
  }>;
  activeTabId: string;
  timestamp: number;
}

export class CacheService {
  private static readonly CACHE_KEY = 'railway-drawer-cache';
  private static readonly VERSION = '1';

  static save(data: CacheData): void {
    try {
      const cacheObject = {
        version: this.VERSION,
        data,
      };
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheObject));
      console.log('[Cache] Saved to localStorage');
    } catch (error) {
      console.error('[Cache] Failed to save:', error);
    }
  }

  static load(): CacheData | null {
    try {
      const item = localStorage.getItem(this.CACHE_KEY);
      if (!item) return null;

      const cacheObject = JSON.parse(item);
      if (cacheObject.version !== this.VERSION) {
        console.warn('[Cache] Version mismatch, clearing cache');
        this.clear();
        return null;
      }

      console.log('[Cache] Loaded from localStorage');
      return cacheObject.data;
    } catch (error) {
      console.error('[Cache] Failed to load:', error);
      return null;
    }
  }

  static clear(): void {
    localStorage.removeItem(this.CACHE_KEY);
    console.log('[Cache] Cleared');
  }

  static exists(): boolean {
    return localStorage.getItem(this.CACHE_KEY) !== null;
  }
}
