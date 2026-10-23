/**
 * @file press-probe.spec.ts
 * @brief On-demand full press grid (5x5 per shape, 100 % and 200 %): what a real press + 30 px
 *        drag does on every kind of object. Skipped unless PRESS_PROBE=1; writes the table to
 *        PRESS_PROBE_OUT (markdown) when set. The CI regression is tests/e2e/press-to-move.spec.ts.
 *
 *   PRESS_PROBE=1 PRESS_PROBE_OUT=/tmp/probe.md npx playwright test tests/e2e/helpers/press-probe.spec.ts
 */
import { test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { probe, setupSamples, table, type ProbeResult } from './press-probe-lib';

test.use({ viewport: { width: 1600, height: 1100 } });

test('press grid over every object kind (probe)', async ({ page }) => {
  test.skip(!process.env.PRESS_PROBE, 'set PRESS_PROBE=1 to run the probe');
  test.setTimeout(30 * 60_000);
  const samples = await setupSamples(page);
  const fr = [0.04, 0.27, 0.5, 0.73, 0.96];
  const off = [-4, -2, 0, 2, 4];
  const results: ProbeResult[] = [];
  for (const zoom of [1, 2]) results.push(...await probe(page, samples, zoom, fr, off));
  const md = table(results);
  console.log(md);
  if (process.env.PRESS_PROBE_OUT) {
    writeFileSync(process.env.PRESS_PROBE_OUT, md + '\n\n' + JSON.stringify(results) + '\n');
  }
});
