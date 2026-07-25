/**
 * Draw.io Arrows2 Sharp Arrow2 shape
 * Adapted from mxArrows.js
 */

import { Shape } from '@maxgraph/core';

export class Arrows2SharpArrow2Shape extends Shape {
  constructor() {
    super();
  }

  dy1 = 0.5;
  dx1 = 0.5;
  dx2 = 0.5;
  dy3 = 0.5;
  dx3 = 0.5;
  notch = 0;

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    c.translate(x, y);

    	let dy1 = h * 0.5 * Math.max(0, Math.min(1, this.dy1));
    	let dx1 = Math.max(0, Math.min(w, this.dx1));
    	let dx2 = Math.max(0, Math.min(w, this.dx2));
    	let dy3 = h * 0.5 * Math.max(0, Math.min(1, this.dy3));
    	let dx3 = Math.max(0, Math.min(w, this.dx3));
    	let notch = Math.max(0, Math.min(w, this.notch));

    	c.begin();
    	c.moveTo(0, dy1);
    	c.lineTo(w - dx1, dy1);
    	c.lineTo(w - dx3, dy3);
    	c.lineTo(w - dx2, 0);
    	c.lineTo(w, h * 0.5);
    	c.lineTo(w - dx2, h);
    	c.lineTo(w - dx3, h - dy3);
    	c.lineTo(w - dx1, h - dy1);
    	c.lineTo(0, h - dy1);
    	c.lineTo(notch, h * 0.5);
    	c.close();
    	c.fillAndStroke();
  }
}
