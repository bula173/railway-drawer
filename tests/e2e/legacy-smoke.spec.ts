/**
 * @file legacy-smoke.spec.ts
 * @brief Smoke test for the Railway Drawer editor (maxGraph). The file keeps its old name (CI lists it).
 *
 * The embedded draw.io mode was removed: old `?editor=` links must still open the editor.
 */

import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/** Nodes in the draw pane of the visible tab's graph: one or more per rendered cell, none when empty. */
function drawPaneNodes(page: Page): Locator {
  return page.locator('#graph-container > div:visible svg > g > g:nth-child(2) > *');
}

async function expectMainLoaded(page: Page): Promise<void> {
  await expect(page.locator('#app-container')).toBeVisible();
  await expect(page.locator('#tabs-container .tab-button')).not.toHaveCount(0);
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
  await expect(page.locator('#graph-container > div:visible svg')).toHaveCount(1);
}

test.describe('main Railway Drawer editor', () => {
  test('loads, drops a shape, undoes/redoes it and keeps it across a reload', async ({ page }) => {
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

    // Reload: the pending autosave is flushed on unload and the shape is restored from the browser cache
    await page.reload();
    await expectMainLoaded(page);
    await expect(drawPaneNodes(page)).not.toHaveCount(0);

    expect(pageErrors).toEqual([]);
  });

  test('the removed draw.io mode: View menu has no switch, old ?editor= links open the editor', async ({ page }) => {
    await page.goto('/');
    await expectMainLoaded(page);
    await expect(page.locator('.editor-toggle')).toHaveCount(0);
    await page.locator('.menu-item[data-menu="view"]').click();
    await expect(page.locator('.menu-dropdown-item[data-action="switchEditorDrawio"]')).toHaveCount(0);

    // The remembered mode of the former mode switch is dropped on boot, whatever it says
    for (const mode of ['drawio', 'legacy', 'main']) {
      await page.evaluate((m) => localStorage.setItem('railway-drawer-editor-mode', m), mode);
      await page.goto(`/?editor=${mode}`);
      await expectMainLoaded(page);
      await expect(page.locator('#app-container')).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem('railway-drawer-editor-mode'))).toBeNull();
    }
  });

  test("the former draw.io view's autosaved document opens once as new tabs", async ({ page }) => {
    await page.goto('/');
    await expectMainLoaded(page);
    const xml =
      '<mxfile host="app.diagrams.net"><diagram id="p1" name="Old draw.io page"><mxGraphModel><root>' +
      '<mxCell id="0"/><mxCell id="1" parent="0"/>' +
      '<mxCell id="v1" value="Kept" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="1">' +
      '<mxGeometry x="40" y="40" width="120" height="60" as="geometry"/></mxCell>' +
      '</root></mxGraphModel></diagram>' +
      '<diagram id="p2" name="Blank page"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram>' +
      '</mxfile>';
    await page.evaluate((doc) => {
      localStorage.clear();
      localStorage.setItem('railway-drawer-drawio-doc', JSON.stringify({ xml: doc, title: 'Old', savedAt: '' }));
    }, xml);
    await page.reload();
    await expect(page.locator('.notification', { hasText: 'Opened the diagram of the former draw.io view in a new tab' })).toBeVisible();
    // the lone empty start tab is replaced; the blank page is skipped
    await expect(page.locator('#tabs-container .tab-button')).toHaveCount(1);
    await expect(page.locator('#tabs-container .tab-button.active')).toContainText('Old draw.io page');
    await expect(drawPaneNodes(page)).not.toHaveCount(0);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('railway-drawer-drawio-doc'))).toBeNull();

    // ...and only once
    await page.reload();
    await expectMainLoaded(page);
    await expect(page.locator('#tabs-container .tab-button')).toHaveCount(1);
  });
});
