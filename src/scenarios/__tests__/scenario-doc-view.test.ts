/**
 * Scenario view additions with real tabs: "Show changes" (highlight layer in the view graph only,
 * legend, Changes list, snapshots untouched), autoplay (interval, stop at the end, loop, Space via
 * the scenario key handler, pause on close), and the PDF / slides exports through installScenarios
 * (options dialog, panel buttons, menu event).
 */
import { emit } from '../../core/event-bus';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Cell } from '@maxgraph/core';
import { TabManager } from '../../ui/tabs';
import type { TabData } from '../../ui/tabs';
import { loadAppDom, clearAppDom } from '../../__tests__/ui/app-dom';
import { installScenarios } from '../install-scenarios';
import type { ScenariosHandle } from '../install-scenarios';
import { captureDrawing } from '../scenario-actions';
import { scenarioKeyAction } from '../scenario-keys';
import { SHOW_CHANGES_KEY } from '../scenario-view';
import { AUTOPLAY_KEY, ScenarioAutoplay } from '../scenario-autoplay';
import { DIFF_LAYER_ID } from '../scenario-diff';
import type { ScenarioDocChoice, ScenarioDocDialogOptions } from '../scenario-doc-export';
import { openScenarioDocDialog } from '../scenario-doc-export';

const notify = { success: vi.fn(), warning: vi.fn(), error: vi.fn() };
const PNG_1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('scenario view: show changes, autoplay, PDF/slides export', () => {
  let tabManager: TabManager | null = null;
  let handle: ScenariosHandle | null = null;
  let saved: Array<{ blob: Blob; name: string }> = [];
  let dialogCalls: ScenarioDocDialogOptions[] = [];

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
    saved = [];
    dialogCalls = [];
    notify.success.mockClear();
    notify.warning.mockClear();
    notify.error.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    handle?.destroy();
    handle = null;
    tabManager?.destroy();
    tabManager = null;
    localStorage.clear();
    document.querySelectorAll('.rd-tpl-modal-overlay').forEach((n) => n.remove());
    document.body.classList.remove('rd-scenario-viewing');
    clearAppDom();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  /** A tab with scenario "Run": step 1 = A, step 2 = A moved + B, step 3 = A restyled, B removed. */
  function start(choice: Partial<ScenarioDocChoice> = {}): { tab: TabData; h: ScenariosHandle; scenarioId: string; xmls: string[] } {
    tabManager = new TabManager('tabs-container', 'graph-container');
    const tab = tabManager.createTab('Węzeł');
    handle = installScenarios(tabManager, notify, document.getElementById('graph-container')!, {
      thumbnails: null,
      renderDrawingSvg: async (xml) => `<svg xmlns="http://www.w3.org/2000/svg"><desc>${xml.includes('rdDiff') ? 'diff' : 'plain'}</desc></svg>`,
      renderDrawingPng: async () => ({ dataUrl: PNG_1x1, width: 200, height: 100 }),
      pdfDeps: { loadFonts: async () => null, loadSvg2Pdf: null, rasterizeSvg: async () => ({ dataUrl: PNG_1x1, width: 100, height: 50 }) },
      saveFile: (blob, name) => saved.push({ blob, name }),
      docDialog: async (opts) => {
        dialogCalls.push(opts);
        return { scenarioId: opts.initialScenarioId ?? opts.scenarios[0].id, orientation: 'portrait', showChanges: opts.showChanges, ...choice };
      },
    });
    const graph = tab.graph;
    const parent = graph.getDefaultParent();
    const set = tab.document.scenarios;
    const s = set.create('Run');
    const a = graph.insertVertex(parent, 'cellA', 'Train', 10, 10, 60, 30);
    set.addStep(s.id, { name: 'one', xml: captureDrawing(tab.document) });
    const moved = a.getGeometry()!.clone();
    moved.translate(100, 0);
    graph.getDataModel().setGeometry(a, moved);
    graph.insertVertex(parent, 'cellB', 'S2', 300, 10, 40, 40);
    set.addStep(s.id, { name: 'two', xml: captureDrawing(tab.document) });
    graph.setCellStyles('fillColor', '#ff0000', [a]);
    graph.removeCells([graph.getDataModel().getCell('cellB') as Cell]);
    set.addStep(s.id, { name: 'three', text: '# Done', xml: captureDrawing(tab.document) });
    const xmls = set.get(s.id)!.steps.map((st) => st.xml);
    return { tab, h: handle, scenarioId: s.id, xmls };
  }

  const diffLayer = (h: ScenariosHandle): Cell | null => (h.viewer.getViewGraph()!.getDataModel().getCell(DIFF_LAYER_ID) as Cell | null) ?? null;
  const diffKinds = (h: ScenariosHandle): string[] =>
    (diffLayer(h)?.children ?? []).map((c) => String((c.getStyle() as Record<string, unknown>).rdDiff ?? '?')).sort();

  it('"Show changes" highlights against the previous step in the view only, with legend and list', () => {
    const { h, scenarioId, tab, xmls } = start();
    const liveXml = tab.document.serializeToXml();
    h.viewer.open(tab.id, scenarioId, 1);
    const view = document.querySelector('[data-testid="scenario-view"]') as HTMLElement;
    const legend = document.querySelector('[data-testid="scenario-diff-legend"]') as HTMLElement;
    const toggle = document.querySelector('.rd-scn-diff-toggle') as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    expect(legend.hidden).toBe(true);
    expect(diffLayer(h)).toBeNull();

    toggle.checked = true;
    toggle.dispatchEvent(new Event('change'));
    expect(localStorage.getItem(SHOW_CHANGES_KEY)).toBe('1');
    expect(legend.hidden).toBe(false);
    expect(diffKinds(h)).toEqual(['added', 'moved']);
    expect(view.dataset.diffAdded).toBe('1');
    expect(view.dataset.diffMoved).toBe('1');
    const items = Array.from(document.querySelectorAll('.rd-scn-side-changes li')).map((li) => [li.getAttribute('data-kind'), li.textContent]);
    expect(items).toEqual([
      ['moved', 'Train: moved'],
      ['added', 'S2 added'],
    ]);
    expect(h.viewer.getShownDiff()?.counts).toEqual({ added: 1, removed: 0, moved: 1, changed: 0 });

    h.viewer.go(1);
    expect(diffKinds(h)).toEqual(['changed', 'removed']);
    expect(Array.from(document.querySelectorAll('.rd-scn-side-changes li')).map((li) => li.textContent)).toEqual([
      'Train: style changed (fillColor)',
      'S2 removed',
    ]);
    // first step: nothing to compare
    h.viewer.first();
    expect(legend.hidden).toBe(true);
    expect(document.querySelector('.rd-scn-side-changes')?.textContent).toContain('First step');
    expect(diffKinds(h)).toEqual([]);

    // snapshots and the live drawing untouched
    expect(tab.document.scenarios.get(scenarioId)!.steps.map((s) => s.xml)).toEqual(xmls);
    h.viewer.close();
    expect(tab.document.serializeToXml()).toBe(liveXml);
    // off again: plain snapshot
    h.viewer.setShowChanges(false);
    h.viewer.open(tab.id, scenarioId, 1);
    expect(diffKinds(h)).toEqual([]);
    expect((document.querySelector('.rd-scn-side-changes-section') as HTMLElement).hidden).toBe(true);
  });

  it('autoplay: advances every interval, stops at the last step, Space toggles, loop wraps, close pauses', () => {
    vi.useFakeTimers();
    const { h, scenarioId, tab } = start();
    h.viewer.open(tab.id, scenarioId, 0);
    const play = document.querySelector('.rd-scn-play-btn') as HTMLButtonElement;
    expect((document.querySelector('.rd-scn-autoplay-interval') as HTMLSelectElement).value).toBe('3');
    play.click();
    expect(h.viewer.isPlaying()).toBe(true);
    expect(play.textContent).toBe('⏸ Pause');
    vi.advanceTimersByTime(2999);
    expect(h.viewer.getState()!.index).toBe(0);
    vi.advanceTimersByTime(1);
    expect(h.viewer.getState()!.index).toBe(1);
    vi.advanceTimersByTime(3000);
    expect(h.viewer.getState()!.index).toBe(2);
    expect(h.viewer.isPlaying()).toBe(false);
    expect(play.textContent).toBe('▶ Play');

    // Space through the scenario key handler: at the end it restarts from step 1
    const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    expect(scenarioKeyAction(space)).toBe('toggle-play');
    expect(h.handleKeydown(space)).toBe(true);
    expect(space.defaultPrevented).toBe(true);
    expect(h.viewer.isPlaying()).toBe(true);
    expect(h.viewer.getState()!.index).toBe(0);
    h.handleKeydown(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    expect(h.viewer.isPlaying()).toBe(false);
    vi.advanceTimersByTime(10_000);
    expect(h.viewer.getState()!.index).toBe(0);

    // 1 s + loop (remembered)
    const select = document.querySelector('.rd-scn-autoplay-interval') as HTMLSelectElement;
    select.value = '1';
    select.dispatchEvent(new Event('change'));
    const loop = document.querySelector('.rd-scn-autoplay-loop') as HTMLInputElement;
    loop.checked = true;
    loop.dispatchEvent(new Event('change'));
    expect(JSON.parse(localStorage.getItem(AUTOPLAY_KEY)!)).toEqual({ seconds: 1, loop: true });
    h.viewer.last();
    h.viewer.play();
    vi.advanceTimersByTime(1000);
    expect(h.viewer.getState()!.index).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(h.viewer.getState()!.index).toBe(1);
    // a manual step restarts the interval
    vi.advanceTimersByTime(600);
    h.viewer.go(1);
    vi.advanceTimersByTime(600);
    expect(h.viewer.getState()!.index).toBe(2);
    h.viewer.close();
    expect(h.viewer.isPlaying()).toBe(false);
  });

  it('keys: Space = toggle-play; a focused check box keeps ←/→ and Space, text fields keep them', () => {
    const keyOn = (target: HTMLElement, key: string): string => {
      document.body.appendChild(target);
      const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      let action = '';
      target.addEventListener('keydown', (evt) => (action = scenarioKeyAction(evt)), { once: true });
      target.dispatchEvent(e);
      target.remove();
      return action;
    };
    const box = Object.assign(document.createElement('input'), { type: 'checkbox' });
    const text = Object.assign(document.createElement('input'), { type: 'text' });
    expect(keyOn(box, 'ArrowRight')).toBe('next');
    expect(keyOn(box, ' ')).toBe('toggle-play');
    expect(keyOn(text, 'ArrowRight')).toBe('pass');
    expect(keyOn(text, ' ')).toBe('pass');
    expect(keyOn(document.createElement('select'), 'ArrowDown')).toBe('pass');
  });

  it('ScenarioAutoplay alone: one step does not play; settings fall back to 3 s', () => {
    localStorage.setItem(AUTOPLAY_KEY, '{"seconds":-1}');
    const shown: number[] = [];
    const ap = new ScenarioAutoplay({ position: () => ({ index: 0, total: 1 }), show: (i) => shown.push(i) });
    expect(ap.getSettings()).toEqual({ seconds: 3, loop: false });
    ap.play();
    expect(ap.isPlaying()).toBe(false);
  });

  it('PDF export: menu event -> options dialog -> PDF file with title + step pages', async () => {
    const { h, scenarioId, tab } = start();
    h.viewer.open(tab.id, scenarioId, 1);
    h.viewer.setShowChanges(true);
    emit('scenario-export-request', { format: 'pdf' });
    await vi.waitFor(() => expect(saved).toHaveLength(1), { timeout: 10_000 });
    expect(dialogCalls[0]).toMatchObject({ format: 'pdf', initialScenarioId: scenarioId, showChanges: true });
    expect(saved[0].name).toBe('Węzeł - Run.pdf');
    expect(saved[0].blob.type).toBe('application/pdf');
    const raw = Buffer.from(await saved[0].blob.arrayBuffer()).toString('latin1');
    expect(raw.startsWith('%PDF-')).toBe(true);
    expect((raw.match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('slides export from the panel button; no steps -> warning, no dialog', async () => {
    const { h } = start();
    h.showPanel('scenarios');
    const btn = document.querySelector('#scenarios-panel .rd-scn-export-slides') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(document.querySelector('#scenarios-panel .rd-scn-export-pdf')).not.toBeNull();
    btn.click();
    await vi.waitFor(() => expect(saved).toHaveLength(1), { timeout: 10_000 });
    expect(saved[0].name).toBe('Węzeł - Run (slides).html');
    const html = await saved[0].blob.text();
    expect(html.match(/<section class="slide step"/g)).toHaveLength(3);
    expect(dialogCalls[0].format).toBe('slides');

    const empty = await (async () => {
      const tab2 = tabManager!.createTab('Empty');
      tabManager!.switchTab(tab2.id);
      return h.exportScenarioDoc('pdf');
    })();
    expect(empty).toBeNull();
    expect(notify.warning).toHaveBeenCalledWith(expect.stringContaining('no scenario with steps'));
    expect(dialogCalls).toHaveLength(1);
  });

  it('"Export ▾" of a panel row and of the view banner: PDF… / Slides (HTML)… / HTML document…; disabled without steps', async () => {
    const { h, scenarioId, tab } = start();
    tab.document.scenarios.create('Empty');
    h.showPanel('scenarios');
    const rows = Array.from(document.querySelectorAll<HTMLElement>('#scenarios-panel .rd-scn-item'));
    const rowExport = (row: HTMLElement): HTMLButtonElement => row.querySelector('.rd-scn-head .rd-scn-export-row') as HTMLButtonElement;
    const runRow = rows.find((r) => r.dataset.scenarioId === scenarioId)!;
    const emptyRow = rows.find((r) => r.dataset.scenarioId !== scenarioId)!;
    // Present, Export ▾, ⋯ in this order
    expect(Array.from(runRow.querySelectorAll('.rd-scn-actions > button, .rd-scn-actions > .rd-scn-menu-wrap > button')).map((b) => b.className)).toEqual([
      'rd-scn-play',
      'rd-scn-export-btn rd-scn-export-row',
      'rd-scn-more',
    ]);
    expect(rowExport(emptyRow).disabled).toBe(true);
    expect(rowExport(emptyRow).title).toBe('Add a step first');
    const btn = rowExport(runRow);
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe('⇩Export▾');
    expect(btn.getAttribute('aria-haspopup')).toBe('menu');
    expect(btn.getAttribute('aria-label')).toBe('Export Run');
    btn.click();
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    const menu = btn.parentElement!.querySelector('.rd-scn-menu') as HTMLElement;
    expect(menu.hidden).toBe(false);
    expect(Array.from(menu.querySelectorAll('[role="menuitem"]')).map((i) => i.textContent)).toEqual(['PDF…', 'Slides (HTML)…', 'HTML document…']);
    expect(document.activeElement).toBe(menu.querySelector('.rd-scn-export-menu-pdf'));
    // Esc closes and returns the focus to the button
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(menu.hidden).toBe(true);
    expect(document.activeElement).toBe(btn);
    // ↓ on the button opens it too; PDF… -> options dialog -> file
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    expect(menu.hidden).toBe(false);
    (menu.querySelector('.rd-scn-export-menu-pdf') as HTMLButtonElement).click();
    expect(menu.hidden).toBe(true);
    await vi.waitFor(() => expect(saved).toHaveLength(1), { timeout: 10_000 });
    expect(dialogCalls[0]).toMatchObject({ format: 'pdf', initialScenarioId: scenarioId });
    expect(saved[0].name).toBe('Węzeł - Run.pdf');
    // HTML document: no dialog
    rowExport(runRow).click();
    (menu.querySelector('.rd-scn-export-menu-html') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(saved).toHaveLength(2), { timeout: 10_000 });
    expect(saved[1].name).toBe('Węzeł - Run.html');
    expect(dialogCalls).toHaveLength(1);

    // the banner of the view: the scenario shown
    h.viewer.open(tab.id, scenarioId, 1);
    const bannerBtn = document.querySelector('.rd-scn-banner .rd-scn-banner-export') as HTMLButtonElement;
    expect(bannerBtn.getAttribute('aria-haspopup')).toBe('menu');
    bannerBtn.click();
    const bannerMenu = bannerBtn.parentElement!.querySelector('.rd-scn-menu') as HTMLElement;
    expect(bannerMenu.hidden).toBe(false);
    // keys of the menu belong to it: not a scenario step, not "Back to editing"
    const down = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    document.activeElement!.dispatchEvent(down);
    expect(scenarioKeyAction(down)).toBe('menu');
    expect(h.handleKeydown(down)).toBe(true);
    expect(h.viewer.getState()!.index).toBe(1);
    expect(document.activeElement).toBe(bannerMenu.querySelector('.rd-scn-export-menu-slides'));
    (document.activeElement as HTMLButtonElement).click();
    await vi.waitFor(() => expect(saved).toHaveLength(3), { timeout: 10_000 });
    expect(dialogCalls[1]).toMatchObject({ format: 'slides', initialScenarioId: scenarioId });
    expect(saved[2].name).toBe('Węzeł - Run (slides).html');
    expect(h.viewer.isActive()).toBe(true);
    // closing the view closes an open banner menu
    bannerBtn.click();
    h.viewer.close();
    expect(bannerMenu.hidden).toBe(true);
  });

  it('keys in the view: Enter / Space / ↑ / ↓ on a menu button and every key in an open menu go to the menu', () => {
    const keyOn = (target: HTMLElement, key: string, host: HTMLElement = target): string => {
      document.body.appendChild(host);
      let action = '';
      target.addEventListener('keydown', (evt) => (action = scenarioKeyAction(evt)), { once: true });
      target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      host.remove();
      return action;
    };
    const menuButton = (): HTMLButtonElement => {
      const b = document.createElement('button');
      b.setAttribute('aria-haspopup', 'menu');
      return b;
    };
    expect(keyOn(menuButton(), ' ')).toBe('menu');
    expect(keyOn(menuButton(), 'Enter')).toBe('menu');
    expect(keyOn(menuButton(), 'ArrowDown')).toBe('menu');
    expect(keyOn(menuButton(), 'ArrowRight')).toBe('next');
    expect(keyOn(menuButton(), 'Escape')).toBe('exit');
    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    const item = menu.appendChild(document.createElement('button'));
    for (const key of ['Escape', 'ArrowUp', 'Home', 'End', ' ', 'Enter', 'ArrowLeft']) expect(keyOn(item, key, menu)).toBe('menu');
    const ctrlZ = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true });
    document.body.appendChild(menu);
    let action = '';
    item.addEventListener('keydown', (evt) => (action = scenarioKeyAction(evt)), { once: true });
    item.dispatchEvent(ctrlZ);
    menu.remove();
    expect(action).toBe('block');
  });

  it('options dialog: scenario choice, orientation remembered, highlight checkbox, Esc cancels', async () => {
    const scenarios = [
      { id: 'x', name: 'Empty', description: '', steps: [] },
      { id: 'y', name: 'Full', description: '', steps: [{ id: 's', name: 's', description: '', xml: '<mxGraphModel/>', uml: '', text: '' }] },
    ];
    const pending = openScenarioDocDialog({ format: 'pdf', scenarios, initialScenarioId: null, showChanges: false });
    const dialog = document.querySelector('[data-testid="scenario-doc-export-dialog"]') as HTMLElement;
    const select = dialog.querySelector('select[name="scenario"]') as HTMLSelectElement;
    expect(select.value).toBe('y');
    expect((select.options[0] as HTMLOptionElement).disabled).toBe(true);
    (dialog.querySelector('input[value="landscape"]') as HTMLInputElement).checked = true;
    (dialog.querySelector('input[name="showChanges"]') as HTMLInputElement).checked = true;
    (dialog.querySelector('.rd-tpl-btn-primary') as HTMLButtonElement).click();
    expect(await pending).toEqual({ scenarioId: 'y', orientation: 'landscape', showChanges: true });
    expect(localStorage.getItem('rd.scenario.pdfOrientation')).toBe('landscape');

    const again = openScenarioDocDialog({ format: 'slides', scenarios: [scenarios[1]], initialScenarioId: 'y', showChanges: true });
    const d2 = document.querySelector('[data-testid="scenario-doc-export-dialog"]') as HTMLElement;
    expect(d2.querySelector('select')).toBeNull();
    expect(d2.querySelector('input[name="orientation"]')).toBeNull();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(await again).toBeNull();
  });
});
