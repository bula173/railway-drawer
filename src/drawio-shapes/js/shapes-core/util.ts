/**
 * Copyright (c) 2006-2025, JGraph Holdings Ltd
 * Copyright (c) 2006-2025, draw.io AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Helpers shared by the ports of jgraph/drawio v32.4.1
 * src/main/webapp/js/grapheditor/Shapes.js (mxUtils.getValue semantics,
 * mxConnectionConstraint shorthands, arcTo flag normalisation).
 */

import { AbstractCanvas2D, ConnectionConstraint, Point } from '@maxgraph/core';

/** Canvas type used by every port (maxGraph's equivalent of mxAbstractCanvas2D). */
export type Canvas = AbstractCanvas2D;

/** Style object as seen by a port: draw.io keys are not all declared in CellStateStyle. */
export type StyleMap = Record<string, unknown> | null | undefined;

/** draw.io mxConstants.LINE_ARCSIZE */
export const LINE_ARCSIZE = 20;
/** draw.io mxConstants.RECTANGLE_ROUNDING_FACTOR */
export const RECTANGLE_ROUNDING_FACTOR = 0.15;
/** draw.io mxConstants.NONE */
export const NONE = 'none';

/** The style of a shape as a plain map (`this.style?.[key]`). */
export function styleOf(shape: { style: unknown }): StyleMap {
  return shape.style as StyleMap;
}

/** mxUtils.getValue(style, key, def): returns the raw value or the default when null/undefined. */
export function getValue<T>(style: StyleMap, key: string, def: T): unknown {
  const v = style?.[key];
  return v === undefined || v === null ? def : v;
}

/**
 * parseFloat(mxUtils.getValue(style, key, def)). A value that does not parse falls back to the
 * default so a malformed style cannot produce NaN path data.
 */
export function num(style: StyleMap, key: string, def: number): number {
  const v = style?.[key];
  if (v === undefined || v === null || v === '') return def;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : def;
}

/** String style value with default. */
export function str(style: StyleMap, key: string, def: string): string {
  const v = style?.[key];
  return v === undefined || v === null ? def : String(v);
}

/**
 * Boolean style value. draw.io stores flags as '0'/'1'; the app's style parser turns them into
 * numbers or booleans. '0', 0, false, 'false' and '' are false.
 */
export function flag(style: StyleMap, key: string, def: boolean): boolean {
  const v = style?.[key];
  if (v === undefined || v === null) return def;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const s = String(v);
  return !(s === '0' || s === 'false' || s === '');
}

/** mxUtils.getValue(style, 'arcSize', LINE_ARCSIZE) / 2, as used by the addPoints shapes. */
export function lineArcSize(style: StyleMap): number {
  return num(style, 'arcSize', LINE_ARCSIZE) / 2;
}

/** mxUtils.getValue(style, 'arcSize', RECTANGLE_ROUNDING_FACTOR * 100) / 100 */
export function rectArcFactor(style: StyleMap): number {
  return num(style, 'arcSize', RECTANGLE_ROUNDING_FACTOR * 100) / 100;
}

/** True when the colour paints something (draw.io: fill != null && fill != 'none'). */
export function isPainted(color: unknown): boolean {
  return color !== undefined && color !== null && color !== NONE && color !== '';
}

/** Clamp v into [lo, hi]: Math.max(lo, Math.min(hi, v)). */
export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * c.arcTo with draw.io's numeric 0/1 flags. maxGraph's arcToCurves compares the two flags with
 * `===`, so both are normalised to booleans.
 */
export function arcTo(
  c: Canvas,
  rx: number,
  ry: number,
  angle: number,
  largeArcFlag: number | boolean,
  sweepFlag: number | boolean,
  x: number,
  y: number
): void {
  c.arcTo(rx, ry, angle, !!largeArcFlag, !!sweepFlag, x, y);
}

/** new mxConnectionConstraint(new mxPoint(x, y), perimeter, name, dx, dy) */
export function cc(
  x: number,
  y: number,
  perimeter = true,
  name: string | null = null,
  dx = 0,
  dy = 0
): ConnectionConstraint {
  return new ConnectionConstraint(new Point(x, y), perimeter, name, dx, dy);
}

/** Point shorthand (new mxPoint). */
export function pt(x: number, y: number): Point {
  return new Point(x, y);
}

/** Shapes.js:10672 mxRectangleShape.prototype.constraints */
export const RECTANGLE_CONSTRAINTS: ConnectionConstraint[] = [
  cc(0, 0), cc(0.25, 0), cc(0.5, 0), cc(0.75, 0), cc(1, 0),
  cc(0, 0.25), cc(0, 0.5), cc(0, 0.75),
  cc(1, 0.25), cc(1, 0.5), cc(1, 0.75),
  cc(0, 1), cc(0.25, 1), cc(0.5, 1), cc(0.75, 1), cc(1, 1),
];

/** Shapes.js:10688 mxEllipse.prototype.constraints (last one uses the default perimeter=true) */
export const ELLIPSE_CONSTRAINTS: ConnectionConstraint[] = [
  cc(0, 0), cc(1, 0), cc(0, 1), cc(1, 1),
  cc(0.5, 0), cc(0.5, 1), cc(0, 0.5), cc(1, 0.5),
];

/** Shapes.js:10908 mxCylinder.prototype.constraints */
export const CYLINDER_CONSTRAINTS: ConnectionConstraint[] = [
  cc(0.15, 0.05, false), cc(0.5, 0), cc(0.85, 0.05, false),
  cc(0, 0.3), cc(0, 0.5), cc(0, 0.7),
  cc(1, 0.3), cc(1, 0.5), cc(1, 0.7),
  cc(0.15, 0.95, false), cc(0.5, 1), cc(0.85, 0.95, false),
];

/** Shapes.js:10939 mxActor.prototype.constraints */
export const ACTOR_CONSTRAINTS: ConnectionConstraint[] = [
  cc(0.5, 0), cc(0.25, 0.2, false), cc(0.1, 0.5, false), cc(0, 0.75),
  cc(0.75, 0.25, false), cc(0.9, 0.5, false), cc(1, 0.75),
  cc(0.25, 1), cc(0.5, 1), cc(0.75, 1),
];

/** Shapes.js:10991 mxHexagon.prototype.constraints */
export const HEXAGON_CONSTRAINTS: ConnectionConstraint[] = [
  cc(0.375, 0), cc(0.5, 0), cc(0.625, 0),
  cc(0, 0.25), cc(0, 0.5), cc(0, 0.75),
  cc(1, 0.25), cc(1, 0.5), cc(1, 0.75),
  cc(0.375, 1), cc(0.5, 1), cc(0.625, 1),
];
