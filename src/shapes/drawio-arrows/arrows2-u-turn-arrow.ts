/**
 * Draw.io Arrows2 U Turn Arrow shape
 * Adapted from mxArrows.js
 */

import { Shape } from '@maxgraph/core';

export class Arrows2UTurnArrowShape extends Shape {
  constructor() {
    super();
  }

  dy = 0.5;
  dx = 0.5;
  arrowHead = 40;
  dx2 = 25;

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    c.translate(x, y);

    	let dy = Math.max(0, Math.min(h, this.dy));
    	let arrowHead = Math.max(0, Math.min(h, this.arrowHead));
    	let dx = (h - arrowHead / 2 + dy) / 2;
    	let dx2 = Math.max(0, this.dx2);
	
    	c.begin();
    	c.moveTo(dx, 0);
    	c.lineTo(dx + dx2, arrowHead * 0.5);
    	c.lineTo(dx, arrowHead);
    	c.lineTo(dx, arrowHead / 2 + dy);
    	c.arcTo(dx - 2 * dy, dx - 2 * dy, 0, 0, 0, dx, h - 2 * dy);
    	c.lineTo(Math.max(w, dx), h - 2 * dy);
    	c.lineTo(Math.max(w, dx), h);
    	c.lineTo(dx, h);
    	c.arcTo(dx, dx, 0, 0, 1, dx, arrowHead / 2 - dy);
    	c.close();
    	c.fillAndStroke();
  }
}
