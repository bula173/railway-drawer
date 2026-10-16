/**
 * Tests of the ported draw.io (jgraph/drawio v32.4.1) Shapes.js edge, markup
 * and table shapes and the table/stack layouts.
 */

import { CellRenderer, CellState, EdgeStyle, Graph, Point, StyleRegistry } from '@maxgraph/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  FlexArrowShape,
  IsometricConnector,
  getDrawioLayoutManager,
  installTableSupport,
  registerShapesEdgeShapes,
  registerShapesEdgeStyles,
} from '../index';

type Call = [string, ...number[]];

/** Canvas stub that records path calls and ignores everything else. */
function recordingCanvas(): { canvas: any; calls: Call[] } {
  const calls: Call[] = [];
  const canvas: any = new Proxy({ state: { dashed: false, fixDash: false, strokeWidth: 1 }, pointerEvents: true, pointerEventsValue: 'all' }, {
    get(target, prop: string) {
      if (prop in target) return (target as any)[prop];
      return (...args: number[]) => {
        calls.push([prop, ...args]);
      };
    },
    set(target, prop: string, value) {
      (target as any)[prop] = value;
      return true;
    },
  });
  return { canvas, calls };
}

let containers: HTMLElement[] = [];
let graphs: Graph[] = [];

function createGraph(): Graph {
  const container = document.createElement('div');
  container.style.width = '800px';
  container.style.height = '600px';
  document.body.appendChild(container);
  containers.push(container);
  const graph = new Graph(container);
  graphs.push(graph);
  return graph;
}

beforeAll(() => {
  registerShapesEdgeShapes();
  registerShapesEdgeStyles();
});

afterEach(() => {
  for (const g of graphs) g.destroy();
  for (const c of containers) c.remove();
  graphs = [];
  containers = [];
});

describe('registration', () => {
  it('registers the draw.io names idempotently', () => {
    const names = registerShapesEdgeShapes();
    expect(names).toEqual(expect.arrayContaining(['flexArrow', 'link', 'filledEdge', 'taperedArrow', 'zigzag',
      'mermaidSankeyLink', 'curvedText', 'table', 'tableRow', 'partialRectangle']));
    expect(registerShapesEdgeShapes()).toEqual(names);
    expect(CellRenderer.defaultShapes.flexArrow).toBe(FlexArrowShape);
    expect(registerShapesEdgeStyles()).toEqual(['isometricEdgeStyle']);
    expect(StyleRegistry.getValue('isometricEdgeStyle')).toBe(IsometricConnector);
    expect((EdgeStyle as any).isometricEdgeStyle).toBe(IsometricConnector);
  });
});

describe('edge shapes', () => {
  const edgeStyles: Record<string, Record<string, unknown>> = {
    link: { shape: 'link' },
    flexArrow: { shape: 'flexArrow', endArrow: 'classic', startArrow: 'classic' },
    filledEdge: { shape: 'filledEdge', strokeWidth: 10, fillColor: '#ffffff', endArrow: 'none', edgeStyle: 'orthogonalEdgeStyle' },
    taperedArrow: { shape: 'taperedArrow', startWidth: 12, endWidth: 2, endArrow: 'block', endFill: 1 },
    taperedArrowCurved: { shape: 'taperedArrow', curved: 1, endArrow: 'open' },
    mermaidSankeyLink: { shape: 'mermaidSankeyLink', width: 20, fillColor: '#AF7AA1', strokeColor: 'none' },
  };

  for (const [name, style] of Object.entries(edgeStyles)) {
    it(`${name} renders between two vertices without NaN`, () => {
      const graph = createGraph();
      const parent = graph.getDefaultParent();
      let edge: any;
      graph.batchUpdate(() => {
        const v1 = graph.insertVertex({ parent, position: [0, 0], size: [40, 40] });
        const v2 = graph.insertVertex({ parent, position: [200, 120], size: [40, 40] });
        edge = graph.insertEdge({ parent, source: v1, target: v2, style: style as any });
      });

      const state = graph.view.getState(edge) as CellState;
      expect(state).not.toBeNull();
      expect(state.shape).not.toBeNull();
      expect(state.shape?.constructor).toBe(CellRenderer.defaultShapes[String(style.shape)]);
      const html = state.shape?.node?.innerHTML ?? '';
      expect(html).toContain('<path');
      expect(html).not.toContain('NaN');
    });
  }

  for (const [name, style] of Object.entries({
    zigzag: { shape: 'zigzag', fillColor: 'none' },
    zigzagRounded: { shape: 'zigzag', rounded: 1 },
    partialRectangle: { shape: 'partialRectangle', left: 0, right: 0, fillColor: 'none' },
  })) {
    it(`${name} renders as a vertex without NaN`, () => {
      const graph = createGraph();
      let v: any;
      graph.batchUpdate(() => {
        v = graph.insertVertex({ parent: graph.getDefaultParent(), position: [10, 10], size: [160, 20], style: style as any });
      });
      const state = graph.view.getState(v) as CellState;
      const html = state.shape?.node?.innerHTML ?? '';
      expect(html).toContain('<path');
      expect(html).not.toContain('NaN');
    });
  }

  it('flexArrow with width=10 produces the draw.io outline', () => {
    const shape = new FlexArrowShape();
    shape.style = { width: 10, endArrow: 'classic' } as any;
    // mxArrowConnector.apply: default sizes are ARROW_SIZE / 5 * 3
    shape.startSize = 18;
    shape.endSize = 18;
    shape.strokeWidth = 1;
    const { canvas, calls } = recordingCanvas();

    shape.paintEdgeShape(canvas, [new Point(0, 0), new Point(100, 0)]);

    const path = calls.filter(([n]) => n === 'moveTo' || n === 'lineTo' || n === 'close');
    const expected: Call[] = [
      ['moveTo', 0.5, 5],
      ['lineTo', 0.5, -5],
      ['lineTo', 80.5, -5],
      ['lineTo', 80.5, -15.5],
      ['lineTo', 99.5, 0],
      ['lineTo', 80.5, 15.5],
      ['lineTo', 80.5, 5],
      ['close'],
    ];
    expect(path.length).toBe(expected.length);
    path.forEach((call, i) => {
      expect(call[0]).toBe(expected[i][0]);
      for (let j = 1; j < expected[i].length; j++) {
        expect(call[j] as number).toBeCloseTo(expected[i][j] as number, 6);
      }
    });
    expect(calls.some(([n]) => n === 'fillAndStroke')).toBe(true);
  });

  it('flexArrow applies draw.io default start/end sizes', () => {
    const graph = createGraph();
    const parent = graph.getDefaultParent();
    let edge: any;
    graph.batchUpdate(() => {
      const v1 = graph.insertVertex({ parent, position: [0, 0], size: [40, 40] });
      const v2 = graph.insertVertex({ parent, position: [200, 0], size: [40, 40] });
      edge = graph.insertEdge({ parent, source: v1, target: v2, style: { shape: 'flexArrow', endArrow: 'classic' } as any });
    });
    const shape = graph.view.getState(edge)?.shape as FlexArrowShape;
    expect(shape.endSize).toBe(18);
    expect(shape.getEdgeWidth()).toBe(10);
    expect(shape.getEndArrowWidth()).toBe(30);
  });
});

describe('curvedText', () => {
  it('renders the label along a path in jsdom', () => {
    const graph = createGraph();
    let v: any;
    expect(() => {
      graph.batchUpdate(() => {
        v = graph.insertVertex({
          parent: graph.getDefaultParent(), value: 'Curved Text', position: [10, 10], size: [70, 50],
          style: { shape: 'curvedText', noLabel: 1, strokeColor: 'none', fillColor: 'none' } as any,
        });
      });
    }).not.toThrow();

    const state = graph.view.getState(v) as CellState;
    const textPath = graph.container.querySelector('textPath');
    expect(textPath).not.toBeNull();
    expect(textPath?.textContent).toBe('Curved Text');
    const href = textPath?.getAttribute('href') ?? '';
    const id = href.substring(href.indexOf('#') + 1);
    const path = graph.container.querySelector(`path[id="${id}"]`);
    expect(path?.getAttribute('d')).toMatch(/^M [-\d.]+ [-\d.]+ A /);
    expect(path?.getAttribute('d')).not.toContain('NaN');
    expect(state.shape).not.toBeNull();

    // Repaints replace the previous group instead of adding another one
    state.shape?.redraw();
    expect(graph.container.querySelectorAll('textPath').length).toBe(1);
  });
});

function insertTable(graph: Graph, tableStyle: Record<string, unknown>): { table: any; rows: any[]; cells: any[][] } {
  const parent = graph.getDefaultParent();
  const rows: any[] = [];
  const cells: any[][] = [];
  let table: any;
  graph.batchUpdate(() => {
    table = graph.insertVertex({ parent, position: [20, 20], size: [200, 100], style: tableStyle as any });

    for (let r = 0; r < 2; r++) {
      const row = graph.insertVertex({
        parent: table, position: [0, r * 50], size: [200, 50],
        style: { shape: 'tableRow', horizontal: false, startSize: 0, swimlaneHead: 0, swimlaneBody: 0,
          strokeColor: 'inherit', fillColor: 'none', collapsible: false } as any,
      });
      rows.push(row);
      const rowCells: any[] = [];

      for (let c = 0; c < 2; c++) {
        rowCells.push(graph.insertVertex({
          parent: row, value: `${r}${c}`, position: [c * 100, 0], size: [100, 50],
          style: { shape: 'partialRectangle', strokeColor: 'inherit', fillColor: 'none', connectable: false } as any,
        }));
      }

      cells.push(rowCells);
    }
  });

  return { table, rows, cells };
}

describe('table support', () => {
  const tableStyle = {
    shape: 'table', startSize: 0, container: 1, collapsible: 0, childLayout: 'tableLayout', strokeColor: '#000000',
  };

  it('is idempotent', () => {
    const graph = createGraph();
    installTableSupport(graph);
    const manager = getDrawioLayoutManager(graph);
    installTableSupport(graph);
    expect(getDrawioLayoutManager(graph)).toBe(manager);
    expect(manager).not.toBeNull();
  });

  it('resizes the rows of a 2x2 table proportionally when the table geometry changes', () => {
    const graph = createGraph();
    installTableSupport(graph);
    const { table, rows, cells } = insertTable(graph, tableStyle);

    graph.batchUpdate(() => {
      const geo = table.getGeometry().clone();
      geo.height = 200;
      geo.width = 300;
      graph.getDataModel().setGeometry(table, geo);
    });

    expect(rows.map((r) => r.getGeometry().y)).toEqual([0, 100]);
    expect(rows.map((r) => r.getGeometry().height)).toEqual([100, 100]);
    expect(rows.map((r) => r.getGeometry().width)).toEqual([300, 300]);
    expect(cells[1].map((c) => c.getGeometry().x)).toEqual([0, 150]);
    expect(cells[1].map((c) => c.getGeometry().width)).toEqual([150, 150]);
    expect(cells[1].map((c) => c.getGeometry().height)).toEqual([100, 100]);
    expect(cells[0][0].getGeometry().alternateBounds.width).toBe(150);
  });

  it('keeps row heights with fixedRows=1 and grows the table', () => {
    const graph = createGraph();
    installTableSupport(graph);
    const { table, rows } = insertTable(graph, { ...tableStyle, fixedRows: 1 });

    graph.batchUpdate(() => {
      const geo = table.getGeometry().clone();
      geo.height = 60;
      graph.getDataModel().setGeometry(table, geo);
    });

    expect(rows.map((r) => r.getGeometry().height)).toEqual([50, 50]);
    expect(table.getGeometry().height).toBe(100);
  });

  it('paints a collapsed table with its grid lines and without NaN', () => {
    const graph = createGraph();
    installTableSupport(graph);
    const { table } = insertTable(graph, { ...tableStyle, tableRender: 'collapsed', startSize: 30 });
    graph.refresh();

    const state = graph.view.getState(table) as CellState;
    const html = state.shape?.node?.innerHTML ?? '';
    expect(html).not.toContain('NaN');
    // Outline plus at least one inner row and one inner column line
    expect((html.match(/<path/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('collapsed tables take over the fills of their cells', () => {
    const graph = createGraph();
    installTableSupport(graph);
    const { table, cells } = insertTable(graph, { ...tableStyle, tableRender: 'collapsed' });

    graph.batchUpdate(() => {
      graph.getDataModel().setStyle(cells[0][0], { ...cells[0][0].getStyle(), fillColor: '#ff0000' });
    });

    const tableHtml = graph.view.getState(table)?.shape?.node?.innerHTML ?? '';
    const cellHtml = graph.view.getState(cells[0][0])?.shape?.node?.innerHTML ?? '';
    expect(tableHtml.toLowerCase()).toContain('#ff0000');
    expect(cellHtml.toLowerCase()).not.toContain('#ff0000');
  });

  it('stacks the children of a stackLayout container', () => {
    const graph = createGraph();
    installTableSupport(graph);
    const parent = graph.getDefaultParent();
    let list: any;
    const items: any[] = [];

    graph.batchUpdate(() => {
      list = graph.insertVertex({
        parent, value: 'List', position: [0, 0], size: [140, 120],
        style: { shape: 'swimlane', childLayout: 'stackLayout', horizontal: true, startSize: 26, horizontalStack: 0,
          resizeParent: 1, resizeParentMax: 0, resizeLast: 0, collapsible: 1, marginBottom: 0 } as any,
      });

      for (let i = 0; i < 3; i++) {
        items.push(graph.insertVertex({
          parent: list, value: `Item ${i + 1}`, position: [0, 0], size: [140, 30],
          style: { shape: 'text', strokeColor: 'none', fillColor: 'none', align: 'left' } as any,
        }));
      }
    });

    expect(items.map((c) => c.getGeometry().y)).toEqual([26, 56, 86]);
    expect(items.map((c) => c.getGeometry().width)).toEqual([140, 140, 140]);
    expect(list.getGeometry().height).toBe(116);
  });
});

describe('isometricEdgeStyle', () => {
  it('produces the draw.io point list', () => {
    const state = {
      view: { transformControlPoint: (_s: unknown, p: Point) => p },
      absolutePoints: [new Point(0, 0), new Point(0, 100)],
      style: {},
    } as unknown as CellState;
    const result: Point[] = [];

    IsometricConnector(state, null, null, [], result);

    const s = Math.sqrt(3) / 2 * 50;
    const expected = [[-s, 25], [0, 50], [s, 75]];
    expect(result.length).toBe(3);
    result.forEach((p, i) => {
      expect(p.x).toBeCloseTo(expected[i][0], 6);
      expect(p.y).toBeCloseTo(expected[i][1], 6);
    });
  });

  it('starts with the vertical axis for elbow=vertical', () => {
    const state = {
      view: { transformControlPoint: (_s: unknown, p: Point) => p },
      absolutePoints: [new Point(0, 0), new Point(0, 100)],
      style: { elbow: 'vertical' },
    } as unknown as CellState;
    const result: Point[] = [];

    IsometricConnector(state, null, null, [], result);

    const s = Math.sqrt(3) / 2 * 50;
    const expected = [[s, 25], [0, 50], [-s, 75]];
    result.forEach((p, i) => {
      expect(p.x).toBeCloseTo(expected[i][0], 6);
      expect(p.y).toBeCloseTo(expected[i][1], 6);
    });
  });
});
