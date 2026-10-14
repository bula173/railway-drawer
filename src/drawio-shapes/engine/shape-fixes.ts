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
import { PolylineShape, Shape, TextShape, constants } from '@maxgraph/core';
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

function flag(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

/** mxShape.createDropShadow for the light theme: `drop-shadow(dx dy blur rgba)`. */
export function drawioDropShadow(style: Record<string, unknown> | null | undefined, scale: number): string {
  const st = style ?? {};
  const dx = num(st.shadowOffsetX, DRAWIO_SHADOW.dx);
  const dy = num(st.shadowOffsetY, DRAWIO_SHADOW.dy);
  const blur = num(st.shadowBlur, DRAWIO_SHADOW.blur);
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
