/**
 * Comprehensive Shape Library - Similar to draw.io
 * Organized by categories with standard geometric and domain-specific shapes
 */

export interface ShapeDefinition {
  name: string;
  label: string;
  category: string;
  shape: string;
  width: number;
  height: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
}

export const SHAPES_LIBRARY: ShapeDefinition[] = [
  // ============= GENERAL =============
  {
    name: 'rectangle',
    label: 'Rectangle',
    category: 'General',
    shape: 'rectangle',
    width: 120,
    height: 80,
    fillColor: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 1,
  },
  {
    name: 'square',
    label: 'Square',
    category: 'General',
    shape: 'rectangle',
    width: 80,
    height: 80,
    fillColor: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 1,
  },
  {
    name: 'ellipse',
    label: 'Ellipse',
    category: 'General',
    shape: 'ellipse',
    width: 100,
    height: 100,
    fillColor: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 1,
  },
  {
    name: 'circle',
    label: 'Circle',
    category: 'General',
    shape: 'ellipse',
    width: 80,
    height: 80,
    fillColor: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 1,
  },
  {
    name: 'diamond',
    label: 'Diamond',
    category: 'General',
    shape: 'rhombus',
    width: 100,
    height: 100,
    fillColor: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 1,
  },
  {
    name: 'triangle',
    label: 'Triangle',
    category: 'General',
    shape: 'triangle',
    width: 100,
    height: 100,
    fillColor: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 1,
  },
  {
    name: 'pentagon',
    label: 'Pentagon',
    category: 'General',
    shape: 'rectangle',
    width: 100,
    height: 100,
    fillColor: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 1,
  },
  {
    name: 'hexagon',
    label: 'Hexagon',
    category: 'General',
    shape: 'rectangle',
    width: 100,
    height: 100,
    fillColor: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 1,
  },
  {
    name: 'cylinder',
    label: 'Cylinder',
    category: 'General',
    shape: 'cylinder',
    width: 100,
    height: 100,
    fillColor: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 1,
  },

  // ============= FLOWCHART =============
  {
    name: 'process',
    label: 'Process',
    category: 'Flowchart',
    shape: 'rectangle',
    width: 120,
    height: 80,
    fillColor: '#ffffff',
    strokeColor: '#0066cc',
    strokeWidth: 2,
  },
  {
    name: 'terminator',
    label: 'Terminator',
    category: 'Flowchart',
    shape: 'ellipse',
    width: 100,
    height: 60,
    fillColor: '#ffffff',
    strokeColor: '#0066cc',
    strokeWidth: 2,
  },
  {
    name: 'decision',
    label: 'Decision',
    category: 'Flowchart',
    shape: 'rhombus',
    width: 100,
    height: 100,
    fillColor: '#ffffff',
    strokeColor: '#ff9900',
    strokeWidth: 2,
  },
  {
    name: 'data',
    label: 'Data/IO',
    category: 'Flowchart',
    shape: 'rectangle',
    width: 100,
    height: 80,
    fillColor: '#ffffff',
    strokeColor: '#0066cc',
    strokeWidth: 2,
  },
  {
    name: 'document',
    label: 'Document',
    category: 'Flowchart',
    shape: 'rectangle',
    width: 100,
    height: 80,
    fillColor: '#f0f0f0',
    strokeColor: '#0066cc',
    strokeWidth: 2,
  },
  {
    name: 'predefined-process',
    label: 'Predefined Process',
    category: 'Flowchart',
    shape: 'rectangle',
    width: 120,
    height: 80,
    fillColor: '#ffffff',
    strokeColor: '#0066cc',
    strokeWidth: 2,
  },
  {
    name: 'database-flowchart',
    label: 'Database',
    category: 'Flowchart',
    shape: 'cylinder',
    width: 100,
    height: 80,
    fillColor: '#ffffff',
    strokeColor: '#0066cc',
    strokeWidth: 2,
  },

  // ============= BASIC SHAPES =============
  {
    name: 'rounded-rectangle',
    label: 'Rounded Rectangle',
    category: 'Basic',
    shape: 'rectangle',
    width: 120,
    height: 80,
    fillColor: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 1,
  },
  {
    name: 'line',
    label: 'Line',
    category: 'Basic',
    shape: 'rectangle',
    width: 120,
    height: 2,
    fillColor: '#000000',
    strokeColor: '#000000',
    strokeWidth: 1,
  },
  {
    name: 'double-ellipse',
    label: 'Double Ellipse',
    category: 'Basic',
    shape: 'ellipse',
    width: 100,
    height: 100,
    fillColor: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 2,
  },

  // ============= ARROWS & CONNECTORS =============
  {
    name: 'arrow-right',
    label: 'Arrow Right',
    category: 'Arrows',
    shape: 'triangle',
    width: 60,
    height: 40,
    fillColor: '#000000',
    strokeColor: '#000000',
    strokeWidth: 1,
  },
  {
    name: 'arrow-down',
    label: 'Arrow Down',
    category: 'Arrows',
    shape: 'triangle',
    width: 40,
    height: 60,
    fillColor: '#000000',
    strokeColor: '#000000',
    strokeWidth: 1,
  },
  {
    name: 'arrow-left',
    label: 'Arrow Left',
    category: 'Arrows',
    shape: 'triangle',
    width: 60,
    height: 40,
    fillColor: '#000000',
    strokeColor: '#000000',
    strokeWidth: 1,
  },
  {
    name: 'arrow-up',
    label: 'Arrow Up',
    category: 'Arrows',
    shape: 'triangle',
    width: 40,
    height: 60,
    fillColor: '#000000',
    strokeColor: '#000000',
    strokeWidth: 1,
  },

  // ============= DATABASE & ER =============
  {
    name: 'entity',
    label: 'Entity',
    category: 'Entity Relation',
    shape: 'rectangle',
    width: 120,
    height: 80,
    fillColor: '#ffffff',
    strokeColor: '#009900',
    strokeWidth: 2,
  },
  {
    name: 'relationship',
    label: 'Relationship',
    category: 'Entity Relation',
    shape: 'rhombus',
    width: 100,
    height: 100,
    fillColor: '#ffffff',
    strokeColor: '#009900',
    strokeWidth: 2,
  },
  {
    name: 'attribute',
    label: 'Attribute',
    category: 'Entity Relation',
    shape: 'ellipse',
    width: 100,
    height: 80,
    fillColor: '#ffffff',
    strokeColor: '#009900',
    strokeWidth: 2,
  },
  {
    name: 'db-table',
    label: 'Table',
    category: 'Entity Relation',
    shape: 'rectangle',
    width: 120,
    height: 100,
    fillColor: '#ffffff',
    strokeColor: '#009900',
    strokeWidth: 2,
  },

  // ============= UML =============
  {
    name: 'class',
    label: 'Class',
    category: 'UML',
    shape: 'rectangle',
    width: 120,
    height: 150,
    fillColor: '#ffffff',
    strokeColor: '#cc0000',
    strokeWidth: 2,
  },
  {
    name: 'interface',
    label: 'Interface',
    category: 'UML',
    shape: 'rectangle',
    width: 120,
    height: 100,
    fillColor: '#ffffff',
    strokeColor: '#cc0000',
    strokeWidth: 2,
  },
  {
    name: 'usecase',
    label: 'Use Case',
    category: 'UML',
    shape: 'ellipse',
    width: 120,
    height: 80,
    fillColor: '#ffffff',
    strokeColor: '#cc0000',
    strokeWidth: 2,
  },
  {
    name: 'actor',
    label: 'Actor',
    category: 'UML',
    shape: 'triangle',
    width: 60,
    height: 80,
    fillColor: '#ffffff',
    strokeColor: '#cc0000',
    strokeWidth: 2,
  },
  {
    name: 'component',
    label: 'Component',
    category: 'UML',
    shape: 'rectangle',
    width: 120,
    height: 80,
    fillColor: '#ffffff',
    strokeColor: '#cc0000',
    strokeWidth: 2,
  },
  {
    name: 'package',
    label: 'Package',
    category: 'UML',
    shape: 'rectangle',
    width: 120,
    height: 100,
    fillColor: '#ffffff',
    strokeColor: '#cc0000',
    strokeWidth: 2,
  },
  {
    name: 'note',
    label: 'Note',
    category: 'UML',
    shape: 'rectangle',
    width: 100,
    height: 80,
    fillColor: '#ffffcc',
    strokeColor: '#cc9900',
    strokeWidth: 1,
  },

  // ============= NETWORK =============
  {
    name: 'computer',
    label: 'Computer',
    category: 'Network',
    shape: 'rectangle',
    width: 100,
    height: 80,
    fillColor: '#e8f4f8',
    strokeColor: '#0066cc',
    strokeWidth: 2,
  },
  {
    name: 'server',
    label: 'Server',
    category: 'Network',
    shape: 'cylinder',
    width: 80,
    height: 100,
    fillColor: '#e8f4f8',
    strokeColor: '#0066cc',
    strokeWidth: 2,
  },
  {
    name: 'database',
    label: 'Database',
    category: 'Network',
    shape: 'cylinder',
    width: 80,
    height: 100,
    fillColor: '#ffe8e8',
    strokeColor: '#cc0000',
    strokeWidth: 2,
  },
  {
    name: 'mobile',
    label: 'Mobile Device',
    category: 'Network',
    shape: 'rectangle',
    width: 60,
    height: 100,
    fillColor: '#e8f4f8',
    strokeColor: '#0066cc',
    strokeWidth: 2,
  },
  {
    name: 'router',
    label: 'Router',
    category: 'Network',
    shape: 'rectangle',
    width: 100,
    height: 80,
    fillColor: '#e8f4f8',
    strokeColor: '#0066cc',
    strokeWidth: 2,
  },
  {
    name: 'cloud',
    label: 'Cloud',
    category: 'Network',
    shape: 'rectangle',
    width: 120,
    height: 80,
    fillColor: '#e0f2f7',
    strokeColor: '#0066cc',
    strokeWidth: 2,
  },

  // ============= BPMN =============
  {
    name: 'bpmn-start',
    label: 'Start Event',
    category: 'BPMN',
    shape: 'ellipse',
    width: 60,
    height: 60,
    fillColor: '#90EE90',
    strokeColor: '#009900',
    strokeWidth: 2,
  },
  {
    name: 'bpmn-end',
    label: 'End Event',
    category: 'BPMN',
    shape: 'ellipse',
    width: 60,
    height: 60,
    fillColor: '#FFB6C6',
    strokeColor: '#cc0000',
    strokeWidth: 2,
  },
  {
    name: 'bpmn-task',
    label: 'Task',
    category: 'BPMN',
    shape: 'rectangle',
    width: 120,
    height: 80,
    fillColor: '#E3F2FD',
    strokeColor: '#0066cc',
    strokeWidth: 2,
  },
  {
    name: 'bpmn-gateway',
    label: 'Gateway',
    category: 'BPMN',
    shape: 'rhombus',
    width: 80,
    height: 80,
    fillColor: '#FFF9C4',
    strokeColor: '#ff9900',
    strokeWidth: 2,
  },

  // ============= CONTAINER =============
  {
    name: 'group',
    label: 'Group/Container',
    category: 'Container',
    shape: 'rectangle',
    width: 200,
    height: 150,
    fillColor: '#f0f0f0',
    strokeColor: '#666666',
    strokeWidth: 1,
  },
  {
    name: 'subsystem',
    label: 'Subsystem',
    category: 'Container',
    shape: 'rectangle',
    width: 200,
    height: 150,
    fillColor: '#ffffff',
    strokeColor: '#333333',
    strokeWidth: 2,
  },

  // ============= MOCKUP UI =============
  {
    name: 'textbox',
    label: 'Text Box',
    category: 'Mockup',
    shape: 'rectangle',
    width: 120,
    height: 40,
    fillColor: '#ffffff',
    strokeColor: '#cccccc',
    strokeWidth: 1,
  },
  {
    name: 'button',
    label: 'Button',
    category: 'Mockup',
    shape: 'rectangle',
    width: 100,
    height: 40,
    fillColor: '#0066cc',
    strokeColor: '#0066cc',
    strokeWidth: 1,
  },
  {
    name: 'panel',
    label: 'Panel',
    category: 'Mockup',
    shape: 'rectangle',
    width: 200,
    height: 150,
    fillColor: '#f9f9f9',
    strokeColor: '#cccccc',
    strokeWidth: 1,
  },
  {
    name: 'checkbox',
    label: 'Checkbox',
    category: 'Mockup',
    shape: 'rectangle',
    width: 40,
    height: 40,
    fillColor: '#ffffff',
    strokeColor: '#666666',
    strokeWidth: 1,
  },
  {
    name: 'radiobutton',
    label: 'Radio Button',
    category: 'Mockup',
    shape: 'ellipse',
    width: 40,
    height: 40,
    fillColor: '#ffffff',
    strokeColor: '#666666',
    strokeWidth: 1,
  },

  // ============= SWIMLANE =============
  {
    name: 'swimlane-horizontal',
    label: 'Swimlane (Horizontal)',
    category: 'Swimlane',
    shape: 'rectangle',
    width: 400,
    height: 100,
    fillColor: '#f0f0f0',
    strokeColor: '#333333',
    strokeWidth: 2,
  },
  {
    name: 'swimlane-vertical',
    label: 'Swimlane (Vertical)',
    category: 'Swimlane',
    shape: 'rectangle',
    width: 100,
    height: 400,
    fillColor: '#f0f0f0',
    strokeColor: '#333333',
    strokeWidth: 2,
  },

  // ============= MISC =============
  {
    name: 'comment',
    label: 'Comment',
    category: 'Misc',
    shape: 'rectangle',
    width: 100,
    height: 80,
    fillColor: '#ffffcc',
    strokeColor: '#cccc00',
    strokeWidth: 1,
  },
  {
    name: 'callout',
    label: 'Callout',
    category: 'Misc',
    shape: 'rectangle',
    width: 120,
    height: 80,
    fillColor: '#f0f0f0',
    strokeColor: '#000000',
    strokeWidth: 1,
  },
  {
    name: 'image-placeholder',
    label: 'Image',
    category: 'Misc',
    shape: 'rectangle',
    width: 100,
    height: 100,
    fillColor: '#e8e8e8',
    strokeColor: '#999999',
    strokeWidth: 1,
  },
];

/**
 * Get all unique categories from shapes library
 */
export function getCategories(): string[] {
  const categories = new Set<string>();
  SHAPES_LIBRARY.forEach((shape) => {
    categories.add(shape.category);
  });
  return Array.from(categories).sort();
}

/**
 * Get shapes by category
 */
export function getShapesByCategory(category: string): ShapeDefinition[] {
  return SHAPES_LIBRARY.filter((shape) => shape.category === category);
}

/**
 * Search shapes by name or label
 */
export function searchShapes(query: string): ShapeDefinition[] {
  const lowerQuery = query.toLowerCase();
  return SHAPES_LIBRARY.filter(
    (shape) =>
      shape.name.toLowerCase().includes(lowerQuery) ||
      shape.label.toLowerCase().includes(lowerQuery) ||
      shape.category.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get shape definition by name
 */
export function getShapeByName(name: string): ShapeDefinition | undefined {
  return SHAPES_LIBRARY.find((shape) => shape.name === name);
}

/**
 * Load shapes from draw.io stencil XML files
 */
export async function loadStencilShapes(stencilName: string): Promise<ShapeDefinition[]> {
  const shapes: ShapeDefinition[] = [];

  try {
    // Fetch stencil XML file
    const response = await fetch(`/src/stencils/${stencilName}.xml`);
    if (!response.ok) {
      console.warn(`Stencil ${stencilName} not found`);
      return shapes;
    }

    const xmlContent = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');

    if (doc.getElementsByTagName('parsererror').length > 0) {
      console.warn(`Invalid XML in stencil ${stencilName}`);
      return shapes;
    }

    // Parse shape elements (limit to first 100 to avoid UI overload)
    const shapeElements = Array.from(doc.querySelectorAll('shape')).slice(0, 100);

    shapeElements.forEach((element) => {
      const name = element.getAttribute('name');
      if (!name) return;

      const w = parseInt(element.getAttribute('w') || '100');
      const h = parseInt(element.getAttribute('h') || '100');

      // Extract color info
      let fillColor = '#ffffff';
      let strokeColor = '#000000';
      const fillAttr = element.getAttribute('fillColor');
      const strokeAttr = element.getAttribute('strokeColor');

      if (fillAttr && fillAttr !== 'none') {
        fillColor = fillAttr.startsWith('#') ? fillAttr : `#${fillAttr}`;
      }
      if (strokeAttr && strokeAttr !== 'none') {
        strokeColor = strokeAttr.startsWith('#') ? strokeAttr : `#${strokeAttr}`;
      }

      const categoryMap: { [key: string]: string } = {
        basic: 'Basic Shapes',
        arrows: 'Arrows',
        flowchart: 'Flowchart',
        aws: 'AWS',
        aws2: 'AWS',
        aws3: 'AWS',
        aws4: 'AWS',
        azure: 'Azure',
        gcp: 'Google Cloud',
        cisco: 'Cisco',
      };

      const shape: ShapeDefinition = {
        name: `${stencilName}-${name.replace(/\s+/g, '-').toLowerCase()}`,
        label: name,
        category: categoryMap[stencilName] || stencilName.charAt(0).toUpperCase() + stencilName.slice(1),
        shape: 'rectangle',
        width: Math.min(w, 120),
        height: Math.min(h, 120),
        fillColor,
        strokeColor,
        strokeWidth: 1,
      };

      shapes.push(shape);
    });

    // Add loaded shapes to library
    shapes.forEach((shape) => {
      if (!SHAPES_LIBRARY.find((s) => s.name === shape.name)) {
        SHAPES_LIBRARY.push(shape);
      }
    });
  } catch (err) {
    console.warn(`Error loading stencil ${stencilName}:`, err);
  }

  return shapes;
}

/**
 * Load multiple stencils
 */
export async function loadStencils(stencilNames: string[]): Promise<void> {
  for (const stencilName of stencilNames) {
    await loadStencilShapes(stencilName);
  }
}
