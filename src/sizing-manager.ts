/**
 * Sizing Manager
 * Manage cell sizing operations (make same size, etc.)
 */

export class SizingManager {
  constructor(private graph: any) {}

  /**
   * Make selected cells the same size as the first cell
   */
  makeSameSize(cells: any[]): void {
    if (!cells || cells.length < 2) return;

    const reference = cells[0];
    if (!reference.geometry) return;

    const refWidth = reference.geometry.width;
    const refHeight = reference.geometry.height;

    // Apply size to all other cells
    cells.slice(1).forEach((cell) => {
      if (cell.geometry) {
        cell.geometry.width = refWidth;
        cell.geometry.height = refHeight;
      }
    });

    this.graph.view.refresh();
  }

  /**
   * Make selected cells the same width as the first cell
   */
  makeSameWidth(cells: any[]): void {
    if (!cells || cells.length < 2) return;

    const reference = cells[0];
    if (!reference.geometry) return;

    const refWidth = reference.geometry.width;

    cells.slice(1).forEach((cell) => {
      if (cell.geometry) {
        cell.geometry.width = refWidth;
      }
    });

    this.graph.view.refresh();
  }

  /**
   * Make selected cells the same height as the first cell
   */
  makeSameHeight(cells: any[]): void {
    if (!cells || cells.length < 2) return;

    const reference = cells[0];
    if (!reference.geometry) return;

    const refHeight = reference.geometry.height;

    cells.slice(1).forEach((cell) => {
      if (cell.geometry) {
        cell.geometry.height = refHeight;
      }
    });

    this.graph.view.refresh();
  }

  /**
   * Get bounding box of selected cells
   */
  getBounds(cells: any[]): { x: number; y: number; width: number; height: number } | null {
    if (!cells || cells.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    cells.forEach((cell) => {
      if (cell.geometry && cell.isVertex?.()) {
        minX = Math.min(minX, cell.geometry.x);
        minY = Math.min(minY, cell.geometry.y);
        maxX = Math.max(maxX, cell.geometry.x + cell.geometry.width);
        maxY = Math.max(maxY, cell.geometry.y + cell.geometry.height);
      }
    });

    if (minX === Infinity) return null;

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }
}
