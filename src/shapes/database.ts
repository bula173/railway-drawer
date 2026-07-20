import { Shape } from '@maxgraph/core';

export class DatabaseShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const cylinderHeight = h * 0.3;

    c.begin();
    c.ellipse(0, 0, w, cylinderHeight);
    c.fillAndStroke();

    c.begin();
    c.moveTo(0, cylinderHeight / 2);
    c.lineTo(0, h - cylinderHeight / 2);
    c.arcTo(w / 2, cylinderHeight / 2, 0, 0, 1, w, h - cylinderHeight / 2);
    c.lineTo(w, cylinderHeight / 2);
    c.stroke();

    c.begin();
    c.ellipse(0, h - cylinderHeight, w, cylinderHeight);
    c.fillAndStroke();
  }
}
