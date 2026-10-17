/**
 * @file drawio-compat.spec.ts
 * @brief draw.io compatibility in the real app (the embedded draw.io mode was removed; compatibility is
 *        the file format and the shapes). Unit-level guard: src/services/__tests__/drawio-compat.test.ts.
 *
 * - File > Open of draw.io files (compressed multi-page fixture, a draw.io desktop file) renders the cells;
 *   File > Export As… writes a valid <mxfile> with the same pages, page ids, cells, wrapper attributes,
 *   styles, and the pages that are not shown byte-for-byte.
 * - Templates > Import… reads the real ERTMS draw.io library (<mxlibrary>, 40 entries) and Export… writes
 *   a draw.io library again.
 * Runs on any port, offline.
 */
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { test, expect } from '@playwright/test';
import type { Download, Page } from '@playwright/test';

const ROOT = process.cwd();
const fixture = (path: string): Promise<string> => readFile(resolve(ROOT, path), 'utf8');

async function freshApp(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
}

async function menu(page: Page, menuName: string, action: string): Promise<void> {
  await page.locator(`.menu-item[data-menu="${menuName}"]`).click();
  await page.locator(`.menu-dropdown[data-menu="${menuName}"] .menu-dropdown-item[data-action="${action}"]`).click();
}

async function openFile(page: Page, name: string, text: string): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await menu(page, 'file', 'open');
  await (await chooser).setFiles({ name, mimeType: 'application/xml', buffer: Buffer.from(text) });
}

async function downloadText(download: Download): Promise<string> {
  const chunks = await (await download.createReadStream()).toArray();
  return Buffer.concat(chunks).toString('utf8');
}

interface PageInfo {
  id: string | null;
  name: string | null;
  compressed: boolean;
  /** Raw content of the <diagram> (text of a compressed page). */
  raw: string;
  cells: Array<{ id: string | null; tag: string; parent: string | null; style: string | null; attrs: Record<string, string> }>;
}

/** Parses an <mxfile> in the page (DOMParser, DecompressionStream for compressed pages). */
function inspectMxfile(page: Page, xml: string): Promise<{ root: string; pages: PageInfo[] }> {
  return page.evaluate(async (text) => {
    const parse = (s: string) => new DOMParser().parseFromString(s, 'text/xml');
    const inflate = async (b64: string): Promise<string> => {
      const bytes = Uint8Array.from(atob(b64.replace(/\s+/g, '')), (c) => c.charCodeAt(0));
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return decodeURIComponent(await new Response(stream).text());
    };
    const doc = parse(text);
    if (doc.getElementsByTagName('parsererror').length) throw new Error('not well-formed');
    const pages: PageInfo[] = [];
    for (const d of Array.from(doc.documentElement.children)) {
      if (d.nodeName !== 'diagram') throw new Error(`<${d.nodeName}> in <mxfile>`);
      let model = Array.from(d.children).find((c) => c.nodeName === 'mxGraphModel') ?? null;
      const compressed = !model;
      if (!model) model = parse(await inflate(d.textContent ?? '')).documentElement;
      const root = Array.from(model.children).find((c) => c.nodeName === 'root');
      if (!root) throw new Error('no <root>');
      pages.push({
        id: d.getAttribute('id'),
        name: d.getAttribute('name'),
        compressed,
        raw: compressed ? (d.textContent ?? '') : new XMLSerializer().serializeToString(model),
        cells: Array.from(root.children).map((el) => {
          const cell = el.nodeName === 'mxCell' ? el : (Array.from(el.children).find((c) => c.nodeName === 'mxCell') ?? el);
          const attrs: Record<string, string> = {};
          if (el.nodeName !== 'mxCell') for (const a of Array.from(el.attributes)) attrs[a.name] = a.value;
          return { id: el.getAttribute('id'), tag: el.nodeName, parent: cell.getAttribute('parent'), style: cell.getAttribute('style'), attrs };
        }),
      });
    }
    return { root: doc.documentElement.nodeName, pages };
  }, xml);
}

test.describe('draw.io files in the Railway Drawer editor', () => {
  test('File > Open of a compressed multi-page draw.io file, then File > Export As… keeps it', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await freshApp(page);
    const source = await fixture('src/services/__tests__/fixtures/drawio/compat-compressed.drawio');

    await openFile(page, 'Station.drawio', source);
    // The two plain pages are kept, the scenario step page became a scenario
    await expect(page.locator('.notification', { hasText: 'only the first page is shown' })).toContainText('"Notes", "Archive"');
    await expect(page.locator('.document-title')).toHaveText('Station layout');
    const graph = page.locator('#graph-container > div:visible');
    for (const label of ['Interlocking', 'S1 (12+345)', 'Hexagon', 'route R1']) {
      await expect(graph.getByText(label, { exact: true }).first()).toBeAttached();
    }
    await expect(graph.locator('b', { hasText: 'B12' })).toBeAttached();

    const [download] = await Promise.all([page.waitForEvent('download'), menu(page, 'file', 'export')]);
    expect(download.suggestedFilename()).toMatch(/\.drawio$/);
    const saved = await downloadText(download);
    expect(saved).not.toContain('xmlns');

    const before = await inspectMxfile(page, source);
    const after = await inspectMxfile(page, saved);
    expect(after.root).toBe('mxfile');
    expect(after.pages.map((p) => [p.id, p.name])).toEqual(before.pages.map((p) => [p.id, p.name]));
    // The shown page: same cells, ids, parents, wrapper attributes; draw.io style strings kept
    const cells = (p: PageInfo) => p.cells.map((c) => ({ id: c.id, tag: c.tag, parent: c.parent, attrs: c.attrs }));
    expect(cells(after.pages[0])).toEqual(cells(before.pages[0]));
    expect(after.pages[0].cells.slice(0, 2).map((c) => [c.id, c.parent])).toEqual([['0', null], ['1', '0']]);
    for (const cell of before.pages[0].cells) {
      if (cell.style) expect(after.pages[0].cells.find((c) => c.id === cell.id)?.style, cell.id ?? '').toContain(cell.style.replace(/;$/, ''));
    }
    expect(cells(after.pages[1])).toEqual(cells(before.pages[1]));
    // Pages that are not shown are written back unchanged (still compressed)
    expect(after.pages.slice(2).map((p) => [p.compressed, p.raw])).toEqual(before.pages.slice(2).map((p) => [p.compressed, p.raw]));
    expect(saved).toContain('rdStepName="Clear"');

    // The export opens again identically
    await openFile(page, 'again.drawio', saved);
    const [again] = await Promise.all([page.waitForEvent('download'), menu(page, 'file', 'export')]);
    const strip = (xml: string) => xml.replace(/ modified="[^"]*"/, '');
    expect(strip(await downloadText(again))).toBe(strip(saved));
    expect(pageErrors).toEqual([]);
  });

  test('File > Open of a draw.io desktop file renders its UserObject, swimlane and edges', async ({ page }) => {
    await freshApp(page);
    const source = await fixture('src/__tests__/fixtures/drawio/native-desktop.drawio');
    await openFile(page, 'native-desktop.drawio', source);
    await expect(page.locator('.document-title')).toHaveText('Station');
    const graph = page.locator('#graph-container > div:visible');
    await expect(graph.getByText('Balise B12 (12.345)').first()).toBeAttached();
    const [download] = await Promise.all([page.waitForEvent('download'), menu(page, 'file', 'export')]);
    const after = await inspectMxfile(page, await downloadText(download));
    const before = await inspectMxfile(page, source);
    expect(after.pages.map((p) => [p.id, p.name])).toEqual(before.pages.map((p) => [p.id, p.name]));
    expect(after.pages[0].cells.map((c) => c.id)).toEqual(before.pages[0].cells.map((c) => c.id));
  });

  test('Templates > Import… reads the ERTMS draw.io library and Export… writes a draw.io library', async ({ page }) => {
    await freshApp(page);
    await page.locator('.left-panel-tab-btn', { hasText: 'Templates' }).click();
    const library = await fixture('public/libraries/ertms.xml');
    const chooser = page.waitForEvent('filechooser');
    await page.locator('.rd-tpl-import').click();
    await (await chooser).setFiles({ name: 'ERTMS.xml', mimeType: 'application/xml', buffer: Buffer.from(library) });
    await expect(page.locator('.notification', { hasText: 'Imported 40 templates from "ERTMS.xml"' })).toBeVisible();

    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.rd-tpl-export').click()]);
    const exported = await downloadText(download);
    const entries = await page.evaluate((text) => {
      const doc = new DOMParser().parseFromString(text, 'text/xml');
      if (doc.documentElement.nodeName !== 'mxlibrary') throw new Error(doc.documentElement.nodeName);
      const list = JSON.parse(doc.documentElement.textContent ?? '') as Array<{ xml?: string; title?: string }>;
      return list.map((e) => ({ title: e.title ?? '', model: !!e.xml && /^\s*(<|&lt;)mxGraphModel/.test(e.xml) }));
    }, exported);
    expect(entries).toHaveLength(40);
    expect(entries.every((e) => e.model)).toBe(true);
  });
});
