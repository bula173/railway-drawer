/**
 * @file grid-toggle.ts
 * @brief One grid switch for View > Grid, the toolbar grid button and Properties > Canvas > Grid:
 *        the canvas checkbox's change listeners show the grid (CanvasProperties) and turn snapping
 *        on (InteractiveUIController); the menu item / button states follow.
 *        The grid is per tab: `graph.gridEnabled` / `graph.gridSize` are the state, loaded from and
 *        saved to draw.io's `grid` / `gridSize` on `<mxGraphModel>` (SaveLoadController), and the
 *        shared controls show the active tab's (`syncGridUi` on tab switch and after a load).
 */
import type { Graph } from '@maxgraph/core';
import { applyGridBackground } from './grid-background';

/** Window event after a load changed a tab's grid (`detail.graph`); TabManager syncs the controls. */
export const GRID_SETTINGS_EVENT = 'rd-grid-settings';

/** Applies a page's grid settings to `graph` (active or background tab) without touching shared controls. */
export function applyGridSettings(graph: Graph, settings: { grid?: boolean; gridSize?: number }): void {
  if (settings.gridSize !== undefined && Number.isFinite(settings.gridSize) && settings.gridSize > 0) {
    graph.gridSize = settings.gridSize;
  }
  if (settings.grid !== undefined) graph.gridEnabled = settings.grid;
  applyGridBackground(graph.getContainer(), graph.gridSize, graph.gridEnabled);
}

/** The shared grid controls (View > Grid, toolbar, Properties > Canvas checkbox and size) show `graph`'s grid. */
export function syncGridUi(graph: Graph): void {
  const checkbox = document.getElementById('canvas-gridEnabled') as HTMLInputElement | null;
  if (checkbox) checkbox.checked = graph.gridEnabled;
  const size = document.getElementById('canvas-gridSize') as HTMLInputElement | null;
  if (size) size.value = String(graph.gridSize);
  syncGridControls(graph.gridEnabled);
}

/** Shows (and snaps to) the grid of `graph`, or hides it. */
export function setGridShown(graph: Graph, on: boolean): void {
  const checkbox = document.getElementById('canvas-gridEnabled') as HTMLInputElement | null;
  if (checkbox) {
    checkbox.checked = on;
    checkbox.dispatchEvent(new Event('change'));
  }
  graph.gridEnabled = on;
  syncGridControls(on);
}

/** View > Grid (aria-checked) and the toolbar button (aria-pressed). */
export function syncGridControls(on: boolean): void {
  document.querySelectorAll('[data-action="showGrid"]').forEach((item) => item.setAttribute('aria-checked', String(on)));
  document.getElementById('btn-grid')?.setAttribute('aria-pressed', String(on));
}
