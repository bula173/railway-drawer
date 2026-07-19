/**
 * Grid & Snap Manager - Enhanced grid functionality
 */
export class GridSnapManager {
  private gridSize = 10;
  private snapEnabled = true;
  private gridVisible = true;

  constructor(private graph: any) {}

  setGridSize(size: number): void {
    this.gridSize = Math.max(5, size);
    this.graph.view.gridSize = this.gridSize;
  }

  getGridSize(): number {
    return this.gridSize;
  }

  toggleSnap(): boolean {
    this.snapEnabled = !this.snapEnabled;
    return this.snapEnabled;
  }

  toggleGridVisibility(): boolean {
    this.gridVisible = !this.gridVisible;
    return this.gridVisible;
  }

  snapToGrid(value: number): number {
    if (!this.snapEnabled) return value;
    return Math.round(value / this.gridSize) * this.gridSize;
  }

  isSnapEnabled(): boolean {
    return this.snapEnabled;
  }

  isGridVisible(): boolean {
    return this.gridVisible;
  }
}
