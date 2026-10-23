/**
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Ported from jgraph/drawio v32.4.1 src/main/webapp/js/grapheditor/Graph.js:
 *   11441 initLayoutManager (stackLayout, tableLayout), 20539-20752 collapsed
 *   table rendering hooks (postConfigureShape, resolveColor,
 *   checkPlaceholderStyles, redrawShape, collapsed table repaints) and
 *   23028 isSwimlane (table and tableRow are swimlanes).
 *
 * Everything is installed on the given graph instance (its cellRenderer and
 * view), never on maxGraph prototypes, so other graphs are not affected.
 */

import { installOnce } from '../../../core/install-once';
import { Cell, CellState, Graph, InternalEvent, LayoutManager, Shape, StackLayout, constants } from '@maxgraph/core';
import { TableLayout, createStackLayout } from './table-layout';
import { CollapsedTableStyle, getCollapsedTableForCell, isCollapsedTableChildShape } from './table-graph';
import { installCurvedTextSupport } from './curved-text';

type ShapeExt = Shape & { collapsedTableStyle?: CollapsedTableStyle | null; laneFill?: string | null };

type GraphExt = Graph & { drawioLayoutManager?: LayoutManager };

/** Returns the layout manager installed by installTableSupport, if any. */
export function getDrawioLayoutManager(graph: Graph): LayoutManager | null {
  return (graph as GraphExt).drawioLayoutManager ?? null;
}

function installSwimlanes(graph: Graph): void {
  const orig = graph.isSwimlane.bind(graph);

  // Graph.isSwimlane (Graph.js:23028)
  graph.isSwimlane = function (cell: Cell, ignoreState = false): boolean {
    if (cell != null && !cell.isEdge() && cell.getParent() !== graph.getDataModel().getRoot()) {
      const shape = (graph.getCurrentCellStyle(cell, ignoreState) as Record<string, unknown>).shape;

      if (shape === 'table' || shape === 'tableRow') {
        return true;
      }
    }

    return orig(cell, ignoreState);
  };
}

function installLayoutManager(graph: Graph): LayoutManager {
  const manager = new LayoutManager(graph);
  const model = graph.getDataModel();

  manager.hasLayout = function (cell: Cell | null): boolean {
    return cell != null && (graph.getCellStyle(cell) as Record<string, unknown>).childLayout != null;
  };

  manager.getLayout = function (cell: Cell | null, eventName: string): StackLayout | null {
    if (cell == null) {
      return null;
    }

    const parent = cell.getParent();

    // Executes layouts from top to bottom except for nested layouts where
    // child layouts are executed before and after the parent layout runs
    if (!cell.isCollapsed() && (eventName !== InternalEvent.BEGIN_UPDATE || manager.hasLayout(parent))) {
      const style = graph.getCellStyle(cell) as Record<string, unknown>;

      if (style.childLayout === 'stackLayout') {
        return createStackLayout(graph, cell);
      } else if (style.childLayout === 'tableLayout') {
        return new TableLayout(graph);
      }
    }

    return null;
  };

  // A change on a cell that is not (or no longer) in the model must not run its layout
  const origExecute = manager.executeLayout.bind(manager);
  manager.executeLayout = function (cell: Cell, bubble?: boolean): void {
    if (model.contains(cell)) {
      origExecute(cell, bubble);
    }
  };

  return manager;
}

function installCollapsedTables(graph: Graph): void {
  const renderer = graph.cellRenderer;
  const view = graph.view as typeof graph.view & { collapsedTableRepaints?: Set<Cell> | null };

  // Keeps the resolved fill and stroke of rows and cells painted by their
  // collapsed table and clears them on the shape (Graph.js:20546)
  const origPostConfigure = renderer.postConfigureShape.bind(renderer);
  renderer.postConfigureShape = function (state: CellState): void {
    origPostConfigure(state);

    if (state.shape != null) {
      const shape = state.shape as ShapeExt;
      shape.collapsedTableStyle = null;

      if (isCollapsedTableChildShape(graph, state)) {
        shape.collapsedTableStyle = {
          fill: shape.fill as string,
          gradient: shape.gradient as string,
          laneFill: shape.laneFill ?? null,
          stroke: shape.stroke as string,
        };
        shape.fill = constants.NONE;
        shape.gradient = constants.NONE;
        shape.stroke = constants.NONE;
        shape.isShadow = false;
        shape.glass = false;

        if (shape.laneFill != null) {
          shape.laneFill = constants.NONE;
        }
      }
    }
  };

  // Resolves inherit from the colors a row or cell had before they were
  // cleared (Graph.js:20580)
  const origResolve = renderer.resolveColor.bind(renderer);
  renderer.resolveColor = function (state: CellState, field: string, key: string): void {
    const shape = (key === 'fontColor' ? state.text : state.shape) as unknown as Record<string, unknown> | null;
    const value = shape != null ? shape[field] : null;
    origResolve(state, field, key);

    if (shape != null && key !== 'fontColor' &&
      (value === 'inherit' || value === 'parentFillColor' || value === 'parentStrokeColor')) {
      const parent = state.cell.getParent();
      const pstate = parent != null ? state.view.getState(parent) : null;
      const saved = pstate != null && pstate.shape != null ? (pstate.shape as ShapeExt).collapsedTableStyle : null;
      const rfield = value === 'parentFillColor' ? 'fill' : value === 'parentStrokeColor' ? 'stroke' : field;

      if (saved != null && (rfield === 'fill' || rfield === 'gradient' || rfield === 'stroke')) {
        shape[field] = saved[rfield as 'fill' | 'gradient' | 'stroke'];
      }
    }
  };

  // Reconfigures a row or cell added to or removed from a collapsed table
  const origCheck = renderer.checkPlaceholderStyles.bind(renderer);
  renderer.checkPlaceholderStyles = function (state: CellState): boolean {
    return origCheck(state) || (state.shape != null &&
      ((state.shape as ShapeExt).collapsedTableStyle != null) !== isCollapsedTableChildShape(graph, state));
  };

  // Schedules a repaint of the collapsed table if one of its rows or cells
  // was repainted (Graph.js:20641)
  const origRedrawShape = renderer.redrawShape.bind(renderer);
  renderer.redrawShape = function (state: CellState, force?: boolean, rendering?: boolean): boolean {
    const shapeChanged = origRedrawShape(state, force, rendering);

    if (shapeChanged && state.shape != null) {
      const table = getCollapsedTableForCell(graph, state.cell);

      if (table != null) {
        if (view.collapsedTableRepaints == null) {
          view.collapsedTableRepaints = new Set();
        }

        view.collapsedTableRepaints.add(table);
      }
    }

    return shapeChanged;
  };

  const flush = (table: Cell | null): void => {
    const pending = view.collapsedTableRepaints;

    if (pending == null) {
      return;
    }

    let tables: Cell[] | null = null;

    if (table != null) {
      if (pending.has(table)) {
        pending.delete(table);
        tables = [table];
      }
    } else {
      tables = Array.from(pending);
      view.collapsedTableRepaints = null;
    }

    if (tables != null) {
      for (const t of tables) {
        const state = view.getState(t);

        if (state != null && !state.invalid && state.shape != null) {
          renderer.redraw(state, true, view.isRendering());
        }
      }
    }
  };

  // Repaints scheduled collapsed tables after their rows and cells were
  // validated and all remaining tables at the end of the validation
  const origValidateCellState = view.validateCellState.bind(view);
  view.validateCellState = function (cell: Cell | null, recurse = true): CellState | null {
    const state = origValidateCellState(cell, recurse);

    if (view.collapsedTableRepaints != null && cell != null && recurse) {
      if (cell === view.currentRoot || cell.getParent() == null) {
        flush(null);
      } else {
        flush(cell);
      }
    }

    return state;
  };

  const origValidate = view.validate.bind(view);
  view.validate = function (cell?: Cell | null): void {
    origValidate(cell);
    flush(null);
  };
}

/**
 * Installs draw.io's table machinery on the given graph: table/tableRow are
 * swimlanes (start sizes), a layout manager runs childLayout=tableLayout
 * (TableLayout) and childLayout=stackLayout (maxGraph StackLayout configured
 * like draw.io) on model changes, collapsed tables (tableRender=collapsed)
 * paint the fills and borders of their rows and cells, and curvedText labels
 * repaint on value changes. Idempotent.
 */
export function installTableSupport(graph: Graph): void {
  const g = graph as GraphExt;

  if (!installOnce(graph, 'drawio.table-support')) {
    return;
  }

  installSwimlanes(graph);
  g.drawioLayoutManager = installLayoutManager(graph);
  installCollapsedTables(graph);
  installCurvedTextSupport(graph);
}
