/**
 * Stencil Loader
 * Load shapes from draw.io XML stencil files
 */

export interface StencilShape {
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

export class StencilLoader {
  /**
   * Load and parse stencil files synchronously from imported data
   */
  static loadStencilShapes(xmlContent: string, stencilName: string): StencilShape[] {
    const shapes: StencilShape[] = [];

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlContent, 'text/xml');

      if (doc.getElementsByTagName('parsererror').length > 0) {
        console.warn(`Invalid XML in stencil ${stencilName}`);
        return shapes;
      }

      // Parse shape elements
      const shapeElements = doc.querySelectorAll('shape');
      shapeElements.forEach((element) => {
        const name = element.getAttribute('name');
        if (!name) return;

        const w = parseInt(element.getAttribute('w') || '100');
        const h = parseInt(element.getAttribute('h') || '100');

        // Limit shapes to avoid UI overload
        if (shapes.length > 50) return;

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

        const shape: StencilShape = {
          name: name.replace(/\s+/g, '-').toLowerCase(),
          label: name,
          category: StencilLoader.getCategoryFromStencil(stencilName),
          shape: 'rectangle',
          width: Math.min(w, 120),
          height: Math.min(h, 120),
          fillColor,
          strokeColor,
          strokeWidth: 1,
        };

        shapes.push(shape);
      });
    } catch (err) {
      console.warn(`Error parsing stencil ${stencilName}:`, err);
    }

    return shapes;
  }

  /**
   * Get category name from stencil filename
   */
  static getCategoryFromStencil(stencilName: string): string {
    const categoryMap: { [key: string]: string } = {
      basic: 'Basic Shapes',
      arrows: 'Arrows',
      flowchart: 'Flowchart',
      'aws': 'AWS',
      'aws2': 'AWS',
      'aws3': 'AWS',
      'aws4': 'AWS',
      'azure': 'Azure',
      'gcp': 'Google Cloud',
      'cisco': 'Cisco',
      'citrix': 'Citrix',
      'bpmn': 'BPMN',
      'eip': 'Enterprise Integration',
      'electrical': 'Electrical',
      'floorplan': 'Floorplan',
      'bootstrap': 'Bootstrap',
    };

    return categoryMap[stencilName] || stencilName.replace(/_/g, ' ').charAt(0).toUpperCase() + stencilName.slice(1);
  }

  /**
   * Get list of available stencil files
   */
  static getAvailableStencils(): string[] {
    return [
      'basic',
      'arrows',
      'flowchart',
      'aws',
      'aws2',
      'aws3',
      'aws4',
      'azure',
      'gcp',
      'cisco',
      'citrix',
      'bpmn',
      'bootstrap',
    ];
  }
}
