/**
 * @file ertms-routes.spec.ts
 * @brief Railway engineering tools end to end: a small layout (2 tracks, points W1, 3 signals) is
 *        loaded into the active tab; the Route tool (toolbar button, clicks on the signals) creates
 *        a diverging route over W1 reverse and a straight one over W1 normal; Extras > Route Table…
 *        lists them with points positions, the interlocking tab lists the conflict, CSV export;
 *        the route is edited in the Data panel; View > Show Routes hides the Routes layer;
 *        a signal from the ERTMS palette dragged near a track snaps onto it with track and km;
 *        Extras > Recalculate km fixes a balise's km.
 *
 * Reads the graph through the dev server's module graph (like ertms-data.spec.ts). Any port.
 */
import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function inGraph<T>(page: Page, body: string, arg?: unknown): Promise<T> {
  return page.evaluate(async ({ body, arg }) => {
    const registry = await import('/src/services/service-registry.ts' as string);
    const tab = registry.ServiceRegistry.getTabManager().getActiveTab();
    return new Function('graph', 'tab', 'arg', body)(tab.graph, tab, arg);
  }, { body, arg }) as Promise<T>;
}

/** Railway data attributes of the object with this rdId (any layer). */
async function attrsOf(page: Page, rdId: string): Promise<Record<string, string> | null> {
  return inGraph(page, `
    const all = Object.values(graph.getDataModel().cells);
    const cell = all.find((c) => c.value && c.value.nodeType === 1 && c.value.getAttribute('rdId') === arg);
    if (!cell) return null;
    const out = { cellId: cell.id, parent: cell.parent ? cell.parent.id : '' };
    for (const a of Array.from(cell.value.attributes)) if (a.name.startsWith('rd')) out[a.name] = a.value;
    return out;`, rdId);
}

/** Client coordinates of a graph point (scrolled into view first). */
async function clientPoint(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  return inGraph(page, `
    const s = graph.view.scale, t = graph.view.translate, c = graph.container;
    const r = c.getBoundingClientRect();
    return { x: r.left + (arg.x + t.x) * s - c.scrollLeft, y: r.top + (arg.y + t.y) * s - c.scrollTop };`, { x, y });
}

async function cellCenter(page: Page, rdId: string): Promise<{ x: number; y: number }> {
  return inGraph(page, `
    const cell = graph.getDefaultParent().children.find((c) => c.value && c.value.nodeType === 1 && c.value.getAttribute('rdId') === arg);
    const g = cell.geometry;
    return { x: g.x + g.width / 2, y: g.y + g.height / 2 };`, rdId);
}

const obj = (id: string, attrs: string, style: string, geo: string, edge = false): string =>
  `<object label="" id="${id}" ${attrs}><mxCell style="${style}" ${edge ? 'edge="1"' : 'vertex="1"'} parent="1">${geo}</mxCell></object>`;
const line = (x1: number, y1: number, x2: number, y2: number): string =>
  `<mxGeometry relative="1" as="geometry"><mxPoint x="${x1}" y="${y1}" as="sourcePoint"/><mxPoint x="${x2}" y="${y2}" as="targetPoint"/></mxGeometry>`;
const box = (cx: number, cy: number): string => `<mxGeometry x="${cx - 10}" y="${cy - 10}" width="20" height="20" as="geometry"/>`;
const TRACK = 'endArrow=none;html=1;strokeWidth=4;';
const SIGNAL = 'triangle;whiteSpace=wrap;html=1;fillColor=#000000;';

/**
 *   S1>      W1                 S2>      T1 y=100, x 0..500, km 10.0-10.5
 *   ==========*======================
 *              \
 *               *================== S3>  T2 y=180, x 150..500, km 20.0-20.35
 */
const LAYOUT = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
${obj('t1', 'rdKind="track" rdId="T1" rdKmStart="10" rdKmEnd="10.5"', TRACK, line(0, 100, 500, 100), true)}
${obj('t2', 'rdKind="track" rdId="T2" rdKmStart="20" rdKmEnd="20.35"', TRACK, line(150, 180, 500, 180), true)}
${obj('w1', 'rdKind="points" rdId="W1" rdPosition="normal" rdTrackId="T1"', TRACK, line(150, 100, 230, 180), true)}
${obj('s1', 'rdKind="signal" rdId="S1" rdDirection="nominal" rdTrackId="T1"', SIGNAL, box(40, 114))}
${obj('s2', 'rdKind="signal" rdId="S2" rdDirection="nominal" rdTrackId="T1"', SIGNAL, box(450, 114))}
${obj('s3', 'rdKind="signal" rdId="S3" rdDirection="nominal" rdTrackId="T2"', SIGNAL, box(440, 194))}
${obj('b1', 'rdKind="balise" rdId="B1" rdTrackId="T1" rdKm="1"', 'rhombus;html=1;', '<mxGeometry x="294" y="94" width="12" height="12" as="geometry"/>')}
</root></mxGraphModel>`;

async function clickSignal(page: Page, rdId: string): Promise<void> {
  const c = await cellCenter(page, rdId);
  const p = await clientPoint(page, c.x, c.y);
  await page.mouse.click(p.x, p.y);
}

/** A real mouse drag of the object by its middle, by (dx, dy) graph units. */
async function dragObject(page: Page, rdId: string, dx: number, dy: number): Promise<void> {
  const c = await cellCenter(page, rdId);
  const from = await clientPoint(page, c.x, c.y);
  const to = await clientPoint(page, c.x + dx, c.y + dy);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 5 });
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
}

async function menu(page: Page, name: string, action: string): Promise<void> {
  await page.locator(`.menu-item[data-menu="${name}"]`).click();
  await page.locator(`.menu-dropdown[data-menu="${name}"] [data-action="${action}"]`).click();
}

test('ERTMS routes: route tool, route/interlocking tables, snap to track, km', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);

  // The layout, loaded like a file (no snapping on load)
  await inGraph(page, 'tab.saveLoadController.load(arg); graph.view.setTranslate(20, 20); graph.container.scrollLeft = 0; graph.container.scrollTop = 0;', LAYOUT);
  expect((await attrsOf(page, 'S1'))?.rdKind).toBe('signal');
  await expect(page.locator('.menu-dropdown [data-action="railwayRoute:toggleSnap"]')).toHaveAttribute('aria-checked', 'true');

  // Route tool: S1 -> S3 over W1 reverse
  await page.locator('#btn-route-tool').click();
  await expect(page.locator('#btn-route-tool')).toHaveAttribute('aria-pressed', 'true');
  const tool = page.locator('.rd-route-tool');
  await expect(tool.locator('.rd-route-status')).toHaveText('Click the start (entry) signal.');
  await clickSignal(page, 'S1');
  await expect(tool.locator('.rd-route-status')).toContainText('Start: S1');
  await clickSignal(page, 'S3');
  await expect(tool.locator('.rd-route-status')).toHaveText('S1 → S3: 1 path');
  await expect(tool.locator('.rd-route-path')).toContainText('W1 reverse');
  await expect(page.locator('.rd-route-overlay .rd-route-hl')).toHaveCount(1);
  // the clicks did not select or move anything
  expect(await inGraph<number>(page, 'return graph.getSelectionCount();')).toBe(0);
  await expect(tool.locator('.rd-route-id-input')).toHaveValue('R1');
  await tool.locator('.rd-route-create').click();
  await expect.poll(() => attrsOf(page, 'R1')).toMatchObject({
    rdKind: 'route',
    rdEntrySignal: 'S1',
    rdExitSignal: 'S3',
    rdPoints: 'W1:reverse',
    rdSections: 'T1, T2',
    rdOverlap: 'T2',
    parent: 'rd-routes',
  });
  expect((await attrsOf(page, 'S1'))?.rdRoutes).toBe('R1');

  // Second route S1 -> S2 over W1 normal, then leave the tool with Esc
  await expect(tool.locator('.rd-route-status')).toHaveText('Click the start (entry) signal.');
  await clickSignal(page, 'S1');
  await clickSignal(page, 'S2');
  await expect(tool.locator('.rd-route-path')).toContainText('W1 normal');
  await tool.locator('.rd-route-create').click();
  await expect.poll(async () => (await attrsOf(page, 'R2'))?.rdPoints).toBe('W1:normal');
  await page.keyboard.press('Escape');
  await expect(tool).toHaveCount(0);
  await expect(page.locator('#btn-route-tool')).toHaveAttribute('aria-pressed', 'false');

  // Route table and interlocking table
  await menu(page, 'extras', 'railwayRoute:routeTable');
  const dialog = page.locator('.rd-route-dialog');
  await expect(dialog).toBeVisible();
  const rows = dialog.locator('.rd-route-table tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('R1');
  await expect(rows.nth(0).locator('td').nth(3)).toHaveText('W1 reverse');
  await expect(rows.nth(0).locator('td').nth(4)).toHaveText('T1, T2');
  await expect(rows.nth(0).locator('td').nth(7)).toHaveText('R2');
  await expect(rows.nth(1).locator('td').nth(3)).toHaveText('W1 normal');
  const [csv] = await Promise.all([page.waitForEvent('download'), dialog.locator('.rd-route-export-csv').click()]);
  expect(csv.suggestedFilename()).toMatch(/-routes\.csv$/);
  const csvText = await readFile((await csv.path())!, 'utf8');
  expect(csvText).toContain('R1,S1,S3,W1 reverse,"T1, T2",T2');
  await dialog.locator('.rd-route-tab[data-tab="conflicts"]').click();
  await expect(dialog.locator('.rd-route-table tbody tr')).toHaveCount(1);
  await expect(dialog.locator('.rd-route-table tbody tr td')).toHaveText(['R1', 'R2', 'T1', 'W1 (reverse/normal)', 'shared section + opposite points positions']);
  const [xlsx] = await Promise.all([page.waitForEvent('download'), dialog.locator('.rd-route-export-xlsx').click()]);
  expect(xlsx.suggestedFilename()).toMatch(/-routes\.xlsx$/);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await menu(page, 'extras', 'railwayRoute:conflictTable');
  await expect(page.locator('.rd-route-tab[data-tab="conflicts"]')).toHaveAttribute('aria-selected', 'true');
  await page.locator('.rd-route-dialog-close').click();

  // The route is a railway object: edit it in the Data panel; no route issues in Checks
  await inGraph(page, 'graph.setSelectionCell(graph.getDataModel().getCell(arg));', (await attrsOf(page, 'R1'))!.cellId);
  await page.locator('.right-panel-switch-btn[data-right-panel="data"]').click();
  await expect(page.locator('#railway-data-panel .rd-rw-title')).toHaveText('Route R1');
  await expect(page.locator('#railway-data-panel [data-field="points"]')).toHaveValue('W1:reverse');
  await page.locator('#railway-data-panel [data-field="notes"]').fill('Wjazd na tor 2');
  await page.locator('#railway-data-panel [data-field="notes"]').press('Enter');
  await expect.poll(async () => (await attrsOf(page, 'R1'))?.rdNotes).toBe('Wjazd na tor 2');
  await page.locator('.right-panel-switch-btn[data-right-panel="checks"]').click();
  await page.locator('#railway-checks-panel').getByRole('button', { name: /Run checks/i }).click();
  await expect(page.locator('#railway-checks-panel .rd-rw-issue[data-rule^="route-"]')).toHaveCount(0);
  // a wrong points position is reported
  await inGraph(page, `
    const cell = graph.getDataModel().getCell(arg);
    const v = cell.value.cloneNode(true); v.setAttribute('rdPoints', 'W1:normal');
    graph.getDataModel().setValue(cell, v);`, (await attrsOf(page, 'R1'))!.cellId);
  await page.locator('#railway-checks-panel').getByRole('button', { name: /Run checks/i }).click();
  await expect(page.locator('#railway-checks-panel .rd-rw-issue[data-rule="route-points"]')).toContainText('requires points W1 normal, but its path needs reverse');
  await inGraph(page, 'graph.clearSelection();');

  // View > Show Routes hides the Routes layer
  await menu(page, 'view', 'railwayRoute:toggleRoutes');
  expect(await inGraph<boolean>(page, "return graph.getDataModel().getCell('rd-routes').isVisible();")).toBe(false);
  await expect(page.locator('.menu-dropdown [data-action="railwayRoute:toggleRoutes"]')).toHaveAttribute('aria-checked', 'false');
  await menu(page, 'view', 'railwayRoute:toggleRoutes');
  expect(await inGraph<boolean>(page, "return graph.getDataModel().getCell('rd-routes').isVisible();")).toBe(true);

  // Snap to track: an ERTMS signal dropped next to T1 sits beside it, with track and km
  const section = page.locator('#drawio-palette-container section[data-palette-id="ertms"]');
  if ((await section.locator('.rd-dp-header').getAttribute('aria-expanded')) !== 'true') await section.locator('.rd-dp-header').click();
  const drop = await clientPoint(page, 300, 125);
  const box = (await page.locator('#graph-container').boundingBox())!;
  await section.locator('.rd-dp-item[title="Signal Right 3"]').first().dragTo(page.locator('#graph-container'), {
    targetPosition: { x: drop.x - box.x, y: drop.y - box.y },
  });
  await expect.poll(async () => (await attrsOf(page, 'S4'))?.rdTrackId).toBe('T1');
  const height = await inGraph<number>(page, "return graph.getDefaultParent().children.find((x) => x.value && x.value.nodeType === 1 && x.value.getAttribute('rdId') === 'S4').geometry.height;");
  const snapped = await cellCenter(page, 'S4');
  // nominal signal: below the track (right-hand side), gap 4
  expect(snapped.y).toBeCloseTo(100 + height / 2 + 4, 1);
  expect(Math.abs(snapped.x - 300)).toBeLessThan(15);
  expect(Number((await attrsOf(page, 'S4'))!.rdKm)).toBeCloseTo(10 + snapped.x / 1000, 3);

  // Dragging it by its middle (real mouse: the signal group moves, no connection starts) far
  // away: no snap; next to T2: snaps onto T2
  const cellsBefore = await inGraph<number>(page, 'return Object.keys(graph.getDataModel().cells).length;');
  await dragObject(page, 'S4', 0, 250);
  const away = await cellCenter(page, 'S4');
  // (a mouse move snaps the cell to the grid, gridSize 10)
  expect(Math.abs(away.y - (snapped.y + 250))).toBeLessThanOrEqual(5);
  expect((await attrsOf(page, 'S4'))?.rdTrackId).toBe('T1');
  await dragObject(page, 'S4', 50, -150);
  expect(await inGraph<number>(page, 'return Object.keys(graph.getDataModel().cells).length;')).toBe(cellsBefore);
  await expect.poll(async () => (await attrsOf(page, 'S4'))?.rdTrackId).toBe('T2');
  expect((await cellCenter(page, 'S4')).y).toBeCloseTo(180 + height / 2 + 4, 1);
  expect(Number((await attrsOf(page, 'S4'))!.rdKm)).toBeCloseTo(20 + ((await cellCenter(page, 'S4')).x - 150) / 1000, 3);
  // Ctrl+Z undoes the move and the snap in one step
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(async () => (await attrsOf(page, 'S4'))?.rdTrackId).toBe('T1');
  expect(await cellCenter(page, 'S4')).toEqual(away);
  await page.keyboard.press('ControlOrMeta+y');
  await expect.poll(async () => (await attrsOf(page, 'S4'))?.rdTrackId).toBe('T2');

  // Extras > Recalculate km: the balise at x=300 on T1 gets km 10.3
  expect((await attrsOf(page, 'B1'))?.rdKm).toBe('1');
  await menu(page, 'extras', 'railwayRoute:recalcKm');
  await expect.poll(async () => (await attrsOf(page, 'B1'))?.rdKm).toBe('10.3');

  // km ruler along the selected track
  await inGraph(page, "graph.setSelectionCell(graph.getDataModel().getCell('t1'));");
  await menu(page, 'view', 'railwayRoute:toggleKmRuler');
  await expect(page.locator('.rd-km-ruler-overlay .rd-km-ruler[data-track="T1"]')).toHaveCount(1);
  await expect(page.locator('.rd-km-ruler-overlay .rd-km-label').first()).toHaveText('10+000');
  await menu(page, 'view', 'railwayRoute:toggleKmRuler');
  await expect(page.locator('.rd-km-ruler-overlay')).toHaveCount(0);

  expect(pageErrors).toEqual([]);
});
