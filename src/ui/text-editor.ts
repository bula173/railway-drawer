import { Graph, InternalEvent } from '@maxgraph/core';

export class TextEditorController {
  private cellEditor: any;

  constructor(graph: Graph) {
    // CellEditorHandler is already available on the graph through default plugins
    this.cellEditor = (graph as any).cellEditor;

    // Setup double-click to start editing
    this.setupDoubleClickEditing(graph);
  }

  private setupDoubleClickEditing(graph: Graph): void {
    // Listen for double-click events
    graph.addListener(InternalEvent.DOUBLE_CLICK, (_sender: any, evt: any) => {
      const cell = evt.getProperty('cell');
      console.log('[TextEditor] Double-click detected on:', cell);

      // Only allow editing for vertices (shapes), not edges
      if (cell && cell.isVertex && cell.isVertex()) {
        console.log('[TextEditor] Starting edit for vertex:', cell.value);
        this.editCell(graph, cell);
      }
    });
  }

  private editCell(_graph: Graph, cell: any): void {
    // Use maxGraph's built-in cell editor
    if (this.cellEditor) {
      console.log('[TextEditor] cellEditor.startEditing() called');
      this.cellEditor.startEditing(cell);
    } else {
      console.error('[TextEditor] Cell editor not available');
    }
  }
}
