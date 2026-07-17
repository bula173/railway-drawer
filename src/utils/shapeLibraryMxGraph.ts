/**
 * @file shapeLibraryMxGraph.ts
 * @brief Shape library manager for mxGraph integration
 *
 * Handles:
 * - Loading shapes from draw.io
 * - Managing custom shape library
 * - Converting shapes for mxGraph
 */

import { logger } from './logger';
import type { ToolboxItem } from '../components/Toolbox';

const DRAIO_SHAPE_SOURCES = {
  general: 'https://raw.githubusercontent.com/jgraph/drawio/dev/src/main/resources/shapes/general.xml',
  railway: 'https://raw.githubusercontent.com/jgraph/drawio/dev/src/main/resources/shapes/railway.xml',
  flowchart: 'https://raw.githubusercontent.com/jgraph/drawio/dev/src/main/resources/shapes/flowchart.xml',
  uml: 'https://raw.githubusercontent.com/jgraph/drawio/dev/src/main/resources/shapes/uml.xml',
};

interface ShapeDefinition {
  id: string;
  name: string;
  width: number;
  height: number;
  svg?: string;
  style?: string;
  description?: string;
}

/**
 * Load shapes from draw.io repository
 */
export async function loadDrawioShapes(category: keyof typeof DRAIO_SHAPE_SOURCES): Promise<ShapeDefinition[]> {
  try {
    const url = DRAIO_SHAPE_SOURCES[category];
    if (!url) {
      logger.warn('shapeLibraryMxGraph', 'Unknown shape category', { category });
      return [];
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch shapes: ${response.statusText}`);
    }

    const xmlText = await response.text();
    const shapes = parseShapeXml(xmlText, category);

    logger.debug('shapeLibraryMxGraph', 'Loaded shapes', {
      category,
      count: shapes.length,
    });

    return shapes;
  } catch (error) {
    logger.error('shapeLibraryMxGraph', 'Failed to load draw.io shapes', {
      category,
      error,
    });
    return [];
  }
}

/**
 * Parse draw.io shape XML format
 */
function parseShapeXml(xmlText: string, category: string): ShapeDefinition[] {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('XML parse error');
    }

    const shapes: ShapeDefinition[] = [];
    const shapeElements = xmlDoc.getElementsByTagName('shape');

    for (let i = 0; i < Math.min(shapeElements.length, 50); i++) {
      const elem = shapeElements[i];
      const name = elem.getAttribute('name') || `${category}_shape_${i}`;
      const w = parseInt(elem.getAttribute('w') || '80', 10);
      const h = parseInt(elem.getAttribute('h') || '60', 10);

      shapes.push({
        id: `${category}_${name.replace(/\s+/g, '_').toLowerCase()}`,
        name,
        width: w,
        height: h,
        description: `${category} shape`,
      });
    }

    return shapes;
  } catch (error) {
    logger.error('shapeLibraryMxGraph', 'Failed to parse shape XML', { error });
    return [];
  }
}

/**
 * Convert draw.io shapes to ToolboxItem format
 */
export function shapesToToolboxItems(shapes: ShapeDefinition[], group: string): ToolboxItem[] {
  return shapes.map(shape => ({
    id: shape.id,
    name: shape.name,
    group,
    width: shape.width,
    height: shape.height,
    shapeElements: [
      {
        id: shape.id,
        svg: shape.svg || createPlaceholderSvg(shape.width, shape.height),
      },
    ],
    dimensionality: '2D',
  }));
}

/**
 * Create placeholder SVG for shapes
 */
function createPlaceholderSvg(width: number, height: number): string {
  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#e8f4f8" stroke="#1976d2" stroke-width="2" rx="4"/>
      <text x="${width / 2}" y="${height / 2}" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="#1976d2">Shape</text>
    </svg>
  `;
}

/**
 * Create SVG representation of shape for canvas
 */
export function createShapeSvg(item: ToolboxItem): string {
  if (item.shapeElements && item.shapeElements.length > 0) {
    return item.shapeElements[0].svg || createPlaceholderSvg(item.width, item.height);
  }
  return createPlaceholderSvg(item.width, item.height);
}

/**
 * Initialize mxGraph with shape library
 */
export async function initializeShapeLibrary(graph: any, mx: any): Promise<ToolboxItem[]> {
  try {
    const allItems: ToolboxItem[] = [];

    // Load general shapes
    const generalShapes = await loadDrawioShapes('general');
    allItems.push(...shapesToToolboxItems(generalShapes, 'General'));

    // Load flowchart shapes
    const flowchartShapes = await loadDrawioShapes('flowchart');
    allItems.push(...shapesToToolboxItems(flowchartShapes, 'Flowchart'));

    logger.debug('shapeLibraryMxGraph', 'Shape library initialized', {
      totalShapes: allItems.length,
    });

    return allItems;
  } catch (error) {
    logger.error('shapeLibraryMxGraph', 'Failed to initialize shape library', { error });
    return [];
  }
}

/**
 * Add shape to mxGraph from ToolboxItem
 */
export function addShapeToGraph(
  graph: any,
  item: ToolboxItem,
  x: number,
  y: number,
  mx?: any
): any {
  try {
    const parent = graph.getDefaultParent();
    const svg = createShapeSvg(item);

    // Create data URI from SVG
    const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
    const svgUrl = URL.createObjectURL(svgBlob);

    // Insert vertex with SVG image
    const vertex = graph.insertVertex(
      parent,
      null,
      item.name,
      x,
      y,
      item.width,
      item.height,
      `image;image=${svgUrl};aspect=fixed`
    );

    logger.debug('shapeLibraryMxGraph', 'Shape added to graph', {
      shapeId: item.id,
      shapeName: item.name,
    });

    return vertex;
  } catch (error) {
    logger.error('shapeLibraryMxGraph', 'Failed to add shape to graph', { error, item });
    throw error;
  }
}

/**
 * Create custom shape from SVG
 */
export function createCustomShape(
  graph: any,
  name: string,
  svg: string,
  x: number,
  y: number,
  width: number = 80,
  height: number = 60
): any {
  try {
    const parent = graph.getDefaultParent();

    // Create data URI from SVG
    const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
    const svgUrl = URL.createObjectURL(svgBlob);

    const vertex = graph.insertVertex(
      parent,
      null,
      name,
      x,
      y,
      width,
      height,
      `image;image=${svgUrl};aspect=fixed`
    );

    return vertex;
  } catch (error) {
    logger.error('shapeLibraryMxGraph', 'Failed to create custom shape', { error, name });
    throw error;
  }
}

/**
 * Handle drop event from toolbox to graph
 */
export function handleToolboxDrop(
  event: React.DragEvent,
  graph: any,
  containerRef: React.RefObject<HTMLDivElement>,
  item: ToolboxItem
): void {
  try {
    event.preventDefault();
    event.stopPropagation();

    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / graph.getView().getScale();
    const y = (event.clientY - rect.top) / graph.getView().getScale();

    addShapeToGraph(graph, item, x, y);
  } catch (error) {
    logger.error('shapeLibraryMxGraph', 'Failed to handle toolbox drop', { error });
  }
}

/**
 * Export shapes from graph as draw.io compatible format
 */
export function exportShapesAsDrawio(graph: any, mx: any): string {
  try {
    const encoder = new mx.mxCodec();
    const node = encoder.encode(graph.getModel());
    return mx.mxUtils.getXml(node);
  } catch (error) {
    logger.error('shapeLibraryMxGraph', 'Failed to export shapes', { error });
    throw error;
  }
}
