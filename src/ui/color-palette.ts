import { Graph } from '@maxgraph/core';

export class ColorPaletteController {
  private graph: Graph;
  private presetColors = [
    '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
    '#FF00FF', '#00FFFF', '#FFA500', '#800080',
    '#FFC0CB', '#A52A2A', '#808080', '#000000',
    '#FFFFFF', '#FFB6C1', '#87CEEB', '#90EE90',
    '#FFD700', '#FF69B4', '#4169E1', '#32CD32',
  ];

  constructor(graph: Graph) {
    this.graph = graph;
    this.setupPalette();
  }

  private setupPalette(): void {
    const paletteContainer = document.getElementById('color-palette');
    if (!paletteContainer) {
      console.log('[ColorPalette] No palette container found');
      return;
    }

    paletteContainer.innerHTML = '';
    paletteContainer.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      padding: 8px;
      background: #f5f5f5;
      border-radius: 4px;
    `;

    this.presetColors.forEach((color) => {
      const swatch = document.createElement('div');
      swatch.style.cssText = `
        width: 24px;
        height: 24px;
        border-radius: 3px;
        background: ${color};
        border: 2px solid #ddd;
        cursor: pointer;
        transition: all 0.2s;
      `;

      swatch.title = color;

      swatch.addEventListener('mouseenter', () => {
        swatch.style.transform = 'scale(1.1)';
        swatch.style.borderColor = '#333';
      });

      swatch.addEventListener('mouseleave', () => {
        swatch.style.transform = 'scale(1)';
        swatch.style.borderColor = '#ddd';
      });

      swatch.addEventListener('click', () => {
        this.applyFillColor(color);
      });

      swatch.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.applyStrokeColor(color);
      });

      paletteContainer.appendChild(swatch);
    });

    // Add info text
    const info = document.createElement('div');
    info.textContent = 'Click for fill • Right-click for stroke';
    info.style.cssText = `
      font-size: 11px;
      color: #999;
      margin-top: 4px;
      text-align: center;
      width: 100%;
    `;
    paletteContainer.appendChild(info);
  }

  private applyFillColor(color: string): void {
    const selected = this.graph.getSelectionCells();
    if (selected.length === 0) return;

    this.graph.batchUpdate(() => {
      selected.forEach((cell: any) => {
        if (cell.style) {
          cell.style.fillColor = color;
        }
        this.graph.refresh();
      });
    });

    console.log(`[ColorPalette] Applied fill color ${color}`);
  }

  private applyStrokeColor(color: string): void {
    const selected = this.graph.getSelectionCells();
    if (selected.length === 0) return;

    this.graph.batchUpdate(() => {
      selected.forEach((cell: any) => {
        if (cell.style) {
          cell.style.strokeColor = color;
        }
        this.graph.refresh();
      });
    });

    console.log(`[ColorPalette] Applied stroke color ${color}`);
  }

  destroy(): void {
    // Cleanup if needed
  }
}
