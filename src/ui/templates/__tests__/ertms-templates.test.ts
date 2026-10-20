/**
 * Classification of the real ERTMS library (public/libraries/ertms.xml) into palette elements and
 * built-in templates, and the ERTMS palette / template sources built on it.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { parseMxLibrary } from '../../../drawio-shapes/engine';
import {
  ertmsPaletteSource,
  fallbackEngine,
  loadErtmsTemplates,
  resetErtmsLibraryCache,
  setDrawioPaletteEngine,
} from '../../drawio-palette';
import { countDrawableCells, isTemplateLibraryEntry, modelLabels, splitErtmsLibrary, TEMPLATE_CELL_THRESHOLD } from '..';

const ROOT = resolve(__dirname, '../../../..');
const LIBRARY_TEXT = readFileSync(resolve(ROOT, 'public/libraries/ertms.xml'), 'utf8');
const entries = parseMxLibrary(LIBRARY_TEXT);

describe('ERTMS library classification', () => {
  it('splits the 40 entries into 18 elements and 22 templates', () => {
    expect(entries).toHaveLength(40);
    const { elements, templates } = splitErtmsLibrary(entries);
    expect(elements).toHaveLength(18);
    expect(templates).toHaveLength(22);
    // every titled entry is a simple element, every untitled one a scenario
    expect(elements.every((e) => e.entry.title.trim() !== '')).toBe(true);
    expect(templates.every((t) => entries[Number(t.id.replace('ertms-tpl-', ''))].title.trim() === '')).toBe(true);
  });

  it('has a wide margin around the cell-count threshold', () => {
    const counts = entries.map((e) => countDrawableCells(e.xml ?? ''));
    const simple = counts.filter((n) => n <= TEMPLATE_CELL_THRESHOLD);
    const complex = counts.filter((n) => n > TEMPLATE_CELL_THRESHOLD);
    expect(Math.max(...simple)).toBeLessThanOrEqual(TEMPLATE_CELL_THRESHOLD / 2 + 10);
    expect(Math.min(...complex)).toBeGreaterThanOrEqual(TEMPLATE_CELL_THRESHOLD + 20);
    expect(entries.filter(isTemplateLibraryEntry)).toHaveLength(22);
  });

  it('names templates after their ERTMS topic, keeps "ERTMS scenario n" and a subtitle of distinctive labels', () => {
    const { templates } = splitErtmsLibrary(entries);
    expect(templates.map((t) => t.originalName)).toEqual(templates.map((_t, i) => `ERTMS scenario ${i + 1}`));
    expect(templates.slice(0, 5).map((t) => t.name)).toEqual([
      'Section timer (L1)',
      'MA length and speed',
      'Level transition L0 → L1',
      'Level transition L0 → L1, shortened route',
      'Level transition L1 → L2',
    ]);
    expect(new Set(templates.map((t) => t.name)).size).toBe(templates.length);
    expect(templates.every((t) => !/^ERTMS scenario/.test(t.name))).toBe(true);
    expect(templates[0].tags).toContain('ertms scenario 1');
    for (const t of templates) {
      expect(t.builtIn).toBe(true);
      expect(t.description, t.name).toBeTruthy();
      const parts = t.description!.split(', ');
      expect(parts.length).toBeGreaterThanOrEqual(1);
      expect(parts.length).toBeLessThanOrEqual(3);
      const labels = modelLabels(t.xml);
      for (const part of parts) expect(labels).toContain(part);
      expect(t.tags).toContain('ertms');
      expect(t.tags).toContain('template');
      for (const part of parts) expect(t.tags).toContain(part.toLowerCase());
      expect(t.xml.startsWith('<mxGraphModel')).toBe(true);
      expect(t.width).toBeGreaterThan(100);
    }
    // labels used by a single scenario come first (e.g. "Entrance Route" only in scenario 3)
    expect(templates[2].description).toContain('Entrance Route');
  });

  it('strips HTML and whitespace from labels', () => {
    const xml =
      '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
      '<mxCell id="2" value="&lt;b&gt;BG&amp;nbsp;4&lt;/b&gt;" vertex="1" parent="1"/>' +
      '<UserObject id="3" label="  S2_Exit "><mxCell vertex="1" parent="1"/></UserObject>' +
      '<mxCell id="4" value="" edge="1" parent="1"/></root></mxGraphModel>';
    expect(modelLabels(xml)).toEqual(['BG 4', 'S2_Exit']);
    expect(countDrawableCells(xml)).toBe(3);
  });
});

describe('ERTMS sources', () => {
  const fetchMock = vi.fn(async (url: string) => {
    const path = resolve(ROOT, 'public', String(url).replace(/^\/+/, ''));
    try {
      const text = readFileSync(path, 'utf8');
      return { ok: true, status: 200, text: async () => text } as Response;
    } catch {
      return { ok: false, status: 404, text: async () => '' } as Response;
    }
  });
  beforeAll(() => {
    vi.stubGlobal('fetch', fetchMock);
    setDrawioPaletteEngine({ ...fallbackEngine, parseMxLibrary });
  });
  afterEach(() => resetErtmsLibraryCache());
  afterAll(() => {
    vi.unstubAllGlobals();
    setDrawioPaletteEngine(fallbackEngine);
  });

  it('the ERTMS palette shows only the 18 elements and keeps the library-index ids', async () => {
    const def = await ertmsPaletteSource('/').load();
    expect(def.entries).toHaveLength(18);
    expect(def.entries.map((e) => e.title)).toContain('Signal Left 3');
    expect(def.entries.map((e) => e.title)).toContain('Train Connected');
    for (const e of def.entries) expect(e.id).toMatch(/^ertms-(\d|1[0-7])-/);
  });

  it('loadErtmsTemplates returns the 22 scenarios, sharing one download with the palette', async () => {
    fetchMock.mockClear();
    const [templates] = await Promise.all([loadErtmsTemplates('/'), ertmsPaletteSource('/').load()]);
    expect(templates).toHaveLength(22);
    expect(templates[0].id).toBe('ertms-tpl-18');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
