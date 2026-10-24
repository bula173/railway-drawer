/**
 * @file etcs-data.spec.ts
 * @brief ETCS balise data end to end: the ERTMS template "ertms-tpl-20" (T1 with the single-balise
 *        groups BG1 / BG4 / BG6 and three main signals) opened as a new diagram; the track gets a
 *        length and a speed limit in the Data panel; BG1's Data panel button opens the ETCS editor
 *        (Railway menu and context menu offer it too); packets 5 + 27 added, "Recompute from
 *        drawing" fills D_LINK (to BG4 / BG6, metres from the track length) and the speed
 *        profile (marked "from drawing"); an out-of-range Q_LOCACC is shown and refuses Save; the
 *        telegram view; Save -> rdEtcs on the cell (one undo step), live checks
 *        (etcs-no-packets for BG4 / BG6); File > Export > Railway Data > Balise ETCS data (.xlsx)
 *        parsed; File > Save keeps the data in the .drawio file. Any port.
 */
import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { clickMenuItem, openLeftTab } from './menu-helpers';

async function inGraph<T>(page: Page, body: string, arg?: unknown): Promise<T> {
  return page.evaluate(
    async ({ body, arg }) => {
      const registry = await import('/src/services/service-registry.ts' as string);
      const geometry = await import('/src/railway/geometry.ts' as string);
      const tab = registry.ServiceRegistry.getTabManager().getActiveTab();
      return new Function('graph', 'tab', 'arg', 'geometry', body)(tab.graph, tab, arg, geometry);
    },
    { body, arg }
  ) as Promise<T>;
}

const FIND = "const find = (id) => Object.values(graph.getDataModel().cells).find((c) => c.value && c.value.getAttribute && c.value.getAttribute('rdId') === id);";

/** Entries of a ZIP whose entries are stored (the app's xlsx writer does not compress). */
function unzipStored(buf: Buffer): Map<string, string> {
  const out = new Map<string, string>();
  let i = 0;
  while (i + 30 <= buf.length && buf.readUInt32LE(i) === 0x04034b50) {
    const size = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    const name = buf.toString('utf8', i + 30, i + 30 + nameLen);
    const start = i + 30 + nameLen + extraLen;
    out.set(name, buf.toString('utf8', start, start + size));
    i = start + size;
  }
  return out;
}

function readWorkbook(buf: Buffer): Map<string, string[][]> {
  const files = unzipStored(buf);
  const names = [...files.get('xl/workbook.xml')!.matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]);
  const unescape = (s: string): string => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const sheets = new Map<string, string[][]>();
  names.forEach((name, i) => {
    const xml = files.get(`xl/worksheets/sheet${i + 1}.xml`)!;
    // cells by their column letter (empty cells are not written)
    const col = (ref: string): number => [...ref].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
    const rows = [...xml.matchAll(/<row [^>]*>(.*?)<\/row>/g)].map((r) => {
      const out: string[] = [];
      for (const c of r[1].matchAll(/<c r="([A-Z]+)\d+"[^>]*>(?:<is><t[^>]*>(.*?)<\/t><\/is>|<v>(.*?)<\/v>)<\/c>/g)) out[col(c[1])] = unescape(c[2] ?? c[3] ?? '');
      return Array.from(out, (x) => x ?? '');
    });
    sheets.set(unescape(name), rows);
  });
  return sheets;
}

async function selectObject(page: Page, id: string): Promise<void> {
  await inGraph(page, `${FIND} graph.setSelectionCell(find(arg));`, id);
}

test('ETCS data: editor on a template balise group, recompute from the drawing, validation, telegrams, checks, XLSX, saved file', async ({ page }) => {
  test.slow();
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);

  // the ERTMS template as a new diagram
  await openLeftTab(page, 'templates');
  const tile = page.locator('#templates-panel [data-template-id="ertms-tpl-20"]');
  await tile.scrollIntoViewIfNeeded();
  await tile.click();
  await page.locator('.rd-tpl-popover [data-action="open"]').click();
  await expect(page.locator('#tabs-container .tab-button')).toHaveCount(2);
  await expect.poll(() => inGraph<boolean>(page, `${FIND} return !!find('BG1') && !!find('BG4') && !!find('BG6');`)).toBe(true);

  // geometry: the expected distances in drawing units (1 unit = 1 m after the length below)
  const geo = await inGraph<{ trackUnits: number; b1: number; b2: number; b3: number; s6: number }>(
    page,
    `${FIND}
     const line = geometry.trackPolyline(find('T1'));
     let len = 0; for (let i = 1; i < line.length; i++) len += Math.hypot(line[i].x - line[i-1].x, line[i].y - line[i-1].y);
     const cx = (id) => geometry.centerOf(find(id)).x;
     return { trackUnits: len, b1: cx('B1'), b2: cx('B2'), b3: cx('B3'), s6: cx('S6') };`
  );
  const trackLength = Math.round(geo.trackUnits * 10);

  // Data panel: track length (10 m per drawing unit) and speed limit
  await page.locator('.right-panel-switch-btn[data-right-panel="data"]').click();
  await selectObject(page, 'T1');
  const data = page.locator('#railway-data-panel');
  await data.locator('#rd-rw-f-length').fill(String(trackLength));
  await data.locator('#rd-rw-f-length').press('Enter');
  await data.locator('#rd-rw-f-speedLimit').fill('120');
  await data.locator('#rd-rw-f-speedLimit').press('Enter');
  await expect.poll(() => inGraph<string>(page, `${FIND} return find('T1').value.getAttribute('rdSpeedLimit');`)).toBe('120');

  // the Railway menu item and the context menu offer the editor for balise groups
  await selectObject(page, 'BG1');
  await expect(data.locator('[data-testid="data-etcs-button"]')).toBeVisible();
  await expect(data.locator('.rd-rw-etcs .rd-rw-hint')).toHaveText('no ETCS data yet');
  await data.locator('[data-testid="data-etcs-button"]').click();
  const dialog = page.locator('[data-testid="etcs-dialog"]');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.rd-route-dialog-title')).toHaveText('ETCS data — balise group BG1');
  await expect(dialog.locator('.rd-etcs-sub')).toContainText('NID_C 510 · NID_BG 1 · 1 balise (N_TOTAL 0) · orientation nominal');

  // packets 5 and 27
  await dialog.locator('.rd-etcs-add-select').selectOption('5');
  await dialog.locator('.rd-etcs-add').click();
  await dialog.locator('.rd-etcs-add-select').selectOption('27');
  await dialog.locator('.rd-etcs-add').click();
  await expect(dialog.locator('.rd-etcs-packet-item')).toHaveCount(2);
  await expect(dialog.locator('.rd-etcs-packet-item[aria-selected="true"]')).toHaveAttribute('data-nid', '27');
  // required values missing -> errors listed
  await expect(dialog.locator('.rd-etcs-problems')).toContainText('D_LINK is required');

  // Recompute from drawing
  await dialog.locator('.rd-etcs-recompute').click();
  await expect(dialog.locator('.rd-etcs-result')).toContainText('Recomputed:');
  // packet 27 (selected): 120 km/h from the group to the end of the walk (signal S6)
  const form = dialog.locator('.rd-etcs-form');
  await expect(form.locator('[data-path="V_STATIC"]')).toHaveValue('120');
  await expect(form.locator('[data-path="D_STATIC"]')).toHaveValue('0');
  const endStatic = Number(await form.locator('[data-path="steps.0.D_STATIC"]').inputValue());
  expect(Math.abs(endStatic - (geo.s6 - geo.b1) * 10)).toBeLessThanOrEqual(10);
  await expect(form.locator('[data-path="steps.0.V_STATIC"]')).toHaveValue('end');
  await expect(form.locator('.rd-etcs-auto')).not.toHaveCount(0);
  // packet 5: D_LINK to BG4, then BG6
  await dialog.locator('.rd-etcs-packet-item[data-nid="5"]').click();
  const dLink = Number(await form.locator('[data-path="D_LINK"]').inputValue());
  expect(Math.abs(dLink - (geo.b2 - geo.b1) * 10)).toBeLessThanOrEqual(1);
  await expect(form.locator('[data-path="NID_BG"]')).toHaveValue('4');
  await expect(form.locator('[data-path="links.0.NID_BG"]')).toHaveValue('6');
  const dLink2 = Number(await form.locator('[data-path="links.0.D_LINK"]').inputValue());
  expect(Math.abs(dLink2 - (geo.b3 - geo.b2) * 10)).toBeLessThanOrEqual(1);
  await expect(form.locator('[data-path="Q_LINKORIENTATION"]')).toHaveValue('1');
  await expect(dialog.locator('.rd-etcs-problems')).not.toContainText('error');

  // validation: Q_LOCACC out of range is marked and refuses Save
  await form.locator('[data-path="Q_LOCACC"]').fill('99');
  await form.locator('[data-path="Q_LOCACC"]').press('Enter');
  await expect(dialog.locator('.rd-etcs-problems')).toContainText('Q_LOCACC 99 m is outside 0–63 m');
  await expect(form.locator('[data-path="Q_LOCACC"]')).toHaveAttribute('aria-invalid', 'true');
  await dialog.locator('.rd-etcs-save').click();
  await expect(dialog.locator('.rd-etcs-error')).toContainText('Not saved: 1 error');
  await expect(dialog).toBeVisible();
  await form.locator('[data-path="Q_LOCACC"]').fill('12');
  await form.locator('[data-path="Q_LOCACC"]').press('Enter');
  await expect(form.locator('[data-path="Q_LOCACC"]')).not.toHaveAttribute('aria-invalid', 'true');
  // a hand-set distance that differs from the drawing is flagged by the next recompute
  await form.locator('[data-path="D_LINK"]').fill(String(dLink + 40));
  await form.locator('[data-path="D_LINK"]').press('Enter');
  await dialog.locator('.rd-etcs-recompute').click();
  await expect(form.locator('.rd-etcs-mismatch')).toContainText(`drawing: ${dLink} m`);
  await dialog.screenshot({ path: test.info().outputPath('etcs-editor-mismatch.png') });
  await form.locator('.rd-etcs-mismatch .rd-etcs-use').click();
  await expect(form.locator('[data-path="D_LINK"]')).toHaveValue(String(dLink));

  // the telegram of the single balise
  await dialog.locator('.rd-route-tab[data-tab="telegrams"]').click();
  await expect(dialog.locator('.rd-etcs-telegram')).toHaveCount(1);
  await expect(dialog.locator('.rd-etcs-telegram[data-pig="0"] .rd-etcs-total')).toContainText('of 830 user bits');
  await expect(dialog.locator('.rd-etcs-telegram .rd-etcs-hex')).toHaveText(/^A1[0-9A-F]+$/);
  await dialog.screenshot({ path: test.info().outputPath('etcs-telegrams.png') });

  // Save: one undoable edit on the group
  await dialog.locator('.rd-etcs-save').click();
  await expect(dialog).toHaveCount(0);
  const stored = await inGraph<string>(page, `${FIND} return find('BG1').value.getAttribute('rdEtcs');`);
  const json = JSON.parse(stored);
  expect(json.packets.map((p: { nid: number }) => p.nid)).toEqual([5, 27]);
  expect(json.packets[0].vars.D_LINK).toBe(dLink);
  expect(json.packets[0].vars.Q_LOCACC).toBe(12);
  expect(json.packets[0].auto).toContain('D_LINK');
  await expect(data.locator('.rd-rw-etcs .rd-rw-hint')).toHaveText('2 packets: 5, 27');

  // live checks: BG4 / BG6 have no packets now that the drawing has ETCS data
  await page.locator('.right-panel-switch-btn[data-right-panel="checks"]').click();
  const checks = page.locator('#railway-checks-panel');
  await expect(checks.locator('.rd-rw-issue[data-rule="etcs-no-packets"]')).toHaveCount(2);
  await expect(checks.locator('.rd-rw-issue[data-rule="etcs-linking-distance"]')).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('etcs-checks.png') });

  // the Railway menu and the context menu open it too
  await selectObject(page, 'BG1');
  await clickMenuItem(page, 'railway', 'etcsData');
  await expect(dialog.locator('.rd-etcs-packet-item')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  // XLSX: summary per group + one row per variable
  const [xlsx] = await Promise.all([page.waitForEvent('download'), clickMenuItem(page, 'file', 'exportRailway:etcsXlsx')]);
  expect(xlsx.suggestedFilename()).toMatch(/-balise-data\.xlsx$/);
  const book = readWorkbook(await readFile((await xlsx.path())!));
  expect([...book.keys()]).toEqual(['Balise groups', 'Balise data']);
  const summary = book.get('Balise groups')!;
  expect(summary[0].slice(0, 3)).toEqual(['Group', 'NID_C', 'NID_BG']);
  const bg1Row = summary.find((r) => r[0] === 'BG1')!;
  expect(bg1Row[9]).toBe('5, 27, 255');
  const rows = book.get('Balise data')!;
  const dLinkRow = rows.find((r) => r[0] === 'BG1' && r[6] === '5' && r[11] === 'D_LINK')!;
  expect(Number(dLinkRow[12])).toBe(dLink);
  expect(dLinkRow[16]).toBe('drawing');
  expect(rows.some((r) => r[0] === 'BG1' && r[6] === '27' && r[11] === 'V_STATIC' && r[12] === '120')).toBe(true);

  // Ctrl+Z undoes the save in one step, Ctrl+Y redoes it
  await page.locator('#graph-container').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => inGraph<string | null>(page, `${FIND} return find('BG1').value.getAttribute('rdEtcs');`)).toBeNull();
  await page.keyboard.press('ControlOrMeta+y');
  await expect.poll(() => inGraph<string | null>(page, `${FIND} return find('BG1').value.getAttribute('rdEtcs');`)).toBe(stored);

  // File > Save: the data is draw.io object data of the group
  const savePromise = page.waitForEvent('download');
  await page.locator('.menu-item[data-menu="file"]').click();
  await page.locator('.menu-dropdown-item[data-action="save"]').click();
  const xml = await readFile(await (await savePromise).path(), 'utf8');
  const bg1 = /<object [^>]*rdId="BG1"[^>]*>/.exec(xml)?.[0] ?? '';
  const attr = /rdEtcs="([^"]*)"/.exec(bg1)?.[1] ?? '';
  expect(attr.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')).toBe(stored);

  expect(pageErrors).toEqual([]);
});
