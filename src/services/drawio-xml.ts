/**
 * @file drawio-xml.ts
 * @brief Native draw.io file format (`<mxGraphModel>` / `<mxCell>`) for maxGraph models.
 * @details
 * maxGraph 0.10 can read the mxGraph format but only writes its own `<GraphDataModel>` format,
 * which draw.io does not open. This module:
 * - writes a model as draw.io XML (`exportModelToDrawioXml`, `buildMxfile`),
 * - reads draw.io XML with maxGraph's codecs, after fixing their gaps
 *   (style parsing, `mxRectangle`, stray model children, numeric flags),
 * - still reads the legacy `<GraphDataModel>` files and caches written by older versions.
 *
 * Data with no draw.io equivalent is kept in style keys that draw.io preserves:
 * - `rdShape`: this app's shape name when it was exported as a draw.io shape (see DRAWIO_SHAPE_MAP),
 * - `rdOwn`: mapped keys/base names the cell had itself (kept on import; see translateShapeStyle),
 * - `rdLayerId`: the app layer of the cell (`__layerId`),
 * - `rdPlantUml`: a PlantUML group's metadata (`__plantuml`), base64 of its UTF-8 JSON.
 */
import {
  Cell,
  CellRenderer,
  Codec,
  CodecRegistry,
  Geometry,
  Graph,
  GraphDataModel,
  ModelXmlSerializer,
  ObjectCodec,
  Point,
  Rectangle,
  Stylesheet,
  SvgCanvas2D,
  mxCellCodec,
  registerModelCodecs,
  xmlUtils,
} from '@maxgraph/core';
import type { CellStyle } from '@maxgraph/core';

/** Attributes of `<mxGraphModel>` that describe the page (draw.io's File > Page Setup / grid). */
export interface PageSettings {
  dx?: number;
  dy?: number;
  grid?: boolean;
  gridSize?: number;
  guides?: boolean;
  tooltips?: boolean;
  connect?: boolean;
  arrows?: boolean;
  fold?: boolean;
  page?: boolean;
  pageScale?: number;
  pageWidth?: number;
  pageHeight?: number;
  background?: string;
  math?: boolean;
  shadow?: boolean;
  /**
   * Every other `<mxGraphModel>` attribute (e.g. draw.io's `backgroundImage`, `extFonts`,
   * `adaptiveColors`), kept verbatim so a save writes it back. Written after the known ones.
   */
  extra?: Record<string, string>;
}

export interface ExportOptions {
  /** The graph's stylesheet: default colours and arrows are written explicitly (draw.io's defaults differ). */
  stylesheet?: Stylesheet;
  /** Page settings written on `<mxGraphModel>`; missing ones get draw.io's defaults. */
  page?: PageSettings;
  /** Adds `html=1` to every cell, like draw.io does for HTML labels. */
  htmlLabels?: boolean;
  /** Writes app shapes as draw.io shapes (DRAWIO_SHAPE_MAP, ERTMS images). Default true. */
  translateShapes?: boolean;
}

/** One `<diagram>` page of an `<mxfile>`. */
export interface MxfilePage {
  id: string;
  name: string;
  /** The `<mxGraphModel>` element (any document; it is imported). */
  model: Element;
  /** Comments stored after the model inside `<diagram>` (e.g. PlantUML metadata). */
  comments?: string[];
}

export interface MxfileMeta {
  host: string;
  modified: string;
  agent: string;
  version: string;
}

// ---------------------------------------------------------------------------------------------
// Page settings
// ---------------------------------------------------------------------------------------------

/** Attribute order and defaults as draw.io writes them. */
const PAGE_ATTRIBUTES: Array<[keyof PageSettings, 'number' | 'boolean' | 'string']> = [
  ['dx', 'number'],
  ['dy', 'number'],
  ['grid', 'boolean'],
  ['gridSize', 'number'],
  ['guides', 'boolean'],
  ['tooltips', 'boolean'],
  ['connect', 'boolean'],
  ['arrows', 'boolean'],
  ['fold', 'boolean'],
  ['page', 'boolean'],
  ['pageScale', 'number'],
  ['pageWidth', 'number'],
  ['pageHeight', 'number'],
  ['background', 'string'],
  ['math', 'boolean'],
  ['shadow', 'boolean'],
];

/** Defaults written when the caller gives no value. `page=0`: this app has an endless canvas. */
export const DEFAULT_PAGE_SETTINGS: Readonly<PageSettings> = {
  grid: true,
  gridSize: 10,
  guides: true,
  tooltips: true,
  connect: true,
  arrows: true,
  fold: true,
  page: false,
  pageScale: 1,
  pageWidth: 827,
  pageHeight: 1169,
  math: false,
  shadow: false,
};

const PAGE_ATTRIBUTE_NAMES = new Set<string>(PAGE_ATTRIBUTES.map(([name]) => name));

function readPageSettings(el: Element): PageSettings {
  const settings: PageSettings = {};
  const target = settings as Record<string, unknown>;
  for (const [name, type] of PAGE_ATTRIBUTES) {
    const raw = el.getAttribute(name);
    if (raw === null) continue;
    if (type === 'string') {
      target[name] = raw;
    } else if (type === 'boolean') {
      target[name] = raw !== '0' && raw !== 'false';
    } else {
      const value = parseFloat(raw);
      if (Number.isFinite(value)) target[name] = value;
    }
  }
  const extra: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) {
    if (PAGE_ATTRIBUTE_NAMES.has(attr.name) || attr.name === 'xmlns' || attr.name.startsWith('xmlns:')) continue;
    extra[attr.name] = attr.value;
  }
  if (Object.keys(extra).length > 0) settings.extra = extra;
  return settings;
}

function writePageSettings(el: Element, page: PageSettings): void {
  const source = page as Record<string, unknown>;
  for (const [name, type] of PAGE_ATTRIBUTES) {
    const value = source[name];
    if (value === undefined || value === null) continue;
    if (type === 'boolean') el.setAttribute(name, value ? '1' : '0');
    else if (type === 'number') el.setAttribute(name, formatNumber(Number(value)));
    else el.setAttribute(name, String(value));
  }
  for (const [name, value] of Object.entries(page.extra ?? {})) {
    if (PAGE_ATTRIBUTE_NAMES.has(name) || typeof value !== 'string') continue;
    try {
      el.setAttribute(name, value);
    } catch {
      // not a valid XML name; nothing draw.io could have written
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Style string <-> CellStyle
// ---------------------------------------------------------------------------------------------

/** maxGraph key -> mxGraph/draw.io key (inverse of maxGraph's codecs/mxGraph/utils.js mapping). */
const KEY_TO_DRAWIO: Record<string, string> = { autoSize: 'autosize' };
const KEY_FROM_DRAWIO: Record<string, string> = { autosize: 'autoSize' };

/** Keys whose values are never numbers, even when they look like one (e.g. `fontColor=000000`). */
const STRING_KEYS = new Set([
  'image',
  'link',
  'label',
  'fontFamily',
  'shape',
  'rdShape',
  'rdLayerId',
  'rdOwn',
  'rdPlantUml',
  'tags',
  'dashPattern',
  'points',
  'tooltip',
  // colours whose name does not end in "color"
  'imageBorder',
  'imageBackground',
]);

/** Boolean CellStyle keys: draw.io writes them as 0/1, maxGraph's types use true/false. */
const BOOLEAN_KEYS = new Set([
  'absoluteArcSize',
  'anchorPointDirection',
  'autoSize',
  'backgroundOutline',
  'bendable',
  'cloneable',
  'collapsible',
  'container',
  'curved',
  'dashed',
  'deletable',
  'editable',
  'endFill',
  'entryPerimeter',
  'exitPerimeter',
  'fixDash',
  'flipH',
  'flipV',
  'foldable',
  'glass',
  'horizontal',
  'html',
  'imageAspect',
  'imageFlipH',
  'imageFlipV',
  'movable',
  'noEdgeStyle',
  'noLabel',
  'orthogonal',
  'orthogonalLoop',
  'part',
  'pointerEvents',
  'portConstraintRotation',
  'recursiveResize',
  'resizable',
  'resizeHeight',
  'resizeWidth',
  'rotatable',
  'rounded',
  'shadow',
  'snapToPoint',
  'startFill',
  'stencilFlipH',
  'stencilFlipV',
  'swimlaneLine',
]);

/** Key not in CellStyle: set when the draw.io style string starts with `;` (no default style). */
const IGNORE_DEFAULT_STYLE = 'ignoreDefaultStyle';

const NUMBER_PATTERN = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
const BASE64_PAYLOAD = /^[A-Za-z0-9+/]+=*$/;

function isStringKey(key: string): boolean {
  return STRING_KEYS.has(key) || /color$/i.test(key);
}

function convertStyleValue(key: string, raw: string): unknown {
  if (BOOLEAN_KEYS.has(key) && (raw === '0' || raw === '1')) return raw === '1';
  if (isStringKey(key) || !NUMBER_PATTERN.test(raw)) return raw;
  const value = parseFloat(raw);
  return Number.isFinite(value) ? value : raw;
}

/**
 * Parses a draw.io style string (`base1;base2;key=value;...`) into a maxGraph CellStyle.
 * Unlike maxGraph's own parser it splits on the first `=` only (base64 padding, URLs with
 * query strings) and keeps colours such as `000000` as strings.
 */
export function parseStyleString(input: string): CellStyle {
  const style: Record<string, unknown> = {};
  const tokens = input.split(';');
  if (tokens.length > 1 && tokens[0] === '' && input.trim() !== '') {
    style[IGNORE_DEFAULT_STYLE] = true;
  }
  for (const token of tokens) {
    if (!token) continue;
    const eq = token.indexOf('=');
    if (eq < 0) {
      const names = (style.baseStyleNames as string[] | undefined) ?? [];
      names.push(token);
      style.baseStyleNames = names;
      continue;
    }
    const rawKey = token.slice(0, eq);
    const key = KEY_FROM_DRAWIO[rawKey] ?? rawKey;
    const raw = token.slice(eq + 1).replace(/%3B/gi, ';');
    style[key] = convertStyleValue(key, raw);
  }
  return style as CellStyle;
}

/** draw.io style strings of parsed styles (see parseDrawioStyle), by style object. */
const rawDrawioStyles = new WeakMap<object, string>();

/**
 * parseStyleString, remembering the original string: while the style object stays unchanged,
 * the export writes that string back byte for byte (draw.io's own spelling: no trailing `;`,
 * repeated keys, empty tokens). Used for styles read from draw.io files and palettes.
 */
export function parseDrawioStyle(input: string): CellStyle {
  const style = parseStyleString(input);
  if (input.trim() !== '') rawDrawioStyles.set(style, input);
  return style;
}

/** Copies the remembered draw.io style string to a clone of a style (cloned cells). */
export function copyRawDrawioStyle(from: unknown, to: unknown): void {
  if (!from || !to || typeof from !== 'object' || typeof to !== 'object') return;
  const raw = rawDrawioStyles.get(from);
  if (raw !== undefined) rawDrawioStyles.set(to, raw);
}

/** The draw.io string a style was parsed from, when the style still means exactly that. */
function unchangedRawStyle(original: unknown, current: CellStyle): string | null {
  if (!original || typeof original !== 'object') return null;
  const raw = rawDrawioStyles.get(original);
  if (raw === undefined) return null;
  return styleToString(current) === styleToString(parseStyleString(raw)) ? raw : null;
}

function styleValueToString(key: string, value: unknown): string | null {
  if (value === undefined || value === null) return null;
  let text: string;
  if (typeof value === 'boolean') text = value ? '1' : '0';
  else if (typeof value === 'number') text = Number.isFinite(value) ? formatNumber(value) : String(value);
  else if (typeof value === 'string') text = value;
  else return null; // functions (perimeters registered in the stylesheet), objects
  if (key === 'image' && text.startsWith('data:')) {
    // draw.io's form: data:<mime>,<base64> (maxGraph re-adds ';base64' when rendering)
    text = text.replace(';base64,', ',');
  }
  // ';' is the only character the style grammar cannot carry
  return text.replace(/;/g, '%3B');
}

/** Serializes a style as draw.io does: base style names first, then `key=value;` pairs. */
export function styleToString(style: CellStyle | string | null | undefined): string {
  if (style === null || style === undefined) return '';
  if (typeof style === 'string') return style.trim();
  const source = style as Record<string, unknown>;
  const parts: string[] = [];
  for (const name of style.baseStyleNames ?? []) parts.push(name);
  for (const key of Object.keys(source)) {
    if (key === 'baseStyleNames' || key === IGNORE_DEFAULT_STYLE) continue;
    const text = styleValueToString(key, source[key]);
    if (text === null) continue;
    parts.push(`${KEY_TO_DRAWIO[key] ?? key}=${text}`);
  }
  const prefix = source[IGNORE_DEFAULT_STYLE] ? ';' : '';
  return parts.length ? `${prefix}${parts.join(';')};` : prefix;
}

// ---------------------------------------------------------------------------------------------
// App shapes -> draw.io shapes
// ---------------------------------------------------------------------------------------------

/**
 * Legacy app shape name -> draw.io style giving a similar picture. On export the cell gets this
 * style plus `rdShape=<app shape>`; on import `rdShape` restores the app shape and the keys and
 * base names added here are removed again (when they still have the written value).
 *
 * Only the app's own shapes are listed. draw.io shapes (hexagon, trapezoid, cross, cylinder3,
 * step, ext, parallelogram, delay, singleArrow, corner, mxgraph.basic.*, mxgraph.arrows2.*,
 * mxgraph.flowchart.*, table, flexArrow, ..., `stencil(...)`) are registered natively
 * (src/drawio-shapes, jgraph/drawio v32.4.1) and are written and read verbatim.
 */
export const DRAWIO_SHAPE_MAP: Record<string, string> = {
  'rectangle-shape': '',
  'rounded-rectangle-shape': 'rounded=1',
  customRoundedRectangle: 'rounded=1',
  'circle-shape': 'ellipse;aspect=fixed',
  'ellipse-shape': 'ellipse',
  'oval-shape': 'ellipse',
  customOval: 'ellipse',
  'diamond-shape': 'rhombus',
  'lozenge-shape': 'rhombus',
  customLozenge: 'rhombus',
  'triangle-shape': 'triangle',
  'hexagon-shape': 'shape=hexagon;perimeter=hexagonPerimeter2;size=0.25',
  customHexagon: 'shape=hexagon;perimeter=hexagonPerimeter2;size=0.25',
  'trapezoid-shape': 'shape=trapezoid;perimeter=trapezoidPerimeter',
  customTrapezoid: 'shape=trapezoid;perimeter=trapezoidPerimeter',
  'cross-shape': 'shape=cross',
  customCross: 'shape=cross',
  'cylinder-shape': 'shape=cylinder3',
  customCylinder: 'shape=cylinder3',
  'chevron-shape': 'shape=step;perimeter=stepPerimeter',
  customChevron: 'shape=step;perimeter=stepPerimeter',
  'star-shape': 'shape=mxgraph.basic.star',
  customStar: 'shape=mxgraph.basic.star',
  'pentagon-shape': 'shape=mxgraph.basic.pentagon',
  customPentagon: 'shape=mxgraph.basic.pentagon',
  'double-rectangle-shape': 'shape=ext;double=1',
  customDoubleRectangle: 'shape=ext;double=1',
  customParallelogram: 'shape=parallelogram',
  customDelay: 'shape=delay',
  'line-shape': 'line',
  customSimpleArrow: 'shape=singleArrow',
  customRightAngle: 'shape=corner',
  'right-angle-shape': 'shape=corner',
};

/** Prefix of the shape keys of earlier app versions for the draw.io arrows2 shapes. */
const LEGACY_MXARROWS_PREFIX = 'mxarrows.Arrows2';

/**
 * draw.io name of a legacy `mxarrows.Arrows2<Name>` shape key (`mxgraph.arrows2.<name>`), or
 * null. Those keys render with the same draw.io port; files are written with the real name.
 */
export function legacyMxArrowsToDrawio(shape: string): string | null {
  if (!shape.startsWith(LEGACY_MXARROWS_PREFIX) || shape.length === LEGACY_MXARROWS_PREFIX.length) return null;
  const name = shape.slice(LEGACY_MXARROWS_PREFIX.length);
  return `mxgraph.arrows2.${name.charAt(0).toLowerCase()}${name.slice(1)}`;
}

/** App shapes that paint fixed graphics with no draw.io equivalent: exported as an SVG image. */
export const IMAGE_FALLBACK_SHAPES = ['ertms-signal', 'ertms-track', 'ertms-train', 'ertms-balise'];

/** Keys the image fallback adds; removed again on import. */
const IMAGE_FALLBACK_KEYS = ['image', 'imageAspect'];

const svgCache = new Map<string, string | null>();

/**
 * Renders a registered app shape into an SVG data URI (draw.io form, without `;base64`),
 * or null when the shape is unknown or fails to paint. Cached per shape and size.
 */
export function renderShapeToSvgDataUri(shapeName: string, width: number, height: number): string | null {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const cacheKey = `${shapeName}|${w}|${h}`;
  const cached = svgCache.get(cacheKey);
  if (cached !== undefined) return cached;

  let result: string | null = null;
  try {
    const ShapeClass = (CellRenderer.defaultShapes as Record<string, unknown>)[shapeName] as
      | (new (...args: unknown[]) => { paintVertexShape(c: unknown, x: number, y: number, w: number, h: number): void })
      | undefined;
    if (ShapeClass) {
      const SVG_NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(SVG_NS, 'svg');
      const g = document.createElementNS(SVG_NS, 'g');
      svg.appendChild(g);
      const canvas = new SvgCanvas2D(g as SVGElement, false);
      // Missing canvas methods (e.g. a shape calling a helper the canvas lacks) paint nothing
      // instead of failing the whole export.
      const safeCanvas = new Proxy(canvas, {
        get(target, prop, receiver) {
          const value = Reflect.get(target, prop, receiver);
          if (value === undefined && typeof prop === 'string') return () => undefined;
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
      const shape = new ShapeClass(new Rectangle(0, 0, w, h), 'none', '#000000', 1);
      shape.paintVertexShape(safeCanvas, 0, 0, w, h);
      // No explicit xmlns attribute: XMLSerializer already declares the namespace of an
      // element made with createElementNS, and a second xmlns makes the SVG malformed
      // (browsers, draw.io included, then show no image).
      svg.setAttribute('width', String(w));
      svg.setAttribute('height', String(h));
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      const markup = new XMLSerializer().serializeToString(svg);
      result = `data:image/svg+xml,${utf8ToBase64(markup)}`;
    }
  } catch (error) {
    console.warn('[drawio-xml] Could not render shape for export:', shapeName, error);
    result = null;
  }
  svgCache.set(cacheKey, result);
  return result;
}

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

/** Returns the style to write for a cell whose `shape` is an app shape, or null to keep it. */
function translateShapeStyle(style: Record<string, unknown>, cell: Cell): Record<string, unknown> | null {
  const shape = style.shape;
  if (typeof shape !== 'string') return null;

  let mapped: Record<string, unknown> | null = null;
  if (Object.prototype.hasOwnProperty.call(DRAWIO_SHAPE_MAP, shape)) {
    mapped = parseStyleString(DRAWIO_SHAPE_MAP[shape]) as Record<string, unknown>;
  } else if (IMAGE_FALLBACK_SHAPES.includes(shape)) {
    const geo = cell.getGeometry();
    const uri = renderShapeToSvgDataUri(shape, geo?.width ?? 40, geo?.height ?? 40);
    if (!uri) return null;
    mapped = { shape: 'image', image: uri, imageAspect: false };
  }
  if (!mapped) return null;

  // Fixed order (base names, mapped keys, the cell's other keys, rdShape) so the output does
  // not depend on where `shape` sat in the style: re-imported styles have it at the end.
  const out: Record<string, unknown> = {};
  const ownBaseNames = (style.baseStyleNames as string[] | undefined) ?? [];
  const mappedBaseNames = (mapped.baseStyleNames as string[] | undefined) ?? [];
  const baseNames = [...mappedBaseNames];
  for (const name of ownBaseNames) {
    if (!baseNames.includes(name)) baseNames.push(name);
  }
  if (baseNames.length) out.baseStyleNames = baseNames;
  const isImage = mapped.shape === 'image';
  // Mapped keys and base names the cell already had itself: listed in `rdOwn` so the import
  // keeps them (it removes the ones the mapping added, which have the same values).
  const own: string[] = [];
  for (const key of Object.keys(mapped)) {
    if (key === 'baseStyleNames') continue;
    // The cell's own values win, except for the image fallback which must replace them
    if (isImage || key === 'shape' || !(key in style)) out[key] = mapped[key];
    else own.push(key);
  }
  for (const name of mappedBaseNames) {
    if (ownBaseNames.includes(name)) own.push(name);
  }
  for (const key of Object.keys(style)) {
    if (key === 'baseStyleNames' || key === 'shape' || key in out) continue;
    out[key] = style[key];
  }
  out.rdShape = shape;
  if (own.length) out.rdOwn = own.join(',');
  return out;
}

/** Undoes translateShapeStyle on an imported style that carries `rdShape`. */
function restoreAppShape(style: Record<string, unknown>): void {
  const appShape = style.rdShape;
  const own = new Set(typeof style.rdOwn === 'string' && style.rdOwn ? style.rdOwn.split(',') : []);
  delete style.rdShape;
  delete style.rdOwn;
  if (typeof appShape !== 'string' || !appShape) return;

  if (Object.prototype.hasOwnProperty.call(DRAWIO_SHAPE_MAP, appShape)) {
    const mapped = parseStyleString(DRAWIO_SHAPE_MAP[appShape]) as Record<string, unknown>;
    for (const key of Object.keys(mapped)) {
      if (key === 'baseStyleNames') continue;
      if (key !== 'shape' && !own.has(key) && style[key] === mapped[key]) delete style[key];
    }
    const added = ((mapped.baseStyleNames as string[] | undefined) ?? []).filter((n) => !own.has(n));
    const names = ((style.baseStyleNames as string[] | undefined) ?? []).filter((n) => !added.includes(n));
    if (names.length) style.baseStyleNames = names;
    else delete style.baseStyleNames;
  } else if (IMAGE_FALLBACK_SHAPES.includes(appShape)) {
    for (const key of IMAGE_FALLBACK_KEYS) delete style[key];
  }
  style.shape = appShape;
}

// ---------------------------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------------------------

/** Numbers as draw.io writes them: integers plain, fractions without floating point noise. */
function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (Number.isInteger(n)) return String(n);
  return String(+n.toFixed(4));
}

const VERTEX_DEFAULT_KEYS = ['fillColor', 'strokeColor', 'fontColor'];
const EDGE_DEFAULT_KEYS = ['strokeColor', 'fontColor', 'endArrow', 'startArrow', 'rounded'];

/**
 * draw.io's default vertex style (styles/default.xml `defaultVertex`, jgraph/drawio v32.4.1,
 * light theme: `default` colours resolved). The shape stays maxGraph's rectangle.
 */
export const DRAWIO_DEFAULT_VERTEX_STYLE: Readonly<CellStyle> = {
  fontSize: 12,
  fontFamily: 'Helvetica',
  align: 'center',
  verticalAlign: 'middle',
  fillColor: '#ffffff',
  strokeColor: '#000000',
  fontColor: '#000000',
};

/** draw.io's default edge style (styles/default.xml `defaultEdge`, light theme). */
export const DRAWIO_DEFAULT_EDGE_STYLE: Readonly<CellStyle> = {
  shape: 'connector',
  labelBackgroundColor: '#ffffff',
  endArrow: 'classic',
  fontSize: 11,
  fontFamily: 'Helvetica',
  align: 'center',
  verticalAlign: 'middle',
  rounded: true,
  strokeColor: '#000000',
  fontColor: '#000000',
};

/**
 * Makes a stylesheet's defaults draw.io's (styles/default.xml), so cells without explicit
 * colours, fonts or arrows look as in draw.io. Used by the tab graphs and the palette thumbnails.
 */
export function applyDrawioDefaultStyles(stylesheet: Stylesheet): void {
  Object.assign(stylesheet.getDefaultVertexStyle(), DRAWIO_DEFAULT_VERTEX_STYLE);
  Object.assign(stylesheet.getDefaultEdgeStyle(), DRAWIO_DEFAULT_EDGE_STYLE);
}

let drawioReferenceStylesheet: Stylesheet | null = null;

/** A stylesheet resolving styles as draw.io does (its defaults and named styles). */
function getDrawioReferenceStylesheet(): Stylesheet {
  if (!drawioReferenceStylesheet) {
    const sheet = new Stylesheet();
    applyDrawioDefaultStyles(sheet);
    registerDrawioNamedStyles(sheet);
    drawioReferenceStylesheet = sheet;
  }
  return drawioReferenceStylesheet;
}

function sameStyleValue(a: unknown, b: unknown): boolean {
  const norm = (v: unknown): string | null => {
    if (v === undefined || v === null) return null;
    if (typeof v === 'boolean') return v ? '1' : '0';
    return String(v).toLowerCase();
  };
  return norm(a) === norm(b);
}

/**
 * Fills in the app's default colours/arrows where draw.io would render something else. Values
 * that equal what draw.io resolves itself (its defaults and named styles) are not written, so
 * cells with draw.io styles (palette entries, opened draw.io files) keep their style verbatim.
 */
function addAppDefaults(style: Record<string, unknown>, cell: Cell, stylesheet: Stylesheet): void {
  if (style[IGNORE_DEFAULT_STYLE]) return;
  const isEdge = cell.isEdge();
  const keys = isEdge ? EDGE_DEFAULT_KEYS : VERTEX_DEFAULT_KEYS;
  const defaults = isEdge ? stylesheet.getDefaultEdgeStyle() : stylesheet.getDefaultVertexStyle();
  const resolved = stylesheet.getCellStyle(style as CellStyle, defaults) as Record<string, unknown>;
  const ref = getDrawioReferenceStylesheet();
  const drawio = ref.getCellStyle(
    style as CellStyle,
    isEdge ? ref.getDefaultEdgeStyle() : ref.getDefaultVertexStyle()
  ) as Record<string, unknown>;
  for (const key of keys) {
    if (key in style) continue;
    const value = resolved[key];
    if (value !== undefined && value !== null && typeof value !== 'function') {
      if (!sameStyleValue(value, drawio[key])) style[key] = value;
    } else if (isEdge && key === 'rounded' && drawio[key]) {
      // draw.io's default edge is rounded
      style[key] = false;
    }
  }
}

/** Cell field holding a PlantUML group's metadata (see PlantUmlGroupManager). */
const PLANTUML_FIELD = '__plantuml';

/**
 * The `rdPlantUml` style value of a PlantUML group: base64 of the UTF-8 JSON of its metadata.
 * Stored in the cell's style because draw.io keeps unknown style keys when it re-saves a file
 * (it drops the XML comment that older versions relied on).
 */
function plantUmlStyleValue(cell: Cell): string | null {
  const metadata = (cell as unknown as Record<string, unknown>)[PLANTUML_FIELD];
  if (!metadata || typeof metadata !== 'object') return null;
  try {
    return utf8ToBase64(JSON.stringify(metadata));
  } catch (error) {
    console.warn('[drawio-xml] Could not write PlantUML metadata of cell', cell.getId(), error);
    return null;
  }
}

/** Reads `rdPlantUml` back into the cell's PlantUML metadata. */
function restorePlantUml(cell: Cell, value: unknown): void {
  if (typeof value !== 'string' || !value) return;
  try {
    const metadata: unknown = JSON.parse(base64ToUtf8(value));
    if (metadata && typeof metadata === 'object') {
      (cell as unknown as Record<string, unknown>)[PLANTUML_FIELD] = metadata;
    }
  } catch (error) {
    console.warn('[drawio-xml] Ignoring unreadable PlantUML metadata on cell', cell.getId(), error);
  }
}

function base64ToUtf8(base64: string): string {
  const binary = atob(base64);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

function cellStyleToWrite(cell: Cell, opts: ExportOptions): string {
  const raw = cell.getStyle() as CellStyle | string | null | undefined;
  const layerId = (cell as unknown as { __layerId?: unknown }).__layerId;
  const plantUml = plantUmlStyleValue(cell);
  if (typeof raw === 'string') {
    let text = styleToString(raw);
    const append = (key: string, value: string): void => {
      text = `${text}${text && !text.endsWith(';') ? ';' : ''}${key}=${value.replace(/;/g, '%3B')};`;
    };
    if (layerId !== undefined && layerId !== null && cell.isVertex()) append('rdLayerId', String(layerId));
    if (plantUml) append('rdPlantUml', plantUml);
    return text;
  }
  if (!cell.isVertex() && !cell.isEdge()) {
    return (raw ? unchangedRawStyle(raw, raw) : null) ?? styleToString(raw);
  }
  let style: Record<string, unknown> = { ...((raw ?? {}) as Record<string, unknown>) };
  if (raw?.baseStyleNames) style.baseStyleNames = [...raw.baseStyleNames];
  if (opts.stylesheet) addAppDefaults(style, cell, opts.stylesheet);
  if (opts.htmlLabels && !('html' in style)) style.html = true;
  if (opts.translateShapes !== false && cell.isVertex()) {
    const drawioName = typeof style.shape === 'string' ? legacyMxArrowsToDrawio(style.shape) : null;
    if (drawioName) style.shape = drawioName;
    else style = translateShapeStyle(style, cell) ?? style;
  }
  const verbatim = unchangedRawStyle(raw, style as CellStyle);
  if (verbatim !== null) {
    let text = verbatim;
    const append = (key: string, value: string): void => {
      text = `${text}${text && !text.endsWith(';') ? ';' : ''}${key}=${value.replace(/;/g, '%3B')};`;
    };
    if (layerId !== undefined && layerId !== null) append('rdLayerId', String(layerId));
    if (plantUml) append('rdPlantUml', plantUml);
    return text;
  }
  if (layerId !== undefined && layerId !== null) style.rdLayerId = String(layerId);
  if (plantUml) style.rdPlantUml = plantUml;
  return styleToString(style as CellStyle);
}

function isElementValue(value: unknown): value is Element {
  return typeof value === 'object' && value !== null && (value as Node).nodeType === 1;
}

/**
 * Sets a numeric attribute unless it is written as 0 (draw.io leaves those out). Values decoded
 * from XML can still be strings, and tiny values round to "0": both would not survive a re-save.
 */
function setNonZero(el: Element, name: string, value: unknown): void {
  const text = formatNumber(Number(value));
  if (text !== '0') el.setAttribute(name, text);
}

function appendPoint(doc: XMLDocument, parent: Element, p: Point | null | undefined, as?: string): void {
  if (!p) return;
  const el = doc.createElement('mxPoint');
  // Values decoded from XML can still be strings ("0"): compare numerically
  setNonZero(el, 'x', p.x);
  setNonZero(el, 'y', p.y);
  if (as) el.setAttribute('as', as);
  parent.appendChild(el);
}

function writeGeometry(doc: XMLDocument, geo: Geometry): Element {
  const el = doc.createElement('mxGeometry');
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    setNonZero(el, key, geo[key]);
  }
  if (geo.relative) el.setAttribute('relative', '1');
  el.setAttribute('as', 'geometry');
  const alt = geo.alternateBounds;
  if (alt) {
    const rect = doc.createElement('mxRectangle');
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      setNonZero(rect, key, alt[key]);
    }
    rect.setAttribute('as', 'alternateBounds');
    el.appendChild(rect);
  }
  appendPoint(doc, el, geo.sourcePoint, 'sourcePoint');
  appendPoint(doc, el, geo.targetPoint, 'targetPoint');
  if (geo.points && geo.points.length > 0) {
    const array = doc.createElement('Array');
    array.setAttribute('as', 'points');
    geo.points.forEach((p) => appendPoint(doc, array, p));
    el.appendChild(array);
  }
  appendPoint(doc, el, geo.offset, 'offset');
  return el;
}

/**
 * Writes the model as a draw.io `<mxGraphModel>` element of `doc` (cells in depth-first
 * order: root, layers, then each cell followed by its children).
 */
export function exportModelToDrawioElement(
  doc: XMLDocument,
  model: GraphDataModel,
  opts: ExportOptions = {}
): Element {
  const graphModel = doc.createElement('mxGraphModel');
  writePageSettings(graphModel, { ...DEFAULT_PAGE_SETTINGS, ...(opts.page ?? {}) });
  const rootEl = doc.createElement('root');
  graphModel.appendChild(rootEl);

  const root = model.getRoot();
  if (!root) {
    const cell0 = doc.createElement('mxCell');
    cell0.setAttribute('id', '0');
    const cell1 = doc.createElement('mxCell');
    cell1.setAttribute('id', '1');
    cell1.setAttribute('parent', '0');
    rootEl.append(cell0, cell1);
    return graphModel;
  }

  const seen = new Set<string>();
  const inModel = (cell: Cell | null): cell is Cell =>
    !!cell && cell.getId() !== null && model.getCell(cell.getId() as string) === cell;

  const writeCell = (cell: Cell): void => {
    const id = cell.getId();
    if (id === null || id === undefined || id === '') {
      throw new Error('Cannot save the diagram: a cell has no id');
    }
    if (seen.has(id)) {
      throw new Error(`Cannot save the diagram: duplicate cell id "${id}"`);
    }
    seen.add(id);

    const mxCell = doc.createElement('mxCell');
    let outer: Element = mxCell;
    const value = cell.getValue();
    if (isElementValue(value)) {
      // draw.io UserObject/object: the id and attributes sit on the wrapper, <mxCell> inside
      outer = doc.importNode(value, true) as Element;
      outer.setAttribute('id', id);
    } else {
      mxCell.setAttribute('id', id);
      if (value !== null && value !== undefined) mxCell.setAttribute('value', String(value));
    }

    const style = cellStyleToWrite(cell, opts);
    if (style) mxCell.setAttribute('style', style);
    if (cell.isVertex()) mxCell.setAttribute('vertex', '1');
    if (cell.isEdge()) mxCell.setAttribute('edge', '1');
    if (cell.parent && cell.connectable === false) mxCell.setAttribute('connectable', '0');
    if (cell.visible === false) mxCell.setAttribute('visible', '0');
    if (cell.collapsed) mxCell.setAttribute('collapsed', '1');
    const parent = cell.getParent();
    if (parent) mxCell.setAttribute('parent', String(parent.getId()));
    const source = cell.getTerminal(true);
    if (inModel(source)) mxCell.setAttribute('source', String(source.getId()));
    const target = cell.getTerminal(false);
    if (inModel(target)) mxCell.setAttribute('target', String(target.getId()));
    const geo = cell.getGeometry();
    if (geo) mxCell.appendChild(writeGeometry(doc, geo));
    if (outer !== mxCell) outer.appendChild(mxCell);
    rootEl.appendChild(outer);

    for (const child of cell.children ?? []) writeCell(child);
  };
  writeCell(root);
  return graphModel;
}

/** Creates an empty XML document with no namespace (element names keep their case). */
function createXmlDocument(): XMLDocument {
  return document.implementation.createDocument(null, null, null);
}

/**
 * Characters XML 1.0 does not allow (C0 controls other than tab/LF/CR, U+FFFE/U+FFFF) and lone
 * surrogates. Browsers' XMLSerializer writes them as they are, which makes the file unreadable.
 */
// eslint-disable-next-line no-control-regex
const INVALID_XML_CHARS = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]|[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

/**
 * Removes the characters XML 1.0 forbids (e.g. a vertical tab pasted from Word) and replaces
 * lone surrogates with U+FFFD; valid surrogate pairs are kept.
 */
export function sanitizeXmlText(text: string): string {
  return text.replace(INVALID_XML_CHARS, (match) => {
    if (match.length === 2) return match;
    const code = match.charCodeAt(0);
    return code >= 0xd800 && code <= 0xdfff ? '\uFFFD' : '';
  });
}

/** Writes the model as a bare draw.io `<mxGraphModel>` string. */
export function exportModelToDrawioXml(model: GraphDataModel, opts: ExportOptions = {}): string {
  const doc = createXmlDocument();
  const el = exportModelToDrawioElement(doc, model, opts);
  doc.appendChild(el);
  return sanitizeXmlText(xmlUtils.getXml(el));
}

/** An empty draw.io model (cells 0 and 1), used when a diagram cannot be serialized. */
export function emptyDrawioModelXml(page?: PageSettings): string {
  return exportModelToDrawioXml(new GraphDataModel(), { page });
}

/** Random draw.io-style page id (20 characters). */
export function generatePageId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const bytes = new Uint8Array(20);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

/**
 * Builds an `<mxfile>`: `pages` first (each `<diagram>` holding its model and comments), then
 * `extraPages` (serialized `<diagram>` elements, kept as they are; invalid ones are skipped).
 */
export function buildMxfile(pages: MxfilePage[], extraPages: string[], meta: MxfileMeta): string {
  const doc = createXmlDocument();
  const mxfile = doc.createElement('mxfile');
  mxfile.setAttribute('host', meta.host);
  mxfile.setAttribute('modified', meta.modified);
  mxfile.setAttribute('agent', meta.agent);
  mxfile.setAttribute('version', meta.version);
  doc.appendChild(mxfile);

  for (const page of pages) {
    const diagram = doc.createElement('diagram');
    diagram.setAttribute('id', page.id);
    diagram.setAttribute('name', page.name);
    diagram.appendChild(doc.importNode(page.model, true));
    for (const comment of page.comments ?? []) diagram.appendChild(doc.createComment(comment));
    mxfile.appendChild(diagram);
  }
  for (const pageXml of extraPages) {
    const pageDoc = new DOMParser().parseFromString(pageXml, 'text/xml');
    if (pageDoc.getElementsByTagName('parsererror').length > 0 || !pageDoc.documentElement) {
      console.error('[drawio-xml] Skipping a preserved page that is not valid XML');
      continue;
    }
    mxfile.appendChild(doc.importNode(pageDoc.documentElement, true));
  }
  return sanitizeXmlText(xmlUtils.getXml(mxfile));
}

// ---------------------------------------------------------------------------------------------
// Reader
// ---------------------------------------------------------------------------------------------

/** mxCell codec with a style parser that keeps draw.io values intact (see parseStyleString). */
class DrawioCellCodec extends mxCellCodec {
  override decodeAttribute(dec: Codec, attr: Attr, obj?: Element | object): void {
    if (obj && attr.nodeName === 'style') {
      (obj as { style: CellStyle }).style = parseDrawioStyle(attr.value);
    } else {
      super.decodeAttribute(dec, attr, obj);
    }
  }
}

let codecsRegistered = false;

/**
 * Registers the codecs for reading draw.io XML. Idempotent; called at startup and by every
 * import function, so it is in place before the first load.
 */
export function registerDrawioCodecs(): void {
  if (codecsRegistered) return;
  registerModelCodecs();
  // Replaces maxGraph's 'mxCell' codec; the legacy 'Cell' codec is untouched
  CodecRegistry.register(new DrawioCellCodec(), false);
  const rectangleCodec = new ObjectCodec(new Rectangle());
  rectangleCodec.setName('mxRectangle');
  CodecRegistry.register(rectangleCodec, false);
  codecsRegistered = true;
}

/**
 * Deepest element nesting accepted in model XML. Real files need about 8 levels
 * (mxGraphModel > root > object > mxCell > mxGeometry > Array > mxPoint); maxGraph's decoder
 * takes super-linear time on deep nesting, so a crafted file could freeze the tab.
 */
export const MAX_MODEL_XML_DEPTH = 32;

function parseModelDocument(xml: string): Element {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length > 0 || !doc.documentElement) {
    throw new Error('The diagram data is not valid XML');
  }
  checkDepth(doc.documentElement);
  return doc.documentElement;
}

/** Throws when elements are nested deeper than MAX_MODEL_XML_DEPTH (iterative, linear time). */
function checkDepth(top: Element): void {
  const stack: Array<[Element, number]> = [[top, 1]];
  while (stack.length > 0) {
    const [el, depth] = stack.pop()!;
    if (depth > MAX_MODEL_XML_DEPTH) {
      throw new Error(`The diagram data is nested too deeply (more than ${MAX_MODEL_XML_DEPTH} levels)`);
    }
    for (const child of Array.from(el.children)) stack.push([child, depth + 1]);
  }
}

/** One cell of a `<root>`: the `<mxCell>`, or a UserObject wrapper with its `<mxCell>` inside. */
interface CellRef {
  id: string | null;
  parent: string | null;
}

function readCellRef(el: Element): CellRef | null {
  const inner = el.nodeName === 'mxCell' ? el : Array.from(el.children).find((c) => c.nodeName === 'mxCell');
  if (!inner) return null;
  // draw.io puts the id on the wrapper; accept it on the inner <mxCell> too
  return { id: el.getAttribute('id') ?? inner.getAttribute('id'), parent: inner.getAttribute('parent') };
}

/**
 * Checks the cell structure before maxGraph decodes it, which would otherwise lose cells
 * silently or fail with a raw message: one `<root>`, unique ids, existing parents, and exactly
 * one root cell that every other cell reaches through its parents.
 * (A source/target naming a missing cell only loses that connection; maxGraph drops it.)
 */
function checkModelStructure(model: Element): void {
  const roots = Array.from(model.children).filter((c) => c.nodeName === 'root');
  if (roots.length > 1) throw new Error('The diagram contains more than one <root> element');
  if (roots.length === 0) return;

  const parentOf = new Map<string, string | null>();
  const refs: CellRef[] = [];
  for (const child of Array.from(roots[0].children)) {
    const ref = readCellRef(child);
    if (!ref) continue;
    refs.push(ref);
    if (ref.id === null) continue;
    if (parentOf.has(ref.id)) throw new Error(`The diagram contains the cell id "${ref.id}" more than once`);
    parentOf.set(ref.id, ref.parent);
  }
  if (refs.length === 0) return;

  const topCells = refs.filter((ref) => ref.parent === null);
  if (topCells.length !== 1) {
    throw new Error(
      topCells.length === 0
        ? 'The diagram is damaged: it has no root cell (every cell has a parent)'
        : `The diagram is damaged: it has ${topCells.length} root cells (cells without a parent)`
    );
  }
  for (const ref of refs) {
    if (ref.parent !== null && !parentOf.has(ref.parent)) {
      throw new Error(
        `The diagram is damaged: cell "${ref.id ?? '(no id)'}" refers to the missing parent "${ref.parent}"`
      );
    }
  }

  // Every cell must reach the root cell; a parent cycle is cut off from the diagram
  const reachesRoot = new Map<string, boolean>();
  for (const id of parentOf.keys()) {
    const path: string[] = [];
    const onPath = new Set<string>();
    let current: string | null = id;
    let ok = false;
    while (current !== null) {
      const known = reachesRoot.get(current);
      if (known !== undefined) {
        ok = known;
        break;
      }
      if (onPath.has(current)) break;
      onPath.add(current);
      path.push(current);
      const parent: string | null | undefined = parentOf.get(current);
      if (parent === null) {
        ok = true;
        break;
      }
      current = parent ?? null;
    }
    for (const visited of path) reachesRoot.set(visited, ok);
    if (!ok) throw new Error(`The diagram is damaged: cell "${id}" is in a parent cycle`);
  }
}

/**
 * Reads a draw.io `<mxGraphModel>` into `model` (its root is replaced) and returns the page
 * settings. `<mxfile>`/`<diagram>` wrappers must be removed first (ProjectService does that).
 */
export function importDrawioXmlIntoModel(xml: string, model: GraphDataModel): PageSettings {
  registerDrawioCodecs();
  const el = parseModelDocument(xml);
  if (el.nodeName !== 'mxGraphModel') {
    throw new Error(`Expected <mxGraphModel>, found <${el.nodeName}>`);
  }
  const settings = readPageSettings(el);
  // maxGraph's ModelCodec recurses forever on any child other than <root>
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 1 && child.nodeName !== 'root') el.removeChild(child);
  }
  checkModelStructure(el);
  new Codec(el.ownerDocument).decode(el, model);
  fixDecodedModel(model);
  return settings;
}

/** Reads a legacy maxGraph `<GraphDataModel>` (files and caches of earlier versions). */
export function importLegacyXmlIntoModel(xml: string, model: GraphDataModel): void {
  registerDrawioCodecs();
  parseModelDocument(xml); // well-formedness and nesting depth
  new ModelXmlSerializer(model).import(xml);
  fixDecodedModel(model);
}

/** Reads either format into `model`; returns page settings for draw.io XML, otherwise null. */
export function importModelXml(xml: string, model: GraphDataModel): PageSettings | null {
  const el = parseModelDocument(xml);
  if (el.nodeName === 'mxGraphModel') return importDrawioXmlIntoModel(xml, model);
  if (el.nodeName === 'GraphDataModel') {
    importLegacyXmlIntoModel(xml, model);
    return null;
  }
  throw new Error(`Unsupported diagram format (<${el.nodeName}>)`);
}

/** True when `xml` is a legacy maxGraph `<GraphDataModel>` document. */
export function isLegacyModelXml(xml: string): boolean {
  return /^\s*(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*<GraphDataModel[\s>/]/.test(xml);
}

function numberAttr(el: Element, name: string): number {
  const raw = el.getAttribute(name) ?? el.getAttribute(`_${name}`);
  const value = raw === null ? 0 : parseFloat(raw);
  return Number.isFinite(value) ? value : 0;
}

function toBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

/** Repairs what maxGraph's decoders leave behind, for both formats. */
function fixDecodedModel(model: GraphDataModel): void {
  const root = model.getRoot();
  if (!root) return;
  const visit = (cell: Cell): void => {
    const c = cell as unknown as Record<string, unknown>;
    // Flags are decoded as the numbers 1/0; app code compares with === true
    c.vertex = toBoolean(c.vertex);
    c.edge = toBoolean(c.edge);
    for (const key of ['connectable', 'visible'] as const) {
      if (c[key] !== undefined && typeof c[key] !== 'boolean') c[key] = toBoolean(c[key]);
    }
    c.collapsed = toBoolean(c.collapsed);

    const geo = cell.getGeometry();
    if (geo) {
      geo.relative = toBoolean(geo.relative);
      const alt = geo.alternateBounds as unknown;
      if (isElementValue(alt)) {
        geo.alternateBounds = new Rectangle(
          numberAttr(alt, 'x'),
          numberAttr(alt, 'y'),
          numberAttr(alt, 'width'),
          numberAttr(alt, 'height')
        );
      }
    }

    const style = cell.getStyle() as unknown;
    if (style && typeof style === 'object') {
      const s = style as Record<string, unknown>;
      if (s.rdLayerId !== undefined) {
        c.__layerId = String(s.rdLayerId);
        delete s.rdLayerId;
      }
      if (s.rdPlantUml !== undefined) {
        restorePlantUml(cell, s.rdPlantUml);
        delete s.rdPlantUml;
      }
      if (s.rdShape !== undefined) restoreAppShape(s);
      else delete s.rdOwn;
      if (typeof s.image === 'string') s.image = restoreBase64Marker(s.image);
    }

    for (const child of cell.children ?? []) visit(child);
  };
  visit(root);
}

/** `data:image/png,AAA=` (draw.io form) -> `data:image/png;base64,AAA=` (as the app stores it). */
function restoreBase64Marker(image: string): string {
  if (!image.startsWith('data:')) return image;
  const comma = image.indexOf(',');
  if (comma < 0) return image;
  const header = image.slice(0, comma);
  const payload = image.slice(comma + 1);
  if (header.endsWith(';base64') || !BASE64_PAYLOAD.test(payload)) return image;
  return `${header};base64,${payload}`;
}

// ---------------------------------------------------------------------------------------------
// Graph setup
// ---------------------------------------------------------------------------------------------

/**
 * draw.io's named styles (styles/default.xml), so base names in draw.io style strings
 * (`text;html=1;...`, `ellipse;...`) have an effect here too.
 */
export const DRAWIO_NAMED_STYLES: Record<string, CellStyle> = {
  text: { fillColor: 'none', gradientColor: 'none', strokeColor: 'none', align: 'left', verticalAlign: 'top' },
  edgeLabel: {
    fillColor: 'none',
    gradientColor: 'none',
    strokeColor: 'none',
    align: 'center',
    verticalAlign: 'middle',
    labelBackgroundColor: '#ffffff',
    fontSize: 11,
  },
  label: {
    fontStyle: 1,
    align: 'left',
    verticalAlign: 'middle',
    spacing: 2,
    spacingLeft: 52,
    imageWidth: 42,
    imageHeight: 42,
    rounded: true,
  },
  ellipse: { shape: 'ellipse', perimeter: 'ellipsePerimeter' },
  rhombus: { shape: 'rhombus', perimeter: 'rhombusPerimeter' },
  triangle: { shape: 'triangle', perimeter: 'trianglePerimeter' },
  line: { shape: 'line', strokeWidth: 4, labelBackgroundColor: '#ffffff', verticalAlign: 'top', spacingTop: 8 },
  image: { shape: 'image', labelBackgroundColor: '#ffffff', verticalAlign: 'top', verticalLabelPosition: 'bottom' },
  group: { verticalAlign: 'top', fillColor: 'none', strokeColor: 'none', gradientColor: 'none', pointerEvents: false },
  swimlane: { shape: 'swimlane', fontStyle: 1, startSize: 23 },
};

/** Adds draw.io's named styles to a stylesheet, without replacing styles the app defined. */
export function registerDrawioNamedStyles(stylesheet: Stylesheet): void {
  for (const [name, style] of Object.entries(DRAWIO_NAMED_STYLES)) {
    if (!stylesheet.styles.has(name)) stylesheet.putCellStyle(name, { ...style });
  }
}

/** Label of a draw.io UserObject value: its `label` attribute, with `%name%` placeholders. */
export function getUserObjectLabel(cell: Cell): string {
  const value = cell.getValue() as Element;
  const label = value.getAttribute('label') ?? '';
  if (value.getAttribute('placeholders') !== '1') return label;
  return label.replace(/%([^%\s]+)%/g, (match, name: string) => {
    let current: Cell | null = cell;
    while (current) {
      const v = current.getValue();
      if (isElementValue(v) && v.hasAttribute(name)) return v.getAttribute(name) ?? '';
      current = current.getParent();
    }
    return match;
  });
}

/**
 * Shows and edits labels of cells whose value is a draw.io UserObject (an XML element),
 * which maxGraph would otherwise show as "UserObject".
 */
export function installUserObjectLabels(graph: Graph): void {
  const baseConvert = graph.convertValueToString.bind(graph);
  graph.convertValueToString = (cell: Cell): string =>
    isElementValue(cell.getValue()) ? getUserObjectLabel(cell) : baseConvert(cell);

  const baseLabelChanged = graph.cellLabelChanged.bind(graph);
  graph.cellLabelChanged = (cell: Cell, value: unknown, autoSize = false): void => {
    const current = cell.getValue();
    if (isElementValue(current) && !isElementValue(value)) {
      // Cloned so undo restores the previous element
      const clone = current.cloneNode(true) as Element;
      clone.setAttribute('label', value === null || value === undefined ? '' : String(value));
      baseLabelChanged(cell, clone, autoSize);
      return;
    }
    baseLabelChanged(cell, value, autoSize);
  };
}
