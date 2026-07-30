/**
 * Draw.io Arrows2 Sharp Arrow shape
 * Adapted from mxArrows.js
 */

import { Shape } from '@maxgraph/core';

export class Arrows2SharpArrowShape extends Shape {
  constructor() {
    super();
  }

  dy1 = 0.5;
  dx1 = 0.5;
  dx2 = 0.5;
  notch = 0;

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    c.translate(x, y);

    	let dy1 = h * 0.5 * Math.max(0, Math.min(1, this.dy1));
    	let dx1 = Math.max(0, Math.min(w, this.dx1));
    	let dx2 = Math.max(0, Math.min(w, this.dx2));
    	let notch = Math.max(0, Math.min(w, this.notch));
    	let dx1a = Math.max(0, Math.min(w, this.dx1));
    	let dy1a = h * 0.5 * Math.max(0, Math.min(h, this.dy1));
    	let x2 = 0;
	
    	if (h != 0)
    	{
    		x2 = dx1a + dx2 * dy1a * 2 / h;
    	}
	
    	c.begin();
    	c.moveTo(0, dy1);
    	c.lineTo(w - dx1, dy1);
    	c.lineTo(w - x2, 0);
    	c.lineTo(w - dx2, 0);
    	c.lineTo(w, h * 0.5);
    	c.lineTo(w - dx2, h);
    	c.lineTo(w - x2, h);
    	c.lineTo(w - dx1, h - dy1);
    	c.lineTo(0, h - dy1);
    	c.lineTo(notch, h * 0.5);
    	c.close();
    	c.fillAndStroke();
  }
}
