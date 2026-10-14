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
 */

import { TextShape } from '@maxgraph/core';
import type { Cell, CellStateStyle, Graph } from '@maxgraph/core';
import { resolveColorValue, resolveLightDarkInCss, type DefaultColorMode } from './colors';

const INSTALLED = Symbol.for('rd.drawioCompatInstalled');

/** Color keys that do not end in `Color`. */
const EXTRA_COLOR_KEYS: ReadonlySet<string> = new Set(['imageBorder', 'imageBackground']);

const LIGHT_DARK_RE = /light-dark\(/i;

function defaultMode(style: Record<string, unknown>, key: string): DefaultColorMode {
  const mode = style[`default${key.charAt(0).toUpperCase()}${key.substring(1)}`];
  return mode === 'invert' || mode === 'page' ? mode : undefined;
}

/**
 * Resolves `light-dark()`, `var(--x, fallback)` and `default` in every color key of a
 * resolved style, in place. Returns the same object.
 */
export function resolveStyleColors<T extends object>(style: T): T {
  if (!style) return style;
  const rec = style as Record<string, unknown>;
  for (const key of Object.keys(rec)) {
    if (!key.endsWith('Color') && !EXTRA_COLOR_KEYS.has(key)) continue;
    const value = rec[key];
    if (typeof value !== 'string') continue;
    const resolved = resolveColorValue(value, key, value === 'default' ? defaultMode(rec, key) : undefined);
    if (resolved !== value) rec[key] = resolved;
  }
  return style;
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
 * - postProcessCellStyle resolves light-dark()/default on the resolved style only;
 * - getLabel rewrites light-dark() in HTML label CSS to the light value;
 * - draw.io's label base spacing (DrawioTextShape) and 0.1 minimum SVG stroke width;
 * - the container gets `color-scheme: light`, so any light-dark() left in CSS picks the
 *   light value too.
 */
export function installDrawioCompat(graph: Graph): void {
  const marked = graph as Graph & { [INSTALLED]?: boolean };
  if (marked[INSTALLED]) return;
  marked[INSTALLED] = true;

  const basePostProcess = graph.postProcessCellStyle.bind(graph);
  graph.postProcessCellStyle = (style: CellStateStyle): CellStateStyle => resolveStyleColors(basePostProcess(style));

  const baseGetLabel = graph.getLabel.bind(graph);
  graph.getLabel = (cell: Cell): string | null => {
    const label = baseGetLabel(cell);
    return typeof label === 'string' && LIGHT_DARK_RE.test(label) ? resolveLightDarkInCss(label) : label;
  };

  // draw.io Graph constructor (Graph.js:941): thin strokes such as fillStrokeWidth=0.2 stay thin
  // instead of being widened to maxGraph's 1px minimum.
  graph.cellRenderer.minSvgStrokeWidth = 0.1;
  graph.cellRenderer.defaultTextShape = DrawioTextShape;

  const container = graph.container as HTMLElement | null | undefined;
  if (container?.style) {
    container.style.setProperty('color-scheme', 'light');
    (container.style as CSSStyleDeclaration & { colorScheme?: string }).colorScheme = 'light';
  }

  // Cells that were rendered before the install pick up the resolved colors
  if (graph.getDataModel().getRoot()) graph.refresh();
}
