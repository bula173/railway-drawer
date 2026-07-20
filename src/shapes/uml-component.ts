import { Shape } from '@maxgraph/core';

export class UmlComponentShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const tabWidth = w * 0.2;
    const tabHeight = h * 0.15;

    c.begin();
    c.moveTo(tabWidth, 0);
    c.lineTo(w, 0);
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.lineTo(0, tabHeight);
    c.lineTo(tabWidth, tabHeight);
    c.close();
    c.fillAndStroke();

    c.setShadow(false);

    c.begin();
    c.moveTo(0, 0);
    c.lineTo(tabWidth, 0);
    c.lineTo(tabWidth, tabHeight);
    c.lineTo(0, tabHeight);
    c.stroke();
  }
}

export class UmlArtifactShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const cornerFold = Math.min(w, h) * 0.15;

    c.begin();
    c.moveTo(0, 0);
    c.lineTo(w - cornerFold, 0);
    c.lineTo(w, cornerFold);
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.close();
    c.fillAndStroke();

    c.setShadow(false);

    c.begin();
    c.moveTo(w - cornerFold, 0);
    c.lineTo(w - cornerFold, cornerFold);
    c.lineTo(w, cornerFold);
    c.stroke();
  }
}
