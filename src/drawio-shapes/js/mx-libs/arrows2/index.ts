/**
 * Copyright (c) 2006-2016, JGraph Holdings Ltd
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG
 * Licensed under the Apache License, Version 2.0 (see NOTICE).
 *
 * Ported from jgraph/drawio v32.4.1 shapes/mxArrows.js
 * Source: https://raw.githubusercontent.com/jgraph/drawio/v32.4.1/src/main/webapp/shapes/mxArrows.js
 */

import { CellRenderer } from '@maxgraph/core';
import { asShapeClass } from '../compat.js';
import { MX_ARROWS2_SHAPES } from './shapes.js';

export * from './shapes.js';
export { MX_ARROWS2_HANDLE_FACTORIES } from './handles.js';

/** Edge shapes in mxArrows.js (paintEdgeShape; insert as edges). */
export const MX_ARROWS2_EDGE_SHAPES: readonly string[] = [
  'mxgraph.arrows2.wedgeArrow',
  'mxgraph.arrows2.wedgeArrowDashed',
  'mxgraph.arrows2.wedgeArrowDashed2',
];

/**
 * Registers every JS shape of draw.io shapes/mxArrows.js under its exact
 * draw.io name (18 vertex shapes 'mxgraph.arrows2.*' plus the wedgeArrow edge
 * shapes). Idempotent; returns the registered names.
 */
export function registerMxArrows2Shapes(): string[] {
  for (const [name, ctor] of MX_ARROWS2_SHAPES) CellRenderer.registerShape(name, asShapeClass(ctor));
  return MX_ARROWS2_SHAPES.map(([name]) => name);
}
