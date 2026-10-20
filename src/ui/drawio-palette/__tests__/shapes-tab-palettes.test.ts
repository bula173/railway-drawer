/**
 * Shapes tab composition: draw.io's General and Basic palettes and the app's Basic shape group
 * are one "General" section (shapes-tab-palettes.ts), with no duplicate section titles or shapes.
 */
import { Graph } from '@maxgraph/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { loadPalette, PALETTES } from '../../../drawio-shapes/palettes';
import type { DrawioPaletteId } from '../../../drawio-shapes/palettes';
import { exportModelToDrawioXml, styleToString } from '../../../services/drawio-xml';
import { registerShapes, shapeRegistry } from '../../../shapes';
import {
  APP_BASIC_MERGE,
  APP_GROUPS_HIDDEN_KEY,
  createDrawioPaletteView,
  entrySignature,
  EXPANDED_STORAGE_KEY,
  fallbackEngine,
  MERGED_APP_GROUPS,
  mergeGeneralPalette,
  migrateMergedPaletteFlags,
  resetDrawioPaletteRenderer,
  setDrawioPaletteEngine,
  shapesTabPalettes,
  VISIBLE_STORAGE_KEY,
} from '..';
import type { PaletteDef } from '..';

const appBasic = () => MERGED_APP_GROUPS.flatMap((g) => shapeRegistry.getShapesByGroup(g));

async function loadDefs(): Promise<Partial<Record<DrawioPaletteId, PaletteDef>>> {
  const ids: DrawioPaletteId[] = ['general', 'basic', 'misc', 'advanced'];
  const defs: Partial<Record<DrawioPaletteId, PaletteDef>> = {};
  for (const id of ids) defs[id] = await loadPalette(id);
  return defs;
}

beforeAll(() => {
  registerShapes();
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = undefined;
});

afterEach(() => {
  document.body.replaceChildren();
  resetDrawioPaletteRenderer();
  setDrawioPaletteEngine(fallbackEngine);
  localStorage.clear();
});

describe('Shapes tab palette list', () => {
  it('has one General section and no Basic section, in draw.io order', () => {
    const list = shapesTabPalettes(appBasic);
    expect(list.map((p) => p.id)).toEqual(['general', 'misc', 'advanced', 'arrows2', 'flowchart', 'arrows']);
    const titles = list.map((p) => p.title);
    expect(titles.filter((t) => t === 'General')).toHaveLength(1);
    expect(titles).not.toContain('Basic');
    expect(new Set(titles).size).toBe(titles.length);
    // the draw.io data contract itself is unchanged
    expect(PALETTES.map((p) => p.id)).toContain('basic');
  });

  it('merges draw.io General, then draw.io Basic, then app shapes without a draw.io equivalent', async () => {
    const defs = await loadDefs();
    const merged = mergeGeneralPalette(defs, appBasic());
    const general = defs.general!.entries;
    const basic = defs.basic!.entries;
    expect(merged.id).toBe('general');
    expect(merged.title).toBe('General');
    expect(merged.entries.slice(0, general.length)).toEqual(general);
    expect(merged.entries.slice(general.length, general.length + basic.length)).toEqual(basic);

    const appended = merged.entries.slice(general.length + basic.length);
    expect(appended.map((e) => e.title)).toEqual(['Cross', 'Divided Rectangle', 'Chevron', 'Horizontal Line']);
    // every shape listed once; entry ids unique
    expect(new Set(merged.entries.map(entrySignature)).size).toBe(merged.entries.length);
    expect(new Set(merged.entries.map((e) => e.id)).size).toBe(merged.entries.length);

    // draw.io-native shapes are copies of the draw.io entries (style verbatim)
    const cross = appended[0];
    expect(cross.style).toBe('shape=cross;whiteSpace=wrap;html=1;');
    expect(defs.advanced!.entries.some((e) => e.style === cross.style && e.title === 'Cross')).toBe(true);
    expect(appended[3].style).toBe(defs.misc!.entries.find((e) => e.title === 'Horizontal Line')!.style);
    // app shapes with no draw.io equivalent keep the app shape
    expect(appended[1].style).toContain('shape=double-rectangle-shape');
    expect(appended[2].style).toContain('shape=chevron-shape');
  });

  it('lists each duplicate app shape only through its draw.io entry', async () => {
    const defs = await loadDefs();
    const merged = mergeGeneralPalette(defs, appBasic());
    for (const [id, merge] of Object.entries(APP_BASIC_MERGE)) {
      expect(shapeRegistry.getShape(id), id).toBeDefined();
      const source = defs[merge.palette]!.entries.filter((e) => e.style === merge.style);
      expect(source, `${id}: ${merge.style}`).toHaveLength(1);
      if (merge.kind === 'duplicate') {
        expect(merged.entries.filter((e) => e.style === merge.style)).toHaveLength(1);
        expect(merged.entries.some((e) => e.id.endsWith(`-app-${id}`))).toBe(false);
      }
    }
    // the app shape registrations stay (old files still load and render)
    expect(shapeRegistry.getShapesByGroup('Basic')).toHaveLength(18);
  });

  it('dedupes draw.io Basic entries that General already has', () => {
    const e = (id: string, style: string) => ({ id, title: id, kind: 'vertex' as const, width: 10, height: 10, style, shapeNames: [], cls: 'a' as const, source: 'x' });
    const def = (id: string, entries: ReturnType<typeof e>[]): PaletteDef => ({ id, title: id, drawioTag: 't', source: id, entries });
    const merged = mergeGeneralPalette(
      { general: def('general', [e('g1', 'a=1;'), e('g2', 'b=1;')]), basic: def('basic', [e('b1', 'b=1;'), e('b2', 'c=1;')]) },
      [],
    );
    expect(merged.entries.map((x) => x.id)).toEqual(['g1', 'g2', 'b2']);
  });

  it('inserts appended entries: draw.io style verbatim, app shapes round-trip via rdShape', async () => {
    const container = document.body.appendChild(document.createElement('div'));
    const graph = new Graph(document.body.appendChild(document.createElement('div')));
    const view = createDrawioPaletteView({ container, getGraph: () => graph, palettes: shapesTabPalettes(appBasic), userLibraries: false });
    await view.ready;
    const sections = Array.from(container.querySelectorAll<HTMLElement>('.rd-dp-category'));
    const headers = sections.map((s) => s.querySelector('.rd-dp-header-title')!.textContent);
    expect(headers.filter((t) => t === 'General')).toHaveLength(1);
    expect(headers).not.toContain('Basic');

    const cross = view.getEntry('general', 'general-app-cross')!;
    const divided = view.getEntry('general', 'general-app-double_rectangle')!;
    view.insert(cross, { x: 100, y: 100 });
    view.insert(divided, { x: 300, y: 100 });
    const [crossCell, dividedCell] = graph.getDefaultParent().children;
    expect(styleToString(crossCell.getStyle())).toBe('shape=cross;whiteSpace=wrap;html=1;');
    expect(dividedCell.getStyle().shape).toBe('double-rectangle-shape');
    const xml = exportModelToDrawioXml(graph.getDataModel());
    expect(xml).toContain('shape=cross;whiteSpace=wrap;html=1;');
    expect(xml).toMatch(/rdShape=double-rectangle-shape/);
    view.destroy();
    graph.destroy();
  });

  it('search lists a shape once across sections', async () => {
    const container = document.body.appendChild(document.createElement('div'));
    const view = createDrawioPaletteView({ container, getGraph: () => null, palettes: shapesTabPalettes(appBasic), userLibraries: false });
    await view.ready;
    view.setSearch('cross');
    await new Promise((r) => setTimeout(r, 0));
    const shown = Array.from(container.querySelectorAll<HTMLElement>('.rd-dp-category:not([hidden]) .rd-dp-item:not([hidden])'));
    const titles = shown.map((n) => n.title);
    expect(titles.filter((t) => t === 'Cross')).toHaveLength(1);
    expect(shown.find((n) => n.title === 'Cross')!.closest<HTMLElement>('section')!.dataset.paletteId).toBe('general');
    view.destroy();
  });
});

describe('migrateMergedPaletteFlags', () => {
  const visible = () => JSON.parse(localStorage.getItem(VISIBLE_STORAGE_KEY) ?? '{}') as Record<string, boolean>;
  const hidden = () => JSON.parse(localStorage.getItem(APP_GROUPS_HIDDEN_KEY) ?? '[]') as string[];

  it('does nothing without stored flags', () => {
    migrateMergedPaletteFlags();
    expect(localStorage.length).toBe(0);
  });

  it('shows General when draw.io Basic was shown although General was hidden', () => {
    localStorage.setItem(VISIBLE_STORAGE_KEY, JSON.stringify({ general: false, basic: true, misc: false }));
    migrateMergedPaletteFlags();
    expect(visible()).toEqual({ misc: false });
  });

  it('shows General when only the app Basic group was shown', () => {
    localStorage.setItem(VISIBLE_STORAGE_KEY, JSON.stringify({ general: false, basic: false }));
    migrateMergedPaletteFlags();
    expect(visible()).toEqual({});
  });

  it('hides General when General, draw.io Basic and app Basic were all hidden; idempotent', () => {
    localStorage.setItem(VISIBLE_STORAGE_KEY, JSON.stringify({ general: false, basic: false }));
    localStorage.setItem(APP_GROUPS_HIDDEN_KEY, JSON.stringify(['Basic', 'Other']));
    migrateMergedPaletteFlags();
    expect(visible()).toEqual({ general: false });
    expect(hidden()).toEqual(['Other']);
    migrateMergedPaletteFlags();
    expect(visible()).toEqual({ general: false });
  });

  it('keeps General shown when only the app Basic group was hidden', () => {
    localStorage.setItem(APP_GROUPS_HIDDEN_KEY, JSON.stringify(['Basic']));
    migrateMergedPaletteFlags();
    expect(visible()).toEqual({});
    expect(hidden()).toEqual([]);
  });

  it('expands General when Basic was expanded', () => {
    localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify({ general: false, basic: true }));
    migrateMergedPaletteFlags();
    expect(JSON.parse(localStorage.getItem(EXPANDED_STORAGE_KEY)!)).toEqual({ general: true });
  });
});
