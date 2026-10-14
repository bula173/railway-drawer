/**
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Ported from jgraph/drawio v32.4.1 src/main/webapp/js/grapheditor/Shapes.js:6978
 * (FilledEdge, registered at :7016).
 */

import { AbstractCanvas2D, ConnectorShape, Point } from '@maxgraph/core';
import { getString } from './util';

/**
 * draw.io `shape=filledEdge`: paints the connector with its stroke and, for
 * stroke widths of at least 3, again with the fill color 2px thinner, which
 * gives a hollow "pipe" edge.
 */
export class FilledEdgeShape extends ConnectorShape {
  constructor() {
    super([], '#000000', 1);
  }

  override paintEdgeShape(c: AbstractCanvas2D, pts: Point[]): void {
    // Markers modify the incoming points array
    const temp: Point[] = pts.map((p) => (p != null ? p.clone() : p));

    // paintEdgeShape resets dashed to false
    const dashed = c.state.dashed;
    const fixDash = c.state.fixDash;
    super.paintEdgeShape(c, temp);

    if (c.state.strokeWidth >= 3) {
      const fillClr = getString(this.style, 'fillColor', null);

      if (fillClr != null) {
        c.setStrokeColor(fillClr);
        c.setStrokeWidth(c.state.strokeWidth - 2);
        c.setDashed(dashed, fixDash);

        super.paintEdgeShape(c, pts);
      }
    }
  }
}
