import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Graph } from '@maxgraph/core';
import { installDrawioCompat, resolveStyleColors } from '../graph-compat';
import { installStencilEngine } from '../stencil-registry';

const ERTMS_PATH = path.resolve(__dirname, '../../../../public/libraries/ertms.xml');

let container: HTMLElement;
let graph: Graph;

beforeAll(() => {
  // jsdom has no layout: maxGraph measures labels with getBBox
  const proto = SVGElement.prototype as unknown as { getBBox?: () => DOMRect };
  if (!proto.getBBox) proto.getBBox = () => ({ x: 0, y: 0, width: 10, height: 10 }) as DOMRect;
  installStencilEngine();
});

function newGraph(): Graph {
  container = document.createElement('div');
  document.body.appendChild(container);
  graph = new Graph(container);
  installDrawioCompat(graph);
  return graph;
}

afterEach(() => {
  graph?.destroy();
  container?.remove();
});

function firstErtmsStencil(): string {
  const lib = fs.readFileSync(ERTMS_PATH, 'utf8');
  return lib.match(/shape=(stencil\([^)]*\))/)![1];
}

describe('installDrawioCompat', () => {
  it('renders a 9x9 ERTMS stencil vertex with resolved colors and keeps cell.style', () => {
    const g = newGraph();
    const style = {
      shape: firstErtmsStencil(),
      fillColor: 'light-dark(#ffffff, #323200)',
      gradientColor: 'none',
      strokeColor: '#404040',
    };
    let cell;
    g.batchUpdate(() => {
      cell = g.insertVertex({ parent: g.getDefaultParent(), position: [10, 10], size: [9, 9], style });
    });
    const paths = Array.from(container.querySelectorAll('svg path'));
    expect(paths.length).toBeGreaterThan(0);
    const painted = paths.filter((p) => p.getAttribute('stroke') === '#404040');
    expect(painted.length).toBeGreaterThan(0);
    expect(paths.some((p) => p.getAttribute('fill') === '#ffffff')).toBe(true);
    expect(container.innerHTML).not.toContain('light-dark(');
    expect(container.innerHTML).not.toContain('stencil(');
    // The model keeps draw.io's values (saves stay 1:1)
    expect(String(cell!.style.fillColor)).toContain('light-dark(');
    expect(g.view.getState(cell!)!.style.fillColor).toBe('#ffffff');
  });

  it("resolves 'default' colors and HTML label CSS", () => {
    const g = newGraph();
    g.setHtmlLabels(true);
    let cell;
    g.batchUpdate(() => {
      cell = g.insertVertex({
        parent: g.getDefaultParent(),
        position: [0, 0],
        size: [80, 40],
        value: '<font style="color: light-dark(rgb(224, 0, 0), rgb(237, 237, 237));">Stop</font>',
        style: { fillColor: 'default', strokeColor: 'default', fontColor: 'light-dark(#111111, #eeeeee)' },
      });
    });
    const state = g.view.getState(cell!)!;
    expect(state.style.fillColor).toBe('#ffffff');
    expect(state.style.strokeColor).toBe('#000000');
    expect(state.style.fontColor).toBe('#111111');
    expect(container.innerHTML).toContain('rgb(224, 0, 0)');
    expect(container.innerHTML).not.toContain('light-dark(');
    // The value is untouched (editing and saving keep it)
    expect(String(cell!.value)).toContain('light-dark(');
    expect(cell!.style.fillColor).toBe('default');
  });

  it('honours default<Key>=invert and is idempotent', () => {
    const g = newGraph();
    const post = g.postProcessCellStyle;
    installDrawioCompat(g);
    expect(g.postProcessCellStyle).toBe(post);
    expect(resolveStyleColors({ fontColor: 'default', defaultFontColor: 'invert' } as Record<string, unknown>)).toEqual({
      fontColor: '#ffffff',
      defaultFontColor: 'invert',
    });
    expect(resolveStyleColors({ imageBorder: 'light-dark(#123456, #000)' })).toEqual({ imageBorder: '#123456' });
  });
});
