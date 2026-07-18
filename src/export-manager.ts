/**
 * Export Manager
 * Export diagrams to various formats
 */

export class ExportManager {
  constructor(private graph: any) {}

  exportAsSVG(filename: string = 'diagram.svg'): void {
    try {
      const svgCanvas = this.graph.view.canvas as SVGElement;
      if (!svgCanvas) {
        throw new Error('No canvas available for export');
      }

      // Get all shapes and connections
      const bounds = this.graph.getGraphBounds();

      // Create SVG document
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');

      svg.setAttribute('version', '1.1');
      svg.setAttribute('xmlns', svgNS);
      svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      svg.setAttribute('width', (bounds.width + 40).toString());
      svg.setAttribute('height', (bounds.height + 40).toString());
      svg.setAttribute('viewBox', `${bounds.x - 20} ${bounds.y - 20} ${bounds.width + 40} ${bounds.height + 40}`);

      // White background
      const bgRect = document.createElementNS(svgNS, 'rect');
      bgRect.setAttribute('width', '100%');
      bgRect.setAttribute('height', '100%');
      bgRect.setAttribute('fill', 'white');
      svg.appendChild(bgRect);

      // Clone the canvas content
      const canvasClone = svgCanvas.cloneNode(true) as SVGElement;
      const children = canvasClone.childNodes;
      for (let i = children.length - 1; i >= 0; i--) {
        svg.appendChild(children[i]);
      }

      // Download
      this.downloadSVG(svg, filename);
    } catch (err) {
      throw new Error(`SVG export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  exportAsPNG(filename: string = 'diagram.png'): void {
    try {
      const canvas = this.graph.view.canvas as HTMLCanvasElement;
      if (!canvas) {
        throw new Error('No canvas available for export');
      }

      // Convert canvas to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          this.downloadBlob(blob, filename);
        }
      }, 'image/png');
    } catch (err) {
      throw new Error(`PNG export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  private downloadSVG(svg: SVGElement, filename: string): void {
    const svgString = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    this.downloadBlob(blob, filename);
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  exportAsHTML(filename: string = 'diagram.html'): void {
    try {
      const svgCanvas = this.graph.view.canvas as SVGElement;
      const svgString = new XMLSerializer().serializeToString(svgCanvas);

      const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Diagram</title>
    <style>
        body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
        svg { border: 1px solid #ccc; max-width: 100%; height: auto; }
        .info { margin-top: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <h1>Diagram Export</h1>
    ${svgString}
    <div class="info">
        <p>Exported from railway-drawer (privacy-focused diagram editor)</p>
        <p>Created: ${new Date().toLocaleString()}</p>
    </div>
</body>
</html>`;

      const blob = new Blob([html], { type: 'text/html' });
      this.downloadBlob(blob, filename);
    } catch (err) {
      throw new Error(`HTML export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  getExportBounds(): any {
    return this.graph.getGraphBounds();
  }

  getDiagramDimensions(): { width: number; height: number } {
    const bounds = this.graph.getGraphBounds();
    return {
      width: Math.ceil(bounds.width + 40),
      height: Math.ceil(bounds.height + 40),
    };
  }
}
