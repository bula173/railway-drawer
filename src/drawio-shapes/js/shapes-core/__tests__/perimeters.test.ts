import { Perimeter, Point, Rectangle, StyleRegistry, type CellState } from '@maxgraph/core';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  BackbonePerimeter,
  CalloutPerimeter,
  CenterPerimeter,
  HexagonPerimeter2,
  MermaidPersonPerimeter,
  MermaidPersonShape,
  ParallelogramPerimeter,
  StepPerimeter,
  TrapezoidPerimeter,
  registerShapesCorePerimeters,
} from '../index';

const B = new Rectangle(10, 20, 120, 80);

function vertex(style: Record<string, unknown> = {}, scale = 1): CellState {
  return { style, view: { scale } } as unknown as CellState;
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len));

  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function distToPolygon(p: Point, poly: Array<[number, number]>): number {
  let best = Infinity;

  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    best = Math.min(best, distToSegment(p, new Point(a[0], a[1]), new Point(b[0], b[1])));
  }

  return best;
}

/** Far away points all around the shape. */
const DIRECTIONS: Point[] = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2 + 0.05;

  return new Point(B.getCenterX() + Math.cos(a) * 500, B.getCenterY() + Math.sin(a) * 500);
});

/** Polygon in absolute coordinates for bounds B. */
function poly(rel: Array<[number, number]>): Array<[number, number]> {
  return rel.map(([x, y]) => [B.x + x, B.y + y]);
}

describe('shapes-core perimeters', () => {
  beforeAll(() => {
    registerShapesCorePerimeters();
  });

  it('registers draw.io style names and Perimeter properties', () => {
    for (const name of [
      'parallelogramPerimeter',
      'hexagonPerimeter2',
      'trapezoidPerimeter',
      'stepPerimeter',
      'calloutPerimeter',
      'backbonePerimeter',
      'centerPerimeter',
      'mermaidPersonPerimeter',
    ]) {
      expect(typeof StyleRegistry.getValue(name), name).toBe('function');
      expect((Perimeter as unknown as Record<string, unknown>)[name], name).toBe(StyleRegistry.getValue(name));
    }

    expect((Perimeter as unknown as Record<string, unknown>).ParallelogramPerimeter).toBe(ParallelogramPerimeter);
  });

  const cases: Array<[string, typeof ParallelogramPerimeter, Record<string, unknown>, Array<[number, number]>]> = [
    // size 0.2 of w = 24
    ['parallelogram', ParallelogramPerimeter, {}, [[24, 0], [120, 0], [96, 80], [0, 80]]],
    ['parallelogram fixed', ParallelogramPerimeter, { fixedSize: 1, size: 30 }, [[30, 0], [120, 0], [90, 80], [0, 80]]],
    ['parallelogram north', ParallelogramPerimeter, { direction: 'north' }, [[0, 0], [120, 16], [120, 80], [0, 64]]],
    ['trapezoid', TrapezoidPerimeter, {}, [[24, 0], [96, 0], [120, 80], [0, 80]]],
    ['trapezoid west', TrapezoidPerimeter, { direction: 'west' }, [[0, 0], [120, 0], [96, 80], [24, 80]]],
    ['trapezoid south', TrapezoidPerimeter, { direction: 'south' }, [[0, 0], [120, 16], [120, 64], [0, 80]]],
    ['step', StepPerimeter, {}, [[0, 0], [96, 0], [120, 40], [96, 80], [0, 80], [24, 40]]],
    ['step north', StepPerimeter, { direction: 'north' }, [[0, 16], [60, 0], [120, 16], [120, 80], [60, 64], [0, 80]]],
    ['hexagon2', HexagonPerimeter2, {}, [[30, 0], [90, 0], [120, 40], [90, 80], [30, 80], [0, 40]]],
    ['hexagon2 fixed', HexagonPerimeter2, { fixedSize: 1, size: 20 }, [[20, 0], [100, 0], [120, 40], [100, 80], [20, 80], [0, 40]]],
    // default size 30 cuts the pointer off the bottom
    ['callout', CalloutPerimeter, {}, [[0, 0], [120, 0], [120, 50], [0, 50]]],
  ];

  it.each(cases)('%s: points lie on the outline', (_label, fn, style, rel) => {
    const outline = poly(rel);

    for (const next of DIRECTIONS) {
      const p = fn(B, vertex(style), next, false);

      expect(p).not.toBeNull();
      expect(distToPolygon(p!, outline)).toBeLessThan(1e-6);
    }
  });

  it('orthogonal projection keeps the coordinate of next', () => {
    const p = ParallelogramPerimeter(B, vertex(), new Point(B.x + 60, B.y - 100), true)!;

    expect(p.x).toBeCloseTo(B.x + 60, 6);
    expect(p.y).toBeCloseTo(B.y, 6);
  });

  it('center perimeter returns the centre', () => {
    const p = CenterPerimeter(B, vertex(), new Point(0, 0), false)!;

    expect(p.x).toBe(B.getCenterX());
    expect(p.y).toBe(B.getCenterY());
  });

  it('backbone perimeter sits on the backbone line', () => {
    const below = BackbonePerimeter(B, vertex({ strokeWidth: 4 }), new Point(B.x + 30, B.y + 300), false)!;
    const above = BackbonePerimeter(B, vertex({ strokeWidth: 4 }), new Point(B.x + 30, B.y - 300), false)!;

    expect(below.x).toBe(B.x + 30);
    expect(below.y).toBe(B.getCenterY() + 1);
    expect(above.y).toBe(B.getCenterY() - 2);

    const vertical = BackbonePerimeter(B, vertex({ direction: 'south' }), new Point(B.x + 500, B.y + 10), false)!;
    expect(vertical.x).toBe(B.getCenterX() - 0.5);
    expect(vertical.y).toBe(B.y + 10);
  });

  it('mermaid person perimeter lies on the head or the body outline', () => {
    const g = MermaidPersonShape.getGeometry(B.width, B.height);
    const cx = B.getCenterX();
    const cy = B.y + g.headRadius;
    const top = B.y + g.bodyTop;

    for (const next of DIRECTIONS) {
      const p = MermaidPersonPerimeter(B, vertex(), next, false)!;

      expect(p).not.toBeNull();
      const onHead = Math.abs(Math.hypot(p.x - cx, p.y - cy) - g.headRadius) < 0.5;
      const onBody =
        p.y >= top - 0.5 &&
        p.y <= B.y + B.height + 0.5 &&
        p.x >= B.x - 0.5 &&
        p.x <= B.x + B.width + 0.5 &&
        (Math.abs(p.x - B.x) < 2 ||
          Math.abs(p.x - B.x - B.width) < 2 ||
          Math.abs(p.y - top) < 2 ||
          Math.abs(p.y - B.y - B.height) < 2 ||
          // rounded corners: within the corner radius band
          Math.min(Math.abs(p.x - B.x), Math.abs(p.x - B.x - B.width)) < g.bodyRadius + 0.5);

      expect(onHead || onBody, `${p.x},${p.y}`).toBe(true);
    }
  });
});
