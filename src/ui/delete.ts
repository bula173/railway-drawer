import { Graph } from '@maxgraph/core';
import { logger } from '../drawio/logger';

export { isEditableTarget, shouldIgnoreGraphShortcut } from '../core/keyboard-guard';

/**
 * Deletes the selected cells of one graph.
 * Keyboard handling (Delete/Backspace) is dispatched once, to the active tab, by the global
 * shortcut handler in main-editor.ts; this controller no longer binds to `document` itself, because
 * one listener per tab acted on every tab (including hidden ones) and ignored text editing.
 */
export class DeleteController {
  private graph: Graph;

  constructor(graph: Graph) {
    this.graph = graph;
  }

  deleteSelection() {
    const cells = this.graph.getSelectionCells();
    if (cells.length === 0) return;

    this.graph.batchUpdate(() => {
      // draw.io deleteCells: locked cells (locked=1, cell-lock.ts) stay, and so do their edges
      this.graph.removeCells(this.graph.getDeletableCells(cells));
    });

    logger.debug('Delete', 'Deleted', [cells.length, 'cell(s)']);
  }
}
