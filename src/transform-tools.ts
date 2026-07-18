/**
 * Transform Tools
 * Rotate and flip shapes
 */

export class TransformTools {
  constructor(private graph: any) {}

  rotateCell(cell: any, degrees: number = 90): void {
    if (!cell || !cell.geometry) return;

    const style = cell.style || {};
    const currentRotation = parseInt(style.rotation || '0');
    const newRotation = (currentRotation + degrees) % 360;

    this.graph.setCellStyles(cell, {
      ...style,
      rotation: newRotation.toString(),
    });
  }

  rotateClockwise90(cell: any): void {
    this.rotateCell(cell, 90);
  }

  rotateCounterClockwise90(cell: any): void {
    this.rotateCell(cell, -90);
  }

  flipHorizontal(cell: any): void {
    if (!cell || !cell.geometry) return;

    const style = cell.style || {};
    const flipped = style.flipH ? (style.flipH === '1' ? '0' : '1') : '1';

    this.graph.setCellStyles(cell, {
      ...style,
      flipH: flipped,
    });
  }

  flipVertical(cell: any): void {
    if (!cell || !cell.geometry) return;

    const style = cell.style || {};
    const flipped = style.flipV ? (style.flipV === '1' ? '0' : '1') : '1';

    this.graph.setCellStyles(cell, {
      ...style,
      flipV: flipped,
    });
  }

  rotateMultiple(cells: any[], degrees: number = 90): void {
    this.graph.batchUpdate(() => {
      cells.forEach((cell) => this.rotateCell(cell, degrees));
    });
  }

  flipMultipleHorizontal(cells: any[]): void {
    this.graph.batchUpdate(() => {
      cells.forEach((cell) => this.flipHorizontal(cell));
    });
  }

  flipMultipleVertical(cells: any[]): void {
    this.graph.batchUpdate(() => {
      cells.forEach((cell) => this.flipVertical(cell));
    });
  }

  setRotation(cell: any, degrees: number): void {
    if (!cell || !cell.geometry) return;

    const normalizedDegrees = ((degrees % 360) + 360) % 360;

    this.graph.setCellStyles(cell, {
      ...cell.style,
      rotation: normalizedDegrees.toString(),
    });
  }

  getRotation(cell: any): number {
    if (!cell || !cell.style) return 0;
    return parseInt(cell.style.rotation || '0');
  }

  isFlippedHorizontal(cell: any): boolean {
    if (!cell || !cell.style) return false;
    return cell.style.flipH === '1';
  }

  isFlippedVertical(cell: any): boolean {
    if (!cell || !cell.style) return false;
    return cell.style.flipV === '1';
  }
}
