/**
 * @file drawio-embed.spec.ts
 * @brief Smoke test for the embedded draw.io editor (?editor=drawio).
 *
 * Needs network access to the draw.io editor (VITE_DRAWIO_URL, default
 * https://embed.diagrams.net/). Skipped when unreachable or with E2E_OFFLINE=1.
 *
 * embed.diagrams.net answers HTTP 403 to a "HeadlessChrome" user agent and to iframes
 * whose Referer has a non-default port (e.g. http://localhost:3000/). The chromium project
 * uses the Desktop Chrome device profile (regular UA); serve the app on a default port:
 *   E2E_PORT=80 npx playwright test tests/e2e/drawio-embed.spec.ts --project=chromium
 * or point VITE_DRAWIO_URL at a self-hosted draw.io. When the editor document is
 * refused the tests skip themselves with that hint instead of failing.
 */

import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const DRAWIO_URL = process.env.VITE_DRAWIO_URL ?? 'https://embed.diagrams.net/';
const AUTOSAVE_KEY = 'railway-drawer-drawio-doc';
const DRAWIO_ORIGIN = new URL(DRAWIO_URL, 'http://localhost:3000/').origin;
const READY_TIMEOUT = 30000;

/** Opens the draw.io mode; skips the test if the editor document is refused (HTTP 4xx/5xx). */
async function openDrawioMode(page: Page): Promise<void> {
  const editorResponse = page
    .waitForResponse(
      (r) => r.url().startsWith(DRAWIO_ORIGIN) && r.request().resourceType() === 'document',
      { timeout: READY_TIMEOUT }
    )
    .then((r) => r.status())
    .catch(() => 0);
  await page.goto('/?editor=drawio');
  const status = await editorResponse;
  test.skip(
    status >= 400,
    `draw.io refused the embed request (HTTP ${status}) from ${page.url()}; run with E2E_PORT=80 or a self-hosted VITE_DRAWIO_URL`
  );
  await expect(page.locator('[data-testid=drawio-embed]')).toHaveAttribute('data-state', 'ready', {
    timeout: READY_TIMEOUT,
  });
}

let drawioReachable = false;

test.describe('draw.io embed', () => {
  test.beforeAll(async ({ request }) => {
    if (process.env.E2E_OFFLINE === '1') return;
    try {
      const response = await request.get(DRAWIO_URL, { timeout: 5000 });
      drawioReachable = response.ok();
    } catch {
      drawioReachable = false;
    }
  });

  test.beforeEach(({ browserName }) => {
    test.setTimeout(120000);
    test.skip(browserName !== 'chromium', 'draw.io embed smoke test runs on chromium only');
    test.skip(!drawioReachable, 'draw.io unreachable (offline)');
  });

  test('loads with the ERTMS library, downloads uncompressed XML and restores after reload', async ({ page }) => {
    await openDrawioMode(page);

    const frame = page.frameLocator('iframe[title="draw.io editor"]');
    const ertmsTitle = frame.locator('.geSidebarContainer a.geTitle', { hasText: /^ERTMS$/ }).first();
    await expect(ertmsTitle).toBeVisible({ timeout: READY_TIMEOUT });
    const tiles = ertmsTitle.locator('xpath=following-sibling::div[1]').locator('a.geItem');
    await expect(tiles).toHaveCount(40);
    await expect(tiles.first()).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('drawio-mode.png') });

    // Clicking a tile inserts it; item 0 ("Signal Left 3") is a shape=stencil(...) group.
    await tiles.first().click();
    await expect
      .poll(() => page.evaluate((key) => window.localStorage.getItem(key) ?? '', AUTOSAVE_KEY), {
        timeout: READY_TIMEOUT,
      })
      .toContain('stencil(');

    const downloadXml = async (): Promise<string> => {
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download .drawio' }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.drawio$/);
      return readFile(await download.path(), 'utf8');
    };
    const xml = await downloadXml();
    expect(xml.startsWith('<mxfile')).toBe(true);
    expect(xml).toContain('<mxGraphModel');
    expect(xml).toContain('stencil(');

    await page.reload();
    await expect(page.locator('[data-testid=drawio-embed]')).toHaveAttribute('data-state', 'ready', {
      timeout: READY_TIMEOUT,
    });
    expect(await downloadXml()).toContain('stencil(');
  });

  test('round-trips custom object attributes from the autosave', async ({ page }) => {
    const fixture =
      '<mxfile><diagram id="p1" name="Page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
      '<object id="sig" label="S12" signalId="S12"><mxCell style="rounded=0;" vertex="1" parent="1">' +
      '<mxGeometry x="40" y="40" width="80" height="40" as="geometry"/></mxCell></object>' +
      '</root></mxGraphModel></diagram></mxfile>';
    await page.addInitScript(
      ([key, xml]) => {
        window.localStorage.setItem(key, JSON.stringify({ xml, title: 'Fixture', savedAt: '' }));
      },
      [AUTOSAVE_KEY, fixture] as const
    );
    await openDrawioMode(page);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download .drawio' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Fixture.drawio');
    const xml = await readFile(await download.path(), 'utf8');
    expect(xml).toContain('signalId="S12"');

    // Export SVG is decoded into a Blob download (never an iframe-supplied href).
    const svgDownloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export SVG' }).click();
    const svgDownload = await svgDownloadPromise;
    expect(svgDownload.suggestedFilename()).toBe('Fixture.drawio.svg');
    const svg = await readFile(await svgDownload.path(), 'utf8');
    expect(svg).toMatch(/<svg[\s>]/);
    expect(svg).toContain('content=');
  });
});
