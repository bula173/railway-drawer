/**
 * Tests of the draw.io (jgraph/drawio v32.4.1) container, layout and table
 * behaviour ports (src/drawio-shapes/behaviour).
 */

import { Cell, Geometry, Graph, InternalEvent, InternalMouseEvent, Point, Rectangle, VertexHandler } from '@maxgraph/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { registerShapesEdgeShapes } from '../../js/shapes-edges';
import { applyDrawioDefaultStyles, parseStyleString, registerDrawioNamedStyles } from '../../../services/drawio-xml';
import {
  DRAWIO_MENU_PREFIX,
  deleteTableColumn,
  deleteTableRow,
  dropCellsIntoContainerAt,
  ensureDrawioMenuItems,
  executeDrawioMenuAction,
  getDropTargetAt,
  getLayoutForParent,
  insertTableColumn,
  insertTableRow,
  installDrawioBehaviour,
  setTableColumnWidth,
  updateDrawioMenuItems,
} from '../index';

let containers: HTMLElement[] = [];
let graphs: Graph[] = [];

function createGraph(): Graph {
  const container = document.createElement('div');
  container.style.width = '800px';
  container.style.height = '600px';
  document.body.appendChild(container);
  containers.push(container);
  const graph = new Graph(container);
  graphs.push(graph);
  // Same stylesheet setup as the tab graphs (src/ui/tabs.ts)
  applyDrawioDefaultStyles(graph.getStylesheet());
  registerDrawioNamedStyles(graph.getStylesheet());
  installDrawioBehaviour(graph);
  return graph;
}

function vertex(graph: Graph, parent: Cell, value: string, x: number, y: number, w: number, h: number, style: string): Cell {
  return graph.insertVertex({ parent, value, position: [x, y], size: [w, h], style: parseStyleString(style) });
}

const LIST_STYLE = 'swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=30;horizontalStack=0;' +
  'resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=1;marginBottom=0;whiteSpace=wrap;html=1;';
const ITEM_STYLE = 'text;strokeColor=none;fillColor=none;align=left;verticalAlign=middle;spacingLeft=4;spacingRight=4;' +
  'overflow=hidden;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;rotatable=0;whiteSpace=wrap;html=1;';

/** The "List" entry of draw.io's General palette (Sidebar.js:2845, general-31). */
function insertList(graph: Graph, x = 0, y = 0): { list: Cell; items: Cell[] } {
  const parent = graph.getDefaultParent();
  let list!: Cell;
  const items: Cell[] = [];

  graph.batchUpdate(() => {
    list = vertex(graph, parent, 'List', x, y, 140, 120, LIST_STYLE);

    for (let i = 0; i < 3; i++) {
      items.push(vertex(graph, list, `Item ${i + 1}`, 0, 0, 80, 30, ITEM_STYLE));
    }
  });

  return { list, items };
}

const TABLE_STYLE = 'shape=table;startSize=0;container=1;collapsible=0;childLayout=tableLayout;';
const ROW_STYLE = 'shape=tableRow;horizontal=0;startSize=0;swimlaneHead=0;swimlaneBody=0;strokeColor=inherit;' +
  'top=0;left=0;bottom=0;right=0;collapsible=0;dropTarget=0;fillColor=none;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;';
const CELL_STYLE = 'shape=partialRectangle;html=1;whiteSpace=wrap;connectable=0;strokeColor=inherit;overflow=hidden;' +
  'fillColor=none;top=0;left=0;bottom=0;right=0;pointerEvents=1;';

/** A 3x2 table like draw.io's Table entry (Sidebar.js createTable): 3 rows of 40, 2 columns of 90. */
function insertTable(graph: Graph, x = 100, y = 100): { table: Cell; rows: Cell[]; cells: Cell[][] } {
  const parent = graph.getDefaultParent();
  let table!: Cell;
  const rows: Cell[] = [];
  const cells: Cell[][] = [];

  graph.batchUpdate(() => {
    table = vertex(graph, parent, '', x, y, 180, 120, TABLE_STYLE);

    for (let r = 0; r < 3; r++) {
      const row = vertex(graph, table, '', 0, r * 40, 180, 40, ROW_STYLE);
      rows.push(row);
      cells.push([0, 1].map((c) => vertex(graph, row, `r${r}c${c}`, c * 90, 0, 90, 40, CELL_STYLE)));
    }
  });

  return { table, rows, cells };
}

function rowsOf(table: Cell): Cell[] {
  return table.getChildCells(true, false);
}

function cellsOf(row: Cell): Cell[] {
  return row.getChildCells(true, false);
}

/** Every row has the same column positions and widths, and the rows tile the table. */
function expectConsistentTable(table: Cell): void {
  const tgeo = table.getGeometry() as Geometry;
  const rows = rowsOf(table);
  const first = cellsOf(rows[0]).map((c) => [c.getGeometry()!.x, c.getGeometry()!.width]);
  let y = 0;

  for (const row of rows) {
    const rgeo = row.getGeometry() as Geometry;
    expect(rgeo.y).toBe(y);
    expect(rgeo.width).toBe(tgeo.width);
    y += rgeo.height;
    expect(cellsOf(row).map((c) => [c.getGeometry()!.x, c.getGeometry()!.width])).toEqual(first);
    expect(cellsOf(row).every((c) => c.getGeometry()!.height === rgeo.height)).toBe(true);
  }

  expect(y).toBe(tgeo.height);
  const last = first[first.length - 1];
  expect(last[0] + last[1]).toBe(tgeo.width);
}

beforeAll(() => {
  registerShapesEdgeShapes();
});

afterEach(() => {
  for (const g of graphs) g.destroy();
  for (const c of containers) c.remove();
  graphs = [];
  containers = [];
});

describe('containers: drop targets', () => {
  it('drops a shape into the body of a swimlane and makes it a child', () => {
    const graph = createGraph();
    const parent = graph.getDefaultParent();
    let lane!: Cell;
    let shape!: Cell;

    graph.batchUpdate(() => {
      lane = vertex(graph, parent, 'Lane', 100, 100, 200, 200, 'swimlane;startSize=30;');
      shape = vertex(graph, parent, 'Shape', 400, 400, 40, 40, 'rounded=0;');
    });

    expect(getDropTargetAt(graph, [shape], 150, 200)).toBe(lane);
    expect(getDropTargetAt(graph, [shape], 50, 50)).toBeNull();

    // Moves the shape to (150, 200) like a drag and drops it into the lane
    graph.batchUpdate(() => {
      graph.moveCells([shape], -250, -200, false);
      dropCellsIntoContainerAt(graph, [shape], 170, 220);
    });

    expect(shape.getParent()).toBe(lane);
    expect(shape.getGeometry()!.x).toBe(50);
    expect(shape.getGeometry()!.y).toBe(100);
  });

  it('accepts container=1 shapes and rejects dropTarget=0, plain shapes and Alt drops', () => {
    const graph = createGraph();
    const parent = graph.getDefaultParent();
    let group!: Cell;
    let plain!: Cell;
    let closed!: Cell;
    let shape!: Cell;

    graph.batchUpdate(() => {
      group = vertex(graph, parent, '', 0, 0, 100, 100, 'rounded=0;container=1;');
      plain = vertex(graph, parent, '', 200, 0, 100, 100, 'rounded=0;');
      closed = vertex(graph, parent, '', 400, 0, 100, 100, 'swimlane;dropTarget=0;');
      shape = vertex(graph, parent, '', 0, 300, 20, 20, 'ellipse;');
    });

    expect(graph.isValidDropTarget(group, [shape], null as unknown as MouseEvent)).toBe(true);
    expect(graph.isValidDropTarget(plain, [shape], null as unknown as MouseEvent)).toBe(false);
    expect(graph.isValidDropTarget(closed, [shape], null as unknown as MouseEvent)).toBe(false);

    const alt = new MouseEvent('mousemove', { clientX: 50, clientY: 50, altKey: true });
    expect(graph.getDropTarget([shape], alt, group, false)).toBeNull();
  });

  it('does not drop lanes into lanes and drops table rows only into tables', () => {
    const graph = createGraph();
    const parent = graph.getDefaultParent();
    let pool!: Cell;
    let lane1!: Cell;
    let lane2!: Cell;

    graph.batchUpdate(() => {
      pool = vertex(graph, parent, 'Pool', 0, 0, 400, 200,
        'swimlane;childLayout=stackLayout;resizeParent=1;resizeParentMax=0;horizontal=1;startSize=20;horizontalStack=0;');
      lane1 = vertex(graph, pool, 'Lane 1', 0, 20, 400, 90, 'swimlane;startSize=20;horizontal=0;');
      lane2 = vertex(graph, pool, 'Lane 2', 0, 110, 400, 90, 'swimlane;startSize=20;horizontal=0;');
    });

    expect(graph.isValidDropTarget(lane1, [lane2], null as unknown as MouseEvent)).toBe(false);
    expect(graph.isValidDropTarget(pool, [lane2], null as unknown as MouseEvent)).toBe(true);

    const { table, rows } = insertTable(graph, 500, 0);
    const { list } = insertList(graph, 0, 300);
    expect(graph.isValidDropTarget(table, [rows[0]], null as unknown as MouseEvent)).toBe(true);
    expect(graph.isValidDropTarget(rows[1], [rows[0]], null as unknown as MouseEvent)).toBe(false);
    expect(getDropTargetAt(graph, [rows[0]], 30, 350)).toBeNull();
    expect(getDropTargetAt(graph, [list], 550, 20)).toBeNull();
  });
});

describe('containers: collapse and expand', () => {
  it('collapses a swimlane to its head and expands it to the alternate bounds', () => {
    const graph = createGraph();
    const parent = graph.getDefaultParent();
    let lane!: Cell;

    graph.batchUpdate(() => {
      lane = vertex(graph, parent, 'Lane', 100, 100, 200, 200, 'swimlane;startSize=30;');
      vertex(graph, lane, 'Child', 20, 50, 40, 40, 'rounded=0;');
    });

    const state = graph.view.getState(lane)!;
    const image = graph.getFoldingImage(state);
    expect(image?.src.startsWith('data:image/svg+xml;base64,')).toBe(true);

    graph.foldCells(true, false, [lane]);
    expect(lane.isCollapsed()).toBe(true);
    expect(lane.getGeometry()!.height).toBe(30);
    expect(lane.getGeometry()!.alternateBounds!.width).toBe(200);
    expect(lane.getGeometry()!.alternateBounds!.height).toBe(200);
    expect(graph.view.getState(lane.getChildAt(0))).toBeNull();

    graph.foldCells(false, false, [lane]);
    expect(lane.isCollapsed()).toBe(false);
    expect(lane.getGeometry()!.width).toBe(200);
    expect(lane.getGeometry()!.height).toBe(200);
    expect(lane.getGeometry()!.x).toBe(100);
  });

  it('is foldable only for collapsible containers like draw.io', () => {
    const graph = createGraph();
    const parent = graph.getDefaultParent();
    let group!: Cell;
    let container!: Cell;
    let noFold!: Cell;

    graph.batchUpdate(() => {
      group = vertex(graph, parent, '', 0, 0, 100, 100, 'rounded=0;');
      vertex(graph, group, '', 10, 10, 10, 10, 'rounded=0;');
      container = vertex(graph, parent, '', 200, 0, 100, 100, 'rounded=0;container=1;');
      noFold = vertex(graph, parent, '', 400, 0, 100, 100, 'swimlane;collapsible=0;');
    });

    expect(graph.isCellFoldable(group, true)).toBe(false);
    expect(graph.isCellFoldable(container, true)).toBe(true);
    expect(graph.isCellFoldable(noFold, true)).toBe(false);
  });

  it('collapsing a lane in a pool shrinks the pool (resizeParentStacks)', () => {
    const graph = createGraph();
    const parent = graph.getDefaultParent();
    let pool!: Cell;
    let lane1!: Cell;
    let lane2!: Cell;

    graph.batchUpdate(() => {
      pool = vertex(graph, parent, 'Pool', 0, 0, 400, 220,
        'swimlane;childLayout=stackLayout;resizeParent=1;resizeParentMax=0;horizontal=1;startSize=20;horizontalStack=0;');
      lane1 = vertex(graph, pool, 'Lane 1', 0, 0, 400, 100, 'swimlane;startSize=20;horizontal=0;');
      lane2 = vertex(graph, pool, 'Lane 2', 0, 0, 400, 100, 'swimlane;startSize=20;horizontal=0;');
    });

    expect(lane1.getGeometry()!.y).toBe(20);
    expect(lane2.getGeometry()!.y).toBe(120);
    expect(pool.getGeometry()!.height).toBe(220);

    graph.foldCells(true, false, [lane1]);
    const collapsed = lane1.getGeometry()!.height;
    expect(collapsed).toBeLessThan(100);
    expect(lane2.getGeometry()!.y).toBe(20 + collapsed);
    expect(pool.getGeometry()!.height).toBe(120 + collapsed);
    // Stack children keep the full width when collapsed
    expect(lane1.getGeometry()!.width).toBe(400);

    graph.foldCells(false, false, [lane1]);
    expect(lane1.getGeometry()!.height).toBe(100);
    expect(pool.getGeometry()!.height).toBe(220);
  });
});

describe('layouts: stackLayout', () => {
  it('lays out the List palette entry like draw.io', () => {
    const graph = createGraph();
    const { list, items } = insertList(graph, 40, 40);

    expect(items.map((c) => c.getGeometry()!.y)).toEqual([30, 60, 90]);
    expect(items.map((c) => c.getGeometry()!.x)).toEqual([0, 0, 0]);
    expect(items.map((c) => c.getGeometry()!.width)).toEqual([140, 140, 140]);
    expect(list.getGeometry()!.height).toBe(120);
  });

  it('keeps the child order, reorders on move and inserts dropped items at the drop position', () => {
    const graph = createGraph();
    const { list, items } = insertList(graph, 0, 0);
    const layout = getLayoutForParent(graph, list)!;

    // Drags item 3 between item 1 and item 2 (view coordinates)
    graph.batchUpdate(() => layout.moveCell(items[2], 10, 50));
    expect(list.getChildren()).toEqual([items[0], items[2], items[1]]);
    expect(items[2].getGeometry()!.y).toBe(60);
    expect(items[1].getGeometry()!.y).toBe(90);

    // Drops a new item between the first two items
    let added!: Cell;
    graph.batchUpdate(() => {
      added = vertex(graph, graph.getDefaultParent(), 'New', 300, 300, 80, 30, ITEM_STYLE);
      dropCellsIntoContainerAt(graph, [added], 20, 58);
    });

    expect(added.getParent()).toBe(list);
    expect(list.getChildren().indexOf(added)).toBe(1);
    expect(list.getChildren().map((c) => c.getGeometry()!.y)).toEqual([30, 60, 90, 120]);
    expect(list.getGeometry()!.height).toBe(150);
  });

  it('places the stack right of the title of horizontal=0 containers', () => {
    const graph = createGraph();
    const parent = graph.getDefaultParent();
    let lane!: Cell;
    const children: Cell[] = [];

    graph.batchUpdate(() => {
      lane = vertex(graph, parent, 'Lane', 0, 0, 300, 100,
        'swimlane;horizontal=0;startSize=40;childLayout=stackLayout;horizontalStack=1;resizeParent=1;resizeParentMax=0;stackSpacing=10;stackBorder=5;');
      children.push(vertex(graph, lane, 'A', 0, 0, 50, 20, 'rounded=0;'));
      children.push(vertex(graph, lane, 'B', 0, 0, 60, 20, 'rounded=0;'));
    });

    expect(children.map((c) => c.getGeometry()!.x)).toEqual([45, 105]);
    expect(children.map((c) => c.getGeometry()!.y)).toEqual([5, 5]);
    expect(children.map((c) => c.getGeometry()!.height)).toEqual([90, 90]);
    expect(lane.getGeometry()!.width).toBe(170);
  });
});

describe('layouts: resizeParent and resizeLast', () => {
  it('fills the parent with the last child (resizeLast=1) and grows the parent when it is resized', () => {
    const graph = createGraph();
    const parent = graph.getDefaultParent();
    let stack!: Cell;
    const children: Cell[] = [];

    graph.batchUpdate(() => {
      stack = vertex(graph, parent, 'Stack', 0, 0, 200, 200,
        'swimlane;startSize=20;childLayout=stackLayout;horizontalStack=0;resizeParent=0;resizeLast=1;');
      children.push(vertex(graph, stack, 'A', 0, 0, 200, 50, 'rounded=0;'));
      children.push(vertex(graph, stack, 'B', 0, 0, 200, 50, 'rounded=0;'));
    });

    expect(children.map((c) => c.getGeometry()!.y)).toEqual([20, 70]);
    expect(children[1].getGeometry()!.height).toBe(130);
    expect(stack.getGeometry()!.height).toBe(200);

    // mxStackLayout.resizeCell: resizing the last child resizes the parent along the stack
    const geo = children[1].getGeometry()!;
    graph.resizeCell(children[1], new Rectangle(geo.x, geo.y, geo.width, 180));
    expect(stack.getGeometry()!.height).toBe(250);
    expect(children[1].getGeometry()!.height).toBe(180);
  });

  it('resizeParent=1 with resizeParentMax=1 only grows the parent', () => {
    const graph = createGraph();
    const parent = graph.getDefaultParent();
    let stack!: Cell;

    graph.batchUpdate(() => {
      stack = vertex(graph, parent, 'Stack', 0, 0, 200, 300,
        'swimlane;startSize=20;childLayout=stackLayout;horizontalStack=0;resizeParent=1;resizeParentMax=1;');
      vertex(graph, stack, 'A', 0, 0, 200, 50, 'rounded=0;');
    });

    expect(stack.getGeometry()!.height).toBe(300);

    graph.batchUpdate(() => {
      for (let i = 0; i < 6; i++) {
        vertex(graph, stack, `N${i}`, 0, 0, 200, 50, 'rounded=0;');
      }
    });

    expect(stack.getGeometry()!.height).toBe(370);
  });
});

describe('tables', () => {
  it('inserts rows before and after with the column layout of the table', () => {
    const graph = createGraph();
    const { table, cells } = insertTable(graph);

    insertTableRow(graph, cells[0][1], false);
    let rows = rowsOf(table);
    expect(rows).toHaveLength(4);
    expect(table.getGeometry()!.height).toBe(160);
    expect(cellsOf(rows[1]).map((c) => c.getValue())).toEqual(['', '']);
    expectConsistentTable(table);

    insertTableRow(graph, cells[2][0], true);
    rows = rowsOf(table);
    expect(rows).toHaveLength(5);
    expect(cellsOf(rows[3]).map((c) => c.getValue())).toEqual(['', '']);
    expect(cellsOf(rows[4]).map((c) => c.getValue())).toEqual(['r2c0', 'r2c1']);
    expect(table.getGeometry()!.height).toBe(200);
    expectConsistentTable(table);
  });

  it('inserts and deletes columns in every row', () => {
    const graph = createGraph();
    const { table, cells } = insertTable(graph);

    insertTableColumn(graph, cells[1][0], true);
    expect(rowsOf(table).every((r) => cellsOf(r).length === 3)).toBe(true);
    expect(cellsOf(rowsOf(table)[0]).map((c) => c.getValue())).toEqual(['', 'r0c0', 'r0c1']);
    expect(table.getGeometry()!.width).toBe(270);
    expectConsistentTable(table);

    deleteTableColumn(graph, cells[2][1]);
    expect(rowsOf(table).every((r) => cellsOf(r).length === 2)).toBe(true);
    expect(cellsOf(rowsOf(table)[0]).map((c) => c.getValue())).toEqual(['', 'r0c0']);
    expect(table.getGeometry()!.width).toBe(180);
    expectConsistentTable(table);
  });

  it('deletes rows and shrinks the table; deleting the last row removes the table', () => {
    const graph = createGraph();
    const { table, rows, cells } = insertTable(graph);

    deleteTableRow(graph, cells[1][0]);
    expect(rowsOf(table)).toEqual([rows[0], rows[2]]);
    expect(table.getGeometry()!.height).toBe(80);
    expectConsistentTable(table);

    deleteTableRow(graph, rows[0]);
    deleteTableRow(graph, rows[2]);
    expect(graph.getDataModel().contains(table)).toBe(false);
  });

  it('keeps rows and columns consistent when a column or row is resized', () => {
    const graph = createGraph();
    const { table, rows, cells } = insertTable(graph);

    // Default (no Shift): the neighbor column absorbs the change, table keeps its width
    setTableColumnWidth(graph, cells[0][0], 30, false);
    expect(cellsOf(rows[2]).map((c) => c.getGeometry()!.width)).toEqual([120, 60]);
    expect(table.getGeometry()!.width).toBe(180);
    expectConsistentTable(table);

    // Last column extends the table
    setTableColumnWidth(graph, cells[1][1], 20, false);
    expect(table.getGeometry()!.width).toBe(200);
    expectConsistentTable(table);

    // Resizing the table distributes the columns proportionally
    graph.batchUpdate(() => {
      const geo = table.getGeometry()!.clone();
      geo.width = 400;
      geo.height = 240;
      graph.getDataModel().setGeometry(table, geo);
    });
    expect(cellsOf(rows[1]).map((c) => c.getGeometry()!.width)).toEqual([240, 160]);
    expect(rowsOf(table).map((r) => r.getGeometry()!.height)).toEqual([80, 80, 80]);
    expectConsistentTable(table);
  });

  it('shows row and column resize handles on the table when a cell is selected', () => {
    const graph = createGraph();
    const { table, rows, cells } = insertTable(graph);

    graph.setSelectionCell(cells[1][0]);
    const handlers = graph.getPlugin('SelectionCellsHandler') as unknown as { getHandler(c: Cell): unknown };
    const handler = handlers.getHandler(table) as VertexHandler & { tableHandles?: unknown[] };
    expect(handler).toBeInstanceOf(VertexHandler);
    expect(handler.tableHandles).toHaveLength(rows.length + 2);
    // Rows and cells are not resizable themselves
    expect(graph.isCellResizable(cells[1][0])).toBe(false);
    expect(graph.isCellResizable(rows[1])).toBe(false);

    // Drags the line between the first and the second row down by 10
    const rowHandle = handler.tableHandles![0] as {
      setPosition(b: unknown, pt: Point, me: InternalMouseEvent): void; execute(me: InternalMouseEvent): void;
      state: { getPaintBounds(): unknown };
    };
    const me = new InternalMouseEvent(new MouseEvent('mouseup'));
    const bounds = rowHandle.state.getPaintBounds();
    rowHandle.setPosition(bounds, new Point(150, 150), me);
    rowHandle.execute(me);
    expect(rowsOf(table).map((r) => r.getGeometry()!.height)).toEqual([50, 40, 40]);
    expect(table.getGeometry()!.height).toBe(130);
    expectConsistentTable(table);

    // The handles follow the new structure
    insertTableRow(graph, cells[0][0], false);
    graph.getPlugin('SelectionCellsHandler');
    const handler2 = handlers.getHandler(table) as VertexHandler & { tableHandles?: unknown[] };
    handler2.redraw();
    expect(handler2.tableHandles).toHaveLength(4 + 2);

    // A refresh that recreates the custom handles (mxVertexHandler.refresh) keeps them
    for (const h of handler2.customHandles) h.destroy();
    handler2.customHandles = handler2.createCustomHandles();
    handler2.redrawHandles();
    expect(handler2.customHandles.filter((h) => (h as unknown as { tableHandle?: boolean }).tableHandle)).toHaveLength(6);
    handler2.customHandles = [];
    handler2.redrawHandles();
    expect(handler2.customHandles).toHaveLength(6);
  });

  it('removeCells clears cell labels and shrinks the table for removed rows', () => {
    const graph = createGraph();
    const { table, rows, cells } = insertTable(graph);

    graph.removeCells([cells[0][0]]);
    expect(graph.getDataModel().contains(cells[0][0])).toBe(true);
    expect(cells[0][0].getValue()).toBe('');

    graph.removeCells([rows[1]]);
    expect(rowsOf(table)).toHaveLength(2);
    expect(table.getGeometry()!.height).toBe(80);
    expectConsistentTable(table);
  });
});

describe('context menu items', () => {
  it('shows the table actions for table cells and runs them', () => {
    const graph = createGraph();
    const { table, cells } = insertTable(graph);
    const menu = document.createElement('div');
    ensureDrawioMenuItems(menu);
    ensureDrawioMenuItems(menu);

    const items = Array.from(menu.querySelectorAll<HTMLElement>('.context-menu-item'));
    expect(items).toHaveLength(7);

    updateDrawioMenuItems(menu, graph, cells[0][0]);
    const visible = items.filter((el) => el.style.display === 'block').map((el) => el.getAttribute('data-action'));
    expect(visible).toEqual([
      'insertColumnBefore', 'insertColumnAfter', 'deleteColumn', 'insertRowBefore', 'insertRowAfter', 'deleteRow',
    ].map((a) => DRAWIO_MENU_PREFIX + a));

    expect(executeDrawioMenuAction(graph, `${DRAWIO_MENU_PREFIX}insertRowAfter`, cells[0][0])).toBe(true);
    expect(rowsOf(table)).toHaveLength(4);
    expect(executeDrawioMenuAction(graph, `${DRAWIO_MENU_PREFIX}deleteColumn`, cells[0][0])).toBe(true);
    expect(rowsOf(table).every((r) => cellsOf(r).length === 1)).toBe(true);
    expect(executeDrawioMenuAction(graph, 'copy', cells[0][0])).toBe(false);

    updateDrawioMenuItems(menu, graph, null);
    expect(items.every((el) => el.style.display === 'none')).toBe(true);
  });

  it('offers collapse/expand for foldable containers and lane actions for lists', () => {
    const graph = createGraph();
    const { list, items } = insertList(graph);
    const menu = document.createElement('div');
    ensureDrawioMenuItems(menu);
    const fold = menu.querySelector<HTMLElement>(`[data-action="${DRAWIO_MENU_PREFIX}toggleFold"]`)!;

    updateDrawioMenuItems(menu, graph, list);
    expect(fold.style.display).toBe('block');
    expect(fold.textContent).toBe('Collapse');
    executeDrawioMenuAction(graph, `${DRAWIO_MENU_PREFIX}toggleFold`, list);
    expect(list.isCollapsed()).toBe(true);
    updateDrawioMenuItems(menu, graph, list);
    expect(fold.textContent).toBe('Expand');
    executeDrawioMenuAction(graph, `${DRAWIO_MENU_PREFIX}toggleFold`, list);
    expect(list.isCollapsed()).toBe(false);

    // List items: vertical stack -> row actions insert/delete items
    updateDrawioMenuItems(menu, graph, items[0]);
    const insertRow = menu.querySelector<HTMLElement>(`[data-action="${DRAWIO_MENU_PREFIX}insertRowAfter"]`)!;
    const insertCol = menu.querySelector<HTMLElement>(`[data-action="${DRAWIO_MENU_PREFIX}insertColumnAfter"]`)!;
    expect(insertRow.style.display).toBe('block');
    expect(insertCol.style.display).toBe('none');
    executeDrawioMenuAction(graph, `${DRAWIO_MENU_PREFIX}insertRowAfter`, items[0]);
    expect(list.getChildCount()).toBe(4);
    expect(list.getChildren().map((c) => c.getGeometry()!.y)).toEqual([30, 60, 90, 120]);
    expect(list.getGeometry()!.height).toBe(150);
  });
});

/**
 * Fires a mouse gesture through the graph's mouse listeners like real pointer
 * events at the given graph coordinates; `init` applies to the moves and the release
 * (eg. Alt held while dragging).
 */
function gesture(graph: Graph, points: Array<[number, number]>, init: MouseEventInit = {}): void {
  const fire = (name: string, gx: number, gy: number): void => {
    // Graph coordinates to view (container) coordinates
    const { scale, translate } = graph.view;
    const x = (gx + translate.x) * scale;
    const y = (gy + translate.y) * scale;
    const evt = new MouseEvent(name === InternalEvent.MOUSE_DOWN ? 'mousedown' : name === InternalEvent.MOUSE_UP ? 'mouseup' : 'mousemove',
      { clientX: x, clientY: y, button: 0, buttons: 1, ...(name === InternalEvent.MOUSE_DOWN ? {} : init) });
    const cell = graph.getCellAt(x, y);
    const state = cell != null ? graph.view.getState(cell) : null;
    // Events from the shape (or the canvas) like real pointer events
    Object.defineProperty(evt, 'target', { value: state?.shape?.node ?? graph.view.getCanvas() });
    const me = new InternalMouseEvent(evt, state);
    graph.fireMouseEvent(name, me);
  };

  const [first, ...rest] = points;
  fire(InternalEvent.MOUSE_DOWN, first[0], first[1]);

  for (const [x, y] of rest) {
    fire(InternalEvent.MOUSE_MOVE, x, y);
  }

  const last = points[points.length - 1];
  fire(InternalEvent.MOUSE_UP, last[0], last[1]);
}

describe('mouse gestures', () => {
  it('dragging a shape onto a swimlane makes it a child (SelectionHandler path)', () => {
    const graph = createGraph();
    const parent = graph.getDefaultParent();
    let lane!: Cell;
    let shape!: Cell;

    graph.batchUpdate(() => {
      lane = vertex(graph, parent, 'Lane', 100, 100, 200, 200, 'swimlane;startSize=30;');
      shape = vertex(graph, parent, 'Shape', 400, 400, 40, 40, 'rounded=0;');
    });

    gesture(graph, [[420, 420], [380, 380], [200, 240], [190, 230]]);

    expect(shape.getParent()).toBe(lane);
    expect(shape.getGeometry()!.x).toBe(70);
    expect(shape.getGeometry()!.y).toBe(110);

    // Alt-drag ignores the drop target and moves the shape out of the lane
    gesture(graph, [[190, 230], [300, 400], [500, 500], [510, 510]], { altKey: true });
    expect(shape.getParent()).toBe(parent);
  });

  it('dragging an inner cell border of an unselected table resizes the column', () => {
    const graph = createGraph();
    const { table, rows } = insertTable(graph, 100, 100);

    // Border between the two columns of the second row is at x = 190
    gesture(graph, [[189, 160], [200, 160], [220, 160]]);

    expect(graph.isCellSelected(table)).toBe(true);
    // As in draw.io, the table grows (Shift keeps the table width)
    expect(cellsOf(rows[1]).map((c) => c.getGeometry()!.width)).toEqual([120, 90]);
    expect(table.getGeometry()!.width).toBe(210);
    expectConsistentTable(table);
  });
});
