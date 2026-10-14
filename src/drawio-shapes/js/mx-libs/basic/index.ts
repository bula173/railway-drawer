/**
 * Copyright (c) 2006-2018, JGraph Holdings Ltd
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG
 * Licensed under the Apache License, Version 2.0 (see NOTICE).
 *
 * Ported from jgraph/drawio v32.4.1 shapes/mxBasic.js
 * Source: https://raw.githubusercontent.com/jgraph/drawio/v32.4.1/src/main/webapp/shapes/mxBasic.js
 */

import { CellRenderer } from '@maxgraph/core';
import { asShapeClass, type HandleFactory } from '../compat.js';
import { MX_BASIC_SHAPES } from './shapes.js';
import { MX_BASIC_HANDLE_FACTORIES as GENERATED_HANDLES } from './handles.js';
import { createPolygonHandles } from './polygon-handles.js';

export * from './shapes.js';
export { createPolygonHandles } from './polygon-handles.js';

/** draw.io Graph.handleFactory entries for mxgraph.basic.* (Graph.createHandle injected by the caller). */
export const MX_BASIC_HANDLE_FACTORIES: Readonly<Record<string, HandleFactory>> = {
  ...GENERATED_HANDLES,
  'mxgraph.basic.polygon': createPolygonHandles,
};

/**
 * Registers every JS shape of draw.io shapes/mxBasic.js under its exact
 * draw.io name (e.g. 'mxgraph.basic.4_point_star_2', 'mxgraph.basic.cross2').
 * Idempotent; returns the registered names.
 */
export function registerMxBasicShapes(): string[] {
  for (const [name, ctor] of MX_BASIC_SHAPES) CellRenderer.registerShape(name, asShapeClass(ctor));
  return MX_BASIC_SHAPES.map(([name]) => name);
}
