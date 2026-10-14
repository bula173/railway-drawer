/**
 * Draw.io Arrows2 Callout Double90 Arrow shape
 * Adapted from mxArrows.js
 */

import { Shape } from '@maxgraph/core';

export class Arrows2CalloutDouble90ArrowShape extends Shape {
  constructor() {
    super();
  }

  dy1 = 0.5;
  dx1 = 0.5;
  dx2 = 0;
  dy2 = 0;
  arrowHead = 0;

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    	const dy1 = Math.max(0, Math.min(h, this.dy1));
    	const dx1 = Math.max(0, Math.min(w, this.dx1));
    	const dx2 = Math.max(0, Math.min(w, this.dx2));
    	const dy2 = Math.max(0, Math.min(w, this.dy2));
    	const arrowHead = Math.max(0, Math.min(h, this.arrowHead));

    	c.begin();
    	c.moveTo(0, 0);
    	c.lineTo(dx2, 0);
    	c.lineTo(dx2, dy2 * 0.5 - dy1);
    	c.lineTo(w - dx1, dy2 * 0.5 - dy1);
    	c.lineTo(w - dx1, dy2 * 0.5 - dy1 - arrowHead);
    	c.lineTo(w, dy2 * 0.5);
    	c.lineTo(w - dx1, dy2 * 0.5 + dy1 + arrowHead);
    	c.lineTo(w - dx1, dy2 * 0.5 + dy1);
    	c.lineTo(dx2, dy2 * 0.5 + dy1);
    	c.lineTo(dx2, dy2);
    	c.lineTo(dx2 / 2 + dy1, dy2);
    	c.lineTo(dx2 / 2 + dy1, h - dx1);
    	c.lineTo(dx2 / 2 + dy1 + arrowHead, h - dx1);
    	c.lineTo(dx2 / 2, h);
    	c.lineTo(dx2 / 2 - dy1 - arrowHead, h - dx1);
    	c.lineTo(dx2 / 2 - dy1, h - dx1);
    	c.lineTo(dx2 / 2 - dy1, dy2);
    	c.lineTo(0, dy2);
    	c.close();
    	c.fillAndStroke();
  }
}
