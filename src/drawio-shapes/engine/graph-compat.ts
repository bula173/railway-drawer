/**
 * @file graph-compat.ts
 * @brief Per-graph draw.io rendering compatibility: `light-dark()` and `default` colors.
 *
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG. Licensed under the Apache
 * License, Version 2.0. Ported from jgraph/drawio v32.4.1
 * src/main/webapp/js/grapheditor/Graph.js:15367-15450 (postProcessCellStyle ->
 * replaceDefaultColors).
 * Source: https://raw.githubusercontent.com/jgraph/drawio/v32.4.1/src/main/webapp/js/grapheditor/Graph.js
 *
 * Only the resolved style (CellState.style) is rewritten. cell.style keeps the original
 * draw.io values, so a saved file still opens 1:1 in draw.io.
 *
 * Color mode: light by default. `setDrawioDarkMode(true)` switches every installed graph (that
 * does not override it with `setGraphColorMode`) to draw.io's dark rendering: light-dark()
 * takes the dark side, `default` colors use shapeForegroundColor/shapeBackgroundColor's dark
 * values, and with adaptiveColors 'auto' (draw.io's default, Graph.js:2247) every plain color is
 * inverted with mxUtils.getInverseColor, as draw.io's SVG canvas does in dark mode.
 * The initial global mode follows `<html data-theme="dark">` when present.
 */

import { TextShape } from '@maxgraph/core';
import type { Cell, CellStateStyle, Graph } from '@maxgraph/core';
import {
  DARK_MIN_CANVAS_TEXT_CONTRAST,
  DARK_MIN_GRAPHICS_CONTRAST,
  DARK_MIN_TEXT_CONTRAST,
  DARK_PAGE_BACKGROUND,
  contrastRatio,
  ensureContrast,
  isDarkResolve,
  parseColor,
  resolveColorValue,
  resolveHtmlLabelColors,
  type AdaptiveColors,
  type ColorResolveOptions,
  type DefaultColorMode,
  type TextContrast,
} from './colors';
import { installPlaceholders } from './placeholders';

const INSTALLED = Symbol.for('rd.drawioCompatInstalled');
const MODE = Symbol.for('rd.drawioColorMode');

interface GraphColorMode {
  /** null: follow the global mode */
  dark: boolean | null;
  /** null: follow the global adaptive colors */
  adaptive: AdaptiveColors | null;
}

type ModedGraph = Graph & { [MODE]?: GraphColorMode; [INSTALLED]?: boolean };

function initialDark(): boolean {
  try {
    return typeof document !== 'undefined' && document.documentElement?.getAttribute('data-theme') === 'dark';
  } catch {
    return false;
  }
}

let globalDark = initialDark();
let globalAdaptive: AdaptiveColors = 'auto';
const installedGraphs = new Set<ModedGraph>();

function modeOf(graph: Graph): GraphColorMode {
  const g = graph as ModedGraph;
  if (!g[MODE]) g[MODE] = { dark: null, adaptive: null };
  return g[MODE]!;
}

/** True when `graph` renders in dark mode (its own setting, else the global one). */
export function isGraphDarkMode(graph: Graph): boolean {
  const own = (graph as ModedGraph)[MODE]?.dark;
  return own != null ? own : globalDark;
}

/** Graph.getAdaptiveColors: the graph's value, else the global default ('auto'). */
export function getGraphAdaptiveColors(graph: Graph): AdaptiveColors {
  const own = (graph as ModedGraph)[MODE]?.adaptive;
  return own != null ? own : globalAdaptive;
}

/** Resolution options for `graph` (dark mode, adaptive colors, page background). */
export function getColorResolveOptions(graph: Graph): ColorResolveOptions {
  const background = (graph as Graph & { background?: string | null }).background;
  return {
    dark: isGraphDarkMode(graph),
    adaptive: getGraphAdaptiveColors(graph),
    pageBackground: typeof background === 'string' ? background : null,
  };
}

/** Container color-scheme and a repaint for the graph's current mode. */
function applyGraphColorMode(graph: Graph): void {
  const container = graph.container as HTMLElement | null | undefined;
  const scheme = isGraphDarkMode(graph) && getGraphAdaptiveColors(graph) !== 'none' ? 'dark' : 'light';
  if (container?.style) {
    container.style.setProperty('color-scheme', scheme);
    (container.style as CSSStyleDeclaration & { colorScheme?: string }).colorScheme = scheme;
    container.setAttribute('data-color-mode', scheme);
  }
  if ((graph as ModedGraph)[INSTALLED] && graph.getDataModel().getRoot()) graph.refresh();
}

/** The global color mode (all installed graphs without their own setting). */
export function getDrawioDarkMode(): boolean {
  return globalDark;
}

/** Switches all installed graphs that follow the global mode to dark or light rendering. */
export function setDrawioDarkMode(dark: boolean): void {
  if (globalDark === dark) return;
  globalDark = dark;
  for (const graph of installedGraphs) {
    if ((graph as ModedGraph)[MODE]?.dark == null) applyGraphColorMode(graph);
  }
  notifyColorModeListeners();
}

/** Graph.defaultAdaptiveColors for all graphs without their own value. */
export function setDefaultAdaptiveColors(value: AdaptiveColors): void {
  if (globalAdaptive === value) return;
  globalAdaptive = value;
  for (const graph of installedGraphs) {
    if ((graph as ModedGraph)[MODE]?.adaptive == null) applyGraphColorMode(graph);
  }
  notifyColorModeListeners();
}

const colorModeListeners = new Set<() => void>();

function notifyColorModeListeners(): void {
  for (const listener of [...colorModeListeners]) {
    try {
      listener();
    } catch {
      // one failing view must not keep the others on the old colors
    }
  }
}

/**
 * Calls `listener` after the global color mode (dark mode or default adaptive colors) changed,
 * e.g. to re-render palette / template thumbnails. Returns the unsubscribe function.
 */
export function onDrawioColorModeChange(listener: () => void): () => void {
  colorModeListeners.add(listener);
  return () => {
    colorModeListeners.delete(listener);
  };
}

/** Cache key part for renderings that follow the global color mode ('' in light mode). */
export function drawioColorModeKey(): string {
  return globalDark && globalAdaptive !== 'none' ? `dark-${globalAdaptive}` : '';
}

/** Per-graph override: true/false pins dark/light (e.g. exports, parity), null follows the global mode. */
export function setGraphColorMode(graph: Graph, dark: boolean | null): void {
  modeOf(graph).dark = dark;
  applyGraphColorMode(graph);
}

/** Graph.setAdaptiveColors: 'auto' | 'simple' | 'none', or null/'default' for the global default. */
export function setGraphAdaptiveColors(graph: Graph, value: AdaptiveColors | 'default' | null): void {
  modeOf(graph).adaptive = value === 'default' ? null : value;
  applyGraphColorMode(graph);
}

/** Color keys that do not end in `Color`. */
const EXTRA_COLOR_KEYS: ReadonlySet<string> = new Set(['imageBorder', 'imageBackground']);

const LIGHT_DARK_RE = /light-dark\(/i;

function defaultMode(style: Record<string, unknown>, key: string): DefaultColorMode {
  const mode = style[`default${key.charAt(0).toUpperCase()}${key.substring(1)}`];
  return mode === 'invert' || mode === 'page' ? mode : undefined;
}

/**
 * Resolves `light-dark()`, `var(--x, fallback)` and `default` in every color key of a
 * resolved style, in place. Returns the same object. Without `options` the light theme is
 * used; with `{ dark: true }` the dark values and adaptive colors apply.
 */
export function resolveStyleColors<T extends object>(style: T, options?: ColorResolveOptions): T {
  if (!style) return style;
  const rec = style as Record<string, unknown>;
  const dark = isDarkResolve(options);
  // the light value of the font color, a candidate when the dark one is unreadable on its fill
  const font = rec.fontColor;
  const lightFont =
    dark && typeof font === 'string'
      ? resolveColorValue(font, 'fontColor', font === 'default' ? defaultMode(rec, 'fontColor') : undefined)
      : undefined;
  for (const key of Object.keys(rec)) {
    if (!key.endsWith('Color') && !EXTRA_COLOR_KEYS.has(key)) continue;
    const value = rec[key];
    if (typeof value !== 'string') continue;
    const resolved = resolveColorValue(value, key, value === 'default' ? defaultMode(rec, key) : undefined, options);
    if (resolved !== value) rec[key] = resolved;
  }
  if (dark) applyDarkContrast(rec, options!, typeof lightFont === 'string' ? lightFont : undefined);
  return style;
}

/** The dark canvas a cell is drawn on: the page background (resolved for dark mode) or #121212. */
export function darkCanvasColor(options?: ColorResolveOptions): string {
  const page = options?.pageBackground;
  if (page && page !== 'none' && page !== 'transparent') {
    const resolved = resolveColorValue(page, 'fillColor', undefined, { ...options, dark: true });
    if (typeof resolved === 'string' && parseColor(resolved)?.a === 1) return resolved;
  }
  return DARK_PAGE_BACKGROUND;
}

const OUTSIDE_LABEL = /^(left|right|top|bottom)$/;

/**
 * What a cell's label is drawn on in a resolved style: an opaque labelBackgroundColor, else the
 * opaque fill when the label sits inside the shape, else `canvas`.
 */
export function labelBackgroundOf(style: Record<string, unknown>, canvas: string): string {
  const opaque = (v: unknown): v is string => typeof v === 'string' && parseColor(v)?.a === 1;
  if (opaque(style.labelBackgroundColor)) return style.labelBackgroundColor;
  const inside = !OUTSIDE_LABEL.test(String(style.labelPosition ?? '')) && !OUTSIDE_LABEL.test(String(style.verticalLabelPosition ?? ''));
  const fillable = style.shape !== 'connector' && style.shape !== 'text' && style.noLabel !== 1;
  if (inside && fillable && opaque(style.fillColor) && style.fillOpacity == null && style.opacity == null) return style.fillColor;
  return canvas;
}

/**
 * Dark mode contrast floors on a resolved style (after light-dark()/default/adaptive colors):
 * strokes and label borders >= DARK_MIN_GRAPHICS_CONTRAST against the canvas; the font color
 * >= DARK_MIN_TEXT_CONTRAST against the cell's own fill / label background (the light font color
 * is used when it reads better there, e.g. white text on a kept red fill) or
 * DARK_MIN_CANVAS_TEXT_CONTRAST against the canvas. Works on the resolved style only.
 */
export function applyDarkContrast(rec: Record<string, unknown>, options: ColorResolveOptions, lightFont?: string): void {
  const canvas = darkCanvasColor(options);
  for (const key of ['strokeColor', 'labelBorderColor', 'imageBorder']) {
    const v = rec[key];
    if (typeof v === 'string') {
      const next = ensureContrast(v, canvas, DARK_MIN_GRAPHICS_CONTRAST);
      if (next !== v) rec[key] = next;
    }
  }
  const font = rec.fontColor;
  if (typeof font !== 'string' || parseColor(font) == null) return;
  const bg = labelBackgroundOf(rec, canvas);
  const min = bg === canvas ? DARK_MIN_CANVAS_TEXT_CONTRAST : DARK_MIN_TEXT_CONTRAST;
  let best = font;
  if (lightFont && parseColor(lightFont) && (contrastRatio(lightFont, bg) ?? 0) > (contrastRatio(font, bg) ?? 0)) {
    best = lightFont;
  }
  const next = ensureContrast(best, bg, min);
  if (next !== font) rec.fontColor = next;
}

/** Background and minimum contrast for the dark-mode text colors of `cell`'s HTML label. */
function labelTextContrast(graph: Graph, cell: Cell, options: ColorResolveOptions): TextContrast | undefined {
  if (!isDarkResolve(options)) return undefined;
  let style: Record<string, unknown> | null = null;
  try {
    style = (graph.view.getState(cell)?.style ?? graph.getCellStyle(cell)) as Record<string, unknown>;
  } catch {
    style = null;
  }
  const canvas = darkCanvasColor(options);
  const background = style ? labelBackgroundOf(style, canvas) : canvas;
  return { background, min: background === canvas ? DARK_MIN_CANVAS_TEXT_CONTRAST : DARK_MIN_TEXT_CONTRAST };
}

/**
 * Labels with draw.io's base spacing: Graph.js:212-213 sets mxText.prototype.baseSpacingTop = 5
 * and baseSpacingBottom = 1 ("Matches label positions of mxGraph 1.x"). maxGraph's TextShape
 * assigns these per instance, so the renderer creates this subclass instead.
 */
export class DrawioTextShape extends TextShape {
  constructor(...args: ConstructorParameters<typeof TextShape>) {
    super(...args);
    this.baseSpacingTop = 5;
    this.baseSpacingBottom = 1;
  }
}

/**
 * Installs draw.io color compatibility on one graph (idempotent):
 * - postProcessCellStyle resolves light-dark()/default (and adaptive colors in dark mode) on
 *   the resolved style only;
 * - draw.io label placeholders (`placeholders=1`: %name%, %id%, %date{mask}%, ...);
 * - getLabel rewrites light-dark() in HTML label CSS to the current mode's value (and inverts
 *   plain label colors in dark mode with adaptiveColors 'auto');
 * - draw.io's label base spacing (DrawioTextShape) and 0.1 minimum SVG stroke width;
 * - the container gets `color-scheme: light` (`dark` in dark mode), so any light-dark() left
 *   in CSS picks the same side.
 */
export function installDrawioCompat(graph: Graph): void {
  const marked = graph as ModedGraph;
  if (marked[INSTALLED]) return;
  marked[INSTALLED] = true;
  installedGraphs.add(marked);

  const baseDestroy = graph.destroy.bind(graph);
  graph.destroy = () => {
    installedGraphs.delete(marked);
    baseDestroy();
  };

  // Placeholders before the light-dark() rewrite: values can contain CSS too
  installPlaceholders(graph);

  const basePostProcess = graph.postProcessCellStyle.bind(graph);
  graph.postProcessCellStyle = (style: CellStateStyle): CellStateStyle =>
    resolveStyleColors(basePostProcess(style), isGraphDarkMode(graph) ? getColorResolveOptions(graph) : undefined);

  const baseGetLabel = graph.getLabel.bind(graph);
  graph.getLabel = (cell: Cell): string | null => {
    const label = baseGetLabel(cell);
    if (typeof label !== 'string') return label;
    if (isGraphDarkMode(graph)) {
      if (!graph.isHtmlLabel(cell) && !LIGHT_DARK_RE.test(label)) return label;
      const options = getColorResolveOptions(graph);
      return resolveHtmlLabelColors(label, options, labelTextContrast(graph, cell, options));
    }
    return LIGHT_DARK_RE.test(label) ? resolveHtmlLabelColors(label) : label;
  };

  // draw.io Graph constructor (Graph.js:941): thin strokes such as fillStrokeWidth=0.2 stay thin
  // instead of being widened to maxGraph's 1px minimum.
  graph.cellRenderer.minSvgStrokeWidth = 0.1;
  graph.cellRenderer.defaultTextShape = DrawioTextShape;

  // color-scheme for the current mode; cells rendered before the install pick up the resolved colors
  applyGraphColorMode(graph);
}
