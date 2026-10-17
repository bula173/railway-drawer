/**
 * @file handle-colors.ts
 * @brief Selection / hover / connection feedback readable on the dark canvas.
 *
 * maxGraph 0.10 draws its interaction feedback with fixed colours from util/Constants: green
 * selection, handles and valid-target highlights (#00FF00, fine on both canvases), red invalid /
 * locked feedback, and blue (#0000FF) for drop-target highlights (DragSource, SelectionHandler)
 * and the handle of a connected edge end (EdgeHandler CONNECT_HANDLE_FILLCOLOR). Blue has only
 * 2.4:1 contrast on the dark canvas (#121212). In dark mode every highlight stroke and edge
 * handle fill is lightened to DARK_MIN_GRAPHICS_CONTRAST against the canvas (#0000FF -> a light
 * blue), keeping its hue; colours that already contrast enough and the light theme are unchanged.
 */
import { CellHighlight, EdgeHandler } from '@maxgraph/core';
import type { Graph, Shape } from '@maxgraph/core';
import { DARK_MIN_GRAPHICS_CONTRAST, ensureContrast } from './colors';
import { darkCanvasColor, getColorResolveOptions, isGraphDarkMode } from './graph-compat';

/** `color` as interaction feedback on `graph`: unchanged in light mode, contrast floor in dark mode. */
export function feedbackColor(graph: Graph | null | undefined, color: string): string;
export function feedbackColor(graph: Graph | null | undefined, color: string | null | undefined): string | null | undefined;
export function feedbackColor(graph: Graph | null | undefined, color: string | null | undefined): string | null | undefined {
  if (!graph || typeof color !== 'string' || !isGraphDarkMode(graph)) return color;
  const options = getColorResolveOptions(graph);
  if (options.adaptive === 'none') return color;
  return ensureContrast(color, darkCanvasColor(options), DARK_MIN_GRAPHICS_CONTRAST);
}

let installed = false;

/** Patches CellHighlight and EdgeHandler once (idempotent). */
export function installDarkFeedbackColors(): void {
  if (installed) return;
  installed = true;

  type HighlightProto = {
    graph: Graph;
    shape: Shape | null;
    createShape(): Shape;
    setHighlightColor(color: string): void;
  };
  const hp = CellHighlight.prototype as unknown as HighlightProto;
  const baseCreate = hp.createShape;
  hp.createShape = function createShape(this: HighlightProto): Shape {
    const shape = baseCreate.call(this);
    if (shape && typeof shape.stroke === 'string') shape.stroke = feedbackColor(this.graph, shape.stroke);
    return shape;
  };
  const baseSet = hp.setHighlightColor;
  hp.setHighlightColor = function setHighlightColor(this: HighlightProto, color: string): void {
    baseSet.call(this, color);
    if (this.shape && typeof this.shape.stroke === 'string') this.shape.stroke = feedbackColor(this.graph, this.shape.stroke);
  };

  type EdgeHandlerProto = { graph: Graph; getHandleFillColor(index: number): string };
  const ep = EdgeHandler.prototype as unknown as EdgeHandlerProto;
  const baseFill = ep.getHandleFillColor;
  ep.getHandleFillColor = function getHandleFillColor(this: EdgeHandlerProto, index: number): string {
    return feedbackColor(this.graph, baseFill.call(this, index));
  };
}
