import { RectangleShape, EllipseShape } from '@maxgraph/core';

/**
 * Hexagon shape - 6-sided polygon
 */
export class HexagonShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.begin();
    c.moveTo(x + w * 0.25, y);
    c.lineTo(x + w * 0.75, y);
    c.lineTo(x + w, y + h * 0.5);
    c.lineTo(x + w * 0.75, y + h);
    c.lineTo(x + w * 0.25, y + h);
    c.lineTo(x, y + h * 0.5);
    c.close();
    c.fillAndStroke();
  }
}

/**
 * Pentagon shape - 5-sided polygon
 */
export class PentagonShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.begin();
    c.moveTo(x + w * 0.5, y);
    c.lineTo(x + w, y + h * 0.38);
    c.lineTo(x + w * 0.82, y + h);
    c.lineTo(x + w * 0.18, y + h);
    c.lineTo(x, y + h * 0.38);
    c.close();
    c.fillAndStroke();
  }
}

/**
 * Star shape - 5-pointed star
 */
export class StarShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const cx = x + w * 0.5;
    const cy = y + h * 0.5;
    const radius = Math.min(w, h) * 0.5;
    const innerRadius = radius * 0.4;

    c.begin();
    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI) / 5 - Math.PI / 2;
      const r = i % 2 === 0 ? radius : innerRadius;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (i === 0) {
        c.moveTo(px, py);
      } else {
        c.lineTo(px, py);
      }
    }
    c.close();
    c.fillAndStroke();
  }
}

/**
 * Trapezoid shape
 */
export class TrapezoidShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.begin();
    c.moveTo(x + w * 0.2, y);
    c.lineTo(x + w * 0.8, y);
    c.lineTo(x + w, y + h);
    c.lineTo(x, y + h);
    c.close();
    c.fillAndStroke();
  }
}

/**
 * Cross/Plus shape
 */
export class CrossShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const thickness = Math.min(w, h) * 0.25;
    const dx = (w - thickness) * 0.5;
    const dy = (h - thickness) * 0.5;

    c.begin();
    // Horizontal bar
    c.rect(x + dx, y, thickness, h);
    // Vertical bar
    c.rect(x, y + dy, w, thickness);
    c.fillAndStroke();
  }
}

/**
 * Cylinder shape (database-like)
 */
export class CylinderShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const topHeight = h * 0.3;

    c.begin();
    // Top ellipse
    c.ellipse(x, y, w, topHeight);
    c.stroke();

    // Side lines
    c.begin();
    c.moveTo(x, y + topHeight * 0.5);
    c.lineTo(x, y + h - topHeight * 0.5);

    c.moveTo(x + w, y + topHeight * 0.5);
    c.lineTo(x + w, y + h - topHeight * 0.5);

    c.stroke();

    // Bottom ellipse
    c.begin();
    c.ellipse(x, y + h - topHeight, w, topHeight);
    c.fillAndStroke();
  }
}

/**
 * Arrow shape for connectors
 */
export class SimpleArrowShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const arrowSize = Math.min(w, h) * 0.3;

    c.begin();
    c.moveTo(x, y + h * 0.5);
    c.lineTo(x + w - arrowSize, y + h * 0.5);
    c.stroke();

    // Arrow head
    c.begin();
    c.moveTo(x + w - arrowSize, y + h * 0.5 - arrowSize * 0.5);
    c.lineTo(x + w, y + h * 0.5);
    c.lineTo(x + w - arrowSize, y + h * 0.5 + arrowSize * 0.5);
    c.stroke();
  }
}

/**
 * Oval/Ellipse shape
 */
export class OvalShape extends EllipseShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.ellipse(x, y, w, h);
    c.fillAndStroke();
  }
}

/**
 * Rectangle with double border
 */
export class DoubleRectangleShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const inset = 3;
    c.rect(x, y, w, h);
    c.stroke();
    c.rect(x + inset, y + inset, w - inset * 2, h - inset * 2);
    c.stroke();
  }
}

/**
 * Parallelogram shape
 */
export class ParallelogramShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const offset = w * 0.15;

    c.begin();
    c.moveTo(x + offset, y);
    c.lineTo(x + w, y);
    c.lineTo(x + w - offset, y + h);
    c.lineTo(x, y + h);
    c.close();
    c.fillAndStroke();
  }
}

/**
 * Delay shape (D-shaped rectangle)
 */
export class DelayShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const arcWidth = w * 0.25;

    c.begin();
    c.moveTo(x + arcWidth, y);
    c.lineTo(x + w, y);
    c.lineTo(x + w, y + h);
    c.lineTo(x + arcWidth, y + h);
    c.arcTo(arcWidth, h, 0, 0, 1, x + arcWidth, y);
    c.fillAndStroke();
  }
}

/**
 * Chevron/Arrow shape pointing right
 */
export class ChevronShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.begin();
    c.moveTo(x, y);
    c.lineTo(x + w * 0.85, y);
    c.lineTo(x + w, y + h * 0.5);
    c.lineTo(x + w * 0.85, y + h);
    c.lineTo(x, y + h);
    c.lineTo(x + w * 0.15, y + h * 0.5);
    c.close();
    c.fillAndStroke();
  }
}

/**
 * Right angle shape
 */
export class RightAngleShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.begin();
    c.moveTo(x + w, y);
    c.lineTo(x + w, y + h);
    c.lineTo(x, y + h);
    c.stroke();
  }
}

/**
 * Lozenge/Diamond alternative
 */
export class LozengeShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.begin();
    c.moveTo(x + w * 0.5, y);
    c.lineTo(x + w, y + h * 0.5);
    c.lineTo(x + w * 0.5, y + h);
    c.lineTo(x, y + h * 0.5);
    c.close();
    c.fillAndStroke();
  }
}

/**
 * Rounded rectangle shape
 */
export class RoundedRectangleShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const arcSize = Math.min(w, h) * 0.2;
    c.begin();
    c.moveTo(x + arcSize, y);
    c.arcTo(arcSize, arcSize, 0, 0, 1, x + w, y);
    c.lineTo(x + w, y + h - arcSize);
    c.arcTo(arcSize, arcSize, 0, 0, 1, x + w - arcSize, y + h);
    c.lineTo(x + arcSize, y + h);
    c.arcTo(arcSize, arcSize, 0, 0, 1, x, y + h - arcSize);
    c.lineTo(x, y + arcSize);
    c.arcTo(arcSize, arcSize, 0, 0, 1, x + arcSize, y);
    c.fillAndStroke();
  }
}
