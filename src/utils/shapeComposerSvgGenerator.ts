/**
 * @file shapeComposerSvgGenerator.ts
 * @brief Converts composed shapes to SVG and toolbox items
 *
 * Generates SVG markup from ComposedShape objects and creates
 * compatible ToolboxItem entries for use in the main canvas
 */

import type { ComposedShape, PrimitiveElement } from '../types';
import type { ToolboxItem } from '../components/Toolbox';
import { logger } from './logger';

/**
 * Generate inline SVG from a composed shape
 */
export function generateSVGFromShape(shape: ComposedShape): string {
  try {
    const elements = shape.elements
      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
      .map(elem => generateSVGElement(elem))
      .join('\n');

    const svg = `<svg width="${shape.width}" height="${shape.height}" viewBox="0 0 ${shape.width} ${shape.height}" xmlns="http://www.w3.org/2000/svg">${elements}</svg>`;

    logger.debug('ShapeComposerSvgGenerator', 'Generated SVG from shape', {
      shapeId: shape.id,
      shapeName: shape.name,
      elementCount: shape.elements.length,
      svgLength: svg.length,
    });

    return svg;
  } catch (error) {
    logger.error('ShapeComposerSvgGenerator', 'Failed to generate SVG', {
      shapeId: shape.id,
      error,
    });
    throw error;
  }
}

/**
 * Generate SVG element for a primitive
 */
function generateSVGElement(elem: PrimitiveElement): string {
  const baseAttrs = buildBaseAttributes(elem);

  switch (elem.type) {
    case 'circle':
      if (!elem.circle) throw new Error('Circle element missing circle properties');
      return `<circle cx="${elem.x}" cy="${elem.y}" r="${elem.circle.radius}" ${baseAttrs} />`;

    case 'line':
      if (!elem.line) throw new Error('Line element missing line properties');
      return `<line x1="${elem.x}" y1="${elem.y}" x2="${elem.line.x2}" y2="${elem.line.y2}" ${baseAttrs} />`;

    case 'rectangle':
      if (!elem.rectangle) throw new Error('Rectangle element missing rectangle properties');
      const rx = elem.rectangle.rx ? ` rx="${elem.rectangle.rx}"` : '';
      return `<rect x="${elem.x}" y="${elem.y}" width="${elem.rectangle.width}" height="${elem.rectangle.height}"${rx} ${baseAttrs} />`;

    case 'polygon':
      if (!elem.polygon) throw new Error('Polygon element missing polygon properties');
      const points = elem.polygon.points
        .map(p => `${p.x},${p.y}`)
        .join(' ');
      return `<polygon points="${points}" ${baseAttrs} />`;

    case 'path':
      if (!elem.path) throw new Error('Path element missing path properties');
      return `<path d="${elem.path.d}" ${baseAttrs} />`;

    case 'text':
      if (!elem.text) throw new Error('Text element missing text properties');
      const textAttrs = buildTextAttributes(elem);
      return `<text x="${elem.x}" y="${elem.y}" ${textAttrs} ${baseAttrs}>${escapeHtml(elem.text.content)}</text>`;

    case 'arc':
      if (!elem.arc) throw new Error('Arc element missing arc properties');
      return generateArcPath(elem, baseAttrs);

    default:
      throw new Error(`Unknown primitive type: ${(elem as any).type}`);
  }
}

/**
 * Build common SVG attributes
 */
function buildBaseAttributes(elem: PrimitiveElement): string {
  const attrs: string[] = [];

  if (elem.fill) attrs.push(`fill="${elem.fill}"`);
  if (elem.stroke) attrs.push(`stroke="${elem.stroke}"`);
  if (elem.strokeWidth !== undefined) attrs.push(`stroke-width="${elem.strokeWidth}"`);
  if (elem.opacity !== undefined) attrs.push(`opacity="${elem.opacity}"`);

  if (elem.rotation && elem.rotation !== 0) {
    attrs.push(`transform="rotate(${elem.rotation} ${elem.x} ${elem.y})"`);
  }

  if (elem.type !== 'text' && elem.type !== 'line') {
    attrs.push('vector-effect="non-scaling-stroke"');
  }

  return attrs.join(' ');
}

/**
 * Build text-specific attributes
 */
function buildTextAttributes(elem: PrimitiveElement): string {
  if (!elem.text) return '';

  const attrs: string[] = [];
  attrs.push(`font-size="${elem.text.fontSize}"`);

  if (elem.text.fontFamily) {
    attrs.push(`font-family="${elem.text.fontFamily}"`);
  }

  if (elem.text.textAnchor) {
    attrs.push(`text-anchor="${elem.text.textAnchor}"`);
  }

  if (elem.text.dominantBaseline) {
    attrs.push(`dominant-baseline="${elem.text.dominantBaseline}"`);
  }

  return attrs.join(' ');
}

/**
 * Generate arc as path
 */
function generateArcPath(elem: PrimitiveElement, baseAttrs: string): string {
  if (!elem.arc) throw new Error('Missing arc properties');

  const { radius, startAngle, endAngle } = elem.arc;
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;

  const x1 = elem.x + radius * Math.cos(startRad);
  const y1 = elem.y + radius * Math.sin(startRad);
  const x2 = elem.x + radius * Math.cos(endRad);
  const y2 = elem.y + radius * Math.sin(endRad);

  const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
  const d = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;

  return `<path d="${d}" fill="none" ${baseAttrs} />`;
}

/**
 * Convert composed shape to ToolboxItem
 */
export function generateToolboxItem(shape: ComposedShape): ToolboxItem {
  const svg = generateSVGFromShape(shape);

  const item: ToolboxItem = {
    id: `custom_${shape.id}`,
    name: shape.name,
    type: 'custom',
    group: shape.group || 'Custom Shapes',
    iconSvg: svg,
    shape: svg,
    width: shape.width,
    height: shape.height,
    dimensionality: '2D',
    shapeElements: [
      {
        id: `element_${shape.id}`,
        svg: svg,
      },
    ],
  };

  logger.debug('ShapeComposerSvgGenerator', 'Generated toolbox item', {
    itemId: item.id,
    name: item.name,
    group: item.group,
  });

  return item;
}

/**
 * Convert multiple shapes to toolbox items
 */
export function generateToolboxItems(shapes: ComposedShape[]): ToolboxItem[] {
  return shapes.map(shape => generateToolboxItem(shape));
}

/**
 * Escape HTML special characters for text content
 */
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, char => map[char]);
}

/**
 * Create thumbnail SVG for shape preview
 */
export function generateThumbnail(shape: ComposedShape, size: number = 64): string {
  const scale = Math.min(size / shape.width, size / shape.height);
  const offsetX = (size - shape.width * scale) / 2;
  const offsetY = (size - shape.height * scale) / 2;

  const elements = shape.elements
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
    .map(elem => generateScaledSVGElement(elem, scale, offsetX, offsetY))
    .join('\n');

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${elements}</svg>`;
}

/**
 * Generate scaled SVG element for thumbnail
 */
function generateScaledSVGElement(
  elem: PrimitiveElement,
  scale: number,
  offsetX: number,
  offsetY: number
): string {
  const scaledElem: PrimitiveElement = {
    ...elem,
    x: elem.x * scale + offsetX,
    y: elem.y * scale + offsetY,
    ...(elem.circle && {
      circle: { radius: elem.circle.radius * scale },
    }),
    ...(elem.line && {
      line: { x2: elem.line.x2 * scale + offsetX, y2: elem.line.y2 * scale + offsetY },
    }),
    ...(elem.rectangle && {
      rectangle: {
        ...elem.rectangle,
        width: elem.rectangle.width * scale,
        height: elem.rectangle.height * scale,
        rx: elem.rectangle.rx ? elem.rectangle.rx * scale : undefined,
      },
    }),
    ...(elem.polygon && {
      polygon: {
        points: elem.polygon.points.map(p => ({
          x: p.x * scale + offsetX,
          y: p.y * scale + offsetY,
        })),
      },
    }),
    ...(elem.text && {
      text: {
        ...elem.text,
        fontSize: elem.text.fontSize * scale,
      },
    }),
    ...(elem.arc && {
      arc: {
        ...elem.arc,
        radius: elem.arc.radius * scale,
      },
    }),
  };

  return generateSVGElement(scaledElem);
}
