/**
 * @file arrange-commands.ts
 * @brief draw.io-like Edit / Arrange menu commands on a tab graph: Select Vertices / Edges / None, Rotate 90°,
 *        Flip Horizontal / Vertical, Lock/Unlock. Each edit is one undo step (style-edit.ts / cell-lock.ts);
 *        locked cells (also via their group or layer) keep their rotation and flips.
 */
import type { Cell, Graph } from '@maxgraph/core';
import { applyStyleToCells } from './style-edit';
import { toggleCellsLocked } from './cell-lock';

/** Selectable descendants of the current layer (draw.io selectCells on the default parent), nothing on a locked layer. */
function layerCells(graph: Graph, filter: (cell: Cell) => boolean, descend: boolean): Cell[] {
  const parent = graph.getDefaultParent();
  const out: Cell[] = [];
  const visit = (cell: Cell): void => {
    for (const child of cell.children ?? []) {
      if (filter(child) && graph.isCellSelectable(child) && graph.view.getState(child)) out.push(child);
      if (descend && child.getChildCount() > 0) visit(child);
    }
  };
  visit(parent);
  return out;
}

/** Edit > Select Vertices: the layer's shapes (groups as a whole; their parts are reached by a second click). */
export function selectVertices(graph: Graph): void {
  graph.setSelectionCells(layerCells(graph, (c) => c.isVertex(), false));
}

/** Edit > Select Edges: every edge of the layer, also inside groups (draw.io selectEdges). */
export function selectEdges(graph: Graph): void {
  graph.setSelectionCells(layerCells(graph, (c) => c.isEdge(), true));
}

/** Edit > Select None. */
export function selectNone(graph: Graph): void {
  graph.clearSelection();
}

function transformableVertices(graph: Graph): Cell[] {
  return graph.getSelectionCells().filter((cell) => cell.isVertex() && !graph.isCellLocked(cell));
}

/** Arrange > Rotate 90°: clockwise, like the Properties > Arrange button (one undo step). */
export function rotateSelection90(graph: Graph): Cell[] {
  return applyStyleToCells(graph, transformableVertices(graph), (style, resolved) => {
    style.rotation = ((Number(resolved.rotation) || 0) + 90) % 360;
  });
}

/** Arrange > Flip Horizontal / Vertical: toggles draw.io's flipH / flipV style key (one undo step). */
export function flipSelection(graph: Graph, key: 'flipH' | 'flipV'): Cell[] {
  return applyStyleToCells(graph, transformableVertices(graph), (style, resolved) => {
    style[key] = !resolved[key];
  });
}

/** Arrange > Lock/Unlock: draw.io lockUnlock on the selection (the first cell decides). */
export function toggleSelectionLocked(graph: Graph): boolean {
  return toggleCellsLocked(graph, graph.getSelectionCells());
}

/**
 * Properties > Arrange > Snap to Grid: the selected vertices' positions rounded to the grid, through
 * the model in one undo step (locked cells and relative geometries keep theirs).
 */
export function snapSelectionToGrid(graph: Graph): Cell[] {
  const size = graph.gridSize > 0 ? graph.gridSize : 10;
  const model = graph.getDataModel();
  const changed: Cell[] = [];
  model.batchUpdate(() => {
    for (const cell of transformableVertices(graph)) {
      const geo = cell.getGeometry();
      if (!geo || geo.relative) continue;
      const x = Math.round(geo.x / size) * size;
      const y = Math.round(geo.y / size) * size;
      if (x === geo.x && y === geo.y) continue;
      const next = geo.clone();
      next.x = x;
      next.y = y;
      model.setGeometry(cell, next);
      changed.push(cell);
    }
  });
  return changed;
}

/**
 * Properties > Arrange > Copy Size: the other selected vertices get the width and height of the first
 * selected cell, through the model in one undo step (locked cells keep their size).
 */
export function matchSelectionSize(graph: Graph): Cell[] {
  const [first, ...rest] = graph.getSelectionCells();
  const source = first?.getGeometry();
  if (!source) return [];
  const model = graph.getDataModel();
  const changed: Cell[] = [];
  model.batchUpdate(() => {
    for (const cell of rest) {
      const geo = cell.getGeometry();
      if (!cell.isVertex() || graph.isCellLocked(cell) || !geo) continue;
      if (geo.width === source.width && geo.height === source.height) continue;
      const next = geo.clone();
      next.width = source.width;
      next.height = source.height;
      model.setGeometry(cell, next);
      changed.push(cell);
    }
  });
  return changed;
}
