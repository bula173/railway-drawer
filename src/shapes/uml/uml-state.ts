import { Shape } from '@maxgraph/core';

export class UmlStateShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const r = Math.min(w, h) * 0.15;

    c.begin();
    c.moveTo(r, 0);
    c.arcTo(r, r, 0, 0, 1, w - r, 0);
    c.lineTo(w, r);
    c.arcTo(r, r, 0, 0, 1, w, h - r);
    c.lineTo(w - r, h);
    c.arcTo(r, r, 0, 0, 1, r, h);
    c.lineTo(0, h - r);
    c.arcTo(r, r, 0, 0, 1, 0, r);
    c.close();
    c.fillAndStroke();
  }
}

export class UmlInitialStateShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const r = Math.min(w, h) * 0.5;

    c.begin();
    c.ellipse(w * 0.5 - r, h * 0.5 - r, r * 2, r * 2);
    c.fillAndStroke();
  }
}

export class UmlFinalStateShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const r = Math.min(w, h) * 0.5;
    const innerR = r * 0.6;

    c.begin();
    c.ellipse(w * 0.5 - r, h * 0.5 - r, r * 2, r * 2);
    c.fillAndStroke();

    c.setShadow(false);
    c.setFillColor('#000000');

    c.begin();
    c.ellipse(w * 0.5 - innerR, h * 0.5 - innerR, innerR * 2, innerR * 2);
    c.fillAndStroke();
  }
}
