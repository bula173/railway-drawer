/**
 * Draw.io Arrows2 Striped Arrow shape
 * Adapted from mxArrows.js
 */

import { Shape } from '@maxgraph/core';

export class Arrows2StripedArrowShape extends Shape {
  constructor() {
    super();
  }

  dy = 0.5;
  dx = 0.5;
  notch = 0;

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    c.translate(x, y);

    	let dy = h * 0.5 * Math.max(0, Math.min(1, this.dy));
    	let dx = Math.max(0, Math.min(w, this.dx));
    	let notch = Math.max(0, Math.min(w, this.notch));

    	c.begin();
    	c.moveTo(notch, dy);
    	c.lineTo(w - dx, dy);
    	c.lineTo(w - dx, 0);
    	c.lineTo(w, h * 0.5);
    	c.lineTo(w - dx, h);
    	c.lineTo(w - dx, h - dy);
    	c.lineTo(notch, h - dy);
    	c.close();
    	c.moveTo(0, h - dy);
    	c.lineTo(notch * 0.16, h - dy);
    	c.lineTo(notch * 0.16, dy);
    	c.lineTo(0, dy);
    	c.close();
    	c.moveTo(notch * 0.32, h - dy);
    	c.lineTo(notch * 0.8, h - dy);
    	c.lineTo(notch * 0.8, dy);
    	c.lineTo(notch * 0.32, dy);
    	c.close();
    	c.fillAndStroke();
  }
}
