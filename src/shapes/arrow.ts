import { Shape } from '@maxgraph/core';

export class ArrowShape extends Shape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    // Canvas already has stroke/fill colors set from style
    // Only draw the arrow shape geometry
    const arrowHeadSize = Math.min(w / 3, h / 2);

    c.begin();
    c.moveTo(x, y + h / 2);
    c.lineTo(x + w - arrowHeadSize, y + h / 2);
    c.lineTo(x + w - arrowHeadSize, y + h / 2 - arrowHeadSize);
    c.lineTo(x + w, y + h / 2);
    c.lineTo(x + w - arrowHeadSize, y + h / 2 + arrowHeadSize);
    c.lineTo(x + w - arrowHeadSize, y + h / 2);
    c.stroke();
  }
}
