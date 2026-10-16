/**
 * Copyright (c) 2006-2018, JGraph Holdings Ltd
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG
 * Licensed under the Apache License, Version 2.0 (see NOTICE).
 *
 * Ported from jgraph/drawio v32.4.1 shapes/mxFlowchart.js
 * Source: https://raw.githubusercontent.com/jgraph/drawio/v32.4.1/src/main/webapp/shapes/mxFlowchart.js
 */

import { CellRenderer } from '@maxgraph/core';
import { asShapeClass } from '../compat.js';
import { MX_FLOWCHART_SHAPES } from './shapes.js';

export * from './shapes.js';
export { MX_FLOWCHART_HANDLE_FACTORIES } from './handles.js';

/**
 * Registers the JS shape of draw.io shapes/mxFlowchart.js
 * ('mxgraph.flowchart.document2'). Idempotent; returns the registered names.
 */
export function registerMxFlowchartShapes(): string[] {
  for (const [name, ctor] of MX_FLOWCHART_SHAPES) CellRenderer.registerShape(name, asShapeClass(ctor));
  return MX_FLOWCHART_SHAPES.map(([name]) => name);
}
