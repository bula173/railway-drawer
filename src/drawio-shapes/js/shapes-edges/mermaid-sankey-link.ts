/**
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Ported from jgraph/drawio v32.4.1 src/main/webapp/js/grapheditor/Shapes.js:9129
 * (MermaidSankeyLinkShape, registered at :9253).
 */

import { AbstractCanvas2D, ConnectorShape, Point, Rectangle, Shape } from '@maxgraph/core';
import { getNumber } from './util';

/**
 * draw.io `shape=mermaidSankeyLink`: the ribbon of a mermaid sankey link, the
 * cubic `M x0,y0 C mx,y0 mx,y1 x1,y1` offset by ±width/2 and filled, so
 * fillColor/gradientColor can paint a gradient along the link.
 */
export class MermaidSankeyLinkShape extends ConnectorShape {
  defaultWidth = 10;

  constructor() {
    super([], '#000000', 1);
  }

  getEdgeWidth(): number {
    return Math.max(1, getNumber(this.style, 'width', this.defaultWidth));
  }

  // The band is a pure fill — skip the half-pixel crisp-stroke offset
  override getSvgScreenOffset(): number {
    return 0;
  }

  override augmentBoundingBox(bbox: Rectangle): void {
    // mxShape.augmentBoundingBox (skips the connector marker sizes)
    Shape.prototype.augmentBoundingBox.call(this, bbox);

    // The band's x-extent ends exactly at the terminals, so only grow vertically.
    const grow = (this.getEdgeWidth() / 2 + this.strokeWidth) * this.scale;
    bbox.y -= grow;
    bbox.height += 2 * grow;
  }

  override paintEdgeShape(c: AbstractCanvas2D, pts: Point[]): void {
    const p0 = pts[0];
    const pe = pts[pts.length - 1];

    if (p0 == null || pe == null) {
      return;
    }

    const x0 = p0.x;
    const y0 = p0.y;
    const x1 = pe.x;
    const y1 = pe.y;
    const mx = (x0 + x1) / 2;
    const hw = this.getEdgeWidth() / 2;

    const n = 32;
    const side1: Point[] = [];
    const side2: Point[] = [];

    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      const x = u * u * u * x0 + 3 * u * u * t * mx + 3 * u * t * t * mx + t * t * t * x1;
      const y = u * u * u * y0 + 3 * u * u * t * y0 + 3 * u * t * t * y1 + t * t * t * y1;
      let dx = 3 * u * u * (mx - x0) + 3 * t * t * (x1 - mx);
      let dy = 6 * u * t * (y1 - y0);
      let len = Math.sqrt(dx * dx + dy * dy);

      if (len === 0) {
        dx = 1;
        dy = 0;
        len = 1;
      }

      const nx = (-dy / len) * hw;
      const ny = (dx / len) * hw;

      side1.push(new Point(x + nx, y + ny));
      side2.push(new Point(x - nx, y - ny));
    }

    c.begin();
    c.moveTo(side1[0].x, side1[0].y);

    for (let i = 1; i <= n; i++) {
      c.lineTo(side1[i].x, side1[i].y);
    }

    for (let i = n; i >= 0; i--) {
      c.lineTo(side2[i].x, side2[i].y);
    }

    c.close();

    // fillAndStroke nulls c.node, so grab the emitted <path> first.
    const bandNode = (c as unknown as { node?: Element | null }).node ?? null;
    c.fillAndStroke();

    // Mermaid composites overlapping bands with multiply so crossings darken.
    if (bandNode != null && typeof bandNode.setAttribute === 'function' && bandNode.parentNode != null) {
      const prevStyle = bandNode.getAttribute('style');
      bandNode.setAttribute('style', (prevStyle != null && prevStyle !== '' ? prevStyle + ';' : '') +
        'mix-blend-mode:multiply');

      // Isolating the group of all cells keeps the page out of the blend.
      const root = (c as unknown as { root?: Element | null }).root ?? null;
      const cellsNode = (root === (this.node as Element | null)
        ? (this.node != null ? this.node.parentNode : null)
        : root) as HTMLElement | SVGElement | null;

      if (cellsNode != null && cellsNode.style != null && cellsNode.style.isolation !== 'isolate') {
        cellsNode.style.isolation = 'isolate';
      }
    }
  }
}
