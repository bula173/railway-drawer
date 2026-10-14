import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CellRenderer, RectangleShape, StencilShapeRegistry } from '@maxgraph/core';
import {
  collectShapeNames,
  ensureStencilsForXml,
  getBasenameForStencil,
  installStencilEngine,
  lookupStencil,
  parseStencilSet,
  preloadStencilSets,
  resetStencilEngineCaches,
  stencilFilesForBasename,
} from '../stencil-registry';
import { compress } from '../codec';
import { Graph } from '@maxgraph/core';

const SET_XML = `<shapes name="mxgraph.rdTest">
  <shape name="Big Box" w="40" h="20" aspect="variable" strokewidth="inherit">
    <foreground><rect x="0" y="0" w="40" h="20"/><fillstroke/></foreground>
  </shape>
  <shape name="__proto__" w="10" h="10"><foreground><rect x="0" y="0" w="10" h="10"/><stroke/></foreground></shape>
  <shape name="process" w="10" h="10"><foreground><rect x="0" y="0" w="10" h="10"/><stroke/></foreground></shape>
</shapes>`;

function parse(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'text/xml');
}

beforeAll(() => {
  installStencilEngine({ baseUrl: '/base/' });
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetStencilEngineCaches();
});

describe('stencil registry', () => {
  it('registers named stencils and resolves them case-insensitively', () => {
    const sizes: Array<[string, number, number]> = [];
    const names = parseStencilSet(parse(SET_XML), (_pkg, stencilName, _name, w, h) => sizes.push([stencilName, w, h]));
    expect(names).toContain('mxgraph.rdtest.big_box');
    expect(sizes[0]).toEqual(['Big_Box', 40, 20]);
    expect(lookupStencil('mxgraph.rdTest.Big_Box')).not.toBeNull();
    expect(StencilShapeRegistry.getStencil('MXGRAPH.RDTEST.BIG_BOX')).toBe(lookupStencil('mxgraph.rdtest.big_box'));
    expect(StencilShapeRegistry.getStencil('mxgraph.rdtest.missing')).toBeNull();
  });

  it('handles <stencils> wrappers and default sizes', () => {
    const sizes: number[] = [];
    parseStencilSet(
      parse('<stencils><shapes name="mxgraph.rdWrap"><shape name="A"><foreground/></shape></shapes></stencils>'),
      (_p, _s, _n, w, h) => sizes.push(w, h)
    );
    expect(sizes).toEqual([80, 80]);
    expect(lookupStencil('mxgraph.rdwrap.a')).not.toBeNull();
  });

  it('keeps prototype keys safe', () => {
    parseStencilSet(parse('<shapes><shape name="__proto__"><foreground/></shape></shapes>'));
    expect(Object.getPrototypeOf(StencilShapeRegistry.stencils)).toBeNull();
    expect(lookupStencil('__proto__')).not.toBeNull();
    expect(StencilShapeRegistry.getStencil('constructor')).toBeNull();
    expect(StencilShapeRegistry.getStencil('toString')).toBeNull();
    expect(({} as Record<string, unknown>).w0).toBeUndefined();
  });

  it('lets a JS shape win over a stencil with the same name', () => {
    parseStencilSet(parse('<shapes><shape name="rdJsShape"><foreground/></shape></shapes>'));
    expect(lookupStencil('rdjsshape')).not.toBeNull();
    CellRenderer.registerShape('rdjsshape', RectangleShape as unknown as Parameters<typeof CellRenderer.registerShape>[1]);
    try {
      expect(StencilShapeRegistry.getStencil('rdjsshape')).toBeNull();
    } finally {
      delete (CellRenderer.defaultShapes as Record<string, unknown>).rdjsshape;
    }
  });

  it('getBasenameForStencil follows Graph.js', () => {
    expect(getBasenameForStencil('mxgraph.mscae.enterprise.x')).toBe('mscae/enterprise');
    expect(getBasenameForStencil('mxgraph.basic.flash')).toBe('basic');
    expect(getBasenameForStencil('process')).toBeNull();
    expect(getBasenameForStencil('mxgraph')).toBeNull();
    expect(stencilFilesForBasename('arrows2')).toEqual([]);
    expect(stencilFilesForBasename('basic')).toEqual(['basic.xml']);
    expect(stencilFilesForBasename('aws3_-_x')).toEqual(['aws3_x.xml']);
  });

  it('collects shape names from XML and style lists', () => {
    const xml = '<mxCell style="html=1;shape=mxgraph.basic.flash;fillColor=red"/><mxCell style="shape=process"/>';
    expect(collectShapeNames(xml).sort()).toEqual(['mxgraph.basic.flash', 'process']);
    expect(collectShapeNames(['ellipse;shape=mxgraph.arrows.x;', 'rounded=1'])).toEqual(['mxgraph.arrows.x']);
  });

  it('preloads each stencil file once and swallows 404', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('stencils/mscae/enterprise.xml')) {
        return new Response('<shapes name="mxgraph.mscae.enterprise"><shape name="Wireless Connection"><foreground/></shape></shapes>');
      }
      return new Response('nope', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const loaded = await ensureStencilsForXml('<a style="shape=mxgraph.mscae.enterprise.wireless_connection;"/>');
    expect(loaded).toEqual(['mscae/enterprise']);
    expect(fetchMock).toHaveBeenCalledWith('/base/stencils/mscae/enterprise.xml');
    expect(StencilShapeRegistry.getStencil('mxgraph.mscae.enterprise.wireless_connection')).not.toBeNull();

    await preloadStencilSets(['mscae/enterprise', 'mscae/enterprise']);
    await expect(preloadStencilSets(['doesnotexist'])).resolves.toBeUndefined();
    await preloadStencilSets(['doesnotexist']);
    expect(fetchMock.mock.calls.filter(([u]) => u.includes('doesnotexist')).length).toBe(1);
    expect(fetchMock.mock.calls.filter(([u]) => u.includes('enterprise')).length).toBe(1);
    // Already registered: nothing to load
    expect(await ensureStencilsForXml(['shape=mxgraph.mscae.enterprise.wireless_connection'])).toEqual([]);
  });

  it('renders shape=stencil(...) and caches the decoded stencil', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const graph = new Graph(container);
    const stencil = `stencil(${compress('<shape w="10" h="10"><foreground><rect x="0" y="0" w="10" h="10"/><fillstroke/></foreground></shape>')})`;
    let a, b, bad;
    graph.batchUpdate(() => {
      const parent = graph.getDefaultParent();
      a = graph.insertVertex({ parent, position: [0, 0], size: [10, 10], style: { shape: stencil } });
      b = graph.insertVertex({ parent, position: [20, 0], size: [10, 10], style: { shape: stencil } });
      bad = graph.insertVertex({ parent, position: [40, 0], size: [10, 10], style: { shape: 'stencil(!!!notbase64)' } });
    });
    const sa = graph.view.getState(a!)!.shape!;
    const sb = graph.view.getState(b!)!.shape!;
    expect(sa.stencil).not.toBeNull();
    expect(sa.stencil).toBe(sb.stencil);
    // Undecodable stencil falls back to the default shape instead of throwing
    expect(graph.view.getState(bad!)!.shape!.stencil).toBeNull();
    graph.destroy();
    container.remove();
  });

  it('is idempotent', () => {
    const createShape = CellRenderer.prototype.createShape;
    const getStencil = StencilShapeRegistry.getStencil;
    installStencilEngine();
    installStencilEngine({ baseUrl: '/base/' });
    expect(CellRenderer.prototype.createShape).toBe(createShape);
    expect(StencilShapeRegistry.getStencil).toBe(getStencil);
  });
});
