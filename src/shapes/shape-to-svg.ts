/**
 * @file shape-to-svg.ts
 * @brief Convert maxGraph Shape classes to SVG icons for toolbar display
 */

import { Shape } from '@maxgraph/core';

/**
 * Render Shape class to SVG string by capturing canvas drawings as SVG paths.
 * Returns just the SVG HTML (not data URI) for use with innerHTML.
 */
export function shapeToSvg(ShapeClass: typeof Shape, options?: { width?: number; height?: number }): string {
  const width = options?.width || 64;
  const height = options?.height || 64;

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
    begin() {
      currentPath = '';
    },
    moveTo(x: number, y: number) {
      currentPath += `M ${x} ${y} `;
    },
    lineTo(x: number, y: number) {
      currentPath += `L ${x} ${y} `;
    },
    quadTo(cpx: number, cpy: number, x: number, y: number) {
      currentPath += `Q ${cpx} ${cpy} ${x} ${y} `;
    },
    arcTo(rx: number, ry: number, rot: number, largeArc: number, sweep: number, x: number, y: number) {
      currentPath += `A ${rx} ${ry} ${rot} ${largeArc} ${sweep} ${x} ${y} `;
    },
    arc(x: number, y: number, r: number, startAngle: number, endAngle: number, counterClockwise?: boolean) {
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
        currentPath = `M ${start.x} ${start.y} `;
      }
      currentPath += `A ${r} ${r} 0 ${largeArc} ${sweep} ${end.x} ${end.y} `;
    },
    ellipse(x: number, y: number, radiusX: number, radiusY: number, _rotation: number, startAngle: number, endAngle: number) {
      const points: string[] = [];
      const steps = 20;
      for (let i = 0; i <= steps; i++) {
        const angle = startAngle + ((endAngle - startAngle) * i) / steps;
        const px = x + radiusX * Math.cos(angle);
        const py = y + radiusY * Math.sin(angle);
        points.push(`${i === 0 ? 'M' : 'L'} ${px} ${py}`);
      }
      currentPath += points.join(' ');
    },
    rect(x: number, y: number, w: number, h: number) {
      currentPath += `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z `;
    },
    close() {
      currentPath += 'Z ';
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
    translate() {},
    save() {},
    restore() {},
    rotate() {},
    scale() {},
    setFillColor() {},
    setStrokeColor() {},
    setStrokeWidth() {},
  };

  try {
    const shape = new ShapeClass();
    shape.paintVertexShape(mockCtx, 0, 0, width, height);

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`;
    fills.forEach(({ path, fillStyle, strokeStyle, lineWidth: sw }) => {
      svg += `<path d="${path}" fill="${fillStyle}" stroke="${strokeStyle}" stroke-width="${sw}"/>`;
    });
    svg += '</svg>';

    return svg;
  } catch (error) {
    console.warn(`Failed to render shape to SVG: ${error}`);
    return '';
  }
}

/**
 * Render Shape class to SVG by capturing canvas drawings as SVG paths.
 * Creates a true vector representation of the shape.
 * @deprecated Use shapeToSvg() for direct SVG HTML instead
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

