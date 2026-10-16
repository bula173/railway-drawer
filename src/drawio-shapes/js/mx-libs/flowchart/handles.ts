/**
 * Copyright (c) 2006-2018, JGraph Holdings Ltd
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG
 * Licensed under the Apache License, Version 2.0 (see NOTICE).
 *
 * Ported from jgraph/drawio v32.4.1 shapes/mxFlowchart.js
 * Source: https://raw.githubusercontent.com/jgraph/drawio/v32.4.1/src/main/webapp/shapes/mxFlowchart.js
 *
 * Graph.handleFactory entries (resize/adjust handles). Graph.createHandle is injected.
 * Mechanical port to @maxgraph/core 0.10.3: mxActor -> ActorShape, mxArrow -> ArrowShape,
 * mxUtils.getValue -> getValue (same semantics), mxPoint/mxRectangle/mxConnectionConstraint ->
 * Point/Rectangle/ConnectionConstraint, this.strokewidth -> this.strokeWidth. Drawing code is unchanged.
 */

import { Point, Rectangle } from '@maxgraph/core';
import { getValue, type CreateHandleFn, type HandleFactory, type HandleThis } from '../compat.js';

/** draw.io Graph.handleFactory entries keyed by shape name. */
export const MX_FLOWCHART_HANDLE_FACTORIES: Record<string, HandleFactory> = {
  // shapes/mxFlowchart.js:71
  'mxgraph.flowchart.document2': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['size'], function (this: HandleThis, bounds: Rectangle)
    {
      const size = Math.max(0, Math.min(1, parseFloat(getValue(this.state.style, 'size', this.size))));
  
      return new Point(bounds.x + 3 * bounds.width / 4, bounds.y + (1 - size) * bounds.height);
  
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      this.state.style['size'] = Math.max(0, Math.min(1, (bounds.y + bounds.height - pt.y) / bounds.height));
    })];
        
    return handles;
  },
};
