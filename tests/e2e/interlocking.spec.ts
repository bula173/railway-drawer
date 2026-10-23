/**
 * @file interlocking.spec.ts
 * @brief Interlocking table and rule checks end to end: a crossover layout (T1/T2 with km, points
 *        W1/W2, signals S1-S4) with three routes on the Routes layer is loaded like a file;
 *        Railway > Conflict Matrix… shows the symmetric matrix (R1/R3 and R2/R3: S P F, parallel
 *        R1/R2 free), the Interlocking table tab the flank protection; the XLSX download is
 *        unzipped and parsed (PKP sheets "Tablica zależności" / "Macierz konfliktów", English
 *        headers option), the matrix CSV; Railway > Rule Settings… raises the minimum overlap
 *        length -> the overlap findings appear in the Checks panel (live), stored on the diagram;
 *        reset to the defaults -> they disappear.
 *
 * Reads the graph through the dev server's module graph (like ertms-routes.spec.ts). Any port.
 */
import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { clickMenuItem } from './menu-helpers';

async function inGraph<T>(page: Page, body: string, arg?: unknown): Promise<T> {
  return page.evaluate(
    async ({ body, arg }) => {
      const registry = await import('/src/services/service-registry.ts' as string);
      const tab = registry.ServiceRegistry.getTabManager().getActiveTab();
      return new Function('graph', 'tab', 'arg', body)(tab.graph, tab, arg);
    },
    { body, arg }
  ) as Promise<T>;
}

const obj = (id: string, attrs: string, style: string, geo: string, edge = false, parent = '1'): string =>
  `<object label="" id="${id}" ${attrs}><mxCell style="${style}" ${edge ? 'edge="1"' : 'vertex="1"'} parent="${parent}">${geo}</mxCell></object>`;
const line = (x1: number, y1: number, x2: number, y2: number): string =>
  `<mxGeometry relative="1" as="geometry"><mxPoint x="${x1}" y="${y1}" as="sourcePoint"/><mxPoint x="${x2}" y="${y2}" as="targetPoint"/></mxGeometry>`;
const box = (cx: number, cy: number): string => `<mxGeometry x="${cx - 10}" y="${cy - 10}" width="20" height="20" as="geometry"/>`;
const TRACK = 'endArrow=none;html=1;strokeWidth=4;';
const SIGNAL = 'triangle;whiteSpace=wrap;html=1;fillColor=#000000;';
const ROUTE = 'endArrow=block;strokeColor=#ff8f00;';

/*   S1>        W1                     S2>     T1 y=100, x 0..800, km 10.0-10.8 (1 unit = 1 m)
 *   ===========*==========================
 *                \
 *   S3>           \ W2                S4>     T2 y=200, x 0..800, km 20.0-20.8
 *   ================*=====================
 */
const CROSSOVER = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
${obj('t1', 'rdKind="track" rdId="T1" rdKmStart="10" rdKmEnd="10.8"', TRACK, line(0, 100, 800, 100), true)}
${obj('t2', 'rdKind="track" rdId="T2" rdKmStart="20" rdKmEnd="20.8"', TRACK, line(0, 200, 800, 200), true)}
${obj('w1', 'rdKind="points" rdId="W1" rdTrackId="T1"', TRACK, line(300, 100, 350, 150), true)}
${obj('w2', 'rdKind="points" rdId="W2" rdTrackId="T2"', TRACK, line(350, 150, 400, 200), true)}
${obj('s1', 'rdKind="signal" rdId="S1" rdSignalType="main" rdDirection="nominal" rdTrackId="T1"', SIGNAL, box(50, 114))}
${obj('s2', 'rdKind="signal" rdId="S2" rdSignalType="main" rdDirection="nominal" rdTrackId="T1"', SIGNAL, box(700, 114))}
${obj('s3', 'rdKind="signal" rdId="S3" rdSignalType="main" rdDirection="nominal" rdTrackId="T2"', SIGNAL, box(50, 214))}
${obj('s4', 'rdKind="signal" rdId="S4" rdSignalType="main" rdDirection="nominal" rdTrackId="T2"', SIGNAL, box(700, 214))}
<mxCell id="rd-routes" value="Routes" parent="0"/>
${obj('r1', 'rdKind="route" rdId="R1" rdEntrySignal="S1" rdExitSignal="S2" rdPoints="W1:normal" rdSections="T1" rdOverlap="T1"', ROUTE, line(50, 100, 700, 100), true, 'rd-routes')}
${obj('r2', 'rdKind="route" rdId="R2" rdEntrySignal="S3" rdExitSignal="S4" rdPoints="W2:normal" rdSections="T2" rdOverlap="T2"', ROUTE, line(50, 200, 700, 200), true, 'rd-routes')}
${obj('r3', 'rdKind="route" rdId="R3" rdEntrySignal="S1" rdExitSignal="S4" rdPoints="W1:reverse, W2:reverse" rdSections="T1, T2" rdOverlap="T2"', ROUTE, line(50, 100, 700, 200), true, 'rd-routes')}
</root></mxGraphModel>`;

/** Entries of a ZIP whose entries are stored (the app's xlsx writer does not compress). */
function unzipStored(buf: Buffer): Map<string, string> {
  const out = new Map<string, string>();
  let i = 0;
  while (i + 30 <= buf.length && buf.readUInt32LE(i) === 0x04034b50) {
    const method = buf.readUInt16LE(i + 8);
    const size = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    const name = buf.toString('utf8', i + 30, i + 30 + nameLen);
    const start = i + 30 + nameLen + extraLen;
    if (method !== 0) throw new Error(`${name}: compressed entry`);
    out.set(name, buf.toString('utf8', start, start + size));
    i = start + size;
  }
  return out;
}

/** Sheet name -> rows of cell texts (inline strings / numbers) of an xlsx workbook. */
function readWorkbook(buf: Buffer): Map<string, string[][]> {
  const files = unzipStored(buf);
  const names = [...files.get('xl/workbook.xml')!.matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]);
  const unescape = (s: string): string => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const sheets = new Map<string, string[][]>();
  names.forEach((name, i) => {
    const xml = files.get(`xl/worksheets/sheet${i + 1}.xml`)!;
    const rows = [...xml.matchAll(/<row [^>]*>(.*?)<\/row>/g)].map((r) =>
      [...r[1].matchAll(/<c r="([A-Z]+)\d+"[^>]*>(?:<is><t[^>]*>(.*?)<\/t><\/is>|<v>(.*?)<\/v>)<\/c>/g)].map((c) => unescape(c[2] ?? c[3] ?? ''))
    );
    sheets.set(unescape(name), rows);
  });
  return sheets;
}

test('interlocking: conflict matrix, interlocking table, XLSX/CSV export, rule settings -> findings', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
  await inGraph(page, 'tab.document.load(arg);', CROSSOVER);

  // Railway > Conflict Matrix…: the Conflicts tab with the symmetric matrix
  await clickMenuItem(page, 'railway', 'railwayRoute:conflictMatrix');
  const dialog = page.locator('[data-testid="route-tables-dialog"]');
  await expect(dialog.locator('.rd-route-tab[data-tab="conflicts"]')).toHaveAttribute('aria-selected', 'true');
  await expect(dialog.locator('.rd-route-tab[data-tab="conflicts"]')).toHaveText('Conflicts (2)');
  const cell = (row: string, col: string) => dialog.locator(`.rd-il-matrix td[data-row="${row}"][data-col="${col}"]`);
  await expect(cell('R1', 'R3')).toHaveText('S P F');
  await expect(cell('R3', 'R1')).toHaveText('S P F');
  await expect(cell('R2', 'R3')).toHaveText('S P F');
  await expect(cell('R1', 'R2')).toHaveText('');
  await expect(cell('R2', 'R1')).toHaveText('');
  await expect(cell('R2', 'R2')).toHaveText('×');
  await expect(cell('R1', 'R3')).toHaveAttribute('title', 'R1 / R3: shared section, opposite points positions, flank protection');
  await expect(dialog.locator('.rd-route-table tbody tr')).toHaveCount(2);
  const [csv] = await Promise.all([page.waitForEvent('download'), dialog.locator('.rd-route-export-csv').click()]);
  expect(csv.suggestedFilename()).toMatch(/-conflict-matrix\.csv$/);
  const csvText = await readFile((await csv.path())!, 'utf8');
  expect(csvText).toContain('Przebieg,R1,R2,R3');
  expect(csvText).toContain('R3,S P F,S P F,×');

  // Interlocking table tab: points with roles, flank protection, conflicting routes, aspects
  await dialog.locator('.rd-route-tab[data-tab="interlocking"]').click();
  const rows = dialog.locator('.rd-il-table tbody tr');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0).locator('td')).toHaveText(['R1', 'S1', 'S2', 'W1 normal (facing)', 'W2 normal', 'T1', 'T1', 'R3 (S,P,F)', 'Proceed (S2 proceed) / Caution (S2 at stop)']);
  await expect(rows.nth(2).locator('td').nth(3)).toHaveText('W1 reverse (facing), W2 reverse (trailing)');
  await expect(rows.nth(2).locator('td').nth(4)).toHaveText('S3 stop');

  // XLSX: PKP sheets in Polish, then with English headers
  const [xlsx] = await Promise.all([page.waitForEvent('download'), dialog.locator('.rd-route-export-xlsx').click()]);
  expect(xlsx.suggestedFilename()).toMatch(/-routes\.xlsx$/);
  const book = readWorkbook(await readFile((await xlsx.path())!));
  expect([...book.keys()]).toEqual(['Tablica zależności', 'Macierz konfliktów', 'Routes', 'Konflikty']);
  const il = book.get('Tablica zależności')!;
  expect(il[0]).toEqual(['Przebieg', 'Od semafora', 'Do semafora', 'Zwrotnice (położenie)', 'Ochrona boczna', 'Odcinki izolowane/sekcje', 'Zakładka', 'Przebiegi wykluczające się', 'Sygnał na semaforze']);
  expect(il[3].slice(0, 8)).toEqual(['R3', 'S1', 'S4', 'W1-, W2-', 'S3 Stój', 'T1, T2', 'T2', 'R1 (S,P,F), R2 (S,P,F)']);
  expect(book.get('Macierz konfliktów')![1]).toEqual(['R1', '×', 'S P F']);
  await dialog.locator('[data-action="english-headers"]').check();
  const [xlsxEn] = await Promise.all([page.waitForEvent('download'), dialog.locator('.rd-route-export-xlsx').click()]);
  const bookEn = readWorkbook(await readFile((await xlsxEn.path())!));
  expect([...bookEn.keys()]).toEqual(['Interlocking table', 'Conflict matrix', 'Routes', 'Conflicts']);
  expect(bookEn.get('Interlocking table')![0][0]).toBe('Route');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  // Rule settings: overlap length 150 m -> R1/R2/R3 overlaps (100 m) are too short, live in the Checks panel
  await page.locator('.right-panel-switch-btn[data-right-panel="checks"]').click();
  const checks = page.locator('#railway-checks-panel');
  const overlapIssues = checks.locator('.rd-rw-issue[data-rule="overlap-length"]');
  await expect(checks.locator('.rd-rw-summary')).not.toHaveText('Checks have not run yet.');
  await expect(overlapIssues).toHaveCount(0);
  await clickMenuItem(page, 'railway', 'railwayRoute:ruleSettings');
  const settings = page.locator('[data-testid="rule-settings-dialog"]');
  await expect(settings.locator('tr[data-rule]')).toHaveCount(10);
  const overlapRow = settings.locator('tr[data-rule="overlap-length"]');
  await expect(overlapRow).toContainText('Minimalna długość zakładki');
  await expect(overlapRow.locator('[data-param="min"]')).toHaveValue('50');
  await overlapRow.locator('[data-param="min"]').fill('150');
  await settings.locator('.rd-rules-save').click();
  await expect(settings).toHaveCount(0);
  await expect(overlapIssues).toHaveCount(3);
  await expect(overlapIssues.first()).toContainText('is 100 m beyond S2; rule: at least 150 m');
  // the finding links to the exit signal as well
  await expect(overlapIssues.first().locator('.rd-rw-issue-rel')).toHaveText('S2');
  expect(await inGraph<string>(page, "return graph.getDataModel().getRoot().getValue().getAttribute('rdRuleSettings');")).toBe('{"overlap-length":{"params":{"min":150}}}');

  // invalid input is refused; reset to the defaults removes the findings again
  await clickMenuItem(page, 'railway', 'railwayRoute:ruleSettings');
  await expect(settings.locator('tr[data-rule="overlap-length"] [data-param="min"]')).toHaveValue('150');
  await settings.locator('tr[data-rule="bg-signal-distance"] [data-param="min"]').fill('80');
  await settings.locator('.rd-rules-save').click();
  await expect(settings.locator('.rd-rules-error')).toContainText('min > max');
  await settings.locator('.rd-rules-reset').click();
  await settings.locator('.rd-rules-save').click();
  await expect(settings).toHaveCount(0);
  await expect(overlapIssues).toHaveCount(0);
  expect(await inGraph<string | null>(page, "return graph.getDataModel().getRoot().getValue().getAttribute('rdRuleSettings');")).toBeNull();

  // the drawing models no train detection: those rules only leave notes (info)
  await expect(checks.locator('.rd-rw-note')).not.toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
