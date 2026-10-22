/**
 * @file ux-batch2b.spec.ts
 * @brief UX batch 2b: ERTMS palette first (captions, EN/PL search), palette click placement (next
 *        to the selection, onto a selected track, cascade), scenario "⋯" menus, the start card,
 *        template display names, narrow-screen banner. Runs on any port.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openLeftTab } from './menu-helpers';

const PALETTE = '#drawio-palette-container';

async function inGraph<T>(page: Page, body: string, arg?: unknown): Promise<T> {
  return page.evaluate(async ({ body, arg }) => {
    const registry = await import('/src/services/service-registry.ts' as string);
    const tab = registry.ServiceRegistry.getTabManager().getActiveTab();
    return new Function('graph', 'tab', 'arg', body)(tab.graph, tab, arg);
  }, { body, arg }) as Promise<T>;
}

interface Box { x: number; y: number; width: number; height: number }

/** Absolute bounds of the selected cell. */
function selectedBox(page: Page): Promise<Box> {
  return inGraph<Box>(page, `
    const c = graph.getSelectionCell();
    const g = c.getGeometry();
    let x = g.x, y = g.y, p = c.parent;
    while (p && p.getGeometry && p.getGeometry() && !p.getGeometry().relative) { x += p.getGeometry().x; y += p.getGeometry().y; p = p.parent; }
    return { x, y, width: g.width, height: g.height };`);
}

const topLevelCount = (page: Page): Promise<number> => inGraph<number>(page, 'return graph.getDefaultParent().children.length;');

async function fresh(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
  await page.locator(`${PALETTE} section[data-palette-id="ertms"] .rd-dp-item`).first().waitFor();
}

test.describe('UX batch 2b', () => {
  test('ERTMS palette first and expanded, captioned, found by Polish names', async ({ page }) => {
    await fresh(page);
    const headers = page.locator(`${PALETTE} .rd-dp-category:not([hidden]) .rd-dp-header-title`);
    await expect(headers.first()).toHaveText('ERTMS');
    const ertms = page.locator(`${PALETTE} section[data-palette-id="ertms"]`);
    await expect(ertms.locator('.rd-dp-header')).toHaveAttribute('aria-expanded', 'true');
    await expect(ertms.locator('.rd-dp-caption')).toHaveCount(18);
    await expect(ertms.locator('.rd-dp-item[title="Signal Right 4"] .rd-dp-caption')).toHaveText('Signal Right 4');

    // the ERTMS section's hits (the railway libraries after it have more, see railway-shapes.spec.ts)
    const visibleTitles = () =>
      page.locator(`${PALETTE} section[data-palette-id="ertms"]:not([hidden]) .rd-dp-item:not([hidden])`).evaluateAll((n) => n.map((e) => (e as HTMLElement).title));
    await page.locator(`${PALETTE} .rd-dp-search`).fill('zwrotnica');
    await expect.poll(visibleTitles).toEqual(['Point Left', 'Point Right']);
    await page.locator(`${PALETTE} .rd-dp-search`).fill('semafor');
    await expect.poll(visibleTitles).toEqual(['Signal Left 3', 'Signal Right 3', 'Signal Right 4']);
    await page.locator(`${PALETTE} .rd-dp-search`).fill('balisa');
    await expect.poll(visibleTitles).toEqual(['Single Balise Right', 'Balise Left']);
  });

  test('palette clicks: next to the selection (connected), onto a selected track, cascade; one undo each', async ({ page }) => {
    await fresh(page);
    const general = page.locator(`${PALETTE} section[data-palette-id="general"]`);
    const ertms = page.locator(`${PALETTE} section[data-palette-id="ertms"]`);

    // cascade: nothing selected, successive clicks do not overlap
    const boxes: Box[] = [];
    for (let i = 0; i < 3; i++) {
      await inGraph(page, 'graph.clearSelection();');
      await general.locator('.rd-dp-item[title="Rectangle"]').click();
      await expect.poll(() => topLevelCount(page)).toBe(i + 1);
      boxes.push(await selectedBox(page));
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
        expect(overlap, `${i}/${j}`).toBe(false);
      }
    }

    // next to the selected rectangle, connected, one undo step
    const source = boxes[2];
    const before = await topLevelCount(page);
    await general.locator('.rd-dp-item[title="Ellipse"]').click();
    await expect.poll(() => topLevelCount(page)).toBe(before + 2);
    const ellipse = await selectedBox(page);
    expect(ellipse.x).toBeGreaterThan(source.x + source.width);
    expect(Math.abs(ellipse.y + ellipse.height / 2 - (source.y + source.height / 2))).toBeLessThan(25);
    expect(await inGraph<number>(page, 'return graph.getDefaultParent().children.filter((c) => c.isEdge() && c.target === graph.getSelectionCell()).length;')).toBe(1);
    await page.locator('#graph-container').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => topLevelCount(page)).toBe(before);

    // a balise clicked while a track is selected goes onto that track
    await inGraph(page, 'graph.clearSelection();');
    await ertms.locator('.rd-dp-item[title="Track"]').click();
    const trackCellId = await inGraph<string>(page, 'return graph.getSelectionCell().id;');
    const withTrack = await topLevelCount(page);
    await ertms.locator('.rd-dp-item[title="Single Balise Right"]').click();
    await expect.poll(() => topLevelCount(page)).toBe(withTrack + 1);
    // snapped onto the selected track: its track reference is that track's object id
    const ids = await page.evaluate(async (trackId) => {
      const registry = await import('/src/services/service-registry.ts' as string);
      const od = await import('/src/railway/object-data.ts' as string);
      const graph = registry.ServiceRegistry.getTabManager().getActiveTab().graph;
      const track = graph.getDataModel().getCell(trackId);
      return { track: od.readObjectId(track) as string, ref: od.readObjectValues(graph.getSelectionCell()).trackId as string };
    }, trackCellId);
    expect(ids.track).toBeTruthy();
    expect(ids.ref).toBe(ids.track);
    // no edge to the track: placed on it, not connected
    expect(await inGraph<number>(page, 'return graph.getDefaultParent().children.filter((c) => c.isEdge() && c.target === graph.getSelectionCell()).length;')).toBe(0);
    await page.locator('#graph-container').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => topLevelCount(page)).toBe(withTrack);
  });

  test('scenario rows: Present button and a "⋯" menu with text actions', async ({ page }) => {
    await fresh(page);
    await page.locator('[data-right-panel="scenarios"]').click();
    const panel = page.locator('#scenarios-panel');
    await panel.locator('.rd-scn-new').click();
    await page.locator('.rd-tpl-modal button', { hasText: 'Create' }).click();
    const head = panel.locator('.rd-scn-head');
    await expect(head.locator('.rd-scn-play')).toHaveText('▶ Present');
    await expect(head.locator('.rd-scn-play')).toBeDisabled();
    for (const target of [head.locator('.rd-scn-play'), head.locator('.rd-scn-more'), panel.locator('.rd-scn-new'), panel.locator('.rd-scn-add-step')]) {
      const box = await target.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(24);
    }
    await head.locator('.rd-scn-more').click();
    const menu = panel.locator('.rd-scn-menu:not([hidden])');
    await expect(menu.locator('[role="menuitem"]')).toHaveText(['Edit…', 'Duplicate', 'Export HTML', 'Export PDF', 'Export Slides', 'Delete…']);
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(head.locator('.rd-scn-more')).toBeFocused();
    await head.locator('.rd-scn-more').click();
    await menu.locator('.rd-scn-duplicate').click();
    await expect(panel.locator('.rd-scn-item')).toHaveCount(2);
    await expect(panel.locator('.rd-scn-name').nth(1)).toHaveAttribute('title', /.+/);
  });

  test('start card: shown on an empty tab, Esc / insert / "Don\'t show again", drops pass', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('rd.startCard.force', '1'));
    await fresh(page);
    await page.evaluate(() => localStorage.setItem('rd.startCard.force', '1'));
    await page.reload();
    const card = page.locator('.rd-start-card');
    await expect(card).toBeVisible();
    await expect(card.locator('.rd-start-action .rd-start-label')).toHaveText([
      'Insert ERTMS symbols',
      'Open template…',
      'Open file…',
      'Import railML…',
      'Railway Script…',
    ]);
    await page.keyboard.press('Escape');
    await expect(card).toBeHidden();

    // a new empty tab shows it again; dropping a palette shape onto the canvas works and hides it
    const newTab = (): Promise<unknown> =>
      page.evaluate(async () => {
        const registry = await import('/src/services/service-registry.ts' as string);
        registry.ServiceRegistry.getTabManager().openNewTab();
      });
    await newTab();
    await expect(card).toBeVisible();
    // drag (mouse, HTML5 DnD) a palette tile and drop it right where the card is: the card steps aside
    const tile = page.locator(`${PALETTE} section[data-palette-id="general"] .rd-dp-item[title="Rectangle"]`);
    await tile.hover();
    await page.mouse.down();
    const cardBox = (await card.boundingBox())!;
    await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => topLevelCount(page)).toBe(1);
    await expect(card).toBeHidden();

    // "Insert ERTMS symbols" focuses the ERTMS palette
    await newTab();
    await expect(card).toBeVisible();
    await card.locator('[data-start-action="ertms"]').click();
    await expect(card).toBeHidden();
    await expect(page.locator(`${PALETTE} section[data-palette-id="ertms"] .rd-dp-item`).first()).toBeFocused();

    // "Don't show again"
    await newTab();
    await expect(card).toBeVisible();
    await card.locator('.rd-start-never').click();
    await expect(card).toBeHidden();
    await page.reload();
    await page.locator(`${PALETTE} section[data-palette-id="ertms"] .rd-dp-item`).first().waitFor();
    await expect(card).toBeHidden();
  });

  test('templates have topic names (original name in the tooltip)', async ({ page }) => {
    await fresh(page);
    await openLeftTab(page, 'templates');
    const tiles = page.locator('#templates-panel [data-section="builtin"] .rd-tpl-tile');
    await expect(tiles).toHaveCount(19);
    await expect(tiles.first().locator('.rd-tpl-name')).toHaveText('Section timer (L1)');
    await expect(tiles.first()).toHaveAttribute('title', /ERTMS scenario 1/);
    const names = await tiles.locator('.rd-tpl-name').allTextContents();
    expect(names.some((n) => /^ERTMS scenario/.test(n))).toBe(false);
    expect(new Set(names).size).toBe(19);
    await tiles.first().hover();
    await expect(page.locator('.rd-tpl-preview:not([hidden]) svg')).toBeVisible();
  });

  test('390 px: rd-narrow, banner (dismissible) and a usable canvas', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.locator('body')).toHaveClass(/rd-narrow/);
    const banner = page.locator('.rd-narrow-banner');
    await expect(banner).toBeVisible();
    const width = await page.locator('#graph-container').evaluate((e) => e.getBoundingClientRect().width);
    expect(width).toBeGreaterThan(300);
    await banner.locator('.rd-narrow-banner-close').click();
    await expect(banner).toBeHidden();
    await page.reload();
    await expect(page.locator('body')).toHaveClass(/rd-narrow/);
    await expect(banner).toBeHidden();
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator('body')).not.toHaveClass(/rd-narrow/);
  });
});
