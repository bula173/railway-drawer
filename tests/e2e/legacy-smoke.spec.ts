/**
 * @file legacy-smoke.spec.ts
 * @brief Smoke test for the default (legacy maxGraph) editor and the editor switch.
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

async function expectLegacyLoaded(page: Page): Promise<void> {
  await expect(page.locator('body')).toHaveAttribute('data-editor', 'legacy');
  await expect(page.locator('#app-container')).toBeVisible();
  await expect(page.locator('#tabs-container .tab-button')).not.toHaveCount(0);
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
  await expect(page.locator('#graph-container > div:visible svg')).toHaveCount(1);
}

test.describe('legacy maxGraph editor', () => {
  test('loads, drops a shape, undoes/redoes it and keeps it across a draw.io round trip', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/');
    await expectLegacyLoaded(page);
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

    // Switch to draw.io: the pending legacy autosave is flushed before the reload
    await page.locator('.editor-toggle [data-editor-mode="drawio"]').click();
    await page.waitForURL(/[?&]editor=drawio/);
    await expect(page.locator('body')).toHaveAttribute('data-editor', 'drawio');
    await expect(page.locator('[data-testid=drawio-workspace]')).toBeVisible();
    await expect(page.locator('#app-container')).toBeHidden();

    // ...and back: the dropped shape was restored from the browser cache
    await page.getByRole('button', { name: 'maxGraph editor' }).click();
    await page.waitForURL(/[?&]editor=legacy/);
    await expectLegacyLoaded(page);
    await expect(page.locator('[data-testid=drawio-workspace]')).toHaveCount(0);
    await expect(drawPaneNodes(page)).not.toHaveCount(0);

    expect(pageErrors).toEqual([]);
  });

  test('View menu switches to draw.io', async ({ page }) => {
    await page.goto('/');
    await expectLegacyLoaded(page);
    await page.locator('.menu-item[data-menu="view"]').click();
    await page.locator('.menu-dropdown-item[data-action="switchEditorDrawio"]').click();
    await page.waitForURL(/[?&]editor=drawio/);
    await expect(page.locator('[data-testid=drawio-workspace]')).toBeVisible();
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
    expect(ownRequests.filter((url) => /maxgraph|legacy-main/i.test(url))).toEqual([]);
  });
});
