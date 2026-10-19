/**
 * @file drawio-palette.spec.ts
 * @brief draw.io palettes in the Shapes tab of the main editor: palettes render, entries insert with
 *        their exact draw.io style, and the saved diagram keeps the draw.io shape names.
 *
 * Runs on any port (no draw.io server is involved). Uses the 5 s autosave into localStorage
 * `railway-drawer-cache` as the save path (same serializer as File > Save).
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const HEXAGON = 'shape=hexagon;perimeter=hexagonPerimeter2;whiteSpace=wrap;html=1;shapeInside=1;fixedSize=1;';
const FLASH = 'verticalLabelPosition=bottom;verticalAlign=top;html=1;shape=mxgraph.basic.flash';

function cachedXml(page: Page): Promise<string> {
  return page.evaluate(() => {
    try {
      // CacheService: { version, data: { tabs: [{ graphXml }] } }
      const cache = JSON.parse(localStorage.getItem('railway-drawer-cache') ?? 'null') as {
        data?: { tabs?: Array<{ graphXml?: string }> };
      } | null;
      return (cache?.data?.tabs ?? []).map((t) => t.graphXml ?? '').join('\n');
    } catch {
      return '';
    }
  });
}

/** Style attribute of the first cell whose style contains `needle`. */
function styleWith(xml: string, needle: string): string | null {
  for (const m of xml.matchAll(/ style="([^"]*)"/g)) if (m[1].includes(needle)) return m[1];
  return null;
}

async function waitForCached(page: Page, needle: string): Promise<string> {
  let xml = '';
  await expect
    .poll(async () => {
      xml = await cachedXml(page);
      return xml.includes(needle);
    }, { timeout: 15_000 })
    .toBe(true);
  return xml;
}

test.describe('draw.io palettes in the maxGraph editor', () => {
  test('render, insert with draw.io styles and save real draw.io shape names', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await page.goto('/');
    await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);

    // One Shapes tab holds app shapes and the draw.io palettes; no separate draw.io/Stencils tabs
    await expect(page.locator('.left-panel-tab-btn:visible')).toHaveText(['Shapes', 'Templates', 'Layers', /PlantUML/, 'Railway Script']);
    await expect(page.locator('#stencils-container')).toHaveCount(0);
    const container = page.locator('#drawio-palette-container');
    await expect(container).toBeVisible();
    await expect(page.locator('#shapes-container #app-shapes-container .shapes-group-header').first()).toBeVisible();

    // General (expanded by default) has draw.io's 45 entries; ERTMS shows the 18 simple elements of
    // the ertms.xml library (its 22 scenario diagrams are ERTMS templates, see templates.spec.ts)
    const general = container.locator('section[data-palette-id="general"]');
    await expect(general.locator('.rd-dp-item')).toHaveCount(45);
    const ertms = container.locator('section[data-palette-id="ertms"]');
    await expect(ertms.locator('.rd-dp-item')).toHaveCount(18);
    await expect(general.locator('.rd-dp-thumb-ready').first()).toBeVisible();
    await expect(general.locator('.rd-dp-thumb-error')).toHaveCount(0);

    // Click inserts at the view centre
    await general.locator('.rd-dp-item[title="Hexagon"]').click();
    const basic = container.locator('section[data-palette-id="basic"]');
    await basic.locator('.rd-dp-header').click();
    await basic.locator('.rd-dp-item[title="Flash"]').click();
    await ertms.locator('.rd-dp-item').first().click();

    const xml = await waitForCached(page, 'mxgraph.basic.flash');
    // verbatim draw.io style; the app only appends its layer id (rdLayerId, kept by draw.io)
    expect(styleWith(xml, 'shape=hexagon')?.replace(/rdLayerId=[^;]*;$/, '')).toBe(HEXAGON);
    expect(styleWith(xml, 'mxgraph.basic.flash')?.replace(/;?rdLayerId=[^;]*;$/, '')).toBe(FLASH);
    expect(xml).not.toContain('rdShape=');

    // Named stencil (mxgraph.basic.flash) was loaded from public/stencils/basic.xml
    const stencilLoaded = await page.evaluate(() =>
      performance.getEntriesByType('resource').some((r) => r.name.includes('stencils/basic.xml'))
    );
    expect(stencilLoaded).toBe(true);

    // Reload: the diagram restored from that XML is written again (autosave) with the same styles
    await page.reload();
    await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
    await page.evaluate(() => localStorage.removeItem('railway-drawer-cache'));
    const again = await waitForCached(page, 'mxgraph.basic.flash');
    expect(styleWith(again, 'shape=hexagon')?.replace(/rdLayerId=[^;]*;$/, '')).toBe(HEXAGON);
    expect(styleWith(again, 'mxgraph.basic.flash')?.replace(/;?rdLayerId=[^;]*;$/, '')).toBe(FLASH);

    expect(pageErrors).toEqual([]);
  });

  test('"More shapes…" toggles draw.io palettes and app shape groups', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('railway-drawer-hidden-shape-groups'));
    await page.reload();
    const appShapes = page.locator('#app-shapes-container');
    await expect(appShapes.locator('.shapes-group-header[data-group="Basic"]')).toBeVisible();

    await page.locator('#drawio-palette-container .rd-dp-more').click();
    const menu = page.locator('#drawio-palette-container .rd-dp-menu');
    await expect(menu.locator('input[data-palette-id="general"]')).toBeChecked();
    const basicGroup = menu.locator('input[data-menu-item-id="app-Basic"]');
    await expect(basicGroup).toBeChecked();

    await basicGroup.uncheck();
    await expect(appShapes.locator('.shapes-group-header[data-group="Basic"]')).toHaveCount(0);
    await page.reload();
    await expect(appShapes.locator('.shapes-group-header[data-group="Basic"]')).toHaveCount(0);

    await page.locator('#drawio-palette-container .rd-dp-more').click();
    await menu.locator('input[data-menu-item-id="app-Basic"]').check();
    await expect(appShapes.locator('.shapes-group-header[data-group="Basic"]')).toBeVisible();
  });

  test('optional ERTMS tab shows only the ERTMS library and is remembered', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('railway-drawer-ertms-tab'));
    await page.reload();
    await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
    const ertmsTab = page.locator('.left-panel-tab-btn', { hasText: 'ERTMS' });
    await expect(ertmsTab).toBeHidden();

    await page.locator('.menu-item[data-menu="view"]').click();
    await page.locator('[data-action="toggleErtmsTab"]').click();
    await expect(ertmsTab).toBeVisible();
    const panel = page.locator('#ertms-panel');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.rd-dp-category')).toHaveCount(1);
    await expect(panel.locator('section[data-palette-id="ertms"] .rd-dp-item')).toHaveCount(18);
    await expect(panel.locator('.rd-dp-more')).toBeHidden();
    await expect(panel.locator('.rd-dp-import')).toBeHidden();

    // remembered across reloads; the tab's close button hides it again
    await page.reload();
    await expect(ertmsTab).toBeVisible();
    await ertmsTab.locator('.tab-close-btn').click();
    await expect(ertmsTab).toBeHidden();
    await page.reload();
    await expect(ertmsTab).toBeHidden();
  });
});
