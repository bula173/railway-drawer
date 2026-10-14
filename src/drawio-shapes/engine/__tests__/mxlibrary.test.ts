import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { GraphDataModel } from '@maxgraph/core';
import { entryToCells, loadMxLibraryFromFile, loadMxLibraryFromUrl, parseMxLibrary } from '../mxlibrary';
import { compress } from '../codec';
import { importDrawioXmlIntoModel } from '../../../services/drawio-xml';

const ERTMS_PATH = path.resolve(__dirname, '../../../../public/libraries/ertms.xml');
const MODEL =
  '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
  '<mxCell id="2" value="Box" style="rounded=1;fillColor=light-dark(#fff, #000);" vertex="1" parent="1">' +
  '<mxGeometry width="40" height="20" as="geometry"/></mxCell></root></mxGraphModel>';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

afterEach(() => vi.unstubAllGlobals());

describe('parseMxLibrary', () => {
  it('reads public/libraries/ertms.xml (40 entries)', () => {
    const entries = parseMxLibrary(fs.readFileSync(ERTMS_PATH, 'utf8'));
    expect(entries.length).toBe(40);
    for (const e of entries) {
      expect(e.xml?.startsWith('<mxGraphModel')).toBe(true);
      expect(e.w).toBeGreaterThan(0);
      expect(e.h).toBeGreaterThan(0);
    }
    expect(entries.filter((e) => e.xml!.includes('shape=stencil(')).length).toBe(26);
  });

  it('decodes base64-deflate entries (draw.io compressed and our compress)', () => {
    const drawioCompressed = zlib
      .deflateRawSync(Buffer.from(encodeURIComponent(MODEL), 'latin1'))
      .toString('base64');
    const lib = `<mxlibrary>${JSON.stringify([
      { xml: drawioCompressed, w: 40, h: 20, title: 'Compressed' },
      { xml: compress(MODEL), w: 40, h: 20, aspect: 'fixed' },
      { xml: '%%%not-a-library-entry', w: 1, h: 1 },
    ])}</mxlibrary>`;
    const entries = parseMxLibrary(lib);
    expect(entries.length).toBe(2);
    expect(entries[0]).toMatchObject({ title: 'Compressed', w: 40, h: 20, xml: MODEL });
    expect(entries[1]).toMatchObject({ title: '', aspect: 'fixed', xml: MODEL });
  });

  it('reads data (image) entries and turns them into an image cell', () => {
    const entries = parseMxLibrary(JSON.stringify([{ data: PNG, w: 16, h: 16, title: 'Pixel' }]));
    expect(entries).toEqual([{ title: 'Pixel', w: 16, h: 16, data: PNG }]);
    const xml = entryToCells(entries[0]);
    expect(xml).toContain('shape=image;');
    expect(xml).toContain('image=data:image/png,iVBOR');
    const model = new GraphDataModel();
    importDrawioXmlIntoModel(xml, model);
    const cell = model.getCell('2')!;
    expect(cell.isVertex()).toBe(true);
    expect(cell.getGeometry()!.width).toBe(16);
    expect(cell.style.shape).toBe('image');
  });

  it('accepts bare JSON arrays with entity-escaped xml and fills in missing sizes', () => {
    const escaped = MODEL.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const entries = parseMxLibrary(JSON.stringify([{ xml: escaped }]));
    expect(entries[0].xml).toBe(MODEL);
    expect(entries[0].w).toBe(80);
  });

  it('throws on files that are not libraries', () => {
    expect(() => parseMxLibrary('<mxfile/>')).toThrow(/mxlibrary/);
    expect(() => parseMxLibrary('<mxlibrary>{"a":1}</mxlibrary>')).toThrow(/array/);
    expect(() => parseMxLibrary('<mxlibrary>[oops</mxlibrary>')).toThrow(/JSON/);
  });
});

describe('entryToCells / loaders', () => {
  it('wraps <root> content and passes models through', () => {
    expect(entryToCells({ title: '', w: 1, h: 1, xml: MODEL })).toBe(MODEL);
    expect(entryToCells({ title: '', w: 1, h: 1, xml: '<root><mxCell id="0"/></root>' })).toBe(
      '<mxGraphModel><root><mxCell id="0"/></root></mxGraphModel>'
    );
  });

  it('loads from a URL and from a File', async () => {
    const text = fs.readFileSync(ERTMS_PATH, 'utf8');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(text)));
    expect((await loadMxLibraryFromUrl('/libraries/ertms.xml')).length).toBe(40);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
    await expect(loadMxLibraryFromUrl('/missing.xml')).rejects.toThrow(/404/);
    const body = JSON.stringify([{ xml: MODEL, w: 40, h: 20 }]).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const file = new File([`<mxlibrary>${body}</mxlibrary>`], 'lib.xml');
    expect((await loadMxLibraryFromFile(file))[0].xml).toBe(MODEL);
  });
});
