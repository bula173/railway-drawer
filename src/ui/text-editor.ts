import { Graph, Point } from '@maxgraph/core';

export class TextEditorController {
  private graph: Graph;
  private lastClickedCell: any = null;
  private lastClickTime: number = 0;
  private clickDelay: number = 400;

  constructor(graph: Graph) {
    this.graph = graph;
    this.setupTextEditingHandlers();
  }

  private setupTextEditingHandlers(): void {
    const container = this.graph.getContainer();

    // Track mouse clicks to detect double-click on same cell
    container.addEventListener('mousedown', (evt: MouseEvent) => {
      // Get the cell at the click position using graph coordinates
      const point = this.getGraphCoordinates(evt);
      const cell = this.graph.getCellAt(point.x, point.y);

      const now = Date.now();

      if (cell && cell.isVertex && cell.isVertex()) {
        // Check if this is a double-click (same cell, within time delay)
        if (this.lastClickedCell === cell && now - this.lastClickTime < this.clickDelay) {
          console.log('[TextEditor] Double-click detected on:', cell.value);
          this.startEditing(cell);
          this.lastClickedCell = null;
          this.lastClickTime = 0;
          evt.preventDefault();
        } else {
          // Single click - just update tracking
          this.lastClickedCell = cell;
          this.lastClickTime = now;
        }
      } else {
        // Clicked on empty space - reset tracking
        this.lastClickedCell = null;
        this.lastClickTime = 0;
      }
    });

    // Also listen for Enter/Space key on selected shapes
    document.addEventListener('keydown', (evt: KeyboardEvent) => {
      if ((evt.key === 'Enter' || evt.key === ' ') && evt.target === document.body) {
        const cells = this.graph.getSelectionCells();
        if (cells.length === 1 && cells[0].isVertex && cells[0].isVertex()) {
          console.log('[TextEditor] Enter/Space pressed, starting edit for:', cells[0].value);
          evt.preventDefault();
          this.startEditing(cells[0]);
        }
      }
    });
  }

  private getGraphCoordinates(evt: MouseEvent): Point {
    const container = this.graph.getContainer();
    const rect = container.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;

    // Create a point with the relative coordinates
    const point = new Point(x, y);
    return point;
  }

  private startEditing(cell: any): void {
    try {
      console.log('[TextEditor] Attempting to start editing for:', cell.value);

      // Try the cellEditorHandler stored on graph (from tabs.ts)
      const handler = (this.graph as any).cellEditorHandler;
      if (handler && handler.startEditing) {
        console.log('[TextEditor] Using cellEditorHandler.startEditing()');
        handler.startEditing(cell);
        return;
      }

      // Try to get the cell editor from the graph view
      const view = (this.graph as any).getView();
      if (view && view.cellEditor) {
        console.log('[TextEditor] Using view.cellEditor.startEditing()');
        view.cellEditor.startEditing(cell);
        return;
      }

      // Try the direct cellEditor property on graph
      const cellEditor = (this.graph as any).cellEditor;
      if (cellEditor && cellEditor.startEditing) {
        console.log('[TextEditor] Using graph.cellEditor.startEditing()');
        cellEditor.startEditing(cell);
        return;
      }

      // Try using graph's built-in startEditing method
      if ((this.graph as any).startEditing) {
        console.log('[TextEditor] Using graph.startEditing()');
        (this.graph as any).startEditing(cell);
        return;
      }

      console.error('[TextEditor] No cell editor method found');
    } catch (error) {
      console.error('[TextEditor] Error starting editing:', error);
    }
  }
}
