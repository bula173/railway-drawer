import { Graph, PanningHandler } from '@maxgraph/core';

export class PanController {
  private panningHandler: PanningHandler;
  private isPanMode: boolean = false;

  constructor(graph: Graph) {
    this.panningHandler = new PanningHandler(graph);
    this.setupKeyboardToggle();
  }

  private setupKeyboardToggle() {
    document.addEventListener('keydown', (e) => {
      if (e.key === ' ' && !this.isPanMode) {
        e.preventDefault();
        this.enablePan();
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === ' ' && this.isPanMode) {
        this.disablePan();
      }
    });
  }

  enablePan() {
    (this.panningHandler as any).active = true;
    this.isPanMode = true;
    console.log('[Pan] Pan mode enabled');
  }

  disablePan() {
    (this.panningHandler as any).active = false;
    this.isPanMode = false;
    console.log('[Pan] Pan mode disabled');
  }
}
