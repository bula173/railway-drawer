/**
 * @file click-insert.ts
 * @brief Where a palette click (no drop point) inserts its shape, like draw.io's
 *        Sidebar.prototype.itemClicked / dropAndConnect (jgraph/drawio v32.4.1, Sidebar.js):
 *
 * 1. A railway symbol that snaps to tracks (signal, balise, axle counter, LEU; snap.ts SNAP_KINDS)
 *    while one track / track section is selected: on that track, at the visible point of its line
 *    nearest the view centre. The insert's snap (snap.ts, same undoable edit) then puts it on the
 *    line (signals beside it) and sets its track reference and km.
 * 2. One unlocked vertex selected (and a vertex entry): next to it, `DEFAULT_EDGE_LENGTH` away and
 *    centred on that side (draw.io dropAndConnect), moved along the side while the spot is taken
 *    (down for east / west, right for south / north), and connected to it by an edge (graph default
 *    style). Directions use draw.io's itemClicked modifiers without its Alt (draw.io only connects on
 *    Alt+Click; here a plain click connects and Alt+Click skips it, view centre instead):
 *      - plain click: east, or south (below) when the east side already has a neighbour (a shape
 *        in the band `DEFAULT_EDGE_LENGTH` + the new width to the right of the selected shape);
 *      - Shift+click: east (draw.io Alt+Shift);
 *      - Ctrl/Cmd+click: north (draw.io Alt+Ctrl/Cmd);
 *      - Ctrl/Cmd+Shift+click: west (draw.io Alt+Ctrl/Cmd+Shift).
 *    The same applies to Enter / Space on a palette tile.
 * 3. Otherwise the view centre; when the shape would overlap an existing one there, the next free
 *    spot of a cascade (right, then the next row), so successive clicks do not stack shapes.
 *
 * The palette view adds the cells and the edge in one model update (one undo step) and selects
 * the new cell.
 */
import type { Cell, Graph } from '@maxgraph/core';
import type { PaletteClickModifiers, PaletteEntry } from './drawio-palette';
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

export type InsertDirection = 'east' | 'south' | 'north' | 'west';

/** draw.io's itemClicked direction for the modifiers (without Alt); null = automatic (east, else south). */
export function clickDirection(mods: Partial<PaletteClickModifiers>): InsertDirection | null {
  if (mods.mod) return mods.shift ? 'west' : 'north';
  return mods.shift ? 'east' : null;
}

/** True when a shape lies in the band east of `b` where an insert of `w` x `h` would go. */
export function hasEastNeighbour(b: Box, w: number, h: number, taken: Box[]): boolean {
  const height = Math.max(b.height, h);
  const band = { x: b.x + b.width, y: b.y + b.height / 2 - height / 2, width: DEFAULT_EDGE_LENGTH + w, height };
  return taken.some((t) => intersects(t, band));
}

/** First free spot from `start`, stepping by (`dx`, `dy`). */
function freeSpotAlong(start: Pt, w: number, h: number, taken: Box[], dx: number, dy: number, max = 10): Pt {
  for (let i = 0; i < max; i++) {
    const c = { x: start.x + dx * i, y: start.y + dy * i };
    if (!taken.some((t) => intersects(t, boxAt(c, w, h)))) return c;
  }
  return start;
}

/** Centre of a `w` x `h` shape placed `DEFAULT_EDGE_LENGTH` from `b` in `direction`, free of `taken`. */
export function placeBeside(b: Box, direction: InsertDirection, w: number, h: number, taken: Box[]): Pt {
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  switch (direction) {
    case 'east':
      return freeSpotAlong({ x: b.x + b.width + DEFAULT_EDGE_LENGTH + w / 2, y: cy }, w, h, taken, 0, h + CASCADE_GAP);
    case 'west':
      return freeSpotAlong({ x: b.x - DEFAULT_EDGE_LENGTH - w / 2, y: cy }, w, h, taken, 0, h + CASCADE_GAP);
    case 'south':
      return freeSpotAlong({ x: cx, y: b.y + b.height + DEFAULT_EDGE_LENGTH + h / 2 }, w, h, taken, w + CASCADE_GAP, 0);
    case 'north':
      return freeSpotAlong({ x: cx, y: b.y - DEFAULT_EDGE_LENGTH - h / 2 }, w, h, taken, w + CASCADE_GAP, 0);
  }
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

/**
 * The placement of a palette click (see the file comment). `modifiers`: Alt = no connect (view
 * centre), Shift / Ctrl/Cmd pick the side (`clickDirection`); a boolean is the old `alt` flag.
 */
export function clickInsertPlacement(
  graph: Graph,
  entry: PaletteEntry,
  modifiers: Partial<PaletteClickModifiers> | boolean = {}
): ClickPlacement {
  const mods = typeof modifiers === 'boolean' ? { alt: modifiers } : modifiers;
  const centre = getViewCenter(graph);
  const w = entry.width || 40;
  const h = entry.height || 40;
  const selection = graph.getSelectionCells();
  if (!mods.alt && selection.length === 1) {
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
        const taken = occupiedBoxes(graph);
        const direction = clickDirection(mods) ?? (hasEastNeighbour(b, w, h, taken) ? 'south' : 'east');
        return { at: placeBeside(b, direction, w, h, taken), connectFrom: selected };
      }
    }
  }
  return { at: freeSpot(centre, w, h, occupiedBoxes(graph)) };
}
