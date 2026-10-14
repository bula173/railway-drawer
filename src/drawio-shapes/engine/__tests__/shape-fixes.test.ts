import { describe, expect, it } from 'vitest';
import { ArrowConnectorShape, Graph, Point, PolylineShape, RectangleShape, Shape, SvgCanvas2D } from '@maxgraph/core';
import type { AbstractCanvas2D } from '@maxgraph/core';
import {
  DRAWIO_SHADOW,
  drawioCreateCss,
  drawioDropShadow,
  installBoundingBoxFix,
  installDropShadowFix,
  installPolylineArcSizeFix,
  installTextCssFix,
  MAX_MARKER_SIZE,
  MAX_SHADOW_EXTENT,
  parseCssColor,
  shadowParams,
  usesSvgBoundingBox,
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

// maxGraph's own implementation, captured before installTextCssFix replaces it
const maxGraphCreateCss = (SvgCanvas2D as unknown as { createCss: typeof drawioCreateCss }).createCss;

describe('drawio label box CSS (mxSvgCanvas2D.createCss)', () => {
  it('matches maxGraph wherever draw.io and maxGraph agree (no fill/width/block, no none colours)', () => {
    expect(maxGraphCreateCss).not.toBe(drawioCreateCss);
    for (const align of ['left', 'center', 'right']) {
      for (const valign of ['top', 'middle', 'bottom']) {
        for (const wrap of [true, false]) {
          for (const [overflow, clip] of [['visible', false], ['hidden', true]] as const) {
            const run = (fn: typeof drawioCreateCss): unknown[] => {
              let out: unknown[] = [];
              fn(120, 40, align, valign, wrap, overflow, clip, '#fff', '#000', 'display: flex; ', '', 1, (...a) => {
                out = a;
              });
              return out;
            };
            expect(run(drawioCreateCss)).toEqual(run(maxGraphCreateCss));
          }
        }
      }
    }
  });

  type Css = { dx: number; dy: number; flex: string; item: string; block: string };
  const css = (overflow: string, bg: string | null = null, border: string | null = null, wrap = true): Css => {
    let out: Css | null = null;
    drawioCreateCss(182, 180, 'left', 'top', wrap, overflow, false, bg, border, 'display: flex; ', '', 1, (dx, dy, flex, item, block) => {
      out = { dx, dy, flex, item, block };
    });
    return out!;
  };

  it('makes the overflow=fill inner box 2px narrower than the outer box, as draw.io does', () => {
    // misc "HTML Table 4": width:100% tables were 2px wider than in draw.io
    const r = css('fill');
    expect(r.flex).toContain('width: 182px; height: 180px;');
    expect(r.item).toContain('width: 180px; height: 180px;');
    expect(r.block).toContain('width: 100%; height: 100%;');
  });

  it('uses w - 2 for overflow=width and supports overflow=block', () => {
    expect(css('width', null, null, false).flex).toContain('width: 180px;');
    const block = css('block', null, null, false);
    expect(block.item).toContain('width: 180px;');
    expect(block.item).not.toContain('overflow: hidden');
  });

  it('offsets the label box by the alignment like mxUtils.getAlignmentAsPoint', () => {
    const at = (align: string, valign: string, overflow: string, wrap = true): [number, number] => {
      let r: [number, number] = [NaN, NaN];
      drawioCreateCss(100, 40, align, valign, wrap, overflow, false, null, null, '', '', 1, (dx, dy) => {
        r = [dx, dy];
      });
      return r;
    };
    expect(at('center', 'middle', 'visible')).toEqual([-50, 0]);
    expect(at('right', 'bottom', 'visible')).toEqual([-100, 0]);
    expect(at('left', 'top', 'visible')).toEqual([0, 0]);
    // unwrapped visible labels are positioned by the flex box alone
    expect(at('center', 'middle', 'visible', false)).toEqual([0, 0]);
    expect(at('center', 'middle', 'fill')).toEqual([-50, -20]);
    expect(at('right', 'bottom', 'hidden')).toEqual([-100, 0]);
  });

  it('omits background and border declarations for none', () => {
    const r = css('fill', 'none', 'none');
    expect(r.item).not.toContain('background-color');
    expect(r.item).not.toContain('border:');
    expect(css('fill', '#ff0000', '#00ff00').item).toContain('background-color: #ff0000; border: 1px solid #00ff00;');
  });

  it('is what maxGraph uses for HTML labels once installed', () => {
    installTextCssFix();
    const graph = new Graph(document.createElement('div'));
    try {
      graph.setHtmlLabels(true);
      const v = graph.insertVertex(graph.getDefaultParent(), null, '<table style="width:100%"><tr><td>x</td></tr></table>', 0, 0, 180, 180, {
        overflow: 'fill',
        html: true,
        whiteSpace: 'wrap',
      } as never);
      const node = graph.view.getState(v)!.text!.node as SVGElement;
      const inner = node.querySelector('foreignObject > div > div') as HTMLElement | null;
      expect(inner).not.toBeNull();
      expect(inner!.style.width).toBe('180px');
    } finally {
      graph.destroy();
    }
  });
});

describe('drawio shape bounding boxes (graph bounds, export size, thumbnail fit)', () => {
  const bbox = (style: Record<string, unknown>, edge = false): { x: number; y: number; width: number; height: number } => {
    installBoundingBoxFix();
    const graph = new Graph(document.createElement('div'));
    try {
      const parent = graph.getDefaultParent();
      const cell = edge
        ? graph.insertEdge({ parent, value: '', source: null, target: null, style: style as never })
        : graph.insertVertex(parent, null, '', 20, 20, 100, 50, style as never);
      if (edge) {
        cell.geometry!.setTerminalPoint(new Point(20, 70), true);
        cell.geometry!.setTerminalPoint(new Point(70, 20), false);
        graph.refresh();
      }
      const b = graph.view.getState(cell)!.shape!.boundingBox!;
      return { x: b.x, y: b.y, width: b.width, height: b.height };
    } finally {
      graph.destroy();
    }
  };

  it('does not count a missing start arrow as an arrow (mxConnector.augmentBoundingBox)', () => {
    // Regression: General "Line" (endArrow=none) was 8.5px larger on every side than in draw.io
    const plain = bbox({ endArrow: 'none' }, true);
    // the 50x50 line plus its stroke (maxGraph added markerSize + 1 = 7 on every side)
    expect(plain.x).toBe(19.5);
    expect(plain.width).toBeLessThan(53);
    // endArrow=classic grows by markerSize 6 + 1 (draw.io: Math.max(size, endSize) + 1)
    const arrow = bbox({ endArrow: 'classic' }, true);
    expect(arrow.x).toBe(plain.x - 7);
    expect(arrow.width).toBe(plain.width + 14);
  });

  it('uses the bounds plus stroke and shadow for vertices, like mxShape.updateBoundingBox', () => {
    expect(bbox({})).toEqual({ x: 19.5, y: 19.5, width: 101, height: 51 });
    // no stroke: no growth
    expect(bbox({ strokeColor: 'none' })).toEqual({ x: 20, y: 20, width: 100, height: 50 });
    // shadow: blur 2 * 2 on every side, then the offset (2, 3)
    expect(bbox({ strokeColor: 'none', shadow: true })).toEqual({ x: 16, y: 16, width: 110, height: 61 });
  });

  it('clamps hostile shadowBlur/shadowOffset/marker sizes from imported styles', () => {
    // Regression: shadowBlur=1e308 overflowed the bbox to Infinity and insertVertex threw
    // "Invalid width supplied." (PageBreaksMixin.updatePageBreaks on every model change);
    // shadowBlur=1e5 grew an 80x40 box to ~400000px graph bounds.
    const m = MAX_SHADOW_EXTENT;
    const huge = bbox({ strokeColor: 'none', shadow: true, shadowBlur: 1e308, shadowOffsetX: -1e308, shadowOffsetY: 1e308 });
    expect(huge).toEqual({ x: 20 - m - 2 * m, y: 20 - 2 * m, width: 100 + m + 4 * m, height: 50 + 4 * m + m });
    const big = bbox({ strokeColor: 'none', shadow: true, shadowBlur: 1e5 });
    expect(big.width).toBeLessThanOrEqual(100 + 4 * m + 3);
    expect(shadowParams({ shadowBlur: -5, shadowOffsetX: 'abc' })).toEqual({ dx: DRAWIO_SHADOW.dx, dy: DRAWIO_SHADOW.dy, blur: 0 });
    expect(drawioDropShadow({ shadowBlur: 1e308, shadowOffsetX: -1e308 }, 1)).toBe(
      `drop-shadow(-${m}px 3px ${m}px rgba(0, 0, 0, 0.25))`
    );
    const edge = bbox({ endArrow: 'classic', endSize: 1e308 }, true);
    expect(Number.isFinite(edge.width)).toBe(true);
    expect(edge.width).toBeLessThanOrEqual(51 + 2 * (MAX_MARKER_SIZE + 1) + 1);
  });

  it('keeps the graph usable with a hostile shadowBlur (page view, later edits)', () => {
    installBoundingBoxFix();
    const graph = new Graph(document.createElement('div'));
    try {
      graph.pageVisible = true;
      const parent = graph.getDefaultParent();
      expect(() => graph.insertVertex(parent, null, '', 10, 10, 80, 40, { shadow: true, shadowBlur: 1e308 } as never)).not.toThrow();
      expect(() => graph.insertVertex(parent, null, '', 120, 10, 80, 40, {})).not.toThrow();
      const b = graph.getGraphBounds();
      expect(Number.isFinite(b.width)).toBe(true);
      expect(b.width).toBeLessThan(1000);
    } finally {
      graph.destroy();
    }
  });

  it('measures the SVG node only for shapes that do so in draw.io', () => {
    class SvgMeasured extends RectangleShape {
      static drawioSvgBoundingBox = true;
    }
    const rect = new RectangleShape(null as never, '#fff', '#000');
    expect(rect.useSvgBoundingBox).toBe(true); // maxGraph default
    expect(usesSvgBoundingBox(rect)).toBe(false); // draw.io default
    expect(usesSvgBoundingBox(new ArrowConnectorShape([], '#000', '#000'))).toBe(true);
    expect(usesSvgBoundingBox(new SvgMeasured(null as never, '#fff', '#000'))).toBe(true);
    expect(Shape.prototype.updateBoundingBox).toBeTypeOf('function');
  });
});
