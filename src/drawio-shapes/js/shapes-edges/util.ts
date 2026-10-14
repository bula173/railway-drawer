/**
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Ported from jgraph/drawio v32.4.1 src/main/webapp/mxgraph/src/util/mxUtils.js
 * (getValue/getNumber semantics) and src/main/webapp/js/grapheditor/Graph.js:7674
 * (Graph.curvePointSteps / Graph.getCurvePoints).
 *
 * Shared helpers of the shapes-edges ports. Style values in this app may be
 * strings (draw.io), numbers or booleans (the importer in services/drawio-xml.ts
 * converts them), so the helpers accept all three.
 */

import { Point } from '@maxgraph/core';

/** draw.io tag the ports in this folder were taken from. */
export const DRAWIO_TAG = 'v32.4.1';

/** Upstream URL prefix of the ported sources. */
export const DRAWIO_SOURCE_BASE = `https://raw.githubusercontent.com/jgraph/drawio/${DRAWIO_TAG}/src/main/webapp/`;

export const NONE = 'none';

export type StyleLike = Record<string, unknown> | null | undefined;

function asRecord(style: unknown): Record<string, unknown> | null {
  return style != null && typeof style === 'object' ? (style as Record<string, unknown>) : null;
}

/** mxUtils.getValue: style[key] or the default if the value is null/undefined. */
export function getValue<T>(style: unknown, key: string, def: T): unknown {
  const s = asRecord(style);
  const v = s != null ? s[key] : undefined;
  return v == null ? def : v;
}

/** String value of style[key] (or the default). */
export function getString(style: unknown, key: string, def: string): string;
export function getString(style: unknown, key: string, def: string | null): string | null;
export function getString(style: unknown, key: string, def: string | null): string | null {
  const v = getValue(style, key, def);
  return v == null ? null : String(v);
}

/** mxUtils.getNumber: Number(style[key]) or the default; booleans map to 1/0. */
export function getNumber(style: unknown, key: string, def: number): number {
  const v = getValue(style, key, def);
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : def;
}

/**
 * Flag semantics of `mxUtils.getValue(style, key, def) == '1'` for values that
 * may be '1'/'0', 1/0 or true/false.
 */
export function isFlag(style: unknown, key: string, def: boolean): boolean {
  const v = getValue(style, key, def);
  return toFlag(v);
}

export function toFlag(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1;
  if (typeof v === 'string') return v === '1' || v === 'true';
  return false;
}

/** True if the value is a usable color (not null and not 'none'). */
export function isColor(v: unknown): v is string {
  return v != null && v !== '' && v !== NONE;
}

/** Number of points per curve segment in getCurvePoints (Graph.js:7674). */
export const CURVE_POINT_STEPS = 16;

/**
 * Port of Graph.getCurvePoints (Graph.js:7685): subdivides the points of a
 * curved/bezier edge into the fine polyline that the curve is painted with.
 */
export function getCurvePoints(pts: (Point | null)[], bezier: boolean): (Point | null)[] {
  const n = pts.length;

  if (n < 3 || pts.indexOf(null) >= 0) {
    return pts;
  }

  const p = pts as Point[];
  const steps = CURVE_POINT_STEPS;
  const result: Point[] = [p[0]];

  const quad = (p0: Point, pc: Point, p1: Point): void => {
    for (let t = 1; t <= steps; t++) {
      const u = t / steps;
      const iu = 1 - u;
      result.push(new Point(
        iu * iu * p0.x + 2 * iu * u * pc.x + u * u * p1.x,
        iu * iu * p0.y + 2 * iu * u * pc.y + u * u * p1.y));
    }
  };

  if (bezier && (n - 1) % 3 === 0) {
    for (let i = 1; i + 2 < n; i += 3) {
      const p0 = p[i - 1];
      const c1 = p[i];
      const c2 = p[i + 1];
      const p1 = p[i + 2];

      for (let t = 1; t <= steps; t++) {
        const u = t / steps;
        const iu = 1 - u;
        result.push(new Point(
          iu * iu * iu * p0.x + 3 * iu * iu * u * c1.x + 3 * iu * u * u * c2.x + u * u * u * p1.x,
          iu * iu * iu * p0.y + 3 * iu * iu * u * c1.y + 3 * iu * u * u * c2.y + u * u * u * p1.y));
      }
    }
  } else {
    let prev = p[0];

    for (let i = 1; i < n - 2; i++) {
      const mid = new Point((p[i].x + p[i + 1].x) / 2, (p[i].y + p[i + 1].y) / 2);
      quad(prev, p[i], mid);
      prev = mid;
    }

    quad(prev, p[n - 2], p[n - 1]);
  }

  return result;
}

/**
 * Minimal port of mxUtils.parseCssFontFamily: quotes family names that
 * contain spaces so they can be used in an SVG font-family attribute.
 */
export function parseCssFontFamily(value: string): string {
  return value
    .split(',')
    .map((name) => {
      const n = name.trim();
      return /\s/.test(n) && !/^['"]/.test(n) ? `"${n}"` : n;
    })
    .join(',');
}
