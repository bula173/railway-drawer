/**
 * Copyright (c) 2006-2016, JGraph Holdings Ltd
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG
 * Licensed under the Apache License, Version 2.0 (see NOTICE).
 *
 * Ported from jgraph/drawio v32.4.1 shapes/mxArrows.js
 * Source: https://raw.githubusercontent.com/jgraph/drawio/v32.4.1/src/main/webapp/shapes/mxArrows.js
 *
 * Graph.handleFactory entries (resize/adjust handles). Graph.createHandle is injected.
 * Mechanical port to @maxgraph/core 0.10.3: mxActor -> ActorShape, mxArrow -> ArrowShape,
 * mxUtils.getValue -> getValue (same semantics), mxPoint/mxRectangle/mxConnectionConstraint ->
 * Point/Rectangle/ConnectionConstraint, this.strokewidth -> this.strokeWidth. Drawing code is unchanged.
 */

import { Point, Rectangle } from '@maxgraph/core';
import { getValue, type CreateHandleFn, type HandleFactory, type HandleThis } from '../compat.js';

/** draw.io Graph.handleFactory entries keyed by shape name. */
export const MX_ARROWS2_HANDLE_FACTORIES: Record<string, HandleFactory> = {
  // shapes/mxArrows.js:148
  'mxgraph.arrows2.arrow': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx', 'dy'], function (this: HandleThis, bounds: Rectangle)
        {
          const dx = Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'dx', this.dx))));
          const dy = Math.max(0, Math.min(1, parseFloat(getValue(this.state.style, 'dy', this.dy))));
  
          return new Point(bounds.x + bounds.width - dx, bounds.y + dy * bounds.height / 2);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['dx'] = Math.round(100 * Math.max(0, Math.min(bounds.width - parseFloat(getValue(this.state.style, 'notch', this.notch)), bounds.x + bounds.width - pt.x))) / 100;
          this.state.style['dy'] = Math.round(100 * Math.max(0, Math.min(1, (((pt.y - bounds.y) / bounds.height) * 2)))) / 100;
        })];
        
    const handle2 = createHandle(state, ['notch'], function (this: HandleThis, bounds: Rectangle)
        {
          const notch = Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'notch', this.notch))));
  
          return new Point(bounds.x + notch, bounds.y + bounds.height / 2);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['notch'] = Math.round(100 * Math.max(0, Math.min(bounds.width - parseFloat(getValue(this.state.style, 'dx', this.dx)), pt.x - bounds.x))) / 100;
        });
    
    handles.push(handle2);
    
    return handles;
  
  },
  // shapes/mxArrows.js:297
  'mxgraph.arrows2.twoWayArrow': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx', 'dy'], function (this: HandleThis, bounds: Rectangle)
        {
          const dx = Math.max(0, Math.min(bounds.width / 2, parseFloat(getValue(this.state.style, 'dx', this.dx))));
          const dy = Math.max(0, Math.min(1, parseFloat(getValue(this.state.style, 'dy', this.dy))));
  
          return new Point(bounds.x + bounds.width - dx, bounds.y + dy * bounds.height / 2);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['dx'] = Math.round(100 * Math.max(0, Math.min(bounds.width / 2, bounds.x + bounds.width - pt.x))) / 100;
          this.state.style['dy'] = Math.round(100 * Math.max(0, Math.min(1, (((pt.y - bounds.y) / bounds.height) * 2)))) / 100;
        })];
    
    return handles;
  
  },
  // shapes/mxArrows.js:403
  'mxgraph.arrows2.stylisedArrow': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx', 'dy'], function (this: HandleThis, bounds: Rectangle)
        {
          const dx = Math.max(0, Math.min(bounds.width - 10, parseFloat(getValue(this.state.style, 'dx', this.dx))));
          const dy = Math.max(0, Math.min(1, parseFloat(getValue(this.state.style, 'dy', this.dy))));
  
          return new Point(bounds.x + bounds.width - dx, bounds.y + dy * bounds.height / 2);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['dx'] = Math.round(100 * Math.max(0, Math.min(bounds.width - 10, bounds.width - parseFloat(getValue(this.state.style, 'notch', this.notch)), bounds.x + bounds.width - pt.x))) / 100;
          this.state.style['dy'] = Math.round(100 * Math.max(0, Math.min(1, (((pt.y - bounds.y) / bounds.height) * 2)))) / 100;
        })];
        
    const handle2 = createHandle(state, ['notch'], function (this: HandleThis, bounds: Rectangle)
        {
          const notch = Math.max(0, Math.min(bounds.width - parseFloat(getValue(this.state.style, 'dx', this.dx)), parseFloat(getValue(this.state.style, 'notch', this.notch))));
  
          return new Point(bounds.x + notch, bounds.y + bounds.height / 2);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['notch'] = Math.round(100 * Math.max(0, Math.min(bounds.width - parseFloat(getValue(this.state.style, 'dx', this.dx)), pt.x - bounds.x))) / 100;
        });
    
    handles.push(handle2);
    
    const handle3 = createHandle(state, ['feather'], function (this: HandleThis, bounds: Rectangle)
        {
          const feather = Math.max(0, Math.min(1, parseFloat(getValue(this.state.style, 'feather', this.dy))));
  
          return new Point(bounds.x, bounds.y + feather * bounds.height / 2);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['feather'] = Math.round(100 * Math.max(0, Math.min(1, (((pt.y - bounds.y) / bounds.height) * 2)))) / 100;
        });
    
    handles.push(handle3);
    
    return handles;
  
  },
  // shapes/mxArrows.js:543
  'mxgraph.arrows2.sharpArrow': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx1', 'dy1'], function (this: HandleThis, bounds: Rectangle)
        {
          const dx1 = Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'dx1', this.dx1))));
          const dy1 = Math.max(0, Math.min(1, parseFloat(getValue(this.state.style, 'dy1', this.dy1))));
  
          return new Point(bounds.x + bounds.width - dx1, bounds.y + dy1 * bounds.height / 2);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['dx1'] = Math.round(100 * Math.max(0, Math.min(bounds.width - parseFloat(getValue(this.state.style, 'notch', this.notch)), bounds.x + bounds.width - pt.x))) / 100;
          this.state.style['dy1'] = Math.round(100 * Math.max(0, Math.min(1, (((pt.y - bounds.y) / bounds.height) * 2)))) / 100;
        })];
        
    const handle2 = createHandle(state, ['notch'], function (this: HandleThis, bounds: Rectangle)
        {
          const notch = Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'notch', this.notch))));
  
          return new Point(bounds.x + notch, bounds.y + bounds.height / 2);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['notch'] = Math.round(100 * Math.max(0, Math.min(bounds.width - parseFloat(getValue(this.state.style, 'dx1', this.dx1)), pt.x - bounds.x))) / 100;
        });
    
    handles.push(handle2);
    
    const handle3 = createHandle(state, ['dx2'], function (this: HandleThis, bounds: Rectangle)
        {
          const dx2 = Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'dx2', this.dx2))));
  
          return new Point(bounds.x + bounds.width - dx2, bounds.y);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['dx2'] = Math.round(100 * Math.max(0, Math.min(bounds.width - parseFloat(getValue(this.state.style, 'notch', this.notch)), bounds.x + bounds.width - pt.x))) / 100;
        });
    
    handles.push(handle3);
    
    return handles;
  },
  // shapes/mxArrows.js:693
  'mxgraph.arrows2.sharpArrow2': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx1', 'dy1'], function (this: HandleThis, bounds: Rectangle)
        {
          const dx1 = Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'dx1', this.dx1))));
          const dy1 = Math.max(0, Math.min(1, parseFloat(getValue(this.state.style, 'dy1', this.dy1))));
  
          return new Point(bounds.x + bounds.width - dx1, bounds.y + dy1 * bounds.height / 2);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['dx1'] = Math.round(100 * Math.max(0, Math.min(bounds.width - parseFloat(getValue(this.state.style, 'notch', this.notch)), bounds.x + bounds.width - pt.x))) / 100;
          this.state.style['dy1'] = Math.round(100 * Math.max(0, Math.min(1, (((pt.y - bounds.y) / bounds.height) * 2)))) / 100;
        })];
        
    const handle2 = createHandle(state, ['notch'], function (this: HandleThis, bounds: Rectangle)
        {
          const notch = Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'notch', this.notch))));
  
          return new Point(bounds.x + notch, bounds.y + bounds.height / 2);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['notch'] = Math.round(100 * Math.max(0, Math.min(bounds.width - parseFloat(getValue(this.state.style, 'dx1', this.dx1)), pt.x - bounds.x))) / 100;
        });
    
    handles.push(handle2);
    
    const handle3 = createHandle(state, ['dx2'], function (this: HandleThis, bounds: Rectangle)
        {
          const dx2 = Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'dx2', this.dx2))));
  
          return new Point(bounds.x + bounds.width - dx2, bounds.y);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['dx2'] = Math.round(100 * Math.max(0, Math.min(bounds.width - parseFloat(getValue(this.state.style, 'notch', this.notch)), bounds.x + bounds.width - pt.x))) / 100;
        });
    
    handles.push(handle3);
  
    const handle4 = createHandle(state, ['dx3', 'dy3'], function (this: HandleThis, bounds: Rectangle)
        {
          const dx3 = Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'dx3', this.dx3))));
          const dy3 = Math.max(0, Math.min(1 - parseFloat(getValue(this.state.style, 'dy1', this.dy1)) / 2, parseFloat(getValue(this.state.style, 'dy3', this.dy3))));
  
          return new Point(bounds.x + bounds.width - dx3, bounds.y + dy3 * bounds.height / 2);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['dx3'] = Math.round(100 * Math.max(parseFloat(getValue(this.state.style, 'dx2', this.dx2)), Math.min(bounds.width, bounds.x + bounds.width - pt.x))) / 100;
          this.state.style['dy3'] = Math.round(100 * Math.max(0, Math.min(parseFloat(getValue(this.state.style, 'dy1', this.dy1)), (((pt.y - bounds.y) / bounds.height) * 2)))) / 100;
        });
  
    handles.push(handle4);
  
    return handles;
  },
  // shapes/mxArrows.js:845
  'mxgraph.arrows2.calloutArrow': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx', 'dy'], function (this: HandleThis, bounds: Rectangle)
        {
          const arrowHead = Math.max(0, Math.min(bounds.height / 2, parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead))));
          const dx = Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'dx', this.dx))));
          const dy = Math.max(0, Math.min(bounds.height / 2 - arrowHead, parseFloat(getValue(this.state.style, 'dy', this.dy))));
  
          return new Point(bounds.x + bounds.width - dx, bounds.y + bounds.height / 2 - dy);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['dx'] = Math.round(100 * Math.max(0, Math.min(bounds.width - parseFloat(getValue(this.state.style, 'notch', this.notch)), bounds.x + bounds.width - pt.x))) / 100;
          this.state.style['dy'] = Math.round(100 * Math.max(0, Math.min(bounds.height / 2 - parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead)), bounds.y + bounds.height / 2 - pt.y))) / 100;
          
        })];
        
    const handle2 = createHandle(state, ['notch'], function (this: HandleThis, bounds: Rectangle)
        {
          const notch = Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'notch', this.notch))));
  
          return new Point(bounds.x + notch, bounds.y + bounds.height / 2);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['notch'] = Math.round(100 * Math.max(0, Math.min(bounds.width - parseFloat(getValue(this.state.style, 'dx', this.dx)), pt.x - bounds.x))) / 100;
        });
  
    handles.push(handle2);
    
    const handle3 = createHandle(state, ['arrowHead'], function (this: HandleThis, bounds: Rectangle)
        {
          const dx =     Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'dx', this.dx))));
          const dy =        Math.max(0, Math.min(bounds.height / 2, parseFloat(getValue(this.state.style, 'dy', this.dy))));
          const arrowHead = Math.max(0, Math.min(bounds.height / 2, parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead))));
  
          return new Point(bounds.x + bounds.width - dx, bounds.y + bounds.height / 2 - dy - arrowHead);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
        this.state.style['arrowHead'] = Math.round(100 * Math.max(0, Math.min(bounds.height / 2 - parseFloat(getValue(this.state.style, 'dy', this.dy)), bounds.y + bounds.height / 2 - parseFloat(getValue(this.state.style, 'dy', this.dy)) - pt.y))) / 100;
        });
  
    handles.push(handle3);
    
    return handles;
  },
  // shapes/mxArrows.js:1007
  'mxgraph.arrows2.bendArrow': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx', 'dy'], function (this: HandleThis, bounds: Rectangle)
        {
          const arrowHead = Math.max(0, Math.min(bounds.height, parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead))));
          const dx = Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'dx', this.dx))));
          const dy = Math.max(0, Math.min(arrowHead, parseFloat(getValue(this.state.style, 'dy', this.dy))));
      
          return new Point(bounds.x + bounds.width - dx, bounds.y + arrowHead / 2 - dy);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['dx'] = Math.round(100 * Math.max(0, Math.min(bounds.width - parseFloat(getValue(this.state.style, 'dy', this.dy)) * 2.2, bounds.x + bounds.width - pt.x))) / 100;
          this.state.style['dy'] = Math.round(100 * Math.max(0, Math.min(parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead)) / 2, bounds.y + parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead)) / 2 - pt.y))) / 100;
          
        })];
        
    const handle2 = createHandle(state, ['notch'], function (this: HandleThis, bounds: Rectangle)
        {
          const arrowHead = Math.max(0, Math.min(bounds.height, parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead))));
          const dy = Math.max(0, Math.min(arrowHead, parseFloat(getValue(this.state.style, 'dy', this.dy))));
          
          const notch = Math.max(0, Math.min(bounds.height - arrowHead / 2 - dy, parseFloat(getValue(this.state.style, 'notch', this.notch))));
  
          return new Point(bounds.x + dy, bounds.y + bounds.height - notch);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['notch'] = Math.round(100 * Math.max(0, Math.min(bounds.height - parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead)) / 2 - parseFloat(getValue(this.state.style, 'dy', this.dy)), bounds.y + bounds.height - pt.y))) / 100;
        });
    
    handles.push(handle2);
  
    const handle3 = createHandle(state, ['arrowHead'], function (this: HandleThis, bounds: Rectangle)
        {
          const dx = Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'dx', this.dx))));
          const arrowHead = Math.max(0, Math.min(bounds.height, parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead))));
  
          return new Point(bounds.x + bounds.width - dx, bounds.y + arrowHead);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['arrowHead'] = Math.round(100 * Math.max(2 * parseFloat(getValue(this.state.style, 'dy', this.dy)), Math.min(bounds.height, pt.y - bounds.y))) / 100;
        });
    
    handles.push(handle3);
  
    return handles;
  },
  // shapes/mxArrows.js:1180
  'mxgraph.arrows2.bendDoubleArrow': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx', 'dy'], function (this: HandleThis, bounds: Rectangle)
        {
          const arrowHead = Math.max(0, Math.min(Math.min(bounds.height, bounds.width) - parseFloat(getValue(this.state.style, 'dx', this.dx)), parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead))));
          const dx = Math.max(0, Math.min(Math.min(bounds.width, bounds.height) - arrowHead, parseFloat(getValue(this.state.style, 'dx', this.dx))));
          const dy = Math.max(0, Math.min(arrowHead, parseFloat(getValue(this.state.style, 'dy', this.dy))));
      
          return new Point(bounds.x + bounds.width - dx, bounds.y + arrowHead / 2 - dy);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['dx'] = Math.round(100 * Math.max(0, Math.min(Math.min(bounds.width, bounds.height) - parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead)), bounds.x + bounds.width - pt.x))) / 100;
          this.state.style['dy'] = Math.round(100 * Math.max(0, Math.min(parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead)) / 2, bounds.y + parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead)) / 2 - pt.y))) / 100;
          
        })];
        
    const handle2 = createHandle(state, ['arrowHead'], function (this: HandleThis, bounds: Rectangle)
        {
          const dx = Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'dx', this.dx))));
          const arrowHead = Math.max(0, Math.min(Math.min(bounds.height, bounds.width) - dx, parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead))));
  
          return new Point(bounds.x + bounds.width - dx, bounds.y + arrowHead);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['arrowHead'] = Math.round(100 * Math.max(2 * parseFloat(getValue(this.state.style, 'dy', this.dy)), Math.min(Math.min(bounds.height, bounds.width) - parseFloat(getValue(this.state.style, 'dx', this.dx)), pt.y - bounds.y))) / 100;
        });
    
    handles.push(handle2);
  
    return handles;
  },
  // shapes/mxArrows.js:1324
  'mxgraph.arrows2.calloutDoubleArrow': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx', 'dy'], function (this: HandleThis, bounds: Rectangle)
        {
          const arrowHead = Math.max(0, Math.min(bounds.height / 2, parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead))));
          const dx = Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'dx', this.dx))));
          const dy = Math.max(0, Math.min(bounds.height / 2 - arrowHead, parseFloat(getValue(this.state.style, 'dy', this.dy))));
  
          return new Point(bounds.x + bounds.width - dx, bounds.y + bounds.height / 2 - dy);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['dx'] = Math.round(100 * Math.max(0, Math.min(bounds.width / 2 - parseFloat(getValue(this.state.style, 'notch', this.notch)), bounds.x + bounds.width - pt.x))) / 100;
          this.state.style['dy'] = Math.round(100 * Math.max(0, Math.min(bounds.height / 2 - parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead)), bounds.y + bounds.height / 2 - pt.y))) / 100;
          
        })];
        
    const handle2 = createHandle(state, ['notch'], function (this: HandleThis, bounds: Rectangle)
        {
          const notch = Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'notch', this.notch))));
  
          return new Point(bounds.x + bounds.width / 2 + notch, bounds.y + bounds.height / 2);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['notch'] = Math.round(100 * Math.max(0, Math.min(bounds.width / 2 - parseFloat(getValue(this.state.style, 'dx', this.dx)), pt.x - bounds.x - bounds.width / 2))) / 100;
        });
  
    handles.push(handle2);
    
    const handle3 = createHandle(state, ['arrowHead'], function (this: HandleThis, bounds: Rectangle)
        {
          const dx =     Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'dx', this.dx))));
          const dy =        Math.max(0, Math.min(bounds.height / 2, parseFloat(getValue(this.state.style, 'dy', this.dy))));
          const arrowHead = Math.max(0, Math.min(bounds.height / 2, parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead))));
  
          return new Point(bounds.x + bounds.width - dx, bounds.y + bounds.height / 2 - dy - arrowHead);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['arrowHead'] = Math.round(100 * Math.max(0, Math.min(bounds.height / 2 - parseFloat(getValue(this.state.style, 'dy', this.dy)), bounds.y + bounds.height / 2 - parseFloat(getValue(this.state.style, 'dy', this.dy)) - pt.y))) / 100;
        });
  
    handles.push(handle3);
    
    return handles;
  },
  // shapes/mxArrows.js:1487
  'mxgraph.arrows2.calloutQuadArrow': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx', 'dy'], function (this: HandleThis, bounds: Rectangle)
        {
          // unused upstream: let arrowHead = Math.max(0, Math.min(bounds.height / 2, parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead))));
          const dx = Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'dx', this.dx))));
          const dy = Math.max(0, Math.min(bounds.height, parseFloat(getValue(this.state.style, 'dy', this.dy))));
  
          return new Point(bounds.x + bounds.width - dx, bounds.y + bounds.height / 2 - dy);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['dx'] = Math.round(100 * Math.max(0, Math.min(Math.min(bounds.width, bounds.height) / 2 - Math.max(parseFloat(getValue(this.state.style, 'notch', this.notch)), parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead))), bounds.x + bounds.width - pt.x))) / 100;
          this.state.style['dy'] = Math.round(100 * Math.max(0, Math.min(parseFloat(getValue(this.state.style, 'notch', this.notch)), bounds.y + bounds.height / 2 - pt.y))) / 100;
          
        })];
        
    const handle2 = createHandle(state, ['notch'], function (this: HandleThis, bounds: Rectangle)
        {
          const notch = Math.max(parseFloat(getValue(this.state.style, 'dy', this.dy)), Math.min(Math.min(bounds.width, bounds.height), parseFloat(getValue(this.state.style, 'notch', this.notch))));
  
          return new Point(bounds.x + bounds.width / 2 + notch, bounds.y + bounds.height / 2);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['notch'] = Math.round(100 * Math.max(parseFloat(getValue(this.state.style, 'dy', this.dy)), Math.min(Math.min(bounds.width, bounds.height) / 2 - parseFloat(getValue(this.state.style, 'dx', this.dx)), pt.x - bounds.x - bounds.width / 2))) / 100;
        });
  
    handles.push(handle2);
    
    const handle3 = createHandle(state, ['arrowHead'], function (this: HandleThis, bounds: Rectangle)
        {
          const dx =     Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'dx', this.dx))));
          const dy =        Math.max(0, Math.min(bounds.height / 2, parseFloat(getValue(this.state.style, 'dy', this.dy))));
          const arrowHead = Math.max(0, Math.min(bounds.height / 2, parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead))));
  
          return new Point(bounds.x + bounds.width - dx, bounds.y + bounds.height / 2 - dy - arrowHead);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['arrowHead'] = Math.round(100 * Math.max(0, Math.min(bounds.height / 2 - parseFloat(getValue(this.state.style, 'dy', this.dy)), bounds.y + bounds.height / 2 - pt.y))) / 100;
        });
  
    handles.push(handle3);
    
    return handles;
  },
  // shapes/mxArrows.js:1655
  'mxgraph.arrows2.calloutDouble90Arrow': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx1', 'dy1'], function (this: HandleThis, bounds: Rectangle)
        {
          const arrowHead = Math.max(0, Math.min(parseFloat(getValue(this.state.style, 'dy2', this.dy2)) / 2, parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead))));
          const dx1 = Math.max(0, Math.min(bounds.width - parseFloat(getValue(this.state.style, 'dx2', this.dx2)), parseFloat(getValue(this.state.style, 'dx1', this.dx1))));
          const dy1 = Math.max(0, Math.min(parseFloat(getValue(this.state.style, 'dy2', this.dy2)) / 2 - arrowHead, parseFloat(getValue(this.state.style, 'dy1', this.dy1))));
  
          return new Point(bounds.x + bounds.width - dx1, bounds.y + parseFloat(getValue(this.state.style, 'dy2', this.dy2)) / 2 - dy1);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['dx1'] = Math.round(100 * Math.max(0, Math.min(bounds.width - parseFloat(getValue(this.state.style, 'dx2', this.dx2)), bounds.height - parseFloat(getValue(this.state.style, 'dy2', this.dy2)), bounds.x + bounds.width - pt.x))) / 100;
          this.state.style['dy1'] = Math.round(100 * Math.max(0, Math.min(parseFloat(getValue(this.state.style, 'dy2', this.dy2)) / 2 - parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead)), bounds.y + parseFloat(getValue(this.state.style, 'dy2', this.dy2)) / 2 - pt.y))) / 100;
          
        })];
        
    const handle2 = createHandle(state, ['dx2', 'dy2'], function (this: HandleThis, bounds: Rectangle)
        {
          const dx2 = Math.max(parseFloat(getValue(this.state.style, 'dy1', this.dy1)) + parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead)), Math.min(bounds.width - parseFloat(getValue(this.state.style, 'dx1', this.dx1)), parseFloat(getValue(this.state.style, 'dx2', this.dx2))));
          const dy2 = Math.max(parseFloat(getValue(this.state.style, 'dy1', this.dy1)) + parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead)), Math.min(bounds.height - parseFloat(getValue(this.state.style, 'dy1', this.dy1)), parseFloat(getValue(this.state.style, 'dy2', this.dy2))));
  
          return new Point(bounds.x + dx2, bounds.y + dy2);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['dx2'] = Math.round(100 * Math.max(parseFloat(getValue(this.state.style, 'dy1', this.dy1)) + parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead)), Math.min(bounds.width - parseFloat(getValue(this.state.style, 'dx1', this.dx1)), pt.x - bounds.x))) / 100;
          this.state.style['dy2'] = Math.round(100 * Math.max(parseFloat(getValue(this.state.style, 'dy1', this.dy1)) + parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead)), Math.min(bounds.height - parseFloat(getValue(this.state.style, 'dx1', this.dx1)), pt.y - bounds.y))) / 100;
        });
  
    handles.push(handle2);
    
    const handle3 = createHandle(state, ['arrowHead'], function (this: HandleThis, bounds: Rectangle)
        {
          const dx1 =     Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'dx1', this.dx1))));
          const dy1 =        Math.max(0, Math.min(parseFloat(getValue(this.state.style, 'dy2', this.dy2)) / 2, parseFloat(getValue(this.state.style, 'dy1', this.dy1))));
          const arrowHead = Math.max(0, Math.min(parseFloat(getValue(this.state.style, 'dy2', this.dy2)) / 2, parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead))));
  
          return new Point(bounds.x + bounds.width - dx1, bounds.y + parseFloat(getValue(this.state.style, 'dy2', this.dy2)) / 2 - dy1 - arrowHead);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['arrowHead'] = Math.round(100 * Math.max(0, Math.min(parseFloat(getValue(this.state.style, 'dy2', this.dy2)) / 2 - parseFloat(getValue(this.state.style, 'dy1', this.dy1)), bounds.y + parseFloat(getValue(this.state.style, 'dy2', this.dy2)) / 2 - parseFloat(getValue(this.state.style, 'dy1', this.dy1)) - pt.y))) / 100;
        });
  
    handles.push(handle3);
    
    return handles;
  },
  // shapes/mxArrows.js:1810
  'mxgraph.arrows2.quadArrow': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx', 'dy'], function (this: HandleThis, bounds: Rectangle)
        {
          // unused upstream: let arrowHead = Math.max(0, Math.min(bounds.height / 2, parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead))));
          const dx = Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'dx', this.dx))));
          const dy = Math.max(0, Math.min(bounds.height / 2, parseFloat(getValue(this.state.style, 'dy', this.dy))));
  
          return new Point(bounds.x + bounds.width - dx, bounds.y + bounds.height / 2 - dy);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['dx'] = Math.round(100 * Math.max(0, Math.min(Math.min(bounds.width, bounds.height) / 2 - parseFloat(getValue(this.state.style, 'dy', this.dy)) - parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead)), bounds.x + bounds.width - pt.x))) / 100;
          this.state.style['dy'] = Math.round(100 * Math.max(0, Math.min(bounds.height / 2 - parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead)), bounds.y + bounds.height / 2 - pt.y))) / 100;
          
        })];
        
    const handle2 = createHandle(state, ['arrowHead'], function (this: HandleThis, bounds: Rectangle)
        {
          const dx =     Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'dx', this.dx))));
          const dy =        Math.max(0, Math.min(bounds.height / 2, parseFloat(getValue(this.state.style, 'dy', this.dy))));
          const arrowHead = Math.max(0, Math.min(bounds.height / 2, parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead))));
  
          return new Point(bounds.x + bounds.width - dx, bounds.y + bounds.height / 2 - dy - arrowHead);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['arrowHead'] = Math.round(100 * Math.max(0, Math.min(bounds.height / 2 - parseFloat(getValue(this.state.style, 'dy', this.dy)), bounds.y + bounds.height / 2 - pt.y))) / 100;
        });
  
    handles.push(handle2);
    
    return handles;
  },
  // shapes/mxArrows.js:1946
  'mxgraph.arrows2.triadArrow': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx', 'dy'], function (this: HandleThis, bounds: Rectangle)
        {
          const arrowHead = Math.max(0, Math.min(bounds.height / 2, parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead))));
          const dx = Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'dx', this.dx))));
          const dy = Math.max(0, Math.min(arrowHead, parseFloat(getValue(this.state.style, 'dy', this.dy))));
  
          return new Point(bounds.x + bounds.width - dx, bounds.y + bounds.height - dy);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['dx'] = Math.round(100 * Math.max(0, Math.min(Math.min(bounds.height - parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead)), bounds.width / 2 - parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead)) / 2), bounds.x + bounds.width - pt.x))) / 100;
          this.state.style['dy'] = Math.round(100 * Math.max(0, Math.min(parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead)) / 2, bounds.y + bounds.height - pt.y))) / 100;
          
        })];
        
    const handle2 = createHandle(state, ['arrowHead'], function (this: HandleThis, bounds: Rectangle)
        {
          const dx =     Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'dx', this.dx))));
          // unused upstream: let dy =        Math.max(0, Math.min(bounds.height / 2, parseFloat(getValue(this.state.style, 'dy', this.dy))));
          const arrowHead = Math.max(0, Math.min(bounds.height, parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead))));
  
          return new Point(bounds.x + bounds.width - dx, bounds.y + bounds.height - arrowHead);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['arrowHead'] = Math.round(100 * Math.max(2 * parseFloat(getValue(this.state.style, 'dy', this.dy)), Math.min(bounds.height - parseFloat(getValue(this.state.style, 'dx', this.dx)), bounds.width - parseFloat(getValue(this.state.style, 'dx', this.dx)) * 2, bounds.y + bounds.height - pt.y))) / 100;
        });
  
    handles.push(handle2);
    
    return handles;
  },
  // shapes/mxArrows.js:2090
  'mxgraph.arrows2.tailedArrow': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx1', 'dy1'], function (this: HandleThis, bounds: Rectangle)
        {
          const arrowHead = Math.max(0, Math.min(bounds.height / 2, parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead))));
          const dx1 = Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'dx1', this.dx1))));
          const dy1 = Math.max(0, Math.min(bounds.height / 2 - arrowHead, parseFloat(getValue(this.state.style, 'dy1', this.dy1))));
  
          return new Point(bounds.x + bounds.width - dx1, bounds.y + bounds.height / 2 - dy1);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['dx1'] = Math.round(100 * Math.max(0, Math.min(bounds.width - parseFloat(getValue(this.state.style, 'notch', this.notch)), bounds.width - parseFloat(getValue(this.state.style, 'dx2', this.dx2)), bounds.x + bounds.width - pt.x))) / 100;
          this.state.style['dy1'] = Math.round(100 * Math.max(0, Math.min(bounds.height / 2 - parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead)), parseFloat(getValue(this.state.style, 'dy2', this.dy2)), bounds.y + bounds.height / 2 - pt.y))) / 100;
          
        })];
        
    const handle2 = createHandle(state, ['notch'], function (this: HandleThis, bounds: Rectangle)
        {
          const notch = Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'notch', this.notch))));
  
          return new Point(bounds.x + notch, bounds.y + bounds.height / 2);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['notch'] = Math.round(100 * Math.max(0, Math.min(bounds.width - parseFloat(getValue(this.state.style, 'dx1', this.dx1)), parseFloat(getValue(this.state.style, 'dx2', this.dx2)), pt.x - bounds.x))) / 100;
        });
  
    handles.push(handle2);
    
    const handle3 = createHandle(state, ['arrowHead'], function (this: HandleThis, bounds: Rectangle)
        {
          const dx1 =     Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'dx1', this.dx1))));
          const dy1 =        Math.max(0, Math.min(bounds.height / 2, parseFloat(getValue(this.state.style, 'dy1', this.dy1))));
          const arrowHead = Math.max(0, Math.min(bounds.height / 2, parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead))));
  
          return new Point(bounds.x + bounds.width - dx1, bounds.y + bounds.height / 2 - dy1 - arrowHead);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['arrowHead'] = Math.round(100 * Math.max(0, Math.min(bounds.height / 2 - parseFloat(getValue(this.state.style, 'dy1', this.dy1)), bounds.y + bounds.height / 2 - pt.y))) / 100;
        });
  
    handles.push(handle3);
    
    const handle4 = createHandle(state, ['dx2', 'dy2'], function (this: HandleThis, bounds: Rectangle)
        {
          const dx2 = Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'dx2', this.dx2))));
          const dy2 = Math.max(0, Math.min(bounds.height / 2, parseFloat(getValue(this.state.style, 'dy2', this.dy2))));
  
          return new Point(bounds.x + dx2, bounds.y + bounds.height / 2 - dy2);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['dx2'] = Math.round(100 * Math.max(parseFloat(getValue(this.state.style, 'notch', this.notch)), Math.min(bounds.width - parseFloat(getValue(this.state.style, 'dx1', this.dx1)) - parseFloat(getValue(this.state.style, 'dy2', this.dy2)) + parseFloat(getValue(this.state.style, 'dy1', this.dy1)) - 1, pt.x - bounds.x))) / 100;
          this.state.style['dy2'] = Math.round(100 * Math.max(parseFloat(getValue(this.state.style, 'dy1', this.dy1)), Math.min(bounds.height / 2, bounds.y + bounds.height / 2 - pt.y))) / 100;
          
        });
  
    handles.push(handle4);
  
    return handles;
  },
  // shapes/mxArrows.js:2264
  'mxgraph.arrows2.tailedNotchedArrow': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx1', 'dy1'], function (this: HandleThis, bounds: Rectangle)
        {
          const arrowHead = Math.max(0, Math.min(bounds.height / 2, parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead))));
          const dx1 = Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'dx1', this.dx1))));
          const dy1 = Math.max(0, Math.min(bounds.height / 2 - arrowHead, parseFloat(getValue(this.state.style, 'dy1', this.dy1))));
  
          return new Point(bounds.x + bounds.width - dx1, bounds.y + bounds.height / 2 - dy1);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['dx1'] = Math.round(100 * Math.max(0, Math.min(bounds.width - parseFloat(getValue(this.state.style, 'notch', this.notch))- parseFloat(getValue(this.state.style, 'dx2', this.dx2)), bounds.x + bounds.width - pt.x))) / 100;
          this.state.style['dy1'] = Math.round(100 * Math.max(0, Math.min(bounds.height / 2 - parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead)), parseFloat(getValue(this.state.style, 'dy2', this.dy2)), bounds.y + bounds.height / 2 - pt.y))) / 100;
          
        })];
        
    const handle2 = createHandle(state, ['notch'], function (this: HandleThis, bounds: Rectangle)
        {
          const notch = Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'notch', this.notch))));
  
          return new Point(bounds.x + notch, bounds.y + bounds.height / 2);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['notch'] = Math.round(100 * Math.max(0, Math.min(bounds.width - parseFloat(getValue(this.state.style, 'dx1', this.dx1)), pt.x - bounds.x))) / 100;
        });
  
    handles.push(handle2);
    
    const handle3 = createHandle(state, ['arrowHead'], function (this: HandleThis, bounds: Rectangle)
        {
          const dx1 =     Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'dx1', this.dx1))));
          const dy1 =        Math.max(0, Math.min(bounds.height / 2, parseFloat(getValue(this.state.style, 'dy1', this.dy1))));
          const arrowHead = Math.max(0, Math.min(bounds.height / 2, parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead))));
  
          return new Point(bounds.x + bounds.width - dx1, bounds.y + bounds.height / 2 - dy1 - arrowHead);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['arrowHead'] = Math.round(100 * Math.max(0, Math.min(bounds.height / 2 - parseFloat(getValue(this.state.style, 'dy1', this.dy1)), bounds.y + bounds.height / 2 - pt.y))) / 100;
        });
  
    handles.push(handle3);
    
    const handle4 = createHandle(state, ['dx2', 'dy2'], function (this: HandleThis, bounds: Rectangle)
        {
          const dx2 = Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'dx2', this.dx2))));
          const dy2 = Math.max(0, Math.min(bounds.height / 2, parseFloat(getValue(this.state.style, 'dy2', this.dy2))));
  
          return new Point(bounds.x + dx2, bounds.y + bounds.height / 2 - dy2);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['dx2'] = Math.round(100 * Math.max(0, Math.min(bounds.width - parseFloat(getValue(this.state.style, 'notch', this.notch)) - parseFloat(getValue(this.state.style, 'dx1', this.dx1)), pt.x - bounds.x))) / 100;
          this.state.style['dy2'] = Math.round(100 * Math.max(parseFloat(getValue(this.state.style, 'dy1', this.dy1)), Math.min(bounds.height / 2, bounds.y + bounds.height / 2 - pt.y))) / 100;
          
        });
  
    handles.push(handle4);
  
    return handles;
  },
  // shapes/mxArrows.js:2426
  'mxgraph.arrows2.stripedArrow': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx', 'dy'], function (this: HandleThis, bounds: Rectangle)
        {
          const dx = Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'dx', this.dx))));
          const dy = Math.max(0, Math.min(1, parseFloat(getValue(this.state.style, 'dy', this.dy))));
  
          return new Point(bounds.x + bounds.width - dx, bounds.y + dy * bounds.height / 2);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['dx'] = Math.round(100 * Math.max(0, Math.min(bounds.width - parseFloat(getValue(this.state.style, 'notch', this.notch)), bounds.x + bounds.width - pt.x))) / 100;
          this.state.style['dy'] = Math.round(100 * Math.max(0, Math.min(1, (((pt.y - bounds.y) / bounds.height) * 2)))) / 100;
        })];
        
    const handle2 = createHandle(state, ['notch'], function (this: HandleThis, bounds: Rectangle)
        {
          const notch = Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'notch', this.notch))));
  
          return new Point(bounds.x + notch, bounds.y + bounds.height / 2);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['notch'] = Math.round(100 * Math.max(0, Math.min(bounds.width - parseFloat(getValue(this.state.style, 'dx', this.dx)), pt.x - bounds.x))) / 100;
        });
    
    handles.push(handle2);
    
    return handles;
  },
  // shapes/mxArrows.js:2537
  'mxgraph.arrows2.jumpInArrow': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx', 'dy'], function (this: HandleThis, bounds: Rectangle)
        {
          const arrowHead = Math.max(0, Math.min(bounds.height, parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead))));
          const dx = Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'dx', this.dx))));
          const dy = Math.max(0, Math.min(arrowHead, parseFloat(getValue(this.state.style, 'dy', this.dy))));
      
          return new Point(bounds.x + bounds.width - dx, bounds.y + arrowHead / 2 - dy);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['dx'] = Math.round(100 * Math.max(0, Math.min(bounds.width, bounds.x + bounds.width - pt.x))) / 100;
          this.state.style['dy'] = Math.round(100 * Math.max(0, Math.min(parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead)) / 2, bounds.y + parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead)) / 2 - pt.y))) / 100;
          
        })];
        
    const handle2 = createHandle(state, ['arrowHead'], function (this: HandleThis, bounds: Rectangle)
        {
          const dx = Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'dx', this.dx))));
          const arrowHead = Math.max(0, Math.min(bounds.height, parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead))));
  
          return new Point(bounds.x + bounds.width - dx, bounds.y + arrowHead);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['arrowHead'] = Math.round(100 * Math.max(2 * parseFloat(getValue(this.state.style, 'dy', this.dy)), Math.min(bounds.height, pt.y - bounds.y))) / 100;
        });
    
    handles.push(handle2);
  
    return handles;
  },
  // shapes/mxArrows.js:2650
  'mxgraph.arrows2.uTurnArrow': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dy'], function (this: HandleThis, bounds: Rectangle)
        {
          const arrowHead = Math.max(0, Math.min(bounds.height, parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead))));
          const dy = Math.max(0, Math.min(arrowHead, parseFloat(getValue(this.state.style, 'dy', this.dy))));
          const dx = (bounds.height - arrowHead / 2 + dy) / 2;
  
          return new Point(bounds.x + dx, bounds.y + arrowHead / 2 - dy);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['dy'] = Math.round(100 * Math.max(0, Math.min(parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead)) / 2, bounds.y + parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead)) / 2 - pt.y))) / 100;
          
        })];
  
    const handle2 = createHandle(state, ['dx2'], function (this: HandleThis, bounds: Rectangle)
        {
          const arrowHead = Math.max(0, Math.min(bounds.height, parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead))));
          const dy = Math.max(0, Math.min(arrowHead, parseFloat(getValue(this.state.style, 'dy', this.dy))));
          const dx = (bounds.height - arrowHead / 2 + dy) / 2;
          
          const dx2 = Math.max(0, Math.min(bounds.width - dx, parseFloat(getValue(this.state.style, 'dx2', this.dx2))));
  
          return new Point(bounds.x + dx + dx2, bounds.y + arrowHead / 2);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          const arrowHead = Math.max(0, Math.min(bounds.height, parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead))));
          const dy = Math.max(0, Math.min(arrowHead, parseFloat(getValue(this.state.style, 'dy', this.dy))));
          const dx = (bounds.height - arrowHead / 2 + dy) / 2;
          this.state.style['dx2'] = Math.round(100 * Math.max(0, Math.min(Math.max(bounds.width, dx), pt.x - bounds.x - dx))) / 100;
        });
    
    handles.push(handle2);
  
    const handle3 = createHandle(state, ['arrowHead'], function (this: HandleThis, bounds: Rectangle)
        {
          const arrowHead = Math.max(0, Math.min(bounds.height, parseFloat(getValue(this.state.style, 'arrowHead', this.arrowHead))));
          const dy = Math.max(0, Math.min(arrowHead, parseFloat(getValue(this.state.style, 'dy', this.dy))));
          const dx = (bounds.height - arrowHead / 2 + dy) / 2;
  
          return new Point(bounds.x + dx, bounds.y + arrowHead);
        }, function (this: HandleThis, bounds: Rectangle, pt: Point)
        {
          this.state.style['arrowHead'] = Math.round(100 * Math.max(2 * parseFloat(getValue(this.state.style, 'dy', this.dy)), Math.min(bounds.height / 2, pt.y - bounds.y))) / 100;
        });
    
    handles.push(handle3);
  
    return handles;
  },
};
