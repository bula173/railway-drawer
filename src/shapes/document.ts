import { Shape } from '@maxgraph/core';

export class DocumentShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const waviness = h * 0.15;

    c.begin();
    c.moveTo(0, 0);
    c.lineTo(w, 0);
    c.lineTo(w, h - waviness);

    for (let i = 0; i < w; i += 10) {
      c.quadTo(i + 5, h - waviness + 5, i + 10, h - waviness);
    }

    c.lineTo(0, h - waviness);
    c.close();
    c.fillAndStroke();
  }
}
