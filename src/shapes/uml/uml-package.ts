import { Shape } from '@maxgraph/core';

export class UmlPackageShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const tabWidth = w * 0.3;
    const tabHeight = h * 0.15;

    c.begin();
    c.moveTo(0, tabHeight);
    c.lineTo(tabWidth, tabHeight);
    c.lineTo(tabWidth, 0);
    c.lineTo(w, 0);
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.close();
    c.fillAndStroke();

    c.setShadow(false);

    c.begin();
    c.moveTo(0, tabHeight);
    c.lineTo(tabWidth, tabHeight);
    c.stroke();
  }
}

export class UmlObjectShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const compartmentHeight = h / 2;

    c.begin();
    c.moveTo(0, 0);
    c.lineTo(w, 0);
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.close();
    c.fillAndStroke();

    c.setShadow(false);

    c.begin();
    c.moveTo(0, compartmentHeight);
    c.lineTo(w, compartmentHeight);
    c.stroke();
  }
}
