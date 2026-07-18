/**
 * Connection Points Manager
 * Manage custom connection attachment points on shapes
 */

export interface ConnectionPoint {
  x: number; // 0-1 (0=left, 1=right)
  y: number; // 0-1 (0=top, 1=bottom)
  perimeter?: number; // 1 = on perimeter (default)
}

export class ConnectionPointsManager {
  constructor(private graph: any) {}

  /**
   * Add connection point to shape
   */
  addConnectionPoint(cell: any, x: number, y: number): void {
    if (!cell.isVertex?.()) return;

    cell.style = cell.style || {};

    // Initialize connection points array in style
    if (!cell.style.connectionPoints) {
      cell.style.connectionPoints = [];
    }

    const point: ConnectionPoint = {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
      perimeter: 1,
    };

    cell.style.connectionPoints.push(point);
    this.graph.view.refresh();
  }

  /**
   * Set connection points for shape
   */
  setConnectionPoints(cell: any, points: ConnectionPoint[]): void {
    if (!cell.isVertex?.()) return;

    cell.style = cell.style || {};
    cell.style.connectionPoints = points.map((p) => ({
      x: Math.max(0, Math.min(1, p.x)),
      y: Math.max(0, Math.min(1, p.y)),
      perimeter: p.perimeter ?? 1,
    }));

    this.graph.view.refresh();
  }

  /**
   * Remove all custom connection points
   */
  clearConnectionPoints(cell: any): void {
    if (!cell.isVertex?.()) return;

    cell.style = cell.style || {};
    cell.style.connectionPoints = undefined;

    this.graph.view.refresh();
  }

  /**
   * Get connection points for shape
   */
  getConnectionPoints(cell: any): ConnectionPoint[] {
    if (!cell.isVertex?.()) return [];

    return (cell.style?.connectionPoints as ConnectionPoint[]) || [];
  }

  /**
   * Add corner connection points (all 4 corners)
   */
  addCornerPoints(cell: any): void {
    const corners: ConnectionPoint[] = [
      { x: 0, y: 0, perimeter: 1 }, // Top-left
      { x: 1, y: 0, perimeter: 1 }, // Top-right
      { x: 0, y: 1, perimeter: 1 }, // Bottom-left
      { x: 1, y: 1, perimeter: 1 }, // Bottom-right
    ];

    this.setConnectionPoints(cell, corners);
  }

  /**
   * Add cardinal connection points (4 sides)
   */
  addCardinalPoints(cell: any): void {
    const points: ConnectionPoint[] = [
      { x: 0.5, y: 0, perimeter: 1 }, // Top
      { x: 1, y: 0.5, perimeter: 1 }, // Right
      { x: 0.5, y: 1, perimeter: 1 }, // Bottom
      { x: 0, y: 0.5, perimeter: 1 }, // Left
    ];

    this.setConnectionPoints(cell, points);
  }

  /**
   * Add 8-point connection (corners + cardinals)
   */
  add8Points(cell: any): void {
    const points: ConnectionPoint[] = [
      { x: 0.5, y: 0, perimeter: 1 },   // Top
      { x: 1, y: 0.5, perimeter: 1 },   // Right
      { x: 0.5, y: 1, perimeter: 1 },   // Bottom
      { x: 0, y: 0.5, perimeter: 1 },   // Left
      { x: 0, y: 0, perimeter: 1 },     // Top-left
      { x: 1, y: 0, perimeter: 1 },     // Top-right
      { x: 1, y: 1, perimeter: 1 },     // Bottom-right
      { x: 0, y: 1, perimeter: 1 },     // Bottom-left
    ];

    this.setConnectionPoints(cell, points);
  }

  /**
   * Apply connection points to selected cells
   */
  applyPointsToSelection(pointType: 'corner' | 'cardinal' | '8point'): void {
    const cells = this.graph.getSelectionModel().cells;

    cells.forEach((cell: any) => {
      switch (pointType) {
        case 'corner':
          this.addCornerPoints(cell);
          break;
        case 'cardinal':
          this.addCardinalPoints(cell);
          break;
        case '8point':
          this.add8Points(cell);
          break;
      }
    });
  }
}
