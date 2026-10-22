import { Graph } from '@maxgraph/core';

export class ZoomController {
  private graph: Graph;

  constructor(graph: Graph) {
    this.graph = graph;
    this.setupZoomButtons();
    this.setupKeyboardShortcuts();
  }

  private setupZoomButtons(): void {
    const zoomInBtn = document.getElementById('btn-zoom-in');
    const zoomOutBtn = document.getElementById('btn-zoom-out');
    const zoomFitBtn = document.getElementById('btn-zoom-fit');
    const zoomActualBtn = document.getElementById('btn-zoom-actual');

    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => this.zoomIn());
    }
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => this.zoomOut());
    }
    if (zoomFitBtn) {
      zoomFitBtn.addEventListener('click', () => this.zoomToFit());
    }
    if (zoomActualBtn) {
      zoomActualBtn.addEventListener('click', () => this.zoomActual());
    }
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ctrl/Cmd + Plus/Equals for zoom in
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        this.zoomIn();
      }

      // Ctrl/Cmd + Minus for zoom out
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        this.zoomOut();
      }

      // Ctrl/Cmd + 0 for actual size (100%)
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        this.zoomActual();
      }

      // Ctrl/Cmd + 1 for fit to view
      if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault();
        this.zoomToFit();
      }
    });
  }

  // Ctrl/Cmd+wheel and pinch zoom around the pointer: canvas-scroll.ts (installCanvasScroll).
  // The commands below go through the graph, which canvas-scroll.ts makes keep the view centre
  // (zoom), and centre the content (zoomActual, fit). The status bar follows the SCALE events.

  zoomIn(): void {
    this.graph.zoomIn();
  }

  zoomOut(): void {
    this.graph.zoomOut();
  }

  zoomActual(): void {
    this.graph.zoomActual();
  }

  zoomToFit(): void {
    this.graph.fit(20);
  }

  destroy(): void {
    // Cleanup if needed
  }
}
