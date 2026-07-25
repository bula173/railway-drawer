/**
 * @file shape-to-svg.ts
 * @brief Convert maxGraph Shape classes to SVG icons for toolbar display
 */

import { Shape } from '@maxgraph/core';

/**
 * Convert a Shape class to an SVG data URI by rendering it to a canvas
 * and capturing the drawing commands
 */
export function shapeToSvg(ShapeClass: typeof Shape, options?: { width?: number; height?: number }): string {
  const width = options?.width || 64;
  const height = options?.height || 64;

  // Create canvas for rendering
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    console.warn('Failed to get canvas context');
    return '';
  }

  try {
    // Instantiate the shape
    const shape = new ShapeClass();

    // Set up canvas context with sensible defaults
    ctx.fillStyle = '#1976d2';
    ctx.strokeStyle = '#0d47a1';
    ctx.lineWidth = 1.5;

    // Paint the shape
    shape.paintVertexShape(ctx as any, 0, 0, width, height);

    // Convert canvas to data URI
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.warn(`Failed to render shape to SVG: ${error}`);
    return '';
  }
}

/**
 * Render Shape class to SVG by capturing canvas drawings as SVG paths
 * This creates a true vector representation
 */
export function shapeToSvgVector(ShapeClass: typeof Shape, options?: { width?: number; height?: number }): string {
  const width = options?.width || 64;
  const height = options?.height || 64;

  // Create a mock canvas context that records SVG commands
  const fills: Array<{ path: string; fillStyle: string; strokeStyle: string; lineWidth: number }> = [];

  let currentPath = '';
  let fillStyle = '#1976d2';
  let strokeStyle = '#0d47a1';
  let lineWidth = 1.5;

  const mockCtx: any = {
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(value: string) {
      fillStyle = value;
    },
    get strokeStyle() {
      return strokeStyle;
    },
    set strokeStyle(value: string) {
      strokeStyle = value;
    },
    get lineWidth() {
      return lineWidth;
    },
    set lineWidth(value: number) {
      lineWidth = value;
    },

    // Path methods
    begin() {
      currentPath = '';
    },
    moveTo(x: number, y: number) {
      currentPath += `M${x},${y}`;
    },
    lineTo(x: number, y: number) {
      currentPath += `L${x},${y}`;
    },
    quadTo(cpx: number, cpy: number, x: number, y: number) {
      currentPath += `Q${cpx},${cpy},${x},${y}`;
    },
    arcTo(rx: number, ry: number, rot: number, largeArc: number, sweep: number, x: number, y: number) {
      currentPath += `A${rx},${ry},${rot},${largeArc},${sweep},${x},${y}`;
    },
    arc(x: number, y: number, r: number, startAngle: number, endAngle: number, counterClockwise?: boolean) {
      // Convert arc to SVG path approximation
      const start = {
        x: x + r * Math.cos(startAngle),
        y: y + r * Math.sin(startAngle),
      };
      const end = {
        x: x + r * Math.cos(endAngle),
        y: y + r * Math.sin(endAngle),
      };
      const largeArc = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
      const sweep = counterClockwise ? 0 : 1;

      if (!currentPath) {
        currentPath = `M${start.x},${start.y}`;
      }
      currentPath += `A${r},${r},0,${largeArc},${sweep},${end.x},${end.y}`;
    },
    ellipse(x: number, y: number, radiusX: number, radiusY: number, _rotation: number, startAngle: number, endAngle: number) {
      // Simplified ellipse as SVG path
      const points: string[] = [];
      const steps = 20;
      for (let i = 0; i <= steps; i++) {
        const angle = startAngle + ((endAngle - startAngle) * i) / steps;
        const px = x + radiusX * Math.cos(angle);
        const py = y + radiusY * Math.sin(angle);
        points.push(`${i === 0 ? 'M' : 'L'}${px},${py}`);
      }
      currentPath += points.join('');
    },
    rect(x: number, y: number, w: number, h: number) {
      currentPath += `M${x},${y}L${x + w},${y}L${x + w},${y + h}L${x},${y + h}Z`;
    },
    close() {
      currentPath += 'Z';
    },
    fill() {
      if (currentPath) {
        fills.push({ path: currentPath, fillStyle, strokeStyle, lineWidth });
        currentPath = '';
      }
    },
    stroke() {
      if (currentPath) {
        fills.push({ path: currentPath, fillStyle: 'none', strokeStyle, lineWidth });
        currentPath = '';
      }
    },
    fillAndStroke() {
      if (currentPath) {
        fills.push({ path: currentPath, fillStyle, strokeStyle, lineWidth });
        currentPath = '';
      }
    },
    end() {
      if (currentPath) {
        fills.push({ path: currentPath, fillStyle, strokeStyle, lineWidth });
        currentPath = '';
      }
    },

    // Utility methods
    translate() {
      // For icon rendering, we don't need translate
    },
    save() {
      // For icon rendering, we don't need save/restore
    },
    restore() {
      // For icon rendering, we don't need save/restore
    },
    rotate() {
      // For icon rendering, we can ignore rotation
    },
    scale() {
      // For icon rendering, we can ignore scale
    },
    setFillColor() {
      // Ignore setFillColor for now
    },
    setStrokeColor() {
      // Ignore setStrokeColor for now
    },
    setStrokeWidth() {
      // Ignore setStrokeWidth for now
    },
  };

  try {
    // Instantiate and render the shape
    const shape = new ShapeClass();
    shape.paintVertexShape(mockCtx, 0, 0, width, height);

    // Build SVG
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`;

    fills.forEach(({ path, fillStyle, strokeStyle, lineWidth: sw }) => {
      svg += `<path d="${path}" fill="${fillStyle}" stroke="${strokeStyle}" stroke-width="${sw}"/>`;
    });

    svg += '</svg>';

    // Convert to data URI
    return `data:image/svg+xml;utf8,${svg}`;
  } catch (error) {
    console.warn(`Failed to render shape to SVG vector: ${error}`);
    return '';
  }
}

/**
 * Simple canvas-based rendering to PNG data URI
 * Fallback method that works for all shapes
 */
export function shapeToCanvasPNG(ShapeClass: typeof Shape, options?: { width?: number; height?: number; fillColor?: string; strokeColor?: string }): string {
  const width = options?.width || 64;
  const height = options?.height || 64;
  const fillColor = options?.fillColor || '#1976d2';
  const strokeColor = options?.strokeColor || '#0d47a1';

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) return '';

  try {
    // Clear canvas with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Set up rendering
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.5;

    // Render shape
    const shape = new ShapeClass();
    shape.paintVertexShape(ctx as any, 0, 0, width, height);

    // Return as PNG data URI
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.warn(`Failed to render shape: ${error}`);
    return '';
  }
}
