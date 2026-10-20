/**
 * @file railway-script.spec.ts
 * @brief Railway Script end to end: a script typed in the left-panel tab "Railway Script" draws
 *        tracks, points, signals and a route (auto-apply); a text edit (signal km) moves the cell;
 *        dragging the signal on the canvas (real mouse) updates `at` in the text; an error in the
 *        text is listed with its line and leaves the drawing unchanged; a reload keeps the script;
 *        File > Import Railway Script… opens a .rdl.yaml in a new tab, File > Export Railway Script…
 *        downloads .rdl.yaml / .rdl.json.
 *
 * Reads the graph through the dev server's module graph (like railml.spec.ts). Any port.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { clickMenuItem } from './menu-helpers';

const SCRIPT = `railwayScript: 1
name: E2E line
# a main track with a branch
tracks:
  - id: T1
    startKm: 0.000
    endKm: 1.200
    points:
      - { id: W1, at: 0.400, to: T2, hand: right }
  - { id: T2, startKm: 0.500, endKm: 1.100 }
signals:
  - { id: S1, track: T1, at: 0.200, direction: nominal, type: main }
  - { id: S2, track: T1, at: 1.000, direction: nominal }
  - { id: S3, track: T2, at: 1.000, direction: nominal }
routes:
  - { id: R1, from: S1, to: S3, via: { W1: reverse } }
`;

interface Obj {
  kind: string;
  id: string;
  km: string;
  trackId: string;
  cx: number;
  cy: number;
  layer: string;
  script: string;
}

/** Railway objects of the active tab (kind:id -> data and centre). */
async function objects(page: Page): Promise<Record<string, Obj>> {
  return page.evaluate(async () => {
    const registry = await import('/src/services/service-registry.ts' as string);
    const validation = await import('/src/railway/validation.ts' as string);
    const geometry = await import('/src/railway/geometry.ts' as string);
    const tab = registry.ServiceRegistry.getTabManager().getActiveTab();
    const out: Record<string, unknown> = {};
    for (const o of validation.collectObjects(tab.graph.getDataModel())) {
      const c = geometry.centerOf(o.cell) ?? { x: NaN, y: NaN };
      out[`${o.kind.id}:${o.id}`] = {
        kind: o.kind.id,
        id: o.id,
        km: o.values.km ?? '',
        trackId: o.values.trackId ?? '',
        cx: c.x,
        cy: c.y,
        layer: o.cell.getParent()?.getId() ?? '',
        script: o.cell.getValue()?.getAttribute?.('rdScript') ?? '',
      };
    }
    return out;
  }) as Promise<Record<string, Obj>>;
}

/** Page coordinates of a railway object's centre. */
async function centreOnPage(page: Page, key: string): Promise<{ x: number; y: number }> {
  return page.evaluate(async (key) => {
    const registry = await import('/src/services/service-registry.ts' as string);
    const validation = await import('/src/railway/validation.ts' as string);
    const tab = registry.ServiceRegistry.getTabManager().getActiveTab();
    const graph = tab.graph;
    const o = validation.collectObjects(graph.getDataModel()).find((x: { kind: { id: string }; id: string }) => `${x.kind.id}:${x.id}` === key);
    const s = graph.view.getState(o.cell);
    const r = graph.container.getBoundingClientRect();
    return { x: r.left + s.getCenterX() - graph.container.scrollLeft, y: r.top + s.getCenterY() - graph.container.scrollTop };
  }, key);
}

async function menu(page: Page, name: string, action: string): Promise<void> {
  await clickMenuItem(page, name, action);
}

async function freshPage(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
}

async function openPanel(page: Page): Promise<void> {
  await page.locator('.left-panel-tab-btn[data-tab="railwayScript"]').click();
  await expect(page.locator('[data-testid="railway-script-text"]')).toBeVisible();
}

test('Railway Script: text draws the layout, edits flow both ways, errors are listed, reload keeps it', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await freshPage(page);
  await openPanel(page);
  const text = page.locator('[data-testid="railway-script-text"]');
  const status = page.locator('[data-testid="railway-script-status"]');
  const problems = page.locator('[data-testid="railway-script-problems"] li');

  // ---- type the script: auto-apply draws it
  await text.fill(SCRIPT);
  await expect(status).toContainText('Applied: 7 objects');
  let objs = await objects(page);
  expect(Object.keys(objs).sort()).toEqual(['points:W1', 'route:R1', 'signal:S1', 'signal:S2', 'signal:S3', 'track:T1', 'track:T2']);
  expect(objs['signal:S1']).toMatchObject({ km: '0.2', trackId: 'T1', script: 'signal:S1' });
  expect(objs['route:R1'].layer).toBe('rd-routes');
  expect(objs['track:T2'].cy).toBeGreaterThan(objs['track:T1'].cy);
  const x0 = objs['signal:S1'].cx;

  // ---- text -> drawing: S1 to km 0.3 (50 units to the right at the default 0.5 per metre)
  await text.fill(SCRIPT.replace('at: 0.200, direction', 'at: 0.300, direction'));
  await expect.poll(async () => Math.round((await objects(page))['signal:S1'].cx - x0)).toBe(50);
  expect((await objects(page))['signal:S1'].km).toBe('0.3');

  // ---- drawing -> text: drag S1 to the right with the mouse; the text gets its new km
  const from = await centreOnPage(page, 'signal:S1');
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 40, from.y, { steps: 4 });
  await page.mouse.move(from.x + 100, from.y, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => Number(/id: S1, track: T1, at: ([\d.]+)/.exec(await text.inputValue())?.[1] ?? 0)).toBeGreaterThan(0.45);
  objs = await objects(page);
  const km = Number(/id: S1, track: T1, at: ([\d.]+)/.exec(await text.inputValue())![1]);
  expect(Number(objs['signal:S1'].km)).toBeCloseTo(km, 3);
  // comments and the other lines are kept
  await expect(text).toHaveValue(/# a main track with a branch\n/);
  await expect(text).toHaveValue(/ {2}- \{ id: S2, track: T1, at: 1\.000, direction: nominal \}\n/);
  await expect(status).not.toContainText('error');

  // ---- an error: listed with its line, the drawing stays as it is
  const before = await objects(page);
  const broken = (await text.inputValue()).replace('{ id: S2, track: T1, at: 1.000, direction: nominal }', '{ id: S2, track: T1, at: 1.000, direction: sideways }');
  await text.fill(broken);
  await expect(problems.filter({ hasText: 'is not one of nominal, reverse' })).toHaveCount(1);
  await expect(problems.first()).toHaveAttribute('data-severity', 'error');
  await expect(problems.first().locator('.rd-rs-problem-pos')).toHaveText(/^13:\d+$/);
  await expect(status).toContainText('1 error');
  await page.waitForTimeout(800);
  expect(await objects(page)).toEqual(before);
  // click jumps to the error
  await problems.first().click();
  expect(await text.evaluate((t: HTMLTextAreaElement) => t.value.slice(t.selectionStart, t.selectionEnd))).toBe('sideways');

  // fix it again
  await text.fill(broken.replace('sideways', 'nominal'));
  await expect(problems).toHaveCount(0);
  const kept = await text.inputValue();

  // ---- reload keeps the script (tab cache) and the drawing
  await page.evaluate(async () => {
    const registry = await import('/src/services/service-registry.ts' as string);
    registry.ServiceRegistry.getTabManager().flushCache();
  });
  await page.reload();
  await openPanel(page);
  await expect(text).toHaveValue(kept);
  objs = await objects(page);
  expect(Object.keys(objs)).toHaveLength(7);
  await expect(status).toContainText('In sync with the drawing');
  expect(pageErrors).toEqual([]);
});

test('Railway Script: File > Import opens a script in a new tab, File > Export downloads YAML and JSON', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await freshPage(page);
  const file = join(tmpdir(), `rs-e2e-${Date.now()}.rdl.yaml`);
  await writeFile(file, SCRIPT.replace('name: E2E line', 'name: Imported line'));

  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), menu(page, 'file', 'importRailwayScript')]);
  await chooser.setFiles(file);
  await expect(page.locator('#tabs-container .tab-button')).toHaveCount(2);
  await expect(page.locator('#tabs-container .tab-button.active')).toContainText('Imported line');
  await expect.poll(async () => Object.keys(await objects(page)).length).toBe(7);
  const text = page.locator('[data-testid="railway-script-text"]');
  await expect(text).toBeVisible();
  await expect(text).toHaveValue(/name: Imported line/);

  // export as YAML: the script as written
  await menu(page, 'file', 'exportRailwayScript');
  const dialog = page.locator('[data-testid="railway-script-export-dialog"]');
  await expect(dialog).toBeVisible();
  const [yaml] = await Promise.all([page.waitForEvent('download'), dialog.locator('.rd-rs-export-yaml').click()]);
  expect(yaml.suggestedFilename()).toBe('Imported line.rdl.yaml');
  expect(await readFile(await yaml.path(), 'utf8')).toBe(await text.inputValue());

  // export as JSON: the same data
  await menu(page, 'file', 'exportRailwayScript');
  const [json] = await Promise.all([page.waitForEvent('download'), dialog.locator('.rd-rs-export-json').click()]);
  expect(json.suggestedFilename()).toBe('Imported line.rdl.json');
  const data = JSON.parse(await readFile(await json.path(), 'utf8'));
  expect(data).toMatchObject({ railwayScript: 1, name: 'Imported line', tracks: [{ id: 'T1' }, { id: 'T2' }] });
  expect(data.routes).toEqual([{ id: 'R1', from: 'S1', to: 'S3', via: { W1: 'reverse' } }]);

  // the first tab has no script: export generates one from its (empty) drawing
  await page.locator('#tabs-container .tab-button').first().click();
  await menu(page, 'file', 'exportRailwayScript');
  await expect(dialog).toContainText('no Railway Script');
  const [gen] = await Promise.all([page.waitForEvent('download'), dialog.locator('.rd-rs-export-yaml').click()]);
  expect(await readFile(await gen.path(), 'utf8')).toContain('railwayScript: 1');
  expect(pageErrors).toEqual([]);
});
