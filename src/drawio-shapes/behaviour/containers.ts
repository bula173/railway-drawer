/**
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Ported from jgraph/drawio v32.4.1 src/main/webapp/js/grapheditor/Graph.js:
 *   10968 isRecursiveVertexResize, 15602 isMoveCellsEvent, 15610 foldCells,
 *   15698 moveSiblings, 16853 isCellFoldable, 23091 isExtendParent,
 *   24149 isValidDropTarget, 26335 getDropTarget (on mxGraph.js:12016 getDropTarget), 31268 mxGraphHandler.isValidDropTarget,
 *   1571 graphHandler.shouldRemoveCellsFromParent, 27401 isCellResizable (transparentBounds),
 *   33439 createFoldingImage / 33471 getFoldingImage (foldingIconSize),
 *   2287 Graph.createSvgImage.
 *
 * draw.io container semantics on a maxGraph Graph instance: swimlanes (shape=swimlane,
 * table, tableRow) and container=1 cells accept dropped children, the head (startSize)
 * stays the label/drag area, collapsible containers get draw.io's folding icon and
 * swap to alternateBounds, folding inside stacks resizes the parent stacks.
 * Everything is installed on the instance, never on maxGraph prototypes.
 */

import { Cell, Graph, ImageBox, SelectionHandler, eventUtils, styleUtils } from '@maxgraph/core';
import type { CellState, InternalMouseEvent } from '@maxgraph/core';
import { getNumber } from '../js/shapes-edges/util';
import { isTable, isTableCell, isTableRow } from '../js/shapes-edges/table-graph';
import {
  currentStyle,
  isContainer,
  isLane,
  isOff,
  isOn,
  isTargetShape,
  isTransparentBounds,
  markInstalled,
} from './common';
import { getLayoutForParent, installDrawioLayouts, resizeParentStacks } from './layouts';

export { isContainer } from './common';

/** Graph.createSvgImage (Graph.js:2287). */
export function createSvgImage(w: number, h: number, data: string, coordWidth?: number, coordHeight?: number): ImageBox {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}px" height="${h}px" ` +
    (coordWidth != null && coordHeight != null ? `viewBox="0 0 ${coordWidth} ${coordHeight}" ` : '') +
    `version="1.1" style="color-scheme: light dark;">${data}</svg>`;
  const bytes = unescape(encodeURIComponent(svg));

  return new ImageBox(`data:image/svg+xml;base64,${btoa(bytes)}`, w, h);
}

/** Graph.createFoldingImage (Graph.js:33439): draw.io's expanded/collapsed folding icons. */
export function createFoldingImage(s: number, collapsed: boolean): ImageBox {
  return collapsed
    ? createSvgImage(s, s, '<defs><linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">' +
      '<stop offset="30%" style="stop-color:#f0f0f0;" /><stop offset="100%" style="stop-color:#AFB0B6;" /></linearGradient></defs>' +
      '<rect x="0" y="0" width="9" height="9" stroke="#8A94A5" fill="url(#grad1)" stroke-width="2"/>' +
      '<path d="M 4.5 2 L 4.5 7 M 2 4.5 L 7 4.5 z" stroke="#000"/>', 9, 9)
    : createSvgImage(s, s, '<defs><linearGradient id="grad1" x1="50%" y1="0%" x2="50%" y2="100%">' +
      '<stop offset="30%" style="stop-color:#f0f0f0;" /><stop offset="100%" style="stop-color:#AFB0B6;" /></linearGradient></defs>' +
      '<rect x="0" y="0" width="9" height="9" stroke="#8A94A5" fill="url(#grad1)" stroke-width="2"/>' +
      '<path d="M 2 4.5 L 7 4.5 z" stroke="#000"/>', 9, 9);
}

/**
 * maxGraph's FoldingMixin defaults point at `<imageBasePath>/collapsed.gif` / `expanded.gif`, which the app does not
 * ship: every graph without draw.io folding (palette thumbnails, the scenario view) requested them (404 on load).
 * The mixin's `options` object is shared by all graphs, so its defaults become draw.io's inline SVG icons (CSP allows
 * data: images); graphs with `installDrawioContainers` still pick their own size via getFoldingImage.
 */
export function installDefaultFoldingImages(): void {
  const options = (Graph.prototype as unknown as { options?: { collapsedImage?: ImageBox; expandedImage?: ImageBox } }).options;

  if (options != null) {
    options.collapsedImage = createFoldingImage(9, true);
    options.expandedImage = createFoldingImage(9, false);
  }
}

installDefaultFoldingImages();

const foldingImages = new Map<string, ImageBox>();

function getFoldingImageForSize(size: number, collapsed: boolean): ImageBox {
  const key = `${size}-${collapsed}`;
  let image = foldingImages.get(key);

  if (image == null) {
    image = createFoldingImage(size, collapsed);
    foldingImages.set(key, image);
  }

  return image;
}

/** Graph.isCellFoldable (Graph.js:16853), without tree folding (treeFolding=1). */
export function isDrawioCellFoldable(graph: Graph, cell: Cell): boolean {
  const style = currentStyle(graph, cell);
  const container = isContainer(graph, cell);

  return graph.isFoldingEnabled() && !isTransparentBounds(graph, cell) &&
    !isOff(style, 'resizable', '1') &&
    ((container && !isOff(style, 'collapsible', '1')) || (!container && isOn(style, 'collapsible', '0'))) &&
    !graph.isCellLocked(cell);
}

/** Graph.isRecursiveVertexResize (Graph.js:10968). */
export function isRecursiveVertexResize(graph: Graph, state: CellState): boolean {
  return !graph.isSwimlane(state.cell) && state.cell.getChildCount() > 0 && !state.cell.isCollapsed() &&
    !isOff(state.style, 'recursiveResize', '1') && (state.style as Record<string, unknown>).childLayout == null;
}

/** Graph.isValidDropTarget (Graph.js:24149) on top of mxGraph.isValidDropTarget. */
function isValidDropTarget(graph: Graph, orig: Graph['isValidDropTarget'], cell: Cell, cells: Cell[], evt: MouseEvent | null): boolean {
  if (cell == null) {
    return false;
  }

  const style = currentStyle(graph, cell);
  let tables = true;
  let rows = true;

  for (let i = 0; i < cells.length && rows; i++) {
    tables = tables && isTable(graph, cells[i]);
    rows = rows && isTableRow(graph, cells[i]);
  }

  // Disables dropping lanes into lanes
  let lanes = false;

  if (isLane(graph, cell)) {
    for (let i = 0; i < cells.length && !lanes; i++) {
      lanes = isLane(graph, cells[i]);
    }
  }

  return !graph.isCellLocked(cell) && !lanes &&
    (isTargetShape(graph, cell, cells) ||
      ((!isOn(style, 'part', '0') || isContainer(graph, cell)) &&
        !isOff(style, 'dropTarget', '1') &&
        (!!orig(cell, cells, evt as MouseEvent) || isContainer(graph, cell)) &&
        !isTableRow(graph, cell) && (!isTable(graph, cell) || rows || tables)));
}

/**
 * mxGraph.getDropTarget (mxGraph.js:12016). maxGraph 0.10.3's port returns null
 * for every clone drop (its parent check runs only when not cloning but is
 * evaluated in both cases), so the original is ported here.
 */
function baseGetDropTarget(graph: Graph, cells: Cell[], evt: MouseEvent, cell: Cell | null, clone: boolean): Cell | null {
  const model = graph.getDataModel();

  if (!graph.isSwimlaneNesting()) {
    for (const c of cells) {
      if (graph.isSwimlane(c)) {
        return null;
      }
    }
  }

  const pt = styleUtils.convertPoint(graph.container, eventUtils.getClientX(evt), eventUtils.getClientY(evt));
  pt.x -= graph.getPanDx();
  pt.y -= graph.getPanDy();
  const swimlane = graph.getSwimlaneAt(pt.x, pt.y);

  if (cell == null) {
    cell = swimlane;
  } else if (swimlane != null) {
    // Checks if the cell is an ancestor of the swimlane under the mouse and
    // uses the swimlane in that case
    let tmp = swimlane.getParent();

    while (tmp != null && graph.isSwimlane(tmp) && tmp !== cell) {
      tmp = tmp.getParent();
    }

    if (tmp === cell) {
      cell = swimlane;
    }
  }

  while (cell != null && !graph.isValidDropTarget(cell, cells, evt) && !model.isLayer(cell)) {
    cell = cell.getParent();
  }

  // Checks if parent is dropped into child if not cloning
  let parent: Cell | null = null;

  if (!clone) {
    parent = cell;

    while (parent != null && cells.indexOf(parent) < 0) {
      parent = parent.getParent();
    }
  }

  return cell != null && !model.isLayer(cell) && parent == null ? cell : null;
}

/**
 * Graph.getDropTarget (Graph.js:26335): Alt disables dropping into containers, edge
 * labels stay on their edges and table rows are always dropped into tables.
 */
function getDropTarget(graph: Graph, cells: Cell[], evt: MouseEvent,
  cell: Cell | null, clone: boolean): Cell | null {
  if (evt != null && eventUtils.isAltDown(evt)) {
    return null;
  }

  // Disables dragging edge labels out of edges
  for (const c of cells) {
    const parent = c.getParent();

    if (parent != null && parent.isEdge() && cells.indexOf(parent) < 0) {
      return null;
    }
  }

  let target = baseGetDropTarget(graph, cells, evt, cell, clone);

  // Always drops rows to tables
  let rows = cells.length > 0;

  for (let i = 0; i < cells.length && rows; i++) {
    rows = rows && isTableRow(graph, cells[i]);
  }

  if (rows) {
    if (isTableCell(graph, target)) {
      target = target!.getParent();
    }

    if (isTableRow(graph, target)) {
      target = target!.getParent();
    }

    if (!isTable(graph, target)) {
      target = null;
    }
  }

  return target;
}
/** Graph.moveSiblings (Graph.js:15698): moves the cells right of and below a folded cell. */
function moveSiblings(graph: Graph, state: CellState, parent: Cell, dx: number, dy: number): void {
  const model = graph.getDataModel();
  model.beginUpdate();
  try {
    const cells = graph.getCellsBeyond(state.x, state.y, parent, true, true);

    for (const cell of cells) {
      if (cell !== state.cell) {
        const tmp = graph.view.getState(cell);
        let geo = cell.getGeometry();

        // If the cell changes only in one dimension then only the cells in the
        // same column (or row) are moved
        if (tmp != null && geo != null &&
          (dx !== 0 || (tmp.x < state.x + state.width && tmp.x + tmp.width > state.x)) &&
          (dy !== 0 || (tmp.y < state.y + state.height && tmp.y + tmp.height > state.y))) {
          geo = geo.clone();
          geo.translate(Math.round(dx * Math.max(0, Math.min(1, (tmp.x - state.x) / state.width))),
            Math.round(dy * Math.max(0, Math.min(1, (tmp.y - state.y) / state.height))));
          model.setGeometry(cell, geo);
        }
      }
    }
  } finally {
    model.endUpdate();
  }
}

/** Graph.isMoveCellsEvent (Graph.js:15602). */
function isMoveCellsEvent(evt: MouseEvent | null, state: CellState): boolean {
  return (evt != null && eventUtils.isShiftDown(evt)) || isOn(state.style, 'moveCells', '0');
}

/**
 * Returns the drop target for the given cells at the given point in graph
 * coordinates (unscaled, untranslated), as draw.io's drop handlers find it
 * (getDropTarget with the topmost cell under the point), or null.
 */
export function getDropTargetAt(graph: Graph, cells: Cell[], x: number, y: number): Cell | null {
  if (!graph.isDropEnabled() || cells.length === 0) {
    return null;
  }

  const { scale, translate } = graph.view;
  const vx = (x + translate.x) * scale;
  const vy = (y + translate.y) * scale;
  const container = graph.container;
  const rect = container?.getBoundingClientRect();
  const clientX = vx + (rect?.left ?? 0) - (container?.scrollLeft ?? 0);
  const clientY = vy + (rect?.top ?? 0) - (container?.scrollTop ?? 0);
  const evt = new MouseEvent('mousemove', { clientX, clientY });
  const excluded = new Set<Cell>(cells);
  const isExcluded = (cell: Cell | null): boolean => {
    for (let c = cell; c != null; c = c.getParent()) {
      if (excluded.has(c)) {
        return true;
      }
    }

    return false;
  };
  const cell = graph.getCellAt(vx, vy, null, true, false, (state: CellState) => isExcluded(state.cell));

  return graph.getDropTarget(cells, evt, cell, true);
}

/**
 * Moves the given cells (children of the default parent, at absolute graph
 * coordinates) into the container under the given point (graph coordinates),
 * as draw.io's sidebar drop does, and returns the cells. Inside a stack layout the
 * cells are inserted at the drop position. Use inside the insert transaction.
 */
export function dropCellsIntoContainerAt(graph: Graph, cells: Cell[], x: number, y: number): Cell[] {
  const target = getDropTargetAt(graph, cells, x, y);

  if (target == null || target === graph.getDefaultParent()) {
    return cells;
  }

  const model = graph.getDataModel();
  let result = cells;
  model.beginUpdate();
  try {
    result = graph.moveCells(cells, 0, 0, false, target);
    const layout = getLayoutForParent(graph, target);

    if (layout != null) {
      const { scale, translate } = graph.view;

      for (const cell of result) {
        layout.moveCell(cell, (x + translate.x) * scale, (y + translate.y) * scale);
      }
    }
  } finally {
    model.endUpdate();
  }

  return result;
}

/**
 * Installs draw.io's container behaviour on the given graph (see the file header).
 * Also installs the draw.io layouts (stack/table/...) it depends on. Idempotent.
 */
export function installContainers(graph: Graph): void {
  installDrawioLayouts(graph);

  if (!markInstalled(graph, 'containers')) {
    return;
  }

  graph.setDropEnabled(true);

  const origIsValidDropTarget = graph.isValidDropTarget.bind(graph);
  graph.isValidDropTarget = function (cell: Cell, cells: Cell[] = [], evt: MouseEvent | null = null): boolean {
    return isValidDropTarget(graph, origIsValidDropTarget, cell, cells, evt);
  } as Graph['isValidDropTarget'];

  graph.getDropTarget = function (cells: Cell[], evt: MouseEvent, cell: Cell | null = null, clone = false): Cell | null {
    return getDropTarget(graph, cells, evt, cell, clone);
  } as Graph['getDropTarget'];

  graph.isCellFoldable = function (cell: Cell): boolean {
    return isDrawioCellFoldable(graph, cell);
  } as Graph['isCellFoldable'];

  // draw.io's SVG folding icons, sized by foldingIconSize (Graph.js:33471)
  graph.getFoldingImage = function (state: CellState): ImageBox | null {
    if (state != null && graph.isFoldingEnabled() && !state.cell.isEdge()) {
      const collapsed = state.cell.isCollapsed();

      if (graph.isCellFoldable(state.cell, !collapsed)) {
        const size = Math.trunc(getNumber(state.style, 'foldingIconSize', 0));
        return getFoldingImageForSize(size > 0 ? size : 9, collapsed);
      }
    }

    return null;
  };

  // Graph.js:23091 expand style, transparentBounds and tables
  const origIsExtendParent = graph.isExtendParent.bind(graph);
  graph.isExtendParent = function (cell: Cell): boolean {
    const parent = cell.getParent();

    if (parent != null) {
      if (isTransparentBounds(graph, parent)) {
        return false;
      }

      const style = currentStyle(graph, parent);

      if (style.expand != null) {
        return !isOff(style, 'expand', '1');
      }
    }

    return origIsExtendParent(cell) && (parent == null || !isTable(graph, parent));
  };

  // Graph.js:27401 transparentBounds cells are not resizable
  const origIsCellResizable = graph.isCellResizable.bind(graph);
  graph.isCellResizable = function (cell: Cell): boolean {
    return !isTransparentBounds(graph, cell) && origIsCellResizable(cell);
  };

  // Graph.js:10968 Enables recursive resize for groups (VertexHandler.isRecursiveResize)
  const origIsRecursiveResize = graph.isRecursiveResize.bind(graph);
  graph.isRecursiveResize = function (state: CellState | null = null): boolean {
    return state != null ? isRecursiveVertexResize(graph, state) : origIsRecursiveResize(state);
  };

  // Graph.js:15610 foldCells: brings expandToFront cells to front, resizes parent
  // stacks (unless Alt is pressed) or moves siblings (Shift / moveCells=1)
  const origFoldCells = graph.foldCells.bind(graph);
  graph.foldCells = function (collapse = false, recurse = false, cells: Cell[] | null = null,
    checkFoldable = false, evt: Event | null = null): Cell[] | null {
    const target = cells ?? graph.getFoldableCells(graph.getSelectionCells(), collapse) ?? [];
    const model = graph.getDataModel();
    let result: Cell[] | null = target;

    model.beginUpdate();
    try {
      result = origFoldCells(collapse, recurse, target, checkFoldable, evt);

      for (const cell of target) {
        const state = graph.view.getState(cell);
        const geo = cell.getGeometry();

        if (state != null && geo != null) {
          // Brings folded containers to front
          if (isOn(state.style, 'expandToFront', '0') && !cell.isCollapsed()) {
            graph.orderCells(false, [cell]);
          }

          let dx: number;
          let dy: number;

          if (geo.alternateBounds != null) {
            dx = geo.width - geo.alternateBounds.width;
            dy = geo.height - geo.alternateBounds.height;
          } else {
            const s = graph.view.scale;
            dx = Math.round(geo.width - state.width / s);
            dy = Math.round(geo.height - state.height / s);
          }

          if (dy !== 0 || dx !== 0) {
            const parent = cell.getParent();
            const layout = getLayoutForParent(graph, parent);

            if (layout == null) {
              // Moves cells to the right and down after collapse/expand
              if (parent != null && evt != null && isMoveCellsEvent(evt as MouseEvent, state)) {
                moveSiblings(graph, state, parent, dx, dy);
              }
            } else if (evt == null || !eventUtils.isAltDown(evt as MouseEvent)) {
              resizeParentStacks(graph, parent, layout, dx, dy);
            }
          }
        }
      }
    } finally {
      model.endUpdate();
    }

    // Selects cells after folding
    if (graph.isEnabled()) {
      graph.setSelectionCells(target);
    }

    return result;
  };

  const selectionHandler = graph.getPlugin('SelectionHandler') as SelectionHandler | undefined;

  if (selectionHandler != null) {
    // Graph.js:31268 Hold Alt to ignore drop target
    const origHandlerIsValidDropTarget = selectionHandler.isValidDropTarget.bind(selectionHandler);
    selectionHandler.isValidDropTarget = function (target: Cell, me: InternalMouseEvent): boolean {
      return origHandlerIsValidDropTarget(target, me) && !eventUtils.isAltDown(me.getEvent());
    };

    // Graph.js:1571 Never removes cells from parents that are being moved
    const origShouldRemove = selectionHandler.shouldRemoveCellsFromParent.bind(selectionHandler);
    selectionHandler.shouldRemoveCellsFromParent = function (parent: Cell, cells: Cell[], evt: MouseEvent): boolean {
      if (graph.isCellSelected(parent) || isTransparentBounds(graph, parent)) {
        return false;
      }

      return origShouldRemove(parent, cells, evt);
    };
  }
}

/** Folds or unfolds a container like a click on its folding icon. Returns true if it is foldable. */
export function toggleFold(graph: Graph, cell: Cell, evt: MouseEvent | null = null): boolean {
  const collapse = !cell.isCollapsed();

  if (!graph.isCellFoldable(cell, collapse)) {
    return false;
  }

  graph.foldCells(collapse, false, [cell], false, evt);
  return true;
}
