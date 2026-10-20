import { Graph, InternalEvent } from '@maxgraph/core';

export class StatusBarController {
  private graph: Graph;

  constructor(graph: Graph) {
    this.graph = graph;
    this.setupListeners();
  }

  private setupListeners(): void {
    // Zoom in the status bar and the toolbar select, on every scale change: buttons, menu, keys,
    // wheel/pinch (zoomIn/zoomOut/setScale fire SCALE), fit and zoomTo (SCALE_AND_TRANSLATE)
    const onScale = () => this.syncZoom();
    this.graph.view.addListener(InternalEvent.SCALE, onScale);
    this.graph.view.addListener(InternalEvent.SCALE_AND_TRANSLATE, onScale);
    this.syncZoom();

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

  /**
   * Shows this tab's zoom in the status bar and the toolbar's zoom select (only while this tab is
   * the shown one: the DOM is shared). A zoom that is not one of the presets gets its own option.
   */
  syncZoom(): void {
    const container = this.graph.container;
    if (!container || !container.isConnected || container.style.display === 'none') return;
    const zoom = Math.round(this.graph.view.scale * 100);
    const statusZoom = document.getElementById('status-zoom');
    if (statusZoom) statusZoom.textContent = `${zoom}%`;
    const zoomSelect = document.getElementById('zoom-level') as HTMLSelectElement | null;
    if (!zoomSelect) return;
    const value = String(zoom);
    let custom = zoomSelect.querySelector<HTMLOptionElement>('option[data-custom]');
    const preset = Array.from(zoomSelect.options).some((o) => o !== custom && o.value === value);
    if (preset) {
      custom?.remove();
    } else {
      if (!custom) {
        custom = document.createElement('option');
        custom.dataset.custom = 'true';
      }
      custom.value = value;
      custom.textContent = `${zoom}%`;
      // Keep the options in ascending order
      const after = Array.from(zoomSelect.options).find((o) => o !== custom && Number(o.value) > zoom);
      zoomSelect.insertBefore(custom, after ?? null);
    }
    zoomSelect.value = value;
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

  setVersion(version: string): void {
    const versionEl = document.getElementById('status-version');
    if (versionEl) versionEl.textContent = version;
  }

  setBuildId(buildId: string): void {
    const buildEl = document.getElementById('status-build');
    if (buildEl) {
      buildEl.textContent = buildId;
      buildEl.title = `Build ID: ${buildId}`;
    }
  }

  setBuildDate(buildDate: string): void {
    const buildDateEl = document.getElementById('status-build-date');
    if (buildDateEl) {
      buildDateEl.textContent = buildDate;
      buildDateEl.title = `Build time: ${buildDate}`;
    }
  }
}
