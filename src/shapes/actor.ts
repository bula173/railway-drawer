import { Shape } from '@maxgraph/core';

export class ActorShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const headSize = w * 0.3;
    const headX = w / 2 - headSize / 2;
    const headY = h * 0.1;

    const bodyStartY = headY + headSize;
    const bodyHeight = h * 0.4;

    const armStartY = bodyStartY + bodyHeight * 0.3;
    const armLength = w * 0.35;

    const legStartY = bodyStartY + bodyHeight;
    const legHeight = h * 0.3;

    c.begin();
    c.ellipse(headX, headY, headSize, headSize);
    c.fillAndStroke();

    c.begin();
    c.moveTo(w / 2, bodyStartY);
    c.lineTo(w / 2, legStartY);
    c.stroke();

    c.begin();
    c.moveTo(w / 2 - armLength, armStartY);
    c.lineTo(w / 2 + armLength, armStartY);
    c.stroke();

    c.begin();
    c.moveTo(w / 2, legStartY);
    c.lineTo(w / 2 - w * 0.15, legStartY + legHeight);
    c.stroke();

    c.begin();
    c.moveTo(w / 2, legStartY);
    c.lineTo(w / 2 + w * 0.15, legStartY + legHeight);
    c.stroke();
  }
}
