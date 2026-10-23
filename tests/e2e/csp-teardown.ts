/**
 * Global teardown: fails the e2e run when the dev server received any Content-Security-Policy
 * violation report (vite.config.ts `securityHeaders`: the dev server sends public/_headers' CSP
 * with a report-uri), so every spec also checks that the app works under the production CSP.
 */
import type { FullConfig } from '@playwright/test';

export default async function cspTeardown(config: FullConfig): Promise<void> {
  if (process.env.RD_NO_CSP === '1') return;
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) return;
  let reports: unknown[];
  try {
    const res = await fetch(`${baseURL}/__rd-csp-reports`);
    if (!res.ok) return;
    reports = (await res.json()) as unknown[];
  } catch {
    return; // server already gone (nothing to check)
  }
  reports = reports.filter((r) => {
    const report = ((r as Record<string, unknown>)['csp-report'] ?? r) as Record<string, unknown>;
    // csp.spec.ts provokes violations on purpose on `/?csp-probe=1`
    if (String(report['document-uri'] ?? '').includes('csp-probe=1')) return false;
    // the specs' page.evaluate harness (`new Function` in evaluated code, no source file); an eval in
    // app code reports its module as source-file and still fails the run
    if (report['blocked-uri'] === 'eval' && !report['source-file']) return false;
    return true;
  });
  if (reports.length) {
    throw new Error(`Content-Security-Policy violations during the e2e run:\n${reports.map((r) => JSON.stringify(r)).join('\n')}`);
  }
}
