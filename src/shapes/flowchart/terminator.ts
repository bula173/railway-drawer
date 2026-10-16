import { Shape } from '@maxgraph/core';

export class TerminatorShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const r = Math.min(w * 0.3, h * 0.5);

    c.begin();
    c.moveTo(r, 0);
    c.arcTo(r, r, 0, 0, 1, w - r, 0);
    c.lineTo(w, h * 0.5);
    c.arcTo(r, r, 0, 0, 1, w - r, h);
    c.lineTo(r, h);
    c.arcTo(r, r, 0, 0, 1, 0, h * 0.5);
    c.lineTo(0, 0);
    c.close();
    c.fillAndStroke();
  }
}
