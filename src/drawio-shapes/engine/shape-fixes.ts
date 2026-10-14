/**
 * @file shape-fixes.ts
 * @brief Fixes in maxGraph 0.10's edge shapes so rounded edges draw as in draw.io.
 *
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG. Licensed under the Apache
 * License, Version 2.0. Behaviour of jgraph/drawio v32.4.1 src/main/webapp/mxgraph/src/shape/mxPolyline.js
 * (paintLine), which passes `arcSize / 2` (default mxConstants.LINE_ARCSIZE = 20) to addPoints.
 * maxGraph 0.10.3 PolylineShape.paintLine passes the full arcSize, so every rounded edge corner
 * (edges default to rounded in draw.io) is cut twice as wide.
 *
 * Shadows: draw.io v32 (mxClient mxShape.updateSvgFilters / createDropShadow / getShadowStyle,
 * Graph.js:140-141) draws `shadow=1` as a CSS `drop-shadow()` filter on the shape node (offset
 * 2,3, blur 2, #000000 at 25%), not as an offset copy of the paths. maxGraph 0.10.3 draws the
 * offset copy and, in SvgCanvas2D.createShadow, sets `fill` to the boolean shadow flag
 * (`s.shadowColor ? s.shadow : ...`), which paints solid black/gray copies.
 */
import { ArrowConnectorShape, ConnectorShape, PolylineShape, Rectangle, Shape, SvgCanvas2D, TextShape, constants, mathUtils } from '@maxgraph/core';
import type { AbstractCanvas2D, Point } from '@maxgraph/core';
import { resolveLightDark } from './colors';

let patched = false;

/** Patches PolylineShape.prototype.paintLine (also used by ConnectorShape). Idempotent. */
export function installPolylineArcSizeFix(): void {
  if (patched) return;
  patched = true;
  const proto = PolylineShape.prototype as unknown as {
    paintLine(this: PolylineShape, c: AbstractCanvas2D, pts: Point[], rounded: boolean): void;
  };
  proto.paintLine = function paintLine(this: PolylineShape, c: AbstractCanvas2D, pts: Point[], rounded: boolean): void {
    const raw = Number(this.style?.arcSize ?? constants.LINE_ARCSIZE);
    const arcSize = (Number.isFinite(raw) ? raw : constants.LINE_ARCSIZE) / 2;
    c.begin();
    this.addPoints(c, pts, rounded, arcSize, false);
    c.stroke();
  };
}

/** `#rgb`, `#rrggbb` or `rgb()` with the alpha applied; other colours are returned unchanged. */
export function parseCssColor(color: string, alpha: number): string {
  const c = resolveLightDark(color.trim());
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 1000) / 1000;
  let m = /^#([0-9a-f]{3})$/i.exec(c);
  if (m) {
    const [r, g, b] = m[1].split('').map((h) => parseInt(h + h, 16));
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  m = /^#([0-9a-f]{6})$/i.exec(c);
  if (m) {
    const v = parseInt(m[1], 16);
    return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${a})`;
  }
  m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i.exec(c);
  if (m) return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${a})`;
  return c;
}

/** draw.io shadow defaults (Graph.js:140-141 and mxConstants). */
export const DRAWIO_SHADOW = { dx: 2, dy: 3, blur: 2, color: '#000000', opacity: 25 } as const;

function num(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : fallback;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * Upper bound for shadow blur and |offset| read from a cell style. Styles come from imported
 * .drawio files and libraries, so raw values like 1e308 would overflow the bounding box
 * (Infinity -> "Invalid width supplied." on every model change) or blow up the graph bounds.
 */
export const MAX_SHADOW_EXTENT = 100;
/** Upper bound for startSize/endSize in the connector bounding box (same reason). */
export const MAX_MARKER_SIZE = 1000;

/** Shadow offset and blur from a style, with draw.io defaults, clamped to a sane range. */
export function shadowParams(style: Record<string, unknown> | null | undefined): { dx: number; dy: number; blur: number } {
  const st = style ?? {};
  const m = MAX_SHADOW_EXTENT;
  return {
    dx: clamp(num(st.shadowOffsetX, DRAWIO_SHADOW.dx), -m, m),
    dy: clamp(num(st.shadowOffsetY, DRAWIO_SHADOW.dy), -m, m),
    blur: clamp(num(st.shadowBlur, DRAWIO_SHADOW.blur), 0, m),
  };
}

const isFiniteRect = (r: Rectangle): boolean =>
  Number.isFinite(r.x) && Number.isFinite(r.y) && Number.isFinite(r.width) && Number.isFinite(r.height);

function flag(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

/** mxShape.createDropShadow for the light theme: `drop-shadow(dx dy blur rgba)`. */
export function drawioDropShadow(style: Record<string, unknown> | null | undefined, scale: number): string {
  const st = style ?? {};
  const { dx, dy, blur } = shadowParams(st);
  const opacity = Math.max(0, Math.min(100, num(st.shadowOpacity, DRAWIO_SHADOW.opacity)));
  const raw = typeof st.shadowColor === 'string' && st.shadowColor !== 'none' ? st.shadowColor : DRAWIO_SHADOW.color;
  const r = (v: number): number => Math.round(v * scale * 100) / 100;
  return `drop-shadow(${r(dx)}px ${r(dy)}px ${r(blur)}px ${parseCssColor(raw, opacity / 100)})`;
}

let shadowPatched = false;

/** Draws shadows like draw.io (CSS drop-shadow filter on the shape node). Idempotent. */
export function installDropShadowFix(): void {
  if (shadowPatched) return;
  shadowPatched = true;
  const proto = Shape.prototype as unknown as {
    configureCanvas(this: Shape, c: AbstractCanvas2D, x: number, y: number, w: number, h: number): void;
    redrawShape(this: Shape): void;
  };
  const baseConfigure = proto.configureCanvas;
  proto.configureCanvas = function configureCanvas(this: Shape, c, x, y, w, h): void {
    baseConfigure.call(this, c, x, y, w, h);
    // The shadow is the node's filter (below), not an offset copy of every path
    c.setShadow(false);
  };
  const baseRedraw = proto.redrawShape;
  proto.redrawShape = function redrawShape(this: Shape): void {
    baseRedraw.call(this);
    const node = this.node as (SVGElement | HTMLElement) | null;
    if (!node?.style) return;
    const style = (this.style ?? null) as Record<string, unknown> | null;
    // mxText.isShadowEnabled reads textShadow; other shapes use shadow (mxShape.isShadowEnabled)
    const enabled = this instanceof TextShape ? flag(style?.textShadow) : this.isShadow;
    node.style.filter = enabled ? drawioDropShadow(style, this.scale || 1) : '';
  };
}

type CreateCssCallback = (dx: number, dy: number, flex: string, item: string, block: string, ofl: string) => void;
type CreateCss = (
  w: number,
  h: number,
  align: string,
  valign: string,
  wrap: boolean,
  overflow: string,
  clip: boolean,
  bg: string | null,
  border: string | null,
  flex: string,
  block: string,
  scale: number,
  callback: CreateCssCallback,
) => void;

let cssPatched = false;

const isColor = (value: string | null | undefined): value is string =>
  value != null && value !== '' && value !== constants.NONE;

/**
 * HTML label box CSS as draw.io computes it (jgraph/drawio v32.4.1 mxSvgCanvas2D.createCss,
 * horizontal labels). maxGraph 0.10.3 differs in three ways that move or resize labels:
 * - overflow=fill: the inner box is `w - 2` px wide in draw.io (maxGraph: `w`), so a
 *   `width:100%` HTML table in the label is 2px narrower;
 * - overflow=width: the outer box is `w - 2` px wide (maxGraph: `w`); overflow=block (draw.io
 *   only) is unknown to maxGraph and laid out as a plain label;
 * - labelBackgroundColor/labelBorderColor `none` emit `background-color: none` / `border: 1px
 *   solid none` declarations instead of none.
 */
export const drawioCreateCss: CreateCss = (w, h, align, valign, wrap, overflow, clip, bg, border, flex, block, _scale, callback) => {
  let item = 'box-sizing: border-box; font-size: 0; ';
  item += `text-align: ${align === constants.ALIGN.LEFT ? 'left' : align === constants.ALIGN.RIGHT ? 'right' : 'center'}; `;
  // mxUtils.getAlignmentAsPoint
  const pt = {
    x: align === constants.ALIGN.LEFT ? 0 : align === constants.ALIGN.RIGHT ? -1 : -0.5,
    y: valign === constants.ALIGN.TOP ? 0 : valign === constants.ALIGN.BOTTOM ? -1 : -0.5,
  };
  let ofl = 'overflow: hidden; ';
  let fw = 'width: 1px; ';
  let fh = 'height: 1px; ';
  let dx = pt.x * w;
  let dy = pt.y * h;

  if (clip) {
    fw = `width: ${Math.round(w)}px; `;
    item += `max-height: ${Math.round(h)}px; `;
    dy = 0;
  } else if (overflow === 'fill') {
    fw = `width: ${Math.round(w)}px; `;
    fh = `height: ${Math.round(h)}px; `;
    block += 'width: 100%; height: 100%; ';
    item += `width: ${Math.round(w - 2)}px; ${fh}`;
  } else if (overflow === 'width') {
    fw = `width: ${Math.round(w - 2)}px; `;
    block += 'width: 100%; ';
    item += fw;
    dy = 0;
    if (h > 0) item += `max-height: ${Math.round(h)}px; `;
  } else if (overflow === 'block') {
    fw = `width: ${Math.round(w - 2)}px; `;
    block += 'width: 100%; ';
    ofl = '';
    dy = 0;
    item += fw;
    if (valign === 'middle') item += `max-height: ${Math.round(h)}px; `;
  } else {
    ofl = '';
    dy = 0;
  }

  let bgc = '';
  if (isColor(bg)) bgc += `background-color: ${bg}; `;
  if (isColor(border)) bgc += `border: 1px solid ${border}; `;
  if (ofl === '' || clip) block += bgc;
  else item += bgc;

  if (wrap && w > 0) {
    block += `white-space: normal; word-wrap: ${constants.WORD_WRAP}; `;
    fw = `width: ${Math.round(w)}px; `;
    if (ofl !== '' && overflow !== 'fill') dy = 0;
  } else {
    block += 'white-space: nowrap; ';
    if (ofl === '' && overflow !== 'block') dx = 0;
  }
  callback(dx, dy, flex + fw + fh, item + ofl, block, ofl);
};

/** Replaces SvgCanvas2D.createCss with drawioCreateCss. Idempotent. */
export function installTextCssFix(): void {
  if (cssPatched) return;
  cssPatched = true;
  (SvgCanvas2D as unknown as { createCss: CreateCss }).createCss = drawioCreateCss;
}

let bboxPatched = false;

const isNoneValue = (value: unknown): boolean => value == null || value === '' || value === constants.NONE;

/**
 * Shape bounding boxes as draw.io computes them (jgraph/drawio v32.4.1 mxShape.augmentBoundingBox,
 * augmentShadowBoundingBox and mxConnector.augmentBoundingBox). They feed the graph bounds, so
 * they set the export canvas size and the palette thumbnail fit. maxGraph 0.10.3 differs:
 * - ConnectorShape counts a missing startArrow/endArrow as an arrow (`undefined !== 'none'`),
 *   growing every edge without a start arrow by markerSize + 1;
 * - shapes without a stroke (strokeColor=none) still grow by half the stroke width;
 * - the shadow adds only its offset, not its blur (draw.io: blur * 2 on every side);
 * - every shape measures its SVG node (Shape constructor: useSvgBoundingBox = true), which
 *   ignores shadows and hugs curves; draw.io measures the SVG only for curved connectors,
 *   arrow connectors and shapes that opt in (mxShape.prototype.useSvgBoundingBox = false), and
 *   otherwise uses the bounds plus augmentBoundingBox (mxShape.updateBoundingBox).
 * Shape classes that measure their SVG in draw.io declare `static drawioSvgBoundingBox = true`.
 */
export function installBoundingBoxFix(): void {
  if (bboxPatched) return;
  bboxPatched = true;
  const updProto = Shape.prototype as unknown as { updateBoundingBox(this: Shape): void };
  updProto.updateBoundingBox = function updateBoundingBox(this: Shape): void {
    let bbox = this.useSvgBoundingBox && usesSvgBoundingBox(this) ? svgBoundingBox(this) : null;
    if (!bbox && this.bounds) {
      bbox = this.createBoundingBox();
      if (bbox) {
        const plain = bbox.clone();
        this.augmentBoundingBox(bbox);
        // Never hand the view a non-finite box (it throws in Rectangle setters / page breaks)
        if (!isFiniteRect(bbox)) bbox = plain;
        const rot = this.getShapeRotation();
        if (rot !== 0) bbox = mathUtils.getBoundingBox(bbox, rot) ?? bbox;
      }
    }
    if (bbox) this.boundingBox = bbox;
  };
  const shapeProto = Shape.prototype as unknown as { augmentBoundingBox(this: Shape, bbox: Rectangle): void };
  shapeProto.augmentBoundingBox = function augmentBoundingBox(this: Shape, bbox: Rectangle): void {
    if (this.isShadow) {
      const { dx, dy, blur } = shadowParams((this.style ?? null) as Record<string, unknown> | null);
      if (dx < 0) {
        bbox.x += dx;
        bbox.width -= dx;
      }
      if (dy < 0) {
        bbox.y += dy;
        bbox.height -= dy;
      }
      bbox.grow(blur * this.scale * 2);
      bbox.width += Math.ceil(Math.round(Math.max(dx, 0) * this.scale * 1e6) / 1e6);
      bbox.height += Math.ceil(Math.round(Math.max(dy, 0) * this.scale * 1e6) / 1e6);
    }
    if (!isNoneValue(this.stroke)) bbox.grow(((this.strokeWidth ?? 0) * this.scale) / 2);
  };

  const connProto = ConnectorShape.prototype as unknown as { augmentBoundingBox(this: ConnectorShape, bbox: Rectangle): void };
  connProto.augmentBoundingBox = function augmentBoundingBox(this: ConnectorShape, bbox: Rectangle): void {
    shapeProto.augmentBoundingBox.call(this, bbox);
    const st = (this.style ?? {}) as Record<string, unknown>;
    let size = 0;
    const marker = (v: unknown): number => clamp(num(v, constants.DEFAULT_MARKERSIZE), 0, MAX_MARKER_SIZE);
    if (!isNoneValue(st.startArrow)) size = marker(st.startSize) + 1;
    if (!isNoneValue(st.endArrow)) size = Math.max(size, marker(st.endSize)) + 1;
    bbox.grow(size * this.scale);
  };
}

/** True when draw.io measures this shape's SVG node for its bounding box (see installBoundingBoxFix). */
export function usesSvgBoundingBox(shape: Shape): boolean {
  // ConnectorShape.updateBoundingBox sets the flag from `curved` (as mxConnector does)
  if (shape instanceof ConnectorShape || shape instanceof ArrowConnectorShape) return true;
  let ctor = shape.constructor as unknown;
  while (typeof ctor === 'function' && ctor !== Shape) {
    if (Object.prototype.hasOwnProperty.call(ctor, 'drawioSvgBoundingBox')) {
      return (ctor as { drawioSvgBoundingBox?: boolean }).drawioSvgBoundingBox === true;
    }
    ctor = Object.getPrototypeOf(ctor);
  }
  return false;
}

/** mxShape.getSvgBoundingBox: the SVG bbox without foreignObjects, grown by the stroke if any. */
function svgBoundingBox(shape: Shape): Rectangle | null {
  const node = shape.node as SVGGraphicsElement | null;
  if (!node?.ownerSVGElement || typeof node.getBBox !== 'function') return null;
  const removed: { node: Element; next: Node | null }[] = [];
  for (const fo of Array.from(node.querySelectorAll('foreignObject'))) {
    removed.push({ node: fo, next: fo.nextSibling });
    fo.remove();
  }
  let result: Rectangle | null = null;
  try {
    const b = node.getBBox();
    if (b.width > 0 && b.height > 0) {
      result = new Rectangle(b.x, b.y, b.width, b.height);
      if (!isNoneValue(shape.stroke)) result.grow(((shape.strokeWidth ?? 0) * shape.scale) / 2);
    }
  } catch {
    // fall back to the shape bounds
  } finally {
    for (let i = removed.length - 1; i >= 0; i--) node.insertBefore(removed[i].node, removed[i].next);
  }
  return result;
}
