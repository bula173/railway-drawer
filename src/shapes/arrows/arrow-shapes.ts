/**
 * Vertex-based arrow shape classes
 * Auto-generated from SVG paths using SvgToVertexConverter
 * Arrows are rendered using maxGraph's drawing API for native styling control
 */

import { RectangleShape } from '@maxgraph/core';

/**
 * Helper: Convert SVG path data to canvas commands
 * Maps SVG viewBox coordinates (0 0 32 30) to shape bounds (x, y, w, h)
 */
const normalizeSvgCoord = (value: number, svgSize: number, shapeSize: number): number => {
  return (value / svgSize) * shapeSize;
};

export class WideArrowShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const vw = 32; // SVG viewBox width
    const vh = 30; // SVG viewBox height

    c.begin();
    c.moveTo(x + normalizeSvgCoord(1.5, vw, w), y + normalizeSvgCoord(6.3, vh, h));
    c.lineTo(x + normalizeSvgCoord(21.8, vw, w), y + normalizeSvgCoord(6.3, vh, h));
    c.lineTo(x + normalizeSvgCoord(30.5, vw, w), y + normalizeSvgCoord(15, vh, h));
    c.lineTo(x + normalizeSvgCoord(21.8, vw, w), y + normalizeSvgCoord(23.7, vh, h));
    c.lineTo(x + normalizeSvgCoord(1.5, vw, w), y + normalizeSvgCoord(23.7, vh, h));
    c.lineTo(x + normalizeSvgCoord(10.2, vw, w), y + normalizeSvgCoord(15, vh, h));
    c.close();
    c.fillAndStroke();
  }
}

export class ThinArrowShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const vw = 32;
    const vh = 30;

    c.begin();
    c.moveTo(x + normalizeSvgCoord(1.5, vw, w), y + normalizeSvgCoord(12.13, vh, h));
    c.lineTo(x + normalizeSvgCoord(24.7, vw, w), y + normalizeSvgCoord(12.13, vh, h));
    c.lineTo(x + normalizeSvgCoord(24.7, vw, w), y + normalizeSvgCoord(6.3, vh, h));
    c.lineTo(x + normalizeSvgCoord(30.5, vw, w), y + normalizeSvgCoord(15, vh, h));
    c.lineTo(x + normalizeSvgCoord(24.7, vw, w), y + normalizeSvgCoord(23.7, vh, h));
    c.lineTo(x + normalizeSvgCoord(24.7, vw, w), y + normalizeSvgCoord(17.87, vh, h));
    c.lineTo(x + normalizeSvgCoord(1.5, vw, w), y + normalizeSvgCoord(17.87, vh, h));
    c.lineTo(x + normalizeSvgCoord(1.5, vw, w), y + normalizeSvgCoord(15, vh, h));
    c.close();
    c.fillAndStroke();
  }
}

export class DoubleArrowShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const vw = 32;
    const vh = 30;

    c.begin();
    c.moveTo(x + normalizeSvgCoord(1.5, vw, w), y + normalizeSvgCoord(6.3, vh, h));
    c.lineTo(x + normalizeSvgCoord(18.9, vw, w), y + normalizeSvgCoord(6.3, vh, h));
    c.lineTo(x + normalizeSvgCoord(18.9, vw, w), y + normalizeSvgCoord(12.1, vh, h));
    c.lineTo(x + normalizeSvgCoord(24.7, vw, w), y + normalizeSvgCoord(12.1, vh, h));
    c.lineTo(x + normalizeSvgCoord(24.7, vw, w), y + normalizeSvgCoord(9.2, vh, h));
    c.lineTo(x + normalizeSvgCoord(30.5, vw, w), y + normalizeSvgCoord(15, vh, h));
    c.lineTo(x + normalizeSvgCoord(24.7, vw, w), y + normalizeSvgCoord(20.8, vh, h));
    c.lineTo(x + normalizeSvgCoord(24.7, vw, w), y + normalizeSvgCoord(17.9, vh, h));
    c.lineTo(x + normalizeSvgCoord(18.9, vw, w), y + normalizeSvgCoord(17.9, vh, h));
    c.lineTo(x + normalizeSvgCoord(18.9, vw, w), y + normalizeSvgCoord(23.7, vh, h));
    c.lineTo(x + normalizeSvgCoord(1.5, vw, w), y + normalizeSvgCoord(23.7, vh, h));
    c.close();
    c.fillAndStroke();
  }
}

export class NotchedArrowShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const vw = 32;
    const vh = 30;

    c.begin();
    c.moveTo(x + normalizeSvgCoord(1.5, vw, w), y + normalizeSvgCoord(12.13, vh, h));
    c.lineTo(x + normalizeSvgCoord(25.28, vw, w), y + normalizeSvgCoord(12.13, vh, h));
    c.lineTo(x + normalizeSvgCoord(21.78, vw, w), y + normalizeSvgCoord(6.3, vh, h));
    c.lineTo(x + normalizeSvgCoord(25.28, vw, w), y + normalizeSvgCoord(6.3, vh, h));
    c.lineTo(x + normalizeSvgCoord(30.5, vw, w), y + normalizeSvgCoord(15, vh, h));
    c.lineTo(x + normalizeSvgCoord(25.28, vw, w), y + normalizeSvgCoord(23.7, vh, h));
    c.lineTo(x + normalizeSvgCoord(21.78, vw, w), y + normalizeSvgCoord(23.7, vh, h));
    c.lineTo(x + normalizeSvgCoord(25.28, vw, w), y + normalizeSvgCoord(17.87, vh, h));
    c.lineTo(x + normalizeSvgCoord(1.5, vw, w), y + normalizeSvgCoord(17.87, vh, h));
    c.lineTo(x + normalizeSvgCoord(1.5, vw, w), y + normalizeSvgCoord(15, vh, h));
    c.close();
    c.fillAndStroke();
  }
}

export class SplitArrowShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const vw = 32;
    const vh = 30;

    c.begin();
    c.moveTo(x + normalizeSvgCoord(9.04, vw, w), y + normalizeSvgCoord(7.75, vh, h));
    c.lineTo(x + normalizeSvgCoord(22.96, vw, w), y + normalizeSvgCoord(7.75, vh, h));
    c.lineTo(x + normalizeSvgCoord(22.96, vw, w), y + normalizeSvgCoord(12.1, vh, h));
    c.lineTo(x + normalizeSvgCoord(24.7, vw, w), y + normalizeSvgCoord(12.1, vh, h));
    c.lineTo(x + normalizeSvgCoord(24.7, vw, w), y + normalizeSvgCoord(9.2, vh, h));
    c.lineTo(x + normalizeSvgCoord(30.5, vw, w), y + normalizeSvgCoord(15, vh, h));
    c.lineTo(x + normalizeSvgCoord(24.7, vw, w), y + normalizeSvgCoord(20.8, vh, h));
    c.lineTo(x + normalizeSvgCoord(24.7, vw, w), y + normalizeSvgCoord(17.9, vh, h));
    c.lineTo(x + normalizeSvgCoord(22.96, vw, w), y + normalizeSvgCoord(17.9, vh, h));
    c.lineTo(x + normalizeSvgCoord(22.96, vw, w), y + normalizeSvgCoord(22.25, vh, h));
    c.lineTo(x + normalizeSvgCoord(9.04, vw, w), y + normalizeSvgCoord(22.25, vh, h));
    c.lineTo(x + normalizeSvgCoord(9.04, vw, w), y + normalizeSvgCoord(17.9, vh, h));
    c.lineTo(x + normalizeSvgCoord(7.3, vw, w), y + normalizeSvgCoord(17.9, vh, h));
    c.lineTo(x + normalizeSvgCoord(7.3, vw, w), y + normalizeSvgCoord(20.8, vh, h));
    c.lineTo(x + normalizeSvgCoord(1.5, vw, w), y + normalizeSvgCoord(15, vh, h));
    c.lineTo(x + normalizeSvgCoord(7.3, vw, w), y + normalizeSvgCoord(9.2, vh, h));
    c.lineTo(x + normalizeSvgCoord(7.3, vw, w), y + normalizeSvgCoord(12.1, vh, h));
    c.lineTo(x + normalizeSvgCoord(9.04, vw, w), y + normalizeSvgCoord(12.1, vh, h));
    c.close();
    c.fillAndStroke();
  }
}

export class CurvedArrowShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const vw = 32;
    const vh = 30;

    c.begin();
    c.moveTo(x + normalizeSvgCoord(19.24, vw, w), y + normalizeSvgCoord(1.5, vh, h));
    c.lineTo(x + normalizeSvgCoord(29.5, vw, w), y + normalizeSvgCoord(8.92, vh, h));
    c.lineTo(x + normalizeSvgCoord(19.24, vw, w), y + normalizeSvgCoord(16.35, vh, h));
    c.lineTo(x + normalizeSvgCoord(19.24, vw, w), y + normalizeSvgCoord(12.97, vh, h));
    c.lineTo(x + normalizeSvgCoord(10.6, vw, w), y + normalizeSvgCoord(12.97, vh, h));
    c.lineTo(x + normalizeSvgCoord(10.6, vw, w), y + normalizeSvgCoord(28.5, vh, h));
    c.lineTo(x + normalizeSvgCoord(6.55, vw, w), y + normalizeSvgCoord(28.5, vh, h));
    c.lineTo(x + normalizeSvgCoord(2.5, vw, w), y + normalizeSvgCoord(28.5, vh, h));
    c.lineTo(x + normalizeSvgCoord(2.5, vw, w), y + normalizeSvgCoord(4.87, vh, h));
    c.lineTo(x + normalizeSvgCoord(19.24, vw, w), y + normalizeSvgCoord(4.87, vh, h));
    c.close();
    c.fillAndStroke();
  }
}

export class LoopArrowShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const vw = 32;
    const vh = 30;

    c.begin();
    c.moveTo(x + normalizeSvgCoord(19.24, vw, w), y + normalizeSvgCoord(1.5, vh, h));
    c.lineTo(x + normalizeSvgCoord(29.5, vw, w), y + normalizeSvgCoord(8.92, vh, h));
    c.lineTo(x + normalizeSvgCoord(19.24, vw, w), y + normalizeSvgCoord(16.35, vh, h));
    c.lineTo(x + normalizeSvgCoord(19.24, vw, w), y + normalizeSvgCoord(12.97, vh, h));
    c.curveTo(
      x + normalizeSvgCoord(9.99, vw, w), y + normalizeSvgCoord(12.98, vh, h),
      x + normalizeSvgCoord(2.5, vw, w), y + normalizeSvgCoord(19.93, vh, h),
      x + normalizeSvgCoord(2.5, vw, w), y + normalizeSvgCoord(28.5, vh, h)
    );
    c.curveTo(
      x + normalizeSvgCoord(2.5, vw, w), y + normalizeSvgCoord(15.45, vh, h),
      x + normalizeSvgCoord(9.99, vw, w), y + normalizeSvgCoord(4.88, vh, h),
      x + normalizeSvgCoord(19.24, vw, w), y + normalizeSvgCoord(4.87, vh, h)
    );
    c.close();
    c.fillAndStroke();
  }
}

export class ChevronArrowShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const vw = 32;
    const vh = 30;

    c.begin();
    c.moveTo(x + normalizeSvgCoord(18.7, vw, w), y + normalizeSvgCoord(8.52, vh, h));
    c.lineTo(x + normalizeSvgCoord(22.48, vw, w), y + normalizeSvgCoord(8.52, vh, h));
    c.lineTo(x + normalizeSvgCoord(22.48, vw, w), y + normalizeSvgCoord(12.3, vh, h));
    c.lineTo(x + normalizeSvgCoord(24.1, vw, w), y + normalizeSvgCoord(12.3, vh, h));
    c.lineTo(x + normalizeSvgCoord(24.1, vw, w), y + normalizeSvgCoord(9.6, vh, h));
    c.lineTo(x + normalizeSvgCoord(29.5, vw, w), y + normalizeSvgCoord(15, vh, h));
    c.lineTo(x + normalizeSvgCoord(24.1, vw, w), y + normalizeSvgCoord(20.4, vh, h));
    c.lineTo(x + normalizeSvgCoord(24.1, vw, w), y + normalizeSvgCoord(17.7, vh, h));
    c.lineTo(x + normalizeSvgCoord(22.48, vw, w), y + normalizeSvgCoord(17.7, vh, h));
    c.lineTo(x + normalizeSvgCoord(22.48, vw, w), y + normalizeSvgCoord(21.48, vh, h));
    c.lineTo(x + normalizeSvgCoord(18.7, vw, w), y + normalizeSvgCoord(21.48, vh, h));
    c.lineTo(x + normalizeSvgCoord(18.7, vw, w), y + normalizeSvgCoord(23.1, vh, h));
    c.lineTo(x + normalizeSvgCoord(21.4, vw, w), y + normalizeSvgCoord(23.1, vh, h));
    c.lineTo(x + normalizeSvgCoord(16, vw, w), y + normalizeSvgCoord(28.5, vh, h));
    c.lineTo(x + normalizeSvgCoord(10.6, vw, w), y + normalizeSvgCoord(23.1, vh, h));
    c.lineTo(x + normalizeSvgCoord(13.3, vw, w), y + normalizeSvgCoord(23.1, vh, h));
    c.lineTo(x + normalizeSvgCoord(13.3, vw, w), y + normalizeSvgCoord(21.48, vh, h));
    c.lineTo(x + normalizeSvgCoord(9.52, vw, w), y + normalizeSvgCoord(21.48, vh, h));
    c.lineTo(x + normalizeSvgCoord(9.52, vw, w), y + normalizeSvgCoord(17.7, vh, h));
    c.lineTo(x + normalizeSvgCoord(7.9, vw, w), y + normalizeSvgCoord(17.7, vh, h));
    c.lineTo(x + normalizeSvgCoord(7.9, vw, w), y + normalizeSvgCoord(20.4, vh, h));
    c.lineTo(x + normalizeSvgCoord(2.5, vw, w), y + normalizeSvgCoord(15, vh, h));
    c.lineTo(x + normalizeSvgCoord(7.9, vw, w), y + normalizeSvgCoord(9.6, vh, h));
    c.lineTo(x + normalizeSvgCoord(7.9, vw, w), y + normalizeSvgCoord(12.3, vh, h));
    c.lineTo(x + normalizeSvgCoord(9.52, vw, w), y + normalizeSvgCoord(12.3, vh, h));
    c.lineTo(x + normalizeSvgCoord(9.52, vw, w), y + normalizeSvgCoord(8.52, vh, h));
    c.lineTo(x + normalizeSvgCoord(13.3, vw, w), y + normalizeSvgCoord(8.52, vh, h));
    c.lineTo(x + normalizeSvgCoord(13.3, vw, w), y + normalizeSvgCoord(6.9, vh, h));
    c.lineTo(x + normalizeSvgCoord(10.6, vw, w), y + normalizeSvgCoord(6.9, vh, h));
    c.lineTo(x + normalizeSvgCoord(16, vw, w), y + normalizeSvgCoord(1.5, vh, h));
    c.lineTo(x + normalizeSvgCoord(21.4, vw, w), y + normalizeSvgCoord(6.9, vh, h));
    c.lineTo(x + normalizeSvgCoord(18.7, vw, w), y + normalizeSvgCoord(6.9, vh, h));
    c.close();
    c.fillAndStroke();
  }
}

export class ZigzagArrowShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const vw = 32;
    const vh = 30;

    c.begin();
    c.moveTo(x + normalizeSvgCoord(18.9, vw, w), y + normalizeSvgCoord(16.45, vh, h));
    c.lineTo(x + normalizeSvgCoord(24.7, vw, w), y + normalizeSvgCoord(16.45, vh, h));
    c.lineTo(x + normalizeSvgCoord(24.7, vw, w), y + normalizeSvgCoord(13.55, vh, h));
    c.lineTo(x + normalizeSvgCoord(30.5, vw, w), y + normalizeSvgCoord(19.35, vh, h));
    c.lineTo(x + normalizeSvgCoord(24.7, vw, w), y + normalizeSvgCoord(25.15, vh, h));
    c.lineTo(x + normalizeSvgCoord(24.7, vw, w), y + normalizeSvgCoord(22.25, vh, h));
    c.lineTo(x + normalizeSvgCoord(7.3, vw, w), y + normalizeSvgCoord(22.25, vh, h));
    c.lineTo(x + normalizeSvgCoord(7.3, vw, w), y + normalizeSvgCoord(25.15, vh, h));
    c.lineTo(x + normalizeSvgCoord(1.5, vw, w), y + normalizeSvgCoord(19.35, vh, h));
    c.lineTo(x + normalizeSvgCoord(7.3, vw, w), y + normalizeSvgCoord(13.55, vh, h));
    c.lineTo(x + normalizeSvgCoord(7.3, vw, w), y + normalizeSvgCoord(16.45, vh, h));
    c.lineTo(x + normalizeSvgCoord(13.1, vw, w), y + normalizeSvgCoord(16.45, vh, h));
    c.lineTo(x + normalizeSvgCoord(13.1, vw, w), y + normalizeSvgCoord(10.65, vh, h));
    c.lineTo(x + normalizeSvgCoord(10.2, vw, w), y + normalizeSvgCoord(10.65, vh, h));
    c.lineTo(x + normalizeSvgCoord(16, vw, w), y + normalizeSvgCoord(4.85, vh, h));
    c.lineTo(x + normalizeSvgCoord(21.8, vw, w), y + normalizeSvgCoord(10.65, vh, h));
    c.lineTo(x + normalizeSvgCoord(18.9, vw, w), y + normalizeSvgCoord(10.65, vh, h));
    c.close();
    c.fillAndStroke();
  }
}

export class HollowArrowShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    const vw = 32;
    const vh = 30;

    c.setFillColor(null);
    c.begin();
    c.moveTo(x + normalizeSvgCoord(1.5, vw, w), y + normalizeSvgCoord(10.94, vh, h));
    c.lineTo(x + normalizeSvgCoord(18.9, vw, w), y + normalizeSvgCoord(10.94, vh, h));
    c.lineTo(x + normalizeSvgCoord(18.9, vw, w), y + normalizeSvgCoord(4.85, vh, h));
    c.lineTo(x + normalizeSvgCoord(30.5, vw, w), y + normalizeSvgCoord(15, vh, h));
    c.lineTo(x + normalizeSvgCoord(18.9, vw, w), y + normalizeSvgCoord(25.15, vh, h));
    c.lineTo(x + normalizeSvgCoord(18.9, vw, w), y + normalizeSvgCoord(19.06, vh, h));
    c.lineTo(x + normalizeSvgCoord(1.5, vw, w), y + normalizeSvgCoord(19.06, vh, h));
    c.lineTo(x + normalizeSvgCoord(1.5, vw, w), y + normalizeSvgCoord(15, vh, h));
    c.close();
    c.stroke();
  }
}
