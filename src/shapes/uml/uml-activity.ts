import { Shape } from '@maxgraph/core';

export class UmlActivityShape extends Shape {
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

export class UmlForkJoinShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    // Determine if horizontal or vertical based on dimensions
    const isHorizontal = w > h;

    c.begin();
    if (isHorizontal) {
      c.moveTo(0, h * 0.5);
      c.lineTo(w, h * 0.5);
    } else {
      c.moveTo(w * 0.5, 0);
      c.lineTo(w * 0.5, h);
    }
    c.stroke();
  }
}

export class UmlDecisionShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    c.begin();
    c.moveTo(w * 0.5, 0);
    c.lineTo(w, h * 0.5);
    c.lineTo(w * 0.5, h);
    c.lineTo(0, h * 0.5);
    c.close();
    c.fillAndStroke();
  }
}

export class UmlMergeShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    c.begin();
    c.moveTo(w * 0.5, 0);
    c.lineTo(w, h * 0.5);
    c.lineTo(w * 0.5, h);
    c.lineTo(0, h * 0.5);
    c.close();
    c.fillAndStroke();
  }
}
