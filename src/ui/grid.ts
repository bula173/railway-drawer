import { Graph } from '@maxgraph/core';
import { applyGridBackground } from './grid-background';

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
    // Theme-aware tile (light/dark grid color), see grid-background.ts
    applyGridBackground(this.graph.getContainer(), this.gridSize, this.isGridVisible);
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
