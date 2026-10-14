/**
 * Tests for the draw.io mx-libs ports (shapes/mxBasic.js, mxArrows.js, mxFlowchart.js @ v32.4.1).
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { CellRenderer, Graph, Rectangle, Point, type Cell } from '@maxgraph/core';
import {
  registerMxBasicShapes,
  registerMxArrows2Shapes,
  registerMxFlowchartShapes,
  registerMxLibShapes,
  MX_BASIC_SHAPES,
  MX_ARROWS2_SHAPES,
  MX_ARROWS2_EDGE_SHAPES,
  MX_FLOWCHART_SHAPES,
  MX_LIBS_CUSTOM_PROPERTIES,
  MX_LIBS_HANDLE_FACTORIES,
  mxShapeArrows2Arrow,
  mxShapeBasic4PointStar2,
  mxShapeArrowsWedgeArrow,
} from '../index';

/** Records every canvas call; numbers are checked for NaN/Infinity. */
function recordingCanvas() {
  const calls: Array<[string, unknown[]]> = [];
  const handler: ProxyHandler<object> = {
    get(_t, prop: string) {
      if (prop === 'calls') return calls;
      return (...args: unknown[]) => {
        calls.push([prop, args]);
        return undefined;
      };
    },
  };
  return new Proxy({}, handler) as any;
}

function badNumbers(calls: Array<[string, unknown[]]>): string[] {
  const bad: string[] = [];
  for (const [name, args] of calls) {
    for (const a of args) {
      if (typeof a === 'number' && !Number.isFinite(a)) bad.push(`${name}(${args.join(', ')})`);
    }
  }
  return bad;
}

const VERTEX_NAMES = [...MX_BASIC_SHAPES, ...MX_ARROWS2_SHAPES, ...MX_FLOWCHART_SHAPES]
  .map(([n]) => n)
  .filter((n) => !MX_ARROWS2_EDGE_SHAPES.includes(n));

describe('mx-libs registration', () => {
  it('registers exact draw.io names and is idempotent', () => {
    const basic = registerMxBasicShapes();
    const arrows = registerMxArrows2Shapes();
    const flow = registerMxFlowchartShapes();
    expect(basic).toHaveLength(33);
    expect(arrows).toHaveLength(21);
    expect(flow).toEqual(['mxgraph.flowchart.document2']);
    expect(basic).toContain('mxgraph.basic.4_point_star_2');
    expect(basic).toContain('mxgraph.basic.polygon');
    expect(basic).not.toContain('mxgraph.basic.rect'); // owned by the Shapes.js port
    expect(arrows).toContain('mxgraph.arrows2.arrow');
    expect(arrows).toContain('mxgraph.arrows2.wedgeArrow');
    expect(arrows).toContain('mxgraph.arrows2.wedgeArrowDashed2');
    for (const n of [...basic, ...arrows, ...flow]) {
      expect(n.startsWith('mxgraph.')).toBe(true);
      expect(CellRenderer.defaultShapes[n]).toBeTypeOf('function');
    }
    const again = registerMxLibShapes();
    expect(again).toEqual([...basic, ...arrows, ...flow]);
    expect(new Set(again).size).toBe(again.length);
  });

  it('exports customProperties and handle factories as data', () => {
    expect(MX_LIBS_CUSTOM_PROPERTIES['mxgraph.arrows2.arrow'].map((p) => p.name)).toEqual([
      'dx', 'dy', 'notch', 'headCrossline', 'tailCrossline', 'boundedLbl',
    ]);
    expect(MX_LIBS_CUSTOM_PROPERTIES['mxgraph.arrows2.wedgeArrow'][0].name).toBe('startWidth');
    expect(typeof MX_LIBS_HANDLE_FACTORIES['mxgraph.basic.polygon']).toBe('function');
    expect(typeof MX_LIBS_HANDLE_FACTORIES['mxgraph.arrows2.arrow']).toBe('function');
    expect(typeof MX_LIBS_HANDLE_FACTORIES['mxgraph.flowchart.document2']).toBe('function');
  });

  it('handle factories produce handles through an injected createHandle', () => {
    const created: Array<{ keys: string[]; pos: Point }> = [];
    const state = { style: { dx: 40, dy: 0.6, notch: 0 } };
    const createHandle = (s: any, keys: string[], getPos: any) => {
      const h = { state: s };
      const pos = getPos.call(h, new Rectangle(0, 0, 100, 60));
      created.push({ keys, pos });
      return h;
    };
    const handles = MX_LIBS_HANDLE_FACTORIES['mxgraph.arrows2.arrow'](state, createHandle);
    expect(handles).toHaveLength(2);
    expect(created[0].keys).toEqual(['dx', 'dy']);
    expect(created[0].pos.x).toBe(60);
    expect(created[0].pos.y).toBeCloseTo(18);
  });
});

describe('mx-libs painting (recording canvas)', () => {
  beforeAll(() => {
    registerMxLibShapes();
  });

  it.each(VERTEX_NAMES)('%s paints a vertex without NaN', (name) => {
    const Ctor = CellRenderer.defaultShapes[name] as any;
    const shape = new Ctor(new Rectangle(0, 0, 120, 80), '#ffffff', '#000000', 1);
    shape.style = {};
    if (name === 'mxgraph.basic.polygon') {
      shape.state = { style: { polyCoords: '[[0,0],[1,0],[0.5,1]]', polyCurves: '[]' } };
    }
    const c = recordingCanvas();
    shape.paintVertexShape(c, 10, 20, 120, 80);
    expect(c.calls.length).toBeGreaterThan(1);
    expect(badNumbers(c.calls)).toEqual([]);
    if (typeof shape.getConstraints === 'function') {
      const constr = shape.getConstraints({}, 120, 80);
      for (const k of constr) {
        expect(Number.isFinite(k.point.x) && Number.isFinite(k.dx) && Number.isFinite(k.dy)).toBe(true);
      }
    }
  });

  it.each(MX_ARROWS2_EDGE_SHAPES)('%s paints an edge without NaN', (name) => {
    const Ctor = CellRenderer.defaultShapes[name] as any;
    const shape = new Ctor();
    shape.style = {};
    const c = recordingCanvas();
    shape.paintEdgeShape(c, [new Point(0, 0), new Point(200, 50)]);
    expect(c.calls.length).toBeGreaterThan(1);
    expect(badNumbers(c.calls)).toEqual([]);
  });

  it('golden: mxgraph.arrows2.arrow with constructor defaults (dy=0.5, dx=0.5, notch=0)', () => {
    const shape = new mxShapeArrows2Arrow();
    shape.style = {} as any;
    const c = recordingCanvas();
    shape.paintVertexShape(c, 0, 0, 100, 60);
    const path = c.calls.filter(([n]: [string]) => ['moveTo', 'lineTo', 'close', 'fillAndStroke'].includes(n));
    expect(path).toEqual([
      ['moveTo', [0, 15]],
      ['lineTo', [99.5, 15]],
      ['lineTo', [99.5, 0]],
      ['lineTo', [100, 30]],
      ['lineTo', [99.5, 60]],
      ['lineTo', [99.5, 45]],
      ['lineTo', [0, 45]],
      ['lineTo', [0, 30]],
      ['close', []],
      ['fillAndStroke', []],
    ]);
  });

  it('golden: mxgraph.arrows2.arrow with the draw.io palette style (dy=0.6;dx=40;notch=0)', () => {
    const shape = new mxShapeArrows2Arrow();
    shape.style = { dy: '0.6', dx: '40', notch: '0' } as any;
    const c = recordingCanvas();
    shape.paintVertexShape(c, 0, 0, 100, 70);
    const pts = c.calls.filter(([n]: [string]) => n === 'moveTo' || n === 'lineTo').map(([, a]: [string, number[]]) => a);
    expect(pts).toEqual([
      [0, 21], [60, 21], [60, 0], [100, 35], [60, 70], [60, 49], [0, 49], [0, 35],
    ]);
    // Crosslines off by default: only one begin/fillAndStroke
    expect(c.calls.filter(([n]: [string]) => n === 'stroke')).toHaveLength(0);
    const constr = shape.getConstraints(null, 100, 70);
    expect(constr).toHaveLength(10);
    expect([constr[4].dx, constr[4].dy]).toEqual([60, 21]);
  });

  it('golden: mxgraph.basic.4_point_star_2 (dx default 0.8)', () => {
    const shape = new mxShapeBasic4PointStar2();
    shape.style = {} as any;
    const c = recordingCanvas();
    shape.paintVertexShape(c, 0, 0, 100, 100);
    const pts = c.calls.filter(([n]: [string]) => n === 'moveTo' || n === 'lineTo').map(([, a]: [string, number[]]) => a);
    expect(pts).toEqual([
      [0, 50], [40, 40], [50, 0], [60, 40], [100, 50], [60, 60], [50, 100], [40, 60],
    ]);
  });

  it('wedgeArrow uses startWidth from style', () => {
    const shape = new mxShapeArrowsWedgeArrow();
    shape.style = { startWidth: 10 } as any;
    const c = recordingCanvas();
    shape.paintEdgeShape(c, [new Point(0, 0), new Point(100, 0)]);
    const pts = c.calls.filter(([n]: [string]) => n === 'moveTo' || n === 'lineTo').map(([, a]: [string, number[]]) => a);
    expect(pts).toEqual([[0, -10], [0, 10], [100, 0]]);
  });
});

describe('mx-libs in a jsdom Graph', () => {
  let graph: Graph | null = null;

  afterEach(() => {
    graph?.destroy();
    graph = null;
  });

  it('renders every vertex shape and the wedge edges without NaN', () => {
    registerMxLibShapes();
    const container = document.createElement('div');
    document.body.appendChild(container);
    graph = new Graph(container);
    const g = graph;
    const parent = g.getDefaultParent();
    const cells: Array<[string, Cell]> = [];
    g.batchUpdate(() => {
      VERTEX_NAMES.forEach((name, i) => {
        const style: Record<string, unknown> = { shape: name };
        if (name === 'mxgraph.basic.polygon') {
          style.polyCoords = '[[0,0],[1,0],[0.5,1]]';
        }
        cells.push([name, g.insertVertex({ parent, position: [(i % 10) * 130, Math.floor(i / 10) * 100], size: [120, 80], style: style as any })]);
      });
      const a = g.insertVertex({ parent, position: [0, 800], size: [20, 20] });
      const b = g.insertVertex({ parent, position: [300, 900], size: [20, 20] });
      for (const name of MX_ARROWS2_EDGE_SHAPES) {
        cells.push([name, g.insertEdge({ parent, source: a, target: b, style: { shape: name } as any })]);
      }
    });

    for (const [name, cell] of cells) {
      const state = g.getView().getState(cell);
      expect(state, name).toBeTruthy();
      expect(state!.shape, name).toBeInstanceOf(CellRenderer.defaultShapes[name] as any);
      const node = state!.shape!.node;
      expect(node, name).toBeTruthy();
      expect(node.innerHTML.includes('NaN'), `${name}: ${node.innerHTML.slice(0, 200)}`).toBe(false);
      expect(node.querySelector('path') ?? node.querySelector('*'), name).toBeTruthy();
    }
    container.remove();
  });
});
