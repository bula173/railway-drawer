/**
 * Z-Order Manager
 * Manage cell layering (bring to front, send to back)
 */

export class ZOrderManager {
  constructor(private graph: any) {}

  /**
   * Bring selected cells to front
   */
  bringToFront(cells: any[]): void {
    if (!cells || cells.length === 0) return;

    const parent = this.graph.getDefaultParent();
    if (!parent || !parent.children) return;

    cells.forEach((cell) => {
      const index = parent.children.indexOf(cell);
      if (index !== -1) {
        // Move to end (front)
        parent.children.splice(index, 1);
        parent.children.push(cell);
      }
    });

    this.graph.view.refresh();
  }

  /**
   * Send selected cells to back
   */
  sendToBack(cells: any[]): void {
    if (!cells || cells.length === 0) return;

    const parent = this.graph.getDefaultParent();
    if (!parent || !parent.children) return;

    // Get cells with their indices and sort by index descending
    const cellsWithIndex = cells
      .map((cell) => ({ cell, index: parent.children.indexOf(cell) }))
      .filter(({ index }) => index !== -1)
      .sort((a, b) => b.index - a.index);

    // Move cells to front in descending index order to preserve relative order
    cellsWithIndex.forEach(({ cell }) => {
      const currentIndex = parent.children.indexOf(cell);
      if (currentIndex !== -1) {
        parent.children.splice(currentIndex, 1);
        parent.children.unshift(cell);
      }
    });

    this.graph.view.refresh();
  }

  /**
   * Bring cell forward (one step)
   */
  bringForward(cell: any): void {
    const parent = this.graph.getDefaultParent();
    if (!parent || !parent.children) return;

    const index = parent.children.indexOf(cell);
    if (index !== -1 && index < parent.children.length - 1) {
      // Swap with next
      [parent.children[index], parent.children[index + 1]] = [
        parent.children[index + 1],
        parent.children[index],
      ];
      this.graph.view.refresh();
    }
  }

  /**
   * Send cell backward (one step)
   */
  sendBackward(cell: any): void {
    const parent = this.graph.getDefaultParent();
    if (!parent || !parent.children) return;

    const index = parent.children.indexOf(cell);
    if (index !== -1 && index > 0) {
      // Swap with previous
      [parent.children[index - 1], parent.children[index]] = [
        parent.children[index],
        parent.children[index - 1],
      ];
      this.graph.view.refresh();
    }
  }
}
