import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildDrawioConfig,
  loadErtmsLibrary,
  parseMxLibrary,
  resetErtmsLibraryCache,
  withSearchTags,
} from '../ertmsLibrary';
// Vite ?raw import: no Node typings needed (tsconfig.test.json has no @types/node).
import ertmsLibraryXml from '../../../public/libraries/ertms.xml?raw';

const FIXTURE =
  '<mxlibrary>[{"xml":"&lt;mxGraphModel&gt;&lt;root/&gt;&lt;/mxGraphModel&gt;","w":10,"h":10}]</mxlibrary>';

afterEach(() => {
  resetErtmsLibraryCache();
  vi.unstubAllGlobals();
});

describe('parseMxLibrary', () => {
  it('decodes entity-escaped item xml', () => {
    const items = parseMxLibrary(FIXTURE);
    expect(items).toHaveLength(1);
    expect(items[0].xml.startsWith('<mxGraphModel')).toBe(true);
    expect(items[0]).toMatchObject({ w: 10, h: 10 });
  });

  it('throws for a non-mxlibrary root', () => {
    expect(() => parseMxLibrary('<mxfile>[]</mxfile>')).toThrow(/mxlibrary/);
  });

  it('throws for malformed JSON', () => {
    expect(() => parseMxLibrary('<mxlibrary>[{"xml":</mxlibrary>')).toThrow(/JSON/);
  });

  it('throws for an item without xml', () => {
    expect(() => parseMxLibrary('<mxlibrary>[{"w":10,"h":10}]</mxlibrary>')).toThrow(/xml/);
  });

  it('throws for an item with invalid size', () => {
    expect(() =>
      parseMxLibrary('<mxlibrary>[{"xml":"&lt;mxGraphModel/&gt;","w":"10","h":10}]</mxlibrary>')
    ).toThrow(/w\/h/);
  });
});

describe('withSearchTags', () => {
  it('adds item-level tags including the title', () => {
    const tagged = withSearchTags(
      [
        { xml: '<a/>', w: 1, h: 1, title: 'Signal' },
        { xml: '<b/>', w: 1, h: 1 },
      ],
      'ertms etcs'
    );
    expect(tagged[0].tags).toBe('ertms etcs Signal');
    expect(tagged[1].tags).toBe('ertms etcs');
  });
});

describe('real ERTMS library asset (regression guard on public/libraries/ertms.xml)', () => {
  const text = ertmsLibraryXml;
  const items = parseMxLibrary(text);

  it('has 40 decoded items', () => {
    expect(items).toHaveLength(40);
    expect(items.every((item) => item.xml.startsWith('<'))).toBe(true);
  });

  it('keeps stencil shapes and light-dark colours', () => {
    expect(items.filter((item) => item.xml.includes('stencil(')).length).toBe(26);
    expect(items.filter((item) => item.xml.includes('light-dark(')).length).toBe(33);
  });
});

describe('loadErtmsLibrary', () => {
  it('fetches relative to the base URL, tags items and memoizes', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(FIXTURE, { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    const items = await loadErtmsLibrary('/railway-drawer/');
    await loadErtmsLibrary('/railway-drawer/');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/railway-drawer/libraries/ertms.xml');
    expect(items[0].tags).toContain('ertms');
  });

  it('rejects on HTTP errors and allows a retry', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response('nope', { status: 404 })));
    vi.stubGlobal('fetch', fetchMock);
    await expect(loadErtmsLibrary('/')).rejects.toThrow(/404/);
    await expect(loadErtmsLibrary('/')).rejects.toThrow(/404/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('buildDrawioConfig', () => {
  it('configures the ERTMS library inline as data', () => {
    const config = buildDrawioConfig([{ xml: '<a/>', w: 1, h: 1 }]);
    expect(config.compressXml).toBe(false);
    expect(config.version).toBeTruthy();
    expect(config.defaultLibraries).toBe('general;ertms');
    expect(config.enableCustomLibraries).toBe(false);
    expect(config.enabledLibraries).toBeUndefined();
    const lib = config.libraries?.[0].entries[0].libs[0];
    expect(lib && 'data' in lib ? lib.data : null).toHaveLength(1);
  });

  it('has no libraries for null', () => {
    const config = buildDrawioConfig(null);
    expect(config.libraries).toBeUndefined();
    expect(config.compressXml).toBe(false);
  });
});
