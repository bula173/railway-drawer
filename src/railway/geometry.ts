/**
 * @file geometry.ts
 * @brief Model-only geometry for the railway checks: absolute bounds of vertices and polylines of
 *        tracks, computed from cell geometries (no view needed, so it works in tests and on
 *        hidden tabs). Rotation is ignored.
 */
import type { Cell } from '@maxgraph/core';

export interface Pt {
  x: number;
  y: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Absolute top-left of a cell's coordinate space (the sum of its ancestor vertices' origins). */
function originOf(parent: Cell | null): Pt {
  let x = 0;
  let y = 0;
  for (let p = parent; p; p = p.getParent()) {
    const geo = p.getGeometry();
    if (!geo || !p.isVertex() || geo.relative) continue;
    x += Number(geo.x) || 0;
    y += Number(geo.y) || 0;
  }
  return { x, y };
}

/** Absolute bounds of a vertex, or of an edge's polyline; null without geometry. */
export function absoluteBounds(cell: Cell): Box | null {
  if (cell.isEdge()) {
    const pts = edgePolyline(cell);
    if (!pts || pts.length === 0) return null;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
  }
  const geo = cell.getGeometry();
  if (!geo || geo.relative) return null;
  const o = originOf(cell.getParent());
  return { x: o.x + (Number(geo.x) || 0), y: o.y + (Number(geo.y) || 0), width: Number(geo.width) || 0, height: Number(geo.height) || 0 };
}

export function centerOf(cell: Cell): Pt | null {
  const b = absoluteBounds(cell);
  return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null;
}

/** Points of an edge: terminal centres or terminal points, plus its control points. */
export function edgePolyline(edge: Cell): Pt[] | null {
  const geo = edge.getGeometry();
  if (!geo) return null;
  const o = originOf(edge.getParent());
  const shift = (p: { x: number; y: number }): Pt => ({ x: o.x + (Number(p.x) || 0), y: o.y + (Number(p.y) || 0) });
  const end = (isSource: boolean): Pt | null => {
    const terminal = edge.getTerminal(isSource);
    if (terminal && terminal.isVertex()) {
      const c = centerOf(terminal);
      if (c) return c;
    }
    const p = geo.getTerminalPoint(isSource);
    return p ? shift(p) : null;
  };
  const start = end(true);
  const stop = end(false);
  if (!start || !stop) return null;
  return [start, ...(geo.points ?? []).map(shift), stop];
}

/**
 * The centre line of a track-like cell: an edge's polyline, or the long axis of a vertex
 * (a rail drawn as a thin shape).
 */
export function trackPolyline(cell: Cell): Pt[] | null {
  if (cell.isEdge()) return edgePolyline(cell);
  const b = absoluteBounds(cell);
  if (!b) return null;
  if (b.width >= b.height) {
    const y = b.y + b.height / 2;
    return [{ x: b.x, y }, { x: b.x + b.width, y }];
  }
  const x = b.x + b.width / 2;
  return [{ x, y: b.y }, { x, y: b.y + b.height }];
}

export interface Projection {
  /** Distance from the point to the polyline. */
  distance: number;
  /** Arc length along the polyline to the nearest point. */
  along: number;
}

/** Nearest point of a polyline to `p`: distance and position along the line. */
export function projectOnPolyline(p: Pt, line: Pt[]): Projection {
  if (line.length === 1) return { distance: Math.hypot(p.x - line[0].x, p.y - line[0].y), along: 0 };
  let best: Projection = { distance: Infinity, along: 0 };
  let offset = 0;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i];
    const b = line[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    const qx = a.x + t * dx;
    const qy = a.y + t * dy;
    const d = Math.hypot(p.x - qx, p.y - qy);
    const len = Math.sqrt(len2);
    if (d < best.distance) best = { distance: d, along: offset + t * len };
    offset += len;
  }
  return best;
}
