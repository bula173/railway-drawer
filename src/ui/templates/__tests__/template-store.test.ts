/**
 * TemplateStore: save/rename/delete, persistence across instances, versioning, quota errors and
 * the draw.io library (<mxlibrary>) export/import round trip.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseMxLibrary } from '../../../drawio-shapes/engine';
import { fallbackParseMxLibrary } from '../../drawio-palette';
import { TemplateStorageError, TemplateStore, TEMPLATES_STORAGE_KEY, TEMPLATES_STORAGE_VERSION } from '..';

const XML =
  '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
  '<mxCell id="2" value="S1 &amp; &lt;BG&gt;" style="shape=mxgraph.basic.flash;html=1;" vertex="1" parent="1">' +
  '<mxGeometry x="0" y="0" width="40" height="20" as="geometry"/></mxCell></root></mxGraphModel>';

afterEach(() => localStorage.clear());

function quotaStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    removeItem: (k: string) => void data.delete(k),
    setItem: () => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    },
  };
}

describe('TemplateStore', () => {
  it('saves, renames and deletes templates and persists them across instances', () => {
    const store = new TemplateStore(localStorage);
    const listener = vi.fn();
    store.subscribe(listener);
    const t = store.add({ name: '  Station   A ', description: 'two points', xml: XML, width: 40, height: 20 });
    expect(t.name).toBe('Station A');
    expect(t.builtIn).toBe(false);
    expect(t.id).toMatch(/^tpl-/);
    expect(listener).toHaveBeenCalledTimes(1);

    const raw = JSON.parse(localStorage.getItem(TEMPLATES_STORAGE_KEY)!);
    expect(raw.version).toBe(TEMPLATES_STORAGE_VERSION);
    expect(raw.templates[0]).toMatchObject({ id: t.id, name: 'Station A', description: 'two points', xml: XML, width: 40, height: 20 });

    // a new instance (page reload) reads them back
    const reloaded = new TemplateStore(localStorage);
    expect(reloaded.list().map((x) => x.name)).toEqual(['Station A']);
    expect(reloaded.get(t.id)?.xml).toBe(XML);

    reloaded.rename(t.id, 'Station B');
    expect(new TemplateStore(localStorage).get(t.id)).toMatchObject({ name: 'Station B', description: 'two points' });
    reloaded.rename(t.id, 'Station B', '');
    expect(new TemplateStore(localStorage).get(t.id)?.description).toBeUndefined();

    reloaded.remove(t.id);
    expect(new TemplateStore(localStorage).list()).toEqual([]);
  });

  it('rejects empty names', () => {
    const store = new TemplateStore(localStorage);
    expect(() => store.add({ name: '   ', xml: XML, width: 1, height: 1 })).toThrow(/empty/);
    const t = store.add({ name: 'A', xml: XML, width: 1, height: 1 });
    expect(() => store.rename(t.id, '')).toThrow(/empty/);
    expect(store.get(t.id)?.name).toBe('A');
  });

  it('a quota error is reported and leaves the templates unchanged', () => {
    const store = new TemplateStore(quotaStorage());
    let error: unknown;
    try {
      store.add({ name: 'Big', xml: XML, width: 1, height: 1 });
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(TemplateStorageError);
    expect((error as TemplateStorageError).quota).toBe(true);
    expect((error as Error).message).toMatch(/storage is full/);
    expect(store.list()).toEqual([]);
  });

  it('rolls back a failed rename', () => {
    const store = new TemplateStore(localStorage);
    const t = store.add({ name: 'A', xml: XML, width: 1, height: 1 });
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    try {
      expect(() => store.rename(t.id, 'B')).toThrow(TemplateStorageError);
    } finally {
      spy.mockRestore();
    }
    expect(store.get(t.id)?.name).toBe('A');
  });

  it('reads unversioned arrays, and leaves data of a newer version untouched', () => {
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify([{ id: 'tpl-old', name: 'Old', xml: XML, width: 10, height: 10 }, { bad: 1 }]));
    expect(new TemplateStore(localStorage).list().map((t) => t.id)).toEqual(['tpl-old']);

    const future = JSON.stringify({ version: TEMPLATES_STORAGE_VERSION + 1, templates: [{ id: 'x', name: 'X', xml: XML }] });
    localStorage.setItem(TEMPLATES_STORAGE_KEY, future);
    const store = new TemplateStore(localStorage);
    expect(store.list()).toEqual([]);
    expect(store.loadWarning).toMatch(/newer version/);
    expect(() => store.add({ name: 'New', xml: XML, width: 1, height: 1 })).toThrow(TemplateStorageError);
    expect(localStorage.getItem(TEMPLATES_STORAGE_KEY)).toBe(future);

    localStorage.setItem(TEMPLATES_STORAGE_KEY, '{not json');
    const broken = new TemplateStore(localStorage);
    expect(broken.list()).toEqual([]);
    expect(broken.loadWarning).toMatch(/could not be read/);
  });

  it('exports a draw.io library and imports it back (real and fallback parser)', () => {
    const store = new TemplateStore(localStorage);
    store.add({ name: 'Layout <1>', description: 'with "quotes" & ampersand', xml: XML, width: 40, height: 20 });
    store.add({ name: 'Layout 2', xml: XML.replace('S1', 'S2'), width: 50, height: 30 });
    const text = store.exportLibrary();
    expect(text.startsWith('<mxlibrary>[')).toBe(true);
    expect(text.endsWith(']</mxlibrary>')).toBe(true);
    // well-formed XML whose text is the JSON draw.io expects
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    const json = JSON.parse(doc.documentElement.textContent!);
    expect(json[0]).toMatchObject({ xml: XML, w: 40, h: 20, title: 'Layout <1>' });

    for (const parse of [parseMxLibrary, fallbackParseMxLibrary]) {
      localStorage.removeItem(TEMPLATES_STORAGE_KEY);
      const other = new TemplateStore(localStorage);
      const added = other.importLibrary(text, parse);
      expect(added.map((t) => t.name)).toEqual(['Layout <1>', 'Layout 2']);
      expect(added[0]).toMatchObject({ xml: XML, width: 40, height: 20, description: 'with "quotes" & ampersand' });
      expect(added[1].xml).toContain('S2');
      expect(new TemplateStore(localStorage).list()).toHaveLength(2);
      expect(other.exportLibrary()).toBe(text);
    }
  });

  it('imports untitled and image entries, and rejects libraries without shapes', () => {
    const store = new TemplateStore(localStorage);
    const lib = `<mxlibrary>${JSON.stringify([
      { xml: XML, w: 10, h: 10 },
      { data: 'data:image/png;base64,AAAA', w: 20, h: 20, title: 'Logo' },
    ])
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')}</mxlibrary>`;
    const added = store.importLibrary(lib, parseMxLibrary, 'Stations');
    expect(added.map((t) => t.name)).toEqual(['Stations 1', 'Logo']);
    expect(added[1].xml).toContain('shape=image');
    expect(added[1].xml).toContain('image=data:image/png,AAAA');
    expect(() => store.importLibrary('<mxlibrary>[]</mxlibrary>', parseMxLibrary)).toThrow(/no shapes/);
    expect(() => store.importLibrary('<nope/>', parseMxLibrary)).toThrow();
    expect(store.list()).toHaveLength(2);
  });
});
