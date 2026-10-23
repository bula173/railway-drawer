/**
 * @file hover-arrows.spec.ts
 * @brief draw.io connection arrows (src/ui/hover-arrows.ts) with real mouse input (page.mouse):
 *        hovering a shape shows 4 arrows; a click on the right arrow adds a connected clone (one
 *        undo step removes both); dragging an arrow onto another shape connects them, onto the blank
 *        canvas adds a connected clone; an existing shape in the arrow's direction is connected
 *        instead of cloned (preview outlines it); locked cells, View > Connection Arrows off
 *        (persisted) and Alt show none; an ERTMS signal's clone keeps its kind and gets a fresh ID;
 *        the arrow colour has >= 3:1 contrast on the light and dark canvas.
 *
 * Reads the graph through the dev server's module graph (like interaction.spec.ts). Any port.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const MODEL_XML = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
<mxCell id="A" value="Alpha" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="80" y="80" width="120" height="60" as="geometry"/></mxCell>
<mxCell id="B" value="Bravo" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="80" y="360" width="120" height="60" as="geometry"/></mxCell>
<mxCell id="N" value="Near" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="560" y="80" width="120" height="60" as="geometry"/></mxCell>
<mxCell id="M" value="Mike" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="400" y="80" width="80" height="60" as="geometry"/></mxCell>
<mxCell id="L" value="Locked" style="rounded=0;whiteSpace=wrap;html=1;locked=1;" vertex="1" parent="1"><mxGeometry x="400" y="360" width="120" height="60" as="geometry"/></mxCell>
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
  await inTab(page, 'tab.document.load(arg); graph.clearSelection();', xml);
}

interface Geo { x: number; y: number; width: number; height: number }

function geometry(page: Page, id: string): Promise<Geo> {
  return inTab<Geo>(page, 'const g = graph.getDataModel().getCell(arg).getGeometry(); return { x: g.x, y: g.y, width: g.width, height: g.height };', id);
}

function vertexIds(page: Page): Promise<string[]> {
  return inTab<string[]>(page, `return Object.values(graph.getDataModel().cells)
    .filter((c) => c.isVertex() && c.getParent() === graph.getDefaultParent()).map((c) => c.id);`);
}

function edges(page: Page): Promise<Array<{ source: string | null; target: string | null }>> {
  return inTab(page, `return Object.values(graph.getDataModel().cells).filter((c) => c.isEdge())
    .map((e) => ({ source: e.source && e.source.id, target: e.target && e.target.id }));`);
}

function selectedIds(page: Page): Promise<string[]> {
  return inTab<string[]>(page, 'return graph.getSelectionCells().map((c) => c.id);');
}

/** Page coordinates of a cell's centre. */
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

const visibleArrows = (page: Page) => page.locator('.rd-hover-arrow:visible');

/** Rests the pointer on a cell (a little off its centre) until its arrows show (`count` visible). */
async function hover(page: Page, id: string, count = 4): Promise<void> {
  const c = await center(page, id);
  await page.mouse.move(c.x - 30, c.y - 25);
  await page.mouse.move(c.x + 5, c.y + 3, { steps: 4 });
  await expect(visibleArrows(page)).toHaveCount(count);
  expect(await inTab<string | null>(page, 'return tab.hoverArrowsController.getCurrentCell()?.id ?? null;')).toBe(id);
}

/** Page centre of the arrow of direction `dir`. */
async function arrowCenter(page: Page, dir: string): Promise<{ x: number; y: number }> {
  const box = await page.locator(`.rd-hover-arrow[data-direction="${dir}"]`).boundingBox();
  expect(box).not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

/** draw.io's clone modifier: Cmd on macOS (Ctrl+click is the context menu there), else Ctrl. */
const CLONE_KEY = process.platform === 'darwin' ? 'Meta' : 'Control';

async function clickArrow(page: Page, dir: string, modifiers: string[] = []): Promise<void> {
  const p = await arrowCenter(page, dir);
  await page.mouse.move(p.x, p.y, { steps: 3 });
  for (const m of modifiers) await page.keyboard.down(m);
  await page.mouse.down();
  await page.mouse.up();
  for (const m of modifiers) await page.keyboard.up(m);
}

async function emptyMove(page: Page): Promise<void> {
  const p = await pagePoint(page, 760, 560);
  await page.mouse.move(p.x, p.y, { steps: 3 });
}

test.describe('connection arrows (real mouse)', () => {
  test('hover shows 4 arrows outside the shape; leaving hides them; Escape hides them', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await freshApp(page);
    await loadModel(page, MODEL_XML);
    await expect(visibleArrows(page)).toHaveCount(0);
    await hover(page, 'A');
    // just outside the shape on each side, centred on it
    const state = await inTab<Geo>(page, `const s = graph.view.getState(graph.getDataModel().getCell('A'));
      const r = graph.container.getBoundingClientRect();
      return { x: r.left + s.x - graph.container.scrollLeft, y: r.top + s.y - graph.container.scrollTop, width: s.width, height: s.height };`);
    const right = (await page.locator('.rd-hover-arrow[data-direction="east"]').boundingBox())!;
    expect(right.x).toBeGreaterThan(state.x + state.width);
    expect(right.x).toBeLessThan(state.x + state.width + 12);
    expect(Math.abs(right.y + right.height / 2 - (state.y + state.height / 2))).toBeLessThanOrEqual(1);
    const up = (await page.locator('.rd-hover-arrow[data-direction="north"]').boundingBox())!;
    expect(up.y + up.height).toBeLessThan(state.y);
    // leaving the shape and its arrows hides them
    await emptyMove(page);
    await expect(visibleArrows(page)).toHaveCount(0);
    // Escape hides them
    await hover(page, 'A');
    await page.keyboard.press('Escape');
    await expect(visibleArrows(page)).toHaveCount(0);
    // a pressed button (rubber band: Shift+drag on the background, a plain drag pans) never shows them
    await hover(page, 'B');
    const from = await pagePoint(page, 300, 250);
    await page.mouse.move(from.x, from.y);
    await page.keyboard.down('Shift');
    await page.mouse.down();
    const c = await center(page, 'B');
    await page.mouse.move(c.x, c.y, { steps: 6 });
    await page.waitForTimeout(400);
    await expect(visibleArrows(page)).toHaveCount(0);
    await page.mouse.up();
    await page.keyboard.up('Shift');
    // constant screen size at another zoom
    await emptyMove(page);
    await inTab(page, 'graph.zoomTo(2);');
    await hover(page, 'A');
    const right2 = (await page.locator('.rd-hover-arrow[data-direction="east"]').boundingBox())!;
    expect(right2.width).toBeCloseTo(right.width, 0);
    await inTab(page, 'graph.zoomTo(1);');
    expect(errors).toEqual([]);
  });

  test('click on the right arrow adds a connected clone to the right; one undo removes both', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await freshApp(page);
    await loadModel(page, MODEL_XML);
    const before = await vertexIds(page);
    await hover(page, 'B');
    // hovering the arrow previews where the clone lands
    const p = await arrowCenter(page, 'east');
    await page.mouse.move(p.x, p.y, { steps: 3 });
    await expect(page.locator('.rd-hover-arrow-preview[data-kind="clone"]')).toBeVisible();
    await page.mouse.down();
    await page.mouse.up();
    const after = await vertexIds(page);
    expect(after.length).toBe(before.length + 1);
    const clone = after.find((id) => !before.includes(id))!;
    // same size and style, 80 (draw.io defaultEdgeLength) to the right, same row
    expect(await geometry(page, clone)).toEqual({ x: 80 + 120 + 80, y: 360, width: 120, height: 60 });
    expect(await inTab(page, 'return graph.getDataModel().getCell(arg).getStyle();', clone))
      .toEqual(await inTab(page, 'return graph.getDataModel().getCell("B").getStyle();'));
    expect(await edges(page)).toEqual([{ source: 'B', target: clone }]);
    expect(await selectedIds(page)).toEqual([clone]);
    await expect(visibleArrows(page)).toHaveCount(0);
    // one undo step removes both
    await page.keyboard.press('Control+z');
    expect(await vertexIds(page)).toEqual(before);
    expect(await edges(page)).toEqual([]);
    await page.keyboard.press('Control+y');
    expect((await vertexIds(page)).length).toBe(before.length + 1);
    expect((await edges(page)).length).toBe(1);
    expect(errors).toEqual([]);
  });

  test('a shape in the arrow direction is connected instead of cloned; Ctrl+click always clones', async ({ page }) => {
    await freshApp(page);
    await loadModel(page, MODEL_XML);
    const before = await vertexIds(page);
    // N's west arrow ends 80 left of N (x 480), on M's right side: M is the target
    await hover(page, 'N');
    const p = await arrowCenter(page, 'west');
    await page.mouse.move(p.x, p.y, { steps: 3 });
    await expect(page.locator('.rd-hover-arrow-preview[data-kind="target"]')).toBeVisible();
    await page.mouse.down();
    await page.mouse.up();
    expect(await vertexIds(page)).toEqual(before);
    expect(await edges(page)).toEqual([{ source: 'N', target: 'M' }]);
    expect(await selectedIds(page)).toEqual(['M']);
    // Ctrl/Cmd+click: a new clone even though M is there
    await emptyMove(page);
    await page.keyboard.press('Control+z');
    expect(await edges(page)).toEqual([]);
    await hover(page, 'N');
    await clickArrow(page, 'west', [CLONE_KEY]);
    const after = await vertexIds(page);
    expect(after.length).toBe(before.length + 1);
    const clone = after.find((id) => !before.includes(id))!;
    expect((await geometry(page, clone)).x).toBe(560 - 80 - 120);
    expect(await edges(page)).toEqual([{ source: 'N', target: clone }]);
  });

  test('dragging an arrow onto another shape connects them; onto the blank canvas adds a connected clone', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await freshApp(page);
    await loadModel(page, MODEL_XML);
    const before = await vertexIds(page);
    await hover(page, 'A');
    const from = await arrowCenter(page, 'south');
    const to = await center(page, 'B');
    await page.mouse.move(from.x, from.y, { steps: 3 });
    await page.mouse.down();
    await page.mouse.move(from.x, (from.y + to.y) / 2, { steps: 5 });
    await page.mouse.move(to.x, to.y, { steps: 5 });
    await page.mouse.up();
    expect(await vertexIds(page)).toEqual(before);
    expect(await edges(page)).toEqual([{ source: 'A', target: 'B' }]);
    expect(await inTab<number>(page, 'return graph.getDataModel().getCell("A").getGeometry().x;')).toBe(80);

    // blank canvas: clone centred at the drop point, connected. The south arrow is hidden now: it
    // lies on the new edge (draw.io checkCollisions)
    await emptyMove(page);
    await hover(page, 'A', 3);
    await expect(page.locator('.rd-hover-arrow[data-direction="south"]')).toBeHidden();
    const from2 = await arrowCenter(page, 'east');
    const drop = await pagePoint(page, 300, 250);
    await page.mouse.move(from2.x, from2.y, { steps: 3 });
    await page.mouse.down();
    await page.mouse.move(drop.x - 40, drop.y - 40, { steps: 5 });
    await page.mouse.move(drop.x, drop.y, { steps: 5 });
    await page.mouse.up();
    const after = await vertexIds(page);
    expect(after.length).toBe(before.length + 1);
    const clone = after.find((id) => !before.includes(id))!;
    const g = await geometry(page, clone);
    expect(g.width).toBe(120);
    expect(Math.abs(g.x + g.width / 2 - 300)).toBeLessThanOrEqual(12);
    expect(Math.abs(g.y + g.height / 2 - 250)).toBeLessThanOrEqual(12);
    expect(await edges(page)).toContainEqual({ source: 'A', target: clone });
    expect(await selectedIds(page)).toEqual([clone]);
    // one undo step
    await page.keyboard.press('Control+z');
    expect(await vertexIds(page)).toEqual(before);
    expect((await edges(page)).length).toBe(1);
    expect(errors).toEqual([]);
  });

  test('no arrows for locked cells, cells on a locked layer, edges; Alt hides; View > Connection Arrows off', async ({ page }) => {
    await freshApp(page);
    await loadModel(page, MODEL_XML);
    const restOn = async (id: string) => {
      const c = await center(page, id);
      await page.mouse.move(c.x - 20, c.y - 10);
      await page.mouse.move(c.x, c.y, { steps: 4 });
      await page.waitForTimeout(500);
    };
    await restOn('L');
    await expect(visibleArrows(page)).toHaveCount(0);
    // a locked layer
    await inTab(page, `const m = graph.getDataModel(); m.setStyle(m.getCell('1'), 'locked=1');`);
    await restOn('A');
    await expect(visibleArrows(page)).toHaveCount(0);
    await inTab(page, `const m = graph.getDataModel(); m.setStyle(m.getCell('1'), '');`);
    await emptyMove(page);
    await hover(page, 'A');
    // Alt hides them (draw.io isResetEvent)
    await page.keyboard.down('Alt');
    const c = await center(page, 'A');
    await page.mouse.move(c.x + 4, c.y + 2, { steps: 2 });
    await expect(visibleArrows(page)).toHaveCount(0);
    await page.keyboard.up('Alt');

    // View > Connection Arrows off: none, persisted over a reload
    await emptyMove(page);
    await page.locator('.menu-item[data-menu="view"]').click();
    const item = page.locator('.menu-dropdown[data-menu="view"] .menu-dropdown-item[data-action="toggleConnectionArrows"]');
    await expect(item).toHaveAttribute('aria-checked', 'true');
    await item.click();
    await restOn('A');
    await expect(visibleArrows(page)).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('rd.connectionArrows'))).toBe('0');
    await page.reload();
    await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
    await loadModel(page, MODEL_XML);
    await restOn('A');
    await expect(visibleArrows(page)).toHaveCount(0);
    await expect(page.locator('.menu-dropdown-item[data-action="toggleConnectionArrows"]')).toHaveAttribute('aria-checked', 'false');
    // Alt+Shift+A turns them on again
    await page.mouse.click(5, 300);
    await page.keyboard.press('Alt+Shift+KeyA');
    await expect(page.locator('.menu-dropdown-item[data-action="toggleConnectionArrows"]')).toHaveAttribute('aria-checked', 'true');
    await emptyMove(page);
    await hover(page, 'A');
  });

  test('an ERTMS signal clone keeps its kind and gets a fresh ID; a group gets one set of arrows', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await freshApp(page);
    const palette = page.locator('#drawio-palette-container');
    const ertms = palette.locator('section[data-palette-id="ertms"]');
    if ((await ertms.locator('.rd-dp-header').getAttribute('aria-expanded')) !== 'true') await ertms.locator('.rd-dp-header').click();
    await ertms.locator('.rd-dp-item[title="Signal Right 3"]').first().click();
    await expect.poll(async () => (await selectedIds(page)).length).toBe(1);
    const [signal] = await selectedIds(page);
    await inTab(page, 'graph.clearSelection();');
    const data = (id: string) => inTab<{ kind: string | null; id: string | null; dir: string | null }>(page, `
      const v = graph.getDataModel().getCell(arg).getValue();
      return v && v.getAttribute ? { kind: v.getAttribute('rdKind'), id: v.getAttribute('rdId'), dir: v.getAttribute('rdDirection') } : { kind: null, id: null, dir: null };
    `, id);
    const original = await data(signal);
    expect(original.kind).toBe('signal');
    expect(original.id).toBe('S1');
    const before = await vertexIds(page);
    await hover(page, signal);
    await clickArrow(page, 'east');
    const after = await vertexIds(page);
    expect(after.length).toBe(before.length + 1);
    const clone = after.find((id) => !before.includes(id))!;
    const cloned = await data(clone);
    expect(cloned.kind).toBe('signal');
    expect(cloned.id).toBe('S2');
    expect(cloned.dir).toBe(original.dir);
    expect(await inTab<number>(page, 'return graph.getDataModel().getCell(arg).getChildCount();', clone))
      .toBe(await inTab<number>(page, 'return graph.getDataModel().getCell(arg).getChildCount();', signal));
    expect(await edges(page)).toContainEqual({ source: signal, target: clone });
    // the Checks see no duplicate id
    expect(await page.evaluate(async () => {
      const registry = await import('/src/services/service-registry.ts' as string);
      const v = await import('/src/railway/validation.ts' as string);
      const graph = registry.ServiceRegistry.getTabManager().getActiveTab().graph;
      return v.validateModel(graph.getDataModel()).filter((i: { rule: string }) => i.rule === 'duplicate-id').length;
    })).toBe(0);
    expect(errors).toEqual([]);
  });

  test('a signal clone on a track snaps like an insert; no arrows on the track edge or with the Route tool', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await freshApp(page);
    // T1 along y=100 (km 10.0 - 10.8), S1 below it (nominal side), no km yet
    await loadModel(page, `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
<object label="" id="t1" rdKind="track" rdId="T1" rdKmStart="10" rdKmEnd="10.8"><mxCell style="endArrow=none;html=1;strokeWidth=4;" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="0" y="100" as="sourcePoint"/><mxPoint x="800" y="100" as="targetPoint"/></mxGeometry></mxCell></object>
<object label="" id="s1" rdKind="signal" rdId="S1" rdDirection="nominal" rdTrackId="T1"><mxCell style="triangle;whiteSpace=wrap;html=1;fillColor=#000000;" vertex="1" parent="1"><mxGeometry x="90" y="104" width="20" height="20" as="geometry"/></mxCell></object>
</root></mxGraphModel>`);
    // the track (an edge) gets none
    const t = await pagePoint(page, 400, 100);
    await page.mouse.move(t.x - 30, t.y);
    await page.mouse.move(t.x, t.y, { steps: 4 });
    await page.waitForTimeout(500);
    await expect(visibleArrows(page)).toHaveCount(0);
    await hover(page, 's1');
    await clickArrow(page, 'east');
    const clone = (await selectedIds(page))[0];
    expect(clone).not.toBe('s1');
    const info = await inTab<{ id: string; track: string; km: string | null; y: number }>(page, `
      const c = graph.getDataModel().getCell(arg); const v = c.getValue();
      return { id: v.getAttribute('rdId'), track: v.getAttribute('rdTrackId'), km: v.getAttribute('rdKm'), y: c.getGeometry().y };`, clone);
    expect(info.id).toBe('S2');
    expect(info.track).toBe('T1');
    // the snap ran in the same edit: km along T1 at x 200 (10 + 200/800 * 0.8)
    expect(Number(info.km)).toBeCloseTo(10.2, 2);
    expect(info.y).toBe(104);
    // one undo step removes clone + edge (and the snap)
    await page.keyboard.press('Control+z');
    expect(await inTab<boolean>(page, 'return !!graph.getDataModel().getCell(arg);', clone)).toBe(false);
    // Route tool active: no arrows
    await emptyMove(page);
    await page.locator('#btn-route-tool').click();
    await expect(page.locator('#graph-container.rd-route-tool-active')).toHaveCount(1);
    const c = await center(page, 's1');
    await page.mouse.move(c.x - 20, c.y - 10);
    await page.mouse.move(c.x, c.y, { steps: 4 });
    await page.waitForTimeout(500);
    await expect(visibleArrows(page)).toHaveCount(0);
    await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
  });

  test('arrow colour contrast >= 3:1 on the light and the dark canvas', async ({ page }) => {
    await freshApp(page);
    await loadModel(page, MODEL_XML);
    const contrast = async (): Promise<number> => {
      await emptyMove(page);
      await hover(page, 'A');
      const p = await arrowCenter(page, 'east');
      await page.mouse.move(p.x, p.y, { steps: 2 });
      return page.evaluate(() => {
        const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
        const lum = ([r, g, b]: number[]) => {
          const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const arrow = document.querySelector('.rd-hover-arrow[data-direction="east"]') as HTMLElement;
        const path = arrow.querySelector('path')!;
        const fill = parse(getComputedStyle(path).fill);
        const canvas = parse(getComputedStyle(arrow.parentElement!).getPropertyValue('--rd-canvas-bg').trim()
          .replace(/^#(..)(..)(..)$/, (_m, r, g, b) => `rgb(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)})`));
        const opacity = Number(getComputedStyle(arrow).opacity);
        if (opacity < 1) return 0;
        const [a, b] = [lum(fill), lum(canvas)].sort((x, y) => y - x);
        return (a + 0.05) / (b + 0.05);
      });
    };
    expect(await contrast()).toBeGreaterThanOrEqual(3);
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    expect(await contrast()).toBeGreaterThanOrEqual(3);
  });
});
