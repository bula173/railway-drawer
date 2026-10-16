import { Graph, PanningHandler } from '@maxgraph/core';
import { shouldIgnoreGraphShortcut } from './delete';

export class PanController {
  private graph: Graph;
  private panningHandler: PanningHandler;
  private isPanMode: boolean = false;

  constructor(graph: Graph) {
    this.graph = graph;
    this.panningHandler = new PanningHandler(graph);
    this.setupKeyboardToggle();
  }

  private setupKeyboardToggle() {
    document.addEventListener('keydown', (e) => {
      // Space typed into a text field or label editor is text, not the pan modifier
      if (shouldIgnoreGraphShortcut(e, this.graph)) return;
      if (e.key === ' ' && !this.isPanMode) {
        e.preventDefault();
        this.enablePan();
      }
    });

    // Not guarded: releasing Space must always leave pan mode, even if focus moved meanwhile
    document.addEventListener('keyup', (e) => {
      if (e.key === ' ' && this.isPanMode) {
        this.disablePan();
      }
    });
  }

  enablePan() {
    this.panningHandler.useLeftButtonForPanning = true;
    this.isPanMode = true;
    console.log('[Pan] Pan mode enabled');
  }

  disablePan() {
    this.panningHandler.useLeftButtonForPanning = false;
    this.isPanMode = false;
    console.log('[Pan] Pan mode disabled');
  }
}
