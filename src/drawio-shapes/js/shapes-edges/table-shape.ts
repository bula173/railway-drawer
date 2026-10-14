/**
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Ported from jgraph/drawio v32.4.1 src/main/webapp/js/grapheditor/Shapes.js:192
 * (TableShape, registered as 'table' at :902) and Shapes.js:905 (TableRowShape,
 * registered as 'tableRow' at :917).
 *
 * Differences to draw.io: maxGraph has no Shape.configurePointerEvents,
 * isShadowEnabled or createDropShadow, so collapsed tables paint their
 * background shadow with the canvas shadow instead of an SVG filter group.
 */

import { AbstractCanvas2D, Rectangle, Shape, mathUtils } from '@maxgraph/core';
import { NONE, getString, getValue, isColor, isFlag } from './util';

const mathUtilsMod = mathUtils.mod;
import { DrawioSwimlaneShape } from './swimlane-base';
import { paintPartialRectangle } from './partial-rectangle';
import {
  CollapsedBorder,
  CollapsedChild,
  CollapsedShapeInfo,
  OutlinePiece,
  createCollapsedTableBorder,
  getActualStartSize,
  getCollapsedTableBands,
  getCollapsedTableBorderKey,
  getCollapsedTableBorders,
  getCollapsedTableFillMode,
  getCollapsedTableRegions,
  getTableLines,
  isCollapsedTable,
  paintTableLine,
} from './table-graph';

type Rect = { x: number; y: number; width: number; height: number };

export class TableShape extends DrawioSwimlaneShape {
  override fixedHeaderDefault = false;

  override paintVertexShape(c: AbstractCanvas2D, x: number, y: number, w: number, h: number): void {
    const collapsed = this.state != null ? this.state.cell.isCollapsed() : false;

    if (!collapsed && this.isCollapsedRender()) {
      this.paintCollapsedTable(c);

      return;
    }

    const horizontal = this.isHorizontal();
    const start = this.getTitleSize();
    const fixedHeader = this.isFixedHeader();

    if (start === 0 && this.isRounded && !this.outline) {
      // Headerless rounded table: paints the rounded background directly
      const r = Shape.prototype.getArcSize.call(this, w, h);
      c.begin();
      c.roundrect(x, y, w, h, r, r);
      c.fillAndStroke();
    } else if ((start === 0 && !fixedHeader) || this.outline) {
      // drawHidden is undefined for tables in draw.io
      paintPartialRectangle(this, c, x, y, w, h, false);
    } else {
      super.paintVertexShape(c, x, y, w, h);
      c.translate(-x, -y);
    }

    if (!collapsed && !this.outline && ((horizontal && start < h) || (!horizontal && start < w))) {
      this.paintForeground(c, x, y, w, h);
    }
  }

  override paintForeground(c: AbstractCanvas2D, x: number, y: number, w: number, h: number): void {
    if (this.state != null && this.bounds != null) {
      let flipH = this.flipH;
      let flipV = this.flipV;

      if (this.direction === 'north' || this.direction === 'south') {
        const tmp = flipH;
        flipH = flipV;
        flipV = tmp;
      }

      // Negative transform to avoid save/restore
      c.rotate(-this.getShapeRotation(), flipH, flipV, x + w / 2, y + h / 2);

      const s = this.scale;
      x = this.bounds.x / s;
      y = this.bounds.y / s;
      w = this.bounds.width / s;
      h = this.bounds.height / s;

      if (this.hasStripes()) {
        const graph = this.state.view.graph;
        const start = getActualStartSize(graph, this.state.cell, true);
        const body = getCollapsedTableBands(0, 0, w, h, start).body;
        const r = this.isRounded ? this.getCollapsedArcSize(w, h, start) : 0;
        const pointerEvents = c.pointerEvents;
        c.pointerEvents = false;
        c.setShadow(false);
        this.paintStripes(c, x, y, w, h, r, body);
        c.pointerEvents = pointerEvents;
      }

      this.paintTableForeground(c, x, y, w, h);
    }
  }

  /** True if the table has evenRowColor, oddRowColor, evenColumnColor or oddColumnColor. */
  hasStripes(): boolean {
    for (const key of ['evenRowColor', 'oddRowColor', 'evenColumnColor', 'oddColumnColor']) {
      if (getValue(this.style, key, NONE) !== NONE) {
        return true;
      }
    }

    return false;
  }

  /** Paints the column and row striping of the table in the given body. */
  paintStripes(c: AbstractCanvas2D, x: number, y: number, w: number, h: number, r: number, body: Rect): void {
    if (this.state == null) return;

    const evenRowColor = getString(this.style, 'evenRowColor', NONE);
    const oddRowColor = getString(this.style, 'oddRowColor', NONE);
    const evenColColor = getString(this.style, 'evenColumnColor', NONE);
    const oddColColor = getString(this.style, 'oddColumnColor', NONE);
    const rows = this.state.cell.getChildCells(true, false);
    const visible = rows.filter((row) => row.isVisible() && row.getGeometry() != null);

    const fill = (clr: string, rect: Rect): void => {
      if (clr !== NONE && rect.width > 0 && rect.height > 0) {
        c.setFillColor(clr);
        this.addCollapsedRegionPath(c, x, y, w, h, r, rect);
        c.fill();
      }
    };

    if ((evenColColor !== NONE || oddColColor !== NONE) && visible.length > 0) {
      const rowGeo = visible[0].getGeometry() as Rectangle;
      const cols = visible[0].getChildCells(true, false);

      for (let i = 0; i < cols.length; i++) {
        const geo = cols[i].getGeometry();

        if (geo != null) {
          const gw = geo.alternateBounds != null ? geo.alternateBounds.width : geo.width;
          fill(mathUtilsMod(i, 2) === 1 ? evenColColor : oddColColor,
            new Rectangle(rowGeo.x + geo.x, body.y, gw, body.height));
        }
      }
    }

    if (evenRowColor !== NONE || oddRowColor !== NONE) {
      for (let i = 0; i < visible.length; i++) {
        const geo = visible[i].getGeometry() as Rectangle;
        fill(mathUtilsMod(i, 2) === 1 ? evenRowColor : oddRowColor, new Rectangle(body.x, geo.y, body.width, geo.height));
      }
    }
  }

  paintTableForeground(c: AbstractCanvas2D, x: number, y: number, _w: number, _h: number): void {
    if (this.state == null) return;

    const style = this.state.style as Record<string, unknown>;
    const lines = getTableLines(this.state.view.graph, this.state.cell,
      getString(style, 'rowLines', '1') !== '0', getString(style, 'columnLines', '1') !== '0');

    for (const line of lines) {
      paintTableLine(c, line, x, y);
    }
  }

  /** True if this table paints its rows and cells with collapsed borders. */
  isCollapsedRender(): boolean {
    return this.state != null && !this.outline && this.style != null &&
      (this.style as Record<string, unknown>).tableRender === 'collapsed' &&
      isCollapsedTable(this.state.view.graph, this.state.cell);
  }

  /** Returns the arc size for the outline of a collapsed table. */
  getCollapsedArcSize(w: number, h: number, start: Rect): number {
    let r = 0;

    if (this.isRounded) {
      const size = Math.max(start.x, start.y, start.width, start.height);

      if (size === 0) {
        r = Shape.prototype.getArcSize.call(this, w, h);
      } else {
        r = this.getSwimlaneArcSize(w, h, size);
        r = Math.min((start.y > 0 || start.height > 0 ? h : w) - size, Math.min(size, r));
      }
    }

    return Math.max(0, Math.min(r, w / 2, h / 2));
  }

  /**
   * Adds the path for the given rectangle where the corners that are corners
   * of the table follow the arc of the table outline.
   */
  addCollapsedRegionPath(c: AbstractCanvas2D, x: number, y: number, w: number, h: number, r: number, rect: Rect): void {
    const eps = 0.01;
    let x0 = rect.x;
    let y0 = rect.y;
    let x1 = rect.x + rect.width;
    let y1 = rect.y + rect.height;
    const top = Math.abs(y0) < eps;
    const left = Math.abs(x0) < eps;
    const bottom = Math.abs(y1 - h) < eps;
    const right = Math.abs(x1 - w) < eps;
    const tl = r > 0 && top && left;
    const tr = r > 0 && top && right;
    const br = r > 0 && bottom && right;
    const bl = r > 0 && bottom && left;
    const rr = Math.min(r, rect.width / ((tl && tr) || (bl && br) ? 2 : 1),
      rect.height / ((tl && bl) || (tr && br) ? 2 : 1));
    x0 += x;
    x1 += x;
    y0 += y;
    y1 += y;

    c.begin();

    if (tl) {
      c.moveTo(x0, y0 + rr);
      c.arcTo(rr, rr, 0, false, true, x0 + rr, y0);
    } else {
      c.moveTo(x0, y0);
    }

    if (tr) {
      c.lineTo(x1 - rr, y0);
      c.arcTo(rr, rr, 0, false, true, x1, y0 + rr);
    } else {
      c.lineTo(x1, y0);
    }

    if (br) {
      c.lineTo(x1, y1 - rr);
      c.arcTo(rr, rr, 0, false, true, x1 - rr, y1);
    } else {
      c.lineTo(x1, y1);
    }

    if (bl) {
      c.lineTo(x0 + rr, y1);
      c.arcTo(rr, rr, 0, false, true, x0, y1 - rr);
    } else {
      c.lineTo(x0, y1);
    }

    c.close();
  }

  /** Fills the given region of a row or cell with the given fill info. */
  fillCollapsedRegion(c: AbstractCanvas2D, x: number, y: number, w: number, h: number, r: number, rect: Rect,
    fill: string | null, info: CollapsedShapeInfo, gradientBounds: Rect | null): void {
    if (isColor(fill) && rect.width > 0 && rect.height > 0) {
      c.save();
      c.setAlpha(info.opacity / 100);
      c.setFillAlpha(info.fillOpacity / 100);

      if (isColor(info.gradient) && gradientBounds != null) {
        c.setGradient(fill, info.gradient, x + gradientBounds.x, y + gradientBounds.y, gradientBounds.width,
          gradientBounds.height, info.gradientDirection as never);
      } else {
        c.setFillColor(fill);
      }

      this.addCollapsedRegionPath(c, x, y, w, h, r, rect);
      c.fill();
      c.restore();
    }
  }

  /** Fills the given row or cell. */
  fillCollapsedChild(c: AbstractCanvas2D, x: number, y: number, w: number, h: number, r: number, child: CollapsedChild): void {
    if (child.takeover && child.info != null) {
      if (child.mode === 'full') {
        this.fillCollapsedRegion(c, x, y, w, h, r, child, child.info.fill, child.info, child);
      } else if (child.mode === 'lane') {
        for (const band of child.split.bands) {
          this.fillCollapsedRegion(c, x, y, w, h, r, band, child.info.fill, child.info, band);
        }

        this.fillCollapsedRegion(c, x, y, w, h, r, child.split.body, child.info.laneFill, child.info, null);
      }
    }
  }

  /** Sets the given border as the stroke of the canvas. */
  setCollapsedBorder(c: AbstractCanvas2D, border: CollapsedBorder): void {
    c.setAlpha(border.opacity / 100);
    c.setStrokeAlpha(border.strokeOpacity / 100);
    c.setStrokeColor(border.color);
    c.setStrokeWidth(border.width);
    c.setDashed(border.dashed, border.fixDash);

    if (border.dashed) {
      c.setDashPattern(border.dashPattern != null ? border.dashPattern : '3 3');
    }
  }

  /**
   * Paints the table, its rows and cells with collapsed borders: table fill,
   * striping, row and cell fills, then all borders on top.
   */
  paintCollapsedTable(c: AbstractCanvas2D): void {
    if (this.state == null || this.bounds == null) return;

    const graph = this.state.view.graph;
    const cell = this.state.cell;
    let flipH = this.flipH;
    let flipV = this.flipV;

    if (this.direction === 'north' || this.direction === 'south') {
      const tmp = flipH;
      flipH = flipV;
      flipV = tmp;
    }

    const s = this.scale;
    const x = this.bounds.x / s;
    const y = this.bounds.y / s;
    const w = this.bounds.width / s;
    const h = this.bounds.height / s;

    // Uses unrotated coordinates as rows and cells are not rotated
    c.rotate(-this.getShapeRotation(), flipH, flipV, x + w / 2, y + h / 2);

    const pointerEvents = c.pointerEvents;
    const tableBorder = createCollapsedTableBorder(this.stroke as string, this);
    const data = getCollapsedTableRegions(graph, cell, w, h);
    const borders = getCollapsedTableBorders(graph, cell, w, h, tableBorder, data);
    const r = this.getCollapsedArcSize(w, h, data.start);
    const full = new Rectangle(0, 0, w, h);
    const events = isFlag(this.style, 'pointerEvents', true);

    if (getCollapsedTableFillMode(this.style as Record<string, unknown>, data.start) === 'full') {
      this.addCollapsedRegionPath(c, x, y, w, h, r, full);
      c.fill();
    } else {
      for (const band of data.title.bands) {
        this.addCollapsedRegionPath(c, x, y, w, h, r, band);
        c.fill();
      }

      if (isColor(this.laneFill)) {
        c.pointerEvents = pointerEvents && events;
        c.setFillColor(this.laneFill);
        this.addCollapsedRegionPath(c, x, y, w, h, r, data.title.body);
        c.fill();
        c.pointerEvents = pointerEvents;
      }
    }

    if (this.isShadow && getCollapsedTableBorderKey(tableBorder) != null) {
      this.addCollapsedRegionPath(c, x, y, w, h, r, full);
      c.stroke();
    }

    c.setShadow(false);
    c.pointerEvents = false;

    // Striping
    this.paintStripes(c, x, y, w, h, r, data.title.body);

    // Row and cell fills
    for (const row of data.rows) {
      this.fillCollapsedChild(c, x, y, w, h, r, row);
    }

    for (const child of data.cells) {
      this.fillCollapsedChild(c, x, y, w, h, r, child);
    }

    // Inner borders grouped by style, thicker borders on top
    const groups = new Map<string, typeof borders.lines>();

    for (const line of borders.lines) {
      const group = groups.get(line.key);

      if (group == null) {
        groups.set(line.key, [line]);
      } else {
        group.push(line);
      }
    }

    const keys = Array.from(groups.keys()).sort((k1, k2) =>
      (groups.get(k1) as typeof borders.lines)[0].border.width - (groups.get(k2) as typeof borders.lines)[0].border.width);

    c.setLineCap('square');

    for (const key of keys) {
      const lines = groups.get(key) as typeof borders.lines;
      c.save();
      this.setCollapsedBorder(c, lines[0].border);
      c.begin();

      for (const line of lines) {
        c.moveTo(x + line.x1, y + line.y1);
        c.lineTo(x + line.x2, y + line.y2);
      }

      c.stroke();
      c.restore();
    }

    c.setLineCap('flat');
    c.pointerEvents = pointerEvents;
    this.paintCollapsedOutline(c, x, y, w, h, r, borders.outline);
  }

  /**
   * Paints the outline of a collapsed table. Consecutive pieces with the same
   * border are painted as one path, including the corner arcs.
   */
  paintCollapsedOutline(c: AbstractCanvas2D, x: number, y: number, w: number, h: number, r: number,
    outline: { top: OutlinePiece[]; right: OutlinePiece[]; bottom: OutlinePiece[]; left: OutlinePiece[] }): void {
    const eps = 0.01;

    interface Side {
      pieces: OutlinePiece[];
      x0: number;
      y0: number;
      dx: number;
      dy: number;
      len: number;
      rev: boolean;
      first?: CollapsedBorder | null;
      last?: CollapsedBorder | null;
    }

    interface Op {
      arc: boolean;
      side?: number;
      from: { x: number; y: number };
      to?: { x: number; y: number };
      border?: CollapsedBorder | null;
      key?: string | null;
    }

    // Sides in clockwise order with start point and direction
    const sides: Side[] = [
      { pieces: outline.top, x0: 0, y0: 0, dx: 1, dy: 0, len: w, rev: false },
      { pieces: outline.right, x0: w, y0: 0, dx: 0, dy: 1, len: h, rev: false },
      { pieces: outline.bottom, x0: w, y0: h, dx: -1, dy: 0, len: w, rev: true },
      { pieces: outline.left, x0: 0, y0: h, dx: 0, dy: -1, len: h, rev: true },
    ];
    const ops: Op[] = [];
    const corners: Op[] = [];

    const getPoint = (side: Side, t: number): { x: number; y: number } => ({ x: side.x0 + side.dx * t, y: side.y0 + side.dy * t });

    for (let i = 0; i < sides.length; i++) {
      const side = sides[i];
      const pieces = side.pieces.slice();

      if (side.rev) {
        pieces.reverse();
      }

      side.first = pieces.length > 0 ? pieces[0].border : null;
      side.last = pieces.length > 0 ? pieces[pieces.length - 1].border : null;

      for (const piece of pieces) {
        const t0 = Math.max(r, side.rev ? side.len - piece.b : piece.a);
        const t1 = Math.min(side.len - r, side.rev ? side.len - piece.a : piece.b);

        if (t1 - t0 > eps) {
          ops.push({ arc: false, from: getPoint(side, t0), to: getPoint(side, t1), border: piece.border });
        }
      }

      if (r > 0) {
        const corner: Op = { arc: true, side: i, from: getPoint(side, side.len - r) };
        corners.push(corner);
        ops.push(corner);
      }
    }

    // Corner arcs use the border of the incoming or else the outgoing side
    for (const corner of corners) {
      const side = sides[corner.side as number];
      const next = sides[((corner.side as number) + 1) % sides.length];
      let border = side.last ?? null;

      if (getCollapsedTableBorderKey(border) == null) {
        border = next.first ?? null;
      }

      corner.to = getPoint(next, r);
      corner.border = border;
    }

    for (const op of ops) {
      op.key = getCollapsedTableBorderKey(op.border);
    }

    const isJoined = (op1: Op, op2: Op): boolean => {
      const to = op1.to as { x: number; y: number };
      return op1.key === op2.key && Math.abs(to.x - op2.from.x) < eps && Math.abs(to.y - op2.from.y) < eps;
    };

    const paintRun = (run: Op[], close: boolean): void => {
      c.save();
      this.setCollapsedBorder(c, run[0].border as CollapsedBorder);
      c.begin();
      c.moveTo(x + run[0].from.x, y + run[0].from.y);

      for (const op of run) {
        const to = op.to as { x: number; y: number };

        if (op.arc) {
          c.arcTo(r, r, 0, false, true, x + to.x, y + to.y);
        } else {
          c.lineTo(x + to.x, y + to.y);
        }
      }

      if (close) {
        c.close();
      }

      c.stroke();
      c.restore();
    };

    // Starts at the first break in the outline
    let start = -1;

    for (let i = 0; i < ops.length && start < 0; i++) {
      if (!isJoined(ops[(i + ops.length - 1) % ops.length], ops[i])) {
        start = i;
      }
    }

    if (start < 0) {
      if (ops.length > 0 && ops[0].key != null) {
        paintRun(ops, true);
      }
    } else {
      let run: Op[] | null = null;

      for (let i = 0; i < ops.length; i++) {
        const op = ops[(start + i) % ops.length];

        if (run != null && !isJoined(run[run.length - 1], op)) {
          paintRun(run, false);
          run = null;
        }

        if (op.key != null) {
          run = run != null ? run : [];
          run.push(op);
        }
      }

      if (run != null) {
        paintRun(run, false);
      }
    }
  }
}

/** draw.io `shape=tableRow`: a table shape without the table foreground. */
export class TableRowShape extends TableShape {
  override paintForeground(): void {
    // overridden to do nothing
  }
}
