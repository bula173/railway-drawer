import { Graph } from '@maxgraph/core';

export class TransformController {
  private graph: Graph;

  constructor(graph: Graph) {
    this.graph = graph;
    this.setupTransformButtons();
    this.setupKeyboardShortcuts();
  }

  private setupTransformButtons(): void {
    const flipHBtn = document.getElementById('btn-flip-h');
    const flipVBtn = document.getElementById('btn-flip-v');
    const rotate90CWBtn = document.getElementById('btn-rotate-90-cw');
    const rotate90CCWBtn = document.getElementById('btn-rotate-90-ccw');
    const matchWidthBtn = document.getElementById('btn-match-width');
    const matchHeightBtn = document.getElementById('btn-match-height');
    const matchSizeBtn = document.getElementById('btn-match-size');

    if (flipHBtn) flipHBtn.addEventListener('click', () => this.flipHorizontal());
    if (flipVBtn) flipVBtn.addEventListener('click', () => this.flipVertical());
    if (rotate90CWBtn) rotate90CWBtn.addEventListener('click', () => this.rotate90CW());
    if (rotate90CCWBtn) rotate90CCWBtn.addEventListener('click', () => this.rotate90CCW());
    if (matchWidthBtn) matchWidthBtn.addEventListener('click', () => this.matchWidth());
    if (matchHeightBtn) matchHeightBtn.addEventListener('click', () => this.matchHeight());
    if (matchSizeBtn) matchSizeBtn.addEventListener('click', () => this.matchSize());
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ctrl/Cmd + H for flip horizontal
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        this.flipHorizontal();
      }

      // Ctrl/Cmd + V for flip vertical (might conflict with paste, but worth trying)
      if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
        e.preventDefault();
        this.flipVertical();
      }

      // Ctrl/Cmd + R for rotate 90 CW
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        this.rotate90CW();
      }

      // Ctrl/Cmd + Shift + R for rotate 90 CCW
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        this.rotate90CCW();
      }
    });
  }

  flipHorizontal(): void {
    const selected = this.graph.getSelectionCells();
    if (selected.length === 0) return;

    this.graph.batchUpdate(() => {
      selected.forEach((cell: any) => {
        if (cell.geometry) {
          cell.style = cell.style || {};
          cell.style.flipH = !(cell.style.flipH === true || cell.style.flipH === '1');
          this.graph.refresh();
        }
      });
    });

    console.log(`[Transform] Flipped ${selected.length} objects horizontally`);
  }

  flipVertical(): void {
    const selected = this.graph.getSelectionCells();
    if (selected.length === 0) return;

    this.graph.batchUpdate(() => {
      selected.forEach((cell: any) => {
        if (cell.geometry) {
          cell.style = cell.style || {};
          cell.style.flipV = !(cell.style.flipV === true || cell.style.flipV === '1');
          this.graph.refresh();
        }
      });
    });

    console.log(`[Transform] Flipped ${selected.length} objects vertically`);
  }

  rotate90CW(): void {
    const selected = this.graph.getSelectionCells();
    if (selected.length === 0) return;

    this.graph.batchUpdate(() => {
      selected.forEach((cell: any) => {
        if (cell.geometry) {
          // Rotate 90° clockwise: swap width/height and adjust position
          const tempWidth = cell.geometry.width;
          cell.geometry.width = cell.geometry.height;
          cell.geometry.height = tempWidth;

          // Rotate style if it has rotation
          cell.style = cell.style || {};
          const currentRotation = parseInt(cell.style.rotation || '0', 10);
          cell.style.rotation = ((currentRotation + 90) % 360).toString();

          this.graph.refresh();
        }
      });
    });

    console.log(`[Transform] Rotated ${selected.length} objects 90° clockwise`);
  }

  rotate90CCW(): void {
    const selected = this.graph.getSelectionCells();
    if (selected.length === 0) return;

    this.graph.batchUpdate(() => {
      selected.forEach((cell: any) => {
        if (cell.geometry) {
          // Rotate 90° counter-clockwise: swap width/height and adjust position
          const tempWidth = cell.geometry.width;
          cell.geometry.width = cell.geometry.height;
          cell.geometry.height = tempWidth;

          // Rotate style if it has rotation
          cell.style = cell.style || {};
          const currentRotation = parseInt(cell.style.rotation || '0', 10);
          cell.style.rotation = ((currentRotation - 90 + 360) % 360).toString();

          this.graph.refresh();
        }
      });
    });

    console.log(`[Transform] Rotated ${selected.length} objects 90° counter-clockwise`);
  }

  matchWidth(): void {
    const selected = this.graph.getSelectionCells();
    if (selected.length < 2 || !selected[0].geometry) return;

    const targetWidth = selected[0].geometry.width;

    this.graph.batchUpdate(() => {
      selected.forEach((cell: any) => {
        if (cell.geometry) {
          cell.geometry.width = targetWidth;
          this.graph.refresh();
        }
      });
    });

    console.log(`[Transform] Matched width of ${selected.length} objects`);
  }

  matchHeight(): void {
    const selected = this.graph.getSelectionCells();
    if (selected.length < 2 || !selected[0].geometry) return;

    const targetHeight = selected[0].geometry.height;

    this.graph.batchUpdate(() => {
      selected.forEach((cell: any) => {
        if (cell.geometry) {
          cell.geometry.height = targetHeight;
          this.graph.refresh();
        }
      });
    });

    console.log(`[Transform] Matched height of ${selected.length} objects`);
  }

  matchSize(): void {
    const selected = this.graph.getSelectionCells();
    if (selected.length < 2 || !selected[0].geometry) return;

    const targetWidth = selected[0].geometry.width;
    const targetHeight = selected[0].geometry.height;

    this.graph.batchUpdate(() => {
      selected.forEach((cell: any) => {
        if (cell.geometry) {
          cell.geometry.width = targetWidth;
          cell.geometry.height = targetHeight;
          this.graph.refresh();
        }
      });
    });

    console.log(`[Transform] Matched size of ${selected.length} objects`);
  }

  destroy(): void {
    // Cleanup if needed
  }
}
