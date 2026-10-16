import { Graph } from '@maxgraph/core';

export class GridController {
  private graph: Graph;
  private gridSize: number = 10;
  private isGridVisible: boolean = true;

  constructor(graph: Graph, gridSize: number = 10) {
    this.graph = graph;
    this.gridSize = gridSize;
    this.setupGrid();
  }

  private setupGrid() {
    this.graph.gridSize = this.gridSize;
    this.updateGridDisplay();
    console.log('[Grid] Grid enabled with size:', this.gridSize);
  }

  private updateGridDisplay() {
    const gridColor = '#e0e0e0';
    const container = this.graph.getContainer();

    if (!container) return;

    if (this.isGridVisible) {
      const gridImage = this.createGridSvg(gridColor);
      container.style.backgroundImage = `url('${gridImage}')`;
      container.style.backgroundSize = `${this.gridSize}px ${this.gridSize}px`;
      container.style.backgroundRepeat = 'repeat';
      container.style.backgroundPosition = '0 0';
    } else {
      container.style.backgroundImage = 'none';
    }
  }

  private createGridSvg(color: string): string {
    const svg = `
      <svg width="${this.gridSize}" height="${this.gridSize}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="${this.gridSize}" height="${this.gridSize}" patternUnits="userSpaceOnUse">
            <path d="M ${this.gridSize} 0 L 0 0 0 ${this.gridSize}" fill="none" stroke="${color}" stroke-width="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="white" />
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    `;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    return URL.createObjectURL(blob);
  }

  toggleGrid(enabled: boolean) {
    this.isGridVisible = enabled;
    this.updateGridDisplay();
    console.log('[Grid] Grid', enabled ? 'enabled' : 'disabled');
  }

  enableSnapToGrid() {
    this.graph.gridSize = this.gridSize;
    console.log('[Grid] Snap to grid enabled');
  }

  disableSnapToGrid() {
    this.graph.gridSize = 1;
    console.log('[Grid] Snap to grid disabled');
  }

  setGridSize(size: number) {
    this.gridSize = size;
    this.graph.gridSize = size;
    this.updateGridDisplay();
    console.log('[Grid] Grid size changed to:', size);
  }
}
