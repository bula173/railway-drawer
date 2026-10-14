/**
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Ported from jgraph/drawio v32.4.1 src/main/webapp/js/grapheditor/Shapes.js:4673
 * (LinkShape, registered at :4699) and Shapes.js:4702 (FlexArrowShape,
 * registered at :4730), with mxArrowConnector.apply from
 * src/main/webapp/mxgraph/src/shape/mxArrowConnector.js:84.
 *
 * These are draw.io's own shapes on top of mxArrowConnector, not maxGraph's
 * 'arrowConnector' shape: the edge width comes from the `width` style and the
 * head width from `startWidth`/`endWidth`.
 */

import { ArrowConnectorShape, CellState, constants } from '@maxgraph/core';
import { getNumber } from './util';

/**
 * mxArrowConnector.apply (mxArrowConnector.js:84): start/end sizes default to
 * ARROW_SIZE / 5 and are always multiplied by 3. maxGraph only does this when
 * both sizes are set in the style, which makes default draw.io arrows smaller.
 */
function applyDrawioArrowSizes(shape: ArrowConnectorShape): void {
  if (shape.style != null) {
    shape.startSize = getNumber(shape.style, 'startSize', constants.ARROW_SIZE / 5) * 3;
    shape.endSize = getNumber(shape.style, 'endSize', constants.ARROW_SIZE / 5) * 3;
  }
}

/** draw.io `shape=link` (Shapes.js:4673): an open-ended double line. */
export class LinkShape extends ArrowConnectorShape {
  defaultWidth = 4;

  constructor() {
    super([], constants.NONE, constants.NONE);
    this.spacing = 0;
  }

  override apply(state: CellState): void {
    super.apply(state);
    applyDrawioArrowSizes(this);
  }

  override isOpenEnded(): boolean {
    return true;
  }

  override getEdgeWidth(): number {
    return getNumber(this.style, 'width', this.defaultWidth) + Math.max(0, this.strokeWidth - 1);
  }

  override isArrowRounded(): boolean {
    return this.isRounded;
  }
}

/** draw.io `shape=flexArrow` (Shapes.js:4702): the generic block arrow edge. */
export class FlexArrowShape extends ArrowConnectorShape {
  defaultWidth = 10;

  defaultArrowWidth = 20;

  constructor() {
    super([], constants.NONE, constants.NONE);
    this.spacing = 0;
  }

  override apply(state: CellState): void {
    super.apply(state);
    applyDrawioArrowSizes(this);
  }

  override getStartArrowWidth(): number {
    return this.getEdgeWidth() + getNumber(this.style, 'startWidth', this.defaultArrowWidth);
  }

  override getEndArrowWidth(): number {
    return this.getEdgeWidth() + getNumber(this.style, 'endWidth', this.defaultArrowWidth);
  }

  override getEdgeWidth(): number {
    return getNumber(this.style, 'width', this.defaultWidth) + Math.max(0, this.strokeWidth - 1);
  }
}
