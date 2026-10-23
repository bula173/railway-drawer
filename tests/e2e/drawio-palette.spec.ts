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
import { leftTabLabels } from './menu-helpers';

/** The railway libraries after ERTMS (src/ui/railway-libraries.ts, railway-shapes.spec.ts). */
const RAILWAY_SECTION_TITLES = ['ERTMS/ETCS extra', 'Polish signalling (PKP PLK)', 'Track layout'];

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
    // The dev server loads several hundred modules; the default buffer (250 entries) would drop the
    // stencil request checked below
    await page.addInitScript(() => performance.setResourceTimingBufferSize(10000));
    await page.goto('/');
    await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);

    // One Shapes tab holds app shapes and the draw.io palettes; no separate draw.io/Stencils tabs
    expect(await leftTabLabels(page)).toEqual(['Shapes', 'Templates', 'Layers', 'PlantUML', 'Railway Script']);
    await expect(page.locator('#stencils-container')).toHaveCount(0);
    const container = page.locator('#drawio-palette-container');
    await expect(container).toBeVisible();
    // draw.io General + Basic and the app's Basic group are one "General" section (no Basic header)
    await expect(page.locator('#shapes-container #app-shapes-container .shapes-group-header')).toHaveCount(0);
    const headers = page.locator('#shapes-container .rd-dp-category:not([hidden]) .rd-dp-header-title');
    await expect(headers).toHaveText(['ERTMS', ...RAILWAY_SECTION_TITLES, 'General', 'Misc', 'Advanced', 'Arrows', 'Flowchart']);
    await expect(container.locator('section[data-palette-id="basic"]')).toHaveCount(0);

    // General (expanded by default): draw.io's 45 General + 76 Basic entries + 4 merged app shapes;
    // ERTMS shows the 18 simple elements of the ertms.xml library (its 22 scenario diagrams are
    // ERTMS templates, see templates.spec.ts)
    const general = container.locator('section[data-palette-id="general"]');
    await expect(general.locator('.rd-dp-item')).toHaveCount(125);
    const ertms = container.locator('section[data-palette-id="ertms"]');
    await expect(ertms.locator('.rd-dp-item')).toHaveCount(18);
    // Thumbnails render when they scroll into view; General now sits below ERTMS and the three
    // railway libraries, so bring it into view first
    await general.locator('.rd-dp-item').first().scrollIntoViewIfNeeded();
    await expect(general.locator('.rd-dp-thumb-ready').first()).toBeVisible({ timeout: 15000 });
    await expect(general.locator('.rd-dp-thumb-error')).toHaveCount(0);

    // Click inserts at the view centre
    await general.locator('.rd-dp-item[title="Hexagon"]').click();
    await general.locator('.rd-dp-item[title="Flash"]').click();
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

  test('"More shapes…" lists the merged General once and toggles it', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('railway-drawer-hidden-shape-groups');
      localStorage.removeItem('rd.drawioPalettes.visible');
    });
    await page.reload();
    const general = page.locator('#drawio-palette-container section[data-palette-id="general"]');
    await expect(general).toBeVisible();

    await page.locator('#drawio-palette-container .rd-dp-more').click();
    const menu = page.locator('#drawio-palette-container .rd-dp-menu');
    await expect(menu.locator('.rd-dp-menu-row')).toHaveText(['ERTMS', ...RAILWAY_SECTION_TITLES, 'General', 'Misc', 'Advanced', 'Arrows', 'Flowchart', 'Arrows (legacy)']);
    await expect(menu.locator('input[data-palette-id="basic"], input[data-menu-item-id="app-Basic"]')).toHaveCount(0);
    const generalBox = menu.locator('input[data-palette-id="general"]');
    await expect(generalBox).toBeChecked();

    await generalBox.uncheck();
    await expect(general).toBeHidden();
    await page.reload();
    await expect(general).toBeHidden();

    await page.locator('#drawio-palette-container .rd-dp-more').click();
    await menu.locator('input[data-palette-id="general"]').check();
    await expect(general).toBeVisible();
  });

  test('stored Basic visibility migrates to the merged General', async ({ page }) => {
    await page.goto('/');
    // General hidden but draw.io Basic shown (old layout): the merged section is shown
    await page.evaluate(() => {
      localStorage.setItem('rd.drawioPalettes.visible', JSON.stringify({ general: false, basic: true }));
      localStorage.setItem('railway-drawer-hidden-shape-groups', JSON.stringify(['Basic']));
    });
    await page.reload();
    await expect(page.locator('#drawio-palette-container section[data-palette-id="general"]')).toBeVisible();
    const stored = await page.evaluate(() => [
      localStorage.getItem('rd.drawioPalettes.visible'),
      localStorage.getItem('railway-drawer-hidden-shape-groups'),
    ]);
    expect(stored).toEqual(['{}', '[]']);
  });

  test('merged-in app shapes insert once, search lists them once', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
    await page.evaluate(() => localStorage.removeItem('rd.drawioPalettes.visible'));
    const container = page.locator('#drawio-palette-container');
    const general = container.locator('section[data-palette-id="general"]');
    await expect(general.locator('.rd-dp-item')).toHaveCount(125);

    // app shape with no draw.io equivalent: app shape, written as a draw.io shape plus rdShape
    await general.locator('.rd-dp-item[title="Divided Rectangle"]').click();
    // app shape with a draw.io equivalent outside General/Basic: inserted with the draw.io style
    await general.locator('.rd-dp-item[title="Cross"]').click();
    const xml = await waitForCached(page, 'rdShape=double-rectangle-shape');
    expect(styleWith(xml, 'shape=cross')?.replace(/;?rdLayerId=[^;]*;$/, '')).toBe('shape=cross;whiteSpace=wrap;html=1;');

    await container.locator('.rd-dp-search').fill('cross');
    const hits = container.locator('.rd-dp-category:not([hidden]) .rd-dp-item:not([hidden])[title="Cross"]');
    await expect(hits).toHaveCount(1);
    await expect(general.locator('.rd-dp-item[title="Cross"]')).toBeVisible();
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
