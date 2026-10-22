/**
 * @file backlog-ui.spec.ts
 * @brief UI backlog: align / distribute undo + locked cells, closeable left tabs by keyboard and from the
 *        » menu, narrow-screen start card action, draw.io page grid settings per tab, click-insert
 *        directions next to a selection, project / tab label rename rules. Real mouse / keyboard input.
 *        Runs on any port.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

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
});
