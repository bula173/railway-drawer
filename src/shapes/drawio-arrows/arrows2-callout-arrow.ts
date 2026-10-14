/**
 * Draw.io Arrows2 Callout Arrow shape
 * Adapted from mxArrows.js
 */

import { Shape } from '@maxgraph/core';

export class Arrows2CalloutArrowShape extends Shape {
  constructor() {
    super();
  }

  dy = 0.5;
  dx = 0.5;
  notch = 0;
  arrowHead = 0;

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    	const dy = Math.max(0, Math.min(h, this.dy));
    	const dx = Math.max(0, Math.min(w, this.dx));
    	const notch = Math.max(0, Math.min(w, this.notch));
    	const arrowHead = Math.max(0, Math.min(h, this.arrowHead));

    	c.begin();
    	c.moveTo(0, 0);
    	c.lineTo(notch, 0);
    	c.lineTo(notch, h * 0.5 - dy);
    	c.lineTo(w - dx, h * 0.5 - dy);
    	c.lineTo(w - dx, h * 0.5 - dy - arrowHead);
    	c.lineTo(w, h * 0.5);
    	c.lineTo(w - dx, h * 0.5 + dy + arrowHead);
    	c.lineTo(w - dx, h * 0.5 + dy);
    	c.lineTo(notch, h * 0.5 + dy);
    	c.lineTo(notch, h);
    	c.lineTo(0, h);
    	c.close();
    	c.fillAndStroke();
  }
}
