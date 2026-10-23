/**
 * @file statusbar.ts
 * @brief The status bar (zoom, selection count, message, version / build) and the toolbar's zoom
 *        select: one view for the app (TabManager's session views) showing the active session's
 *        zoom and selection (session.ts); a background tab's changes never reach it.
 */
import { onGraphEvent, onSelectionChange } from '../core/graph-events';
import { Graph, InternalEvent } from '@maxgraph/core';
import { ActiveSessionBinding, type GraphSession } from './session';

export class StatusBarController {
  /** The bound session's graph (the active tab's). */
  private graph!: Graph;
  private bound = false;
  private readonly binding: ActiveSessionBinding<GraphSession>;

  /** Follows the active session; with `graph`, stays on that graph (tests). */
  constructor(graph?: Graph) {
    this.binding = new ActiveSessionBinding<GraphSession>(
      (session, disposers) => {
        this.graph = session.graph;
        this.bound = true;
        // Zoom in the status bar and the toolbar select, on every scale change: buttons, menu, keys,
        // wheel/pinch (zoomIn/zoomOut/setScale fire SCALE), fit and zoomTo (SCALE_AND_TRANSLATE)
        disposers.add(onGraphEvent(session.graph.view, [InternalEvent.SCALE, InternalEvent.SCALE_AND_TRANSLATE], () => this.syncZoom()));
        // Selection count of the shown tab
        disposers.add(onSelectionChange(session.graph, () => this.syncSelection()));
        // the shown tab's zoom and selection (also after a tab switch)
        this.syncZoom();
        this.syncSelection();
      },
      () => {
        this.bound = false;
      },
      graph ? { graph } : null
    );
  }

  /** Unbinds the view (TabManager's views are destroyed). */
  destroy(): void {
    this.binding.dispose();
  }

  /** True while the bound graph is shown (the scenario view hides it). */
  private isShown(): boolean {
    if (!this.bound) return false;
    const container = this.graph.container;
    return !!container && container.isConnected && container.style.display !== 'none';
  }

  /** Shows the shown tab's selection count in the status bar. */
  syncSelection(): void {
    if (!this.isShown()) return;
    const statusSelected = document.getElementById('status-selected');
    if (statusSelected) statusSelected.textContent = String(this.graph.getSelectionCount());
  }

  /**
   * Shows the shown tab's zoom in the status bar and the toolbar's zoom select. A zoom that is not
   * one of the presets gets its own option.
   */
  syncZoom(): void {
    if (!this.isShown()) return;
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
