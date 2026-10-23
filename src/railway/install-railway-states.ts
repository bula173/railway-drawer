/**
 * @file install-railway-states.ts
 * @brief Wires runtime states into the main editor (called once from main-editor.ts after
 *        installRailwayRoutes): the window event `railway-state-request` (context menu "State ▸ /
 *        Aspect ▸ / Position ▸", Railway > Object State ▸ items `data-action="railwayState:<cmd>"`,
 *        dispatched by MenuController) runs on the active tab's selection; the states legend over
 *        the canvas (Railway > Object State > State Legend, localStorage `rd.railway.stateLegend`).
 */
import { off, on } from '../core/event-bus';
import type { Cell, Graph } from '@maxgraph/core';
import './railway-states.css';
import type { TabManager } from '../ui/tabs';
import { createGraphFeature } from '../core/graph-feature';
import type { RailwayNotifier } from './install-railway-data';
import { getCellKind } from './object-data';
import { STATE_REQUEST_EVENT } from './state-menu';
import { installPointsFade } from './points-fade';
import { stateShortcutCommand } from './state-shortcuts';
import { shouldIgnoreGraphShortcut } from '../ui/delete';
import { applicableCells, occupyUnderTrains, resetAllStates, resetObjectStates, runRouteCommand, setStateOnCells } from './state-apply';
import type { StateDimension, StateVisual } from './states';
import { STATE_SCHEME, scaledStrokeWidth } from './states';
import { readItem, writeItem } from '../core/safe-storage';
import { STORAGE_KEYS } from '../core/storage-keys';

export const STATE_LEGEND_KEY = STORAGE_KEYS.railwayStateLegend;

export interface RailwayStatesHandle {
  run(command: string): void;
  isLegendShown(): boolean;
  destroy(): void;
}


function readLegendFlag(): boolean {
  try {
    return readItem(STATE_LEGEND_KEY) === '1';
  } catch {
    return false;
  }
}

function writeLegendFlag(on: boolean): void {
  try {
    writeItem(STATE_LEGEND_KEY, on ? '1' : '0');
  } catch {
    // session only
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** A small picture of a state's look (diagram colours, not chrome). */
function swatch(visual: StateVisual, lamp: boolean): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '28');
  svg.setAttribute('height', '12');
  svg.setAttribute('viewBox', '0 0 28 12');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('rd-state-swatch');
  if (lamp) {
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', '14');
    c.setAttribute('cy', '6');
    c.setAttribute('r', '5');
    c.setAttribute('fill', visual.lamp && visual.lamp !== 'none' ? visual.lamp : 'none');
    c.setAttribute('class', 'rd-state-swatch-outline');
    svg.append(c);
    return svg;
  }
  const l = document.createElementNS(SVG_NS, 'line');
  l.setAttribute('x1', '2');
  l.setAttribute('y1', '6');
  l.setAttribute('x2', '26');
  l.setAttribute('y2', '6');
  l.setAttribute('stroke-width', String(visual.widthScale ? scaledStrokeWidth(4, visual.widthScale) : 4));
  if (visual.stroke) l.setAttribute('stroke', visual.stroke);
  else l.setAttribute('class', 'rd-state-swatch-drawn');
  if (visual.dashPattern) l.setAttribute('stroke-dasharray', visual.dashPattern);
  if (visual.opacity !== undefined) l.setAttribute('opacity', String(visual.opacity / 100));
  svg.append(l);
  return svg;
}

/** Legend rows: [group title, [label, visual, lamp]]. */
function legendRows(): Array<[string, Array<[string, StateVisual, boolean]>]> {
  const of = (id: keyof typeof STATE_SCHEME, dim: StateDimension, lamp = false): Array<[string, StateVisual, boolean]> =>
    (STATE_SCHEME[id][dim]?.options ?? []).map((o) => [o.label, o.visual, lamp]);
  return [
    ['Track sections, tracks, points', of('section', 'state')],
    ['Points position (diverging leg)', of('points', 'position')],
    ['Routes', of('route', 'state')],
    ['Signal aspects (lamps)', of('signal', 'aspect', true)],
    ['Level crossings', of('levelCrossing', 'state')],
    ['Balises, LEUs, axle counters, joints', of('equipment', 'state')],
  ];
}

export function buildStateLegend(onClose: () => void): HTMLElement {
  const root = document.createElement('div');
  root.className = 'rd-state-legend';
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Object states legend');
  root.dataset.testid = 'state-legend';
  const head = document.createElement('div');
  head.className = 'rd-state-legend-head';
  const title = document.createElement('span');
  title.className = 'rd-strong';
  title.textContent = 'Object states';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'rd-btn rd-state-legend-close';
  close.textContent = '×';
  close.title = 'Hide the legend (Railway > Object State > State Legend)';
  close.setAttribute('aria-label', 'Hide the states legend');
  close.addEventListener('click', onClose);
  head.append(title, close);
  root.append(head);
  for (const [group, rows] of legendRows()) {
    const section = document.createElement('div');
    section.className = 'rd-state-legend-group';
    const h = document.createElement('div');
    h.className = 'rd-state-legend-title';
    h.textContent = group;
    section.append(h);
    for (const [label, visual, lamp] of rows) {
      const row = document.createElement('div');
      row.className = 'rd-state-legend-row';
      const text = document.createElement('span');
      text.textContent = label;
      row.append(swatch(visual, lamp), text);
      section.append(row);
    }
    root.append(section);
  }
  return root;
}

const NOTHING_SELECTED = 'Select a track section, track, points, signal, route or level crossing first.';

/** Height of the canvas' horizontal scrollbar (style.css `.rd-graph-canvas::-webkit-scrollbar`). */
const CANVAS_SCROLLBAR_PX = 12;

export function installRailwayStates(tabManager: TabManager, notify: RailwayNotifier): RailwayStatesHandle {
  const getGraph = (): Graph | null => tabManager.getActiveTab()?.graph ?? null;
  let legendOn = readLegendFlag();
  let legend: HTMLElement | null = null;

  const placeLegend = (): void => {
    const host = document.getElementById('graph-container');
    if (!legend || !host) return;
    const r = host.getBoundingClientRect();
    legend.style.left = `${Math.round(r.left + 8)}px`;
    // Above the canvas' horizontal scrollbar (12 px, style.css .rd-graph-canvas), which comes and
    // goes with the zoom: the legend stays fixed in the view and never covers it
    legend.style.bottom = `${Math.round(Math.max(8, window.innerHeight - r.bottom + 8) + CANVAS_SCROLLBAR_PX)}px`;
  };
  const syncLegend = (): void => {
    if (legendOn && !legend) {
      legend = buildStateLegend(() => run('toggleLegend'));
      document.body.append(legend);
    } else if (!legendOn && legend) {
      legend.remove();
      legend = null;
    }
    placeLegend();
    document.querySelectorAll('[data-action="railwayState:toggleLegend"]').forEach((item) => item.setAttribute('aria-checked', String(legendOn)));
  };

  const selection = (graph: Graph): Cell[] => graph.getSelectionCells().filter((c) => c.isVertex() || c.isEdge());

  const run = (command: string): void => {
    if (command === 'toggleLegend') {
      legendOn = !legendOn;
      writeLegendFlag(legendOn);
      syncLegend();
      return;
    }
    const graph = getGraph();
    if (!graph) return;
    const cells = selection(graph);
    if (command === 'resetAll') {
      const changed = resetAllStates(graph);
      notify.success(changed.length > 0 ? 'All object states reset to the drawn colours' : 'No object has a state');
      return;
    }
    if (command === 'reset') {
      if (cells.length === 0) notify.warning(NOTHING_SELECTED);
      else resetObjectStates(graph, cells);
      return;
    }
    if (command === 'setRoute' || command === 'releaseRoute' || command === 'occupyRoute') {
      const routes = cells.filter((c) => getCellKind(c) === 'route');
      if (routes.length === 0) {
        notify.warning('Select a route (Routes layer) first.');
        return;
      }
      const missing = new Set<string>();
      const model = graph.getDataModel();
      model.beginUpdate();
      try {
        for (const r of routes) {
          const res = runRouteCommand(graph, r, command === 'setRoute' ? 'set' : command === 'occupyRoute' ? 'occupy' : 'release');
          res.missing.forEach((m) => missing.add(m));
        }
      } finally {
        model.endUpdate();
      }
      if (missing.size > 0) notify.warning(`Not found in the drawing: ${[...missing].join(', ')}`);
      return;
    }
    if (command === 'occupyUnderTrain' || command === 'freeUnderTrain') {
      const trains = cells.filter((c) => getCellKind(c) === 'train');
      if (trains.length === 0) {
        notify.warning('Select a train first.');
        return;
      }
      const changed = occupyUnderTrains(graph, trains, command === 'occupyUnderTrain');
      if (changed.length === 0 && command === 'occupyUnderTrain') notify.warning('No track section or track under the train.');
      return;
    }
    const m = /^(state|aspect|position):(.+)$/.exec(command);
    if (!m) return;
    const dim = m[1] as StateDimension;
    const targets = applicableCells(cells, dim, m[2]);
    if (targets.length === 0) {
      notify.warning(cells.length === 0 ? NOTHING_SELECTED : `None of the selected objects can be set to "${m[2]}".`);
      return;
    }
    setStateOnCells(graph, targets, dim, m[2]);
  };

  const onRequest = (detail: string | undefined): void => {
    if (typeof detail === 'string') run(detail);
  };
  // points in reverse: the straight continuation faded (view overlay per tab graph, points-fade.ts)
  const fades = createGraphFeature('points-fade', installPointsFade);
  const syncFades = (): void => fades.sync(tabManager.getAllTabs().map((t) => t.graph));

  // Alt+F/O/R/N/V/1-4 on the selection (state-shortcuts.ts; event.code: Alt types characters on
  // macOS). Bubble phase after main-editor's dispatcher; the scenario view swallows Alt keys before.
  const onKey = (e: KeyboardEvent): void => {
    const command = stateShortcutCommand(e);
    const graph = getGraph();
    if (!command || !graph || e.defaultPrevented || shouldIgnoreGraphShortcut(e, graph)) return;
    if (e.target instanceof Element && e.target.closest('#menu-bar, #context-menu, .rd-toolbar-menu, .left-panel-overflow-menu, [role="dialog"]')) return;
    // only for the canvas (panels use their own keys)
    const focus = document.activeElement;
    if (focus && focus !== document.body && !graph.container.contains(focus)) return;
    e.preventDefault();
    if (!e.repeat) run(command);
  };

  on(STATE_REQUEST_EVENT, onRequest);
  window.addEventListener('resize', placeLegend);
  document.addEventListener('keydown', onKey);
  on('tab-changed', syncFades);
  on('tab-closed', syncFades);
  syncLegend();
  syncFades();

  const handle: RailwayStatesHandle = {
    run,
    isLegendShown: () => legendOn,
    destroy() {
      off(STATE_REQUEST_EVENT, onRequest);
      window.removeEventListener('resize', placeLegend);
      document.removeEventListener('keydown', onKey);
      off('tab-changed', syncFades);
      off('tab-closed', syncFades);
      fades.dispose();
      legend?.remove();
      legend = null;
    },
  };
  return handle;
}
