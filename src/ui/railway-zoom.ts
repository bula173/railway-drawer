/**
 * @file railway-zoom.ts
 * @brief Railway drawings open zoomed in: the ERTMS / railway symbols are small (a signal is ~30x10 px), so at
 *        100 % a freshly opened template, railML import or Railway Script drawing was hard to read.
 *
 * `zoomRailwayDrawing(graph)` after opening such a drawing into an empty tab: the fit scale clamped to
 * `RAILWAY_MIN_ZOOM` (150 %) .. `RAILWAY_MAX_ZOOM` (200 %) when the drawing is small or medium (its fit scale
 * >= `LARGE_FIT`, i.e. at 150 % it is at most twice the view), the content centred, or its start (top-left)
 * shown where it does not fit. A large drawing (a whole station from railML) gets the plain fit (<= 100 %) as an
 * overview. A new empty tab stays at 100 %; View > Fit / Reset Zoom are unchanged. Not undoable (view state).
 */
import type { Graph } from '@maxgraph/core';
import { centerCanvasContent, resetCanvasScroll } from './canvas-scroll';

export const RAILWAY_MIN_ZOOM = 1.5;
export const RAILWAY_MAX_ZOOM = 2;
/** Fit scales below this are "large" drawings: plain fit instead of the 150 % minimum. */
export const LARGE_FIT = 0.75;
const BORDER = 20;

/** The zoom a railway drawing with fit scale `fit` opens at. */
export function railwayOpenZoom(fit: number): number {
  if (!Number.isFinite(fit) || fit <= 0) return 1;
  if (fit < LARGE_FIT) return Math.min(fit, 1);
  return Math.min(Math.max(fit, RAILWAY_MIN_ZOOM), RAILWAY_MAX_ZOOM);
}

/** Zooms a just opened railway drawing (shown tab) as described above; no-op on an empty or hidden graph. */
export function zoomRailwayDrawing(graph: Graph): void {
  const c = graph.container;
  if (!c || c.clientWidth <= 0 || c.clientHeight <= 0) return;
  const bounds = graph.getGraphBounds();
  if (bounds.width <= 0 && bounds.height <= 0) return;
  // a load while the tab was hidden left a pending scroll reset: do it now, so it does not undo the centring
  resetCanvasScroll(graph);
  const s = graph.view.scale;
  const w = Math.max(bounds.width / s, 1);
  const h = Math.max(bounds.height / s, 1);
  const fit = Math.min((c.clientWidth - 2 * BORDER) / w, (c.clientHeight - 2 * BORDER) / h);
  const target = railwayOpenZoom(fit);
  if (Math.abs(target - s) > 1e-3) graph.view.setScale(target);
  centerCanvasContent(graph);
}
