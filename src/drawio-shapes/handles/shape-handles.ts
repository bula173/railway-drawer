/**
 * @file shape-handles.ts
 * @brief draw.io's Graph.handleFactory for the Shapes.js shapes ported to maxGraph.
 *
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG. Licensed under the Apache
 * License, Version 2.0. Ported from jgraph/drawio v32.4.1
 * src/main/webapp/js/grapheditor/Shapes.js:9297-10298 (createArcHandle, create*HandleFunction,
 * createEdgeHandle, createEdgeWidthHandle, createTaperedWidthHandle, handleFactory).
 * Source: https://raw.githubusercontent.com/jgraph/drawio/v32.4.1/src/main/webapp/js/grapheditor/Shapes.js
 *
 * Mechanical port: mxPoint -> Point, mxUtils.getValue/getNumber -> getValue/getNumber (same
 * semantics), mxUtils.ptSegDistSq/ptLineDist -> mathUtils, mxEvent.is*Down -> eventUtils,
 * shape.strokewidth -> shape.strokeWidth, XxxShape.prototype.size -> the literal draw.io default
 * (the TS ports keep these as instance fields). Boolean style checks accept maxGraph's parsed
 * values (true/1/'1') where mxGraph saw numbers. Only shapes registered in this app are listed;
 * draw.io entries for unported shapes (umlLifeline, umlFrame, module, folder, note2, cylinder2,
 * pipe) are left out.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Point, eventUtils, mathUtils } from '@maxgraph/core';
import type { CellState, Graph, InternalMouseEvent, Rectangle } from '@maxgraph/core';
import { getNumber, getValue, type HandleThis } from '../js/mx-libs/compat.js';
import { isDrawioSwimlane, isTableCell, isTableRow, swimlaneDirection } from '../js/shapes-edges/table-graph.js';
import { createHandle, type DrawioHandle } from './create-handle.js';

/** Vertex/edge handle factory with draw.io's signature: fn(state) -> handles. */
export type ShapeHandleFactory = (state: CellState) => DrawioHandle[] | null;

// mxConstants used by the factories
const STYLE_ARCSIZE = 'arcSize';
const STYLE_ABSOLUTE_ARCSIZE = 'absoluteArcSize';
const STYLE_ROUNDED = 'rounded';
const STYLE_STARTSIZE = 'startSize';
const STYLE_ENDSIZE = 'endSize';
const STYLE_STARTARROW = 'startArrow';
const STYLE_ENDARROW = 'endArrow';
const STYLE_HORIZONTAL = 'horizontal';
const LINE_ARCSIZE = 20;
const RECTANGLE_ROUNDING_FACTOR = 0.15;
const ARROW_SIZE = 30;
const DEFAULT_STARTSIZE = 40;
const NONE = 'none';

// draw.io prototype defaults (Shapes.js line numbers)
const D = {
  processSize: 0.1, // 2445
  noteSize: 30, // 1275
  manualInputSize: 30, // 4740
  dataStorageSize: 0.1, // 4979
  dataStorageFixedSize: 20, // 4981
  calloutSize: 30, // 2557
  calloutPosition: 0.5, // 2559
  calloutPosition2: 0.5, // 2561
  calloutBase: 20, // 2563
  wedgeTipX: -0.25, // 2600
  wedgeTipY: 1, // 2602
  wedgeMaxTipOffset: 100, // 2608
  internalStorageDx: 20, // 4778
  internalStorageDy: 20, // 4780
  cornerDx: 20, // 4825
  cornerDy: 20, // 4827
  teeDx: 20, // 4882
  teeDy: 20, // 4884
  crossSize: 0.2, // 5420
  documentSize: 0.3, // 1896
  tapeSize: 0.4, // 1841
  cylinder3Size: 15, // 1441
  offPageConnectorSize: 3 / 8, // 5073
  singleArrowWidth: 0.3, // 4916
  singleArrowSize: 0.2, // 4918
  stepSize: 0.2, // 2759
  stepFixedSize: 20, // 2761
  hexagonSize: 0.25, // 2789
  hexagonFixedSize: 20, // 2791
  curlyBracketSize: 0.5, // 2110
  displaySize: 0.25, // 5457
  cubeSize: 20, // 976
  cardSize: 30, // 1815
  loopLimitSize: 20, // 5047
  trapezoidSize: 0.2, // 2080
  trapezoidFixedSize: 20, // 2082
  parallelogramSize: 0.2, // 2050
  parallelogramFixedSize: 20, // 2052
  zigzagSize: 10, // 7625
  arcStartY: 25, // 8089
  arcMidY: -25, // 8090
  arcEndY: 25, // 8091
} as const;

/** `if (mxUtils.getValue(style, key, false))` with mxGraph's numeric parsing ('0' -> 0). */
function isOn(style: object, key: string, def: unknown = false): boolean {
  const v = getValue(style, key, def);
  return !!v && v !== '0' && v !== 'false';
}

/** `mxUtils.getValue(style, 'fixedSize', '0') != '0'`. */
function isFixed(style: object): boolean {
  const v = getValue(style, 'fixedSize', '0');
  return !(v === 0 || v === '0' || v === false || v === 'false');
}

/** `value == '1'` / `value == 1`. */
function isOne(v: unknown): boolean {
  return v === 1 || v === '1' || v === true;
}

function graphOf(state: CellState): Graph {
  return state.view.graph;
}

function evt(me: InternalMouseEvent | undefined): MouseEvent {
  return me!.getEvent() as MouseEvent;
}

type Pos = (this: HandleThis, bounds: Rectangle) => Point | null;
type SetPos = (this: HandleThis, bounds: Rectangle, pt: Point, me?: InternalMouseEvent) => void;

function handle(
  state: CellState,
  keys: string[],
  getPositionFn: Pos,
  setPositionFn: SetPos,
  ignoreGrid?: boolean | null,
  redrawEdges?: boolean | null,
  executeFn?: ((me: InternalMouseEvent) => void) | null,
): DrawioHandle {
  return createHandle(state, keys, getPositionFn, setPositionFn, ignoreGrid, redrawEdges, executeFn);
}

// Shapes.js:9297
export function createArcHandle(state: CellState, yOffset?: number | null): DrawioHandle {
  return handle(
    state,
    [STYLE_ARCSIZE],
    function (bounds) {
      const tmp = yOffset != null ? yOffset : bounds.height / 8;

      if (isOne(getValue(state.style, STYLE_ABSOLUTE_ARCSIZE, 0))) {
        const arcSize = getValue(state.style, STYLE_ARCSIZE, LINE_ARCSIZE) / 2;

        return new Point(bounds.x + bounds.width - Math.min(bounds.width / 2, arcSize), bounds.y + tmp);
      } else {
        const arcSize =
          Math.max(0, parseFloat(getValue(state.style, STYLE_ARCSIZE, RECTANGLE_ROUNDING_FACTOR * 100))) / 100;

        return new Point(
          bounds.x +
            bounds.width -
            Math.min(Math.max(bounds.width / 2, bounds.height / 2), Math.min(bounds.width, bounds.height) * arcSize),
          bounds.y + tmp,
        );
      }
    },
    function (bounds, pt) {
      if (isOne(getValue(state.style, STYLE_ABSOLUTE_ARCSIZE, 0))) {
        this.state.style[STYLE_ARCSIZE] = Math.round(
          Math.max(0, Math.min(bounds.width, (bounds.x + bounds.width - pt.x) * 2)),
        );
      } else {
        const f = Math.min(
          50,
          Math.max(0, ((bounds.width - pt.x + bounds.x) * 100) / Math.min(bounds.width, bounds.height)),
        );
        this.state.style[STYLE_ARCSIZE] = Math.round(f);
      }
    },
  );
}

// Shapes.js:9333
function createArcHandleFunction(): ShapeHandleFactory {
  return function (state) {
    const handles: DrawioHandle[] = [];

    if (isOn(state.style, STYLE_ROUNDED, false)) {
      handles.push(createArcHandle(state));
    }

    return handles;
  };
}

// Shapes.js:9348
function createTrapezoidHandleFunction(
  max: number | null,
  defaultValue: number,
  fixedDefaultValue: number | null,
): ShapeHandleFactory {
  const m = max != null ? max : 0.5;

  return function (state) {
    const handles = [
      handle(
        state,
        ['size'],
        function (bounds) {
          const fixed = fixedDefaultValue != null ? isFixed(this.state.style) : null;
          const size = Math.max(
            0,
            parseFloat(getValue(this.state.style, 'size', fixed ? fixedDefaultValue : defaultValue)),
          );

          return new Point(
            bounds.x + Math.min(bounds.width * 0.75 * m, size * (fixed ? 0.75 : bounds.width * 0.75)),
            bounds.y + bounds.height / 4,
          );
        },
        function (bounds, pt) {
          const fixed = fixedDefaultValue != null ? isFixed(this.state.style) : null;
          const size = fixed ? pt.x - bounds.x : Math.max(0, Math.min(m, ((pt.x - bounds.x) / bounds.width) * 0.75));

          this.state.style['size'] = size;
        },
        false,
        true,
      ),
    ];

    if (isOn(state.style, STYLE_ROUNDED, false)) {
      handles.push(createArcHandle(state));
    }

    return handles;
  };
}

// Shapes.js:9377
function createDisplayHandleFunction(
  defaultValue: number,
  allowArcHandle: boolean,
  max?: number | null,
  redrawEdges?: boolean,
  fixedDefaultValue?: number,
): ShapeHandleFactory {
  const m = max != null ? max : 0.5;

  return function (state) {
    const handles = [
      handle(
        state,
        ['size'],
        function (bounds) {
          const fixed = fixedDefaultValue != null ? isFixed(this.state.style) : null;
          const size = parseFloat(getValue(this.state.style, 'size', fixed ? fixedDefaultValue : defaultValue));

          return new Point(
            bounds.x + Math.max(0, Math.min(bounds.width * 0.5, size * (fixed ? 1 : bounds.width))),
            bounds.getCenterY(),
          );
        },
        function (bounds, pt) {
          const fixed = fixedDefaultValue != null ? isFixed(this.state.style) : null;
          const size = fixed ? pt.x - bounds.x : Math.max(0, Math.min(m, (pt.x - bounds.x) / bounds.width));

          this.state.style['size'] = size;
        },
        false,
        redrawEdges,
      ),
    ];

    if (allowArcHandle && isOn(state.style, STYLE_ROUNDED, false)) {
      handles.push(createArcHandle(state));
    }

    return handles;
  };
}

// Shapes.js:9406
function createCubeHandleFunction(factor: number, defaultValue: number, allowArcHandle: boolean): ShapeHandleFactory {
  return function (state) {
    const handles = [
      handle(
        state,
        ['size'],
        function (bounds) {
          const size =
            Math.max(
              0,
              Math.min(
                bounds.width,
                Math.min(bounds.height, parseFloat(getValue(this.state.style, 'size', defaultValue))),
              ),
            ) * factor;

          return new Point(bounds.x + size, bounds.y + size);
        },
        function (bounds, pt) {
          this.state.style['size'] = Math.round(
            Math.max(0, Math.min(Math.min(bounds.width, pt.x - bounds.x), Math.min(bounds.height, pt.y - bounds.y))) /
              factor,
          );
        },
        false,
      ),
    ];

    if (allowArcHandle && isOn(state.style, STYLE_ROUNDED, false)) {
      handles.push(createArcHandle(state));
    }

    return handles;
  };
}

// Shapes.js:9431
function createCylinderHandleFunction(defaultValue: number): ShapeHandleFactory {
  return function (state) {
    return [
      handle(
        state,
        ['size'],
        function (bounds) {
          const size = Math.max(
            0,
            Math.min(bounds.height * 0.5, parseFloat(getValue(this.state.style, 'size', defaultValue))),
          );

          return new Point(bounds.x, bounds.y + size);
        },
        function (bounds, pt) {
          this.state.style['size'] = Math.max(0, pt.y - bounds.y);
        },
        true,
      ),
    ];
  };
}

// Shapes.js:9447
function createArrowHandleFunction(maxSize: number): ShapeHandleFactory {
  return function (state) {
    return [
      handle(
        state,
        ['arrowWidth', 'arrowSize'],
        function (bounds) {
          const aw = Math.max(0, Math.min(1, getValue(this.state.style, 'arrowWidth', D.singleArrowWidth)));
          const as = Math.max(0, Math.min(maxSize, getValue(this.state.style, 'arrowSize', D.singleArrowSize)));

          return new Point(bounds.x + (1 - as) * bounds.width, bounds.y + ((1 - aw) * bounds.height) / 2);
        },
        function (bounds, pt) {
          this.state.style['arrowWidth'] = Math.max(
            0,
            Math.min(1, (Math.abs(bounds.y + bounds.height / 2 - pt.y) / bounds.height) * 2),
          );
          this.state.style['arrowSize'] = Math.max(0, Math.min(maxSize, (bounds.x + bounds.width - pt.x) / bounds.width));
        },
      ),
    ];
  };
}

type EdgeGetPos = (this: HandleThis, dist: number, nx: number, ny: number, p0: Point, p1: Point) => Point;
type EdgeSetPos = (
  this: HandleThis,
  dist: number,
  nx: number,
  ny: number,
  p0: Point,
  p1: Point,
  pt: Point,
  me?: InternalMouseEvent,
) => void;

// Shapes.js:9465
function createWedgeHandleFunction(defaultValue: number, spacing: number): ShapeHandleFactory {
  return function (state) {
    return [
      createEdgeHandle(
        state,
        ['startWidth'],
        true,
        function (dist, nx, ny, p0) {
          const w = getNumber(state.style, 'startWidth', defaultValue) * state.view.scale + spacing;

          return new Point(p0.x + (nx * dist) / 4 + (ny * w) / 2, p0.y + (ny * dist) / 4 - (nx * w) / 2);
        },
        function (_dist, _nx, _ny, p0, p1, pt) {
          const w = Math.sqrt(mathUtils.ptSegDistSq(p0.x, p0.y, p1.x, p1.y, pt.x, pt.y));
          (state.style as any)['startWidth'] = Math.round(w * 2) / state.view.scale - spacing;
        },
      ),
    ];
  };
}

// Shapes.js:9482
function createEdgeHandle(
  state: CellState,
  keys: string[],
  start: boolean,
  getPosition: EdgeGetPos,
  setPosition: EdgeSetPos,
): DrawioHandle {
  return handle(
    state,
    keys,
    function (_bounds) {
      const pts = state.absolutePoints;

      if (pts != null && pts.length > 0) {
        const n = pts.length - 1;

        const tr = state.view.translate;
        const s = state.view.scale;

        const p0 = (start ? pts[0] : pts[n])!;
        const p1 = (start ? pts[1] : pts[n - 1])!;
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;

        const dist = Math.sqrt(dx * dx + dy * dy);

        const pt = getPosition.call(this, dist, dx / dist, dy / dist, p0, p1);

        return new Point(pt.x / s - tr.x, pt.y / s - tr.y);
      } else {
        return null;
      }
    },
    function (_bounds, pt, me) {
      const pts = state.absolutePoints;
      const n = pts.length - 1;

      const tr = state.view.translate;
      const s = state.view.scale;

      const p0 = (start ? pts[0] : pts[n])!;
      const p1 = (start ? pts[1] : pts[n - 1])!;
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;

      const dist = Math.sqrt(dx * dx + dy * dy);
      pt.x = (pt.x + tr.x) * s;
      pt.y = (pt.y + tr.y) * s;

      setPosition.call(this, dist, dx / dist, dy / dist, p0, p1, pt, me);
    },
  );
}

function shapeOf(state: CellState): any {
  return state.shape as any;
}

// Shapes.js:9531
function createEdgeWidthHandle(state: CellState, start: boolean, spacing: number): DrawioHandle {
  return createEdgeHandle(
    state,
    ['width'],
    start,
    function (dist, nx, ny, p0) {
      const w = shapeOf(state).getEdgeWidth() * state.view.scale + spacing;

      return new Point(p0.x + (nx * dist) / 4 + (ny * w) / 2, p0.y + (ny * dist) / 4 - (nx * w) / 2);
    },
    function (_dist, _nx, _ny, p0, p1, pt) {
      const w = Math.sqrt(mathUtils.ptSegDistSq(p0.x, p0.y, p1.x, p1.y, pt.x, pt.y));
      (state.style as any)['width'] = Math.round(Math.round(w * 2) / state.view.scale - spacing);
    },
  );
}

// Shapes.js:9551 - width handles of the tapered arrow at the painted start and end of the band
function createTaperedWidthHandle(state: CellState, start: boolean, spacing: number): DrawioHandle {
  const key = start ? 'startWidth' : 'endWidth';
  const getFrame = (): { x: number; y: number; nx: number; ny: number; t: number } | null => {
    const shape = shapeOf(state);
    return shape != null && shape.getWidthHandleFrame != null ? shape.getWidthHandleFrame(start) : null;
  };

  return handle(
    state,
    [key],
    function (_bounds) {
      const f = getFrame();

      if (f != null) {
        const s = state.view.scale;
        const tr = state.view.translate;
        const sw = shapeOf(state).getStartWidth();
        const ew = shapeOf(state).getEndWidth();
        const w = ((sw + (ew - sw) * f.t) * s) / 2 + spacing;

        return new Point((f.x + f.nx * w) / s - tr.x, (f.y + f.ny * w) / s - tr.y);
      }

      return null;
    },
    function (_bounds, pt) {
      const f = getFrame();

      if (f != null) {
        const s = state.view.scale;
        const tr = state.view.translate;
        const d = ((pt.x + tr.x) * s - f.x) * f.nx + ((pt.y + tr.y) * s - f.y) * f.ny;

        // Local width at the handle and the width at the end it controls
        const w = (2 * Math.max(0, d - spacing)) / s;
        const value = start
          ? (w - shapeOf(state).getEndWidth() * f.t) / (1 - f.t)
          : (w - shapeOf(state).getStartWidth() * (1 - f.t)) / f.t;

        (state.style as any)[key] = Math.min(999, Math.max(0, Math.round(value)));
      }
    },
  );
}

/** One flexArrow width/arrow handle (Shapes.js:9625-9762, four near-identical blocks). */
function createFlexArrowHandle(state: CellState, start: boolean, arrowWidth: boolean, tol: number): DrawioHandle {
  const sizeKey = start ? STYLE_STARTSIZE : STYLE_ENDSIZE;
  const otherSizeKey = start ? STYLE_ENDSIZE : STYLE_STARTSIZE;
  const widthKey = start ? 'startWidth' : 'endWidth';
  const otherWidthKey = start ? 'endWidth' : 'startWidth';
  const sign = start ? 1 : -1;
  const keys = arrowWidth
    ? ['startWidth', 'endWidth', STYLE_STARTSIZE, STYLE_ENDSIZE]
    : ['width', STYLE_STARTSIZE, STYLE_ENDSIZE];
  const style = state.style as any;

  return createEdgeHandle(
    state,
    keys,
    start,
    function (_dist, nx, ny, p0) {
      const shape = shapeOf(state);
      const width = arrowWidth ? (start ? shape.getStartArrowWidth() : shape.getEndArrowWidth()) : shape.getEdgeWidth();
      const w = (width - shape.strokeWidth) * state.view.scale;
      const l = getNumber(state.style, sizeKey, ARROW_SIZE / 5) * 3 * state.view.scale;

      return new Point(
        p0.x + nx * (l + shape.strokeWidth * state.view.scale) + (sign * ny * w) / 2,
        p0.y + ny * (l + shape.strokeWidth * state.view.scale) - (sign * nx * w) / 2,
      );
    },
    function (_dist, nx, ny, p0, p1, pt, me) {
      const shape = shapeOf(state);
      const w = Math.sqrt(mathUtils.ptSegDistSq(p0.x, p0.y, p1.x, p1.y, pt.x, pt.y));
      const l = mathUtils.ptLineDist(p0.x, p0.y, p0.x + ny, p0.y - nx, pt.x, pt.y);

      style[sizeKey] = Math.round((l - shape.strokeWidth) / 3 / state.view.scale);

      if (arrowWidth) {
        style[widthKey] = Math.round(Math.max(0, Math.round(w * 2) - shape.getEdgeWidth()) / state.view.scale);
      } else {
        style['width'] = Math.round((w * 2) / state.view.scale);
      }

      // Applies to opposite side
      if (eventUtils.isShiftDown(evt(me)) || eventUtils.isControlDown(evt(me))) {
        style[otherSizeKey] = style[sizeKey];

        if (arrowWidth) {
          style[otherWidthKey] = style[widthKey];
        }
      }

      // Snaps to the other end's geometry
      if (!eventUtils.isAltDown(evt(me))) {
        if (Math.abs(parseFloat(style[sizeKey]) - parseFloat(style[otherSizeKey])) < tol / 6) {
          style[sizeKey] = style[otherSizeKey];
        }

        if (arrowWidth && Math.abs(parseFloat(style[widthKey]) - parseFloat(style[otherWidthKey])) < tol) {
          style[widthKey] = style[otherWidthKey];
        }
      }
    },
  );
}

/** Graph.handleFactory entries of Shapes.js (Shapes.js:9597-10298), ported shapes only. */
export const SHAPE_HANDLE_FACTORIES: Readonly<Record<string, ShapeHandleFactory>> = {
  taperedArrow: function (state) {
    const spacing = 5;

    return [createTaperedWidthHandle(state, true, spacing), createTaperedWidthHandle(state, false, spacing)];
  },
  link: function (state) {
    const spacing = 10;

    return [createEdgeWidthHandle(state, true, spacing), createEdgeWidthHandle(state, false, spacing)];
  },
  flexArrow: function (state) {
    // Do not use state.shape.startSize/endSize since it is cached
    const tol = state.view.graph.gridSize / state.view.scale;
    const handles: DrawioHandle[] = [];

    if (getValue(state.style, STYLE_STARTARROW, NONE) != NONE) {
      handles.push(createFlexArrowHandle(state, true, false, tol));
      handles.push(createFlexArrowHandle(state, true, true, tol));
    }

    if (getValue(state.style, STYLE_ENDARROW, NONE) != NONE) {
      handles.push(createFlexArrowHandle(state, false, false, tol));
      handles.push(createFlexArrowHandle(state, false, true, tol));
    }

    return handles;
  },
  swimlane: function (state) {
    const handles: DrawioHandle[] = [];

    if (isOn(state.style, STYLE_ROUNDED)) {
      const size = parseFloat(getValue(state.style, STYLE_STARTSIZE, DEFAULT_STARTSIZE));
      handles.push(createArcHandle(state, size / 2));
    }

    // Start size handle must be last item in handles for hover to work in tables (see mouse event handler in Graph)
    handles.push(
      handle(
        state,
        [STYLE_STARTSIZE],
        function (bounds) {
          const size = parseFloat(getValue(state.style, STYLE_STARTSIZE, DEFAULT_STARTSIZE));

          if (isOne(getValue(state.style, STYLE_HORIZONTAL, 1))) {
            return new Point(bounds.getCenterX(), bounds.y + Math.max(0, Math.min(bounds.height, size)));
          } else {
            return new Point(bounds.x + Math.max(0, Math.min(bounds.width, size)), bounds.getCenterY());
          }
        },
        function (bounds, pt) {
          (state.style as any)[STYLE_STARTSIZE] = isOne(getValue(this.state.style, STYLE_HORIZONTAL, 1))
            ? Math.round(Math.max(0, Math.min(bounds.height, pt.y - bounds.y)))
            : Math.round(Math.max(0, Math.min(bounds.width, pt.x - bounds.x)));
        },
        false,
        null,
        function (me) {
          const graph = graphOf(state);

          if (
            !eventUtils.isShiftDown(evt(me)) &&
            !eventUtils.isControlDown(evt(me)) &&
            (isTableRow(graph, state.cell) || isTableCell(graph, state.cell))
          ) {
            const dir = swimlaneDirection(state.style as any);
            const parent = state.cell.getParent();
            const cells = parent != null ? parent.getChildCells(true, false) : [];
            const temp = [];

            for (let i = 0; i < cells.length; i++) {
              // Finds siblings with the same direction and to set start size
              if (
                cells[i] != state.cell &&
                isDrawioSwimlane(graph, cells[i]) &&
                swimlaneDirection(graph.getCurrentCellStyle(cells[i]) as any) == dir
              ) {
                temp.push(cells[i]);
              }
            }

            graph.setCellStyles(STYLE_STARTSIZE as any, (state.style as any)[STYLE_STARTSIZE], temp);
          }
        },
      ),
    );

    return handles;
  },
  label: createArcHandleFunction(),
  ext: createArcHandleFunction(),
  rectangle: createArcHandleFunction(),
  triangle: createArcHandleFunction(),
  rhombus: createArcHandleFunction(),
  process: function (state) {
    const handles = [
      handle(
        state,
        ['size'],
        function (bounds) {
          const fixed = isFixed(this.state.style);
          const size = parseFloat(getValue(this.state.style, 'size', D.processSize));

          return fixed
            ? new Point(bounds.x + size, bounds.y + bounds.height / 4)
            : new Point(bounds.x + bounds.width * size, bounds.y + bounds.height / 4);
        },
        function (bounds, pt) {
          const fixed = isFixed(this.state.style);
          const size = fixed
            ? Math.max(0, Math.min(bounds.width * 0.5, pt.x - bounds.x))
            : Math.max(0, Math.min(0.5, (pt.x - bounds.x) / bounds.width));
          this.state.style['size'] = size;
        },
        false,
      ),
    ];

    if (isOn(state.style, STYLE_ROUNDED, false)) {
      handles.push(createArcHandle(state));
    }

    return handles;
  },
  cross: function (state) {
    return [
      handle(
        state,
        ['size'],
        function (bounds) {
          const m = Math.min(bounds.width, bounds.height);
          const size = (Math.max(0, Math.min(1, getValue(this.state.style, 'size', D.crossSize))) * m) / 2;

          return new Point(bounds.getCenterX() - size, bounds.getCenterY() - size);
        },
        function (bounds, pt) {
          const m = Math.min(bounds.width, bounds.height);
          this.state.style['size'] = Math.max(
            0,
            Math.min(
              1,
              Math.min(
                (Math.max(0, bounds.getCenterY() - pt.y) / m) * 2,
                (Math.max(0, bounds.getCenterX() - pt.x) / m) * 2,
              ),
            ),
          );
        },
      ),
    ];
  },
  note: function (state) {
    return [
      handle(
        state,
        ['size'],
        function (bounds) {
          const size = Math.max(
            0,
            Math.min(bounds.width, Math.min(bounds.height, parseFloat(getValue(this.state.style, 'size', D.noteSize)))),
          );

          return new Point(bounds.x + bounds.width - size, bounds.y + size);
        },
        function (bounds, pt) {
          this.state.style['size'] = Math.round(
            Math.max(
              0,
              Math.min(Math.min(bounds.width, bounds.x + bounds.width - pt.x), Math.min(bounds.height, pt.y - bounds.y)),
            ),
          );
        },
      ),
    ];
  },
  manualInput: function (state) {
    const handles = [
      handle(
        state,
        ['size'],
        function (bounds) {
          const size = Math.max(0, Math.min(bounds.height, getValue(this.state.style, 'size', D.manualInputSize)));

          return new Point(bounds.x + bounds.width / 4, bounds.y + (size * 3) / 4);
        },
        function (bounds, pt) {
          this.state.style['size'] = Math.round(Math.max(0, Math.min(bounds.height, ((pt.y - bounds.y) * 4) / 3)));
        },
        false,
      ),
    ];

    if (isOn(state.style, STYLE_ROUNDED, false)) {
      handles.push(createArcHandle(state));
    }

    return handles;
  },
  dataStorage: function (state) {
    return [
      handle(
        state,
        ['size'],
        function (bounds) {
          const fixed = isFixed(this.state.style);
          const size = parseFloat(
            getValue(this.state.style, 'size', fixed ? D.dataStorageFixedSize : D.dataStorageSize),
          );

          return new Point(bounds.x + bounds.width - size * (fixed ? 1 : bounds.width), bounds.getCenterY());
        },
        function (bounds, pt) {
          const fixed = isFixed(this.state.style);
          const size = fixed
            ? Math.max(0, Math.min(bounds.width, bounds.x + bounds.width - pt.x))
            : Math.max(0, Math.min(1, (bounds.x + bounds.width - pt.x) / bounds.width));

          this.state.style['size'] = size;
        },
        false,
      ),
    ];
  },
  callout: function (state) {
    const handles = [
      handle(
        state,
        ['size', 'position'],
        function (bounds) {
          const size = Math.max(0, Math.min(bounds.height, getValue(this.state.style, 'size', D.calloutSize)));
          const position = Math.max(0, Math.min(1, getValue(this.state.style, 'position', D.calloutPosition)));

          return new Point(bounds.x + position * bounds.width, bounds.y + bounds.height - size);
        },
        function (bounds, pt) {
          this.state.style['size'] = Math.round(Math.max(0, Math.min(bounds.height, bounds.y + bounds.height - pt.y)));
          this.state.style['position'] =
            Math.round(Math.max(0, Math.min(1, (pt.x - bounds.x) / bounds.width)) * 100) / 100;
        },
        false,
      ),
      handle(
        state,
        ['position2'],
        function (bounds) {
          const position2 = Math.max(0, Math.min(1, getValue(this.state.style, 'position2', D.calloutPosition2)));

          return new Point(bounds.x + position2 * bounds.width, bounds.y + bounds.height);
        },
        function (bounds, pt) {
          this.state.style['position2'] =
            Math.round(Math.max(0, Math.min(1, (pt.x - bounds.x) / bounds.width)) * 100) / 100;
        },
        false,
      ),
      handle(
        state,
        ['base'],
        function (bounds) {
          const size = Math.max(0, Math.min(bounds.height, getValue(this.state.style, 'size', D.calloutSize)));
          const position = Math.max(0, Math.min(1, getValue(this.state.style, 'position', D.calloutPosition)));
          const base = Math.max(0, Math.min(bounds.width, getValue(this.state.style, 'base', D.calloutBase)));

          return new Point(
            bounds.x + Math.min(bounds.width, position * bounds.width + base),
            bounds.y + bounds.height - size,
          );
        },
        function (bounds, pt) {
          const position = Math.max(0, Math.min(1, getValue(this.state.style, 'position', D.calloutPosition)));

          this.state.style['base'] = Math.round(
            Math.max(0, Math.min(bounds.width, pt.x - bounds.x - position * bounds.width)),
          );
        },
        false,
      ),
    ];

    if (isOn(state.style, STYLE_ROUNDED, false)) {
      handles.push(createArcHandle(state));
    }

    return handles;
  },
  wedgeCallout: function (state) {
    const handles = [
      handle(
        state,
        ['tipX', 'tipY'],
        function (bounds) {
          const tip: Point =
            this.state.shape != null && typeof this.state.shape.getTipOffset === 'function'
              ? this.state.shape.getTipOffset()
              : new Point(D.wedgeTipX, D.wedgeTipY);

          return new Point(bounds.getCenterX() + tip.x * bounds.width, bounds.getCenterY() + tip.y * bounds.height);
        },
        function (bounds, pt) {
          const max = D.wedgeMaxTipOffset;
          this.state.style['tipX'] =
            Math.round(1000 * Math.max(-max, Math.min(max, (pt.x - bounds.getCenterX()) / Math.max(1, bounds.width)))) /
            1000;
          this.state.style['tipY'] =
            Math.round(
              1000 * Math.max(-max, Math.min(max, (pt.y - bounds.getCenterY()) / Math.max(1, bounds.height))),
            ) / 1000;
        },
        false,
      ),
    ];

    if (isOn(state.style, STYLE_ROUNDED, false)) {
      handles.push(createArcHandle(state));
    }

    return handles;
  },
  internalStorage: function (state) {
    const handles = [
      handle(
        state,
        ['dx', 'dy'],
        function (bounds) {
          const dx = Math.max(0, Math.min(bounds.width, getValue(this.state.style, 'dx', D.internalStorageDx)));
          const dy = Math.max(0, Math.min(bounds.height, getValue(this.state.style, 'dy', D.internalStorageDy)));

          return new Point(bounds.x + dx, bounds.y + dy);
        },
        function (bounds, pt) {
          this.state.style['dx'] = Math.round(Math.max(0, Math.min(bounds.width, pt.x - bounds.x)));
          this.state.style['dy'] = Math.round(Math.max(0, Math.min(bounds.height, pt.y - bounds.y)));
        },
        false,
      ),
    ];

    if (isOn(state.style, STYLE_ROUNDED, false)) {
      handles.push(createArcHandle(state));
    }

    return handles;
  },
  corner: function (state) {
    return [
      handle(
        state,
        ['dx', 'dy'],
        function (bounds) {
          const dx = Math.max(0, Math.min(bounds.width, getValue(this.state.style, 'dx', D.cornerDx)));
          const dy = Math.max(0, Math.min(bounds.height, getValue(this.state.style, 'dy', D.cornerDy)));

          return new Point(bounds.x + dx, bounds.y + dy);
        },
        function (bounds, pt) {
          this.state.style['dx'] = Math.round(Math.max(0, Math.min(bounds.width, pt.x - bounds.x)));
          this.state.style['dy'] = Math.round(Math.max(0, Math.min(bounds.height, pt.y - bounds.y)));
        },
        false,
      ),
    ];
  },
  tee: function (state) {
    return [
      handle(
        state,
        ['dx', 'dy'],
        function (bounds) {
          const dx = Math.max(0, Math.min(bounds.width, getValue(this.state.style, 'dx', D.teeDx)));
          const dy = Math.max(0, Math.min(bounds.height, getValue(this.state.style, 'dy', D.teeDy)));

          return new Point(bounds.x + (bounds.width + dx) / 2, bounds.y + dy);
        },
        function (bounds, pt) {
          this.state.style['dx'] = Math.round(Math.max(0, Math.min(bounds.width / 2, pt.x - bounds.x - bounds.width / 2) * 2));
          this.state.style['dy'] = Math.round(Math.max(0, Math.min(bounds.height, pt.y - bounds.y)));
        },
        false,
      ),
    ];
  },
  singleArrow: createArrowHandleFunction(1),
  doubleArrow: createArrowHandleFunction(0.5),
  'mxgraph.arrows2.wedgeArrow': createWedgeHandleFunction(20, 20),
  'mxgraph.arrows2.wedgeArrowDashed': createWedgeHandleFunction(20, 20),
  'mxgraph.arrows2.wedgeArrowDashed2': createWedgeHandleFunction(20, 20),
  document: function (state) {
    return [
      handle(
        state,
        ['size'],
        function (bounds) {
          const size = Math.max(0, Math.min(1, parseFloat(getValue(this.state.style, 'size', D.documentSize))));

          return new Point(bounds.x + (3 * bounds.width) / 4, bounds.y + (1 - size) * bounds.height);
        },
        function (bounds, pt) {
          this.state.style['size'] = Math.max(0, Math.min(1, (bounds.y + bounds.height - pt.y) / bounds.height));
        },
        false,
      ),
    ];
  },
  tape: function (state) {
    return [
      handle(
        state,
        ['size'],
        function (bounds) {
          const size = Math.max(0, Math.min(1, parseFloat(getValue(this.state.style, 'size', D.tapeSize))));

          return new Point(bounds.getCenterX(), bounds.y + (size * bounds.height) / 2);
        },
        function (bounds, pt) {
          this.state.style['size'] = Math.max(0, Math.min(1, ((pt.y - bounds.y) / bounds.height) * 2));
        },
        false,
      ),
    ];
  },
  isoCube2: function (state) {
    return [
      handle(
        state,
        ['isoAngle'],
        function (bounds) {
          // draw.io reads the static IsoCubeShape2.isoAngle here, which is undefined (the default
          // lives on the prototype), so a cell without isoAngle has no handle position.
          const isoAngle =
            (Math.max(0.01, Math.min(94, parseFloat(getValue(this.state.style, 'isoAngle', undefined)))) * Math.PI) /
            200;
          const isoH = Math.min(bounds.width * Math.tan(isoAngle), bounds.height * 0.5);

          return new Point(bounds.x, bounds.y + isoH);
        },
        function (bounds, pt) {
          this.state.style['isoAngle'] = Math.max(0, ((pt.y - bounds.y) * 50) / bounds.height);
        },
        true,
      ),
    ];
  },
  cylinder3: createCylinderHandleFunction(D.cylinder3Size),
  offPageConnector: function (state) {
    return [
      handle(
        state,
        ['size'],
        function (bounds) {
          const size = Math.max(0, Math.min(1, parseFloat(getValue(this.state.style, 'size', D.offPageConnectorSize))));

          return new Point(bounds.getCenterX(), bounds.y + (1 - size) * bounds.height);
        },
        function (bounds, pt) {
          this.state.style['size'] = Math.max(0, Math.min(1, (bounds.y + bounds.height - pt.y) / bounds.height));
        },
        false,
      ),
    ];
  },
  'mxgraph.basic.rect': function (state) {
    const handles = [
      handle(
        state,
        ['size'],
        function (bounds) {
          // `this.size` / `this.dx2` are the handle's (undefined) fields, verbatim from draw.io
          const size = Math.max(
            0,
            Math.min(bounds.width / 2, bounds.height / 2, parseFloat(getValue(this.state.style, 'size', this.size))),
          );

          return new Point(bounds.x + size, bounds.y + size);
        },
        function (bounds, pt) {
          this.state.style['size'] =
            Math.round(100 * Math.max(0, Math.min(bounds.height / 2, bounds.width / 2, pt.x - bounds.x))) / 100;
        },
      ),
    ];

    const handle2 = handle(
      state,
      ['indent'],
      function (bounds) {
        const dx2 = Math.max(0, Math.min(100, parseFloat(getValue(this.state.style, 'indent', this.dx2))));

        return new Point(bounds.x + bounds.width * 0.75, bounds.y + (dx2 * bounds.height) / 200);
      },
      function (bounds, pt) {
        this.state.style['indent'] =
          Math.round(100 * Math.max(0, Math.min(100, (200 * (pt.y - bounds.y)) / bounds.height))) / 100;
      },
    );

    handles.push(handle2);

    return handles;
  },
  curvedText: function (state) {
    const inset = 10;

    const getYOffset = function (st: any): number {
      return (st.shape != null ? st.shape._curveYOffset : 0) || 0;
    };

    return [
      handle(
        state,
        ['arcStartY'],
        function (bounds) {
          const val = parseFloat(getValue(this.state.style, 'arcStartY', D.arcStartY));
          const yOff = getYOffset(this.state);

          return new Point(bounds.x + inset, bounds.y + Math.max(0, Math.min(bounds.height, val + yOff)));
        },
        function (bounds, pt) {
          const yOff = getYOffset(this.state);
          this.state.style['arcStartY'] = Math.round(Math.max(0, Math.min(bounds.height, pt.y - bounds.y)) - yOff);
        },
        false,
      ),
      handle(
        state,
        ['arcMidY'],
        function (bounds) {
          const startVal = parseFloat(getValue(this.state.style, 'arcStartY', D.arcStartY));
          const endVal = parseFloat(getValue(this.state.style, 'arcEndY', D.arcEndY));
          const midOffset = parseFloat(getValue(this.state.style, 'arcMidY', D.arcMidY));
          const chordMidY = (startVal + endVal) / 2;
          const yOff = getYOffset(this.state);

          return new Point(
            bounds.x + bounds.width / 2 + 10,
            bounds.y + Math.max(0, Math.min(bounds.height, chordMidY + midOffset + yOff)),
          );
        },
        function (bounds, pt) {
          const startVal = parseFloat(getValue(this.state.style, 'arcStartY', D.arcStartY));
          const endVal = parseFloat(getValue(this.state.style, 'arcEndY', D.arcEndY));
          const chordMidY = (startVal + endVal) / 2;
          const yOff = getYOffset(this.state);
          const defaultMid = Math.abs(D.arcMidY);
          const maxMid = Math.max(defaultMid, Math.min(chordMidY, bounds.height - chordMidY));
          this.state.style['arcMidY'] = Math.round(
            Math.max(-maxMid, Math.min(maxMid, pt.y - bounds.y - yOff - chordMidY)),
          );
        },
        false,
      ),
      handle(
        state,
        ['arcEndY'],
        function (bounds) {
          const val = parseFloat(getValue(this.state.style, 'arcEndY', D.arcEndY));
          const yOff = getYOffset(this.state);

          return new Point(bounds.x + bounds.width - inset, bounds.y + Math.max(0, Math.min(bounds.height, val + yOff)));
        },
        function (bounds, pt) {
          const yOff = getYOffset(this.state);
          this.state.style['arcEndY'] = Math.round(Math.max(0, Math.min(bounds.height, pt.y - bounds.y)) - yOff);
        },
        false,
      ),
    ];
  },
  step: createDisplayHandleFunction(D.stepSize, true, null, true, D.stepFixedSize),
  hexagon: createDisplayHandleFunction(D.hexagonSize, true, 0.5, true, D.hexagonFixedSize),
  curlyBracket: createDisplayHandleFunction(D.curlyBracketSize, false),
  display: createDisplayHandleFunction(D.displaySize, false),
  cube: createCubeHandleFunction(1, D.cubeSize, false),
  card: createCubeHandleFunction(0.5, D.cardSize, true),
  loopLimit: createCubeHandleFunction(0.5, D.loopLimitSize, true),
  trapezoid: createTrapezoidHandleFunction(0.5, D.trapezoidSize, D.trapezoidFixedSize),
  parallelogram: createTrapezoidHandleFunction(1, D.parallelogramSize, D.parallelogramFixedSize),
  zigzag: function (state) {
    // Handle at 2nd peak, half sensitivity (factor 3 = 1.5 for 2nd peak * 2 for half)
    return [
      handle(
        state,
        ['size'],
        function (bounds) {
          const size = Math.max(5, parseFloat(getValue(this.state.style, 'size', D.zigzagSize)));

          return new Point(bounds.x + 3 * size, bounds.y);
        },
        function (bounds, pt) {
          this.state.style['size'] = Math.max(5, Math.round((pt.x - bounds.x) / 3));
        },
        false,
      ),
    ];
  },
};
