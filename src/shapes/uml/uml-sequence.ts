import { Shape } from '@maxgraph/core';

export class UmlLifelineShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const headHeight = h * 0.15;

    c.begin();
    c.ellipse(w * 0.25, 0, w * 0.5, headHeight);
    c.fillAndStroke();

    c.setShadow(false);

    c.begin();
    c.moveTo(w * 0.5, headHeight);
    c.lineTo(w * 0.5, h);
    c.stroke();
  }
}

export class UmlActivationBoxShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const boxWidth = w * 0.4;

    c.begin();
    c.moveTo(w * 0.5 - boxWidth * 0.5, 0);
    c.lineTo(w * 0.5 + boxWidth * 0.5, 0);
    c.lineTo(w * 0.5 + boxWidth * 0.5, h);
    c.lineTo(w * 0.5 - boxWidth * 0.5, h);
    c.close();
    c.fillAndStroke();
  }
}

export class UmlMessageArrowShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    c.begin();
    c.moveTo(0, h * 0.5);
    c.lineTo(w - 6, h * 0.5);
    c.stroke();

    c.setShadow(false);

    c.begin();
    c.moveTo(w - 6, h * 0.5 - 3);
    c.lineTo(w, h * 0.5);
    c.lineTo(w - 6, h * 0.5 + 3);
    c.stroke();
  }
}

export class UmlCombinedFragmentShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const labelHeight = h * 0.12;

    c.begin();
    c.moveTo(0, 0);
    c.lineTo(w, 0);
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.close();
    c.fillAndStroke();

    c.setShadow(false);

    c.begin();
    c.moveTo(0, labelHeight);
    c.lineTo(w, labelHeight);
    c.stroke();

    c.begin();
    c.moveTo(w * 0.2, 0);
    c.lineTo(w * 0.2, labelHeight);
    c.stroke();
  }
}

export class UmlInteractionUseShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    c.begin();
    c.moveTo(0, 0);
    c.lineTo(w, 0);
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.close();
    c.fillAndStroke();

    c.setShadow(false);

    const labelY = h * 0.3;
    c.begin();
    c.moveTo(w * 0.15, labelY - 4);
    c.lineTo(w * 0.15, labelY + 4);
    c.lineTo(w * 0.25, labelY);
    c.close();
    c.fillAndStroke();
  }
}

export class UmlNoteShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const cornerSize = Math.min(w, h) * 0.15;

    c.begin();
    c.moveTo(0, 0);
    c.lineTo(w - cornerSize, 0);
    c.lineTo(w, cornerSize);
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.close();
    c.fillAndStroke();

    c.setShadow(false);

    c.begin();
    c.moveTo(w - cornerSize, 0);
    c.lineTo(w - cornerSize, cornerSize);
    c.lineTo(w, cornerSize);
    c.stroke();
  }
}
