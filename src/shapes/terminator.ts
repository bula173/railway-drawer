import { Shape } from '@maxgraph/core';

export class TerminatorShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const cornerSize = Math.min(w, h) * 0.2;

    c.begin();
    c.moveTo(cornerSize, 0);
    c.lineTo(w - cornerSize, 0);
    c.arcTo(cornerSize, cornerSize, 0, 0, 1, w, cornerSize);
    c.lineTo(w, h - cornerSize);
    c.arcTo(cornerSize, cornerSize, 0, 0, 1, w - cornerSize, h);
    c.lineTo(cornerSize, h);
    c.arcTo(cornerSize, cornerSize, 0, 0, 1, 0, h - cornerSize);
    c.lineTo(0, cornerSize);
    c.arcTo(cornerSize, cornerSize, 0, 0, 1, cornerSize, 0);
    c.close();
    c.fillAndStroke();
  }
}
