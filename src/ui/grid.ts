import { Graph } from '@maxgraph/core';

export class GridController {
  private graph: Graph;
  private gridSize: number = 10;

  constructor(graph: Graph, gridSize: number = 10) {
    this.graph = graph;
    this.gridSize = gridSize;
    this.setupGrid();
  }

  private setupGrid() {
    this.graph.gridSize = this.gridSize;

    const gridColor = '#e0e0e0';
    const gridWidth = '1px';

    const canvas = (this.graph.view as any).canvas as HTMLCanvasElement | undefined;
    if (canvas) {
      canvas.style.backgroundImage = `
        linear-gradient(${gridColor} ${gridWidth}, transparent ${gridWidth}),
        linear-gradient(90deg, ${gridColor} ${gridWidth}, transparent ${gridWidth})
      `;
      canvas.style.backgroundSize = `${this.gridSize}px ${this.gridSize}px`;
      canvas.style.backgroundPosition = '0 0, 0 0';
    }

    this.enableSnapToGrid();
    console.log('[Grid] Grid enabled with size:', this.gridSize);
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
    console.log('[Grid] Grid size changed to:', size);
  }
}
