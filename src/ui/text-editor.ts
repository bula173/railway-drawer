import { Graph, InternalEvent } from '@maxgraph/core';

export class TextEditorController {
  private graph: Graph;

  constructor(graph: Graph) {
    this.graph = graph;
    this.setupTextEditingHandlers();
  }

  private setupTextEditingHandlers(): void {
    // CellEditorHandler already handles double-click text editing natively
    // We just need to add support for Enter/Space key to start editing

    // Listen for Enter/Space key on selected shapes
    document.addEventListener('keydown', (evt: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      if (evt.target instanceof HTMLInputElement || evt.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (evt.key === 'Enter' || evt.key === ' ') {
        const cells = this.graph.getSelectionCells();
        if (cells.length === 1 && cells[0].isVertex && cells[0].isVertex()) {
          console.log('[TextEditor] Enter/Space pressed, starting edit for:', cells[0].value);
          evt.preventDefault();
          this.startEditing(cells[0]);
        }
      }
    });

    // Log when text editing starts (for debugging)
    this.graph.addListener(InternalEvent.DOUBLE_CLICK, (_sender: any, evt: any) => {
      const cell = evt.getProperty('cell');
      if (cell && cell.isVertex && cell.isVertex()) {
        console.log('[TextEditor] Double-click detected on vertex:', cell.value);
      }
    });
  }

  private startEditing(cell: any): void {
    try {
      console.log('[TextEditor] Starting text editing for:', cell.value);

      // Try the cellEditorHandler stored on graph (from tabs.ts)
      const handler = (this.graph as any).cellEditorHandler;
      if (handler && handler.startEditing) {
        console.log('[TextEditor] Using cellEditorHandler.startEditing()');
        handler.startEditing(cell);
        return;
      }

      console.error('[TextEditor] cellEditorHandler not found on graph');
    } catch (error) {
      console.error('[TextEditor] Error starting editing:', error);
    }
  }
}
