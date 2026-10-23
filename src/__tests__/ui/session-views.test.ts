/**
 * The shell's panels are views bound to the active session (session.ts, session-views.ts): a tab
 * switch rebinds them, an edit on a background tab (through its graph) never changes what they show.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TabManager } from '../../ui/tabs';
import { activeSession } from '../../ui/session';
import { loadAppDom, clearAppDom } from './app-dom';

describe('session views', () => {
  let tabManager: TabManager | null = null;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.stubGlobal('ResizeObserver', class { observe(): void {} unobserve(): void {} disconnect(): void {} });
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

  const state = (): string | undefined => document.getElementById('property-content')?.dataset.state;
  const header = (): string => document.getElementById('prop-selection-header')?.textContent ?? '';

  /** What the shared panels show. */
  const shown = () => ({
    state: state(),
    header: header(),
    selected: document.getElementById('status-selected')?.textContent,
    zoom: document.getElementById('status-zoom')?.textContent,
    layers: document.getElementById('layers-list')?.textContent,
    undoDisabled: (document.getElementById('btn-undo') as HTMLButtonElement | null)?.disabled,
  });

  it('the active session follows the shown tab', () => {
    tabManager = new TabManager('tabs-container', 'graph-container');
    const first = tabManager.createTab('First');
    expect(activeSession()).toBe(first);
    const second = tabManager.createTab('Second');
    expect(activeSession()).toBe(first);
    tabManager.switchTab(second.id);
    expect(activeSession()).toBe(second);
    tabManager.closeTab(second.id);
    expect(activeSession()).toBe(first);
    tabManager.destroy();
    tabManager = null;
    expect(activeSession()).toBeNull();
  });

  it('an edit on a background tab does not change the shown properties, status, layers or undo state', () => {
    tabManager = new TabManager('tabs-container', 'graph-container');
    const first = tabManager.createTab('First');
    const second = tabManager.createTab('Second');
    const a = first.graph.insertVertex(first.graph.getDefaultParent(), null, 'Shown', 10, 10, 80, 40);
    first.graph.setSelectionCell(a);
    expect(state()).toBe('cell');
    const before = shown();

    // the background tab: a new layer, a selected shape, a zoom, an undoable edit
    const model = second.graph.getDataModel();
    second.graph.batchUpdate(() => {
      const b = second.graph.insertVertex(second.graph.getDefaultParent(), null, 'Background', 10, 10, 80, 40);
      second.graph.insertVertex(second.graph.getDefaultParent(), null, 'Other', 100, 10, 80, 40);
      second.graph.setSelectionCells([b]);
    });
    second.graph.zoomTo(2);
    model.setValue(second.graph.getSelectionCell(), 'Renamed');
    second.graph.clearSelection();

    expect(shown()).toEqual(before);

    // shown: the panels follow it
    tabManager.switchTab(second.id);
    expect(state()).not.toBe('cell');
    second.graph.setSelectionCell(second.graph.getChildVertices(second.graph.getDefaultParent())[0]);
    expect(state()).toBe('cell');
    expect(header()).toContain('Renamed');
    // and the first tab is now the background one
    first.graph.clearSelection();
    expect(state()).toBe('cell');
  });
});
