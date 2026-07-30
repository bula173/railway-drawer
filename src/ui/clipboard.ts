import { Graph } from '@maxgraph/core';
import { ClipboardService } from '../services/clipboard-service';

export class ClipboardController {
  private graph: Graph;
  private clipboardService: ClipboardService;

  constructor(graph: Graph) {
    this.graph = graph;
    this.clipboardService = ClipboardService.getInstance();
    this.setupKeyboardShortcuts();
  }

  private setupKeyboardShortcuts(): void {
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

  copy(): void {
    const cells = this.graph.getSelectionCells();
    this.clipboardService.copy(cells, this.graph);
  }

  cut(): void {
    const cells = this.graph.getSelectionCells();
    this.clipboardService.cut(cells, this.graph);
  }

  paste(): void {
    this.clipboardService.paste(this.graph, 20, 20);
  }
}
