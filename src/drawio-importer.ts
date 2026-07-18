/**
 * Draw.io Shape Library Importer
 * Converts draw.io XML shape definitions to our shape library format
 */

import { ShapeDefinition } from './shapes/shapes-library';

export interface DrawioShape {
  name: string;
  label: string;
  width?: number;
  height?: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
}

/**
 * Parse draw.io XML library format
 * Draw.io libraries are typically structured as:
 * <shapes>
 *   <shape name="name" w="width" h="height">
 *     <connections/>
 *     <backgroundFunction name="..."/>
 *     <foregroundFunction name="..."/>
 *   </shape>
 * </shapes>
 */
export function parseDrawioLibrary(xmlContent: string): ShapeDefinition[] {
  const shapes: ShapeDefinition[] = [];

  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

    // Check for parse errors
    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('Invalid XML format');
    }

    // Get all shape elements
    const shapeElements = xmlDoc.querySelectorAll('shape');

    shapeElements.forEach((_elem: Element, index: number) => {
      const htmlElem = _elem as HTMLElement;
      const name = htmlElem.getAttribute('name') || `imported-shape-${index}`;
      const label = htmlElem.getAttribute('label') || name;
      const width = parseInt(htmlElem.getAttribute('w') || '100');
      const height = parseInt(htmlElem.getAttribute('h') || '100');

      // Extract style information if available
      const style = htmlElem.getAttribute('style') || '';
      const fillColor = extractStyleValue(style, 'fillColor') || '#ffffff';
      const strokeColor = extractStyleValue(style, 'strokeColor') || '#000000';
      const strokeWidth = parseInt(extractStyleValue(style, 'strokeWidth') || '1');

      // Determine shape type from the element structure or style
      const shapeType = determineShapeType(htmlElem, style, name);

      shapes.push({
        name: name.toLowerCase().replace(/\s+/g, '-'),
        label: label,
        category: 'Imported from draw.io',
        shape: shapeType,
        width: width || 100,
        height: height || 100,
        fillColor: fillColor,
        strokeColor: strokeColor,
        strokeWidth: strokeWidth,
      });
    });
  } catch (error) {
    console.error('Error parsing draw.io library:', error);
    throw new Error(`Failed to parse draw.io library: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return shapes;
}

/**
 * Extract style value from draw.io style string
 * Format: "key=value;key2=value2;"
 */
function extractStyleValue(style: string, key: string): string | null {
  const regex = new RegExp(`${key}=([^;]*)`);
  const match = style.match(regex);
  return match ? match[1] : null;
}

/**
 * Determine shape type from draw.io element
 */
function determineShapeType(_elem: HTMLElement, style: string, name: string): string {
  const shapeName = name.toLowerCase();

  // Try to determine from style
  if (style.includes('ellipse')) return 'ellipse';
  if (style.includes('rhombus') || style.includes('diamond')) return 'rhombus';
  if (style.includes('triangle')) return 'triangle';
  if (style.includes('cylinder')) return 'cylinder';

  // Try to determine from name
  if (shapeName.includes('ellipse') || shapeName.includes('circle')) return 'ellipse';
  if (shapeName.includes('diamond') || shapeName.includes('rhombus')) return 'rhombus';
  if (shapeName.includes('triangle')) return 'triangle';
  if (shapeName.includes('cylinder')) return 'cylinder';

  // Default to rectangle
  return 'rectangle';
}

/**
 * Import shapes from a draw.io library file
 * User can provide the XML content from a .drawio file or custom library
 */
export function importDrawioLibrary(xmlContent: string, category: string = 'Imported from draw.io'): ShapeDefinition[] {
  const shapes = parseDrawioLibrary(xmlContent);

  // Assign category to all imported shapes
  return shapes.map(shape => ({
    ...shape,
    category: category
  }));
}

/**
 * Load draw.io library from a file
 * This would be called from the UI when user selects a file
 */
export async function loadDrawioFile(file: File): Promise<ShapeDefinition[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const shapes = parseDrawioLibrary(content);
        resolve(shapes);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Merge imported shapes with existing library
 */
export function mergeShapeLibraries(existing: ShapeDefinition[], imported: ShapeDefinition[]): ShapeDefinition[] {
  // Create a map to avoid duplicates by name
  const shapeMap = new Map<string, ShapeDefinition>();

  // Add existing shapes
  existing.forEach(shape => {
    shapeMap.set(shape.name, shape);
  });

  // Add imported shapes (will overwrite if same name)
  imported.forEach(shape => {
    shapeMap.set(shape.name, shape);
  });

  return Array.from(shapeMap.values());
}

/**
 * Export current library as draw.io compatible XML
 */
export function exportAsDrawioLibrary(shapes: ShapeDefinition[]): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<shapes>\n';

  shapes.forEach(shape => {
    const style = buildStyleString(shape);
    xml += `  <shape name="${escapeXml(shape.name)}" label="${escapeXml(shape.label)}" w="${shape.width}" h="${shape.height}" style="${escapeXml(style)}">\n`;
    xml += '    <connections/>\n';
    xml += '  </shape>\n';
  });

  xml += '</shapes>';
  return xml;
}

/**
 * Build style string from shape definition
 */
function buildStyleString(shape: ShapeDefinition): string {
  const parts = [
    `shape=${shape.shape}`,
    `fillColor=${shape.fillColor || '#ffffff'}`,
    `strokeColor=${shape.strokeColor || '#000000'}`,
    `strokeWidth=${shape.strokeWidth || 1}`,
  ];
  return parts.join(';') + ';';
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
