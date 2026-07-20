import { Graph, UndoManager } from '@maxgraph/core';

export class UndoRedoController {
  private graph: Graph;
  private undoManager: UndoManager;

  constructor(graph: Graph) {
    this.graph = graph;
    this.undoManager = new UndoManager();
    this.setupListeners();
    this.setupKeyboardShortcuts();
    this.setupToolbarButtons();
  }

  private setupListeners() {
    (this.graph as any).model.addListener('change', (_sender: any, evt: any) => {
      this.undoManager.undoableEditHappened(evt.getProperty('edit'));
    });
  }

  private setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        this.undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        this.redo();
      }
    });
  }

  private setupToolbarButtons() {
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');

    if (undoBtn) {
      undoBtn.addEventListener('click', () => this.undo());
    }

    if (redoBtn) {
      redoBtn.addEventListener('click', () => this.redo());
    }
  }

  undo() {
    this.undoManager.undo();
    console.log('[UndoRedo] Undo');
  }

  redo() {
    this.undoManager.redo();
    console.log('[UndoRedo] Redo');
  }
}
