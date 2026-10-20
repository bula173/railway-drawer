/**
 * @file scenarios.spec.ts
 * @brief Scenarios (right panel "Scenarios"): create a scenario, add 3 steps while the drawing
 *        changes, present them on the canvas with the arrow keys, back to editing restores the
 *        live drawing (and its undo history), rename/reorder/delete steps, reload, File > Save
 *        writes one draw.io page per step, and opening that file restores the scenarios.
 *
 * Runs on any port (no draw.io server involved). The live drawing is checked through the 5 s
 * autosave into localStorage `railway-drawer-cache`.
 */
import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const HEXAGON = '#drawio-palette-container section[data-palette-id="general"] .rd-dp-item[title="Hexagon"]';

interface CachedTab {
  name?: string;
  graphXml?: string;
  scenarios?: Array<{ name: string; steps: Array<{ name: string; xml: string }> }>;
}

function cachedTabs(page: Page): Promise<CachedTab[]> {
  return page.evaluate(() => {
    try {
      const cache = JSON.parse(localStorage.getItem('railway-drawer-cache') ?? 'null') as { data?: { tabs?: CachedTab[] } } | null;
      return cache?.data?.tabs ?? [];
    } catch {
      return [];
    }
  });
}

function count(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

async function hexagonsInCache(page: Page): Promise<number> {
  const tabs = await cachedTabs(page);
  return count(tabs.map((t) => t.graphXml ?? '').join('\n'), 'shape=hexagon');
}

async function waitForHexagons(page: Page, n: number): Promise<void> {
  await expect.poll(() => hexagonsInCache(page), { timeout: 15_000 }).toBe(n);
}

/** Number of hexagon shapes drawn in the scenario view. */
function viewShapes(page: Page): Promise<number> {
  return page.locator('[data-testid="scenario-view"] .rd-scn-view-host svg path').count();
}

async function answer(page: Page, name?: string, description?: string): Promise<void> {
  const dialog = page.locator('.rd-tpl-modal');
  await expect(dialog).toBeVisible();
  if (name !== undefined) await dialog.locator('input[name="template-name"]').fill(name);
  if (description !== undefined) await dialog.locator('input[name="template-description"]').fill(description);
  await dialog.locator('.rd-tpl-btn-primary, .rd-tpl-btn-danger').click();
  await expect(dialog).toHaveCount(0);
}

async function freshApp(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
}

test.describe('scenarios', () => {
  test('create, add steps, present, edit, persist, save as pages and reopen', async ({ page }) => {
    test.setTimeout(120_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await freshApp(page);

    // Properties is the default view of the right panel
    await expect(page.locator('#property-content')).toBeVisible();
    await expect(page.locator('#scenarios-panel')).toBeHidden();
    await page.locator('[data-right-panel="scenarios"]').click();
    const panel = page.locator('#scenarios-panel');
    await expect(panel).toBeVisible();
    await expect(page.locator('#property-content')).toBeHidden();
    await expect(panel.locator('.rd-scn-empty')).toBeVisible();

    await panel.locator('.rd-scn-new').click();
    await answer(page, 'Wjazd pociągu', 'Pociąg wjeżdża na stację');
    await expect(panel.locator('.rd-scn-name')).toHaveText('Wjazd pociągu');

    // 3 steps: 1, 2 and 3 hexagons
    for (let i = 1; i <= 3; i++) {
      await page.locator(HEXAGON).click();
      await waitForHexagons(page, i);
      await panel.locator('.rd-scn-add-step').click();
      await answer(page, `Krok ${i}`);
    }
    const stepNames = panel.locator('.rd-scn-step-name');
    await expect(stepNames).toHaveText(['Krok 1', 'Krok 2', 'Krok 3']);
    await expect(panel.locator('.rd-scn-count')).toHaveText('3 steps');
    await expect(panel.locator('.rd-scn-thumb-ready')).toHaveCount(3);

    // present: click step 1, then the arrow keys
    const liveDiv = page.locator('#graph-container > div[id^="graph-tab-"]');
    const banner = page.locator('.rd-scn-banner-title');
    await panel.locator('.rd-scn-step').first().click();
    await expect(banner).toHaveText('Wjazd pociągu — step 1/3: Krok 1');
    await expect(liveDiv).toBeHidden();
    const perHexagon = await viewShapes(page);
    expect(perHexagon).toBeGreaterThan(0);
    await page.keyboard.press('ArrowRight');
    await expect(banner).toHaveText('Wjazd pociągu — step 2/3: Krok 2');
    await expect.poll(() => viewShapes(page)).toBe(2 * perHexagon);
    await page.keyboard.press('ArrowRight');
    await expect(banner).toHaveText('Wjazd pociągu — step 3/3: Krok 3');
    await expect.poll(() => viewShapes(page)).toBe(3 * perHexagon);
    await expect(panel.locator('.rd-scn-step.rd-scn-step-active .rd-scn-step-name')).toHaveText('Krok 3');
    await page.screenshot({ path: test.info().outputPath('scenario-view.png') });
    await page.keyboard.press('ArrowLeft');
    await expect(banner).toHaveText('Wjazd pociągu — step 2/3: Krok 2');
    await page.locator('.rd-scn-prev').click();
    await expect(banner).toHaveText('Wjazd pociągu — step 1/3: Krok 1');
    await expect.poll(() => viewShapes(page)).toBe(perHexagon);
    // editing shortcuts do nothing to the hidden live drawing
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Delete');
    // Esc: back to editing
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="scenario-view"]')).toBeHidden();
    await expect(liveDiv).toBeVisible();
    await waitForHexagons(page, 3);
    // the live undo history is intact
    await page.locator('#graph-container').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Control+z');
    await waitForHexagons(page, 2);
    await page.keyboard.press('Control+y');
    await waitForHexagons(page, 3);

    // rename step 2
    await panel.locator('.rd-scn-step').nth(1).locator('.rd-scn-more').click();
    await panel.locator('.rd-scn-step').nth(1).locator('.rd-scn-step-edit').click();
    await answer(page, 'Zajęcie odcinka', 'S2 → czerwony');
    await expect(stepNames).toHaveText(['Krok 1', 'Zajęcie odcinka', 'Krok 3']);
    await expect(panel.locator('.rd-scn-step').nth(1).locator('.rd-scn-step-desc')).toHaveText('S2 → czerwony');

    // reorder: ↓ on step 1, then drag it back to the top
    await panel.locator('.rd-scn-step').first().locator('.rd-scn-more').click();
    await panel.locator('.rd-scn-step').first().locator('.rd-scn-step-down').click();
    await expect(stepNames).toHaveText(['Zajęcie odcinka', 'Krok 1', 'Krok 3']);
    await panel.locator('.rd-scn-step').nth(1).dragTo(panel.locator('.rd-scn-step').first(), { targetPosition: { x: 20, y: 4 } });
    await expect(stepNames).toHaveText(['Krok 1', 'Zajęcie odcinka', 'Krok 3']);

    // delete step 3 (confirmed)
    await panel.locator('.rd-scn-step').nth(2).locator('.rd-scn-more').click();
    await panel.locator('.rd-scn-step').nth(2).locator('.rd-scn-step-delete').click();
    await answer(page);
    await expect(stepNames).toHaveText(['Krok 1', 'Zajęcie odcinka']);

    // reload: kept in the tab cache
    await expect
      .poll(async () => (await cachedTabs(page))[0]?.scenarios?.[0]?.steps.map((s) => s.name), { timeout: 15_000 })
      .toEqual(['Krok 1', 'Zajęcie odcinka']);
    await page.reload();
    await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
    await page.locator('[data-right-panel="scenarios"]').click();
    await expect(panel.locator('.rd-scn-name')).toHaveText('Wjazd pociągu');
    await panel.locator('.rd-scn-toggle').click();
    await expect(stepNames).toHaveText(['Krok 1', 'Zajęcie odcinka']);

    // File > Save downloads the .drawio file with one page per step
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.menu-item[data-menu="file"]').click();
    await page.locator('.menu-dropdown-item[data-action="save"]').click();
    const download = await downloadPromise;
    const filePath = await download.path();
    const xml = await readFile(filePath, 'utf8');
    const pageNames = [...xml.matchAll(/<diagram [^>]*?name="([^"]*)"/g)].map((m) => m[1]);
    expect(pageNames.slice(1)).toEqual(['Wjazd pociągu / 1. Krok 1', 'Wjazd pociągu / 2. Zajęcie odcinka']);
    expect(xml).toContain('rdScenarios=');
    expect(xml).toContain('rdStepName="Zajęcie odcinka"');

    // open it in a new tab: the scenarios come back
    await page.locator('#tabs-container .tab-new-btn').click();
    await expect(page.locator('#tabs-container .tab-button')).toHaveCount(2);
    await page.locator('#tabs-container .tab-button').nth(1).click();
    await expect(panel.locator('.rd-scn-empty')).toBeVisible();
    const chooserPromise = page.waitForEvent('filechooser');
    await page.locator('.menu-item[data-menu="file"]').click();
    await page.locator('.menu-dropdown-item[data-action="open"]').click();
    const chooser = await chooserPromise;
    await chooser.setFiles({ name: 'scenarios.drawio', mimeType: 'application/xml', buffer: Buffer.from(xml) });
    await expect(panel.locator('.rd-scn-name')).toHaveText('Wjazd pociągu');
    await panel.locator('.rd-scn-toggle').click();
    await expect(stepNames).toHaveText(['Krok 1', 'Zajęcie odcinka']);
    // only the first page is the drawing: no "pages not loaded" warning for the step pages
    await expect(page.locator('.notification', { hasText: 'only the first page is shown' })).toHaveCount(0);
    await panel.locator('.rd-scn-step').nth(1).click();
    await expect(banner).toHaveText('Wjazd pociągu — step 2/2: Zajęcie odcinka');
    await expect.poll(() => viewShapes(page)).toBe(2 * perHexagon);
    await page.locator('.rd-scn-exit').click();
    await expect(page.locator('[data-testid="scenario-view"]')).toBeHidden();

    expect(pageErrors).toEqual([]);
  });

  test('replace drawing with a step is confirmed and undoable', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await freshApp(page);
    await page.locator('[data-right-panel="scenarios"]').click();
    const panel = page.locator('#scenarios-panel');
    await panel.locator('.rd-scn-new').click();
    await answer(page, 'S');
    await page.locator(HEXAGON).click();
    await waitForHexagons(page, 1);
    await panel.locator('.rd-scn-add-step').click();
    await answer(page, 'one');
    await page.locator(HEXAGON).click();
    await page.locator(HEXAGON).click();
    await waitForHexagons(page, 3);

    await panel.locator('.rd-scn-play').click();
    await expect(page.locator('.rd-scn-banner-title')).toHaveText('S — step 1/1: one');
    // cancel keeps everything
    await page.locator('.rd-scn-replace').click();
    await page.locator('.rd-tpl-modal .rd-tpl-btn:not(.rd-tpl-btn-danger)').click();
    await expect(page.locator('[data-testid="scenario-view"]')).toBeVisible();
    await page.locator('.rd-scn-replace').click();
    await answer(page);
    await expect(page.locator('[data-testid="scenario-view"]')).toBeHidden();
    await waitForHexagons(page, 1);
    await page.keyboard.press('Control+z');
    await waitForHexagons(page, 3);
    expect(pageErrors).toEqual([]);
  });
});
