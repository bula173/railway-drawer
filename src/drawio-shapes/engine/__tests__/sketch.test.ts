import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Graph, RectangleShape, Rectangle, SvgCanvas2D } from '@maxgraph/core';
import type { Cell } from '@maxgraph/core';
import { ComicCanvas, RoughCanvas, createHandJiggle, sketchSeed } from '../sketch';
import { installStencilEngine } from '../stencil-registry';

let container: HTMLElement;
let graph: Graph;

beforeAll(() => {
  const proto = SVGElement.prototype as unknown as { getBBox?: () => DOMRect };
  if (!proto.getBBox) proto.getBBox = () => ({ x: 0, y: 0, width: 10, height: 10 }) as DOMRect;
  installStencilEngine();
});

afterEach(() => {
  graph?.destroy();
  container?.remove();
});

function newGraph(): Graph {
  container = document.createElement('div');
  document.body.appendChild(container);
  graph = new Graph(container);
  return graph;
}

function addVertex(g: Graph, style: Record<string, unknown>, id?: string, size: [number, number] = [120, 60]): Cell {
  let cell!: Cell;
  g.batchUpdate(() => {
    cell = g.insertVertex({ parent: g.getDefaultParent(), id, position: [20, 20], size, style });
  });
  return cell;
}

function shapeNode(g: Graph, cell: Cell): SVGGElement {
  return g.view.getState(cell)!.shape!.node as SVGGElement;
}

const paths = (node: Element): string[] => Array.from(node.querySelectorAll('path')).map((p) => p.getAttribute('d') ?? '');

// misc-22: Rectangle (sketch)
const RECT_SKETCH = {
  rounded: true,
  whiteSpace: 'wrap',
  html: true,
  strokeWidth: 2,
  fillWeight: 4,
  hachureGap: 8,
  hachureAngle: 45,
  fillColor: '#1ba1e2',
  sketch: 1,
} as Record<string, unknown>;

describe('sketchSeed (RoughCanvas.getStyle)', () => {
  it('hashes the cell id like draw.io', () => {
    expect(sketchSeed(null)).toBe(1);
    expect(sketchSeed('2')).toBe(31 + 50);
    expect(sketchSeed('abc')).toBe(((((31 + 97) * 31 + 98) * 31 + 99) << 0));
  });
});

describe('sketch=1 rendering', () => {
  it('draws rough.js strokes and a hachure fill instead of the plain shape', () => {
    const g = newGraph();
    const cell = addVertex(g, RECT_SKETCH, 's1');
    const node = shapeNode(g, cell);
    const fill = node.querySelectorAll('path[data-rough-fill="1"]');
    expect(fill.length).toBe(1);
    expect(fill[0].getAttribute('stroke')).toBe('#1ba1e2');
    expect(fill[0].getAttribute('stroke-width')).toBe('4');
    expect(fill[0].getAttribute('fill')).toBe('none');
    // rough outline: double-stroked bezier path in the stroke colour, no solid fill
    const outline = Array.from(node.querySelectorAll('path:not([data-rough-fill])')).filter((p) => p.getAttribute('stroke') !== 'none');
    expect(outline.length).toBeGreaterThan(0);
    expect(outline.some((p) => /C/.test(p.getAttribute('d') ?? ''))).toBe(true);
    expect(Array.from(node.querySelectorAll('[fill="#1ba1e2"]'))).toHaveLength(0);
  });

  it('is stable across repaints and differs between cell ids', () => {
    const g = newGraph();
    const a = addVertex(g, RECT_SKETCH, 'a');
    const before = paths(shapeNode(g, a));
    g.view.getState(a)!.shape!.redraw();
    expect(paths(shapeNode(g, a))).toEqual(before);
    const b = addVertex(g, RECT_SKETCH, 'b');
    const pa = paths(shapeNode(g, a)).filter((d) => d.length > 40);
    const pb = paths(shapeNode(g, b)).filter((d) => d.length > 40);
    expect(pb).not.toEqual(pa);
  });

  it('fills solid when the fill is the background (fillStyle=auto)', () => {
    const g = newGraph();
    const cell = addVertex(g, { sketch: 1, fillColor: '#ffffff', strokeColor: '#000000' }, 'w');
    const node = shapeNode(g, cell);
    expect(node.querySelectorAll('path[data-rough-fill]').length).toBe(0);
    expect(node.querySelector('path[fill="#ffffff"]')).not.toBeNull();
  });

  it('draws ellipses (misc-23, fillStyle=dots -> hachure) and rhombi (misc-24, cross-hatch)', () => {
    const g = newGraph();
    const ellipse = addVertex(g, { shape: 'ellipse', strokeWidth: 2, fillWeight: 2, hachureGap: 8, fillColor: '#990000', fillStyle: 'dots', sketch: 1 }, 'e', [80, 80]);
    expect(shapeNode(g, ellipse).querySelectorAll('path[data-rough-fill]').length).toBe(1);
    const rhombus = addVertex(g, { shape: 'rhombus', strokeWidth: 2, fillWeight: -1, hachureGap: 8, fillStyle: 'cross-hatch', fillColor: '#006600', sketch: 1 }, 'r', [80, 80]);
    const fill = shapeNode(g, rhombus).querySelector('path[data-rough-fill]');
    expect(fill?.getAttribute('stroke')).toBe('#006600');
    // fillWeight=-1: half the stroke width (SvgCanvas2D omits stroke-width 1)
    expect(fill?.getAttribute('stroke-width') ?? '1').toBe('1');
  });

  it('leaves shapes without sketch=1 unchanged', () => {
    const g = newGraph();
    const cell = addVertex(g, { fillColor: '#1ba1e2' }, 'p');
    const node = shapeNode(g, cell);
    expect(node.querySelector('rect[fill="#1ba1e2"]')).not.toBeNull();
    expect(node.querySelectorAll('path[data-rough-fill]').length).toBe(0);
  });
});

describe('RoughCanvas', () => {
  function setup(style: Record<string, unknown>) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const root = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(root);
    const canvas = new SvgCanvas2D(root, false);
    const shape = new RectangleShape(new Rectangle(0, 0, 100, 50), '#1ba1e2', '#000000', 2);
    shape.style = style as never;
    return { canvas, shape, root };
  }

  it('passes style values like draw.io (numbers, defaults otherwise)', () => {
    const { canvas, shape } = setup({ sketch: 1, hachureAngle: '45', hachureGap: 8, fillWeight: 4, jiggle: 2, fillStyle: 'zigzag' });
    canvas.setFillColor('#1ba1e2');
    canvas.setStrokeColor('#000000');
    const rc = new RoughCanvas(canvas, shape);
    const o = rc.getStyle(true, true);
    expect(o.hachureAngle).toBe(45);
    expect(o.hachureGap).toBe(8);
    expect(o.dashGap).toBe(8);
    expect(o.fillWeight).toBe(4);
    expect(o.roughness).toBe(2);
    expect(o.bowing).toBe(1);
    expect(o.fillStyle).toBe('zigzag');
    expect(o.fill).toBe('#1ba1e2');
    expect(o.stroke).toBe('#000000');
    expect(o.preserveVertices).toBe(true);
    expect(rc.getStyle(false, true).stroke).toBe('none');
    rc.destroy();
  });

  it('limits fills of huge shapes', () => {
    const { canvas, shape } = setup({ sketch: 1 });
    shape.bounds = new Rectangle(0, 0, 150000, 60000);
    canvas.setFillColor('#ff0000');
    const rc = new RoughCanvas(canvas, shape);
    expect(rc.getStyle(true, true).fillStyle).toBe('solid');
    rc.destroy();
  });

  it('restores the canvas methods on destroy', () => {
    const { canvas, shape } = setup({ sketch: 1 });
    const rect = canvas.rect;
    const rc = new RoughCanvas(canvas, shape);
    expect(canvas.rect).not.toBe(rect);
    rc.destroy();
    expect(canvas.rect).toBe(rect);
  });

  it('createHandJiggle picks rough, comic or none', () => {
    const { canvas, shape } = setup({ sketch: 1 });
    const j1 = createHandJiggle(shape, canvas);
    expect(j1).toBeInstanceOf(RoughCanvas);
    j1!.destroy();
    shape.style = { sketch: 1, sketchStyle: 'comic' } as never;
    const j2 = createHandJiggle(shape, canvas);
    expect(j2).toBeInstanceOf(ComicCanvas);
    j2!.destroy();
    shape.style = { comic: '1' } as never;
    const j3 = createHandJiggle(shape, canvas);
    expect(j3).toBeInstanceOf(ComicCanvas);
    j3!.destroy();
    shape.style = { sketch: 0 } as never;
    expect(createHandJiggle(shape, canvas)).toBeNull();
    shape.style = { sketch: 1 } as never;
    shape.outline = true;
    expect(createHandJiggle(shape, canvas)).toBeNull();
  });
});

describe('ComicCanvas', () => {
  it('splits long lines into jiggled segments', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const root = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(root);
    const canvas = new SvgCanvas2D(root, false);
    const jiggle = new ComicCanvas(canvas, 2, () => 0.75);
    canvas.setStrokeColor('#000000');
    canvas.begin();
    canvas.moveTo(0, 0);
    canvas.lineTo(100, 0);
    canvas.stroke();
    jiggle.destroy();
    const d = root.querySelector('path')!.getAttribute('d')!;
    // 10 segments of 10px, offset (0.75 - 0.5) * 2 = 0.5 perpendicular
    expect(d.split('L').length - 1).toBe(11);
    expect(d).toContain('L 10 -0.5');
  });
});
