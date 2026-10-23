/**
 * @file style-edit.ts
 * @brief Style edits from the properties panels, the draw.io way (mxGraph.setCellStyles /
 *        mxUtils.setStyle): only the edited keys of each cell's OWN style change.
 *
 * The panels used to write `graph.getCellStyle(cell)` back into the cell. That is the resolved
 * style: stylesheet defaults merged in, base style names (`text;`, `group;`, `ellipse;`) dropped,
 * `light-dark()`/`default` colors resolved to the light theme (installDrawioCompat) and, worst,
 * every `none` value deleted by maxGraph's Stylesheet.getCellStyle. So an edit on a draw.io cell
 * (templates, palettes, opened files) brought back the default black outline (strokeColor=none),
 * white fill (fillColor=none) and classic arrow heads (endArrow=none), and the light-dark() lines
 * of the ERTMS templates lost their dark-mode colors.
 */
import type { Cell, CellStyle, Graph } from '@maxgraph/core';
import { copyRawDrawioStyle, parseStyleString } from '../services/drawio-xml';

export type StyleRecord = Record<string, unknown>;

/** Mutates a copy of a cell's own style; `resolved` is the effective style (read-only). */
export type StyleMutation = (style: StyleRecord, resolved: StyleRecord, cell: Cell) => void;

/** A copy of the cell's own style (the keys stored on the cell, not the resolved style). */
export function ownStyleCopy(cell: Cell): StyleRecord {
  const raw = cell.getStyle() as unknown;
  const own: StyleRecord = typeof raw === 'string' ? (parseStyleString(raw) as StyleRecord)
    : raw && typeof raw === 'object' ? (raw as StyleRecord) : {};
  const copy: StyleRecord = { ...own };
  if (Array.isArray(own.baseStyleNames)) copy.baseStyleNames = [...(own.baseStyleNames as unknown[])];
  return copy;
}

/** The effective style of a cell (defaults, base styles, light-dark()/inherit resolved). */
export function resolvedStyle(graph: Graph, cell: Cell): StyleRecord {
  return { ...(graph.getCellStyle(cell) as unknown as StyleRecord) };
}

/** Flags are parsed as booleans (`dashed=1` -> true) but written as 1/0 by the panels */
function normalizeValue(value: unknown): unknown {
  if (value === true) return 1;
  if (value === false) return 0;
  return value;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a) === JSON.stringify(b);
  return normalizeValue(a) === normalizeValue(b);
}

function sameStyle(a: StyleRecord, b: StyleRecord): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) if (!sameValue(a[key], b[key])) return false;
  return true;
}

/**
 * Applies `mutate` to a copy of each cell's own style and stores the result through the model
 * (one undoable edit). Keys set to `undefined`/`null` are removed, as draw.io's
 * setCellStyles(key, null) does. Cells whose style does not change are left alone.
 * @returns the cells whose style changed
 */
export function applyStyleToCells(graph: Graph, cells: Cell[], mutate: StyleMutation): Cell[] {
  const changed: Cell[] = [];
  if (cells.length === 0) return changed;
  const model = graph.getDataModel();
  model.beginUpdate();
  try {
    for (const cell of cells) {
      const before = ownStyleCopy(cell);
      const next = ownStyleCopy(cell);
      // keeps the draw.io string the style was read from: written back once the keys are back to it
      copyRawDrawioStyle(cell.getStyle(), next);
      mutate(next, resolvedStyle(graph, cell), cell);
      for (const key of Object.keys(next)) {
        if (next[key] === undefined || next[key] === null) delete next[key];
      }
      if (sameStyle(before, next)) continue;
      model.setStyle(cell, next as CellStyle);
      changed.push(cell);
    }
  } finally {
    model.endUpdate();
  }
  return changed;
}

/** Sets (or, with `undefined`/`null`, removes) style keys on every cell. */
export function setCellStyleValues(graph: Graph, cells: Cell[], values: StyleRecord): Cell[] {
  return applyStyleToCells(graph, cells, (style) => {
    for (const [key, value] of Object.entries(values)) style[key] = value;
  });
}

// ---------------------------------------------------------------------------------------------
// Copy / Paste Style (format painter), the draw.io way
// ---------------------------------------------------------------------------------------------

/**
 * draw.io's Graph.cellStyles (jgraph/drawio v32.4.1 Graph.js:2007, with Graph.textStyles :1968,
 * Graph.edgeStyles :1988 and Graph.cellStyleGroups :1997): the keys Edit > Paste Style copies
 * (Graph.prototype.pasteStyle :10358). Visual keys only: never `shape`, stencils, `locked`, `html`,
 * the app's `rd*` data keys or geometry-like keys.
 */
export const PASTE_STYLE_KEYS: readonly string[] = [
  'rounded', 'shadow', 'glass', 'dashed', 'dashPattern', 'comic', 'sketch', 'fillWeight',
  'hachureGap', 'hachureAngle', 'jiggle', 'disableMultiStroke', 'disableMultiStrokeFill',
  'fillStyle', 'curveFitting', 'simplification', 'sketchStyle', 'pointerEvents', 'opacity',
  'strokeColor', 'strokeWidth', 'align', 'verticalAlign', 'spacingLeft', 'spacingRight',
  'spacingTop', 'spacingBottom', 'spacing', 'arcSize', 'absoluteArcSize', 'comicStyle',
  'swimlaneFillColor', 'shadowOffsetX', 'shadowOffsetY', 'shadowBlur', 'shadowColor', 'shadowOpacity',
  // Graph.textStyles
  'fontFamily', 'fontSource', 'fontSize', 'fontColor', 'fontStyle', 'textOpacity', 'labelBorderColor',
  'labelBackgroundColor', 'defaultLabelBackgroundColor', 'autosize', 'resizable', 'horizontal', 'textDirection',
  'autosizeText',
  // Graph.edgeStyles
  'edgeStyle', 'elbow', 'jumpStyle', 'jumpSize', 'startArrow', 'startFill', 'startSize', 'endArrow', 'endFill',
  'endSize', 'flowAnimation', 'flowAnimationDirection', 'flowAnimationTimingFunction', 'flowAnimationDuration',
  'sourcePerimeterSpacing', 'targetPerimeterSpacing', 'fixedPointSpacing', 'curved', 'curveGeometry', 'linecap',
  'linejoin', 'libavoidRouting', 'followTerminals',
  // Graph.cellStyleGroups
  'fillColor', 'gradientColor', 'gradientDirection', 'roundedPerimeter',
];

/**
 * The style Copy Style takes from `cell` (draw.io Graph.copyStyle = the cell's effective style),
 * limited to PASTE_STYLE_KEYS. The cell's own values win over the resolved ones, so `none` colours
 * (deleted from maxGraph's resolved style) and light-dark() values are copied as stored.
 */
export function copyPasteStyle(graph: Graph, cell: Cell): StyleRecord {
  const merged: StyleRecord = { ...resolvedStyle(graph, cell), ...ownStyleCopy(cell) };
  const out: StyleRecord = {};
  for (const key of PASTE_STYLE_KEYS) if (merged[key] !== undefined && merged[key] !== null) out[key] = merged[key];
  return out;
}

/**
 * draw.io Graph.pasteStyle + updateCellStyles: sets each copied key whose effective value differs on
 * every vertex / edge in `cells`, skipping locked cells (also via a locked group / layer); one
 * undoable edit. @returns the cells whose style changed
 */
export function pasteStyleToCells(graph: Graph, cells: Cell[], style: StyleRecord): Cell[] {
  const targets = cells.filter((cell) => (cell.isVertex() || cell.isEdge()) && !graph.isCellLocked(cell));
  return applyStyleToCells(graph, targets, (next, resolved) => {
    for (const key of PASTE_STYLE_KEYS) {
      if (!(key in style)) continue;
      const value = style[key];
      if (!sameValue(next[key] ?? resolved[key], value)) next[key] = value;
    }
  });
}

// ---------------------------------------------------------------------------------------------
// Displaying effective values
// ---------------------------------------------------------------------------------------------

/**
 * Effective color of `key`: the resolved value, or `none` when the resolved style has none
 * (maxGraph's stylesheet deletes `none` values, so a missing color key means no color).
 */
export function effectiveColor(resolved: StyleRecord, key: string): string {
  const value = resolved[key];
  if (typeof value !== 'string' || value.trim() === '' || value === 'none') return 'none';
  return value;
}

const NAMED_COLORS: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', lime: '#00ff00', blue: '#0000ff',
  yellow: '#ffff00', cyan: '#00ffff', aqua: '#00ffff', magenta: '#ff00ff', fuchsia: '#ff00ff',
  gray: '#808080', grey: '#808080', silver: '#c0c0c0', maroon: '#800000', olive: '#808000',
  purple: '#800080', teal: '#008080', navy: '#000080', orange: '#ffa500', transparent: '#ffffff',
};

function hex2(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

/**
 * A `#rrggbb` value for `<input type="color">` (which accepts nothing else), or `fallback` when
 * `color` is `none` or not understood. Accepts #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba(),
 * `rrggbb` without `#` (draw.io files contain it) and basic color names.
 */
export function toColorInputValue(color: unknown, fallback: string): string {
  if (typeof color !== 'string') return fallback;
  const value = color.trim().toLowerCase();
  if (value === '' || value === 'none') return fallback;
  let m = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/.exec(value);
  if (m) return `#${m[1]}`;
  m = /^#([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])?$/.exec(value);
  if (m) return `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`;
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(value);
  if (m) return `#${hex2(Number(m[1]))}${hex2(Number(m[2]))}${hex2(Number(m[3]))}`;
  return NAMED_COLORS[value] ?? fallback;
}

// ---------------------------------------------------------------------------------------------
// Line pattern (draw.io Format panel: solid / dashed / dotted)
// ---------------------------------------------------------------------------------------------

export type LinePattern = 'solid' | 'dashed' | 'dotted';

/** draw.io's dotted pattern (Format.js addPattern: dashed=1, dashPattern=1 2). */
export const DOTTED_DASH_PATTERN = '1 2';

function isOn(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

/** The line pattern shown for a resolved style. */
export function linePatternOf(resolved: StyleRecord): LinePattern {
  if (!isOn(resolved.dashed)) return 'solid';
  return String(resolved.dashPattern ?? '').trim() === DOTTED_DASH_PATTERN ? 'dotted' : 'dashed';
}

/** Style keys for a line pattern, as draw.io writes them (null removes the key). */
export function linePatternStyle(pattern: string): StyleRecord {
  if (pattern === 'dashed') return { dashed: 1, dashPattern: null };
  if (pattern === 'dotted') return { dashed: 1, dashPattern: DOTTED_DASH_PATTERN };
  return { dashed: null, dashPattern: null };
}

/**
 * Style keys for a custom dash pattern. maxGraph only dashes with `dashed=1` and splits
 * `dashPattern` on spaces (comma separated values rendered as NaN); `none` restores a solid line.
 */
export function dashPatternStyle(pattern: string): StyleRecord {
  const normalized = pattern.trim().replace(/[\s,]+/g, ' ');
  if (normalized === '' || normalized === 'none') return { dashed: null, dashPattern: null };
  return { dashed: 1, dashPattern: normalized };
}

/** maxGraph's dash pattern when `dashed=1` has no `dashPattern` (SvgCanvas2D: '3 3'). */
export const DEFAULT_DASH_PATTERN = '3 3';

/** The dash pattern shown for a resolved style ('none' for solid lines). */
export function dashPatternOf(resolved: StyleRecord): string {
  if (!isOn(resolved.dashed)) return 'none';
  const pattern = String(resolved.dashPattern ?? '').trim();
  return pattern === '' ? DEFAULT_DASH_PATTERN : pattern.replace(/[\s,]+/g, ' ');
}
