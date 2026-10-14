/**
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Ported from jgraph/drawio v32.4.1 src/main/webapp/mxgraph/src/shape/mxSwimlane.js
 * (draw.io's mxSwimlane with laneFill, fixedHeader, swimlaneHead/Body and
 * footers) and the paintVertexShape override at
 * src/main/webapp/js/grapheditor/Shapes.js:925 (table grid line repaint).
 *
 * Base class of the table and tableRow shapes. It is not registered as
 * 'swimlane' (maxGraph's own SwimlaneShape keeps that name).
 */

import { AbstractCanvas2D, CellState, Rectangle, Shape, constants } from '@maxgraph/core';
import { NONE, getNumber, getString, getValue, isColor, isFlag, toFlag } from './util';
import { isTableRow, paintTableCellLines } from './table-graph';

export class DrawioSwimlaneShape extends Shape {
  imageSize = 16;

  fixedHeaderDefault = true;

  /** swimlaneFillColor (mxSwimlane.apply). */
  laneFill: string = NONE;

  constructor() {
    super();
    this.bounds = new Rectangle();
    this.fill = NONE;
    this.stroke = '#000000';
    this.strokeWidth = 1;
  }

  override apply(state: CellState): void {
    super.apply(state);

    if (this.style != null) {
      this.laneFill = getString(this.style, 'swimlaneFillColor', NONE);
    }
  }

  override isRoundable(_c: AbstractCanvas2D, _x: number, _y: number, _w: number, _h: number): boolean {
    return true;
  }

  getTitleSize(): number {
    return Math.max(0, getNumber(this.style, 'startSize', constants.DEFAULT_STARTSIZE));
  }

  getFooterSize(): number {
    return Math.max(0, getNumber(this.style, 'footerSize', 0));
  }

  isFixedHeader(): boolean {
    return toFlag(getValue(this.style, 'fixedHeader', this.fixedHeaderDefault));
  }

  override getLabelBounds(rect: Rectangle): Rectangle {
    const start = this.getTitleSize();

    if (start === 0 && !this.isFixedHeader()) {
      return super.getLabelBounds(rect);
    }

    const flipH = isFlag(this.style, 'flipH', false);
    const flipV = isFlag(this.style, 'flipV', false);
    const bounds = new Rectangle(rect.x, rect.y, rect.width, rect.height);
    const horizontal = this.isHorizontal();

    // East is default
    const shapeVertical = this.direction === 'north' || this.direction === 'south';
    const realHorizontal = horizontal === !shapeVertical;
    const realFlipH = !realHorizontal && flipH !== (this.direction === 'south' || this.direction === 'west');
    const realFlipV = realHorizontal && flipV !== (this.direction === 'south' || this.direction === 'west');

    if (!shapeVertical) {
      const tmp = Math.min(bounds.height, start * this.scale);

      if (realFlipH || realFlipV) {
        bounds.y += bounds.height - tmp;
      }

      bounds.height = tmp;
    } else {
      const tmp = Math.min(bounds.width, start * this.scale);

      if (realFlipH || realFlipV) {
        bounds.x += bounds.width - tmp;
      }

      bounds.width = tmp;
    }

    return bounds;
  }

  override getGradientBounds(_c: AbstractCanvas2D, x: number, y: number, w: number, h: number): Rectangle {
    const start = this.getTitleSize();

    return this.isHorizontal() ? new Rectangle(x, y, w, Math.min(start, h)) : new Rectangle(x, y, Math.min(start, w), h);
  }

  getSwimlaneArcSize(w: number, h: number, start: number): number {
    if (isFlag(this.style, 'absoluteArcSize', false)) {
      return Math.min(w / 2, Math.min(h / 2, getNumber(this.style, 'arcSize', constants.LINE_ARCSIZE) / 2));
    }

    const f = getNumber(this.style, 'arcSize', constants.RECTANGLE_ROUNDING_FACTOR * 100) / 100;

    return start * f * 3;
  }

  isHorizontal(): boolean {
    return toFlag(getValue(this.style, 'horizontal', 1));
  }

  /** mxSwimlane.paintVertexShape followed by Shapes.js:925 (grid line repaint). */
  override paintVertexShape(c: AbstractCanvas2D, x: number, y: number, w: number, h: number): void {
    this.paintSwimlaneVertexShape(c, x, y, w, h);

    if (this.state != null && !this.outline) {
      const graph = this.state.view.graph;
      const filled = isColor(this.fill) || isColor(this.laneFill);

      if (filled) {
        const cell = this.state.cell;

        // A table row only fills its title strip, so the separators are
        // only covered there
        if (isTableRow(graph, cell)) {
          const start = this.getTitleSize();

          if (this.isHorizontal()) {
            paintTableCellLines(graph, c, cell, 0, 0, w, Math.min(start, h), this.stroke as string, this.strokeWidth);
          } else {
            paintTableCellLines(graph, c, cell, 0, 0, Math.min(start, w), h, this.stroke as string, this.strokeWidth);
          }
        } else {
          paintTableCellLines(graph, c, cell, 0, 0, w, h, this.stroke as string, this.strokeWidth);
        }
      }
    }
  }

  /** mxSwimlane.prototype.paintVertexShape (mxSwimlane.js). */
  paintSwimlaneVertexShape(c: AbstractCanvas2D, x: number, y: number, w: number, h: number): void {
    if (this.outline) {
      return;
    }

    let start = this.getTitleSize();

    if (start === 0 && !this.isFixedHeader()) {
      return;
    }

    let r = 0;
    start = this.isHorizontal() ? Math.min(start, h) : Math.min(start, w);

    c.translate(x, y);

    if (!this.isRounded) {
      this.paintSwimlane(c, x, y, w, h, start);
    } else {
      r = this.getSwimlaneArcSize(w, h, start);
      r = Math.min((this.isHorizontal() ? h : w) - start, Math.min(start, r));
      this.paintRoundedSwimlane(c, x, y, w, h, start, r);
    }

    this.paintFooter(c, x, y, w, h, start, r);

    const sep = getString(this.style, 'separatorColor', NONE);
    this.paintSeparator(c, x, y, w, h, start, sep);

    if (this.imageSrc) {
      const b = this.getImageBounds(x, y, w, h);
      c.image(b.x - x, b.y - y, b.width, b.height, this.imageSrc, false, false, false);
    }

    if (this.glass) {
      c.setShadow(false);
      this.paintGlassEffect(c, 0, 0, w, start, r);
    }
  }

  private flags(): { events: boolean; line: boolean; head: boolean; body: boolean } {
    return {
      events: isFlag(this.style, 'pointerEvents', true),
      line: getNumber(this.style, 'swimlaneLine', 1) === 1,
      head: getNumber(this.style, 'swimlaneHead', 1) === 1,
      body: getNumber(this.style, 'swimlaneBody', 1) === 1,
    };
  }

  private paintBody(c: AbstractCanvas2D, fill: string, body: boolean): void {
    if (body) {
      if (fill === NONE) {
        c.stroke();
      } else {
        c.fillAndStroke();
      }
    } else if (fill !== NONE) {
      c.fill();
    }
  }

  paintSwimlane(c: AbstractCanvas2D, x: number, y: number, w: number, h: number, start: number): void {
    const fill = this.laneFill;
    const { events, line, head, body } = this.flags();

    if (this.isHorizontal()) {
      c.begin();
      c.moveTo(0, start);
      c.lineTo(0, 0);
      c.lineTo(w, 0);
      c.lineTo(w, start);

      if (head) c.fillAndStroke();
      else c.fill();

      if (start < h) {
        if (fill === NONE || !events) c.pointerEvents = false;
        if (fill !== NONE) c.setFillColor(fill);

        c.begin();
        c.moveTo(0, start);
        c.lineTo(0, h);
        c.lineTo(w, h);
        c.lineTo(w, start);
        this.paintBody(c, fill, body);
      }
    } else {
      c.begin();
      c.moveTo(start, 0);
      c.lineTo(0, 0);
      c.lineTo(0, h);
      c.lineTo(start, h);

      if (head) c.fillAndStroke();
      else c.fill();

      if (start < w) {
        if (fill === NONE || !events) c.pointerEvents = false;
        if (fill !== NONE) c.setFillColor(fill);

        c.begin();
        c.moveTo(start, 0);
        c.lineTo(w, 0);
        c.lineTo(w, h);
        c.lineTo(start, h);
        this.paintBody(c, fill, body);
      }
    }

    if (line) {
      this.paintDivider(c, x, y, w, h, start, fill === NONE);
    }
  }

  paintRoundedSwimlane(c: AbstractCanvas2D, x: number, y: number, w: number, h: number, start: number, r: number): void {
    const fill = this.laneFill;
    const { events, line, head, body } = this.flags();

    if (this.isHorizontal()) {
      c.begin();
      c.moveTo(w, start);
      c.lineTo(w, r);
      c.quadTo(w, 0, w - Math.min(w / 2, r), 0);
      c.lineTo(Math.min(w / 2, r), 0);
      c.quadTo(0, 0, 0, r);
      c.lineTo(0, start);

      if (head) c.fillAndStroke();
      else c.fill();

      if (start < h) {
        if (fill === NONE || !events) c.pointerEvents = false;
        if (fill !== NONE) c.setFillColor(fill);

        c.begin();
        c.moveTo(0, start);
        c.lineTo(0, h - r);
        c.quadTo(0, h, Math.min(w / 2, r), h);
        c.lineTo(w - Math.min(w / 2, r), h);
        c.quadTo(w, h, w, h - r);
        c.lineTo(w, start);
        this.paintBody(c, fill, body);
      }
    } else {
      c.begin();
      c.moveTo(start, 0);
      c.lineTo(r, 0);
      c.quadTo(0, 0, 0, Math.min(h / 2, r));
      c.lineTo(0, h - Math.min(h / 2, r));
      c.quadTo(0, h, r, h);
      c.lineTo(start, h);

      if (head) c.fillAndStroke();
      else c.fill();

      if (start < w) {
        if (fill === NONE || !events) c.pointerEvents = false;
        if (fill !== NONE) c.setFillColor(fill);

        c.begin();
        c.moveTo(start, h);
        c.lineTo(w - r, h);
        c.quadTo(w, h, w, h - Math.min(h / 2, r));
        c.lineTo(w, Math.min(h / 2, r));
        c.quadTo(w, 0, w - r, 0);
        c.lineTo(start, 0);
        this.paintBody(c, fill, body);
      }
    }

    if (line) {
      this.paintDivider(c, x, y, w, h, start, fill === NONE);
    }
  }

  paintFooter(c: AbstractCanvas2D, _x: number, _y: number, w: number, h: number, start: number, r: number): void {
    let footer = this.getFooterSize();
    const horizontal = this.isHorizontal();
    const size = horizontal ? h : w;

    // Keeps the footer within the body so it never overlaps the title
    footer = Math.min(footer, size - start);

    if (footer <= 0) {
      return;
    }

    const fill = this.fill;

    if (isColor(fill)) {
      c.setFillColor(fill);
    }

    c.setShadow(false);
    c.begin();

    if (horizontal) {
      const rr = Math.min(w / 2, r);

      if (footer >= r) {
        c.moveTo(0, h - footer);
        c.lineTo(0, h - r);
        c.quadTo(0, h, rr, h);
        c.lineTo(w - rr, h);
        c.quadTo(w, h, w, h - r);
        c.lineTo(w, h - footer);
      } else {
        const t = 1 - Math.sqrt(footer / r);
        const px = rr * t * t;
        const bx = rr * t;
        c.moveTo(px, h - footer);
        c.quadTo(bx, h, rr, h);
        c.lineTo(w - rr, h);
        c.quadTo(w - bx, h, w - px, h - footer);
      }
    } else {
      const rr = Math.min(h / 2, r);

      if (footer >= r) {
        c.moveTo(w - footer, 0);
        c.lineTo(w - r, 0);
        c.quadTo(w, 0, w, rr);
        c.lineTo(w, h - rr);
        c.quadTo(w, h, w - r, h);
        c.lineTo(w - footer, h);
      } else {
        const t = 1 - Math.sqrt(footer / r);
        const py = rr * t * t;
        const by = rr * t;
        c.moveTo(w - footer, py);
        c.quadTo(w, by, w, rr);
        c.lineTo(w, h - rr);
        c.quadTo(w, h - by, w - footer, h - py);
      }
    }

    c.close();

    if (isColor(fill)) {
      c.fillAndStroke();
    } else {
      c.stroke();
    }
  }

  paintDivider(c: AbstractCanvas2D, _x: number, _y: number, w: number, h: number, start: number, shadow: boolean): void {
    if (start !== 0) {
      if (!shadow) {
        c.setShadow(false);
      }

      c.begin();

      if (this.isHorizontal()) {
        c.moveTo(0, start);
        c.lineTo(w, start);
      } else {
        c.moveTo(start, 0);
        c.lineTo(start, h);
      }

      c.stroke();
    }
  }

  paintSeparator(c: AbstractCanvas2D, _x: number, _y: number, w: number, h: number, start: number, color: string): void {
    if (color !== NONE) {
      c.setStrokeColor(color);
      c.setDashed(true);
      c.begin();

      if (this.isHorizontal()) {
        c.moveTo(w, start);
        c.lineTo(w, h);
      } else {
        c.moveTo(start, 0);
        c.lineTo(w, 0);
      }

      c.stroke();
      c.setDashed(false);
    }
  }

  getImageBounds(x: number, y: number, w: number, _h: number): Rectangle {
    return this.isHorizontal()
      ? new Rectangle(x + w - this.imageSize, y, this.imageSize, this.imageSize)
      : new Rectangle(x, y, this.imageSize, this.imageSize);
  }
}
