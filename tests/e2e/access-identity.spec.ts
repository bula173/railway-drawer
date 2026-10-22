/**
 * @file access-identity.spec.ts
 * @brief Top-bar Cloudflare Access user (src/ui/access-identity.ts): with a mocked
 *        `/cdn-cgi/access/get-identity` JSON the top bar shows the email and a Log out button
 *        (icon-only below 900 px, logout navigates to `/cdn-cgi/access/logout`); a 404 shows
 *        nothing and logs nothing from the app; the new element passes a contrast audit in the
 *        light and the dark theme. The dev server is http://localhost, where the app never asks
 *        Access, so the tests set the dev-only localStorage flag `rd.accessProbe` = '1'.
 * Runs on any port.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const EMAIL = 'marcin.kwiatkowski@railway-drawer.example.com';
const IDENTITY = '**/cdn-cgi/access/get-identity';

async function openApp(page: Page, opts: { theme?: 'light' | 'dark'; identity: 'ok' | '404' }): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (msg) => {
    // the browser itself reports the 404 of the request ("Failed to load resource"); the app must not log
    if (msg.type() === 'error' && !msg.text().startsWith('Failed to load resource')) errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  await page.addInitScript((theme) => {
    localStorage.setItem('rd.accessProbe', '1');
    if (theme) localStorage.setItem('rd.theme', theme);
  }, opts.theme ?? null);
  await page.route(IDENTITY, (route) =>
    opts.identity === 'ok'
      ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ email: EMAIL, name: 'Marcin', idp: { type: 'onetimepin' } }) })
      : route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not found' })
  );
  const asked = page.waitForResponse(IDENTITY);
  await page.goto('/');
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
  await asked;
  return errors;
}

test.describe('Cloudflare Access user in the top bar', () => {
  test('identity JSON: email (truncated, tooltip) + Log out; icon-only when narrow; Log out leaves for the Access logout', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 800 });
    const errors = await openApp(page, { identity: 'ok' });
    const user = page.locator('.top-bar-right > .rd-access-user');
    await expect(user).toBeVisible();
    await expect(user.locator('.rd-access-email-text')).toHaveText(EMAIL);
    await expect(user.locator('.rd-access-email')).toHaveAttribute('title', `Signed in as Marcin <${EMAIL}>`);
    // truncated with an ellipsis inside its max width
    const text = await user.locator('.rd-access-email-text').evaluate((el) => ({ overflow: getComputedStyle(el).textOverflow, clipped: el.scrollWidth > el.clientWidth }));
    expect(text).toEqual({ overflow: 'ellipsis', clipped: true });
    const logout = page.getByRole('button', { name: `Log out (${EMAIL})` });
    await expect(logout).toBeVisible();
    await expect(logout).toHaveText('Log out');
    // before the Share button, on one row
    const [ub, sb] = await Promise.all([user.boundingBox(), page.locator('#share-btn').boundingBox()]);
    expect(ub!.x + ub!.width).toBeLessThanOrEqual(sb!.x);

    // narrow: the email hides, Log out keeps an icon button (name from aria-label, >= 24 px)
    await page.setViewportSize({ width: 820, height: 700 });
    await expect(user.locator('.rd-access-email')).toBeHidden();
    await expect(logout).toBeVisible();
    await expect(logout.locator('.rd-access-logout-text')).toBeHidden();
    await expect(logout.locator('svg.rd-icon')).toBeVisible();
    const box = await logout.boundingBox();
    expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(24);
    const top = await page.locator('.top-bar').evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
    expect(top).toBe(true);

    // no unsaved remote changes: straight to Cloudflare's logout
    await page.route('**/cdn-cgi/access/logout', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Logged out</title><p>Logged out</p>' }));
    await logout.click();
    await expect(page).toHaveURL(/\/cdn-cgi\/access\/logout$/);
    expect(errors).toEqual([]);
  });

  test('404 (no Access: LAN, dev): nothing shown, no app errors', async ({ page }) => {
    const errors = await openApp(page, { identity: '404' });
    // the response arrived; give the app a moment to (not) render
    await page.waitForTimeout(300);
    await expect(page.locator('.rd-access-user')).toHaveCount(0);
    await expect(page.locator('#share-btn')).toBeVisible();
    expect(errors).toEqual([]);
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`contrast of the top-bar user (${theme} theme)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme === 'dark' ? 'light' : 'dark' });
      await openApp(page, { theme, identity: 'ok' });
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const user = page.locator('.rd-access-user');
      await expect(user).toBeVisible();
      const checks = await user.evaluate((root) => {
        const parse = (v: string): number[] | null => {
          const m = /rgba?\(([^)]+)\)/.exec(v);
          return m ? m[1].split(/[\s,/]+/).filter(Boolean).map(Number) : null;
        };
        const background = (el: Element): number[] => {
          const layers: number[][] = [];
          for (let n: Element | null = el; n; n = n.parentElement) {
            const c = parse(getComputedStyle(n).backgroundColor);
            const a = c ? (c.length > 3 ? c[3] : 1) : 0;
            if (c && a > 0) {
              layers.push([c[0], c[1], c[2], a]);
              if (a >= 1) break;
            }
          }
          let out = [255, 255, 255];
          for (let i = layers.length - 1; i >= 0; i--) out = out.map((v, k) => layers[i][k] * layers[i][3] + v * (1 - layers[i][3]));
          return out;
        };
        const lum = (c: number[]): number => {
          const ch = (v: number): number => {
            const s = v / 255;
            return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
          };
          return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2]);
        };
        const ratio = (a: number[], b: number[]): number => {
          const [x, y] = [lum(a), lum(b)];
          return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
        };
        const result: Array<{ what: string; ratio: number; min: number }> = [];
        for (const el of Array.from(root.querySelectorAll<HTMLElement>('.rd-access-email-text, .rd-access-logout-text'))) {
          result.push({ what: el.className, ratio: ratio(parse(getComputedStyle(el).color)!, background(el)), min: 4.5 });
        }
        for (const svg of Array.from(root.querySelectorAll<SVGElement>('svg.rd-icon'))) {
          result.push({ what: `${svg.parentElement!.className} icon`, ratio: ratio(parse(getComputedStyle(svg).color)!, background(svg.parentElement!)), min: 3 });
        }
        return result;
      });
      expect(checks.length).toBe(4);
      for (const c of checks) expect(c.ratio, `${c.what} ${c.ratio.toFixed(2)}`).toBeGreaterThanOrEqual(c.min);
      await user.screenshot({ path: `test-results/access-identity/top-bar-user-${theme}.png` });
    });
  }
});
