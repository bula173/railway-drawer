/**
 * Draw.io Arrows2 Jump In Arrow shape
 * Adapted from mxArrows.js
 */

import { Shape } from '@maxgraph/core';

export class Arrows2JumpInArrowShape extends Shape {
  constructor() {
    super();
  }

  dy = 0.5;
  dx = 0.5;
  arrowHead = 40;

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    c.translate(x, y);

    	let dy = Math.max(0, Math.min(h, this.dy));
    	let dx = Math.max(0, Math.min(w, this.dx));
    	let arrowHead = Math.max(0, Math.min(h, this.arrowHead));

    	c.begin();
    	c.moveTo(w - dx, 0);
    	c.lineTo(w, arrowHead * 0.5);
    	c.lineTo(w - dx, arrowHead);
    	c.lineTo(w - dx, arrowHead / 2 + dy);
    	c.arcTo(w - dx, h - arrowHead / 2 - dy, 0, 0, 0, 0, h);
    	c.arcTo(w - dx, h - arrowHead / 2 + dy, 0, 0, 1, w - dx, arrowHead / 2 - dy);
    	c.close();
    	c.fillAndStroke();
  }
}
