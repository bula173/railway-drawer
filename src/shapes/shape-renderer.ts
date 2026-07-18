/**
 * Shape Icon Renderer
 * Simple SVG preview icons for shapes
 */

import { ShapeDefinition } from './shapes-library';

export function createShapeIcon(shape: ShapeDefinition): HTMLElement {
  const container = document.createElement('div');
  container.className = 'shape-icon-container';
  container.style.width = '48px';
  container.style.height = '48px';
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.backgroundColor = '#f9f9f9';
  container.style.borderRadius = '4px';
  container.style.border = '1px solid #e0e0e0';
  container.style.padding = '4px';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '40');
  svg.setAttribute('height', '40');
  svg.setAttribute('viewBox', '0 0 40 40');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.style.display = 'block';

  const fill = shape.fillColor || '#ffffff';
  const stroke = shape.strokeColor || '#333333';
  const strokeWidth = Math.max(0.5, (shape.strokeWidth || 1) * 0.75);

  try {
    switch (shape.shape) {
      case 'rectangle':
        drawRectangle(svg, fill, stroke, strokeWidth);
        break;
      case 'ellipse':
        drawEllipse(svg, fill, stroke, strokeWidth);
        break;
      case 'rhombus':
        drawDiamond(svg, fill, stroke, strokeWidth);
        break;
      case 'triangle':
        drawTriangle(svg, fill, stroke, strokeWidth);
        break;
      case 'cylinder':
        drawCylinder(svg, fill, stroke, strokeWidth);
        break;
      case 'cloud':
        drawCloud(svg, fill, stroke, strokeWidth);
        break;
      case 'hexagon':
        drawHexagon(svg, fill, stroke, strokeWidth);
        break;
      case 'doubleellipse':
        drawDoubleEllipse(svg, fill, stroke, strokeWidth);
        break;
      default:
        drawRectangle(svg, fill, stroke, strokeWidth);
    }
  } catch (e) {
    console.error('Error drawing shape icon:', e);
    drawRectangle(svg, fill, stroke, strokeWidth);
  }

  container.appendChild(svg);
  return container;
}

function drawRectangle(svg: SVGSVGElement, fill: string, stroke: string, strokeWidth: number) {
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', '6');
  rect.setAttribute('y', '8');
  rect.setAttribute('width', '28');
  rect.setAttribute('height', '24');
  rect.setAttribute('fill', fill);
  rect.setAttribute('stroke', stroke);
  rect.setAttribute('stroke-width', strokeWidth.toString());
  rect.setAttribute('rx', '1');
  svg.appendChild(rect);
}

function drawEllipse(svg: SVGSVGElement, fill: string, stroke: string, strokeWidth: number) {
  const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  ellipse.setAttribute('cx', '20');
  ellipse.setAttribute('cy', '20');
  ellipse.setAttribute('rx', '14');
  ellipse.setAttribute('ry', '12');
  ellipse.setAttribute('fill', fill);
  ellipse.setAttribute('stroke', stroke);
  ellipse.setAttribute('stroke-width', strokeWidth.toString());
  svg.appendChild(ellipse);
}

function drawDiamond(svg: SVGSVGElement, fill: string, stroke: string, strokeWidth: number) {
  const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  polygon.setAttribute('points', '20,4 34,20 20,36 6,20');
  polygon.setAttribute('fill', fill);
  polygon.setAttribute('stroke', stroke);
  polygon.setAttribute('stroke-width', strokeWidth.toString());
  svg.appendChild(polygon);
}

function drawTriangle(svg: SVGSVGElement, fill: string, stroke: string, strokeWidth: number) {
  const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  polygon.setAttribute('points', '20,6 34,32 6,32');
  polygon.setAttribute('fill', fill);
  polygon.setAttribute('stroke', stroke);
  polygon.setAttribute('stroke-width', strokeWidth.toString());
  svg.appendChild(polygon);
}

function drawCylinder(svg: SVGSVGElement, fill: string, stroke: string, strokeWidth: number) {
  // Top circle
  const top = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  top.setAttribute('cx', '20');
  top.setAttribute('cy', '10');
  top.setAttribute('rx', '12');
  top.setAttribute('ry', '5');
  top.setAttribute('fill', fill);
  top.setAttribute('stroke', stroke);
  top.setAttribute('stroke-width', strokeWidth.toString());
  svg.appendChild(top);

  // Body
  const body = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  body.setAttribute('d', 'M 8 10 L 8 30 Q 20 33 32 30 L 32 10');
  body.setAttribute('fill', fill);
  body.setAttribute('stroke', stroke);
  body.setAttribute('stroke-width', strokeWidth.toString());
  svg.appendChild(body);

  // Bottom circle
  const bottom = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  bottom.setAttribute('cx', '20');
  bottom.setAttribute('cy', '30');
  bottom.setAttribute('rx', '12');
  bottom.setAttribute('ry', '5');
  bottom.setAttribute('fill', fill);
  bottom.setAttribute('stroke', stroke);
  bottom.setAttribute('stroke-width', strokeWidth.toString());
  svg.appendChild(bottom);
}

function drawCloud(svg: SVGSVGElement, fill: string, stroke: string, strokeWidth: number) {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M 8 22 Q 6 16 12 14 Q 14 8 20 8 Q 26 8 28 14 Q 34 16 32 22 Q 34 28 28 30 L 12 30 Q 6 28 8 22 Z');
  path.setAttribute('fill', fill);
  path.setAttribute('stroke', stroke);
  path.setAttribute('stroke-width', strokeWidth.toString());
  path.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(path);
}

function drawHexagon(svg: SVGSVGElement, fill: string, stroke: string, strokeWidth: number) {
  const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  // Regular hexagon centered at 20,20
  polygon.setAttribute('points', '20,4 34,12 34,28 20,36 6,28 6,12');
  polygon.setAttribute('fill', fill);
  polygon.setAttribute('stroke', stroke);
  polygon.setAttribute('stroke-width', strokeWidth.toString());
  svg.appendChild(polygon);
}

function drawDoubleEllipse(svg: SVGSVGElement, fill: string, stroke: string, strokeWidth: number) {
  // Outer ellipse
  const outer = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  outer.setAttribute('cx', '20');
  outer.setAttribute('cy', '20');
  outer.setAttribute('rx', '14');
  outer.setAttribute('ry', '12');
  outer.setAttribute('fill', 'none');
  outer.setAttribute('stroke', stroke);
  outer.setAttribute('stroke-width', strokeWidth.toString());
  svg.appendChild(outer);

  // Inner ellipse
  const inner = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  inner.setAttribute('cx', '20');
  inner.setAttribute('cy', '20');
  inner.setAttribute('rx', '10');
  inner.setAttribute('ry', '8');
  inner.setAttribute('fill', fill);
  inner.setAttribute('stroke', stroke);
  inner.setAttribute('stroke-width', strokeWidth.toString());
  svg.appendChild(inner);
}
