/**
 * registerShapes() registers the draw.io JS shape ports so that they survive maxGraph's lazy
 * registration of its core shapes (done when the first Graph is created), and the stencil arc
 * fix reads draw.io's "0"/"1" arc flags numerically.
 */
import { describe, expect, it } from 'vitest';
import { CellRenderer, Graph, StencilShape } from '@maxgraph/core';
import { registerShapes } from '../../shapes';
import { HexagonShape as DrawioHexagon } from '../../drawio-shapes/js/shapes-core';
import { arcFlag, installStencilArcFix, stencilColor } from '../../drawio-shapes/engine';
import { parseDrawioStyle } from '../../services/drawio-xml';

describe('registerShapes', () => {
  it("keeps draw.io's hexagon after the first Graph registers maxGraph's core shapes", () => {
    registerShapes();
    const host = document.createElement('div');
    const graph = new Graph(host);
    try {
      expect(CellRenderer.defaultShapes.hexagon).toBe(DrawioHexagon);
      const v = graph.insertVertex(graph.getDefaultParent(), null, '', 0, 0, 120, 80,
        parseDrawioStyle('shape=hexagon;perimeter=hexagonPerimeter2;whiteSpace=wrap;html=1;shapeInside=1;fixedSize=1;'));
      const path = graph.view.getState(v)?.shape?.node?.querySelector('path')?.getAttribute('d') ?? '';
      // fixedSize=1: draw.io's fixed 20px slant, not 25 % of the width
      expect(path.startsWith('M 20 0 L 100 0')).toBe(true);
      // the app's own hexagon is untouched
      expect(CellRenderer.defaultShapes.customHexagon).toBeDefined();
    } finally {
      graph.destroy();
    }
  });
});

describe('stencil arc flags', () => {
  it('reads "0" as false like draw.io (maxGraph used Boolean("0") === true)', () => {
    expect(arcFlag('0')).toBe(false);
    expect(arcFlag('1')).toBe(true);
    expect(arcFlag(null)).toBe(false);
    expect(arcFlag('true')).toBe(true);
  });

  it('passes numeric flags to canvas.arcTo', () => {
    installStencilArcFix();
    const xml = '<shape name="t" w="10" h="10" aspect="variable"><foreground><path>' +
      '<move x="0" y="5"/><arc rx="5" ry="5" x-axis-rotation="0" large-arc-flag="0" sweep-flag="1" x="10" y="5"/>' +
      '</path><stroke/></foreground></shape>';
    const node = new DOMParser().parseFromString(xml, 'text/xml').documentElement;
    const stencil = new StencilShape(node);
    const calls: unknown[][] = [];
    const canvas = new Proxy({}, {
      get: (_t, prop) => (...args: unknown[]) => { if (prop === 'arcTo') calls.push(args); },
    });
    const arc = node.getElementsByTagName('arc')[0];
    (stencil as unknown as { drawNode(...a: unknown[]): void }).drawNode(
      canvas, {}, arc, { x: 0, y: 0, width: 2, height: 2 }, false, true);
    expect(calls).toEqual([[10, 10, 0, false, true, 20, 10]]);
  });
});

describe('stencil colours', () => {
  const node = (xml: string): Element => new DOMParser().parseFromString(xml, 'text/xml').documentElement;
  const shape = (style: Record<string, unknown>) => ({ style, fill: '#111111', stroke: '#222222' }) as never;

  it('resolves style keys with their default, like mxStencil.parseColor', () => {
    const n = node('<fillcolor color="accentColor" default="#ffff00"/>');
    expect(stencilColor(shape({}), n, 'accentColor')).toBe('#ffff00');
    expect(stencilColor(shape({ accentColor: '#ff0000' }), n, 'accentColor')).toBe('#ff0000');
    expect(stencilColor(shape({ accentColor: 'light-dark(#00ff00, #000000)' }), n, 'accentColor')).toBe('#00ff00');
  });

  it('keeps literals and maps stroke/fill to the shape colours', () => {
    const n = node('<strokecolor color="#123456"/>');
    expect(stencilColor(shape({}), n, '#123456')).toBe('#123456');
    expect(stencilColor(shape({}), n, 'none')).toBe('none');
    expect(stencilColor(shape({}), n, 'stroke')).toBe('#222222');
    expect(stencilColor(shape({}), n, 'fill')).toBe('#111111');
  });
});
