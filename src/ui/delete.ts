import { Graph } from '@maxgraph/core';

export class DeleteController {
  private graph: Graph;

  constructor(graph: Graph) {
    this.graph = graph;
    this.setupKeyboardShortcuts();
  }

  private setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const cells = this.graph.getSelectionCells();
        if (cells.length > 0) {
          e.preventDefault();
          this.deleteSelection();
        }
      }
    });
  }

  deleteSelection() {
    const cells = this.graph.getSelectionCells();
    if (cells.length === 0) return;

    this.graph.batchUpdate(() => {
      this.graph.removeCells(cells);
    });

    console.log('[Delete] Deleted', cells.length, 'cell(s)');
  }
}
