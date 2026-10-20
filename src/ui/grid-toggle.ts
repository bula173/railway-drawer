/**
 * @file grid-toggle.ts
 * @brief One grid switch for View > Grid, the toolbar grid button and Properties > Canvas > Grid:
 *        the canvas checkbox's change listeners show the grid (CanvasProperties) and turn snapping
 *        on (InteractiveUIController); the menu item / button states follow.
 */
import type { Graph } from '@maxgraph/core';

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
