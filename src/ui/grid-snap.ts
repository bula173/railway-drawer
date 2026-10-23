import { Graph } from '@maxgraph/core';
import { logger } from '../drawio/logger';

export class GridSnapController {
  private graph: Graph;
  private snapEnabled = true;
  private gridSize = 10;

  constructor(graph: Graph) {
    this.graph = graph;
    this.setupGridSnap();
  }

  private setupGridSnap(): void {
    // Enable grid snap by default
    this.graph.gridSize = this.gridSize;
    // snapLarge is not declared by maxGraph's Graph typings; set as an ad-hoc flag as before
    (this.graph as Graph & { snapLarge?: boolean }).snapLarge = true;
  }

  toggleSnap(): void {
    this.snapEnabled = !this.snapEnabled;

    if (this.snapEnabled) {
      this.graph.gridSize = this.gridSize;
      logger.debug('GridSnap', 'Grid snap enabled');
    } else {
      this.graph.gridSize = 1; // Set to 1 to effectively disable snapping
      logger.debug('GridSnap', 'Grid snap disabled');
    }
  }

  isSnapEnabled(): boolean {
    return this.snapEnabled;
  }

  setGridSize(size: number): void {
    this.gridSize = size;
    if (this.snapEnabled) {
      this.graph.gridSize = size;
    }
    logger.debug('GridSnap', `Grid size set to ${size}px`);
  }

  destroy(): void {
    // Cleanup if needed
  }
}
