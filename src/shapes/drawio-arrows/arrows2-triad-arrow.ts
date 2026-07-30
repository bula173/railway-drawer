/**
 * Draw.io Arrows2 Triad Arrow shape
 * Adapted from mxArrows.js
 */

import { Shape } from '@maxgraph/core';

export class Arrows2TriadArrowShape extends Shape {
  constructor() {
    super();
  }

  dy = 0.5;
  dx = 0.5;
  arrowHead = 0;

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    c.translate(x, y);

    	let dy = Math.max(0, Math.min(h, this.dy));
    	let dx = Math.max(0, Math.min(w, this.dx));
    	let arrowHead = Math.max(0, Math.min(h, this.arrowHead));

    	c.begin();
    	c.moveTo(w * 0.5 + arrowHead * 0.5 - dy, h - arrowHead + dy);
    	c.lineTo(w - dx, h - arrowHead + dy);
    	c.lineTo(w - dx, h - arrowHead);
    	c.lineTo(w, h - arrowHead * 0.5);
    	c.lineTo(w - dx, h);
    	c.lineTo(w - dx, h - dy);
    	c.lineTo(dx, h - dy);
    	c.lineTo(dx, h);
    	c.lineTo(0, h - arrowHead * 0.5);
    	c.lineTo(dx, h - arrowHead);
    	c.lineTo(dx, h - arrowHead + dy);
    	c.lineTo(w * 0.5 - arrowHead * 0.5 + dy, h - arrowHead + dy);
    	c.lineTo(w * 0.5 - arrowHead * 0.5 + dy, dx);
    	c.lineTo(w * 0.5 - arrowHead * 0.5, dx);
    	c.lineTo(w * 0.5, 0);
    	c.lineTo(w * 0.5 + arrowHead * 0.5, dx);
    	c.lineTo(w * 0.5 + arrowHead * 0.5 - dy, dx);
    	c.close();
    	c.fillAndStroke();
  }
}
