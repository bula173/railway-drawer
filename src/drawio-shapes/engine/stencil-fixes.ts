/**
 * @file stencil-fixes.ts
 * @brief Fixes in maxGraph 0.10's StencilShape so draw.io stencils draw as in draw.io.
 *
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG. Licensed under the Apache
 * License, Version 2.0. Behaviour of jgraph/drawio v32.4.1 src/main/webapp/mxgraph/src/shape/mxStencil.js
 * (drawNode, `arc`), which passes the flag attributes to mxUtils.arcToCurves, where they are
 * compared numerically ("0" means false).
 *
 * maxGraph 0.10.3 StencilShape.drawNode
 * - converts `large-arc-flag` / `sweep-flag` with `Boolean(node.getAttribute(...))`, so the
 *   string "0" becomes true and every arc with a 0 flag takes the wrong (large / mirrored) path:
 *   ticks, moons, half circles, the flowchart delay, U-turn arrows, ... render as big circles;
 * - passes `<fillcolor>` / `<strokecolor>` / `<fontcolor>` colours verbatim, while draw.io
 *   (mxStencil.parseColor/getColorValue, mxStencil.js:540-640) also accepts `stroke`, `fill`,
 *   `font` and style keys such as `accentColor` with a `default` (e.g. flowchart Parallel Mode).
 */
import { StencilShape } from '@maxgraph/core';
import type { AbstractCanvas2D, Graph, Rectangle, Shape } from '@maxgraph/core';
import {
  DARK_MIN_CANVAS_TEXT_CONTRAST,
  DARK_MIN_GRAPHICS_CONTRAST,
  ensureContrast,
  isDarkResolve,
  resolveColorValue,
  resolveLightDark,
  type ColorResolveOptions,
} from './colors';
import { darkCanvasColor, getColorResolveOptions, isGraphDarkMode } from './graph-compat';

/** draw.io's reading of an arc flag attribute: numeric, so "0" (and a missing value) is false. */
export function arcFlag(value: string | null): boolean {
  if (value === null) return false;
  const n = parseFloat(value);
  return Number.isNaN(n) ? value === 'true' : n !== 0;
}

/** mxUtils.isValidColor: a colour literal rather than a style key (`accentColor`, `fillColor2`). */
function isColorLiteral(value: string): boolean {
  return /^(#|rgb|hsl|light-dark\(|var\()/i.test(value) || /^[a-z]+$/.test(value);
}

/** The graph a shape is drawn for (its cell state's view), if any. */
function graphOf(shape: Shape): Graph | null {
  return ((shape as unknown as { state?: { view?: { graph?: Graph } } }).state?.view?.graph ?? null) as Graph | null;
}

/**
 * Dark rendering of a stencil's own colour (a literal in the stencil XML or a node default, which
 * the cell style does not carry): adaptive like style colours (colors.ts adaptiveDarkColor:
 * black -> light, white -> dark, saturated kept), strokes and text with the same minimum
 * contrast against the canvas as style colours (graph-compat.ts applyDarkContrast).
 */
function darkStencilColor(color: string, nodeName: string, options: ColorResolveOptions): string {
  const resolved = resolveColorValue(color, nodeName === 'fillcolor' ? 'fillColor' : nodeName === 'fontcolor' ? 'fontColor' : 'strokeColor', undefined, options);
  if (typeof resolved !== 'string') return color;
  if (nodeName === 'strokecolor') return ensureContrast(resolved, darkCanvasColor(options), DARK_MIN_GRAPHICS_CONTRAST);
  if (nodeName === 'fontcolor') return ensureContrast(resolved, darkCanvasColor(options), DARK_MIN_CANVAS_TEXT_CONTRAST);
  return resolved;
}

/**
 * mxStencil.parseColor (mxStencil.js:540). Colours taken from the shape (`stroke`, `fill`) or the
 * resolved cell style are already in the graph's colour mode; literal and default colours of the
 * stencil itself are resolved for it here (light-dark(), and adaptive colours in dark mode).
 */
export function stencilColor(shape: Shape, node: Element, value: string | null): string | null {
  if (value === null) return null;
  const style = (shape.style ?? null) as Record<string, unknown> | null;
  let result: unknown = value;
  // true when the value comes from the stencil (literal or node default), not from the cell
  let own = true;
  if (value === 'stroke') {
    result = (shape as unknown as { stroke?: string }).stroke;
    own = false;
  } else if (value === 'fill') {
    result = (shape as unknown as { fill?: string }).fill;
    own = false;
  } else if (value === 'font' && style) {
    own = style.fontColor == null;
    result = style.fontColor ?? 'black';
  } else if (style && !isColorLiteral(value)) {
    // getColorValue: the style key, else the node's default
    const defaultValue = node.getAttribute('default');
    result = style[value];
    own = false;
    if (result === undefined || result === null) {
      result = defaultValue;
      own = true;
    } else if (result === 'default' && defaultValue !== null && defaultValue !== 'none') {
      result = defaultValue;
      own = true;
    }
    if (result === 'default') {
      result = node.nodeName === 'fillcolor' ? '#ffffff' : '#000000';
      own = true;
    }
  }
  if (typeof result !== 'string') return null;
  const graph = own ? graphOf(shape) : null;
  if (graph && isGraphDarkMode(graph)) {
    const options = getColorResolveOptions(graph);
    if (isDarkResolve(options)) return darkStencilColor(result, node.nodeName, options);
  }
  return resolveLightDark(result);
}

const COLOR_NODES: Record<string, 'setFillColor' | 'setStrokeColor' | 'setFontColor'> = {
  fillcolor: 'setFillColor',
  strokecolor: 'setStrokeColor',
  fontcolor: 'setFontColor',
};

let patched = false;

/** Patches StencilShape.prototype.drawNode for `<arc>` and colour nodes. Idempotent. */
export function installStencilArcFix(): void {
  if (patched) return;
  patched = true;
  type DrawNode = (
    canvas: AbstractCanvas2D,
    shape: Shape,
    node: Element,
    aspect: Rectangle,
    disableShadow: boolean,
    paint: boolean
  ) => void;
  const proto = StencilShape.prototype as unknown as { drawNode: DrawNode };
  const base = proto.drawNode;
  proto.drawNode = function drawNode(this: StencilShape, canvas, shape, node, aspect, disableShadow, paint) {
    if (paint && node.nodeName === 'arc') {
      const sx = aspect.width;
      const sy = aspect.height;
      canvas.arcTo(
        Number(node.getAttribute('rx')) * sx,
        Number(node.getAttribute('ry')) * sy,
        Number(node.getAttribute('x-axis-rotation')),
        arcFlag(node.getAttribute('large-arc-flag')),
        arcFlag(node.getAttribute('sweep-flag')),
        aspect.x + Number(node.getAttribute('x')) * sx,
        aspect.y + Number(node.getAttribute('y')) * sy
      );
      return;
    }
    const setter = paint ? COLOR_NODES[node.nodeName] : undefined;
    if (setter) {
      canvas[setter](stencilColor(shape, node, node.getAttribute('color')));
      return;
    }
    base.call(this, canvas, shape, node, aspect, disableShadow, paint);
  };
}
