/**
 * Copyright (c) 2006-2018, JGraph Holdings Ltd
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG
 * Licensed under the Apache License, Version 2.0 (see NOTICE).
 *
 * Ported from jgraph/drawio v32.4.1 shapes/mxFlowchart.js
 * Source: https://raw.githubusercontent.com/jgraph/drawio/v32.4.1/src/main/webapp/shapes/mxFlowchart.js
 *
 * Mechanical port to @maxgraph/core 0.10.3: mxActor -> ActorShape, mxArrow -> ArrowShape,
 * mxUtils.getValue -> getValue (same semantics), mxPoint/mxRectangle/mxConnectionConstraint ->
 * Point/Rectangle/ConnectionConstraint, this.strokewidth -> this.strokeWidth. Drawing code is unchanged.
 */

import { ActorShape, ConnectionConstraint, Point } from '@maxgraph/core';
import { getValue, type CustomProperty, type DrawioCanvas, type ShapeCtor } from '../compat.js';

/** draw.io shapes/mxFlowchart.js:10 (mxgraph.flowchart.document2) */
export class mxShapeFlowchartDocument2 extends ActorShape {
  static readonly cst = {DOCUMENT2 : 'mxgraph.flowchart.document2'} as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'size', dispName: 'Wave Size', type: 'float', min:0, max:1, defVal:0.25},
  ];
  constraints: ConnectionConstraint[] | null = [new ConnectionConstraint(new Point(0.25, 0), false),
      new ConnectionConstraint(new Point(0.5, 0), false),
      new ConnectionConstraint(new Point(0.75, 0), false),
    new ConnectionConstraint(new Point(0, 0.25), false),
    new ConnectionConstraint(new Point(0, 0.5), false),
    new ConnectionConstraint(new Point(0, 0.75), false),
    new ConnectionConstraint(new Point(1, 0.25), false),
    new ConnectionConstraint(new Point(1, 0.5), false),
    new ConnectionConstraint(new Point(1, 0.75), false)];
  size = 0.5;

  /** draw.io shapes/mxFlowchart.js:36 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const dy = h * Math.max(0, Math.min(1, parseFloat(getValue(this.style, 'size', this.size))));
    const fy = 1.4;
    const r = 5;

    c.begin();
    c.moveTo(w - r, 0);
    c.arcTo(r, r, 0, 0, 1, w, r);
    c.lineTo(w, h - dy / 2);
    c.quadTo(w * 3 / 4, h - dy * fy, w / 2, h - dy / 2);
    c.quadTo(w / 4, h - dy * (1 - fy), 0, h - dy / 2);
    c.lineTo(0, dy / 2);
    c.lineTo(0, r);
    c.arcTo(r, r, 0, 0, 1, r, 0);
    c.close();
    c.fillAndStroke();
  }
}

/** Registered draw.io shape names (exact upstream names) -> constructors, in upstream order. */
export const MX_FLOWCHART_SHAPES: ReadonlyArray<readonly [string, ShapeCtor]> = [
  ['mxgraph.flowchart.document2', mxShapeFlowchartDocument2], // shapes/mxFlowchart.js:58
];

/** draw.io customProperties keyed by shape name (plain data for a properties panel). */
export const MX_FLOWCHART_CUSTOM_PROPERTIES: Readonly<Record<string, CustomProperty[]>> = {
  'mxgraph.flowchart.document2': mxShapeFlowchartDocument2.customProperties,
};
