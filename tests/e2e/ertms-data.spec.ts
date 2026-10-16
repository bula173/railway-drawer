/**
 * @file ertms-data.spec.ts
 * @brief Railway object data end to end: ERTMS palette inserts get their kind, the Data panel
 *        edits typed fields, a duplicate signal ID shows up in Checks (badge, click selects the
 *        cell), fixing it clears the error, File > Export Railway Data > Signals (CSV) has the rows,
 *        a reload keeps the data, and File > Save writes the attributes as draw.io object data.
 *
 * Reads the graph through the dev server's module graph (like style-edit.spec.ts). Any port.
 */
import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function inGraph<T>(page: Page, body: string, arg?: unknown): Promise<T> {
  return page.evaluate(async ({ body, arg }) => {
    const registry = await import('/src/services/service-registry.ts' as string);
    const graph = registry.ServiceRegistry.getTabManager().getActiveTab().graph;
    return new Function('graph', 'arg', body)(graph, arg);
  }, { body, arg }) as Promise<T>;
}

interface ObjectInfo {
  id: string;
  kind: string | null;
  attrs: Record<string, string>;
}

/** Top-level cells of the drawing with their railway data attributes. */
async function objects(page: Page): Promise<ObjectInfo[]> {
  return inGraph(page, `
    return graph.getDefaultParent().children.map((c) => {
      const v = c.value;
      const attrs = {};
      if (v && v.nodeType === 1) for (const a of Array.from(v.attributes)) if (a.name.startsWith('rd')) attrs[a.name] = a.value;
      return { id: c.id, kind: attrs.rdKind ?? null, attrs };
    });`);
}

async function selectionIds(page: Page): Promise<string[]> {
  return inGraph(page, 'return graph.getSelectionCells().map((c) => c.id);');
}

async function insertErtms(page: Page, title: string): Promise<string> {
  await inGraph(page, 'graph.clearSelection();');
  const section = page.locator('#drawio-palette-container section[data-palette-id="ertms"]');
  if ((await section.locator('.rd-dp-header').getAttribute('aria-expanded')) !== 'true') {
    await section.locator('.rd-dp-header').click();
  }
  await section.locator(`.rd-dp-item[title="${title}"]`).first().click();
  await expect.poll(async () => (await selectionIds(page)).length).toBe(1);
  return (await selectionIds(page))[0];
}

async function select(page: Page, id: string): Promise<void> {
  await inGraph(page, 'graph.setSelectionCell(graph.getDataModel().getCell(arg));', id);
}

const dataPanel = (page: Page) => page.locator('#railway-data-panel');
const checksPanel = (page: Page) => page.locator('#railway-checks-panel');
const fieldOf = (page: Page, key: string) => dataPanel(page).locator(`[data-field="${key}"]`);

async function fill(page: Page, key: string, value: string): Promise<void> {
  await fieldOf(page, key).fill(value);
  await fieldOf(page, key).press('Enter');
}

test('ERTMS objects: kinds on insert, data editing, checks, CSV, reload, saved file', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-editor', 'main');
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);

  // Insert a signal and a balise from the ERTMS palette: kinds and IDs are pre-assigned
  const signal = await insertErtms(page, 'Signal Left 3');
  const balise = await insertErtms(page, 'Single Balise Right');
  const signal2 = await insertErtms(page, 'Signal Right 3');
  const byId = async (id: string) => (await objects(page)).find((o) => o.id === id)!;
  expect(await byId(signal)).toMatchObject({ kind: 'signal', attrs: { rdId: 'S1', rdAspects: '3', rdDirection: 'reverse', rdSignalType: 'main' } });
  expect(await byId(balise)).toMatchObject({ kind: 'balise', attrs: { rdId: 'B1', rdDirection: 'nominal' } });
  expect((await byId(signal2)).attrs.rdId).toBe('S2');

  // Fill data in the Data panel
  await select(page, signal);
  await page.locator('.right-panel-switch-btn[data-right-panel="data"]').click();
  await expect(dataPanel(page)).toBeVisible();
  await expect(dataPanel(page).locator('.rd-rw-title')).toHaveText('Signal S1');
  await expect(fieldOf(page, 'kind')).toHaveValue('signal');
  await fill(page, 'km', '12+345');
  await fieldOf(page, 'signalType').selectOption('shunting');
  await fill(page, 'notes', 'Semafor wjazdowy, „Łódź”');
  await expect.poll(async () => (await byId(signal)).attrs).toMatchObject({ rdKm: '12.345', rdSignalType: 'shunting', rdNotes: 'Semafor wjazdowy, „Łódź”' });
  await expect(fieldOf(page, 'km')).toHaveValue('12.345');

  // Duplicate ID -> error in Checks (badge on the switch)
  await select(page, signal2);
  await expect(dataPanel(page).locator('.rd-rw-title')).toHaveText('Signal S2');
  await fill(page, 'id', 'S1');
  await fill(page, 'km', '12.9');
  const badge = page.locator('.right-panel-switch-btn[data-right-panel="checks"] .rd-rw-badge');
  await expect(badge).toBeVisible();
  await expect(badge).toHaveClass(/rd-rw-badge-error/);
  await page.locator('.right-panel-switch-btn[data-right-panel="checks"]').click();
  const duplicates = checksPanel(page).locator('.rd-rw-issue[data-rule="duplicate-id"]');
  await expect(duplicates).toHaveCount(2);
  await expect(duplicates.first()).toContainText('Duplicate signal ID "S1"');
  await expect(checksPanel(page).locator('.rd-rw-summary')).toContainText('error');

  // Clicking an error selects its cell
  await inGraph(page, 'graph.clearSelection();');
  await checksPanel(page).locator(`.rd-rw-issue[data-rule="duplicate-id"][data-cell-id="${signal2}"] .rd-rw-issue-main`).click();
  await expect.poll(() => selectionIds(page)).toEqual([signal2]);
  await checksPanel(page).locator(`.rd-rw-issue[data-rule="duplicate-id"][data-cell-id="${signal}"] .rd-rw-issue-main`).click();
  await expect.poll(() => selectionIds(page)).toEqual([signal]);

  // Fix it from the issue's Edit button -> the error clears
  await checksPanel(page).locator(`.rd-rw-issue[data-rule="duplicate-id"][data-cell-id="${signal2}"] .rd-rw-issue-edit`).click();
  await expect(dataPanel(page)).toBeVisible();
  await expect(fieldOf(page, 'id')).toBeFocused();
  await fill(page, 'id', 'S3');
  await page.locator('.right-panel-switch-btn[data-right-panel="checks"]').click();
  await expect(checksPanel(page).locator('.rd-rw-issue[data-rule="duplicate-id"]')).toHaveCount(0);
  // the balise has no group yet: still reported, as an error of its own rule
  await expect(checksPanel(page).locator('.rd-rw-issue[data-rule="balise-without-group"]')).toHaveCount(1);

  // Undo the ID fix brings the duplicate back; redo removes it again
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('ControlOrMeta+z');
  await expect(checksPanel(page).locator('.rd-rw-issue[data-rule="duplicate-id"]')).toHaveCount(2);
  await page.keyboard.press('ControlOrMeta+y');
  await expect(checksPanel(page).locator('.rd-rw-issue[data-rule="duplicate-id"]')).toHaveCount(0);

  // File > Export Railway Data > Signals (CSV)
  const csvPromise = page.waitForEvent('download');
  await page.locator('.menu-item[data-menu="file"]').click();
  await page.locator('.menu-submenu-title', { hasText: 'Export Railway Data' }).hover();
  await page.locator('.menu-dropdown-item[data-action="exportRailway:signals"]').click();
  const csvDownload = await csvPromise;
  expect(csvDownload.suggestedFilename()).toMatch(/-signals\.csv$/);
  const csvBytes = await readFile(await csvDownload.path());
  expect([...csvBytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const csvLines = csvBytes.toString('utf8').slice(1).split('\r\n');
  expect(csvLines[0]).toBe('Signal ID,Type,Direction,km position [km],Track,Aspects,Routes,Remarks,Label,Cell ID');
  expect(csvLines[1]).toBe(`S1,Shunting signal,Reverse,12.345,,3,,"Semafor wjazdowy, „Łódź”",,${signal}`);
  expect(csvLines[2]).toBe(`S3,Main signal,Nominal,12.9,,3,,,,${signal2}`);

  // Reload: the autosave keeps the data
  await expect
    .poll(async () => page.evaluate(() => localStorage.getItem('railway-drawer-cache') ?? ''), { timeout: 15_000 })
    .toContain('rdId=\\"S3\\"'); // inside the cache's JSON
  await page.reload();
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
  await expect.poll(async () => (await objects(page)).filter((o) => o.kind).map((o) => o.attrs.rdId)).toEqual(['S1', 'B1', 'S3']);
  expect((await byId(signal)).attrs).toMatchObject({ rdKm: '12.345', rdNotes: 'Semafor wjazdowy, „Łódź”' });

  // File > Save: draw.io object data in the file
  const savePromise = page.waitForEvent('download');
  await page.locator('.menu-item[data-menu="file"]').click();
  await page.locator('.menu-dropdown-item[data-action="save"]').click();
  const xml = await readFile(await (await savePromise).path(), 'utf8');
  const signalEl = new RegExp(`<object label="" rdKind="signal" [^>]*>`).exec(xml)?.[0] ?? '';
  expect(signalEl).toContain('rdId="S1"');
  expect(signalEl).toContain('rdKm="12.345"');
  expect(signalEl).toContain(`id="${signal}"`);
  expect(xml).toContain('rdNotes="Semafor wjazdowy, „Łódź”"');
  expect(xml).toMatch(/<object [^>]*rdKind="balise"[^>]*rdId="B1"/);

  expect(pageErrors).toEqual([]);
});
