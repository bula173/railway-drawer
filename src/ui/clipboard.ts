import { Graph } from '@maxgraph/core';
import { ClipboardService } from '../services/clipboard-service';

/**
 * Clipboard commands for one graph.
 * Ctrl/Cmd+C/X/V are dispatched once, to the active tab, by the global shortcut handler in
 * legacy-main.ts (guarded by `shouldIgnoreGraphShortcut` from ./delete). This controller no longer
 * binds its own `document` keydown listener: that listener ran in addition to legacy-main.ts (double
 * paste at the same offset), ran once per open tab, and hijacked copy/paste inside text fields.
 */
export class ClipboardController {
  private graph: Graph;
  private clipboardService: ClipboardService;

  constructor(graph: Graph) {
    this.graph = graph;
    this.clipboardService = ClipboardService.getInstance();
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
