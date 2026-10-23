import { defineConfig } from '@playwright/test';
import base from './playwright.config';

/**
 * The specs that need no dev-server module imports, run against the PRODUCTION build (`vite preview`
 * of dist/, `npm run build` first) under the exact production CSP of public/_headers (no
 * 'unsafe-eval'); csp-teardown.ts fails the run on any violation report. `npm run test:e2e:preview`.
 */
const port = Number(process.env.E2E_PORT ?? 4173);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  ...base,
  testMatch: [
    'csp.spec.ts',
    'legacy-smoke.spec.ts',
    'share.spec.ts',
    'gitlab.spec.ts',
    'scenarios.spec.ts',
    'scenario-uml-text.spec.ts',
    'templates.spec.ts',
    'drawio-compat.spec.ts',
    'drawio-palette.spec.ts',
    'all-shapes.spec.ts',
  ],
  use: { ...base.use, baseURL },
  projects: base.projects,
  webServer: {
    command: `npx vite preview --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
