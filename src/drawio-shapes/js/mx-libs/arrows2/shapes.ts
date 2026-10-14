/**
 * Copyright (c) 2006-2016, JGraph Holdings Ltd
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG
 * Licensed under the Apache License, Version 2.0 (see NOTICE).
 *
 * Ported from jgraph/drawio v32.4.1 shapes/mxArrows.js
 * Source: https://raw.githubusercontent.com/jgraph/drawio/v32.4.1/src/main/webapp/shapes/mxArrows.js
 *
 * Mechanical port to @maxgraph/core 0.10.3: mxActor -> ActorShape, mxArrow -> ArrowShape,
 * mxUtils.getValue -> getValue (same semantics), mxPoint/mxRectangle/mxConnectionConstraint ->
 * Point/Rectangle/ConnectionConstraint, this.strokewidth -> this.strokeWidth. Drawing code is unchanged.
 */

import { ActorShape, ArrowShape, ConnectionConstraint, Point, Rectangle, constants } from '@maxgraph/core';
import { getValue, type CustomProperty, type DrawioCanvas, type ShapeCtor } from '../compat.js';

/** draw.io shapes/mxArrows.js:11 (mxgraph.arrows2.arrow) */
export class mxShapeArrows2Arrow extends ActorShape {
  static readonly cst = { ARROW : 'mxgraph.arrows2.arrow' } as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx', dispName: 'Arrowhead Length', type: 'float', min: 0, defVal: 40},
    {name: 'dy', dispName: 'Arrow Width', type: 'float', min:0, max:1, defVal: 0.6},
    {name: 'notch', dispName: 'Notch', type: 'float', min:0, defVal: 0},
    {name: 'headCrossline', dispName: 'Head Crossline', type: 'bool', defVal: false},
    {name: 'tailCrossline', dispName: 'Tail Crossline', type: 'bool', defVal: false},
    {name: 'boundedLbl', dispName: 'Bounded Label', type: 'bool', defVal: false}
  ];
  dy = 0.5;
  dx = 0.5;
  notch = 0;

  /** draw.io shapes/mxArrows.js:46 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const dy = h * 0.5 * Math.max(0, Math.min(1, parseFloat(getValue(this.style, 'dy', this.dy))));
    const dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    const notch = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'notch', this.notch))));
    const headCrossline = getValue(this.style, 'headCrossline', false);
    const tailCrossline = getValue(this.style, 'tailCrossline', false);

    c.begin();
    c.moveTo(0, dy);
    c.lineTo(w - dx, dy);
    c.lineTo(w - dx, 0);
    c.lineTo(w, h * 0.5);
    c.lineTo(w - dx, h);
    c.lineTo(w - dx, h - dy);
    c.lineTo(0, h - dy);
    c.lineTo(notch, h * 0.5);
    c.close();
    c.fillAndStroke();

    c.setShadow(false);

    if (headCrossline)
    {
      c.begin();
      c.moveTo(w - dx, dy);
      c.lineTo(w - dx, h - dy);
      c.stroke();
    }

    if (tailCrossline)
    {
      c.begin();
      c.moveTo(notch, dy);
      c.lineTo(notch, h - dy);
      c.stroke();
    }
  }

  /** draw.io shapes/mxArrows.js:87 */
  override getLabelBounds(rect: Rectangle): Rectangle {
    if (getValue(this.style, 'boundedLbl', false))
    {
      const w = rect.width;
      const h = rect.height;

      let dy, dx;
      let direction = this.direction || 'east';

      if (getValue(this.style, 'flipH', false))
      {
        if (direction == 'west')
          direction = 'east';
        else if (direction == 'east')
          direction = 'west';
      }

      if (getValue(this.style, 'flipV', false))
      {
        if (direction == 'north')
          direction = 'south';
        else if (direction == 'south')
          direction = 'north';
      }

      if (direction == 'north'
          || direction == 'south')
      {
        dy = w * 0.5 * Math.max(0, Math.min(1, parseFloat(getValue(this.style, 'dy', this.dy))));
        dx = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dx', this.dx))));
      }
      else
      {
        dy = h * 0.5 * Math.max(0, Math.min(1, parseFloat(getValue(this.style, 'dy', this.dy))));
        dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
      }

      if (direction == 'east')
      {
        return new Rectangle(rect.x, rect.y + dy, w - dx, h - 2 * dy);
      }
      else if (direction == 'west')
      {
        return new Rectangle(rect.x + dx, rect.y + dy, w - dx, h - 2 * dy);
      }
      else if (direction == 'north')
      {
        return new Rectangle(rect.x + dy, rect.y + dx, w - 2 * dy, h - dx);
      }
      else
      {
        return new Rectangle(rect.x + dy, rect.y, w - 2 * dy, h - dx);
      }
    }

    return rect;
  }

  /** draw.io shapes/mxArrows.js:178 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    const dy = h * 0.5 * Math.max(0, Math.min(1, parseFloat(getValue(this.style, 'dy', this.dy))));
    const dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    const notch = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'notch', this.notch))));

    constr.push(new ConnectionConstraint(new Point(1, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(0, 0.5), false, null, notch, 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, h - dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, h - dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, h));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w - dx) * 0.5, dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w - dx) * 0.5, h - dy));

    return (constr);
  }
}

/** draw.io shapes/mxArrows.js:205 (mxgraph.arrows2.twoWayArrow) */
export class mxShapeArrows2TwoWayArrow extends ActorShape {
  static readonly cst = { TWO_WAY_ARROW : 'mxgraph.arrows2.twoWayArrow' } as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx', dispName: 'Arrowhead Length', type: 'float', min:0, defVal: 35},
    {name: 'dy', dispName: 'Arrow Width', type: 'float', min:0, max:1, defVal: 0.6},
    {name: 'boundedLbl', dispName: 'Bounded Label', type: 'bool', defVal: false}
  ];
  constraints: ConnectionConstraint[] | null = null;
  dy = 0.5;
  dx = 0.5;

  /** draw.io shapes/mxArrows.js:236 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const dy = h * 0.5 * Math.max(0, Math.min(1, parseFloat(getValue(this.style, 'dy', this.dy))));
    const dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));

    c.begin();
    c.moveTo(dx, dy);
    c.lineTo(w - dx, dy);
    c.lineTo(w - dx, 0);
    c.lineTo(w, h * 0.5);
    c.lineTo(w - dx, h);
    c.lineTo(w - dx, h - dy);
    c.lineTo(dx, h - dy);
    c.lineTo(dx, h);
    c.lineTo(0, h * 0.5);
    c.lineTo(dx, 0);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxArrows.js:258 */
  override getLabelBounds(rect: Rectangle): Rectangle {
    if (getValue(this.style, 'boundedLbl', false))
    {
      const w = rect.width;
      const h = rect.height;
      const vertical = this.direction == 'north'
              || this.direction == 'south';

      let dy, dx;

      if (vertical)
      {
        dy = w * 0.5 * Math.max(0, Math.min(1, parseFloat(getValue(this.style, 'dy', this.dy))));
        dx = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dx', this.dx))));
      }
      else
      {
        dy = h * 0.5 * Math.max(0, Math.min(1, parseFloat(getValue(this.style, 'dy', this.dy))));
        dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
      }

      if (vertical)
      {
        return new Rectangle(rect.x + dy, rect.y + dx, w - 2 * dy, h - 2 * dx);
      }
      else
      {
        return new Rectangle(rect.x + dx, rect.y + dy, w - 2 * dx, h - 2 * dy);
      }
    }

    return rect;
  }

  /** draw.io shapes/mxArrows.js:315 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    const dy = h * 0.5 * Math.max(0, Math.min(1, parseFloat(getValue(this.style, 'dy', this.dy))));
    const dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));

    constr.push(new ConnectionConstraint(new Point(1, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx, 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx, dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx, h));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx, h - dy));
    constr.push(new ConnectionConstraint(new Point(0, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, h));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, h - dy));
    constr.push(new ConnectionConstraint(new Point(0.5, 0), false, null, 0, dy));
    constr.push(new ConnectionConstraint(new Point(0.5, 0), false, null, 0, h - dy));

    return (constr);
  }
}

/** draw.io shapes/mxArrows.js:343 (mxgraph.arrows2.stylisedArrow) */
export class mxShapeArrows2StylisedArrow extends ActorShape {
  static readonly cst = { STYLISED_ARROW : 'mxgraph.arrows2.stylisedArrow' } as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx', dispName: 'Arrowhead Length', type: 'float', min:0, defVal:40},
    {name: 'dy', dispName: 'Arrow Width', type: 'float', min:0, max:1, defVal:0.6},
    {name: 'notch', dispName: 'Notch', type: 'float', min:0, defVal:0},
    {name: 'feather', dispName: 'Feather', type: 'float', min:0, max:1, defVal:0.4},
  ];
  constraints: ConnectionConstraint[] | null = null;
  dy = 0.5;
  dx = 0.5;
  notch = 0;
  feather = 0.5;

  /** draw.io shapes/mxArrows.js:377 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const dy = h * 0.5 * Math.max(0, Math.min(1, parseFloat(getValue(this.style, 'dy', this.dy))));
    const dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    const notch = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'notch', this.notch))));
    const feather = h * 0.5 * Math.max(0, Math.min(1, parseFloat(getValue(this.style, 'feather', this.feather))));

    c.begin();
    c.moveTo(0, feather);
    c.lineTo(w - dx, dy);
    c.lineTo(w - dx - 10, 0);
    c.lineTo(w, h * 0.5);
    c.lineTo(w - dx - 10, h);
    c.lineTo(w - dx, h - dy);
    c.lineTo(0, h - feather);
    c.lineTo(notch, h * 0.5);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxArrows.js:445 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    const dy = h * 0.5 * Math.max(0, Math.min(1, parseFloat(getValue(this.style, 'dy', this.dy))));
    const dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    const notch = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'notch', this.notch))));
    const feather = h * 0.5 * Math.max(0, Math.min(1, parseFloat(getValue(this.style, 'feather', this.feather))));

    constr.push(new ConnectionConstraint(new Point(1, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(0, 0.5), false, null, notch, 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, feather));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, h - feather));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx - 10, 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, h - dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx - 10, h));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w - dx) * 0.5, (dy + feather) * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w - dx) * 0.5, h - (dy + feather) * 0.5));

    return (constr);
  }
}

/** draw.io shapes/mxArrows.js:473 (mxgraph.arrows2.sharpArrow) */
export class mxShapeArrows2SharpArrow extends ActorShape {
  static readonly cst = { SHARP_ARROW : 'mxgraph.arrows2.sharpArrow' } as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx1', dispName: 'Arrowhead Arrow Width', type: 'float', min:0, defVal:18},
    {name: 'dy1', dispName: 'Arrow Arrow Width', type: 'float', min:0, max:1, defVal:0.67},
    {name: 'dx2', dispName: 'Arrowhead Angle', type: 'float', min:0, defVal:18},
    {name: 'notch', dispName: 'Notch', type: 'float', min:0, defVal:0}
  ];
  constraints: ConnectionConstraint[] | null = null;
  dy1 = 0.5;
  dx1 = 0.5;
  dx2 = 0.5;
  notch = 0;

  /** draw.io shapes/mxArrows.js:507 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const dy1 = h * 0.5 * Math.max(0, Math.min(1, parseFloat(getValue(this.style, 'dy1', this.dy1))));
    const dx1 = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx1', this.dx1))));
    const dx2 = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx2', this.dx2))));
    const notch = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'notch', this.notch))));
    const dx1a = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx1', this.dx1))));
    const dy1a = h * 0.5 * Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy1', this.dy1))));
    let x2 = 0;

    if (h != 0)
    {
      x2 = dx1a + dx2 * dy1a * 2 / h;
    }

    c.begin();
    c.moveTo(0, dy1);
    c.lineTo(w - dx1, dy1);
    c.lineTo(w - x2, 0);
    c.lineTo(w - dx2, 0);
    c.lineTo(w, h * 0.5);
    c.lineTo(w - dx2, h);
    c.lineTo(w - x2, h);
    c.lineTo(w - dx1, h - dy1);
    c.lineTo(0, h - dy1);
    c.lineTo(notch, h * 0.5);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxArrows.js:584 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    const dy1 = h * 0.5 * Math.max(0, Math.min(1, parseFloat(getValue(this.style, 'dy1', this.dy1))));
    const dx1 = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx1', this.dx1))));
    const dx2 = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx2', this.dx2))));
    const notch = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'notch', this.notch))));
    const dx1a = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx1', this.dx1))));
    const dy1a = h * 0.5 * Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy1', this.dy1))));
    let x2 = 0;

    if (h != 0)
    {
      x2 = dx1a + dx2 * dy1a * 2 / h;
    }

    constr.push(new ConnectionConstraint(new Point(1, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(0, 0.5), false, null, notch, 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, dy1));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx1, dy1));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - x2, 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx2, 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, h - dy1));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx1, h - dy1));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - x2, h));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx2, h));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w - dx1) * 0.5, dy1));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w - dx1) * 0.5, h - dy1));

    return (constr);
  }
}

/** draw.io shapes/mxArrows.js:622 (mxgraph.arrows2.sharpArrow2) */
export class mxShapeArrows2SharpArrow2 extends ActorShape {
  static readonly cst = { SHARP_ARROW2 : 'mxgraph.arrows2.sharpArrow2' } as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx1', dispName: 'Arrowhead Arrow Width', type: 'float', min:0, defVal:18},
    {name: 'dy1', dispName: 'Arrow Width', type: 'float', min:0, max:1, defVal:0.67},
    {name: 'dx2', dispName: 'Arrowhead Angle', type: 'float', min:0, defVal:18},
    {name: 'dx3', dispName: 'Arrowhead Edge X', type: 'float', min:0, defVal:27},
    {name: 'dy3', dispName: 'Arrowhead Edge Y', type: 'float', min:0, max:1, defVal:0.15},
    {name: 'notch', dispName: 'Notch', type: 'float', min:0, defVal:0}
  ];
  constraints: ConnectionConstraint[] | null = null;
  dy1 = 0.5;
  dx1 = 0.5;
  dx2 = 0.5;
  dy3 = 0.5;
  dx3 = 0.5;
  notch = 0;

  /** draw.io shapes/mxArrows.js:661 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const dy1 = h * 0.5 * Math.max(0, Math.min(1, parseFloat(getValue(this.style, 'dy1', this.dy1))));
    const dx1 = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx1', this.dx1))));
    const dx2 = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx2', this.dx2))));
    const dy3 = h * 0.5 * Math.max(0, Math.min(1, parseFloat(getValue(this.style, 'dy3', this.dy3))));
    const dx3 = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx3', this.dx3))));
    const notch = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'notch', this.notch))));
    // unused upstream: let dx1a = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx1', this.dx1))));
    // unused upstream: let dy1a = h * 0.5 * Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy1', this.dy1))));

    c.begin();
    c.moveTo(0, dy1);
    c.lineTo(w - dx1, dy1);
    c.lineTo(w - dx3, dy3);
    c.lineTo(w - dx2, 0);
    c.lineTo(w, h * 0.5);
    c.lineTo(w - dx2, h);
    c.lineTo(w - dx3, h - dy3);
    c.lineTo(w - dx1, h - dy1);
    c.lineTo(0, h - dy1);
    c.lineTo(notch, h * 0.5);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxArrows.js:748 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    const dy1 = h * 0.5 * Math.max(0, Math.min(1, parseFloat(getValue(this.style, 'dy1', this.dy1))));
    const dx1 = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx1', this.dx1))));
    const dx2 = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx2', this.dx2))));
    const dy3 = h * 0.5 * Math.max(0, Math.min(1, parseFloat(getValue(this.style, 'dy3', this.dy3))));
    const dx3 = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx3', this.dx3))));
    const notch = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'notch', this.notch))));
    // unused upstream: let dx1a = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx1', this.dx1))));
    // unused upstream: let dy1a = h * 0.5 * Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy1', this.dy1))));

    constr.push(new ConnectionConstraint(new Point(1, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(0, 0.5), false, null, notch, 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, dy1));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx1, dy1));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx3, dy3));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx2, 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, h - dy1));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx1, h - dy1));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx3, h - dy3));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx2, h));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w - dx1) * 0.5, dy1));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w - dx1) * 0.5, h - dy1));

    return (constr);
  }
}

/** draw.io shapes/mxArrows.js:782 (mxgraph.arrows2.calloutArrow) */
export class mxShapeArrows2CalloutArrow extends ActorShape {
  static readonly cst = { CALLOUT_ARROW : 'mxgraph.arrows2.calloutArrow' } as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx', dispName: 'Arrowhead Length', type: 'float', min:0, defVal:20},
    {name: 'arrowHead', dispName: 'Arrowhead Width', type: 'float', min:0, defVal:10},
    {name: 'dy', dispName: 'Arrow Width', type: 'float', min:0, defVal:10},
    {name: 'notch', dispName: 'Rectangle Width', type: 'float', min:0, defVal:60}
  ];
  constraints: ConnectionConstraint[] | null = null;
  dy = 0.5;
  dx = 0.5;
  notch = 0;
  arrowHead = 0;

  /** draw.io shapes/mxArrows.js:816 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const dy = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy', this.dy))));
    const dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    const notch = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'notch', this.notch))));
    const arrowHead = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'arrowHead', this.arrowHead))));

    c.begin();
    c.moveTo(0, 0);
    c.lineTo(notch, 0);
    c.lineTo(notch, h * 0.5 - dy);
    c.lineTo(w - dx, h * 0.5 - dy);
    c.lineTo(w - dx, h * 0.5 - dy - arrowHead);
    c.lineTo(w, h * 0.5);
    c.lineTo(w - dx, h * 0.5 + dy + arrowHead);
    c.lineTo(w - dx, h * 0.5 + dy);
    c.lineTo(notch, h * 0.5 + dy);
    c.lineTo(notch, h);
    c.lineTo(0, h);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxArrows.js:890 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    const dy = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy', this.dy))));
    const dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    const notch = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'notch', this.notch))));
    const arrowHead = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'arrowHead', this.arrowHead))));

    constr.push(new ConnectionConstraint(new Point(0, 0), false));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, notch, 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null,notch, h * 0.5 - dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, h * 0.5 - dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, h * 0.5 - dy - arrowHead));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w, h * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, h * 0.5 + dy + arrowHead));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, h * 0.5 + dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, notch, h * 0.5 + dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, notch, h));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, h));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, notch * 0.5 , 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, notch * 0.5 , h));
    constr.push(new ConnectionConstraint(new Point(0, 0.5), false, null, (notch + w - dx) * 0.5, -dy));
    constr.push(new ConnectionConstraint(new Point(0, 0.5), false, null, (notch + w - dx) * 0.5, dy));

    return (constr);
  }
}

/** draw.io shapes/mxArrows.js:923 (mxgraph.arrows2.bendArrow) */
export class mxShapeArrows2BendArrow extends ActorShape {
  static readonly cst = { BEND_ARROW : 'mxgraph.arrows2.bendArrow' } as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx', dispName: 'Arrowhead Length', type: 'float', min:0, defVal: 38},
    {name: 'dy', dispName: 'Arrow Width', type: 'float', min:0, defVal: 15},
    {name: 'notch', dispName: 'Notch', type: 'float', min:0, defVal: 0},
    {name: 'arrowHead', dispName: 'Arrowhead Width', type: 'float', min:0, defVal:55},
    {name: 'rounded', dispName: 'Rounded', type: 'boolean', defVal: false}
  ];
  constraints: ConnectionConstraint[] | null = null;
  dy = 0.5;
  dx = 0.5;
  notch = 0;
  arrowHead = 40;

  /** draw.io shapes/mxArrows.js:958 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const dy = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy', this.dy))));
    const dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    const notch = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'notch', this.notch))));
    const arrowHead = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'arrowHead', this.arrowHead))));
    const rounded = getValue(this.style, 'rounded', '0');

    c.begin();
    c.moveTo(w - dx, 0);
    c.lineTo(w, arrowHead * 0.5);
    c.lineTo(w - dx, arrowHead);
    c.lineTo(w - dx, arrowHead / 2 + dy);

    if (rounded == '1')
    {
      c.lineTo(dy * 2.2, arrowHead / 2 + dy);
      c.arcTo(dy * 0.2, dy * 0.2, 0, 0, 0, dy * 2, arrowHead / 2 + dy * 1.2);
    }
    else
    {
      c.lineTo(dy * 2, arrowHead / 2 + dy);
    }

    c.lineTo(dy * 2, h);
    c.lineTo(dy, h - notch);
    c.lineTo(0, h);

    if (rounded == '1')
    {
      c.lineTo(0, arrowHead / 2 + dy);
      c.arcTo(dy * 2, dy * 2, 0, 0, 1, dy * 2, arrowHead / 2 - dy);
    }
    else
    {
      c.lineTo(0, arrowHead / 2 - dy);
    }

    c.lineTo(w - dx, arrowHead / 2 - dy);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxArrows.js:1054 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    const dy = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy', this.dy))));
    const dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    const notch = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'notch', this.notch))));
    const arrowHead = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'arrowHead', this.arrowHead))));
    const rounded = getValue(this.style, 'rounded', '0');

    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w - dx + dy * 2) * 0.5, arrowHead / 2 - dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, arrowHead / 2 - dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w, arrowHead * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, arrowHead));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, arrowHead / 2 + dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w - dx + dy * 2) * 0.5, arrowHead / 2 + dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dy * 2, (h - arrowHead / 2 - dy) * 0.5 + arrowHead / 2 + dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dy * 2, h));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dy, h - notch));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, h));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, (h - arrowHead / 2 - dy) * 0.5 + arrowHead / 2 + dy));

    if (rounded == '1')
    {
      constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dy * 0.586, arrowHead / 2 - dy * 0.414));
      constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 2 * dy  + dy * 0.0586, arrowHead / 2 + dy + dy * 0.0586));
    }
    else
    {
      constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, arrowHead / 2 - dy));
      constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dy * 2, arrowHead / 2 + dy));
    }

    return (constr);
  }
}

/** draw.io shapes/mxArrows.js:1096 (mxgraph.arrows2.bendDoubleArrow) */
export class mxShapeArrows2BendDoubleArrow extends ActorShape {
  static readonly cst = { BEND_DOUBLE_ARROW : 'mxgraph.arrows2.bendDoubleArrow' } as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx', dispName: 'Arrowhead Length', type: 'float', min:0, defVal:38},
    {name: 'dy', dispName: 'Arrow Width', type: 'float', min:0, defVal:15},
    {name: 'arrowHead', dispName: 'Arrowhead Width', type: 'float', min:0, defVal:55},
    {name: 'rounded', dispName: 'Rounded', type: 'boolean', defVal:false}
  ];
  constraints: ConnectionConstraint[] | null = null;
  dy = 0.5;
  dx = 0.5;
  notch = 0;
  arrowHead = 40;

  /** draw.io shapes/mxArrows.js:1130 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const dy = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy', this.dy))));
    const dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    const arrowHead = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'arrowHead', this.arrowHead))));
    const rounded = getValue(this.style, 'rounded', '0');

    c.begin();
    c.moveTo(w - dx, 0);
    c.lineTo(w, arrowHead * 0.5);
    c.lineTo(w - dx, arrowHead);
    c.lineTo(w - dx, arrowHead / 2 + dy);

    if (rounded == '1')
    {
      c.lineTo(arrowHead / 2 + dy * 1.2, arrowHead / 2 + dy);
      c.arcTo(dy * 0.2, dy * 0.2, 0, 0, 0, arrowHead /2 + dy, arrowHead / 2 + dy * 1.2);
    }
    else
    {
      c.lineTo(arrowHead / 2 + dy, arrowHead / 2 + dy);
    }

    c.lineTo(arrowHead / 2 + dy, h - dx);
    c.lineTo(arrowHead, h - dx);
    c.lineTo(arrowHead / 2, h);
    c.lineTo(0, h - dx);
    c.lineTo(arrowHead / 2 - dy, h - dx);

    if (rounded == '1')
    {
      c.lineTo(arrowHead / 2 - dy, arrowHead / 2 + dy);
      c.arcTo(dy * 2, dy * 2, 0, 0, 1, arrowHead / 2 + dy, arrowHead / 2 - dy);
    }
    else
    {
      c.lineTo(arrowHead / 2 - dy, arrowHead / 2 - dy);
    }

    c.lineTo(w - dx, arrowHead / 2 - dy);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxArrows.js:1212 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    const dy = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy', this.dy))));
    const dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    const arrowHead = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'arrowHead', this.arrowHead))));
    const rounded = getValue(this.style, 'rounded', '0');

    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx , 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w, arrowHead * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, arrowHead));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, arrowHead / 2 + dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (arrowHead / 2 + dy + w - dx) * 0.5, arrowHead / 2 + dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (arrowHead / 2 + dy + w - dx) * 0.5, arrowHead / 2 - dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, arrowHead / 2 + dy, (arrowHead / 2 + dy + h - dx) * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, arrowHead / 2 - dy, (arrowHead / 2 + dy + h - dx) * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, arrowHead / 2 + dy, h - dx));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, arrowHead, h - dx));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, arrowHead / 2, h));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, h - dx));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, arrowHead / 2 - dy, h - dx));

    if (rounded == '1')
    {
      constr.push(new ConnectionConstraint(new Point(0, 0), false, null, arrowHead / 2 - dy * 0.414, arrowHead / 2 - dy * 0.414));
      constr.push(new ConnectionConstraint(new Point(0, 0), false, null, arrowHead / 2 + dy + dy * 0.0586, arrowHead / 2 + dy + dy * 0.0586));
    }
    else
    {
      constr.push(new ConnectionConstraint(new Point(0, 0), false, null, arrowHead / 2 - dy, arrowHead / 2 - dy));
      constr.push(new ConnectionConstraint(new Point(0, 0), false, null, arrowHead / 2 + dy, arrowHead / 2 + dy));
    }

    return (constr);
  }
}

/** draw.io shapes/mxArrows.js:1254 (mxgraph.arrows2.calloutDoubleArrow) */
export class mxShapeArrows2CalloutDoubleArrow extends ActorShape {
  static readonly cst = { CALLOUT_DOUBLE_ARROW : 'mxgraph.arrows2.calloutDoubleArrow' } as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx', dispName: 'Arrowhead Length', type: 'float', min:0, defVal:20},
    {name: 'dy', dispName: 'Arrow Width', type: 'float', min:0, defVal:10},
    {name: 'arrowHead', dispName: 'Arrowhead Width', type: 'float', min:0, defVal:10},
    {name: 'notch', dispName: 'Rect Size', type: 'float', min:0, defVal:24}
  ];
  constraints: ConnectionConstraint[] | null = null;
  dy = 0.5;
  dx = 0.5;
  notch = 0;
  arrowHead = 0;

  /** draw.io shapes/mxArrows.js:1288 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const dy = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy', this.dy))));
    const dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    const notch = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'notch', this.notch))));
    const arrowHead = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'arrowHead', this.arrowHead))));

    c.begin();
    c.moveTo(w / 2 - notch, 0);
    c.lineTo(w / 2 + notch, 0);
    c.lineTo(w / 2 + notch, h * 0.5 - dy);
    c.lineTo(w - dx, h * 0.5 - dy);
    c.lineTo(w - dx, h * 0.5 - dy - arrowHead);
    c.lineTo(w, h * 0.5);
    c.lineTo(w - dx, h * 0.5 + dy + arrowHead);
    c.lineTo(w - dx, h * 0.5 + dy);
    c.lineTo(w / 2 + notch, h * 0.5 + dy);
    c.lineTo(w / 2 + notch, h);
    c.lineTo(w / 2 - notch, h);
    c.lineTo(w / 2 - notch, h * 0.5 + dy);
    c.lineTo(dx, h * 0.5 + dy);
    c.lineTo(dx, h * 0.5 + dy + arrowHead);
    c.lineTo(0, h * 0.5);
    c.lineTo(dx, h * 0.5 - dy - arrowHead);
    c.lineTo(dx, h * 0.5 - dy);
    c.lineTo(w / 2 - notch, h * 0.5 - dy);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxArrows.js:1369 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    const dy = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy', this.dy))));
    const dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    const notch = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'notch', this.notch))));
    const arrowHead = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'arrowHead', this.arrowHead))));

    constr.push(new ConnectionConstraint(new Point(0.5, 0), false));
    constr.push(new ConnectionConstraint(new Point(0.5, 1), false));
    constr.push(new ConnectionConstraint(new Point(0, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(1, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w / 2 - notch, 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w / 2 + notch, 0));
    constr.push(new ConnectionConstraint(new Point(0, 1), false, null, w / 2 - notch, 0));
    constr.push(new ConnectionConstraint(new Point(0, 1), false, null, w / 2 + notch, 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, h * 0.5 - dy - arrowHead));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, h * 0.5 + dy + arrowHead));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx, h * 0.5 - dy - arrowHead));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx, h * 0.5 + dy + arrowHead));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w * 1.5 - dx + notch) * 0.5, h * 0.5 - dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w * 1.5 - dx + notch) * 0.5, h * 0.5 + dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w * 0.5 + dx - notch) * 0.5, h * 0.5 - dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w * 0.5 + dx - notch) * 0.5, h * 0.5 + dy));

    return (constr);
  }
}

/** draw.io shapes/mxArrows.js:1403 (mxgraph.arrows2.calloutQuadArrow) */
export class mxShapeArrows2CalloutQuadArrow extends ActorShape {
  static readonly cst = { CALLOUT_QUAD_ARROW : 'mxgraph.arrows2.calloutQuadArrow' } as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx', dispName: 'Arrowhead Length', type: 'float', min:0, defVal:20},
    {name: 'dy', dispName: 'Arrow Width', type: 'float', min:0, defVal: 10},
    {name: 'notch', dispName: 'Rect Size', type: 'float', min:0, defVal:24},
    {name: 'arrowHead', dispName: 'Arrowhead Width', type: 'float', min:0, defVal:10}
  ];
  constraints: ConnectionConstraint[] | null = null;
  dy = 0.5;
  dx = 0.5;
  notch = 0;
  arrowHead = 0;

  /** draw.io shapes/mxArrows.js:1437 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const dy = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy', this.dy))));
    const dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    const notch = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'notch', this.notch))));
    const arrowHead = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'arrowHead', this.arrowHead))));

    c.begin();
    c.moveTo(w * 0.5 + dy, h * 0.5 - notch);
    c.lineTo(w * 0.5 + notch, h * 0.5 - notch);
    c.lineTo(w * 0.5 + notch, h * 0.5 - dy);
    c.lineTo(w - dx, h * 0.5 - dy);
    c.lineTo(w - dx, h * 0.5 - dy - arrowHead);
    c.lineTo(w, h * 0.5);
    c.lineTo(w - dx, h * 0.5 + dy + arrowHead);
    c.lineTo(w - dx, h * 0.5 + dy);
    c.lineTo(w * 0.5 + notch, h * 0.5 + dy);
    c.lineTo(w * 0.5 + notch, h * 0.5 + notch);
    c.lineTo(w * 0.5 + dy, h * 0.5 + notch);
    c.lineTo(w * 0.5 + dy, h - dx);
    c.lineTo(w * 0.5 + dy + arrowHead, h - dx);
    c.lineTo(w * 0.5, h);
    c.lineTo(w * 0.5 - dy - arrowHead, h - dx);
    c.lineTo(w * 0.5 - dy, h - dx);
    c.lineTo(w * 0.5 - dy, h * 0.5 + notch);
    c.lineTo(w * 0.5 - notch, h * 0.5 + notch);
    c.lineTo(w * 0.5 - notch, h * 0.5 + dy);
    c.lineTo(dx, h * 0.5 + dy);
    c.lineTo(dx, h * 0.5 + dy + arrowHead);
    c.lineTo(0, h * 0.5);
    c.lineTo(dx, h * 0.5 - dy - arrowHead);
    c.lineTo(dx, h * 0.5 - dy);
    c.lineTo(w * 0.5 - notch, h * 0.5 - dy);
    c.lineTo(w * 0.5 - notch, h * 0.5 - notch);
    c.lineTo(w * 0.5 - dy, h * 0.5 - notch);
    c.lineTo(w * 0.5 - dy, dx);
    c.lineTo(w * 0.5 - dy - arrowHead, dx);
    c.lineTo(w * 0.5, 0);
    c.lineTo(w * 0.5 + dy + arrowHead, dx);
    c.lineTo(w * 0.5 + dy, dx);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxArrows.js:1532 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    const dy = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy', this.dy))));
    const dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    const notch = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'notch', this.notch))));
    const arrowHead = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'arrowHead', this.arrowHead))));

    constr.push(new ConnectionConstraint(new Point(0.5, 0), false));
    constr.push(new ConnectionConstraint(new Point(0.5, 1), false));
    constr.push(new ConnectionConstraint(new Point(0, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(1, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5 + dy, h * 0.5 - notch));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5 + notch, h * 0.5 - notch));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5 + notch, h * 0.5 - dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5 + dy, h * 0.5 + notch));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5 + notch, h * 0.5 + notch));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5 + notch, h * 0.5 + dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5 - dy, h * 0.5 + notch));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5 - notch, h * 0.5 + notch));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5 - notch, h * 0.5 + dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5 - dy, h * 0.5 - notch));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5 - notch, h * 0.5 - notch));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5 - notch, h * 0.5 - dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, h * 0.5 - dy - arrowHead));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, h * 0.5 + dy + arrowHead));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5 - dy - arrowHead, h - dx));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5 + dy + arrowHead, h - dx));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx, h * 0.5 - dy - arrowHead));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx, h * 0.5 + dy + arrowHead));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5 - dy - arrowHead, dx));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5 + dy + arrowHead, dx));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.75 + (notch - dx) * 0.5, h * 0.5 - dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.75 + (notch - dx) * 0.5, h * 0.5 + dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5 - dy, h * 0.75 + (notch - dx) * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5 + dy, h * 0.75 + (notch - dx) * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.25 - (notch - dx) * 0.5, h * 0.5 - dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.25 - (notch - dx) * 0.5, h * 0.5 + dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5 - dy, h * 0.25 - (notch - dx) * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5 + dy, h * 0.25 - (notch - dx) * 0.5));

    return (constr);
  }
}

/** draw.io shapes/mxArrows.js:1582 (mxgraph.arrows2.calloutDouble90Arrow) */
export class mxShapeArrows2CalloutDouble90Arrow extends ActorShape {
  static readonly cst = { CALLOUT_DOUBLE_90_ARROW : 'mxgraph.arrows2.calloutDouble90Arrow' } as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx1', dispName: 'Arrowhead Length', type: 'float', min:0, defVal:20},
    {name: 'dy1', dispName: 'Arrow Width', type: 'float', min:0, defVal: 10},
    {name: 'dx2', dispName: 'Callout Width', type: 'float', min:0, defVal:70},
    {name: 'dy2', dispName: 'Callout Height', type: 'float', min:0, defVal:70},
    {name: 'arrowHead', dispName: 'ArrowHead Width', type: 'float', min:0, defVal:10}
  ];
  constraints: ConnectionConstraint[] | null = null;
  dy1 = 0.5;
  dx1 = 0.5;
  dx2 = 0;
  dy2 = 0;
  arrowHead = 0;

  /** draw.io shapes/mxArrows.js:1618 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const dy1 = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy1', this.dy1))));
    const dx1 = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx1', this.dx1))));
    const dx2 = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx2', this.dx2))));
    const dy2 = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dy2', this.dy2))));
    const arrowHead = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'arrowHead', this.arrowHead))));

    c.begin();
    c.moveTo(0, 0);
    c.lineTo(dx2, 0);
    c.lineTo(dx2, dy2 * 0.5 - dy1);
    c.lineTo(w - dx1, dy2 * 0.5 - dy1);
    c.lineTo(w - dx1, dy2 * 0.5 - dy1 - arrowHead);
    c.lineTo(w, dy2 * 0.5);
    c.lineTo(w - dx1, dy2 * 0.5 + dy1 + arrowHead);
    c.lineTo(w - dx1, dy2 * 0.5 + dy1);
    c.lineTo(dx2, dy2 * 0.5 + dy1);
    c.lineTo(dx2, dy2);
    c.lineTo(dx2 / 2 + dy1, dy2);
    c.lineTo(dx2 / 2 + dy1, h - dx1);
    c.lineTo(dx2 / 2 + dy1 + arrowHead, h - dx1);
    c.lineTo(dx2 / 2, h);
    c.lineTo(dx2 / 2 - dy1 - arrowHead, h - dx1);
    c.lineTo(dx2 / 2 - dy1, h - dx1);
    c.lineTo(dx2 / 2 - dy1, dy2);
    c.lineTo(0, dy2);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxArrows.js:1702 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    const dy1 = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy1', this.dy1))));
    const dx1 = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx1', this.dx1))));
    const dx2 = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx2', this.dx2))));
    const dy2 = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dy2', this.dy2))));
    const arrowHead = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'arrowHead', this.arrowHead))));

    constr.push(new ConnectionConstraint(new Point(0, 0), false));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx2 * 0.5, 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx2, 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w - dx1 + dx2) * 0.5, dy2 * 0.5 - dy1));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx1, dy2 * 0.5 - dy1 - arrowHead));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w, dy2 * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx1, dy2 * 0.5 + dy1 + arrowHead));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w - dx1 + dx2) * 0.5, dy2 * 0.5 + dy1));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx2, dy2));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx2 * 0.5 + dy1, (h - dx1 + dy2) * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx2 * 0.5 - dy1, (h - dx1 + dy2) * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx2 / 2 + dy1 + arrowHead, h - dx1));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx2 / 2, h));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx2 / 2 - dy1 - arrowHead, h - dx1));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, dy2));

    return (constr);
  }
}

/** draw.io shapes/mxArrows.js:1736 (mxgraph.arrows2.quadArrow) */
export class mxShapeArrows2QuadArrow extends ActorShape {
  static readonly cst = { QUAD_ARROW : 'mxgraph.arrows2.quadArrow' } as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx', dispName: 'Arrowhead Length', type: 'float', min:0, defVal:20},
    {name: 'dy', dispName: 'Arrow Width', type: 'float', min:0, defVal:10},
    {name: 'arrowHead', dispName: 'Arrowhead Width', type: 'float', min:0, defVal:10}
  ];
  constraints: ConnectionConstraint[] | null = null;
  dy = 0.5;
  dx = 0.5;
  notch = 0;
  arrowHead = 0;

  /** draw.io shapes/mxArrows.js:1769 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const dy = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy', this.dy))));
    const dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    const arrowHead = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'arrowHead', this.arrowHead))));

    c.begin();
    c.moveTo(w * 0.5 + dy, h * 0.5 - dy);
    c.lineTo(w - dx, h * 0.5 - dy);
    c.lineTo(w - dx, h * 0.5 - dy - arrowHead);
    c.lineTo(w, h * 0.5);
    c.lineTo(w - dx, h * 0.5 + dy + arrowHead);
    c.lineTo(w - dx, h * 0.5 + dy);
    c.lineTo(w * 0.5 + dy, h * 0.5 + dy);
    c.lineTo(w * 0.5 + dy, h - dx);
    c.lineTo(w * 0.5 + dy + arrowHead, h - dx);
    c.lineTo(w * 0.5, h);
    c.lineTo(w * 0.5 - dy - arrowHead, h - dx);
    c.lineTo(w * 0.5 - dy, h - dx);
    c.lineTo(w * 0.5 - dy, h * 0.5 + dy);
    c.lineTo(dx, h * 0.5 + dy);
    c.lineTo(dx, h * 0.5 + dy + arrowHead);
    c.lineTo(0, h * 0.5);
    c.lineTo(dx, h * 0.5 - dy - arrowHead);
    c.lineTo(dx, h * 0.5 - dy);
    c.lineTo(w * 0.5 - dy, h * 0.5 - dy);
    c.lineTo(w * 0.5 - dy, dx);
    c.lineTo(w * 0.5 - dy - arrowHead, dx);
    c.lineTo(w * 0.5, 0);
    c.lineTo(w * 0.5 + dy + arrowHead, dx);
    c.lineTo(w * 0.5 + dy, dx);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxArrows.js:1843 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    const dy = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy', this.dy))));
    const dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    const arrowHead = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'arrowHead', this.arrowHead))));

    constr.push(new ConnectionConstraint(new Point(0.5, 0), false));
    constr.push(new ConnectionConstraint(new Point(0.5, 1), false));
    constr.push(new ConnectionConstraint(new Point(0, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(1, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, h * 0.5 - dy - arrowHead));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, h * 0.5 + dy + arrowHead));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx, h * 0.5 - dy - arrowHead));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx, h * 0.5 + dy + arrowHead));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5 - dy - arrowHead, dx));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5 + dy + arrowHead, dx));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5 - dy - arrowHead, h - dx));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5 + dy + arrowHead, h - dx));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5 - dy, (dx - dy) * 0.5 + h * 0.25));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5 + dy, (dx - dy) * 0.5 + h * 0.25));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5 - dy, (dy - dx) * 0.5 + h * 0.75));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5 + dy, (dy - dx) * 0.5 + h * 0.75));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (dx - dy) * 0.5 + w * 0.25, h * 0.5 - dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (dx - dy) * 0.5 + w * 0.25, h * 0.5 + dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (dy - dx) * 0.5 + w * 0.75, h * 0.5 - dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (dy - dx) * 0.5 + w * 0.75, h * 0.5 + dy));

    return (constr);
  }
}

/** draw.io shapes/mxArrows.js:1880 (mxgraph.arrows2.triadArrow) */
export class mxShapeArrows2TriadArrow extends ActorShape {
  static readonly cst = { TRIAD_ARROW : 'mxgraph.arrows2.triadArrow' } as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx', dispName: 'Arrowhead Length', type: 'float', min:0, defVal:20},
    {name: 'dy', dispName: 'Arrow Width', type: 'float', min:0, defVal:10},
    {name: 'arrowHead', dispName: 'Arrowhead Width', type: 'float', min:0, defVal:40}
  ];
  constraints: ConnectionConstraint[] | null = null;
  dy = 0.5;
  dx = 0.5;
  arrowHead = 0;

  /** draw.io shapes/mxArrows.js:1912 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const dy = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy', this.dy))));
    const dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    const arrowHead = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'arrowHead', this.arrowHead))));

    c.begin();
    c.moveTo(w * 0.5 + arrowHead * 0.5 - dy, h - arrowHead + dy);
    c.lineTo(w - dx, h - arrowHead + dy);
    c.lineTo(w - dx, h - arrowHead);
    c.lineTo(w, h - arrowHead * 0.5);
    c.lineTo(w - dx, h);
    c.lineTo(w - dx, h - dy);
    c.lineTo(dx, h - dy);
    c.lineTo(dx, h);
    c.lineTo(0, h - arrowHead * 0.5);
    c.lineTo(dx, h - arrowHead);
    c.lineTo(dx, h - arrowHead + dy);
    c.lineTo(w * 0.5 - arrowHead * 0.5 + dy, h - arrowHead + dy);
    c.lineTo(w * 0.5 - arrowHead * 0.5 + dy, dx);
    c.lineTo(w * 0.5 - arrowHead * 0.5, dx);
    c.lineTo(w * 0.5, 0);
    c.lineTo(w * 0.5 + arrowHead * 0.5, dx);
    c.lineTo(w * 0.5 + arrowHead * 0.5 - dy, dx);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxArrows.js:1979 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    const dy = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy', this.dy))));
    const dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    const arrowHead = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'arrowHead', this.arrowHead))));

    constr.push(new ConnectionConstraint(new Point(0.5, 0), false, null, - arrowHead * 0.5, dx));
    constr.push(new ConnectionConstraint(new Point(0.5, 0), false));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5, h - dy));
    constr.push(new ConnectionConstraint(new Point(0.5, 0), false, null, arrowHead * 0.5, dx));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, h - arrowHead));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w, h - arrowHead * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, h));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx, h - arrowHead));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, h - arrowHead * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx, h));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w * 1.5 - dx + arrowHead * 0.5 - dy) * 0.5, h - arrowHead + dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w * 1.5 - dx + arrowHead * 0.5 - dy) * 0.5, h - dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w * 0.5 + dx - arrowHead * 0.5 + dy) * 0.5, h - arrowHead + dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w * 0.5 + dx - arrowHead * 0.5 + dy) * 0.5, h - dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5 - arrowHead * 0.5 + dy, (dx + h - arrowHead + dy) * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w * 0.5 + arrowHead * 0.5 - dy, (dx + h - arrowHead + dy) * 0.5));

    return (constr);
  }
}

/** draw.io shapes/mxArrows.js:2012 (mxgraph.arrows2.tailedArrow) */
export class mxShapeArrows2TailedArrow extends ActorShape {
  static readonly cst = { TAILED_ARROW : 'mxgraph.arrows2.tailedArrow' } as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx1', dispName: 'Arrowhead Length', type: 'float', min:0, defVal: 20},
    {name: 'dy1', dispName: 'Arrow Width', type: 'float', min:0, defVal: 10},
    {name: 'dx2', dispName: 'Tail Length', type: 'float', min:0, defVal: 25},
    {name: 'dy2', dispName: 'Tail Width', type: 'float', min:0, defVal:30},
    {name: 'notch', dispName: 'Notch', type: 'float', min:0, defVal: 0},
    {name: 'arrowHead', dispName: 'Arrowhead Width', type: 'float', min:0, defVal:20}
  ];
  constraints: ConnectionConstraint[] | null = null;
  dy = 0.5;
  dx = 0.5;
  dx1 = 20;
  dy1 = 10;
  dx2 = 25;
  dy2 = 30;
  notch = 0;
  arrowHead = 0;

  /** draw.io shapes/mxArrows.js:2052 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const dy1 = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy1', this.dy1))));
    const dx1 = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx1', this.dx1))));
    const dy2 = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy2', this.dy2))));
    const dx2 = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx2', this.dx2))));
    const notch = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'notch', this.notch))));
    const arrowHead = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'arrowHead', this.arrowHead))));
    let x2 = 0;

    if (dy2 != 0)
    {
      x2 = dx2 + dy2 * (dy2 - dy1) / dy2;
    }

    c.begin();
    c.moveTo(0, h * 0.5 - dy2);
    c.lineTo(dx2, h * 0.5 - dy2);
    c.lineTo(x2, h * 0.5 - dy1);
    c.lineTo(w - dx1, h * 0.5 - dy1);
    c.lineTo(w - dx1, h * 0.5 - dy1 - arrowHead);
    c.lineTo(w, h * 0.5);
    c.lineTo(w - dx1, h * 0.5 + dy1 + arrowHead);
    c.lineTo(w - dx1, h * 0.5 + dy1);
    c.lineTo(x2, h * 0.5 + dy1);
    c.lineTo(dx2, h * 0.5 + dy2);
    c.lineTo(0, h * 0.5 + dy2);
    c.lineTo(notch, h * 0.5);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxArrows.js:2150 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    const dy1 = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy1', this.dy1))));
    const dx1 = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx1', this.dx1))));
    const dy2 = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy2', this.dy2))));
    const dx2 = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx2', this.dx2))));
    const notch = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'notch', this.notch))));
    const arrowHead = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'arrowHead', this.arrowHead))));
    let x2 = 0;

    if (dy2 != 0)
    {
      x2 = dx2 + dy2 * (dy2 - dy1) / dy2;
    }

    constr.push(new ConnectionConstraint(new Point(0, 0.5), false, null, notch, 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, h * 0.5 - dy2));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx2, h * 0.5 - dy2));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w - dx1 + x2) * 0.5, h * 0.5 - dy1));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx1, h * 0.5 - dy1 - arrowHead));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, h * 0.5 + dy2));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx2, h * 0.5 + dy2));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w - dx1 + x2) * 0.5, h * 0.5 + dy1));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx1, h * 0.5 + dy1 + arrowHead));
    constr.push(new ConnectionConstraint(new Point(1, 0.5), false));

    return (constr);
  }
}

/** draw.io shapes/mxArrows.js:2186 (mxgraph.arrows2.tailedNotchedArrow) */
export class mxShapeArrows2TailedNotchedArrow extends ActorShape {
  static readonly cst = { TAILED_NOTCHED_ARROW : 'mxgraph.arrows2.tailedNotchedArrow' } as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx1', dispName: 'Arrowhead Length', type: 'float', mix:0, defVal:20},
    {name: 'dy1', dispName: 'Arrow Width', type: 'float', min:0, defVal:10},
    {name: 'dx2', dispName: 'Tail Length', type: 'float', min:0, defVal:25},
    {name: 'dy2', dispName: 'Tail Width', type: 'float', min:0, defVal:30},
    {name: 'notch', dispName: 'Notch', type: 'float', min:0, defVal:20},
    {name: 'arrowHead', dispName: 'Arrowhead Width', type: 'float', min:0, defVal:20}
  ];
  constraints: ConnectionConstraint[] | null = null;
  dy = 0.5;
  dx = 0.5;
  dx1 = 20;
  dy1 = 10;
  dx2 = 25;
  dy2 = 30;
  notch = 0;
  arrowHead = 0;

  /** draw.io shapes/mxArrows.js:2226 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const dy1 = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy1', this.dy1))));
    const dx1 = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx1', this.dx1))));
    const dy2 = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy2', this.dy2))));
    const dx2 = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx2', this.dx2))));
    const notch = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'notch', this.notch))));
    const arrowHead = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'arrowHead', this.arrowHead))));
    let x2 = 0;

    if (dy2 != 0)
    {
      x2 = dx2 + notch * (dy2 - dy1) / dy2;
    }

    c.begin();
    c.moveTo(0, h * 0.5 - dy2);
    c.lineTo(dx2, h * 0.5 - dy2);
    c.lineTo(x2, h * 0.5 - dy1);
    c.lineTo(w - dx1, h * 0.5 - dy1);
    c.lineTo(w - dx1, h * 0.5 - dy1 - arrowHead);
    c.lineTo(w, h * 0.5);
    c.lineTo(w - dx1, h * 0.5 + dy1 + arrowHead);
    c.lineTo(w - dx1, h * 0.5 + dy1);
    c.lineTo(x2, h * 0.5 + dy1);
    c.lineTo(dx2, h * 0.5 + dy2);
    c.lineTo(0, h * 0.5 + dy2);
    c.lineTo(notch, h * 0.5);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxArrows.js:2324 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    const dy1 = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy1', this.dy1))));
    const dx1 = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx1', this.dx1))));
    const dy2 = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy2', this.dy2))));
    const dx2 = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx2', this.dx2))));
    const notch = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'notch', this.notch))));
    const arrowHead = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'arrowHead', this.arrowHead))));
    let x2 = 0;

    if (dy2 != 0)
    {
      x2 = dx2 + notch * (dy2 - dy1) / dy2;
    }

    constr.push(new ConnectionConstraint(new Point(0, 0.5), false, null, notch, 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, h * 0.5 - dy2));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx2, h * 0.5 - dy2));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w - dx1 + x2) * 0.5, h * 0.5 - dy1));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx1, h * 0.5 - dy1 - arrowHead));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, h * 0.5 + dy2));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx2, h * 0.5 + dy2));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w - dx1 + x2) * 0.5, h * 0.5 + dy1));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx1, h * 0.5 + dy1 + arrowHead));
    constr.push(new ConnectionConstraint(new Point(1, 0.5), false));

    return (constr);
  }
}

/** draw.io shapes/mxArrows.js:2360 (mxgraph.arrows2.stripedArrow) */
export class mxShapeArrows2StripedArrow extends ActorShape {
  static readonly cst = { STRIPED_ARROW : 'mxgraph.arrows2.stripedArrow' } as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx', dispName: 'Arrowhead Length', type: 'float', min:0, defVal:40},
    {name: 'dy', dispName: 'Arrow Width', type: 'float', min:0, max:1, defVal:0.6},
    {name: 'notch', dispName: 'Stripes Length', type: 'float', min:0, defVal:25}
  ];
  constraints: ConnectionConstraint[] | null = null;
  dy = 0.5;
  dx = 0.5;
  notch = 0;

  /** draw.io shapes/mxArrows.js:2392 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const dy = h * 0.5 * Math.max(0, Math.min(1, parseFloat(getValue(this.style, 'dy', this.dy))));
    const dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    const notch = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'notch', this.notch))));

    c.begin();
    c.moveTo(notch, dy);
    c.lineTo(w - dx, dy);
    c.lineTo(w - dx, 0);
    c.lineTo(w, h * 0.5);
    c.lineTo(w - dx, h);
    c.lineTo(w - dx, h - dy);
    c.lineTo(notch, h - dy);
    c.close();
    c.moveTo(0, h - dy);
    c.lineTo(notch * 0.16, h - dy);
    c.lineTo(notch * 0.16, dy);
    c.lineTo(0, dy);
    c.close();
    c.moveTo(notch * 0.32, h - dy);
    c.lineTo(notch * 0.8, h - dy);
    c.lineTo(notch * 0.8, dy);
    c.lineTo(notch * 0.32, dy);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxArrows.js:2455 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    const dy = h * 0.5 * Math.max(0, Math.min(1, parseFloat(getValue(this.style, 'dy', this.dy))));
    const dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    // unused upstream: let notch = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'notch', this.notch))));

    constr.push(new ConnectionConstraint(new Point(1, 0.5), false));
    constr.push(new ConnectionConstraint(new Point(0, 0.5), false, null, 0, 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, h - dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, h - dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, h));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w - dx) * 0.5, dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (w - dx) * 0.5, h - dy));

    return (constr);
  }
}

/** draw.io shapes/mxArrows.js:2482 (mxgraph.arrows2.jumpInArrow) */
export class mxShapeArrows2JumpInArrow extends ActorShape {
  static readonly cst = { JUMP_IN_ARROW : 'mxgraph.arrows2.jumpInArrow' } as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx', dispName: 'Arrowhead Length', type: 'float', min:0, defVal:38},
    {name: 'dy', dispName: 'Arrow Width', type: 'float', min:0, defVal:15},
    {name: 'arrowHead', dispName: 'Arrowhead Width', type: 'float', min:0, defVal:55}
  ];
  constraints: ConnectionConstraint[] | null = null;
  dy = 0.5;
  dx = 0.5;
  arrowHead = 40;

  /** draw.io shapes/mxArrows.js:2514 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const dy = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy', this.dy))));
    const dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    const arrowHead = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'arrowHead', this.arrowHead))));

    c.begin();
    c.moveTo(w - dx, 0);
    c.lineTo(w, arrowHead * 0.5);
    c.lineTo(w - dx, arrowHead);
    c.lineTo(w - dx, arrowHead / 2 + dy);
    c.arcTo(w - dx, h - arrowHead / 2 - dy, 0, 0, 0, 0, h);
    c.arcTo(w - dx, h - arrowHead / 2 + dy, 0, 0, 1, w - dx, arrowHead / 2 - dy);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxArrows.js:2569 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    // unused upstream: let dy = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy', this.dy))));
    const dx = Math.max(0, Math.min(w, parseFloat(getValue(this.style, 'dx', this.dx))));
    const arrowHead = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'arrowHead', this.arrowHead))));

    constr.push(new ConnectionConstraint(new Point(0, 1), false));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w, arrowHead * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, w - dx, arrowHead));

    return (constr);
  }
}

/** draw.io shapes/mxArrows.js:2590 (mxgraph.arrows2.uTurnArrow) */
export class mxShapeArrows2UTurnArrow extends ActorShape {
  static readonly cst = { U_TURN_ARROW : 'mxgraph.arrows2.uTurnArrow' } as const;
  static readonly customProperties: CustomProperty[] = [
    {name: 'dx2', dispName: 'Arrowhead Length', type: 'float', min:0, defVal:25},
    {name: 'dy', dispName: 'Arrow Width', type: 'float', min:0, defVal:11},
    {name: 'arrowHead', dispName: 'Arrowhead Width', type: 'float', min:0, defVal:43}
  ];
  constraints: ConnectionConstraint[] | null = null;
  dy = 0.5;
  dx = 0.5;
  dx2 = 25;
  arrowHead = 40;

  /** draw.io shapes/mxArrows.js:2623 */
  override paintVertexShape(c: DrawioCanvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    const dy = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy', this.dy))));
    const arrowHead = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'arrowHead', this.arrowHead))));
    const dx = (h - arrowHead / 2 + dy) / 2;
    const dx2 = Math.max(0, parseFloat(getValue(this.style, 'dx2', this.dx2)));

    c.begin();
    c.moveTo(dx, 0);
    c.lineTo(dx + dx2, arrowHead * 0.5);
    c.lineTo(dx, arrowHead);
    c.lineTo(dx, arrowHead / 2 + dy);
    c.arcTo(dx - 2 * dy, dx - 2 * dy, 0, 0, 0, dx, h - 2 * dy);
    c.lineTo(Math.max(w, dx), h - 2 * dy);
    c.lineTo(Math.max(w, dx), h);
    c.lineTo(dx, h);
    c.arcTo(dx, dx, 0, 0, 1, dx, arrowHead / 2 - dy);
    c.close();
    c.fillAndStroke();
  }

  /** draw.io shapes/mxArrows.js:2701 */
  getConstraints(_style: unknown, w: number, h: number): ConnectionConstraint[] {
    const constr = [];
    const dy = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'dy', this.dy))));
    const arrowHead = Math.max(0, Math.min(h, parseFloat(getValue(this.style, 'arrowHead', this.arrowHead))));
    const dx = (h - arrowHead / 2 + dy) / 2;
    const dx2 = Math.max(0, parseFloat(getValue(this.style, 'dx2', this.dx2)));

    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx, 0));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx + dx2, arrowHead * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx, arrowHead));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (dx + w) * 0.5, h - 2 * dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, Math.max(w, dx), h - 2 * dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, Math.max(w, dx), h - dy));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, Math.max(w, dx), h));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, (dx + w) * 0.5, h));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, dx, h));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, 0, (h + arrowHead * 0.5 - dy) * 0.5));
    constr.push(new ConnectionConstraint(new Point(0, 0), false, null, arrowHead - 2 * dy, (h + arrowHead * 0.5 - dy) * 0.5));

    return (constr);
  }
}

/** draw.io shapes/mxArrows.js:2727 () */
export class mxShapeArrowsWedgeArrow extends ArrowShape {
  static readonly customProperties: CustomProperty[] = [
    {name: 'startWidth', dispName: 'Wedge Width', type: 'float', min:0, defVal:25}
  ];
  override useSvgBoundingBox = true;
  static drawioSvgBoundingBox = true;

  constructor() {
    // draw.io: mxArrow.call(this)
    super([], 'none', 'none');
  }

  /** draw.io shapes/mxArrows.js:2740 */
  override paintEdgeShape(c: DrawioCanvas, pts: Point[]): void {
    const sw = Math.max(0, parseFloat(getValue(this.style, 'startWidth', 20)));

    // Base vector (between end points)
    const p0 = pts[0];
    const pe = pts[pts.length - 1];

    const dx = pe.x - p0.x;
    const dy = pe.y - p0.y;
    const dist = Math.sqrt(dx * dx + dy * dy);  
    const nx = dx * sw / dist;
    const ny = dy * sw / dist;

    c.begin();
    c.moveTo(p0.x + ny, p0.y - nx);
    c.lineTo(p0.x - ny, p0.y + nx);
    c.lineTo(pe.x, pe.y);
    c.close();
    c.fillAndStroke();
  }
}

/** draw.io shapes/mxArrows.js:2767 () */
export class mxShapeArrowsWedgeArrowDashed extends ArrowShape {
  static readonly customProperties: CustomProperty[] = [
    {name: 'startWidth', dispName: 'Wedge Width', type: 'float', min:0, defVal:25}
  ];
  override useSvgBoundingBox = true;
  static drawioSvgBoundingBox = true;

  constructor() {
    // draw.io: mxArrowConnector.call(this)
    super([], 'none', 'none', 1, constants.ARROW_WIDTH, constants.ARROW_SPACING, constants.ARROW_SIZE / 5);
  }

  /** draw.io shapes/mxArrows.js:2780 */
  override paintEdgeShape(c: DrawioCanvas, pts: Point[]): void {
    const startWidth = Math.max(0, parseFloat(getValue(this.style, 'startWidth', 20)));
    const steps = 8;
    // Base vector (between end points)
    const p0 = pts[0];
    const pe = pts[pts.length - 1];

    const dx = pe.x - p0.x;
    const dy = pe.y - p0.y;
    const dist = Math.sqrt(dx * dx + dy * dy);  
    const nx = dx * startWidth / dist;
    const ny = dy * startWidth / dist;
    let cnx = nx; // current nx
    let cny = ny; // current ny
    let pcx = p0.x; // current x on edge
    let pcy = p0.y; // current y on edge

    c.begin();

       for (let i = 0; i <= steps; i++)
    {
      cnx = nx * (steps - i) / steps;
      cny = ny * (steps - i) / steps;

      if (i == steps)
      {
        cnx = nx * (steps - i * 0.98) / steps;
        cny = ny * (steps - i * 0.98) / steps;
      }

      const px1 = pcx + cny;
      const py1 = pcy - cnx;
      const px2 = pcx - cny;
      const py2 = pcy + cnx;

      c.moveTo(px1, py1);
      c.lineTo(px2, py2);

      pcx = pcx + dx / steps;
      pcy = pcy + dy / steps;
    } 

    c.stroke();
  }
}

/** draw.io shapes/mxArrows.js:2831 () */
export class mxShapeArrowsWedgeArrowDashed2 extends ArrowShape {
  static readonly customProperties: CustomProperty[] = [
    {name: 'startWidth', dispName: 'Wedge Width', type: 'float', min:0, defVal:25},
    {name: 'stepSize', dispName: 'Step Size', type: 'float', min:0, defVal:25}
  ];
  override useSvgBoundingBox = true;
  static drawioSvgBoundingBox = true;
  maxSteps = 10000;

  constructor() {
    // draw.io: mxArrowConnector.call(this)
    super([], 'none', 'none', 1, constants.ARROW_WIDTH, constants.ARROW_SPACING, constants.ARROW_SIZE / 5);
  }

  /** draw.io shapes/mxArrows.js:2852 */
  override paintEdgeShape(c: DrawioCanvas, pts: Point[]): void {
    const startWidth = Math.max(0, parseFloat(getValue(this.style, 'startWidth', 20)));
    const stepSize = Math.max(0, parseFloat(getValue(this.style, 'stepSize', 10)));

    // Base vector (between end points)
    const p0 = pts[0];
    const pe = pts[pts.length - 1];

    const dx = pe.x - p0.x;
    const dy = pe.y - p0.y;
    const dist = Math.sqrt(dx * dx + dy * dy);  
    const nx = dx * startWidth / dist;
    const ny = dy * startWidth / dist;
    let cnx = nx; // current nx
    let cny = ny; // current ny
    let pcx = p0.x; // current x on edge
    let pcy = p0.y; // current y on edge
    const steps = (stepSize > 0) ? Math.min(Math.floor(dist / stepSize), this.maxSteps) : 0;

    c.begin();

       for (let i = 0; i <= steps; i++)
    {
      cnx = nx * (steps - i) / steps;
      cny = ny * (steps - i) / steps;

      if (i == steps)
      {
        cnx = nx * (steps - i * 0.98) / steps;
        cny = ny * (steps - i * 0.98) / steps;
      }

      const px1 = pcx + cny;
      const py1 = pcy - cnx;
      const px2 = pcx - cny;
      const py2 = pcy + cnx;

      c.moveTo(px1, py1);
      c.lineTo(px2, py2);

      pcx = pcx + dx / steps;
      pcy = pcy + dy / steps;
    } 

    c.stroke();
  }
}

/** Registered draw.io shape names (exact upstream names) -> constructors, in upstream order. */
export const MX_ARROWS2_SHAPES: ReadonlyArray<readonly [string, ShapeCtor]> = [
  ['mxgraph.arrows2.arrow', mxShapeArrows2Arrow], // shapes/mxArrows.js:146
  ['mxgraph.arrows2.twoWayArrow', mxShapeArrows2TwoWayArrow], // shapes/mxArrows.js:293
  ['mxgraph.arrows2.stylisedArrow', mxShapeArrows2StylisedArrow], // shapes/mxArrows.js:399
  ['mxgraph.arrows2.sharpArrow', mxShapeArrows2SharpArrow], // shapes/mxArrows.js:539
  ['mxgraph.arrows2.sharpArrow2', mxShapeArrows2SharpArrow2], // shapes/mxArrows.js:689
  ['mxgraph.arrows2.calloutArrow', mxShapeArrows2CalloutArrow], // shapes/mxArrows.js:841
  ['mxgraph.arrows2.bendArrow', mxShapeArrows2BendArrow], // shapes/mxArrows.js:1003
  ['mxgraph.arrows2.bendDoubleArrow', mxShapeArrows2BendDoubleArrow], // shapes/mxArrows.js:1176
  ['mxgraph.arrows2.calloutDoubleArrow', mxShapeArrows2CalloutDoubleArrow], // shapes/mxArrows.js:1320
  ['mxgraph.arrows2.calloutQuadArrow', mxShapeArrows2CalloutQuadArrow], // shapes/mxArrows.js:1483
  ['mxgraph.arrows2.calloutDouble90Arrow', mxShapeArrows2CalloutDouble90Arrow], // shapes/mxArrows.js:1651
  ['mxgraph.arrows2.quadArrow', mxShapeArrows2QuadArrow], // shapes/mxArrows.js:1806
  ['mxgraph.arrows2.triadArrow', mxShapeArrows2TriadArrow], // shapes/mxArrows.js:1942
  ['mxgraph.arrows2.tailedArrow', mxShapeArrows2TailedArrow], // shapes/mxArrows.js:2086
  ['mxgraph.arrows2.tailedNotchedArrow', mxShapeArrows2TailedNotchedArrow], // shapes/mxArrows.js:2260
  ['mxgraph.arrows2.stripedArrow', mxShapeArrows2StripedArrow], // shapes/mxArrows.js:2422
  ['mxgraph.arrows2.jumpInArrow', mxShapeArrows2JumpInArrow], // shapes/mxArrows.js:2533
  ['mxgraph.arrows2.uTurnArrow', mxShapeArrows2UTurnArrow], // shapes/mxArrows.js:2646
  ['mxgraph.arrows2.wedgeArrow', mxShapeArrowsWedgeArrow], // shapes/mxArrows.js:2762
  ['mxgraph.arrows2.wedgeArrowDashed', mxShapeArrowsWedgeArrowDashed], // shapes/mxArrows.js:2826
  ['mxgraph.arrows2.wedgeArrowDashed2', mxShapeArrowsWedgeArrowDashed2], // shapes/mxArrows.js:2900
];

/** draw.io customProperties keyed by shape name (plain data for a properties panel). */
export const MX_ARROWS2_CUSTOM_PROPERTIES: Readonly<Record<string, CustomProperty[]>> = {
  'mxgraph.arrows2.arrow': mxShapeArrows2Arrow.customProperties,
  'mxgraph.arrows2.twoWayArrow': mxShapeArrows2TwoWayArrow.customProperties,
  'mxgraph.arrows2.stylisedArrow': mxShapeArrows2StylisedArrow.customProperties,
  'mxgraph.arrows2.sharpArrow': mxShapeArrows2SharpArrow.customProperties,
  'mxgraph.arrows2.sharpArrow2': mxShapeArrows2SharpArrow2.customProperties,
  'mxgraph.arrows2.calloutArrow': mxShapeArrows2CalloutArrow.customProperties,
  'mxgraph.arrows2.bendArrow': mxShapeArrows2BendArrow.customProperties,
  'mxgraph.arrows2.bendDoubleArrow': mxShapeArrows2BendDoubleArrow.customProperties,
  'mxgraph.arrows2.calloutDoubleArrow': mxShapeArrows2CalloutDoubleArrow.customProperties,
  'mxgraph.arrows2.calloutQuadArrow': mxShapeArrows2CalloutQuadArrow.customProperties,
  'mxgraph.arrows2.calloutDouble90Arrow': mxShapeArrows2CalloutDouble90Arrow.customProperties,
  'mxgraph.arrows2.quadArrow': mxShapeArrows2QuadArrow.customProperties,
  'mxgraph.arrows2.triadArrow': mxShapeArrows2TriadArrow.customProperties,
  'mxgraph.arrows2.tailedArrow': mxShapeArrows2TailedArrow.customProperties,
  'mxgraph.arrows2.tailedNotchedArrow': mxShapeArrows2TailedNotchedArrow.customProperties,
  'mxgraph.arrows2.stripedArrow': mxShapeArrows2StripedArrow.customProperties,
  'mxgraph.arrows2.jumpInArrow': mxShapeArrows2JumpInArrow.customProperties,
  'mxgraph.arrows2.uTurnArrow': mxShapeArrows2UTurnArrow.customProperties,
  'mxgraph.arrows2.wedgeArrow': mxShapeArrowsWedgeArrow.customProperties,
  'mxgraph.arrows2.wedgeArrowDashed': mxShapeArrowsWedgeArrowDashed.customProperties,
  'mxgraph.arrows2.wedgeArrowDashed2': mxShapeArrowsWedgeArrowDashed2.customProperties,
};
