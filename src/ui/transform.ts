import { Graph, type Cell } from '@maxgraph/core';

/**
 * Style keys as this controller reads and writes them: values may also be draw.io-style
 * strings ('1', '90'), which maxGraph's CellStyle typing does not allow
 */
interface TransformStyle {
  flipH?: boolean | string;
  flipV?: boolean | string;
  rotation?: number | string;
}
import { logger } from '../drawio/logger';

export class TransformController {
  private graph: Graph;

  constructor(graph: Graph) {
    this.graph = graph;
  }

  flipHorizontal(): void {
    const selected = this.graph.getSelectionCells();
    if (selected.length === 0) return;

    this.graph.batchUpdate(() => {
      selected.forEach((cell: Cell) => {
        if (cell.geometry) {
          cell.style = cell.style || {};
          const style = cell.style as TransformStyle;
          style.flipH = !(style.flipH === true || style.flipH === '1');
          this.graph.refresh();
        }
      });
    });

    logger.debug('Transform', `Flipped ${selected.length} objects horizontally`);
  }

  flipVertical(): void {
    const selected = this.graph.getSelectionCells();
    if (selected.length === 0) return;

    this.graph.batchUpdate(() => {
      selected.forEach((cell: Cell) => {
        if (cell.geometry) {
          cell.style = cell.style || {};
          const style = cell.style as TransformStyle;
          style.flipV = !(style.flipV === true || style.flipV === '1');
          this.graph.refresh();
        }
      });
    });

    logger.debug('Transform', `Flipped ${selected.length} objects vertically`);
  }

  rotate90CW(): void {
    const selected = this.graph.getSelectionCells();
    if (selected.length === 0) return;

    this.graph.batchUpdate(() => {
      selected.forEach((cell: Cell) => {
        if (cell.geometry) {
          // Rotate 90° clockwise: swap width/height and adjust position
          const tempWidth = cell.geometry.width;
          cell.geometry.width = cell.geometry.height;
          cell.geometry.height = tempWidth;

          // Rotate style if it has rotation
          cell.style = cell.style || {};
          const style = cell.style as TransformStyle;
          const currentRotation = parseInt(String(style.rotation || '0'), 10);
          style.rotation = ((currentRotation + 90) % 360).toString();

          this.graph.refresh();
        }
      });
    });

    logger.debug('Transform', `Rotated ${selected.length} objects 90° clockwise`);
  }

  rotate90CCW(): void {
    const selected = this.graph.getSelectionCells();
    if (selected.length === 0) return;

    this.graph.batchUpdate(() => {
      selected.forEach((cell: Cell) => {
        if (cell.geometry) {
          // Rotate 90° counter-clockwise: swap width/height and adjust position
          const tempWidth = cell.geometry.width;
          cell.geometry.width = cell.geometry.height;
          cell.geometry.height = tempWidth;

          // Rotate style if it has rotation
          cell.style = cell.style || {};
          const style = cell.style as TransformStyle;
          const currentRotation = parseInt(String(style.rotation || '0'), 10);
          style.rotation = ((currentRotation - 90 + 360) % 360).toString();

          this.graph.refresh();
        }
      });
    });

    logger.debug('Transform', `Rotated ${selected.length} objects 90° counter-clockwise`);
  }

  matchWidth(): void {
    const selected = this.graph.getSelectionCells();
    if (selected.length < 2 || !selected[0].geometry) return;

    const targetWidth = selected[0].geometry.width;

    this.graph.batchUpdate(() => {
      selected.forEach((cell: Cell) => {
        if (cell.geometry) {
          cell.geometry.width = targetWidth;
          this.graph.refresh();
        }
      });
    });

    logger.debug('Transform', `Matched width of ${selected.length} objects`);
  }

  matchHeight(): void {
    const selected = this.graph.getSelectionCells();
    if (selected.length < 2 || !selected[0].geometry) return;

    const targetHeight = selected[0].geometry.height;

    this.graph.batchUpdate(() => {
      selected.forEach((cell: Cell) => {
        if (cell.geometry) {
          cell.geometry.height = targetHeight;
          this.graph.refresh();
        }
      });
    });

    logger.debug('Transform', `Matched height of ${selected.length} objects`);
  }

  matchSize(): void {
    const selected = this.graph.getSelectionCells();
    if (selected.length < 2 || !selected[0].geometry) return;

    const targetWidth = selected[0].geometry.width;
    const targetHeight = selected[0].geometry.height;

    this.graph.batchUpdate(() => {
      selected.forEach((cell: Cell) => {
        if (cell.geometry) {
          cell.geometry.width = targetWidth;
          cell.geometry.height = targetHeight;
          this.graph.refresh();
        }
      });
    });

    logger.debug('Transform', `Matched size of ${selected.length} objects`);
  }

  destroy(): void {
    // Cleanup if needed
  }
}
