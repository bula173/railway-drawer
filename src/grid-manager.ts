/**
 * Grid Manager
 * Handles visual grid rendering and snap-to-grid functionality
 */

export interface GridConfig {
  gridSize: number;
  gridVisible: boolean;
  snapEnabled: boolean;
  gridColor: string;
}

export class GridManager {
  private gridSize: number;
  private gridVisible: boolean;
  private snapEnabled: boolean;
  private gridColor: string;
  private listeners: Array<(config: GridConfig) => void> = [];

  constructor(gridSize: number = 10, gridVisible: boolean = true, snapEnabled: boolean = true) {
    this.gridSize = gridSize;
    this.gridVisible = gridVisible;
    this.snapEnabled = snapEnabled;
    this.gridColor = '#e0e0e0';
  }

  setGridSize(size: number): void {
    this.gridSize = Math.max(5, Math.min(50, size));
    this.notifyListeners();
  }

  setGridVisible(visible: boolean): void {
    this.gridVisible = visible;
    this.notifyListeners();
  }

  setSnapEnabled(enabled: boolean): void {
    this.snapEnabled = enabled;
    this.notifyListeners();
  }

  setGridColor(color: string): void {
    this.gridColor = color;
  }

  getGridSize(): number {
    return this.gridSize;
  }

  isGridVisible(): boolean {
    return this.gridVisible;
  }

  isSnapEnabled(): boolean {
    return this.snapEnabled;
  }

  snapCoordinate(coord: number): number {
    if (!this.snapEnabled) return coord;
    return Math.round(coord / this.gridSize) * this.gridSize;
  }

  snapPosition(x: number, y: number): [number, number] {
    if (!this.snapEnabled) return [x, y];
    return [this.snapCoordinate(x), this.snapCoordinate(y)];
  }

  snapGeometry(x: number, y: number, width: number, height: number): [number, number, number, number] {
    if (!this.snapEnabled) return [x, y, width, height];
    const snappedX = this.snapCoordinate(x);
    const snappedY = this.snapCoordinate(y);
    const snappedWidth = Math.max(this.gridSize, this.snapCoordinate(width));
    const snappedHeight = Math.max(this.gridSize, this.snapCoordinate(height));
    return [snappedX, snappedY, snappedWidth, snappedHeight];
  }

  drawGrid(
    container: HTMLElement,
    offsetX: number = 0,
    offsetY: number = 0,
    scale: number = 1,
  ): void {
    if (!this.gridVisible || !container) return;

    // Get or create canvas for grid
    let canvas = container.querySelector('.grid-canvas') as HTMLCanvasElement;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'grid-canvas';
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '0';
      container.insertBefore(canvas, container.firstChild);
    }

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = this.gridColor;
    ctx.lineWidth = 0.5;

    const gridSpacing = this.gridSize * scale;
    const startX = (offsetX % gridSpacing) - (offsetX > 0 ? gridSpacing : 0);
    const startY = (offsetY % gridSpacing) - (offsetY > 0 ? gridSpacing : 0);

    // Draw vertical lines
    for (let x = startX; x < canvas.width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // Draw horizontal lines
    for (let y = startY; y < canvas.height; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }

  addListener(callback: (config: GridConfig) => void): void {
    this.listeners.push(callback);
  }

  removeListener(callback: (config: GridConfig) => void): void {
    this.listeners = this.listeners.filter((l) => l !== callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) =>
      listener({
        gridSize: this.gridSize,
        gridVisible: this.gridVisible,
        snapEnabled: this.snapEnabled,
        gridColor: this.gridColor,
      }),
    );
  }

  getConfig(): GridConfig {
    return {
      gridSize: this.gridSize,
      gridVisible: this.gridVisible,
      snapEnabled: this.snapEnabled,
      gridColor: this.gridColor,
    };
  }
}
