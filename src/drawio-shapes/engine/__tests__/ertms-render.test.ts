/**
 * Renders every entry of public/libraries/ertms.xml in a maxGraph Graph with the draw.io
 * engine installed: no errors, no unresolved light-dark()/stencil(...) in the SVG, and the
 * named stencils (mxgraph.basic.flash, mxgraph.mscae.enterprise.wireless_connection) render
 * as stencils once their sets are preloaded from public/stencils.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Graph, StencilShapeRegistry } from '@maxgraph/core';
import type { Cell } from '@maxgraph/core';
import { importDrawioXmlIntoModel } from '../../../services/drawio-xml';
import { entryToCells, parseMxLibrary } from '../mxlibrary';
import { installDrawioCompat } from '../graph-compat';
import { ensureStencilsForXml, installStencilEngine } from '../stencil-registry';

const PUBLIC = path.resolve(__dirname, '../../../../public');
const NAMED = ['mxgraph.basic.flash', 'mxgraph.mscae.enterprise.wireless_connection'];
const stencilFilesPresent =
  fs.existsSync(path.join(PUBLIC, 'stencils/basic.xml')) && fs.existsSync(path.join(PUBLIC, 'stencils/mscae/enterprise.xml'));

const entries = parseMxLibrary(fs.readFileSync(path.join(PUBLIC, 'libraries/ertms.xml'), 'utf8'));

beforeAll(async () => {
  const proto = SVGElement.prototype as unknown as { getBBox?: () => DOMRect };
  if (!proto.getBBox) proto.getBBox = () => ({ x: 0, y: 0, width: 10, height: 10 }) as DOMRect;
  // fetch stub serving public/ from disk
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const file = path.join(PUBLIC, String(url).replace(/^\/+/, ''));
      if (!file.startsWith(PUBLIC) || !fs.existsSync(file)) return new Response('', { status: 404 });
      return new Response(fs.readFileSync(file, 'utf8'));
    })
  );
  installStencilEngine({ baseUrl: '/' });
  await ensureStencilsForXml(entries.map((e) => e.xml ?? ''));
});

afterAll(() => vi.unstubAllGlobals());

function allCells(root: Cell): Cell[] {
  const out: Cell[] = [];
  const walk = (c: Cell): void => {
    out.push(c);
    for (const child of c.children ?? []) walk(child);
  };
  walk(root);
  return out;
}

function attributesContaining(el: Element, needle: string): string[] {
  const hits: string[] = [];
  for (const node of [el, ...Array.from(el.querySelectorAll('*'))]) {
    for (const attr of Array.from(node.attributes)) {
      if (attr.value.includes(needle)) hits.push(`<${node.nodeName} ${attr.name}="${attr.value.slice(0, 60)}">`);
    }
  }
  return hits;
}

describe('ERTMS library in maxGraph', () => {
  it('has 37 entries', () => {
    expect(entries.length).toBe(37);
  });

  it.each(entries.map((e, i) => [i, e.title || `#${i}`, e] as const))('renders entry %i (%s)', (_i, _title, entry) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const graph = new Graph(container);
    graph.setHtmlLabels(true);
    try {
      installDrawioCompat(graph);
      expect(() => {
        importDrawioXmlIntoModel(entryToCells(entry), graph.getDataModel());
        graph.refresh();
      }).not.toThrow();

      const cells = allCells(graph.getDataModel().getRoot()!).filter((c) => c.isVertex() || c.isEdge());
      expect(cells.length).toBeGreaterThan(0);
      for (const cell of cells) {
        const shape = graph.view.getState(cell)?.shape;
        const name = String(cell.style?.shape ?? '');
        if (name.startsWith('stencil(')) {
          expect(shape?.stencil, `stencil(...) of cell ${cell.id}`).toBeTruthy();
        }
        if (stencilFilesPresent && NAMED.includes(name)) {
          expect(shape?.stencil, `${name} of cell ${cell.id}`).toBeTruthy();
        }
      }

      expect(attributesContaining(container, 'light-dark(')).toEqual([]);
      expect(attributesContaining(container, 'stencil(')).toEqual([]);
      // Saves stay 1:1: the model keeps draw.io's values
      const styles = cells.map((c) => JSON.stringify(c.style));
      if (entry.xml!.includes('light-dark(')) expect(styles.some((s) => s.includes('light-dark('))).toBe(true);
    } finally {
      graph.destroy();
      container.remove();
    }
  });

  it.runIf(stencilFilesPresent)('registers the named stencil sets ERTMS uses', () => {
    for (const name of NAMED) expect(StencilShapeRegistry.getStencil(name), name).toBeTruthy();
  });
});
