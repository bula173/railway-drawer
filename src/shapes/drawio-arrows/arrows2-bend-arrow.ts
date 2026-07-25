/**
 * Draw.io Arrows2 Bend Arrow shape
 * Adapted from mxArrows.js
 */

import { Shape } from '@maxgraph/core';

export class Arrows2BendArrowShape extends Shape {
  constructor() {
    super();
  }

  dy = 0.5;
  dx = 0.5;
  notch = 0;
  arrowHead = 40;

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    c.translate(x, y);

    	let dy = Math.max(0, Math.min(h, this.dy));
    	let dx = Math.max(0, Math.min(w, this.dx));
    	let notch = Math.max(0, Math.min(h, this.notch));
    	let arrowHead = Math.max(0, Math.min(h, this.arrowHead));
    	let rounded = '0';

    	c.begin();
    	c.moveTo(w - dx, 0);
    	c.lineTo(w, arrowHead * 0.5);
    	c.lineTo(w - dx, arrowHead);
    	c.lineTo(w - dx, arrowHead / 2 + dy);
	
    	if (rounded == '1')
    	{
    		c.lineTo(dy * 2.2, arrowHead / 2 + dy);
    		c.arcTo(dy * 0.2, dy * 0.2, 0, 0, 0, dy * 2, arrowHead / 2 + dy * 1.2);
    	}
    	else
    	{
    		c.lineTo(dy * 2, arrowHead / 2 + dy);
    	}
	
    	c.lineTo(dy * 2, h);
    	c.lineTo(dy, h - notch);
    	c.lineTo(0, h);
	
    	if (rounded == '1')
    	{
    		c.lineTo(0, arrowHead / 2 + dy);
    		c.arcTo(dy * 2, dy * 2, 0, 0, 1, dy * 2, arrowHead / 2 - dy);
    	}
    	else
    	{
    		c.lineTo(0, arrowHead / 2 - dy);
    	}

    	c.lineTo(w - dx, arrowHead / 2 - dy);
    	c.close();
    	c.fillAndStroke();
  }
}
