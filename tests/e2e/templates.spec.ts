/**
 * @file templates.spec.ts
 * @brief Templates in the main editor: the ERTMS palette shows only the simple elements, the
 *        Templates tab lists the 22 built-in ERTMS templates, and user templates are saved
 *        ("Save as Template…"), survive a reload, insert, rename and delete.
 *
 * Runs on any port (no draw.io server is involved). The diagram is checked through the 5 s
 * autosave into localStorage `railway-drawer-cache`.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const TEMPLATES_KEY = 'railway-drawer-templates';

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

function count(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

async function waitForCachedCount(page: Page, needle: string, n: number): Promise<void> {
  await expect.poll(async () => count(await cachedXml(page), needle), { timeout: 15_000 }).toBe(n);
}

async function waitForCached(page: Page, needle: string): Promise<void> {
  await expect.poll(async () => (await cachedXml(page)).includes(needle), { timeout: 15_000 }).toBe(true);
}

function storedTemplates(page: Page): Promise<{ version: number; templates: Array<{ name: string; xml: string }> } | null> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), TEMPLATES_KEY);
}

async function freshApp(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
}

test.describe('templates', () => {
  test('ERTMS palette shows the elements, the Templates tab the 22 ERTMS templates', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await freshApp(page);

    const ertms = page.locator('#drawio-palette-container section[data-palette-id="ertms"]');
    await expect(ertms.locator('.rd-dp-item')).toHaveCount(18);
    await expect(ertms.locator('.rd-dp-item[title="Signal Left 3"]')).toHaveCount(1);

    // tab bar: no label is cut (the tabs wrap when the panel is narrow), also with the ERTMS tab
    const tabs = page.locator('.left-panel-tab-btn:visible');
    await expect(tabs).toHaveText(['Shapes', 'Templates', 'Layers', /PlantUML/]);
    const clippedTabs = (): Promise<number> =>
      page.locator('.left-panel-tab-btn:visible').evaluateAll((btns) => {
        const bar = btns[0].parentElement!.getBoundingClientRect();
        return btns.filter((b) => {
          const r = b.getBoundingClientRect();
          return b.scrollWidth > b.clientWidth + 1 || r.left < bar.left - 1 || r.right > bar.right + 1;
        }).length;
      });
    expect(await clippedTabs()).toBe(0);
    await page.locator('.menu-item[data-menu="view"]').click();
    await page.locator('[data-action="toggleErtmsTab"]').click();
    await expect(tabs).toHaveText(['Shapes', 'ERTMS×', 'Templates', 'Layers', /PlantUML/]);
    expect(await clippedTabs()).toBe(0);
    await page.locator('#ertms-panel section[data-palette-id="ertms"] .rd-dp-item').first().waitFor();
    await expect(page.locator('#ertms-panel section[data-palette-id="ertms"] .rd-dp-item')).toHaveCount(18);

    await page.locator('.left-panel-tab-btn', { hasText: 'Templates' }).click();
    const panel = page.locator('#templates-panel');
    await expect(panel).toBeVisible();
    const builtin = panel.locator('[data-section="builtin"] .rd-tpl-tile');
    await expect(builtin).toHaveCount(22);
    await expect(builtin.first().locator('.rd-tpl-name')).toHaveText('ERTMS scenario 1');
    await expect(builtin.first().locator('.rd-tpl-desc')).not.toBeEmpty();
    await expect(panel.locator('[data-section="builtin"] .rd-tpl-thumb-ready').first()).toBeVisible();
    await expect(panel.locator('[data-section="user"] .rd-tpl-empty')).toContainText('Select shapes and use Save as template');

    // search
    await panel.locator('.rd-tpl-search').fill('entrance route');
    await expect(builtin).toHaveCount(1);
    await panel.locator('.rd-tpl-search').fill('');
    await expect(builtin).toHaveCount(22);

    // insert into the diagram (an HTML label of scenario 1)
    await builtin.first().click();
    await page.locator('.rd-tpl-popover [data-action="insert"]').click();
    await waitForCached(page, 'L_ENDSECTION');

    // open as a new diagram tab named after the template
    await builtin.nth(1).click();
    await page.locator('.rd-tpl-popover [data-action="open"]').click();
    await expect(page.locator('#tabs-container .tab-button.active')).toContainText('ERTMS scenario 2');
    await expect(page.locator('#tabs-container .tab-button')).toHaveCount(2);

    // drag a tile onto the canvas
    await builtin.nth(2).dragTo(page.locator('#graph-container'), { targetPosition: { x: 300, y: 250 } });
    await waitForCached(page, 'Entrance Route');

    expect(pageErrors).toEqual([]);
  });

  test('save a selection as a template, reload, insert, rename and delete it', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await freshApp(page);

    // a selection: the inserted Hexagon (palette inserts select the new cells)
    await page.locator('#drawio-palette-container section[data-palette-id="general"] .rd-dp-item[title="Hexagon"]').click();
    await waitForCachedCount(page, 'shape=hexagon', 1);

    // the canvas context menu offers it too
    await page.locator('#graph-container').click({ button: 'right', position: { x: 8, y: 8 } });
    await expect(page.locator('#context-menu [data-action="saveAsTemplate"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#context-menu')).toBeHidden();
    // the right-click on the empty canvas cleared the selection: select the hexagon again
    await page.locator('#drawio-palette-container section[data-palette-id="general"] .rd-dp-item[title="Hexagon"]').click();
    await waitForCachedCount(page, 'shape=hexagon', 2);

    await page.locator('.menu-item[data-menu="file"]').click();
    await page.locator('.menu-dropdown-item[data-action="saveAsTemplate"]').click();
    const dialog = page.locator('.rd-tpl-modal');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('1 selected shape');
    // the name is required
    await dialog.locator('input[name="template-name"]').press('Enter');
    await expect(dialog.locator('.rd-tpl-modal-error')).toBeVisible();
    await dialog.locator('input[name="template-name"]').fill('My hexagon');
    await dialog.locator('input[name="template-description"]').fill('one shape');
    await dialog.locator('input[name="template-name"]').press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.notification', { hasText: 'Template "My hexagon" saved' })).toBeVisible();

    const stored = await storedTemplates(page);
    expect(stored?.version).toBe(1);
    expect(stored?.templates.map((t) => t.name)).toEqual(['My hexagon']);
    expect(count(stored!.templates[0].xml, 'shape=hexagon')).toBe(1);
    expect(stored!.templates[0].xml.startsWith('<mxGraphModel')).toBe(true);

    // survives a reload
    await page.reload();
    await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
    await page.locator('.left-panel-tab-btn', { hasText: 'Templates' }).click();
    const user = page.locator('#templates-panel [data-section="user"] .rd-tpl-tile');
    await expect(user).toHaveCount(1);
    await expect(user.locator('.rd-tpl-name')).toHaveText('My hexagon');
    await expect(user.locator('.rd-tpl-desc')).toHaveText('one shape');

    // insert it
    await page.evaluate(() => localStorage.removeItem('railway-drawer-cache'));
    await user.click();
    await page.locator('.rd-tpl-popover [data-action="insert"]').click();
    await waitForCachedCount(page, 'shape=hexagon', 3);

    // rename (popover entry)
    await user.click();
    await page.locator('.rd-tpl-popover [data-action="rename"]').click();
    await expect(dialog.locator('input[name="template-name"]')).toHaveValue('My hexagon');
    await dialog.locator('input[name="template-name"]').fill('Hexagon yard');
    await dialog.locator('.rd-tpl-btn-primary').click();
    await expect(user.locator('.rd-tpl-name')).toHaveText('Hexagon yard');
    expect((await storedTemplates(page))?.templates.map((t) => t.name)).toEqual(['Hexagon yard']);

    // delete (tile button, confirm)
    await user.locator('.rd-tpl-delete').click();
    await page.locator('.rd-tpl-modal .rd-tpl-btn-danger').click();
    await expect(user).toHaveCount(0);
    await expect(page.locator('#templates-panel [data-section="user"] .rd-tpl-empty')).toBeVisible();
    expect((await storedTemplates(page))?.templates).toEqual([]);

    expect(pageErrors).toEqual([]);
  });
});
