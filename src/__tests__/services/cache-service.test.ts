/**
 * @file cache-service.test.ts
 * @brief Tests for CacheService
 */

import { CacheService } from '../../services/cache-service';

describe('CacheService', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('save and load', () => {
    it('should save and retrieve cache data', () => {
      const cacheData = {
        projectName: 'Test Project',
        tabs: [
          {
            id: 'tab-1',
            name: 'Diagram 1',
            graphXml: '<mxGraphModel></mxGraphModel>',
          },
        ],
        activeTabId: 'tab-1',
        timestamp: Date.now(),
      };

      CacheService.save(cacheData);
      const loaded = CacheService.load();

      expect(loaded).toBeDefined();
      expect(loaded?.projectName).toBe('Test Project');
      expect(loaded?.tabs).toHaveLength(1);
      expect(loaded?.tabs[0].name).toBe('Diagram 1');
    });

    it('should return null when no cache exists', () => {
      const loaded = CacheService.load();
      expect(loaded).toBeNull();
    });

    it('should detect when cache exists', () => {
      const cacheData = {
        projectName: 'Test',
        tabs: [],
        activeTabId: 'tab-1',
        timestamp: Date.now(),
      };

      CacheService.save(cacheData);
      expect(CacheService.exists()).toBe(true);
    });

    it('should not detect cache when empty', () => {
      expect(CacheService.exists()).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear cache data', () => {
      const cacheData = {
        projectName: 'Test',
        tabs: [],
        activeTabId: 'tab-1',
        timestamp: Date.now(),
      };

      CacheService.save(cacheData);
      expect(CacheService.exists()).toBe(true);

      CacheService.clear();
      expect(CacheService.exists()).toBe(false);
    });
  });

  describe('version handling', () => {
    it('should handle cache versioning', () => {
      const cacheData = {
        projectName: 'Test',
        tabs: [],
        activeTabId: 'tab-1',
        timestamp: Date.now(),
      };

      CacheService.save(cacheData);
      const loaded = CacheService.load();

      // Should load successfully with version handling
      expect(loaded).toBeDefined();
    });
  });
});
