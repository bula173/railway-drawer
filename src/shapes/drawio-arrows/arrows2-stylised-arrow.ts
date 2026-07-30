/**
 * Draw.io Arrows2 Stylised Arrow shape
 * Adapted from mxArrows.js
 */

import { Shape } from '@maxgraph/core';

export class Arrows2StylisedArrowShape extends Shape {
  constructor() {
    super();
  }

  dy = 0.5;
  dx = 0.5;
  notch = 0;
  feather = 0.5;

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    c.translate(x, y);

    	let dy = h * 0.5 * Math.max(0, Math.min(1, this.dy));
    	let dx = Math.max(0, Math.min(w, this.dx));
    	let notch = Math.max(0, Math.min(w, this.notch));
    	let feather = h * 0.5 * Math.max(0, Math.min(1, this.feather));

    	c.begin();
    	c.moveTo(0, feather);
    	c.lineTo(w - dx, dy);
    	c.lineTo(w - dx - 10, 0);
    	c.lineTo(w, h * 0.5);
    	c.lineTo(w - dx - 10, h);
    	c.lineTo(w - dx, h - dy);
    	c.lineTo(0, h - feather);
    	c.lineTo(notch, h * 0.5);
    	c.close();
    	c.fillAndStroke();
  }
}
