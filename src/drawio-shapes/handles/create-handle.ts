/**
 * @file create-handle.ts
 * @brief draw.io's Graph.createHandle for maxGraph: a VertexHandle whose position comes from
 * the cell style and whose drag writes the style back (live preview, one undoable edit).
 *
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG. Licensed under the Apache
 * License, Version 2.0. Ported from jgraph/drawio v32.4.1
 * src/main/webapp/js/grapheditor/Shapes.js:9258-9295 (createHandle),
 * src/main/webapp/js/grapheditor/Graph.js:33591/33635 (secondaryHandleImage) and
 * src/main/webapp/mxgraph/mxClient.js (mxHandle.processEvent).
 * Source: https://raw.githubusercontent.com/jgraph/drawio/v32.4.1/src/main/webapp/js/grapheditor/Shapes.js
 *
 * maxGraph 0.10.3 gap: VertexHandle.processEvent computes the snapped/rotated point but never
 * calls setPosition (mxHandle.processEvent does), so a dragged handle changed nothing.
 * DrawioHandle restores the mxGraph behaviour.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { ImageBox, InternalEvent, Point, VertexHandle, mathUtils } from '@maxgraph/core';
import type { CellState, CellStateStyle, InternalMouseEvent, Rectangle } from '@maxgraph/core';
import type { CreateHandleFn, HandleThis } from '../js/mx-libs/compat.js';

/** Graph.createSvgImage(w, h, data): base64 SVG data URI (Graph.js:2288). */
export function createSvgImage(w: number, h: number, data: string): ImageBox {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}px" ` +
    `height="${h}px" version="1.1" style="color-scheme: light dark;">${data}</svg>`;
  const b64 = typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(svg))) : '';
  return new ImageBox(`data:image/svg+xml;base64,${b64}`, w, h);
}

/** HoverIcons.prototype.secondaryHandle (Graph.js:33591): draw.io's yellow diamond. */
export const SECONDARY_HANDLE_IMAGE = createSvgImage(
  16,
  16,
  '<path d="m 8 3 L 13 8 L 8 13 L 3 8 z" stroke="#fff" fill="#fca000"/>',
);

type PositionFn = (this: HandleThis, bounds: Rectangle) => Point | null;
type SetPositionFn = (this: HandleThis, bounds: Rectangle, pt: Point, me?: InternalMouseEvent) => void;

/**
 * mxHandle as draw.io uses it. getPosition/setPosition/execute are assigned per instance by
 * createHandle, exactly like Shapes.js does on the mxHandle object.
 */
export class DrawioHandle extends VertexHandle {
  /** Marks handles created by this module (draw.io code checks handle flags the same way). */
  readonly drawioHandle = true;

  /** mxHandle.processEvent: snap, rotate, flip, then setPosition (missing in maxGraph 0.10.3). */
  override processEvent(me: InternalMouseEvent): void {
    const { scale } = this.graph.view;
    const tr = this.graph.view.translate;
    let pt = new Point(me.getGraphX() / scale - tr.x, me.getGraphY() / scale - tr.y);

    // Center shape on mouse cursor
    if (this.shape != null && this.shape.bounds != null) {
      pt.x -= this.shape.bounds.width / scale / 4;
      pt.y -= this.shape.bounds.height / scale / 4;
    }

    // Snaps to grid for the rotated position then applies the rotation for the direction after that
    const alpha1 = -mathUtils.toRadians(this.getRotation());
    const alpha2 = -mathUtils.toRadians(this.getTotalRotation()) - alpha1;
    pt = this.flipPoint(
      this.rotatePoint(
        this.snapPoint(this.rotatePoint(pt, alpha1), this.ignoreGrid || !this.graph.isGridEnabledEvent(me.getEvent())),
        alpha2,
      ),
    );
    this.setPosition(this.state.getPaintBounds(), pt, me);
    this.redraw();
  }
}

/**
 * Graph.createHandle(state, keys, getPositionFn, setPositionFn, ignoreGrid, redrawEdges, executeFn)
 * (Shapes.js:9258). On mouse up, execute copies every key of the live (state) style into the
 * cell style with graph.setCellStyles inside the handler's batch update: one undoable edit.
 */
export function createHandle(
  state: CellState,
  keys: string[],
  getPositionFn: PositionFn,
  setPositionFn: SetPositionFn,
  ignoreGrid?: boolean | null,
  redrawEdges?: boolean | null,
  executeFn?: ((me: InternalMouseEvent) => void) | null,
): DrawioHandle {
  const handle = new DrawioHandle(state, 'default', SECONDARY_HANDLE_IMAGE);

  handle.execute = function (this: DrawioHandle, me: InternalMouseEvent) {
    for (let i = 0; i < keys.length; i++) {
      this.copyStyle(keys[i] as keyof CellStateStyle);
    }

    if (executeFn) {
      executeFn(me);
    }
  };

  handle.getPosition = getPositionFn as unknown as VertexHandle['getPosition'];
  handle.setPosition = setPositionFn as unknown as VertexHandle['setPosition'];
  handle.ignoreGrid = ignoreGrid != null ? ignoreGrid : true;

  // Overridden to update connected edges
  if (redrawEdges) {
    const positionChanged = handle.positionChanged;

    handle.positionChanged = function (this: DrawioHandle) {
      positionChanged.apply(this);

      // Redraws connected edges TODO: Include child edges
      state.view.invalidate(this.state.cell);
      state.view.validate();
    };
  }

  return handle;
}

/** createHandle typed as the injected `CreateHandleFn` of the mx-libs handle factories. */
export const createHandleFn: CreateHandleFn = createHandle as unknown as CreateHandleFn;

/** Index of the first custom handle (mxEvent.CUSTOM_HANDLE), for tests and callers. */
export const CUSTOM_HANDLE_INDEX: number = InternalEvent.CUSTOM_HANDLE;

/** Loose handle type used by the factories (the draw.io code reads arbitrary fields). */
export type AnyHandle = DrawioHandle & Record<string, any>;
