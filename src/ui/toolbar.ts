export class ToolbarController {
  constructor() {
    this.setupHandlers();
  }

  private setupHandlers() {
    // NOTE: Zoom handlers are managed by ZoomController to avoid duplicates
    // NOTE: Undo/Redo are handled by UndoRedoController and keyboard shortcuts

    // Format Painter (stub for future implementation)
    document.getElementById('btn-format-painter')?.addEventListener('click', () => {
      console.log('[Toolbar] Format Painter - Not yet implemented');
    });

    // More Options (stub for future implementation)
    document.getElementById('btn-more-options')?.addEventListener('click', () => {
      console.log('[Toolbar] More Options - Not yet implemented');
    });
  }
}
