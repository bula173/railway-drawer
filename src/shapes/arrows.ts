import { RectangleShape } from '@maxgraph/core';

/**
 * Wide block arrow pointing right
 */
export class WideArrowShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const arrowSize = h * 0.3;
    c.begin();
    c.moveTo(x, y + arrowSize);
    c.lineTo(x + w * 0.7, y + arrowSize);
    c.lineTo(x + w * 0.7, y);
    c.lineTo(x + w, y + h * 0.5);
    c.lineTo(x + w * 0.7, y + h);
    c.lineTo(x + w * 0.7, y + h - arrowSize);
    c.lineTo(x, y + h - arrowSize);
    c.close();
    c.fillAndStroke();
  }
}

/**
 * Thin arrow pointing right
 */
export class ThinArrowShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const arrowSize = h * 0.2;
    c.begin();
    c.moveTo(x, y + arrowSize);
    c.lineTo(x + w * 0.75, y + arrowSize);
    c.lineTo(x + w * 0.75, y);
    c.lineTo(x + w, y + h * 0.5);
    c.lineTo(x + w * 0.75, y + h);
    c.lineTo(x + w * 0.75, y + h - arrowSize);
    c.lineTo(x, y + h - arrowSize);
    c.close();
    c.fillAndStroke();
  }
}

/**
 * Double-headed arrow
 */
export class DoubleArrowShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const arrowSize = h * 0.25;
    const bodyStart = x + w * 0.15;
    const bodyEnd = x + w * 0.85;

    c.begin();
    // Left arrow head
    c.moveTo(x, y + h * 0.5);
    c.lineTo(bodyStart, y);
    c.lineTo(bodyStart, y + arrowSize);
    c.lineTo(bodyEnd, y + arrowSize);
    c.lineTo(bodyEnd, y);
    c.lineTo(x + w, y + h * 0.5);
    c.lineTo(bodyEnd, y + h);
    c.lineTo(bodyEnd, y + h - arrowSize);
    c.lineTo(bodyStart, y + h - arrowSize);
    c.lineTo(bodyStart, y + h);
    c.close();
    c.fillAndStroke();
  }
}

/**
 * Notched arrow
 */
export class NotchedArrowShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const notch = h * 0.15;
    c.begin();
    c.moveTo(x, y + h * 0.5 - notch);
    c.lineTo(x + w * 0.65, y + h * 0.5 - notch);
    c.lineTo(x + w * 0.65, y);
    c.lineTo(x + w, y + h * 0.5);
    c.lineTo(x + w * 0.65, y + h);
    c.lineTo(x + w * 0.65, y + h * 0.5 + notch);
    c.lineTo(x, y + h * 0.5 + notch);
    c.lineTo(x + w * 0.25, y + h * 0.5);
    c.close();
    c.fillAndStroke();
  }
}

/**
 * Split arrow (T-shaped)
 */
export class SplitArrowShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const arrowStart = x + w * 0.4;

    // Top arrow
    c.begin();
    c.moveTo(arrowStart, y);
    c.lineTo(x + w * 0.6, y);
    c.lineTo(x + w * 0.5, y + h * 0.3);
    c.lineTo(arrowStart, y + h * 0.3);
    c.close();
    c.fillAndStroke();

    // Bottom arrow
    c.begin();
    c.moveTo(arrowStart, y + h * 0.7);
    c.lineTo(x + w * 0.6, y + h * 0.7);
    c.lineTo(x + w * 0.5, y + h);
    c.lineTo(arrowStart, y + h);
    c.close();
    c.fillAndStroke();

    // Right main arrow
    c.begin();
    c.moveTo(arrowStart, y + h * 0.35);
    c.lineTo(x + w * 0.7, y + h * 0.35);
    c.lineTo(x + w * 0.7, y + h * 0.3);
    c.lineTo(x + w, y + h * 0.5);
    c.lineTo(x + w * 0.7, y + h * 0.7);
    c.lineTo(x + w * 0.7, y + h * 0.65);
    c.lineTo(arrowStart, y + h * 0.65);
    c.close();
    c.fillAndStroke();
  }
}

/**
 * Curved arrow pointing right
 */
export class CurvedArrowShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const arrowSize = h * 0.25;
    const curveRadius = h * 0.4;

    c.begin();
    c.moveTo(x, y + h * 0.5);
    c.quadTo(x + w * 0.3, y - curveRadius, x + w * 0.6, y + arrowSize);
    c.lineTo(x + w * 0.6, y);
    c.lineTo(x + w, y + h * 0.5);
    c.lineTo(x + w * 0.6, y + h);
    c.lineTo(x + w * 0.6, y + h - arrowSize);
    c.quadTo(x + w * 0.3, y + h + curveRadius, x, y + h * 0.5);
    c.close();
    c.fillAndStroke();
  }
}

/**
 * Loop arrow (points back to start)
 */
export class LoopArrowShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const loopHeight = h * 0.6;

    // Main arrow pointing right
    c.setStrokeColor('#333333');
    c.setStrokeWidth(2);
    c.setFillColor('none');

    c.begin();
    c.moveTo(x + w * 0.15, y + h * 0.5 - loopHeight / 2);
    c.quadTo(x + w * 0.5, y - loopHeight, x + w * 0.85, y + h * 0.5 - loopHeight / 2);
    c.stroke();

    // Arrow head
    c.begin();
    c.moveTo(x + w * 0.85, y + h * 0.5 - loopHeight / 2);
    c.lineTo(x + w * 0.75, y + h * 0.5 - loopHeight / 2 - w * 0.08);
    c.lineTo(x + w * 0.8, y + h * 0.5 - loopHeight / 2 + w * 0.08);
    c.close();
    c.fillAndStroke();
  }
}

/**
 * Zigzag arrow
 */
export class ZigzagArrowShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const zigSize = h * 0.15;

    c.begin();
    c.moveTo(x, y + h * 0.5);
    c.lineTo(x + w * 0.2, y + h * 0.5 - zigSize);
    c.lineTo(x + w * 0.4, y + h * 0.5 + zigSize);
    c.lineTo(x + w * 0.6, y + h * 0.5 - zigSize);
    c.lineTo(x + w * 0.75, y + h * 0.5);
    c.lineTo(x + w * 0.75, y);
    c.lineTo(x + w, y + h * 0.5);
    c.lineTo(x + w * 0.75, y + h);
    c.lineTo(x + w * 0.75, y + h * 0.5);
    c.lineTo(x + w * 0.6, y + h * 0.5 + zigSize);
    c.lineTo(x + w * 0.4, y + h * 0.5 - zigSize);
    c.lineTo(x + w * 0.2, y + h * 0.5 + zigSize);
    c.lineTo(x, y + h * 0.5);
    c.close();
    c.fillAndStroke();
  }
}

/**
 * Chevron arrow (two-direction)
 */
export class ChevronArrowShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const chevronSize = w * 0.15;

    c.begin();
    c.moveTo(x, y + h * 0.5);
    c.lineTo(x + chevronSize, y);
    c.lineTo(x + w * 0.5, y + h * 0.5);
    c.lineTo(x + chevronSize, y + h);
    c.lineTo(x, y + h * 0.5);
    c.lineTo(x + w * 0.5, y + h * 0.5);
    c.lineTo(x + w - chevronSize, y);
    c.lineTo(x + w, y + h * 0.5);
    c.lineTo(x + w - chevronSize, y + h);
    c.lineTo(x + w * 0.5, y + h * 0.5);
    c.close();
    c.fillAndStroke();
  }
}

/**
 * Hollow arrow
 */
export class HollowArrowShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const arrowSize = h * 0.3;

    c.setFillColor('none');
    c.setStrokeColor('#333333');
    c.setStrokeWidth(2);

    c.begin();
    c.moveTo(x, y + arrowSize);
    c.lineTo(x + w * 0.7, y + arrowSize);
    c.lineTo(x + w * 0.7, y);
    c.lineTo(x + w, y + h * 0.5);
    c.lineTo(x + w * 0.7, y + h);
    c.lineTo(x + w * 0.7, y + h - arrowSize);
    c.lineTo(x, y + h - arrowSize);
    c.close();
    c.stroke();
  }
}
