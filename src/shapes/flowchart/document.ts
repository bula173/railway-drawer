import { Shape } from '@maxgraph/core';

export class DocumentShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const dy = h * 0.1;

    c.begin();
    c.moveTo(0, 0);
    c.lineTo(w, 0);
    c.lineTo(w, h - dy);

    const step = w * 0.1;
    for (let i = 0; i < w; i += step) {
      c.quadTo(i + step * 0.5, h - dy + dy * 0.5, Math.min(i + step, w), h - dy);
    }

    c.lineTo(0, h - dy);
    c.close();
    c.fillAndStroke();
  }
}
