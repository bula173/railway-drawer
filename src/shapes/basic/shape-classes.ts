/**
 * Vertex-based shape classes for basic geometric shapes
 * These shapes render using maxGraph's AbstractCanvas2D API, allowing native styling
 */

import { RectangleShape, EllipseShape } from '@maxgraph/core';

export class RectangleShapeVertex extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.begin();
    c.rect(x, y, w, h);
    c.fillAndStroke();
  }
}

export class CircleShapeVertex extends EllipseShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.begin();
    c.ellipse(x, y, w, h);
    c.fillAndStroke();
  }
}

export class DiamondShapeVertex extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.begin();
    c.moveTo(x + w / 2, y);
    c.lineTo(x + w, y + h / 2);
    c.lineTo(x + w / 2, y + h);
    c.lineTo(x, y + h / 2);
    c.close();
    c.fillAndStroke();
  }
}

export class TriangleShapeVertex extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.begin();
    c.moveTo(x + w / 2, y);
    c.lineTo(x + w, y + h);
    c.lineTo(x, y + h);
    c.close();
    c.fillAndStroke();
  }
}

export class EllipseShapeVertex extends EllipseShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.begin();
    c.ellipse(x, y, w, h);
    c.fillAndStroke();
  }
}

export class RoundedRectangleShapeVertex extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const round = Math.min(w, h) * 0.15;
    c.begin();
    c.moveTo(x + round, y);
    c.lineTo(x + w - round, y);
    c.quadTo(x + w, y, x + w, y + round);
    c.lineTo(x + w, y + h - round);
    c.quadTo(x + w, y + h, x + w - round, y + h);
    c.lineTo(x + round, y + h);
    c.quadTo(x, y + h, x, y + h - round);
    c.lineTo(x, y + round);
    c.quadTo(x, y, x + round, y);
    c.close();
    c.fillAndStroke();
  }
}

export class HexagonShapeVertex extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.begin();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 - Math.PI / 2;
      const px = x + w / 2 + (w / 2) * Math.cos(angle);
      const py = y + h / 2 + (h / 2) * Math.sin(angle);
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.close();
    c.fillAndStroke();
  }
}

export class PentagonShapeVertex extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.begin();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const px = x + w / 2 + (w / 2) * Math.cos(angle);
      const py = y + h / 2 + (h / 2.2) * Math.sin(angle);
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.close();
    c.fillAndStroke();
  }
}

export class StarShapeVertex extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.begin();
    const cx = x + w / 2;
    const cy = y + h / 2;
    const outerRadius = Math.min(w, h) / 2;
    const innerRadius = outerRadius * 0.4;
    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI) / 5 - Math.PI / 2;
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const px = cx + radius * Math.cos(angle);
      const py = cy + radius * Math.sin(angle);
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.close();
    c.fillAndStroke();
  }
}

export class TrapezoidShapeVertex extends RectangleShape {
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

export class CrossShapeVertex extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const barWidth = w * 0.25;
    const barHeight = h * 0.25;

    // Vertical bar
    c.begin();
    c.rect(x + w / 2 - barWidth / 2, y, barWidth, h);
    c.fillAndStroke();

    // Horizontal bar
    c.begin();
    c.rect(x, y + h / 2 - barHeight / 2, w, barHeight);
    c.fillAndStroke();
  }
}

export class CylinderShapeVertex extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const topH = h * 0.25;

    // Top ellipse
    c.begin();
    c.ellipse(x, y, w, topH);
    c.fillAndStroke();

    // Side rectangle
    c.begin();
    c.rect(x, y + topH / 2, w, h - topH);
    c.fillAndStroke();

    // Bottom ellipse (stroked only)
    c.setFillColor(null);
    c.begin();
    c.ellipse(x, y + h - topH / 2, w, topH);
    c.stroke();
  }
}

export class OvalShapeVertex extends EllipseShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.begin();
    c.ellipse(x, y, w, h);
    c.fillAndStroke();
  }
}

export class DoubleRectangleShapeVertex extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.begin();
    c.rect(x, y, w, h);
    c.fillAndStroke();

    // Center line
    c.begin();
    c.moveTo(x + w / 2, y);
    c.lineTo(x + w / 2, y + h);
    c.stroke();
  }
}

export class LosangeShapeVertex extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.begin();
    c.moveTo(x + w / 2, y);
    c.lineTo(x + w, y + h / 2);
    c.lineTo(x + w / 2, y + h);
    c.lineTo(x, y + h / 2);
    c.close();
    c.fillAndStroke();
  }
}

export class ChevronShapeVertex extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.begin();
    c.moveTo(x, y);
    c.lineTo(x + w * 0.75, y + h / 2);
    c.lineTo(x, y + h);
    c.lineTo(x + w * 0.65, y + h / 2);
    c.close();
    c.fillAndStroke();
  }
}

export class RightAngleShapeVertex extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setFillColor(null);
    c.begin();
    c.moveTo(x + w * 0.75, y);
    c.lineTo(x + w * 0.75, y + h * 0.75);
    c.lineTo(x, y + h * 0.75);
    c.stroke();
  }
}

export class LineShapeVertex extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.setFillColor(null);
    c.begin();
    c.moveTo(x, y + h / 2);
    c.lineTo(x + w, y + h / 2);
    c.stroke();
  }
}
