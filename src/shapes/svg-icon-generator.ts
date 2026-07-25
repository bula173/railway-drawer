import { Shape } from '@maxgraph/core';

/**
 * Generate an SVG element from a Shape class by rendering it and extracting the visual result.
 * This is the simplest, most direct approach - no intermediate strings or complex conversions.
 */
export function generateShapeIcon(ShapeClass: typeof Shape, width: number = 32, height: number = 30): SVGElement | null {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', `${width}`);
  svg.setAttribute('height', `${height}`);
  svg.setAttribute('style', 'display: block; overflow: hidden;');

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

  // Create a mock canvas context that records SVG commands as DOM elements
  const commands: Array<{ type: string; data: any }> = [];

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
      commands.push({ type: 'begin', data: {} });
    },
    moveTo(x: number, y: number) {
      commands.push({ type: 'moveTo', data: { x, y } });
    },
    lineTo(x: number, y: number) {
      commands.push({ type: 'lineTo', data: { x, y } });
    },
    quadTo(cpx: number, cpy: number, x: number, y: number) {
      commands.push({ type: 'quadTo', data: { cpx, cpy, x, y } });
    },
    arcTo(rx: number, ry: number, rot: number, largeArc: number, sweep: number, x: number, y: number) {
      commands.push({ type: 'arcTo', data: { rx, ry, rot, largeArc, sweep, x, y } });
    },
    arc(x: number, y: number, r: number, startAngle: number, endAngle: number, counterClockwise?: boolean) {
      commands.push({ type: 'arc', data: { x, y, r, startAngle, endAngle, counterClockwise } });
    },
    ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation: number, startAngle: number, endAngle: number) {
      commands.push({ type: 'ellipse', data: { x, y, radiusX, radiusY, rotation, startAngle, endAngle } });
    },
    rect(x: number, y: number, w: number, h: number) {
      commands.push({ type: 'rect', data: { x, y, w, h } });
    },
    close() {
      commands.push({ type: 'close', data: {} });
    },
    fill() {
      commands.push({ type: 'fill', data: { fillStyle, strokeStyle, lineWidth } });
    },
    stroke() {
      commands.push({ type: 'stroke', data: { fillStyle: 'none', strokeStyle, lineWidth } });
    },
    fillAndStroke() {
      commands.push({ type: 'fillAndStroke', data: { fillStyle, strokeStyle, lineWidth } });
    },
    end() {
      commands.push({ type: 'end', data: { fillStyle, strokeStyle, lineWidth } });
    },

    // No-ops for transforms
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
    // Render shape to mock context
    const shape = new ShapeClass();
    shape.paintVertexShape(mockCtx, 0, 0, width, height);

    // Convert commands to SVG path
    let pathData = '';
    for (const cmd of commands) {
      switch (cmd.type) {
        case 'moveTo':
          pathData += `M${cmd.data.x},${cmd.data.y}`;
          break;
        case 'lineTo':
          pathData += `L${cmd.data.x},${cmd.data.y}`;
          break;
        case 'quadTo':
          pathData += `Q${cmd.data.cpx},${cmd.data.cpy},${cmd.data.x},${cmd.data.y}`;
          break;
        case 'arcTo':
          pathData += `A${cmd.data.rx},${cmd.data.ry},${cmd.data.rot},${cmd.data.largeArc},${cmd.data.sweep},${cmd.data.x},${cmd.data.y}`;
          break;
        case 'rect':
          pathData += `M${cmd.data.x},${cmd.data.y}L${cmd.data.x + cmd.data.w},${cmd.data.y}L${cmd.data.x + cmd.data.w},${cmd.data.y + cmd.data.h}L${cmd.data.x},${cmd.data.y + cmd.data.h}Z`;
          break;
        case 'close':
          pathData += 'Z';
          break;
        case 'fillAndStroke':
        case 'end':
          if (pathData) {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', pathData);
            path.setAttribute('fill', cmd.data.fillStyle);
            path.setAttribute('stroke', cmd.data.strokeStyle);
            path.setAttribute('stroke-width', String(cmd.data.lineWidth));
            g.appendChild(path);
            pathData = '';
          }
          break;
      }
    }

    svg.appendChild(g);
    return svg;
  } catch (error) {
    console.warn('Failed to generate shape icon:', error);
    return null;
  }
}
