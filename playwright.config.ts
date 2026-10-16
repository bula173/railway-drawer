import { defineConfig, devices } from '@playwright/test';

// E2E_PORT selects the dev-server port (default 3000, the Vite default of this repo).
// embed.diagrams.net refuses (HTTP 403) iframes whose Referer carries a non-default port, so the
// draw.io embed spec only runs for real with the app on a default port, like production:
//   E2E_PORT=80 npx playwright test --project=chromium
// (macOS lets non-root processes bind port 80; on Linux point VITE_DRAWIO_URL at a self-hosted
// draw.io instead). On other ports that spec skips itself with this hint.
const port = Number(process.env.E2E_PORT ?? 3000);
const baseURL = port === 80 ? 'http://localhost' : `http://localhost:${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  // Only Playwright specs; tests/e2e/parity/__tests__/*.test.ts are vitest unit tests
  testMatch: '*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      // Desktop Chrome sends a regular Chrome user agent; embed.diagrams.net answers 403 to "HeadlessChrome".
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: `npx vite --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
