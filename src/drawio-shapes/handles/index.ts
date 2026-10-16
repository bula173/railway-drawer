/**
 * @file index.ts
 * @brief draw.io shape handles (Graph.createHandle / Graph.handleFactory) for maxGraph.
 *
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG. Licensed under the Apache
 * License, Version 2.0. Ported from jgraph/drawio v32.4.1 (see the individual files).
 *
 * Usage: `installDrawioHandles(graph)` once per Graph (tab graphs; not needed for hidden
 * thumbnail graphs, which never select cells).
 */

export {
  CUSTOM_HANDLE_INDEX,
  DrawioHandle,
  SECONDARY_HANDLE_IMAGE,
  createHandle,
  createHandleFn,
  createSvgImage,
  type AnyHandle,
} from './create-handle.js';
export { SHAPE_HANDLE_FACTORIES, createArcHandle, type ShapeHandleFactory } from './shape-handles.js';
export {
  DRAWIO_HANDLE_FACTORIES,
  augmentEdgeHandler,
  augmentVertexHandler,
  createDrawioEdgeHandles,
  createDrawioVertexHandles,
  installDrawioHandles,
} from './install.js';
