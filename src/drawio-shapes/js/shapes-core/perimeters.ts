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
 * Perimeters ported from jgraph/drawio v32.4.1 src/main/webapp/js/grapheditor/Shapes.js
 * (centerPerimeter:3785, backbonePerimeter:4061, calloutPerimeter:4099,
 * parallelogramPerimeter:4110, trapezoidPerimeter:4173, stepPerimeter:4246,
 * hexagonPerimeter2:4323, mermaidPersonPerimeter:8894).
 */

import {
  Perimeter,
  Point,
  Rectangle,
  mathUtils,
  type CellState,
  type PerimeterFunction,
} from '@maxgraph/core';
import {
  CalloutShape,
  HexagonShape,
  MermaidPersonShape,
  ParallelogramShape,
  StepShape,
  TrapezoidShape,
} from './shapes';
import { flag, num, str, type StyleMap } from './util';

function styleOf(vertex: CellState | null | undefined): StyleMap {
  return (vertex?.style ?? null) as StyleMap;
}

function scaleOf(vertex: CellState | null | undefined): number {
  return vertex?.view?.scale ?? 1;
}

/** Shared tail of the polygon perimeters: orthogonal projection then mxUtils.getPerimeterPoint. */
function polygonPoint(points: Point[], bounds: Rectangle, next: Point, orthogonal: boolean): Point | null {
  const x = bounds.x;
  const w = bounds.width;
  const p1 = new Point(bounds.getCenterX(), bounds.getCenterY());

  if (orthogonal) {
    if (next.x < x || next.x > x + w) {
      p1.y = next.y;
    } else {
      p1.x = next.x;
    }
  }

  return mathUtils.getPerimeterPoint(points, p1, next);
}

/** Reads `size` the way the draw.io perimeters do (fixed sizes are scaled by the view). */
function perimeterSize(vertex: CellState, fixedDefault: number, relDefault: number): { fixed: boolean; size: number } {
  const style = styleOf(vertex);
  const fixed = flag(style, 'fixedSize', false);
  let size = num(style, 'size', fixed ? fixedDefault : relDefault);

  if (fixed) {
    size *= scaleOf(vertex);
  }

  return { fixed, size };
}

/** Shapes.js:3785 */
export const CenterPerimeter: PerimeterFunction = (bounds) => new Point(bounds.getCenterX(), bounds.getCenterY());

/** Shapes.js:4061 */
export const BackbonePerimeter: PerimeterFunction = (bounds, vertex, next) => {
  const style = styleOf(vertex);
  const view = vertex.view as unknown as { getPixelSize?: () => number; scale: number };
  const px = typeof view.getPixelSize === 'function' ? view.getPixelSize() : 1;
  let sw = (num(style, 'strokeWidth', 1) * view.scale) / 2 - px;

  if (style?.backboneSize != null) {
    sw += (num(style, 'backboneSize', 0) * view.scale) / 2 - px;
  }

  const direction = str(style, 'direction', '');

  if (direction == 'south' || direction == 'north') {
    if (next.x < bounds.getCenterX()) {
      sw += px;
      sw *= -1;
    }

    return new Point(bounds.getCenterX() + sw, Math.min(bounds.y + bounds.height, Math.max(bounds.y, next.y)));
  }

  if (next.y < bounds.getCenterY()) {
    sw += px;
    sw *= -1;
  }

  return new Point(Math.min(bounds.x + bounds.width, Math.max(bounds.x, next.x)), bounds.getCenterY() + sw);
};

/** Shapes.js:4099 */
export const CalloutPerimeter: PerimeterFunction = (bounds, vertex, next, orthogonal) => {
  const style = styleOf(vertex);
  const size = Math.max(0, Math.min(bounds.height, num(style, 'size', CalloutShape.defaultSize) * scaleOf(vertex)));
  const directed = mathUtils.getDirectedBounds(
    bounds,
    new Rectangle(0, 0, 0, size),
    vertex.style,
    flag(style, 'flipH', false),
    flag(style, 'flipV', false)
  );

  return Perimeter.RectanglePerimeter(directed, vertex, next, orthogonal);
};

/** Shapes.js:4110 */
export const ParallelogramPerimeter: PerimeterFunction = (bounds, vertex, next, orthogonal) => {
  const { fixed, size } = perimeterSize(vertex, ParallelogramShape.defaultFixedSize, ParallelogramShape.defaultSize);
  const { x, y, width: w, height: h } = bounds;
  const direction = str(styleOf(vertex), 'direction', 'east');
  const vertical = direction == 'north' || direction == 'south';
  let points: Point[];

  if (vertical) {
    const dy = fixed ? Math.max(0, Math.min(h, size)) : h * Math.max(0, Math.min(1, size));
    points = [new Point(x, y), new Point(x + w, y + dy), new Point(x + w, y + h), new Point(x, y + h - dy), new Point(x, y)];
  } else {
    const dx = fixed ? Math.max(0, Math.min(w * 0.5, size)) : w * Math.max(0, Math.min(1, size));
    points = [new Point(x + dx, y), new Point(x + w, y), new Point(x + w - dx, y + h), new Point(x, y + h), new Point(x + dx, y)];
  }

  return polygonPoint(points, bounds, next, orthogonal);
};

/** Shapes.js:4173 */
export const TrapezoidPerimeter: PerimeterFunction = (bounds, vertex, next, orthogonal) => {
  const { fixed, size } = perimeterSize(vertex, TrapezoidShape.defaultFixedSize, TrapezoidShape.defaultSize);
  const { x, y, width: w, height: h } = bounds;
  const direction = str(styleOf(vertex), 'direction', 'east');
  let points: Point[];

  if (direction == 'east') {
    const dx = fixed ? Math.max(0, Math.min(w * 0.5, size)) : w * Math.max(0, Math.min(1, size));
    points = [new Point(x + dx, y), new Point(x + w - dx, y), new Point(x + w, y + h), new Point(x, y + h), new Point(x + dx, y)];
  } else if (direction == 'west') {
    const dx = fixed ? Math.max(0, Math.min(w, size)) : w * Math.max(0, Math.min(1, size));
    points = [new Point(x, y), new Point(x + w, y), new Point(x + w - dx, y + h), new Point(x + dx, y + h), new Point(x, y)];
  } else if (direction == 'north') {
    const dy = fixed ? Math.max(0, Math.min(h, size)) : h * Math.max(0, Math.min(1, size));
    points = [new Point(x, y + dy), new Point(x + w, y), new Point(x + w, y + h), new Point(x, y + h - dy), new Point(x, y + dy)];
  } else {
    const dy = fixed ? Math.max(0, Math.min(h, size)) : h * Math.max(0, Math.min(1, size));
    points = [new Point(x, y), new Point(x + w, y + dy), new Point(x + w, y + h - dy), new Point(x, y + h), new Point(x, y)];
  }

  return polygonPoint(points, bounds, next, orthogonal);
};

/** Shapes.js:4246 */
export const StepPerimeter: PerimeterFunction = (bounds, vertex, next, orthogonal) => {
  const { fixed, size } = perimeterSize(vertex, StepShape.defaultFixedSize, StepShape.defaultSize);
  const { x, y, width: w, height: h } = bounds;
  const cx = bounds.getCenterX();
  const cy = bounds.getCenterY();
  const direction = str(styleOf(vertex), 'direction', 'east');
  let points: Point[];

  if (direction == 'east') {
    const dx = fixed ? Math.max(0, Math.min(w, size)) : w * Math.max(0, Math.min(1, size));
    points = [
      new Point(x, y), new Point(x + w - dx, y), new Point(x + w, cy),
      new Point(x + w - dx, y + h), new Point(x, y + h), new Point(x + dx, cy), new Point(x, y),
    ];
  } else if (direction == 'west') {
    const dx = fixed ? Math.max(0, Math.min(w, size)) : w * Math.max(0, Math.min(1, size));
    points = [
      new Point(x + dx, y), new Point(x + w, y), new Point(x + w - dx, cy),
      new Point(x + w, y + h), new Point(x + dx, y + h), new Point(x, cy), new Point(x + dx, y),
    ];
  } else if (direction == 'north') {
    const dy = fixed ? Math.max(0, Math.min(h, size)) : h * Math.max(0, Math.min(1, size));
    points = [
      new Point(x, y + dy), new Point(cx, y), new Point(x + w, y + dy),
      new Point(x + w, y + h), new Point(cx, y + h - dy), new Point(x, y + h), new Point(x, y + dy),
    ];
  } else {
    const dy = fixed ? Math.max(0, Math.min(h, size)) : h * Math.max(0, Math.min(1, size));
    points = [
      new Point(x, y), new Point(cx, y + dy), new Point(x + w, y),
      new Point(x + w, y + h - dy), new Point(cx, y + h), new Point(x, y + h - dy), new Point(x, y),
    ];
  }

  return polygonPoint(points, bounds, next, orthogonal);
};

/** Shapes.js:4323 */
export const HexagonPerimeter2: PerimeterFunction = (bounds, vertex, next, orthogonal) => {
  const { fixed, size } = perimeterSize(vertex, HexagonShape.defaultFixedSize, HexagonShape.defaultSize);
  const { x, y, width: w, height: h } = bounds;
  const cx = bounds.getCenterX();
  const cy = bounds.getCenterY();
  const direction = str(styleOf(vertex), 'direction', 'east');
  const vertical = direction == 'north' || direction == 'south';
  let points: Point[];

  if (vertical) {
    const dy = fixed ? Math.max(0, Math.min(h, size)) : h * Math.max(0, Math.min(1, size));
    points = [
      new Point(cx, y), new Point(x + w, y + dy), new Point(x + w, y + h - dy),
      new Point(cx, y + h), new Point(x, y + h - dy), new Point(x, y + dy), new Point(cx, y),
    ];
  } else {
    const dx = fixed ? Math.max(0, Math.min(w, size)) : w * Math.max(0, Math.min(1, size));
    points = [
      new Point(x + dx, y), new Point(x + w - dx, y), new Point(x + w, cy),
      new Point(x + w - dx, y + h), new Point(x + dx, y + h), new Point(x, cy), new Point(x + dx, y),
    ];
  }

  return polygonPoint(points, bounds, next, orthogonal);
};

/** Shapes.js:8894 */
export const MermaidPersonPerimeter: PerimeterFunction = (bounds, vertex, next, orthogonal) => {
  const s = scaleOf(vertex);
  const g = MermaidPersonShape.getGeometry(bounds.width / s, bounds.height / s);
  const { x, y, width: w, height: h } = bounds;
  const r = g.headRadius * s;
  const top = y + g.bodyTop * s;
  const br = g.bodyRadius * s;
  const cx = x + w / 2;
  const cy = y + r;
  const points: Point[] = [];

  // Angles in degrees, clockwise from the positive x-axis as y points down
  const arc = (acx: number, acy: number, ar: number, from: number, to: number, n: number) => {
    for (let i = 0; i <= n; i++) {
      const a = ((from + ((to - from) * i) / n) * Math.PI) / 180;
      points.push(new Point(acx + ar * Math.cos(a), acy + ar * Math.sin(a)));
    }
  };

  // Where the head meets the top of the body
  const join = (Math.asin(Math.max(-1, Math.min(1, (top - cy) / r))) * 180) / Math.PI;

  arc(cx, cy, r, 180 - join, 360 + join, 24);
  arc(x + w - br, top + br, br, 270, 360, 6);
  arc(x + w - br, y + h - br, br, 0, 90, 6);
  arc(x + br, y + h - br, br, 90, 180, 6);
  arc(x + br, top + br, br, 180, 270, 6);
  points.push(points[0]);

  return polygonPoint(points, bounds, next, orthogonal);
};

/** draw.io style name -> perimeter function (mxStyleRegistry.putValue names). */
export const SHAPES_CORE_PERIMETERS: Record<string, PerimeterFunction> = {
  centerPerimeter: CenterPerimeter,
  backbonePerimeter: BackbonePerimeter,
  calloutPerimeter: CalloutPerimeter,
  parallelogramPerimeter: ParallelogramPerimeter,
  trapezoidPerimeter: TrapezoidPerimeter,
  stepPerimeter: StepPerimeter,
  hexagonPerimeter2: HexagonPerimeter2,
  mermaidPersonPerimeter: MermaidPersonPerimeter,
};

/** draw.io style name -> mxPerimeter property name. */
export const SHAPES_CORE_PERIMETER_PROPERTY: Record<string, string> = {
  centerPerimeter: 'CenterPerimeter',
  backbonePerimeter: 'BackbonePerimeter',
  calloutPerimeter: 'CalloutPerimeter',
  parallelogramPerimeter: 'ParallelogramPerimeter',
  trapezoidPerimeter: 'TrapezoidPerimeter',
  stepPerimeter: 'StepPerimeter',
  hexagonPerimeter2: 'HexagonPerimeter2',
  mermaidPersonPerimeter: 'MermaidPersonPerimeter',
};
