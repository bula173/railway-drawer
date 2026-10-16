/**
 * Copyright (c) 2006-2018, JGraph Holdings Ltd
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG
 * Licensed under the Apache License, Version 2.0 (see NOTICE).
 *
 * Ported from jgraph/drawio v32.4.1 shapes/mxBasic.js:3347 (createPolygonHandles IIFE)
 * Source: https://raw.githubusercontent.com/jgraph/drawio/v32.4.1/src/main/webapp/shapes/mxBasic.js
 *
 * Hand port: the upstream IIFE registers Graph.handleFactory['mxgraph.basic.polygon'].
 * It relies on draw.io handle internals (handle.execute/redraw, selectionCellsHandler),
 * which are reached through `any` exactly as upstream does.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Point, Rectangle, mathUtils } from '@maxgraph/core';
import { getValue, type CreateHandleFn, type HandleFactory, type HandleThis } from '../compat.js';

export const createPolygonHandles: HandleFactory = function (state: any, createHandle: CreateHandleFn): any[] {
  const handles: any[] = [];

  try {
    const coords = JSON.parse(getValue(state.style, 'polyCoords', '[]'));
    const curves = JSON.parse(getValue(state.style, 'polyCurves', '[]'));
    const polyline = getValue(state.style, 'polyline', 0);
    const isPolyline = polyline == 1 || polyline === true || polyline === 'true' || polyline === '1';
    const minPoints = isPolyline ? 2 : 3;

    // Ignores coordinates that are not arrays, e.g. {"length":1e9}
    if (!Array.isArray(coords)) {
      return handles;
    }

    // Ensure curves array matches coords length
    while (Array.isArray(curves) && curves.length < coords.length) {
      curves.push([]);
    }

    // Helper to refresh handler after structural changes
    const refreshHandler = (): void => {
      const handler = state.view.graph.selectionCellsHandler.getHandler(state.cell);

      if (handler != null) {
        handler.refresh(state);
      }
    };

    // Vertex handles (move existing points)
    for (let i = 0; i < coords.length; i++) {
      (function (index: number) {
        const handle = createHandle(
          state,
          ['polyCoords', 'polyCurves'],
          function (this: HandleThis, bounds: Rectangle) {
            return new Point(bounds.x + coords[index][0] * bounds.width, bounds.y + coords[index][1] * bounds.height);
          },
          function (this: HandleThis, bounds: Rectangle, pt: Point) {
            const x = Math.round(100000 * Math.max(0, Math.min(1, (pt.x - bounds.x) / bounds.width))) / 100000;
            const y = Math.round(100000 * Math.max(0, Math.min(1, (pt.y - bounds.y) / bounds.height))) / 100000;

            coords[index] = [x, y];
            state.style['polyCoords'] = JSON.stringify(coords);
            state.style['polyCurves'] = JSON.stringify(curves);
          },
          false,
        );

        // Collinear removal on mouse up only (not during drag)
        const vertexOrigExecute = handle.execute;

        handle.execute = function (this: any, ...args: any[]) {
          if (coords.length > minPoints) {
            const n = coords.length;
            const prevIdx = (index - 1 + n) % n;
            const nextIdx = (index + 1) % n;
            const canRemove = !isPolyline || (index > 0 && index < n - 1);

            if (canRemove) {
              const bounds = this.state.getPaintBounds();
              const px = coords[prevIdx][0] * bounds.width;
              const py = coords[prevIdx][1] * bounds.height;
              const nx = coords[nextIdx][0] * bounds.width;
              const ny = coords[nextIdx][1] * bounds.height;
              const cx = coords[index][0] * bounds.width;
              const cy = coords[index][1] * bounds.height;

              if (mathUtils.ptSegDistSq(px, py, nx, ny, cx, cy) < 4) {
                coords.splice(index, 1);
                curves.splice(index, 1);
                state.style['polyCoords'] = JSON.stringify(coords);
                state.style['polyCurves'] = JSON.stringify(curves);
                vertexOrigExecute.apply(this, args);
                refreshHandler();

                return;
              }
            }
          }

          vertexOrigExecute.apply(this, args);
        };

        handles.push(handle);
      })(i);
    }

    // Control point handles (adjust bezier control points)
    for (let i = 0; i < curves.length && i < coords.length; i++) {
      (function (segIndex: number) {
        if (curves[segIndex] != null && curves[segIndex].length >= 3 && curves[segIndex][0] === 'Q') {
          const cpHandle = createHandle(
            state,
            ['polyCurves'],
            function (this: HandleThis, bounds: Rectangle) {
              return new Point(
                bounds.x + curves[segIndex][1] * bounds.width,
                bounds.y + curves[segIndex][2] * bounds.height,
              );
            },
            function (this: HandleThis, bounds: Rectangle, pt: Point) {
              const x = Math.round(100000 * Math.max(0, Math.min(1, (pt.x - bounds.x) / bounds.width))) / 100000;
              const y = Math.round(100000 * Math.max(0, Math.min(1, (pt.y - bounds.y) / bounds.height))) / 100000;

              curves[segIndex] = ['Q', x, y];
              state.style['polyCurves'] = JSON.stringify(curves);
            },
            false,
          );

          // Visually distinct: override shape color
          const cpOrigRedraw = cpHandle.redraw;

          cpHandle.redraw = function (this: any, ...args: any[]) {
            cpOrigRedraw.apply(this, args);

            if (this.shape != null && this.shape.node != null) {
              this.shape.node.setAttribute('fill', '#fca000');

              if (this.shape.node.firstChild != null) {
                this.shape.node.firstChild.setAttribute('fill', '#fca000');
              }
            }
          };

          handles.push(cpHandle);
        }
      })(i);
    }
  } catch {
    // ignore
  }

  return handles;
};
