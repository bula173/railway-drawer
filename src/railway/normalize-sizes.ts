/**
 * @file normalize-sizes.ts
 * @brief Arrange > Normalize Symbol Sizes: gives the selected railway symbols the default box of
 *        the symbol size standard (symbol-sizes.ts), in one undoable edit, around their centres
 *        (snap to track then re-places snapped kinds beside their track as for a move). Mirrors the
 *        library generators: a signal's lamp row is re-laid out in the signal box (one lamp
 *        diameter, the row centred beside the mast, the head band on the side it is drawn, texts in
 *        the label band), a board's face is centred beside its post, a train is scaled to the
 *        standard height (aspect kept, texts keep their box), a TC joint marker group and single
 *        shapes get the class box. Symbols already in their standard size are left alone; existing
 *        drawings are never changed without this command.
 */
import { Point } from '@maxgraph/core';
import type { Cell, Geometry, Graph, GraphDataModel } from '@maxgraph/core';
import { getCellKind, readAttr } from './object-data';
import { signalLamps } from './state-apply';
import { SYMBOL_SIZES, normalisedSize, symbolClassOf } from './symbol-sizes';
import type { Size } from './symbol-sizes';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Edits = Map<Cell, Geometry>;

function geoOf(edits: Edits, cell: Cell): Geometry | null {
  const g = edits.get(cell) ?? cell.getGeometry();
  return g ? (edits.has(cell) ? g : g.clone()) : null;
}

function put(edits: Edits, cell: Cell, g: Geometry): void {
  edits.set(cell, g);
}

function isText(cell: Cell): boolean {
  const s = cell.getStyle() as unknown;
  if (typeof s === 'string') return /^text(;|$)/.test(s);
  const names = s && typeof s === 'object' ? (s as { baseStyleNames?: unknown }).baseStyleNames : undefined;
  return Array.isArray(names) && names.includes('text');
}

function descendants(cell: Cell): Cell[] {
  return (cell.children ?? []).flatMap((c) => [c, ...descendants(c)]);
}

/** Offset of `cell`'s coordinate system inside `top` (its nested groups' x/y). */
function originIn(cell: Cell, top: Cell): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (let p = cell.getParent(); p && p !== top; p = p.getParent()) {
    const g = p.getGeometry();
    x += g?.x ?? 0;
    y += g?.y ?? 0;
  }
  return { x, y };
}

function edgePoints(g: Geometry): Point[] {
  return [g.sourcePoint, g.targetPoint, ...(g.points ?? [])].filter((p): p is Point => !!p);
}

function setEnds(edits: Edits, edge: Cell, a: [number, number], b: [number, number]): void {
  const g = geoOf(edits, edge);
  if (!g) return;
  g.sourcePoint = new Point(a[0], a[1]);
  g.targetPoint = new Point(b[0], b[1]);
  put(edits, edge, g);
}

function setBox(edits: Edits, cell: Cell, b: Box): void {
  const g = geoOf(edits, cell);
  if (!g) return;
  g.x = b.x;
  g.y = b.y;
  g.width = b.w;
  g.height = b.h;
  put(edits, cell, g);
}

/** Signal group -> the standard signal box (the generators' relayout_signal). */
function relayoutSignal(graph: Graph, edits: Edits, cell: Cell, own: Box): void {
  const S = SYMBOL_SIZES.signal;
  const lampCells = new Set(signalLamps(graph, cell));
  const lamps: Array<{ c: Cell; b: Box }> = [];
  const masts: Cell[] = [];
  const arms: Cell[] = [];
  const texts: Cell[] = [];
  const groups: Cell[] = [];
  const others: Array<{ c: Cell; o: { x: number; y: number } }> = [];
  for (const c of descendants(cell)) {
    const g = c.getGeometry();
    if (!g) continue;
    const o = originIn(c, cell);
    if (c.isEdge()) {
      const pts = edgePoints(g);
      const vertical = pts.length === 2 && Math.abs(pts[0].x - pts[1].x) < 0.01;
      const horizontal = pts.length === 2 && Math.abs(pts[0].y - pts[1].y) < 0.01;
      if (vertical) masts.push(c);
      else if (horizontal) arms.push(c);
      else others.push({ c, o });
    } else if ((c.children?.length ?? 0) > 0) groups.push(c);
    else if (lampCells.has(c)) lamps.push({ c, b: { x: g.x + o.x, y: g.y + o.y, w: g.width, h: g.height } });
    else if (isText(c)) texts.push(c);
    else others.push({ c, o });
  }
  if (lamps.length === 0 || masts.length === 0) return;
  lamps.sort((a, b) => a.b.x - b.b.x);
  const n = lamps.length;
  const lampCx = lamps.reduce((s, l) => s + l.b.x + l.b.w / 2, 0) / n;
  const lampCy = lamps.reduce((s, l) => s + l.b.y + l.b.h / 2, 0) / n;
  const mg = masts[0].getGeometry()!;
  const mastX = (edgePoints(mg)[0]?.x ?? 0) + originIn(masts[0], cell).x;
  const mastLeft = mastX < lampCx;
  const headTop = Math.abs(lampCy - own.h / 2) < 0.5 ? readAttr(cell, 'rdDirection') !== 'reverse' : lampCy < own.h / 2;
  const y0 = headTop ? 0 : S.h - S.head;
  const ly = y0 + (S.head - S.lamp) / 2;
  const mx = mastLeft ? S.mastInset : S.w - S.mastInset;
  const [a0, a1] = mastLeft ? [mx + S.arm, S.w] : [0, mx - S.arm];
  const rx0 = a0 + (a1 - a0 - n * S.lamp) / 2;
  const ox0 = lamps[0].b.x;
  const ox1 = Math.max(...lamps.map((l) => l.b.x + l.b.w));
  const oy0 = Math.min(...lamps.map((l) => l.b.y));
  const oy1 = Math.max(...lamps.map((l) => l.b.y + l.b.h));
  const sx = ox1 > ox0 ? (n * S.lamp) / (ox1 - ox0) : 1;
  const sy = oy1 > oy0 ? S.lamp / (oy1 - oy0) : 1;
  const mapX = (x: number): number => rx0 + (x - ox0) * sx;
  const mapY = (y: number): number => ly + (y - oy0) * sy;
  for (const g of groups) setBox(edits, g, { x: 0, y: 0, w: S.w, h: S.h });
  lamps.forEach((l, i) => setBox(edits, l.c, { x: rx0 + i * S.lamp, y: ly, w: S.lamp, h: S.lamp }));
  for (const m of masts) setEnds(edits, m, [mx, y0], [mx, y0 + S.head]);
  const armEnd = mastLeft ? rx0 : rx0 + n * S.lamp;
  for (const a of arms) setEnds(edits, a, [mx, y0 + S.head / 2], [armEnd, y0 + S.head / 2]);
  for (const t of texts) setBox(edits, t, { x: 0, y: headTop ? S.head : 0, w: S.w, h: S.h - S.head });
  for (const { c, o } of others) {
    const g = geoOf(edits, c);
    if (!g) continue;
    if (c.isEdge()) {
      for (const p of edgePoints(g)) {
        p.x = mapX(p.x + o.x);
        p.y = mapY(p.y + o.y);
      }
    } else {
      g.x = mapX(g.x + o.x);
      g.y = mapY(g.y + o.y);
      g.width *= sx;
      g.height *= sy;
    }
    put(edits, c, g);
  }
}

/** Board group (post + arm + face) -> the standard board box, face centred beside the post. */
function relayoutBoard(edits: Edits, cell: Cell): void {
  const B = SYMBOL_SIZES.board;
  const kids = cell.children ?? [];
  const face = kids.find((c) => c.isVertex() && !isText(c));
  const fg = face?.getGeometry();
  const post = kids.find((c) => c.isEdge() && (() => {
    const p = edgePoints(c.getGeometry()!);
    return p.length === 2 && Math.abs(p[0].x - p[1].x) < 0.01;
  })());
  if (!face || !fg || !post) return;
  const postLeft = (edgePoints(post.getGeometry()!)[0]?.x ?? 0) < fg.x + fg.width / 2;
  const square = Math.abs(fg.width - fg.height) < 0.25 * Math.max(fg.width, fg.height);
  const [fw, fh] = square ? B.symbolFace : B.face;
  const X = (x: number, w = 0): number => (postLeft ? x : B.w - x - w);
  const a0 = 1 + B.arm;
  const fx = a0 + (B.w - a0 - fw) / 2;
  const fy = (B.h - fh) / 2;
  const sx = fw / (fg.width || fw);
  const sy = fh / (fg.height || fh);
  const old = { x: fg.x, y: fg.y };
  for (const c of kids) {
    if (c === face || c === post) continue;
    const g = geoOf(edits, c);
    if (!g) continue;
    if (c.isEdge()) {
      const p = edgePoints(g);
      if (p.length === 2 && Math.abs(p[0].y - p[1].y) < 0.01) {
        // the arm from the post to the face
        g.sourcePoint = new Point(X(1), B.h / 2);
        g.targetPoint = new Point(X(fx), B.h / 2);
      } else {
        // a strike over the face follows it
        for (const q of p) {
          q.x = X(fx, fw) + (q.x - old.x) * sx;
          q.y = fy + (q.y - old.y) * sy;
        }
      }
      put(edits, c, g);
    }
  }
  setEnds(edits, post, [X(1), 0], [X(1), B.h]);
  setBox(edits, face, { x: X(fx, fw), y: fy, w: fw, h: fh });
}

/** Scales every cell inside `cell` (texts keep their box: centred as before, bottom edge scaled). */
function scaleInside(edits: Edits, cell: Cell, sx: number, sy: number): void {
  for (const c of descendants(cell)) {
    const g = geoOf(edits, c);
    if (!g) continue;
    if (c.isEdge()) {
      for (const p of edgePoints(g)) {
        p.x *= sx;
        p.y *= sy;
      }
    } else if (isText(c)) {
      g.x = (g.x + g.width / 2) * sx - g.width / 2;
      g.y = (g.y + g.height) * sy - g.height;
    } else {
      g.x *= sx;
      g.y *= sy;
      g.width *= sx;
      g.height *= sy;
    }
    put(edits, c, g);
  }
}

/** TC joint marker group: lines scaled, parts (the bar) keep their size and move with the scale. */
function normaliseJoint(edits: Edits, cell: Cell, own: Box, to: Size): void {
  const sx = to.w / own.w;
  const sy = to.h / own.h;
  for (const c of cell.children ?? []) {
    const g = geoOf(edits, c);
    if (!g) continue;
    if (c.isEdge()) {
      for (const p of edgePoints(g)) {
        p.x *= sx;
        p.y *= sy;
      }
    } else {
      g.x = (g.x + g.width / 2) * sx - g.width / 2;
      g.y = (g.y + g.height / 2) * sy - g.height / 2;
    }
    put(edits, c, g);
  }
}

/** The cells of `cells` (railway symbols with a standard class) that get a new size. */
export function normalizeSymbolSizes(graph: Graph, cells: Cell[]): Cell[] {
  const model: GraphDataModel = graph.getDataModel();
  const edits: Edits = new Map();
  const changed: Cell[] = [];
  for (const cell of cells) {
    const geo = cell.getGeometry();
    if (!cell.isVertex() || !geo || graph.isCellLocked(cell)) continue;
    const cls = symbolClassOf(getCellKind(cell), readAttr(cell, 'rdSignalType'));
    if (!cls) continue;
    const own: Box = { x: geo.x, y: geo.y, w: geo.width, h: geo.height };
    const to = normalisedSize(cls, { w: own.w, h: own.h });
    if (Math.abs(to.w - own.w) < 0.01 && Math.abs(to.h - own.h) < 0.01) continue;
    if ((cell.children?.length ?? 0) > 0) {
      if (cls === 'signal') relayoutSignal(graph, edits, cell, own);
      else if (cls === 'board') relayoutBoard(edits, cell);
      else if (cls === 'insulatedJoint') normaliseJoint(edits, cell, own, to);
      else scaleInside(edits, cell, to.w / own.w, to.h / own.h);
    }
    const next = geoOf(edits, cell)!;
    next.x = own.x + own.w / 2 - to.w / 2;
    next.y = own.y + own.h / 2 - to.h / 2;
    next.width = to.w;
    next.height = to.h;
    put(edits, cell, next);
    changed.push(cell);
  }
  if (edits.size > 0) {
    model.batchUpdate(() => {
      for (const [c, g] of edits) model.setGeometry(c, g);
    });
  }
  return changed;
}

/** The railway symbols among the selection (and the selected groups' railway children). */
export function selectedSymbols(graph: Graph): Cell[] {
  const out: Cell[] = [];
  for (const c of graph.getSelectionCells()) {
    if (getCellKind(c)) out.push(c);
    else if (!c.isEdge()) for (const k of c.children ?? []) if (getCellKind(k)) out.push(k);
  }
  return out;
}

