import { Graph } from '@maxgraph/core';

export class ClipboardController {
  private graph: Graph;
  private clipboard: any[] = [];

  constructor(graph: Graph) {
    this.graph = graph;
    this.setupKeyboardShortcuts();
  }

  private setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        this.copy();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        e.preventDefault();
        this.cut();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        this.paste();
      }
    });
  }

  copy() {
    const cells = this.graph.getSelectionCells();
    if (cells.length === 0) return;
    this.clipboard = this.graph.cloneCells(cells);
    console.log('[Clipboard] Copied', cells.length, 'cell(s)');
  }

  cut() {
    const cells = this.graph.getSelectionCells();
    if (cells.length === 0) return;
    this.clipboard = this.graph.cloneCells(cells);
    this.graph.batchUpdate(() => {
      this.graph.removeCells(cells);
    });
    console.log('[Clipboard] Cut', cells.length, 'cell(s)');
  }

  paste() {
    if (this.clipboard.length === 0) return;

    this.graph.batchUpdate(() => {
      const imported = this.graph.importCells(this.clipboard, 20, 20);
      this.graph.setSelectionCells(imported);
    });

    console.log('[Clipboard] Pasted', this.clipboard.length, 'cell(s)');
  }
}
