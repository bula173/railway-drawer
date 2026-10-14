/**
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Ported from jgraph/drawio v32.4.1 src/main/webapp/js/grapheditor/Shapes.js
 * (edge and markup shapes, table shapes, isometricEdgeStyle) and
 * src/main/webapp/js/grapheditor/Graph.js (table and stack layouts).
 *
 * Public entry points of the shapes-edges unit:
 *   registerShapesEdgeShapes()  -> CellRenderer.registerShape for the shapes
 *   registerShapesEdgeStyles()  -> StyleRegistry/EdgeStyle 'isometricEdgeStyle'
 *   installTableSupport(graph)  -> per-graph table/stack layouts, collapsed
 *                                  table rendering and curvedText hooks
 */

import { CellRenderer, EdgeStyle, Shape, StyleRegistry } from '@maxgraph/core';
import { FlexArrowShape, LinkShape } from './link-shapes';
import { FilledEdgeShape } from './filled-edge';
import { TaperedArrowShape } from './tapered-arrow';
import { ZigzagShape } from './zigzag';
import { MermaidSankeyLinkShape } from './mermaid-sankey-link';
import { CurvedTextShape } from './curved-text';
import { PartialRectangleShape } from './partial-rectangle';
import { TableRowShape, TableShape } from './table-shape';
import { IsometricConnector } from './isometric-edge-style';

export { FlexArrowShape, LinkShape } from './link-shapes';
export { FilledEdgeShape } from './filled-edge';
export { TaperedArrowShape } from './tapered-arrow';
export { ZigzagShape } from './zigzag';
export { MermaidSankeyLinkShape } from './mermaid-sankey-link';
export { CurvedTextShape, installCurvedTextSupport } from './curved-text';
export { PartialRectangleShape, paintPartialRectangle } from './partial-rectangle';
export { DrawioSwimlaneShape } from './swimlane-base';
export { TableRowShape, TableShape } from './table-shape';
export { IsometricConnector } from './isometric-edge-style';
export { TableLayout, createStackLayout, setTableColumnWidth, setTableRowHeight } from './table-layout';
export { getDrawioLayoutManager, installTableSupport } from './table-support';
export {
  getActualStartSize,
  getTableLines,
  isCollapsedTable,
  isStack,
  isTable,
  isTableCell,
  isTableRow,
  visitTableCells,
} from './table-graph';
export { DRAWIO_TAG, getCurvePoints } from './util';

/** draw.io shape name -> constructor, in Shapes.js order. */
export const SHAPES_EDGES: ReadonlyArray<readonly [string, typeof Shape]> = [
  ['table', TableShape as unknown as typeof Shape],
  ['tableRow', TableRowShape as unknown as typeof Shape],
  ['link', LinkShape as unknown as typeof Shape],
  ['flexArrow', FlexArrowShape as unknown as typeof Shape],
  ['partialRectangle', PartialRectangleShape as unknown as typeof Shape],
  ['filledEdge', FilledEdgeShape as unknown as typeof Shape],
  ['taperedArrow', TaperedArrowShape as unknown as typeof Shape],
  ['zigzag', ZigzagShape as unknown as typeof Shape],
  ['curvedText', CurvedTextShape as unknown as typeof Shape],
  ['mermaidSankeyLink', MermaidSankeyLinkShape as unknown as typeof Shape],
];

/**
 * Handle/property metadata of the ported shapes for a later properties panel
 * (subset of draw.io's Format panel custom properties for these shapes).
 */
export const customProperties: Record<string, ReadonlyArray<{ name: string; dispName: string; type: string; defVal: unknown; min?: number; max?: number }>> = {
  flexArrow: [
    { name: 'width', dispName: 'Width', type: 'float', defVal: 10, min: 0 },
    { name: 'startWidth', dispName: 'Start Width', type: 'float', defVal: 20, min: 0 },
    { name: 'endWidth', dispName: 'End Width', type: 'float', defVal: 20, min: 0 },
  ],
  link: [{ name: 'width', dispName: 'Width', type: 'float', defVal: 4, min: 0 }],
  taperedArrow: [
    { name: 'startWidth', dispName: 'Start Width', type: 'float', defVal: 12, min: 0 },
    { name: 'endWidth', dispName: 'End Width', type: 'float', defVal: 2, min: 0 },
  ],
  zigzag: [{ name: 'size', dispName: 'Size', type: 'float', defVal: 10, min: 5 }],
  mermaidSankeyLink: [{ name: 'width', dispName: 'Width', type: 'float', defVal: 10, min: 1 }],
  curvedText: [
    { name: 'arcStartY', dispName: 'Arc Start Y', type: 'float', defVal: 25 },
    { name: 'arcMidY', dispName: 'Arc Mid Y', type: 'float', defVal: -25 },
    { name: 'arcEndY', dispName: 'Arc End Y', type: 'float', defVal: 25 },
    { name: 'curveType', dispName: 'Curve Type', type: 'enum', defVal: 'round' },
  ],
  partialRectangle: [
    { name: 'top', dispName: 'Top Line', type: 'bool', defVal: true },
    { name: 'bottom', dispName: 'Bottom Line', type: 'bool', defVal: true },
    { name: 'left', dispName: 'Left Line', type: 'bool', defVal: true },
    { name: 'right', dispName: 'Right Line', type: 'bool', defVal: true },
  ],
  table: [
    { name: 'rowLines', dispName: 'Row Lines', type: 'bool', defVal: true },
    { name: 'columnLines', dispName: 'Column Lines', type: 'bool', defVal: true },
    { name: 'fixedRows', dispName: 'Fixed Rows', type: 'bool', defVal: false },
    { name: 'resizeLast', dispName: 'Resize Last Column', type: 'bool', defVal: false },
    { name: 'resizeLastRow', dispName: 'Resize Last Row', type: 'bool', defVal: false },
  ],
};

/**
 * Registers the ported Shapes.js edge/markup/table shapes under their draw.io
 * names and returns the names. Idempotent.
 */
export function registerShapesEdgeShapes(): string[] {
  const names: string[] = [];

  for (const [name, ctor] of SHAPES_EDGES) {
    if (CellRenderer.defaultShapes[name] !== ctor) {
      CellRenderer.registerShape(name, ctor);
    }

    names.push(name);
  }

  return names;
}

/** Registers draw.io's isometricEdgeStyle (Shapes.js:10580). Idempotent. */
export function registerShapesEdgeStyles(): string[] {
  StyleRegistry.putValue('isometricEdgeStyle', IsometricConnector);
  const edgeStyles = EdgeStyle as unknown as Record<string, unknown>;
  edgeStyles.isometricEdgeStyle = IsometricConnector;
  edgeStyles.IsometricConnector = IsometricConnector;

  return ['isometricEdgeStyle'];
}
