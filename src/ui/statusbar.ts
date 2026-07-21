import { Graph } from '@maxgraph/core';

export class StatusBarController {
  private graph: Graph;

  constructor(graph: Graph) {
    this.graph = graph;
    this.setupListeners();
  }

  private setupListeners(): void {
    // Update zoom status and sync zoom selector
    this.graph.view.addListener('scale', () => {
      const zoom = Math.round(this.graph.view.scale * 100);
      const statusZoom = document.getElementById('status-zoom');
      if (statusZoom) statusZoom.textContent = `${zoom}%`;

      // Sync zoom selector if it matches a standard value
      const zoomSelect = document.getElementById('zoom-level') as HTMLSelectElement;
      if (zoomSelect) {
        const options = Array.from(zoomSelect.options).map((o) => parseInt(o.value));
        if (options.includes(zoom)) {
          zoomSelect.value = zoom.toString();
        }
      }
    });

    // Update selection status
    this.graph.getSelectionModel().addListener('change', () => {
      const cells = this.graph.getSelectionCells();
      const statusSelected = document.getElementById('status-selected');
      const newValue = cells.length.toString();

      console.log('[StatusBar] Selection changed:', cells.length);
      console.log('[StatusBar] Element found:', !!statusSelected);
      console.log('[StatusBar] Current value:', statusSelected?.textContent);
      console.log('[StatusBar] New value:', newValue);

      if (statusSelected) {
        statusSelected.textContent = newValue;
        console.log('[StatusBar] After update:', statusSelected.textContent);
        console.log('[StatusBar] HTML:', statusSelected.outerHTML);
      }
    });
  }

  setMessage(message: string, duration: number = 3000) {
    const messageEl = document.getElementById('status-message');
    if (messageEl) {
      messageEl.textContent = message;
      messageEl.classList.add('active');

      setTimeout(() => {
        if (messageEl.textContent === message) {
          messageEl.textContent = 'Ready';
          messageEl.classList.remove('active');
        }
      }, duration);
    }
  }
}
