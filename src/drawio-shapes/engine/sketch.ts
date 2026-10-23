/**
 * @file sketch.ts
 * @brief draw.io hand-drawn styles for maxGraph shapes: `sketch=1` (rough.js) and `comic=1`.
 *
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG. Licensed under the Apache
 * License, Version 2.0. Ported from jgraph/drawio v32.4.1
 * src/main/webapp/js/diagramly/Editor.js:1544-2380 (Editor.createRoughCanvas, RoughCanvas,
 * mxShape.prototype.createRoughCanvas / createHandJiggle / paint / paintGlassEffect,
 * mxImageShape.prototype.paintVertexShape) and src/main/webapp/js/grapheditor/Shapes.js:2146-2355
 * (HandJiggle, mxShape.prototype.beforePaint / afterPaint / updateBoundingBox /
 * createComicCanvas). rough.js (MIT, Preet Shihn) is the same release draw.io vendors
 * (src/main/webapp/js/rough/rough.min.js = roughjs 4.6.6).
 * Source: https://raw.githubusercontent.com/jgraph/drawio/v32.4.1/src/main/webapp/js/diagramly/Editor.js
 *
 * How it works (as in draw.io): before a shape paints, a "hand jiggle" wrapper replaces the path
 * methods of its canvas. For `sketch=1` the wrapper records the path (rect/ellipse go straight
 * to the rough.js generator), and fill/stroke/fillAndStroke hand it to rough.js, whose output
 * ops are painted back through the original canvas methods. The seed comes from the cell id, so
 * a cell looks the same on every repaint and in exports. Shapes paint twice: once invisibly
 * (fill/stroke none, for events and to keep transforms), once sketched.
 *
 * Style keys: sketch, sketchStyle (rough|comic), jiggle (rough.js roughness), fillStyle (auto,
 * hachure, solid, zigzag, cross-hatch, dashed, zigzag-line; dots falls back to auto), fillWeight,
 * hachureGap, hachureAngle, curveFitting, bowing, simplification, disableMultiStroke,
 * disableMultiStrokeFill, dashGap, dashOffset, zigzagOffset; `comic=1` for the legacy jiggle.
 */
import { createInstallScope, installOnce } from '../../core/install-once';
import rough from 'roughjs';
import type { Drawable, OpSet, Options, ResolvedOptions } from 'roughjs/bin/core';
import type { RoughGenerator } from 'roughjs/bin/generator';
import { ImageShape, Point, Rectangle, Shape, TextShape, constants, mathUtils } from '@maxgraph/core';
import type { AbstractCanvas2D } from '@maxgraph/core';
import { resolveLightDark } from './colors';
import { usesSvgBoundingBox } from './shape-fixes';

/** Editor.sketchDefaultJiggle (comic style). */
export const SKETCH_DEFAULT_JIGGLE = 2;

const NONE = constants.NONE;

type StyleRecord = Record<string, unknown>;

/** Canvas with the methods the wrappers replace, plus draw.io's `handJiggle` slot. */
type JiggleCanvas = AbstractCanvas2D & {
  handJiggle?: HandJiggleBase | null;
  root?: Element | null;
};

type PathMethod = (...args: number[]) => void;

/** mxUtils.getValue: the style value if present (not null/undefined), else the default. */
function getValue<T>(style: StyleRecord | null | undefined, key: string, def: T): unknown {
  const v = style?.[key];
  return v == null ? def : v;
}

/**
 * Style values as rough.js gets them in draw.io: numbers for numeric values (draw.io's exported
 * hatching of `hachureAngle=45` is diagonal, i.e. rough.js computes `45 + 90`, not the string
 * concatenation "4590"), booleans as 1/0, other values unchanged.
 */
function styleValue(style: StyleRecord | null | undefined, key: string, def: unknown): unknown {
  const v = style?.[key];
  if (v == null) return def;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return v;
}

function isSet(style: StyleRecord | null | undefined, key: string): boolean {
  const v = style?.[key];
  return v != null && v !== '0' && v !== 0 && v !== false;
}

/** Seed of a cell id (RoughCanvas.getStyle): Java-style string hash, 1 without an id. */
export function sketchSeed(id: string | null | undefined): number {
  let seed = 1;
  if (id != null) {
    for (let i = 0; i < id.length; i++) {
      seed = ((seed << 5) - seed + id.charCodeAt(i)) << 0;
    }
  }
  return seed;
}

/** `#rgb`/`#rrggbb`/`rgb()` as `rgb(r,g,b)` (mxUtils.hex2rgb) for background comparisons. */
function hex2rgb(color: unknown): string {
  if (typeof color !== 'string') return String(color);
  const c = resolveLightDark(color.trim()).toLowerCase();
  let m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(c);
  if (m) return `rgb(${parseInt(m[1] + m[1], 16)},${parseInt(m[2] + m[2], 16)},${parseInt(m[3] + m[3], 16)})`;
  m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(c);
  if (m) return `rgb(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)})`;
  m = /^rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(c);
  if (m) return `rgb(${m[1]},${m[2]},${m[3]})`;
  if (c === 'white') return 'rgb(255,255,255)';
  return c;
}

/** Common base so `c.handJiggle instanceof HandJiggleBase` finds either wrapper. */
abstract class HandJiggleBase {
  passThrough = false;
  abstract destroy(): void;
}

/** Hand-drawn wrapper of `comic=1` / `sketchStyle=comic` (Shapes.js HandJiggle). */
export class ComicCanvas extends HandJiggleBase {
  /** Maximum number of segments per line. */
  maxSegments = 10000;
  private readonly canvas: JiggleCanvas;
  private readonly defaultVariation: number;
  private readonly originals: Record<string, PathMethod>;
  private lastX: number | null = null;
  private lastY: number | null = null;
  private firstX: number | null = null;
  private firstY: number | null = null;

  constructor(canvas: AbstractCanvas2D, defaultVariation: number, private readonly random: () => number = Math.random) {
    super();
    this.canvas = canvas as JiggleCanvas;
    this.canvas.setLineJoin('round');
    this.canvas.setLineCap('round');
    this.defaultVariation = defaultVariation;
    const c = this.canvas as unknown as Record<string, PathMethod>;
    this.originals = {};
    for (const name of ['lineTo', 'moveTo', 'close', 'quadTo', 'curveTo', 'arcTo']) {
      this.originals[name] = c[name];
    }
    c.lineTo = (x: number, y: number) => this.lineTo(x, y);
    c.moveTo = (x: number, y: number) => this.moveTo(x, y);
    c.close = () => this.close();
    c.quadTo = (...a: number[]) => this.passTo('quadTo', a, a[2], a[3]);
    c.curveTo = (...a: number[]) => this.passTo('curveTo', a, a[4], a[5]);
    c.arcTo = (...a: number[]) => this.passTo('arcTo', a, a[5], a[6]);
  }

  private call(name: string, args: number[]): void {
    this.originals[name].apply(this.canvas, args);
  }

  private passTo(name: string, args: number[], x: number, y: number): void {
    this.call(name, args);
    this.lastX = x;
    this.lastY = y;
  }

  moveTo(x: number, y: number): void {
    this.call('moveTo', [x, y]);
    this.lastX = this.firstX = x;
    this.lastY = this.firstY = y;
  }

  close(): void {
    if (this.firstX != null && this.firstY != null) {
      this.lineTo(this.firstX, this.firstY);
      this.call('close', []);
    }
    this.call('close', []);
  }

  lineTo(endX: number, endY: number): void {
    if (this.lastX != null && this.lastY != null) {
      const dx = Math.abs(endX - this.lastX);
      const dy = Math.abs(endY - this.lastY);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 2) {
        this.call('lineTo', [endX, endY]);
        this.lastX = endX;
        this.lastY = endY;
        return;
      }
      let segs = Math.min(Math.round(dist / 10), this.maxSegments);
      let variation = this.defaultVariation;
      if (segs < 5) {
        segs = 5;
        variation /= 3;
      }
      const stepX = (Math.sign(endX - this.lastX) * dx) / segs;
      const stepY = (Math.sign(endY - this.lastY) * dy) / segs;
      const fx = dx / dist;
      const fy = dy / dist;
      for (let s = 0; s < segs; s++) {
        const x = stepX * s + this.lastX;
        const y = stepY * s + this.lastY;
        const offset = (this.random() - 0.5) * variation;
        this.call('lineTo', [x - offset * fy, y - offset * fx]);
      }
      this.call('lineTo', [endX, endY]);
    } else {
      this.call('lineTo', [endX, endY]);
    }
    this.lastX = endX;
    this.lastY = endY;
  }

  destroy(): void {
    Object.assign(this.canvas, this.originals);
  }
}

/** Sketch options as RoughCanvas.getStyle computes them (plus `filled`). */
export type SketchOptions = Options & { filled?: boolean; [key: string]: unknown };

const WRAPPED = ['begin', 'end', 'rect', 'roundrect', 'ellipse', 'lineTo', 'moveTo', 'quadTo', 'curveTo', 'arcTo', 'close', 'fill', 'stroke', 'fillAndStroke'] as const;
type WrappedName = (typeof WRAPPED)[number];

/** rough.js wrapper of `sketch=1` (Editor.js RoughCanvas + Editor.createRoughCanvas). */
export class RoughCanvas extends HandJiggleBase {
  /** Maximum width plus height of shapes with a sketch fill; larger shapes are filled solid. */
  maxFillSize = 200000;
  /** Maximum number of lines of a sketch fill (hachure lines, dashes or lines of zigzags). */
  maxFillCount = 100000;

  readonly generator: RoughGenerator;
  private readonly canvas: JiggleCanvas;
  private readonly shape: Shape;
  private readonly originals = {} as Record<WrappedName, (...args: unknown[]) => void>;
  private path: (string | number)[] = [];
  private nextShape: Drawable | null = null;
  private lastX = 0;
  private lastY = 0;

  constructor(canvas: AbstractCanvas2D, shape: Shape) {
    super();
    this.canvas = canvas as JiggleCanvas;
    this.shape = shape;
    this.generator = rough.generator();
    // Avoids "spikes" in the output
    this.canvas.setLineJoin('round');
    this.canvas.setLineCap('round');
    const c = this.canvas as unknown as Record<string, (...args: unknown[]) => void>;
    for (const name of WRAPPED) {
      this.originals[name] = c[name];
      const own = (this as unknown as Record<string, (...args: unknown[]) => void>)[name];
      c[name] = (...args: unknown[]) => {
        if (this.passThrough) this.originals[name].apply(this.canvas, args);
        else own.apply(this, args);
      };
    }
  }

  private get state(): JiggleCanvas['state'] {
    return this.canvas.state;
  }

  /** RoughCanvas.getStyle: rough.js options from the canvas state and the cell style. */
  getStyle(stroke: boolean, fill: boolean): SketchOptions {
    const shapeStyle = (this.shape.style ?? null) as StyleRecord | null;
    const state = this.state;
    const seed = sketchSeed(this.shape.state?.cell?.id ?? null);
    const style: SketchOptions = { strokeWidth: state.strokeWidth, seed, preserveVertices: true };
    const defs = this.generator.defaultOptions;
    style.stroke = stroke ? (state.strokeColor === NONE ? 'transparent' : (state.strokeColor as string)) : NONE;

    let gradient: string | null = null;
    style.filled = fill;
    if (fill) {
      style.fill = state.fillColor === NONE ? '' : (state.fillColor as string);
      gradient = state.gradientColor === NONE ? null : (state.gradientColor as string);
    } else {
      style.fill = '';
    }

    style.bowing = styleValue(shapeStyle, 'bowing', defs.bowing) as number;
    style.hachureAngle = styleValue(shapeStyle, 'hachureAngle', defs.hachureAngle) as number;
    style.curveFitting = styleValue(shapeStyle, 'curveFitting', defs.curveFitting) as number;
    style.roughness = styleValue(shapeStyle, 'jiggle', defs.roughness) as number;
    style.simplification = styleValue(shapeStyle, 'simplification', defs.simplification) as number;
    style.disableMultiStroke = styleValue(shapeStyle, 'disableMultiStroke', defs.disableMultiStroke) as boolean;
    style.disableMultiStrokeFill = styleValue(shapeStyle, 'disableMultiStrokeFill', defs.disableMultiStrokeFill) as boolean;

    const hachureGap = styleValue(shapeStyle, 'hachureGap', -1);
    style.hachureGap = (hachureGap === 'auto' ? -1 : hachureGap) as number;
    style.dashGap = styleValue(shapeStyle, 'dashGap', hachureGap) as number;
    style.dashOffset = styleValue(shapeStyle, 'dashOffset', hachureGap) as number;
    style.zigzagOffset = styleValue(shapeStyle, 'zigzagOffset', hachureGap) as number;

    const fillWeight = styleValue(shapeStyle, 'fillWeight', -1);
    style.fillWeight = (fillWeight === 'auto' ? -1 : fillWeight) as number;

    let fillStyle = String(getValue(shapeStyle, 'fillStyle', 'auto'));
    // Dots fill style is disabled due to performance problems
    if (fillStyle === 'dots') fillStyle = 'auto';
    if (fillStyle === 'auto') {
      // One of the following backgrounds for solid fill
      const bg = [hex2rgb('#ffffff')];
      const graph = this.shape.state?.view?.graph as { shapeBackgroundColor?: string } | undefined;
      if (graph?.shapeBackgroundColor) bg.push(hex2rgb(graph.shapeBackgroundColor));
      fillStyle = style.fill != null && (gradient != null || bg.includes(hex2rgb(style.fill))) ? 'solid' : defs.fillStyle;
    }
    style.fillStyle = fillStyle;
    if (fill) this.limitFill(style);
    return style;
  }

  /** RoughCanvas.limitFill: caps the work of sketch fills of huge shapes or tiny gaps. */
  limitFill(style: SketchOptions): void {
    const bounds = this.shape.bounds;
    const scale = this.shape.scale;
    const fillStyle = style.fillStyle;
    if (bounds == null || !(scale > 0) || fillStyle === 'solid') return;
    const w = bounds.width / scale;
    const h = bounds.height / scale;
    if (w + h > this.maxFillSize) {
      style.fillStyle = 'solid';
      return;
    }
    let gap = parseFloat(String(style.hachureGap));
    gap = gap < 0 ? 4 * Number(style.strokeWidth) : gap;
    if (!(gap >= 0)) return;
    const max = this.maxFillCount;
    // Hachure lines in both directions for cross-hatch (rough.js uses a gap of at least 0.1)
    let g = Math.max(gap, 0.1);
    const minGap = ((fillStyle === 'cross-hatch' ? 2 : 1) * (w + h)) / max;
    if (g < minGap) {
      g = minGap;
      style.hachureGap = g;
    }
    if (fillStyle === 'dashed') {
      let offset = parseFloat(String(style.dashOffset));
      let dashGap = parseFloat(String(style.dashGap));
      offset = offset < 0 ? gap : offset;
      dashGap = dashGap < 0 ? gap : dashGap;
      const dash = (w * h) / (g * max);
      if (offset + dashGap < dash) {
        const f = offset + dashGap > 0 ? dash / (offset + dashGap) : 0;
        style.dashOffset = f > 0 ? offset * f : dash / 2;
        style.dashGap = f > 0 ? dashGap * f : dash / 2;
      }
    } else if (fillStyle === 'zigzag-line') {
      // Lines of zigzags, which take twice as long to paint
      let zigzag = parseFloat(String(style.zigzagOffset));
      zigzag = zigzag < 0 ? gap : zigzag;
      const minZigzag = (Math.sqrt(g * g + (8 * w * h) / max) - g) / 2;
      if (zigzag < minZigzag) style.zigzagOffset = minZigzag;
    }
  }

  /** View translate in shape coordinates: rough.js gets diagram units (stable hachure lines). */
  getViewTranslate(): Point {
    const tr = (this.shape as Shape & { viewTranslate?: Point | null }).viewTranslate ?? this.shape.state?.view?.translate;
    return tr ?? new Point(0, 0);
  }

  private format(value: number): number {
    return this.canvas.format(value);
  }

  private addOp(op: string, ...coords: number[]): void {
    this.path.push(op);
    if (coords.length > 1) {
      const tr = this.getViewTranslate();
      for (let i = 1; i < coords.length; i += 2) {
        this.lastX = coords[i - 1];
        this.lastY = coords[i];
        this.path.push(this.format(this.lastX - tr.x));
        this.path.push(this.format(this.lastY - tr.y));
      }
    }
  }

  begin(): void {
    this.path = [];
  }

  end(): void {
    // do nothing
  }

  moveTo(x: number, y: number): void {
    this.addOp('M', x, y);
  }

  lineTo(x: number, y: number): void {
    this.addOp('L', x, y);
  }

  close(): void {
    this.addOp('Z');
  }

  quadTo(x1: number, y1: number, x2: number, y2: number): void {
    this.addOp('Q', x1, y1, x2, y2);
  }

  curveTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
    this.addOp('C', x1, y1, x2, y2, x3, y3);
  }

  arcTo(rx: number, ry: number, angle: number, largeArcFlag: boolean | number, sweepFlag: boolean | number, x: number, y: number): void {
    const curves = mathUtils.arcToCurves(this.lastX, this.lastY, rx, ry, angle, !!largeArcFlag, !!sweepFlag, x, y);
    if (curves != null) {
      for (let i = 0; i < curves.length; i += 6) {
        this.curveTo(curves[i], curves[i + 1], curves[i + 2], curves[i + 3], curves[i + 4], curves[i + 5]);
      }
    }
    this.lastX = x;
    this.lastY = y;
  }

  rect(x: number, y: number, w: number, h: number): void {
    const tr = this.getViewTranslate();
    this.path = [];
    this.nextShape = this.generator.rectangle(x - tr.x, y - tr.y, w, h, this.getStyle(true, true) as Options);
  }

  ellipse(x: number, y: number, w: number, h: number): void {
    const tr = this.getViewTranslate();
    this.path = [];
    this.nextShape = this.generator.ellipse(x + w / 2 - tr.x, y + h / 2 - tr.y, w, h, this.getStyle(true, true) as Options);
  }

  roundrect(x: number, y: number, w: number, h: number, dx: number, dy: number): void {
    this.begin();
    this.moveTo(x + dx, y);
    this.lineTo(x + w - dx, y);
    this.quadTo(x + w, y, x + w, y + dy);
    this.lineTo(x + w, y + h - dy);
    this.quadTo(x + w, y + h, x + w - dx, y + h);
    this.lineTo(x + dx, y + h);
    this.quadTo(x, y + h, x, y + h - dy);
    this.lineTo(x, y + dy);
    this.quadTo(x, y, x + dx, y);
  }

  /** RoughCanvas.drawPath: paints the recorded path or the pending rect/ellipse with rough.js. */
  drawPath(style: SketchOptions): void {
    const tr = this.getViewTranslate();
    const translate = tr.x !== 0 || tr.y !== 0;
    if (translate) {
      this.canvas.save();
      this.canvas.translate(tr.x, tr.y);
    }
    if (this.path.length > 0) {
      this.passThrough = true;
      try {
        this.draw(this.generator.path(this.path.join(' '), style as Options));
      } catch {
        // ignore
      }
      this.passThrough = false;
    } else if (this.nextShape != null) {
      const options = this.nextShape.options as unknown as Record<string, unknown>;
      for (const key of Object.keys(style)) options[key] = style[key];
      if (style.stroke === NONE || style.stroke == null) delete options.stroke;
      if (!style.filled) delete options.fill;
      this.passThrough = true;
      this.draw(this.nextShape);
      this.passThrough = false;
    }
    if (translate) this.canvas.restore();
  }

  /** Editor.createRoughCanvas rc.draw: paints a drawable through the canvas. */
  draw(drawable: Drawable): void {
    const o = (drawable.options ?? this.generator.defaultOptions) as ResolvedOptions & { filled?: boolean };
    for (const drawing of drawable.sets ?? []) {
      if (drawing.type === 'path') {
        if (o.stroke != null) this.drawToContext(drawing, o);
      } else if (drawing.type === 'fillPath') {
        this.drawToContext(drawing, o);
      } else if (drawing.type === 'fillSketch') {
        this.fillSketch(drawing, o);
      }
    }
  }

  /** rc.fillSketch: hachure/zigzag/... lines stroked in the fill colour with the fill weight. */
  private fillSketch(drawing: OpSet, o: ResolvedOptions & { filled?: boolean }): void {
    const c = this.canvas;
    const s = c.state;
    const { strokeColor, strokeWidth, strokeAlpha, dashed } = s;
    // Style values may be strings (see styleValue)
    let fweight = Number(o.fillWeight);
    if (fweight < 0) fweight = Number(o.strokeWidth) / 2;
    c.setStrokeAlpha(s.fillAlpha);
    c.setStrokeColor(o.fill || '');
    c.setStrokeWidth(fweight);
    c.setDashed(false);
    const prev = c.root?.lastChild ?? null;
    this.drawToContext(drawing, o);
    // Tags the hachure fill path (draw.io's flow animation skips it)
    const last = c.root?.lastChild as Element | null | undefined;
    if (last && last !== prev && last.nodeName === 'path') last.setAttribute('data-rough-fill', '1');
    c.setDashed(dashed);
    c.setStrokeWidth(strokeWidth);
    c.setStrokeColor(strokeColor);
    c.setStrokeAlpha(strokeAlpha);
  }

  /** rc._drawToContext */
  private drawToContext(drawing: OpSet, o: ResolvedOptions & { filled?: boolean }): void {
    const c = this.canvas;
    c.begin();
    for (const item of drawing.ops) {
      const d = item.data;
      if (item.op === 'move') c.moveTo(d[0], d[1]);
      else if (item.op === 'bcurveTo') c.curveTo(d[0], d[1], d[2], d[3], d[4], d[5]);
      else if (item.op === 'lineTo') c.lineTo(d[0], d[1]);
    }
    c.end();
    if (drawing.type === 'fillPath' && o.filled) c.fill();
    else c.stroke();
  }

  stroke(): void {
    this.drawPath(this.getStyle(true, false));
  }

  fill(): void {
    this.drawPath(this.getStyle(false, true));
  }

  fillAndStroke(): void {
    this.drawPath(this.getStyle(true, true));
  }

  destroy(): void {
    Object.assign(this.canvas, this.originals);
  }
}

/** True for shapes drawn with rough.js or the comic jiggle (sketch=1 / comic=1). */
export function isHandDrawn(shape: Shape): boolean {
  const style = (shape.style ?? null) as StyleRecord | null;
  return !shape.outline && style != null && (isSet(style, 'sketch') || isSet(style, 'comic'));
}

/**
 * mxShape.prototype.createHandJiggle (Shapes.js + Editor.js): a RoughCanvas for `sketch=1`, a
 * ComicCanvas for `comic=1` or `sketchStyle=comic`, otherwise null.
 */
export function createHandJiggle(shape: Shape, c: AbstractCanvas2D): HandJiggleBase | null {
  if (shape.outline || shape instanceof TextShape) return null;
  const style = (shape.style ?? null) as StyleRecord | null;
  if (style == null) return null;
  if (isSet(style, 'sketch')) {
    if (getValue(style, 'sketchStyle', 'rough') === 'comic') {
      return new ComicCanvas(c, Number(getValue(style, 'jiggle', SKETCH_DEFAULT_JIGGLE)));
    }
    return new RoughCanvas(c, shape);
  }
  if (isSet(style, 'comic')) return new ComicCanvas(c, Number(getValue(style, 'jiggle', SKETCH_DEFAULT_JIGGLE)));
  return null;
}

const PAGE = createInstallScope();

type ShapeProto = {
  beforePaint(this: Shape, c: AbstractCanvas2D): void;
  afterPaint(this: Shape, c: AbstractCanvas2D): void;
  paint(this: Shape, c: AbstractCanvas2D): void;
  paintGlassEffect(this: Shape, c: AbstractCanvas2D, x: number, y: number, w: number, h: number, arc: number): void;
  updateBoundingBox(this: Shape): void;
};

/** mxShape.getSvgBoundingBox: the painted SVG (without labels), grown by half the stroke. */
function paintedBoundingBox(shape: Shape): Rectangle | null {
  const node = shape.node as SVGGraphicsElement | null;
  if (!node?.ownerSVGElement || typeof node.getBBox !== 'function') return null;
  try {
    const b = node.getBBox();
    if (!(b.width > 0 && b.height > 0)) return null;
    const r = new Rectangle(b.x, b.y, b.width, b.height);
    if (shape.stroke && shape.stroke !== NONE) r.grow(((shape.strokeWidth ?? 0) * shape.scale) / 2);
    return r;
  } catch {
    return null;
  }
}

/**
 * Installs the hand-drawn styles on maxGraph's Shape prototype (idempotent). Install after the
 * other Shape patches (installBoundingBoxFix replaces updateBoundingBox).
 */
export function installSketchSupport(): void {
  if (!installOnce(PAGE, 'sketch')) return;
  const proto = Shape.prototype as unknown as ShapeProto;

  const baseBeforePaint = proto.beforePaint;
  proto.beforePaint = function beforePaint(this: Shape, c: AbstractCanvas2D): void {
    baseBeforePaint.call(this, c);
    const jc = c as JiggleCanvas;
    if (jc.handJiggle == null) jc.handJiggle = createHandJiggle(this, c);
  };

  const baseAfterPaint = proto.afterPaint;
  proto.afterPaint = function afterPaint(this: Shape, c: AbstractCanvas2D): void {
    baseAfterPaint.call(this, c);
    const jc = c as JiggleCanvas;
    if (jc.handJiggle != null) {
      jc.handJiggle.destroy();
      delete jc.handJiggle;
    }
  };

  // Paints the plain shape invisibly first (keeps events and transforms), then sketched
  const basePaint = proto.paint;
  proto.paint = function paint(this: Shape, c: AbstractCanvas2D): void {
    const jc = c as JiggleCanvas;
    const jiggle = jc.handJiggle;
    if (jiggle instanceof RoughCanvas && !this.outline) {
      c.save();
      const { fill, stroke } = this;
      this.fill = NONE;
      this.stroke = NONE;
      const { setStrokeColor, setFillColor, setGradient } = c;
      c.setStrokeColor = () => undefined;
      c.setFillColor = () => undefined;
      c.setGradient = () => undefined;
      jiggle.passThrough = true;
      try {
        basePaint.call(this, c);
      } finally {
        jiggle.passThrough = false;
        c.setFillColor = setFillColor;
        c.setStrokeColor = setStrokeColor;
        c.setGradient = setGradient;
        this.stroke = stroke;
        this.fill = fill;
        c.restore();
      }
    }
    basePaint.call(this, c);
  };

  // Glass effect is not sketched
  if (typeof proto.paintGlassEffect === 'function') {
    const baseGlass = proto.paintGlassEffect;
    proto.paintGlassEffect = function paintGlassEffect(this: Shape, c, x, y, w, h, arc): void {
      const jiggle = (c as JiggleCanvas).handJiggle;
      if (jiggle instanceof RoughCanvas) {
        jiggle.passThrough = true;
        try {
          baseGlass.call(this, c, x, y, w, h, arc);
        } finally {
          jiggle.passThrough = false;
        }
      } else {
        baseGlass.call(this, c, x, y, w, h, arc);
      }
    };
  }

  // Avoids duplicate painting of images (the invisible pass would paint them too)
  const imgProto = ImageShape.prototype as unknown as {
    paintVertexShape(this: ImageShape, c: AbstractCanvas2D, x: number, y: number, w: number, h: number): void;
  };
  const baseImagePaint = imgProto.paintVertexShape;
  imgProto.paintVertexShape = function paintVertexShape(this: ImageShape, c, x, y, w, h): void {
    const jiggle = (c as JiggleCanvas).handJiggle;
    if (jiggle == null || !jiggle.passThrough) baseImagePaint.call(this, c, x, y, w, h);
  };

  // The jiggle overshoots the shape bounds: adds the painted bounds (jgraph/drawio#5450)
  const baseUpdateBoundingBox = proto.updateBoundingBox;
  proto.updateBoundingBox = function updateBoundingBox(this: Shape): void {
    baseUpdateBoundingBox.call(this);
    if (this.boundingBox != null && isHandDrawn(this) && !(this.useSvgBoundingBox && usesSvgBoundingBox(this))) {
      const bbox = paintedBoundingBox(this);
      if (bbox) this.boundingBox.add(bbox);
    }
  };
}
