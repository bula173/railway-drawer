/**
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Ported from jgraph/drawio v32.4.1 src/main/webapp/js/grapheditor/Shapes.js:5256
 * (PartialRectangleShape, registered at :5356).
 */

import { AbstractCanvas2D, EllipseShape, Rectangle, Shape, constants } from '@maxgraph/core';
import { isColor, isFlag } from './util';
import { paintTableCellLines } from './table-graph';

/**
 * PartialRectangleShape.prototype.paintVertexShape as a function, because the
 * table shape calls it with itself as `this` (Shapes.js:231) where drawHidden
 * is undefined.
 */
export function paintPartialRectangle(shape: Shape, c: AbstractCanvas2D, x: number, y: number, w: number,
  h: number, drawHidden: boolean): void {
  if (!shape.outline) {
    c.setStrokeColor(null);
  }

  if (shape.style != null) {
    const pointerEvents = c.pointerEvents;
    const filled = isColor(shape.fill);
    const events = isFlag(shape.style, 'pointerEvents', true);

    if (!events && !filled) {
      c.pointerEvents = false;
    }

    const top = isFlag(shape.style, 'top', true);
    const left = isFlag(shape.style, 'left', true);
    const right = isFlag(shape.style, 'right', true);
    const bottom = isFlag(shape.style, 'bottom', true);

    if (drawHidden || filled || shape.outline || top || right || bottom || left) {
      c.rect(x, y, w, h);
      c.fill();

      c.pointerEvents = pointerEvents;
      c.setStrokeColor(shape.stroke);
      c.setLineCap('square');
      c.begin();
      c.moveTo(x, y);

      if (shape.outline || top) {
        c.lineTo(x + w, y);
      } else {
        c.moveTo(x + w, y);
      }

      if (shape.outline || right) {
        c.lineTo(x + w, y + h);
      } else {
        c.moveTo(x + w, y + h);
      }

      if (shape.outline || bottom) {
        c.lineTo(x, y + h);
      } else {
        c.moveTo(x, y + h);
      }

      if (shape.outline || left) {
        c.lineTo(x, y);
      }

      c.end();
      c.stroke();
      c.setLineCap('flat');
    } else {
      c.setStrokeColor(shape.stroke);
    }
  }

  // Repaints the table grid lines hidden by the cell fill (see
  // Graph.paintTableCellLines). No-op unless this is a filled table cell.
  if (shape.state != null && !shape.outline && isColor(shape.fill)) {
    paintTableCellLines(shape.state.view.graph, c, shape.state.cell, x, y, w, h,
      shape.stroke as string, shape.strokeWidth);
  }
}

/**
 * draw.io `shape=partialRectangle`: a rectangle whose sides are hidden with
 * top=0, left=0, bottom=0 or right=0. Also the default cell shape of tables.
 */
export class PartialRectangleShape extends EllipseShape {
  drawHidden = true;

  constructor() {
    super(new Rectangle(), constants.NONE, '#000000');
  }

  override paintVertexShape(c: AbstractCanvas2D, x: number, y: number, w: number, h: number): void {
    paintPartialRectangle(this, c, x, y, w, h, this.drawHidden);
  }
}
