import { Graph } from '@maxgraph/core';

export class GridSnapController {
  private graph: Graph;
  private snapEnabled = true;
  private gridSize = 10;

  constructor(graph: Graph) {
    this.graph = graph;
    this.setupGridSnap();
    this.setupToggleButton();
  }

  private setupGridSnap(): void {
    // Enable grid snap by default
    this.graph.gridSize = this.gridSize;
    (this.graph as any).snapLarge = true;
  }

  private setupToggleButton(): void {
    const toggleBtn = document.getElementById('btn-grid-snap');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleSnap());
      this.updateButtonState(toggleBtn);
    }
  }

  toggleSnap(): void {
    this.snapEnabled = !this.snapEnabled;

    if (this.snapEnabled) {
      this.graph.gridSize = this.gridSize;
      console.log('[GridSnap] Grid snap enabled');
    } else {
      this.graph.gridSize = 1; // Set to 1 to effectively disable snapping
      console.log('[GridSnap] Grid snap disabled');
    }

    const toggleBtn = document.getElementById('btn-grid-snap');
    if (toggleBtn) {
      this.updateButtonState(toggleBtn);
    }
  }

  private updateButtonState(btn: HTMLElement): void {
    if (this.snapEnabled) {
      btn.classList.add('active');
      btn.title = 'Grid Snap: ON (Click to disable)';
    } else {
      btn.classList.remove('active');
      btn.title = 'Grid Snap: OFF (Click to enable)';
    }
  }

  isSnapEnabled(): boolean {
    return this.snapEnabled;
  }

  setGridSize(size: number): void {
    this.gridSize = size;
    if (this.snapEnabled) {
      this.graph.gridSize = size;
    }
    console.log(`[GridSnap] Grid size set to ${size}px`);
  }

  destroy(): void {
    // Cleanup if needed
  }
}
