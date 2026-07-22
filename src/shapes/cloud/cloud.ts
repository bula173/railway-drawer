import { Shape } from '@maxgraph/core';

export class CloudShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const r = Math.min(w * 0.15, h * 0.15);

    c.begin();
    c.moveTo(w * 0.5, 0);
    c.arcTo(r, r * 0.75, 0, 0, 1, w * 0.65, h * 0.2);
    c.arcTo(r * 1.2, r * 0.8, 0, 0, 1, w, h * 0.4);
    c.arcTo(r * 0.9, r * 0.6, 0, 0, 1, w * 0.95, h * 0.65);
    c.arcTo(r * 1.1, r * 0.75, 0, 0, 1, w * 0.6, h);
    c.arcTo(r * 0.8, r * 0.6, 0, 0, 1, w * 0.3, h * 0.9);
    c.arcTo(r * 1.2, r * 0.8, 0, 0, 1, 0, h * 0.6);
    c.arcTo(r * 0.9, r * 0.7, 0, 0, 1, w * 0.2, h * 0.2);
    c.arcTo(r * 1.1, r * 0.75, 0, 0, 1, w * 0.5, 0);
    c.close();
    c.fillAndStroke();
  }
}
