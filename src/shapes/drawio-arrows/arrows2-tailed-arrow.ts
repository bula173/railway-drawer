/**
 * Draw.io Arrows2 Tailed Arrow shape
 * Adapted from mxArrows.js
 */

import { Shape } from '@maxgraph/core';

export class Arrows2TailedArrowShape extends Shape {
  constructor() {
    super();
  }

  dy = 0.5;
  dx = 0.5;
  notch = 0;
  arrowHead = 0;
  dx1 = 20;
  dy1 = 10;
  dx2 = 25;
  dy2 = 30;

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    c.translate(x, y);

    	let dy1 = Math.max(0, Math.min(h, this.dy1));
    	let dx1 = Math.max(0, Math.min(w, this.dx1));
    	let dy2 = Math.max(0, Math.min(h, this.dy2));
    	let dx2 = Math.max(0, Math.min(w, this.dx2));
    	let notch = Math.max(0, Math.min(w, this.notch));
    	let arrowHead = Math.max(0, Math.min(h, this.arrowHead));
    	let x2 = 0;
	
    	if (dy2 != 0)
    	{
    		x2 = dx2 + dy2 * (dy2 - dy1) / dy2;
    	}

    	c.begin();
    	c.moveTo(0, h * 0.5 - dy2);
    	c.lineTo(dx2, h * 0.5 - dy2);
    	c.lineTo(x2, h * 0.5 - dy1);
    	c.lineTo(w - dx1, h * 0.5 - dy1);
    	c.lineTo(w - dx1, h * 0.5 - dy1 - arrowHead);
    	c.lineTo(w, h * 0.5);
    	c.lineTo(w - dx1, h * 0.5 + dy1 + arrowHead);
    	c.lineTo(w - dx1, h * 0.5 + dy1);
    	c.lineTo(x2, h * 0.5 + dy1);
    	c.lineTo(dx2, h * 0.5 + dy2);
    	c.lineTo(0, h * 0.5 + dy2);
    	c.lineTo(notch, h * 0.5);
    	c.close();
    	c.fillAndStroke();
  }
}
