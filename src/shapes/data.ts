import { Shape } from '@maxgraph/core';

export class DataShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const skew = Math.min(w * 0.15, h * 0.2);

    c.begin();
    c.moveTo(skew, 0);
    c.lineTo(w, 0);
    c.lineTo(w - skew, h);
    c.lineTo(0, h);
    c.close();
    c.fillAndStroke();
  }
}
