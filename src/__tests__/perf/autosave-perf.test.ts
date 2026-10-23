/**
 * Autosave cost with 5 tabs × a large diagram (RD_PERF=1 npx vitest run src/__tests__/perf).
 * Skipped otherwise: timings are machine dependent. Prints the "before" path (every tab serialised
 * and the whole session written as one JSON string, as the single-key autosave did) against the
 * incremental per-tab autosave (TabManager.saveToCache) with nothing / one tab changed.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TabManager } from '../../ui/tabs';
import { loadAppDom, clearAppDom } from '../ui/app-dom';

const TABS = 5;
const VERTICES = 1500;
const RUNS = 5;

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

describe.skipIf(!process.env.RD_PERF)('autosave performance', () => {
  let tm: TabManager | null = null;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.stubGlobal('ResizeObserver', class { observe(): void {} unobserve(): void {} disconnect(): void {} });
    loadAppDom();
    localStorage.clear();
  });

  afterEach(() => {
    tm?.destroy();
    tm = null;
    localStorage.clear();
    clearAppDom();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it(`${TABS} tabs × ${VERTICES} vertices + ${VERTICES - 1} edges`, () => {
    tm = new TabManager('tabs-container', 'graph-container');
    const tabs = Array.from({ length: TABS }, (_, i) => tm!.createTab(`Big ${i + 1}`));
    for (const tab of tabs) {
      const g = tab.graph;
      const parent = g.getDefaultParent();
      g.batchUpdate(() => {
        let prev = null;
        for (let v = 0; v < VERTICES; v++) {
          const cell = g.insertVertex(parent, null, `Signal ${v}`, (v % 50) * 60, Math.floor(v / 50) * 60, 40, 30, { fillColor: '#ffeecc', rounded: 1 } as never);
          if (prev) g.insertEdge(parent, null, '', prev, cell);
          prev = cell;
        }
      });
    }
    const save = (): boolean => (tm as unknown as { saveToCache(): boolean }).saveToCache();

    // before: every tab serialised, one JSON string of the whole session, one write
    const before: number[] = [];
    let bytes = 0;
    for (let r = 0; r < RUNS; r++) {
      const t0 = performance.now();
      const data = {
        version: '1',
        data: {
          projectName: 'P',
          tabs: tabs.map((t) => ({ id: t.id, name: t.name, graphXml: t.saveLoadController.serializeToXml() })),
          activeTabId: tabs[0].id,
          timestamp: Date.now(),
        },
      };
      const json = JSON.stringify(data);
      localStorage.setItem('perf-single-key', json);
      before.push(performance.now() - t0);
      bytes = json.length;
    }
    localStorage.removeItem('perf-single-key');

    expect(save()).toBe(true); // first save: everything
    const idle: number[] = [];
    for (let r = 0; r < RUNS; r++) {
      const t0 = performance.now();
      save();
      idle.push(performance.now() - t0);
    }
    const oneTab: number[] = [];
    for (let r = 0; r < RUNS; r++) {
      const g = tabs[2].graph;
      g.insertVertex(g.getDefaultParent(), null, `extra ${r}`, 0, 0, 10, 10);
      const t0 = performance.now();
      save();
      oneTab.push(performance.now() - t0);
    }
    const line = (label: string, v: number[]): string => `${label}: median ${median(v).toFixed(1)} ms (runs ${v.map((x) => x.toFixed(0)).join('/')})`;
    process.stdout.write(
      [
        `autosave, ${TABS} tabs, session JSON ${(bytes / 1e6).toFixed(2)} MB`,
        line('before (all tabs serialised, single key)', before),
        line('after, nothing changed', idle),
        line('after, one tab changed', oneTab),
      ].join('\n') + '\n'
    );
  }, 300_000);
});
