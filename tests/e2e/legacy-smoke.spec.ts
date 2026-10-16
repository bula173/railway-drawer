/**
 * @file legacy-smoke.spec.ts
 * @brief Smoke test for the main Railway Drawer editor (maxGraph, the default) and the switch to
 *        the draw.io compatibility view and back. The file keeps its old name (CI lists it).
 *
 * Runs on any port; the draw.io iframe itself is not needed (only the draw.io workspace
 * toolbar is used to switch back), so a 403 from embed.diagrams.net does not matter here.
 */

import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/** Nodes in the draw pane of the visible tab's graph: one or more per rendered cell, none when empty. */
function drawPaneNodes(page: Page): Locator {
  return page.locator('#graph-container > div:visible svg > g > g:nth-child(2) > *');
}

async function expectMainLoaded(page: Page): Promise<void> {
  await expect(page.locator('body')).toHaveAttribute('data-editor', 'main');
  await expect(page.locator('#app-container')).toBeVisible();
  await expect(page.locator('#tabs-container .tab-button')).not.toHaveCount(0);
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
  await expect(page.locator('#graph-container > div:visible svg')).toHaveCount(1);
}

test.describe('main Railway Drawer editor', () => {
  test('loads, drops a shape, undoes/redoes it and keeps it across a draw.io round trip', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/');
    await expectMainLoaded(page);
    await expect(drawPaneNodes(page)).toHaveCount(0);

    // Drag the first shape of the palette onto the canvas (HTML5 drag and drop)
    const firstShape = page.locator('#shapes-container .shape-icon-only').first();
    await expect(firstShape).toBeVisible();
    await firstShape.dragTo(page.locator('#graph-container'));
    await expect(drawPaneNodes(page)).not.toHaveCount(0);

    // Ctrl/Cmd+Z goes through the single keyboard dispatcher to GraphCommandService.undo()
    await page.locator('body').press('ControlOrMeta+z');
    await expect(drawPaneNodes(page)).toHaveCount(0);
    await page.locator('body').press('ControlOrMeta+y');
    await expect(drawPaneNodes(page)).not.toHaveCount(0);

    // Switch to draw.io: the pending autosave is flushed before the reload
    await page.locator('.editor-toggle [data-editor-mode="drawio"]').click();
    await page.waitForURL(/[?&]editor=drawio/);
    await expect(page.locator('body')).toHaveAttribute('data-editor', 'drawio');
    await expect(page.locator('[data-testid=drawio-workspace]')).toBeVisible();
    await expect(page.locator('#app-container')).toBeHidden();

    // ...and back: the dropped shape was restored from the browser cache
    await page.getByRole('button', { name: 'Back to Railway Drawer editor' }).click();
    await page.waitForURL(/[?&]editor=main/);
    await expectMainLoaded(page);
    await expect(page.locator('[data-testid=drawio-workspace]')).toHaveCount(0);
    await expect(drawPaneNodes(page)).not.toHaveCount(0);

    expect(pageErrors).toEqual([]);
  });

  test('View > Open in draw.io (compatibility view)', async ({ page }) => {
    await page.goto('/');
    await expectMainLoaded(page);
    await page.locator('.menu-item[data-menu="view"]').click();
    await page.locator('.menu-dropdown-item[data-action="switchEditorDrawio"]', { hasText: 'Open in draw.io (compatibility view)' }).click();
    await page.waitForURL(/[?&]editor=drawio/);
    await expect(page.locator('[data-testid=drawio-workspace]')).toBeVisible();
  });

  test('old links and stored choices with editor=legacy open the main editor', async ({ page }) => {
    await page.goto('/?editor=legacy');
    await expectMainLoaded(page);
    expect(await page.evaluate(() => localStorage.getItem('railway-drawer-editor-mode'))).toBe('main');
    await page.evaluate(() => localStorage.setItem('railway-drawer-editor-mode', 'legacy'));
    await page.goto('/');
    await expectMainLoaded(page);
  });

  test('draw.io mode does not download the maxGraph editor', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (req) => requests.push(req.url()));
    await page.goto('/?editor=drawio');
    await expect(page.locator('[data-testid=drawio-workspace]')).toBeVisible();
    await expect(page.locator('#app-container')).toBeHidden();
    // Give lazy imports a moment to show up if they were (wrongly) triggered
    await page.waitForLoadState('networkidle').catch(() => undefined);
    const ownRequests = requests.filter((url) => new URL(url).hostname === 'localhost');
    expect(ownRequests.length).toBeGreaterThan(0);
    expect(ownRequests.filter((url) => /maxgraph|main-editor/i.test(url))).toEqual([]);
  });
});
