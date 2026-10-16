/**
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Ported from jgraph/drawio v32.4.1 src/main/webapp/js/grapheditor/Shapes.js:10479
 * (isometric base vectors and mxEdgeStyle.IsometricConnector, registered as
 * 'isometricEdgeStyle' at :10580).
 */

import { CellState, Point, mathUtils } from '@maxgraph/core';
import { getValue } from './util';

const alpha1 = mathUtils.toRadians(-30);
const isoHVector = mathUtils.getRotatedPoint(new Point(1, 0), Math.cos(alpha1), Math.sin(alpha1));

const alpha2 = mathUtils.toRadians(-150);
const isoVVector = mathUtils.getRotatedPoint(new Point(1, 0), Math.cos(alpha2), Math.sin(alpha2));

/**
 * Routes an edge along the isometric axes (30° and 150°) through the first
 * control point, or the center between the terminals. `elbow=vertical`
 * starts with the vertical axis.
 */
export function IsometricConnector(state: CellState, source: CellState | null, target: CellState | null,
  points: Point[] | null, result: Point[]): void {
  const view = state.view;
  let pt: Point | null = points != null && points.length > 0 ? points[0] : null;
  const pts = state.absolutePoints ?? [];
  let p0: Point | null = pts.length > 0 ? pts[0] : null;
  let pe: Point | null = pts.length > 0 ? pts[pts.length - 1] : null;

  if (pt != null) {
    pt = view.transformControlPoint(state, pt);
  }

  if (p0 == null && source != null) {
    p0 = new Point(source.getCenterX(), source.getCenterY());
  }

  if (pe == null && target != null) {
    pe = new Point(target.getCenterX(), target.getCenterY());
  }

  const a1 = isoHVector.x;
  const a2 = isoHVector.y;

  const b1 = isoVVector.x;
  const b2 = isoVVector.y;

  const elbow = getValue(state.style, 'elbow', 'horizontal') === 'horizontal';

  if (pe != null && p0 != null) {
    let last = p0;

    const isoLineTo = (x: number, y: number, ignoreFirst: boolean): void => {
      const c1 = x - last.x;
      const c2 = y - last.y;

      // Solves for isometric base vectors
      const h = (b2 * c1 - b1 * c2) / (a1 * b2 - a2 * b1);
      const v = (a2 * c1 - a1 * c2) / (a2 * b1 - a1 * b2);

      if (elbow) {
        if (ignoreFirst) {
          last = new Point(last.x + a1 * h, last.y + a2 * h);
          result.push(last);
        }

        last = new Point(last.x + b1 * v, last.y + b2 * v);
        result.push(last);
      } else {
        if (ignoreFirst) {
          last = new Point(last.x + b1 * v, last.y + b2 * v);
          result.push(last);
        }

        last = new Point(last.x + a1 * h, last.y + a2 * h);
        result.push(last);
      }
    };

    if (pt == null) {
      pt = new Point(p0.x + (pe.x - p0.x) / 2, p0.y + (pe.y - p0.y) / 2);
    }

    isoLineTo(pt.x, pt.y, true);
    isoLineTo(pe.x, pe.y, false);
  }
}
