/**
 * @file dark-shapes.spec.ts
 * @brief Diagram shapes in the dark theme: the rendered SVG colours of representative cells (ERTMS
 *        signal, balise, track, point, text, a default rectangle, stencils with an explicit black
 *        stroke, an inline stencil with its own black colour, an HTML label in dark grey) and of the
 *        palette / template thumbnails must contrast with what they are drawn on: strokes >= 3:1,
 *        text >= 4.5:1 (WCAG). Selection feedback likewise. Only the rendering changes: the saved
 *        .drawio file and the PNG export are identical in the light and the dark theme.
 *
 * Contrast is measured on the rendered SVG (stroke attributes, computed text colours), against the
 * canvas (#121212) for cells and the thumbnail's effective background for thumbnails.
 * Screenshots: test-results/dark-shapes/*.png. Any port (no draw.io server is involved).
 */
import { mkdir } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import type { Download, Page } from '@playwright/test';
import { clickMenuItem, openLeftTab } from './menu-helpers';

type Theme = 'light' | 'dark';

const SHOT_DIR = 'test-results/dark-shapes';
const CANVAS = '#121212';
const PALETTE = '#drawio-palette-container';
/** The railway libraries after ERTMS (ERTMS/ETCS extra, Polish signalling, Track layout). */
const RAILWAY_SECTIONS = ['etcs-extra', 'rail-pl', 'track-layout'];

interface Colours {
  strokes: string[];
  texts: string[];
}

interface ThumbReport extends Colours {
  title: string;
  background: string;
}

async function openApp(page: Page, theme: Theme): Promise<void> {
  await page.emulateMedia({ colorScheme: theme === 'dark' ? 'light' : 'dark' });
  await page.goto('/');
  await page.evaluate((t) => {
    localStorage.clear();
    localStorage.setItem('rd.theme', t);
  }, theme);
  await page.reload();
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await page.locator(`${PALETTE} section[data-palette-id="general"] .rd-dp-item[title="Rectangle"]`).waitFor();
}

/** Runs `body` with `graph` = the active tab's graph and `arg`. */
async function inGraph<T>(page: Page, body: string, arg?: unknown): Promise<T> {
  return page.evaluate(async ({ body, arg }) => {
    const registry = await import('/src/services/service-registry.ts' as string);
    const tab = registry.ServiceRegistry.getTabManager().getActiveTab();
    return new Function('graph', 'tab', 'arg', body)(tab.graph, tab, arg);
  }, { body, arg }) as Promise<T>;
}

async function expandSection(page: Page, id: string): Promise<void> {
  const header = page.locator(`${PALETTE} section[data-palette-id="${id}"] .rd-dp-header`);
  if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click();
}

async function insertFromPalette(page: Page, palette: string, title: string): Promise<string> {
  await inGraph(page, 'graph.clearSelection();');
  await expandSection(page, palette);
  const item = page.locator(`${PALETTE} section[data-palette-id="${palette}"] .rd-dp-item[title="${title}"]`).first();
  await item.scrollIntoViewIfNeeded();
  await item.click();
  await expect.poll(() => inGraph<number>(page, 'return graph.getSelectionCount();')).toBe(1);
  return inGraph<string>(page, 'return graph.getSelectionCell().id;');
}

async function menu(page: Page, menuName: string, action: string): Promise<void> {
  await clickMenuItem(page, menuName, action);
}

async function readDownload(download: Download): Promise<Buffer> {
  return (await download.createReadStream()).toArray().then((chunks) => Buffer.concat(chunks));
}

/** WCAG contrast of two CSS colours, computed in the page (canvas-normalized). */
function contrastIn(page: Page, pairs: Array<[string, string]>): Promise<number[]> {
  return page.evaluate((pairs) => {
    const ctx = document.createElement('canvas').getContext('2d')!;
    const rgb = (v: string): number[] => {
      ctx.fillStyle = '#000000';
      ctx.fillStyle = v;
      const f = ctx.fillStyle;
      if (f.startsWith('#')) return [1, 3, 5].map((i) => parseInt(f.slice(i, i + 2), 16));
      return (/rgba?\(([^)]+)\)/.exec(f)?.[1] ?? '0,0,0').split(',').map((x) => parseFloat(x));
    };
    const lum = (c: number[]): number => {
      const ch = (v: number) => {
        const s = v / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2]);
    };
    return pairs.map(([a, b]) => {
      const la = lum(rgb(a));
      const lb = lum(rgb(b));
      return Math.round(((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)) * 100) / 100;
    });
  }, pairs);
}

/**
 * In the page: visible stroke colours and text colours below each element matching `selector`
 * (label text: computed `color` of HTML labels, `fill` of SVG text), with the effective background.
 */
function collectColours(page: Page, selector: string, tag?: Record<string, string>): Promise<ThumbReport[]> {
  return page.evaluate(async ({ selector, tag }) => {
    if (tag) {
      // tag every cell's shape and label node right before reading (a repaint replaces the nodes)
      const registry = await import('/src/services/service-registry.ts' as string);
      const graph = registry.ServiceRegistry.getTabManager().getActiveTab().graph;
      for (const [key, id] of Object.entries(tag)) {
        const cell = graph.getDataModel().getCell(id);
        [cell, ...(cell.children ?? [])].forEach((c: unknown, i: number) => {
          const st = graph.view.getState(c);
          st?.shape?.node?.setAttribute('data-dks', `${key}#${i}`);
          st?.text?.node?.setAttribute('data-dks', `${key}#${i} label`);
        });
      }
    }
    const ctx = document.createElement('canvas').getContext('2d')!;
    const norm = (v: string | null): string | null => {
      if (!v || v === 'none' || v === 'transparent' || v.startsWith('url(')) return null;
      ctx.fillStyle = '#010203';
      ctx.fillStyle = v;
      const f = ctx.fillStyle;
      if (f === '#010203' && v.toLowerCase() !== '#010203') return null;
      if (/rgba\([^)]*,\s*0\)$/.test(f)) return null;
      return f;
    };
    const opaqueBg = (el: Element): string => {
      for (let n: Element | null = el; n; n = n.parentElement) {
        const bg = getComputedStyle(n).backgroundColor;
        const m = /rgba?\(([^)]+)\)/.exec(bg);
        if (m) {
          const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
          if (p.length < 4 || p[3] >= 1) return bg;
        }
      }
      return '#ffffff';
    };
    const hidden = (el: Element): boolean => {
      for (let n: Element | null = el; n && n.nodeName.toLowerCase() !== 'body'; n = n.parentElement) {
        if (n.getAttribute('visibility') === 'hidden' || n.closest('defs')) return true;
        const cs = getComputedStyle(n);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return true;
        if (n.getAttribute('opacity') === '0' || n.getAttribute('stroke-opacity') === '0') return true;
      }
      return false;
    };
    return Array.from(document.querySelectorAll(selector)).map((root) => {
      const strokes = new Set<string>();
      const texts = new Set<string>();
      for (const el of Array.from(root.querySelectorAll('*'))) {
        if (hidden(el)) continue;
        const sw = el.getAttribute('stroke-width');
        const stroke = norm(el.getAttribute('stroke'));
        if (stroke && (sw === null || parseFloat(sw) > 0)) strokes.add(stroke);
        const hasText = Array.from(el.childNodes).some((c) => c.nodeType === 3 && (c.textContent ?? '').trim());
        if (hasText) {
          const c = el instanceof SVGElement ? norm(el.getAttribute('fill') ?? getComputedStyle(el).fill) : norm(getComputedStyle(el).color);
          if (c) texts.add(c);
        }
      }
      const title = root.closest('[title]')?.getAttribute('title') ?? root.getAttribute('data-dks') ?? '';
      return { title, background: opaqueBg(root), strokes: [...strokes], texts: [...texts] };
    });
  }, { selector, tag });
}

/** Contrast offenders of reports: strokes < 3, text < 4.5 against `background` (or the report's own). */
async function offenders(page: Page, reports: ThumbReport[], background?: string): Promise<string[]> {
  const pairs: Array<[string, string]> = [];
  const meta: string[] = [];
  for (const r of reports) {
    const bg = background ?? r.background;
    for (const s of r.strokes) {
      pairs.push([s, bg]);
      meta.push(`${r.title} | stroke ${s} on ${bg}`);
    }
    for (const t of r.texts) {
      pairs.push([t, bg]);
      meta.push(`${r.title} | text ${t} on ${bg}`);
    }
  }
  const ratios = await contrastIn(page, pairs);
  return meta
    .map((m, i) => ({ m, r: ratios[i], min: m.includes('| text ') ? 4.5 : 3 }))
    .filter((x) => x.r < x.min)
    .map((x) => `${x.m} = ${x.r} (< ${x.min})`);
}

/** An inline stencil whose own XML paints a black outline and a white fill. */
const LITERAL_STENCIL_XML =
  '<shape name="literal" w="40" h="40" aspect="variable" strokewidth="inherit"><foreground>' +
  '<strokecolor color="#000000"/><fillcolor color="#ffffff"/><rect x="0" y="0" w="40" h="40"/><fillstroke/>' +
  '<path><move x="0" y="0"/><line x="40" y="40"/></path><stroke/></foreground></shape>';

/** Model for the "file / export unchanged" test: ERTMS-like light-dark() strokes, black / grey colours. */
const MODEL_XML = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
<mxCell id="R" value="Signal box" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="40" y="40" width="120" height="60" as="geometry"/></mxCell>
<mxCell id="S" value="" style="ellipse;fillColor=#e00000;strokeColor=#000000;" vertex="1" parent="1"><mxGeometry x="200" y="40" width="40" height="40" as="geometry"/></mxCell>
<mxCell id="T" value="" style="endArrow=none;html=1;strokeWidth=4;strokeColor=light-dark(#a5a5a5, #5f5f5f);" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="40" y="140" as="sourcePoint"/><mxPoint x="320" y="140" as="targetPoint"/></mxGeometry></mxCell>
<mxCell id="X" value="Km 12+345" style="text;html=1;fontColor=#333333;" vertex="1" parent="1"><mxGeometry x="40" y="160" width="100" height="30" as="geometry"/></mxCell>
<mxCell id="B" value="" style="shape=mxgraph.basic.star;strokeColor=#000000;fillColor=#ffffff;" vertex="1" parent="1"><mxGeometry x="260" y="40" width="40" height="40" as="geometry"/></mxCell>
</root></mxGraphModel>`;

test.describe('dark theme: shapes are readable', () => {
  test('cells on the canvas: strokes >= 3:1 and text >= 4.5:1 against the dark canvas', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await openApp(page, 'dark');
    await mkdir(SHOT_DIR, { recursive: true });

    const ids: Record<string, string> = {};
    ids.signal = await insertFromPalette(page, 'ertms', 'Signal Left 3');
    ids.balise = await insertFromPalette(page, 'ertms', 'Single Balise Right');
    ids.track = await insertFromPalette(page, 'ertms', 'Track');
    ids.point = await insertFromPalette(page, 'ertms', 'Point Left');
    ids.train = await insertFromPalette(page, 'ertms', 'Train');
    ids.text = await insertFromPalette(page, 'general', 'Text');
    ids.rectangle = await insertFromPalette(page, 'general', 'Rectangle');
    Object.assign(
      ids,
      await page.evaluate(async (stencilXml) => {
        const registry = await import('/src/services/service-registry.ts' as string);
        const codec = await import('/src/drawio-shapes/engine/codec.ts' as string);
        const graph = registry.ServiceRegistry.getTabManager().getActiveTab().graph;
        const out: Record<string, string> = {};
        graph.batchUpdate(() => {
          const add = (key: string, style: Record<string, unknown>, value: string, x: number) => {
            out[key] = graph.insertVertex({ parent: graph.getDefaultParent(), value, position: [x, 420], size: [60, 60], style }).id;
          };
          add('star', { shape: 'mxgraph.basic.star', strokeColor: '#000000', fillColor: '#ffffff' }, '', 40);
          add('literalStencil', { shape: `stencil(${codec.compress(stencilXml)})` }, '', 140);
          add('greyHtml', { html: 1, fillColor: 'none', strokeColor: 'none' }, '<span style="color: #333333">Km 12+345</span>', 240);
          add('blueText', { fontColor: '#0000ff', fillColor: 'none', strokeColor: 'none' }, 'Route R1', 340);
        });
        return out;
      }, LITERAL_STENCIL_XML),
    );
    // lay the palette inserts out in a row (the palette drops them at the same place)
    await inGraph(page, `
      const model = graph.getDataModel();
      model.batchUpdate(() => {
        arg.forEach((id, i) => {
          const cell = model.getCell(id);
          const box = graph.getBoundingBox([cell]);
          const s = graph.view.scale;
          const t = graph.view.translate;
          graph.moveCells([cell], 40 + (i % 4) * 170 - (box.x / s - t.x), 60 + Math.floor(i / 4) * 140 - (box.y / s - t.y));
        });
      });
      graph.clearSelection();
    `, [ids.signal, ids.balise, ids.track, ids.point, ids.train, ids.text, ids.rectangle]);

    await page.locator('#graph-container').screenshot({ path: `${SHOT_DIR}/canvas-dark.png` });

    const reports = await collectColours(page, '#graph-container [data-dks]', ids);
    const keys = new Set(reports.map((r) => r.title.split('#')[0]));
    for (const k of Object.keys(ids)) expect(keys, `rendered ${k}`).toContain(k);
    // every representative cell draws something visible
    for (const k of ['signal', 'balise', 'track', 'point', 'rectangle', 'star', 'literalStencil']) {
      expect(reports.filter((r) => r.title.startsWith(`${k}#`)).flatMap((r) => r.strokes).length, `${k} strokes`).toBeGreaterThan(0);
    }
    for (const k of ['text', 'greyHtml', 'blueText']) {
      expect(reports.filter((r) => r.title.startsWith(`${k}#`)).flatMap((r) => r.texts).length, `${k} text`).toBeGreaterThan(0);
    }
    expect(await offenders(page, reports, CANVAS)).toEqual([]);

    // only the rendering changed: the cells keep their stored colours
    const stored = await inGraph<Record<string, unknown>>(page, `
      const m = graph.getDataModel();
      return { star: m.getCell(arg.star).style.strokeColor, grey: String(m.getCell(arg.greyHtml).value), blue: m.getCell(arg.blueText).style.fontColor };
    `, ids);
    expect(stored).toEqual({ star: '#000000', grey: '<span style="color: #333333">Km 12+345</span>', blue: '#0000ff' });

    // selection border, handles and the drop-target / connect feedback colours
    await inGraph(page, 'graph.setSelectionCells(arg.map((id) => graph.getDataModel().getCell(id)));', [ids.rectangle, ids.track]);
    await page.locator('#graph-container').screenshot({ path: `${SHOT_DIR}/selection-dark.png` });
    const feedback = await page.evaluate(async () => {
      const registry = await import('/src/services/service-registry.ts' as string);
      const graph = registry.ServiceRegistry.getTabManager().getActiveTab().graph;
      // maxGraph draws selection borders and handles into the overlay pane
      const pane = graph.view.getOverlayPane() as SVGElement;
      const ctx = document.createElement('canvas').getContext('2d')!;
      const colours = new Set<string>();
      for (const el of Array.from(pane.querySelectorAll('*'))) {
        for (const attr of ['stroke', 'fill']) {
          const v = el.getAttribute(attr);
          if (!v || v === 'none' || v === 'transparent' || v.startsWith('url(')) continue;
          if (attr === 'stroke' && (el.getAttribute('stroke-opacity') === '0' || el.getAttribute('visibility') === 'hidden')) continue;
          if (getComputedStyle(el).visibility === 'hidden') continue;
          ctx.fillStyle = '#010203';
          ctx.fillStyle = v;
          colours.add(`${attr}:${ctx.fillStyle}`);
        }
      }
      return [...colours];
    });
    // the handles' black outline sits on their green fill; the fill / dashed border carry the contrast
    const visibleFeedback = feedback.filter((c) => c !== 'stroke:#000000' && c !== 'stroke:#ffffff');
    expect(visibleFeedback.length).toBeGreaterThan(0);
    const fbRatios = await contrastIn(page, visibleFeedback.map((c) => [c.split(':')[1], CANVAS] as [string, string]));
    expect(visibleFeedback.filter((_c, i) => fbRatios[i] < 3)).toEqual([]);
    const blue = await page.evaluate(async () => {
      const registry = await import('/src/services/service-registry.ts' as string);
      const hc = await import('/src/drawio-shapes/engine/handle-colors.ts' as string);
      const graph = registry.ServiceRegistry.getTabManager().getActiveTab().graph;
      return hc.feedbackColor(graph, '#0000FF') as string;
    });
    expect((await contrastIn(page, [[blue, CANVAS]]))[0]).toBeGreaterThanOrEqual(3);
    expect(errors).toEqual([]);
  });

  test('palette and template thumbnails use the dark rendering (and follow a theme switch)', async ({ page }) => {
    await openApp(page, 'dark');
    await mkdir(SHOT_DIR, { recursive: true });
    // general, ERTMS and the railway libraries (src/ui/railway-libraries.ts)
    for (const id of ['general', 'ertms', ...RAILWAY_SECTIONS]) {
      await expandSection(page, id);
      const thumbs = page.locator(`${PALETTE} section[data-palette-id="${id}"] .rd-dp-thumb`);
      const n = await thumbs.count();
      for (let i = 0; i < n; i++) await thumbs.nth(i).scrollIntoViewIfNeeded();
      await expect(page.locator(`${PALETTE} section[data-palette-id="${id}"] .rd-dp-thumb:not(.rd-dp-thumb-ready)`)).toHaveCount(0);
    }
    await page.locator(`${PALETTE} section[data-palette-id="ertms"]`).screenshot({ path: `${SHOT_DIR}/palette-ertms-dark.png` });
    const thumbs = await collectColours(
      page,
      // General also holds draw.io's Basic palette (merged); its entries with fixed draw.io colours
      // (pattern fills, smileys, Sankey link) were never part of this check, so only General's own
      // entries, the merged app shapes and ERTMS are checked
      [
        `${PALETTE} section[data-palette-id="general"] .rd-dp-item:not([data-entry-id^="basic-"]) .rd-dp-thumb`,
        ...['ertms', ...RAILWAY_SECTIONS].map((id) => `${PALETTE} section[data-palette-id="${id}"] .rd-dp-thumb`),
      ].join(', '),
    );
    expect(thumbs.length).toBeGreaterThan(200);
    expect(await offenders(page, thumbs)).toEqual([]);

    // the thumbnail matches the canvas: same stroke as the inserted ERTMS track
    const trackThumb = thumbs.find((t) => t.title === 'Track')!;
    const trackId = await insertFromPalette(page, 'ertms', 'Track');
    const canvasStroke = await inGraph<string>(page, 'return graph.view.getState(graph.getDataModel().getCell(arg)).style.strokeColor;', trackId);
    const ctxHex = await page.evaluate((v) => {
      const ctx = document.createElement('canvas').getContext('2d')!;
      ctx.fillStyle = v;
      return ctx.fillStyle;
    }, canvasStroke);
    expect(trackThumb.strokes).toContain(ctxHex);
    // the library's light-dark(#e00000, #5f5f5f) track keeps its red instead of turning dim grey
    expect(trackThumb.strokes).not.toContain('#5f5f5f');

    // Templates tab
    await openLeftTab(page, 'templates');
    await page.locator('#templates-panel .rd-tpl-tile').first().waitFor();
    const tiles = page.locator('#templates-panel .rd-tpl-thumb');
    for (let i = 0; i < Math.min(4, await tiles.count()); i++) await tiles.nth(i).scrollIntoViewIfNeeded();
    await expect(page.locator('#templates-panel .rd-tpl-thumb.rd-tpl-thumb-ready').first()).toBeVisible();
    await page.locator('#leftpanel-container').screenshot({ path: `${SHOT_DIR}/templates-dark.png` });
    const templates = (await collectColours(page, '#templates-panel .rd-tpl-thumb.rd-tpl-thumb-ready')).slice(0, 4);
    expect(templates.length).toBeGreaterThan(0);
    // template thumbnails are tiny (whole layouts in 200px): strokes only, text there is not readable at any theme
    expect(await offenders(page, templates.map((t) => ({ ...t, texts: [] })))).toEqual([]);

    // View > Dark Mode back to light: the thumbnails re-render with the light colours
    await openLeftTab(page, 'shapes');
    await menu(page, 'view', 'toggleDarkMode');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect
      .poll(async () => (await collectColours(page, `${PALETTE} section[data-palette-id="ertms"] .rd-dp-item[title="Track"] .rd-dp-thumb`))[0]?.strokes)
      .toContain('#e00000');
  });

  test('saved .drawio file and PNG export are the same in the light and the dark theme', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await openApp(page, 'light');
    await inGraph(page, 'tab.saveLoadController.load(arg);', MODEL_XML);

    const snapshot = async (): Promise<{ file: string; png: string; size: string }> => {
      const [file] = await Promise.all([page.waitForEvent('download'), menu(page, 'file', 'export')]);
      const text = (await readDownload(file)).toString('utf8').replace(/\s(modified|etag|agent|version)="[^"]*"/g, '');
      const [png] = await Promise.all([page.waitForEvent('download'), menu(page, 'file', 'exportPng')]);
      const bytes = await readDownload(png);
      const decoded = await page.evaluate(async (b64) => {
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = `data:image/png;base64,${b64}`;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, img.width, img.height).data;
        const digest = await crypto.subtle.digest('SHA-256', data);
        return {
          size: `${img.width}x${img.height}`,
          hash: Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join(''),
        };
      }, bytes.toString('base64'));
      return { file: text, png: decoded.hash, size: decoded.size };
    };

    const light = await snapshot();
    expect(light.file).toContain('light-dark(#a5a5a5, #5f5f5f)');
    expect(light.file).toContain('strokeColor=#000000');
    await menu(page, 'view', 'toggleDarkMode');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    // the canvas does render dark ...
    const rendered = await inGraph<string>(page, "return graph.view.getState(graph.getDataModel().getCell('S')).style.strokeColor;");
    expect(rendered).not.toBe('#000000');
    await page.locator('#graph-container').screenshot({ path: `${SHOT_DIR}/export-model-dark.png` });
    // ... but the file and the image export do not
    const dark = await snapshot();
    expect(dark.file).toBe(light.file);
    expect(dark.size).toBe(light.size);
    expect(dark.png).toBe(light.png);
    expect(errors).toEqual([]);
  });
});
