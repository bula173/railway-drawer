import { Shape } from '@maxgraph/core';

export class DatabaseShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const cylinderHeight = Math.max(h * 0.2, 10);

    c.begin();
    c.ellipse(0, 0, w, cylinderHeight);
    c.fillAndStroke();

    c.setShadow(false);

    c.begin();
    c.moveTo(0, cylinderHeight * 0.5);
    c.lineTo(0, h - cylinderHeight * 0.5);
    c.stroke();

    c.begin();
    c.moveTo(w, cylinderHeight * 0.5);
    c.lineTo(w, h - cylinderHeight * 0.5);
    c.stroke();

    c.begin();
    c.ellipse(0, h - cylinderHeight, w, cylinderHeight);
    c.fillAndStroke();
  }
}
