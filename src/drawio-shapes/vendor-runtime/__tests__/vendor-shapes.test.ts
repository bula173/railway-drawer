/**
 * The vendored draw.io shape libraries (src/drawio-shapes/vendor, loaded lazily through the mxGraph
 * compatibility layer): the stencil engine loads them on demand like draw.io's
 * mxStencilRegistry.libraries, and every JS-shape and stencil vertex entry of every palette renders
 * (a registered shape of the right class with SVG content).
 */
import { CellRenderer, Graph } from '@maxgraph/core';
import { readFileSync, readdirSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { ensureStencilsForXml, installStencilEngine } from '../../engine';
import { registerDrawioJsShapes } from '../../../shapes/index';
import { parseDrawioStyle } from '../../../services/drawio-xml';
import { DRAWIO_HANDLE_FACTORIES } from '../../handles';
import { resolveDrawioShapes, vendorModuleIds } from '../loader';

const DATA = 'src/drawio-shapes/palettes/data';
const shapes = CellRenderer.defaultShapes as unknown as Record<string, new () => unknown>;

beforeAll(() => {
  registerDrawioJsShapes();
  installStencilEngine({ baseUrl: '/' });
  // stencil sets are served from public/ (the dev server does the same)
  globalThis.fetch = (async (url: string) => {
    const path = 'public/' + String(url).replace(/^\/+/, '');
    try {
      const text = readFileSync(path, 'utf8');
      return { ok: true, status: 200, text: async () => text } as Response;
    } catch {
      return { ok: false, status: 404, text: async () => '' } as Response;
    }
  }) as typeof fetch;
});

describe('vendored draw.io shape libraries', () => {
  it('has one module per upstream shape file plus the missing Shapes.js shapes', () => {
    const ids = vendorModuleIds();
    expect(ids).toContain('mxAWS4');
    expect(ids).toContain('bpmn-mxBpmnShape2');
    expect(ids).toContain('Shapes-extra');
    expect(ids).not.toContain('mxBasic');
    expect(ids.length).toBe(46);
  });

  it('resolves names and basenames like mxStencilRegistry.libraries', async () => {
    const r = await resolveDrawioShapes(['mxgraph.aws4.resourceIcon', 'umlLifeline'], ['aws4', 'cisco19']);
    expect(r.modules).toEqual(expect.arrayContaining(['mxAWS4', 'Shapes-extra', 'mxCisco19']));
    expect(r.stencilFiles).toEqual(expect.arrayContaining(['aws4.xml', 'cisco19.xml']));
  });

  it('loads a library on demand for a drawing and registers its shapes and handles', async () => {
    expect(shapes['umlLifeline']).toBeUndefined();
    const loaded = await ensureStencilsForXml(['shape=umlLifeline;perimeter=lifelinePerimeter;', 'shape=mxgraph.bpmn.task2;']);
    expect(loaded).toEqual(expect.arrayContaining(['js:Shapes-extra', 'js:bpmn-mxBpmnShape2']));
    expect(typeof shapes['umlLifeline']).toBe('function');
    expect(typeof shapes['mxgraph.bpmn.task2']).toBe('function');
    // a second call loads nothing
    expect(await ensureStencilsForXml(['shape=umlLifeline;'])).toEqual([]);
    // Graph.handleFactory entries of the module reach the handle registry
    await ensureStencilsForXml(['shape=mxgraph.electrical.transmission.twoLineCrossover;']);
    expect(Object.keys(DRAWIO_HANDLE_FACTORIES).length).toBeGreaterThan(0);
  });

  it('renders every JS-shape and stencil vertex entry of every palette', { timeout: 300_000 }, async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const graph = new Graph(container);
    const parent = graph.getDefaultParent();
    const errors: string[] = [];
    let n = 0;
    for (const f of readdirSync(DATA)) {
      if (!f.endsWith('.json') || f === 'catalogue.json') continue;
      const def = JSON.parse(readFileSync(`${DATA}/${f}`, 'utf8')) as {
        id: string;
        entries: Array<{ title: string; kind: string; cls: string; style?: string; value?: string; width: number; height: number; shapeNames: string[] }>;
      };
      for (const e of def.entries) {
        if ((e.cls !== 'c' && e.cls !== 'b') || e.kind !== 'vertex' || !e.style) continue;
        await ensureStencilsForXml([e.style]);
        const name = e.shapeNames[0];
        if (e.cls === 'c' && !shapes[name]) {
          errors.push(`${def.id}:${e.title}: ${name} not registered`);
          continue;
        }
        try {
          let cell: unknown;
          graph.batchUpdate(() => {
            cell = graph.insertVertex(parent, null, e.value ?? '', 0, 0, e.width, e.height, parseDrawioStyle(e.style!) as never);
          });
           
          const state = graph.view.getState(cell as any) as any;
          if (!state?.shape) errors.push(`${def.id}:${e.title}: no shape`);
          else if (e.cls === 'c' && !(state.shape instanceof shapes[name])) errors.push(`${def.id}:${e.title}: wrong class`);
          else if (!state.shape.node || state.shape.node.childNodes.length === 0) errors.push(`${def.id}:${e.title}: nothing drawn`);
          n++;
        } catch (err) {
          errors.push(`${def.id}:${e.title}:${name}: ${(err as Error).message}`);
        }
        graph.removeCells(graph.getChildCells(parent));
      }
    }
    expect(errors).toEqual([]);
    expect(n).toBeGreaterThan(9000);
  });
});
