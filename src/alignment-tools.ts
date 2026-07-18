/**
 * Alignment Tools
 * Align and distribute multiple selected shapes
 */

export class AlignmentTools {
  constructor(private graph: any) {}

  alignLeft(cells: any[]): void {
    if (cells.length < 2) return;

    let minX = Infinity;
    cells.forEach((cell) => {
      if (cell.geometry) {
        minX = Math.min(minX, cell.geometry.x);
      }
    });

    this.graph.batchUpdate(() => {
      cells.forEach((cell) => {
        if (cell.geometry) {
          const newGeo = {
            x: minX,
            y: cell.geometry.y,
            width: cell.geometry.width,
            height: cell.geometry.height,
          };
          this.graph.model.setGeometry(cell, newGeo);
        }
      });
    });
  }

  alignRight(cells: any[]): void {
    if (cells.length < 2) return;

    let maxX = -Infinity;
    cells.forEach((cell) => {
      if (cell.geometry) {
        maxX = Math.max(maxX, cell.geometry.x + cell.geometry.width);
      }
    });

    this.graph.batchUpdate(() => {
      cells.forEach((cell) => {
        if (cell.geometry) {
          const newGeo = {
            x: maxX - cell.geometry.width,
            y: cell.geometry.y,
            width: cell.geometry.width,
            height: cell.geometry.height,
          };
          this.graph.model.setGeometry(cell, newGeo);
        }
      });
    });
  }

  alignHCenter(cells: any[]): void {
    if (cells.length < 2) return;

    let minX = Infinity;
    let maxX = -Infinity;
    cells.forEach((cell) => {
      if (cell.geometry) {
        minX = Math.min(minX, cell.geometry.x);
        maxX = Math.max(maxX, cell.geometry.x + cell.geometry.width);
      }
    });

    const centerX = (minX + maxX) / 2;

    this.graph.batchUpdate(() => {
      cells.forEach((cell) => {
        if (cell.geometry) {
          const newGeo = {
            x: centerX - cell.geometry.width / 2,
            y: cell.geometry.y,
            width: cell.geometry.width,
            height: cell.geometry.height,
          };
          this.graph.model.setGeometry(cell, newGeo);
        }
      });
    });
  }

  alignTop(cells: any[]): void {
    if (cells.length < 2) return;

    let minY = Infinity;
    cells.forEach((cell) => {
      if (cell.geometry) {
        minY = Math.min(minY, cell.geometry.y);
      }
    });

    this.graph.batchUpdate(() => {
      cells.forEach((cell) => {
        if (cell.geometry) {
          const newGeo = {
            x: cell.geometry.x,
            y: minY,
            width: cell.geometry.width,
            height: cell.geometry.height,
          };
          this.graph.model.setGeometry(cell, newGeo);
        }
      });
    });
  }

  alignBottom(cells: any[]): void {
    if (cells.length < 2) return;

    let maxY = -Infinity;
    cells.forEach((cell) => {
      if (cell.geometry) {
        maxY = Math.max(maxY, cell.geometry.y + cell.geometry.height);
      }
    });

    this.graph.batchUpdate(() => {
      cells.forEach((cell) => {
        if (cell.geometry) {
          const newGeo = {
            x: cell.geometry.x,
            y: maxY - cell.geometry.height,
            width: cell.geometry.width,
            height: cell.geometry.height,
          };
          this.graph.model.setGeometry(cell, newGeo);
        }
      });
    });
  }

  alignVCenter(cells: any[]): void {
    if (cells.length < 2) return;

    let minY = Infinity;
    let maxY = -Infinity;
    cells.forEach((cell) => {
      if (cell.geometry) {
        minY = Math.min(minY, cell.geometry.y);
        maxY = Math.max(maxY, cell.geometry.y + cell.geometry.height);
      }
    });

    const centerY = (minY + maxY) / 2;

    this.graph.batchUpdate(() => {
      cells.forEach((cell) => {
        if (cell.geometry) {
          const newGeo = {
            x: cell.geometry.x,
            y: centerY - cell.geometry.height / 2,
            width: cell.geometry.width,
            height: cell.geometry.height,
          };
          this.graph.model.setGeometry(cell, newGeo);
        }
      });
    });
  }

  distributeHorizontally(cells: any[]): void {
    if (cells.length < 3) return;

    // Sort by X position
    const sorted = [...cells].sort((a, b) => a.geometry.x - b.geometry.x);

    let minX = Infinity;
    let maxX = -Infinity;
    let totalWidth = 0;

    sorted.forEach((cell) => {
      if (cell.geometry) {
        minX = Math.min(minX, cell.geometry.x);
        maxX = Math.max(maxX, cell.geometry.x + cell.geometry.width);
        totalWidth += cell.geometry.width;
      }
    });

    const totalGap = maxX - minX - totalWidth;
    const gap = totalGap / (sorted.length - 1);

    this.graph.batchUpdate(() => {
      let currentX = minX;
      sorted.forEach((cell, index) => {
        if (cell.geometry) {
          const newGeo = {
            x: currentX,
            y: cell.geometry.y,
            width: cell.geometry.width,
            height: cell.geometry.height,
          };
          this.graph.model.setGeometry(cell, newGeo);
          currentX += cell.geometry.width + (index < sorted.length - 1 ? gap : 0);
        }
      });
    });
  }

  distributeVertically(cells: any[]): void {
    if (cells.length < 3) return;

    // Sort by Y position
    const sorted = [...cells].sort((a, b) => a.geometry.y - b.geometry.y);

    let minY = Infinity;
    let maxY = -Infinity;
    let totalHeight = 0;

    sorted.forEach((cell) => {
      if (cell.geometry) {
        minY = Math.min(minY, cell.geometry.y);
        maxY = Math.max(maxY, cell.geometry.y + cell.geometry.height);
        totalHeight += cell.geometry.height;
      }
    });

    const totalGap = maxY - minY - totalHeight;
    const gap = totalGap / (sorted.length - 1);

    this.graph.batchUpdate(() => {
      let currentY = minY;
      sorted.forEach((cell, index) => {
        if (cell.geometry) {
          const newGeo = {
            x: cell.geometry.x,
            y: currentY,
            width: cell.geometry.width,
            height: cell.geometry.height,
          };
          this.graph.model.setGeometry(cell, newGeo);
          currentY += cell.geometry.height + (index < sorted.length - 1 ? gap : 0);
        }
      });
    });
  }
}
