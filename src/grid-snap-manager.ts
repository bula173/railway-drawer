/**
 * Grid & Snap Manager - Enhanced grid functionality with visual feedback
 */
export class GridSnapManager {
  private gridSize = 10;
  private snapEnabled = true;
  private gridVisible = true;
  private snapMargin = 4; // Pixels for snap detection
  private gridSizes = [5, 10, 15, 20, 25, 30];

  constructor(private graph: any) {}

  setGridSize(size: number): void {
    this.gridSize = Math.max(5, Math.min(50, size));
    this.graph.view.gridSize = this.gridSize;
  }

  getGridSize(): number {
    return this.gridSize;
  }

  getGridSizeOptions(): number[] {
    return this.gridSizes;
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

  snapPosition(x: number, y: number): [number, number] {
    if (!this.snapEnabled) return [x, y];
    return [
      Math.round(x / this.gridSize) * this.gridSize,
      Math.round(y / this.gridSize) * this.gridSize,
    ];
  }

  isNearGridLine(value: number): boolean {
    if (!this.snapEnabled) return false;
    const remainder = value % this.gridSize;
    return remainder < this.snapMargin || remainder > this.gridSize - this.snapMargin;
  }

  getSnapGuide(value: number): number | null {
    if (!this.snapEnabled) return null;
    const remainder = value % this.gridSize;
    if (remainder < this.snapMargin) return value - remainder;
    if (remainder > this.gridSize - this.snapMargin) return value + (this.gridSize - remainder);
    return null;
  }

  isSnapEnabled(): boolean {
    return this.snapEnabled;
  }

  isGridVisible(): boolean {
    return this.gridVisible;
  }

  setSnapMargin(margin: number): void {
    this.snapMargin = Math.max(1, Math.min(10, margin));
  }

  getSnapMargin(): number {
    return this.snapMargin;
  }
}
