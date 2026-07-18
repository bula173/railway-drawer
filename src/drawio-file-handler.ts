/**
 * Draw.io File Handler
 * Load and save complete diagram files in draw.io format
 */

export class DrawioFileHandler {
  constructor(private graph: any) {}

  /**
   * Export diagram to draw.io XML format
   */
  exportToDrawio(filename: string = 'diagram.drawio'): void {
    try {
      const xmlContent = this.generateDrawioXML();
      const blob = new Blob([xmlContent], { type: 'application/xml' });
      this.downloadFile(blob, filename);
    } catch (err) {
      throw new Error(`Export to draw.io failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  /**
   * Import diagram from draw.io file
   */
  importFromDrawio(file: File): Promise<any> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const xmlContent = event.target?.result as string;
          const diagram = this.parseDrawioXML(xmlContent);
          resolve(diagram);
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
   * Generate draw.io compatible XML from current diagram
   */
  private generateDrawioXML(): string {
    const mxFileElement = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="railway-drawer" modified="${new Date().toISOString()}" agent="railway-drawer/0.5.0" version="1.0">
  <diagram name="Page-1" id="diagram-1">
    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
${this.generateCellsXML()}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
    return mxFileElement;
  }

  /**
   * Generate XML for all cells (vertices and edges)
   */
  private generateCellsXML(): string {
    const cells: string[] = [];
    const parent = this.graph.getDefaultParent();

    if (!parent || !parent.children) {
      return '';
    }

    parent.children.forEach((cell: any, index: number) => {
      if (cell.isVertex && cell.isVertex()) {
        const geo = cell.geometry;
        const style = this.buildStyleString(cell.style || {});

        cells.push(`        <mxCell id="cell-${index}" value="${this.escapeXml(cell.value || '')}" style="${style}" vertex="1" parent="1">
          <mxGeometry x="${geo.x}" y="${geo.y}" width="${geo.width}" height="${geo.height}" as="geometry"/>
        </mxCell>`);
      } else if (cell.isEdge && cell.isEdge()) {
        const style = this.buildStyleString(cell.style || {});
        const sourceId = cell.source?.id || '';
        const targetId = cell.target?.id || '';

        cells.push(`        <mxCell id="edge-${index}" value="${this.escapeXml(cell.value || '')}" style="${style}" edge="1" parent="1" source="${sourceId}" target="${targetId}">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>`);
      }
    });

    return cells.join('\n');
  }

  /**
   * Build draw.io style string from cell style object
   */
  private buildStyleString(style: any): string {
    const parts: string[] = [];

    if (style.shape) parts.push(`shape=${style.shape}`);
    if (style.fillColor) parts.push(`fillColor=${style.fillColor}`);
    if (style.strokeColor) parts.push(`strokeColor=${style.strokeColor}`);
    if (style.strokeWidth) parts.push(`strokeWidth=${style.strokeWidth}`);
    if (style.fontColor) parts.push(`fontColor=${style.fontColor}`);
    if (style.fontSize) parts.push(`fontSize=${style.fontSize}`);
    if (style.rotation) parts.push(`rotation=${style.rotation}`);
    if (style.flipH) parts.push(`flipH=${style.flipH}`);
    if (style.flipV) parts.push(`flipV=${style.flipV}`);

    return parts.join(';') + ';';
  }

  /**
   * Parse draw.io XML and extract diagram data
   */
  private parseDrawioXML(xmlContent: string): any {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('Invalid XML format');
    }

    const cells = xmlDoc.querySelectorAll('mxCell');
    const diagram: any = {
      cells: [],
      edges: [],
    };

    cells.forEach((cell: Element) => {
      const id = cell.getAttribute('id');
      const value = cell.getAttribute('value') || '';
      const style = cell.getAttribute('style') || '';
      const isVertex = cell.getAttribute('vertex') === '1';
      const isEdge = cell.getAttribute('edge') === '1';

      if (id === '0' || id === '1') return; // Skip root cells

      const geo = cell.querySelector('mxGeometry');
      const x = parseInt(geo?.getAttribute('x') || '0');
      const y = parseInt(geo?.getAttribute('y') || '0');
      const width = parseInt(geo?.getAttribute('width') || '100');
      const height = parseInt(geo?.getAttribute('height') || '100');

      if (isVertex) {
        diagram.cells.push({
          id,
          value,
          x,
          y,
          width,
          height,
          style: this.parseStyleString(style),
        });
      } else if (isEdge) {
        const source = cell.getAttribute('source');
        const target = cell.getAttribute('target');
        diagram.edges.push({
          id,
          value,
          source,
          target,
          style: this.parseStyleString(style),
        });
      }
    });

    return diagram;
  }

  /**
   * Parse draw.io style string into object
   */
  private parseStyleString(style: string): any {
    const obj: any = {};
    const parts = style.split(';');

    parts.forEach((part) => {
      const [key, value] = part.split('=');
      if (key && value) {
        obj[key.trim()] = value.trim();
      }
    });

    return obj;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Download file helper
   */
  private downloadFile(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
