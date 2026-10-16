/**
 * @file gitlab.spec.ts
 * @brief GitLab provider without a GitLab: "Not configured" in the Share dialog, runtime settings
 *        (URL + OAuth application id) make Open/Save and the sign-in button appear, a `?gitlab=`
 *        link on an unconfigured browser explains what to do. No request reaches any GitLab.
 *
 * Runs on any port.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function freshApp(page: Page, path = '/'): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(path);
  await expect(page.locator('body')).toHaveAttribute('data-editor', 'main');
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
}

test.describe('gitlab', () => {
  test('not configured -> runtime settings -> sign-in button (no GitLab contacted)', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    const gitlabRequests: string[] = [];
    await page.route('http://gitlab.e2e.invalid/**', (route) => {
      gitlabRequests.push(route.request().url());
      return route.abort();
    });
    await freshApp(page);

    await page.locator('#share-btn').click();
    const dialog = page.locator('[data-testid="share-dialog"]');
    const section = dialog.locator('[data-testid="share-provider-gitlab"]');
    await expect(section.locator('[data-testid="share-provider-gitlab-status"]')).toHaveText('Not configured');
    await expect(section.locator('a', { hasText: 'How to enable' })).toHaveAttribute('href', /docs\/GITLAB\.md$/);
    // SharePoint is still there, first
    await expect(dialog.locator('[data-testid="share-provider-sharepoint-status"]')).toHaveText('Not configured');
    await expect(dialog.locator('.rd-share-section[data-provider]').first()).toHaveAttribute('data-provider', 'sharepoint');

    const settings = section.locator('[data-testid="share-provider-gitlab-settings"]');
    await expect(settings).toHaveAttribute('open', '');
    await expect(settings).toContainText('Register this redirect URI');
    await settings.locator('input[data-setting="url"]').fill('http://gitlab.e2e.invalid');
    await settings.locator('input[data-setting="clientId"]').fill('e2e-application-id');
    await settings.locator('[data-testid="share-provider-gitlab-settings-save"]').click();
    await expect(page.locator('.notification', { hasText: 'GitLab settings saved' })).toBeVisible();
    await expect(section.locator('[data-testid="share-provider-gitlab-status"]')).toHaveCount(0);
    await expect(section.locator('[data-testid="share-provider-gitlab-link"]')).toBeDisabled();

    // stored in this browser only
    const stored = await page.evaluate(() => localStorage.getItem('rd.gitlab.settings'));
    expect(JSON.parse(stored ?? '{}')).toEqual({ url: 'http://gitlab.e2e.invalid', clientId: 'e2e-application-id' });

    // Open from GitLab… -> browse dialog asks to sign in (the implementation chunk loads; GitLab is not contacted)
    await section.locator('[data-testid="share-provider-gitlab-open"]').click();
    const browse = page.locator('[data-testid="remote-open-dialog"]');
    await expect(browse).toBeVisible();
    await expect(browse.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(browse).toContainText('Sign in with your GitLab account to browse.');
    await page.keyboard.press('Escape');
    await expect(browse).toHaveCount(0);

    // The File menu got the GitLab items without a reload
    await page.locator('.menu-item[data-menu="file"]').click();
    await expect(page.locator('#file-menu-remote-items .menu-dropdown-item[data-provider="gitlab"]')).toHaveText(['Open from GitLab…', 'Save to GitLab…']);
    await page.keyboard.press('Escape');

    // After a reload the settings still apply
    await page.reload();
    await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
    // the Share button is wired a moment after the tabs appear
    await expect(async () => {
      await page.locator('#share-btn').click();
      await expect(page.locator('[data-testid="share-dialog"]')).toBeVisible({ timeout: 1000 });
    }).toPass();
    await expect(page.locator('[data-testid="share-provider-gitlab-open"]')).toBeVisible();

    expect(gitlabRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('a ?gitlab= link on a browser without GitLab settings explains what to do', async ({ page }) => {
    await freshApp(page, '/?gitlab=rail/ertms:main:docs/Station.drawio');
    await expect(page.locator('.notification', { hasText: 'is not set up in this browser' })).toBeVisible();
    await expect(page.locator('.notification', { hasText: 'rail/ertms › main › docs/Station.drawio' })).toBeVisible();
    // the parameter is removed from the address bar (kept for this tab until GitLab is set up)
    expect(page.url()).not.toContain('gitlab=');
    expect(await page.evaluate(() => sessionStorage.getItem('rd.gitlab.pendingOpen'))).toContain('Station.drawio');
  });
});
