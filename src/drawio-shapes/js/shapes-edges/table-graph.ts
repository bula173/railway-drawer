/**
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Ported from jgraph/drawio v32.4.1 src/main/webapp/js/grapheditor/Graph.js:
 *   18664 visitTableCells, 18741 getTableLines, 18800 paintTableCellLines,
 *   18888 isTableCell, 18896 isTableRow, 18981 isTable, 18995 isCollapsedTable,
 *   19013 getCollapsedTableForCell, 19046 isCollapsedTableChildShape,
 *   19173 createCollapsedTableBorder, 19190 getCollapsedTableBorderKey,
 *   19204 getCollapsedTableShapeInfo, 19229 getCollapsedTableFillMode,
 *   19261 getCollapsedTableBands, 19302 getCollapsedTableRegions,
 *   19433 getCollapsedTableBorders, 23028 isSwimlane (table/tableRow),
 * and src/main/webapp/mxgraph/src/view/mxGraph.js:10015 getSwimlaneDirection,
 * :10066 getActualStartSize.
 *
 * The draw.io Graph methods are plain functions taking the maxGraph Graph so
 * the shapes work without patching Graph.prototype.
 */

import { AbstractCanvas2D, Cell, CellState, Geometry, Graph, Point, Rectangle, Shape, constants, mathUtils } from '@maxgraph/core';
import { NONE, getNumber, getString, getValue, isFlag, toFlag } from './util';

type StyleRecord = Record<string, unknown>;

/** Graph.minTableColumnWidth (Graph.js:1923). */
export const MIN_TABLE_COLUMN_WIDTH = 20;

/** Graph.minTableRowHeight (Graph.js:1928). */
export const MIN_TABLE_ROW_HEIGHT = 20;

function cellStyle(graph: Graph, cell: Cell | null): StyleRecord {
  return (cell != null ? graph.getCellStyle(cell) : {}) as StyleRecord;
}

function currentStyle(graph: Graph, cell: Cell, ignoreState = false): StyleRecord {
  return graph.getCurrentCellStyle(cell, ignoreState) as StyleRecord;
}

/** Visible child vertices (mxGraphModel.getChildCells(cell, true)). */
export function childVertices(cell: Cell | null): Cell[] {
  return cell != null ? cell.getChildCells(true, false) : [];
}

/** Graph.isSwimlane (Graph.js:23028): swimlane, table and tableRow shapes. */
export function isDrawioSwimlane(graph: Graph, cell: Cell | null, ignoreState = false): boolean {
  if (cell != null && !cell.isEdge() && cell.getParent() !== graph.getDataModel().getRoot()) {
    const shape = currentStyle(graph, cell, ignoreState).shape;
    return shape === 'swimlane' || shape === 'table' || shape === 'tableRow';
  }

  return false;
}

/** mxGraph.getSwimlaneDirection (mxGraph.js:10015). */
export function swimlaneDirection(style: StyleRecord): string {
  const dir = getString(style, 'direction', 'east');
  const flipH = isFlag(style, 'flipH', false);
  const flipV = isFlag(style, 'flipV', false);
  const h = toFlag(getValue(style, 'horizontal', true));
  let n = h ? 0 : 3;

  if (dir === 'north') {
    n--;
  } else if (dir === 'west') {
    n += 2;
  } else if (dir === 'south') {
    n += 1;
  }

  const m = mathUtils.mod(n, 2);

  if (flipH && m === 1) {
    n += 2;
  }

  if (flipV && m === 0) {
    n += 2;
  }

  return ['north', 'east', 'south', 'west'][mathUtils.mod(n, 4)];
}

/**
 * mxGraph.getActualStartSize (mxGraph.js:10066) with draw.io's isSwimlane,
 * returning top, left, bottom, right start sizes as y, x, height, width.
 */
export function getActualStartSize(graph: Graph, cell: Cell | null, ignoreState = false): Rectangle {
  const result = new Rectangle();

  if (cell != null && isDrawioSwimlane(graph, cell, ignoreState)) {
    const style = currentStyle(graph, cell, ignoreState);
    const size = Math.trunc(getNumber(style, 'startSize', constants.DEFAULT_STARTSIZE));
    const dir = swimlaneDirection(style);

    if (dir === 'north') {
      result.y = size;
    } else if (dir === 'west') {
      result.x = size;
    } else if (dir === 'south') {
      result.height = size;
    } else {
      result.width = size;
    }
  }

  return result;
}

/** Graph.isTable (Graph.js:18981). */
export function isTable(graph: Graph, cell: Cell | null): boolean {
  return cell != null && cellStyle(graph, cell).childLayout === 'tableLayout';
}

/** Graph.isTableRow (Graph.js:18896). */
export function isTableRow(graph: Graph, cell: Cell | null): boolean {
  return cell != null && cell.isVertex() && isTable(graph, cell.getParent());
}

/** Graph.isTableCell (Graph.js:18888). */
export function isTableCell(graph: Graph, cell: Cell | null): boolean {
  return cell != null && cell.isVertex() && isTableRow(graph, cell.getParent());
}

/** Graph.isStack (Graph.js:19735). */
export function isStack(graph: Graph, cell: Cell | null): boolean {
  return cell != null && cellStyle(graph, cell).childLayout === 'stackLayout';
}

export interface TableIter {
  cell: Cell;
  rowspan: number;
  colspan: number;
  row: number;
  col: number;
  geo: Geometry;
  point: Point;
  actual: TableIter;
}

export type TableVisitor = (iter: TableIter, colCount: number, rowCount: number, x0: number, y0: number) => void;

/** Graph.visitTableCells (Graph.js:18664). */
export function visitTableCells(graph: Graph, cell: Cell, visitor: TableVisitor): void {
  let lastRow: (TableIter | null)[] | null = null;
  const rows = childVertices(cell);
  const start = getActualStartSize(graph, cell, true);

  for (let i = 0; i < rows.length; i++) {
    const rowStart = getActualStartSize(graph, rows[i], true);
    const cols = childVertices(rows[i]);
    const rowStyle = cellStyle(graph, rows[i]);
    let lastCol: TableIter | null = null;
    const row: (TableIter | null)[] = [];

    for (let j = 0; j < cols.length; j++) {
      const cgeo = cols[j].getGeometry();

      // Skips cells with no geometry (consistent with TableLayout.layoutRow)
      if (cgeo == null) {
        row.push(null);
        continue;
      }

      const col = { cell: cols[j], rowspan: 1, colspan: 1, row: i, col: j, geo: cgeo } as TableIter;
      const geo = cgeo.alternateBounds != null ? cgeo.alternateBounds : cgeo;
      const first = lastRow != null ? lastRow[0] : null;
      col.point = new Point(geo.width + (lastCol != null ? lastCol.point.x : start.x + rowStart.x),
        geo.height + (first != null ? first.point.y : start.y + rowStart.y));
      col.actual = col;

      const above = lastRow != null ? lastRow[j] : null;

      if (above != null && above.rowspan > 1) {
        col.rowspan = above.rowspan - 1;
        col.colspan = above.colspan;
        col.actual = above.actual;
      } else if (lastCol != null && lastCol.colspan > 1) {
        col.rowspan = lastCol.rowspan;
        col.colspan = lastCol.colspan - 1;
        col.actual = lastCol.actual;
      } else {
        const style = currentStyle(graph, cols[j], true);

        if (style != null) {
          col.rowspan = Math.trunc(getNumber(style, 'rowspan', 1)) || 1;
          col.colspan = Math.trunc(getNumber(style, 'colspan', 1)) || 1;
        }
      }

      const head = isFlag(rowStyle, 'swimlaneHead', true) &&
        getValue(rowStyle, 'strokeColor', NONE) !== NONE;

      visitor(col, cols.length, rows.length, start.x + (head ? rowStart.x : 0), start.y + (head ? rowStart.y : 0));
      row.push(col);
      lastCol = col;
    }

    lastRow = row;
  }
}

/** Graph.getTableLines (Graph.js:18741). Arrays may contain null (gaps). */
export function getTableLines(graph: Graph, cell: Cell, horizontal: boolean, vertical: boolean): (Point | null)[][] {
  const hl: (Point | null)[][] = [];
  const vl: (Point | null)[][] = [];

  if (horizontal || vertical) {
    visitTableCells(graph, cell, (iter, colCount, rowCount, x0, y0) => {
      // Constructs horizontal lines
      if (horizontal && iter.row < rowCount - 1) {
        if (hl[iter.row] == null) {
          hl[iter.row] = [new Point(x0, iter.point.y)];
        }

        if (iter.rowspan > 1) {
          hl[iter.row].push(null);
        }

        hl[iter.row].push(iter.point);
      }

      // Constructs vertical lines
      if (vertical && iter.col < colCount - 1) {
        if (vl[iter.col] == null) {
          vl[iter.col] = [new Point(iter.point.x, y0)];
        }

        if (iter.colspan > 1) {
          vl[iter.col].push(null);
        }

        vl[iter.col].push(iter.point);
      }
    });
  }

  // Sparse arrays are compacted like Array.concat does when iterated
  return hl.concat(vl).filter((l) => l != null);
}

/** TableLineShape.paintTableLine (Shapes.js:126). */
export function paintTableLine(c: AbstractCanvas2D, line: (Point | null)[] | null, dx: number, dy: number): void {
  if (line != null) {
    let last: Point | null = null;
    c.begin();

    for (let i = 0; i < line.length; i++) {
      const curr = line[i];

      if (curr != null) {
        if (last == null) {
          c.moveTo(curr.x + dx, curr.y + dy);
        } else {
          c.lineTo(curr.x + dx, curr.y + dy);
        }
      }

      last = curr;
    }

    c.end();
    c.stroke();
  }
}

/** Graph.isCollapsedTable (Graph.js:18995). */
export function isCollapsedTable(graph: Graph, cell: Cell | null): boolean {
  if (cell != null && cell.isVertex()) {
    const style = currentStyle(graph, cell);

    return style != null && style.tableRender === 'collapsed' &&
      style.childLayout === 'tableLayout' && style.shape === 'table';
  }

  return false;
}

/** Graph.getCollapsedTableForCell (Graph.js:19013). */
export function getCollapsedTableForCell(graph: Graph, cell: Cell | null): Cell | null {
  if (cell != null && cell.isVertex()) {
    const parent = cell.getParent();

    if (parent != null && parent.isVertex()) {
      if (isCollapsedTable(graph, parent)) {
        return parent;
      }

      const table = parent.getParent();

      if (isCollapsedTable(graph, table)) {
        return table;
      }
    }
  }

  return null;
}

/** Graph.isCollapsedTableChildShape (Graph.js:19046). */
export function isCollapsedTableChildShape(graph: Graph, state: CellState | null): boolean {
  if (state != null && state.style != null && getCollapsedTableForCell(graph, state.cell) != null) {
    const style = state.style as StyleRecord;
    const shape = style.shape;

    return shape === 'tableRow' || shape === 'partialRectangle' ||
      ((shape == null || shape === 'rectangle' || shape === 'swimlane') && !isFlag(style, 'rounded', false));
  }

  return false;
}

/** Graph.paintTableCellLines (Graph.js:18800). */
export function paintTableCellLines(graph: Graph, c: AbstractCanvas2D, cell: Cell, x: number, y: number,
  w: number, h: number, stroke: string | null, strokeWidth: number): void {
  // Collapsed tables paint all borders above the fills
  if (stroke == null || stroke === NONE || getCollapsedTableForCell(graph, cell) != null) {
    return;
  }

  let top = false;
  let bottom = false;
  let left = false;
  let right = false;

  if (isTableRow(graph, cell)) {
    const table = cell.getParent();
    const rows = childVertices(table);
    const index = rows.indexOf(cell);
    const rowLines = getString(currentStyle(graph, table as Cell), 'rowLines', '1') !== '0';

    top = rowLines && index > 0;
    bottom = rowLines && index < rows.length - 1;
  } else if (isTableCell(graph, cell)) {
    const row = cell.getParent() as Cell;
    const table = row.getParent() as Cell;
    const rows = childVertices(table);
    const cols = childVertices(row);
    const style = currentStyle(graph, table);
    const rowLines = getString(style, 'rowLines', '1') !== '0';
    const columnLines = getString(style, 'columnLines', '1') !== '0';
    const rowIndex = rows.indexOf(row);
    const colIndex = cols.indexOf(cell);

    top = rowLines && rowIndex > 0;
    bottom = rowLines && rowIndex < rows.length - 1;
    left = columnLines && colIndex > 0;
    right = columnLines && colIndex < cols.length - 1;
  } else {
    return;
  }

  if (top || bottom || left || right) {
    c.setStrokeColor(stroke);
    c.setStrokeWidth(strokeWidth);
    c.setDashed(false);
    c.setShadow(false);

    const seg = (x1: number, y1: number, x2: number, y2: number): void => {
      c.begin();
      c.moveTo(x1, y1);
      c.lineTo(x2, y2);
      c.stroke();
    };

    if (top) seg(x, y, x + w, y);
    if (bottom) seg(x, y + h, x + w, y + h);
    if (left) seg(x, y, x, y + h);
    if (right) seg(x + w, y, x + w, y + h);
  }
}

export interface CollapsedBorder {
  color: string;
  width: number;
  dashed: boolean;
  dashPattern: string | null;
  fixDash: boolean;
  opacity: number;
  strokeOpacity: number;
}

/** Fill and stroke of a row or cell shape before they were cleared. */
export interface CollapsedTableStyle {
  fill: string | null;
  gradient: string | null;
  laneFill: string | null;
  stroke: string | null;
}

export interface CollapsedShapeInfo {
  fill: string | null;
  gradient: string | null;
  laneFill: string | null;
  gradientDirection: string;
  opacity: number;
  fillOpacity: number;
  border: CollapsedBorder;
}

type ShapeExt = Shape & { collapsedTableStyle?: CollapsedTableStyle | null; laneFill?: string | null };

/** Graph.createCollapsedTableBorder (Graph.js:19173). */
export function createCollapsedTableBorder(stroke: string | null, shape: Shape): CollapsedBorder {
  const style = (shape.style ?? {}) as StyleRecord;

  return {
    color: stroke != null ? stroke : NONE,
    width: shape.strokeWidth != null ? Number(shape.strokeWidth) : 1,
    dashed: shape.isDashed === true,
    dashPattern: shape.isDashed ? getString(style, 'dashPattern', null) : null,
    fixDash: isFlag(style, 'fixDash', false),
    opacity: shape.opacity != null ? shape.opacity : 100,
    strokeOpacity: shape.strokeOpacity != null ? shape.strokeOpacity : 100,
  };
}

/** Graph.getCollapsedTableBorderKey (Graph.js:19190). */
export function getCollapsedTableBorderKey(border: CollapsedBorder | null | undefined): string | null {
  return border != null && border.color != null && border.color !== NONE && border.width > 0
    ? [border.color, border.width, border.dashed ? 1 : 0, border.dashPattern ?? '', border.fixDash ? 1 : 0,
      border.opacity, border.strokeOpacity].join('|')
    : null;
}

/** Graph.getCollapsedTableShapeInfo (Graph.js:19204). */
export function getCollapsedTableShapeInfo(state: CellState | null): CollapsedShapeInfo | null {
  const shape = (state != null ? state.shape : null) as ShapeExt | null;

  if (shape == null) {
    return null;
  }

  const saved: CollapsedTableStyle = shape.collapsedTableStyle != null ? shape.collapsedTableStyle
    : { fill: shape.fill as string, gradient: shape.gradient as string, laneFill: shape.laneFill ?? null, stroke: shape.stroke as string };

  return {
    fill: saved.fill,
    gradient: saved.gradient,
    laneFill: saved.laneFill,
    gradientDirection: shape.gradientDirection as string,
    opacity: shape.opacity != null ? shape.opacity : 100,
    fillOpacity: shape.fillOpacity != null ? shape.fillOpacity : 100,
    border: createCollapsedTableBorder(saved.stroke, shape),
  };
}

/** Graph.getCollapsedTableFillMode (Graph.js:19229). */
export function getCollapsedTableFillMode(style: StyleRecord, start: Rectangle): 'full' | 'lane' | 'none' {
  const shape = style.shape;
  const empty = start.x === 0 && start.y === 0 && start.width === 0 && start.height === 0;

  if (shape === 'table' || shape === 'tableRow') {
    const fixed = isFlag(style, 'fixedHeader', false);

    // Headerless rounded tables without collapsed borders fill their
    // rounded rectangle with the fill color (see TableShape)
    const rounded = style.tableRender !== 'collapsed' && isFlag(style, 'rounded', false);

    return empty && (!fixed || rounded) ? 'full' : 'lane';
  } else if (shape === 'swimlane') {
    const fixed = isFlag(style, 'fixedHeader', true);

    return empty && !fixed ? 'none' : 'lane';
  }

  return 'full';
}

export interface Bands {
  bands: Rectangle[];
  body: Rectangle;
}

/** Graph.getCollapsedTableBands (Graph.js:19261). */
export function getCollapsedTableBands(x: number, y: number, w: number, h: number, start: Rectangle): Bands {
  const top = Math.min(start.y, h);
  const bottom = Math.min(start.height, h - top);
  const left = Math.min(start.x, w);
  const right = Math.min(start.width, w - left);
  const bh = h - top - bottom;
  const bands: Rectangle[] = [];

  if (top > 0) bands.push(new Rectangle(x, y, w, top));
  if (bottom > 0) bands.push(new Rectangle(x, y + h - bottom, w, bottom));
  if (left > 0 && bh > 0) bands.push(new Rectangle(x, y + top, left, bh));
  if (right > 0 && bh > 0) bands.push(new Rectangle(x + w - right, y + top, right, bh));

  return { bands, body: new Rectangle(x + left, y + top, Math.max(0, w - left - right), Math.max(0, bh)) };
}

interface Sides {
  top: boolean;
  left: boolean;
  bottom: boolean;
  right: boolean;
}

export interface CollapsedChild {
  cell: Cell;
  index?: number;
  row?: CollapsedChild;
  state: CellState | null;
  info: CollapsedShapeInfo | null;
  takeover: boolean;
  sides: Sides;
  line: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  mode: 'full' | 'lane' | 'none';
  split: Bands;
}

export interface Region {
  kind: 'title' | 'strip' | 'cellStrip' | 'cell';
  x: number;
  y: number;
  width: number;
  height: number;
  data: { line: boolean; row?: CollapsedChild; cell?: CollapsedChild };
}

export interface CollapsedRegions {
  start: Rectangle;
  title: Bands;
  rows: CollapsedChild[];
  cells: CollapsedChild[];
  regions: Region[];
}

/** Graph.getCollapsedTableRegions (Graph.js:19302). */
export function getCollapsedTableRegions(graph: Graph, table: Cell, w: number, h: number): CollapsedRegions {
  const tableStyle = currentStyle(graph, table);
  const start = getActualStartSize(graph, table, true);
  const title = getCollapsedTableBands(0, 0, w, h, start);
  const result: CollapsedRegions = { start, title, rows: [], cells: [], regions: [] };
  const rowLookup = new Map<Cell, CollapsedChild>();

  // Visible sides as in PartialRectangleShape (missing flags are true)
  const getSides = (style: StyleRecord): Sides => ({
    top: isFlag(style, 'top', true),
    left: isFlag(style, 'left', true),
    bottom: isFlag(style, 'bottom', true),
    right: isFlag(style, 'right', true),
  });

  const addRegion = (kind: Region['kind'], rect: { x: number; y: number; width: number; height: number },
    data: Region['data']): void => {
    if (rect.width > 0 && rect.height > 0) {
      result.regions.push({ kind, x: rect.x, y: rect.y, width: rect.width, height: rect.height, data });
    }
  };

  const titleLine = getNumber(tableStyle, 'swimlaneLine', 1) !== 0;

  for (const band of title.bands) {
    addRegion('title', band, { line: titleLine });
  }

  const rows = childVertices(table);

  for (let i = 0; i < rows.length; i++) {
    const geo = rows[i].getGeometry();

    if (geo != null && rows[i].isVisible()) {
      const state = graph.view.getState(rows[i]);
      const style = currentStyle(graph, rows[i]);
      const rowStart = getActualStartSize(graph, rows[i], true);
      const row: CollapsedChild = {
        cell: rows[i],
        index: i,
        state,
        info: getCollapsedTableShapeInfo(state),
        takeover: isCollapsedTableChildShape(graph, state),
        sides: getSides(style),
        line: getNumber(style, 'swimlaneLine', 1) !== 0,
        x: geo.x,
        y: geo.y,
        width: geo.width,
        height: geo.height,
        mode: getCollapsedTableFillMode(style, rowStart),
        split: getCollapsedTableBands(geo.x, geo.y, geo.width, geo.height, rowStart),
      };

      for (const band of row.split.bands) {
        addRegion('strip', band, { row, line: row.line });
      }

      rowLookup.set(rows[i], row);
      result.rows.push(row);
    }
  }

  visitTableCells(graph, table, (iter) => {
    const row = rowLookup.get(iter.cell.getParent() as Cell);

    if (row != null && iter.actual.cell === iter.cell && iter.cell.isVisible()) {
      const geo = iter.geo;
      const state = graph.view.getState(iter.cell);
      const style = currentStyle(graph, iter.cell);
      const cellStart = getActualStartSize(graph, iter.cell, true);
      const x = row.x + geo.x;
      const y = row.y + geo.y;
      const cell: CollapsedChild = {
        cell: iter.cell,
        row,
        state,
        info: getCollapsedTableShapeInfo(state),
        takeover: isCollapsedTableChildShape(graph, state),
        sides: getSides(style),
        line: getNumber(style, 'swimlaneLine', 1) !== 0,
        x,
        y,
        width: geo.width,
        height: geo.height,
        mode: getCollapsedTableFillMode(style, cellStart),
        split: getCollapsedTableBands(x, y, geo.width, geo.height, cellStart),
      };
      result.cells.push(cell);

      if (cell.mode === 'lane') {
        for (const band of cell.split.bands) {
          addRegion('cellStrip', band, { row, cell, line: cell.line });
        }

        addRegion('cell', cell.split.body, { row, cell, line: cell.line });
      } else {
        addRegion('cell', cell, { row, cell, line: cell.line });
      }
    }
  });

  return result;
}

export interface BorderLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  border: CollapsedBorder;
  key: string;
}

export interface OutlinePiece {
  a: number;
  b: number;
  border: CollapsedBorder | null;
}

export interface CollapsedBorders {
  lines: BorderLine[];
  outline: { top: OutlinePiece[]; right: OutlinePiece[]; bottom: OutlinePiece[]; left: OutlinePiece[] };
}

interface SideEntry {
  a: number;
  b: number;
  region: Region | null;
  before: boolean;
  side?: 'top' | 'bottom' | 'left' | 'right';
  pos: number;
}

interface Interval {
  key: string;
  border: CollapsedBorder;
  a: number;
  b: number;
  pos: number;
}

/** Graph.getCollapsedTableBorders (Graph.js:19433). */
export function getCollapsedTableBorders(graph: Graph, table: Cell, w: number, h: number,
  tableBorder: CollapsedBorder, data?: CollapsedRegions): CollapsedBorders {
  const d = data != null ? data : getCollapsedTableRegions(graph, table, w, h);
  const style = currentStyle(graph, table);
  const rowLines = getString(style, 'rowLines', '1') !== '0';
  const columnLines = getString(style, 'columnLines', '1') !== '0';
  const tableKey = getCollapsedTableBorderKey(tableBorder);
  const outline: CollapsedBorders['outline'] = { top: [], right: [], bottom: [], left: [] };
  const intervals: Interval[] = [];
  const lines: BorderLine[] = [];
  const bounds = { x: 0, y: 0, width: w, height: h };
  const eps = 0.01;

  const round = (value: number): number => Math.round(value * 100) / 100;

  const addSide = (map: Map<number, SideEntry[]>, pos: number, a: number, b: number, region: Region | null,
    before: boolean, side?: SideEntry['side']): void => {
    pos = round(pos);
    let sides = map.get(pos);

    if (sides == null) {
      sides = [];
      map.set(pos, sides);
    }

    sides.push({ a: round(Math.min(a, b)), b: round(Math.max(a, b)), region, before, side, pos });
  };

  // True if the given side at pos is the given side of the owner
  const isOwnerSide = (owner: { x: number; y: number; width: number; height: number }, side: string | undefined,
    pos: number): boolean => {
    const value = side === 'top' ? owner.y : side === 'bottom' ? owner.y + owner.height
      : side === 'left' ? owner.x : owner.x + owner.width;

    return Math.abs(round(value) - pos) < eps;
  };

  // True if the region side divides a title strip from the body
  const isDivider = (entry: SideEntry): boolean => {
    const region = entry.region as Region;
    const owner = region.kind === 'title' ? bounds : region.kind === 'strip'
      ? (region.data.row as CollapsedChild) : (region.data.cell as CollapsedChild);

    return !isOwnerSide(owner, entry.side, entry.pos);
  };

  // True if the region side is hidden by a 0 flag or swimlaneLine=0
  const isHidden = (entry: SideEntry): boolean => {
    const region = entry.region as Region;
    const cell = region.data.cell;
    const row = region.data.row;

    if (isDivider(entry)) {
      return !region.data.line;
    }

    const side = entry.side as keyof Sides;

    return (cell != null && isOwnerSide(cell, side, entry.pos) && !cell.sides[side]) ||
      (row != null && isOwnerSide(row, side, entry.pos) && !row.sides[side]);
  };

  // Returns the most specific stroke for the given region side
  const getClaim = (entry: SideEntry): { level: number; border: CollapsedBorder } => {
    const region = entry.region as Region;
    const cell = region.data.cell;
    const row = region.data.row;
    const rowKey = row != null && row.info != null ? getCollapsedTableBorderKey(row.info.border) : tableKey;

    if (cell != null && cell.takeover && cell.info != null && getCollapsedTableBorderKey(cell.info.border) !== rowKey) {
      return { level: 2, border: cell.info.border };
    } else if (row != null && row.takeover && row.info != null && rowKey !== tableKey) {
      return { level: 1, border: row.info.border };
    }

    return { level: 0, border: tableBorder };
  };

  const resolve = (claims: SideEntry[], horizontal: boolean, outer: boolean): CollapsedBorder | null => {
    let divider = false;
    let best: { level: number; border: CollapsedBorder; before: boolean } | null = null;

    for (const claimEntry of claims) {
      if (isHidden(claimEntry)) {
        return null;
      }

      divider = divider || isDivider(claimEntry);
      const claim = getClaim(claimEntry);

      if (claim.level > 0 && (best == null || claim.level > best.level ||
        (claim.level === best.level && (claim.border.width > best.border.width ||
        (claim.border.width === best.border.width && claimEntry.before && !best.before))))) {
        best = { level: claim.level, border: claim.border, before: claimEntry.before };
      }
    }

    if (best != null) {
      return getCollapsedTableBorderKey(best.border) != null ? best.border : null;
    } else if (!outer && !divider && (horizontal ? !rowLines : !columnLines)) {
      return null;
    }

    return tableKey != null ? tableBorder : null;
  };

  const process = (map: Map<number, SideEntry[]>, horizontal: boolean): void => {
    for (const [pos, sides] of map) {
      const points: number[] = [];

      sides.sort((s1, s2) => s1.a - s2.a);

      for (const s of sides) {
        points.push(s.a, s.b);
      }

      points.sort((p1, p2) => p1 - p2);

      let outerSide: OutlinePiece[] | null = null;

      if (horizontal) {
        outerSide = Math.abs(pos) < eps ? outline.top : (Math.abs(pos - round(h)) < eps ? outline.bottom : null);
      } else {
        outerSide = Math.abs(pos) < eps ? outline.left : (Math.abs(pos - round(w)) < eps ? outline.right : null);
      }

      let active: SideEntry[] = [];
      let next = 0;
      let current: Interval | null = null;

      for (let i = 0; i < points.length - 1; i++) {
        const p = points[i];
        const q = points[i + 1];

        if (q - p <= eps) {
          continue;
        }

        while (next < sides.length && sides[next].a <= p + eps) {
          active.push(sides[next++]);
        }

        const claims: SideEntry[] = [];
        let outer = false;
        const temp: SideEntry[] = [];

        for (const entry of active) {
          if (entry.b > p + eps) {
            temp.push(entry);

            if (entry.b >= q - eps) {
              if (entry.region == null) {
                outer = true;
              } else {
                claims.push(entry);
              }
            }
          }
        }

        active = temp;

        if (outer && outerSide != null) {
          const border = resolve(claims, horizontal, true);
          const last = outerSide.length > 0 ? outerSide[outerSide.length - 1] : null;

          if (last != null && Math.abs(last.b - p) < eps &&
            getCollapsedTableBorderKey(last.border) === getCollapsedTableBorderKey(border)) {
            last.b = q;
          } else {
            outerSide.push({ a: p, b: q, border });
          }

          current = null;
        } else if (claims.length > 0) {
          const border = resolve(claims, horizontal, false);
          const borderKey = getCollapsedTableBorderKey(border);

          if (borderKey == null || border == null) {
            current = null;
          } else if (current != null && current.key === borderKey && Math.abs(current.b - p) < eps) {
            current.b = q;
          } else {
            current = { key: borderKey, border, a: p, b: q, pos };
            intervals.push(current);
          }
        } else {
          current = null;
        }
      }
    }
  };

  const hor = new Map<number, SideEntry[]>();
  const ver = new Map<number, SideEntry[]>();

  for (const r of d.regions) {
    addSide(hor, r.y, r.x, r.x + r.width, r, false, 'top');
    addSide(hor, r.y + r.height, r.x, r.x + r.width, r, true, 'bottom');
    addSide(ver, r.x, r.y, r.y + r.height, r, false, 'left');
    addSide(ver, r.x + r.width, r.y, r.y + r.height, r, true, 'right');
  }

  addSide(hor, 0, 0, w, null, false);
  addSide(hor, h, 0, w, null, true);
  addSide(ver, 0, 0, h, null, false);
  addSide(ver, w, 0, h, null, true);

  process(hor, true);

  for (const line of intervals.splice(0)) {
    lines.push({ x1: line.a, y1: line.pos, x2: line.b, y2: line.pos, border: line.border, key: line.key });
  }

  process(ver, false);

  for (const line of intervals.splice(0)) {
    lines.push({ x1: line.pos, y1: line.a, x2: line.pos, y2: line.b, border: line.border, key: line.key });
  }

  return { lines, outline };
}
