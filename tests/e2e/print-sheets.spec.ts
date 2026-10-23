/**
 * @file print-sheets.spec.ts
 * @brief Print sheets (src/print): File > Page Setup… A3 landscape + Title Block… + Revisions… ->
 *        the sheet border (frame, title block) is drawn on the canvas; View > Pages… adds a page,
 *        View > Insert Sheet Reference… adds continuation markers that go to their page on click;
 *        File > Export > Sheets (PDF) downloads a real PDF (parsed: page count, A3 landscape page
 *        size, the title block text with Polish letters through the embedded font's ToUnicode
 *        map, the marker label with the target sheet number); File > Print… fills the print-only
 *        container (one sheet per page, its paper size) and calls window.print(); the .drawio file
 *        keeps draw.io's page attributes and the title block.
 *
 * Runs on any port (dev server only: the tab is reached through the service registry module).
 */
import { readFile } from 'node:fs/promises';
import { inflateSync, constants as zlib } from 'node:zlib';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { clickMenuItem } from './menu-helpers';

const SHOT_DIR = process.env.PRINT_SHEETS_SHOTS ?? '';

async function freshApp(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
}

/** Runs `body` with `tab` = the active tab (graph, document). */
async function withTab<T>(page: Page, body: string): Promise<T> {
  return page.evaluate(async (code) => {
    const registry = await import('/src/services/service-registry.ts' as string);
    const tab = registry.ServiceRegistry.getTabManager().getActiveTab();
    return new Function('tab', `return (async () => { ${code} })();`)(tab);
  }, body) as Promise<T>;
}

/** Shows the whole sheet (the page at the origin, A3 landscape) in the view. */
async function fitSheet(page: Page): Promise<void> {
  await withTab(
    page,
    `const c = tab.graph.container; const s = Math.min(c.clientWidth / 1720, c.clientHeight / 1240);
     tab.graph.view.scaleAndTranslate(s, 30, 30); c.scrollLeft = 0; c.scrollTop = 0;`
  );
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: SHOT_DIR ? `${SHOT_DIR}/${name}.png` : test.info().outputPath(`${name}.png`) });
}

// ---- a small PDF reader: objects, Flate streams, ToUnicode maps, shown text -------------------------

interface PdfObject {
  dict: string;
  stream: Buffer | null;
}

function pdfObjects(bytes: Buffer): Map<number, PdfObject> {
  const raw = bytes.toString('latin1');
  const out = new Map<number, PdfObject>();
  const re = /(\d+) 0 obj\b([\s\S]*?)\bendobj/g;
  for (let m = re.exec(raw); m; m = re.exec(raw)) {
    const body = m[2];
    const at = body.indexOf('stream');
    if (at < 0) {
      out.set(Number(m[1]), { dict: body, stream: null });
      continue;
    }
    const dict = body.slice(0, at);
    let start = at + 6;
    if (body[start] === '\r') start++;
    if (body[start] === '\n') start++;
    const end = body.lastIndexOf('endstream');
    let data = Buffer.from(body.slice(start, end), 'latin1');
    if (/\/FlateDecode/.test(dict)) data = inflateSync(data, { finishFlush: zlib.Z_SYNC_FLUSH });
    out.set(Number(m[1]), { dict, stream: data });
  }
  return out;
}

function hexToUtf16(hex: string): string {
  let s = '';
  for (let i = 0; i + 4 <= hex.length; i += 4) s += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
  return s;
}

function parseCmap(text: string): Map<number, string> {
  const map = new Map<number, string>();
  for (const block of text.match(/beginbfchar([\s\S]*?)endbfchar/g) ?? []) {
    for (const m of block.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) map.set(parseInt(m[1], 16), hexToUtf16(m[2]));
  }
  for (const block of text.match(/beginbfrange([\s\S]*?)endbfrange/g) ?? []) {
    for (const m of block.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      const a = parseInt(m[1], 16);
      const b = parseInt(m[2], 16);
      const base = parseInt(m[3], 16);
      for (let c = a; c <= b; c++) map.set(c, String.fromCharCode(base + c - a));
    }
  }
  return map;
}

/** The text shown on each page (Tj / TJ with the fonts' ToUnicode maps; standard fonts as Latin-1). */
function pdfPageTexts(bytes: Buffer): string[] {
  const objects = pdfObjects(bytes);
  const fontMaps = new Map<string, Map<number, string> | null>();
  const resourceFonts = new Map<string, number>();
  for (const [, obj] of objects) {
    for (const m of obj.dict.matchAll(/\/(F\d+)\s+(\d+) 0 R/g)) resourceFonts.set(m[1], Number(m[2]));
  }
  for (const [name, id] of resourceFonts) {
    const font = objects.get(id);
    const toUnicode = font ? /\/ToUnicode\s+(\d+) 0 R/.exec(font.dict) : null;
    const cmap = toUnicode ? objects.get(Number(toUnicode[1]))?.stream?.toString('latin1') : null;
    fontMaps.set(name, cmap ? parseCmap(cmap) : null);
  }
  const decode = (hex: string, map: Map<number, string> | null | undefined): string => {
    if (!map) return Buffer.from(hex, 'hex').toString('latin1');
    let s = '';
    for (let i = 0; i + 4 <= hex.length; i += 4) s += map.get(parseInt(hex.slice(i, i + 4), 16)) ?? '';
    return s;
  };
  const pages: string[] = [];
  for (const [, obj] of objects) {
    if (!/\/Type\s*\/Page[^s]/.test(obj.dict)) continue;
    const contents = /\/Contents\s+(\d+) 0 R/.exec(obj.dict);
    const stream = contents ? objects.get(Number(contents[1]))?.stream?.toString('latin1') : null;
    if (!stream) continue;
    let font: string | null = null;
    let text = '';
    const tokens = /\/(F\d+)\s+[\d.]+\s+Tf|<([0-9a-fA-F]*)>\s*Tj|\[((?:[^\]\\]|\\.)*)\]\s*TJ|\(((?:[^)\\]|\\.)*)\)\s*Tj|\bET\b/g;
    for (let m = tokens.exec(stream); m; m = tokens.exec(stream)) {
      if (m[1]) font = m[1];
      else if (m[2] !== undefined) text += decode(m[2], font ? fontMaps.get(font) : null);
      else if (m[3] !== undefined) {
        for (const part of m[3].matchAll(/<([0-9a-fA-F]*)>|\(((?:[^)\\]|\\.)*)\)/g)) text += part[1] !== undefined ? decode(part[1], font ? fontMaps.get(font) : null) : part[2];
      } else if (m[4] !== undefined) text += m[4];
      else text += '\n';
    }
    pages.push(text);
  }
  return pages;
}

// ---- the flow -----------------------------------------------------------------------------------------

test.describe('print sheets', () => {
  test('page setup + title block -> sheet border on the canvas; pages, sheet references, PDF, print', async ({ page }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    const warnings: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'warning' || msg.type() === 'error') warnings.push(msg.text());
    });
    await freshApp(page);
    await withTab(
      page,
      `const graph = tab.graph;
       graph.batchUpdate(() => {
         graph.insertVertex(graph.getDefaultParent(), null, 'Łódź Kaliska', 120, 120, 160, 60, 'rounded=1;whiteSpace=wrap;html=1;');
         graph.insertVertex(graph.getDefaultParent(), null, 'Żółta głowica', 520, 160, 160, 60, 'shape=hexagon;whiteSpace=wrap;html=1;');
         const signal = new DOMParser().parseFromString('<object label="S1" rdKind="signal" rdId="S1" rdSignalType="main"/>', 'text/xml').documentElement;
         graph.insertVertex(graph.getDefaultParent(), null, signal, 340, 330, 24, 48, 'shape=ellipse;fillColor=#ff0000;');
       });`
    );

    // File > Page Setup…: A3 landscape, fit
    await clickMenuItem(page, 'file', 'pageSetup');
    const setup = page.locator('[data-testid="sheet-setup-dialog"]');
    await expect(setup).toBeVisible();
    await setup.locator('select[name="format"]').selectOption('A3');
    await setup.locator('select[name="orientation"]').selectOption('landscape');
    await setup.locator('input[name="sheetTitle"]').fill('Plan schematyczny — głowica A');
    await setup.locator('.rd-tpl-btn-primary').click();
    await expect(setup).toHaveCount(0);
    const overlay = page.locator('[data-testid="sheet-overlay"]');
    await expect(overlay).toHaveCount(1);
    await expect(overlay).toHaveAttribute('data-format', 'A3 landscape');
    expect(await withTab<unknown>(page, 'return tab.document.getPageSettings();')).toMatchObject({ pageWidth: 1654, pageHeight: 1169, pageScale: 1, page: true });
    // the View menu item follows
    await page.locator('.menu-item[data-menu="view"]').click();
    await expect(page.locator('.menu-dropdown[data-menu="view"] [data-action="toggleSheetBorder"]')).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');

    // File > Title Block…
    await clickMenuItem(page, 'file', 'titleBlock');
    const tb = page.locator('[data-testid="title-block-dialog"]');
    await expect(tb).toBeVisible();
    await tb.locator('input[name="project"]').fill('Stacja Łódź Kaliska — przebudowa');
    await tb.locator('input[name="drawingNumber"]').fill('RD-ŁK-001');
    await tb.locator('input[name="designed"]').fill('Józef Żółć');
    await tb.locator('input[name="company"]').fill('Koleje Śląskie Projekt');
    await tb.locator('input[name="status"]').fill('Do uzgodnień');
    await tb.locator('.rd-tpl-btn-primary').click();
    await expect(tb).toHaveCount(0);
    // File > Revisions…
    await clickMenuItem(page, 'file', 'revisions');
    const rev = page.locator('[data-testid="revisions-dialog"]');
    await rev.locator('.rd-print-add-rev').click();
    await rev.locator('input[name="description-0"]').fill('Pierwsze wydanie');
    await rev.locator('.rd-tpl-btn-primary').click();
    await expect(rev).toHaveCount(0);
    // the overlay shows the title block (debounced redraw)
    await expect(overlay.locator('[data-field="project"]')).toContainText('Stacja Łódź Kaliska');
    await expect(overlay.locator('[data-field="title"]').first()).toContainText('Plan schematyczny');
    await expect(overlay.locator('[data-field="sheet"]')).toHaveText('1 z 1');
    await expect(overlay.locator('[data-field="rev-description"]')).toHaveText('Pierwsze wydanie');
    await expect(overlay.locator('.rd-sheet-frame')).toHaveCount(1);
    await fitSheet(page);
    await shot(page, 'sheet-border-a3-landscape');

    // View > Pages…: a second page, shown
    await clickMenuItem(page, 'view', 'pages');
    const pages = page.locator('[data-testid="pages-dialog"]');
    await expect(pages.locator('li')).toHaveCount(1);
    await pages.locator('.rd-print-page-add').click();
    const nameDialog = page.locator('[data-testid="page-name-dialog"]');
    await nameDialog.locator('input[name="page-name"]').fill('Szlak');
    await nameDialog.locator('.rd-tpl-btn-primary').click();
    await expect(pages).toHaveCount(0);
    expect(await withTab<number>(page, 'return tab.document.shownPageIndex();')).toBe(1);
    // the new page has the same sheet
    await expect(overlay).toHaveAttribute('data-format', 'A3 landscape');
    await expect(overlay.locator('[data-field="sheet"]')).toHaveText('2 z 2');
    await withTab(page, `tab.graph.insertVertex(tab.graph.getDefaultParent(), null, 'Szlak Ś1', 200, 200, 120, 50, 'whiteSpace=wrap;html=1;');`);

    // View > Insert Sheet Reference… on page 2 -> page 1
    await clickMenuItem(page, 'view', 'insertSheetRef');
    const refDialog = page.locator('[data-testid="sheet-ref-dialog"]');
    await expect(refDialog).toBeVisible();
    await refDialog.locator('.rd-tpl-btn-primary').click();
    await expect.poll(() => withTab<string>(page, `const c = tab.graph.getSelectionCell(); return c && c.getValue().getAttribute('label');`)).toBe('ciąg dalszy na arkuszu 1');
    const markerId = await withTab<string>(page, 'return tab.graph.getSelectionCell().getId();');
    await withTab(page, `const c = tab.graph.getDataModel().getCell('${markerId}'); tab.graph.moveCells([c], 400 - c.getGeometry().x, 400 - c.getGeometry().y); tab.graph.clearSelection();`);

    // a click on the marker goes to page 1 (a drag would move it)
    const clickMarker = async (id: string): Promise<void> => {
      const box = await withTab<{ x: number; y: number }>(
        page,
        `const cell = tab.graph.getDataModel().getCell('${id}'); tab.graph.zoomActual(); tab.graph.scrollCellToVisible(cell, true); const s = tab.graph.view.getState(cell); const r = tab.graph.container.getBoundingClientRect(); return { x: r.left + s.getCenterX() - tab.graph.container.scrollLeft, y: r.top + s.getCenterY() - tab.graph.container.scrollTop };`
      );
      await page.mouse.click(box.x, box.y);
    };
    await clickMarker(markerId);
    await expect.poll(() => withTab<number>(page, 'return tab.document.shownPageIndex();')).toBe(0);
    await expect.poll(() => withTab<string>(page, `return tab.graph.getChildVertices(tab.graph.getDefaultParent()).map((c) => typeof c.getValue() === 'string' ? c.getValue() : c.getValue().getAttribute('label')).join('|');`)).toBe('Łódź Kaliska|Żółta głowica|S1');
    await expect(overlay.locator('[data-field="sheet"]')).toHaveText('1 z 2');

    // page 1 -> page 2 marker, clicked
    await clickMenuItem(page, 'view', 'insertSheetRef');
    await expect(refDialog).toBeVisible();
    await refDialog.locator('.rd-tpl-btn-primary').click();
    await expect.poll(() => withTab<string>(page, `const c = tab.graph.getSelectionCell(); return c && c.getValue().getAttribute('label');`)).toBe('ciąg dalszy na arkuszu 2');
    const marker2 = await withTab<string>(page, 'const c = tab.graph.getSelectionCell(); tab.graph.moveCells([c], 900 - c.getGeometry().x, 300 - c.getGeometry().y); tab.graph.clearSelection(); return c.getId();');
    await clickMarker(marker2);
    await expect.poll(() => withTab<number>(page, 'return tab.document.shownPageIndex();')).toBe(1);
    await expect.poll(() => withTab<string>(page, `return tab.graph.getChildVertices(tab.graph.getDefaultParent()).map((c) => typeof c.getValue() === 'string' ? c.getValue() : c.getValue().getAttribute('label')).join('|');`)).toBe('Szlak Ś1|ciąg dalszy na arkuszu 1');
    await fitSheet(page);
    await shot(page, 'sheet-2-with-reference');

    // File > Export > Sheets…: PDF of both pages
    await clickMenuItem(page, 'file', 'exportSheets');
    const exportDialog = page.locator('[data-testid="export-sheets-dialog"]');
    await expect(exportDialog).toBeVisible();
    await expect(exportDialog.locator('input[type="checkbox"]')).toHaveCount(2);
    const download = page.waitForEvent('download');
    await exportDialog.locator('.rd-tpl-btn-primary').click();
    const pdf = await download;
    expect(pdf.suggestedFilename()).toMatch(/ - sheets\.pdf$/);
    const pdfPath = SHOT_DIR ? `${SHOT_DIR}/sheets.pdf` : test.info().outputPath('sheets.pdf');
    await pdf.saveAs(pdfPath);
    const bytes = await readFile(pdfPath);
    const raw = bytes.toString('latin1');
    expect(raw.startsWith('%PDF-')).toBe(true);
    expect((raw.match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(2);
    // A3 landscape: 420 x 297 mm = 1190.55 x 841.89 pt
    const boxes = [...raw.matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)].map((m) => [Number(m[1]), Number(m[2])]);
    expect(boxes.length).toBeGreaterThanOrEqual(2);
    for (const [w, h] of boxes) {
      expect(w).toBeCloseTo(1190.55, 0);
      expect(h).toBeCloseTo(841.89, 0);
    }
    expect(raw).toMatch(/\/BaseFont \/DejaVuSans/);
    const texts = pdfPageTexts(bytes);
    expect(texts).toHaveLength(2);
    const flat = texts.map((t) => t.replace(/\s+/g, ' '));
    expect(flat[0]).toContain('Stacja Łódź Kaliska');
    expect(flat[0]).toContain('Józef Żółć');
    expect(flat[0]).toContain('Tytuł rysunku');
    expect(flat[0]).toContain('Plan schematyczny');
    expect(flat[0]).toContain('Pierwsze wydanie');
    expect(flat[0]).toContain('1 z 2');
    expect(flat[0]).toContain('Żółta głowica'); // a drawing label, as vector text
    expect(flat[0]).toContain('ciąg dalszy na arkuszu 2');
    expect(flat[0]).toContain('Legenda');
    expect(flat[0]).toContain('Main signal');
    expect(flat[1]).toContain('2 z 2');
    expect(flat[1]).toContain('ciąg dalszy na arkuszu 1');
    expect(warnings.filter((w) => /Sheet as vector failed|PDF fonts could not be loaded/.test(w))).toEqual([]);

    // File > Print…: the print-only container, then window.print()
    await page.evaluate(() => {
      (window as unknown as { __printed: number }).__printed = 0;
      window.print = () => {
        (window as unknown as { __printed: number }).__printed++;
      };
    });
    await clickMenuItem(page, 'file', 'print');
    await expect(exportDialog).toBeVisible();
    await exportDialog.locator('.rd-tpl-btn-primary').click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1);
    const sheets = page.locator('#rd-print-root .rd-print-sheet');
    await expect(sheets).toHaveCount(2);
    await expect(sheets.first()).toHaveAttribute('data-paper', 'A3-landscape');
    await expect(sheets.first().locator('svg').first()).toHaveAttribute('width', '420mm');
    await expect(sheets.first().locator('[data-field="project"]')).toContainText('Łódź');
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#app-container')).toBeHidden();
    await expect(sheets.first()).toBeVisible();
    await page.emulateMedia({ media: 'screen' });
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await expect(page.locator('#rd-print-root')).toHaveCount(0);

    // the .drawio file: draw.io's page attributes, the root-cell setup, the title block, the page links
    const xml = await withTab<string>(page, 'return tab.document.getProjectXml();');
    expect(xml.match(/<diagram /g)).toHaveLength(2);
    expect(xml).toMatch(/<mxGraphModel [^>]*page="1"[^>]*pageScale="1" pageWidth="1654" pageHeight="1169"/);
    expect(xml).toContain('rdSheetTitle="Plan schematyczny — głowica A"');
    expect(xml).toMatch(/<diagram [^>]*rdTitleBlock="/);
    expect(xml).toMatch(/link="data:page\/id,[^"]+"/);
    expect(errors).toEqual([]);
  });
});
