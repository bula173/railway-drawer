/**
 * Data and Checks panels with real tabs (index.html DOM): kind selector, typed fields, multi-select
 * editing, undo through the tab's command service, live checks with the badge, click-to-select,
 * reports through the menu events, Edit Data… without a selection.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cell } from '@maxgraph/core';
import { TabManager } from '../../ui/tabs';
import type { TabData } from '../../ui/tabs';
import { loadAppDom, clearAppDom } from '../../__tests__/ui/app-dom';
import { installScenarios } from '../../scenarios/install-scenarios';
import type { ScenariosHandle } from '../../scenarios/install-scenarios';
import { installRailwayData } from '../install-railway-data';
import type { RailwayDataHandle } from '../install-railway-data';
import { getCellKind, readObjectId, readObjectValues } from '../object-data';
import { captureDrawing } from '../../scenarios/scenario-actions';
import { buildShareMxfile, splitSharedFile } from '../../share/share-mxfile';

const notify = { success: vi.fn(), warning: vi.fn(), error: vi.fn() };

describe('railway Data and Checks panels', () => {
  let tabManager: TabManager | null = null;
  let scenarios: ScenariosHandle | null = null;
  let railway: RailwayDataHandle | null = null;
  let downloads: Array<{ name: string; blob: Blob }> = [];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.stubGlobal('ResizeObserver', class { observe(): void {} unobserve(): void {} disconnect(): void {} });
    loadAppDom();
    localStorage.clear();
    downloads = [];
    for (const fn of Object.values(notify)) fn.mockClear();
  });

  afterEach(() => {
    railway?.destroy();
    scenarios?.destroy();
    tabManager?.destroy();
    railway = null;
    scenarios = null;
    tabManager = null;
    localStorage.clear();
    clearAppDom();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function start(): TabData {
    tabManager = new TabManager('tabs-container', 'graph-container');
    const tab = tabManager.createTab('Stacja Łódź');
    scenarios = installScenarios(tabManager, notify, document.getElementById('graph-container')!, { thumbnails: null });
    railway = installRailwayData(tabManager, notify, {
      showPanel: scenarios.showPanel,
      liveDelay: 50,
      download: (blob, name) => downloads.push({ blob, name }),
    });
    return tab;
  }

  const vertex = (tab: TabData, label: string, x = 10): Cell => {
    let cell!: Cell;
    tab.graph.batchUpdate(() => {
      cell = tab.graph.insertVertex(tab.graph.getDefaultParent(), null, label, x, 10, 40, 20);
    });
    return cell;
  };
  const dataPanel = (): HTMLElement => document.getElementById('railway-data-panel')!;
  const checksPanel = (): HTMLElement => document.getElementById('railway-checks-panel')!;
  const field = (key: string): HTMLInputElement | HTMLSelectElement =>
    dataPanel().querySelector(`[data-field="${key}"]`) as HTMLInputElement | HTMLSelectElement;
  const setField = (key: string, value: string): void => {
    const input = field(key);
    input.value = value;
    input.dispatchEvent(new Event('change'));
  };
  const badge = (): HTMLElement => document.querySelector('[data-right-panel="checks"] .rd-rw-badge') as HTMLElement;

  it('switch has Properties | Data | Checks | Scenarios and shows one panel at a time', () => {
    start();
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.right-panel-switch-btn'));
    expect(buttons.map((b) => b.dataset.rightPanel)).toEqual(['properties', 'data', 'checks', 'scenarios']);
    buttons[1].click();
    expect(dataPanel().hidden).toBe(false);
    expect(document.getElementById('property-content')!.hidden).toBe(true);
    expect(checksPanel().hidden).toBe(true);
    buttons[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(checksPanel().hidden).toBe(false);
    expect(dataPanel().hidden).toBe(true);
    expect(dataPanel().textContent).toContain('Select a shape');
  });

  it('assigns a kind, edits typed fields, undoes through the tab history', () => {
    const tab = start();
    const cell = vertex(tab, 'Semafor');
    tab.graphCommandService.clearHistory();
    tab.graph.setSelectionCell(cell);
    scenarios!.showPanel('data');
    expect((field('kind') as HTMLSelectElement).value).toBe('');

    setField('kind', 'signal');
    expect(getCellKind(cell)).toBe('signal');
    expect(readObjectId(cell)).toBe('S1');
    expect(dataPanel().querySelector('.rd-rw-title')!.textContent).toBe('Signal S1');
    expect(field('id').value).toBe('S1');
    expect(field('signalType').tagName).toBe('SELECT');

    setField('km', '12+345');
    expect(readObjectValues(cell).km).toBe('12.345');
    expect(field('km').value).toBe('12.345');
    setField('aspects', '9');
    vi.advanceTimersByTime(60); // live checks
    expect(field('aspects').classList.contains('rd-rw-invalid')).toBe(true);
    expect(dataPanel().textContent).toContain('Aspects 9 is out of range 1–6');
    expect(badge().hidden).toBe(false);
    expect(badge().classList.contains('rd-rw-badge-error')).toBe(true);

    setField('direction', 'reverse');
    expect(readObjectValues(cell)).toEqual({ id: 'S1', direction: 'reverse', km: '12.345', aspects: '9' });

    // each change is one undo step
    tab.graphCommandService.undo();
    expect(readObjectValues(cell).direction).toBeUndefined();
    tab.graphCommandService.undo();
    tab.graphCommandService.undo();
    expect(readObjectValues(cell)).toEqual({ id: 'S1' });
    tab.graphCommandService.undo();
    expect(cell.getValue()).toBe('Semafor');
    expect(tab.graphCommandService.canUndo()).toBe(false);
    // the panel follows undo
    expect((field('kind') as HTMLSelectElement).value).toBe('');
  });

  it('a field that commits after the selection changed writes to the cell it was shown for', () => {
    const tab = start();
    const a = vertex(tab, 'A', 0);
    const b = vertex(tab, 'B', 100);
    tab.graph.setSelectionCells([a, b]);
    scenarios!.showPanel('data');
    setField('kind', 'signal');
    tab.graph.setSelectionCell(a);
    const notesOfA = field('notes') as HTMLInputElement;
    notesOfA.value = 'tylko A';
    // the user clicks B on the canvas; the field's change event fires afterwards (blur)
    tab.graph.setSelectionCell(b);
    notesOfA.dispatchEvent(new Event('change'));
    expect(readObjectValues(a).notes).toBe('tylko A');
    expect(readObjectValues(b).notes).toBeUndefined();
  });

  it('references autocomplete IDs of the allowed kinds; show-ID-in-label toggles the placeholder', () => {
    const tab = start();
    const track = vertex(tab, '', 0);
    const signal = vertex(tab, '', 100);
    tab.graph.setSelectionCell(track);
    scenarios!.showPanel('data');
    setField('kind', 'track');
    setField('id', 'T7');
    tab.graph.setSelectionCell(signal);
    setField('kind', 'signal');
    const list = document.getElementById(field('trackId').getAttribute('list')!)!;
    expect(Array.from(list.querySelectorAll('option')).map((o) => o.value)).toEqual(['T7']);

    const toggle = dataPanel().querySelector('#rd-rw-label-id') as HTMLInputElement;
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change'));
    // draw.io placeholders: the label shows the ID, editing shows %rdId%
    expect(tab.graph.getLabel(signal)).toBe('S1');
    expect(tab.graph.convertValueToString(signal)).toBe('%rdId%');
    expect((signal.getValue() as Element).getAttribute('label')).toBe('%rdId%');
  });

  it('edits several objects of the same kind together; mixed values and kinds', () => {
    const tab = start();
    const a = vertex(tab, 'A', 0);
    const b = vertex(tab, 'B', 100);
    const c = vertex(tab, 'C', 200);
    scenarios!.showPanel('data');
    tab.graph.setSelectionCells([a, b]);
    setField('kind', 'baliseGroup');
    expect([readObjectId(a), readObjectId(b)]).toEqual(['BG1', 'BG2']);
    expect(dataPanel().querySelector('.rd-rw-title')!.textContent).toBe('2 selected: 2 balise groups');
    expect(field('id').disabled).toBe(true);
    expect((field('id') as HTMLInputElement).placeholder).toBe('(mixed)');
    setField('nidC', '7');
    expect([readObjectValues(a).nidC, readObjectValues(b).nidC]).toEqual(['7', '7']);
    expect(field('nidC').value).toBe('7');

    tab.graph.setSelectionCells([a, c]);
    expect((field('kind') as HTMLSelectElement).value).toBe('__mixed');
    expect(field('nidC')).toBeNull();
    expect(dataPanel().textContent).toContain('different kinds');
  });

  it('Checks: live badge, click selects the cell, Edit focuses the field, fix clears', () => {
    const tab = start();
    const a = vertex(tab, '', 0);
    const b = vertex(tab, '', 100);
    tab.graph.setSelectionCells([a, b]);
    scenarios!.showPanel('data');
    setField('kind', 'signal');
    tab.graph.setSelectionCell(b);
    setField('id', 'S1');
    vi.advanceTimersByTime(60);
    expect(badge().textContent).toBe('2');

    window.dispatchEvent(new CustomEvent('railway-checks-request'));
    expect(checksPanel().hidden).toBe(false);
    const rows = checksPanel().querySelectorAll<HTMLElement>('.rd-rw-issue');
    expect(rows).toHaveLength(2);
    expect(rows[0].dataset.rule).toBe('duplicate-id');
    expect(checksPanel().querySelector('.rd-rw-summary')!.textContent).toBe('2 errors');
    tab.graph.clearSelection();
    (rows[0].querySelector('.rd-rw-issue-main') as HTMLButtonElement).click();
    expect(tab.graph.getSelectionCells()).toEqual([a]);
    (rows[1].querySelector('.rd-rw-issue-edit') as HTMLButtonElement).click();
    expect(tab.graph.getSelectionCells()).toEqual([b]);
    expect(dataPanel().hidden).toBe(false);
    expect(document.activeElement).toBe(field('id'));

    setField('id', 'S2');
    vi.advanceTimersByTime(60);
    expect(badge().hidden).toBe(true);
    expect(checksPanel().querySelector('.rd-rw-summary')!.textContent).toBe('No problems found');
    expect(checksPanel().querySelectorAll('.rd-rw-issue')).toHaveLength(0);
    expect(checksPanel().querySelector('.rd-rw-objects')!.textContent).toBe('2 railway objects: 2 signals');
  });

  it('live checks can be turned off (remembered); Run checks runs on demand', () => {
    const tab = start();
    const live = checksPanel().querySelector('[data-action="live-checks"]') as HTMLInputElement;
    live.checked = false;
    live.dispatchEvent(new Event('change'));
    expect(localStorage.getItem('rd.railway.liveChecks')).toBe('0');
    const cell = vertex(tab, '');
    tab.graph.setSelectionCell(cell);
    scenarios!.showPanel('data');
    setField('kind', 'balise');
    vi.advanceTimersByTime(1000);
    expect(badge().hidden).toBe(true);
    (checksPanel().querySelector('[data-action="run-checks"]') as HTMLButtonElement).click();
    expect(badge().textContent).toBe('1');
    expect(checksPanel().querySelector('.rd-rw-issue')!.textContent).toContain('does not belong to a balise group');
  });

  it('exports CSV and xlsx through File > Export Railway Data and the Checks panel', async () => {
    const tab = start();
    const s = vertex(tab, 'Wjazd, „A”');
    tab.graph.setSelectionCell(s);
    scenarios!.showPanel('data');
    setField('kind', 'signal');
    setField('km', '1,5');

    (document.querySelector('[data-action="exportRailway:signals"]') as HTMLElement).click();
    expect(downloads.map((d) => d.name)).toEqual(['Stacja Łódź-signals.csv']);
    const raw = new Uint8Array(await downloads[0].blob.arrayBuffer());
    expect([...raw.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM for Excel
    const csv = new TextDecoder().decode(raw);
    expect(csv).toContain('S1,,,1.5,,,,,"Wjazd, „A”"');
    expect(notify.success).toHaveBeenCalledWith('Exported 1 row to Stacja Łódź-signals.csv');

    (checksPanel().querySelector('[data-report="points"]') as HTMLButtonElement).click();
    expect(downloads[1].name).toBe('Stacja Łódź-points.csv');
    expect(notify.warning).toHaveBeenCalledWith(expect.stringContaining('only has the header row'));

    window.dispatchEvent(new CustomEvent('railway-export-request', { detail: 'xlsx' }));
    expect(downloads[2].name).toBe('Stacja Łódź-railway-data.xlsx');
    const bytes = new Uint8Array(await downloads[2].blob.arrayBuffer());
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]);
  });

  it('scenario steps and share links keep the data (they snapshot the model XML)', () => {
    const tab = start();
    const cell = vertex(tab, 'Semafor');
    tab.graph.setSelectionCell(cell);
    scenarios!.showPanel('data');
    setField('kind', 'signal');
    setField('notes', 'Łódź „Kaliska”');
    const step = captureDrawing(tab.saveLoadController);
    expect(step).toContain('rdKind="signal"');
    expect(step).toContain('rdNotes="Łódź „Kaliska”"');
    const shared = buildShareMxfile([{ name: tab.name, modelXml: step }]);
    expect(splitSharedFile(shared).map((p) => p.fileXml).join('')).toContain('rdNotes="Łódź „Kaliska”"');
  });

  it('Edit Data… without a selection shows the Data panel with a hint', () => {
    start();
    (document.querySelector('.menu-dropdown [data-action="editData"]') as HTMLElement).click();
    expect(dataPanel().hidden).toBe(false);
    expect(notify.warning).toHaveBeenCalledWith(expect.stringContaining('Select a shape first'));
  });

  it('follows the active tab', () => {
    const tab1 = start();
    const cell = vertex(tab1, '');
    tab1.graph.setSelectionCell(cell);
    scenarios!.showPanel('data');
    setField('kind', 'signal');
    setField('id', '');
    vi.advanceTimersByTime(60);
    expect(badge().textContent).toBe('1');
    const tab2 = tabManager!.createTab('Second');
    tabManager!.switchTab(tab2.id);
    expect(badge().hidden).toBe(true);
    expect(dataPanel().textContent).toContain('Select a shape');
    tabManager!.switchTab(tab1.id);
    expect(badge().textContent).toBe('1');
  });
});
