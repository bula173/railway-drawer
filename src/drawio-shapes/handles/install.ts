/**
 * @file install.ts
 * @brief Installs draw.io's shape handles (yellow diamonds) on one maxGraph Graph.
 *
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG. Licensed under the Apache
 * License, Version 2.0. Ported from jgraph/drawio v32.4.1
 * src/main/webapp/js/grapheditor/Shapes.js:10300-10375 (mxVertexHandler/mxEdgeHandler
 * createCustomHandles) and mxClient.js mxVertexHandler.refresh (custom handles recreated).
 * Source: https://raw.githubusercontent.com/jgraph/drawio/v32.4.1/src/main/webapp/js/grapheditor/Shapes.js
 *
 * maxGraph creates handlers through graph.createVertexHandler / graph.createEdgeHandler. Both are
 * wrapped per graph: the created handler keeps its class (other extensions may subclass it) and
 * gets draw.io's handles appended after its own custom handles, which is the order draw.io uses
 * (Graph.js table handles first, then Shapes.js shape handles).
 *
 * Gaps fixed on the handler instance (maxGraph 0.10.3):
 * - VertexHandler has no refresh(); SelectionCellsHandler calls it when present, as mxGraph does,
 *   so custom handles follow style changes (rounded on/off, another shape).
 * - VertexHandler.reset() reads sizers[index] for a custom handle index (-100) and throws on
 *   Escape during a handle drag.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { installOnce } from '../../core/install-once.js';
import { CellRenderer, InternalEvent, StencilShapeRegistry } from '@maxgraph/core';
import type { CellState, EdgeHandler, Graph, VertexHandler } from '@maxgraph/core';
import { MX_LIBS_HANDLE_FACTORIES } from '../js/mx-libs/index.js';
import { isDrawioSwimlane } from '../js/shapes-edges/table-graph.js';
import { createHandleFn, type DrawioHandle } from './create-handle.js';
import { SHAPE_HANDLE_FACTORIES, type ShapeHandleFactory } from './shape-handles.js';

const AUGMENTED = 'drawio.handles.augmented';

/**
 * draw.io's Graph.handleFactory: Shapes.js entries, then the shape libraries (mxBasic.js,
 * mxArrows.js, mxFlowchart.js), which draw.io loads later and which therefore win.
 */
export const DRAWIO_HANDLE_FACTORIES: Readonly<Record<string, ShapeHandleFactory>> = (() => {
  const result: Record<string, ShapeHandleFactory> = { ...SHAPE_HANDLE_FACTORIES };

  for (const [name, factory] of Object.entries(MX_LIBS_HANDLE_FACTORIES)) {
    result[name] = (state: CellState) => factory(state, createHandleFn) as DrawioHandle[];
  }

  return result;
})();

/**
 * Adds a Graph.handleFactory entry of a lazily loaded (vendored) draw.io shape library. Entries
 * of the hand-ported libraries above are kept (they were registered first and are not replaced).
 */
export function registerDrawioHandleFactory(name: string, factory: (state: CellState) => unknown): void {
  const registry = DRAWIO_HANDLE_FACTORIES as Record<string, ShapeHandleFactory>;
  if (Object.prototype.hasOwnProperty.call(registry, name)) return;
  registry[name] = (state: CellState) => {
    const handles = factory(state);
    return (Array.isArray(handles) ? handles : null) as DrawioHandle[];
  };
}

function isKnownShape(name: unknown): boolean {
  if (typeof name !== 'string' || name === '') return false;
  return CellRenderer.defaultShapes[name] != null || StencilShapeRegistry.getStencil(name) != null;
}

/** Shapes.js:10306 mxVertexHandler.prototype.createCustomHandles (draw.io's part only). */
export function createDrawioVertexHandles(handler: VertexHandler): DrawioHandle[] | null {
  const state = handler.state;
  const graph = handler.graph;

  // Vertices without a geometry have no paint bounds to place the handles
  if (!graph.isCellRotatable(state.cell) || state.getPaintBounds() == null) {
    return null;
  }

  let name = state.style.shape as string | undefined;

  if (!isKnownShape(name)) {
    name = 'rectangle';
  } else if (isDrawioSwimlane(graph, state.cell)) {
    name = 'swimlane';
  }

  let fn = DRAWIO_HANDLE_FACTORIES[name!];

  if (fn == null && state.shape != null && (state.shape as any).isRoundable()) {
    fn = DRAWIO_HANDLE_FACTORIES['rectangle'];
  }

  return fn != null ? fn(state) : null;
}

/** Shapes.js:10356 mxEdgeHandler.prototype.createCustomHandles. */
export function createDrawioEdgeHandles(handler: EdgeHandler): DrawioHandle[] | null {
  const state = handler.state;
  let name = state.style.shape as string | undefined;

  if (!isKnownShape(name)) {
    name = 'connector';
  }

  const fn = DRAWIO_HANDLE_FACTORIES[name!];

  return fn != null ? fn(state) : null;
}

function concatHandles(base: unknown, extra: DrawioHandle[] | null): any[] {
  const list = Array.isArray(base) ? base : [];
  return extra != null && extra.length > 0 ? list.concat(extra) : list;
}

/** Adds draw.io's handles to a vertex handler that was just constructed. */
export function augmentVertexHandler(handler: VertexHandler): VertexHandler {
  const h = handler as VertexHandler & Record<string | symbol, any>;
  if (!installOnce(h, AUGMENTED)) return handler;

  const baseCreate = h.createCustomHandles.bind(h);
  h.createCustomHandles = (() =>
    concatHandles(baseCreate(), createDrawioVertexHandles(h))) as unknown as VertexHandler['createCustomHandles'];

  // The constructor already called createCustomHandles (without draw.io's handles)
  const extra = createDrawioVertexHandles(h);

  if (extra != null && extra.length > 0) {
    h.customHandles = concatHandles(h.customHandles, extra);
    h.redrawHandles();
  }

  // mxVertexHandler.refresh: recreates the custom handles for the current style
  const baseRefresh = typeof h.refresh === 'function' ? h.refresh : null;
  h.refresh = function (this: typeof h) {
    if (baseRefresh) baseRefresh.apply(this);

    if (this.customHandles != null) {
      for (const handle of this.customHandles) handle.destroy();
    }

    this.customHandles = this.createCustomHandles() as typeof this.customHandles;
    this.redrawHandles();
  };

  // reset() during a custom handle gesture (Escape) must not index sizers with -100
  const baseReset = h.reset.bind(h);
  h.reset = () => {
    if (h.index != null && h.index <= InternalEvent.CUSTOM_HANDLE) {
      h.index = null;
    }
    baseReset();
  };

  return handler;
}

/** Adds draw.io's handles to an edge handler that was just constructed. */
export function augmentEdgeHandler(handler: EdgeHandler): EdgeHandler {
  const h = handler as EdgeHandler & Record<string | symbol, any>;
  if (!installOnce(h, AUGMENTED)) return handler;

  // EdgeHandler.refresh() already recreates custom handles through createCustomHandles
  const baseCreate = h.createCustomHandles.bind(h);
  h.createCustomHandles = (() =>
    concatHandles(baseCreate(), createDrawioEdgeHandles(h))) as unknown as EdgeHandler['createCustomHandles'];

  const extra = createDrawioEdgeHandles(h);

  if (extra != null && extra.length > 0) {
    h.customHandles = concatHandles(h.customHandles, extra);
    h.redraw();
  }

  return handler;
}

/**
 * Installs draw.io's custom handles on `graph` (idempotent). Dragging a yellow handle updates
 * the style live; on mouse up the changed keys are written with graph.setCellStyles in one
 * model transaction, so a single undo step restores them.
 */
export function installDrawioHandles(graph: Graph): void {
  if (!installOnce(graph, 'drawio.handles')) return;

  const baseVertex = graph.createVertexHandler.bind(graph);
  graph.createVertexHandler = (state: CellState) => augmentVertexHandler(baseVertex(state));

  const baseEdge = graph.createEdgeHandler.bind(graph);
  graph.createEdgeHandler = (state: CellState, edgeStyle: any) => augmentEdgeHandler(baseEdge(state, edgeStyle));
}
