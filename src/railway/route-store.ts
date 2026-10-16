/**
 * @file route-store.ts
 * @brief Route objects in the model: each route is an edge (kind `route`) on its own layer
 *        "Routes" (root child `rd-routes`), drawn as a translucent highlight along its path with
 *        its ID as label. The layer keeps routes apart from the drawing; View > Show Routes hides
 *        it (draw.io shows it as a normal layer). Route edges are not movable/bendable; their
 *        geometry is recomputed by "Update Route Paths" after the tracks changed.
 */
import { Cell, Geometry, Point } from '@maxgraph/core';
import type { CellStyle, Graph, GraphDataModel } from '@maxgraph/core';
import { formatStoredNumber, splitRefList } from './catalogue';
import type { Pt } from './geometry';
import { ID_PLACEHOLDER, buildDataValue, readObjectId, setRailwayData, usedIds, nextFreeId } from './object-data';
import type { RoutePath } from './routes';
import { findRoutePaths, routeValues } from './routes';
import { buildTopology } from './topology';
import type { RailObject } from './validation';
import { collectObjects, indexObjects } from './validation';
import { parseStyleString } from '../services/drawio-xml';

export const ROUTES_LAYER_ID = 'rd-routes';
export const ROUTE_COLOR = '#ff8f00';

export function routeEdgeStyle(): CellStyle {
  const style = parseStyleString(
    `edgeStyle=none;rounded=1;html=1;endArrow=block;endFill=1;startArrow=oval;startFill=1;strokeColor=${ROUTE_COLOR};strokeWidth=5;opacity=60;` +
      `fontColor=#b35c00;fontStyle=1;labelBackgroundColor=#ffffff;`
  ) as Record<string, unknown>;
  Object.assign(style, { movable: false, bendable: false, editable: false, resizable: false, connectable: false, rdRoute: 1 });
  return style as CellStyle;
}

export function getRoutesLayer(model: GraphDataModel): Cell | null {
  const cell = model.getCell(ROUTES_LAYER_ID);
  return cell && cell.getParent() === model.getRoot() ? cell : null;
}

/** The Routes layer, created (inside the caller's update) when missing. */
export function ensureRoutesLayer(model: GraphDataModel): Cell {
  const existing = getRoutesLayer(model);
  if (existing) return existing;
  const layer = new Cell('Routes');
  layer.setId(ROUTES_LAYER_ID);
  model.add(model.getRoot()!, layer);
  return layer;
}

/** Drops points that lie on the straight line between their neighbours. */
export function simplifyLine(line: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of line) {
    if (out.length > 0 && Math.hypot(p.x - out[out.length - 1].x, p.y - out[out.length - 1].y) < 0.5) continue;
    while (out.length >= 2) {
      const a = out[out.length - 2];
      const b = out[out.length - 1];
      const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
      if (Math.abs(cross) / (Math.hypot(p.x - a.x, p.y - a.y) || 1) < 0.5) out.pop();
      else break;
    }
    out.push({ ...p });
  }
  return out;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function routeGeometry(line: Pt[]): Geometry {
  const pts = simplifyLine(line);
  const geo = new Geometry();
  geo.relative = true;
  const first = pts[0] ?? { x: 0, y: 0 };
  const last = pts[pts.length - 1] ?? first;
  geo.setTerminalPoint(new Point(round(first.x), round(first.y)), true);
  geo.setTerminalPoint(new Point(round(last.x), round(last.y)), false);
  geo.points = pts.slice(1, -1).map((p) => new Point(round(p.x), round(p.y)));
  return geo;
}

/** A free route ID (`R1`, `R2`, ...). */
export function nextRouteId(model: GraphDataModel): string {
  return nextFreeId('route', usedIds(model, 'route'));
}

/**
 * Adds a route object for `path` (one undoable edit): the edge on the Routes layer with the
 * route data, and the route ID in the entry signal's "Routes" list.
 */
export function addRoute(graph: Graph, path: RoutePath, entry: RailObject, exit: RailObject, id?: string): Cell {
  const model = graph.getDataModel();
  const routeId = id?.trim() || nextRouteId(model);
  const value = buildDataValue('', { kind: 'route', values: { id: routeId, ...routeValues(path, entry, exit) } }) as Element;
  value.setAttribute('label', ID_PLACEHOLDER);
  value.setAttribute('placeholders', '1');
  const edge = new Cell(value, routeGeometry(path.line), routeEdgeStyle());
  edge.setEdge(true);
  model.beginUpdate();
  try {
    const layer = ensureRoutesLayer(model);
    model.add(layer, edge);
    const routes = splitRefList(entry.values.routes);
    if (!routes.some((r) => r.toUpperCase() === routeId.toUpperCase())) {
      setRailwayData(model, [entry.cell], { values: { routes: [...routes, routeId].join(', ') } });
    }
  } finally {
    model.endUpdate();
  }
  return edge;
}

export interface RoutePathUpdate {
  updated: number;
  /** Routes without a path in the drawing now. */
  failed: string[];
}

/**
 * Recomputes the geometry and length of every route from the drawing (one undoable edit): the path
 * with the route's sections (else the first one) between its signals. Data other than the length
 * is kept; routes without a path are listed in `failed` and unchanged.
 */
export function updateRoutePaths(model: GraphDataModel): RoutePathUpdate {
  const objects = collectObjects(model);
  const index = indexObjects(objects);
  const topo = buildTopology(objects);
  const result: RoutePathUpdate = { updated: 0, failed: [] };
  model.beginUpdate();
  try {
    for (const r of objects.filter((o) => o.kind.id === 'route')) {
      const entry = index.get('signal')?.get((r.values.entrySignal ?? '').trim().toUpperCase());
      const exit = index.get('signal')?.get((r.values.exitSignal ?? '').trim().toUpperCase());
      const paths = entry && exit ? findRoutePaths(topo, entry, exit, { maxPaths: 16 }).paths : [];
      const sections = splitRefList(r.values.sections).map((s) => s.toUpperCase());
      const path = paths.find((p) => p.sections.map((s) => s.toUpperCase()).join(',') === sections.join(',')) ?? (sections.length === 0 ? paths[0] : undefined);
      if (!path || !r.cell.isEdge()) {
        result.failed.push(r.id || readObjectId(r.cell) || String(r.cell.getId()));
        continue;
      }
      model.setGeometry(r.cell, routeGeometry(path.line));
      setRailwayData(model, [r.cell], { values: { length: formatStoredNumber(Math.round(path.metres)) } });
      result.updated++;
    }
  } finally {
    model.endUpdate();
  }
  return result;
}

/** Shows or hides the Routes layer (view state saved with the file, not an undoable edit). */
export function setRoutesVisible(graph: Graph, visible: boolean): void {
  const layer = getRoutesLayer(graph.getDataModel());
  if (!layer || layer.isVisible() === visible) return;
  layer.setVisible(visible);
  graph.refresh();
}

