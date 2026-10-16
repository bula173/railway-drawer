import { CellRenderer, type Graph } from '@maxgraph/core';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  HexagonShape,
  SHAPES_CORE,
  getDrawioConnectionConstraints,
  registerShapesCorePerimeters,
  registerShapesCoreShapes,
} from '../index';
import { commandString, createGraph, endPoints, insert, parsePath, paths, shapeElements, stubGetBBox } from './helpers';

const EXPECTED_NAMES = [
  'process', 'parallelogram', 'hexagon', 'cylinder3', 'document', 'internalStorage', 'cube', 'step',
  'trapezoid', 'tape', 'note', 'card', 'callout', 'wedgeCallout', 'umlActor', 'xor', 'or', 'dataStorage',
  'isoCube2', 'isoRectangle', 'curlyBracket', 'crossbar', 'waypoint', 'ext', 'tapeData', 'manualInput',
  'loopLimit', 'offPageConnector', 'delay', 'display', 'singleArrow', 'doubleArrow', 'cross', 'corner',
  'tee', 'datastore', 'orEllipse', 'sumEllipse', 'lineEllipse', 'sortShape', 'collate', 'switch',
  'smileyFace', 'message', 'mindmapBang', 'gitTag', 'mermaidPerson', 'mermaidUsecaseActor',
  'mxgraph.basic.rect',
];

/** Style variants that exercise the optional branches of the ports. */
const VARIANTS: Record<string, Array<Record<string, unknown>>> = {
  process: [{ rounded: 1 }, { fixedSize: 1, size: 15 }],
  parallelogram: [{ rounded: 1 }, { fixedSize: 1, size: 30 }],
  hexagon: [{ rounded: 1 }, { fixedSize: 1, size: 25 }],
  cylinder3: [{ lid: 0 }, { size: 0 }, { boundedLbl: 1 }],
  document: [{ boundedLbl: 1, size: 0.2 }],
  internalStorage: [{ rounded: 1, dx: 10, dy: 30 }],
  cube: [{ darkOpacity: 0.05, darkOpacity2: -0.1, boundedLbl: 1 }],
  step: [{ rounded: 1, fixedSize: 1, size: 10 }],
  trapezoid: [{ rounded: 1, fixedSize: 1, size: 10 }],
  tape: [{ boundedLbl: 1 }, { direction: 'south', boundedLbl: 1 }],
  note: [{ darkOpacity: 0.05 }],
  card: [{ rounded: 1 }],
  callout: [{ rounded: 1, position: 0.2, position2: 0.1 }],
  wedgeCallout: [{ rounded: 1 }, { tipX: 1.2, tipY: 0.1 }, { tipX: 0, tipY: 0 }, { tipX: 0.1, tipY: -3 }],
  waypoint: [{ size: 10 }],
  ext: [{ double: 1 }, { symbol0: 'umlActor', symbol0Width: 10, symbol0Height: 20, symbol0Align: 'right' }],
  lineEllipse: [{ line: 'vertical' }],
  sortShape: [{ double: 1 }],
  smileyFace: [{ smileyType: 'sad' }, { smileyType: 'neutral' }],
  gitTag: [{ holeSize: 0 }],
  mermaidPerson: [{ shadow: 1 }],
  mermaidUsecaseActor: [{ actorType: 'hollow', business: 1 }, { actorType: 'awesome' }, { business: 1 }],
  'mxgraph.basic.rect': [
    { rectStyle: 'rounded', rectOutline: 'double', fillColor2: '#ff0000' },
    { rectStyle: 'snip', top: 0, rectOutline: 'frame' },
    { rectStyle: 'invRound', left: 0, right: 0, absoluteCornerSize: 0 },
    { rectStyle: 'fold', fillColor: 'none', bottom: 0 },
    { topLeftStyle: 'rounded', topRightStyle: 'snip', bottomRightStyle: 'invRound', bottomLeftStyle: 'fold' },
  ],
};

function assertDrawn(graph: Graph, style: Record<string, unknown>): void {
  const cell = insert(graph, style);
  const elements = shapeElements(graph, cell);
  const label = JSON.stringify(style);

  expect(elements.length, `${label} draws nothing`).toBeGreaterThan(0);

  for (const el of elements) {
    for (const attr of ['d', 'x', 'y', 'width', 'height', 'cx', 'cy', 'rx', 'ry']) {
      const value = el.getAttribute(attr);

      if (value !== null) {
        expect(value, `${label} <${el.tagName} ${attr}>`).not.toMatch(/NaN|Infinity|undefined/);
      }
    }
  }
}

describe('shapes-core registration', () => {
  it('registers every draw.io name and is idempotent', () => {
    const first = registerShapesCoreShapes();
    const second = registerShapesCoreShapes();

    expect(first).toEqual(second);
    expect([...first].sort()).toEqual([...EXPECTED_NAMES].sort());

    const defaults = (CellRenderer as unknown as { defaultShapes: Record<string, unknown> }).defaultShapes;

    for (const name of first) {
      expect(defaults[name], name).toBe(SHAPES_CORE[name]);
    }
  });

  it('overrides the core hexagon like draw.io does', () => {
    registerShapesCoreShapes();
    const defaults = (CellRenderer as unknown as { defaultShapes: Record<string, unknown> }).defaultShapes;

    expect(defaults.hexagon).toBe(HexagonShape);
  });

  it('registers the perimeters idempotently', () => {
    expect(registerShapesCorePerimeters()).toEqual(registerShapesCorePerimeters());
  });
});

describe('shapes-core rendering', () => {
  let graph: Graph;
  let container: HTMLElement;

  beforeAll(() => {
    stubGetBBox();
    registerShapesCoreShapes();
    registerShapesCorePerimeters();
  });

  beforeEach(() => {
    ({ graph, container } = createGraph());
  });

  afterEach(() => {
    graph.destroy();
    container.remove();
  });

  it.each(EXPECTED_NAMES)('%s renders a 120x80 vertex without NaN', (name) => {
    assertDrawn(graph, { shape: name });
  });

  it.each(Object.entries(VARIANTS))('%s renders its style variants', (name, variants) => {
    for (const variant of variants) {
      assertDrawn(graph, { shape: name, ...variant });
    }
  });

  it.each(EXPECTED_NAMES)('%s exposes finite connection constraints', (name) => {
    const cell = insert(graph, { shape: name });
    const constraints = getDrawioConnectionConstraints(graph.view.getState(cell));

    for (const c of constraints ?? []) {
      expect(Number.isFinite(c.point?.x), name).toBe(true);
      expect(Number.isFinite(c.point?.y), name).toBe(true);
      expect(Number.isFinite(c.dx) && Number.isFinite(c.dy), name).toBe(true);
    }
  });
});

/**
 * Golden checks: command sequences and end points derived by hand from Shapes.js@v32.4.1 for a
 * 120x80 vertex. The SVG canvas may add a constant crisp-edge offset, so every point is compared
 * relative to the offset of the first move.
 */
describe('shapes-core golden paths', () => {
  let graph: Graph;
  let container: HTMLElement;

  beforeAll(() => {
    stubGetBBox();
    registerShapesCoreShapes();
  });

  beforeEach(() => {
    ({ graph, container } = createGraph());
  });

  afterEach(() => {
    graph.destroy();
    container.remove();
  });

  function expectPoints(d: string, expected: Array<[number, number] | null>, offset?: [number, number]): [number, number] {
    const actual = endPoints(d);
    expect(actual.length, d).toBe(expected.length);
    const first = actual[0]!;
    const off: [number, number] = offset ?? [first[0] - expected[0]![0], first[1] - expected[0]![1]];

    expect(Math.abs(off[0])).toBeLessThanOrEqual(1);
    expect(Math.abs(off[1])).toBeLessThanOrEqual(1);

    expected.forEach((p, i) => {
      if (p === null) {
        expect(actual[i], `${d} #${i}`).toBeNull();
      } else {
        expect(actual[i]![0] - off[0], `${d} #${i}.x`).toBeCloseTo(p[0], 1);
        expect(actual[i]![1] - off[1], `${d} #${i}.y`).toBeCloseTo(p[1], 1);
      }
    });

    return off;
  }

  it('process: rectangle plus inner lines at w * 0.1 (Shapes.js:2492)', () => {
    const cell = insert(graph, { shape: 'process' });
    const els = shapeElements(graph, cell);

    expect(els[0].tagName).toBe('rect');
    const ds = paths(graph, cell);
    expect(ds).toHaveLength(1);
    expect(commandString(ds[0])).toBe('MLML');
    expectPoints(ds[0], [[12, 0], [12, 80], [108, 0], [108, 80]]);
  });

  it('hexagon size=0.25: six corners at s = w * 0.25 (Shapes.js:2797)', () => {
    const cell = insert(graph, { shape: 'hexagon', size: 0.25 });
    const ds = paths(graph, cell);

    expect(ds).toHaveLength(1);
    expect(commandString(ds[0])).toBe('MLLLLLZ');
    expectPoints(ds[0], [[30, 0], [90, 0], [120, 40], [90, 80], [30, 80], [0, 40], null]);
  });

  it('cylinder3: body arcs and lid (Shapes.js:1443)', () => {
    const cell = insert(graph, { shape: 'cylinder3' });
    const ds = paths(graph, cell);

    expect(ds).toHaveLength(2);
    // moveTo, two quarter arcs, lineTo, two quarter arcs, close
    expect(commandString(ds[0])).toMatch(/^M(C+)(C+)L(C+)(C+)Z$/);
    const body = parsePath(ds[0]);
    const ends = endPoints(ds[0]);
    const lineIdx = body.findIndex((c) => c.cmd === 'L');
    const off = expectPoints(`M ${ends[0]!.join(' ')}`, [[0, 15]]);
    const at = (i: number) => [ends[i]![0] - off[0], ends[i]![1] - off[1]];

    expect(at(lineIdx)[0]).toBeCloseTo(120, 1);
    expect(at(lineIdx)[1]).toBeCloseTo(65, 1);
    expect(at(lineIdx - 1)).toEqual([expect.closeTo(120, 1), expect.closeTo(15, 1)]);
    expect(at(body.length - 2)).toEqual([expect.closeTo(0, 1), expect.closeTo(65, 1)]);
    // the arcs pass through the top and bottom centres
    const passes = (x: number, y: number) =>
      ends.some((p) => p !== null && Math.abs(p[0] - off[0] - x) < 0.1 && Math.abs(p[1] - off[1] - y) < 0.1);
    expect(passes(60, 0)).toBe(true);
    expect(passes(60, 80)).toBe(true);

    // lid: from (w, size) through (w/2, 2*size) to (0, size)
    expect(commandString(ds[1])).toMatch(/^M(C+)(C+)$/);
    const lid = endPoints(ds[1]);
    expect([lid[0]![0] - off[0], lid[0]![1] - off[1]]).toEqual([expect.closeTo(120, 1), expect.closeTo(15, 1)]);
    const last = lid[lid.length - 1]!;
    expect([last[0] - off[0], last[1] - off[1]]).toEqual([expect.closeTo(0, 1), expect.closeTo(15, 1)]);
    expect(lid.some((p) => p !== null && Math.abs(p[0] - off[0] - 60) < 0.1 && Math.abs(p[1] - off[1] - 30) < 0.1)).toBe(
      true
    );
  });

  it('callout: bubble with pointer (Shapes.js:2576)', () => {
    const cell = insert(graph, { shape: 'callout' });
    const ds = paths(graph, cell);

    expect(ds).toHaveLength(1);
    expect(commandString(ds[0])).toBe('MLLLLLLZ');
    expectPoints(ds[0], [[0, 0], [120, 0], [120, 50], [80, 50], [60, 80], [60, 50], [0, 50], null]);
  });

  it('note: folded corner outline and fold (Shapes.js:1279)', () => {
    const cell = insert(graph, { shape: 'note' });
    const ds = paths(graph, cell);

    expect(ds).toHaveLength(2);
    expect(commandString(ds[0])).toBe('MLLLLLZ');
    const off = expectPoints(ds[0], [[0, 0], [90, 0], [120, 30], [120, 80], [0, 80], [0, 0], null]);
    expect(commandString(ds[1])).toBe('MLL');
    expectPoints(ds[1], [[90, 0], [90, 30], [120, 30]], off);
  });
});
