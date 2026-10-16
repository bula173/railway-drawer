/**
 * Regression: a corrupt or old-format cache made restoreFromCache() create no tab while startup
 * had already chosen the restore branch, leaving the app with zero tabs (no canvas, no "+").
 * The startup logic in legacy-main.ts is mirrored in startApp().
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TabManager } from '../../ui/tabs';
import { CacheService } from '../../services/cache-service';
import { ProjectService } from '../../services/project-service';
import { globalNotificationManager } from '../../ui/notification';
import { loadAppDom, clearAppDom } from './app-dom';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const CACHE_KEY = 'railway-drawer-cache';

/** Same sequence as legacy-main.ts: try the cache, then make sure at least one tab exists. */
function startApp(): TabManager {
  const tabManager = new TabManager('tabs-container', 'graph-container');
  if (CacheService.exists()) {
    tabManager.restoreFromCache();
  }
  if (tabManager.getAllTabs().length === 0) {
    tabManager.createTab('Diagram 1');
  }
  return tabManager;
}

describe('TabManager cache restore', () => {
  let tabManager: TabManager | null = null;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // jsdom's Blob is not accepted by Node's URL.createObjectURL (used for the grid background)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    // jsdom has no 2D canvas; the drawing overlay copes with a missing context
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      }
    );
    loadAppDom();
    localStorage.clear();
  });

  afterEach(() => {
    tabManager?.destroy();
    tabManager = null;
    localStorage.clear();
    clearAppDom();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    ['unparsable JSON', '{not json'],
    ['JSON without tabs', JSON.stringify({ version: 1, data: { projectName: 'x' } })],
    ['empty tab list', JSON.stringify({ data: { projectName: 'x', tabs: [], activeTabId: null } })],
    ['wrong field types', JSON.stringify({ data: { projectName: 1, tabs: [{ id: 2 }] } })],
  ])('falls back to exactly one tab for a cache with %s', (_label, raw) => {
    localStorage.setItem(CACHE_KEY, raw);

    tabManager = startApp();

    expect(tabManager.getAllTabs()).toHaveLength(1);
    expect(tabManager.getActiveTab()?.name).toBe('Diagram 1');
    expect(document.querySelectorAll('#graph-container > div')).toHaveLength(1);
  });

  it('restores a valid cache with UTF-8 tab names instead of adding a fresh tab', () => {
    const first = new TabManager('tabs-container', 'graph-container');
    const tab = first.createTab('Węzeł Łódź');
    tab.graph.insertVertex(tab.graph.getDefaultParent(), null, 'Żółw', 0, 0, 40, 40);
    CacheService.save({
      projectName: 'Projekt',
      tabs: [{ id: tab.id, name: tab.name, graphXml: tab.saveLoadController.serializeToXml() }],
      activeTabId: tab.id,
      timestamp: Date.now(),
    });
    first.destroy();
    clearAppDom();
    loadAppDom();

    tabManager = startApp();

    const tabs = tabManager.getAllTabs();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].name).toBe('Węzeł Łódź');
    const labels = tabs[0].graph.getChildVertices(tabs[0].graph.getDefaultParent()).map((c) => c.getValue());
    expect(labels).toEqual(['Żółw']);
  });

  it('flushCache writes the latest edits now and reports a failed write', () => {
    tabManager = startApp();
    const tab = tabManager.getActiveTab()!;
    tab.graph.insertVertex(tab.graph.getDefaultParent(), null, 'Flushed', 0, 0, 40, 40);

    expect(tabManager.flushCache()).toBe(true);
    expect(localStorage.getItem(CACHE_KEY)).toContain('Flushed');

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(tabManager.flushCache()).toBe(false);
  });

  it('restores a cache written in the legacy <GraphDataModel> format and migrates it to draw.io XML', () => {
    const legacyCache = readFileSync(resolve(__dirname, '../fixtures/drawio/legacy-cache.json'), 'utf8');
    expect(legacyCache).toContain('<GraphDataModel');
    localStorage.setItem(CACHE_KEY, legacyCache);

    tabManager = startApp();

    const tabs = tabManager.getAllTabs();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].name).toBe('Stara karta');
    const model = tabs[0].graph.getDataModel();
    expect(model.getCell('a')?.getValue()).toBe('Signal\nA1');
    expect(model.getCell('ab')?.getTerminal(true)).toBe(model.getCell('a'));

    // Rewritten right after the restore, in the native format (no version bump, nothing dropped)
    const migrated = CacheService.load();
    expect(migrated?.tabs).toHaveLength(1);
    expect(migrated?.tabs[0].name).toBe('Stara karta');
    expect(CacheService.needsMigration(migrated!)).toBe(false);
    expect(migrated?.tabs[0].graphXml.startsWith('<mxGraphModel')).toBe(true);
    expect(migrated?.tabs[0].graphXml).toContain('PLANTUML_METADATA_UTF8:');
  });

  it('keeps pages 2..n of an opened multi-page file across a browser reload', async () => {
    const page = (id: string, name: string, label: string): string =>
      `<diagram id="${id}" name="${name}"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>` +
      `<mxCell id="v" value="${label}" vertex="1" parent="1"><mxGeometry width="40" height="40" as="geometry"/></mxCell>` +
      '</root></mxGraphModel></diagram>';
    const file = new File(
      [`<mxfile host="app.diagrams.net">${page('p1', 'One', 'A')}${page('p2', 'Two', 'B')}${page('p3', 'Three', 'C')}</mxfile>`],
      'three.drawio'
    );
    vi.spyOn(globalNotificationManager, 'warning').mockReturnValue('');
    const first = new TabManager('tabs-container', 'graph-container');
    const opened = first.createTab('Opened');
    await opened.saveLoadController.loadProjectFromFile(file);
    (first as unknown as { saveToCache(): void }).saveToCache();
    first.destroy();
    clearAppDom();
    loadAppDom();

    // Reload: the restored tab writes all three pages again
    tabManager = startApp();
    const exportSpy = vi.spyOn(ProjectService.prototype, 'exportToFile').mockImplementation(() => {});
    tabManager.getAllTabs()[0].saveLoadController.saveProject();
    const saved = new DOMParser().parseFromString(exportSpy.mock.calls[0][0], 'text/xml');
    const diagrams = Array.from(saved.getElementsByTagName('diagram'));
    expect(diagrams.map((d) => d.getAttribute('id'))).toEqual(['p1', 'p2', 'p3']);
    expect(diagrams.map((d) => d.getElementsByTagName('mxCell')[2].getAttribute('value'))).toEqual(['A', 'B', 'C']);
  });

  it('keeps legacy XML of a tab that cannot be restored instead of migrating it', () => {
    const broken = '<GraphDataModel><root><Cell id="0"/><Cell id="1" parent="0"/><Cell id="1" parent="0"/></root>';
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        version: '1',
        data: { projectName: 'p', tabs: [{ id: 't', name: 'Broken', graphXml: broken }], activeTabId: 't', timestamp: 1 },
      })
    );
    vi.spyOn(globalNotificationManager, 'warning').mockReturnValue('');

    tabManager = startApp();
    (tabManager as unknown as { saveToCache(): void }).saveToCache();

    expect(CacheService.load()?.tabs[0].graphXml).toBe(broken);
  });
});
