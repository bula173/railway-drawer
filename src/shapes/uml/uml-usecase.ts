import { Shape } from '@maxgraph/core';

export class UmlUsecaseShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    c.begin();
    c.ellipse(0, 0, w, h);
    c.fillAndStroke();
  }
}
