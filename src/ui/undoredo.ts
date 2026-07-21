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
    this.undoManager.addListener('undoableEdit', () => {
      this.updateButtonStates();
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
    const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement | null;
    const redoBtn = document.getElementById('btn-redo') as HTMLButtonElement | null;

    if (undoBtn) {
      undoBtn.addEventListener('click', () => this.undo());
      undoBtn.disabled = true;
    }

    if (redoBtn) {
      redoBtn.addEventListener('click', () => this.redo());
      redoBtn.disabled = true;
    }
  }

  undo() {
    if (this.undoManager.canUndo()) {
      this.undoManager.undo();
      console.log('[UndoRedo] Undo');
      this.updateButtonStates();
    }
  }

  redo() {
    if (this.undoManager.canRedo()) {
      this.undoManager.redo();
      console.log('[UndoRedo] Redo');
      this.updateButtonStates();
    }
  }

  private updateButtonStates() {
    const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement | null;
    const redoBtn = document.getElementById('btn-redo') as HTMLButtonElement | null;

    if (undoBtn) {
      undoBtn.disabled = !this.undoManager.canUndo();
    }
    if (redoBtn) {
      redoBtn.disabled = !this.undoManager.canRedo();
    }
  }
}
