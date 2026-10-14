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
 * Ported from jgraph/drawio v32.4.1 src/main/webapp/js/grapheditor/Shapes.js
 * (https://raw.githubusercontent.com/jgraph/drawio/v32.4.1/src/main/webapp/js/grapheditor/Shapes.js).
 * Each class names the line of its draw.io constructor; constraints come from
 * Shapes.js:10604-11181. Hand-drawn (sketch/comic) rendering is not ported.
 */

import { ConnectionConstraint, Point, Rectangle, mathUtils } from '@maxgraph/core';
import {
  DrawioActor,
  DrawioCylinder,
  DrawioEllipse,
  DrawioRectangle,
  DrawioRhombus,
  DrawioShape,
  getDefaultShape,
} from './base';
import {
  ELLIPSE_CONSTRAINTS,
  HEXAGON_CONSTRAINTS,
  NONE,
  RECTANGLE_CONSTRAINTS,
  arcTo,
  cc,
  clamp,
  flag,
  lineArcSize,
  num,
  pt,
  rectArcFactor,
  str,
  type Canvas,
  type StyleMap,
} from './util';

const tan30 = Math.tan(mathUtils.toRadians(30));
const tan30Dx = (0.5 - tan30) / 2;

/** True when the shape is drawn east/west (draw.io: direction == null || east || west). */
function isHorizontalDirection(direction: unknown): boolean {
  return direction === undefined || direction === null || direction === 'east' || direction === 'west';
}

// ---------------------------------------------------------------------------------------------
// Cube (Shapes.js:969, registered 1054)
// ---------------------------------------------------------------------------------------------

export class CubeShape extends DrawioCylinder {
  size = 20;
  darkOpacity = 0;
  darkOpacity2 = 0;

  /** Shapes.js:982 */
  override paintVertexShape(c: Canvas, x: number, y: number, w: number, h: number): void {
    const s = Math.max(0, Math.min(w, Math.min(h, num(this.sv, 'size', this.size))));
    const op = Math.max(-1, Math.min(1, num(this.sv, 'darkOpacity', this.darkOpacity)));
    const op2 = Math.max(-1, Math.min(1, num(this.sv, 'darkOpacity2', this.darkOpacity2)));
    c.translate(x, y);

    c.begin();
    c.moveTo(0, 0);
    c.lineTo(w - s, 0);
    c.lineTo(w, s);
    c.lineTo(w, h);
    c.lineTo(s, h);
    c.lineTo(0, h - s);
    c.lineTo(0, 0);
    c.close();
    c.fillAndStroke();

    if (!this.outline) {
      c.setShadow(false);

      if (op != 0) {
        c.setFillAlpha(Math.abs(op));
        c.setFillColor(op < 0 ? '#FFFFFF' : '#000000');
        c.begin();
        c.moveTo(0, 0);
        c.lineTo(w - s, 0);
        c.lineTo(w, s);
        c.lineTo(s, s);
        c.close();
        c.fill();
      }

      if (op2 != 0) {
        c.setFillAlpha(Math.abs(op2));
        c.setFillColor(op2 < 0 ? '#FFFFFF' : '#000000');
        c.begin();
        c.moveTo(0, 0);
        c.lineTo(s, s);
        c.lineTo(s, h);
        c.lineTo(0, h - s);
        c.close();
        c.fill();
      }

      c.begin();
      c.moveTo(s, h);
      c.lineTo(s, s);
      c.lineTo(0, 0);
      c.moveTo(s, s);
      c.lineTo(w, s);
      c.stroke();
    }
  }

  /** Shapes.js:1042 */
  override getLabelMargins(_rect: Rectangle | null): Rectangle | null {
    if (flag(this.sv, 'boundedLbl', false)) {
      const s = num(this.sv, 'size', this.size) * this.scale;

      return new Rectangle(s, s, 0, 0);
    }

    return null;
  }

  /** Shapes.js:10751 */
  override getConstraints(_style: StyleMap, w: number, h: number): ConnectionConstraint[] {
    const s = Math.max(0, Math.min(w, Math.min(h, num(this.sv, 'size', this.size))));

    return [
      cc(0, 0, false),
      cc(0, 0, false, null, (w - s) * 0.5, 0),
      cc(0, 0, false, null, w - s, 0),
      cc(0, 0, false, null, w - s * 0.5, s * 0.5),
      cc(0, 0, false, null, w, s),
      cc(0, 0, false, null, w, (h + s) * 0.5),
      cc(1, 1, false),
      cc(0, 0, false, null, (w + s) * 0.5, h),
      cc(0, 0, false, null, s, h),
      cc(0, 0, false, null, s * 0.5, h - s * 0.5),
      cc(0, 0, false, null, 0, h - s),
      cc(0, 0, false, null, 0, (h - s) * 0.5),
    ];
  }
}

// ---------------------------------------------------------------------------------------------
// Waypoint (Shapes.js:1112, registered 1133)
// ---------------------------------------------------------------------------------------------

export class WaypointShape extends DrawioCylinder {
  size = 6;

  /** Shapes.js:1121 */
  override paintVertexShape(c: Canvas, x: number, y: number, w: number, h: number): void {
    c.setFillColor(this.stroke);
    const s = Math.max(0, num(this.sv, 'size', this.size) - 2) + 2 * this.strokeWidth;
    c.ellipse(x + (w - s) * 0.5, y + (h - s) * 0.5, s, s);
    c.fill();

    c.setFillColor(NONE);
    c.rect(x, y, w, h);
    c.fill();
  }
}

// ---------------------------------------------------------------------------------------------
// IsoRectangle (Shapes.js:1136, registered 1159)
// ---------------------------------------------------------------------------------------------

export class IsoRectangleShape extends DrawioActor {
  size = 20;
  /** Shapes.js:10605 */
  override constraints: ConnectionConstraint[] | null = [];

  /** Shapes.js:1145 */
  override redrawPath(c: Canvas, _x: number, _y: number, w: number, h: number): void {
    const m = Math.min(w, h / tan30);

    c.translate((w - m) / 2, (h - m) / 2 + m / 4);
    c.moveTo(0, 0.25 * m);
    c.lineTo(0.5 * m, m * tan30Dx);
    c.lineTo(m, 0.25 * m);
    c.lineTo(0.5 * m, (0.5 - tan30Dx) * m);
    c.lineTo(0, 0.25 * m);
    c.close();
  }
}

// ---------------------------------------------------------------------------------------------
// DataStore (Shapes.js:1201, registered 1265)
// ---------------------------------------------------------------------------------------------

export class DataStoreShape extends DrawioCylinder {
  /** Shapes.js:1208 */
  override redrawPath(c: Canvas, _x: number, _y: number, w: number, h: number, isForeground = false): void {
    const dy = Math.min(h / 2, Math.round(h / 8) + this.strokeWidth - 1);

    if ((isForeground && this.filled) || (!isForeground && !this.filled)) {
      c.moveTo(0, dy);
      c.curveTo(0, 2 * dy, w, 2 * dy, w, dy);

      // Needs separate shapes for correct hit-detection
      if (!isForeground) {
        c.stroke();
        c.begin();
      }

      c.translate(0, dy / 2);
      c.moveTo(0, dy);
      c.curveTo(0, 2 * dy, w, 2 * dy, w, dy);

      if (!isForeground) {
        c.stroke();
        c.begin();
      }

      c.translate(0, dy / 2);
      c.moveTo(0, dy);
      c.curveTo(0, 2 * dy, w, 2 * dy, w, dy);

      if (!isForeground) {
        c.stroke();
        c.begin();
      }

      c.translate(0, -dy);
    }

    if (!isForeground) {
      c.moveTo(0, dy);
      c.curveTo(0, -dy / 3, w, -dy / 3, w, dy);
      c.lineTo(w, h - dy);
      c.curveTo(w, h + dy / 3, 0, h + dy / 3, 0, h - dy);
      c.close();
    }
  }

  /** Shapes.js:1259 */
  override getLabelMargins(rect: Rectangle | null): Rectangle | null {
    if (!rect) return null;

    return new Rectangle(0, 2.5 * Math.min(rect.height / 2, Math.round(rect.height / 8) + this.strokeWidth - 1), 0, 0);
  }
}

// ---------------------------------------------------------------------------------------------
// Note (Shapes.js:1268, registered 1321)
// ---------------------------------------------------------------------------------------------

export class NoteShape extends DrawioCylinder {
  size = 30;
  darkOpacity = 0;

  /** Shapes.js:1279 */
  override paintVertexShape(c: Canvas, x: number, y: number, w: number, h: number): void {
    const s = Math.max(0, Math.min(w, Math.min(h, num(this.sv, 'size', this.size))));
    const op = Math.max(-1, Math.min(1, num(this.sv, 'darkOpacity', this.darkOpacity)));
    c.translate(x, y);

    c.begin();
    c.moveTo(0, 0);
    c.lineTo(w - s, 0);
    c.lineTo(w, s);
    c.lineTo(w, h);
    c.lineTo(0, h);
    c.lineTo(0, 0);
    c.close();
    c.fillAndStroke();

    if (!this.outline) {
      c.setShadow(false);

      if (op != 0) {
        c.setFillAlpha(Math.abs(op));
        c.setFillColor(op < 0 ? '#FFFFFF' : '#000000');
        c.begin();
        c.moveTo(w - s, 0);
        c.lineTo(w - s, s);
        c.lineTo(w, s);
        c.close();
        c.fill();
      }

      c.begin();
      c.moveTo(w - s, 0);
      c.lineTo(w - s, s);
      c.lineTo(w, s);
      c.stroke();
    }
  }

  /** Shapes.js:10703 */
  override getConstraints(_style: StyleMap, w: number, h: number): ConnectionConstraint[] {
    const s = Math.max(0, Math.min(w, Math.min(h, num(this.sv, 'size', this.size))));
    const constr = [
      cc(0, 0, false),
      cc(0, 0, false, null, (w - s) * 0.5, 0),
      cc(0, 0, false, null, w - s, 0),
      cc(0, 0, false, null, w - s * 0.5, s * 0.5),
      cc(0, 0, false, null, w, s),
      cc(0, 0, false, null, w, (h + s) * 0.5),
      cc(1, 1, false),
      cc(0.5, 1, false),
      cc(0, 1, false),
      cc(0, 0.5, false),
    ];

    if (w >= s * 2) {
      constr.push(cc(0.5, 0, false));
    }

    return constr;
  }
}

// ---------------------------------------------------------------------------------------------
// IsoCube2 (Shapes.js:1345, registered 1382)
// ---------------------------------------------------------------------------------------------

export class IsoCubeShape2 extends DrawioShape {
  isoAngle = 15;

  private isoH(w: number, h: number): number {
    const isoAngle = (Math.max(0.01, Math.min(94, num(this.sv, 'isoAngle', this.isoAngle))) * Math.PI) / 200;

    return Math.min(w * Math.tan(isoAngle), h * 0.5);
  }

  /** Shapes.js:1354 */
  override paintVertexShape(c: Canvas, x: number, y: number, w: number, h: number): void {
    const isoH = this.isoH(w, h);

    c.translate(x, y);

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

  /** Shapes.js:10626 */
  override getConstraints(_style: StyleMap, w: number, h: number): ConnectionConstraint[] {
    const isoH = this.isoH(w, h);

    return [
      cc(0.5, 0, false),
      cc(0, 0, false, null, w, isoH),
      cc(1, 0.5, false),
      cc(0, 0, false, null, w, h - isoH),
      cc(0.5, 1, false),
      cc(0, 0, false, null, 0, h - isoH),
      cc(0, 0.5, false),
      cc(0, 0, false, null, 0, isoH),
    ];
  }
}

// ---------------------------------------------------------------------------------------------
// Cylinder3 (Shapes.js:1430, registered 1491)
// ---------------------------------------------------------------------------------------------

export class CylinderShape3 extends DrawioCylinder {
  size = 15;

  /** Shapes.js:1443 */
  override paintVertexShape(c: Canvas, x: number, y: number, w: number, h: number): void {
    const size = Math.max(0, Math.min(h * 0.5, num(this.sv, 'size', this.size)));
    const lid = flag(this.sv, 'lid', true);

    c.translate(x, y);

    if (size == 0) {
      c.rect(0, 0, w, h);
      c.fillAndStroke();
    } else {
      c.begin();

      if (lid) {
        c.moveTo(0, size);
        arcTo(c, w * 0.5, size, 0, 0, 1, w * 0.5, 0);
        arcTo(c, w * 0.5, size, 0, 0, 1, w, size);
      } else {
        c.moveTo(0, 0);
        arcTo(c, w * 0.5, size, 0, 0, 0, w * 0.5, size);
        arcTo(c, w * 0.5, size, 0, 0, 0, w, 0);
      }

      c.lineTo(w, h - size);
      arcTo(c, w * 0.5, size, 0, 0, 1, w * 0.5, h);
      arcTo(c, w * 0.5, size, 0, 0, 1, 0, h - size);
      c.close();
      c.fillAndStroke();

      c.setShadow(false);

      if (lid) {
        c.begin();
        c.moveTo(w, size);
        arcTo(c, w * 0.5, size, 0, 0, 1, w * 0.5, 2 * size);
        arcTo(c, w * 0.5, size, 0, 0, 1, 0, size);
        c.stroke();
      }
    }
  }

  /** Shapes.js:1954 */
  override getLabelMargins(rect: Rectangle | null): Rectangle | null {
    if (rect && flag(this.sv, 'boundedLbl', false)) {
      let size = num(this.sv, 'size', 15);

      if (!flag(this.sv, 'lid', true)) {
        size /= 2;
      }

      return new Rectangle(
        0,
        Math.min(rect.height * this.scale, size * 2 * this.scale),
        0,
        Math.max(0, size * 0.3 * this.scale)
      );
    }

    return null;
  }

  /** Shapes.js:10772 */
  override getConstraints(_style: StyleMap, _w: number, h: number): ConnectionConstraint[] {
    const s = Math.max(0, Math.min(h, num(this.sv, 'size', this.size)));

    return [
      cc(0.5, 0, false),
      cc(0, 0.5, false),
      cc(0.5, 1, false),
      cc(1, 0.5, false),

      cc(0, 0, false, null, 0, s),
      cc(1, 0, false, null, 0, s),
      cc(1, 1, false, null, 0, -s),
      cc(0, 1, false, null, 0, -s),

      cc(0, 0, false, null, 0, s + (h * 0.5 - s) * 0.5),
      cc(1, 0, false, null, 0, s + (h * 0.5 - s) * 0.5),
      cc(1, 0, false, null, 0, h - s - (h * 0.5 - s) * 0.5),
      cc(0, 0, false, null, 0, h - s - (h * 0.5 - s) * 0.5),

      cc(0.145, 0, false, null, 0, s * 0.29),
      cc(0.855, 0, false, null, 0, s * 0.29),
      cc(0.855, 1, false, null, 0, -s * 0.29),
      cc(0.145, 1, false, null, 0, -s * 0.29),
    ];
  }
}

// ---------------------------------------------------------------------------------------------
// Switch (Shapes.js:1494, registered 1512)
// ---------------------------------------------------------------------------------------------

export class SwitchShape extends DrawioActor {
  /** Shapes.js:10949 */
  override constraints: ConnectionConstraint[] | null = [
    cc(0, 0, false), cc(0.5, 0.25, false), cc(1, 0, false),
    cc(0.25, 0.5, false), cc(0.75, 0.5, false),
    cc(0, 1, false), cc(0.5, 0.75, false), cc(1, 1, false),
  ];

  /** Shapes.js:1501 */
  override redrawPath(c: Canvas, _x: number, _y: number, w: number, h: number): void {
    const curve = 0.5;
    c.moveTo(0, 0);
    c.quadTo(w / 2, h * curve, w, 0);
    c.quadTo(w * (1 - curve), h / 2, w, h);
    c.quadTo(w / 2, h * (1 - curve), 0, h);
    c.quadTo(w * curve, h / 2, 0, 0);
  }
}

// ---------------------------------------------------------------------------------------------
// SmileyFace (Shapes.js:1724, registered 1805)
// ---------------------------------------------------------------------------------------------

export class SmileyFaceShape extends DrawioShape {
  featureColor = '#666666';
  /** Shapes.js:10701 */
  override constraints: ConnectionConstraint[] | null = ELLIPSE_CONSTRAINTS;

  /** Shapes.js:1733 */
  override paintVertexShape(c: Canvas, x: number, y: number, w: number, h: number): void {
    const smileyType = str(this.sv, 'smileyType', 'happy');
    const featureColor = str(this.sv, 'smileyFeatureColor', this.featureColor);

    c.translate(x, y);

    // Face circle uses cell's own fill/stroke + strokeWidth
    const r = Math.min(w, h) / 2;
    c.ellipse(w / 2 - r, h / 2 - r, r * 2, r * 2);
    c.fillAndStroke();

    const s = Math.min(w, h) / 30;
    const cx = w / 2;
    const cy = h / 2;

    c.setFillColor(featureColor);
    c.setStrokeColor(featureColor);
    c.setStrokeWidth(2 * s);

    const eyeR = 1.5 * s;
    const eyeXOffset = 5 * s;
    const eyeYOffset = 5 * s;

    c.ellipse(cx - eyeXOffset - eyeR, cy - eyeYOffset - eyeR, eyeR * 2, eyeR * 2);
    c.fillAndStroke();
    c.ellipse(cx + eyeXOffset - eyeR, cy - eyeYOffset - eyeR, eyeR * 2, eyeR * 2);
    c.fillAndStroke();

    c.setStrokeWidth(1 * s);
    c.setFillColor('#000000');

    if (smileyType == 'happy') {
      const mcx = cx;
      const mcy = cy + 2 * s;

      c.begin();
      c.moveTo(mcx + 7.5 * s, mcy);
      arcTo(c, 7.5 * s, 7.5 * s, 0, 1, 1, mcx - 7.5 * s, mcy);
      c.lineTo(mcx - 6.818 * s, mcy);
      arcTo(c, 6.818 * s, 6.818 * s, 0, 1, 0, mcx + 6.818 * s, mcy);
      c.close();
      c.fillAndStroke();
    } else if (smileyType == 'sad') {
      const mcx = cx;
      const mcy = cy + 7 * s;

      c.begin();
      c.moveTo(mcx - 7.5 * s, mcy);
      arcTo(c, 7.5 * s, 7.5 * s, 0, 1, 1, mcx + 7.5 * s, mcy);
      c.lineTo(mcx + 6.818 * s, mcy);
      arcTo(c, 6.818 * s, 6.818 * s, 0, 1, 0, mcx - 6.818 * s, mcy);
      c.close();
      c.fillAndStroke();
    } else {
      c.begin();
      c.moveTo(cx - 5 * s, cy + 7 * s);
      c.lineTo(cx + 5 * s, cy + 7 * s);
      c.stroke();
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Card (Shapes.js:1808, registered 1831)
// ---------------------------------------------------------------------------------------------

export class CardShape extends DrawioActor {
  size = 30;

  override isRoundable(): boolean {
    return true;
  }

  /** Shapes.js:1822 */
  override redrawPath(c: Canvas, _x: number, _y: number, w: number, h: number): void {
    const s = Math.max(0, Math.min(w, Math.min(h, num(this.sv, 'size', this.size))));
    this.addRoundedPoints(c, [pt(s, 0), pt(w, 0), pt(w, h), pt(0, h), pt(0, s)], true);
  }

  /** Shapes.js:10727 */
  override getConstraints(_style: StyleMap, w: number, h: number): ConnectionConstraint[] {
    const s = Math.max(0, Math.min(w, Math.min(h, num(this.sv, 'size', this.size))));
    const constr = [
      cc(1, 0, false),
      cc(0, 0, false, null, (w + s) * 0.5, 0),
      cc(0, 0, false, null, s, 0),
      cc(0, 0, false, null, s * 0.5, s * 0.5),
      cc(0, 0, false, null, 0, s),
      cc(0, 0, false, null, 0, (h + s) * 0.5),
      cc(0, 1, false),
      cc(0.5, 1, false),
      cc(1, 1, false),
      cc(1, 0.5, false),
    ];

    if (w >= s * 2) {
      constr.push(cc(0.5, 0, false));
    }

    return constr;
  }
}

// ---------------------------------------------------------------------------------------------
// Tape (Shapes.js:1834, registered 1886)
// ---------------------------------------------------------------------------------------------

export class TapeShape extends DrawioActor {
  size = 0.4;
  /** Shapes.js:10957 */
  override constraints: ConnectionConstraint[] | null = [
    cc(0, 0.35, false), cc(0, 0.5, false), cc(0, 0.65, false),
    cc(1, 0.35, false), cc(1, 0.5, false), cc(1, 0.65, false),
    cc(0.25, 1, false), cc(0.75, 0, false),
  ];

  /** Shapes.js:1843 */
  override redrawPath(c: Canvas, _x: number, _y: number, w: number, h: number): void {
    const dy = h * Math.max(0, Math.min(1, num(this.sv, 'size', this.size)));
    const fy = 1.4;

    c.moveTo(0, dy / 2);
    c.quadTo(w / 4, dy * fy, w / 2, dy / 2);
    c.quadTo((w * 3) / 4, dy * (1 - fy), w, dy / 2);
    c.lineTo(w, h - dy / 2);
    c.quadTo((w * 3) / 4, h - dy * fy, w / 2, h - dy / 2);
    c.quadTo(w / 4, h - dy * (1 - fy), 0, h - dy / 2);
    c.lineTo(0, dy / 2);
    c.close();
  }

  /** Shapes.js:1859 */
  override getLabelBounds(rect: Rectangle): Rectangle {
    if (flag(this.sv, 'boundedLbl', false)) {
      const size = num(this.sv, 'size', this.size);
      const w = rect.width;
      const h = rect.height;

      if (isHorizontalDirection(this.direction)) {
        const dy = h * size;

        return new Rectangle(rect.x, rect.y + dy, w, h - 2 * dy);
      }

      const dx = w * size;

      return new Rectangle(rect.x + dx, rect.y, w - 2 * dx, h);
    }

    return rect;
  }
}

// ---------------------------------------------------------------------------------------------
// Document (Shapes.js:1889, registered 1924)
// ---------------------------------------------------------------------------------------------

export class DocumentShape extends DrawioActor {
  size = 0.3;
  /** Shapes.js:11017 */
  override constraints: ConnectionConstraint[] | null = [
    cc(0.25, 0), cc(0.5, 0), cc(0.75, 0),
    cc(0, 0.25), cc(0, 0.5), cc(0, 0.75),
    cc(1, 0.25), cc(1, 0.5), cc(1, 0.75),
  ];

  /** Shapes.js:1898 */
  override getLabelMargins(rect: Rectangle | null): Rectangle | null {
    if (rect && flag(this.sv, 'boundedLbl', false)) {
      return new Rectangle(0, 0, 0, num(this.sv, 'size', this.size) * rect.height);
    }

    return null;
  }

  /** Shapes.js:1909 */
  override redrawPath(c: Canvas, _x: number, _y: number, w: number, h: number): void {
    const dy = h * Math.max(0, Math.min(1, num(this.sv, 'size', this.size)));
    const fy = 1.4;

    c.moveTo(0, 0);
    c.lineTo(w, 0);
    c.lineTo(w, h - dy / 2);
    c.quadTo((w * 3) / 4, h - dy * fy, w / 2, h - dy / 2);
    c.quadTo(w / 4, h - dy * (1 - fy), 0, h - dy / 2);
    c.lineTo(0, dy / 2);
    c.close();
  }
}

// ---------------------------------------------------------------------------------------------
// Parallelogram (Shapes.js:2043, registered 2070)
// ---------------------------------------------------------------------------------------------

export class ParallelogramShape extends DrawioActor {
  static readonly defaultSize = 0.2;
  static readonly defaultFixedSize = 20;
  size = ParallelogramShape.defaultSize;
  fixedSize = ParallelogramShape.defaultFixedSize;
  /** Shapes.js:11015 */
  override constraints: ConnectionConstraint[] | null = RECTANGLE_CONSTRAINTS;

  override isRoundable(): boolean {
    return true;
  }

  /** Shapes.js:2059 */
  override redrawPath(c: Canvas, _x: number, _y: number, w: number, h: number): void {
    const fixed = flag(this.sv, 'fixedSize', false);
    const dx = fixed
      ? Math.max(0, Math.min(w, num(this.sv, 'size', this.fixedSize)))
      : w * Math.max(0, Math.min(1, num(this.sv, 'size', this.size)));
    this.addRoundedPoints(c, [pt(0, h), pt(dx, 0), pt(w, 0), pt(w - dx, h)], true);
  }
}

// ---------------------------------------------------------------------------------------------
// Trapezoid (Shapes.js:2073, registered 2100)
// ---------------------------------------------------------------------------------------------

export class TrapezoidShape extends DrawioActor {
  static readonly defaultSize = 0.2;
  static readonly defaultFixedSize = 20;
  size = TrapezoidShape.defaultSize;
  fixedSize = TrapezoidShape.defaultFixedSize;
  /** Shapes.js:11016 */
  override constraints: ConnectionConstraint[] | null = RECTANGLE_CONSTRAINTS;

  override isRoundable(): boolean {
    return true;
  }

  /** Shapes.js:2089 */
  override redrawPath(c: Canvas, _x: number, _y: number, w: number, h: number): void {
    const fixed = flag(this.sv, 'fixedSize', false);
    const dx = fixed
      ? Math.max(0, Math.min(w * 0.5, num(this.sv, 'size', this.fixedSize)))
      : w * Math.max(0, Math.min(0.5, num(this.sv, 'size', this.size)));
    this.addRoundedPoints(c, [pt(0, h), pt(dx, 0), pt(w - dx, 0), pt(w, h)], true);
  }
}

// ---------------------------------------------------------------------------------------------
// CurlyBracket (Shapes.js:2103, registered 2123)
// ---------------------------------------------------------------------------------------------

export class CurlyBracketShape extends DrawioActor {
  size = 0.5;

  /** Shapes.js:2112 */
  override redrawPath(c: Canvas, _x: number, _y: number, w: number, h: number): void {
    c.setFillColor(null);
    const s = w * Math.max(0, Math.min(1, num(this.sv, 'size', this.size)));
    this.addRoundedPoints(
      c,
      [pt(w, 0), pt(s, 0), pt(s, h / 2), pt(0, h / 2), pt(s, h / 2), pt(s, h), pt(w, h)],
      false
    );
  }
}

// ---------------------------------------------------------------------------------------------
// Process (Shapes.js:2438, registered 2526)
// ---------------------------------------------------------------------------------------------

export class ProcessShape extends DrawioRectangle {
  size = 0.1;
  fixedSize = false;

  override isHtmlAllowed(): boolean {
    return false;
  }

  /** Shapes.js:2453 */
  override getLabelBounds(rect: Rectangle): Rectangle {
    if (flag(this.sv, 'horizontal', true) == isHorizontalDirection(this.direction)) {
      const w = rect.width;
      const h = rect.height;
      const r = new Rectangle(rect.x, rect.y, w, h);

      const isFixedSize = flag(this.sv, 'fixedSize', this.fixedSize);
      let inset = num(this.sv, 'size', this.size);

      if (isFixedSize) {
        inset = Math.max(0, Math.min(w, inset * this.scale));
      } else {
        inset = w * Math.max(0, Math.min(1, inset));

        if (this.isRounded) {
          const f = rectArcFactor(this.sv);
          inset = Math.max(inset, Math.min(w * f, h * f));
        }
      }

      r.x += Math.round(inset);
      r.width -= Math.round(2 * inset);

      return r;
    }

    return rect;
  }

  /** Shapes.js:2492 */
  override paintForeground(c: Canvas, x: number, y: number, w: number, h: number): void {
    const isFixedSize = flag(this.sv, 'fixedSize', this.fixedSize);
    let inset = num(this.sv, 'size', this.size);

    if (isFixedSize) {
      inset = Math.max(0, Math.min(w, inset));
    } else {
      inset = w * Math.max(0, Math.min(1, inset));
    }

    if (this.isRounded) {
      const f = rectArcFactor(this.sv);
      inset = Math.max(inset, Math.min(w * f, h * f));
    }

    // Crisp rendering of inner lines
    inset = Math.round(inset);

    c.begin();
    c.moveTo(x + inset, y);
    c.lineTo(x + inset, y + h);
    c.moveTo(x + w - inset, y);
    c.lineTo(x + w - inset, y + h);
    c.stroke();
    super.paintForeground(c, x, y, w, h);
  }
}

// ---------------------------------------------------------------------------------------------
// Callout (Shapes.js:2550, registered 2590)
// ---------------------------------------------------------------------------------------------

export class CalloutShape extends DrawioActor {
  static readonly defaultSize = 30;
  size = CalloutShape.defaultSize;
  position = 0.5;
  position2 = 0.5;
  base = 20;
  /** Inherited from mxHexagon (Shapes.js:10991); getConstraints wins. */
  override constraints: ConnectionConstraint[] | null = HEXAGON_CONSTRAINTS;

  /** Shapes.js:2565 */
  override getLabelMargins(_rect: Rectangle | null): Rectangle | null {
    return new Rectangle(0, 0, 0, num(this.sv, 'size', this.size) * this.scale);
  }

  override isRoundable(): boolean {
    return true;
  }

  private geometry(w: number, h: number) {
    return {
      s: Math.max(0, Math.min(h, num(this.sv, 'size', this.size))),
      dx: w * Math.max(0, Math.min(1, num(this.sv, 'position', this.position))),
      dx2: w * Math.max(0, Math.min(1, num(this.sv, 'position2', this.position2))),
      base: Math.max(0, Math.min(w, num(this.sv, 'base', this.base))),
    };
  }

  /** Shapes.js:2576 */
  override redrawPath(c: Canvas, _x: number, _y: number, w: number, h: number): void {
    const { s, dx, dx2, base } = this.geometry(w, h);

    this.addRoundedPoints(
      c,
      [
        pt(0, 0),
        pt(w, 0),
        pt(w, h - s),
        pt(Math.min(w, dx + base), h - s),
        pt(dx2, h),
        pt(Math.max(0, dx), h - s),
        pt(0, h - s),
      ],
      true,
      [4]
    );
  }

  /** Shapes.js:10644 */
  override getConstraints(_style: StyleMap, w: number, h: number): ConnectionConstraint[] {
    const { s, dx2 } = this.geometry(w, h);
    const constr = [
      cc(0, 0, false),
      cc(0.25, 0, false),
      cc(0.5, 0, false),
      cc(0.75, 0, false),
      cc(1, 0, false),
      cc(0, 0, false, null, w, (h - s) * 0.5),
      cc(0, 0, false, null, w, h - s),
      cc(0, 0, false, null, dx2, h),
      cc(0, 0, false, null, 0, h - s),
      cc(0, 0, false, null, 0, (h - s) * 0.5),
    ];

    if (w >= s * 2) {
      constr.push(cc(0.5, 0, false));
    }

    return constr;
  }
}

// ---------------------------------------------------------------------------------------------
// WedgeCallout (Shapes.js:2593, registered 2749)
// ---------------------------------------------------------------------------------------------

export class WedgeCalloutShape extends DrawioActor {
  tipX = -0.25;
  tipY = 1;
  base = 20;
  /** Limits the tip offset relative to width and height to keep bounding boxes finite. */
  maxTipOffset = 100;
  /** Shapes.js:10698 */
  override constraints: ConnectionConstraint[] | null = RECTANGLE_CONSTRAINTS;

  override isRoundable(): boolean {
    return true;
  }

  /** Shapes.js:2617 */
  getTipOffset(): Point {
    const max = this.maxTipOffset;
    const tx = num(this.sv, 'tipX', this.tipX);
    const ty = num(this.sv, 'tipY', this.tipY);

    return new Point(Math.max(-max, Math.min(max, tx)), Math.max(-max, Math.min(max, ty)));
  }

  /** Shapes.js:2630 */
  getTailPoints(w: number, h: number): { points: Point[]; index: number } | null {
    const tip = this.getTipOffset();
    const dx = tip.x * w;
    const dy = tip.y * h;

    if (Math.abs(dx) <= w / 2 && Math.abs(dy) <= h / 2) {
      return null;
    }

    const arcSize = lineArcSize(this.sv);
    const base = Math.max(0, num(this.sv, 'base', this.base));
    let inset = this.isRounded ? arcSize : 0;
    const tp = new Point(w / 2 + dx, h / 2 + dy);

    if (Math.abs(dx) * h >= Math.abs(dy) * w && dx != 0) {
      // Tail exits through the left or right side
      inset = Math.min(inset, h / 2);
      const hb = Math.max(0, Math.min(base, h - 2 * inset)) / 2;
      let ey = h / 2 + (dy * (w / 2)) / Math.abs(dx);
      ey = Math.max(inset + hb, Math.min(h - inset - hb, ey));

      return dx > 0
        ? { points: [pt(w, ey - hb), tp, pt(w, ey + hb)], index: 2 }
        : { points: [pt(0, ey + hb), tp, pt(0, ey - hb)], index: 4 };
    }

    // Tail exits through the top or bottom side
    inset = Math.min(inset, w / 2);
    const hb = Math.max(0, Math.min(base, w - 2 * inset)) / 2;
    let ex = w / 2 + (dx * (h / 2)) / Math.abs(dy);
    ex = Math.max(inset + hb, Math.min(w - inset - hb, ex));

    return dy > 0
      ? { points: [pt(ex + hb, h), tp, pt(ex - hb, h)], index: 3 }
      : { points: [pt(ex - hb, 0), tp, pt(ex + hb, 0)], index: 1 };
  }

  /** Shapes.js:2673 */
  override redrawPath(c: Canvas, _x: number, _y: number, w: number, h: number): void {
    const pts = [pt(0, 0), pt(w, 0), pt(w, h), pt(0, h)];
    const tail = this.getTailPoints(w, h);
    let exclude: number[] | undefined;

    if (tail != null) {
      pts.splice(tail.index, 0, ...tail.points);
      exclude = [tail.index, tail.index + 1, tail.index + 2];
    }

    this.addRoundedPoints(c, pts, true, exclude);
  }

  /**
   * Shapes.js:2693 (getShapeBoundingBox): adds the tail tip, including the miter overshoot, to
   * the bounding box so exports and fit include the tail.
   */
  override updateBoundingBox(): void {
    super.updateBoundingBox();

    const bbox = this.boundingBox;

    if (bbox == null || this.bounds == null) return;

    const b = this.bounds.clone();
    const s = this.scale;
    const w = b.width / s;
    const h = b.height / s;
    const tail = this.getTailPoints(w, h);

    if (tail == null) return;

    const tp = tail.points[1];
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    let rect = new Rectangle(
      cx + (tp.x - w / 2) * s * (this.flipH ? -1 : 1),
      cy + (tp.y - h / 2) * s * (this.flipV ? -1 : 1),
      0,
      0
    );
    this.augmentBoundingBox(rect);

    const v1x = tail.points[0].x - tp.x;
    const v1y = tail.points[0].y - tp.y;
    const v2x = tail.points[2].x - tp.x;
    const v2y = tail.points[2].y - tp.y;
    const n1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const n2 = Math.sqrt(v2x * v2x + v2y * v2y);

    if (n1 > 0 && n2 > 0) {
      const cos = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (n1 * n2)));
      const sinHalf = Math.sqrt((1 - cos) / 2);
      const miter = sinHalf > 0 ? Math.min(10, 1 / sinHalf) : 10;
      rect.grow(((miter - 1) * this.strokeWidth * this.scale) / 2);
    }

    const rot = this.getShapeRotation();

    if (rot != 0) {
      rect = mathUtils.getBoundingBox(rect, rot, new Point(cx, cy)) ?? rect;
    }

    bbox.add(rect);
  }
}

// ---------------------------------------------------------------------------------------------
// Step (Shapes.js:2752, registered 2779)
// ---------------------------------------------------------------------------------------------

export class StepShape extends DrawioActor {
  static readonly defaultSize = 0.2;
  static readonly defaultFixedSize = 20;
  size = StepShape.defaultSize;
  fixedSize = StepShape.defaultFixedSize;
  /** Shapes.js:10965 */
  override constraints: ConnectionConstraint[] | null = [
    cc(0.25, 0), cc(0.5, 0), cc(0.75, 0),
    cc(0.25, 1), cc(0.5, 1), cc(0.75, 1),
    cc(0, 0.25), cc(0, 0.5), cc(0, 0.75),
    cc(1, 0.25), cc(1, 0.5), cc(1, 0.75),
  ];

  override isRoundable(): boolean {
    return true;
  }

  /** Shapes.js:2768 */
  override redrawPath(c: Canvas, _x: number, _y: number, w: number, h: number): void {
    const fixed = flag(this.sv, 'fixedSize', false);
    const s = fixed
      ? Math.max(0, Math.min(w, num(this.sv, 'size', this.fixedSize)))
      : w * Math.max(0, Math.min(1, num(this.sv, 'size', this.size)));
    this.addRoundedPoints(
      c,
      [pt(0, 0), pt(w - s, 0), pt(w, h / 2), pt(w - s, h), pt(0, h), pt(s, h / 2)],
      true
    );
  }
}

// ---------------------------------------------------------------------------------------------
// Hexagon (Shapes.js:2782, registered 2807; replaces maxGraph's core hexagon as draw.io does)
// ---------------------------------------------------------------------------------------------

export class HexagonShape extends DrawioActor {
  static readonly defaultSize = 0.25;
  static readonly defaultFixedSize = 20;
  size = HexagonShape.defaultSize;
  fixedSize = HexagonShape.defaultFixedSize;
  /** mxHexagon constraints, Shapes.js:10991 */
  override constraints: ConnectionConstraint[] | null = HEXAGON_CONSTRAINTS;

  override isRoundable(): boolean {
    return true;
  }

  /** Shapes.js:2797 */
  override redrawPath(c: Canvas, _x: number, _y: number, w: number, h: number): void {
    const fixed = flag(this.sv, 'fixedSize', false);
    const s = fixed
      ? Math.max(0, Math.min(w * 0.5, num(this.sv, 'size', this.fixedSize)))
      : w * Math.max(0, Math.min(1, num(this.sv, 'size', this.size)));
    this.addRoundedPoints(
      c,
      [pt(s, 0), pt(w - s, 0), pt(w, 0.5 * h), pt(w - s, h), pt(s, h), pt(0, 0.5 * h)],
      true
    );
  }
}

// ---------------------------------------------------------------------------------------------
// Extended shape "ext" (Shapes.js:2960, registered 3080)
// ---------------------------------------------------------------------------------------------

export class ExtendedShape extends DrawioRectangle {
  override isHtmlAllowed(): boolean {
    return false;
  }

  /** Shapes.js:2971 */
  override getLabelBounds(rect: Rectangle): Rectangle {
    if (num(this.sv, 'double', 0) == 1) {
      const margin = (Math.max(2, this.strokeWidth + 1) + num(this.sv, 'margin', 0)) * this.scale;

      return new Rectangle(rect.x + margin, rect.y + margin, rect.width - 2 * margin, rect.height - 2 * margin);
    }

    return rect;
  }

  /** Shapes.js:2985 */
  override paintForeground(c: Canvas, x: number, y: number, w: number, h: number): void {
    const style = this.sv;

    if (style != null) {
      if (!this.outline && num(style, 'double', 0) == 1) {
        const margin = Math.max(2, this.strokeWidth + 1) + num(style, 'margin', 0);
        x += margin;
        y += margin;
        w -= 2 * margin;
        h -= 2 * margin;

        if (w > 0 && h > 0) {
          super.paintBackground(c, x, y, w, h);
        }
      }

      c.setDashed(false);

      // Draws the symbols defined in the style. The symbols are numbered from 1...n. Possible
      // postfixes are align, verticalAlign, spacing, arcSpacing, width, height.
      let counter = 0;
      let Ctor: ReturnType<typeof getDefaultShape>;

      do {
        const name = style['symbol' + counter];
        Ctor = typeof name === 'string' ? getDefaultShape(name) : undefined;

        if (Ctor != null) {
          const align = style['symbol' + counter + 'Align'];
          const valign = style['symbol' + counter + 'VerticalAlign'];
          const width = num(style, 'symbol' + counter + 'Width', 0);
          const height = num(style, 'symbol' + counter + 'Height', 0);
          let spacing = num(style, 'symbol' + counter + 'Spacing', 0);
          let vspacing = num(style, 'symbol' + counter + 'VSpacing', 0) || spacing;
          const arcspacing = style['symbol' + counter + 'ArcSpacing'];

          if (arcspacing != null) {
            const arcSize = this.getArcSize(w + this.strokeWidth, h + this.strokeWidth) * num(style, 'symbol' + counter + 'ArcSpacing', 0);
            spacing += arcSize;
            vspacing += arcSize;
          }

          let x2 = x;
          let y2 = y;

          if (align == 'center') {
            x2 += (w - width) / 2;
          } else if (align == 'right') {
            x2 += w - width - spacing;
          } else {
            x2 += spacing;
          }

          if (valign == 'middle') {
            y2 += (h - height) / 2;
          } else if (valign == 'bottom') {
            y2 += h - height - vspacing;
          } else {
            y2 += vspacing;
          }

          c.save();

          // Small hack to pass style along into subshape
          const tmp = new Ctor();
          tmp.style = this.style;
          tmp.paintVertexShape(c, x2, y2, width, height);
          c.restore();
        }

        counter++;
      } while (Ctor != null);
    }

    // Paints glass effect
    super.paintForeground(c, x, y, w, h);
  }
}

// ---------------------------------------------------------------------------------------------
// Message (Shapes.js:3083, registered 3109)
// ---------------------------------------------------------------------------------------------

export class MessageShape extends DrawioCylinder {
  /** Shapes.js:3090 */
  override redrawPath(c: Canvas, _x: number, _y: number, w: number, h: number, isForeground = false): void {
    if (isForeground) {
      c.moveTo(0, 0);
      c.lineTo(w / 2, h / 2);
      c.lineTo(w, 0);
    } else {
      c.moveTo(0, 0);
      c.lineTo(w, 0);
      c.lineTo(w, h);
      c.lineTo(0, h);
      c.close();
    }
  }
}

// ---------------------------------------------------------------------------------------------
// UML actor (Shapes.js:3112, registered 3148)
// ---------------------------------------------------------------------------------------------

export class UmlActorShape extends DrawioShape {
  /** Shapes.js:10920 */
  override constraints: ConnectionConstraint[] | null = [
    cc(0.25, 0.1, false), cc(0.5, 0, false), cc(0.75, 0.1, false),
    cc(0, 1 / 3, false), cc(0, 1, false),
    cc(1, 1 / 3, false), cc(1, 1, false),
    cc(0.5, 0.5, false),
  ];

  /** Shapes.js:3119 */
  override paintBackground(c: Canvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    // Head
    c.ellipse(w / 4, 0, w / 2, h / 4);
    c.fillAndStroke();

    c.begin();
    c.moveTo(w / 2, h / 4);
    c.lineTo(w / 2, (2 * h) / 3);

    // Arms
    c.moveTo(w / 2, h / 3);
    c.lineTo(0, h / 3);
    c.moveTo(w / 2, h / 3);
    c.lineTo(w, h / 3);

    // Legs
    c.moveTo(w / 2, (2 * h) / 3);
    c.lineTo(0, h);
    c.moveTo(w / 2, (2 * h) / 3);
    c.lineTo(w, h);

    c.stroke();
  }
}

// ---------------------------------------------------------------------------------------------
// Manual input (Shapes.js:4733, registered 4768)
// ---------------------------------------------------------------------------------------------

export class ManualInputShape extends DrawioActor {
  size = 30;
  /** Shapes.js:10847 */
  override constraints: ConnectionConstraint[] | null = RECTANGLE_CONSTRAINTS;

  override isRoundable(): boolean {
    return true;
  }

  /** Shapes.js:4747 */
  override getLabelMargins(_rect: Rectangle | null): Rectangle | null {
    if (flag(this.sv, 'boundedLbl', false)) {
      const s = num(this.sv, 'size', this.size) * this.scale;

      return new Rectangle(0, s, 0, 0);
    }

    return null;
  }

  /** Shapes.js:4759 */
  override redrawPath(c: Canvas, _x: number, _y: number, w: number, h: number): void {
    const s = Math.min(h, num(this.sv, 'size', this.size));
    this.addRoundedPoints(c, [pt(0, h), pt(0, s), pt(w, 0), pt(w, h)], true);
  }
}

// ---------------------------------------------------------------------------------------------
// Internal storage (Shapes.js:4771, registered 4815)
// ---------------------------------------------------------------------------------------------

export class InternalStorageShape extends DrawioRectangle {
  dx = 20;
  dy = 20;

  override isHtmlAllowed(): boolean {
    return false;
  }

  /** Shapes.js:4787 */
  override paintForeground(c: Canvas, x: number, y: number, w: number, h: number): void {
    super.paintForeground(c, x, y, w, h);
    let inset = 0;

    if (this.isRounded) {
      const f = rectArcFactor(this.sv);
      inset = Math.max(inset, Math.min(w * f, h * f));
    }

    const dx = Math.max(inset, Math.min(w, num(this.sv, 'dx', this.dx)));
    const dy = Math.max(inset, Math.min(h, num(this.sv, 'dy', this.dy)));

    c.begin();
    c.moveTo(x, y + dy);
    c.lineTo(x + w, y + dy);
    c.stroke();

    c.begin();
    c.moveTo(x + dx, y);
    c.lineTo(x + dx, y + h);
    c.stroke();
  }
}

// ---------------------------------------------------------------------------------------------
// Corner (Shapes.js:4818, registered 4847)
// ---------------------------------------------------------------------------------------------

export class CornerShape extends DrawioActor {
  dx = 20;
  dy = 20;

  override isRoundable(): boolean {
    return true;
  }

  /** Shapes.js:4835 */
  override redrawPath(c: Canvas, _x: number, _y: number, w: number, h: number): void {
    const dx = Math.max(0, Math.min(w, num(this.sv, 'dx', this.dx)));
    const dy = Math.max(0, Math.min(h, num(this.sv, 'dy', this.dy)));
    this.addRoundedPoints(c, [pt(0, 0), pt(w, 0), pt(w, dy), pt(dx, dy), pt(dx, h), pt(0, h)], true);
  }

  /** Shapes.js:11055 */
  override getConstraints(_style: StyleMap, w: number, h: number): ConnectionConstraint[] {
    const dx = Math.max(0, Math.min(w, num(this.sv, 'dx', this.dx)));
    const dy = Math.max(0, Math.min(h, num(this.sv, 'dy', this.dy)));

    return [
      cc(0, 0, false),
      cc(0.5, 0, false),
      cc(1, 0, false),
      cc(0, 0, false, null, w, dy * 0.5),
      cc(0, 0, false, null, w, dy),
      cc(0, 0, false, null, (w + dx) * 0.5, dy),
      cc(0, 0, false, null, dx, dy),
      cc(0, 0, false, null, dx, (h + dy) * 0.5),
      cc(0, 0, false, null, dx, h),
      cc(0, 0, false, null, dx * 0.5, h),
      cc(0, 0.5, false),
      cc(0, 1, false),
    ];
  }
}

// ---------------------------------------------------------------------------------------------
// Crossbar (Shapes.js:4850, registered 4872)
// ---------------------------------------------------------------------------------------------

export class CrossbarShape extends DrawioActor {
  /** Shapes.js:11077 */
  override constraints: ConnectionConstraint[] | null = [
    cc(0, 0, false), cc(0, 0.5, false), cc(0, 1, false),
    cc(0.25, 0.5, false), cc(0.5, 0.5, false), cc(0.75, 0.5, false),
    cc(1, 0, false), cc(1, 0.5, false), cc(1, 1, false),
  ];

  /** Shapes.js:4857 */
  override redrawPath(c: Canvas, _x: number, _y: number, w: number, h: number): void {
    c.moveTo(0, 0);
    c.lineTo(0, h);

    c.moveTo(w, 0);
    c.lineTo(w, h);

    c.moveTo(0, h / 2);
    c.lineTo(w, h / 2);
  }
}

// ---------------------------------------------------------------------------------------------
// Tee (Shapes.js:4875, registered 4906)
// ---------------------------------------------------------------------------------------------

export class TeeShape extends DrawioActor {
  dx = 20;
  dy = 20;

  override isRoundable(): boolean {
    return true;
  }

  /** Shapes.js:4892 */
  override redrawPath(c: Canvas, _x: number, _y: number, w: number, h: number): void {
    const dx = Math.max(0, Math.min(w, num(this.sv, 'dx', this.dx)));
    const dy = Math.max(0, Math.min(h, num(this.sv, 'dy', this.dy)));
    this.addRoundedPoints(
      c,
      [
        pt(0, 0),
        pt(w, 0),
        pt(w, dy),
        pt((w + dx) / 2, dy),
        pt((w + dx) / 2, h),
        pt((w - dx) / 2, h),
        pt((w - dx) / 2, dy),
        pt(0, dy),
      ],
      true
    );
  }

  /** Shapes.js:11028 */
  override getConstraints(_style: StyleMap, w: number, h: number): ConnectionConstraint[] {
    const dx = Math.max(0, Math.min(w, num(this.sv, 'dx', this.dx)));
    const dy = Math.max(0, Math.min(h, num(this.sv, 'dy', this.dy)));

    return [
      cc(0, 0, false),
      cc(0.5, 0, false),
      cc(1, 0, false),
      cc(0, 0, false, null, w, dy * 0.5),
      cc(0, 0, false, null, w, dy),
      cc(0, 0, false, null, w * 0.75 + dx * 0.25, dy),
      cc(0, 0, false, null, (w + dx) * 0.5, dy),
      cc(0, 0, false, null, (w + dx) * 0.5, (h + dy) * 0.5),
      cc(0, 0, false, null, (w + dx) * 0.5, h),
      cc(0.5, 1, false),
      cc(0, 0, false, null, (w - dx) * 0.5, h),
      cc(0, 0, false, null, (w - dx) * 0.5, (h + dy) * 0.5),
      cc(0, 0, false, null, (w - dx) * 0.5, dy),
      cc(0, 0, false, null, w * 0.25 - dx * 0.25, dy),
      cc(0, 0, false, null, 0, dy),
      cc(0, 0, false, null, 0, dy * 0.5),
    ];
  }
}

// ---------------------------------------------------------------------------------------------
// Single arrow (Shapes.js:4909, registered 4939)
// ---------------------------------------------------------------------------------------------

export class SingleArrowShape extends DrawioActor {
  static readonly defaultArrowWidth = 0.3;
  static readonly defaultArrowSize = 0.2;
  arrowWidth = SingleArrowShape.defaultArrowWidth;
  arrowSize = SingleArrowShape.defaultArrowSize;

  override isRoundable(): boolean {
    return true;
  }

  protected arrowGeometry(w: number, h: number) {
    const aw = h * clamp(num(this.sv, 'arrowWidth', this.arrowWidth), 0, 1);
    const as = w * clamp(num(this.sv, 'arrowSize', this.arrowSize), 0, 1);
    const at = (h - aw) / 2;

    return { as, at, ab: at + aw };
  }

  /** Shapes.js:4925 */
  override redrawPath(c: Canvas, _x: number, _y: number, w: number, h: number): void {
    const { as, at, ab } = this.arrowGeometry(w, h);
    this.addRoundedPoints(
      c,
      [pt(0, at), pt(w - as, at), pt(w - as, 0), pt(w, h / 2), pt(w - as, h), pt(w - as, ab), pt(0, ab)],
      true
    );
  }

  /** Shapes.js:11087 */
  override getConstraints(_style: StyleMap, w: number, h: number): ConnectionConstraint[] {
    const { as, at } = this.arrowGeometry(w, h);

    return [
      cc(0, 0.5, false),
      cc(0, 0, false, null, 0, at),
      cc(0, 0, false, null, (w - as) * 0.5, at),
      cc(0, 0, false, null, w - as, 0),
      cc(1, 0.5, false),
      cc(0, 0, false, null, w - as, h),
      cc(0, 0, false, null, (w - as) * 0.5, h - at),
      cc(0, 0, false, null, 0, h - at),
    ];
  }
}

// ---------------------------------------------------------------------------------------------
// Double arrow (Shapes.js:4942, registered 4969)
// ---------------------------------------------------------------------------------------------

export class DoubleArrowShape extends DrawioActor {
  override isRoundable(): boolean {
    return true;
  }

  private arrowGeometry(w: number, h: number) {
    const aw = h * clamp(num(this.sv, 'arrowWidth', SingleArrowShape.defaultArrowWidth), 0, 1);
    const as = w * clamp(num(this.sv, 'arrowSize', SingleArrowShape.defaultArrowSize), 0, 1);
    const at = (h - aw) / 2;

    return { as, at, ab: at + aw };
  }

  /** Shapes.js:4954 */
  override redrawPath(c: Canvas, _x: number, _y: number, w: number, h: number): void {
    const { as, at, ab } = this.arrowGeometry(w, h);
    this.addRoundedPoints(
      c,
      [
        pt(0, h / 2),
        pt(as, 0),
        pt(as, at),
        pt(w - as, at),
        pt(w - as, 0),
        pt(w, h / 2),
        pt(w - as, h),
        pt(w - as, ab),
        pt(as, ab),
        pt(as, h),
      ],
      true
    );
  }

  /** Shapes.js:11107 */
  override getConstraints(_style: StyleMap, w: number, h: number): ConnectionConstraint[] {
    const { as, at } = this.arrowGeometry(w, h);

    return [
      cc(0, 0.5, false),
      cc(0, 0, false, null, as, 0),
      cc(0, 0, false, null, w * 0.5, at),
      cc(0, 0, false, null, w - as, 0),
      cc(1, 0.5, false),
      cc(0, 0, false, null, w - as, h),
      cc(0, 0, false, null, w * 0.5, h - at),
      cc(0, 0, false, null, as, h),
    ];
  }
}

// ---------------------------------------------------------------------------------------------
// Data storage (Shapes.js:4972, registered 4998)
// ---------------------------------------------------------------------------------------------

export class DataStorageShape extends DrawioActor {
  size = 0.1;
  fixedSize = 20;
  /** Shapes.js:10842 */
  override constraints: ConnectionConstraint[] | null = RECTANGLE_CONSTRAINTS;

  /** Shapes.js:4983 */
  override redrawPath(c: Canvas, _x: number, _y: number, w: number, h: number): void {
    const fixed = flag(this.sv, 'fixedSize', false);
    const s = fixed
      ? Math.max(0, Math.min(w, num(this.sv, 'size', this.fixedSize)))
      : w * Math.max(0, Math.min(1, num(this.sv, 'size', this.size)));

    c.moveTo(s, 0);
    c.lineTo(w, 0);
    c.quadTo(w - s * 2, h / 2, w, h);
    c.lineTo(s, h);
    c.quadTo(s - s * 2, h / 2, s, 0);
    c.close();
  }
}

// ---------------------------------------------------------------------------------------------
// Or / Xor (Shapes.js:5001 / 5020, registered 5017 / 5037)
// ---------------------------------------------------------------------------------------------

export class OrShape extends DrawioActor {
  /** Shapes.js:11166 */
  override constraints: ConnectionConstraint[] | null = [
    cc(0, 0.25, false), cc(0, 0.5, false), cc(0, 0.75, false),
    cc(1, 0.5, false), cc(0.7, 0.1, false), cc(0.7, 0.9, false),
  ];

  /** Shapes.js:5008 */
  override redrawPath(c: Canvas, _x: number, _y: number, w: number, h: number): void {
    c.moveTo(0, 0);
    c.quadTo(w, 0, w, h / 2);
    c.quadTo(w, h, 0, h);
    c.close();
  }
}

export class XorShape extends DrawioActor {
  /** Shapes.js:11172 */
  override constraints: ConnectionConstraint[] | null = [
    cc(0.175, 0.25, false), cc(0.25, 0.5, false), cc(0.175, 0.75, false),
    cc(1, 0.5, false), cc(0.7, 0.1, false), cc(0.7, 0.9, false),
  ];

  /** Shapes.js:5027 */
  override redrawPath(c: Canvas, _x: number, _y: number, w: number, h: number): void {
    c.moveTo(0, 0);
    c.quadTo(w, 0, w, h / 2);
    c.quadTo(w, h, 0, h);
    c.quadTo(w / 2, h / 2, 0, 0);
    c.close();
  }
}

// ---------------------------------------------------------------------------------------------
// Loop limit (Shapes.js:5040, registered 5063)
// ---------------------------------------------------------------------------------------------

export class LoopLimitShape extends DrawioActor {
  size = 20;
  /** Shapes.js:10906 */
  override constraints: ConnectionConstraint[] | null = RECTANGLE_CONSTRAINTS;

  override isRoundable(): boolean {
    return true;
  }

  /** Shapes.js:5054 */
  override redrawPath(c: Canvas, _x: number, _y: number, w: number, h: number): void {
    const s = Math.min(w / 2, Math.min(h, num(this.sv, 'size', this.size)));
    this.addRoundedPoints(c, [pt(s, 0), pt(w - s, 0), pt(w, s * 0.8), pt(w, h), pt(0, h), pt(0, s * 0.8)], true);
  }
}

// ---------------------------------------------------------------------------------------------
// Off page connector (Shapes.js:5066, registered 5088)
// ---------------------------------------------------------------------------------------------

export class OffPageConnectorShape extends DrawioActor {
  size = 3 / 8;
  /** Shapes.js:10907 */
  override constraints: ConnectionConstraint[] | null = RECTANGLE_CONSTRAINTS;

  override isRoundable(): boolean {
    return true;
  }

  /** Shapes.js:5079 */
  override redrawPath(c: Canvas, _x: number, _y: number, w: number, h: number): void {
    const s = h * Math.max(0, Math.min(1, num(this.sv, 'size', this.size)));
    this.addRoundedPoints(c, [pt(0, 0), pt(w, 0), pt(w, h - s), pt(w / 2, h), pt(0, h - s)], true);
  }
}

// ---------------------------------------------------------------------------------------------
// Ellipse variants: tapeData 5091, orEllipse 5112, sumEllipse 5140, lineEllipse 5359, collate 5191
// ---------------------------------------------------------------------------------------------

export class TapeDataShape extends DrawioEllipse {
  /** Shapes.js:5098 */
  override paintVertexShape(c: Canvas, x: number, y: number, w: number, h: number): void {
    super.paintVertexShape(c, x, y, w, h);

    c.begin();
    c.moveTo(x + w / 2, y + h);
    c.lineTo(x + w, y + h);
    c.stroke();
  }
}

export class OrEllipseShape extends DrawioEllipse {
  /** Shapes.js:5119 */
  override paintVertexShape(c: Canvas, x: number, y: number, w: number, h: number): void {
    super.paintVertexShape(c, x, y, w, h);

    c.setShadow(false);
    c.begin();
    c.moveTo(x, y + h / 2);
    c.lineTo(x + w, y + h / 2);
    c.stroke();

    c.begin();
    c.moveTo(x + w / 2, y);
    c.lineTo(x + w / 2, y + h);
    c.stroke();
  }
}

export class SumEllipseShape extends DrawioEllipse {
  /** Shapes.js:5147 */
  override paintVertexShape(c: Canvas, x: number, y: number, w: number, h: number): void {
    super.paintVertexShape(c, x, y, w, h);
    const s2 = 0.145;

    c.setShadow(false);
    c.begin();
    c.moveTo(x + w * s2, y + h * s2);
    c.lineTo(x + w * (1 - s2), y + h * (1 - s2));
    c.stroke();

    c.begin();
    c.moveTo(x + w * (1 - s2), y + h * s2);
    c.lineTo(x + w * s2, y + h * (1 - s2));
    c.stroke();
  }
}

export class LineEllipseShape extends DrawioEllipse {
  /** Shapes.js:5366 */
  override paintVertexShape(c: Canvas, x: number, y: number, w: number, h: number): void {
    super.paintVertexShape(c, x, y, w, h);

    c.setShadow(false);
    c.begin();

    if (str(this.sv, 'line', '') == 'vertical') {
      c.moveTo(x + w / 2, y);
      c.lineTo(x + w / 2, y + h);
    } else {
      c.moveTo(x, y + h / 2);
      c.lineTo(x + w, y + h / 2);
    }

    c.stroke();
  }
}

export class CollateShape extends DrawioEllipse {
  /** Shapes.js:5198 */
  override paintVertexShape(c: Canvas, x: number, y: number, w: number, h: number): void {
    c.begin();
    c.moveTo(x, y);
    c.lineTo(x + w, y);
    c.lineTo(x + w / 2, y + h / 2);
    c.close();
    c.fillAndStroke();

    c.begin();
    c.moveTo(x, y + h);
    c.lineTo(x + w, y + h);
    c.lineTo(x + w / 2, y + h / 2);
    c.close();
    c.fillAndStroke();
  }
}

// ---------------------------------------------------------------------------------------------
// Sort (Shapes.js:5169, registered 5188)
// ---------------------------------------------------------------------------------------------

export class SortShape extends DrawioRhombus {
  /** Shapes.js:5176 */
  override paintVertexShape(c: Canvas, x: number, y: number, w: number, h: number): void {
    super.paintVertexShape(c, x, y, w, h);

    c.setShadow(false);
    c.begin();
    c.moveTo(x, y + h / 2);
    c.lineTo(x + w, y + h / 2);
    c.stroke();
  }
}

// ---------------------------------------------------------------------------------------------
// Delay (Shapes.js:5391, registered 5410)
// ---------------------------------------------------------------------------------------------

export class DelayShape extends DrawioActor {
  /** Shapes.js:10848 */
  override constraints: ConnectionConstraint[] | null = RECTANGLE_CONSTRAINTS;

  /** Shapes.js:5398 */
  override redrawPath(c: Canvas, _x: number, _y: number, w: number, h: number): void {
    const dx = Math.min(w, h / 2);
    c.moveTo(0, 0);
    c.lineTo(w - dx, 0);
    c.quadTo(w, 0, w, h / 2);
    c.quadTo(w, h, w - dx, h);
    c.lineTo(0, h);
    c.close();
  }
}

// ---------------------------------------------------------------------------------------------
// Cross (Shapes.js:5413, registered 5447)
// ---------------------------------------------------------------------------------------------

export class CrossShape extends DrawioActor {
  size = 0.2;

  private crossGeometry(w: number, h: number) {
    const m = Math.min(h, w);
    const size = Math.max(0, Math.min(m, m * num(this.sv, 'size', this.size)));
    const t = (h - size) / 2;
    const l = (w - size) / 2;

    return { t, b: t + size, l, r: l + size };
  }

  /** Shapes.js:5422 */
  override redrawPath(c: Canvas, _x: number, _y: number, w: number, h: number): void {
    const { t, b, l, r } = this.crossGeometry(w, h);

    c.moveTo(0, t);
    c.lineTo(l, t);
    c.lineTo(l, 0);
    c.lineTo(r, 0);
    c.lineTo(r, t);
    c.lineTo(w, t);
    c.lineTo(w, b);
    c.lineTo(r, b);
    c.lineTo(r, h);
    c.lineTo(l, h);
    c.lineTo(l, b);
    c.lineTo(0, b);
    c.close();
  }

  /** Shapes.js:11127 */
  override getConstraints(_style: StyleMap, w: number, h: number): ConnectionConstraint[] {
    const { t, b, l, r } = this.crossGeometry(w, h);

    return [
      cc(0, 0, false, null, l, t * 0.5),
      cc(0, 0, false, null, l, 0),
      cc(0.5, 0, false),
      cc(0, 0, false, null, r, 0),
      cc(0, 0, false, null, r, t * 0.5),
      cc(0, 0, false, null, r, t),
      cc(0, 0, false, null, l, h - t * 0.5),
      cc(0, 0, false, null, l, h),
      cc(0.5, 1, false),
      cc(0, 0, false, null, r, h),
      cc(0, 0, false, null, r, h - t * 0.5),
      cc(0, 0, false, null, r, b),
      cc(0, 0, false, null, (w + r) * 0.5, t),
      cc(0, 0, false, null, w, t),
      cc(1, 0.5, false),
      cc(0, 0, false, null, w, b),
      cc(0, 0, false, null, (w + r) * 0.5, b),
      cc(0, 0, false, null, l, b),
      cc(0, 0, false, null, l * 0.5, t),
      cc(0, 0, false, null, 0, t),
      cc(0, 0.5, false),
      cc(0, 0, false, null, 0, b),
      cc(0, 0, false, null, l * 0.5, b),
      cc(0, 0, false, null, l, t),
    ];
  }
}

// ---------------------------------------------------------------------------------------------
// Display (Shapes.js:5450, registered 5474)
// ---------------------------------------------------------------------------------------------

export class DisplayShape extends DrawioActor {
  size = 0.25;

  private displayGeometry(w: number, h: number) {
    const dx = Math.min(w, h / 2);
    const s = Math.min(w - dx, Math.max(0, num(this.sv, 'size', this.size)) * w);

    return { dx, s };
  }

  /** Shapes.js:5459 */
  override redrawPath(c: Canvas, _x: number, _y: number, w: number, h: number): void {
    const { dx, s } = this.displayGeometry(w, h);

    c.moveTo(0, h / 2);
    c.lineTo(s, 0);
    c.lineTo(w - dx, 0);
    c.quadTo(w, 0, w, h / 2);
    c.quadTo(w, h, w - dx, h);
    c.lineTo(s, h);
    c.close();
  }

  /** Shapes.js:10850 */
  override getConstraints(_style: StyleMap, w: number, h: number): ConnectionConstraint[] {
    const { dx, s } = this.displayGeometry(w, h);

    return [
      cc(0, 0.5, false, null),
      cc(0, 0, false, null, s, 0),
      cc(0, 0, false, null, (s + w - dx) * 0.5, 0),
      cc(0, 0, false, null, w - dx, 0),
      cc(1, 0.5, false, null),
      cc(0, 0, false, null, w - dx, h),
      cc(0, 0, false, null, (s + w - dx) * 0.5, h),
      cc(0, 0, false, null, s, h),
    ];
  }
}

// ---------------------------------------------------------------------------------------------
// Git tag (Shapes.js:8415, registered 8484)
// ---------------------------------------------------------------------------------------------

export class GitTagShape extends DrawioActor {
  tabSize = 8;
  tabInset = 4;
  holeSize = 1.0;
  /** Shapes.js:10697 */
  override constraints: ConnectionConstraint[] | null = RECTANGLE_CONSTRAINTS;

  override isRoundable(): boolean {
    return false;
  }

  /** Shapes.js:8431 */
  override redrawPath(c: Canvas, _x: number, _y: number, w: number, h: number): void {
    const tabSize = Math.max(0, Math.min(w, num(this.sv, 'tabSize', this.tabSize)));
    const tabInset = Math.max(0, Math.min(h, num(this.sv, 'tabInset', this.tabInset)));
    const tabY1 = (h - tabInset) / 2;
    const tabY2 = tabY1 + tabInset;

    c.moveTo(0, tabY1);
    c.lineTo(0, tabY2);
    c.lineTo(tabSize, h);
    c.lineTo(w, h);
    c.lineTo(w, 0);
    c.lineTo(tabSize, 0);
    c.close();
  }

  /** Shapes.js:8454 */
  override paintVertexShape(c: Canvas, x: number, y: number, w: number, h: number): void {
    super.paintVertexShape(c, x, y, w, h);

    const holeSize = Math.max(0, num(this.sv, 'holeSize', this.holeSize));

    if (holeSize <= 0) {
      return;
    }

    const tabSize = num(this.sv, 'tabSize', this.tabSize);
    const holeColor = str(this.sv, 'holeColor', str(this.sv, 'fontColor', '#333333'));

    c.setFillColor(holeColor);
    c.setStrokeColor(holeColor);
    c.begin();
    c.ellipse(tabSize / 2 - holeSize, h / 2 - holeSize, holeSize * 2, holeSize * 2);
    c.fillAndStroke();
  }

  /** Shapes.js:8477 */
  override getLabelBounds(rect: Rectangle): Rectangle {
    const tabSize = num(this.sv, 'tabSize', this.tabSize) * this.scale;

    return new Rectangle(rect.x + tabSize, rect.y, rect.width - tabSize, rect.height);
  }
}

// ---------------------------------------------------------------------------------------------
// Mindmap bang (Shapes.js:8570, registered 8637)
// ---------------------------------------------------------------------------------------------

export class MindmapBangShape extends DrawioActor {
  /** Shapes.js:10699 */
  override constraints: ConnectionConstraint[] | null = ELLIPSE_CONSTRAINTS;

  override isRoundable(): boolean {
    return false;
  }

  /** Shapes.js:8582 */
  override redrawPath(c: Canvas, _x: number, _y: number, w: number, h: number): void {
    const W = w * 0.8;
    const H = h * 0.8;
    const r = W * 0.15;
    const r80 = r * 0.8;
    const ox = W * 0.1;
    const oy = H * 0.1;

    let px = ox;
    let py = oy;
    c.moveTo(px, py);

    // Top: 4 arcs left->right; corners spike up by 0.1*H.
    px += W * 0.25; py += -H * 0.1; arcTo(c, r, r, 0, 0, 0, px, py);
    px += W * 0.25; py += 0; arcTo(c, r, r, 0, 0, 0, px, py);
    px += W * 0.25; py += 0; arcTo(c, r, r, 0, 0, 0, px, py);
    px += W * 0.25; py += H * 0.1; arcTo(c, r, r, 0, 0, 0, px, py);

    // Right: 3 arcs top->bottom; middle spike protrudes right.
    px += W * 0.15; py += H * 0.33; arcTo(c, r, r, 0, 0, 0, px, py);
    px += 0; py += H * 0.34; arcTo(c, r80, r80, 0, 0, 0, px, py);
    px += -W * 0.15; py += H * 0.33; arcTo(c, r, r, 0, 0, 0, px, py);

    // Bottom: 4 arcs right->left; corners spike down by 0.15*H.
    px += -W * 0.25; py += H * 0.15; arcTo(c, r, r, 0, 0, 0, px, py);
    px += -W * 0.25; py += 0; arcTo(c, r, r, 0, 0, 0, px, py);
    px += -W * 0.25; py += 0; arcTo(c, r, r, 0, 0, 0, px, py);
    px += -W * 0.25; py += -H * 0.15; arcTo(c, r, r, 0, 0, 0, px, py);

    // Left: 3 arcs bottom->top; middle spike protrudes left.
    px += -W * 0.1; py += -H * 0.33; arcTo(c, r, r, 0, 0, 0, px, py);
    px += 0; py += -H * 0.34; arcTo(c, r80, r80, 0, 0, 0, px, py);
    px += W * 0.1; py += -H * 0.33; arcTo(c, r, r, 0, 0, 0, px, py);

    c.close();
  }

  /** Shapes.js:8627 */
  override getLabelBounds(rect: Rectangle): Rectangle {
    const insetX = rect.width * 0.1;
    const insetY = rect.height * 0.1;

    return new Rectangle(rect.x + insetX, rect.y + insetY, rect.width - insetX * 2, rect.height - insetY * 2);
  }
}

// ---------------------------------------------------------------------------------------------
// Mermaid person (Shapes.js:8709, registered 8764)
// ---------------------------------------------------------------------------------------------

export interface MermaidPersonGeometry {
  headRadius: number;
  bodyTop: number;
  bodyHeight: number;
  bodyRadius: number;
}

export class MermaidPersonShape extends DrawioShape {
  /** Shapes.js:8720 */
  static getGeometry(w: number, h: number): MermaidPersonGeometry {
    const headRadius = Math.min(Math.max(w * 0.23, 16), 56);
    const bodyTop = Math.min(h, 2 * headRadius - headRadius * 0.27);
    const bodyHeight = h - bodyTop;

    return {
      headRadius,
      bodyTop,
      bodyHeight,
      bodyRadius: Math.max(0, Math.min(w * 0.177, bodyHeight * 0.45)),
    };
  }

  /** Shapes.js:8730 */
  override paintVertexShape(c: Canvas, x: number, y: number, w: number, h: number): void {
    const g = MermaidPersonShape.getGeometry(w, h);
    const r = g.headRadius;

    const head = () => {
      c.ellipse(x + w / 2 - r, y, 2 * r, 2 * r);
      c.fillAndStroke();
    };

    // The head is drawn over the body so the full circle stays visible. With a shadow, the
    // head is painted first as well so its shadow falls behind the body instead of onto it.
    if (this.isShadow) {
      head();
    }

    c.roundrect(x, y + g.bodyTop, w, g.bodyHeight, g.bodyRadius, g.bodyRadius);
    c.fillAndStroke();
    c.setShadow(false);
    head();
  }

  /** Shapes.js:8755 */
  override getLabelBounds(rect: Rectangle): Rectangle {
    const g = MermaidPersonShape.getGeometry(rect.width / this.scale, rect.height / this.scale);

    return new Rectangle(rect.x, rect.y + g.bodyTop * this.scale, rect.width, g.bodyHeight * this.scale);
  }
}

// ---------------------------------------------------------------------------------------------
// Mermaid use case actor (Shapes.js:8772, registered 8890)
// ---------------------------------------------------------------------------------------------

export class MermaidUsecaseActorShape extends DrawioShape {
  /** Width and height of the figure the paths are defined in, centered at 0,0. */
  figureWidth = 56;
  figureHeight = 72;
  /** Head circle (center y and radius) of each figure. */
  heads: Record<string, [number, number]> = { normal: [-24, 12], hollow: [-23, 9], awesome: [-21, 13] };

  /** Shapes.js:8792 */
  override paintVertexShape(c: Canvas, x: number, y: number, w: number, h: number): void {
    let type = str(this.sv, 'actorType', 'normal');
    type = Object.prototype.hasOwnProperty.call(this.heads, type) ? type : 'normal';
    const sx = w / this.figureWidth;
    const sy = h / this.figureHeight;
    const cx = x + w / 2;
    const cy = y + h / 2;

    const px = (value: number) => cx + value * sx;
    const py = (value: number) => cy + value * sy;

    // Closed circle of four cubic arcs, as Mermaid draws the heads
    const circle = (ccy: number, r: number) => {
      const k = r * 0.55228;
      c.moveTo(px(0), py(ccy + r));
      c.curveTo(px(k), py(ccy + r), px(r), py(ccy + k), px(r), py(ccy));
      c.curveTo(px(r), py(ccy - k), px(k), py(ccy - r), px(0), py(ccy - r));
      c.curveTo(px(-k), py(ccy - r), px(-r), py(ccy - k), px(-r), py(ccy));
      c.curveTo(px(-r), py(ccy + k), px(-k), py(ccy + r), px(0), py(ccy + r));
      c.close();
    };

    c.begin();

    if (type == 'hollow') {
      circle(-23, 9);
      c.moveTo(px(-22), py(-10));
      c.lineTo(px(22), py(-10));
      c.lineTo(px(22), py(0));
      c.lineTo(px(6), py(0));
      c.lineTo(px(22), py(17));
      c.lineTo(px(13), py(28));
      c.lineTo(px(0), py(13));
      c.lineTo(px(-13), py(28));
      c.lineTo(px(-22), py(17));
      c.lineTo(px(-6), py(0));
      c.lineTo(px(-22), py(0));
      c.close();
      c.stroke();
    } else if (type == 'awesome') {
      circle(-21, 13);
      c.moveTo(px(-24), py(25));
      c.curveTo(px(-24), py(7), px(-14), py(-3), px(0), py(-3));
      c.curveTo(px(14), py(-3), px(24), py(7), px(24), py(25));
      c.curveTo(px(24), py(28), px(21), py(30), px(18), py(30));
      c.lineTo(px(-18), py(30));
      c.curveTo(px(-21), py(30), px(-24), py(28), px(-24), py(25));
      c.close();
      c.fillAndStroke();
    } else {
      // The lines enclose no area, so only the head is filled
      circle(-24, 12);
      c.moveTo(px(0), py(-12));
      c.lineTo(px(0), py(8));
      c.moveTo(px(-17), py(-5));
      c.lineTo(px(17), py(-5));
      c.moveTo(px(0), py(8));
      c.lineTo(px(-15), py(28));
      c.moveTo(px(0), py(8));
      c.lineTo(px(15), py(28));
      c.fillAndStroke();
    }

    if (flag(this.sv, 'business', false)) {
      // Mermaid's businessMarkerPathForCircle: a chord at 60 degrees, offset from the center of
      // the head by 0.6 of its radius
      const head = this.heads[type];
      const r = head[1];
      const offset = r * 0.6;
      const half = r * Math.sqrt(1 - 0.36);
      const dx = Math.cos(Math.PI / 3);
      const dy = -Math.sin(Math.PI / 3);
      const mx = offset * -dy;
      const my = head[0] + offset * dx;

      c.setShadow(false);
      c.begin();
      c.moveTo(px(mx - half * dx), py(my - half * dy));
      c.lineTo(px(mx + half * dx), py(my + half * dy));
      c.stroke();
    }
  }
}

