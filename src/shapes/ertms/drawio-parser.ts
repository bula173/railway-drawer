/**
 * @file drawio-parser.ts
 * @brief Parse draw.io shape definitions for complex editable shapes
 * @details
 * Converts draw.io mxGraphModel XML to editable shape components
 * Each shape can be composed of multiple elements (cells, geometries, styles)
 */

export interface DrawioCell {
  id: string;
  parent: string;
  style?: string;
  value?: string;
  vertex?: boolean;
  edge?: boolean;
  geometry?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    relative?: boolean;
    as?: string;
    points?: Array<{ x: number; y: number }>;
  };
}

export interface DrawioShapeDefinition {
  title: string;
  width: number;
  height: number;
  cells: DrawioCell[];
  rootId: string;
}

/**
 * Parse draw.io XML shape definition
 */
export function parseDrawioShape(xml: string, title: string, w: number, h: number): DrawioShapeDefinition {
  const cells: DrawioCell[] = [];

  // Parse XML to extract cells
  const parser = new DOMParser();
  try {
    const doc = parser.parseFromString(xml, 'text/xml');
    const cellNodes = doc.getElementsByTagName('mxCell');

    let rootId = '0';

    Array.from(cellNodes).forEach((node) => {
      const cell: DrawioCell = {
        id: node.getAttribute('id') || '',
        parent: node.getAttribute('parent') || '',
        style: node.getAttribute('style') || undefined,
        value: node.getAttribute('value') || undefined,
        vertex: node.getAttribute('vertex') === '1',
        edge: node.getAttribute('edge') === '1',
      };

      // Parse geometry
      const geoNode = node.getElementsByTagName('mxGeometry')[0];
      if (geoNode) {
        cell.geometry = {
          x: geoNode.getAttribute('x') ? parseFloat(geoNode.getAttribute('x')!) : undefined,
          y: geoNode.getAttribute('y') ? parseFloat(geoNode.getAttribute('y')!) : undefined,
          width: geoNode.getAttribute('width') ? parseFloat(geoNode.getAttribute('width')!) : undefined,
          height: geoNode.getAttribute('height') ? parseFloat(geoNode.getAttribute('height')!) : undefined,
          relative: geoNode.getAttribute('relative') === '1',
          as: geoNode.getAttribute('as') || undefined,
        };

        // Parse points (for edges/lines)
        const pointNodes = geoNode.getElementsByTagName('mxPoint');
        if (pointNodes.length > 0) {
          cell.geometry.points = Array.from(pointNodes).map((p) => ({
            x: parseFloat(p.getAttribute('x') || '0'),
            y: parseFloat(p.getAttribute('y') || '0'),
          }));
        }
      }

      cells.push(cell);

      if (cell.id === '1') {
        rootId = cell.id;
      }
    });
  } catch (error) {
    console.error('[DrawioParser] Failed to parse XML:', error);
  }

  return {
    title,
    width: w,
    height: h,
    cells,
    rootId,
  };
}

/**
 * Extract editable components from shape definition
 */
export function extractComponents(shape: DrawioShapeDefinition): DrawioCell[] {
  // Get all cells that are direct children of root (id='1')
  return shape.cells.filter((cell) => cell.parent === shape.rootId && cell.id !== '0' && cell.id !== '1');
}

/**
 * Generate shape class definition from parsed draw.io shape
 */
export function generateShapeClass(shape: DrawioShapeDefinition): string {
  const components = extractComponents(shape);
  const className = shape.title.replace(/\s+/g, '');

  const componentCode = components
    .map((comp) => {
      const style = comp.style || '';
      const isEdge = comp.edge;
      const isVertex = comp.vertex;

      if (isVertex) {
        return `
    // ${comp.value || comp.id}
    const comp${comp.id} = {
      type: 'vertex',
      style: '${style}',
      x: ${comp.geometry?.x || 0},
      y: ${comp.geometry?.y || 0},
      width: ${comp.geometry?.width || 50},
      height: ${comp.geometry?.height || 50}
    };`;
      } else if (isEdge) {
        return `
    // Edge: ${comp.id}
    const comp${comp.id} = {
      type: 'edge',
      style: '${style}',
      value: '${comp.value || ''}'
    };`;
      }

      return '';
    })
    .join('\n');

  return `
/**
 * Complex shape: ${shape.title}
 * Imported from draw.io
 * Width: ${shape.width}, Height: ${shape.height}
 */
export class ${className}Shape extends ComplexShape {
  paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    // Render composite shape with ${components.length} components
    ${componentCode}

    // TODO: Implement rendering based on component definitions
  }

  // Properties editable via Properties Panel
  getEditableProperties(): Record<string, any> {
    return {
      ${components.map((comp) => `'${comp.id}': { style: '${comp.style}' }`).join(',\n      ')}
    };
  }
}
`;
}
