import { Shape } from '@maxgraph/core';

export class ActorShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const headSize = Math.min(w * 0.4, h * 0.25);
    const headX = w * 0.5 - headSize * 0.5;
    const headY = h * 0.05;

    const bodyStartY = headY + headSize;
    const bodyMidY = bodyStartY + h * 0.2;
    const legStartY = bodyMidY + h * 0.1;

    c.begin();
    c.ellipse(headX, headY, headSize, headSize);
    c.fillAndStroke();

    c.setShadow(false);

    c.begin();
    c.moveTo(w * 0.5, bodyStartY);
    c.lineTo(w * 0.5, legStartY);
    c.stroke();

    c.begin();
    c.moveTo(w * 0.2, bodyMidY);
    c.lineTo(w * 0.8, bodyMidY);
    c.stroke();

    c.begin();
    c.moveTo(w * 0.5, legStartY);
    c.lineTo(w * 0.35, h * 0.95);
    c.stroke();

    c.begin();
    c.moveTo(w * 0.5, legStartY);
    c.lineTo(w * 0.65, h * 0.95);
    c.stroke();
  }
}
