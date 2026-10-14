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
 * Ported from jgraph/drawio v32.4.1 src/main/webapp/js/grapheditor/Shapes.js:5482-6975
 * (mxShapeBasicRect2, registered as 'mxgraph.basic.rect' at Shapes.js:6973).
 * The drawing helpers below Shapes.js:5639 are a mechanical transliteration of the draw.io
 * source (var -> let, sc.fn -> fn, typed parameters, arcTo flags normalised).
 */

import type { DirectionValue } from '@maxgraph/core';
import { ConnectionConstraint } from '@maxgraph/core';
import { DrawioActor } from './base';
import { arcTo, clamp, flag, num, str, type Canvas } from './util';

/** Shapes.js:5503 mxShapeBasicRect2.prototype.customProperties (data for a properties panel). */
export const BASIC_RECT2_CUSTOM_PROPERTIES = [
  {
    name: 'rectStyle', dispName: 'Style', type: 'enum', defVal: 'square',
    enumList: [
      { val: 'square', dispName: 'Square' },
      { val: 'rounded', dispName: 'Round' },
      { val: 'snip', dispName: 'Snip' },
      { val: 'invRound', dispName: 'Inv. Round' },
      { val: 'fold', dispName: 'Fold' },
    ],
  },
  { name: 'size', dispName: 'Corner Size', type: 'float', defVal: 10 },
  { name: 'absoluteCornerSize', dispName: 'Abs. Corner Size', type: 'bool', defVal: true },
  { name: 'indent', dispName: 'Indent', type: 'float', defVal: 2 },
  {
    name: 'rectOutline', dispName: 'Outline', type: 'enum', defVal: 'single',
    enumList: [
      { val: 'single', dispName: 'Single' },
      { val: 'double', dispName: 'Double' },
      { val: 'frame', dispName: 'Frame' },
    ],
  },
  { name: 'fillColor2', dispName: 'Inside Fill Color', type: 'color', defVal: 'none' },
  { name: 'gradientColor2', dispName: 'Inside Gradient Color', type: 'color', defVal: 'none' },
  {
    name: 'gradientDirection2', dispName: 'Inside Gradient Direction', type: 'enum', defVal: 'south',
    enumList: [
      { val: 'south', dispName: 'South' },
      { val: 'west', dispName: 'West' },
      { val: 'north', dispName: 'North' },
      { val: 'east', dispName: 'East' },
    ],
  },
  { name: 'top', dispName: 'Top Line', type: 'bool', defVal: true },
  { name: 'right', dispName: 'Right', type: 'bool', defVal: true },
  { name: 'bottom', dispName: 'Bottom Line', type: 'bool', defVal: true },
  { name: 'left', dispName: 'Left ', type: 'bool', defVal: true },
  ...(['topLeftStyle', 'topRightStyle', 'bottomRightStyle', 'bottomLeftStyle'] as const).map((name) => ({
    name,
    dispName: {
      topLeftStyle: 'Top Left Style',
      topRightStyle: 'Top Right Style',
      bottomRightStyle: 'Bottom Right Style',
      bottomLeftStyle: 'Bottom Left Style',
    }[name],
    type: 'enum',
    defVal: 'default',
    enumList: [
      { val: 'default', dispName: 'Default' },
      { val: 'square', dispName: 'Square' },
      { val: 'rounded', dispName: 'Round' },
      { val: 'snip', dispName: 'Snip' },
      { val: 'invRound', dispName: 'Inv. Round' },
      { val: 'fold', dispName: 'Fold' },
    ],
  })),
];

/** Optional overrides of strictDrawShape (draw.io's `os` argument). */
export interface Rect2Overrides {
  rectStyle?: string;
  absoluteCornerSize?: boolean;
  size?: number;
  rectOutline?: string;
  indent?: number;
  dashed?: boolean;
  dashPattern?: string;
  relIndent?: number;
  top?: boolean;
  right?: boolean;
  bottom?: boolean;
  left?: boolean;
  topLeftStyle?: string;
  topRightStyle?: string;
  bottomRightStyle?: string;
  bottomLeftStyle?: string;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  fillColor2?: string;
  gradientColor2?: string;
  gradientDirection2?: DirectionValue;
  opacity?: number;
}

/** Resolved values passed from strictDrawShape to the transliterated body. */
export interface Rect2Values {
  rectStyle: string;
  rectOutline: string;
  topLeftStyle: string;
  topRightStyle: string;
  bottomRightStyle: string;
  bottomLeftStyle: string;
  fillColor: string;
  fillColor2: string;
  gradientColor2: string;
  gdir2: DirectionValue;
  opacity: number;
  size: number;
  indent: number;
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
}

/** mxShapeBasicRect2 (Shapes.js:5482) */
export class BasicRect2Shape extends DrawioActor {
  /** Shapes.js:5501 */
  static readonly cst = { RECT2: 'mxgraph.basic.rect' } as const;
  static readonly customProperties = BASIC_RECT2_CUSTOM_PROPERTIES;

  rectStyle = 'square';
  size = 10;
  absoluteCornerSize = true;
  indent = 2;
  rectOutline = 'single';
  /** Shapes.js:6975 */
  override constraints: ConnectionConstraint[] | null = null;

  /** Shapes.js:5577 */
  override paintVertexShape(c: Canvas, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);
    this.strictDrawShape(c, 0, 0, w, h);
  }

  /** Shapes.js:5584 */
  strictDrawShape(c: Canvas, x: number, y: number, w: number, h: number, os?: Rect2Overrides | null): void {
    const st = this.sv;
    // read styles or optionally override them externally via "os" variable
    const rectStyle = os?.rectStyle || str(st, 'rectStyle', this.rectStyle);
    const absoluteCornerSize = os?.absoluteCornerSize || flag(st, 'absoluteCornerSize', this.absoluteCornerSize);
    let size = os?.size || clamp(num(st, 'size', this.size), 0, w);
    const rectOutline = os?.rectOutline || str(st, 'rectOutline', this.rectOutline);
    let indent = os?.indent || clamp(num(st, 'indent', this.indent), 0, w);
    const dashed = os?.dashed || flag(st, 'dashed', false);
    const dashPattern = os?.dashPattern || str(st, 'dashPattern', '');
    const relIndent = os?.relIndent || clamp(indent, 0, 50);
    const top = os?.top || flag(st, 'top', true);
    const right = os?.right || flag(st, 'right', true);
    const bottom = os?.bottom || flag(st, 'bottom', true);
    const left = os?.left || flag(st, 'left', true);
    const topLeftStyle = os?.topLeftStyle || str(st, 'topLeftStyle', 'default');
    const topRightStyle = os?.topRightStyle || str(st, 'topRightStyle', 'default');
    const bottomRightStyle = os?.bottomRightStyle || str(st, 'bottomRightStyle', 'default');
    const bottomLeftStyle = os?.bottomLeftStyle || str(st, 'bottomLeftStyle', 'default');
    const fillColor = os?.fillColor || str(st, 'fillColor', '#ffffff');
    const strokeWidth = os?.strokeWidth || num(st, 'strokeWidth', 1);
    const fillColor2 = os?.fillColor2 || str(st, 'fillColor2', 'none');
    const gradientColor2 = os?.gradientColor2 || str(st, 'gradientColor2', 'none');
    const gdir2 = os?.gradientDirection2 || (str(st, 'gradientDirection2', 'south') as DirectionValue);
    const opacity = os?.opacity || num(st, 'opacity', 100);

    const relSize = Math.max(0, Math.min(50, size));

    c.setDashed(dashed);

    if (dashPattern && dashPattern != '') {
      c.setDashPattern(dashPattern);
    }

    c.setStrokeWidth(strokeWidth);

    size = Math.min(h * 0.5, w * 0.5, size);

    if (!absoluteCornerSize) {
      size = (relSize * Math.min(w, h)) / 100;
    }

    size = Math.min(size, Math.min(w, h) * 0.5);

    if (!absoluteCornerSize) {
      indent = Math.min((relIndent * Math.min(w, h)) / 100);
    }

    indent = Math.min(indent, Math.min(w, h) * 0.5 - size);

    drawRect2Body(c, x, y, w, h, {
      rectStyle, rectOutline, topLeftStyle, topRightStyle, bottomRightStyle, bottomLeftStyle,
      fillColor, fillColor2, gradientColor2, gdir2, opacity, size, indent, top, right, bottom, left,
    });
  }
}

// ---------------------------------------------------------------------------------------------
// Transliterated from Shapes.js:5639-6971
// ---------------------------------------------------------------------------------------------

export function drawRect2Body(c: Canvas, x: number, y: number, w: number, h: number, v: Rect2Values): void {
  const { rectStyle, rectOutline, topLeftStyle, topRightStyle, bottomRightStyle, bottomLeftStyle,
    fillColor, fillColor2, gradientColor2, gdir2, opacity, size, indent, top, right, bottom, left } = v;
  if ((top || right || bottom || left) && rectOutline != 'frame')
  {

    //outline fill
    c.begin();
    if (!top)
    {
      c.moveTo(0,0);
    }
    else
    {
      moveNW(c, x, y, w, h, rectStyle, topLeftStyle, size, left);
    }

    if (top)
    {
      paintNW(c, x, y, w, h, rectStyle, topLeftStyle, size, left);
    }

    paintTop(c, x, y, w, h, rectStyle, topRightStyle, size, right);

    if (right)
    {
      paintNE(c, x, y, w, h, rectStyle, topRightStyle, size, top);
    }

    paintRight(c, x, y, w, h, rectStyle, bottomRightStyle, size, bottom);

    if (bottom)
    {
      paintSE(c, x, y, w, h, rectStyle, bottomRightStyle, size, right);
    }

    paintBottom(c, x, y, w, h, rectStyle, bottomLeftStyle, size, left);

    if (left)
    {
      paintSW(c, x, y, w, h, rectStyle, bottomLeftStyle, size, bottom);
    }

    paintLeft(c, x, y, w, h, rectStyle, topLeftStyle, size, top);
    c.close();
    c.fill();

    c.setShadow(false);

    //inner fill
    c.setFillColor(fillColor2);
    let op1 = opacity;
    let op2 = opacity;

    if (fillColor2 == 'none')
    {
      op1 = 0;
    }

    if (gradientColor2 == 'none')
    {
      op2 = 0;
    }

    c.setGradient(fillColor2, gradientColor2, 0, 0, w, h, gdir2, op1, op2);

    c.begin();

    if (!top)
    {
      c.moveTo(indent,0);
    }
    else
    {
      moveNWInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent, top, left);
    }

    paintLeftInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, bottom, left);

    if (left && bottom)
    {
      paintSWInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, bottom);
    }

    paintBottomInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent, right, bottom);

    if (bottom && right)
    {
      paintSEInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent);
    }

    paintRightInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent, top, right);

    if (right && top)
    {
      paintNEInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent);
    }

    paintTopInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent, left, top);

    if (top && left)
    {
      paintNWInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent);
    }

    c.fill();

    if (fillColor == 'none')
    {
      c.begin();
      paintFolds(c, x, y, w, h, rectStyle, topLeftStyle, topRightStyle, bottomRightStyle, bottomLeftStyle, size, top, right, bottom, left);
      c.stroke();
    }
  }

  //draw all the combinations
  if (!top && !right && !bottom && left)
  {

    if (rectOutline != 'frame')
    {
      c.begin();
      moveSW(c, x, y, w, h, rectStyle, topLeftStyle, size, bottom);
      paintLeft(c, x, y, w, h, rectStyle, topLeftStyle, size, top);

      if (rectOutline == 'double')
      {
        moveNWInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent, top, left);
        paintLeftInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, bottom, left);
      }

      c.stroke();
    }
    else
    {
      c.begin();
      moveSW(c, x, y, w, h, rectStyle, topLeftStyle, size, bottom);
      paintLeft(c, x, y, w, h, rectStyle, topLeftStyle, size, top);
      lineNWInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent, top, left);
      paintLeftInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, bottom, left);
      c.close();
      c.fillAndStroke();
    }
  }
  else if (!top && !right && bottom && !left)
  {
    if (rectOutline != 'frame')
    {
      c.begin();
      moveSE(c, x, y, w, h, rectStyle, bottomRightStyle, size, right);
      paintBottom(c, x, y, w, h, rectStyle, bottomLeftStyle, size, left);

      if (rectOutline == 'double')
      {
        moveSWInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, left);
        paintBottomInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent, right, bottom);
      }

      c.stroke();
    }
    else
    {
      c.begin();
      moveSE(c, x, y, w, h, rectStyle, bottomRightStyle, size, right);
      paintBottom(c, x, y, w, h, rectStyle, bottomLeftStyle, size, left);
      lineSWInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, left);
      paintBottomInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent, right, bottom);
      c.close();
      c.fillAndStroke();
    }
  }
  else if (!top && !right && bottom && left)
  {
    if (rectOutline != 'frame')
    {
      c.begin();
      moveSE(c, x, y, w, h, rectStyle, bottomRightStyle, size, right);
      paintBottom(c, x, y, w, h, rectStyle, bottomLeftStyle, size, left);
      paintSW(c, x, y, w, h, rectStyle, bottomLeftStyle, size, bottom);
      paintLeft(c, x, y, w, h, rectStyle, topLeftStyle, size, top);

      if (rectOutline == 'double')
      {
        moveNWInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent, top, left);
        paintLeftInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, bottom, left);
        paintSWInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, bottom);
        paintBottomInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent, right, bottom);
      }

      c.stroke();
    }
    else
    {
      c.begin();
      moveSE(c, x, y, w, h, rectStyle, bottomRightStyle, size, right);
      paintBottom(c, x, y, w, h, rectStyle, bottomLeftStyle, size, left);
      paintSW(c, x, y, w, h, rectStyle, bottomLeftStyle, size, bottom);
      paintLeft(c, x, y, w, h, rectStyle, topLeftStyle, size, top);
      lineNWInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent, top, left);
      paintLeftInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, bottom, left);
      paintSWInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, bottom);
      paintBottomInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent, right, bottom);
      c.close();
      c.fillAndStroke();
    }
  }
  else if (!top && right && !bottom && !left)
  {
    if (rectOutline != 'frame')
    {
      c.begin();
      moveNE(c, x, y, w, h, rectStyle, topRightStyle, size, top);
      paintRight(c, x, y, w, h, rectStyle, bottomRightStyle, size, bottom);

      if (rectOutline == 'double')
      {
        moveSEInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent, bottom);
        paintRightInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent, top, right);
      }

      c.stroke();
    }
    else
    {
      c.begin();
      moveNE(c, x, y, w, h, rectStyle, topRightStyle, size, top);
      paintRight(c, x, y, w, h, rectStyle, bottomRightStyle, size, bottom);
      lineSEInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent, bottom);
      paintRightInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent, top, right);
      c.close();
      c.fillAndStroke();
    }
  }
  else if (!top && right && !bottom && left)
  {
    if (rectOutline != 'frame')
    {
      c.begin();
      moveSW(c, x, y, w, h, rectStyle, topLeftStyle, size, bottom);
      paintLeft(c, x, y, w, h, rectStyle, topLeftStyle, size, top);

      if (rectOutline == 'double')
      {
        moveNWInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent, top, left);
        paintLeftInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, bottom, left);
      }

      c.stroke();

      c.begin();
      moveNE(c, x, y, w, h, rectStyle, topRightStyle, size, top);
      paintRight(c, x, y, w, h, rectStyle, bottomRightStyle, size, bottom);

      if (rectOutline == 'double')
      {
        moveSEInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent, bottom);
        paintRightInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent, top, right);
      }

      c.stroke();
    }
    else
    {
      c.begin();
      moveSW(c, x, y, w, h, rectStyle, topLeftStyle, size, bottom);
      paintLeft(c, x, y, w, h, rectStyle, topLeftStyle, size, top);
      lineNWInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent, top, left);
      paintLeftInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, bottom, left);
      c.close();
      c.fillAndStroke();

      c.begin();
      moveNE(c, x, y, w, h, rectStyle, topRightStyle, size, top);
      paintRight(c, x, y, w, h, rectStyle, bottomRightStyle, size, bottom);
      lineSEInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent, bottom);
      paintRightInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent, top, right);
      c.close();
      c.fillAndStroke();
    }
  }
  else if (!top && right && bottom && !left)
  {
    if (rectOutline != 'frame')
    {
      c.begin();
      moveNE(c, x, y, w, h, rectStyle, topRightStyle, size, top);
      paintRight(c, x, y, w, h, rectStyle, bottomRightStyle, size, bottom);
      paintSE(c, x, y, w, h, rectStyle, bottomRightStyle, size, right);
      paintBottom(c, x, y, w, h, rectStyle, bottomLeftStyle, size, left);

      if (rectOutline == 'double')
      {
        moveSWInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, left);
        paintBottomInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent, right, bottom);
        paintSEInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent);
        paintRightInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent, top, right);
      }

      c.stroke();
    }
    else
    {
      c.begin();
      moveNE(c, x, y, w, h, rectStyle, topRightStyle, size, top);
      paintRight(c, x, y, w, h, rectStyle, bottomRightStyle, size, bottom);
      paintSE(c, x, y, w, h, rectStyle, bottomRightStyle, size, right);
      paintBottom(c, x, y, w, h, rectStyle, bottomLeftStyle, size, left);
      lineSWInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, left);
      paintBottomInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent, right, bottom);
      paintSEInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent);
      paintRightInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent, top, right);
      c.close();
      c.fillAndStroke();
    }
  }
  else if (!top && right && bottom && left)
  {
    if (rectOutline != 'frame')
    {
      c.begin();
      moveNE(c, x, y, w, h, rectStyle, topRightStyle, size, top);
      paintRight(c, x, y, w, h, rectStyle, bottomRightStyle, size, bottom);
      paintSE(c, x, y, w, h, rectStyle, bottomRightStyle, size, right);
      paintBottom(c, x, y, w, h, rectStyle, bottomLeftStyle, size, left);
      paintSW(c, x, y, w, h, rectStyle, bottomLeftStyle, size, bottom);
      paintLeft(c, x, y, w, h, rectStyle, topLeftStyle, size, top);

      if (rectOutline == 'double')
      {
        moveNWInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent, top, left);
        paintLeftInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, bottom, left);
        paintSWInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, bottom);
        paintBottomInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent, right, bottom);
        paintSEInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent);
        paintRightInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent, top, right);
      }

      c.stroke();
    }
    else
    {
      c.begin();
      moveNE(c, x, y, w, h, rectStyle, topRightStyle, size, top);
      paintRight(c, x, y, w, h, rectStyle, bottomRightStyle, size, bottom);
      paintSE(c, x, y, w, h, rectStyle, bottomRightStyle, size, right);
      paintBottom(c, x, y, w, h, rectStyle, bottomLeftStyle, size, left);
      paintSW(c, x, y, w, h, rectStyle, bottomLeftStyle, size, bottom);
      paintLeft(c, x, y, w, h, rectStyle, topLeftStyle, size, top);
      lineNWInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent, top, left);
      paintLeftInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, bottom, left);
      paintSWInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, bottom);
      paintBottomInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent, right, bottom);
      paintSEInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent);
      paintRightInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent, top, right);
      c.close();
      c.fillAndStroke();
    }
  }
  else if (top && !right && !bottom && !left)
  {
    if (rectOutline != 'frame')
    {
      c.begin();
      moveNW(c, x, y, w, h, rectStyle, topLeftStyle, size, left);
      paintTop(c, x, y, w, h, rectStyle, topRightStyle, size, right);

      if (rectOutline == 'double')
      {
        moveNEInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent, right);
        paintTopInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent, left, top);
      }

      c.stroke();
    }
    else
    {
      c.begin();
      moveNW(c, x, y, w, h, rectStyle, topLeftStyle, size, left);
      paintTop(c, x, y, w, h, rectStyle, topRightStyle, size, right);
      lineNEInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent, right);
      paintTopInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent, left, top);
      c.close();
      c.fillAndStroke();
    }
  }
  else if (top && !right && !bottom && left)
  {
    if (rectOutline != 'frame')
    {
      c.begin();
      moveSW(c, x, y, w, h, rectStyle, bottomLeftStyle, size, bottom);
      paintLeft(c, x, y, w, h, rectStyle, topLeftStyle, size, top);
      paintNW(c, x, y, w, h, rectStyle, topLeftStyle, size, left);
      paintTop(c, x, y, w, h, rectStyle, topRightStyle, size, right);

      if (rectOutline == 'double')
      {
        moveNEInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent, right);
        paintTopInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent, left, top);
        paintNWInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent);
        paintLeftInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, bottom, left);
      }

      c.stroke();
    }
    else
    {
      c.begin();
      moveSW(c, x, y, w, h, rectStyle, bottomLeftStyle, size, bottom);
      paintLeft(c, x, y, w, h, rectStyle, topLeftStyle, size, top);
      paintNW(c, x, y, w, h, rectStyle, topLeftStyle, size, left);
      paintTop(c, x, y, w, h, rectStyle, topRightStyle, size, right);
      lineNEInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent, right);
      paintTopInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent, left, top);
      paintNWInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent);
      paintLeftInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, bottom, left);
      c.close();
      c.fillAndStroke();
    }
  }
  else if (top && !right && bottom && !left)
  {
    if (rectOutline != 'frame')
    {
      c.begin();
      moveNW(c, x, y, w, h, rectStyle, topLeftStyle, size, left);
      paintTop(c, x, y, w, h, rectStyle, topRightStyle, size, right);

      if (rectOutline == 'double')
      {
        moveNEInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent, right);
        paintTopInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent, left, top);
      }

      c.stroke();

      c.begin();
      moveSE(c, x, y, w, h, rectStyle, bottomRightStyle, size, right);
      paintBottom(c, x, y, w, h, rectStyle, bottomLeftStyle, size, left);

      if (rectOutline == 'double')
      {
        moveSWInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, left);
        paintBottomInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent, right, bottom);
      }

      c.stroke();
    }
    else
    {
      c.begin();
      moveNW(c, x, y, w, h, rectStyle, topLeftStyle, size, left);
      paintTop(c, x, y, w, h, rectStyle, topRightStyle, size, right);
      lineNEInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent, right);
      paintTopInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent, left, top);
      c.close();
      c.fillAndStroke();

      c.begin();
      moveSE(c, x, y, w, h, rectStyle, bottomRightStyle, size, right);
      paintBottom(c, x, y, w, h, rectStyle, bottomLeftStyle, size, left);
      lineSWInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, left);
      paintBottomInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent, right, bottom);
      c.close();
      c.fillAndStroke();
    }
  }
  else if (top && !right && bottom && left)
  {
    if (rectOutline != 'frame')
    {
      c.begin();
      moveSE(c, x, y, w, h, rectStyle, bottomRightStyle, size, right);
      paintBottom(c, x, y, w, h, rectStyle, bottomLeftStyle, size, left);
      paintSW(c, x, y, w, h, rectStyle, bottomLeftStyle, size, bottom);
      paintLeft(c, x, y, w, h, rectStyle, topLeftStyle, size, top);
      paintNW(c, x, y, w, h, rectStyle, topLeftStyle, size, left);
      paintTop(c, x, y, w, h, rectStyle, topRightStyle, size, right);

      if (rectOutline == 'double')
      {
        moveNEInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent, right);
        paintTopInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent, left, top);
        paintNWInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent);
        paintLeftInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, bottom, left);
        paintSWInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, bottom);
        paintBottomInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent, right, bottom);
      }

      c.stroke();
    }
    else
    {
      c.begin();
      moveSE(c, x, y, w, h, rectStyle, bottomRightStyle, size, right);
      paintBottom(c, x, y, w, h, rectStyle, bottomLeftStyle, size, left);
      paintSW(c, x, y, w, h, rectStyle, bottomLeftStyle, size, bottom);
      paintLeft(c, x, y, w, h, rectStyle, topLeftStyle, size, top);
      paintNW(c, x, y, w, h, rectStyle, topLeftStyle, size, left);
      paintTop(c, x, y, w, h, rectStyle, topRightStyle, size, right);
      lineNEInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent, right);
      paintTopInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent, left, top);
      paintNWInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent);
      paintLeftInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, bottom, left);
      paintSWInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, bottom);
      paintBottomInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent, right, bottom);
      c.close();
      c.fillAndStroke();
    }
  }
  else if (top && right && !bottom && !left)
  {
    if (rectOutline != 'frame')
    {
      c.begin();
      moveNW(c, x, y, w, h, rectStyle, topLeftStyle, size, left);
      paintTop(c, x, y, w, h, rectStyle, topRightStyle, size, right);
      paintNE(c, x, y, w, h, rectStyle, topRightStyle, size, top);
      paintRight(c, x, y, w, h, rectStyle, bottomRightStyle, size, bottom);

      if (rectOutline == 'double')
      {
        moveSEInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent, bottom);
        paintRightInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent, top, right);
        paintNEInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent);
        paintTopInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent, left, top);
      }

      c.stroke();
    }
    else
    {
      c.begin();
      moveNW(c, x, y, w, h, rectStyle, topLeftStyle, size, left);
      paintTop(c, x, y, w, h, rectStyle, topRightStyle, size, right);
      paintNE(c, x, y, w, h, rectStyle, topRightStyle, size, top);
      paintRight(c, x, y, w, h, rectStyle, bottomRightStyle, size, bottom);
      lineSEInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent, bottom);
      paintRightInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent, top, right);
      paintNEInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent);
      paintTopInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent, left, top);
      c.close();
      c.fillAndStroke();
    }
  }
  else if (top && right && !bottom && left)
  {
    if (rectOutline != 'frame')
    {
      c.begin();
      moveSW(c, x, y, w, h, rectStyle, bottomLeftStyle, size, bottom);
      paintLeft(c, x, y, w, h, rectStyle, topLeftStyle, size, top);
      paintNW(c, x, y, w, h, rectStyle, topLeftStyle, size, left);
      paintTop(c, x, y, w, h, rectStyle, topRightStyle, size, right);
      paintNE(c, x, y, w, h, rectStyle, topRightStyle, size, top);
      paintRight(c, x, y, w, h, rectStyle, bottomRightStyle, size, bottom);

      if (rectOutline == 'double')
      {
        moveSEInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent, bottom);
        paintRightInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent, top, right);
        paintNEInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent);
        paintTopInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent, left, top);
        paintNWInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent);
        paintLeftInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, bottom, left);
      }

      c.stroke();
    }
    else
    {
      c.begin();
      moveSW(c, x, y, w, h, rectStyle, bottomLeftStyle, size, bottom);
      paintLeft(c, x, y, w, h, rectStyle, topLeftStyle, size, top);
      paintNW(c, x, y, w, h, rectStyle, topLeftStyle, size, left);
      paintTop(c, x, y, w, h, rectStyle, topRightStyle, size, right);
      paintNE(c, x, y, w, h, rectStyle, topRightStyle, size, top);
      paintRight(c, x, y, w, h, rectStyle, bottomRightStyle, size, bottom);
      lineSEInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent, bottom);
      paintRightInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent, top, right);
      paintNEInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent);
      paintTopInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent, left, top);
      paintNWInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent);
      paintLeftInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, bottom, left);
      c.close();
      c.fillAndStroke();
    }
  }
  else if (top && right && bottom && !left)
  {
    if (rectOutline != 'frame')
    {
      c.begin();
      moveNW(c, x, y, w, h, rectStyle, topLeftStyle, size, left);
      paintTop(c, x, y, w, h, rectStyle, topRightStyle, size, right);
      paintNE(c, x, y, w, h, rectStyle, topRightStyle, size, top);
      paintRight(c, x, y, w, h, rectStyle, bottomRightStyle, size, bottom);
      paintSE(c, x, y, w, h, rectStyle, bottomRightStyle, size, right);
      paintBottom(c, x, y, w, h, rectStyle, bottomLeftStyle, size, left);

      if (rectOutline == 'double')
      {
        moveSWInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, left);
        paintBottomInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent, right, bottom);
        paintSEInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent);
        paintRightInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent, top, right);
        paintNEInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent);
        paintTopInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent, left, top);
      }

      c.stroke();
    }
    else
    {
      c.begin();
      moveNW(c, x, y, w, h, rectStyle, topLeftStyle, size, left);
      paintTop(c, x, y, w, h, rectStyle, topRightStyle, size, right);
      paintNE(c, x, y, w, h, rectStyle, topRightStyle, size, top);
      paintRight(c, x, y, w, h, rectStyle, bottomRightStyle, size, bottom);
      paintSE(c, x, y, w, h, rectStyle, bottomRightStyle, size, right);
      paintBottom(c, x, y, w, h, rectStyle, bottomLeftStyle, size, left);
      lineSWInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, left);
      paintBottomInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent, right, bottom);
      paintSEInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent);
      paintRightInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent, top, right);
      paintNEInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent);
      paintTopInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent, left, top);
      c.close();
      c.fillAndStroke();
    }
  }
  else if (top && right && bottom && left)
  {
    if (rectOutline != 'frame')
    {
      c.begin();
      moveNW(c, x, y, w, h, rectStyle, topLeftStyle, size, left);
      paintNW(c, x, y, w, h, rectStyle, topLeftStyle, size, left);
      paintTop(c, x, y, w, h, rectStyle, topRightStyle, size, right);
      paintNE(c, x, y, w, h, rectStyle, topRightStyle, size, top);
      paintRight(c, x, y, w, h, rectStyle, bottomRightStyle, size, bottom);
      paintSE(c, x, y, w, h, rectStyle, bottomRightStyle, size, right);
      paintBottom(c, x, y, w, h, rectStyle, bottomLeftStyle, size, left);
      paintSW(c, x, y, w, h, rectStyle, bottomLeftStyle, size, bottom);
      paintLeft(c, x, y, w, h, rectStyle, topLeftStyle, size, top);
      c.close();

      if (rectOutline == 'double')
      {
        moveSWInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, left);
        paintSWInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, bottom);
        paintBottomInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent, right, bottom);
        paintSEInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent);
        paintRightInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent, top, right);
        paintNEInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent);
        paintTopInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent, left, top);
        paintNWInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent);
        paintLeftInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, bottom, left);
        c.close();
      }

      c.stroke();
    }
    else
    {
      c.begin();
      moveNW(c, x, y, w, h, rectStyle, topLeftStyle, size, left);
      paintNW(c, x, y, w, h, rectStyle, topLeftStyle, size, left);
      paintTop(c, x, y, w, h, rectStyle, topRightStyle, size, right);
      paintNE(c, x, y, w, h, rectStyle, topRightStyle, size, top);
      paintRight(c, x, y, w, h, rectStyle, bottomRightStyle, size, bottom);
      paintSE(c, x, y, w, h, rectStyle, bottomRightStyle, size, right);
      paintBottom(c, x, y, w, h, rectStyle, bottomLeftStyle, size, left);
      paintSW(c, x, y, w, h, rectStyle, bottomLeftStyle, size, bottom);
      paintLeft(c, x, y, w, h, rectStyle, topLeftStyle, size, top);
      c.close();
      moveSWInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, left);
      paintSWInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, bottom);
      paintBottomInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent, right, bottom);
      paintSEInner(c, x, y, w, h, rectStyle, bottomRightStyle, size, indent);
      paintRightInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent, top, right);
      paintNEInner(c, x, y, w, h, rectStyle, topRightStyle, size, indent);
      paintTopInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent, left, top);
      paintNWInner(c, x, y, w, h, rectStyle, topLeftStyle, size, indent);
      paintLeftInner(c, x, y, w, h, rectStyle, bottomLeftStyle, size, indent, bottom, left);
      c.close();
      c.fillAndStroke();
    }
  }

  c.begin();
  paintFolds(c, x, y, w, h, rectStyle, topLeftStyle, topRightStyle, bottomRightStyle, bottomLeftStyle, size, top, right, bottom, left);
  c.stroke();
}

/** Shapes.js:6331 */
function moveNW(c: Canvas, _x: number, _y: number, _w: number, _h: number, rectStyle: string, topLeftStyle: string, size: number, left: boolean): void
{
  if((topLeftStyle == 'square' || (topLeftStyle == 'default' && rectStyle == 'square' )) || !left)
  {
    c.moveTo(0, 0);
  }
  else
  {
    c.moveTo(0, size);
  }
}

/** Shapes.js:6343 */
function moveNE(c: Canvas, _x: number, _y: number, w: number, _h: number, rectStyle: string, topRightStyle: string, size: number, top: boolean): void
{
  if((topRightStyle == 'square' || (topRightStyle == 'default' && rectStyle == 'square' )) || !top)
  {
    c.moveTo(w, 0);
  }
  else
  {
    c.moveTo(w - size, 0);
  }
}

/** Shapes.js:6355 */
function moveSE(c: Canvas, _x: number, _y: number, w: number, h: number, rectStyle: string, bottomRightStyle: string, size: number, right: boolean): void
{
  if((bottomRightStyle == 'square' || (bottomRightStyle == 'default' && rectStyle == 'square' )) || !right)
  {
    c.moveTo(w, h);
  }
  else
  {
    c.moveTo(w, h - size);
  }
}

/** Shapes.js:6367 */
function moveSW(c: Canvas, _x: number, _y: number, _w: number, h: number, rectStyle: string, bottomLeftStyle: string, size: number, bottom: boolean): void
{
  if((bottomLeftStyle == 'square' || (bottomLeftStyle == 'default' && rectStyle == 'square' )) || !bottom)
  {
    c.moveTo(0, h);
  }
  else
  {
    c.moveTo(size, h);
  }
}

/** Shapes.js:6379 */
function paintNW(c: Canvas, _x: number, _y: number, _w: number, _h: number, rectStyle: string, topLeftStyle: string, size: number, left: boolean): void
{
  if (!left)
  {
    c.lineTo(0, 0);
  }
  else if((topLeftStyle == 'rounded' || (topLeftStyle == 'default' && rectStyle == 'rounded' )) ||
      (topLeftStyle == 'invRound' || (topLeftStyle == 'default' && rectStyle == 'invRound' )) )
  {
    let inv = 0;

    if (topLeftStyle == 'rounded' || (topLeftStyle == 'default' && rectStyle == 'rounded' ))
    {
      inv = 1;
    }

    arcTo(c, size, size, 0, 0, inv, size, 0);
  }
  else if((topLeftStyle == 'snip' || (topLeftStyle == 'default' && rectStyle == 'snip' )) ||
      (topLeftStyle == 'fold' || (topLeftStyle == 'default' && rectStyle == 'fold' )))
  {
    c.lineTo(size, 0);
  }
}

/** Shapes.js:6404 */
function paintTop(c: Canvas, _x: number, _y: number, w: number, _h: number, rectStyle: string, topRightStyle: string, size: number, right: boolean): void
{
  if((topRightStyle == 'square' || (topRightStyle == 'default' && rectStyle == 'square' )) || !right)
  {
    c.lineTo(w, 0);
  }
  else
  {
    c.lineTo(w - size, 0);
  }
}

/** Shapes.js:6416 */
function paintNE(c: Canvas, _x: number, _y: number, w: number, _h: number, rectStyle: string, topRightStyle: string, size: number, top: boolean): void
{
  if (!top)
  {
    c.lineTo(w, 0);
  }
  else if((topRightStyle == 'rounded' || (topRightStyle == 'default' && rectStyle == 'rounded' )) ||
      (topRightStyle == 'invRound' || (topRightStyle == 'default' && rectStyle == 'invRound' )) )
  {
    let inv = 0;

    if (topRightStyle == 'rounded' || (topRightStyle == 'default' && rectStyle == 'rounded' ))
    {
      inv = 1;
    }

    arcTo(c, size, size, 0, 0, inv, w, size);
  }
  else if((topRightStyle == 'snip' || (topRightStyle == 'default' && rectStyle == 'snip' )) ||
      (topRightStyle == 'fold' || (topRightStyle == 'default' && rectStyle == 'fold' )))
  {
    c.lineTo(w, size);
  }
}

/** Shapes.js:6441 */
function paintRight(c: Canvas, _x: number, _y: number, w: number, h: number, rectStyle: string, bottomRightStyle: string, size: number, bottom: boolean): void
{
  if((bottomRightStyle == 'square' || (bottomRightStyle == 'default' && rectStyle == 'square' )) || !bottom)
  {
    c.lineTo(w, h);
  }
  else
  {
    c.lineTo(w, h - size);
  }
}

/** Shapes.js:6453 */
function paintLeft(c: Canvas, _x: number, _y: number, _w: number, _h: number, rectStyle: string, topLeftStyle: string, size: number, top: boolean): void
{
  if((topLeftStyle == 'square' || (topLeftStyle == 'default' && rectStyle == 'square' )) || !top)
  {
    c.lineTo(0, 0);
  }
  else
  {
    c.lineTo(0, size);
  }
}

/** Shapes.js:6465 */
function paintSE(c: Canvas, _x: number, _y: number, w: number, h: number, rectStyle: string, bottomRightStyle: string, size: number, right: boolean): void
{
  if (!right)
  {
    c.lineTo(w, h);
  }
  else if((bottomRightStyle == 'rounded' || (bottomRightStyle == 'default' && rectStyle == 'rounded' )) ||
      (bottomRightStyle == 'invRound' || (bottomRightStyle == 'default' && rectStyle == 'invRound' )) )
  {
    let inv = 0;

    if (bottomRightStyle == 'rounded' || (bottomRightStyle == 'default' && rectStyle == 'rounded' ))
    {
      inv = 1;
    }

    arcTo(c, size, size, 0, 0, inv, w - size, h);
  }
  else if((bottomRightStyle == 'snip' || (bottomRightStyle == 'default' && rectStyle == 'snip' )) ||
      (bottomRightStyle == 'fold' || (bottomRightStyle == 'default' && rectStyle == 'fold' )))
  {
    c.lineTo(w - size, h);
  }
}

/** Shapes.js:6490 */
function paintBottom(c: Canvas, _x: number, _y: number, _w: number, h: number, rectStyle: string, bottomLeftStyle: string, size: number, left: boolean): void
{
  if((bottomLeftStyle == 'square' || (bottomLeftStyle == 'default' && rectStyle == 'square' )) || !left)
  {
    c.lineTo(0, h);
  }
  else
  {
    c.lineTo(size, h);
  }
}

/** Shapes.js:6502 */
function paintSW(c: Canvas, _x: number, _y: number, _w: number, h: number, rectStyle: string, bottomLeftStyle: string, size: number, bottom: boolean): void
{
  if (!bottom)
  {
    c.lineTo(0, h);
  }
  else if((bottomLeftStyle == 'rounded' || (bottomLeftStyle == 'default' && rectStyle == 'rounded' )) ||
      (bottomLeftStyle == 'invRound' || (bottomLeftStyle == 'default' && rectStyle == 'invRound' )) )
  {
    let inv = 0;

    if (bottomLeftStyle == 'rounded' || (bottomLeftStyle == 'default' && rectStyle == 'rounded' ))
    {
      inv = 1;
    }

    arcTo(c, size, size, 0, 0, inv, 0, h - size);
  }
  else if((bottomLeftStyle == 'snip' || (bottomLeftStyle == 'default' && rectStyle == 'snip' )) ||
      (bottomLeftStyle == 'fold' || (bottomLeftStyle == 'default' && rectStyle == 'fold' )))
  {
    c.lineTo(0, h - size);
  }
}

/** Shapes.js:6527 */
function paintNWInner(c: Canvas, _x: number, _y: number, _w: number, _h: number, rectStyle: string, topLeftStyle: string, size: number, indent: number): void
{
  if(topLeftStyle == 'rounded' || (topLeftStyle == 'default' && rectStyle == 'rounded' ))
  {
    arcTo(c, size - indent * 0.5, size - indent * 0.5, 0, 0, 0, indent, indent * 0.5 + size);
  }
  else if(topLeftStyle == 'invRound' || (topLeftStyle == 'default' && rectStyle == 'invRound' ))
  {
    arcTo(c, size + indent, size + indent, 0, 0, 1, indent, indent + size);
  }
  else if(topLeftStyle == 'snip' || (topLeftStyle == 'default' && rectStyle == 'snip' ))
  {
    c.lineTo(indent, indent * 0.5 + size);
  }
  else if(topLeftStyle == 'fold' || (topLeftStyle == 'default' && rectStyle == 'fold' ))
  {
    c.lineTo(indent + size, indent + size);
    c.lineTo(indent, indent + size);
  }
}

/** Shapes.js:6548 */
function paintTopInner(c: Canvas, _x: number, _y: number, _w: number, _h: number, rectStyle: string, topLeftStyle: string, size: number, indent: number, left: boolean, top: boolean): void
{
  if (!left && !top)
  {
    c.lineTo(0, 0);
  }
  else if (!left && top)
  {
    c.lineTo(0, indent);
  }
  else if (left && !top)
  {
    c.lineTo(indent, 0);
  }
  else if (!left)
  {
    c.lineTo(0, indent);
  }
  else if(topLeftStyle == 'square' || (topLeftStyle == 'default' && rectStyle == 'square' ))
  {
    c.lineTo(indent, indent);
  }
  else if((topLeftStyle == 'rounded' || (topLeftStyle == 'default' && rectStyle == 'rounded' )) ||
      (topLeftStyle == 'snip' || (topLeftStyle == 'default' && rectStyle == 'snip' )))
  {
    c.lineTo(size + indent * 0.5, indent);
  }
  else
  {
    c.lineTo(size + indent, indent);
  }
}

/** Shapes.js:6581 */
function paintNEInner(c: Canvas, _x: number, _y: number, w: number, _h: number, rectStyle: string, topRightStyle: string, size: number, indent: number): void
{
  if(topRightStyle == 'rounded' || (topRightStyle == 'default' && rectStyle == 'rounded' ))
  {
    arcTo(c, size - indent * 0.5, size - indent * 0.5, 0, 0, 0, w - size - indent * 0.5, indent);
  }
  else if(topRightStyle == 'invRound' || (topRightStyle == 'default' && rectStyle == 'invRound' ))
  {
    arcTo(c, size + indent, size + indent, 0, 0, 1, w - size - indent, indent);
  }
  else if(topRightStyle == 'snip' || (topRightStyle == 'default' && rectStyle == 'snip' ))
  {
    c.lineTo(w - size - indent * 0.5, indent);
  }
  else if(topRightStyle == 'fold' || (topRightStyle == 'default' && rectStyle == 'fold' ))
  {
    c.lineTo(w - size - indent, size + indent);
    c.lineTo(w - size - indent, indent);
  }
}

/** Shapes.js:6602 */
function paintRightInner(c: Canvas, _x: number, _y: number, w: number, _h: number, rectStyle: string, topRightStyle: string, size: number, indent: number, top: boolean, right: boolean): void
{
  if (!top && !right)
  {
    c.lineTo(w, 0);
  }
  else if (!top && right)
  {
    c.lineTo(w - indent, 0);
  }
  else if (top && !right)
  {
    c.lineTo(w, indent);
  }
  else if (!top)
  {
    c.lineTo(w - indent, 0);
  }
  else if(topRightStyle == 'square' || (topRightStyle == 'default' && rectStyle == 'square' ))
  {
    c.lineTo(w - indent, indent);
  }
  else if((topRightStyle == 'rounded' || (topRightStyle == 'default' && rectStyle == 'rounded' )) ||
      (topRightStyle == 'snip' || (topRightStyle == 'default' && rectStyle == 'snip' )))
  {
    c.lineTo(w - indent, size + indent * 0.5);
  }
  else
  {
    c.lineTo(w - indent, size + indent);
  }
}

/** Shapes.js:6635 */
function paintLeftInner(c: Canvas, _x: number, _y: number, _w: number, h: number, rectStyle: string, bottomLeftStyle: string, size: number, indent: number, bottom: boolean, left: boolean): void
{
  if (!bottom && !left)
  {
    c.lineTo(0, h);
  }
  else if (!bottom && left)
  {
    c.lineTo(indent, h);
  }
  else if (bottom && !left)
  {
    c.lineTo(0, h - indent);
  }
  else if (!bottom)
  {
    c.lineTo(indent, h);
  }
  else if(bottomLeftStyle == 'square' || (bottomLeftStyle == 'default' && rectStyle == 'square' ))
  {
    c.lineTo(indent, h - indent);
  }
  else if((bottomLeftStyle == 'rounded' || (bottomLeftStyle == 'default' && rectStyle == 'rounded' )) ||
      (bottomLeftStyle == 'snip' || (bottomLeftStyle == 'default' && rectStyle == 'snip' )))
  {
    c.lineTo(indent, h - size - indent * 0.5);
  }
  else
  {
    c.lineTo(indent, h - size - indent);
  }
}

/** Shapes.js:6668 */
function paintSEInner(c: Canvas, _x: number, _y: number, w: number, h: number, rectStyle: string, bottomRightStyle: string, size: number, indent: number): void
{
  if(bottomRightStyle == 'rounded' || (bottomRightStyle == 'default' && rectStyle == 'rounded' ))
  {
    arcTo(c, size - indent * 0.5, size - indent * 0.5, 0, 0, 0, w - indent, h - size - indent * 0.5);
  }
  else if(bottomRightStyle == 'invRound' || (bottomRightStyle == 'default' && rectStyle == 'invRound' ))
  {
    arcTo(c, size + indent, size + indent, 0, 0, 1, w - indent, h - size - indent);
  }
  else if(bottomRightStyle == 'snip' || (bottomRightStyle == 'default' && rectStyle == 'snip' ))
  {
    c.lineTo(w - indent, h - size - indent * 0.5);
  }
  else if(bottomRightStyle == 'fold' || (bottomRightStyle == 'default' && rectStyle == 'fold' ))
  {
    c.lineTo(w - size - indent, h - size - indent);
    c.lineTo(w - indent, h - size - indent);
  }
}

/** Shapes.js:6689 */
function paintBottomInner(c: Canvas, _x: number, _y: number, w: number, h: number, rectStyle: string, bottomRightStyle: string, size: number, indent: number, right: boolean, bottom: boolean): void
{
  if (!right && !bottom)
  {
    c.lineTo(w, h);
  }
  else if (!right && bottom)
  {
    c.lineTo(w, h - indent);
  }
  else if (right && !bottom)
  {
    c.lineTo(w - indent, h);
  }
  else if((bottomRightStyle == 'square' || (bottomRightStyle == 'default' && rectStyle == 'square' )) || !right)
  {
    c.lineTo(w - indent, h - indent);
  }
  else if((bottomRightStyle == 'rounded' || (bottomRightStyle == 'default' && rectStyle == 'rounded' )) ||
      (bottomRightStyle == 'snip' || (bottomRightStyle == 'default' && rectStyle == 'snip' )))
  {
    c.lineTo(w - size - indent * 0.5, h - indent);
  }
  else
  {
    c.lineTo(w - size - indent, h - indent);
  }
}

/** Shapes.js:6718 */
function paintSWInner(c: Canvas, _x: number, _y: number, _w: number, h: number, rectStyle: string, bottomLeftStyle: string, size: number, indent: number, bottom: boolean): void
{
  if (!bottom)
  {
    c.lineTo(indent, h);
  }
  else if(bottomLeftStyle == 'square' || (bottomLeftStyle == 'default' && rectStyle == 'square' ))
  {
    c.lineTo(indent, h - indent);
  }
  else if(bottomLeftStyle == 'rounded' || (bottomLeftStyle == 'default' && rectStyle == 'rounded' ))
  {
    arcTo(c, size - indent * 0.5, size - indent * 0.5, 0, 0, 0, size + indent * 0.5, h - indent);
  }
  else if(bottomLeftStyle == 'invRound' || (bottomLeftStyle == 'default' && rectStyle == 'invRound' ))
  {
    arcTo(c, size + indent, size + indent, 0, 0, 1, size + indent, h - indent);
  }
  else if(bottomLeftStyle == 'snip' || (bottomLeftStyle == 'default' && rectStyle == 'snip' ))
  {
    c.lineTo(size + indent * 0.5, h - indent);
  }
  else if(bottomLeftStyle == 'fold' || (bottomLeftStyle == 'default' && rectStyle == 'fold' ))
  {
    c.lineTo(indent + size, h - size - indent);
    c.lineTo(indent + size, h - indent);
  }
}

/** Shapes.js:6747 */
function moveSWInner(c: Canvas, _x: number, _y: number, _w: number, h: number, rectStyle: string, bottomLeftStyle: string, size: number, indent: number, left: boolean): void
{
  if (!left)
  {
    c.moveTo(0, h - indent);
  }
  else if(bottomLeftStyle == 'square' || (bottomLeftStyle == 'default' && rectStyle == 'square' ))
  {
    c.moveTo(indent, h - indent);
  }
  else if((bottomLeftStyle == 'rounded' || (bottomLeftStyle == 'default' && rectStyle == 'rounded' )) ||
      (bottomLeftStyle == 'snip' || (bottomLeftStyle == 'default' && rectStyle == 'snip' )))
  {
    c.moveTo(indent, h - size - indent * 0.5);
  }
  else if((bottomLeftStyle == 'invRound' || (bottomLeftStyle == 'default' && rectStyle == 'invRound' )) ||
      (bottomLeftStyle == 'fold' || (bottomLeftStyle == 'default' && rectStyle == 'fold' )))
  {
    c.moveTo(indent, h - size - indent);
  }
}

/** Shapes.js:6769 */
function lineSWInner(c: Canvas, _x: number, _y: number, _w: number, h: number, rectStyle: string, bottomLeftStyle: string, size: number, indent: number, left: boolean): void
{
  if (!left)
  {
    c.lineTo(0, h - indent);
  }
  else if(bottomLeftStyle == 'square' || (bottomLeftStyle == 'default' && rectStyle == 'square' ))
  {
    c.lineTo(indent, h - indent);
  }
  else if((bottomLeftStyle == 'rounded' || (bottomLeftStyle == 'default' && rectStyle == 'rounded' )) ||
      (bottomLeftStyle == 'snip' || (bottomLeftStyle == 'default' && rectStyle == 'snip' )))
  {
    c.lineTo(indent, h - size - indent * 0.5);
  }
  else if((bottomLeftStyle == 'invRound' || (bottomLeftStyle == 'default' && rectStyle == 'invRound' )) ||
      (bottomLeftStyle == 'fold' || (bottomLeftStyle == 'default' && rectStyle == 'fold' )))
  {
      c.lineTo(indent, h - size - indent);
  }
}

/** Shapes.js:6791 */
function moveSEInner(c: Canvas, _x: number, _y: number, w: number, h: number, rectStyle: string, bottomRightStyle: string, size: number, indent: number, bottom: boolean): void
{
  if (!bottom)
  {
    c.moveTo(w - indent, h);
  }
  else if(bottomRightStyle == 'square' || (bottomRightStyle == 'default' && rectStyle == 'square' ))
  {
    c.moveTo(w - indent, h - indent);
  }
  else if((bottomRightStyle == 'rounded' || (bottomRightStyle == 'default' && rectStyle == 'rounded' )) ||
      (bottomRightStyle == 'snip' || (bottomRightStyle == 'default' && rectStyle == 'snip' )))
  {
    c.moveTo(w - indent, h - size - indent * 0.5);
  }
  else if((bottomRightStyle == 'invRound' || (bottomRightStyle == 'default' && rectStyle == 'invRound' )) ||
      (bottomRightStyle == 'fold' || (bottomRightStyle == 'default' && rectStyle == 'fold' )))
  {
    c.moveTo(w - indent, h - size - indent);
  }
}

/** Shapes.js:6813 */
function lineSEInner(c: Canvas, _x: number, _y: number, w: number, h: number, rectStyle: string, bottomRightStyle: string, size: number, indent: number, bottom: boolean): void
{
  if (!bottom)
  {
    c.lineTo(w - indent, h);
  }
  else if(bottomRightStyle == 'square' || (bottomRightStyle == 'default' && rectStyle == 'square' ))
  {
    c.lineTo(w - indent, h - indent);
  }
  else if((bottomRightStyle == 'rounded' || (bottomRightStyle == 'default' && rectStyle == 'rounded' )) ||
      (bottomRightStyle == 'snip' || (bottomRightStyle == 'default' && rectStyle == 'snip' )))
  {
    c.lineTo(w - indent, h - size - indent * 0.5);
  }
  else if((bottomRightStyle == 'invRound' || (bottomRightStyle == 'default' && rectStyle == 'invRound' )) ||
      (bottomRightStyle == 'fold' || (bottomRightStyle == 'default' && rectStyle == 'fold' )))
  {
    c.lineTo(w - indent, h - size - indent);
  }
}

/** Shapes.js:6835 */
function moveNEInner(c: Canvas, _x: number, _y: number, w: number, _h: number, rectStyle: string, topRightStyle: string, size: number, indent: number, right: boolean): void
{
  if (!right)
  {
    c.moveTo(w, indent);
  }
  else if((topRightStyle == 'square' || (topRightStyle == 'default' && rectStyle == 'square' )) || right)
  {
    c.moveTo(w - indent, indent);
  }
  else if((topRightStyle == 'rounded' || (topRightStyle == 'default' && rectStyle == 'rounded' )) ||
      (topRightStyle == 'snip' || (topRightStyle == 'default' && rectStyle == 'snip' )))
  {
    c.moveTo(w - indent, size + indent * 0.5);
  }
  else if((topRightStyle == 'invRound' || (topRightStyle == 'default' && rectStyle == 'invRound' )) ||
      (topRightStyle == 'fold' || (topRightStyle == 'default' && rectStyle == 'fold' )))
  {
    c.moveTo(w - indent, size + indent);
  }
}

/** Shapes.js:6857 */
function lineNEInner(c: Canvas, _x: number, _y: number, w: number, _h: number, rectStyle: string, topRightStyle: string, size: number, indent: number, right: boolean): void
{
  if (!right)
  {
    c.lineTo(w, indent);
  }
  else if((topRightStyle == 'square' || (topRightStyle == 'default' && rectStyle == 'square' )) || right)
  {
    c.lineTo(w - indent, indent);
  }
  else if((topRightStyle == 'rounded' || (topRightStyle == 'default' && rectStyle == 'rounded' )) ||
      (topRightStyle == 'snip' || (topRightStyle == 'default' && rectStyle == 'snip' )))
  {
    c.lineTo(w - indent, size + indent * 0.5);
  }
  else if((topRightStyle == 'invRound' || (topRightStyle == 'default' && rectStyle == 'invRound' )) ||
      (topRightStyle == 'fold' || (topRightStyle == 'default' && rectStyle == 'fold' )))
  {
    c.lineTo(w - indent, size + indent);
  }
}

/** Shapes.js:6879 */
function moveNWInner(c: Canvas, _x: number, _y: number, _w: number, _h: number, rectStyle: string, topLeftStyle: string, size: number, indent: number, top: boolean, left: boolean): void
{
  if (!top && !left)
  {
    c.moveTo(0, 0);
  }
  else if (!top && left)
  {
    c.moveTo(indent, 0);
  }
  else if (top && !left)
  {
    c.moveTo(0, indent);
  }
  else if(topLeftStyle == 'square' || (topLeftStyle == 'default' && rectStyle == 'square' ))
  {
    c.moveTo(indent, indent);
  }
  else if((topLeftStyle == 'rounded' || (topLeftStyle == 'default' && rectStyle == 'rounded' )) ||
      (topLeftStyle == 'snip' || (topLeftStyle == 'default' && rectStyle == 'snip' )))
  {
    c.moveTo(indent, size + indent * 0.5);
  }
  else if((topLeftStyle == 'invRound' || (topLeftStyle == 'default' && rectStyle == 'invRound' )) ||
      (topLeftStyle == 'fold' || (topLeftStyle == 'default' && rectStyle == 'fold' )))
  {
    c.moveTo(indent, size + indent);
  }
}

/** Shapes.js:6909 */
function lineNWInner(c: Canvas, _x: number, _y: number, _w: number, _h: number, rectStyle: string, topLeftStyle: string, size: number, indent: number, top: boolean, left: boolean): void
{
  if (!top && !left)
  {
    c.lineTo(0, 0);
  }
  else if (!top && left)
  {
    c.lineTo(indent, 0);
  }
  else if (top && !left)
  {
    c.lineTo(0, indent);
  }
  else if(topLeftStyle == 'square' || (topLeftStyle == 'default' && rectStyle == 'square' ))
  {
    c.lineTo(indent, indent);
  }
  else if((topLeftStyle == 'rounded' || (topLeftStyle == 'default' && rectStyle == 'rounded' )) ||
      (topLeftStyle == 'snip' || (topLeftStyle == 'default' && rectStyle == 'snip' )))
  {
    c.lineTo(indent, size + indent * 0.5);
  }
  else if((topLeftStyle == 'invRound' || (topLeftStyle == 'default' && rectStyle == 'invRound' )) ||
      (topLeftStyle == 'fold' || (topLeftStyle == 'default' && rectStyle == 'fold' )))
  {
    c.lineTo(indent, size + indent);
  }
}

/** Shapes.js:6939 */
function paintFolds(c: Canvas, _x: number, _y: number, w: number, h: number, rectStyle: string, topLeftStyle: string, topRightStyle: string, bottomRightStyle: string, bottomLeftStyle: string, size: number, top: boolean, right: boolean, bottom: boolean, left: boolean): void
{
  if (rectStyle == 'fold' || topLeftStyle == 'fold' || topRightStyle == 'fold' || bottomRightStyle == 'fold' || bottomLeftStyle == 'fold')
  {
    if ((topLeftStyle == 'fold' || (topLeftStyle == 'default' && rectStyle == 'fold' )) && (top && left))
    {
      c.moveTo(0, size);
      c.lineTo(size, size);
      c.lineTo(size, 0);
    }

    if ((topRightStyle == 'fold' || (topRightStyle == 'default' && rectStyle == 'fold' )) && (top && right))
    {
      c.moveTo(w - size, 0);
      c.lineTo(w - size, size);
      c.lineTo(w, size);
    }

    if ((bottomRightStyle == 'fold' || (bottomRightStyle == 'default' && rectStyle == 'fold' )) && (bottom && right))
    {
      c.moveTo(w - size, h);
      c.lineTo(w - size, h - size);
      c.lineTo(w, h - size);
    }

    if ((bottomLeftStyle == 'fold' || (bottomLeftStyle == 'default' && rectStyle == 'fold' )) && (bottom && left))
    {
      c.moveTo(0, h - size);
      c.lineTo(size, h - size);
      c.lineTo(size, h);
    }
  }
}
