/**
 * @file railway-shapes.spec.ts
 * @brief The railway libraries of the Shapes tab (src/ui/railway-libraries.ts): the sections
 *        "ERTMS/ETCS extra", "Polish signalling (PKP PLK)" and "Track layout" follow ERTMS, open with
 *        captioned thumbnails; a Polish semafor inserts as a signal (kind, direction, aspects, ID) and
 *        Railway > Object State > Proceed paints its lamps; EN/PL search ("tarcza", "marker board");
 *        a turnout set from Track layout inserts as track + points and exports to railML 3.2.
 *
 * Reads the graph through the dev server's module graph (like ertms-data.spec.ts). Any port.
 */
import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { clickMenuItem } from './menu-helpers';

const PALETTE = '#drawio-palette-container';
const SECTIONS = [
  ['etcs-extra', 'ERTMS/ETCS extra'],
  ['rail-pl', 'Polish signalling (PKP PLK)'],
  ['track-layout', 'Track layout'],
] as const;

async function inGraph<T>(page: Page, body: string, arg?: unknown): Promise<T> {
  return page.evaluate(async ({ body, arg }) => {
    const registry = await import('/src/services/service-registry.ts' as string);
    const graph = registry.ServiceRegistry.getTabManager().getActiveTab().graph;
    return new Function('graph', 'arg', body)(graph, arg);
  }, { body, arg }) as Promise<T>;
}

async function fresh(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
  await page.locator(`${PALETTE} section[data-palette-id="ertms"] .rd-dp-item`).first().waitFor();
}

const section = (page: Page, id: string) => page.locator(`${PALETTE} section[data-palette-id="${id}"]`);

async function expand(page: Page, id: string): Promise<void> {
  const header = section(page, id).locator('.rd-dp-header');
  if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click();
  await expect(header).toHaveAttribute('aria-expanded', 'true');
}

/** Clicks a palette tile (insert at the view centre) and returns the new top-level cell ids. */
async function insert(page: Page, id: string, title: string): Promise<string[]> {
  await inGraph(page, 'graph.clearSelection();');
  await expand(page, id);
  await section(page, id).locator(`.rd-dp-item[title="${title}"]`).click();
  await expect.poll(() => inGraph<number>(page, 'return graph.getSelectionCount();')).toBeGreaterThan(0);
  return inGraph(page, 'return graph.getSelectionCells().map((c) => c.id);');
}

interface Info {
  kind: string | null;
  attrs: Record<string, string>;
  lamps: string[];
}

async function info(page: Page, id: string): Promise<Info> {
  return inGraph(page, `
    const cell = graph.getDataModel().getCell(arg);
    const v = cell.value;
    const attrs = {};
    if (v && v.nodeType === 1) for (const a of Array.from(v.attributes)) if (a.name.startsWith('rd')) attrs[a.name] = a.value;
    const lamps = (cell.children || []).map((c) => graph.view.getState(c)).filter((st) => st && st.style.shape === 'ellipse')
      .map((st) => st.style.fillColor);
    return { kind: attrs.rdKind ?? null, attrs, lamps };`, id);
}

test('railway libraries: sections, Polish semafor with lamp aspects, search, turnout to railML', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await fresh(page);

  // Sections right after ERTMS, collapsed until opened, captioned thumbnails
  const headers = await page.locator(`${PALETTE} .rd-dp-category:not([hidden]) .rd-dp-header-title`).allTextContents();
  expect(headers.slice(0, 4)).toEqual(['ERTMS', ...SECTIONS.map(([, title]) => title)]);
  for (const [id] of SECTIONS) {
    await expand(page, id);
    await expect.poll(() => section(page, id).locator('.rd-dp-item').count()).toBeGreaterThan(30);
    await expect(section(page, id).locator('.rd-dp-caption').first()).toBeVisible();
  }

  // Polish semafor: signal, nominal, 3 aspects, generated ID; Proceed paints its 3 lamps
  const [sem] = await insert(page, 'rail-pl', 'Semafor 3-komorowy prawy');
  const before = await info(page, sem);
  expect(before).toMatchObject({ kind: 'signal', attrs: { rdId: 'S1', rdSignalType: 'main', rdDirection: 'nominal', rdAspects: '3' } });
  expect(before.lamps).toHaveLength(3);
  await clickMenuItem(page, 'railway', 'railwayState:aspect:proceed');
  await expect.poll(async () => (await info(page, sem)).attrs.rdAspect).toBe('proceed');
  expect((await info(page, sem)).lamps).toEqual(['#00c853', '#00c853', '#00c853']);
  await clickMenuItem(page, 'railway', 'railwayState:aspect:stop');
  await expect.poll(async () => (await info(page, sem)).lamps).toEqual(['#ff0000', '#ff0000', '#ff0000']);
  // a second one gets the next ID
  const [sem2] = await insert(page, 'rail-pl', 'Semafor wjazdowy lewy');
  expect((await info(page, sem2)).attrs).toMatchObject({ rdId: 'S2', rdDirection: 'reverse', rdAspects: '5' });

  // Search: Polish and English words
  const hits = (id: string) =>
    section(page, id).locator('.rd-dp-item:not([hidden])').evaluateAll((n) => n.map((e) => (e as HTMLElement).title));
  const search = page.locator(`${PALETTE} .rd-dp-search`);
  await search.fill('tarcza');
  await expect.poll(() => hits('rail-pl')).toContain('Tarcza manewrowa Tm prawy');
  expect(await hits('rail-pl')).toContain('Tarcza ostrzegawcza świetlna To lewy');
  await search.fill('marker board');
  await expect.poll(() => hits('etcs-extra')).toEqual(['ETCS Stop Marker Right', 'ETCS Stop Marker Left', 'ETCS Location Marker Right', 'ETCS Location Marker Left']);
  await search.fill('');

  // Turnout set from Track layout: a track and a points leg with generated IDs; railML export
  await inGraph(page, 'graph.removeCells(graph.getChildCells(graph.getDefaultParent()), true);');
  const turnout = await insert(page, 'track-layout', 'Turnout 1:9 Left (toe left)');
  const parts = await Promise.all(turnout.map((id) => info(page, id)));
  expect(parts.map((p) => [p.kind, p.attrs.rdId])).toEqual([['track', 'T1'], ['points', 'W1']]);
  expect(parts[1].attrs).toMatchObject({ rdHand: 'left', rdPosition: 'normal' });

  await clickMenuItem(page, 'file', 'exportRailml');
  const dialog = page.locator('[data-testid="railml-export-dialog"]');
  await expect(dialog).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), dialog.locator('.rd-railml-export-btn').click()]);
  const xml = await readFile((await download.path())!, 'utf8');
  const counts = await page.evaluate((text) => {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    const all = (name: string) => Array.from(doc.getElementsByTagName('*')).filter((e) => e.localName === name);
    return {
      parseError: doc.getElementsByTagName('parsererror').length,
      netElements: all('netElement').length,
      switches: all('switchIS').length,
    };
  }, xml);
  expect(counts.parseError).toBe(0);
  expect(counts.switches).toBe(1);
  expect(counts.netElements).toBeGreaterThanOrEqual(3);
  expect(pageErrors).toEqual([]);
});
