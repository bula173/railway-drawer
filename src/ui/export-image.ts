import { Graph } from '@maxgraph/core';

export class ExportImageController {
  private graph: Graph;

  constructor(graph: Graph) {
    this.graph = graph;
    this.setupExportButtons();
  }

  private setupExportButtons(): void {
    const exportPngBtn = document.getElementById('btn-export-png');
    const exportSvgBtn = document.getElementById('btn-export-svg');

    if (exportPngBtn) {
      exportPngBtn.addEventListener('click', () => this.exportToPNG());
    }
    if (exportSvgBtn) {
      exportSvgBtn.addEventListener('click', () => this.exportToSVG());
    }
  }

  exportToPNG(): void {
    try {
      const canvas = this.createCanvas();
      if (!canvas) return;

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `diagram-${Date.now()}.png`;
      link.click();

      console.log('[ExportImage] Diagram exported as PNG');
    } catch (error) {
      console.error('[ExportImage] PNG export failed:', error);
      alert('Failed to export as PNG');
    }
  }

  exportToSVG(): void {
    try {
      const svg = this.createSVG();
      if (!svg) return;

      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `diagram-${Date.now()}.svg`;
      link.click();
      URL.revokeObjectURL(url);

      console.log('[ExportImage] Diagram exported as SVG');
    } catch (error) {
      console.error('[ExportImage] SVG export failed:', error);
      alert('Failed to export as SVG');
    }
  }

  private createCanvas(): HTMLCanvasElement | null {
    const model = (this.graph as any).getModel();

    // Get bounds
    const cells = (model as any).cells || {};
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    Object.values(cells).forEach((cell: any) => {
      if (cell.geometry) {
        minX = Math.min(minX, cell.geometry.x);
        minY = Math.min(minY, cell.geometry.y);
        maxX = Math.max(maxX, cell.geometry.x + cell.geometry.width);
        maxY = Math.max(maxY, cell.geometry.y + cell.geometry.height);
      }
    });

    if (!isFinite(minX) || !isFinite(minY)) {
      alert('No objects to export');
      return null;
    }

    const padding = 20;
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    // Render graph to canvas
    const renderCanvas = (this.graph as any).getCanvas?.() as HTMLCanvasElement;
    if (renderCanvas && renderCanvas.toDataURL) {
      try {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(
            img,
            minX - padding,
            minY - padding,
            (maxX - minX) + padding * 2,
            (maxY - minY) + padding * 2,
            0,
            0,
            width,
            height
          );
        };
        img.src = renderCanvas.toDataURL();
      } catch (e) {
        console.log('[ExportImage] Canvas rendering, using SVG fallback');
      }
    }

    // Alternative: render via SVG
    try {
      const svgString = this.createSVGString(minX - padding, minY - padding);
      const svg = new Image();
      svg.onload = () => {
        ctx.drawImage(svg, 0, 0);
      };
      svg.src = 'data:image/svg+xml;base64,' + btoa(svgString);
    } catch (e) {
      console.log('[ExportImage] SVG rendering failed');
    }

    return canvas;
  }

  private createSVG(): string | null {
    const svgString = this.createSVGString(0, 0);
    return svgString || null;
  }

  private createSVGString(offsetX: number, offsetY: number): string {
    const model = (this.graph as any).getModel();

    // Get bounds
    const cells = (model as any).cells || {};
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    Object.values(cells).forEach((cell: any) => {
      if (cell.geometry) {
        minX = Math.min(minX, cell.geometry.x);
        minY = Math.min(minY, cell.geometry.y);
        maxX = Math.max(maxX, cell.geometry.x + cell.geometry.width);
        maxY = Math.max(maxY, cell.geometry.y + cell.geometry.height);
      }
    });

    if (!isFinite(minX)) {
      return '';
    }

    const padding = 20;
    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;

    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style type="text/css"><![CDATA[
      * { margin: 0; padding: 0; }
      line, polyline { fill: none; stroke: #000; stroke-width: 1; }
      ellipse, circle, polygon { fill: white; stroke: #000; stroke-width: 1; }
      rect { fill: white; stroke: #000; stroke-width: 1; }
      text { font: 11px Arial; }
    ]]></style>
  </defs>
  <rect width="${width}" height="${height}" fill="white"/>
`;

    // Draw cells
    Object.values(cells).forEach((cell: any) => {
      if (cell.isVertex?.() && cell.geometry) {
        const x = cell.geometry.x - minX + padding + offsetX;
        const y = cell.geometry.y - minY + padding + offsetY;
        const w = cell.geometry.width;
        const h = cell.geometry.height;
        const label = cell.value || '';

        svg += `  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${cell.style?.fillColor || 'white'}" stroke="${cell.style?.strokeColor || 'black'}"/>`;
        if (label) {
          svg += `  <text x="${x + 5}" y="${y + h / 2 + 4}">${this.escapeXML(label)}</text>`;
        }
      } else if (cell.isEdge?.() && cell.geometry) {
        // Simple edge rendering (source to target line)
        const sourceGeo = cell.source?.geometry;
        const targetGeo = cell.target?.geometry;
        if (sourceGeo && targetGeo) {
          const x1 = sourceGeo.x + sourceGeo.width / 2 - minX + padding + offsetX;
          const y1 = sourceGeo.y + sourceGeo.height / 2 - minY + padding + offsetY;
          const x2 = targetGeo.x + targetGeo.width / 2 - minX + padding + offsetX;
          const y2 = targetGeo.y + targetGeo.height / 2 - minY + padding + offsetY;
          svg += `  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${cell.style?.strokeColor || 'black'}" stroke-width="${cell.style?.strokeWidth || 1}"/>`;
        }
      }
    });

    svg += '</svg>';
    return svg;
  }

  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  destroy(): void {
    // Cleanup if needed
  }
}
