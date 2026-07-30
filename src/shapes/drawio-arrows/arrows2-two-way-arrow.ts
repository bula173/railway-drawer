/**
 * Draw.io Arrows2 Two Way Arrow shape
 * Adapted from mxArrows.js
 */

import { Shape } from '@maxgraph/core';

export class Arrows2TwoWayArrowShape extends Shape {
  constructor() {
    super();
  }

  dy = 0.5;
  dx = 0.5;

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    c.translate(x, y);

    	let dy = h * 0.5 * Math.max(0, Math.min(1, this.dy));
    	let dx = Math.max(0, Math.min(w, this.dx));

    	c.begin();
    	c.moveTo(dx, dy);
    	c.lineTo(w - dx, dy);
    	c.lineTo(w - dx, 0);
    	c.lineTo(w, h * 0.5);
    	c.lineTo(w - dx, h);
    	c.lineTo(w - dx, h - dy);
    	c.lineTo(dx, h - dy);
    	c.lineTo(dx, h);
    	c.lineTo(0, h * 0.5);
    	c.lineTo(dx, 0);
    	c.close();
    	c.fillAndStroke();
  }
}
