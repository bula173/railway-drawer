import { Graph } from '@maxgraph/core';

export class ZoomController {
  private graph: Graph;

  constructor(graph: Graph) {
    this.graph = graph;
    this.setupZoomButtons();
    this.setupKeyboardShortcuts();
    this.setupMouseWheelZoom();
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

  private setupMouseWheelZoom(): void {
    const container = this.graph.getContainer();

    container.addEventListener('wheel', (e: WheelEvent) => {
      // Only zoom if Ctrl/Cmd is pressed
      if (!e.ctrlKey && !e.metaKey) {
        return;
      }

      e.preventDefault();

      if (e.deltaY < 0) {
        this.zoomIn();
      } else if (e.deltaY > 0) {
        this.zoomOut();
      }
    });
  }

  zoomIn(): void {
    const scale = 1.2;
    const view = this.graph.getView();
    const currentZoom = view.getScale();
    const newZoom = Math.min(currentZoom * scale, 5); // Max 500%
    view.setScale(newZoom);
    this.updateStatusBar(newZoom);
  }

  zoomOut(): void {
    const scale = 1 / 1.2;
    const view = this.graph.getView();
    const currentZoom = view.getScale();
    const newZoom = Math.max(currentZoom * scale, 0.1); // Min 10%
    view.setScale(newZoom);
    this.updateStatusBar(newZoom);
  }

  zoomActual(): void {
    const view = this.graph.getView();
    view.setScale(1);
    this.updateStatusBar(1);
  }

  zoomToFit(): void {
    const border = 20;
    this.graph.fit(border);
    const view = this.graph.getView();
    const zoom = view.getScale();
    this.updateStatusBar(zoom);
  }

  private updateStatusBar(zoom: number): void {
    const statusBar = document.querySelector('.status-bar-zoom') as HTMLElement;
    if (statusBar) {
      statusBar.textContent = `${Math.round(zoom * 100)}%`;
    }
  }

  destroy(): void {
    // Cleanup if needed
  }
}
