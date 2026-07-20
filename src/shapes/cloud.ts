import { Shape } from '@maxgraph/core';

export class CloudShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const r = 10;
    const d = 15;

    c.begin();
    c.moveTo(w / 4, 0);
    c.curveTo(w / 4, -d, w / 4 - r, -d, w / 4 - r, 0);
    c.curveTo(-d, 0, -d, h / 3, 0, h / 3);
    c.curveTo(-d, h / 3 + r, -d + r, h / 3 + r, d, h / 3 + r);
    c.curveTo(d, h + d, (3 * w) / 4, h + d, (3 * w) / 4, h);
    c.curveTo(w + d, h, w + d, (2 * h) / 3, w, (2 * h) / 3);
    c.curveTo(w + d, (2 * h) / 3 - r, w + d - r, (2 * h) / 3 - r, w - d, (2 * h) / 3 - r);
    c.curveTo(w, -d, (3 * w) / 4, -d, (3 * w) / 4, 0);
    c.close();
    c.fillAndStroke();
  }
}
