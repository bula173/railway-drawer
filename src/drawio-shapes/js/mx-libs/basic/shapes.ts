/**
 * Copyright (c) 2006-2018, JGraph Holdings Ltd
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG
 * Licensed under the Apache License, Version 2.0 (see NOTICE).
 *
 * Ported from jgraph/drawio v32.4.1 shapes/mxBasic.js
 * Source: https://raw.githubusercontent.com/jgraph/drawio/v32.4.1/src/main/webapp/shapes/mxBasic.js
 *
 * Mechanical port to @maxgraph/core 0.10.3: mxActor -> ActorShape, mxArrow -> ArrowShape,
 * mxUtils.getValue -> getValue (same semantics), mxPoint/mxRectangle/mxConnectionConstraint ->
 * Point/Rectangle/ConnectionConstraint, this.strokewidth -> this.strokeWidth. Drawing code is unchanged.
 */

import { ActorShape, ConnectionConstraint, MarkerShape, Point, Rectangle, constants } from '@maxgraph/core';
import { getNumber, getValue, type CustomProperty, type DrawioCanvas, type ShapeCtor } from '../compat.js';

const DEFAULT_MARKERSIZE = constants.DEFAULT_MARKERSIZE;

/** draw.io shapes/mxBasic.js:10 (mxgraph.basic.cross2) */
export class mxShapeBasicCross extends ActorShape {
  static readonly cst = {CROSS : 'mxgraph.basic.cross2'} as const;
  constraints: ConnectionConstraint[] | null = null;
  dx = 0.5;

  /** draw.io shapes/mxBasic.js:32 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));

    c.begin();
    c.moveTo(w * 0.5 + dx, 0);
    c.lineTo(w * 0.5 + dx, h * 0.5 - dx);
    c.lineTo(w, h * 0.5 - dx);
    c.lineTo(w, h * 0.5 + dx);
    c.lineTo(w * 0.5 + dx, h * 0.5 + dx);
    c.lineTo(w * 0.5 + dx, h);
    c.lineTo(w * 0.5 - dx, h);
    c.lineTo(w * 0.5 - dx, h * 0.5 + dx);
    c.lineTo(0, h * 0.5 + dx);
    c.lineTo(0, h * 0.5 - dx);
    c.lineTo(w * 0.5 - dx, h * 0.5 - dx);
    c.lineTo(w * 0.5 - dx, 0);
    c.close();
    c.fillAndStroke();
  }
}

/** draw.io shapes/mxBasic.js:80 (mxgraph.basic.rectCallout) */
export class mxShapeBasicRectCallout extends ActorShape {
  static readonly cst = {RECT_CALLOUT : 'mxgraph.basic.rectCallout'} as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx', dispName: 'Callout Position', type: 'float', min:0, defVal:30},
    {name: 'dy', dispName: 'Callout Size', type: 'float', min:0, defVal:15},
    {name: 'boundedLbl', dispName: 'Bounded Label', type: 'bool', defVal: false}
  ];
  dy = 0.5;
  dx = 0.5;

  /** draw.io shapes/mxBasic.js:109 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    const dy = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy', this.dy))));

    c.begin();
    c.moveTo(dx - dy * 0.5, h - dy);
    c.lineTo(0, h - dy);
    c.lineTo(0, 0);
    c.lineTo(w, 0);
    c.lineTo(w, h - dy);
    c.lineTo(dx + dy * 0.5, h - dy);
    c.lineTo(dx - dy, h);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxBasic.js:128 */
  override getLabelMargins(): Rectangle | null {
    if (getValue(this.style, 'boundedLbl', false))
    {
      return new Rectangle(0, 0, 0, parseFloat(getValue(this.style, 'dy', this.dy)) * this.scale);
    }

    return null;
  }

  /** draw.io shapes/mxBasic.js:158 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    const dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    const dy = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy', this.dy))));

    constr.push(new ConnectionConstraint(new Point(0, 0), false));
    constr.push(new ConnectionConstraint(new Point(0.25, 0), false));
    constr.push(new ConnectionConstraint(new Point(0.5, 0), false));
    constr.push(new ConnectionConstraint(new Point(0.75, 0), false));
    constr.push(new ConnectionConstraint(new Point(1, 0), false));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w, (h - dy) * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w, h - dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx - dy, h));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, h - dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, (h - dy) * 0.5));

    return (constr);
  }
}

/** draw.io shapes/mxBasic.js:184 (mxgraph.basic.roundRectCallout) */
export class mxShapeBasicRoundRectCallout extends ActorShape {
  static readonly cst = {ROUND_RECT_CALLOUT : 'mxgraph.basic.roundRectCallout'} as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'size', dispName: 'Arc Size', type: 'float', min:0, defVal:5},
    {name: 'dx', dispName: 'Callout Position', type: 'float', min:0, defVal:30},
    {name: 'dy', dispName: 'Callout Size', type: 'float', min:0, defVal:15},
    {name: 'boundedLbl', dispName: 'Bounded Label', type: 'bool', defVal: false}
  ];
  constraints: ConnectionConstraint[] | null = null;
  dy = 0.5;
  dx = 0.5;
  size = 10;

  /** draw.io shapes/mxBasic.js:203 (mxShapeBasicRectCallout.prototype.getLabelMargins) */
  override getLabelMargins(_rect: Rectangle): Rectangle | null {
    return mxShapeBasicRectCallout.prototype.getLabelMargins.call(this);
  }

  /** draw.io shapes/mxBasic.js:217 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    let dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    const dy = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy', this.dy))));
    let r = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'size', this.size))));

    r = Math.min((h - dy) / 2, w / 2, r);
    dx = Math.max(r + dy * 0.5, dx);
    dx = Math.min(w - r - dy * 0.5, dx);

    c.begin();
    c.moveTo(dx - dy * 0.5, h - dy);
    c.lineTo(r, h - dy);
    c.arcTo(r, r, 0, 0, 1, 0, h - dy - r);
    c.lineTo(0, r);
    c.arcTo(r, r, 0, 0, 1, r, 0);
    c.lineTo(w - r, 0);
    c.arcTo(r, r, 0, 0, 1, w, r);
    c.lineTo(w, h - dy - r);
    c.arcTo(r, r, 0, 0, 1, w - r, h - dy);
    c.lineTo(dx + dy * 0.5, h - dy);
    c.arcTo(1.9 * dy, 1.4 * dy, 0, 0, 1, dx - dy, h);
    c.arcTo(0.9 * dy, 1.4 * dy, 0, 0, 0, dx - dy * 0.5, h - dy);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxBasic.js:275 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    let dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    const dy = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy', this.dy))));
    let r = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'size', this.size))));

    r = Math.min((h - dy) / 2, w / 2, r);
    dx = Math.max(r + dy * 0.5, dx);
    dx = Math.min(w - r - dy * 0.5, dx);

    if (r < w * 0.25)
    {
      constr.push(new ConnectionConstraint(new Point(0.25, 0), false));
      constr.push(new ConnectionConstraint(new Point(0.75, 0), false));
    }

    if (r < (h - dy) * 0.25)
    {
      constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w, (h - dy) * 0.25));
      constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w, (h - dy) * 0.75));
      constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, (h - dy) * 0.25));
      constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, (h - dy) * 0.75));
    }

    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, r * 0.293, r * 0.293));
    constr.push(new ConnectionConstraint(new Point(0.5, 0), false));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - r * 0.293, r * 0.293));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w, (h - dy) * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, (h - dy) * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - r * 0.293, h - dy - r * 0.293));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, r * 0.293, h - dy - r * 0.293));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx - dy, h));

    return (constr);
  }
}

/** draw.io shapes/mxBasic.js:318 (mxgraph.basic.wave2) */
export class mxShapeBasicWave extends ActorShape {
  static readonly cst = {WAVE : 'mxgraph.basic.wave2'} as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dy', dispName: 'Wave Size', type: 'float', min:0, max:1, defVal: 0.3}
  ];
  constraints: ConnectionConstraint[] | null = null;
  dy = 0.5;

  /** draw.io shapes/mxBasic.js:344 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const dy = h * Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy', this.dy))));
    const fy = 1.4

    c.begin();
    c.moveTo(0, dy / 2);
    c.quadTo(w / 6, dy * (1 - fy), w / 3, dy / 2);
    c.quadTo(w / 2, dy * fy, w * 2 / 3, dy / 2);
    c.quadTo(w * 5 / 6, dy * (1 - fy), w, dy / 2);
    c.lineTo(w, h - dy / 2);
    c.quadTo(w * 5 / 6, h - dy * fy, w * 2 / 3, h - dy / 2);
    c.quadTo(w / 2, h - dy * (1 - fy), w / 3, h - dy / 2);
    c.quadTo(w / 6, h - dy * fy, 0, h - dy / 2);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxBasic.js:383 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    const dy = h * Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy', this.dy))));
    // unused upstream: let fy = 1.4

    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, dy * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w / 6, h * 0.015));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w / 3, dy * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5, dy * 0.95));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.67, dy * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.83, h * 0.015));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w, dy * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w, h * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w, h - dy * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.83, h - dy * 0.95));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.67, h - dy * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5, h - dy * 0.04));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w / 3, h - dy * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w / 6, h - dy * 0.95));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, h - dy * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, h * 0.5));

    return (constr);
  }
}

/** draw.io shapes/mxBasic.js:415 (mxgraph.basic.octagon2) */
export class mxShapeBasicOctagon extends ActorShape {
  static readonly cst = {OCTAGON : 'mxgraph.basic.octagon2'} as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx', dispName: 'Cutoff Size', type: 'float', min:0, defVal:15}
  ];
  constraints: ConnectionConstraint[] | null = null;
  dx = 0.5;

  /** draw.io shapes/mxBasic.js:441 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    let dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx)))) * 2;

    dx = Math.min(w * 0.5, h * 0.5, dx);

    c.begin();
    c.moveTo(dx, 0);
    c.lineTo(w - dx, 0);
    c.lineTo(w, dx);
    c.lineTo(w, h - dx);
    c.lineTo(w - dx, h);
    c.lineTo(dx, h);
    c.lineTo(0, h - dx);
    c.lineTo(0, dx);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxBasic.js:481 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    let dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx)))) * 2;

    dx = Math.min(w * 0.5, h * 0.5, dx) * 0.5;

    constr.push(new ConnectionConstraint(new Point(0.5, 0), false));
    constr.push(new ConnectionConstraint(new Point(0.5, 1), false));
    constr.push(new ConnectionConstraint(new Point(0, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(1, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx, dx));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, dx));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, h - dx));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx, h - dx));

    return (constr);
  }
}

/** draw.io shapes/mxBasic.js:506 (mxgraph.basic.isocube) */
export class mxShapeBasicIsoCube extends ActorShape {
  static readonly cst = {ISO_CUBE : 'mxgraph.basic.isocube'} as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'isoAngle', dispName: 'Perspective Angle', type: 'float', min:0, defVal:15}
  ];
  constraints: ConnectionConstraint[] | null = null;
  isoAngle = 15;

  /** draw.io shapes/mxBasic.js:532 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const isoAngle = Math.max(0.01, Math.min(94, parseFloat(getValue(this.style, 'isoAngle', this.isoAngle)))) * Math.PI / 200 ;
    const isoH = Math.min(w * Math.tan(isoAngle), h * 0.5);

    c.begin();
    c.moveTo(w * 0.5, 0);
    c.lineTo(w, isoH);
    c.lineTo(w, h - isoH);
    c.lineTo(w * 0.5, h);
    c.lineTo(0, h - isoH);
    c.lineTo(0, isoH);
    c.close();
    c.fillAndStroke();

    c.setShadow(false);

    c.begin();
    c.moveTo(0, isoH);
    c.lineTo(w * 0.5, 2 * isoH);
    c.lineTo(w, isoH);
    c.moveTo(w * 0.5, 2 * isoH);
    c.lineTo(w * 0.5, h);
    c.stroke();
  }

  /** draw.io shapes/mxBasic.js:580 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    const isoAngle = Math.max(0.01, Math.min(94, parseFloat(getValue(this.style, 'isoAngle', this.isoAngle)))) * Math.PI / 200 ;
    const isoH = Math.min(w * Math.tan(isoAngle), h * 0.5);

    constr.push(new ConnectionConstraint(new Point(0.5, 0), false));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w, isoH));
    constr.push(new ConnectionConstraint(new Point(1, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w, h - isoH));
    constr.push(new ConnectionConstraint(new Point(0.5, 1), false));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, h - isoH));
    constr.push(new ConnectionConstraint(new Point(0, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, isoH));

    return (constr);
  }
}

/** draw.io shapes/mxBasic.js:604 (mxgraph.basic.acute_triangle) */
export class mxShapeBasicTriangleAcute extends ActorShape {
  static readonly cst = {ACUTE_TRIANGLE : 'mxgraph.basic.acute_triangle'} as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx', dispName: 'Top', type: 'float', min:0, max:1, defVal:0.5}
  ];
  constraints: ConnectionConstraint[] | null = null;
  dx = 0.5;

  /** draw.io shapes/mxBasic.js:630 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const dx = w * Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));

    c.begin();
    c.moveTo(0, h);
    c.lineTo(dx, 0);
    c.lineTo(w, h);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxBasic.js:663 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    const dx = w * Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));

    constr.push(new ConnectionConstraint(new Point(1, 1), false));
    constr.push(new ConnectionConstraint(new Point(0.5, 1), false));
    constr.push(new ConnectionConstraint(new Point(0, 1), false));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx, 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx * 0.5, h * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - (w - dx) * 0.5, h * 0.5));

    return (constr);
  }
}

/** draw.io shapes/mxBasic.js:684 (mxgraph.basic.obtuse_triangle) */
export class mxShapeBasicTriangleObtuse extends ActorShape {
  static readonly cst = {OBTUSE_TRIANGLE : 'mxgraph.basic.obtuse_triangle'} as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx', dispName: 'Bottom', type: 'float', min:0, max:1, defVal:0.25}
  ];
  constraints: ConnectionConstraint[] | null = null;
  dx = 0.5;

  /** draw.io shapes/mxBasic.js:710 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const dx = w * Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));

    c.begin();
    c.moveTo(dx, h);
    c.lineTo(0, 0);
    c.lineTo(w, h);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxBasic.js:743 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    const dx = w * Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));

    constr.push(new ConnectionConstraint(new Point(0, 0), false));
    constr.push(new ConnectionConstraint(new Point(1, 1), false));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5, h * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w + dx) * 0.5, h));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx, h));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx * 0.5, h * 0.5));

    return (constr);
  }
}

/** draw.io shapes/mxBasic.js:764 (mxgraph.basic.drop) */
export class mxShapeBasicDrop extends ActorShape {
  static readonly cst = {DROP : 'mxgraph.basic.drop'} as const;
  constraints: ConnectionConstraint[] | null = null;

  /** draw.io shapes/mxBasic.js:785 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const r = Math.min(h, w) * 0.5;
    const d = h - r;
    const a = Math.sqrt(d * d - r * r);

    const angle = Math.atan(a / r);

    const x1 = r * Math.sin(angle);
    const y1 = r * Math.cos(angle);

    c.begin();
    c.moveTo(w * 0.5, 0);
    c.lineTo(w * 0.5 + x1, h - r - y1);
    c.arcTo(r, r, 0, 0, 1, w * 0.5 + r, h - r);
    c.arcTo(r, r, 0, 0, 1, w * 0.5, h);
    c.arcTo(r, r, 0, 0, 1, w * 0.5 - r, h - r);
    c.arcTo(r, r, 0, 0, 1, w * 0.5 - x1, h - r - y1);
    c.close();
    c.fillAndStroke();
  }
}

/** draw.io shapes/mxBasic.js:819 (mxgraph.basic.cone2) */
export class mxShapeBasicCone2 extends ActorShape {
  static readonly cst = {CONE2 : 'mxgraph.basic.cone2'} as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx', dispName: 'Top', type: 'float', min:0, max:1, defVal:0.5},
    {name: 'dy', dispName: 'Bottom', type: 'float', min:0, max:1, defVal:0.9}
  ];
  constraints: ConnectionConstraint[] | null = null;
  dx = 0.5;
  dy = 0.9;

  /** draw.io shapes/mxBasic.js:847 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const dx = w * Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    const dy = h * Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy', this.dy))));

    const ry = h - dy;

    c.begin();
    c.moveTo(dx, 0);

    if (ry > 0)
    {
      c.lineTo(w, h - ry);
      c.arcTo(w * 0.5, ry, 0, 0, 1, w * 0.5, h);
      c.arcTo(w * 0.5, ry, 0, 0, 1, 0, h - ry);
    }
    else
    {
      c.lineTo(w, h);
      c.lineTo(0, h);
    }

    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxBasic.js:906 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    const dx = w * Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    const dy = h * Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy', this.dy))));
    const ry = h - dy;

    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx, 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w, h - ry));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5, h));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, h - ry));

    return (constr);
  }
}

/** draw.io shapes/mxBasic.js:927 (mxgraph.basic.pyramid) */
export class mxShapeBasicPyramid extends ActorShape {
  static readonly cst = {PYRAMID : 'mxgraph.basic.pyramid'} as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx1', dispName: 'Top', type: 'float', min:0, max:1, defVal:0.4},
    {name: 'dx2', dispName: 'Bottom', type: 'float', min:0, max:1, defVal:0.6},
    {name: 'dy1', dispName: 'Perspective Left', type: 'float', min:0, max:1, defVal:0.9},
    {name: 'dy2', dispName: 'Perspective Right', type: 'float', min:0, max:1, defVal:0.8}
  ];
  constraints: ConnectionConstraint[] | null = null;
  dx1 = 0.5;
  dx2 = 0.6;
  dy1 = 0.9;
  dy2 = 0.8;

  /** draw.io shapes/mxBasic.js:959 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const dx1 = w * Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx1', this.dx1))));
    const dx2 = w * Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx2', this.dx2))));
    const dy1 = h * Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy1', this.dy1))));
    const dy2 = h * Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy2', this.dy2))));

    c.begin();
    c.moveTo(dx1, 0);
    c.lineTo(w, dy2);
    c.lineTo(dx2, h);
    c.lineTo(0, dy1);
    c.close();
    c.fillAndStroke();

    c.setShadow(false);

    c.begin();
    c.moveTo(dx1, 0);
    c.lineTo(dx2, h);
    c.stroke();
  }

  /** draw.io shapes/mxBasic.js:1039 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    const dx1 = w * Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx1', this.dx1))));
    const dx2 = w * Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx2', this.dx2))));
    const dy1 = h * Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy1', this.dy1))));
    const dy2 = h * Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy2', this.dy2))));

    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx1, 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w + dx1) * 0.5, dy2 * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w, dy2));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w + dx2) * 0.5, (h + dy2) * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx2, h));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx2 * 0.5, (h + dy1) * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, dy1));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx1 * 0.5, dy1 * 0.5));

    return (constr);
  }
}

/** draw.io shapes/mxBasic.js:1065 (mxgraph.basic.4_point_star_2) */
export class mxShapeBasic4PointStar2 extends ActorShape {
  static readonly cst = {FOUR_POINT_STAR_2 : 'mxgraph.basic.4_point_star_2'} as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx', dispName: 'Thickness', type: 'float', min:0, max:1, defVal:0.8}
  ];
  constraints: ConnectionConstraint[] | null = null;
  dx = 0.8;

  /** draw.io shapes/mxBasic.js:1091 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const dx = 0.5 * Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));

    c.begin();
    c.moveTo(0, h * 0.5);
    c.lineTo(dx * w, dx * h);
    c.lineTo(w * 0.5, 0);
    c.lineTo(w - dx * w, dx * h);
    c.lineTo(w, h * 0.5);
    c.lineTo(w - dx * w, h - dx * h);
    c.lineTo(w * 0.5, h);
    c.lineTo(dx * w, h - dx * h);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxBasic.js:1129 */
  getConstraints(_style: unknown, w: number, _h: number): ConnectionConstraint[] {
    const constr = [];
    const dx = 0.5 * Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));

    constr.push(new ConnectionConstraint(new Point(0.5, 0), false));
    constr.push(new ConnectionConstraint(new Point(0.5, 1), false));
    constr.push(new ConnectionConstraint(new Point(0, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(1, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(dx, dx), false));
    constr.push(new ConnectionConstraint(new Point(1 - dx, dx), false));
    constr.push(new ConnectionConstraint(new Point(1 - dx, 1 - dx), false));
    constr.push(new ConnectionConstraint(new Point(dx, 1 - dx), false));

    return (constr);
  }
}

/** draw.io shapes/mxBasic.js:1152 (mxgraph.basic.diag_snip_rect) */
export class mxShapeBasicDiagSnipRect extends ActorShape {
  static readonly cst = {DIAG_SNIP_RECT : 'mxgraph.basic.diag_snip_rect'} as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx', dispName: 'Snip', type: 'float', min:0, deVal:6},
  ];
  constraints: ConnectionConstraint[] | null = null;
  dx = 0.5;

  /** draw.io shapes/mxBasic.js:1178 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    let dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx)))) * 2;

    dx = Math.min(w * 0.5, h * 0.5, dx);

    c.begin();
    c.moveTo(dx, 0);
    c.lineTo(w, 0);
    c.lineTo(w, h - dx);
    c.lineTo(w - dx, h);
    c.lineTo(0, h);
    c.lineTo(0, dx);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxBasic.js:1216 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    let dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx)))) * 2;

    dx = Math.min(w * 0.5, h * 0.5, dx) * 0.5;

    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx, dx));
    constr.push(new ConnectionConstraint(new Point(0.5, 0), false));
    constr.push(new ConnectionConstraint(new Point(1, 0), false));
    constr.push(new ConnectionConstraint(new Point(1, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, h - dx));
    constr.push(new ConnectionConstraint(new Point(0.5, 1), false));
    constr.push(new ConnectionConstraint(new Point(0, 1), false));
    constr.push(new ConnectionConstraint(new Point(0, 0.5), false));

    return (constr);
  }
}

/** draw.io shapes/mxBasic.js:1241 (mxgraph.basic.diag_round_rect) */
export class mxShapeBasicDiagRoundRect extends ActorShape {
  static readonly cst = {DIAG_ROUND_RECT : 'mxgraph.basic.diag_round_rect'} as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx', dispName: 'Rounding Size', type: 'float', min:0, defVal:6},
  ];
  constraints: ConnectionConstraint[] | null = null;
  dx = 0.5;

  /** draw.io shapes/mxBasic.js:1267 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    let dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx)))) * 2;

    dx = Math.min(w * 0.5, h * 0.5, dx);

    c.begin();
    c.moveTo(dx, 0);
    c.lineTo(w, 0);
    c.lineTo(w, h - dx);
    c.arcTo(dx, dx, 0, 0, 1, w - dx, h);
    c.lineTo(0, h);
    c.lineTo(0, dx);
    c.arcTo(dx, dx, 0, 0, 1, dx, 0);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxBasic.js:1306 */
  getConstraints(_style: unknown, _w: number, _h: number): ConnectionConstraint[] {
    const constr = [];

    constr.push(new ConnectionConstraint(new Point(0.5, 0), false));
    constr.push(new ConnectionConstraint(new Point(1, 0), false));
    constr.push(new ConnectionConstraint(new Point(1, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(0.5, 1), false));
    constr.push(new ConnectionConstraint(new Point(0, 1), false));
    constr.push(new ConnectionConstraint(new Point(0, 0.5), false));

    return (constr);
  }
}

/** draw.io shapes/mxBasic.js:1326 (mxgraph.basic.corner_round_rect) */
export class mxShapeBasicCornerRoundRect extends ActorShape {
  static readonly cst = {CORNER_ROUND_RECT : 'mxgraph.basic.corner_round_rect'} as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx', dispName: 'Rounding Size', type: 'float', min:0, defVal:6},
  ];
  constraints: ConnectionConstraint[] | null = null;
  dx = 0.5;

  /** draw.io shapes/mxBasic.js:1352 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    let dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx)))) * 2;

    dx = Math.min(w * 0.5, h * 0.5, dx);

    c.begin();
    c.moveTo(dx, 0);
    c.lineTo(w, 0);
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.lineTo(0, dx);
    c.arcTo(dx, dx, 0, 0, 1, dx, 0);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxBasic.js:1390 */
  getConstraints(_style: unknown, _w: number, _h: number): ConnectionConstraint[] {
    const constr = [];

    constr.push(new ConnectionConstraint(new Point(0.5, 0), false));
    constr.push(new ConnectionConstraint(new Point(1, 0), false));
    constr.push(new ConnectionConstraint(new Point(1, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(1, 1), false));
    constr.push(new ConnectionConstraint(new Point(0.5, 1), false));
    constr.push(new ConnectionConstraint(new Point(0, 1), false));
    constr.push(new ConnectionConstraint(new Point(0, 0.5), false));

    return (constr);
  }
}

/** draw.io shapes/mxBasic.js:1411 (mxgraph.basic.plaque) */
export class mxShapeBasicPlaque extends ActorShape {
  static readonly cst = {PLAQUE : 'mxgraph.basic.plaque'} as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx', dispName: 'Cutoff Size', type: 'float', min:0, defVal:6},
  ];
  constraints: ConnectionConstraint[] | null = null;
  dx = 0.5;

  /** draw.io shapes/mxBasic.js:1437 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    let dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx)))) * 2;

    dx = Math.min(w * 0.5, h * 0.5, dx);

    c.begin();
    c.moveTo(w - dx, 0);
    c.arcTo(dx, dx, 0, 0, 0, w, dx);
    c.lineTo(w, h - dx);
    c.arcTo(dx, dx, 0, 0, 0, w - dx, h);
    c.lineTo(dx, h);
    c.arcTo(dx, dx, 0, 0, 0, 0, h - dx);
    c.lineTo(0, dx);
    c.arcTo(dx, dx, 0, 0, 0, dx, 0);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxBasic.js:1477 */
  getConstraints(_style: unknown, _w: number, _h: number): ConnectionConstraint[] {
    const constr = [];

    constr.push(new ConnectionConstraint(new Point(0.5, 0), false));
    constr.push(new ConnectionConstraint(new Point(1, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(0.5, 1), false));
    constr.push(new ConnectionConstraint(new Point(0, 0.5), false));

    return (constr);
  }
}

/** draw.io shapes/mxBasic.js:1495 (mxgraph.basic.frame) */
export class mxShapeBasicFrame extends ActorShape {
  static readonly cst = {FRAME : 'mxgraph.basic.frame'} as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx', dispName: 'Width', type: 'float', min:0, defVal:10},
  ];
  constraints: ConnectionConstraint[] | null = null;
  dx = 0.5;

  /** draw.io shapes/mxBasic.js:1521 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    let dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));

    dx = Math.min(w * 0.5, h * 0.5, dx);

    c.begin();
    c.moveTo(w, 0);
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.lineTo(0, 0);
    c.close();
    c.moveTo(dx, dx);
    c.lineTo(dx, h - dx);
    c.lineTo(w - dx, h - dx);
    c.lineTo(w - dx, dx);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxBasic.js:1562 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    let dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    dx = Math.min(w * 0.5, h * 0.5, dx);

    constr.push(new ConnectionConstraint(new Point(0, 0), false));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.25, 0));
    constr.push(new ConnectionConstraint(new Point(0.5, 0), false));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.75, 0));
    constr.push(new ConnectionConstraint(new Point(1, 0), false));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w, h * 0.25));
    constr.push(new ConnectionConstraint(new Point(1, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w, h * 0.75));
    constr.push(new ConnectionConstraint(new Point(1, 1), false));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.75, h));
    constr.push(new ConnectionConstraint(new Point(0.5, 1), false));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.25, h));
    constr.push(new ConnectionConstraint(new Point(0, 1), false));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, h * 0.75));
    constr.push(new ConnectionConstraint(new Point(0, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, h * 0.25));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx, dx));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w - 2 * dx)* 0.25 + dx, dx));
    constr.push(new ConnectionConstraint(new Point(0.5, 0), false, null, 0, dx));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w * 1.5 - dx) * 0.5, dx));
    constr.push(new ConnectionConstraint(new Point(1, 0), false, null, -dx, dx));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, (h - 2 * dx)* 0.25 + dx));
    constr.push(new ConnectionConstraint(new Point(1, 0.5), false, null, -dx, 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, (h  - 2 * dx) * 0.75 + dx));
    constr.push(new ConnectionConstraint(new Point(1, 1), false, null, -dx, -dx));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w - 2 * dx) * 0.75 + dx, h - dx));
    constr.push(new ConnectionConstraint(new Point(0.5, 1), false, null, 0, -dx));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w  - 2 * dx) * 0.25 + dx, h - dx));
    constr.push(new ConnectionConstraint(new Point(0, 1), false, null, dx, -dx));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx, (h - 2 * dx) * 0.75 + dx));
    constr.push(new ConnectionConstraint(new Point(0, 0.5), false, null, dx, 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx, (h - 2 * dx) * 0.25 + dx));

    return (constr);
  }
}

/** draw.io shapes/mxBasic.js:1610 (mxgraph.basic.plaque_frame) */
export class mxShapeBasicPlaqueFrame extends ActorShape {
  static readonly cst = {PLAQUE_FRAME : 'mxgraph.basic.plaque_frame'} as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx', dispName: 'Width', type: 'float', mix:0, defVal:10},
  ];
  constraints: ConnectionConstraint[] | null = null;
  dx = 0.5;

  /** draw.io shapes/mxBasic.js:1635 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    let dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));

    dx = Math.min(w * 0.25, h * 0.25, dx);

    c.begin();
    c.moveTo(w - dx, 0);
    c.arcTo(dx, dx, 0, 0, 0, w, dx);
    c.lineTo(w, h - dx);
    c.arcTo(dx, dx, 0, 0, 0, w - dx, h);
    c.lineTo(dx, h);
    c.arcTo(dx, dx, 0, 0, 0, 0, h - dx);
    c.lineTo(0, dx);
    c.arcTo(dx, dx, 0, 0, 0, dx, 0);
    c.close();

    c.moveTo(dx * 2, dx);
    c.arcTo(dx * 2, dx * 2, 0, 0, 1, dx, dx * 2);
    c.lineTo(dx, h - 2 * dx);
    c.arcTo(dx * 2, dx * 2, 0, 0, 1, dx * 2, h - dx);
    c.lineTo(w - 2 * dx, h - dx);
    c.arcTo(dx * 2, dx * 2, 0, 0, 1, w - dx, h - 2 * dx);
    c.lineTo(w - dx, dx * 2);
    c.arcTo(dx * 2, dx * 2, 0, 0, 1, w - 2 * dx, dx);
    c.close();

    c.fillAndStroke();
  }

  /** draw.io shapes/mxBasic.js:1687 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    let dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    dx = Math.min(w * 0.5, h * 0.5, dx);

    constr.push(new ConnectionConstraint(new Point(0.5, 0), false));
    constr.push(new ConnectionConstraint(new Point(1, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(0.5, 1), false));
    constr.push(new ConnectionConstraint(new Point(0, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(0.5, 0), false, null, 0, dx));
    constr.push(new ConnectionConstraint(new Point(1, 0.5), false, null, -dx, 0));
    constr.push(new ConnectionConstraint(new Point(0.5, 1), false, null, 0, -dx));
    constr.push(new ConnectionConstraint(new Point(0, 0.5), false, null, dx, 0));

    return (constr);
  }
}

/** draw.io shapes/mxBasic.js:1711 (mxgraph.basic.rounded_frame) */
export class mxShapeBasicRoundedFrame extends ActorShape {
  static readonly cst = {ROUNDED_FRAME : 'mxgraph.basic.rounded_frame'} as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx', dispName: 'Width', type: 'float', min:0, defVal:10},
  ];
  constraints: ConnectionConstraint[] | null = null;
  dx = 0.5;

  /** draw.io shapes/mxBasic.js:1737 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    let dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));

    dx = Math.min(w * 0.25, h * 0.25, dx);

    c.begin();
    c.moveTo(w - 2 * dx, 0);
    c.arcTo(dx * 2, dx * 2, 0, 0, 1, w, 2 * dx);
    c.lineTo(w, h - 2 * dx);
    c.arcTo(dx * 2, dx * 2, 0, 0, 1, w - 2 * dx, h);
    c.lineTo(dx * 2, h);
    c.arcTo(dx * 2, dx * 2, 0, 0, 1, 0, h - 2 * dx);
    c.lineTo(0, 2 * dx);
    c.arcTo(dx * 2, dx * 2, 0, 0, 1, 2 * dx, 0);
    c.close();

    c.moveTo(dx * 2, dx);
    c.arcTo(dx, dx, 0, 0, 0, dx, dx * 2);
    c.lineTo(dx, h - 2 * dx);
    c.arcTo(dx, dx, 0, 0, 0, dx * 2, h - dx);
    c.lineTo(w - 2 * dx, h - dx);
    c.arcTo(dx, dx, 0, 0, 0, w - dx, h - 2 * dx);
    c.lineTo(w - dx, dx * 2);
    c.arcTo(dx, dx, 0, 0, 0, w - 2 * dx, dx);
    c.close();

    c.fillAndStroke();
  }

  /** draw.io shapes/mxBasic.js:1789 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    let dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    dx = Math.min(w * 0.5, h * 0.5, dx);

    constr.push(new ConnectionConstraint(new Point(0.5, 0), false));
    constr.push(new ConnectionConstraint(new Point(1, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(0.5, 1), false));
    constr.push(new ConnectionConstraint(new Point(0, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(0.5, 0), false, null, 0, dx));
    constr.push(new ConnectionConstraint(new Point(1, 0.5), false, null, -dx, 0));
    constr.push(new ConnectionConstraint(new Point(0.5, 1), false, null, 0, -dx));
    constr.push(new ConnectionConstraint(new Point(0, 0.5), false, null, dx, 0));

    return (constr);
  }
}

/** draw.io shapes/mxBasic.js:1813 (mxgraph.basic.frame_corner) */
export class mxShapeBasicFrameCorner extends ActorShape {
  static readonly cst = {FRAME_CORNER : 'mxgraph.basic.frame_corner'} as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx', dispName: 'Width', type: 'float', min:0, defVal:10},
  ];
  constraints: ConnectionConstraint[] | null = null;
  dx = 0.5;

  /** draw.io shapes/mxBasic.js:1839 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    let dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));

    dx = Math.min(w * 0.5, h * 0.5, dx);

    c.begin();
    c.moveTo(0, 0);
    c.lineTo(w, 0);
    c.lineTo(w - dx, dx);
    c.lineTo(dx, dx);
    c.lineTo(dx, h - dx);
    c.lineTo(0, h);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxBasic.js:1877 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    let dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));

    dx = Math.min(w * 0.5, h * 0.5, dx);

    constr.push(new ConnectionConstraint(new Point(0, 0), false));
    constr.push(new ConnectionConstraint(new Point(0.5, 0), false));
    constr.push(new ConnectionConstraint(new Point(1, 0), false));
    constr.push(new ConnectionConstraint(new Point(1, 0), false, null, -dx, dx));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w - 2 * dx) * 0.5 + dx, dx));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx, dx));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx, (h - 2 * dx) * 0.5 + dx));
    constr.push(new ConnectionConstraint(new Point(0, 1), false, null, dx, -dx));
    constr.push(new ConnectionConstraint(new Point(0, 1), false));
    constr.push(new ConnectionConstraint(new Point(0, 0.5), false));

    return (constr);
  }
}

/** draw.io shapes/mxBasic.js:1904 (mxgraph.basic.diag_stripe) */
export class mxShapeBasicDiagStripe extends ActorShape {
  static readonly cst = {DIAG_STRIPE : 'mxgraph.basic.diag_stripe'} as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx', dispName: 'Width', type: 'float', mix:0, defVal:10},
  ];
  constraints: ConnectionConstraint[] | null = null;
  dx = 0.5;

  /** draw.io shapes/mxBasic.js:1930 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    let dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));

    dx = Math.min(w, h, dx);

    c.begin();
    c.moveTo(0, h);
    c.lineTo(w, 0);
    c.lineTo(w, Math.min(dx * 100 / w, h));
    c.lineTo(Math.min(dx * 100 / h, w), h);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxBasic.js:1966 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    let dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    dx = Math.min(w, h, dx);

    constr.push(new ConnectionConstraint(new Point(0, 1), false));
    constr.push(new ConnectionConstraint(new Point(0.5, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(1, 0), false));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w, Math.min(dx * 100 / w, h) * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w, Math.min(dx * 100 / w, h)));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w + Math.min(dx * 100 / h, w)) * 0.5, (Math.min(dx * 100 / w, h) + h) * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, Math.min(dx * 100 / h, w), h));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, Math.min(dx * 100 / h, w) * 0.5, h));

    return (constr);
  }
}

/** draw.io shapes/mxBasic.js:1990 (mxgraph.basic.donut) */
export class mxShapeBasicDonut extends ActorShape {
  static readonly cst = {DONUT : 'mxgraph.basic.donut'} as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx', dispName: 'Width', type: 'float', min:0, defVal:25}
  ];
  constraints: ConnectionConstraint[] | null = null;
  dx = 0.5;

  /** draw.io shapes/mxBasic.js:2016 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    let dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));

    dx = Math.min(w * 0.5, h * 0.5, dx);

    c.begin();
    c.moveTo(0, h * 0.5);
    c.arcTo(w * 0.5, h * 0.5, 0, 0, 1, w * 0.5, 0);
    c.arcTo(w * 0.5, h * 0.5, 0, 0, 1, w, h * 0.5);
    c.arcTo(w * 0.5, h * 0.5, 0, 0, 1, w * 0.5, h);
    c.arcTo(w * 0.5, h * 0.5, 0, 0, 1, 0, h * 0.5);
    c.close();
    c.moveTo(w * 0.5, dx);
    c.arcTo(w * 0.5 - dx, h * 0.5 - dx, 0, 0, 0, dx, h * 0.5);
    c.arcTo(w * 0.5 - dx, h * 0.5 - dx, 0, 0, 0, w * 0.5, h - dx);
    c.arcTo(w * 0.5 - dx, h * 0.5 - dx, 0, 0, 0, w - dx, h * 0.5);
    c.arcTo(w * 0.5 - dx, h * 0.5 - dx, 0, 0, 0, w * 0.5, dx);
    c.close();
    c.fillAndStroke();
  }
}

/** draw.io shapes/mxBasic.js:2065 (mxgraph.basic.layered_rect) */
export class mxShapeBasicLayeredRect extends ActorShape {
  static readonly cst = {LAYERED_RECT : 'mxgraph.basic.layered_rect'} as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx', dispName: 'Layer Distance', type: 'float', mix:0, defVal:10},
    {name: 'boundedLbl', dispName: 'Bounded Label', type: 'bool', defVal: false}
  ];
  constraints: ConnectionConstraint[] | null = null;
  dx = 0.5;

  /** draw.io shapes/mxBasic.js:2093 */
  override getLabelMargins(rect: Rectangle): Rectangle | null {
    if (getValue(this.style, 'boundedLbl', false))
    {
      const w = rect.width / this.scale;
      const h = rect.height / this.scale;
      let dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));

      dx = Math.min(w * 0.5, h * 0.5, dx) * this.scale;

      return new Rectangle(0, 0, dx, dx);
    }

    return null;
  }

  /** draw.io shapes/mxBasic.js:2114 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    let dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));

    dx = Math.min(w * 0.5, h * 0.5, dx);

    c.begin();
    c.moveTo(dx, dx);
    c.lineTo(w, dx);
    c.lineTo(w, h);
    c.lineTo(dx, h);
    c.close();
    c.fillAndStroke();

    c.begin();
    c.moveTo(dx * 0.5, dx * 0.5);
    c.lineTo(w - dx * 0.5, dx * 0.5);
    c.lineTo(w - dx * 0.5, h - dx * 0.5);
    c.lineTo(dx * 0.5, h - dx * 0.5);
    c.close();
    c.fillAndStroke();

    c.begin();
    c.moveTo(0, 0);
    c.lineTo(w - dx, 0);
    c.lineTo(w - dx, h - dx);
    c.lineTo(0, h - dx);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxBasic.js:2166 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    let dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    dx = Math.min(w * 0.5, h * 0.5, dx);

    constr.push(new ConnectionConstraint(new Point(0, 0), false));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w - dx) * 0.25, 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w - dx) * 0.5, 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w - dx) * 0.75, 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx * 0.5, dx * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w, dx));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w, (h - dx) * 0.25 + dx));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w, (h - dx) * 0.5 + dx));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w, (h - dx) * 0.75 + dx));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w, h));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w - dx) * 0.75 + dx, h));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w - dx) * 0.5 + dx, h));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w - dx) * 0.25 + dx, h));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx, h));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx * 0.5, h - dx * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, h - dx));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, (h - dx) * 0.75));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, (h - dx) * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, (h - dx) * 0.25));

    return (constr);
  }
}

/** draw.io shapes/mxBasic.js:2202 (mxgraph.basic.button) */
export class mxShapeBasicButton extends ActorShape {
  static readonly cst = {BUTTON : 'mxgraph.basic.button'} as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx', dispName: 'Button Height', type: 'float', min:0, defVal:10}
  ];
  constraints: ConnectionConstraint[] | null = null;
  dx = 0.5;

  /** draw.io shapes/mxBasic.js:2228 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    let dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));

    dx = Math.min(w * 0.5, h * 0.5, dx);

    c.begin();
    c.moveTo(0, 0);
    c.lineTo(w, 0);
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.close();
    c.fillAndStroke();

    c.setShadow(false);
    c.setLineJoin('round');

    c.begin();
    c.moveTo(0, h);
    c.lineTo(0, 0);
    c.lineTo(dx, dx);
    c.lineTo(dx, h - dx);
    c.close();
    c.fillAndStroke();

    c.begin();
    c.moveTo(0, 0);
    c.lineTo(w, 0);
    c.lineTo(w - dx, dx);
    c.lineTo(dx, dx);
    c.close();
    c.fillAndStroke();

    c.begin();
    c.moveTo(w, 0);
    c.lineTo(w, h);
    c.lineTo(w - dx, h - dx);
    c.lineTo(w - dx, dx);
    c.close();
    c.fillAndStroke();

    c.begin();
    c.moveTo(0, h);
    c.lineTo(dx, h - dx);
    c.lineTo(w - dx, h - dx);
    c.lineTo(w, h);
    c.close();
    c.fillAndStroke();

    c.begin();
    c.moveTo(0, h);
    c.lineTo(0, 0);
    c.lineTo(dx, dx);
    c.lineTo(dx, h - dx);
    c.close();
    c.fillAndStroke();
  }
}

/** draw.io shapes/mxBasic.js:2315 (mxgraph.basic.shaded_button) */
export class mxShapeBasicShadedButton extends ActorShape {
  static readonly cst = {SHADED_BUTTON : 'mxgraph.basic.shaded_button'} as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx', dispName: 'Button Height', type: 'float', min:0, defVal:10}
  ];
  constraints: ConnectionConstraint[] | null = null;
  dx = 0.5;

  /** draw.io shapes/mxBasic.js:2341 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    c.setShadow(false);

    let dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));

    dx = Math.min(w * 0.5, h * 0.5, dx);

    c.begin();
    c.moveTo(0, 0);
    c.lineTo(w, 0);
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.close();
    c.fill();

    c.setFillColor('#ffffff');
    c.setAlpha(0.25);
    c.begin();
    c.moveTo(0, h);
    c.lineTo(0, 0);
    c.lineTo(dx, dx);
    c.lineTo(dx, h - dx);
    c.close();
    c.fill();

    c.setAlpha(0.5);
    c.begin();
    c.moveTo(0, 0);
    c.lineTo(w, 0);
    c.lineTo(w - dx, dx);
    c.lineTo(dx, dx);
    c.close();
    c.fill();

    c.setFillColor('#000000');
    c.setAlpha(0.25);
    c.begin();
    c.moveTo(w, 0);
    c.lineTo(w, h);
    c.lineTo(w - dx, h - dx);
    c.lineTo(w - dx, dx);
    c.close();
    c.fill();

    c.setAlpha(0.5);
    c.begin();
    c.moveTo(0, h);
    c.lineTo(dx, h - dx);
    c.lineTo(w - dx, h - dx);
    c.lineTo(w, h);
    c.close();
    c.fill();
  }
}

/** draw.io shapes/mxBasic.js:2425 (mxgraph.basic.pie) */
export class mxShapeBasicPie extends ActorShape {
  static readonly cst = {PIE : 'mxgraph.basic.pie'} as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'startAngle', dispName: 'Start Angle', type: 'float', min:0, max:1, defVal: 0.2},
    {name: 'endAngle', dispName: 'End Angle', type: 'float', min:0, max:1, defVal: 0.9}
  ];
  constraints: ConnectionConstraint[] | null = null;
  startAngle = 0.25;
  endAngle = 0.75;

  /** draw.io shapes/mxBasic.js:2453 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);
    const startAngleSource = Math.max(0, Math.min(1, parseFloat(getValue(this.style, 'startAngle', this.startAngle))));
    const endAngleSource = Math.max(0, Math.min(1, parseFloat(getValue(this.style, 'endAngle', this.endAngle))));
    const startAngle = 2 * Math.PI * startAngleSource;
    const endAngle = 2 * Math.PI * endAngleSource;
    const rx = w * 0.5;
    const ry = h * 0.5;

    const startX = rx + Math.sin(startAngle) * rx;
    const startY = ry - Math.cos(startAngle) * ry;
    const endX = rx + Math.sin(endAngle) * rx;
    const endY = ry - Math.cos(endAngle) * ry;

    let angDiff = endAngle - startAngle;

    if (angDiff < 0)
    {
      angDiff = angDiff + Math.PI * 2;
    }

    let bigArc = 0;

    if (angDiff >= Math.PI)
    {
      bigArc = 1;
    }

    c.begin();
    const startAngleDiff = startAngleSource % 1;
    const endAngleDiff = endAngleSource % 1;

    if (startAngleDiff == 0 && endAngleDiff == 0.5)
    {
      c.moveTo(rx, ry);
      c.lineTo(startX, startY);
      c.arcTo(rx, ry, 0, 0, 1, w, h * 0.5);
      c.arcTo(rx, ry, 0, 0, 1, w * 0.5, h);
    }
    else if (startAngleDiff == 0.5 && endAngleDiff == 0)
    {
      c.moveTo(rx, ry);
      c.lineTo(startX, startY);
      c.arcTo(rx, ry, 0, 0, 1, 0, h * 0.5);
      c.arcTo(rx, ry, 0, 0, 1, w * 0.5, 0);
    }
    else
    {
      c.moveTo(rx, ry);
      c.lineTo(startX, startY);
      c.arcTo(rx, ry, 0, bigArc, 1, endX, endY);
    }

    c.close();
    c.fillAndStroke();
  }
}

/** draw.io shapes/mxBasic.js:2569 (mxgraph.basic.arc) */
export class mxShapeBasicArc extends ActorShape {
  static readonly cst = {ARC : 'mxgraph.basic.arc'} as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'startAngle', dispName: 'Start Angle', type: 'float', min:0, max:1, defVal: 0.3},
    {name: 'endAngle', dispName: 'End Angle', type: 'float', min:0, max:1, defVal:0.1},
    {name: 'startArrow', dispName: 'Start Arrow', type: 'enum', defVal: 'none',
      enumList: [{val: 'none', dispName: 'None'}, {val: 'classic', dispName: 'Classic'},
        {val: 'classicThin', dispName: 'Classic Thin'}, {val: 'open', dispName: 'Open'},
        {val: 'openThin', dispName: 'Open Thin'}, {val: 'block', dispName: 'Block'},
        {val: 'blockThin', dispName: 'Block Thin'}, {val: 'oval', dispName: 'Oval'},
        {val: 'diamond', dispName: 'Diamond'}, {val: 'diamondThin', dispName: 'Diamond Thin'}]},
    {name: 'endArrow', dispName: 'End Arrow', type: 'enum', defVal: 'none',
      enumList: [{val: 'none', dispName: 'None'}, {val: 'classic', dispName: 'Classic'},
        {val: 'classicThin', dispName: 'Classic Thin'}, {val: 'open', dispName: 'Open'},
        {val: 'openThin', dispName: 'Open Thin'}, {val: 'block', dispName: 'Block'},
        {val: 'blockThin', dispName: 'Block Thin'}, {val: 'oval', dispName: 'Oval'},
        {val: 'diamond', dispName: 'Diamond'}, {val: 'diamondThin', dispName: 'Diamond Thin'}]},
    {name: 'startFill', dispName: 'Start Fill', type: 'bool', defVal: true},
    {name: 'endFill', dispName: 'End Fill', type: 'bool', defVal: true},
    {name: 'startSize', dispName: 'Start Size', type: 'float', min: 1, defVal: 6},
    {name: 'endSize', dispName: 'End Size', type: 'float', min: 1, defVal: 6}
  ];
  constraints: ConnectionConstraint[] | null = null;
  startAngle = 0.25;
  endAngle = 0.75;

  /** draw.io shapes/mxBasic.js:2613 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const startAngleSource = Math.max(0, Math.min(1, parseFloat(getValue(this.style, 'startAngle', this.startAngle))));
    const endAngleSource = Math.max(0, Math.min(1, parseFloat(getValue(this.style, 'endAngle', this.endAngle))));
    const startAngle = 2 * Math.PI * startAngleSource;
    const endAngle = 2 * Math.PI * endAngleSource;

    // Arrow markers
    const startArrow = getValue(this.style, 'startArrow', 'none');
    const endArrow = getValue(this.style, 'endArrow', 'none');
    const startSize = getNumber(this.style, 'startSize', DEFAULT_MARKERSIZE);
    const endSize = getNumber(this.style, 'endSize', DEFAULT_MARKERSIZE);

    // Inset ellipse to keep markers within shape bounds
    let markerPadding = 0;

    if (startArrow != null && startArrow != 'none')
    {
      markerPadding = Math.max(markerPadding, startSize);
    }

    if (endArrow != null && endArrow != 'none')
    {
      markerPadding = Math.max(markerPadding, endSize);
    }

    if (markerPadding > 0)
    {
      markerPadding = (markerPadding + this.strokeWidth) / 2;
    }

    const cx = w * 0.5;
    const cy = h * 0.5;
    const rx = Math.max(0, w * 0.5 - markerPadding);
    const ry = Math.max(0, h * 0.5 - markerPadding);

    let startX = cx + Math.sin(startAngle) * rx;
    let startY = cy - Math.cos(startAngle) * ry;
    let endX = cx + Math.sin(endAngle) * rx;
    let endY = cy - Math.cos(endAngle) * ry;

    let startMarker = null;
    let endMarker = null;

    if (startArrow != null && startArrow != 'none')
    {
      const startFilled = getValue(this.style, 'startFill') != 0;

      // Direction pointing into the start (opposite of clockwise tangent)
      const dx = -rx * Math.cos(startAngle);
      const dy = -ry * Math.sin(startAngle);
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0)
      {
        const pe = new Point(startX, startY);
        startMarker = MarkerShape.createMarker(c, this, startArrow, pe,
          dx / dist, dy / dist, startSize, true, this.strokeWidth, startFilled);
        startX = pe.x;
        startY = pe.y;
      }
    }

    if (endArrow != null && endArrow != 'none')
    {
      const endFilled = getValue(this.style, 'endFill') != 0;

      // Direction along the clockwise tangent at end
      const dx = rx * Math.cos(endAngle);
      const dy = ry * Math.sin(endAngle);
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0)
      {
        const pe = new Point(endX, endY);
        endMarker = MarkerShape.createMarker(c, this, endArrow, pe,
          dx / dist, dy / dist, endSize, false, this.strokeWidth, endFilled);
        endX = pe.x;
        endY = pe.y;
      }
    }

    // Draw arc
    let angDiff = endAngle - startAngle;

    if (angDiff < 0)
    {
      angDiff = angDiff + Math.PI * 2;
    }

    let bigArc = 0;

    if (angDiff > Math.PI)
    {
      bigArc = 1;
    }

    c.begin();

    const startAngleDiff = startAngleSource % 1;
    const endAngleDiff = endAngleSource % 1;

    if (startMarker == null && endMarker == null &&
      startAngleDiff == 0 && endAngleDiff == 0.5)
    {
      c.moveTo(startX, startY);
      c.arcTo(rx, ry, 0, 0, 1, cx + rx, cy);
      c.arcTo(rx, ry, 0, 0, 1, cx, cy + ry);
    }
    else if (startMarker == null && endMarker == null &&
      startAngleDiff == 0.5 && endAngleDiff == 0)
    {
      c.moveTo(startX, startY);
      c.arcTo(rx, ry, 0, 0, 1, cx - rx, cy);
      c.arcTo(rx, ry, 0, 0, 1, cx, cy - ry);
    }
    else
    {
      c.moveTo(startX, startY);
      c.arcTo(rx, ry, 0, bigArc, 1, endX, endY);
    }

    c.stroke();

    // Paint markers
    c.setShadow(false);
    c.setDashed(false);

    if (startMarker != null)
    {
      c.setFillColor(getValue(this.style,
        'startFillColor', this.stroke));
      startMarker();
    }

    if (endMarker != null)
    {
      c.setFillColor(getValue(this.style,
        'endFillColor', this.stroke));
      endMarker();
    }
  }
}

/** draw.io shapes/mxBasic.js:2816 (mxgraph.basic.partConcEllipse) */
export class mxShapeBasicPartConcEllipse extends ActorShape {
  static readonly cst = {PART_CONC_ELLIPSE : 'mxgraph.basic.partConcEllipse'} as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'startAngle', dispName: 'Start Angle', type: 'float', min:0, max:1, defVal:0.25},
    {name: 'endAngle', dispName: 'End Angle', type: 'float', min:0, max:1, defVal:0.1},
    {name: 'arcWidth', dispName: 'Arc Width', type: 'float', min:0, max:1, defVal:0.5}
  ];
  constraints: ConnectionConstraint[] | null = null;
  startAngle = 0.25;
  endAngle = 0.75;
  arcWidth = 0.5;

  /** draw.io shapes/mxBasic.js:2846 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const startAngle = 2 * Math.PI * Math.max(0, Math.min(1, parseFloat(getValue(this.style, 'startAngle', this.startAngle))));
    let endAngle = 2 * Math.PI * Math.max(0, Math.min(1, parseFloat(getValue(this.style, 'endAngle', this.endAngle))));
    const arcWidth = 1 - Math.max(0, Math.min(1, parseFloat(getValue(this.style, 'arcWidth', this.arcWidth))));
    const rx = w * 0.5;
    const ry = h * 0.5;
    const rx2 = rx * arcWidth;
    const ry2 = ry * arcWidth;

    let angDiff = endAngle - startAngle;

    if (angDiff < 0)
    {
      angDiff = angDiff + Math.PI * 2;
    }
    else if (angDiff == Math.PI)
    {
      endAngle = endAngle + 0.00001;
    }

    const startX = rx + Math.sin(startAngle) * rx;
    const startY = ry - Math.cos(startAngle) * ry;
    const innerStartX = rx + Math.sin(startAngle) * rx2;
    const innerStartY = ry - Math.cos(startAngle) * ry2;
    const endX = rx + Math.sin(endAngle) * rx;
    const endY = ry - Math.cos(endAngle) * ry;
    const innerEndX = rx + Math.sin(endAngle) * rx2;
    const innerEndY = ry - Math.cos(endAngle) * ry2;


    let bigArc = 0;

    if (angDiff >= Math.PI)
    {
      bigArc = 1;
    }

    c.begin();
    c.moveTo(startX, startY);
    c.arcTo(rx, ry, 0, bigArc, 1, endX, endY);
    c.lineTo(innerEndX, innerEndY);
    c.arcTo(rx2, ry2, 0, bigArc, 0, innerStartX, innerStartY);
    c.close();
    c.fillAndStroke();
  }
}

/** draw.io shapes/mxBasic.js:2965 (mxgraph.basic.numberedEntryVert) */
export class mxShapeBasicNumEntryVert extends ActorShape {
  static readonly cst = {NUM_ENTRY_VERT : 'mxgraph.basic.numberedEntryVert'} as const;
  constraints: ConnectionConstraint[] | null = null;
  dy = 0.5;

  /** draw.io shapes/mxBasic.js:2987 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const dy = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dy', this.dy))));

    const inset = 5;

    const d = Math.min(dy, w - 2 * inset, h - inset);

    c.ellipse(w * 0.5 - d * 0.5, 0, d, d);
    c.fillAndStroke();

    c.begin();
    c.moveTo(0, d * 0.5);
    c.lineTo(w * 0.5 - d * 0.5 - inset, d * 0.5);
    c.arcTo(d * 0.5 + inset, d * 0.5 + inset, 0, 0, 0, w * 0.5 + d * 0.5 + inset, d * 0.5);
    c.lineTo(w, d * 0.5);
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.close();
    c.fillAndStroke();
  }
}

/** draw.io shapes/mxBasic.js:3036 (mxgraph.basic.bendingArch) */
export class mxShapeBasicBendingArch extends ActorShape {
  static readonly cst = {BENDING_ARCH : 'mxgraph.basic.bendingArch'} as const;
  constraints: ConnectionConstraint[] | null = null;
  startAngle = 0.25;
  endAngle = 0.75;
  arcWidth = 0.5;

  /** draw.io shapes/mxBasic.js:3060 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const startAngle = 2 * Math.PI * Math.max(0, Math.min(1, parseFloat(getValue(this.style, 'startAngle', this.startAngle))));
    const endAngle = 2 * Math.PI * Math.max(0, Math.min(1, parseFloat(getValue(this.style, 'endAngle', this.endAngle))));
    const arcWidth = 1 - Math.max(0, Math.min(1, parseFloat(getValue(this.style, 'arcWidth', this.arcWidth))));
    const rx = w * 0.5;
    const ry = h * 0.5;
    const rx2 = rx * arcWidth;
    const ry2 = ry * arcWidth;

    const startX = rx + Math.sin(startAngle) * rx;
    const startY = ry - Math.cos(startAngle) * ry;
    const innerStartX = rx + Math.sin(startAngle) * rx2;
    const innerStartY = ry - Math.cos(startAngle) * ry2;
    const endX = rx + Math.sin(endAngle) * rx;
    const endY = ry - Math.cos(endAngle) * ry;
    const innerEndX = rx + Math.sin(endAngle) * rx2;
    const innerEndY = ry - Math.cos(endAngle) * ry2;

    let angDiff = endAngle - startAngle;

    if (angDiff < 0)
    {
      angDiff = angDiff + Math.PI * 2;
    }

    let bigArc = 0;

    if (angDiff > Math.PI)
    {
      bigArc = 1;
    }

    const rx3 = rx2 - 5;
    const ry3 = ry2 - 5;

    c.ellipse(w * 0.5 - rx3, h * 0.5 - ry3, 2 * rx3, 2 * ry3);
    c.fillAndStroke();

    c.begin();
    c.moveTo(startX, startY);
    c.arcTo(rx, ry, 0, bigArc, 1, endX, endY);
    c.lineTo(innerEndX, innerEndY);
    c.arcTo(rx2, ry2, 0, bigArc, 0, innerStartX, innerStartY);
    c.close();
    c.fillAndStroke();
  }
}

/** draw.io shapes/mxBasic.js:3180 (mxgraph.basic.three_corner_round_rect) */
export class mxShapeBasicThreeCornerRoundRect extends ActorShape {
  static readonly cst = {THREE_CORNER_ROUND_RECT : 'mxgraph.basic.three_corner_round_rect'} as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx', dispName: 'Rounding Size', type: 'float', min:0, defVal:6}
  ];
  constraints: ConnectionConstraint[] | null = null;
  dx = 0.5;

  /** draw.io shapes/mxBasic.js:3206 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    let dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx)))) * 2;

    dx = Math.min(w * 0.5, h * 0.5, dx);

    c.begin();
    c.moveTo(dx, 0);
    c.lineTo(w - dx, 0);
    c.arcTo(dx, dx, 0, 0, 1, w, dx);
    c.lineTo(w, h - dx);
    c.arcTo(dx, dx, 0, 0, 1, w - dx, h);
    c.lineTo(0, h);
    c.lineTo(0, dx);
    c.arcTo(dx, dx, 0, 0, 1, dx, 0);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxBasic.js:3246 */
  getConstraints(_style: unknown, _w: number, _h: number): ConnectionConstraint[] {
    const constr = [];

    constr.push(new ConnectionConstraint(new Point(0.5, 0), false));
    constr.push(new ConnectionConstraint(new Point(1, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(0.5, 1), false));
    constr.push(new ConnectionConstraint(new Point(0, 1), false));
    constr.push(new ConnectionConstraint(new Point(0, 0.5), false));

    return (constr);
  }
}

/** draw.io shapes/mxBasic.js:3265 (mxgraph.basic.polygon) */
export class mxShapeBasicPolygon extends ActorShape {
  static readonly cst = {POLYGON : 'mxgraph.basic.polygon'} as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'polyline', dispName: 'Polyline', type: 'bool', defVal:false},
    {name: 'polyCurves', dispName: 'Curves', type: 'string', defVal: '[]'}
  ];
  constraints: ConnectionConstraint[] | null = null;
  dx = 0.5;
  dy = 0.5;

  /** draw.io shapes/mxBasic.js:3293 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    try
    {
        c.translate(x, y);
        const coords = JSON.parse(getValue(this.state?.style, 'polyCoords', '[]'));
        const curves = JSON.parse(getValue(this.state?.style, 'polyCurves', '[]'));
        const polyline = getValue(this.style, 'polyline', false);

        if (coords.length > 0)
        {
            c.begin();
            c.moveTo(coords[0][0] * w, coords[0][1] * h);

            for (let i = 1; i < coords.length; i++)
            {
                const ci = (curves.length > i - 1) ? curves[i - 1] : null;

                if (ci != null && ci.length >= 3 && ci[0] === 'Q')
                {
                    c.quadTo(ci[1] * w, ci[2] * h, coords[i][0] * w, coords[i][1] * h);
                }
                else
                {
                    c.lineTo(coords[i][0] * w, coords[i][1] * h);
                }
            }

            if (polyline == false)
            {
                const closeCurve = (curves.length >= coords.length) ? curves[coords.length - 1] : null;

                if (closeCurve != null && closeCurve.length >= 3 && closeCurve[0] === 'Q')
                {
                    c.quadTo(closeCurve[1] * w, closeCurve[2] * h, coords[0][0] * w, coords[0][1] * h);
                }

                c.close();
            }

            c.end();
            c.fillAndStroke();
        }
    }
    catch (e)
    {
        // ignore
    }
  }
}

/** draw.io shapes/mxBasic.js:3507 (mxgraph.basic.patternFillRect) */
export class mxShapeBasicPatternFillRect extends ActorShape {
  static readonly cst = {PATTERN_FILL_RECT : 'mxgraph.basic.patternFillRect'} as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'step', dispName: 'Fill Step', type: 'float', min:0, defVal:5},
    {name: 'fillStyle', dispName: 'Fill Style', type: 'enum', defVal:'none',
      enumList:[
        {val: 'none', dispName: 'None'},
        {val: 'diag', dispName: 'Diagonal'},
        {val: 'diagRev', dispName: 'Diagonal Reverse'},
        {val: 'vert', dispName: 'Vertical'},
        {val: 'hor', dispName: 'Horizontal'},
        {val: 'grid', dispName: 'Grid'},
        {val: 'diagGrid', dispName: 'Diagonal Grid'}
    ]},
    {name: 'fillStrokeWidth', dispName: 'Fill Stroke Width', type: 'float', min:0, defVal:1},
    {name: 'fillStrokeColor', dispName: 'Fill Stroke Color', type: 'color', defVal:'#cccccc'},
    {name: 'top', dispName: 'Top Line', type: 'bool', defVal:true},
    {name: 'right', dispName: 'Right Line', type: 'bool', defVal:true},
    {name: 'bottom', dispName: 'Bottom Line', type: 'bool', defVal:true},
    {name: 'left', dispName: 'Left Line', type: 'bool', defVal:true}
  ];
  maxLines = 10000;
  dx = 0.5;

  /** draw.io shapes/mxBasic.js:3556 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const strokeColor = getValue(this.style, 'strokeColor', '#000000');
    const strokeWidth = getValue(this.style, 'strokeWidth', '1');

    c.rect(0, 0, w, h);
    c.fill();

    const fillStrokeColor = getValue(this.style, 'fillStrokeColor', '#cccccc');
    const fillStrokeWidth = parseFloat(getValue(this.style, 'fillStrokeWidth', 1));

    c.setStrokeColor(fillStrokeColor);
    c.setStrokeWidth(fillStrokeWidth);

    let step = parseFloat(getValue(this.style, 'step', 5));
    const fillStyle = getValue(this.style, 'fillStyle', 'none');

    if (fillStyle == 'diag' || fillStyle == 'diagGrid')
    {
      step = step * 1.41;
      let i = 0;
      let n = 0;

      c.begin();

      while (i < (h + w) && n < this.maxLines)
      {
        // unused upstream: let cx = 0;
        // unused upstream: let cy = 0;

        if (i <= h)
        {
          c.moveTo(0, i);

          if(i <= w)
          {
            c.lineTo(i, 0);
          }
          else
          {
            c.lineTo(w, i - w);
          }
        }
        else
        {
          c.moveTo(i - h, h);

          if(i <= w)
          {
            c.lineTo(i, 0);
          }
          else
          {
            c.lineTo(w, i - w);
          }
        }

        i = i + step;
        n++;
      }

      c.stroke();
    }
    else if (fillStyle == 'vert' || fillStyle == 'grid')
    {
      c.begin();
      let i = 0;
      let n = 0;

      while (i <= w && n < this.maxLines)
      {
        // unused upstream: let cx = 0;
        // unused upstream: let cy = 0;

        c.moveTo(i, 0);
        c.lineTo(i, h);

        i = i + step;
        n++;
      }

      c.stroke();
    }

    if (fillStyle == 'diagRev' || fillStyle == 'diagGrid')
    {
      if (fillStyle == 'diagRev')
      {
        step = step * 1.41;
      }

      let i = 0;
      let n = 0;

      c.begin();

      while (i < (h + w) && n < this.maxLines)
      {
        // unused upstream: let cx = 0;
        // unused upstream: let cy = 0;

        if (i <= h)
        {
          c.moveTo(w, i);

          if(i <= w)
          {
            c.lineTo(w - i, 0);
          }
          else
          {
            c.lineTo(w - w, i - w);
          }
        }
        else
        {
          c.moveTo(w - i + h, h);

          if(i <= w)
          {
            c.lineTo(w - i, 0);
          }
          else
          {
            c.lineTo(0, i - w);
          }
        }

        i = i + step;
        n++;
      }

      c.stroke();
    }
    else if (fillStyle == 'hor' || fillStyle == 'grid')
    {
      c.begin();
      let i = 0;
      let n = 0;

      while (i <= h && n < this.maxLines)
      {
        // unused upstream: let cx = 0;
        // unused upstream: let cy = 0;

        c.moveTo(0, i);
        c.lineTo(w, i);

        i = i + step;
        n++;
      }

      c.stroke();
    }

    c.setStrokeColor(strokeColor);
    c.setStrokeWidth(strokeWidth);

    c.begin();
    c.moveTo(0, 0);

    if (getValue(this.style, 'top', '1') == '1')
    {
      c.lineTo(w, 0);
    }
    else
    {
      c.moveTo(w, 0);
    }

    if (getValue(this.style, 'right', '1') == '1')
    {
      c.lineTo(w, h);
    }
    else
    {
      c.moveTo(w, h);
    }

    if (getValue(this.style, 'bottom', '1') == '1')
    {
      c.lineTo(0, h);
    }
    else
    {
      c.moveTo(0, h);
    }

    if (getValue(this.style, 'left', '1') == '1')
    {
      c.lineTo(0, 0);
    }

    c.end();
    c.stroke();
  }

  /** draw.io shapes/mxBasic.js:3757 */
  getConstraints(_style: unknown, _w: number, _h: number): ConnectionConstraint[] {
    const constr = [];

    constr.push(new ConnectionConstraint(new Point(0, 0), false));
    constr.push(new ConnectionConstraint(new Point(0.25, 0), false));
    constr.push(new ConnectionConstraint(new Point(0.5, 0), false));
    constr.push(new ConnectionConstraint(new Point(0.75, 0), false));
    constr.push(new ConnectionConstraint(new Point(1, 0), false));
    constr.push(new ConnectionConstraint(new Point(1, 0.25), false));
    constr.push(new ConnectionConstraint(new Point(1, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(1, 0.75), false));
    constr.push(new ConnectionConstraint(new Point(1, 1), false));
    constr.push(new ConnectionConstraint(new Point(0.75, 1), false));
    constr.push(new ConnectionConstraint(new Point(0.75, 1), false));
    constr.push(new ConnectionConstraint(new Point(0.5, 1), false));
    constr.push(new ConnectionConstraint(new Point(0.25, 1), false));
    constr.push(new ConnectionConstraint(new Point(0, 1), false));
    constr.push(new ConnectionConstraint(new Point(0, 0.75), false));
    constr.push(new ConnectionConstraint(new Point(0, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(0, 0.25), false));

    return (constr);
  }
}

/** Registered draw.io shape names (exact upstream names) -> constructors, in upstream order. */
export const MX_BASIC_SHAPES: ReadonlyArray<readonly [string, ShapeCtor]> = [
  ['mxgraph.basic.cross2', mxShapeBasicCross], // shapes/mxBasic.js:55
  ['mxgraph.basic.rectCallout', mxShapeBasicRectCallout], // shapes/mxBasic.js:138
  ['mxgraph.basic.roundRectCallout', mxShapeBasicRoundRectCallout], // shapes/mxBasic.js:246
  ['mxgraph.basic.wave2', mxShapeBasicWave], // shapes/mxBasic.js:364
  ['mxgraph.basic.octagon2', mxShapeBasicOctagon], // shapes/mxBasic.js:462
  ['mxgraph.basic.isocube', mxShapeBasicIsoCube], // shapes/mxBasic.js:560
  ['mxgraph.basic.acute_triangle', mxShapeBasicTriangleAcute], // shapes/mxBasic.js:644
  ['mxgraph.basic.obtuse_triangle', mxShapeBasicTriangleObtuse], // shapes/mxBasic.js:724
  ['mxgraph.basic.drop', mxShapeBasicDrop], // shapes/mxBasic.js:809
  ['mxgraph.basic.cone2', mxShapeBasicCone2], // shapes/mxBasic.js:875
  ['mxgraph.basic.pyramid', mxShapeBasicPyramid], // shapes/mxBasic.js:984
  ['mxgraph.basic.4_point_star_2', mxShapeBasic4PointStar2], // shapes/mxBasic.js:1110
  ['mxgraph.basic.diag_snip_rect', mxShapeBasicDiagSnipRect], // shapes/mxBasic.js:1197
  ['mxgraph.basic.diag_round_rect', mxShapeBasicDiagRoundRect], // shapes/mxBasic.js:1287
  ['mxgraph.basic.corner_round_rect', mxShapeBasicCornerRoundRect], // shapes/mxBasic.js:1371
  ['mxgraph.basic.plaque', mxShapeBasicPlaque], // shapes/mxBasic.js:1458
  ['mxgraph.basic.frame', mxShapeBasicFrame], // shapes/mxBasic.js:1543
  ['mxgraph.basic.plaque_frame', mxShapeBasicPlaqueFrame], // shapes/mxBasic.js:1668
  ['mxgraph.basic.rounded_frame', mxShapeBasicRoundedFrame], // shapes/mxBasic.js:1770
  ['mxgraph.basic.frame_corner', mxShapeBasicFrameCorner], // shapes/mxBasic.js:1858
  ['mxgraph.basic.diag_stripe', mxShapeBasicDiagStripe], // shapes/mxBasic.js:1947
  ['mxgraph.basic.donut', mxShapeBasicDonut], // shapes/mxBasic.js:2040
  ['mxgraph.basic.layered_rect', mxShapeBasicLayeredRect], // shapes/mxBasic.js:2147
  ['mxgraph.basic.button', mxShapeBasicButton], // shapes/mxBasic.js:2290
  ['mxgraph.basic.shaded_button', mxShapeBasicShadedButton], // shapes/mxBasic.js:2400
  ['mxgraph.basic.pie', mxShapeBasicPie], // shapes/mxBasic.js:2511
  ['mxgraph.basic.arc', mxShapeBasicArc], // shapes/mxBasic.js:2758
  ['mxgraph.basic.partConcEllipse', mxShapeBasicPartConcEllipse], // shapes/mxBasic.js:2895
  ['mxgraph.basic.numberedEntryVert', mxShapeBasicNumEntryVert], // shapes/mxBasic.js:3011
  ['mxgraph.basic.bendingArch', mxShapeBasicBendingArch], // shapes/mxBasic.js:3110
  ['mxgraph.basic.three_corner_round_rect', mxShapeBasicThreeCornerRoundRect], // shapes/mxBasic.js:3227
  ['mxgraph.basic.polygon', mxShapeBasicPolygon], // shapes/mxBasic.js:3343
  ['mxgraph.basic.patternFillRect', mxShapeBasicPatternFillRect], // shapes/mxBasic.js:3755
];

/** draw.io customProperties keyed by shape name (plain data for a properties panel). */
export const MX_BASIC_CUSTOM_PROPERTIES: Readonly<Record<string, CustomProperty[]>> = {
  'mxgraph.basic.rectCallout': mxShapeBasicRectCallout.customProperties,
  'mxgraph.basic.roundRectCallout': mxShapeBasicRoundRectCallout.customProperties,
  'mxgraph.basic.wave2': mxShapeBasicWave.customProperties,
  'mxgraph.basic.octagon2': mxShapeBasicOctagon.customProperties,
  'mxgraph.basic.isocube': mxShapeBasicIsoCube.customProperties,
  'mxgraph.basic.acute_triangle': mxShapeBasicTriangleAcute.customProperties,
  'mxgraph.basic.obtuse_triangle': mxShapeBasicTriangleObtuse.customProperties,
  'mxgraph.basic.cone2': mxShapeBasicCone2.customProperties,
  'mxgraph.basic.pyramid': mxShapeBasicPyramid.customProperties,
  'mxgraph.basic.4_point_star_2': mxShapeBasic4PointStar2.customProperties,
  'mxgraph.basic.diag_snip_rect': mxShapeBasicDiagSnipRect.customProperties,
  'mxgraph.basic.diag_round_rect': mxShapeBasicDiagRoundRect.customProperties,
  'mxgraph.basic.corner_round_rect': mxShapeBasicCornerRoundRect.customProperties,
  'mxgraph.basic.plaque': mxShapeBasicPlaque.customProperties,
  'mxgraph.basic.frame': mxShapeBasicFrame.customProperties,
  'mxgraph.basic.plaque_frame': mxShapeBasicPlaqueFrame.customProperties,
  'mxgraph.basic.rounded_frame': mxShapeBasicRoundedFrame.customProperties,
  'mxgraph.basic.frame_corner': mxShapeBasicFrameCorner.customProperties,
  'mxgraph.basic.diag_stripe': mxShapeBasicDiagStripe.customProperties,
  'mxgraph.basic.donut': mxShapeBasicDonut.customProperties,
  'mxgraph.basic.layered_rect': mxShapeBasicLayeredRect.customProperties,
  'mxgraph.basic.button': mxShapeBasicButton.customProperties,
  'mxgraph.basic.shaded_button': mxShapeBasicShadedButton.customProperties,
  'mxgraph.basic.pie': mxShapeBasicPie.customProperties,
  'mxgraph.basic.arc': mxShapeBasicArc.customProperties,
  'mxgraph.basic.partConcEllipse': mxShapeBasicPartConcEllipse.customProperties,
  'mxgraph.basic.three_corner_round_rect': mxShapeBasicThreeCornerRoundRect.customProperties,
  'mxgraph.basic.polygon': mxShapeBasicPolygon.customProperties,
  'mxgraph.basic.patternFillRect': mxShapeBasicPatternFillRect.customProperties,
};
