/**
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG
 * Licensed under the Apache License, Version 2.0 (see NOTICE).
 *
 * Ports of draw.io shapes/mxBasic.js, shapes/mxArrows.js and shapes/mxFlowchart.js
 * (jgraph/drawio v32.4.1) for @maxgraph/core 0.10.3.
 *
 * Shapes are registered under their exact draw.io names. Each shape class keeps
 * draw.io's `getConstraints(style, w, h)` / `constraints` (connection points),
 * `static customProperties` (Format panel metadata) and the library exports its
 * Graph.handleFactory entries as data (`*_HANDLE_FACTORIES`). maxGraph does not
 * consume these on its own; see the integration notes in the unit report.
 */

import type { CustomProperty, HandleFactory } from './compat.js';
import { MX_ARROWS2_CUSTOM_PROPERTIES, MX_ARROWS2_HANDLE_FACTORIES, registerMxArrows2Shapes } from './arrows2/index.js';
import { MX_BASIC_CUSTOM_PROPERTIES, MX_BASIC_HANDLE_FACTORIES, registerMxBasicShapes } from './basic/index.js';
import {
  MX_FLOWCHART_CUSTOM_PROPERTIES,
  MX_FLOWCHART_HANDLE_FACTORIES,
  registerMxFlowchartShapes,
} from './flowchart/index.js';

export * from './compat.js';
export * from './basic/index.js';
export * from './arrows2/index.js';
export * from './flowchart/index.js';

/** Registers all mx-libs shapes (basic, arrows2, flowchart). Idempotent; returns all names. */
export function registerMxLibShapes(): string[] {
  return [...registerMxBasicShapes(), ...registerMxArrows2Shapes(), ...registerMxFlowchartShapes()];
}

/** customProperties of every mx-libs shape keyed by draw.io shape name. */
export const MX_LIBS_CUSTOM_PROPERTIES: Readonly<Record<string, CustomProperty[]>> = {
  ...MX_BASIC_CUSTOM_PROPERTIES,
  ...MX_ARROWS2_CUSTOM_PROPERTIES,
  ...MX_FLOWCHART_CUSTOM_PROPERTIES,
};

/** Graph.handleFactory entries of every mx-libs shape keyed by draw.io shape name. */
export const MX_LIBS_HANDLE_FACTORIES: Readonly<Record<string, HandleFactory>> = {
  ...MX_BASIC_HANDLE_FACTORIES,
  ...MX_ARROWS2_HANDLE_FACTORIES,
  ...MX_FLOWCHART_HANDLE_FACTORIES,
};
