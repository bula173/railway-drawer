/**
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Ported from jgraph/drawio v32.4.1 src/main/webapp/js/grapheditor/Shapes.js:7618
 * (ZigzagShape, registered at :7725).
 */

import { AbstractCanvas2D, RectangleShape, Rectangle, constants } from '@maxgraph/core';
import { getNumber, getValue, isColor } from './util';

/**
 * draw.io `shape=zigzag`: `size` is the half-wavelength in graph units, the
 * height sets the amplitude and `rounded` switches between zigzag and wave.
 */
export class ZigzagShape extends RectangleShape {
  size = 10;

  /** Maximum number of full segments. */
  maxSegments = 10000;

  constructor() {
    super(new Rectangle(), constants.NONE, '#000000');
  }

  override isRoundable(_c: AbstractCanvas2D, _x: number, _y: number, _w: number, _h: number): boolean {
    return true;
  }

  override paintVertexShape(c: AbstractCanvas2D, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);

    // Background fill
    const fillClr = getValue(this.style, 'fillColor', null);

    if (isColor(fillClr)) {
      c.setStrokeColor(constants.NONE);
      c.begin();
      c.rect(0, 0, w, h);
      c.fillAndStroke();
      c.setStrokeColor(this.stroke);
    }

    const size = Math.max(5, getNumber(this.style, 'size', this.size));
    const centerY = h / 2;

    // Inset peaks so stroke stays within bounds
    const sw = this.strokeWidth;
    const inset = this.isRounded ? sw / 2 : sw;
    const topY = inset;
    const bottomY = h - inset;

    // Number of full peak-to-peak segments, adjusted to fit width
    const numFull = Math.min(Math.max(1, Math.round(w / size) - 1), this.maxSegments);
    const halfWave = w / (numFull + 1);
    // End segments are half-width so angle matches middle segments
    const halfEnd = halfWave / 2;

    c.begin();
    c.moveTo(0, centerY);

    if (this.isRounded) {
      const k = 0.4;

      c.curveTo(k * halfEnd, centerY - (centerY - topY) * k, (1 - k) * halfEnd, topY, halfEnd, topY);

      for (let j = 0; j < numFull; j++) {
        const sx = halfEnd + j * halfWave;
        const ex = sx + halfWave;
        const sy = j % 2 === 0 ? topY : bottomY;
        const ey = j % 2 === 0 ? bottomY : topY;

        c.curveTo(sx + k * halfWave, sy, ex - k * halfWave, ey, ex, ey);
      }

      const lastX = halfEnd + numFull * halfWave;
      const lastY = numFull % 2 === 0 ? topY : bottomY;
      const dirSign = lastY === topY ? 1 : -1;

      c.curveTo(lastX + k * halfEnd, lastY, w - k * halfEnd, centerY - dirSign * (centerY - topY) * k, w, centerY);
    } else {
      c.lineTo(halfEnd, topY);

      for (let j = 0; j < numFull; j++) {
        const ex = halfEnd + (j + 1) * halfWave;
        const ey = j % 2 === 0 ? bottomY : topY;
        c.lineTo(ex, ey);
      }

      c.lineTo(w, centerY);
    }

    c.stroke();
  }
}
