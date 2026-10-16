/**
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Ported from jgraph/drawio v32.4.1 src/main/webapp/js/grapheditor/Graph.js:20216
 * (TableLayout), Graph.js:11450 (layoutManager.getLayout for stackLayout and
 * tableLayout), Graph.js:19762 (setTableRowHeight) and Graph.js:19832
 * (setTableColumnWidth).
 */

import { Cell, Geometry, Graph, Rectangle, StackLayout } from '@maxgraph/core';
import { getNumber, getValue, isFlag, toFlag } from './util';
import {
  MIN_TABLE_COLUMN_WIDTH,
  MIN_TABLE_ROW_HEIGHT,
  childVertices,
  getActualStartSize,
  visitTableCells,
} from './table-graph';

/** Special layout for tables (childLayout=tableLayout). */
export class TableLayout extends StackLayout {
  constructor(graph: Graph) {
    super(graph, false);
  }

  /** Overrides stack layout to handle row reorder. */
  override isHorizontal(): boolean {
    return false;
  }

  /** Overrides to allow for table rows and cells. */
  override isVertexIgnored(vertex: Cell): boolean {
    return !vertex.isVertex() || !vertex.isVisible();
  }

  /** Returns the total vertical or horizontal size of the given cells. */
  getSize(cells: Cell[], horizontal: boolean): number {
    let total = 0;

    for (const cell of cells) {
      if (!this.isVertexIgnored(cell)) {
        const geo = cell.getGeometry();

        if (geo != null) {
          total += horizontal ? geo.width : geo.height;
        }
      }
    }

    return total;
  }

  /** Returns the column positions for the given row and table width. */
  getRowLayout(row: Cell, width: number): number[] {
    const cells = childVertices(row);
    const off = getActualStartSize(this.graph, row, true);
    const sw = this.getSize(cells, true);
    const rw = Math.max(0, width - off.x - off.width);
    const result: number[] = [];
    let x = off.x;

    for (const cell of cells) {
      const geo = cell.getGeometry();

      if (geo != null) {
        // Distributes evenly if stored widths are unusable
        x += sw > 0 ? (geo.alternateBounds != null ? geo.alternateBounds.width : geo.width) * rw / sw : rw / cells.length;
        result.push(Math.round(x));
      }
    }

    return result;
  }

  /** Places the cells at the given positions in the given row. */
  layoutRow(row: Cell, positions: number[] | null, height: number, tw: number): number {
    const model = this.graph.getDataModel();
    const cells = childVertices(row);
    const off = getActualStartSize(this.graph, row, true);
    let x = off.x;
    let sw = 0;

    if (positions != null) {
      positions = positions.slice();
      positions.splice(0, 0, off.x);
    }

    for (let i = 0; i < cells.length; i++) {
      let geo = cells[i].getGeometry();

      if (geo != null) {
        geo = geo.clone();

        geo.y = off.y;
        geo.height = Math.max(0, height - off.y - off.height);

        if (positions != null) {
          geo.x = positions[i];
          geo.width = Math.max(0, positions[i + 1] - geo.x);

          // Fills with last geo if not enough cells
          if (i === cells.length - 1 && i < positions.length - 2) {
            geo.width = Math.max(0, tw - geo.x - off.x - off.width);
          }
        } else {
          geo.x = x;
          x += geo.width;

          if (i === cells.length - 1) {
            geo.width = Math.max(0, tw - off.x - off.width - sw);
          } else {
            sw += geo.width;
          }
        }

        geo.alternateBounds = new Rectangle(0, 0, geo.width, geo.height);
        model.setGeometry(cells[i], geo);
      }
    }

    return sw;
  }

  override execute(parent: Cell): void {
    let table = parent != null ? parent.getGeometry() : null;

    if (table == null) {
      return;
    }

    const graph = this.graph;
    const offset = getActualStartSize(graph, parent, true);
    const style = graph.getCellStyle(parent) as Record<string, unknown>;
    const resizeLastRow = isFlag(style, 'resizeLastRow', false);
    const resizeLast = isFlag(style, 'resizeLast', false);
    const fixedRows = isFlag(style, 'fixedRows', false);
    const model = graph.getDataModel();
    let sw = 0;

    model.beginUpdate();
    try {
      const rows = childVertices(parent);

      // Updates row visibilities
      for (const row of rows) {
        model.setVisible(row, true);
      }

      if (rows.length > 0 && !parent.isCollapsed()) {
        // Grows the table if the start sizes leave no room for content
        let start = 0;

        for (const row of rows) {
          const rs = getActualStartSize(graph, row, true);
          start = Math.max(start, rs.x + rs.width);
        }

        let minWidth = offset.x + offset.width + start;
        let minHeight = offset.y + offset.height;
        minWidth += minWidth > 0 ? MIN_TABLE_COLUMN_WIDTH : 0;
        minHeight += minHeight > 0 ? MIN_TABLE_ROW_HEIGHT : 0;

        if (table.width < minWidth || table.height < minHeight) {
          table = table.clone();
          table.width = Math.max(table.width, minWidth);
          table.height = Math.max(table.height, minHeight);
          model.setGeometry(parent, table);
        }
      }

      const th = table.height - offset.y - offset.height;
      const tw = table.width - offset.x - offset.width;
      const sh = this.getSize(rows, false);

      if (th > 0 && tw > 0 && rows.length > 0 && sh > 0) {
        if (resizeLastRow) {
          let row = rows[rows.length - 1].getGeometry();

          if (row != null) {
            row = row.clone();
            row.height = th - sh + row.height;
            model.setGeometry(rows[rows.length - 1], row);
          }
        }

        const pos = resizeLast ? null : this.getRowLayout(rows[0], tw);
        let y = offset.y;

        // Updates row geometries
        for (const rowCell of rows) {
          let row = rowCell.getGeometry();

          if (row != null) {
            row = row.clone();
            row.x = offset.x;
            row.width = tw;
            row.y = Math.round(y);

            if (resizeLastRow || fixedRows) {
              y += row.height;
            } else {
              y += (row.height / sh) * th;
            }

            row.height = Math.round(y) - row.y;
            model.setGeometry(rowCell, row);

            // Updates cell geometries
            sw = Math.max(sw, this.layoutRow(rowCell, pos, row.height, tw));
          }
        }

        if (fixedRows && th < sh) {
          table = table.clone();
          table.height = y + offset.height;
          model.setGeometry(parent, table);
        }

        if (resizeLast && tw < sw + MIN_TABLE_COLUMN_WIDTH) {
          table = table.clone();
          table.width = sw + offset.width + offset.x + MIN_TABLE_COLUMN_WIDTH;
          model.setGeometry(parent, table);
        }

        // All geometries of cells in rows with a geometry are cloned at this
        // point so they can change in-place below (merged cells)
        visitTableCells(graph, parent, (iter) => {
          model.setVisible(iter.cell, iter.actual.cell === iter.cell);

          if (iter.actual.cell !== iter.cell && (iter.actual.cell.getParent()?.getGeometry() ?? null) != null) {
            if (iter.actual.row === iter.row) {
              const g = iter.geo.alternateBounds != null ? iter.geo.alternateBounds : iter.geo;
              iter.actual.geo.width += g.width;
            }

            if (iter.actual.col === iter.col) {
              const g = iter.geo.alternateBounds != null ? iter.geo.alternateBounds : iter.geo;
              iter.actual.geo.height += g.height;
            }
          }
        });
      } else {
        // Updates row visibilities
        for (const row of rows) {
          model.setVisible(row, false);
        }
      }
    } finally {
      model.endUpdate();
    }
  }
}

/** True if the given cell is a transparentBounds container (draw.io). */
function isTransparentBounds(graph: Graph, cell: Cell): boolean {
  return isFlag(graph.getCellStyle(cell), 'transparentBounds', false);
}

/**
 * The stack layout that draw.io's layout manager creates for
 * childLayout=stackLayout (Graph.js:11469).
 */
export function createStackLayout(graph: Graph, cell: Cell): StackLayout {
  const style = graph.getCellStyle(cell) as Record<string, unknown>;
  const transparentParent = isTransparentBounds(graph, cell);
  const stackLayout = new StackLayout(graph, true);
  stackLayout.resizeParentMax = !transparentParent && isFlag(style, 'resizeParentMax', true);
  stackLayout.horizontal = toFlag(getValue(style, 'horizontalStack', '1'));
  stackLayout.resizeParent = !transparentParent && isFlag(style, 'resizeParent', true);
  stackLayout.resizeLast = !transparentParent && isFlag(style, 'resizeLast', false);
  stackLayout.spacing = getNumber(style, 'stackSpacing', 0) || stackLayout.spacing;
  stackLayout.border = getNumber(style, 'stackBorder', 0) || stackLayout.border;
  stackLayout.marginLeft = getNumber(style, 'marginLeft', 0) || 0;
  stackLayout.marginRight = getNumber(style, 'marginRight', 0) || 0;
  stackLayout.marginTop = getNumber(style, 'marginTop', 0) || 0;
  stackLayout.marginBottom = getNumber(style, 'marginBottom', 0) || 0;
  stackLayout.allowGaps = toFlag(getValue(style, 'allowGaps', 0)) || getNumber(style, 'allowGaps', 0) > 0;
  stackLayout.fill = !transparentParent;

  if (stackLayout.allowGaps) {
    stackLayout.gridSize = getNumber(style, 'stackUnitSize', 20);
  }

  return stackLayout;
}

/** Graph.setTableRowHeight (Graph.js:19762). */
export function setTableRowHeight(graph: Graph, row: Cell, dy: number, extend = true): void {
  const model = graph.getDataModel();

  model.beginUpdate();
  try {
    let rgeo = row.getGeometry();

    if (rgeo != null) {
      rgeo = rgeo.clone();
      rgeo.height += dy;
      model.setGeometry(row, rgeo);

      const table = row.getParent() as Cell;
      const rows = childVertices(table);

      // Shifts and resizes neighbor row
      if (!extend) {
        const index = rows.indexOf(row);

        if (index < rows.length - 1) {
          const nextRow = rows[index + 1];
          let geo = nextRow.getGeometry();

          if (geo != null) {
            geo = geo.clone();
            geo.y += dy;
            geo.height -= dy;
            model.setGeometry(nextRow, geo);
          }
        }
      }

      // Updates height of table
      let tgeo = table.getGeometry();

      if (tgeo != null) {
        // Always extends for last row
        if (!extend) {
          extend = row === rows[rows.length - 1];
        }

        if (extend) {
          tgeo = tgeo.clone();
          tgeo.height += dy;
          model.setGeometry(table, tgeo);
        }
      }
    }
  } finally {
    model.endUpdate();
  }
}

/** Graph.setTableColumnWidth (Graph.js:19832). */
export function setTableColumnWidth(graph: Graph, col: Cell, dx: number, extend = false): void {
  const model = graph.getDataModel();
  let row = col.getParent() as Cell;
  const table = row.getParent() as Cell;
  let cells = childVertices(row);
  const index = cells.indexOf(col);
  const lastColumn = index === cells.length - 1;

  model.beginUpdate();
  try {
    const rows = childVertices(table);

    for (const r of rows) {
      row = r;
      cells = childVertices(row);
      const cell = cells[index];
      let geo: Geometry | null = cell != null ? cell.getGeometry() : null;

      if (geo != null) {
        geo = geo.clone();
        geo.width += dx;

        if (geo.alternateBounds != null) {
          geo.alternateBounds.width += dx;
        }

        model.setGeometry(cell, geo);
      }

      // Shifts and resizes neighbor column
      if (index < cells.length - 1) {
        const next = cells[index + 1];
        let ngeo = next.getGeometry();

        if (ngeo != null) {
          ngeo = ngeo.clone();
          ngeo.x += dx;

          if (!extend) {
            ngeo.width -= dx;

            if (ngeo.alternateBounds != null) {
              ngeo.alternateBounds.width -= dx;
            }
          }

          model.setGeometry(next, ngeo);
        }
      }
    }

    if (lastColumn || extend) {
      let tgeo = table.getGeometry();

      if (tgeo != null) {
        tgeo = tgeo.clone();
        tgeo.width += dx;
        model.setGeometry(table, tgeo);
      }
    }

    const manager = (graph as unknown as { drawioLayoutManager?: { executeLayout(cell: Cell): void } }).drawioLayoutManager;

    if (manager != null) {
      manager.executeLayout(table);
    }
  } finally {
    model.endUpdate();
  }
}
