/**
 * Copyright (c) 2006-2018, JGraph Holdings Ltd
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG
 * Licensed under the Apache License, Version 2.0 (see NOTICE).
 *
 * Ported from jgraph/drawio v32.4.1 shapes/mxBasic.js
 * Source: https://raw.githubusercontent.com/jgraph/drawio/v32.4.1/src/main/webapp/shapes/mxBasic.js
 *
 * Graph.handleFactory entries (resize/adjust handles). Graph.createHandle is injected.
 * Mechanical port to @maxgraph/core 0.10.3: mxActor -> ActorShape, mxArrow -> ArrowShape,
 * mxUtils.getValue -> getValue (same semantics), mxPoint/mxRectangle/mxConnectionConstraint ->
 * Point/Rectangle/ConnectionConstraint, this.strokewidth -> this.strokeWidth. Drawing code is unchanged.
 */

import { Point, Rectangle } from '@maxgraph/core';
import { getValue, type CreateHandleFn, type HandleFactory, type HandleThis } from '../compat.js';

/** draw.io Graph.handleFactory entries keyed by shape name. */
export const MX_BASIC_HANDLE_FACTORIES: Record<string, HandleFactory> = {
  // shapes/mxBasic.js:59
  'mxgraph.basic.cross2': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx'], function (this: HandleThis, bounds: Rectangle)
    {
      const dx = Math.max(0, Math.min(bounds.width / 2, bounds.width / 2, parseFloat(getValue(this.state.style, 'dx', this.dx))));
  
      return new Point(bounds.x + bounds.width / 2 + dx, bounds.y + bounds.height / 2 - dx);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      this.state.style['dx'] = Math.round(100 * Math.max(0, Math.min(bounds.height / 2, bounds.width / 2, pt.x - bounds.x - bounds.width / 2))) / 100;
    })];
        
    return handles;
  },
  // shapes/mxBasic.js:140
  'mxgraph.basic.rectCallout': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx', 'dy'], function (this: HandleThis, bounds: Rectangle)
    {
      const dx = Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'dx', this.dx))));
      const dy = Math.max(0, Math.min(bounds.height, parseFloat(getValue(this.state.style, 'dy', this.dy))));
  
      return new Point(bounds.x + dx, bounds.y + bounds.height - dy);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      const y = parseFloat(getValue(this.state.style, 'dy', this.dy)) * 0.6;
      this.state.style['dx'] = Math.round(100 * Math.max(y, Math.min(bounds.width - y, pt.x - bounds.x))) / 100;
      this.state.style['dy'] = Math.round(Math.max(0, Math.min(bounds.height, bounds.y + bounds.height - pt.y)));
    })];
        
    return handles;
  },
  // shapes/mxBasic.js:250
  'mxgraph.basic.roundRectCallout': function (state: unknown, createHandle: CreateHandleFn) {
    return [createHandle(state, ['dx', 'dy'], function (this: HandleThis, bounds: Rectangle)
    {
      const dx = Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'dx', this.dx))));
      const dy = Math.max(0, Math.min(bounds.height, parseFloat(getValue(this.state.style, 'dy', this.dy))));
  
      return new Point(bounds.x + dx, bounds.y + bounds.height - dy);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      const y = parseFloat(getValue(this.state.style, 'dy', this.dy)) * 0.6;
      this.state.style['dx'] = Math.round(100 * Math.max(y, Math.min(bounds.width - y, pt.x - bounds.x))) / 100;
      this.state.style['dy'] = Math.round(Math.max(0, Math.min(bounds.height, bounds.y + bounds.height - pt.y)));
    }), createHandle(state, ['size'], function (this: HandleThis, bounds: Rectangle)
    {
      const size = Math.max(0, Math.min(bounds.width, parseFloat(getValue(this.state.style, 'size', this.size))));
  
      return new Point(bounds.x + bounds.width - size, bounds.y + 10);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      const dy = parseFloat(getValue(this.state.style, 'dy', this.dy));
      this.state.style['size'] = Math.round(100 * Math.max(0, Math.min(bounds.width / 2, (bounds.height - dy) / 2, bounds.x + bounds.width - pt.x))) / 100;
    })];
  },
  // shapes/mxBasic.js:368
  'mxgraph.basic.wave2': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dy'], function (this: HandleThis, bounds: Rectangle)
    {
      const dy = Math.max(0, Math.min(1, parseFloat(getValue(this.state.style, 'dy', this.dy))));
  
      return new Point(bounds.x + bounds.width / 2, bounds.y + dy * bounds.height);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      this.state.style['dy'] = Math.round(100 * Math.max(0, Math.min(1, (pt.y - bounds.y) / bounds.height))) / 100;
    })];
  
    return handles;
  },
  // shapes/mxBasic.js:466
  'mxgraph.basic.octagon2': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx'], function (this: HandleThis, bounds: Rectangle)
    {
      const dx = Math.max(0, Math.min(bounds.width / 4, bounds.width / 4, parseFloat(getValue(this.state.style, 'dx', this.dx))));
  
      return new Point(bounds.x + dx, bounds.y + dx);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      this.state.style['dx'] = Math.round(100 * Math.max(0, Math.min(bounds.height / 4, bounds.width / 4, pt.x - bounds.x))) / 100;
    })];
        
    return handles;
  },
  // shapes/mxBasic.js:564
  'mxgraph.basic.isocube': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['isoAngle'], function (this: HandleThis, bounds: Rectangle)
    {
      const isoAngle = Math.max(0.01, Math.min(94, parseFloat(getValue(this.state.style, 'isoAngle', this.isoAngle)))) * Math.PI / 200 ;
      const isoH = Math.min(bounds.width * Math.tan(isoAngle), bounds.height * 0.5);
  
      return new Point(bounds.x, bounds.y + isoH);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      this.state.style['isoAngle'] = Math.round(100 * Math.max(0, Math.min(100, pt.y - bounds.y))) / 100;
    })];
        
    return handles;
  },
  // shapes/mxBasic.js:648
  'mxgraph.basic.acute_triangle': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx'], function (this: HandleThis, bounds: Rectangle)
    {
      const dx = Math.max(0, Math.min(1, parseFloat(getValue(this.state.style, 'dx', this.dx))));
  
      return new Point(bounds.x + dx * bounds.width, bounds.y + 10);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      this.state.style['dx'] = Math.round(100 * Math.max(0, Math.min(1, (pt.x - bounds.x) / bounds.width))) / 100;
    })];
  
    return handles;
  },
  // shapes/mxBasic.js:728
  'mxgraph.basic.obtuse_triangle': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx'], function (this: HandleThis, bounds: Rectangle)
    {
      const dx = Math.max(0, Math.min(1, parseFloat(getValue(this.state.style, 'dx', this.dx))));
  
      return new Point(bounds.x + dx * bounds.width, bounds.y + bounds.height - 10);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      this.state.style['dx'] = Math.round(100 * Math.max(0, Math.min(1, (pt.x - bounds.x) / bounds.width))) / 100;
    })];
  
    return handles;
  },
  // shapes/mxBasic.js:879
  'mxgraph.basic.cone2': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx'], function (this: HandleThis, bounds: Rectangle)
    {
      const dx = Math.max(0, Math.min(1, parseFloat(getValue(this.state.style, 'dx', this.dx))));
  
      return new Point(bounds.x + dx * bounds.width, bounds.y + 10);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      this.state.style['dx'] = Math.round(100 * Math.max(0, Math.min(1, (pt.x - bounds.x) / bounds.width))) / 100;
    })];
  
    const handle2 = createHandle(state, ['dy'], function (this: HandleThis, bounds: Rectangle)
    {
      const dy = Math.max(0, Math.min(1, parseFloat(getValue(this.state.style, 'dy', this.dy))));
  
      return new Point(bounds.x + 10, bounds.y + dy * bounds.height);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      this.state.style['dy'] = Math.round(100 * Math.max(0, Math.min(1, (pt.y - bounds.y) / bounds.height))) / 100;
    });
    
    handles.push(handle2);
    
    return handles;
  },
  // shapes/mxBasic.js:988
  'mxgraph.basic.pyramid': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx1'], function (this: HandleThis, bounds: Rectangle)
    {
      const dx1 = Math.max(0, Math.min(1, parseFloat(getValue(this.state.style, 'dx1', this.dx1))));
  
      return new Point(bounds.x + dx1 * bounds.width, bounds.y + 10);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      this.state.style['dx1'] = Math.round(100 * Math.max(0, Math.min(1, (pt.x - bounds.x) / bounds.width))) / 100;
    })];
  
    const handle2 = createHandle(state, ['dx2'], function (this: HandleThis, bounds: Rectangle)
    {
      const dx2 = Math.max(0, Math.min(1, parseFloat(getValue(this.state.style, 'dx2', this.dx2))));
  
      return new Point(bounds.x + dx2 * bounds.width, bounds.y + bounds.height - 10);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      this.state.style['dx2'] = Math.round(100 * Math.max(0, Math.min(1, (pt.x - bounds.x) / bounds.width))) / 100;
    });
    
    handles.push(handle2);
    
    const handle3 = createHandle(state, ['dy1'], function (this: HandleThis, bounds: Rectangle)
    {
      const dy1 = Math.max(0, Math.min(1, parseFloat(getValue(this.state.style, 'dy1', this.dy1))));
  
      return new Point(bounds.x + 10, bounds.y + dy1 * bounds.height);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      this.state.style['dy1'] = Math.round(100 * Math.max(0, Math.min(1, (pt.y - bounds.y) / bounds.height))) / 100;
    });
    
    handles.push(handle3);
    
    const handle4 = createHandle(state, ['dy2'], function (this: HandleThis, bounds: Rectangle)
    {
      const dy2 = Math.max(0, Math.min(1, parseFloat(getValue(this.state.style, 'dy2', this.dy2))));
  
      return new Point(bounds.x + bounds.width - 10, bounds.y + dy2 * bounds.height);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      this.state.style['dy2'] = Math.round(100 * Math.max(0, Math.min(1, (pt.y - bounds.y) / bounds.height))) / 100;
    });
    
    handles.push(handle4);
    
    return handles;
  },
  // shapes/mxBasic.js:1114
  'mxgraph.basic.4_point_star_2': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx'], function (this: HandleThis, bounds: Rectangle)
    {
      const dx = Math.max(0, Math.min(1, parseFloat(getValue(this.state.style, 'dx', this.dx))));
  
      return new Point(bounds.x + dx * bounds.width / 2, bounds.y + dx * bounds.height / 2);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      this.state.style['dx'] = Math.round(100 * Math.max(0, Math.min(1, 2 * (pt.x - bounds.x) / bounds.width))) / 100;
    })];
  
    return handles;
  },
  // shapes/mxBasic.js:1201
  'mxgraph.basic.diag_snip_rect': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx'], function (this: HandleThis, bounds: Rectangle)
    {
      const dx = Math.max(0, Math.min(bounds.width / 4, bounds.width / 4, parseFloat(getValue(this.state.style, 'dx', this.dx))));
  
      return new Point(bounds.x + dx, bounds.y + dx);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      this.state.style['dx'] = Math.round(100 * Math.max(0, Math.min(bounds.height / 4, bounds.width / 4, pt.x - bounds.x))) / 100;
    })];
        
    return handles;
  },
  // shapes/mxBasic.js:1291
  'mxgraph.basic.diag_round_rect': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx'], function (this: HandleThis, bounds: Rectangle)
    {
      const dx = Math.max(0, Math.min(bounds.width / 4, bounds.width / 4, parseFloat(getValue(this.state.style, 'dx', this.dx))));
  
      return new Point(bounds.x + dx, bounds.y + dx);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      this.state.style['dx'] = Math.round(100 * Math.max(0, Math.min(bounds.height / 4, bounds.width / 4, pt.x - bounds.x))) / 100;
    })];
        
    return handles;
  },
  // shapes/mxBasic.js:1375
  'mxgraph.basic.corner_round_rect': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx'], function (this: HandleThis, bounds: Rectangle)
    {
      const dx = Math.max(0, Math.min(bounds.width / 4, bounds.width / 4, parseFloat(getValue(this.state.style, 'dx', this.dx))));
  
      return new Point(bounds.x + dx, bounds.y + dx);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      this.state.style['dx'] = Math.round(100 * Math.max(0, Math.min(bounds.height / 4, bounds.width / 4, pt.x - bounds.x))) / 100;
    })];
        
    return handles;
  },
  // shapes/mxBasic.js:1462
  'mxgraph.basic.plaque': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx'], function (this: HandleThis, bounds: Rectangle)
    {
      const dx = Math.max(0, Math.min(bounds.width / 4, bounds.width / 4, parseFloat(getValue(this.state.style, 'dx', this.dx))));
  
      return new Point(bounds.x + dx * 1.41, bounds.y + dx * 1.41);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      this.state.style['dx'] = Math.round(100 * Math.max(0, Math.min(bounds.height / 4, bounds.width / 4, pt.x - bounds.x))) / 100;
    })];
        
    return handles;
  },
  // shapes/mxBasic.js:1547
  'mxgraph.basic.frame': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx'], function (this: HandleThis, bounds: Rectangle)
    {
      const dx = Math.max(0, Math.min(bounds.width / 2, bounds.width / 2, parseFloat(getValue(this.state.style, 'dx', this.dx))));
  
      return new Point(bounds.x + dx, bounds.y + dx);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      this.state.style['dx'] = Math.round(100 * Math.max(0, Math.min(bounds.height / 2, bounds.width / 2, pt.x - bounds.x))) / 100;
    })];
        
    return handles;
  },
  // shapes/mxBasic.js:1672
  'mxgraph.basic.plaque_frame': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx'], function (this: HandleThis, bounds: Rectangle)
    {
      const dx = Math.max(0, Math.min(bounds.width / 4, bounds.width / 4, parseFloat(getValue(this.state.style, 'dx', this.dx))));
  
      return new Point(bounds.x + dx, bounds.y + dx);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      this.state.style['dx'] = Math.round(100 * Math.max(0, Math.min(bounds.height / 4, bounds.width / 4, pt.x - bounds.x))) / 100;
    })];
        
    return handles;
  },
  // shapes/mxBasic.js:1774
  'mxgraph.basic.rounded_frame': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx'], function (this: HandleThis, bounds: Rectangle)
    {
      const dx = Math.max(0, Math.min(bounds.width / 4, bounds.width / 4, parseFloat(getValue(this.state.style, 'dx', this.dx))));
  
      return new Point(bounds.x + dx, bounds.y + dx);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      this.state.style['dx'] = Math.round(100 * Math.max(0, Math.min(bounds.height / 4, bounds.width / 4, pt.x - bounds.x))) / 100;
    })];
        
    return handles;
  },
  // shapes/mxBasic.js:1862
  'mxgraph.basic.frame_corner': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx'], function (this: HandleThis, bounds: Rectangle)
    {
      const dx = Math.max(0, Math.min(bounds.width / 2, bounds.width / 2, parseFloat(getValue(this.state.style, 'dx', this.dx))));
  
      return new Point(bounds.x + dx, bounds.y + dx);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      this.state.style['dx'] = Math.round(100 * Math.max(0, Math.min(bounds.height / 2, bounds.width / 2, pt.x - bounds.x))) / 100;
    })];
        
    return handles;
  },
  // shapes/mxBasic.js:1951
  'mxgraph.basic.diag_stripe': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx'], function (this: HandleThis, bounds: Rectangle)
    {
      const dx = Math.max(0, Math.min(bounds.width / 2, parseFloat(getValue(this.state.style, 'dx', this.dx))));
  
      return new Point(bounds.x + dx, bounds.y + bounds.height);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      this.state.style['dx'] = Math.round(100 * Math.max(0, Math.min(bounds.height / 2, bounds.width / 2, pt.x - bounds.x))) / 100;
    })];
        
    return handles;
  },
  // shapes/mxBasic.js:2044
  'mxgraph.basic.donut': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx'], function (this: HandleThis, bounds: Rectangle)
    {
      const dx = Math.max(0, Math.min(bounds.width / 2, bounds.width / 2, parseFloat(getValue(this.state.style, 'dx', this.dx))));
  
      return new Point(bounds.x + dx, bounds.y + bounds.height / 2);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      this.state.style['dx'] = Math.round(100 * Math.max(0, Math.min(bounds.height / 2, bounds.width / 2, pt.x - bounds.x))) / 100;
    })];
        
    return handles;
  },
  // shapes/mxBasic.js:2151
  'mxgraph.basic.layered_rect': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx'], function (this: HandleThis, bounds: Rectangle)
    {
      const dx = Math.max(0, Math.min(bounds.width / 2, bounds.width / 2, parseFloat(getValue(this.state.style, 'dx', this.dx))));
  
      return new Point(bounds.x + bounds.width - dx, bounds.y + bounds.height - dx);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      this.state.style['dx'] = Math.round(100 * Math.max(0, Math.min(bounds.height / 2, bounds.width / 2, - pt.x + bounds.width + bounds.x))) / 100;
    })];
        
    return handles;
  },
  // shapes/mxBasic.js:2294
  'mxgraph.basic.button': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx'], function (this: HandleThis, bounds: Rectangle)
    {
      const dx = Math.max(0, Math.min(bounds.width / 2, bounds.width / 2, parseFloat(getValue(this.state.style, 'dx', this.dx))));
  
      return new Point(bounds.x + dx, bounds.y + dx);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      this.state.style['dx'] = Math.round(100 * Math.max(0, Math.min(bounds.height / 2, bounds.width / 2, pt.x - bounds.x))) / 100;
    })];
        
    return handles;
  },
  // shapes/mxBasic.js:2404
  'mxgraph.basic.shaded_button': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx'], function (this: HandleThis, bounds: Rectangle)
    {
      const dx = Math.max(0, Math.min(bounds.width / 2, bounds.width / 2, parseFloat(getValue(this.state.style, 'dx', this.dx))));
  
      return new Point(bounds.x + dx, bounds.y + dx);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      this.state.style['dx'] = Math.round(100 * Math.max(0, Math.min(bounds.height / 2, bounds.width / 2, pt.x - bounds.x))) / 100;
    })];
        
    return handles;
  },
  // shapes/mxBasic.js:2515
  'mxgraph.basic.pie': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['startAngle'], function (this: HandleThis, bounds: Rectangle)
    {
      const startAngle = 2 * Math.PI * Math.max(0, Math.min(1, parseFloat(getValue(this.state.style, 'startAngle', this.startAngle))));
  
      return new Point(bounds.x + bounds.width * 0.5 + Math.sin(startAngle) * bounds.width * 0.5, bounds.y + bounds.height * 0.5 - Math.cos(startAngle) * bounds.height * 0.5);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      const handleX = Math.round(100 * Math.max(-1, Math.min(1, (pt.x - bounds.x - bounds.width * 0.5) / (bounds.width * 0.5)))) / 100;
      const handleY = -Math.round(100 * Math.max(-1, Math.min(1, (pt.y - bounds.y - bounds.height * 0.5) / (bounds.height * 0.5)))) / 100;
      
      let res =  0.5 * Math.atan2(handleX, handleY) / Math.PI;
      
      if (res < 0)
      {
        res = 1 + res;
      }
  
      this.state.style['startAngle'] = res;
      
    })];
  
    const handle2 = createHandle(state, ['endAngle'], function (this: HandleThis, bounds: Rectangle)
    {
      const endAngle = 2 * Math.PI * Math.max(0, Math.min(1, parseFloat(getValue(this.state.style, 'endAngle', this.endAngle))));
  
      return new Point(bounds.x + bounds.width * 0.5 + Math.sin(endAngle) * bounds.width * 0.5, bounds.y + bounds.height * 0.5 - Math.cos(endAngle) * bounds.height * 0.5);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      const handleX = Math.round(100 * Math.max(-1, Math.min(1, (pt.x - bounds.x - bounds.width * 0.5) / (bounds.width * 0.5)))) / 100;
      const handleY = -Math.round(100 * Math.max(-1, Math.min(1, (pt.y - bounds.y - bounds.height * 0.5) / (bounds.height * 0.5)))) / 100;
      
      let res =  0.5 * Math.atan2(handleX, handleY) / Math.PI;
      
      if (res < 0)
      {
        res = 1 + res;
      }
      
      this.state.style['endAngle'] = res;
    });
    
    handles.push(handle2);
    
    return handles;
  },
  // shapes/mxBasic.js:2762
  'mxgraph.basic.arc': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['startAngle'], function (this: HandleThis, bounds: Rectangle)
    {
      const startAngle = 2 * Math.PI * Math.max(0, Math.min(1, parseFloat(getValue(this.state.style, 'startAngle', this.startAngle))));
  
      return new Point(bounds.x + bounds.width * 0.5 + Math.sin(startAngle) * bounds.width * 0.5, bounds.y + bounds.height * 0.5 - Math.cos(startAngle) * bounds.height * 0.5);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      const handleX = Math.round(100 * Math.max(-1, Math.min(1, (pt.x - bounds.x - bounds.width * 0.5) / (bounds.width * 0.5)))) / 100;
      const handleY = -Math.round(100 * Math.max(-1, Math.min(1, (pt.y - bounds.y - bounds.height * 0.5) / (bounds.height * 0.5)))) / 100;
      
      let res =  0.5 * Math.atan2(handleX, handleY) / Math.PI;
      
      if (res < 0)
      {
        res = 1 + res;
      }
  
      this.state.style['startAngle'] = res;
      
    })];
  
    const handle2 = createHandle(state, ['endAngle'], function (this: HandleThis, bounds: Rectangle)
    {
      const endAngle = 2 * Math.PI * Math.max(0, Math.min(1, parseFloat(getValue(this.state.style, 'endAngle', this.endAngle))));
  
      return new Point(bounds.x + bounds.width * 0.5 + Math.sin(endAngle) * bounds.width * 0.5, bounds.y + bounds.height * 0.5 - Math.cos(endAngle) * bounds.height * 0.5);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      const handleX = Math.round(100 * Math.max(-1, Math.min(1, (pt.x - bounds.x - bounds.width * 0.5) / (bounds.width * 0.5)))) / 100;
      const handleY = -Math.round(100 * Math.max(-1, Math.min(1, (pt.y - bounds.y - bounds.height * 0.5) / (bounds.height * 0.5)))) / 100;
      
      let res =  0.5 * Math.atan2(handleX, handleY) / Math.PI;
      
      if (res < 0)
      {
        res = 1 + res;
      }
      
      this.state.style['endAngle'] = res;
    });
    
    handles.push(handle2);
    
    return handles;
  },
  // shapes/mxBasic.js:2899
  'mxgraph.basic.partConcEllipse': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['startAngle'], function (this: HandleThis, bounds: Rectangle)
    {
      const startAngle = 2 * Math.PI * Math.max(0, Math.min(1, parseFloat(getValue(this.state.style, 'startAngle', this.startAngle))));
  
      return new Point(bounds.x + bounds.width * 0.5 + Math.sin(startAngle) * bounds.width * 0.5, bounds.y + bounds.height * 0.5 - Math.cos(startAngle) * bounds.height * 0.5);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      const handleX = Math.round(100 * Math.max(-1, Math.min(1, (pt.x - bounds.x - bounds.width * 0.5) / (bounds.width * 0.5)))) / 100;
      const handleY = -Math.round(100 * Math.max(-1, Math.min(1, (pt.y - bounds.y - bounds.height * 0.5) / (bounds.height * 0.5)))) / 100;
      
      let res =  0.5 * Math.atan2(handleX, handleY) / Math.PI;
      
      if (res < 0)
      {
        res = 1 + res;
      }
  
      this.state.style['startAngle'] = res;
      
    })];
  
    const handle2 = createHandle(state, ['endAngle'], function (this: HandleThis, bounds: Rectangle)
    {
      const endAngle = 2 * Math.PI * Math.max(0, Math.min(1, parseFloat(getValue(this.state.style, 'endAngle', this.endAngle))));
  
      return new Point(bounds.x + bounds.width * 0.5 + Math.sin(endAngle) * bounds.width * 0.5, bounds.y + bounds.height * 0.5 - Math.cos(endAngle) * bounds.height * 0.5);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      const handleX = Math.round(100 * Math.max(-1, Math.min(1, (pt.x - bounds.x - bounds.width * 0.5) / (bounds.width * 0.5)))) / 100;
      const handleY = -Math.round(100 * Math.max(-1, Math.min(1, (pt.y - bounds.y - bounds.height * 0.5) / (bounds.height * 0.5)))) / 100;
      
      let res =  0.5 * Math.atan2(handleX, handleY) / Math.PI;
      
      if (res < 0)
      {
        res = 1 + res;
      }
      
      this.state.style['endAngle'] = res;
    });
    
    handles.push(handle2);
    
    const handle3 = createHandle(state, ['arcWidth'], function (this: HandleThis, bounds: Rectangle)
    {
      const arcWidth = Math.max(0, Math.min(1, parseFloat(getValue(this.state.style, 'arcWidth', this.arcWidth))));
  
      return new Point(bounds.x + bounds.width / 2, bounds.y + arcWidth * bounds.height * 0.5);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      this.state.style['arcWidth'] = Math.round(100 * Math.max(0, Math.min(bounds.height / 2, bounds.width / 2, (pt.y - bounds.y) / (bounds.height * 0.5)))) / 100;
    });
        
    handles.push(handle3);
    
    return handles;
  },
  // shapes/mxBasic.js:3015
  'mxgraph.basic.numberedEntryVert': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dy'], function (this: HandleThis, bounds: Rectangle)
    {
      const dy = Math.max(0, Math.min(bounds.width, bounds.width, parseFloat(getValue(this.state.style, 'dy', this.dy))));
  
      return new Point(bounds.x + bounds.width / 2, bounds.y + dy);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      this.state.style['dy'] = Math.round(100 * Math.max(0, Math.min(bounds.height, bounds.width, pt.y - bounds.y))) / 100;
    })];
        
    return handles;
  },
  // shapes/mxBasic.js:3114
  'mxgraph.basic.bendingArch': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['startAngle'], function (this: HandleThis, bounds: Rectangle)
    {
      const startAngle = 2 * Math.PI * Math.max(0, Math.min(1, parseFloat(getValue(this.state.style, 'startAngle', this.startAngle))));
  
      return new Point(bounds.x + bounds.width * 0.5 + Math.sin(startAngle) * bounds.width * 0.5, bounds.y + bounds.height * 0.5 - Math.cos(startAngle) * bounds.height * 0.5);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      const handleX = Math.round(100 * Math.max(-1, Math.min(1, (pt.x - bounds.x - bounds.width * 0.5) / (bounds.width * 0.5)))) / 100;
      const handleY = -Math.round(100 * Math.max(-1, Math.min(1, (pt.y - bounds.y - bounds.height * 0.5) / (bounds.height * 0.5)))) / 100;
      
      let res =  0.5 * Math.atan2(handleX, handleY) / Math.PI;
      
      if (res < 0)
      {
        res = 1 + res;
      }
  
      this.state.style['startAngle'] = res;
      
    })];
  
    const handle2 = createHandle(state, ['endAngle'], function (this: HandleThis, bounds: Rectangle)
    {
      const endAngle = 2 * Math.PI * Math.max(0, Math.min(1, parseFloat(getValue(this.state.style, 'endAngle', this.endAngle))));
  
      return new Point(bounds.x + bounds.width * 0.5 + Math.sin(endAngle) * bounds.width * 0.5, bounds.y + bounds.height * 0.5 - Math.cos(endAngle) * bounds.height * 0.5);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      const handleX = Math.round(100 * Math.max(-1, Math.min(1, (pt.x - bounds.x - bounds.width * 0.5) / (bounds.width * 0.5)))) / 100;
      const handleY = -Math.round(100 * Math.max(-1, Math.min(1, (pt.y - bounds.y - bounds.height * 0.5) / (bounds.height * 0.5)))) / 100;
      
      let res =  0.5 * Math.atan2(handleX, handleY) / Math.PI;
      
      if (res < 0)
      {
        res = 1 + res;
      }
      
      this.state.style['endAngle'] = res;
    });
    
    handles.push(handle2);
    
    const handle3 = createHandle(state, ['arcWidth'], function (this: HandleThis, bounds: Rectangle)
    {
      const arcWidth = Math.max(0, Math.min(1, parseFloat(getValue(this.state.style, 'arcWidth', this.arcWidth))));
  
      return new Point(bounds.x + bounds.width / 2, bounds.y + arcWidth * bounds.height * 0.5);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      this.state.style['arcWidth'] = Math.round(100 * Math.max(0, Math.min(bounds.height / 2, bounds.width / 2, (pt.y - bounds.y) / (bounds.height * 0.5)))) / 100;
    });
        
    handles.push(handle3);
    
    return handles;
  },
  // shapes/mxBasic.js:3231
  'mxgraph.basic.three_corner_round_rect': function (state: unknown, createHandle: CreateHandleFn) {
    const handles = [createHandle(state, ['dx'], function (this: HandleThis, bounds: Rectangle)
    {
      const dx = Math.max(0, Math.min(bounds.width / 4, bounds.width / 4, parseFloat(getValue(this.state.style, 'dx', this.dx))));
  
      return new Point(bounds.x + dx, bounds.y + dx);
    }, function (this: HandleThis, bounds: Rectangle, pt: Point)
    {
      this.state.style['dx'] = Math.round(100 * Math.max(0, Math.min(bounds.height / 4, bounds.width / 4, pt.x - bounds.x))) / 100;
    })];
        
    return handles;
  },
};
