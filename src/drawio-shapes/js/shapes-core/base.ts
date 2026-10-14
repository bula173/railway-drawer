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
 * Base classes mirroring the draw.io (mxGraph) shape hierarchy as patched by
 * jgraph/drawio v32.4.1 src/main/webapp/js/grapheditor/Shapes.js:
 * mxActor -> ActorShape, mxCylinder -> CylinderShape (with the getCylinderSize /
 * getLabelMargins overrides of Shapes.js:1926-1952), mxRectangleShape -> RectangleShape,
 * mxEllipse -> EllipseShape, mxRhombus -> RhombusShape (double style, Shapes.js:2838-2884),
 * plus draw.io's connection-constraint protocol (`constraints` / `getConstraints`).
 */

import {
  ActorShape,
  CellRenderer,
  ConnectionConstraint,
  CylinderShape,
  EllipseShape,
  Point,
  Rectangle,
  RectangleShape,
  RhombusShape,
  Shape,
  type CellState,
} from '@maxgraph/core';
import {
  ACTOR_CONSTRAINTS,
  CYLINDER_CONSTRAINTS,
  ELLIPSE_CONSTRAINTS,
  RECTANGLE_CONSTRAINTS,
  NONE,
  flag,
  isPainted,
  lineArcSize,
  num,
  type Canvas,
  type StyleMap,
} from './util';

/** draw.io's connection point protocol (Graph.getAllConnectionConstraints, Graph.js:23647). */
export interface DrawioConstrainedShape {
  /** Static connection points (draw.io `shape.prototype.constraints`). null = none defined. */
  constraints: ConnectionConstraint[] | null;
  /** Size dependent connection points; null means "use `constraints`". */
  getConstraints(style: StyleMap, w: number, h: number): ConnectionConstraint[] | null;
}

/** Shape.style as a plain map. */
function s(shape: Shape): StyleMap {
  return shape.style as StyleMap;
}

/** mxShape (draw.io). */
export class DrawioShape extends Shape implements DrawioConstrainedShape {
  constraints: ConnectionConstraint[] | null = null;

  constructor() {
    super();
  }

  get sv(): StyleMap {
    return s(this);
  }

  getConstraints(_style: StyleMap, _w: number, _h: number): ConnectionConstraint[] | null {
    return null;
  }
}

/** mxActor (draw.io). Shapes.js:10939 sets its default constraints. */
export class DrawioActor extends ActorShape implements DrawioConstrainedShape {
  constraints: ConnectionConstraint[] | null = ACTOR_CONSTRAINTS;

  constructor() {
    super();
  }

  get sv(): StyleMap {
    return s(this);
  }

  getConstraints(_style: StyleMap, _w: number, _h: number): ConnectionConstraint[] | null {
    return null;
  }

  override paintVertexShape(c: Canvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);
    c.begin();
    this.redrawPath(c, x, y, w, h);
    c.fillAndStroke();
  }

  override redrawPath(c: Canvas, x: number, y: number, w: number, h: number): void {
    super.redrawPath(c as never, x, y, w, h);
  }

  /** draw.io's addPoints with the style arc size, a frequent pattern in Shapes.js. */
  protected addRoundedPoints(c: Canvas, pts: Point[], close: boolean, exclude?: number[]): void {
    this.addPoints(c, pts, this.isRounded, lineArcSize(this.sv), close, exclude ?? []);
  }
}

/**
 * mxCylinder (draw.io) including the overrides in Shapes.js:1926-1952 (size style for the
 * cylinder height, bounded label margins) and the constraints from Shapes.js:10908.
 */
export class DrawioCylinder extends CylinderShape implements DrawioConstrainedShape {
  constraints: ConnectionConstraint[] | null = CYLINDER_CONSTRAINTS;

  constructor() {
    super(null as unknown as Rectangle, NONE, NONE);
  }

  get sv(): StyleMap {
    return s(this);
  }

  getConstraints(_style: StyleMap, _w: number, _h: number): ConnectionConstraint[] | null {
    return null;
  }

  /** Shapes.js:1928 */
  override getCylinderSize(x: number, y: number, w: number, h: number): number {
    const size = this.sv?.size;

    if (size !== undefined && size !== null) {
      return h * Math.max(0, Math.min(1, num(this.sv, 'size', 0)));
    }

    return super.getCylinderSize(x, y, w, h);
  }

  /** Shapes.js:1942 */
  override getLabelMargins(rect: Rectangle | null): Rectangle | null {
    if (rect && flag(this.sv, 'boundedLbl', false)) {
      const size = num(this.sv, 'size', 0.15) * 2;

      return new Rectangle(0, Math.min(this.maxHeight * this.scale, rect.height * size), 0, 0);
    }

    return null;
  }

  /** draw.io tests `this.fill != null`; maxGraph uses the 'none' constant. */
  protected get filled(): boolean {
    return isPainted(this.fill);
  }
}

/** mxRectangleShape (draw.io), constraints from Shapes.js:10672. */
export class DrawioRectangle extends RectangleShape implements DrawioConstrainedShape {
  constraints: ConnectionConstraint[] | null = RECTANGLE_CONSTRAINTS;

  constructor() {
    super(null as unknown as Rectangle, NONE, NONE);
  }

  get sv(): StyleMap {
    return s(this);
  }

  getConstraints(_style: StyleMap, _w: number, _h: number): ConnectionConstraint[] | null {
    return null;
  }
}

/** mxEllipse (draw.io), constraints from Shapes.js:10688. */
export class DrawioEllipse extends EllipseShape implements DrawioConstrainedShape {
  constraints: ConnectionConstraint[] | null = ELLIPSE_CONSTRAINTS;

  constructor() {
    super(null as unknown as Rectangle, NONE, NONE);
  }

  get sv(): StyleMap {
    return s(this);
  }

  getConstraints(_style: StyleMap, _w: number, _h: number): ConnectionConstraint[] | null {
    return null;
  }
}

/**
 * mxRhombus (draw.io) with the double style of Shapes.js:2838-2884; constraints from
 * Shapes.js:10984 (same as mxEllipse).
 */
export class DrawioRhombus extends RhombusShape implements DrawioConstrainedShape {
  constraints: ConnectionConstraint[] | null = ELLIPSE_CONSTRAINTS;

  constructor() {
    super(null as unknown as Rectangle, NONE, NONE);
  }

  get sv(): StyleMap {
    return s(this);
  }

  getConstraints(_style: StyleMap, _w: number, _h: number): ConnectionConstraint[] | null {
    return null;
  }

  private isDouble(): boolean {
    return this.sv != null && num(this.sv, 'double', 0) === 1;
  }

  /** Shapes.js:2840 */
  override getLabelBounds(rect: Rectangle): Rectangle {
    if (this.isDouble()) {
      const margin = (Math.max(2, this.strokeWidth + 1) * 2 + num(this.sv, 'margin', 0)) * this.scale;

      return new Rectangle(rect.x + margin, rect.y + margin, rect.width - 2 * margin, rect.height - 2 * margin);
    }

    return rect;
  }

  /** Shapes.js:2853 */
  override paintVertexShape(c: Canvas, x: number, y: number, w: number, h: number): void {
    super.paintVertexShape(c, x, y, w, h);

    if (!this.outline && this.isDouble()) {
      const margin = Math.max(2, this.strokeWidth + 1) * 2 + num(this.sv, 'margin', 0);
      const iw = w - 2 * margin;
      const ih = h - 2 * margin;

      if (iw > 0 && ih > 0) {
        c.setShadow(false);
        super.paintVertexShape(c, x + margin, y + margin, iw, ih);
      }
    }
  }
}

/**
 * Returns the connection points of a draw.io port the way Graph.getAllConnectionConstraints
 * (Graph.js:23647) does: the `points` style, then getConstraints(style, w, h) (w/h swapped for
 * north/south), then stencil constraints, then `shape.constraints`. Integration can install this
 * as graph.getAllConnectionConstraints.
 */
export function getDrawioConnectionConstraints(terminal: CellState | null): ConnectionConstraint[] | null {
  if (!terminal) return null;

  const style = terminal.style as StyleMap;
  const points = style?.points;

  if (points !== undefined && points !== null) {
    const result: ConnectionConstraint[] = [];

    try {
      const list = JSON.parse(String(points)) as number[][];

      for (const tmp of list) {
        result.push(
          new ConnectionConstraint(
            new Point(tmp[0], tmp[1]),
            tmp.length > 2 ? tmp[2] !== 0 : true,
            null,
            tmp.length > 3 ? tmp[3] : 0,
            tmp.length > 4 ? tmp[4] : 0
          )
        );
      }
    } catch {
      // ignore, as draw.io does
    }

    return result;
  }

  const shape = terminal.shape as (Shape & Partial<DrawioConstrainedShape>) | null;

  if (shape && shape.bounds) {
    const dir = shape.direction;
    let w = shape.bounds.width / shape.scale;
    let h = shape.bounds.height / shape.scale;

    if (dir === 'north' || dir === 'south') {
      const tmp = w;
      w = h;
      h = tmp;
    }

    const constraints = typeof shape.getConstraints === 'function' ? shape.getConstraints(style, w, h) : null;

    if (constraints) return constraints;
    if (shape.stencil?.constraints) return shape.stencil.constraints;
    if (shape.constraints) return shape.constraints;
  }

  return null;
}

/** Looks up a registered shape constructor (mxCellRenderer.defaultShapes). */
export function getDefaultShape(name: string): typeof Shape | undefined {
  const shapes = (CellRenderer as unknown as { defaultShapes: Record<string, typeof Shape> }).defaultShapes;

  return Object.prototype.hasOwnProperty.call(shapes, name) ? shapes[name] : undefined;
}
