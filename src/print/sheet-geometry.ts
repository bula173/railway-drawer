/**
 * @file sheet-geometry.ts
 * @brief Where everything goes on a sheet (paper millimetres, origin top-left): the frame, the
 *        title block in the bottom-right corner of the frame, the revision table above it, the
 *        legend box (left of the title block, or above the revision table when there is no room),
 *        and where the drawing is printed; plus the sheet's extent in drawing units (draw.io page
 *        view: the page at the origin, `pageScale` times the page size).
 */
import { PX_PER_MM, type SheetSetup } from './sheet-setup';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Title block size (mm): the usual 180 mm wide block of technical drawings. */
export const TITLE_BLOCK = { width: 180, height: 50 } as const;
/** Revision table: header and row heights (mm). */
export const REVISION_ROW = { header: 5, row: 5 } as const;
/** Free space between a fitted drawing and the frame / blocks (mm). */
export const FIT_PADDING = 5;
/** Legend: title height, row height, column width, rows per column (mm). */
export const LEGEND = { title: 6, row: 6, column: 55, rows: 7, pad: 2 } as const;

export interface SheetLayoutInput {
  /** Revision rows printed (the table shows at least one empty row). */
  revisionRows: number;
  /** Legend entries (0: no legend box). */
  legendEntries: number;
}

export interface SheetGeometry {
  paper: { width: number; height: number };
  /** The frame (= the paper inside the margins when there is no frame line). */
  frame: Rect;
  titleBlock: Rect | null;
  revisions: Rect | null;
  legend: Rect | null;
  legendColumns: number;
  /** The candidate areas for a fitted drawing (beside / above the blocks). */
  fitAreas: Rect[];
  /** Drawing units per paper mm (x / y: draw.io's page px are not exactly square in mm). */
  unitsPerMm: { x: number; y: number };
  /** The sheet in drawing coordinates (fixed scale: what is printed; fit: the page view's page). */
  sheetInDrawing: Rect;
}

export function legendColumns(entries: number): number {
  return entries > 0 ? Math.ceil(entries / LEGEND.rows) : 0;
}

export function legendSize(entries: number): { width: number; height: number } {
  if (entries <= 0) return { width: 0, height: 0 };
  const rows = Math.min(entries, LEGEND.rows);
  return { width: legendColumns(entries) * LEGEND.column, height: LEGEND.title + rows * LEGEND.row + LEGEND.pad };
}

export function revisionTableHeight(rows: number): number {
  return REVISION_ROW.header + Math.max(1, rows) * REVISION_ROW.row;
}

/** The sheet's layout for `setup` with the given block contents. */
export function sheetGeometry(setup: SheetSetup, input: SheetLayoutInput): SheetGeometry {
  const { width, height } = setup.paper;
  const m = setup.margins;
  const left = m.left + setup.filing;
  const frame: Rect = { x: left, y: m.top, width: Math.max(10, width - left - m.right), height: Math.max(10, height - m.top - m.bottom) };
  const right = frame.x + frame.width;
  const bottom = frame.y + frame.height;

  let titleBlock: Rect | null = null;
  let revisions: Rect | null = null;
  let legend: Rect | null = null;
  const blockWidth = Math.min(TITLE_BLOCK.width, frame.width);
  let stackTop = bottom;
  if (setup.titleBlock) {
    titleBlock = { x: right - blockWidth, y: bottom - TITLE_BLOCK.height, width: blockWidth, height: TITLE_BLOCK.height };
    stackTop = titleBlock.y;
  }
  if (setup.revisions) {
    const h = revisionTableHeight(input.revisionRows);
    revisions = { x: right - blockWidth, y: stackTop - h, width: blockWidth, height: h };
    stackTop = revisions.y;
  }
  let besideWidth = setup.titleBlock || setup.revisions ? blockWidth : 0;
  if (setup.legend && input.legendEntries > 0) {
    const size = legendSize(input.legendEntries);
    const besideRoom = frame.width - besideWidth;
    if (titleBlock && size.width <= besideRoom && size.height <= frame.height) {
      // left of the title block, on the frame's bottom edge
      legend = { x: titleBlock.x - size.width, y: bottom - size.height, width: size.width, height: size.height };
      besideWidth += size.width;
    } else {
      const w = Math.min(size.width, frame.width);
      legend = { x: right - w, y: stackTop - size.height, width: w, height: size.height };
      stackTop = legend.y;
      besideWidth = Math.max(besideWidth, w);
    }
  }

  // A fitted drawing goes above the blocks (full width) or left of them (full height), FIT_PADDING inside
  const fitAreas: Rect[] = [];
  const topOfBlocks = Math.min(stackTop, legend ? legend.y : stackTop);
  const inset = (r: Rect): Rect => ({ x: r.x + FIT_PADDING, y: r.y + FIT_PADDING, width: Math.max(1, r.width - 2 * FIT_PADDING), height: Math.max(1, r.height - 2 * FIT_PADDING) });
  if (topOfBlocks < bottom) {
    fitAreas.push(inset({ x: frame.x, y: frame.y, width: frame.width, height: Math.max(1, topOfBlocks - frame.y) }));
    if (besideWidth < frame.width) fitAreas.push(inset({ x: frame.x, y: frame.y, width: frame.width - besideWidth, height: frame.height }));
  } else {
    fitAreas.push(inset(frame));
  }

  const unitsPerMm = {
    x: (setup.pagePx.width / setup.paper.width) * setup.scale,
    y: (setup.pagePx.height / setup.paper.height) * setup.scale,
  };
  return {
    paper: { width, height },
    frame,
    titleBlock,
    revisions,
    legend,
    legendColumns: legend ? legendColumns(input.legendEntries) : 0,
    fitAreas,
    unitsPerMm,
    sheetInDrawing: { x: 0, y: 0, width: setup.pagePx.width * setup.scale, height: setup.pagePx.height * setup.scale },
  };
}

/** Where a drawing of `content` size (drawing units) is printed in fit mode: the largest of the fit areas, centred. */
export function fitPlacement(geometry: SheetGeometry, content: { width: number; height: number }): { rect: Rect; scale: number } {
  const w = Math.max(1, content.width);
  const h = Math.max(1, content.height);
  let best: { rect: Rect; scale: number } | null = null;
  for (const area of geometry.fitAreas) {
    const scale = Math.min(area.width / w, area.height / h);
    if (!best || scale > best.scale) {
      const rw = w * scale;
      const rh = h * scale;
      best = { rect: { x: area.x + (area.width - rw) / 2, y: area.y + (area.height - rh) / 2, width: rw, height: rh }, scale };
    }
  }
  return best ?? { rect: { ...geometry.frame }, scale: 1 };
}

/** The printed ratio 1:x of a fitted drawing (paper mm per drawing unit `scale` vs draw.io's 1:1). */
export function effectiveRatio(scale: number): number {
  return scale > 0 ? 1 / (scale * PX_PER_MM) : 1;
}
