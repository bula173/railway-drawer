/**
 * CSP and security headers (public/_headers, sent by the dev server too: vite.config.ts
 * `securityHeaders`). The other specs run under the same CSP and `csp-teardown.ts` fails the run on
 * any reported violation (PDF / slides / image exports, AI panel, share dialogs included).
 */
import { expect, test } from '@playwright/test';

test.describe('Content-Security-Policy', () => {
  test('the app is served with the security headers', async ({ request }) => {
    const res = await request.get('/');
    const headers = res.headers();
    expect(headers['content-security-policy']).toContain("script-src 'self'");
    // dev server: the exact production policy (no 'unsafe-eval') as Report-Only next to it
    expect(headers['content-security-policy-report-only']).toContain("script-src 'self';");
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['permissions-policy']).toContain('camera=()');
  });

  test('the theme is set before the app by the external theme script', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('rd.theme', 'dark'));
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('#graph-container')).toBeVisible();
  });

  test('inline scripts are blocked (probe page: its reports are ignored by the teardown)', async ({ page }) => {
    await page.goto('/?csp-probe=1');
    await expect(page.locator('#graph-container')).toBeVisible();
    const result = await page.evaluate(async () => {
      const w = window as unknown as { __rdProbe?: number };
      const violations: string[] = [];
      document.addEventListener('securitypolicyviolation', (e) => violations.push(`${e.disposition}:${e.blockedURI}:${e.violatedDirective}`));
      const script = document.createElement('script');
      script.textContent = 'window.__rdProbe = 1';
      document.head.appendChild(script);
      await new Promise((r) => setTimeout(r, 200));
      return { ran: w.__rdProbe === 1, violations };
    });
    expect(result.ran).toBe(false);
    expect(result.violations.some((v) => v.startsWith('enforce:inline:script-src'))).toBe(true);
  });
});
