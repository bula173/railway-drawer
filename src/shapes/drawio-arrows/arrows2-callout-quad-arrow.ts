/**
 * Draw.io Arrows2 Callout Quad Arrow shape
 * Adapted from mxArrows.js
 */

import { Shape } from '@maxgraph/core';

export class Arrows2CalloutQuadArrowShape extends Shape {
  constructor() {
    super();
  }

  dy = 0.5;
  dx = 0.5;
  notch = 0;
  arrowHead = 0;

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    c.translate(x, y);

    	let dy = Math.max(0, Math.min(h, this.dy));
    	let dx = Math.max(0, Math.min(w, this.dx));
    	let notch = Math.max(0, Math.min(w, this.notch));
    	let arrowHead = Math.max(0, Math.min(h, this.arrowHead));

    	c.begin();
    	c.moveTo(w * 0.5 + dy, h * 0.5 - notch);
    	c.lineTo(w * 0.5 + notch, h * 0.5 - notch);
    	c.lineTo(w * 0.5 + notch, h * 0.5 - dy);
    	c.lineTo(w - dx, h * 0.5 - dy);
    	c.lineTo(w - dx, h * 0.5 - dy - arrowHead);
    	c.lineTo(w, h * 0.5);
    	c.lineTo(w - dx, h * 0.5 + dy + arrowHead);
    	c.lineTo(w - dx, h * 0.5 + dy);
    	c.lineTo(w * 0.5 + notch, h * 0.5 + dy);
    	c.lineTo(w * 0.5 + notch, h * 0.5 + notch);
    	c.lineTo(w * 0.5 + dy, h * 0.5 + notch);
    	c.lineTo(w * 0.5 + dy, h - dx);
    	c.lineTo(w * 0.5 + dy + arrowHead, h - dx);
    	c.lineTo(w * 0.5, h);
    	c.lineTo(w * 0.5 - dy - arrowHead, h - dx);
    	c.lineTo(w * 0.5 - dy, h - dx);
    	c.lineTo(w * 0.5 - dy, h * 0.5 + notch);
    	c.lineTo(w * 0.5 - notch, h * 0.5 + notch);
    	c.lineTo(w * 0.5 - notch, h * 0.5 + dy);
    	c.lineTo(dx, h * 0.5 + dy);
    	c.lineTo(dx, h * 0.5 + dy + arrowHead);
    	c.lineTo(0, h * 0.5);
    	c.lineTo(dx, h * 0.5 - dy - arrowHead);
    	c.lineTo(dx, h * 0.5 - dy);
    	c.lineTo(w * 0.5 - notch, h * 0.5 - dy);
    	c.lineTo(w * 0.5 - notch, h * 0.5 - notch);
    	c.lineTo(w * 0.5 - dy, h * 0.5 - notch);
    	c.lineTo(w * 0.5 - dy, dx);
    	c.lineTo(w * 0.5 - dy - arrowHead, dx);
    	c.lineTo(w * 0.5, 0);
    	c.lineTo(w * 0.5 + dy + arrowHead, dx);
    	c.lineTo(w * 0.5 + dy, dx);
    	c.close();
    	c.fillAndStroke();
  }
}
