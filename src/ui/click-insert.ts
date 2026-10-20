/**
 * @file click-insert.ts
 * @brief Where a palette click (no drop point) inserts its shape, like draw.io's
 *        Sidebar.prototype.itemClicked / dropAndConnect (jgraph/drawio v32.4.1, Sidebar.js):
 *
 * 1. A railway symbol that snaps to tracks (signal, balise, axle counter, LEU; snap.ts SNAP_KINDS)
 *    while one track / track section is selected: on that track, at the visible point of its line
 *    nearest the view centre. The insert's snap (snap.ts, same undoable edit) then puts it on the
 *    line (signals beside it) and sets its track reference and km.
 * 2. One unlocked vertex selected (and a vertex entry): next to it, `DEFAULT_EDGE_LENGTH` to the
 *    east and vertically centred (draw.io dropAndConnect, DIRECTION_EAST), moved down while the
 *    spot is taken, and connected to it by an edge (graph default style). draw.io does this on
 *    Alt+Click; here a plain click does it and Alt+Click skips it (view centre instead).
 * 3. Otherwise the view centre; when the shape would overlap an existing one there, the next free
 *    spot of a cascade (right, then the next row), so successive clicks do not stack shapes.
 *
 * The palette view adds the cells and the edge in one model update (one undo step) and selects
 * the new cell.
 */
import type { Cell, Graph } from '@maxgraph/core';
import type { PaletteEntry } from './drawio-palette';
import { getViewCenter } from './drawio-palette/entry-cells';
import { kindForPaletteEntry } from '../railway/catalogue';
import type { Box, Pt } from '../railway/geometry';
import { absoluteBounds } from '../railway/geometry';
import { SNAP_KINDS } from '../railway/snap';
import { linkLine, projectPoint } from '../railway/topology';
import { collectObjects } from '../railway/validation';

/** draw.io Graph.defaultEdgeLength: gap between a selected shape and the one added next to it. */
export const DEFAULT_EDGE_LENGTH = 80;
/** Gap between cascaded shapes. */
export const CASCADE_GAP = 20;

export interface ClickPlacement {
  /** Centre of the inserted cells, graph coordinates. */
  at: Pt;
  /** Connect the inserted vertex to this cell (one edge, same edit). */
  connectFrom?: Cell;
}

function intersects(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** Bounds of the visible vertices of the default parent's layer (top-level shapes). */
function occupiedBoxes(graph: Graph): Box[] {
  const out: Box[] = [];
  const parent = graph.getDefaultParent();
  for (const cell of parent?.children ?? []) {
    if (!cell.isVertex() || !cell.isVisible()) continue;
    const b = absoluteBounds(cell);
    if (b) out.push(b);
  }
  return out;
}

function boxAt(c: Pt, w: number, h: number): Box {
  return { x: c.x - w / 2, y: c.y - h / 2, width: w, height: h };
}

/** Visible part of the graph, graph coordinates. */
export function visibleRect(graph: Graph): Box {
  const container = graph.container;
  const { scale, translate } = graph.view;
  return {
    x: (container?.scrollLeft ?? 0) / scale - translate.x,
    y: (container?.scrollTop ?? 0) / scale - translate.y,
    width: (container?.clientWidth ?? 0) / scale,
    height: (container?.clientHeight ?? 0) / scale,
  };
}

/** Point of `line` nearest `p` that lies in `rect` (else the nearest point overall). */
export function nearestVisiblePoint(p: Pt, line: Pt[], rect: Box): Pt {
  const nearest = projectPoint(p, line).point;
  const inside = (q: Pt): boolean => q.x >= rect.x && q.x <= rect.x + rect.width && q.y >= rect.y && q.y <= rect.y + rect.height;
  if (rect.width <= 0 || rect.height <= 0 || inside(nearest)) return nearest;
  let best: Pt | null = null;
  let bestD = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i];
    const b = line[i + 1];
    for (let s = 0; s <= 64; s++) {
      const q = { x: a.x + ((b.x - a.x) * s) / 64, y: a.y + ((b.y - a.y) * s) / 64 };
      if (!inside(q)) continue;
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = q;
      }
    }
  }
  return best ?? nearest;
}

/** First cascade spot from `start` whose box is free (right in steps, then the next row). */
export function freeSpot(start: Pt, w: number, h: number, taken: Box[], perRow = 4, maxRows = 6): Pt {
  for (let i = 0; i < perRow * maxRows; i++) {
    const c = {
      x: start.x + (i % perRow) * (w + CASCADE_GAP),
      y: start.y + Math.floor(i / perRow) * (h + CASCADE_GAP),
    };
    const box = boxAt(c, w, h);
    if (!taken.some((t) => intersects(t, box))) return c;
  }
  return start;
}

/** The placement of a palette click (see the file comment); `alt` = Alt held (no connect). */
export function clickInsertPlacement(graph: Graph, entry: PaletteEntry, alt = false): ClickPlacement {
  const centre = getViewCenter(graph);
  const w = entry.width || 40;
  const h = entry.height || 40;
  const selection = graph.getSelectionCells();
  if (!alt && selection.length === 1) {
    const selected = selection[0];
    const kind = kindForPaletteEntry(entry)?.kind;
    if (kind && SNAP_KINDS.has(kind)) {
      const track = collectObjects(graph.getDataModel()).find(
        (o) => o.cell === selected && (o.kind.id === 'track' || o.kind.id === 'trackSection'),
      );
      const line = track ? linkLine(track) : null;
      if (line && line.length > 0) return { at: nearestVisiblePoint(centre, line, visibleRect(graph)) };
    }
    if (selected.isVertex() && entry.kind !== 'edge' && !graph.isCellLocked(selected)) {
      const b = absoluteBounds(selected);
      if (b) {
        const start = { x: b.x + b.width + DEFAULT_EDGE_LENGTH + w / 2, y: b.y + b.height / 2 };
        const taken = occupiedBoxes(graph);
        return { at: freeSpot(start, w, h, taken, 1, 10), connectFrom: selected };
      }
    }
  }
  return { at: freeSpot(centre, w, h, occupiedBoxes(graph)) };
}
