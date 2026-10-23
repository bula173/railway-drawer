/**
 * Incremental autosave: per-tab keys, dirty tabs only, idle scheduling, migration of the single-key
 * cache of earlier versions.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TabManager } from '../../ui/tabs';
import { SaveLoadController } from '../../ui/saveload';
import { CacheService } from '../../services/cache-service';
import { loadAppDom, clearAppDom } from './app-dom';
import { storedAutosave } from './autosave-store';

const MODEL = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>';

describe('CacheService per-tab layout', () => {
  beforeEach(() => {
    localStorage.clear();
    CacheService.clear();
  });
  afterEach(() => localStorage.clear());

  const session = (tabs: Array<{ id: string; name: string }>) => ({
    projectName: 'P',
    tabs: tabs.map((t) => ({ ...t, graphXml: MODEL })),
    activeTabId: tabs[0].id,
    timestamp: 1,
  });

  it('writes an index and one key per tab, and removes the keys of closed tabs', () => {
    expect(CacheService.save(session([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]))).toBe('saved');
    expect(JSON.parse(localStorage.getItem('rd.cache.index')!)).toMatchObject({ version: '2', tabIds: ['a', 'b'], activeTabId: 'a' });
    expect(JSON.parse(localStorage.getItem('rd.cache.tab.b')!)).toMatchObject({ id: 'b', name: 'B', graphXml: MODEL });
    CacheService.save(session([{ id: 'b', name: 'B' }]));
    expect(localStorage.getItem('rd.cache.tab.a')).toBeNull();
    expect(CacheService.load()?.tabs.map((t) => t.id)).toEqual(['b']);
  });

  it('rewrites only the tabs whose entry changed', () => {
    CacheService.save(session([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]));
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    CacheService.save(session([{ id: 'a', name: 'A' }, { id: 'b', name: 'B2' }]));
    expect(setItem.mock.calls.map((c) => c[0])).toEqual(['rd.cache.tab.b', 'rd.cache.index']);
    setItem.mockRestore();
  });

  it('writes everything again when the stored index is not the one this page wrote', () => {
    CacheService.save(session([{ id: 'a', name: 'A' }]));
    localStorage.clear(); // e.g. site data cleared, or another window wrote its session
    CacheService.save(session([{ id: 'a', name: 'A' }]));
    expect(storedAutosave()?.data.tabs).toHaveLength(1);
  });

  it('reads the single-key cache of earlier versions and migrates it on the next save', () => {
    localStorage.setItem(
      'railway-drawer-cache',
      JSON.stringify({ version: '1', data: { projectName: 'Old', tabs: [{ id: 'o', name: 'Old', graphXml: MODEL }], activeTabId: 'o', timestamp: 5 } })
    );
    const data = CacheService.load()!;
    expect(data.projectName).toBe('Old');
    expect(CacheService.exists()).toBe(true);
    expect(CacheService.save(data)).toBe('saved');
    expect(localStorage.getItem('railway-drawer-cache')).toBeNull();
    expect(CacheService.load()?.tabs[0]).toMatchObject({ id: 'o', name: 'Old' });
  });

  it('skips a tab whose entry is missing or broken, and clears an unusable cache', () => {
    CacheService.save(session([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]));
    localStorage.setItem('rd.cache.tab.a', '{broken');
    expect(CacheService.load()?.tabs.map((t) => t.id)).toEqual(['b']);
    localStorage.removeItem('rd.cache.tab.b');
    expect(CacheService.load()).toBeNull();
    expect(CacheService.exists()).toBe(false);
  });
});

describe('TabManager incremental autosave', () => {
  let tm: TabManager | null = null;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.stubGlobal('ResizeObserver', class { observe(): void {} unobserve(): void {} disconnect(): void {} });
    loadAppDom();
    localStorage.clear();
    CacheService.clear();
  });

  afterEach(() => {
    tm?.destroy();
    tm = null;
    localStorage.clear();
    clearAppDom();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const save = (m: TabManager): boolean => (m as unknown as { saveToCache(): boolean }).saveToCache();

  it('serialises only the tabs that changed since the last autosave', () => {
    tm = new TabManager('tabs-container', 'graph-container');
    const one = tm.createTab('One');
    const two = tm.createTab('Two');
    expect(save(tm)).toBe(true);
    const serialize = vi.spyOn(SaveLoadController.prototype, 'serializeToXml');
    expect(save(tm)).toBe(true);
    expect(serialize).not.toHaveBeenCalled();

    two.graph.insertVertex(two.graph.getDefaultParent(), null, 'Edited', 0, 0, 40, 40);
    save(tm);
    expect(serialize).toHaveBeenCalledTimes(1);
    expect(serialize.mock.contexts[0]).toBe(two.saveLoadController);
    expect(storedAutosave()?.data.tabs.find((t) => t.id === two.id)?.graphXml).toContain('Edited');

    one.graph.gridEnabled = !one.graph.gridEnabled; // not a model change: the fingerprint sees it
    serialize.mockClear();
    save(tm);
    expect(serialize.mock.contexts).toContain(one.saveLoadController);
  });

  it('caches scenario and tab name changes without serialising the model again', () => {
    tm = new TabManager('tabs-container', 'graph-container');
    const tab = tm.createTab('One');
    save(tm);
    const serialize = vi.spyOn(SaveLoadController.prototype, 'serializeToXml');
    tab.saveLoadController.getScenarios().create('S', '');
    tm.renameTab(tab.id, 'Renamed');
    save(tm);
    expect(serialize).not.toHaveBeenCalled();
    const stored = storedAutosave()!.data.tabs[0];
    expect(stored.name).toBe('Renamed');
    expect(stored.scenarios).toHaveLength(1);
  });

  it('runs the 5 s autosave in an idle period', () => {
    vi.useFakeTimers();
    const idle = vi.fn((cb: () => void) => setTimeout(cb, 50) as unknown as number);
    vi.stubGlobal('requestIdleCallback', idle);
    vi.stubGlobal('cancelIdleCallback', (h: number) => clearTimeout(h));
    tm = new TabManager('tabs-container', 'graph-container');
    tm.createTab('One');
    vi.advanceTimersByTime(5000);
    expect(idle).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('rd.cache.index')).toBeNull();
    vi.advanceTimersByTime(50);
    expect(localStorage.getItem('rd.cache.index')).not.toBeNull();
  });
});
