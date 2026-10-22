/**
 * @file install-railway-data.ts
 * @brief Wires railway object data into the main editor (called once from main-editor.ts):
 *        the right panel's Data and Checks views for the active tab, live (debounced) checks
 *        with a count badge, Edit Data… (Extras menu, context menu), Railway Checks, and the
 *        CSV/xlsx reports (File > Export Railway Data, Checks panel).
 */
import { InternalEvent } from '@maxgraph/core';
import type { Cell, EventObject, EventSource, Graph } from '@maxgraph/core';
import './railway-data.css';
import type { TabManager } from '../ui/tabs';
import type { RightPanelView } from '../scenarios/scenarios-panel';
import { RIGHT_PANEL_EVENT } from '../scenarios/scenarios-panel';
import type { PaletteEntry } from '../ui/drawio-palette/contracts';
import { KINDS, isErtmsLibraryEntry, kindForPaletteEntry, kindForStyle } from './catalogue';
import { handOfLegCell } from './hand';
import { renumberInsertedObjects } from './insert-ids';
import { applyPresetToNewCells, setRailwayData } from './object-data';
import { createRailwayDataPanel } from './data-panel';
import type { RailwayDataPanel } from './data-panel';
import { createChecksPanel } from './checks-panel';
import type { ChecksPanel, ChecksResult } from './checks-panel';
import type { Issue } from './validation';
import { collectObjects, countIssues, validateModel } from './validation';
import type { ReportId } from './report';
import { REPORTS, buildReportTable, fileBaseName, getReport, tableToCsv } from './report';

export interface RailwayNotifier {
  success(message: string): void;
  warning(message: string): void;
  error(message: string): void;
}

export interface RailwayDataHandle {
  dataPanel: RailwayDataPanel;
  checksPanel: ChecksPanel;
  /** Runs the checks on the active tab now and returns the issues. */
  runChecks(): Issue[];
  /** Latest check results of the active tab. */
  getIssues(): Issue[];
  destroy(): void;
}

export interface InstallRailwayDataOptions {
  /** Shows a right-panel view (from installScenarios). */
  showPanel: (view: RightPanelView) => void;
  /** Debounce of the live checks in ms (default 400). */
  liveDelay?: number;
  /** File download (default: an object URL link click); tests replace it. */
  download?: (blob: Blob, fileName: string) => void;
}

export const LIVE_CHECKS_KEY = 'rd.railway.liveChecks';

function readLive(): boolean {
  try {
    return localStorage.getItem(LIVE_CHECKS_KEY) !== '0';
  } catch {
    return true;
  }
}

function writeLive(live: boolean): void {
  try {
    localStorage.setItem(LIVE_CHECKS_KEY, live ? '1' : '0');
  } catch {
    // storage blocked: applies for this session
  }
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Palette hook (`prepareInsert`): ERTMS library entries that are railway objects get their kind,
 * preset values and a free generated ID, as part of the insert edit (only single-cell entries).
 * Entries of other libraries carry their data in the cells (the railway libraries,
 * src/ui/railway-libraries.ts, or user libraries): objects without an ID or with a taken one get
 * the next free ID and references between the inserted objects follow (insert-ids.ts).
 */
export function prepareRailwayInsert(graph: Graph, cells: Cell[], entry: PaletteEntry): void {
  if (!isErtmsLibraryEntry(entry)) {
    renumberInsertedObjects(graph.getDataModel(), cells);
    return;
  }
  const preset = kindForPaletteEntry(entry);
  if (!preset || cells.length !== 1) return;
  // points ("Point Left/Right"): the hand is read from the toe, from the leg's geometry (not the title)
  const hand = preset.kind === 'points' ? handOfLegCell(cells[0]) : null;
  applyPresetToNewCells(graph.getDataModel(), cells, hand ? { ...preset, values: { ...preset.values, hand } } : preset);
}

/** App shapes dropped from the Shapes tab: railway shapes get their kind (inside the caller's update). */
export function assignKindForInsertedShape(graph: Graph, cell: Cell): void {
  const preset = kindForStyle(cell.getStyle());
  if (!preset) return;
  setRailwayData(graph.getDataModel(), [cell], { kind: preset.kind, values: preset.values ?? {} }, { autoId: true });
}

export function installRailwayData(tabManager: TabManager, notify: RailwayNotifier, options: InstallRailwayDataOptions): RailwayDataHandle {
  const getGraph = (): Graph | null => tabManager.getActiveTab()?.graph ?? null;
  const download = options.download ?? downloadBlob;
  const liveDelay = options.liveDelay ?? 400;
  let live = readLive();
  let lastResult: ChecksResult | null = null;
  let lastGraph: Graph | null = null;
  let currentView: RightPanelView = 'properties';
  let timer: ReturnType<typeof setTimeout> | null = null;

  const dataPanel = createRailwayDataPanel({
    container: document.getElementById('railway-data-panel')!,
    getGraph,
    getIssues: () => (lastGraph === getGraph() ? lastResult?.issues ?? [] : []),
  });

  const badge = document.querySelector<HTMLElement>('.right-panel-switch-btn[data-right-panel="checks"] .rd-rw-badge');
  const updateBadge = (): void => {
    if (!badge) return;
    const issues = lastResult?.issues ?? [];
    const { errors, warnings } = countIssues(issues);
    badge.hidden = errors + warnings === 0;
    badge.textContent = String(errors + warnings);
    badge.classList.toggle('rd-rw-badge-error', errors > 0);
    badge.title = `${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}`;
  };

  const runChecks = (): Issue[] => {
    bind();
    if (timer) clearTimeout(timer);
    timer = null;
    const graph = getGraph();
    if (!graph) {
      lastResult = null;
      lastGraph = null;
    } else {
      const model = graph.getDataModel();
      const objects = collectObjects(model);
      const counts = KINDS.map((k): [string, number] => {
        const n = objects.filter((o) => o.kind.id === k.id).length;
        return [n === 1 ? k.label : k.plural, n];
      }).filter(([, n]) => n > 0);
      lastResult = { issues: validateModel(model), objectCounts: counts, at: new Date() };
      lastGraph = graph;
    }
    checksPanel.show(lastResult);
    updateBadge();
    if (currentView === 'data') dataPanel.refresh();
    return lastResult?.issues ?? [];
  };

  const scheduleChecks = (): void => {
    if (!live) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(runChecks, liveDelay);
  };

  const selectIssue = (issue: Issue, edit: boolean): void => {
    const graph = getGraph();
    const cell = graph?.getDataModel().getCell(issue.cellId);
    if (!graph || !cell) {
      notify.warning('This object is no longer in the diagram; the checks were run again.');
      runChecks();
      return;
    }
    graph.setSelectionCell(cell);
    graph.scrollCellToVisible(cell);
    if (edit) {
      options.showPanel('data');
      dataPanel.focusField(issue.field);
    }
  };

  const exportReport = async (id: ReportId | 'xlsx'): Promise<void> => {
    const tab = tabManager.getActiveTab();
    if (!tab) return;
    const objects = collectObjects(tab.graph.getDataModel());
    const base = fileBaseName(tab.name);
    try {
      if (id === 'xlsx') {
        const tables = REPORTS.map((r) => buildReportTable(objects, r));
        // The XLSX writer is a separate chunk, loaded on first use
        const { buildXlsx } = await import('./xlsx');
        const bytes = buildXlsx(tables);
        download(new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${base}-railway-data.xlsx`);
        notify.success(`Exported ${objects.length} railway object${objects.length === 1 ? '' : 's'} to ${base}-railway-data.xlsx`);
        return;
      }
      const report = getReport(id);
      if (!report) return;
      const table = buildReportTable(objects, report);
      const fileName = `${base}-${report.fileSuffix}.csv`;
      download(new Blob([tableToCsv(table)], { type: 'text/csv;charset=utf-8' }), fileName);
      if (table.rows.length === 0) notify.warning(`${report.title}: the diagram has none, so ${fileName} only has the header row`);
      else notify.success(`Exported ${table.rows.length} row${table.rows.length === 1 ? '' : 's'} to ${fileName}`);
    } catch (error) {
      notify.error(`Could not export the railway data: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const checksPanel = createChecksPanel({
    container: document.getElementById('railway-checks-panel')!,
    live,
    onRun: () => {
      runChecks();
    },
    onLiveChange: (value) => {
      live = value;
      writeLive(value);
      if (live) runChecks();
    },
    onSelect: selectIssue,
    onExport: exportReport,
  });

  // ---- active graph listeners
  let bound: { graph: Graph; selection: EventSource; model: EventSource } | null = null;
  const onSelectionChange = (): void => {
    if (currentView === 'data') dataPanel.refresh();
  };
  const onModelChange = (_sender: EventSource, _evt: EventObject): void => {
    if (currentView === 'data') dataPanel.refresh();
    scheduleChecks();
  };
  function bind(): void {
    const graph = getGraph();
    if (bound?.graph === graph) return;
    if (bound) {
      bound.selection.removeListener(onSelectionChange);
      bound.model.removeListener(onModelChange);
      bound = null;
    }
    if (graph) {
      const selection = graph.getSelectionModel() as unknown as EventSource;
      const model = graph.getDataModel() as unknown as EventSource;
      selection.addListener(InternalEvent.CHANGE, onSelectionChange);
      model.addListener(InternalEvent.CHANGE, onModelChange);
      bound = { graph, selection, model };
    }
  }
  const onTabChanged = (): void => {
    bind();
    dataPanel.refresh();
    if (live) runChecks();
    else {
      lastResult = null;
      checksPanel.show(null);
      updateBadge();
    }
  };
  bind();
  if (live) runChecks();

  const onView = (evt: Event): void => {
    bind();
    currentView = (evt as CustomEvent<{ view: RightPanelView }>).detail?.view ?? 'properties';
    if (currentView === 'data') dataPanel.refresh();
    if (currentView === 'checks' && (!lastResult || lastGraph !== getGraph())) runChecks();
  };
  const onEditData = (): void => {
    bind();
    options.showPanel('data');
    const graph = getGraph();
    if (!graph || graph.getSelectionCount() === 0) {
      notify.warning('Select a shape first, then Edit Data… shows its railway data.');
      dataPanel.refresh();
      return;
    }
    dataPanel.focusField();
  };
  const onChecks = (): void => {
    options.showPanel('checks');
    runChecks();
  };
  const onExport = (evt: Event): void => {
    const id = (evt as CustomEvent<string>).detail;
    if (id === 'xlsx' || getReport(id)) void exportReport(id as ReportId | 'xlsx');
  };
  window.addEventListener(RIGHT_PANEL_EVENT, onView);
  window.addEventListener('tab-changed', onTabChanged);
  window.addEventListener('tab-closed', onTabChanged);
  window.addEventListener('railway-edit-data-request', onEditData);
  window.addEventListener('railway-checks-request', onChecks);
  window.addEventListener('railway-export-request', onExport);

  return {
    dataPanel,
    checksPanel,
    runChecks,
    getIssues: () => lastResult?.issues ?? [],
    destroy() {
      if (timer) clearTimeout(timer);
      if (bound) {
        bound.selection.removeListener(onSelectionChange);
        bound.model.removeListener(onModelChange);
      }
      window.removeEventListener(RIGHT_PANEL_EVENT, onView);
      window.removeEventListener('tab-changed', onTabChanged);
      window.removeEventListener('tab-closed', onTabChanged);
      window.removeEventListener('railway-edit-data-request', onEditData);
      window.removeEventListener('railway-checks-request', onChecks);
      window.removeEventListener('railway-export-request', onExport);
      dataPanel.destroy();
      checksPanel.destroy();
    },
  };
}
