import { Shape } from '@maxgraph/core';

export class UmlClassShape extends Shape {
  constructor() {
    super();
  }

  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    c.translate(x, y);

    const compartmentHeight = h / 3;

    c.setStrokeColor('#000000');
    c.setFillColor('#ffffff');

    // Main rectangle
    c.begin();
    c.moveTo(0, 0);
    c.lineTo(w, 0);
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.close();
    c.fillAndStroke();

    // Dividing lines between compartments
    c.setShadow(false);
    c.begin();
    c.moveTo(0, compartmentHeight);
    c.lineTo(w, compartmentHeight);
    c.stroke();

    c.begin();
    c.moveTo(0, compartmentHeight * 2);
    c.lineTo(w, compartmentHeight * 2);
    c.stroke();
  }
}
