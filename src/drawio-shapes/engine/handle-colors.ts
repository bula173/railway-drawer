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
 *
 * Selection like draw.io: vertex / edge selection borders and the sizer / bend handles are draw.io blue instead of
 * maxGraph's green (green means proceed / free in railway drawings). `SELECTION_COLOR` mirrors the chrome token
 * `--rd-selection` (variables.css): >= 3:1 on the light (#fff) and the dark (#121212) canvas. Sizers are round
 * dots with a white rim like draw.io's handle image; their bounds (and so the hit area) are maxGraph's.
 */
import { CellHighlight, EdgeHandler, EllipseShape, RectangleShape, VertexHandler } from '@maxgraph/core';
import type { Graph, Rectangle, Shape } from '@maxgraph/core';
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

/** Selection colour per canvas (= `--rd-selection` light / dark in variables.css). */
export const SELECTION_COLOR = { light: '#0f8bd0', dark: '#29b6f2' } as const;
/** maxGraph's HANDLE_FILLCOLOR / VERTEX_SELECTION_COLOR (util/Constants), replaced by the selection colour. */
const MAXGRAPH_GREEN = '#00FF00';
const HANDLE_RIM = '#ffffff';

/** Selection border / handle colour on `graph`'s canvas. */
export function selectionColor(graph: Graph | null | undefined): string {
  return feedbackColor(graph, graph && isGraphDarkMode(graph) ? SELECTION_COLOR.dark : SELECTION_COLOR.light);
}

function isMaxGraphGreen(color: unknown): boolean {
  return typeof color === 'string' && color.toUpperCase() === MAXGRAPH_GREEN;
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
    const color = baseFill.call(this, index);
    return isMaxGraphGreen(color) ? selectionColor(this.graph) : feedbackColor(this.graph, color);
  };
  installSelectionColors();
}

function installSelectionColors(): void {
  type SelectionProto = { graph: Graph; getSelectionColor(): string };
  for (const proto of [VertexHandler.prototype, EdgeHandler.prototype] as unknown as SelectionProto[]) {
    proto.getSelectionColor = function getSelectionColor(this: SelectionProto): string {
      return selectionColor(this.graph);
    };
  }

  type SizerProto = { graph: Graph; createSizerShape(bounds: Rectangle, index: number, fillColor?: string): Shape };
  const vp = VertexHandler.prototype as unknown as SizerProto;
  const baseSizer = vp.createSizerShape;
  vp.createSizerShape = function createSizerShape(this: SizerProto, bounds: Rectangle, index: number, fillColor?: string): Shape {
    const shape = baseSizer.call(this, bounds, index, fillColor);
    if ((shape instanceof RectangleShape || shape instanceof EllipseShape) && (fillColor == null || isMaxGraphGreen(fillColor))) {
      const dot = new EllipseShape(shape.bounds!, selectionColor(this.graph), HANDLE_RIM);
      return dot;
    }
    return shape;
  };

  type BendProto = { graph: Graph; createHandleShape(index?: number): Shape };
  const bp = EdgeHandler.prototype as unknown as BendProto;
  const baseHandle = bp.createHandleShape;
  bp.createHandleShape = function createHandleShape(this: BendProto, index?: number): Shape {
    const shape = baseHandle.call(this, index);
    if (isMaxGraphGreen(shape.fill)) {
      shape.fill = selectionColor(this.graph);
      shape.stroke = HANDLE_RIM;
    }
    return shape;
  };
}
