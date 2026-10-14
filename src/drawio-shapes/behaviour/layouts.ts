/**
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Ported from jgraph/drawio v32.4.1:
 *   src/main/webapp/mxgraph/src/layout/mxStackLayout.js (draw.io's version:
 *     resizeCell 247, getLayoutCells 308 with non-movable cells kept in place,
 *     execute 370 with getActualStartSize/getActualFooterSize, updateParentGeometry 631),
 *   src/main/webapp/js/grapheditor/Graph.js:
 *     11441 initLayoutManager (stackLayout, circleLayout, tableLayout),
 *     15540 updateAlternateBounds (stack children), 15738 resizeParentStacks,
 *     24560 isExtendParentsOnAdd, 31553 mxStackLayout.resizeCell (shrinking pools).
 *
 * draw.io v32 runs treeLayout, flowLayout and organicLayout through ELK
 * (Graph.getChildLayouts / createLayouts), which is not available here; those
 * values use the mxGraph layouts draw.io used before ELK (mxCompactTreeLayout,
 * mxHierarchicalLayout, mxFastOrganicLayout) with the same style keys.
 */

import {
  Cell,
  CircleLayout,
  CompactTreeLayout,
  FastOrganicLayout,
  Geometry,
  Graph,
  GraphLayout,
  HierarchicalLayout,
  InternalEvent,
  LayoutManager,
  Point,
  Rectangle,
  StackLayout,
} from '@maxgraph/core';
import { getNumber, getString, getValue, isFlag, toFlag } from '../js/shapes-edges/util';
import { getActualStartSize } from '../js/shapes-edges/table-graph';
import { TableLayout } from '../js/shapes-edges/table-layout';
import { getDrawioLayoutManager, installTableSupport } from '../js/shapes-edges/table-support';
import { cellStyle, getActualFooterSize, isTransparentBounds, markInstalled } from './common';

/**
 * draw.io's mxStackLayout (its mxgraph fork differs from maxGraph's StackLayout):
 * start sizes on any side of a swimlane (direction/flip), footers, non-movable
 * children kept in place and resizeCell for resizeLast stacks.
 */
export class DrawioStackLayout extends StackLayout {
  /** mxStackLayout.getLayoutCells (mxStackLayout.js:308): non-movable cells are kept in place in execute. */
  override getLayoutCells(parent: Cell): Cell[] {
    const cells: Cell[] = [];

    for (const child of parent.getChildren()) {
      if (!this.isVertexIgnored(child)) {
        cells.push(child);
      }
    }

    if (this.allowGaps) {
      cells.sort((c1, c2) => {
        const geo1 = c1.getGeometry() as Geometry;
        const geo2 = c2.getGeometry() as Geometry;

        // Same (odd) comparison as draw.io: (a > b > 0) compares a boolean with 0
        return this.horizontal
          ? (geo1.x === geo2.x ? 0 : (Number(geo1.x > geo2.x) > 0 ? 1 : -1))
          : (geo1.y === geo2.y ? 0 : (Number(geo1.y > geo2.y) > 0 ? 1 : -1));
      });
    }

    return cells;
  }

  /**
   * mxStackLayout.resizeCell (mxStackLayout.js:247): resizes the parent along the
   * stack axis if the last child of a resizeLast stack without resizeParent is resized,
   * plus Graph.js:31553: resizing a child resizes the stack parent in the other axis.
   */
  override resizeCell(cell: Cell, bounds: Rectangle, prev?: Cell): void {
    const previous = prev as unknown as Rectangle | undefined;
    const graph = this.graph;
    const model = graph.getDataModel();

    if (this.resizeLast && !this.resizeParent && cell != null && bounds != null && previous != null) {
      const parent = cell.getParent();
      const pgeo = parent?.getGeometry() ?? null;
      const cells = parent != null ? this.getLayoutCells(parent) : [];

      if (parent != null && pgeo != null && !pgeo.relative && cells.length > 0 &&
        cells[cells.length - 1] === cell && this.isVertexMovable(cell) && !parent.isCollapsed()) {
        // Uses the previous location in the stack with the new size
        const last = new Rectangle(previous.x, previous.y, bounds.width, bounds.height);
        const max = this.resizeParentMax;
        this.resizeParentMax = false;

        try {
          this.updateParentGeometry(parent, pgeo, last as unknown as Geometry);
        } finally {
          this.resizeParentMax = max;
        }
      }
    }

    // Graph.js:31553 Overridden to allow for shrinking pools when lanes are resized
    if (cellStyle(graph, cell).childLayout == null) {
      const parent = cell.getParent();
      let geo = parent != null ? parent.getGeometry() : null;

      // Ignores transparentBounds parents whose geometry is derived from the children
      if (parent != null && geo != null && !isTransparentBounds(graph, parent)) {
        const style = cellStyle(graph, parent);

        if (style.childLayout === 'stackLayout') {
          const border = getNumber(style, 'stackBorder', 0);
          const horizontal = isFlag(style, 'horizontalStack', true);
          const start = getActualStartSize(graph, parent, true);
          const footer = getActualFooterSize(graph, parent, true);
          const prevGeo = geo;
          geo = geo.clone();

          // Adds the margins and footer that execute subtracts when it fills the
          // children, otherwise the resized child shrinks in the next layout run
          if (horizontal) {
            geo.height = bounds.height + start.y + start.height + footer.y + footer.height + 2 * border +
              getNumber(style, 'marginTop', 0) + getNumber(style, 'marginBottom', 0);
          } else {
            geo.width = bounds.width + start.x + start.width + footer.x + footer.width + 2 * border +
              getNumber(style, 'marginLeft', 0) + getNumber(style, 'marginRight', 0);
          }

          if (geo.width !== prevGeo.width || geo.height !== prevGeo.height) {
            model.setGeometry(parent, geo);
          }
        }
      }
    }
  }

  /** mxStackLayout.execute (mxStackLayout.js:370). */
  override execute(parent: Cell): void {
    if (parent == null) {
      return;
    }

    const pgeo = this.getParentSize(parent) as Geometry | null;
    const horizontal = this.isHorizontal();
    const model = this.graph.getDataModel();
    let fillValue = 0;

    if (pgeo != null) {
      fillValue = horizontal ? pgeo.height - this.marginTop - this.marginBottom :
        pgeo.width - this.marginLeft - this.marginRight;
    }

    fillValue -= 2 * this.border;
    let x0 = this.x0 + this.border + this.marginLeft;
    let y0 = this.y0 + this.border + this.marginTop;

    // Handles swimlane start size, taking into account direction and horizontal
    // and vertical flip styles: the title may sit on any side of the swimlane
    const startSize = getActualStartSize(this.graph, parent, true);

    if (pgeo != null) {
      startSize.x = Math.min(startSize.x, pgeo.width);
      startSize.y = Math.min(startSize.y, pgeo.height);
      startSize.width = Math.min(startSize.width, pgeo.width);
      startSize.height = Math.min(startSize.height, pgeo.height);
    }

    // Handles the footer size, painted opposite the title for swimlanes and at
    // the bottom for other containers
    const footerSize = getActualFooterSize(this.graph, parent, true);

    if (horizontal) {
      fillValue -= startSize.y + startSize.height + footerSize.y + footerSize.height;
    } else {
      fillValue -= startSize.x + startSize.width + footerSize.x + footerSize.width;
    }

    x0 += startSize.x + footerSize.x;
    y0 += startSize.y + footerSize.y;

    model.beginUpdate();
    try {
      let tmp = 0;
      let last: Geometry | null = null;
      let lastValue = 0;
      let lastChild: Cell | null = null;
      let moved = false;
      const cells = this.getLayoutCells(parent);

      for (const child of cells) {
        let geo = child.getGeometry();

        if (geo != null && !this.isVertexMovable(child)) {
          // Keeps non-movable (eg. locked) cells in place and continues the
          // stack after them to avoid overlaps
          const sw = this.borderCollapse ? 0 : getNumber(cellStyle(this.graph, child), 'strokeWidth', 1);
          last = geo;
          lastChild = null;
          lastValue = (horizontal ? geo.x + geo.width : geo.y + geo.height) + Math.floor(sw / 2);
        } else if (geo != null) {
          geo = geo.clone();
          moved = true;

          if (this.wrap != null && last != null) {
            if ((horizontal && last.x + last.width + geo.width + 2 * this.spacing > this.wrap) ||
              (!horizontal && last.y + last.height + geo.height + 2 * this.spacing > this.wrap)) {
              last = null;

              if (horizontal) {
                y0 += tmp + this.spacing;
              } else {
                x0 += tmp + this.spacing;
              }

              tmp = 0;
            }
          }

          tmp = Math.max(tmp, horizontal ? geo.height : geo.width);
          const sw = this.borderCollapse ? 0 : getNumber(cellStyle(this.graph, child), 'strokeWidth', 1);

          if (last != null) {
            const temp = lastValue + this.spacing + Math.floor(sw / 2);

            if (horizontal) {
              geo.x = this.snap((this.allowGaps ? Math.max(temp, geo.x) : temp) - this.marginLeft) + this.marginLeft;
            } else {
              geo.y = this.snap((this.allowGaps ? Math.max(temp, geo.y) : temp) - this.marginTop) + this.marginTop;
            }
          } else if (!this.keepFirstLocation) {
            if (horizontal) {
              geo.x = (this.allowGaps && geo.x > x0) ? Math.max(this.snap(geo.x - this.marginLeft) + this.marginLeft, x0) : x0;
            } else {
              geo.y = (this.allowGaps && geo.y > y0) ? Math.max(this.snap(geo.y - this.marginTop) + this.marginTop, y0) : y0;
            }
          }

          if (horizontal) {
            geo.y = y0;
          } else {
            geo.x = x0;
          }

          if (this.fill && pgeo != null) {
            if (horizontal) {
              geo.height = fillValue;
            } else {
              geo.width = fillValue;
            }
          }

          if (horizontal) {
            geo.width = this.snap(geo.width);
          } else {
            geo.height = this.snap(geo.height);
          }

          this.setChildGeometry(child, geo);
          lastChild = child;
          last = geo;
          lastValue = horizontal ? last.x + last.width + Math.floor(sw / 2) : last.y + last.height + Math.floor(sw / 2);
        }
      }

      // Ignores stacks with non-movable cells only as before
      if (!moved) {
        last = null;
      }

      if (this.resizeParent && pgeo != null && last != null && !parent.isCollapsed()) {
        this.updateParentGeometry(parent, pgeo, last);
      } else if (this.resizeLast && pgeo != null && last != null && lastChild != null) {
        if (horizontal) {
          last.width = pgeo.width - last.x - this.spacing - this.marginRight - startSize.width - footerSize.width;
        } else {
          last.height = pgeo.height - last.y - this.spacing - this.marginBottom - startSize.height - footerSize.height;
        }

        this.setChildGeometry(lastChild, last);
      }
    } finally {
      model.endUpdate();
    }
  }

  /** mxStackLayout.updateParentGeometry (mxStackLayout.js:631). */
  override updateParentGeometry(parent: Cell, pgeo: Geometry, last: Geometry): void {
    const horizontal = this.isHorizontal();
    const model = this.graph.getDataModel();

    // Keeps the parent's title and footer regions clear of the last child when
    // they are on the stack axis
    const startSize = getActualStartSize(this.graph, parent, true);
    const footerSize = getActualFooterSize(this.graph, parent, true);
    const pgeo2 = pgeo.clone();

    if (horizontal) {
      const tmp = last.x + last.width + this.marginRight + this.border + startSize.width + footerSize.width;
      pgeo2.width = this.resizeParentMax ? Math.max(pgeo2.width, tmp) : tmp;
    } else {
      const tmp = last.y + last.height + this.marginBottom + this.border + startSize.height + footerSize.height;
      pgeo2.height = this.resizeParentMax ? Math.max(pgeo2.height, tmp) : tmp;
    }

    if (pgeo.x !== pgeo2.x || pgeo.y !== pgeo2.y || pgeo.width !== pgeo2.width || pgeo.height !== pgeo2.height) {
      model.setGeometry(parent, pgeo2);
    }
  }
}

/** The stack layout draw.io's layout manager creates for childLayout=stackLayout (Graph.js:11469). */
export function createDrawioStackLayout(graph: Graph, cell: Cell): DrawioStackLayout {
  const style = cellStyle(graph, cell);

  // transparentBounds parents derive their size from their children: no fill
  // or parent resize (Graph.js:11462)
  const transparentParent = isTransparentBounds(graph, cell);
  const stackLayout = new DrawioStackLayout(graph, true);
  stackLayout.resizeParentMax = !transparentParent && isFlag(style, 'resizeParentMax', true);
  stackLayout.horizontal = isFlag(style, 'horizontalStack', true);
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

/** The circle layout of Graph.js:11492 (anchored below the title, fits the parent). */
function createCircleLayout(graph: Graph, cell: Cell): CircleLayout {
  const style = cellStyle(graph, cell);
  const transparentParent = isTransparentBounds(graph, cell);
  const circleLayout = new CircleLayout(graph);
  const resizeParent = !transparentParent && isFlag(style, 'resizeParent', true);
  let startSize = getNumber(style, 'startSize', 40);
  startSize = Number.isFinite(startSize) ? startSize : 40;
  const sideTitle = !isFlag(style, 'horizontal', true);
  circleLayout.moveCircle = true;
  circleLayout.x0 = sideTitle ? startSize + 20 : 20;
  circleLayout.y0 = sideTitle ? 20 : startSize + 20;

  const circleExecute = circleLayout.execute.bind(circleLayout);
  circleLayout.execute = (parent: Cell): void => {
    const model = graph.getDataModel();

    // Top-left of the parent's current content (transparentBounds parents
    // carry the absolute position in their children)
    const contentMin = (): Point | null => {
      let min: Point | null = null;

      for (const child of parent.getChildren()) {
        const geo = child.isVertex() ? child.getGeometry() : null;

        if (geo != null && !geo.relative) {
          min = min == null ? new Point(geo.x, geo.y) : new Point(Math.min(min.x, geo.x), Math.min(min.y, geo.y));
        }
      }

      return min;
    };

    const pre = transparentParent ? contentMin() : null;
    circleExecute(parent);

    if (pre != null) {
      const post = contentMin();

      if (post != null && (pre.x !== post.x || pre.y !== post.y)) {
        for (const child of parent.getChildren()) {
          const geo = child.isVertex() ? child.getGeometry() : null;

          if (geo != null && !geo.relative) {
            graph.translateCell(child, pre.x - post.x, pre.y - post.y);
          }
        }
      }
    }

    let pgeo = parent.getGeometry();

    if (resizeParent && pgeo != null) {
      let w = 0;
      let h = 0;

      for (const child of parent.getChildren()) {
        const geo = child.getGeometry();

        if (geo != null && !geo.relative) {
          w = Math.max(w, geo.x + geo.width);
          h = Math.max(h, geo.y + geo.height);
        }
      }

      if (w > 0 && h > 0 && (pgeo.width !== w + 20 || pgeo.height !== h + 20)) {
        pgeo = pgeo.clone();
        pgeo.width = w + 20;
        pgeo.height = h + 20;
        model.setGeometry(parent, pgeo);
      }
    }
  };

  return circleLayout;
}

/** Pre-ELK draw.io treeLayout (mxCompactTreeLayout configured from the style). */
function createTreeLayout(graph: Graph, cell: Cell): CompactTreeLayout {
  const style = cellStyle(graph, cell);
  const treeLayout = new CompactTreeLayout(graph, isFlag(style, 'horizontalTree', true));
  treeLayout.resizeParent = isFlag(style, 'resizeParent', true);
  treeLayout.groupPadding = getNumber(style, 'parentPadding', 20);
  treeLayout.levelDistance = getNumber(style, 'treeLevelDistance', 30);
  treeLayout.maintainParentLocation = true;
  treeLayout.edgeRouting = false;
  treeLayout.resetEdges = false;
  return treeLayout;
}

/** Pre-ELK draw.io flowLayout (mxHierarchicalLayout configured from the style). */
function createFlowLayout(graph: Graph, cell: Cell): HierarchicalLayout {
  const style = cellStyle(graph, cell);
  const orientation = getString(style, 'flowOrientation', 'east');
  const flowLayout = new HierarchicalLayout(graph, orientation as ConstructorParameters<typeof HierarchicalLayout>[1]);
  flowLayout.resizeParent = isFlag(style, 'resizeParent', true);
  flowLayout.parentBorder = getNumber(style, 'parentPadding', 20);
  flowLayout.maintainParentLocation = true;
  flowLayout.intraCellSpacing = getNumber(style, 'intraCellSpacing', flowLayout.intraCellSpacing);
  flowLayout.interRankCellSpacing = getNumber(style, 'interRankCellSpacing', flowLayout.interRankCellSpacing);
  flowLayout.interHierarchySpacing = getNumber(style, 'interHierarchySpacing', flowLayout.interHierarchySpacing);
  flowLayout.parallelEdgeSpacing = getNumber(style, 'parallelEdgeSpacing', flowLayout.parallelEdgeSpacing);
  return flowLayout;
}

/**
 * The layout for the given container as draw.io's layoutManager.getLayout
 * (Graph.js:11450) returns it, or null.
 */
export function createLayoutForCell(graph: Graph, cell: Cell): GraphLayout | null {
  const childLayout = cellStyle(graph, cell).childLayout;

  if (childLayout === 'stackLayout') {
    return createDrawioStackLayout(graph, cell);
  } else if (childLayout === 'circleLayout') {
    return createCircleLayout(graph, cell);
  } else if (childLayout === 'tableLayout') {
    return new TableLayout(graph);
  } else if (childLayout === 'treeLayout') {
    return createTreeLayout(graph, cell);
  } else if (childLayout === 'flowLayout') {
    return createFlowLayout(graph, cell);
  } else if (childLayout === 'organicLayout') {
    return new FastOrganicLayout(graph);
  }

  return null;
}

/** The layout of the given parent (a stack layout or null), as Graph.layoutManager.getLayout(parent). */
export function getLayoutForParent(graph: Graph, parent: Cell | null): GraphLayout | null {
  const manager = getDrawioLayoutManager(graph);
  return manager != null && parent != null ? manager.getLayout(parent, InternalEvent.LAYOUT_CELLS) as GraphLayout | null : null;
}

/** True for draw.io's plain stack layouts (`layout.constructor == mxStackLayout`). */
export function isStackLayout(layout: GraphLayout | null): layout is DrawioStackLayout {
  return layout instanceof DrawioStackLayout;
}

/**
 * Graph.resizeParentStacks (Graph.js:15738): bubbles a size change up through all
 * parent stack layouts with the same orientation.
 */
export function resizeParentStacks(graph: Graph, parent: Cell | null, layout: GraphLayout | null, dx: number, dy: number): void {
  if (!isStackLayout(layout) || layout.resizeLast) {
    return;
  }

  const model = graph.getDataModel();
  model.beginUpdate();
  try {
    const dir = layout.horizontal;
    let current: GraphLayout | null = layout;

    // Bubble resize up for all parent stack layouts with same orientation
    while (parent != null && isStackLayout(current) && current.horizontal === dir && !current.resizeLast) {
      let pgeo = parent.getGeometry();
      const pstate = graph.view.getState(parent);

      if (pstate != null && pgeo != null) {
        pgeo = pgeo.clone();

        if (current.horizontal) {
          pgeo.width += dx + Math.min(0, pstate.width / graph.view.scale - pgeo.width);
        } else {
          pgeo.height += dy + Math.min(0, pstate.height / graph.view.scale - pgeo.height);
        }

        model.setGeometry(parent, pgeo);
      }

      parent = parent.getParent();
      current = getLayoutForParent(graph, parent);
    }
  } finally {
    model.endUpdate();
  }
}

/**
 * Installs draw.io's layout manager configuration on the graph: stackLayout as
 * draw.io's mxStackLayout, tableLayout, circleLayout and the pre-ELK tree, flow and
 * organic layouts; stack children keep no alternate width (height for horizontal
 * stacks) when collapsed and adding cells to a stack does not extend it.
 * Requires the table support (installed here if missing). Idempotent.
 */
export function installDrawioLayouts(graph: Graph): LayoutManager | null {
  installTableSupport(graph);
  const manager = getDrawioLayoutManager(graph);

  if (manager == null || !markInstalled(graph, 'layouts')) {
    return manager;
  }

  // Graph.js:11450: layouts run top to bottom except for nested layouts
  manager.getLayout = function (cell: Cell | null, eventName?: string): GraphLayout | null {
    if (cell == null) {
      return null;
    }

    const parent = cell.getParent();

    if (!cell.isCollapsed() && (eventName !== InternalEvent.BEGIN_UPDATE || manager.hasLayout(parent))) {
      return createLayoutForCell(graph, cell);
    }

    return null;
  } as typeof manager.getLayout;

  // Graph.js:15540 Disables alternate width persistence for stack layout parents
  const origUpdateAlternateBounds = graph.updateAlternateBounds.bind(graph);
  graph.updateAlternateBounds = function (cell: Cell | null = null, geo: Geometry | null = null, willCollapse = false): void {
    if (cell != null && geo != null && geo.alternateBounds != null) {
      const layout = getLayoutForParent(graph, cell.getParent());

      if (isStackLayout(layout)) {
        if (layout.horizontal) {
          geo.alternateBounds.height = 0;
        } else {
          geo.alternateBounds.width = 0;
        }
      }
    }

    origUpdateAlternateBounds(cell, geo, willCollapse);
  };

  // Graph.js:24560 Disables extending parents with stack layouts on add
  const origIsExtendParentsOnAdd = graph.isExtendParentsOnAdd.bind(graph);
  graph.isExtendParentsOnAdd = function (cell: Cell): boolean {
    let result = origIsExtendParentsOnAdd(cell);

    if (result && cell != null && isStackLayout(getLayoutForParent(graph, cell.getParent()))) {
      result = false;
    }

    return result;
  };

  return manager;
}

/** Graph.deleteLane (Graph.js:29443): removes the given lane, or the last lane of the given pool. */
export function deleteLane(graph: Graph, cell: Cell): void {
  const model = graph.getDataModel();
  model.beginUpdate();
  try {
    let lane = cell;
    const pool = cellStyle(graph, lane).childLayout === 'stackLayout' ? lane : lane.getParent();

    if (pool == null) {
      return;
    }

    const lanes = pool.getChildCells(true, false);

    if (lanes.length === 0) {
      model.remove(pool);
    } else {
      if (pool === lane) {
        lane = lanes[lanes.length - 1];
      }

      model.remove(lane);
    }
  } finally {
    model.endUpdate();
  }
}

/** Graph.insertLane (Graph.js:29488): inserts a copy of the given lane before or after it (or at the start/end of a pool). */
export function insertLane(graph: Graph, cell: Cell, before: boolean): void {
  const model = graph.getDataModel();
  model.beginUpdate();
  try {
    let lane: Cell | null = cell;
    let pool: Cell | null;

    if (cellStyle(graph, lane).childLayout === 'stackLayout') {
      pool = lane;
      const lanes = pool.getChildCells(true, false);
      lane = lanes[before ? 0 : lanes.length - 1] ?? null;
    } else {
      pool = lane.getParent();
    }

    if (pool == null || lane == null) {
      return;
    }

    const index = pool.getIndex(lane);
    const clone = lane.clone();
    clone.setValue('');
    model.add(pool, clone, index + (before ? 0 : 1));
  } finally {
    model.endUpdate();
  }
}
