/**
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Ported from jgraph/drawio v32.4.1 src/main/webapp/js/grapheditor/Shapes.js:7021
 * (TaperedArrowShape, registered at :7554). Uses Graph.getCurvePoints
 * (Graph.js:7685) and mxPolyline.paintEdgeShape/paintBezierLine
 * (src/main/webapp/mxgraph/src/shape/mxPolyline.js).
 */

import { AbstractCanvas2D, ConnectorShape, MarkerShape, Point, Rectangle, constants, mathUtils } from '@maxgraph/core';
import { getCurvePoints, getNumber, getValue, toFlag } from './util';

interface Head {
  cl: Point;
  tip: Point;
  cr: Point;
}

type MarkerPaint = () => void;

/**
 * draw.io `shape=taperedArrow`: a band whose width changes linearly from
 * startWidth at the source to endWidth at the target (before the marker),
 * filled with fillColor (and gradientColor) and outlined with strokeColor.
 */
export class TaperedArrowShape extends ConnectorShape {
  defaultStartWidth = 12;

  defaultEndWidth = 2;

  /** Maximum number of points of a loop that removeLoops cuts. */
  maxLoopPoints = 1000;

  /** Width factors of the heads painted as part of the band outline. */
  outlineHeads: Record<string, number> = { classic: 2, block: 2, classicThin: 3, blockThin: 3 };

  /** Markers painted as a single closed path that can join the band path. */
  mergedMarkers = ['classic', 'classicThin', 'block', 'blockThin', 'diamond', 'diamondThin', 'doubleBlock', 'box'];

  heads: (Head | null)[] | null = null;

  centerLine: Point[] | null = null;

  centerLength: number | null = null;

  bandPainted = false;

  /** Set by exports that paint in model units (draw.io viewTranslate). */
  viewTranslate: Point | null = null;

  constructor() {
    super([], '#000000', 1);
  }

  getStartWidth(): number {
    return Math.max(0, getNumber(this.style, 'startWidth', this.defaultStartWidth));
  }

  getEndWidth(): number {
    return Math.max(0, getNumber(this.style, 'endWidth', this.defaultEndWidth));
  }

  override augmentBoundingBox(bbox: Rectangle): void {
    super.augmentBoundingBox(bbox);

    // Allows for the band and the markers that are scaled with the width
    bbox.grow(Math.max(this.getStartWidth(), this.getEndWidth()) * this.scale);
  }

  override paintLine(c: AbstractCanvas2D, pts: Point[], rounded?: boolean): void {
    let p: (Point | null)[] = pts;

    if (rounded) {
      const arcSize = getNumber(this.style, 'arcSize', constants.LINE_ARCSIZE) / 2;
      p = this.getRoundedPoints(pts, arcSize);
    }

    this.paintTaperedLine(c, p);
  }

  override paintCurvedLine(c: AbstractCanvas2D, pts: Point[]): void {
    this.paintTaperedLine(c, getCurvePoints(pts, false));
  }

  paintBezierLine(c: AbstractCanvas2D, pts: Point[]): void {
    this.paintTaperedLine(c, getCurvePoints(pts, true));
  }

  /**
   * Returns a fine polyline for the rounded corners that Shape.addPoints
   * paints for rounded connectors.
   */
  getRoundedPoints(pts: (Point | null)[], arcSize: number): (Point | null)[] {
    const n = pts.length;

    if (n < 3 || pts.indexOf(null) >= 0) {
      return pts;
    }

    const p = pts as Point[];
    const steps = 8;
    const result: Point[] = [p[0]];
    let pt = p[0];

    for (let i = 1; i < n - 1; i++) {
      const tmp = p[i];
      let dx = pt.x - tmp.x;
      let dy = pt.y - tmp.y;

      if (dx === 0 && dy === 0) {
        continue;
      }

      let dist = Math.sqrt(dx * dx + dy * dy);
      const p1 = new Point(tmp.x + dx * Math.min(arcSize, dist / 2) / dist,
        tmp.y + dy * Math.min(arcSize, dist / 2) / dist);
      result.push(p1);

      // Uses next non-overlapping point
      let next = p[i + 1];

      while (i < n - 2 && Math.round(next.x - tmp.x) === 0 && Math.round(next.y - tmp.y) === 0) {
        next = p[i + 2];
        i++;
      }

      dx = next.x - tmp.x;
      dy = next.y - tmp.y;
      dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const p2 = new Point(tmp.x + dx * Math.min(arcSize, dist / 2) / dist,
        tmp.y + dy * Math.min(arcSize, dist / 2) / dist);

      for (let t = 1; t <= steps; t++) {
        const u = t / steps;
        const iu = 1 - u;
        result.push(new Point(
          iu * iu * p1.x + 2 * iu * u * tmp.x + u * u * p2.x,
          iu * iu * p1.y + 2 * iu * u * tmp.y + u * u * p2.y));
      }

      pt = p2;
    }

    result.push(p[n - 1]);

    return result;
  }

  /**
   * Returns the point, unit normal (screen coordinates) and relative position
   * of the painted center line near its start or end, where the width handles
   * are placed. Returns null if the shape has not been painted.
   */
  getWidthHandleFrame(start: boolean): { x: number; y: number; nx: number; ny: number; t: number } | null {
    const p = this.centerLine;

    if (p == null || p.length < 2 || this.centerLength == null || !(this.centerLength > 0)) {
      return null;
    }

    const s = this.scale;
    const tr = this.state != null ? this.state.view.translate : new Point();
    const total = this.centerLength;
    const a = Math.min(total / 4, 24 / s);
    const n = p.length;
    let remaining = a;
    let q: Point | null = null;
    let tx = 0;
    let ty = 0;

    for (let i = 0; i < n - 1 && q == null; i++) {
      const p0 = start ? p[i] : p[n - 1 - i];
      const p1 = start ? p[i + 1] : p[n - 2 - i];
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0 && (dist >= remaining || i === n - 2)) {
        const f = Math.min(1, remaining / dist);
        q = new Point(p0.x + dx * f, p0.y + dy * f);

        // Tangent in the direction of the edge
        tx = (start ? dx : -dx) / dist;
        ty = (start ? dy : -dy) / dist;
      } else {
        remaining -= dist;
      }
    }

    if (q == null) {
      return null;
    }

    return { x: (q.x + tr.x) * s, y: (q.y + tr.y) * s, nx: -ty, ny: tx, t: start ? a / total : 1 - a / total };
  }

  paintTaperedLine(c: AbstractCanvas2D, pts: (Point | null)[]): void {
    this.centerLine = null;
    this.centerLength = null;

    // Removes duplicate points
    const p: Point[] = [];

    for (let i = 0; i < pts.length; i++) {
      const cur = pts[i];

      if (cur != null && (p.length === 0 || cur.x !== p[p.length - 1].x || cur.y !== p[p.length - 1].y)) {
        p.push(cur);
      }
    }

    if (p.length < 2) {
      return;
    }

    // Normals and lengths of the segments
    const normals: Point[] = [];
    const lengths = [0];

    for (let i = 1; i < p.length; i++) {
      const dx = p[i].x - p[i - 1].x;
      const dy = p[i].y - p[i - 1].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      normals.push(new Point(-dy / dist, dx / dist));
      lengths.push(lengths[i - 1] + dist);
    }

    const total = lengths[lengths.length - 1];

    // Painted center line for the width handles in model units
    const tr = this.viewTranslate != null ? this.viewTranslate
      : (this.state != null ? this.state.view.translate : new Point());
    this.centerLine = p.map((pt) => new Point(pt.x - tr.x, pt.y - tr.y));
    this.centerLength = total;

    const sw = this.getStartWidth();
    const ew = this.getEndWidth();
    let left: Point[] = [];
    let right: Point[] = [];

    for (let i = 0; i < p.length; i++) {
      const w = (sw + (ew - sw) * lengths[i] / total) / 2;
      const n0 = normals[Math.max(0, i - 1)];
      const n1 = normals[Math.min(normals.length - 1, i)];
      let nx = n0.x + n1.x;
      let ny = n0.y + n1.y;
      const nl = Math.sqrt(nx * nx + ny * ny);

      // Mitered offset limited to twice the width for sharp angles
      const cos = nl === 0 ? 0 : nl / 2;
      const f = w / Math.max(0.5, cos);
      nx = nl === 0 ? n1.x : nx / nl;
      ny = nl === 0 ? n1.y : ny / nl;

      left.push(new Point(p[i].x + nx * f, p[i].y + ny * f));
      right.push(new Point(p[i].x - nx * f, p[i].y - ny * f));
    }

    // The inner side of corners and curves with a radius below the
    // half width loops back on itself
    const span = 2 * Math.max(sw, ew);
    left = this.removeLoops(left, lengths, span);
    right = this.removeLoops(right, lengths, span);

    // Adds the band to the current path, which is filled and stroked in
    // paintEdgeShape together with the filled markers
    c.begin();
    c.moveTo(left[0].x, left[0].y);

    for (let i = 1; i < left.length; i++) {
      c.lineTo(left[i].x, left[i].y);
    }

    // Heads that are part of the outline are added between the sides
    const endHead = this.heads != null ? this.heads[1] : null;
    const startHead = this.heads != null ? this.heads[0] : null;

    if (endHead != null) {
      c.lineTo(endHead.cl.x, endHead.cl.y);
      c.lineTo(endHead.tip.x, endHead.tip.y);
      c.lineTo(endHead.cr.x, endHead.cr.y);
    }

    for (let i = right.length - 1; i >= 0; i--) {
      c.lineTo(right[i].x, right[i].y);
    }

    if (startHead != null) {
      c.lineTo(startHead.cr.x, startHead.cr.y);
      c.lineTo(startHead.tip.x, startHead.tip.y);
      c.lineTo(startHead.cl.x, startHead.cl.y);
    }

    c.close();
    this.bandPainted = true;
  }

  /**
   * Markers are scaled with the width of the band at their end. Filled classic
   * and block heads are stored in heads and painted as part of the band
   * outline, like the head of flexArrow, and null is returned for them.
   */
  override createMarker(c: AbstractCanvas2D, pts: Point[], source: boolean): MarkerPaint | null {
    let result: MarkerPaint | null = null;
    const n = pts.length;
    const type = getValue(this.style, source ? 'startArrow' : 'endArrow', null) as string | null;
    const p0 = source ? pts[1] : pts[n - 2];
    const pe = source ? pts[0] : pts[n - 1];

    if (type != null && type !== constants.NONE && p0 != null && pe != null) {
      const dx = pe.x - p0.x;
      const dy = pe.y - p0.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0) {
        const ux = dx / dist;
        const uy = dy / dist;
        const w = source ? this.getStartWidth() : this.getEndWidth();
        const wf = this.isMergedMarker(source) ? this.outlineHeads[type] : undefined;
        let size = getNumber(this.style, source ? 'startSize' : 'endSize', constants.DEFAULT_MARKERSIZE);

        if (wf != null) {
          // Same geometry as the arrow marker with the half width of the head
          // larger than the half width of the band
          size += w * wf / 2;
          const sw = this.strokeWidth;
          const endOffsetX = ux * sw * 1.118;
          const endOffsetY = uy * sw * 1.118;
          const unitX = ux * (size + sw);
          const unitY = uy * (size + sw);
          const tip = new Point(pe.x - endOffsetX, pe.y - endOffsetY);
          const f = type === 'classic' || type === 'classicThin' ? 3 / 4 : 1;
          pe.x += -unitX * f - endOffsetX;
          pe.y += -unitY * f - endOffsetY;

          const c1 = new Point(tip.x - unitX - unitY / wf, tip.y - unitY + unitX / wf);
          const c2 = new Point(tip.x + unitY / wf - unitX, tip.y - unitY - unitX / wf);

          // Corners on the left and right side of the band (whose direction
          // is reversed at the start)
          if (this.heads != null) {
            this.heads[source ? 0 : 1] = source ? { cl: c2, tip, cr: c1 } : { cl: c1, tip, cr: c2 };
          }
        } else {
          const filled = !isZero(getValue(this.style, source ? 'startFill' : 'endFill', 1));
          result = MarkerShape.createMarker(c, this, type, pe, ux, uy, size + w, source,
            this.strokeWidth, filled) as MarkerPaint | null;
        }
      }
    }

    return result;
  }

  /**
   * Removes the local loops of the given offset polyline by cutting it at the
   * self-intersections whose distance along the center line is at most span.
   */
  removeLoops(pts: Point[], lengths: number[], span: number): Point[] {
    const n = pts.length;
    let cur = pts[0];
    const result = [cur];
    let i = 0;

    while (i < n - 1) {
      let ip: Point | null = null;
      let j = i + 2;

      while (j < n - 1 && j < i + 2 + this.maxLoopPoints && lengths[j] - lengths[i + 1] <= span) {
        j++;
      }

      // Uses the last intersection to remove nested loops
      for (j--; j >= i + 2 && ip == null; j--) {
        ip = mathUtils.intersection(cur.x, cur.y, pts[i + 1].x, pts[i + 1].y,
          pts[j].x, pts[j].y, pts[j + 1].x, pts[j + 1].y);
      }

      if (ip != null) {
        cur = ip;
        i = j + 1;
      } else {
        cur = pts[i + 1];
        i++;
      }

      result.push(cur);
    }

    return result;
  }

  /** True if the given marker is added to the path of the band. */
  isMergedMarker(source: boolean): boolean {
    const type = getValue(this.style, source ? 'startArrow' : 'endArrow', null);

    return this.mergedMarkers.indexOf(String(type)) >= 0 &&
      !isZero(getValue(this.style, source ? 'startFill' : 'endFill', 1)) &&
      getValue(this.style, source ? 'startFillColor' : 'endFillColor', null) == null;
  }

  /** mxPolyline.paintEdgeShape (draw.io) incl. the bezier style. */
  private paintPolyline(c: AbstractCanvas2D, pts: Point[]): void {
    const prev = c.pointerEventsValue;
    c.pointerEventsValue = 'stroke';

    if (this.style != null && toFlag(getValue(this.style, 'bezier', 0))) {
      this.paintBezierLine(c, pts);
    } else if (this.style != null && toFlag(getValue(this.style, 'curved', 0))) {
      this.paintCurvedLine(c, pts);
    } else {
      this.paintLine(c, pts, this.isRounded);
    }

    c.pointerEventsValue = prev;
  }

  /**
   * Fills the band with the fill color (or gradient) and strokes its outline.
   * Filled markers are part of the same path.
   */
  override paintEdgeShape(c: AbstractCanvas2D, pts: Point[]): void {
    this.heads = [null, null];
    const sourceMarker = this.createMarker(c, pts, true);
    const targetMarker = this.createMarker(c, pts, false);
    const merged: { paint: MarkerPaint; source: boolean }[] = [];
    const separate: { paint: MarkerPaint; source: boolean }[] = [];

    if (sourceMarker != null) {
      (this.isMergedMarker(true) ? merged : separate).push({ paint: sourceMarker, source: true });
    }

    if (targetMarker != null) {
      (this.isMergedMarker(false) ? merged : separate).push({ paint: targetMarker, source: false });
    }

    // Makes the filled area clickable
    const prev = c.pointerEventsValue;
    c.pointerEventsValue = 'all';
    this.bandPainted = false;
    this.paintPolyline(c, pts);
    c.pointerEventsValue = 'all';

    if (merged.length > 0) {
      if (!this.bandPainted) {
        c.begin();
        this.bandPainted = true;
      }

      // Collects the paths of the markers in the current path
      const canvas = c as unknown as Record<string, unknown>;
      const saved = {
        begin: canvas.begin,
        fill: canvas.fill,
        stroke: canvas.stroke,
        fillAndStroke: canvas.fillAndStroke,
      };
      const nop = (): void => {};
      canvas.begin = nop;
      canvas.fill = nop;
      canvas.stroke = nop;
      canvas.fillAndStroke = nop;

      try {
        for (const m of merged) {
          m.paint();
        }
      } finally {
        canvas.begin = saved.begin;
        canvas.fill = saved.fill;
        canvas.stroke = saved.stroke;
        canvas.fillAndStroke = saved.fillAndStroke;
      }
    }

    if (this.bandPainted) {
      c.fillAndStroke();
    }

    c.pointerEventsValue = prev;

    // Other markers use the fill color of the band without gradient
    if (separate.length > 0) {
      c.setShadow(false);
      c.setDashed(false);

      for (const m of separate) {
        c.setFillColor(getValue(this.style, m.source ? 'startFillColor' : 'endFillColor', this.fill) as string);
        m.paint();
      }
    }
  }
}

function isZero(v: unknown): boolean {
  return v === 0 || v === '0' || v === false;
}
