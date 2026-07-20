import { Shape } from '@maxgraph/core';

export class LineShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    c.begin();
    c.moveTo(0, h * 0.5);
    c.lineTo(w, h * 0.5);
    c.stroke();
  }
}
