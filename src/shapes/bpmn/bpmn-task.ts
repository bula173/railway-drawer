import { Shape } from '@maxgraph/core';

export class BpmnTaskShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const r = Math.min(w, h) * 0.1;

    c.begin();
    c.moveTo(r, 0);
    c.arcTo(r, r, 0, 0, 1, w - r, 0);
    c.lineTo(w, r);
    c.arcTo(r, r, 0, 0, 1, w, h - r);
    c.lineTo(w - r, h);
    c.arcTo(r, r, 0, 0, 1, r, h);
    c.lineTo(0, h - r);
    c.arcTo(r, r, 0, 0, 1, 0, r);
    c.close();
    c.fillAndStroke();
  }
}
