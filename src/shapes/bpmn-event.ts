import { Shape } from '@maxgraph/core';

export class BpmnEventShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const r = Math.min(w, h) * 0.5;

    c.begin();
    c.ellipse(w * 0.5 - r, h * 0.5 - r, r * 2, r * 2);
    c.fillAndStroke();
  }
}
