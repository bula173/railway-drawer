import { describe, expect, it } from 'vitest';
import { Graph, Point, PolylineShape, Shape } from '@maxgraph/core';
import type { AbstractCanvas2D } from '@maxgraph/core';
import {
  DRAWIO_SHADOW,
  drawioDropShadow,
  installDropShadowFix,
  installPolylineArcSizeFix,
  parseCssColor,
} from '../shape-fixes';
import { DrawioTextShape, installDrawioCompat } from '../graph-compat';

describe('installPolylineArcSizeFix', () => {
  it('passes half the arcSize to addPoints, like mxPolyline.paintLine', () => {
    installPolylineArcSizeFix();
    const calls: number[] = [];
    const shape = new PolylineShape([new Point(0, 0), new Point(10, 0)], '#000', 1);
    shape.addPoints = ((_c: AbstractCanvas2D, _p: Point[], _r: boolean, arcSize: number) => {
      calls.push(arcSize);
    }) as PolylineShape['addPoints'];
    const canvas = { begin: () => undefined, stroke: () => undefined } as unknown as AbstractCanvas2D;
    const paint = (shape as unknown as { paintLine(c: AbstractCanvas2D, p: Point[], r: boolean): void }).paintLine;
    paint.call(shape, canvas, [], true);
    shape.style = { arcSize: 30 } as Shape['style'];
    paint.call(shape, canvas, [], true);
    expect(calls).toEqual([10, 15]);
  });
});

describe('drawio drop shadows', () => {
  it('builds draw.io drop-shadow() filters', () => {
    expect(drawioDropShadow(null, 1)).toBe('drop-shadow(2px 3px 2px rgba(0, 0, 0, 0.25))');
    expect(drawioDropShadow({ shadowOffsetX: 4, shadowColor: '#ff0000', shadowOpacity: 50 }, 2)).toBe(
      'drop-shadow(8px 6px 4px rgba(255, 0, 0, 0.5))'
    );
    expect(DRAWIO_SHADOW.opacity).toBe(25);
  });

  it('applies an alpha to hex, rgb and light-dark colours', () => {
    expect(parseCssColor('#abc', 1)).toBe('rgba(170, 187, 204, 1)');
    expect(parseCssColor('rgb(1, 2, 3)', 0.5)).toBe('rgba(1, 2, 3, 0.5)');
    expect(parseCssColor('light-dark(#000000, #ffffff)', 0.25)).toBe('rgba(0, 0, 0, 0.25)');
    expect(parseCssColor('gray', 0.25)).toBe('gray');
  });

  it('sets the filter on shadowed shapes instead of painting offset copies', () => {
    installDropShadowFix();
    const graph = new Graph(document.createElement('div'));
    try {
      const v = graph.insertVertex(graph.getDefaultParent(), null, '', 10, 10, 80, 40, { shadow: true });
      const w = graph.insertVertex(graph.getDefaultParent(), null, '', 110, 10, 80, 40, {});
      const node = graph.view.getState(v)!.shape!.node as SVGElement;
      expect(node.style.filter).toContain('drop-shadow(');
      expect(node.querySelector('[fill="true"]')).toBeNull();
      expect((graph.view.getState(w)!.shape!.node as SVGElement).style.filter).toBe('');
    } finally {
      graph.destroy();
    }
  });
});

describe('installDrawioCompat label spacing', () => {
  it("uses draw.io's base spacing and minimum stroke width", () => {
    const graph = new Graph(document.createElement('div'));
    try {
      installDrawioCompat(graph);
      expect(graph.cellRenderer.minSvgStrokeWidth).toBe(0.1);
      const v = graph.insertVertex(graph.getDefaultParent(), null, 'A', 0, 0, 80, 40, {});
      const text = graph.view.getState(v)!.text!;
      expect(text).toBeInstanceOf(DrawioTextShape);
      expect(text.baseSpacingTop).toBe(5);
      expect(text.baseSpacingBottom).toBe(1);
    } finally {
      graph.destroy();
    }
  });
});
