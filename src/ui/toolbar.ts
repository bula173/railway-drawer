import { Graph } from '@maxgraph/core';

export class ToolbarController {
  private graph: Graph;

  constructor(graph: Graph) {
    this.graph = graph;
    this.setupHandlers();
  }

  private setupHandlers() {
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
      this.graph.zoomIn();
    });

    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
      this.graph.zoomOut();
    });

    document.getElementById('btn-fit')?.addEventListener('click', () => {
      this.graph.fit(20);
    });

    document.getElementById('btn-reset-zoom')?.addEventListener('click', () => {
      this.graph.zoomActual();
    });

    document.getElementById('btn-undo')?.addEventListener('click', () => {
      // TODO: Implement undo
    });

    document.getElementById('btn-redo')?.addEventListener('click', () => {
      // TODO: Implement redo
    });
  }
}
