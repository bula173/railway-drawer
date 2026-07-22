import { Shape } from '@maxgraph/core';

export class BpmnGatewayShape extends Shape {
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
