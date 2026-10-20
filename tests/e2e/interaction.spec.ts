/**
 * @file interaction.spec.ts
 * @brief Canvas interaction like draw.io, with real mouse input (page.mouse):
 *        press+drag in the middle of a vertex moves it (and the whole selection), connections
 *        start only from connection points, a click on a group's child selects the group first,
 *        edges move by their body and reconnect by their end handle; locked cells keep their
 *        geometry (Properties fields disabled, arrow keys); Lock keeps the selection; the project
 *        name follows the active tab (rename, switch, reload).
 *
 * Reads the graph through the dev server's module graph (like style-edit.spec.ts). Any port.
 */
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { clickMenuItem } from './menu-helpers';

const MODEL_XML = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
<mxCell id="A" value="Alpha" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="60" y="60" width="120" height="60" as="geometry"/></mxCell>
<mxCell id="B" value="Bravo" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="320" y="60" width="120" height="60" as="geometry"/></mxCell>
<mxCell id="C" value="Charlie" style="ellipse;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="60" y="220" width="80" height="80" as="geometry"/></mxCell>
<mxCell id="G" value="" style="group" vertex="1" connectable="0" parent="1"><mxGeometry x="320" y="220" width="160" height="80" as="geometry"/></mxCell>
<mxCell id="G1" value="Inner 1" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="G"><mxGeometry width="70" height="80" as="geometry"/></mxCell>
<mxCell id="G2" value="Inner 2" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="G"><mxGeometry x="90" width="70" height="80" as="geometry"/></mxCell>
<mxCell id="E" value="" style="endArrow=classic;html=1;" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="560" y="80" as="sourcePoint"/><mxPoint x="720" y="80" as="targetPoint"/></mxGeometry></mxCell>
</root></mxGraphModel>`;

async function freshApp(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
}

/** Runs `body` (function body text) with `tab` = the active tab, `graph` and `arg`. */
async function inTab<T>(page: Page, body: string, arg?: unknown): Promise<T> {
  return page.evaluate(async ({ body, arg }) => {
    const registry = await import('/src/services/service-registry.ts' as string);
    const tab = registry.ServiceRegistry.getTabManager().getActiveTab();
    return new Function('tab', 'graph', 'arg', body)(tab, tab.graph, arg);
  }, { body, arg }) as Promise<T>;
}

async function loadModel(page: Page, xml: string): Promise<void> {
  await inTab(page, 'tab.saveLoadController.load(arg); graph.clearSelection();', xml);
}

function selectedIds(page: Page): Promise<string[]> {
  return inTab<string[]>(page, 'return graph.getSelectionCells().map((c) => c.id).sort();');
}

async function select(page: Page, ids: string[]): Promise<void> {
  await inTab(page, 'const m = graph.getDataModel(); graph.setSelectionCells(arg.map((id) => m.getCell(id)));', ids);
}

interface Geo { x: number; y: number; width: number; height: number }

function geometry(page: Page, id: string): Promise<Geo> {
  return inTab<Geo>(page, 'const g = graph.getDataModel().getCell(arg).getGeometry(); return { x: g.x, y: g.y, width: g.width, height: g.height };', id);
}

function edgeCount(page: Page): Promise<number> {
  return inTab<number>(page, 'return Object.values(graph.getDataModel().cells).filter((c) => c.isEdge()).length;');
}

/** Page coordinates of a cell's centre (from its view state). */
function center(page: Page, id: string): Promise<{ x: number; y: number }> {
  return inTab(page, `
    const s = graph.view.getState(graph.getDataModel().getCell(arg));
    const r = graph.container.getBoundingClientRect();
    return { x: r.left + s.getCenterX() - graph.container.scrollLeft, y: r.top + s.getCenterY() - graph.container.scrollTop };
  `, id);
}

/** Page coordinates of a graph point. */
function pagePoint(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  return inTab(page, `
    const r = graph.container.getBoundingClientRect();
    const s = graph.view.scale, t = graph.view.translate;
    return { x: r.left + (arg.x + t.x) * s - graph.container.scrollLeft, y: r.top + (arg.y + t.y) * s - graph.container.scrollTop };
  `, { x, y });
}

/** A real press-move-release drag from `from` by (dx, dy) page pixels. */
async function drag(page: Page, from: { x: number; y: number }, dx: number, dy: number): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx / 3, from.y + dy / 3, { steps: 4 });
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 6 });
  await page.mouse.up();
}

async function emptyClick(page: Page): Promise<void> {
  const p = await pagePoint(page, 700, 500);
  await page.mouse.click(p.x, p.y);
}

test.describe('canvas interaction (real mouse)', () => {
  test('dragging a vertex from its middle moves it; the whole selection moves; no edge is created', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await freshApp(page);
    await loadModel(page, MODEL_XML);
    const edges = await edgeCount(page);

    // unselected rectangle: press in the exact middle and drag
    await drag(page, await center(page, 'A'), 100, 40);
    expect(await geometry(page, 'A')).toMatchObject({ x: 160, y: 100 });
    expect(await edgeCount(page)).toBe(edges);
    expect(await selectedIds(page)).toEqual(['A']);
    // one undo step
    await page.keyboard.press('Control+z');
    expect(await geometry(page, 'A')).toMatchObject({ x: 60, y: 60 });

    // ellipse middle
    await drag(page, await center(page, 'C'), 60, 0);
    expect((await geometry(page, 'C')).x).toBe(120);
    expect(await edgeCount(page)).toBe(edges);

    // a multi-selection moves together when one of its cells is dragged by the middle
    await select(page, ['A', 'B']);
    await drag(page, await center(page, 'B'), 0, 80);
    expect((await geometry(page, 'A')).y).toBe(140);
    expect((await geometry(page, 'B')).y).toBe(140);
    expect(await edgeCount(page)).toBe(edges);
    expect(await selectedIds(page)).toEqual(['A', 'B']);
    expect(errors).toEqual([]);
  });

  test('a connection starts from a connection point and ends on another shape', async ({ page }) => {
    await freshApp(page);
    await loadModel(page, MODEL_XML);
    const edges = await edgeCount(page);
    // right-middle connection point of A (x=180, y=90) to the middle of B
    const start = await pagePoint(page, 180, 90);
    const target = await center(page, 'B');
    await page.mouse.move(start.x - 20, start.y);
    await page.mouse.move(start.x, start.y, { steps: 3 });
    await page.mouse.down();
    await page.mouse.move((start.x + target.x) / 2, target.y, { steps: 5 });
    await page.mouse.move(target.x, target.y, { steps: 5 });
    await page.mouse.up();
    expect(await edgeCount(page)).toBe(edges + 1);
    const ends = await inTab<{ source: string | null; target: string | null }>(page, `
      const e = Object.values(graph.getDataModel().cells).find((c) => c.isEdge() && c.id !== 'E');
      return { source: e.source && e.source.id, target: e.target && e.target.id };
    `);
    expect(ends).toEqual({ source: 'A', target: 'B' });
    // A did not move
    expect(await geometry(page, 'A')).toMatchObject({ x: 60, y: 60 });
  });

  test('a group: first click selects the group, second the child; dragging a child moves the group', async ({ page }) => {
    await freshApp(page);
    await loadModel(page, MODEL_XML);
    const edges = await edgeCount(page);
    const inner = await center(page, 'G1');
    await page.mouse.click(inner.x, inner.y);
    expect(await selectedIds(page)).toEqual(['G']);
    await page.waitForTimeout(400);
    await page.mouse.click(inner.x, inner.y);
    expect(await selectedIds(page)).toEqual(['G1']);

    // unselected group, drag from the middle of a child: the group moves, the child stays in it
    await emptyClick(page);
    await drag(page, await center(page, 'G2'), 0, 100);
    expect(await geometry(page, 'G')).toMatchObject({ x: 320, y: 320 });
    expect(await geometry(page, 'G2')).toMatchObject({ x: 90, y: 0 });
    expect(await edgeCount(page)).toBe(edges);
    expect(await selectedIds(page)).toEqual(['G']);
  });

  test('an edge moves when dragged by its body and reconnects by its end handle', async ({ page }) => {
    await freshApp(page);
    await loadModel(page, MODEL_XML);
    const edges = await edgeCount(page);
    const mid = await pagePoint(page, 640, 80);
    await drag(page, mid, 0, 60);
    const pts = await inTab<number[]>(page, `
      const g = graph.getDataModel().getCell('E').getGeometry();
      return [g.sourcePoint.x, g.sourcePoint.y, g.targetPoint.x, g.targetPoint.y];
    `);
    expect(pts).toEqual([560, 140, 720, 140]);
    expect(await edgeCount(page)).toBe(edges);
    expect(await selectedIds(page)).toEqual(['E']);

    // the selected edge's end handle onto B connects it
    const end = await pagePoint(page, 720, 140);
    await drag(page, end, ...(await (async () => {
      const b = await center(page, 'B');
      return [b.x - end.x, b.y - end.y] as [number, number];
    })()));
    expect(await inTab(page, "const e = graph.getDataModel().getCell('E'); return e.target && e.target.id;")).toBe('B');
    expect(await edgeCount(page)).toBe(edges);
  });

  test('ERTMS library shapes and draw.io palette shapes move when dragged by the middle', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await freshApp(page);
    const palette = page.locator('#drawio-palette-container');
    const ertms = palette.locator('section[data-palette-id="ertms"]');
    if ((await ertms.locator('.rd-dp-header').getAttribute('aria-expanded')) !== 'true') await ertms.locator('.rd-dp-header').click();
    const general = palette.locator('section[data-palette-id="general"]');
    const items: Array<{ section: typeof ertms; title: string }> = [
      { section: ertms, title: 'Signal Right 3' },
      { section: ertms, title: 'Single Balise Right' },
      { section: ertms, title: 'Signal Left 3' },
      { section: ertms, title: 'Train' },
      { section: general, title: 'Hexagon' },
      { section: general, title: 'Cylinder' },
    ];
    for (const { section, title } of items) {
      await inTab(page, 'graph.clearSelection();');
      const item = section.locator(`.rd-dp-item[title="${title}"]`).first();
      if ((await item.count()) === 0) continue;
      await item.click();
      await expect.poll(async () => (await selectedIds(page)).length).toBe(1);
      const [id] = await selectedIds(page);
      await emptyClick(page);
      const before = await geometry(page, id);
      const edges = await edgeCount(page);
      await drag(page, await center(page, id), 80, 50);
      const after = await geometry(page, id);
      expect(after.x - before.x, title).toBeCloseTo(80, 0);
      expect(after.y - before.y, title).toBeCloseTo(50, 0);
      expect(await edgeCount(page), title).toBe(edges);
      expect(await selectedIds(page), title).toEqual([id]);
      await page.keyboard.press('Delete');
    }
    expect(errors).toEqual([]);
  });
});

async function menu(page: Page, menuName: string, action: string): Promise<void> {
  await clickMenuItem(page, menuName, action);
}

function isLocked(page: Page, id: string): Promise<boolean> {
  return inTab<boolean>(page, 'return graph.isCellLocked(graph.getDataModel().getCell(arg));', id);
}

const GEOMETRY_FIELDS = ['#prop-x', '#prop-y', '#prop-w', '#prop-h', '#prop-rotation', '#btn-rotate90', '#btn-flipHorizontal', '#btn-flipVertical'];

/** Two layers: L2 (upper) holds U. */
const LAYERS_XML = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
<mxCell id="A" value="Alpha" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="60" y="60" width="120" height="60" as="geometry"/></mxCell>
<mxCell id="L2" value="Upper" parent="0"/>
<mxCell id="U" value="Ulysses" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="L2"><mxGeometry x="320" y="60" width="120" height="60" as="geometry"/></mxCell>
</root></mxGraphModel>`;

test.describe('locked cells keep their geometry', () => {
  test('Properties geometry fields are disabled for a locked cell and a cell on a locked layer', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await freshApp(page);
    await loadModel(page, LAYERS_XML);
    const a = await center(page, 'A');
    await page.mouse.click(a.x, a.y);
    await page.locator('.prop-tab[data-tab="arrange"]').click();
    for (const sel of GEOMETRY_FIELDS) await expect(page.locator(sel), sel).toBeEnabled();
    // an unlocked cell: X changes it (one undo step)
    await page.locator('#prop-x').fill('100');
    await page.locator('#prop-x').dispatchEvent('change');
    expect((await geometry(page, 'A')).x).toBe(100);

    await page.locator('#btn-lock').click();
    expect(await isLocked(page, 'A')).toBe(true);
    for (const sel of GEOMETRY_FIELDS) await expect(page.locator(sel), sel).toBeDisabled();
    await expect(page.locator('#btn-lock')).toBeEnabled();
    // even a change event that still arrives leaves the locked cell alone
    await page.evaluate(() => {
      const set = (id: string, v: string): void => {
        const el = document.getElementById(id) as HTMLInputElement;
        el.value = v;
        el.dispatchEvent(new Event('change'));
      };
      set('prop-x', '300'); set('prop-y', '300'); set('prop-w', '10'); set('prop-h', '10'); set('prop-rotation', '45');
      document.getElementById('btn-rotate90')!.click();
      document.getElementById('btn-flipHorizontal')!.click();
    });
    expect(await geometry(page, 'A')).toEqual({ x: 100, y: 60, width: 120, height: 60 });
    expect(await inTab(page, "const s = graph.getDataModel().getCell('A').getStyle(); return [s.rotation ?? null, s.flipH ?? null];")).toEqual([null, null]);
    // Undo unlocks: the fields are enabled again
    await page.keyboard.press('Control+z');
    expect(await isLocked(page, 'A')).toBe(false);
    for (const sel of GEOMETRY_FIELDS) await expect(page.locator(sel), sel).toBeEnabled();

    // a selected cell whose layer gets locked (e.g. by Redo; cells on a locked layer cannot be
    // clicked) shows disabled fields
    await select(page, ['U']);
    for (const sel of GEOMETRY_FIELDS) await expect(page.locator(sel), sel).toBeEnabled();
    await inTab(page, "graph.getDataModel().setStyle(graph.getDataModel().getCell('L2'), { locked: 1 });");
    expect(await selectedIds(page)).toEqual(['U']);
    for (const sel of GEOMETRY_FIELDS) await expect(page.locator(sel), sel).toBeDisabled();
    await page.locator('#prop-y').evaluate((el: HTMLInputElement) => { el.value = '400'; el.dispatchEvent(new Event('change')); });
    expect((await geometry(page, 'U')).y).toBe(60);
    expect(errors).toEqual([]);
  });

  test('arrow keys nudge the selection (1 px, Shift: grid size), never a locked cell', async ({ page }) => {
    await freshApp(page);
    await loadModel(page, MODEL_XML);
    const b = await center(page, 'B');
    await page.mouse.click(b.x, b.y);
    expect(await selectedIds(page)).toEqual(['B']);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    expect(await geometry(page, 'B')).toMatchObject({ x: 321, y: 61 });
    await page.keyboard.press('Shift+ArrowLeft');
    expect((await geometry(page, 'B')).x).toBe(311);
    // each nudge is one undo step
    await page.keyboard.press('Control+z');
    expect((await geometry(page, 'B')).x).toBe(321);

    // lock A; nudging A + B moves only B
    const a = await center(page, 'A');
    await page.mouse.click(a.x, a.y, { button: 'right' });
    await page.locator('#context-menu [data-action="lock"]').click();
    expect(await isLocked(page, 'A')).toBe(true);
    await page.keyboard.press('ArrowUp');
    expect(await geometry(page, 'A')).toMatchObject({ x: 60, y: 60 });
    await select(page, ['A', 'B']);
    await page.keyboard.press('ArrowUp');
    expect(await geometry(page, 'A')).toMatchObject({ x: 60, y: 60 });
    expect(await geometry(page, 'B')).toMatchObject({ x: 321, y: 60 });
    // not while typing in a field
    await page.locator('.prop-tab[data-tab="arrange"]').click();
    await page.locator('#prop-y').focus();
    await page.keyboard.press('ArrowUp');
    expect(await geometry(page, 'B')).toMatchObject({ x: 321, y: 60 });
  });
});

test('right-click > Lock / Unlock keeps the selection', async ({ page }) => {
  await freshApp(page);
  await loadModel(page, MODEL_XML);
  // a single unselected cell
  const a = await center(page, 'A');
  await page.mouse.click(a.x, a.y, { button: 'right' });
  const lockItem = page.locator('#context-menu [data-action="lock"]');
  await expect(lockItem).toHaveText('Lock');
  await lockItem.click();
  expect(await isLocked(page, 'A')).toBe(true);
  expect(await selectedIds(page)).toEqual(['A']);
  await expect(page.locator('#btn-lock')).toHaveText('Unlock');

  // a multi-selection
  await select(page, ['B', 'C']);
  const b = await center(page, 'B');
  await page.mouse.click(b.x, b.y, { button: 'right' });
  await lockItem.click();
  expect(await isLocked(page, 'B')).toBe(true);
  expect(await isLocked(page, 'C')).toBe(true);
  expect(await selectedIds(page)).toEqual(['B', 'C']);
  // Unlock too
  await page.mouse.click(b.x, b.y, { button: 'right' });
  await expect(lockItem).toHaveText('Unlock');
  await lockItem.click();
  expect(await isLocked(page, 'B')).toBe(false);
  expect(await selectedIds(page)).toEqual(['B', 'C']);

  // a group: right-click on its child acts on the group (selected or not), like a click
  const ownLock = (id: string): Promise<boolean> => inTab(page, "const s = graph.getDataModel().getCell(arg).getStyle(); return !!s && (s.locked === 1 || s.locked === '1' || s.locked === true);", id);
  await emptyClick(page);
  const g1 = await center(page, 'G1');
  await page.mouse.click(g1.x, g1.y, { button: 'right' });
  expect(await selectedIds(page)).toEqual(['G']);
  await lockItem.click();
  expect(await ownLock('G')).toBe(true);
  expect(await ownLock('G1')).toBe(false);
  expect(await selectedIds(page)).toEqual(['G']);
  // the gap between the children of the selected group (no shape there)
  const gap = await pagePoint(page, 400, 260);
  await page.mouse.click(gap.x, gap.y, { button: 'right' });
  await expect(lockItem).toHaveText('Unlock');
  await lockItem.click();
  expect(await ownLock('G')).toBe(false);
  expect(await selectedIds(page)).toEqual(['G']);
  // an edge has the cell menu too
  const e = await pagePoint(page, 640, 80);
  await page.mouse.click(e.x, e.y, { button: 'right' });
  expect(await selectedIds(page)).toEqual(['E']);
  await lockItem.click();
  expect(await ownLock('E')).toBe(true);
  expect(await selectedIds(page)).toEqual(['E']);
});

test('the project name follows the active tab: rename, switch, label, reload', async ({ page }) => {
  await freshApp(page);
  const title = page.locator('.document-title');
  const rename = async (name: string): Promise<void> => {
    await title.click();
    await title.locator('input').fill(name);
    await title.locator('input').press('Enter');
    await expect(title).toHaveText(name);
  };
  const tabs = page.locator('#tabs-container .tab-button');
  const exportName = async (): Promise<string> => {
    const [file] = await Promise.all([page.waitForEvent('download'), menu(page, 'file', 'export')]);
    return file.suggestedFilename();
  };

  // a new tab's project is named like the tab ("Diagram 1"), so renaming it relabels the tab
  await expect(title).toHaveText('Diagram 1');
  await rename('Station A');
  await expect(tabs.nth(0).locator('.tab-label')).toHaveText('Station A');
  // a second tab has its own project; "+" shows the new tab at once
  await page.locator('#tabs-container .tab-new-btn').click();
  await expect(tabs.nth(1)).toHaveClass(/active/);
  // default names take the lowest free number: "Diagram 1" is free again after the rename
  await expect(tabs.nth(1).locator('.tab-label')).toHaveText('Diagram 1');
  await expect(title).toHaveText('Diagram 1');
  await rename('Station B');
  expect(await exportName()).toBe('Station B.drawio');
  await tabs.nth(0).click();
  await expect(title).toHaveText('Station A');
  expect(await exportName()).toBe('Station A.drawio');

  // a tab labelled with its project name is relabelled with it (tabs opened from files/links)
  await tabs.nth(1).click();
  await tabs.nth(1).locator('.tab-label').dblclick();
  await tabs.nth(1).locator('input').fill('Station B');
  await tabs.nth(1).locator('input').press('Enter');
  await rename('Station C');
  await expect(tabs.nth(1).locator('.tab-label')).toHaveText('Station C');
  await expect(tabs.nth(0).locator('.tab-label')).toHaveText('Station A');

  // kept per tab over a reload
  await page.evaluate(async () => {
    const registry = await import('/src/services/service-registry.ts' as string);
    registry.ServiceRegistry.getTabManager().flushCache();
  });
  await page.reload();
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
  await expect(title).toHaveText('Station C');
  await tabs.nth(0).click();
  await expect(title).toHaveText('Station A');
  expect(await exportName()).toBe('Station A.drawio');
  await tabs.nth(1).click();
  await expect(title).toHaveText('Station C');
  expect(await exportName()).toBe('Station C.drawio');
});

test('a file with the old app-only layers (rdLayerId) opens with draw.io layers, unsaved', async ({ page }) => {
  await freshApp(page);
  const text = await readFile(resolve(process.cwd(), 'src/services/__tests__/fixtures/legacy/legacy-layers.drawio'), 'utf8');
  const chooser = page.waitForEvent('filechooser');
  await menu(page, 'file', 'open');
  await (await chooser).setFiles({ name: 'old-layers.drawio', mimeType: 'application/xml', buffer: Buffer.from(text) });
  await page.locator('.left-panel-tab-btn', { hasText: 'Layers' }).click();
  await expect(page.locator('#layers-list .layer-item .layer-name')).toHaveText(['Layer 3 (1)', 'Layer 2 (4)', 'Background (3)']);
  await expect(page.locator('.save-status')).toContainText('Unsaved');
  const [file] = await Promise.all([page.waitForEvent('download'), menu(page, 'file', 'export')]);
  const saved = (await (await file.createReadStream()).toArray()).map((c) => c.toString()).join('');
  expect(saved).not.toContain('rdLayerId');
  expect(saved).toContain('id="layer-1700000005000" value="Layer 2" parent="0"');
});
