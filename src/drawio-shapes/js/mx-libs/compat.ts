/**
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG
 * Licensed under the Apache License, Version 2.0 (see NOTICE).
 *
 * Small draw.io (mxGraph) compatibility layer used by the mx-libs ports.
 * It keeps the ported shape code close to the upstream sources:
 * - getValue/getNumber follow mxUtils.getValue/getNumber semantics
 *   (value is used when it is not null/undefined, otherwise the default),
 * - CustomProperty mirrors draw.io's `customProperties` metadata,
 * - HandleFactory mirrors draw.io's `Graph.handleFactory[name]` entries; the
 *   draw.io `Graph.createHandle` is passed in by the caller (a later handles
 *   integration), so this module has no dependency on a handle implementation.
 *
 * Ported from jgraph/drawio v32.4.1 src/main/webapp/mxgraph/src/util/mxUtils.js
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { AbstractCanvas2D, Point, Rectangle, Shape } from '@maxgraph/core';

/** Pinned upstream draw.io release the mx-libs ports were taken from. */
export const DRAWIO_TAG = 'v32.4.1';

/** Style-like bag (maxGraph CellStateStyle or a plain record). */
export type StyleBag = object | null | undefined;

/**
 * mxUtils.getValue: returns style[key] when it is not null/undefined,
 * otherwise defaultValue. The result is `any` on purpose (draw.io code feeds it
 * to parseFloat, compares it with == and passes it to canvas setters).
 */
export function getValue(style: StyleBag, key: string, defaultValue?: unknown): any {
  if (style != null) {
    const value = (style as Record<string, unknown>)[key];
    if (value != null) return value;
  }
  return defaultValue;
}

/**
 * mxUtils.getNumber: like getValue but converts the result to a number
 * (draw.io: `value = Number(value); if (isNaN(value)) value = defaultValue`).
 */
export function getNumber(style: StyleBag, key: string, defaultValue: number): number {
  let value = Number(getValue(style, key, defaultValue));
  if (Number.isNaN(value)) value = defaultValue;
  return value;
}

/** draw.io `customProperties` entry (Format panel metadata). */
export interface CustomProperty {
  name: string;
  dispName: string;
  type: string;
  min?: number;
  max?: number;
  /** Upstream typo kept verbatim (mxShapeBasicLayeredRect uses `mix`). */
  mix?: number;
  defVal?: unknown;
  enumList?: Array<{ val: string; dispName: string }>;
  [key: string]: unknown;
}

/** The `this` of draw.io handle callbacks (the created mxHandle). */
export interface HandleThis {
  state: { style: Record<string, any>; [key: string]: any };
  [key: string]: any;
}

/** draw.io Graph.createHandle(state, keys, getPositionFn, setPositionFn, ignoreGrid?, redrawEdges?, ...). */
export type CreateHandleFn = (
  state: any,
  keys: string[],
  getPositionFn: (this: HandleThis, bounds: Rectangle) => Point,
  setPositionFn: (this: HandleThis, bounds: Rectangle, pt: Point, me?: any) => void,
  ignoreGrid?: boolean,
  redrawEdges?: boolean,
) => any;

/** draw.io Graph.handleFactory entry, with createHandle injected. */
export type HandleFactory = (state: any, createHandle: CreateHandleFn) => any[];

/** Shape constructor (CellRenderer instantiates it with no arguments). */
export type ShapeCtor = new (...args: any[]) => Shape;

/** CellRenderer.registerShape is typed as `typeof Shape`; subclasses have other constructor signatures. */
export function asShapeClass(ctor: ShapeCtor): typeof Shape {
  return ctor as unknown as typeof Shape;
}

/**
 * AbstractCanvas2D as draw.io code uses it: arcTo takes 0/1 numbers for the
 * large-arc and sweep flags (maxGraph types them as booleans but treats them
 * the same way at runtime).
 */
export type DrawioCanvas = Omit<AbstractCanvas2D, 'arcTo'> & {
  arcTo(
    rx: number,
    ry: number,
    angle: number,
    largeArcFlag: number | boolean,
    sweepFlag: number | boolean,
    x: number,
    y: number,
  ): void;
};
