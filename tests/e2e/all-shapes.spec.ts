/**
 * @file all-shapes.spec.ts
 * @brief Every draw.io library in the Shapes tab: "More shapes…" turns on UML, BPMN and AWS (lazy
 *        sections, real thumbnails), inserted entries save draw.io's exact style strings, the
 *        search covers all libraries (grouped by library), and user libraries can be imported,
 *        extended with the selection, persisted and exported as draw.io libraries.
 *
 * Uses the 5 s autosave into localStorage `railway-drawer-cache` as the save path (same
 * serializer as File > Save).
 */
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

interface Entry { id: string; title: string; style?: string }
function paletteEntry(file: string, id: string): Entry {
  const def = JSON.parse(readFileSync(`src/drawio-shapes/palettes/data/${file}.json`, 'utf8')) as { entries: Entry[] };
  const e = def.entries.find((x) => x.id === id);
  if (!e) throw new Error(`no entry ${id} in ${file}`);
  return e;
}

function cachedXml(page: Page): Promise<string> {
  return page.evaluate(() => {
    try {
      const cache = JSON.parse(localStorage.getItem('railway-drawer-cache') ?? 'null') as {
        data?: { tabs?: Array<{ graphXml?: string }> };
      } | null;
      return (cache?.data?.tabs ?? []).map((t) => t.graphXml ?? '').join('\n');
    } catch {
      return '';
    }
  });
}

function escapeXmlAttr(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function waitForCachedStyle(page: Page, style: string): Promise<void> {
  const needle = `style="${escapeXmlAttr(style)}"`;
  await expect.poll(async () => (await cachedXml(page)).includes(needle), { timeout: 20_000 }).toBe(true);
}

async function openEditor(page: Page): Promise<Locator> {
  await page.goto('/');
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
  const container = page.locator('#drawio-palette-container');
  await expect(container).toBeVisible();
  return container;
}

async function enableLibraries(container: Locator, ids: string[]): Promise<void> {
  await container.locator('.rd-dp-more').click();
  const dialog = container.locator('.rd-dp-menu');
  await expect(dialog).toBeVisible();
  for (const id of ids) {
    const box = dialog.locator(`input[data-library-id="${id}"]`);
    await expect(box).toBeVisible();
    await box.check();
  }
  await dialog.locator('.rd-dp-menu-close').click();
  await expect(dialog).toBeHidden();
}

/** Expands a section (if collapsed) and waits until its tiles rendered without errors. */
async function expandAndRender(container: Locator, paletteId: string, minItems: number): Promise<Locator> {
  const section = container.locator(`section[data-palette-id="${paletteId}"]`);
  await expect(section).toBeVisible();
  if (!(await section.evaluate((s) => s.classList.contains('rd-dp-expanded')))) {
    await section.locator('.rd-dp-header').click();
  }
  await expect.poll(async () => section.locator('.rd-dp-item').count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(minItems);
  // thumbnails render lazily when scrolled into view
  const items = section.locator('.rd-dp-item');
  const n = Math.min(await items.count(), 12);
  for (let i = 0; i < n; i++) await items.nth(i).scrollIntoViewIfNeeded();
  await expect.poll(async () => section.locator('.rd-dp-thumb-ready').count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(Math.min(n, 6));
  await expect(section.locator('.rd-dp-thumb-error')).toHaveCount(0);
  return section;
}

test.describe('all draw.io libraries', () => {
  test('More shapes enables UML, BPMN and AWS; entries render and save draw.io-native styles', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    const container = await openEditor(page);

    // the defaults only: no draw.io library section is shown before More shapes
    await expect(container.locator('.rd-dp-catalogue:not([hidden])')).toHaveCount(0);

    await container.locator('.rd-dp-more').click();
    const dialog = container.locator('.rd-dp-menu');
    // draw.io's categories, libraries off by default, vendor sets with an attribution
    await expect(dialog.locator('.rd-dp-lib-section .rd-dp-menu-section')).toContainText(['Standard', 'Software', 'Networking', 'Business', 'Other']);
    await expect(dialog.locator('input[data-library-id]')).not.toHaveCount(0);
    expect(await dialog.locator('input[data-library-id]:checked').count()).toBe(0);
    await expect(dialog.locator('.rd-dp-lib-row[data-library-id="aws4"] .rd-dp-info')).toHaveAttribute('title', /trademark/i);
    // the preview pane shows the library's shapes
    await dialog.locator('.rd-dp-lib-row[data-library-id="uml"] .rd-dp-lib-title').click();
    await expect(dialog.locator('.rd-dp-lib-preview-title')).toHaveText('UML');
    await expect.poll(async () => dialog.locator('.rd-dp-lib-preview-thumb svg').count(), { timeout: 20_000 }).toBeGreaterThan(5);
    // the filter narrows the list
    await dialog.locator('.rd-dp-lib-filter').fill('bpmn');
    await expect(dialog.locator('.rd-dp-lib-row:not([hidden])')).toHaveCount(1);
    await dialog.locator('.rd-dp-lib-filter').fill('');
    await dialog.locator('.rd-dp-menu-close').click();

    await enableLibraries(container, ['uml', 'bpmn2', 'aws4']);
    await expect(container.locator('section[data-palette-id="uml"]')).toBeVisible();
    await expect(container.locator('section[data-palette-id="bpmn2General"]')).toBeVisible();
    await expect(container.locator('section[data-palette-id="aws4Compute"]')).toBeVisible();

    // JS shapes (UML, vendored Shapes.js / mxBpmnShape2.js) and stencils (AWS) render
    const uml = await expandAndRender(container, 'uml', 60);
    await expandAndRender(container, 'bpmn2Tasks', 5);
    const compute = await expandAndRender(container, 'aws4Compute', 20);

    // insert: exact draw.io styles in the saved diagram
    const actor = paletteEntry('uml', 'uml-27-actor');
    await uml.locator(`.rd-dp-item[data-entry-id="${actor.id}"]`).click();
    const lambda = paletteEntry('aws4Compute', 'aws4Compute-15-lambda');
    const lambdaTile = compute.locator(`.rd-dp-item[data-entry-id="${lambda.id}"]`);
    await lambdaTile.scrollIntoViewIfNeeded();
    await lambdaTile.click();
    const lifeline = paletteEntry('uml', 'uml-36-actor-lifeline');
    const lifelineTile = uml.locator(`.rd-dp-item[data-entry-id="${lifeline.id}"]`);
    await lifelineTile.scrollIntoViewIfNeeded();
    await lifelineTile.click();
    await waitForCachedStyle(page, actor.style!);
    await waitForCachedStyle(page, lambda.style!);
    await waitForCachedStyle(page, lifeline.style!);

    // the canvas draws them (vendored JS shape umlLifeline, AWS stencil): shapes have SVG content
    const drawn = await page.evaluate(() => document.querySelectorAll('#graph-container svg g g path, #graph-container svg g g rect').length);
    expect(drawn).toBeGreaterThan(5);

    // the library choice persists
    await page.reload();
    await expect(page.locator('#drawio-palette-container section[data-palette-id="aws4Compute"]')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('search covers every library and groups the results by library', async ({ page }) => {
    const container = await openEditor(page);
    const search = container.locator('.rd-dp-search');
    for (const [query, library] of [['actor', 'uml'], ['lambda', 'aws4'], ['router', 'cisco']] as const) {
      await search.fill(query);
      const results = container.locator('.rd-dp-search-results');
      await expect(results).toBeVisible({ timeout: 20_000 });
      const group = results.locator(`.rd-dp-sr-group[data-library="${library}"]`);
      await expect(group).toBeVisible();
      await expect(group.locator('.rd-dp-sr-library')).toContainText('(');
      await expect.poll(async () => results.locator('.rd-dp-item').count(), { timeout: 20_000 }).toBeGreaterThan(0);
    }
    // a result inserts like any tile
    await search.fill('lambda');
    const tile = container.locator('.rd-dp-sr-group[data-library="aws4"] .rd-dp-item').first();
    await expect(tile).toBeVisible({ timeout: 20_000 });
    await tile.click();
    await expect.poll(async () => (await cachedXml(page)).includes('mxgraph.aws4'), { timeout: 20_000 }).toBe(true);
    // "Show library" adds it to the tab
    await container.locator('.rd-dp-sr-group[data-library="aws4"] .rd-dp-sr-show').click();
    await search.fill('');
    await expect(container.locator('.rd-dp-catalogue[data-library="aws4"]:not([hidden])').first()).toBeVisible();
    await expect(container.locator('.rd-dp-search-results')).toBeHidden();
  });

  test('user libraries: import, add selection, persist and export as a draw.io library', async ({ page }) => {
    const container = await openEditor(page);
    // import a draw.io library file through "＋ Add library"
    const boxXml = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="2" value="Box" ' +
      'style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;" vertex="1" parent="1"><mxGeometry width="120" height="60" as="geometry"/></mxCell></root></mxGraphModel>';
    const json = JSON.stringify([{ xml: boxXml, w: 120, h: 60, aspect: 'fixed', title: 'Box' }]);
    // as draw.io writes a library: the JSON body is XML text (entity-escaped)
    const library = `<mxlibrary>${json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</mxlibrary>`;
    await container.locator('.rd-dp-import').click();
    const chooser = page.waitForEvent('filechooser');
    await page.locator('.rd-dp-add-menu [data-action="import"]').click();
    await (await chooser).setFiles({ name: 'My shapes.xml', mimeType: 'application/xml', buffer: Buffer.from(library) });
    const section = container.locator('section[data-palette-id="lib-my-shapes"]');
    await expect(section).toBeVisible();
    await expect(section.locator('.rd-dp-header-title')).toHaveText('My shapes');
    await expect(section.locator('.rd-dp-item')).toHaveCount(1);

    // insert the entry, keep it selected and add the selection to the library
    await section.locator('.rd-dp-item').first().click();
    await waitForCachedStyle(page, 'rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;');
    await section.locator('.rd-dp-lib-add').click();
    await expect(section.locator('.rd-dp-item')).toHaveCount(2);

    // a palette tile dragged onto the library is added too
    const general = container.locator('section[data-palette-id="general"]');
    await general.locator('.rd-dp-item').first().dragTo(section.locator('.rd-dp-body'));
    await expect(section.locator('.rd-dp-item')).toHaveCount(3);

    // rename
    await section.locator('.rd-dp-lib-rename').click();
    await page.locator('.rd-dp-prompt input').fill('Railway boxes');
    await page.locator('.rd-dp-prompt-ok').click();
    await expect(section.locator('.rd-dp-header-title')).toHaveText('Railway boxes');

    // persisted
    await page.reload();
    const restored = page.locator('#drawio-palette-container section[data-palette-id="lib-my-shapes"]');
    await expect(restored.locator('.rd-dp-header-title')).toHaveText('Railway boxes');
    await expect(restored.locator('.rd-dp-item')).toHaveCount(3);

    // export: a draw.io library with the three entries, styles verbatim
    const download = page.waitForEvent('download');
    await restored.locator('.rd-dp-lib-export').click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('Railway boxes.xml');
    const text = readFileSync((await file.path())!, 'utf8');
    expect(text.startsWith('<mxlibrary>[')).toBe(true);
    const body = text.replace(/^<mxlibrary>/, '').replace(/<\/mxlibrary>$/, '');
    expect(body).not.toContain('<');
    const items = JSON.parse(body.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')) as Array<{ xml: string; title: string }>;
    expect(items).toHaveLength(3);
    expect(items[0].title).toBe('Box');
    expect(items[1].xml).toContain('rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;');

    // remove
    await restored.locator('.rd-dp-remove').click();
    await expect(restored).toHaveCount(0);
  });
});
