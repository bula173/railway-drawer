/**
 * Shape Icon Renderer
 * Simple SVG preview icons for shapes
 */

import { ShapeDefinition } from './shapes-library';

export function createShapeIcon(shape: ShapeDefinition): HTMLElement {
  const container = document.createElement('div');
  container.className = 'shape-icon-container';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '32');
  svg.setAttribute('height', '32');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.style.display = 'block';
  svg.style.width = '100%';
  svg.style.height = '100%';

  const fill = shape.fillColor || '#ffffff';
  const stroke = shape.strokeColor || '#333333';
  const strokeWidth = Math.max(1, Math.min(1.5, (shape.strokeWidth || 1)));

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
  rect.setAttribute('x', '5');
  rect.setAttribute('y', '7');
  rect.setAttribute('width', '22');
  rect.setAttribute('height', '18');
  rect.setAttribute('fill', fill);
  rect.setAttribute('stroke', stroke);
  rect.setAttribute('stroke-width', strokeWidth.toString());
  rect.setAttribute('stroke-linejoin', 'miter');
  rect.setAttribute('rx', '0');
  svg.appendChild(rect);
}

function drawEllipse(svg: SVGSVGElement, fill: string, stroke: string, strokeWidth: number) {
  const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  ellipse.setAttribute('cx', '16');
  ellipse.setAttribute('cy', '16');
  ellipse.setAttribute('rx', '10');
  ellipse.setAttribute('ry', '9');
  ellipse.setAttribute('fill', fill);
  ellipse.setAttribute('stroke', stroke);
  ellipse.setAttribute('stroke-width', strokeWidth.toString());
  ellipse.setAttribute('stroke-linejoin', 'miter');
  svg.appendChild(ellipse);
}

function drawDiamond(svg: SVGSVGElement, fill: string, stroke: string, strokeWidth: number) {
  const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  polygon.setAttribute('points', '16,3 28,16 16,29 4,16');
  polygon.setAttribute('fill', fill);
  polygon.setAttribute('stroke', stroke);
  polygon.setAttribute('stroke-width', strokeWidth.toString());
  polygon.setAttribute('stroke-linejoin', 'miter');
  svg.appendChild(polygon);
}

function drawTriangle(svg: SVGSVGElement, fill: string, stroke: string, strokeWidth: number) {
  const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  polygon.setAttribute('points', '16,4 28,26 4,26');
  polygon.setAttribute('fill', fill);
  polygon.setAttribute('stroke', stroke);
  polygon.setAttribute('stroke-width', strokeWidth.toString());
  polygon.setAttribute('stroke-linejoin', 'miter');
  svg.appendChild(polygon);
}

function drawCylinder(svg: SVGSVGElement, fill: string, stroke: string, strokeWidth: number) {
  // Top circle
  const top = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  top.setAttribute('cx', '16');
  top.setAttribute('cy', '8');
  top.setAttribute('rx', '9');
  top.setAttribute('ry', '4');
  top.setAttribute('fill', fill);
  top.setAttribute('stroke', stroke);
  top.setAttribute('stroke-width', strokeWidth.toString());
  svg.appendChild(top);

  // Body
  const body = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  body.setAttribute('d', 'M 7 8 L 7 24 Q 16 27 25 24 L 25 8');
  body.setAttribute('fill', fill);
  body.setAttribute('stroke', stroke);
  body.setAttribute('stroke-width', strokeWidth.toString());
  body.setAttribute('stroke-linejoin', 'miter');
  svg.appendChild(body);

  // Bottom circle
  const bottom = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  bottom.setAttribute('cx', '16');
  bottom.setAttribute('cy', '24');
  bottom.setAttribute('rx', '9');
  bottom.setAttribute('ry', '4');
  bottom.setAttribute('fill', fill);
  bottom.setAttribute('stroke', stroke);
  bottom.setAttribute('stroke-width', strokeWidth.toString());
  svg.appendChild(bottom);
}

function drawCloud(svg: SVGSVGElement, fill: string, stroke: string, strokeWidth: number) {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M 6 18 Q 4 13 9 11 Q 10 6 16 6 Q 21 6 23 11 Q 28 13 26 18 Q 28 23 23 25 L 9 25 Q 4 23 6 18 Z');
  path.setAttribute('fill', fill);
  path.setAttribute('stroke', stroke);
  path.setAttribute('stroke-width', strokeWidth.toString());
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('stroke-linecap', 'round');
  svg.appendChild(path);
}

function drawHexagon(svg: SVGSVGElement, fill: string, stroke: string, strokeWidth: number) {
  const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  // Regular hexagon
  polygon.setAttribute('points', '16,3 26,9 26,21 16,27 6,21 6,9');
  polygon.setAttribute('fill', fill);
  polygon.setAttribute('stroke', stroke);
  polygon.setAttribute('stroke-width', strokeWidth.toString());
  polygon.setAttribute('stroke-linejoin', 'miter');
  svg.appendChild(polygon);
}

function drawDoubleEllipse(svg: SVGSVGElement, fill: string, stroke: string, strokeWidth: number) {
  // Outer ellipse
  const outer = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  outer.setAttribute('cx', '16');
  outer.setAttribute('cy', '16');
  outer.setAttribute('rx', '11');
  outer.setAttribute('ry', '10');
  outer.setAttribute('fill', 'none');
  outer.setAttribute('stroke', stroke);
  outer.setAttribute('stroke-width', strokeWidth.toString());
  svg.appendChild(outer);

  // Inner ellipse
  const inner = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  inner.setAttribute('cx', '16');
  inner.setAttribute('cy', '16');
  inner.setAttribute('rx', '7');
  inner.setAttribute('ry', '6');
  inner.setAttribute('fill', fill);
  inner.setAttribute('stroke', stroke);
  inner.setAttribute('stroke-width', strokeWidth.toString());
  svg.appendChild(inner);
}
