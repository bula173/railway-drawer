/**
 * @file drawio-parity.spec.ts
 * @brief Per-entry visual parity: maxGraph mode vs. real draw.io (self-hosted v32.4.1 by default).
 *
 * For every entry of the draw.io palettes (src/drawio-shapes/palettes/data/*.json) and of the
 * ERTMS library (public/libraries/ertms.xml) one mxGraphModel is rendered twice at scale 2 with
 * a 10px border on white:
 *  - draw.io: tests/e2e/parity/drawio-host.html, routed at <app>/__parity/drawio-host.html
 *    (http://localhost/parity/drawio-host.html with VITE_DRAWIO_URL),
 *    embeds the self-hosted draw.io at <app>/drawio/ (scripts/drawio-selfhost, the same pinned tag as
 *    the palette data) or VITE_DRAWIO_URL (e.g. https://embed.diagrams.net/) with ?embed=1&proto=json
 *    and answers {action:'export', format:'png'};
 *  - app: window.__rdParity.render(xml, {scale, border, background}) → PNG data URI
 *    (debug hook provided by the app integration).
 * tests/e2e/parity/compare.ts trims, aligns and pixelmatches both images; the report goes to
 * test-results/drawio-parity/ (report.json, index.html, PNGs).
 *
 * Run (any port, offline; needs the devDependencies pixelmatch [+ pngjs]):
 *   npx playwright test tests/e2e/drawio-parity.spec.ts --project=chromium
 * Options: PARITY_FILTER=<palette id or entry-id substring>, PARITY_LIMIT=<n per palette>,
 * VITE_DRAWIO_URL=https://embed.diagrams.net/ (public editor: needs network and the app on port 80,
 * E2E_PORT=80; PARITY_ANY_PORT=1 skips that check), E2E_OFFLINE=1 (skip, external draw.io only).
 * Thresholds: pass ≤ 2 %, warn ≤ 6 %, fail above; entries in tests/e2e/parity/expected-mismatch.json
 * are reported but never fail. Each palette test asserts zero failures among the other entries.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, devices } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { classify, compareImages, loadImageDeps } from './parity/compare';
import type { ImageDeps } from './parity/compare';
import { dataUriToBuffer } from './parity/png';
import { collectEntries } from './parity/entries';
import type { ParityEntry } from './parity/entries';
import { REPORT_DIR, summarize, writePaletteResult, writeReport } from './parity/report';
import type { EntryResult } from './parity/report';

interface ParityRenderOptions {
  scale: number;
  border: number;
  background: string;
}

declare global {
  interface Window {
    /** App debug hook (integration): renders a model in a hidden maxGraph graph to a PNG data URI. */
    __rdParity?: { render(xml: string, opts: ParityRenderOptions): Promise<string> };
    /** drawio-host.html */
    parityReady?: Promise<void>;
    parityExport?(xml: string, opts: ParityRenderOptions & { timeout?: number }): Promise<string>;
  }
}

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.E2E_PORT ?? 3000);
const APP_URL = PORT === 80 ? 'http://localhost/' : `http://localhost:${PORT}/`;
/** External draw.io (VITE_DRAWIO_URL), else the self-hosted copy served next to the app. */
const EXTERNAL_DRAWIO = process.env.VITE_DRAWIO_URL || null;
const DRAWIO_URL = new URL(EXTERNAL_DRAWIO ?? 'drawio/', APP_URL).href;
const DRAWIO_PREFIX = DRAWIO_URL.split(/[?#]/)[0];
/**
 * The routed host page: on http://localhost (port 80) for embed.diagrams.net (Referer without a port);
 * on the app origin for the self-hosted copy, because Chrome's Local Network Access checks block a
 * routed (address-space-less) http://localhost page from framing http://localhost:<port>.
 */
const HOST_URL = EXTERNAL_DRAWIO ? 'http://localhost/parity/drawio-host.html' : `${APP_URL}__parity/drawio-host.html`;
const HOST_HTML = readFileSync(resolve(HERE, 'parity/drawio-host.html'), 'utf8');
const RENDER: ParityRenderOptions = { scale: 2, border: 10, background: '#ffffff' };
const READY_TIMEOUT = 45000;
const PER_ENTRY_MS = 20000;
const DRAWIO_TAG = 'v32.4.1';

const groups = collectEntries({
  filter: process.env.PARITY_FILTER,
  limit: process.env.PARITY_LIMIT ? Number(process.env.PARITY_LIMIT) : undefined,
});

let skipReason: string | null = null;
let deps: ImageDeps | null = null;
let context: BrowserContext | null = null;
let drawioPage: Page | null = null;
let appPage: Page | null = null;

async function openDrawioHost(page: Page): Promise<string | null> {
  await page.route(`${HOST_URL}*`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: HOST_HTML }));
  const editorStatus = page
    .waitForResponse((r) => r.url().startsWith(DRAWIO_PREFIX) && r.request().resourceType() === 'document', {
      timeout: READY_TIMEOUT,
    })
    .then((r) => r.status())
    .catch(() => 0);
  await page.goto(`${HOST_URL}?drawio=${encodeURIComponent(DRAWIO_URL)}`);
  const status = await editorStatus;
  if (status >= 400) {
    return `draw.io refused the embed request (HTTP ${status}); serve from port 80 with a regular Chrome UA or set VITE_DRAWIO_URL`;
  }
  try {
    await page.evaluate((ms) => Promise.race([window.parityReady, new Promise((_r, rej) => setTimeout(() => rej(new Error('timeout')), ms))]), READY_TIMEOUT);
  } catch {
    return `draw.io editor did not send {event:'init'} within ${READY_TIMEOUT} ms (HTTP ${status})`;
  }
  return null;
}

async function openApp(page: Page, baseURL: string): Promise<string | null> {
  await page.goto(baseURL);
  try {
    await page.waitForFunction(() => typeof window.__rdParity?.render === 'function', undefined, { timeout: READY_TIMEOUT });
  } catch {
    return 'app debug hook window.__rdParity.render(xml, {scale, border, background}) is missing (integration step pending)';
  }
  return null;
}

function writePng(rel: string, data: Uint8Array): string {
  const file = resolve(REPORT_DIR, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
  return rel;
}

async function runEntry(entry: ParityEntry, d: ImageDeps, dPage: Page, aPage: Page): Promise<EntryResult> {
  const base: EntryResult = {
    id: entry.id,
    palette: entry.palette,
    title: entry.title,
    kind: entry.kind,
    cls: entry.cls,
    status: 'error',
    diffRatio: 1,
    diffPixels: 0,
    contentPixels: 0,
    sizeDelta: { width: 0, height: 0 },
    drawioSize: { width: 0, height: 0 },
    appSize: { width: 0, height: 0 },
    expectedMismatch: entry.expectedMismatch,
    images: {},
  };
  const prefix = `${entry.palette}/${entry.id}`;
  try {
    const drawioUri = await dPage.evaluate(
      ([xml, opts]) => window.parityExport!(xml, opts),
      [entry.xml, { ...RENDER, timeout: PER_ENTRY_MS }] as const
    );
    const drawioBuf = dataUriToBuffer(drawioUri);
    base.images.drawio = writePng(`${prefix}.drawio.png`, drawioBuf);
    const appUri = await aPage.evaluate(([xml, opts]) => window.__rdParity!.render(xml, opts), [entry.xml, RENDER] as const);
    const appBuf = dataUriToBuffer(appUri);
    base.images.app = writePng(`${prefix}.app.png`, appBuf);
    const r = compareImages(d.decode(drawioBuf), d.decode(appBuf), { match: d.pixelmatch ?? undefined });
    base.images.diff = writePng(`${prefix}.diff.png`, d.encode(r.diff));
    return {
      ...base,
      status: classify(r.diffRatio, !!entry.expectedMismatch),
      diffRatio: r.diffRatio,
      diffPixels: r.diffPixels,
      contentPixels: r.contentPixels,
      sizeDelta: r.sizeDelta,
      drawioSize: r.drawioSize,
      appSize: r.appSize,
      blank: r.blank === 'none' ? undefined : r.blank,
    };
  } catch (error) {
    return { ...base, status: entry.expectedMismatch ? 'expected' : 'error', error: String((error as Error)?.message ?? error) };
  }
}

test.describe('draw.io parity', () => {
  // In order, in one worker (opts out of fullyParallel); a failing palette does not skip the others.
  test.describe.configure({ mode: 'default' });

  test.beforeAll(async ({ browser, request }, testInfo) => {
    test.setTimeout(3 * READY_TIMEOUT);
    if (EXTERNAL_DRAWIO && process.env.E2E_OFFLINE === '1') {
      skipReason = 'E2E_OFFLINE=1';
      return;
    }
    if (EXTERNAL_DRAWIO && PORT !== 80 && process.env.PARITY_ANY_PORT !== '1') {
      skipReason =
        `draw.io parity needs the app on port 80 (E2E_PORT=${PORT}); embed.diagrams.net refuses non-default-port referers. ` +
        'Run: E2E_PORT=80 npx playwright test tests/e2e/drawio-parity.spec.ts --project=chromium';
      return;
    }
    deps = await loadImageDeps();
    if (!deps.pixelmatch) {
      skipReason = `missing devDependencies: ${deps.missing.join(', ')} (npm i -D pixelmatch pngjs)`;
      return;
    }
    try {
      const res = await request.get(DRAWIO_URL, { timeout: 10000, headers: { 'User-Agent': devices['Desktop Chrome'].userAgent } });
      if (!res.ok()) skipReason = `draw.io unreachable (HTTP ${res.status()} from ${DRAWIO_URL})`;
    } catch (error) {
      skipReason = `draw.io unreachable (${String(error).split('\n')[0]})`;
    }
    if (skipReason) return;
    context = await browser.newContext({ ...devices['Desktop Chrome'], viewport: { width: 1400, height: 1000 } });
    drawioPage = await context.newPage();
    appPage = await context.newPage();
    const baseURL = String(testInfo.project.use.baseURL ?? (PORT === 80 ? 'http://localhost' : `http://localhost:${PORT}`));
    skipReason = (await openDrawioHost(drawioPage)) ?? (await openApp(appPage, baseURL));
  });

  test.afterAll(async () => {
    await context?.close();
    context = drawioPage = appPage = null;
    writeReport();
  });

  if (groups.size === 0) {
    test('no entries', () => {
      test.skip(true, `no parity entries match PARITY_FILTER=${process.env.PARITY_FILTER ?? ''}`);
    });
  }

  for (const [palette, entries] of groups) {
    test(`${palette} (${entries.length} entries)`, async ({ browserName }) => {
      test.skip(browserName !== 'chromium', 'draw.io parity runs on chromium only');
      // The self-hosted copy is part of the build: unavailable is a failure, not a skip.
      if (!EXTERNAL_DRAWIO && skipReason && !skipReason.startsWith('missing devDependencies')) {
        expect(skipReason, `self-hosted draw.io at ${DRAWIO_URL}`).toBeNull();
      }
      test.skip(!!skipReason, skipReason ?? '');
      test.setTimeout(60000 + entries.length * PER_ENTRY_MS);

      const results: EntryResult[] = [];
      for (const entry of entries) {
        results.push(await runEntry(entry, deps!, drawioPage!, appPage!));
      }
      writePaletteResult({ palette, drawioTag: DRAWIO_TAG, generatedAt: new Date().toISOString(), entries: results });
      writeReport();

      const s = summarize(results);
      test.info().annotations.push({
        type: 'parity',
        description: `${palette}: ${s.pass} pass, ${s.warn} warn, ${s.fail} fail, ${s.expected} expected, ${s.error} error`,
      });
      const failing = results
        .filter((r) => r.status === 'fail' || r.status === 'error')
        .map((r) => `${r.id} ${r.status} ${(r.diffRatio * 100).toFixed(2)}%${r.error ? ` (${r.error})` : ''}`);
      expect(failing, `parity failures in ${palette}; see test-results/drawio-parity/index.html`).toEqual([]);
    });
  }
});
