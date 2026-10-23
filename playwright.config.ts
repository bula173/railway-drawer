import { defineConfig, devices } from '@playwright/test';

// E2E_PORT selects the dev-server port (default 3000, the Vite default of this repo).
const port = Number(process.env.E2E_PORT ?? 3000);
const baseURL = port === 80 ? 'http://localhost' : `http://localhost:${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '*.spec.ts',
  // the dev server runs under the production CSP (public/_headers); any violation fails the run
  globalTeardown: './tests/e2e/csp-teardown.ts',
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
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: `npx vite --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
