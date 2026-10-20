/**
 * @file share.spec.ts
 * @brief Share dialog: "Copy link with diagram" (#R link in the URL hash) opens the same tabs in a
 *        fresh browser (also when that browser remembers the draw.io editor mode), downloads
 *        (.drawio, PNG, SVG), broken links report an error, SharePoint shows "Not configured".
 *
 * Runs on any port; no network services are involved.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

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

async function freshApp(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
}

async function tabNames(page: Page): Promise<string[]> {
  return page.locator('#tabs-container .tab-button').evaluateAll((tabs) =>
    tabs.map((t) => (t.querySelector('.tab-label, .tab-name, span')?.textContent ?? t.textContent ?? '').replace('×', '').trim())
  );
}

test.describe('share', () => {
  test('copy link -> a fresh browser opens the same tabs; SharePoint not configured', async ({ page, context, browser, baseURL }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL });
    await freshApp(page);

    // Tab 1: a hexagon; tab 2: an ERTMS template opened as a new diagram
    await page.locator('#drawio-palette-container section[data-palette-id="general"] .rd-dp-item[title="Hexagon"]').click();
    await page.locator('.left-panel-tab-btn', { hasText: 'Templates' }).click();
    await page.locator('#templates-panel [data-section="builtin"] .rd-tpl-tile').nth(1).click();
    await page.locator('.rd-tpl-popover [data-action="open"]').click();
    await expect(page.locator('#tabs-container .tab-button')).toHaveCount(2);
    await expect(page.locator('#tabs-container .tab-button.active')).toContainText('MA length and speed');

    // Share dialog from the top bar
    await page.locator('#share-btn').click();
    const dialog = page.locator('[data-testid="share-dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('role', 'dialog');
    await expect(dialog.locator('[data-testid="share-provider-sharepoint-status"]')).toHaveText('Not configured');
    await expect(dialog.locator('[data-testid="share-provider-sharepoint-howto"] summary')).toHaveText('How to enable');
    const linkInput = dialog.locator('[data-testid="share-link"]');
    await expect(linkInput).toHaveValue(/#R[A-Za-z0-9_-]+$/);
    await expect(dialog.locator('[data-testid="share-link-length"]')).toContainText('Link length:');
    await expect(dialog.locator('[data-testid="share-open-drawio"]')).toHaveAttribute('href', /^https:\/\/app\.diagrams\.net\/#R/);

    await dialog.locator('[data-testid="share-copy-link"]').click();
    await expect(page.locator('.notification', { hasText: 'Link copied' })).toBeVisible();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toBe(await linkInput.inputValue());
    expect(link.startsWith(`${baseURL}/#R`)).toBe(true);

    // Escape closes the dialog
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    // The sender's diagram, for comparison
    await expect.poll(async () => (await cachedXml(page)).includes('shape=hexagon'), { timeout: 15_000 }).toBe(true);

    // A fresh browser that still remembers the removed draw.io editor mode opens the link in the editor
    const other = await browser.newContext();
    await other.addInitScript(() => {
      if (!sessionStorage.getItem('rd-e2e-init')) {
        sessionStorage.setItem('rd-e2e-init', '1');
        localStorage.setItem('railway-drawer-editor-mode', 'drawio');
      }
    });
    const receiver = await other.newPage();
    const receiverErrors: string[] = [];
    receiver.on('pageerror', (err) => receiverErrors.push(err.message));
    await receiver.goto(link);
    await expect(receiver.locator('#tabs-container .tab-button.active')).toHaveCount(1);
    await expect(receiver.locator('.notification', { hasText: 'Opened the shared diagram in 2 new tabs' })).toBeVisible();
    // the lone empty start tab was replaced by the two shared tabs
    await expect(receiver.locator('#tabs-container .tab-button')).toHaveCount(2);
    const names = await tabNames(receiver);
    expect(names.join('|')).toContain('Diagram 1');
    expect(names.join('|')).toContain('MA length and speed');
    // the hash is gone (a reload does not open the diagram again)
    expect(receiver.url()).not.toContain('#R');
    await expect.poll(async () => (await cachedXml(receiver)).includes('shape=hexagon'), { timeout: 15_000 }).toBe(true);
    // the remembered mode of the removed mode switch is dropped on boot
    expect(await receiver.evaluate(() => localStorage.getItem('railway-drawer-editor-mode'))).toBeNull();
    expect(receiverErrors).toEqual([]);
    await other.close();

    expect(pageErrors).toEqual([]);
  });

  test('downloads .drawio, PNG and SVG from the Share dialog', async ({ page }) => {
    await freshApp(page);
    await page.locator('#drawio-palette-container section[data-palette-id="general"] .rd-dp-item[title="Hexagon"]').click();
    // File > Share…
    await page.locator('.menu-item[data-menu="file"]').click();
    await page.locator('.menu-dropdown-item[data-action="share"]').click();
    const dialog = page.locator('[data-testid="share-dialog"]');
    await expect(dialog).toBeVisible();
    // not bound to a cloud file: no "Stored in:" status item
    await expect(page.locator('#status-remote-item')).toBeHidden();

    const [drawio] = await Promise.all([page.waitForEvent('download'), dialog.locator('[data-testid="share-download-drawio"]').click()]);
    expect(drawio.suggestedFilename()).toMatch(/\.drawio$/);
    const drawioText = await (await drawio.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
    expect(drawioText.startsWith('<mxfile')).toBe(true);
    expect(drawioText).toContain('shape=hexagon');

    const [png] = await Promise.all([page.waitForEvent('download'), dialog.locator('[data-testid="share-export-png"]').click()]);
    expect(png.suggestedFilename()).toMatch(/\.png$/);
    const pngBytes = await (await png.createReadStream()).toArray().then((c) => Buffer.concat(c));
    expect(pngBytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(pngBytes.length).toBeGreaterThan(500);

    const [svg] = await Promise.all([page.waitForEvent('download'), dialog.locator('[data-testid="share-export-svg"]').click()]);
    expect(svg.suggestedFilename()).toMatch(/\.svg$/);
    const svgText = await (await svg.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8'));
    expect(svgText).toContain('<svg');
  });

  test('a damaged link shows an error and keeps the current diagram', async ({ page }) => {
    await freshApp(page);
    await page.goto('/#Rthis-is-not-a-diagram');
    await expect(page.locator('.notification', { hasText: 'Could not open the shared diagram' })).toBeVisible();
    await expect(page.locator('#tabs-container .tab-button')).toHaveCount(1);
    expect(page.url()).not.toContain('#R');
  });
});
