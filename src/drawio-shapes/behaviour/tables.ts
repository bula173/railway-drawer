/**
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Ported from jgraph/drawio v32.4.1:
 *   src/main/webapp/js/grapheditor/Graph.js:
 *     498-603 mouseDown on table cell borders starts the row/column resize,
 *     1135 graphHandler.getCells / 1166 graphHandler.start (table parts),
 *     11064 getCompositeParent, 14488 selectCellForEvent / 14544 selectTableRange,
 *     18580 getDefaultTableSides, 19922 resizeAllTableRows, 19972 resizeAllTableColumns,
 *     20036 distributeRows, 20098 distributeColumns, 23047 isCellEditable,
 *     23067 isCellMovable, 23379 moveCells (rows between tables), 23531 removeCells,
 *     25517 processChange (repaints tables), 27401 isCellResizable,
 *     29290 deleteCells (shrinks tables), 29349 insertTableColumn, 29524 insertTableRow,
 *     29635 deleteTableColumn, 29807 deleteTableRow,
 *     31609 mxSelectionCellsHandler.getHandledSelectionCells,
 *     31659 isGhostPreview, 31812 isRotationHandleVisible, 31882 isParentHighlightVisible,
 *     31903 isCustomHandleVisible, 31917 getSelectionBorderInset,
 *     31995 createCustomHandles (row and column resize handles of tables),
 *   src/main/webapp/js/grapheditor/Shapes.js:62 TableLineShape,
 *   src/main/webapp/mxgraph/src/handler/mxHandle.js processEvent (maxGraph 0.10.3's
 *     VertexHandle.processEvent does not call setPosition).
 *
 * Installed per graph instance; the table geometry operations are plain functions.
 */

import {
  AbstractCanvas2D,
  Cell,
  CellState,
  EventObject,
  Geometry,
  GeometryChange,
  Graph,
  InternalEvent,
  Point,
  Rectangle,
  SelectionCellsHandler,
  SelectionHandler,
  Shape,
  VertexHandle,
  VertexHandler,
  eventUtils,
  mathUtils,
} from '@maxgraph/core';
import type { InternalMouseEvent } from '@maxgraph/core';
import {
  MIN_TABLE_COLUMN_WIDTH,
  MIN_TABLE_ROW_HEIGHT,
  getActualStartSize,
  isTable,
  isTableCell,
  isTableRow,
  paintTableLine,
  visitTableCells,
} from '../js/shapes-edges/table-graph';
import { setTableColumnWidth, setTableRowHeight } from '../js/shapes-edges/table-layout';
import { getDrawioLayoutManager } from '../js/shapes-edges/table-support';
import { parseStyleString } from '../../services/drawio-xml';
import { childVertices, isPart, markInstalled } from './common';
import { installDrawioLayouts } from './layouts';

export { isTable, isTableCell, isTableRow } from '../js/shapes-edges/table-graph';
export { setTableColumnWidth, setTableRowHeight } from '../js/shapes-edges/table-layout';

type StyleRecord = Record<string, unknown>;

function executeTableLayout(graph: Graph, table: Cell): void {
  getDrawioLayoutManager(graph)?.executeLayout(table, false);
}

/** Clone of a style without rowspan/colspan (mxUtils.setStyle(style, key, null)). */
function withoutSpans(style: unknown): StyleRecord {
  const result: StyleRecord = { ...((style ?? {}) as StyleRecord) };
  delete result.rowspan;
  delete result.colspan;
  return result;
}

/** Graph.getCompositeParent (Graph.js:11064): the first ancestor that is not a part. */
export function getCompositeParent(graph: Graph, cell: Cell): Cell {
  let result = cell;

  while (isPart(graph, result)) {
    const temp = result.getParent();

    if (temp == null || !temp.isVertex()) {
      break;
    }

    result = temp;
  }

  return result;
}

/** Graph.getDefaultTableSides (Graph.js:18580). */
function getDefaultTableSides(graph: Graph, table: Cell): string {
  return (graph.getCellStyle(table) as StyleRecord).tableRender === 'collapsed' ? '' : 'top=0;left=0;bottom=0;right=0;';
}

/** Graph.insertTableColumn (Graph.js:29349): inserts a column before or after the column of the given cell. */
export function insertTableColumn(graph: Graph, cell: Cell, before: boolean): void {
  const model = graph.getDataModel();
  model.beginUpdate();
  try {
    let table = cell;
    let index = 0;

    if (isTableCell(graph, cell)) {
      const row = cell.getParent() as Cell;
      table = row.getParent() as Cell;
      index = childVertices(row).indexOf(cell);
    } else {
      if (isTableRow(graph, cell)) {
        table = cell.getParent() as Cell;
      } else {
        cell = childVertices(table)[0];
      }

      if (!before && cell != null) {
        index = childVertices(cell).length - 1;
      }
    }

    const rows = childVertices(table);
    let dw = MIN_TABLE_COLUMN_WIDTH;

    for (const row of rows) {
      const child = childVertices(row)[index];
      let clone: Cell;

      // Handles possible missing child in row
      if (child != null) {
        clone = child.clone();
      } else {
        clone = new Cell('', new Geometry(0, 0, MIN_TABLE_COLUMN_WIDTH, MIN_TABLE_ROW_HEIGHT), {});
        clone.setVertex(true);
      }

      // Removes value, col/rowspan and alternate bounds
      clone.setValue('');
      clone.setStyle(withoutSpans(clone.getStyle()));
      const geo = clone.getGeometry();

      if (geo != null) {
        if (geo.alternateBounds != null) {
          geo.width = geo.alternateBounds.width;
          geo.height = geo.alternateBounds.height;
          geo.alternateBounds = null;
        }

        dw = geo.width;
        const rowGeo = row.getGeometry();

        if (rowGeo != null) {
          geo.height = rowGeo.height;
        }
      }

      model.add(row, clone, index + (before ? 0 : 1));
    }

    let tableGeo = table.getGeometry();

    if (tableGeo != null) {
      tableGeo = tableGeo.clone();
      tableGeo.width += dw;
      model.setGeometry(table, tableGeo);
    }
  } finally {
    model.endUpdate();
  }
}

/** Graph.insertTableRow (Graph.js:29524): inserts a row before or after the row of the given cell. */
export function insertTableRow(graph: Graph, cell: Cell, before: boolean): void {
  const model = graph.getDataModel();
  model.beginUpdate();
  try {
    let table: Cell = cell;
    let row: Cell | null = cell;

    if (isTableCell(graph, cell)) {
      row = cell.getParent() as Cell;
      table = row.getParent() as Cell;
    } else if (isTableRow(graph, cell)) {
      table = cell.getParent() as Cell;
    } else {
      const rows = childVertices(table);
      row = rows[before ? 0 : rows.length - 1] ?? null;
    }

    if (row != null) {
      const cells = childVertices(row);
      const index = table.getIndex(row);
      const newRow = row.clone();
      newRow.setValue('');
      const rowGeo = newRow.getGeometry();

      if (rowGeo != null) {
        for (const c of cells) {
          const clone = c.clone();

          // Removes value, col/rowspan and alternate bounds
          clone.setValue('');
          clone.setStyle(withoutSpans(clone.getStyle()));
          const geo = clone.getGeometry();

          if (geo != null) {
            if (geo.alternateBounds != null) {
              geo.width = geo.alternateBounds.width;
              geo.height = geo.alternateBounds.height;
              geo.alternateBounds = null;
            }

            geo.height = rowGeo.height;
          }

          newRow.insert(clone);
        }

        model.add(table, newRow, index + (before ? 0 : 1));
        let tableGeo = table.getGeometry();

        if (tableGeo != null) {
          tableGeo = tableGeo.clone();
          tableGeo.height += rowGeo.height;
          model.setGeometry(table, tableGeo);
        }
      }
    } else {
      // Empty table: insert initial row with a single column
      let tableGeo = table.getGeometry();

      if (tableGeo != null) {
        const rowHeight = 40;
        const rowWidth = tableGeo.width;
        const sides = getDefaultTableSides(graph, table);
        const rowStyle = 'shape=tableRow;horizontal=0;startSize=0;swimlaneHead=0;swimlaneBody=0;strokeColor=inherit;' +
          sides + 'collapsible=0;dropTarget=0;fillColor=none;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;fixedHeader=1;';
        const cellStyle = 'shape=partialRectangle;html=1;whiteSpace=wrap;connectable=0;strokeColor=inherit;' +
          'overflow=hidden;fillColor=none;' + sides + 'pointerEvents=1;';
        const newRow = new Cell('', new Geometry(0, 0, rowWidth, rowHeight), parseStyleString(rowStyle));
        newRow.setVertex(true);
        const newCell = new Cell('', new Geometry(0, 0, rowWidth, rowHeight), parseStyleString(cellStyle));
        newCell.setVertex(true);
        newRow.insert(newCell);
        model.add(table, newRow);

        tableGeo = tableGeo.clone();
        tableGeo.height += rowHeight;
        model.setGeometry(table, tableGeo);
      }
    }
  } finally {
    model.endUpdate();
  }
}

/** Graph.deleteTableColumn (Graph.js:29635): deletes the column of the given cell (or the last one). */
export function deleteTableColumn(graph: Graph, cell: Cell): void {
  const model = graph.getDataModel();
  model.beginUpdate();
  try {
    let table: Cell = cell;
    let row: Cell = cell;

    if (isTableCell(graph, cell)) {
      row = cell.getParent() as Cell;
    }

    if (isTableRow(graph, row)) {
      table = row.getParent() as Cell;
    }

    const rows = childVertices(table);

    if (rows.length === 0) {
      model.remove(table);
    } else {
      if (!isTableRow(graph, row)) {
        row = rows[0];
      }

      const cells = childVertices(row);

      if (cells.length <= 1) {
        model.remove(table);
      } else {
        let index = cells.length - 1;

        if (isTableCell(graph, cell)) {
          index = cells.indexOf(cell);
        }

        let width = 0;

        for (const r of rows) {
          const child = childVertices(r)[index];

          if (child != null) {
            model.remove(child);
            const geo = child.getGeometry();

            if (geo != null) {
              width = Math.max(width, geo.width);
            }
          }
        }

        let tableGeo = table.getGeometry();

        if (tableGeo != null) {
          tableGeo = tableGeo.clone();
          tableGeo.width -= width;
          model.setGeometry(table, tableGeo);
        }
      }
    }
  } finally {
    model.endUpdate();
  }
}

/** Graph.deleteTableRow (Graph.js:29807): deletes the row of the given cell (or the last one). */
export function deleteTableRow(graph: Graph, cell: Cell): void {
  const model = graph.getDataModel();
  model.beginUpdate();
  try {
    let table: Cell = cell;
    let row: Cell = cell;

    if (isTableCell(graph, cell)) {
      row = cell.getParent() as Cell;
      cell = row;
    }

    if (isTableRow(graph, cell)) {
      table = row.getParent() as Cell;
    }

    const rows = childVertices(table);

    if (rows.length <= 1) {
      model.remove(table);
    } else {
      if (!isTableRow(graph, row)) {
        row = rows[rows.length - 1];
      }

      model.remove(row);
      const height = row.getGeometry()?.height ?? 0;
      let tableGeo = table.getGeometry();

      if (tableGeo != null) {
        tableGeo = tableGeo.clone();
        tableGeo.height -= height;
        model.setGeometry(table, tableGeo);
      }
    }
  } finally {
    model.endUpdate();
  }
}

/** Graph.resizeAllTableRows (Graph.js:19922): resizes all rows by dy, extending the table. */
export function resizeAllTableRows(graph: Graph, table: Cell, dy: number): void {
  const model = graph.getDataModel();
  const rows = childVertices(table);

  if (rows.length === 0) {
    return;
  }

  model.beginUpdate();
  try {
    rows.forEach((row, i) => {
      let rgeo = row.getGeometry();

      if (rgeo != null) {
        rgeo = rgeo.clone();
        rgeo.y += dy * i;
        rgeo.height = Math.max(MIN_TABLE_ROW_HEIGHT, rgeo.height + dy);
        model.setGeometry(row, rgeo);
      }
    });

    let tgeo = table.getGeometry();

    if (tgeo != null) {
      tgeo = tgeo.clone();
      tgeo.height += dy * rows.length;
      model.setGeometry(table, tgeo);
    }

    executeTableLayout(graph, table);
  } finally {
    model.endUpdate();
  }
}

/** Graph.resizeAllTableColumns (Graph.js:19972): resizes all columns by dx, extending the table. */
export function resizeAllTableColumns(graph: Graph, table: Cell, dx: number): void {
  const model = graph.getDataModel();
  const rows = childVertices(table);

  if (rows.length === 0) {
    return;
  }

  model.beginUpdate();
  try {
    for (const row of rows) {
      childVertices(row).forEach((cell, j) => {
        let geo = cell.getGeometry();

        if (geo != null) {
          geo = geo.clone();
          geo.x += dx * j;
          geo.width = Math.max(MIN_TABLE_COLUMN_WIDTH, geo.width + dx);

          if (geo.alternateBounds != null) {
            geo.alternateBounds.width = Math.max(MIN_TABLE_COLUMN_WIDTH, geo.alternateBounds.width + dx);
          }

          model.setGeometry(cell, geo);
        }
      });
    }

    let tgeo = table.getGeometry();

    if (tgeo != null) {
      tgeo = tgeo.clone();
      tgeo.width += dx * childVertices(rows[0]).length;
      model.setGeometry(table, tgeo);
    }

    executeTableLayout(graph, table);
  } finally {
    model.endUpdate();
  }
}

/** Graph.distributeRows (Graph.js:20036): equal row heights without changing the table size. */
export function distributeRows(graph: Graph, table: Cell): void {
  const model = graph.getDataModel();
  const rows = childVertices(table);

  if (rows.length < 2) {
    return;
  }

  model.beginUpdate();
  try {
    const total = rows.reduce((sum, row) => sum + (row.getGeometry()?.height ?? 0), 0);
    const newHeight = total / rows.length;
    let y = 0;

    rows.forEach((row, i) => {
      let rgeo = row.getGeometry();

      if (rgeo != null) {
        rgeo = rgeo.clone();

        if (i === 0) {
          y = rgeo.y;
        }

        rgeo.y = y;
        rgeo.height = newHeight;
        model.setGeometry(row, rgeo);
        y += newHeight;
      }
    });

    executeTableLayout(graph, table);
  } finally {
    model.endUpdate();
  }
}

/** Graph.distributeColumns (Graph.js:20098): equal column widths without changing the table size. */
export function distributeColumns(graph: Graph, table: Cell): void {
  const model = graph.getDataModel();
  const rows = childVertices(table);

  if (rows.length === 0) {
    return;
  }

  const first = childVertices(rows[0]);

  if (first.length < 2) {
    return;
  }

  model.beginUpdate();
  try {
    const total = first.reduce((sum, cell) => {
      const geo = cell.getGeometry();
      return sum + (geo != null ? (geo.alternateBounds ?? geo).width : 0);
    }, 0);
    const newWidth = total / first.length;

    for (const row of rows) {
      let x = 0;

      childVertices(row).forEach((cell, j) => {
        let geo = cell.getGeometry();

        if (geo != null) {
          geo = geo.clone();

          if (j === 0) {
            x = geo.x;
          }

          geo.x = x;
          geo.width = newWidth;

          if (geo.alternateBounds != null) {
            geo.alternateBounds.width = newWidth;
          }

          model.setGeometry(cell, geo);
          x += newWidth;
        }
      });
    }

    executeTableLayout(graph, table);
  } finally {
    model.endUpdate();
  }
}

/** Graph.selectTableRange (Graph.js:14544): selects the cells between two table cells. */
export function selectTableRange(graph: Graph, startCell: Cell | null, endCell: Cell | null): boolean {
  if (startCell == null || endCell == null || !isTableCell(graph, startCell) || !isTableCell(graph, endCell)) {
    return false;
  }

  const startRow = startCell.getParent() as Cell;
  const table = startRow.getParent() as Cell;
  const endRow = endCell.getParent() as Cell;

  if (table !== endRow.getParent()) {
    return false;
  }

  const startCellIndex = startRow.getIndex(startCell);
  const startRowIndex = table.getIndex(startRow);
  const endCellIndex = endRow.getIndex(endCell);
  const endRowIndex = table.getIndex(endRow);
  const cells: Cell[] = [];

  for (let row = Math.min(startRowIndex, endRowIndex); row <= Math.max(startRowIndex, endRowIndex); row++) {
    const currentRow = table.getChildAt(row);

    for (let col = Math.min(startCellIndex, endCellIndex); col <= Math.max(startCellIndex, endCellIndex); col++) {
      const c = currentRow?.getChildAt(col);

      if (c != null) {
        cells.push(c);
      }
    }
  }

  if (cells.length > 0 && (cells.length > 1 || graph.getSelectionCount() > 1 || !graph.isCellSelected(cells[0]))) {
    graph.setSelectionCells(cells);
    return true;
  }

  return false;
}

/** TableLineShape (Shapes.js:62): a polyline (with gaps) in view coordinates. */
export class TableLineShape extends Shape {
  line: (Point | null)[] | null;

  constructor(line: (Point | null)[] | null, stroke: string, strokeWidth = 1) {
    super();
    this.line = line;
    this.stroke = stroke;
    this.strokeWidth = strokeWidth;
    this.updateBoundsFromLine();
  }

  updateBoundsFromLine(): void {
    let box: Rectangle | null = null;

    for (const curr of this.line ?? []) {
      if (curr != null) {
        const temp = new Rectangle(curr.x, curr.y, this.strokeWidth, this.strokeWidth);

        if (box == null) {
          box = temp;
        } else {
          box.add(temp);
        }
      }
    }

    this.bounds = box ?? new Rectangle();
  }

  override paintVertexShape(c: AbstractCanvas2D): void {
    paintTableLine(c, this.line, 0, 0);
  }
}

/** Lines between the rows (horizontal) or columns of a table, indexed by row/column (Graph.getTableLines). */
function getIndexedTableLines(graph: Graph, table: Cell, horizontal: boolean): (Point | null)[][] {
  const lines: (Point | null)[][] = [];

  visitTableCells(graph, table, (iter, colCount, rowCount, x0, y0) => {
    if (horizontal && iter.row < rowCount - 1) {
      if (lines[iter.row] == null) {
        lines[iter.row] = [new Point(x0, iter.point.y)];
      }

      if (iter.rowspan > 1) {
        lines[iter.row].push(null);
      }

      lines[iter.row].push(iter.point);
    } else if (!horizontal && iter.col < colCount - 1) {
      if (lines[iter.col] == null) {
        lines[iter.col] = [new Point(iter.point.x, y0)];
      }

      if (iter.colspan > 1) {
        lines[iter.col].push(null);
      }

      lines[iter.col].push(iter.point);
    }
  });

  return lines;
}

type TableHandleExt = VertexHandle & { tableHandle: true };

/** A row-resize or col-resize handle of a table (Graph.js:32046 / 32152). */
class TableResizeHandle extends VertexHandle {
  readonly tableHandle = true as const;
  delta = 0;

  constructor(
    state: CellState,
    private readonly handler: VertexHandler,
    private readonly index: number,
    private readonly rowHandle: boolean,
    private readonly count: number,
    private readonly cellGeo: Geometry,
    private readonly nextGeo: Geometry | null,
  ) {
    super(state, rowHandle ? 'row-resize' : 'col-resize', null, new TableLineShape(null, 'none', 1));
    const shape = this.shape as TableLineShape;
    shape.isDashed = handler.selectionBorder.isDashed;
    shape.svgStrokeTolerance++;
    const node = shape.node;
    const parent = node?.parentNode;

    if (node != null && parent != null) {
      parent.insertBefore(node, parent.firstChild);
    }
  }

  private get graphRef(): Graph {
    return this.handler.graph;
  }

  private get tableState(): CellState {
    return this.handler.state;
  }

  private line(): (Point | null)[] {
    const graph = this.graphRef;
    const table = this.tableState.cell;
    const lines = getIndexedTableLines(graph, table, this.rowHandle);
    const line = lines[this.index];

    if (line != null) {
      return line;
    }

    // mxLine fallback (Graph.js:32085): below the last row / right of the last column
    const tgeo = table.getGeometry() as Geometry;
    const start = getActualStartSize(graph, table, true);
    const last = this.index === this.count - 1;

    if (this.rowHandle) {
      const y = (this.state.cell.getGeometry()?.y ?? 0) + this.cellGeo.height;
      return [new Point(last ? 0 : start.x, y), new Point(last ? tgeo.width : tgeo.width - start.width, y)];
    }

    const rowGeo = this.state.cell.getParent()?.getGeometry();
    const x = (rowGeo?.x ?? 0) + this.cellGeo.x + (this.cellGeo.alternateBounds ?? this.cellGeo).width;
    return [new Point(x, last ? 0 : start.y), new Point(x, last ? tgeo.height : tgeo.height - start.height)];
  }

  override redraw(): void {
    const shape = this.shape as TableLineShape | null;

    if (shape == null) {
      return;
    }

    const graph = this.graphRef;
    const s = graph.view.scale;
    const t = graph.view.translate;
    const origin = this.tableState.origin;
    const x0 = origin.x + t.x;
    const y0 = origin.y + t.y;
    const dx = this.rowHandle ? 0 : this.delta;
    const dy = this.rowHandle ? this.delta : 0;

    shape.stroke = this.delta === 0 ? 'none' : (this.handler.selectionBorder.stroke ?? 'none');
    shape.line = this.line().map((pt) => (pt == null ? null : new Point((x0 + pt.x + dx) * s, (y0 + pt.y + dy) * s)));
    shape.updateBoundsFromLine();
    shape.redraw();
  }

  /** mxHandle.processEvent: maxGraph 0.10.3 never calls setPosition. */
  override processEvent(me: InternalMouseEvent): void {
    const graph = this.graphRef;
    const { scale } = graph.view;
    const tr = graph.view.translate;
    let pt = new Point(me.getGraphX() / scale - tr.x, me.getGraphY() / scale - tr.y);

    if (this.shape != null && this.shape.bounds != null) {
      pt.x -= this.shape.bounds.width / scale / 4;
      pt.y -= this.shape.bounds.height / scale / 4;
    }

    const alpha1 = -mathUtils.toRadians(this.getRotation());
    const alpha2 = -mathUtils.toRadians(this.getTotalRotation()) - alpha1;
    pt = this.flipPoint(this.rotatePoint(this.snapPoint(this.rotatePoint(pt, alpha1),
      this.ignoreGrid || !graph.isGridEnabledEvent(me.getEvent())), alpha2));
    this.setPosition(this.state.getPaintBounds(), pt, me);
    this.redraw();
  }

  override setPosition(bounds: Rectangle | null, pt: Point, me: InternalMouseEvent): void {
    const b = bounds ?? new Rectangle();
    const shift = eventUtils.isShiftDown(me.getEvent());

    if (this.rowHandle) {
      this.delta = Math.max(MIN_TABLE_ROW_HEIGHT - b.height, pt.y - b.y - b.height);

      if (this.nextGeo != null && shift) {
        this.delta = Math.min(this.delta, this.nextGeo.height - MIN_TABLE_ROW_HEIGHT);
      }
    } else {
      const g = this.cellGeo.alternateBounds ?? this.cellGeo;
      this.delta = Math.max(MIN_TABLE_COLUMN_WIDTH - g.width, pt.x - b.x - g.width);

      if (this.nextGeo != null && shift) {
        this.delta = Math.min(this.delta, (this.nextGeo.alternateBounds ?? this.nextGeo).width - MIN_TABLE_COLUMN_WIDTH);
      }
    }
  }

  override execute(me: InternalMouseEvent): void {
    const graph = this.graphRef;
    const table = this.tableState.cell;

    if (this.delta !== 0) {
      const evt = me.getEvent();
      const shiftPressed = eventUtils.isShiftDown(evt);
      const ctrlPressed = eventUtils.isControlDown(evt) || eventUtils.isMetaDown(evt);

      if (ctrlPressed && shiftPressed) {
        if (this.rowHandle) {
          distributeRows(graph, table);
        } else {
          distributeColumns(graph, table);
        }
      } else if (ctrlPressed) {
        if (this.rowHandle) {
          resizeAllTableRows(graph, table, this.delta);
        } else {
          resizeAllTableColumns(graph, table, this.delta);
        }
      } else if (this.rowHandle) {
        setTableRowHeight(graph, this.state.cell, this.delta, !shiftPressed);
      } else {
        setTableColumnWidth(graph, this.state.cell, this.delta, !shiftPressed);
      }
    } else if (!(this.handler as VertexHandler & { blockDelayedSelection?: boolean }).blockDelayedSelection) {
      // A click on a line selects the cell under the mouse
      const temp = graph.getCellAt(me.getGraphX(), me.getGraphY()) ?? table;
      const selectionHandler = graph.getPlugin('SelectionHandler') as SelectionHandler | undefined;

      if (selectionHandler != null) {
        selectionHandler.selectCellForEvent(temp, me);
      } else {
        graph.selectCellForEvent(temp, me.getEvent());
      }
    }

    this.delta = 0;
  }

  /** Stops repaint of the cell via the vertex handler. */
  override positionChanged(): void {
    // do nothing
  }

  override reset(): void {
    this.delta = 0;
    this.setVisible(true);
  }
}

/** Creates the row and column resize handles of a table vertex handler (Graph.js:31995). */
function createTableHandles(graph: Graph, handler: VertexHandler): VertexHandle[] {
  const handles: VertexHandle[] = [];
  const tableState = handler.state;

  if (!isTable(graph, tableState.cell) || !graph.isCellMovable(tableState.cell)) {
    return handles;
  }

  const rows = childVertices(tableState.cell);
  const rowStates = rows.map((r) => graph.view.getState(r)).filter((s): s is CellState => s != null);

  if (rowStates.length === 0) {
    return handles;
  }

  // Adds row height handles
  rowStates.forEach((rowState, index) => {
    const geo = rowState.cell.getGeometry();

    if (geo != null && graph.isCellMovable(rowState.cell)) {
      const next = index < rowStates.length - 1 ? rowStates[index + 1].cell.getGeometry() : null;
      handles.push(new TableResizeHandle(rowState, handler, index, true, rowStates.length, geo, next));
    }
  });

  // Adds column width handles
  const cols = childVertices(rowStates[0].cell);
  const s = graph.view.scale;

  cols.forEach((col, index) => {
    const geo = col.getGeometry();

    // Skips columns without a geometry, eg. from malformed XML
    if (geo == null) {
      return;
    }

    let colState = graph.view.getState(col);

    if (colState == null) {
      const g = geo.alternateBounds ?? geo;
      colState = new CellState(graph.view, col, graph.getCellStyle(col));
      colState.x = tableState.x + geo.x * s;
      colState.y = tableState.y + geo.y * s;
      colState.width = g.width * s;
      colState.height = g.height * s;
      colState.updateCachedBounds();
    }

    const next = index < cols.length - 1 ? cols[index + 1].getGeometry() : null;
    handles.push(new TableResizeHandle(colState, handler, index, false, cols.length, geo, next));
  });

  return handles;
}

function tableSignature(graph: Graph, table: Cell): string {
  const rows = childVertices(table);
  return `${rows.length}:${rows.map((r) => childVertices(r).length).join(',')}:${graph.view.scale}`;
}

type TableVertexHandler = VertexHandler & {
  tableHandles?: VertexHandle[];
  tableSignature?: string;
  blockDelayedSelection?: boolean;
};

function isTableHandle(handle: unknown): boolean {
  return (handle as Partial<TableHandleExt> | null)?.tableHandle === true;
}

/**
 * Rebuilds the table handles of the handler if the rows or columns changed or if
 * they were dropped from the custom handles (eg. by a handler refresh that
 * recreates the custom handles).
 */
function syncTableHandles(graph: Graph, handler: TableVertexHandler): void {
  const signature = tableSignature(graph, handler.state.cell);
  const current = handler.tableHandles;

  if (current != null && handler.tableSignature === signature &&
    current.every((h) => h.shape != null && (handler.customHandles as unknown[]).indexOf(h) >= 0)) {
    return;
  }

  for (const h of current ?? []) {
    h.destroy();
  }

  handler.customHandles = handler.customHandles.filter((h) => !isTableHandle(h));
  handler.tableHandles = createTableHandles(graph, handler);
  handler.tableSignature = signature;
  handler.customHandles = handler.customHandles.concat(handler.tableHandles as unknown as typeof handler.customHandles);
}

/** Configures a new vertex handler for tables, rows and cells. */
function configureHandler(graph: Graph, handler: TableVertexHandler): void {
  const cell = handler.state.cell;
  const table = isTable(graph, cell);
  const part = isTableCell(graph, cell) || isTableRow(graph, cell);

  if (!table && !part && !graph.isSwimlane(cell)) {
    return;
  }

  // Graph.js:31659 Forces preview for title size in tables, rows, cells and swimlanes
  const origIsGhostPreview = handler.isGhostPreview.bind(handler);
  handler.isGhostPreview = () => origIsGhostPreview() && !table && !part && !graph.isSwimlane(cell);

  if (!table && !part) {
    return;
  }

  // Graph.js:31812 Hides rotation handle for tables, rows and cells
  if (handler.rotationShape != null) {
    const shape = handler.rotationShape;
    handler.sizers = handler.sizers.filter((s) => s !== shape);
    shape.destroy();
    handler.rotationShape = null;
  }

  // Graph.js:31882 no parent highlight for rows and cells
  if (part) {
    handler.isParentHighlightVisible = () => false;
    handler.updateParentHighlight();

    // Graph.js:31917 selection border inset for rows (1) and cells (2)
    const inset = isTableRow(graph, cell) ? 1 : 2;
    const origBorderBounds = handler.getSelectionBorderBounds.bind(handler);
    handler.getSelectionBorderBounds = () => {
      const b = Rectangle.fromRectangle(origBorderBounds());
      b.grow(-inset);
      return b;
    };
    handler.redraw();
  }

  if (table) {
    // Graph.js:31903 table handles are always visible, other custom handles only
    // if the table itself is selected
    const origIsCustomHandleVisible = handler.isCustomHandleVisible.bind(handler);
    handler.isCustomHandleVisible = (handle: Parameters<VertexHandler['isCustomHandleVisible']>[0]) =>
      isTableHandle(handle) ||
      (origIsCustomHandleVisible(handle) && graph.isCellSelected(cell));

    // Handlers that recreate their custom handles (mxVertexHandler.refresh) get the
    // table handles from createCustomHandles
    const origCreateCustomHandles = handler.createCustomHandles.bind(handler);
    handler.createCustomHandles = (() => {
      const base = ((origCreateCustomHandles() ?? []) as unknown[]).filter((h) => !isTableHandle(h));
      handler.tableHandles = createTableHandles(graph, handler);
      handler.tableSignature = tableSignature(graph, cell);
      return base.concat(handler.tableHandles);
    }) as unknown as VertexHandler['createCustomHandles'];

    const origRedrawHandles = handler.redrawHandles.bind(handler);
    handler.redrawHandles = () => {
      if (handler.index == null) {
        syncTableHandles(graph, handler);
      }

      origRedrawHandles();
    };

    syncTableHandles(graph, handler);
    handler.redraw();
  }
}

/**
 * True if the mouse event is on an inner border of the given table cell, as in
 * draw.io's mouseDown handling (Graph.js:517-547).
 */
function isOnInnerCellBorder(graph: Graph, state: CellState, me: InternalMouseEvent): boolean {
  const s = graph.view.scale;
  const tol = (state.shape?.svgStrokeTolerance ?? 8) + 2;
  const tolerance = eventUtils.isTouchEvent(me.getEvent()) ? tol - 3 : tol / 2;
  const t1 = tolerance + 2;
  const x = me.getGraphX();
  const y = me.getGraphY();
  const contains = (px: number, py: number): boolean =>
    px >= state.x && px <= state.x + state.width && py >= state.y && py <= state.y + state.height;

  if (contains(x - t1, y - t1) && contains(x - t1, y + t1) && contains(x + t1, y + t1) && contains(x + t1, y - t1)) {
    return false;
  }

  const box = new Rectangle(x - 1 - tolerance, y - 1 - tolerance, 2 * tolerance, 2 * tolerance);
  const row = state.cell.getParent() as Cell;
  const table = row.getParent() as Cell;
  const b = tolerance * s;
  const b2 = 2 * b;

  // Ignores events on top line of top row and left line of left column
  return (table.getChildAt(0) !== row && mathUtils.intersects(box, new Rectangle(state.x, state.y - b, state.width, b2))) ||
    (row.getChildAt(0) !== state.cell && mathUtils.intersects(box, new Rectangle(state.x - b, state.y, b2, state.height))) ||
    mathUtils.intersects(box, new Rectangle(state.x, state.y + state.height - b, state.width, b2)) ||
    mathUtils.intersects(box, new Rectangle(state.x + state.width - b, state.y, b2, state.height));
}

/**
 * Installs draw.io's table editing on the given graph: table parts move and edit
 * with their table, selecting a cell or row shows the table handler with row and
 * column resize handles, dragging an inner cell border resizes the row/column
 * (Shift: keep the table size, Ctrl: all rows/columns, Ctrl+Shift: distribute),
 * Shift+click selects a cell range, deleting rows shrinks the table, deleting
 * cells clears their labels and rows can be dragged between tables. Idempotent.
 */
export function installTables(graph: Graph): void {
  installDrawioLayouts(graph);

  if (!markInstalled(graph, 'tables')) {
    return;
  }

  const model = graph.getDataModel();

  // Graph.js:23047 / 23067 table parts are editable/movable if the table is
  const origIsCellEditable = graph.isCellEditable.bind(graph);
  graph.isCellEditable = function (cell: Cell): boolean {
    if (cell == null || !origIsCellEditable(cell)) {
      return false;
    }

    return isTableCell(graph, cell) || isTableRow(graph, cell) ? graph.isCellEditable(cell.getParent() as Cell) : true;
  };

  const origIsCellMovable = graph.isCellMovable.bind(graph);
  graph.isCellMovable = function (cell: Cell): boolean {
    if (cell == null || !origIsCellMovable(cell)) {
      return false;
    }

    return isTableCell(graph, cell) || isTableRow(graph, cell) ? graph.isCellMovable(cell.getParent() as Cell) : true;
  };

  // Graph.js:27401 rows and cells are resized with the table handles
  const origIsCellResizable = graph.isCellResizable.bind(graph);
  graph.isCellResizable = function (cell: Cell): boolean {
    return !isTableCell(graph, cell) && !isTableRow(graph, cell) && origIsCellResizable(cell);
  };

  // Graph.js:23531 removeCells clears table cell labels, removes tables without rows
  // and (Graph.js:29299 deleteCells) shrinks tables when rows are removed
  const origRemoveCells = graph.removeCells.bind(graph);
  graph.removeCells = function (cells: Cell[] | null = null, includeEdges: boolean | null = true): Cell[] {
    const input = cells ?? graph.getDeletableCells(graph.getSelectionCells());
    let result: Cell[] = [];

    model.beginUpdate();
    try {
      for (const cell of input) {
        if (isTableCell(graph, cell)) {
          const row = cell.getParent() as Cell;
          const table = row.getParent() as Cell;

          // Removes table if one cell in one row left
          if (row.getChildCount() === 1 && table.getChildCount() === 1) {
            if (input.indexOf(table) < 0 && result.indexOf(table) < 0) {
              result.push(table);
            }
          } else {
            graph.labelChanged(cell, '', null as unknown as EventObject);
          }
        } else {
          // Deletes table if all rows are removed
          if (isTableRow(graph, cell)) {
            const table = cell.getParent() as Cell;

            if (input.indexOf(table) < 0 && result.indexOf(table) < 0) {
              const rows = childVertices(table);
              const deleteCount = rows.filter((r) => input.indexOf(r) >= 0).length;

              if (deleteCount === rows.length) {
                result.push(table);
              } else {
                // Shrinks the table (Graph.deleteCells)
                const rgeo = cell.getGeometry();
                let tgeo = table.getGeometry();

                if (rgeo != null && tgeo != null) {
                  tgeo = tgeo.clone();
                  tgeo.height -= rgeo.height;
                  model.setGeometry(table, tgeo);
                }
              }
            }
          }

          result.push(cell);
        }
      }

      result = origRemoveCells(result, includeEdges);
    } finally {
      model.endUpdate();
    }

    return result;
  };

  // Graph.js:23379 moving rows between tables keeps heights and column counts consistent
  const origMoveCells = graph.moveCells.bind(graph);
  graph.moveCells = function (cells: Cell[], dx = 0, dy = 0, clone = false, target: Cell | null = null,
    evt: MouseEvent | null = null, mapping: Record<string, unknown> = {}): Cell[] {
    // Replaces source tables with rows
    if (isTable(graph, target)) {
      let newCells: Cell[] = [];

      for (const c of cells) {
        if (isTable(graph, c)) {
          newCells = newCells.concat(childVertices(c).reverse());
        } else {
          newCells.push(c);
        }
      }

      cells = newCells;
    }

    let result: Cell[] = [];
    model.beginUpdate();
    try {
      const sourceTables: Cell[] = [];

      for (let i = 0; i < cells.length; i++) {
        if (target != null && isTableRow(graph, cells[i])) {
          const parent = cells[i].getParent();
          const row = cells[i].getGeometry();

          if (isTable(graph, parent)) {
            sourceTables.push(parent as Cell);
          }

          if (parent != null && row != null && isTable(graph, parent) && isTable(graph, target) && (clone || parent !== target)) {
            if (!clone) {
              let table = parent.getGeometry();

              if (table != null) {
                table = table.clone();
                table.height -= row.height;
                model.setGeometry(parent, table);
              }
            }

            let table = target.getGeometry();

            if (table != null) {
              table = table.clone();
              table.height += row.height;
              model.setGeometry(target, table);
            }

            // Matches column count
            const rows = childVertices(target);

            if (rows.length > 0) {
              cells[i] = clone ? model.cloneCell(cells[i], true) as Cell : cells[i];
              let sourceCols = childVertices(cells[i]);
              const cols = childVertices(rows[0]);
              const count = cols.length - sourceCols.length;

              if (count > 0) {
                for (let j = 0; j < count; j++) {
                  const col = sourceCols[sourceCols.length - 1].clone();
                  col.setValue('');
                  model.add(cells[i], col);
                }
              } else if (count < 0) {
                for (let j = 0; j > count; j--) {
                  model.remove(sourceCols[sourceCols.length + j - 1]);
                }
              }

              // Updates column widths
              sourceCols = childVertices(cells[i]);

              for (let j = 0; j < cols.length; j++) {
                const geo = cols[j].getGeometry();
                let geo2 = sourceCols[j]?.getGeometry() ?? null;

                if (geo != null && geo2 != null) {
                  geo2 = geo2.clone();
                  geo2.width = geo.width;
                  model.setGeometry(sourceCols[j], geo2);
                }
              }
            }
          }
        }
      }

      result = origMoveCells(cells, dx, dy, clone, target, evt as MouseEvent, mapping);

      // Removes empty tables
      for (const t of sourceTables) {
        if (!clone && model.contains(t) && t.getChildCount() === 0) {
          model.remove(t);
        }
      }
    } finally {
      model.endUpdate();
    }

    return result;
  } as Graph['moveCells'];

  // Graph.js:25517 forces a repaint of the table when a row or cell geometry changes
  model.addListener(InternalEvent.EXECUTED, (_sender: unknown, evt: EventObject) => {
    const change = evt.getProperty('change') as unknown;

    if (change instanceof GeometryChange && change.cell != null &&
      (isTableCell(graph, change.cell) || isTableRow(graph, change.cell))) {
      let cell: Cell | null = change.cell;

      if (isTableCell(graph, cell)) {
        cell = cell.getParent();
      }

      if (isTableRow(graph, cell)) {
        cell = cell!.getParent();
      }

      const state = cell != null ? graph.view.getState(cell) : null;

      if (cell != null && state != null && state.shape != null) {
        graph.view.invalidate(cell, false, false);
      }
    }
  });

  // Graph.js:14488 Shift+click selects a range of table cells
  const origSelectCellForEvent = graph.selectCellForEvent.bind(graph);
  graph.selectCellForEvent = function (cell: Cell, evt: MouseEvent): void {
    if (!eventUtils.isShiftDown(evt) || graph.isSelectionEmpty() || !selectTableRange(graph, graph.getSelectionCell(), cell)) {
      origSelectCellForEvent(cell, evt);
    }
  };

  // Graph.js:31609 shows the handler of the table for selected rows and cells
  const selectionCellsHandler = graph.getPlugin('SelectionCellsHandler') as SelectionCellsHandler | undefined;

  if (selectionCellsHandler != null) {
    const origGetHandled = selectionCellsHandler.getHandledSelectionCells.bind(selectionCellsHandler);
    selectionCellsHandler.getHandledSelectionCells = function (): Cell[] {
      const result: Cell[] = [];
      const seen = new Set<Cell>();
      const add = (c: Cell | null): void => {
        if (c != null && !seen.has(c)) {
          seen.add(c);
          result.push(c);
        }
      };

      for (const cell of origGetHandled()) {
        if (isTableCell(graph, cell)) {
          add(cell.getParent()?.getParent() ?? null);
        } else if (isTableRow(graph, cell)) {
          add(cell.getParent());
        }

        add(cell);
      }

      return result;
    };
  }

  // Configures vertex handlers of tables, rows and cells (handles, previews)
  const origCreateHandler = graph.createHandler.bind(graph);
  graph.createHandler = function (state: CellState) {
    const handler = origCreateHandler(state);

    if (handler instanceof VertexHandler) {
      configureHandler(graph, handler as TableVertexHandler);
    }

    return handler;
  } as Graph['createHandler'];

  // Graph.js:1135 / 1166 dragging a table cell or row moves the table, selected rows move
  const selectionHandler = graph.getPlugin('SelectionHandler') as SelectionHandler | undefined;

  if (selectionHandler != null) {
    const origGetCells = selectionHandler.getCells.bind(selectionHandler);
    selectionHandler.getCells = function (initialCell: Cell): Cell[] {
      const cells = origGetCells(initialCell);
      const seen = new Set<Cell>();
      const result: Cell[] = [];

      for (const c of cells) {
        // Propagates to composite parents or moves selected table rows
        const cell = (isTableCell(graph, initialCell) && isTableCell(graph, c) && graph.isCellSelected(c)) ?
          c.getParent() :
          ((isTableRow(graph, initialCell) && isTableRow(graph, c) && graph.isCellSelected(c)) ? c : getCompositeParent(graph, c));

        if (cell != null && !seen.has(cell)) {
          seen.add(cell);
          result.push(cell);
        }
      }

      return result;
    };

    const origStart = selectionHandler.start.bind(selectionHandler);
    selectionHandler.start = function (cell: Cell, x: number, y: number, cells?: Cell[]): void {
      // Propagates to selected table row to start move
      let ignoreParent = false;

      if (isTableCell(graph, cell)) {
        if (!graph.isCellSelected(cell)) {
          cell = cell.getParent() as Cell;
        } else {
          ignoreParent = true;
        }
      }

      if (!ignoreParent && (!isTableRow(graph, cell) || !graph.isCellSelected(cell))) {
        cell = getCompositeParent(graph, cell);
      }

      origStart(cell, x, y, cells);
    };
  }

  // Graph.js:498 mouseDown on an inner border of a cell of an unselected table
  // selects the table and starts resizing the row or column
  graph.addListener(InternalEvent.FIRE_MOUSE_EVENT, (_sender: unknown, evt: EventObject) => {
    if (evt.getProperty('eventName') !== InternalEvent.MOUSE_DOWN || !graph.isEnabled()) {
      return;
    }

    const me = evt.getProperty('event') as InternalMouseEvent;
    const state = me.getState();
    const mouseEvent = me.getEvent();

    if (state == null || eventUtils.isAltDown(mouseEvent) || eventUtils.isControlDown(mouseEvent) ||
      !isTableCell(graph, state.cell) || !graph.isCellMovable(state.cell) || graph.isCellSelected(state.cell)) {
      return;
    }

    const handlers = selectionCellsHandler;
    const existing = handlers?.getHandler(state.cell) as VertexHandler | null | undefined;

    // Cell handles have precedence over row and col resize
    if (existing != null && existing.getHandleForEvent(me) != null) {
      return;
    }

    const table = state.cell.getParent()?.getParent() as Cell;

    if (graph.isCellSelected(table) || !isOnInnerCellBorder(graph, state, me)) {
      return;
    }

    const wasSelected = handlers?.isHandled(table) ?? false;
    graph.selectCellForEvent(table, mouseEvent);
    const handler = handlers?.getHandler(table) as TableVertexHandler | null | undefined;

    if (handler != null && handler instanceof VertexHandler) {
      const handle = handler.getHandleForEvent(me);

      if (handle != null) {
        handler.start(me.getGraphX(), me.getGraphY(), handle);
        handler.blockDelayedSelection = !wasSelected;
        me.consume();
      }
    }
  });
}
