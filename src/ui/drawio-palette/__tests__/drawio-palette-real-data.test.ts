/**
 * The palette UI against the real palette data and stencil engine (src/drawio-shapes),
 * including the ERTMS library from public/libraries/ertms.xml.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Graph } from '@maxgraph/core';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as engineModule from '../../../drawio-shapes/engine';
import { loadPalette, PALETTES } from '../../../drawio-shapes/palettes';
import { styleToString } from '../../../services/drawio-xml';
import {
  createDrawioPaletteView,
  ertmsPaletteSource,
  fallbackEngine,
  renderEntryForParity,
  resetDrawioPaletteRenderer,
  resetErtmsLibraryCache,
  setDrawioPaletteEngine,
} from '..';
import type { PaletteEngine } from '..';

const ROOT = resolve(__dirname, '../../../..');

const realEngine: PaletteEngine = {
  ensureStencilsForXml: (x) => engineModule.ensureStencilsForXml(x),
  installDrawioCompat: (g) => engineModule.installDrawioCompat(g),
  parseMxLibrary: (t) => engineModule.parseMxLibrary(t),
};

beforeAll(() => {
  const proto = (globalThis as any).SVGElement.prototype;
  if (!proto.getBBox) proto.getBBox = () => ({ x: 0, y: 0, width: 20, height: 10 });
  // Serve public/ for the ERTMS library and stencil files
  vi.stubGlobal('fetch', async (url: string) => {
    const path = resolve(ROOT, 'public', String(url).replace(/^\/+/, ''));
    try {
      const text = readFileSync(path, 'utf8');
      return { ok: true, status: 200, text: async () => text } as Response;
    } catch {
      return { ok: false, status: 404, text: async () => '' } as Response;
    }
  });
  (globalThis as any).IntersectionObserver = undefined;
  engineModule.installStencilEngine({ baseUrl: '/' });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  resetErtmsLibraryCache();
  document.body.replaceChildren();
  resetDrawioPaletteRenderer();
  setDrawioPaletteEngine(fallbackEngine);
  localStorage.clear();
});

describe('drawio palette with the real data', () => {
  it('shows the draw.io palettes and ERTMS, and inserts real entries', { timeout: 30000 }, async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const graph = new Graph(document.body.appendChild(document.createElement('div')));
    const view = createDrawioPaletteView({
      container,
      getGraph: () => graph,
      palettes: PALETTES.map((meta) => ({ ...meta, load: () => loadPalette(meta.id) })),
      extraLibraries: [ertmsPaletteSource('/')],
      engine: realEngine,
    });
    await view.ready;

    const ids = Array.from(container.querySelectorAll<HTMLElement>('.rd-dp-category:not(.rd-dp-catalogue)')).map((s) => s.dataset.paletteId);
    expect(ids).toEqual(['general', 'misc', 'advanced', 'basic', 'arrows2', 'flowchart', 'arrows', 'ertms']);
    expect(view.isPaletteVisible('arrows')).toBe(false);

    const general = await loadPalette('general');
    const items = container.querySelectorAll('[data-palette-id="general"] .rd-dp-item');
    expect(items.length).toBe(general.entries.length);

    // only the 18 simple ERTMS elements; the 22 scenario diagrams are templates (Templates tab)
    const ertmsItems = container.querySelectorAll('[data-palette-id="ertms"] .rd-dp-item');
    expect(ertmsItems.length).toBe(18);

    // a vertex entry keeps draw.io's style string
    const rect = general.entries.find((e) => e.kind === 'vertex' && e.style)!;
    view.insert(rect, { x: 200, y: 200 });
    const [cell] = graph.getDefaultParent().children;
    expect(styleToString(cell.getStyle())).toBe(rect.style);

    // an ERTMS tile inserts its cells with their stencil(...) styles
    const ertmsEntry = view.getEntry('ertms', (ertmsItems[0] as HTMLElement).dataset.entryId!)!;
    view.insert(ertmsEntry, { x: 400, y: 400 });
    const styles = graph.getDefaultParent().children.slice(1).map((c) => styleToString(c.getStyle()));
    expect(styles.length).toBeGreaterThan(0);
    expect(ertmsEntry.xml).toBeTruthy();

    // every visible tile gets a rendered thumbnail
    const thumbs = Array.from(container.querySelectorAll<HTMLElement>('.rd-dp-category:not([hidden]) .rd-dp-thumb'));
    await vi.waitFor(
      () => {
        const done = thumbs.filter((t) => t.classList.contains('rd-dp-thumb-ready') || t.classList.contains('rd-dp-thumb-error'));
        expect(done.length).toBe(thumbs.length);
      },
      { timeout: 20000 }
    );
    const failed = thumbs.filter((t) => t.classList.contains('rd-dp-thumb-error'));
    expect(failed.map((t) => (t.parentElement as HTMLElement).dataset.entryId)).toEqual([]);
    view.destroy();
    graph.destroy();
  });

  it('renders an ERTMS stencil(...) entry to SVG', async () => {
    setDrawioPaletteEngine(realEngine);
    const def = await ertmsPaletteSource('/').load();
    const stencilEntry = def.entries.find((e) => e.shapeNames.some((n) => n.startsWith('stencil(')))!;
    expect(stencilEntry).toBeDefined();
    const svg = await renderEntryForParity(stencilEntry, 1);
    expect(svg.querySelectorAll('path, rect, ellipse').length).toBeGreaterThan(0);
  });
});
