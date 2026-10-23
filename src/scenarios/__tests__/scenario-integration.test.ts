/**
 * Scenarios with real tabs: cache restore, the read-only scenario view (never changes the live
 * drawing or its undo history), "Replace drawing with this step" (undoable), the keyboard while
 * viewing, and the right-panel UI.
 */
import { isAutosaveKey, storedAutosave, writeStoredAutosaveTab } from '../../__tests__/ui/autosave-store';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TabManager } from '../../ui/tabs';
import type { TabData } from '../../ui/tabs';
import { CacheService } from '../../services/cache-service';
import { loadAppDom, clearAppDom } from '../../__tests__/ui/app-dom';
import { installScenarios } from '../install-scenarios';
import type { ScenariosHandle } from '../install-scenarios';
import { captureDrawing, replaceDrawingWithSnapshot } from '../scenario-actions';
import { scenarioKeyAction } from '../scenario-keys';

const notify = { success: vi.fn(), warning: vi.fn(), error: vi.fn() };

function labels(tab: TabData | { graph: TabData['graph'] }): string[] {
  const graph = tab.graph;
  return graph
    .getChildCells(graph.getDefaultParent())
    .map((c) => String(c.getValue()))
    .sort();
}

function history(tab: TabData): { length: number; next: number } {
  const manager = (tab.graphCommandService as unknown as { undoManager: { history: unknown[]; indexOfNextAdd: number } })
    .undoManager;
  return { length: manager.history.length, next: manager.indexOfNextAdd };
}

function key(init: KeyboardEventInit, target?: EventTarget): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  if (target) Object.defineProperty(e, 'target', { value: target });
  return e;
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

/** Fills and confirms the app's name/description modal. */
async function answerDialog(name?: string, description?: string): Promise<void> {
  await settle();
  const dialog = document.querySelector('.rd-tpl-modal');
  expect(dialog).not.toBeNull();
  if (name !== undefined) (dialog!.querySelector('input[name="template-name"]') as HTMLInputElement).value = name;
  if (description !== undefined) (dialog!.querySelector('input[name="template-description"]') as HTMLInputElement).value = description;
  (dialog!.querySelector('.rd-tpl-btn-primary, .rd-tpl-btn-danger') as HTMLButtonElement).click();
  await settle();
}

describe('scenarios with tabs', () => {
  let tabManager: TabManager | null = null;
  let handle: ScenariosHandle | null = null;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
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
    notify.success.mockClear();
    notify.warning.mockClear();
    notify.error.mockClear();
  });

  afterEach(() => {
    handle?.destroy();
    handle = null;
    tabManager?.destroy();
    tabManager = null;
    localStorage.clear();
    document.body.classList.remove('rd-scenario-viewing');
    clearAppDom();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function start(): { tm: TabManager; tab: TabData; h: ScenariosHandle } {
    tabManager = new TabManager('tabs-container', 'graph-container');
    const tab = tabManager.createTab('Węzeł Łódź');
    handle = installScenarios(tabManager, notify, document.getElementById('graph-container')!, { thumbnails: null });
    return { tm: tabManager, tab, h: handle };
  }

  function insert(tab: TabData, label: string, x = 10): void {
    tab.graph.insertVertex(tab.graph.getDefaultParent(), null, label, x, 10, 60, 30);
  }

  it('keeps scenarios in the tab cache and restores them', () => {
    const { tm, tab } = start();
    insert(tab, 'A');
    const set = tab.document.scenarios;
    const s = set.create('Wjazd "IC" <1>', 'opis ąę');
    set.addStep(s.id, { name: 'Krok 1', description: 'd', xml: captureDrawing(tab.document) });
    expect(tm.flushCache()).toBe(true);
    const cached = storedAutosave()!;
    expect(cached.data.tabs[0].scenarios).toHaveLength(1);
    const expected = set.list();

    handle!.destroy();
    handle = null;
    tm.destroy();
    clearAppDom();
    loadAppDom();
    tabManager = new TabManager('tabs-container', 'graph-container');
    expect(CacheService.exists()).toBe(true);
    expect(tabManager.restoreFromCache()).toBe(true);
    const restored = tabManager.getActiveTab()!;
    expect(restored.document.scenarios.list()).toEqual(expected);
    expect(labels(restored)).toEqual(['A']);
  });

  it('writes no scenarios key for tabs without scenarios, and sanitizes a damaged cache entry', () => {
    const { tm } = start();
    tm.flushCache();
    expect(storedAutosave()!.data.tabs[0].scenarios).toBeUndefined();

    const raw = storedAutosave()!;
    raw.data.tabs[0].scenarios = [{ id: 'x', name: 'Ok', steps: [{ name: 'no xml' }, { id: 'st', name: 'good', xml: '<mxGraphModel/>' }] }, 7];
    writeStoredAutosaveTab(raw.data.tabs[0]);
    handle!.destroy();
    handle = null;
    tm.destroy();
    clearAppDom();
    loadAppDom();
    tabManager = new TabManager('tabs-container', 'graph-container');
    tabManager.restoreFromCache();
    const list = tabManager.getActiveTab()!.document.scenarios.list();
    expect(list).toHaveLength(1);
    expect(list[0].steps.map((s) => s.name)).toEqual(['good']);
  });

  it('viewing steps never changes the live drawing or its undo history', () => {
    const { tab, h } = start();
    insert(tab, 'A');
    const set = tab.document.scenarios;
    const s = set.create('S');
    set.addStep(s.id, { name: 'only A', xml: captureDrawing(tab.document) });
    insert(tab, 'B', 100);
    set.addStep(s.id, { name: 'A and B', xml: captureDrawing(tab.document) });
    insert(tab, 'C', 200);
    tab.graph.setSelectionCells(tab.graph.getChildCells(tab.graph.getDefaultParent()).slice(0, 1));

    const liveXml = tab.document.serializeToXml();
    const before = history(tab);
    const liveDiv = document.getElementById(`graph-${tab.id}`)!;

    expect(h.viewer.open(tab.id, s.id, 0)).toBe(true);
    expect(liveDiv.style.display).toBe('none');
    expect(document.body.classList.contains('rd-scenario-viewing')).toBe(true);
    const view = h.viewer.getViewGraph()!;
    expect(view.isEnabled()).toBe(false);
    expect(labels({ graph: view })).toEqual(['A']);
    expect(document.querySelector('.rd-scn-banner-title')?.textContent).toBe('S — step 1/2: only A');

    // keyboard: arrows step, editing shortcuts are blocked and never reach the drawing
    const right = key({ key: 'ArrowRight' });
    expect(h.handleKeydown(right)).toBe(true);
    expect(right.defaultPrevented).toBe(true);
    expect(labels({ graph: view })).toEqual(['A', 'B']);
    expect(document.querySelector('.rd-scn-banner-title')?.textContent).toBe('S — step 2/2: A and B');
    h.handleKeydown(key({ key: 'ArrowRight' })); // clamped at the last step
    expect(h.viewer.getState()?.index).toBe(1);
    for (const init of [{ key: 'z', ctrlKey: true }, { key: 'Delete' }, { key: 'a', metaKey: true }, { key: 'v', ctrlKey: true }]) {
      const e = key(init);
      expect(h.handleKeydown(e)).toBe(true);
      expect(e.defaultPrevented).toBe(true);
    }
    h.handleKeydown(key({ key: 'Home' }));
    expect(h.viewer.getState()?.index).toBe(0);
    h.handleKeydown(key({ key: 'End' }));
    expect(h.viewer.getState()?.index).toBe(1);
    h.handleKeydown(key({ key: 'ArrowLeft' }));
    expect(h.viewer.getState()?.index).toBe(0);
    // typing in a field passes through to the normal handlers
    expect(h.handleKeydown(key({ key: 'ArrowLeft' }, document.createElement('input')))).toBe(false);

    // Escape: back to editing, exactly as before
    expect(h.handleKeydown(key({ key: 'Escape' }))).toBe(true);
    expect(h.viewer.isActive()).toBe(false);
    expect(liveDiv.style.display).toBe('block');
    expect(document.body.classList.contains('rd-scenario-viewing')).toBe(false);
    expect(tab.document.serializeToXml()).toBe(liveXml);
    expect(history(tab)).toEqual(before);
    expect(tab.graph.getSelectionCount()).toBe(1);
    expect(labels(tab)).toEqual(['A', 'B', 'C']);
    // and the live history still works
    tab.graphCommandService.undo();
    expect(labels(tab)).toEqual(['A', 'B']);
    // outside the view the arrows are not taken
    expect(h.handleKeydown(key({ key: 'ArrowRight' }))).toBe(false);
  });

  it('follows changes of the scenario while viewing and closes when its steps are gone', () => {
    const { tab, h } = start();
    insert(tab, 'A');
    const set = tab.document.scenarios;
    const s = set.create('S');
    const one = set.addStep(s.id, { name: 'one', xml: captureDrawing(tab.document) });
    insert(tab, 'B', 100);
    const two = set.addStep(s.id, { name: 'two', xml: captureDrawing(tab.document) });
    h.viewer.open(tab.id, s.id, 1);
    set.updateStep(s.id, two.id, { name: 'zwei' });
    expect(document.querySelector('.rd-scn-banner-title')?.textContent).toBe('S — step 2/2: zwei');
    set.removeStep(s.id, two.id);
    expect(h.viewer.getState()?.index).toBe(0);
    expect(labels({ graph: h.viewer.getViewGraph()! })).toEqual(['A']);
    set.removeStep(s.id, one.id);
    expect(h.viewer.isActive()).toBe(false);
    expect(document.getElementById(`graph-${tab.id}`)!.style.display).toBe('block');
  });

  it('closes the view when another tab is activated', () => {
    const { tm, tab, h } = start();
    insert(tab, 'A');
    const set = tab.document.scenarios;
    const s = set.create('S');
    set.addStep(s.id, { name: 'one', xml: captureDrawing(tab.document) });
    const other = tm.createTab('Other');
    h.viewer.open(tab.id, s.id, 0);
    tm.switchTab(other.id);
    expect(h.viewer.isActive()).toBe(false);
    // the first tab's div stays hidden (it is not the active one), the new one is shown
    expect(document.getElementById(`graph-${tab.id}`)!.style.display).toBe('none');
    expect(document.getElementById(`graph-${other.id}`)!.style.display).toBe('block');
  });

  it('the tab\'s project XML (File > Save, remote providers) carries the scenarios, and loading a file replaces them', async () => {
    const { tab } = start();
    insert(tab, 'A');
    const set = tab.document.scenarios;
    const s = set.create('Ruch');
    set.addStep(s.id, { name: 'Pierwszy', xml: captureDrawing(tab.document) });
    const xml = tab.document.getProjectXml();
    expect(xml).toContain('name="Ruch / 1. Pierwszy"');
    const expected = set.list();
    set.replaceAll([]);
    await tab.saveLoadController.loadProjectXml(xml, 'x.drawio', { quiet: true });
    expect(set.list()).toEqual(expected);
    // a file without scenarios leaves the tab without scenarios
    await tab.saveLoadController.loadProjectXml(`<mxfile><diagram id="p" name="P">${expected[0].steps[0].xml}</diagram></mxfile>`, 'y.drawio', {
      quiet: true,
    });
    expect(set.size).toBe(0);
  });

  it('warns right away when a new step does not fit into browser storage', async () => {
    start();
    (document.querySelector('[data-right-panel="scenarios"]') as HTMLButtonElement).click();
    const panel = document.getElementById('scenarios-panel')!;
    (panel.querySelector('.rd-scn-new') as HTMLButtonElement).click();
    await answerDialog('S');
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k: string) => {
      if (isAutosaveKey(k)) throw new DOMException('full', 'QuotaExceededError');
    });
    (panel.querySelector('.rd-scn-add-step-details') as HTMLButtonElement).click();
    await answerDialog('big');
    expect(panel.querySelectorAll('.rd-scn-step')).toHaveLength(1);
    expect(notify.warning).toHaveBeenCalledWith(expect.stringContaining('browser storage is full'));
    setItem.mockRestore();
  });

  it('"Replace drawing with this step" is one undoable edit', () => {
    const { tab } = start();
    insert(tab, 'A');
    const step = captureDrawing(tab.document);
    insert(tab, 'B', 100);
    replaceDrawingWithSnapshot(tab.graph, step);
    expect(labels(tab)).toEqual(['A']);
    tab.graphCommandService.undo();
    expect(labels(tab)).toEqual(['A', 'B']);
    tab.graphCommandService.redo();
    expect(labels(tab)).toEqual(['A']);
    expect(() => replaceDrawingWithSnapshot(tab.graph, '<html/>')).toThrow();
  });

  it('right panel: Properties by default, Scenarios lists the active tab and drives the view', async () => {
    const { tm, tab, h } = start();
    const props = document.getElementById('property-content')!;
    const panel = document.getElementById('scenarios-panel')!;
    expect(props.hidden).toBe(false);
    expect(panel.hidden).toBe(true);
    (document.querySelector('[data-right-panel="scenarios"]') as HTMLButtonElement).click();
    expect(props.hidden).toBe(true);
    expect(panel.hidden).toBe(false);
    expect(panel.querySelector('.rd-scn-empty')).not.toBeNull();
    expect(panel.querySelector('.rd-scn-tabname')?.textContent).toBe('Węzeł Łódź');

    // new scenario
    (panel.querySelector('.rd-scn-new') as HTMLButtonElement).click();
    await answerDialog('Wjazd', 'opis');
    expect(panel.querySelectorAll('.rd-scn-item')).toHaveLength(1);
    expect(panel.querySelector('.rd-scn-name')?.textContent).toBe('Wjazd');

    // 3 steps, the drawing changes in between
    for (const [i, label] of ['A', 'B', 'C'].entries()) {
      insert(tab, label, i * 100);
      (panel.querySelector('.rd-scn-add-step-details') as HTMLButtonElement).click();
      await answerDialog(`Krok ${label}`);
    }
    const stepNames = (): string[] => Array.from(panel.querySelectorAll('.rd-scn-step-name')).map((n) => n.textContent ?? '');
    expect(stepNames()).toEqual(['Krok A', 'Krok B', 'Krok C']);
    expect(panel.querySelector('.rd-scn-count')?.textContent).toBe('3 steps');

    // reorder with ↓ / ↑
    (panel.querySelectorAll('.rd-scn-step-down')[0] as HTMLButtonElement).click();
    expect(stepNames()).toEqual(['Krok B', 'Krok A', 'Krok C']);
    (panel.querySelectorAll('.rd-scn-step-up')[1] as HTMLButtonElement).click();
    expect(stepNames()).toEqual(['Krok A', 'Krok B', 'Krok C']);

    // click a step: shown on the canvas and highlighted
    (panel.querySelectorAll('.rd-scn-step')[1] as HTMLElement).click();
    expect(h.viewer.getState()?.index).toBe(1);
    expect(labels({ graph: h.viewer.getViewGraph()! })).toEqual(['A', 'B']);
    expect(panel.querySelectorAll('.rd-scn-step')[1].classList.contains('rd-scn-step-active')).toBe(true);
    (document.querySelector('.rd-scn-next') as HTMLButtonElement).click();
    expect(panel.querySelectorAll('.rd-scn-step')[2].classList.contains('rd-scn-step-active')).toBe(true);
    (document.querySelector('.rd-scn-exit') as HTMLButtonElement).click();
    expect(h.viewer.isActive()).toBe(false);
    expect(panel.querySelectorAll('.rd-scn-step-active')).toHaveLength(0);

    // rename step, delete step (confirmed)
    (panel.querySelectorAll('.rd-scn-step-edit')[0] as HTMLButtonElement).click();
    await answerDialog('Sygnał S1', 'zielone');
    expect(stepNames()[0]).toBe('Sygnał S1');
    expect(panel.querySelector('.rd-scn-step-desc')?.textContent).toBe('zielone');
    (panel.querySelectorAll('.rd-scn-step-delete')[2] as HTMLButtonElement).click();
    await answerDialog();
    expect(stepNames()).toEqual(['Sygnał S1', 'Krok B']);

    // another tab: the panel follows it
    const other = tm.createTab('Druga');
    tm.switchTab(other.id);
    expect(panel.querySelector('.rd-scn-tabname')?.textContent).toBe('Druga');
    expect(panel.querySelector('.rd-scn-empty')).not.toBeNull();
    tm.switchTab(tab.id);
    expect(stepNames()).toEqual(['Sygnał S1', 'Krok B']);

    // delete scenario (confirmed)
    (panel.querySelector('.rd-scn-delete') as HTMLButtonElement).click();
    await answerDialog();
    expect(panel.querySelectorAll('.rd-scn-item')).toHaveLength(0);
    expect(notify.error).not.toHaveBeenCalled();
  });
});

describe('scenarioKeyAction', () => {
  it('maps navigation keys and blocks editing shortcuts, but leaves fields and save alone', () => {
    expect(scenarioKeyAction(key({ key: 'ArrowLeft' }))).toBe('prev');
    expect(scenarioKeyAction(key({ key: 'PageUp' }))).toBe('prev');
    expect(scenarioKeyAction(key({ key: 'ArrowRight' }))).toBe('next');
    expect(scenarioKeyAction(key({ key: 'PageDown' }))).toBe('next');
    expect(scenarioKeyAction(key({ key: 'Home' }))).toBe('first');
    expect(scenarioKeyAction(key({ key: 'End' }))).toBe('last');
    expect(scenarioKeyAction(key({ key: 'Escape' }))).toBe('exit');
    expect(scenarioKeyAction(key({ key: 'Z', ctrlKey: true, shiftKey: true }))).toBe('block');
    expect(scenarioKeyAction(key({ key: 'Backspace' }))).toBe('block');
    expect(scenarioKeyAction(key({ key: 's', ctrlKey: true }))).toBe('pass');
    expect(scenarioKeyAction(key({ key: 'r', ctrlKey: true }))).toBe('swallow');
    expect(scenarioKeyAction(key({ key: 'Tab' }))).toBe('swallow');
    const textarea = document.createElement('textarea');
    expect(scenarioKeyAction(key({ key: 'ArrowLeft' }, textarea))).toBe('pass');
    expect(scenarioKeyAction(key({ key: 'ArrowLeft', isComposing: true }))).toBe('pass');
  });
});
