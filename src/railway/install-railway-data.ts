/**
 * @file install-railway-data.ts
 * @brief Wires railway object data into the main editor (called once from main-editor.ts):
 *        the right panel's Data and Checks views for the active tab, live (debounced) checks
 *        with a count badge, Edit Data… (Extras menu, context menu), Railway Checks, and the
 *        CSV/xlsx reports (File > Export Railway Data, Checks panel).
 */
import { onModelChange as onGraphModelChange, onSelectionChange as onGraphSelectionChange } from '../core/graph-events';
import { off, on } from '../core/event-bus';
import type { Cell, EventObject, EventSource, Graph } from '@maxgraph/core';
import './railway-data.css';
import type { TabManager } from '../ui/tabs';
// the bus event active-session-changed (declared by ui/session.ts)
import type {} from '../ui/session';
import type { RightPanelView } from '../scenarios/scenarios-panel';
import { RIGHT_PANEL_EVENT } from '../scenarios/scenarios-panel';
import type { PaletteEntry } from '../ui/drawio-palette/contracts';
import { KINDS, isErtmsLibraryEntry, kindForPaletteEntry, kindForStyle } from './catalogue';
import { handOfLegCell } from './hand';
import { prepareClonedCells } from './clone';
import { applyPresetToNewCells, getCellKind, readAttr, setRailwayData } from './object-data';
import { createRailwayDataPanel } from './data-panel';
import type { RailwayDataPanel } from './data-panel';
import { createChecksPanel } from './checks-panel';
import type { ChecksPanel, ChecksResult } from './checks-panel';
import type { Issue } from './validation';
import { collectObjects, countIssues, validateModelReport } from './validation';
import { etcsEnvFromModel } from './etcs/etcs-compute';
import type { ReportId } from './report';
import { REPORTS, buildReportTable, fileBaseName, getReport, tableToCsv } from './report';
import { readItem, writeItem } from '../core/safe-storage';
import { STORAGE_KEYS } from '../core/storage-keys';

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

export const LIVE_CHECKS_KEY = STORAGE_KEYS.railwayLiveChecks;
/** `exportRailway:<id>` of the balise ETCS data. */
const ETCS_EXPORTS = ['etcsCsv', 'etcsXlsx', 'etcsJson', 'etcsReport'];

function readLive(): boolean {
  try {
    return readItem(LIVE_CHECKS_KEY) !== '0';
  } catch {
    return true;
  }
}

function writeLive(live: boolean): void {
  try {
    writeItem(LIVE_CHECKS_KEY, live ? '1' : '0');
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
    prepareClonedCells(graph.getDataModel(), cells);
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
      const report = validateModelReport(model);
      lastResult = { issues: report.issues, notes: report.notes.map((n) => n.message), objectCounts: counts, at: new Date() };
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

  // ---- active graph listeners: the panels follow the active session (ui/session.ts), a background
  // tab's selection / model changes never reach them
  let bound: { graph: Graph; dispose: () => void } | null = null;
  const onSelectionChange = (): void => {
    if (currentView === 'data') dataPanel.refresh();
  };
  const onModelChange = (_sender: EventSource, _evt: EventObject): void => {
    if (currentView === 'data') dataPanel.refresh();
    scheduleChecks();
  };
  function bind(graph: Graph | null = getGraph()): void {
    if (bound?.graph === graph) return;
    if (bound) {
      bound.dispose();
      bound = null;
    }
    if (graph) {
      const offSelection = onGraphSelectionChange(graph, onSelectionChange);
      const offModel = onGraphModelChange(graph, onModelChange);
      bound = {
        graph,
        dispose: () => {
          offSelection();
          offModel();
        },
      };
    }
  }
  const onSessionChanged = ({ session }: { session: { graph: Graph } | null }): void => {
    bind(session?.graph ?? null);
    if (!session) return;
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

  const onView = (detail: { view: RightPanelView } | undefined): void => {
    bind();
    currentView = detail?.view ?? 'properties';
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
  const onExport = (id: string): void => {
    if (id === 'xlsx' || getReport(id)) void exportReport(id as ReportId | 'xlsx');
    else if (ETCS_EXPORTS.includes(id)) void exportEtcs(id);
  };
  /** Balise ETCS data exports (lazy etcs/etcs-export.ts; the XLSX writer is its own chunk). */
  const exportEtcs = async (id: string): Promise<void> => {
    const tab = tabManager.getActiveTab();
    if (!tab) return;
    const model = tab.graph.getDataModel();
    const base = fileBaseName(tab.name);
    try {
      const { buildEtcsVariableTable, buildEtcsSummaryTable, buildEtcsJson, buildEtcsHtmlReport } = await import('./etcs/etcs-export');
      const env = etcsEnvFromModel(model);
      const withData = env.groups.filter((g) => g.data).length;
      if (env.groups.length === 0) {
        notify.warning('The diagram has no balise groups.');
        return;
      }
      if (id === 'etcsCsv') {
        const table = buildEtcsVariableTable(env);
        download(new Blob([tableToCsv(table)], { type: 'text/csv;charset=utf-8' }), `${base}-balise-data.csv`);
      } else if (id === 'etcsXlsx') {
        const { buildXlsx } = await import('./xlsx');
        const bytes = buildXlsx([buildEtcsSummaryTable(env), buildEtcsVariableTable(env)]);
        download(new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${base}-balise-data.xlsx`);
      } else if (id === 'etcsJson') {
        download(new Blob([buildEtcsJson(env, model, tab.name)], { type: 'application/json' }), `${base}-balise-data.json`);
      } else {
        download(new Blob([buildEtcsHtmlReport(env, tab.name)], { type: 'text/html;charset=utf-8' }), `${base}-balise-telegrams.html`);
      }
      if (withData === 0) notify.warning(`No balise group has ETCS data yet (Railway > ETCS Data…): exported ${env.groups.length} group${env.groups.length === 1 ? '' : 's'} without packets`);
      else notify.success(`Exported the ETCS data of ${withData} balise group${withData === 1 ? '' : 's'}`);
    } catch (error) {
      notify.error(`Could not export the ETCS data: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  /** Railway > ETCS Data… / context menu / Data panel: the editor of the selected balise group (or of a selected balise's group). */
  const onEtcs = (): void => {
    const graph = getGraph();
    if (!graph) return;
    const model = graph.getDataModel();
    const selected = graph.getSelectionCells();
    let group = selected.find((c) => getCellKind(c) === 'baliseGroup') ?? null;
    if (!group) {
      const balise = selected.find((c) => getCellKind(c) === 'balise');
      const gid = balise ? readAttr(balise, 'rdGroupId').trim().toUpperCase() : '';
      group = gid ? collectObjects(model).find((o) => o.kind.id === 'baliseGroup' && o.id.toUpperCase() === gid)?.cell ?? null : null;
    }
    if (!group) {
      notify.warning('Select a balise group (or one of its balises) first, then ETCS Data… edits its telegram data.');
      return;
    }
    const cell = group;
    import('./etcs/etcs-dialog')
      .then(({ openEtcsDialog }) => openEtcsDialog({ model, cell, notify, download }))
      .catch((error: unknown) => notify.error(`Could not open the ETCS editor: ${error instanceof Error ? error.message : String(error)}`));
  };
  on(RIGHT_PANEL_EVENT, onView);
  on('active-session-changed', onSessionChanged);
  on('railway-edit-data-request', onEditData);
  on('railway-checks-request', onChecks);
  on('railway-export-request', onExport);
  on('railway-etcs-request', onEtcs);

  return {
    dataPanel,
    checksPanel,
    runChecks,
    getIssues: () => lastResult?.issues ?? [],
    destroy() {
      if (timer) clearTimeout(timer);
      bound?.dispose();
      off(RIGHT_PANEL_EVENT, onView);
      off('active-session-changed', onSessionChanged);
      off('railway-edit-data-request', onEditData);
      off('railway-checks-request', onChecks);
      off('railway-export-request', onExport);
      off('railway-etcs-request', onEtcs);
      dataPanel.destroy();
      checksPanel.destroy();
    },
  };
}
