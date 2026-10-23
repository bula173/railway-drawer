/**
 * @file install-railway-routes.ts
 * @brief Wires the railway engineering tools into the main editor (called once from
 *        main-editor.ts after installRailwayData): the route tool (toolbar `#btn-route-tool`,
 *        Extras > Route Tool), route and interlocking tables, the conflict matrix, Rule settings…,
 *        Update Route Paths, Recalculate km, View > Snap to Track / Show Routes / km Ruler.
 *
 * Menu items carry `data-action="railwayRoute:<command>"`; MenuController dispatches the window
 * event `railway-route-request` with the command as detail (see RouteCommand).
 */
import { reportLoadFailure } from '../core/load-failure';
import { onModelChange, onSelectionChange } from '../core/graph-events';
import { off, on } from '../core/event-bus';
import type { Graph } from '@maxgraph/core';
import './railway-routes.css';
import type { TabManager } from '../ui/tabs';
import { createGraphFeature } from '../core/graph-feature';
import { GraphOverlay, pointsAttr, svgEl } from './graph-overlay';
import { downloadBlob } from './install-railway-data';
import type { RailwayNotifier } from './install-railway-data';
import { formatChainage, kmScaleOf, recalculateKm, rulerTicks } from './km';
import { getCellKind, setRailwayData } from './object-data';
import { fileBaseName } from './report';
import type { RouteTableTab } from './route-tables-dialog';
import { RouteTool } from './route-tool';
import { getRoutesLayer, setRoutesVisible, updateRoutePaths } from './route-store';
import { buildRouteTable, detectConflicts, routeRecords } from './routes';
import { computeInterlocking } from './interlocking';
import { installSnapToTrack, readSnapEnabled, writeSnapEnabled } from './snap';
import { collectObjects } from './validation';
import { readItem, writeItem } from '../core/safe-storage';
import { STORAGE_KEYS } from '../core/storage-keys';

export type RouteCommand =
  | 'tool'
  | 'routeTable'
  | 'conflictTable'
  | 'conflictMatrix'
  | 'ruleSettings'
  | 'updateRoutes'
  | 'recalcKm'
  | 'toggleSnap'
  | 'toggleRoutes'
  | 'toggleKmRuler';

export const ROUTE_REQUEST_EVENT = 'railway-route-request' as const;
export const KM_RULER_KEY = STORAGE_KEYS.railwayKmRuler;

export interface RailwayRoutesHandle {
  tool: RouteTool;
  run(command: RouteCommand): void;
  isSnapEnabled(): boolean;
  isKmRulerOn(): boolean;
  destroy(): void;
}


function readFlag(key: string, fallback: boolean): boolean {
  try {
    const v = readItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

function writeFlag(key: string, on: boolean): void {
  try {
    writeItem(key, on ? '1' : '0');
  } catch {
    // session only
  }
}

export interface InstallRailwayRoutesOptions {
  download?: (blob: Blob, fileName: string) => void;
}

export function installRailwayRoutes(tabManager: TabManager, notify: RailwayNotifier, options: InstallRailwayRoutesOptions = {}): RailwayRoutesHandle {
  const download = options.download ?? downloadBlob;
  const getGraph = (): Graph | null => tabManager.getActiveTab()?.graph ?? null;
  let snap = readSnapEnabled();
  let ruler = readFlag(KM_RULER_KEY, false);
  const button = document.getElementById('btn-route-tool');

  const syncMenu = (): void => {
    const set = (cmd: RouteCommand, on: boolean): void => {
      document.querySelectorAll(`[data-action="railwayRoute:${cmd}"]`).forEach((item) => item.setAttribute('aria-checked', String(on)));
    };
    set('toggleSnap', snap);
    set('toggleKmRuler', ruler);
    const layer = getGraph() ? getRoutesLayer(getGraph()!.getDataModel()) : null;
    set('toggleRoutes', layer ? layer.isVisible() : true);
    set('tool', tool.isActive());
  };

  const tool = new RouteTool({
    getGraph,
    notify,
    onChange: (active) => {
      button?.classList.toggle('active', active);
      button?.setAttribute('aria-pressed', String(active));
      syncMenu();
    },
  });

  // ---- per graph: snap to track
  const snapFeature = createGraphFeature('snap-to-track', (graph) => installSnapToTrack(graph, () => snap));
  const ensureSnap = (): void => snapFeature.sync(tabManager.getAllTabs().map((tab) => tab.graph));

  // ---- km ruler of the selected track
  let rulerGraph: Graph | null = null;
  let rulerOverlay: GraphOverlay | null = null;
  let rulerBound: (() => void) | null = null;
  const drawRuler = (): void => {
    if (!rulerOverlay || !rulerGraph) return;
    const selected = rulerGraph.getSelectionCells().filter((c) => getCellKind(c) === 'track' || getCellKind(c) === 'trackSection');
    const objects = selected.length > 0 ? collectObjects(rulerGraph.getDataModel()) : [];
    const children: SVGElement[] = [];
    for (const cell of selected) {
      const o = objects.find((x) => x.cell === cell);
      const scale = o ? kmScaleOf(o) : null;
      if (!scale) continue;
      const g = svgEl('g', { class: 'rd-km-ruler', 'data-track': o!.id });
      g.append(svgEl('polyline', { points: pointsAttr(scale.line), class: 'rd-km-ruler-line' }));
      for (const t of rulerTicks(scale)) {
        const len = t.major ? 10 : 5;
        g.append(svgEl('line', { x1: t.point.x, y1: t.point.y, x2: t.point.x + t.normal.x * len, y2: t.point.y + t.normal.y * len, class: t.major ? 'rd-km-tick rd-km-major' : 'rd-km-tick' }));
        if (t.major) {
          const label = svgEl('text', { x: t.point.x + t.normal.x * 20, y: t.point.y + t.normal.y * 20 + 3, class: 'rd-km-label', 'text-anchor': 'middle' });
          label.textContent = formatChainage(t.km);
          g.append(label);
        }
      }
      children.push(g);
    }
    rulerOverlay.set(children);
  };
  const unbindRuler = (): void => {
    rulerBound?.();
    rulerBound = null;
    rulerOverlay?.destroy();
    rulerOverlay = null;
    rulerGraph = null;
  };
  const bindRuler = (): void => {
    const graph = ruler ? getGraph() : null;
    if (graph === rulerGraph) {
      drawRuler();
      return;
    }
    unbindRuler();
    if (!graph) return;
    rulerGraph = graph;
    rulerOverlay = new GraphOverlay(graph, 'rd-km-ruler-overlay');
    const offSelection = onSelectionChange(graph, drawRuler);
    const offModel = onModelChange(graph, drawRuler);
    rulerBound = () => {
      offSelection();
      offModel();
    };
    drawRuler();
  };

  const showTables = (tab: RouteTableTab): void => {
    const active = tabManager.getActiveTab();
    if (!active) return;
    const objects = collectObjects(active.graph.getDataModel());
    const records = routeRecords(objects);
    const conflicts = detectConflicts(records);
    const interlocking = computeInterlocking(objects);
    // The dialog and its XLSX writer are a separate chunk, loaded on first use
    import('./route-tables-dialog')
      .then(({ openRouteTablesDialog }) =>
        openRouteTablesDialog({
          routes: buildRouteTable(records, conflicts),
          interlocking,
          tab,
          baseName: fileBaseName(active.name),
          download,
        })
      )
      .catch((error: unknown) => {
        reportLoadFailure('error', 'Railway', 'route tables could not be loaded', error);
      });
  };

  const run = (command: RouteCommand): void => {
    ensureSnap();
    const graph = getGraph();
    switch (command) {
      case 'tool':
        tool.toggle();
        break;
      case 'routeTable':
        showTables('routes');
        break;
      case 'conflictTable':
        showTables('interlocking');
        break;
      case 'conflictMatrix':
        showTables('conflicts');
        break;
      case 'ruleSettings': {
        if (!graph) break;
        // the dialog is a separate chunk, loaded on first use
        import('./rule-settings-dialog')
          .then(({ openRuleSettingsDialog }) => openRuleSettingsDialog({ model: graph.getDataModel(), notify }))
          .catch((error: unknown) => {
            console.error('[Railway] rule settings could not be loaded', error);
          });
        break;
      }
      case 'updateRoutes': {
        if (!graph) break;
        const r = updateRoutePaths(graph.getDataModel());
        if (r.failed.length > 0) notify.warning(`Updated ${r.updated} route${r.updated === 1 ? '' : 's'}; no path in the drawing for ${r.failed.join(', ')}`);
        else notify.success(`Updated ${r.updated} route path${r.updated === 1 ? '' : 's'}`);
        break;
      }
      case 'recalcKm': {
        if (!graph) break;
        const updates = recalculateKm(collectObjects(graph.getDataModel()));
        if (updates.length === 0) {
          notify.success('km positions are up to date (objects need a track with km start and end)');
          break;
        }
        const byCell = new Map(updates.map((u) => [u.cell, u.km]));
        setRailwayData(graph.getDataModel(), [...byCell.keys()], (cell) => ({ values: { km: byCell.get(cell) ?? '' } }));
        notify.success(`Recalculated km of ${updates.length} object${updates.length === 1 ? '' : 's'}`);
        break;
      }
      case 'toggleSnap':
        snap = !snap;
        writeSnapEnabled(snap);
        break;
      case 'toggleRoutes': {
        if (!graph) break;
        const layer = getRoutesLayer(graph.getDataModel());
        if (!layer) notify.warning('The diagram has no routes yet.');
        else setRoutesVisible(graph, !layer.isVisible());
        break;
      }
      case 'toggleKmRuler':
        ruler = !ruler;
        writeFlag(KM_RULER_KEY, ruler);
        bindRuler();
        if (ruler && graph && !graph.getSelectionCells().some((c) => getCellKind(c) === 'track' || getCellKind(c) === 'trackSection')) {
          notify.warning('Select a track with km start and km end to see its km ruler.');
        }
        break;
    }
    syncMenu();
  };

  const onRequest = (detail: string): void => {
    const cmd = detail as RouteCommand;
    run(cmd);
  };
  const onTab = (): void => {
    if (tool.isActive()) tool.deactivate();
    ensureSnap();
    bindRuler();
    syncMenu();
  };
  on(ROUTE_REQUEST_EVENT, onRequest);
  on('tab-changed', onTab);
  on('tab-closed', onTab);
  // the toolbar button runs `railwayRoute:tool` (ui/commands, toolbar.ts data-command)
  ensureSnap();
  bindRuler();
  syncMenu();

  const handle: RailwayRoutesHandle = {
    tool,
    run,
    isSnapEnabled: () => snap,
    isKmRulerOn: () => ruler,
    destroy() {
      tool.deactivate();
      unbindRuler();
      snapFeature.dispose();
      off(ROUTE_REQUEST_EVENT, onRequest);
      off('tab-changed', onTab);
      off('tab-closed', onTab);
    },
  };
  return handle;
}
