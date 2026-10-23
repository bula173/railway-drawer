/**
 * @file backlog-ui.spec.ts
 * @brief UI backlog: align / distribute undo + locked cells, closeable left tabs by keyboard and from the
 *        » menu, narrow-screen start card action, draw.io page grid settings per tab, click-insert
 *        directions next to a selection, project / tab label rename rules. Real mouse / keyboard input.
 *        Runs on any port.
 */
import { test, expect } from '@playwright/test';
import type { Download, Page } from '@playwright/test';
import { clickMenuItem } from './menu-helpers';

const PALETTE = '#drawio-palette-container';

async function inGraph<T>(page: Page, body: string, arg?: unknown): Promise<T> {
  return page.evaluate(async ({ body, arg }) => {
    const registry = await import('/src/services/service-registry.ts' as string);
    const tab = registry.ServiceRegistry.getTabManager().getActiveTab();
    return new Function('graph', 'tab', 'arg', body)(tab.graph, tab, arg);
  }, { body, arg }) as Promise<T>;
}

async function fresh(page: Page, viewport?: { width: number; height: number }): Promise<void> {
  if (viewport) await page.setViewportSize(viewport);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1, { timeout: 60_000 });
}

async function downloadText(download: Download): Promise<string> {
  const chunks = await (await download.createReadStream()).toArray();
  return Buffer.concat(chunks).toString('utf8');
}

/** Inserts rectangles (one model update, then a cleared history) and returns their ids. */
function addRects(page: Page, rects: Array<[number, number, number, number]>): Promise<string[]> {
  return inGraph<string[]>(page, `
    const ids = [];
    graph.batchUpdate(() => {
      for (const [x, y, w, h] of arg) ids.push(graph.insertVertex({ parent: graph.getDefaultParent(), value: '', position: [x, y], size: [w, h] }).id);
    });
    tab.graphCommandService?.clearHistory?.();
    return ids;`, rects);
}

/** Screen point of a cell's centre (scrolls it into view first). */
async function cellCenter(page: Page, id: string): Promise<{ x: number; y: number }> {
  return inGraph(page, `
    const cell = graph.getDataModel().getCell(arg);
    graph.scrollCellToVisible(cell);
    const s = graph.view.getState(cell);
    const r = graph.container.getBoundingClientRect();
    return { x: r.left + s.getCenterX() - graph.container.scrollLeft, y: r.top + s.getCenterY() - graph.container.scrollTop };`, id);
}

const geo = (page: Page, id: string): Promise<{ x: number; y: number; width: number; height: number }> =>
  inGraph(page, 'const g = graph.getDataModel().getCell(arg).geometry; return { x: g.x, y: g.y, width: g.width, height: g.height };', id);

test.describe('UI backlog', () => {
  test('align / distribute: one undo step each, locked cells stay', async ({ page }) => {
    await fresh(page);
    const [a, b, c, locked] = await addRects(page, [[100, 100, 60, 40], [260, 180, 80, 40], [180, 300, 40, 40], [40, 400, 40, 40]]);
    await inGraph(page, `
      const cell = graph.getDataModel().getCell(arg);
      graph.getDataModel().setStyle(cell, 'locked=1;');`, locked);
    // Shift+drag on the background = rubber band around all four
    const pa = await cellCenter(page, a);
    await page.keyboard.down('Shift');
    await page.mouse.move(pa.x - 110, pa.y - 60);
    await page.mouse.down();
    await page.mouse.move(pa.x + 150, pa.y + 200, { steps: 6 });
    await page.mouse.move(pa.x + 290, pa.y + 360, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await expect.poll(() => inGraph<number>(page, 'return graph.getSelectionCount();')).toBe(4);

    await page.locator('#btn-align').click();
    await page.locator('#btn-align-left').click();
    await expect.poll(async () => [(await geo(page, a)).x, (await geo(page, b)).x, (await geo(page, c)).x]).toEqual([100, 100, 100]);
    expect((await geo(page, locked)).x).toBe(40);

    await page.locator('#btn-align').click();
    await page.locator('#btn-distribute-v').click();
    await expect.poll(async () => [(await geo(page, a)).y, (await geo(page, b)).y, (await geo(page, c)).y]).toEqual([100, 200, 300]);
    expect((await geo(page, locked)).y).toBe(400);

    // one Ctrl+Z per command
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => (await geo(page, b)).y).toBe(180);
    expect((await geo(page, b)).x).toBe(100);
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => [(await geo(page, a)).x, (await geo(page, b)).x, (await geo(page, c)).x]).toEqual([100, 260, 180]);
    await page.keyboard.press('ControlOrMeta+y');
    await expect.poll(async () => (await geo(page, b)).x).toBe(100);
  });
  test('left tabs: close buttons are real buttons (Tab + Enter), Delete on the tab, Close in the » menu', async ({ page }) => {
    await fresh(page);
    await page.evaluate(() => localStorage.setItem('rd.sidePanels', JSON.stringify({ left: { width: 520 } })));
    await page.reload();
    await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1, { timeout: 60_000 });
    // valid HTML: no button inside a button anywhere in the tab strip
    expect(await page.locator('.left-panel-tabbar button button').count()).toBe(0);

    const plantuml = page.locator('.left-panel-tab-btn[data-tab="plantuml"]');
    const label = plantuml.locator('.left-panel-tab-label');
    const close = plantuml.getByRole('button', { name: 'Close PlantUML tab' });
    await expect(close).toBeVisible();
    // keyboard: the tab, Tab -> its close button, Enter closes
    await label.focus();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(plantuml).toBeHidden();
    await expect(page.locator('.left-panel-tab-btn[data-tab="shapes"] .left-panel-tab-label')).toBeFocused();

    // Delete on the focused tab closes it and keeps the selected shape
    await clickMenuItem(page, 'extras', 'plantumlEditor');
    await expect(plantuml).toBeVisible();
    const [rect] = await addRects(page, [[100, 100, 80, 40]]);
    await inGraph(page, 'graph.setSelectionCell(graph.getDataModel().getCell(arg));', rect);
    await label.focus();
    await page.keyboard.press('Delete');
    await expect(plantuml).toBeHidden();
    expect(await inGraph<boolean>(page, 'return !!graph.getDataModel().getCell(arg);', rect)).toBe(true);

    // narrow left panel: PlantUML in the » menu has a "Close PlantUML" item (keyboard)
    await page.evaluate(() => localStorage.setItem('rd.sidePanels', JSON.stringify({ left: { width: 180 } })));
    await page.reload();
    await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1, { timeout: 60_000 });
    await clickMenuItem(page, 'extras', 'plantumlEditor');
    await page.locator('.left-panel-tab-btn[data-tab="shapes"] .left-panel-tab-label').click();
    await expect(plantuml).toBeHidden();
    const more = page.locator('.left-panel-tab-more');
    await more.focus();
    await page.keyboard.press('ArrowDown');
    const closeItem = page.locator('.left-panel-overflow-close[data-tab="plantuml"]');
    await expect(closeItem).toHaveText('Close PlantUML');
    for (let i = 0; i < 12 && !(await closeItem.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('ArrowDown');
    await expect(closeItem).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.left-panel-overflow-menu')).toBeHidden();
    // the remaining tabs fit the compact strip (inactive tabs as icons): no » left, PlantUML in no menu
    await expect(more).toBeHidden();
    await expect(page.locator('.left-panel-overflow-item[data-tab="plantuml"]:visible')).toHaveCount(0);
  });

  test('narrow screen: start card "Insert ERTMS symbols" opens the left panel for the session', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('rd.startCard.force', '1'));
    await fresh(page, { width: 390, height: 844 });
    await page.evaluate(() => localStorage.setItem('rd.startCard.force', '1'));
    await page.reload();
    await expect(page.locator('body')).toHaveClass(/rd-narrow/);
    const left = page.locator('#leftpanel-container');
    await expect(left).toBeHidden();
    const stored = await page.evaluate(() => localStorage.getItem('rd.sidePanels'));
    await page.locator('.rd-start-card [data-start-action="ertms"]').click();
    await expect(left).toBeVisible();
    await expect(left).toHaveClass(/rd-panel-open-narrow/);
    await expect(page.locator('#btn-toggle-left-panel')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(`${PALETTE} section[data-palette-id="ertms"] .rd-dp-item`).first()).toBeVisible();
    await expect(page.locator(`${PALETTE} section[data-palette-id="ertms"] .rd-dp-item`).first()).toBeFocused();
    // session only: the stored panel state is unchanged, a reload hides it again
    expect(await page.evaluate(() => localStorage.getItem('rd.sidePanels'))).toBe(stored);
    await page.reload();
    await expect(page.locator('body')).toHaveClass(/rd-narrow/);
    await expect(left).toBeHidden();
  });
  test('draw.io page grid (grid="0", gridSize) applies per tab, View > Grid / toolbar follow, saved back', async ({ page }) => {
    await fresh(page);
    const file = '<mxfile host="app.diagrams.net"><diagram id="g1" name="Grid off"><mxGraphModel dx="800" dy="600" grid="0" gridSize="20" guides="1" page="0">' +
      '<root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="v" value="A" style="rounded=0;" vertex="1" parent="1"><mxGeometry x="40" y="40" width="80" height="40" as="geometry"/></mxCell></root>' +
      '</mxGraphModel></diagram></mxfile>';
    const chooser = page.waitForEvent('filechooser');
    await clickMenuItem(page, 'file', 'open');
    await (await chooser).setFiles({ name: 'grid-off.drawio', mimeType: 'application/xml', buffer: Buffer.from(file) });
    const gridState = (): Promise<{ on: boolean; size: number; bg: boolean }> =>
      inGraph(page, "return { on: graph.gridEnabled, size: graph.gridSize, bg: graph.container.classList.contains('rd-grid-on') };");
    await expect.poll(gridState).toEqual({ on: false, size: 20, bg: false });
    const viewGrid = page.locator('.menu-dropdown [data-action="showGrid"]');
    const button = page.locator('#btn-grid');
    await expect(viewGrid).toHaveAttribute('aria-checked', 'false');
    await expect(button).toHaveAttribute('aria-pressed', 'false');

    // another tab keeps its own grid (on), switching back shows this tab's again
    await clickMenuItem(page, 'file', 'new');
    await expect(page.locator('#tabs-container .tab-button')).toHaveCount(2);
    await expect.poll(gridState).toEqual({ on: true, size: 10, bg: true });
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#tabs-container .tab-button').first().click();
    await expect.poll(gridState).toEqual({ on: false, size: 20, bg: false });
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(viewGrid).toHaveAttribute('aria-checked', 'false');

    const exported = async (): Promise<{ grid: string | null; gridSize: string | null }> => {
      const [download] = await Promise.all([page.waitForEvent('download'), clickMenuItem(page, 'file', 'export')]);
      const text = await downloadText(download);
      return page.evaluate((xml) => {
        const model = new DOMParser().parseFromString(xml, 'text/xml').querySelector('mxGraphModel')!;
        return { grid: model.getAttribute('grid'), gridSize: model.getAttribute('gridSize') };
      }, text);
    };
    expect(await exported()).toEqual({ grid: '0', gridSize: '20' });
    // the toolbar toggle turns it on for this tab and the file says so
    await button.click();
    await expect.poll(gridState).toEqual({ on: true, size: 20, bg: true });
    await expect(viewGrid).toHaveAttribute('aria-checked', 'true');
    expect(await exported()).toEqual({ grid: '1', gridSize: '20' });
    // off again, kept over a reload (cache) for this tab only
    await button.click();
    await expect.poll(gridState).toEqual({ on: false, size: 20, bg: false });
    await page.evaluate(async () => {
      const registry = await import('/src/services/service-registry.ts' as string);
      registry.ServiceRegistry.getTabManager().flushCache();
    });
    await page.reload();
    await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1, { timeout: 60_000 });
    await expect.poll(gridState).toEqual({ on: false, size: 20, bg: false });
    await expect(button).toHaveAttribute('aria-pressed', 'false');
  });
  test('palette click next to a selection: below when east is taken, Shift east, Ctrl/Cmd north, Ctrl/Cmd+Shift west', async ({ page }) => {
    await fresh(page);
    const general = page.locator(`${PALETTE} section[data-palette-id="general"]`);
    await general.locator('.rd-dp-item[title="Ellipse"]').waitFor();
    const [src, east] = await addRects(page, [[200, 200, 80, 40], [360, 200, 80, 40]]);
    const src0 = await geo(page, src);
    const centreOf = (g: { x: number; y: number; width: number; height: number }) => ({ x: g.x + g.width / 2, y: g.y + g.height / 2 });
    const selectSource = async (): Promise<void> => {
      const p = await cellCenter(page, src);
      await page.mouse.click(p.x, p.y);
      await expect.poll(() => inGraph<string>(page, 'return graph.getSelectionCell()?.id;')).toBe(src);
    };
    const count = (): Promise<number> => inGraph<number>(page, 'return graph.getDefaultParent().children.length;');
    const insert = async (modifiers: Array<'Shift' | 'ControlOrMeta'>): Promise<{ x: number; y: number }> => {
      await selectSource();
      const before = await count();
      await general.locator('.rd-dp-item[title="Ellipse"]').click({ modifiers });
      await expect.poll(count).toBe(before + 2);
      const id = await inGraph<string>(page, 'return graph.getSelectionCell().id;');
      expect(await inGraph<number>(page, 'return graph.getDefaultParent().children.filter((c) => c.isEdge() && c.source?.id === arg[0] && c.target?.id === arg[1]).length;', [src, id])).toBe(1);
      const c = centreOf(await geo(page, id));
      // one undo step removes the shape and its edge
      await page.locator('#graph-container').click({ position: { x: 5, y: 5 } });
      await page.keyboard.press('ControlOrMeta+z');
      await expect.poll(count).toBe(before);
      return c;
    };
    const s = centreOf(src0);
    // plain click: the east side has a neighbour -> below
    const below = await insert([]);
    expect(Math.abs(below.x - s.x)).toBeLessThan(1);
    expect(below.y).toBeGreaterThan(src0.y + src0.height);
    // Shift: east anyway (past the neighbour)
    const right = await insert(['Shift']);
    expect(right.x).toBeGreaterThan(src0.x + src0.width);
    // Ctrl/Cmd: north, Ctrl/Cmd+Shift: west
    const above = await insert(['ControlOrMeta']);
    expect(Math.abs(above.x - s.x)).toBeLessThan(1);
    expect(above.y).toBeLessThan(src0.y);
    const left = await insert(['ControlOrMeta', 'Shift']);
    expect(left.x).toBeLessThan(src0.x);
    expect(Math.abs(left.y - s.y)).toBeLessThan(1);
    // without the east neighbour a plain click goes east again
    await inGraph(page, 'graph.getDataModel().remove(graph.getDataModel().getCell(arg));', east);
    const plain = await insert([]);
    expect(plain.x).toBeGreaterThan(src0.x + src0.width);
    expect(Math.abs(plain.y - s.y)).toBeLessThan(1);
  });
  test('tab label rename renames the project when they match; Save As relabels such a tab', async ({ page }) => {
    await fresh(page);
    const title = page.locator('.document-title');
    const label = page.locator('#tabs-container .tab-button.active .tab-label');
    await expect(label).toHaveText('Diagram 1');
    await expect(title).toHaveText('Diagram 1');
    const renameLabel = async (from: string, to: string): Promise<void> => {
      await page.locator('#tabs-container .tab-label', { hasText: from }).dblclick();
      const input = page.locator('#tabs-container input');
      await input.fill(to);
      await input.press('Enter');
      await expect(label).toHaveText(to);
    };
    const exportName = async (): Promise<string> => {
      const [file] = await Promise.all([page.waitForEvent('download'), clickMenuItem(page, 'file', 'export')]);
      return file.suggestedFilename();
    };
    const saveAs = async (name: string): Promise<string> => {
      await clickMenuItem(page, 'file', 'saveAs');
      const dialog = page.getByTestId('save-as-dialog');
      await dialog.locator('input').fill(name);
      const [file] = await Promise.all([page.waitForEvent('download'), dialog.locator('input').press('Enter')]);
      return file.suggestedFilename();
    };
    // label = project name: renaming the label renames the project (title, export name)
    await renameLabel('Diagram 1', 'Station North');
    await expect(title).toHaveText('Station North');
    expect(await exportName()).toBe('Station North.drawio');
    // Save As: the label equal to the old project name follows
    expect(await saveAs('Station South')).toBe('Station South.drawio');
    await expect(title).toHaveText('Station South');
    await expect(label).toHaveText('Station South');
    // a label of its own: neither rule touches the other name
    await page.evaluate(async () => {
      const registry = await import('/src/services/service-registry.ts' as string);
      registry.ServiceRegistry.getTabManager().getActiveTab().document.setProjectName('Interlocking');
    });
    await renameLabel('Station South', 'My view');
    expect(await exportName()).toBe('Interlocking.drawio');
    expect(await saveAs('Interlocking 2')).toBe('Interlocking 2.drawio');
    await expect(title).toHaveText('Interlocking 2');
    await expect(label).toHaveText('My view');
    // kept over a reload
    await page.evaluate(async () => {
      const registry = await import('/src/services/service-registry.ts' as string);
      registry.ServiceRegistry.getTabManager().flushCache();
    });
    await page.reload();
    await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1, { timeout: 60_000 });
    await expect(label).toHaveText('My view');
    await expect(title).toHaveText('Interlocking 2');
  });
});
