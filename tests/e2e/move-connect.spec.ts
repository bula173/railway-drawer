/**
 * @file move-connect.spec.ts
 * @brief Moving and connecting with real mouse input (page.mouse), draw.io feel:
 *        - a drag lands where it is released (±1 px) with the grid off, on the grid (gridSize 10)
 *          with it on, at 100 % and 150 %: draw.io rectangle, ERTMS signal (group), balise, track,
 *          a cell of an inserted template; Alt held while dragging disables grid and track snapping;
 *        - snap to track only close to the line (a signal 60 px away stays, 8 px away snaps) with the
 *          track highlighted during the drag; a balise dropped on a track does not split it;
 *        - the dragged cell is the one under the pointer (another selected cell stays);
 *        - connecting: from a connection point ('x', incl. quarter points), from a hover arrow, by
 *          dropping an edge end on a shape's body (floating, blue outline), ERTMS signal connectable
 *          as a whole, a new edge ends where it is released.
 *
 * Reads the graph through the dev server's module graph (like interaction.spec.ts). Any port.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openLeftTab } from './menu-helpers';

// room for the drawing at 150 % (presses must land inside the window)
test.use({ viewport: { width: 1600, height: 1100 } });

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

function selectedIds(page: Page): Promise<string[]> {
  return inTab<string[]>(page, 'return graph.getSelectionCells().map((c) => c.id).sort();');
}

interface Geo { x: number; y: number; width: number; height: number }
function geometry(page: Page, id: string): Promise<Geo> {
  return inTab<Geo>(page, 'const g = graph.getDataModel().getCell(arg).getGeometry(); return { x: g.x, y: g.y, width: g.width, height: g.height };', id);
}

/** Moves a vertex to (x, y) or an edge to the line (x, y)-(x2, y) through the model. */
async function place(page: Page, id: string, x: number, y: number, x2?: number): Promise<void> {
  await inTab(page, `
    const m = graph.getDataModel(); const c = m.getCell(arg.id); const g = c.getGeometry().clone();
    if (c.isEdge()) { const P = graph.view.translate.constructor; g.setTerminalPoint(new P(arg.x, arg.y), true); g.setTerminalPoint(new P(arg.x2, arg.y), false); }
    else { g.x = arg.x; g.y = arg.y; }
    m.setGeometry(c, g); graph.clearSelection();
  `, { id, x, y, x2 });
}

/** Page coordinates of a graph point. */
function pagePoint(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  return inTab(page, `
    const r = graph.container.getBoundingClientRect();
    const s = graph.view.scale, t = graph.view.translate;
    return { x: r.left + (arg.x + t.x) * s - graph.container.scrollLeft, y: r.top + (arg.y + t.y) * s - graph.container.scrollTop };
  `, { x, y });
}

/** Page coordinates of a cell's centre. */
function center(page: Page, id: string): Promise<{ x: number; y: number }> {
  return inTab(page, `
    const s = graph.view.getState(graph.getDataModel().getCell(arg));
    const r = graph.container.getBoundingClientRect();
    return { x: r.left + s.getCenterX() - graph.container.scrollLeft, y: r.top + s.getCenterY() - graph.container.scrollTop };
  `, id);
}

/**
 * Press, move in steps, (optional check while the button is down), release. `alt`: Alt is held
 * from the first move on (draw.io: Alt pressed before the press starts a rubber band instead).
 */
async function drag(page: Page, from: { x: number; y: number }, dx: number, dy: number,
  opts: { alt?: boolean; during?: () => Promise<void> } = {}): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx / 6, from.y + dy / 6, { steps: 2 });
  if (opts.alt) await page.keyboard.down('Alt');
  await page.mouse.move(from.x + dx / 3, from.y + dy / 3, { steps: 3 });
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 6 });
  if (opts.during) await opts.during();
  await page.mouse.up();
  if (opts.alt) await page.keyboard.up('Alt');
}

async function paletteInsert(page: Page, section: string, title: string): Promise<string> {
  await inTab(page, 'graph.clearSelection();');
  const sec = page.locator(`#drawio-palette-container section[data-palette-id="${section}"]`);
  if ((await sec.locator('.rd-dp-header').getAttribute('aria-expanded')) !== 'true') await sec.locator('.rd-dp-header').click();
  await sec.locator(`.rd-dp-item[title="${title}"]`).first().click();
  await expect.poll(async () => (await selectedIds(page)).length).toBe(1);
  return (await selectedIds(page))[0];
}

async function setGrid(page: Page, on: boolean): Promise<void> {
  if ((await inTab<boolean>(page, 'return graph.gridEnabled;')) !== on) await page.locator('#btn-grid').click();
  expect(await inTab<boolean>(page, 'return graph.gridEnabled;')).toBe(on);
}

const attr = (page: Page, id: string, name: string): Promise<string | null> =>
  inTab(page, 'const v = graph.getDataModel().getCell(arg.id).value; return v && v.getAttribute ? v.getAttribute(arg.name) : null;', { id, name });

const snapShown = (page: Page): Promise<string | null> => inTab(page, "return graph.container.getAttribute('data-rd-track-snap');");

interface EdgeInfo { id: string; source: string | null; target: string | null; style: Record<string, unknown>; targetPoint: number[] | null }
/** Top-level edges (not the parts of ERTMS symbols). */
const edgesOf = (page: Page): Promise<EdgeInfo[]> => inTab(page, `
  const layer = graph.getDefaultParent();
  return (layer.children || []).filter((c) => c.isEdge())
    .map((e) => ({ id: e.id, source: e.source && e.source.id, target: e.target && e.target.id, style: { ...(e.style || {}) },
      targetPoint: e.getGeometry().targetPoint ? [e.getGeometry().targetPoint.x, e.getGeometry().targetPoint.y] : null }));
`);

/** A rectangle, an ERTMS signal, a balise and a track (an edge, far below them). */
async function setup(page: Page): Promise<{ rect: string; sig: string; bal: string; trk: string }> {
  await freshApp(page);
  const rect = await paletteInsert(page, 'general', 'Rectangle');
  const sig = await paletteInsert(page, 'ertms', 'Signal Right 3');
  const bal = await paletteInsert(page, 'ertms', 'Single Balise Right');
  const trk = await paletteInsert(page, 'ertms', 'Track');
  await place(page, trk, 100, 500, 700);
  await place(page, rect, 103, 97);
  await place(page, sig, 303, 207);
  await place(page, bal, 453, 303);
  return { rect, sig, bal, trk };
}

test.describe('moving (real mouse)', () => {
  test('a drag lands where it is released with the grid off, on the grid with it on (100 % and 150 %)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    const { rect, sig, bal, trk } = await setup(page);
    // draw.io defaults: grid on, gridSize 10
    expect(await inTab(page, 'return [graph.gridEnabled, graph.gridSize];')).toEqual([true, 10]);
    for (const scale of [1, 1.5]) {
      await inTab(page, 'graph.zoomTo(arg); graph.clearSelection();', scale);
      for (const grid of [false, true]) {
        await setGrid(page, grid);
        for (const id of [rect, sig, bal]) {
          for (const d of [5, 8, 15, 33]) {
            // grid on: start on the grid (draw.io leaves an off-grid cell in place for moves under
            // half a grid step and aligns it on longer ones)
            const off = grid ? 0 : 3;
            await place(page, id, 100 + off, (id === rect ? 100 : id === sig ? 210 : 300) - off);
            const before = await geometry(page, id);
            await drag(page, await center(page, id), d, -d);
            const after = await geometry(page, id);
            const what = `${id} zoom ${scale} grid ${grid} drag ${d}`;
            expect(await selectedIds(page), what).toEqual([id]);
            if (grid) {
              expect([after.x % 10, after.y % 10], what).toEqual([0, 0]);
              expect(Math.abs(after.x - (before.x + d / scale)), what).toBeLessThanOrEqual(5);
              expect(Math.abs(after.y - (before.y - d / scale)), what).toBeLessThanOrEqual(5);
            } else {
              expect(Math.abs(after.x - before.x - d / scale), what).toBeLessThanOrEqual(1);
              expect(Math.abs(after.y - before.y + d / scale), what).toBeLessThanOrEqual(1);
            }
          }
        }
        // the track (an edge), dragged by its body
        await place(page, trk, 100, 500, 700);
        await drag(page, await pagePoint(page, 400, 500), 8, 12);
        const sp = await inTab<number[]>(page, 'const g = graph.getDataModel().getCell(arg).getGeometry(); return [g.sourcePoint.x, g.sourcePoint.y];', trk);
        const tol = grid ? 5 : 1;
        expect(Math.abs(sp[0] - 100 - 8 / scale), `track x ${scale} ${grid}`).toBeLessThanOrEqual(tol);
        expect(Math.abs(sp[1] - 500 - 12 / scale), `track y ${scale} ${grid}`).toBeLessThanOrEqual(tol);
        await place(page, trk, 100, 500, 700);
      }
    }
    expect(errors).toEqual([]);
  });

  test('a cell of an inserted template moves where released; Alt while dragging ignores the grid', async ({ page }) => {
    await freshApp(page);
    await openLeftTab(page, 'templates');
    await page.locator('#templates-panel [data-section="builtin"] .rd-tpl-tile').first().click();
    await page.locator('.rd-tpl-popover [data-action="insert"]').click();
    await expect.poll(async () => (await selectedIds(page)).length).toBeGreaterThan(10);
    // a text label of the template (top level, no railway data)
    const id = await inTab<string>(page, `
      const t = graph.getSelectionCells().find((c) => c.isVertex() && !(c.children || []).length &&
        /"text"|baseStyleNames":\\["text/.test(JSON.stringify(c.style)) && !(c.value && c.value.getAttribute && c.value.getAttribute('rdKind')));
      return t.id;
    `);
    await inTab(page, 'graph.clearSelection();');
    // moved to a free spot (the template lies around the view centre)
    await setGrid(page, false);
    await place(page, id, 23, 27);
    expect(await inTab(page, 'const s = graph.view.getState(graph.getDataModel().getCell(arg)); return graph.getCellAt(s.getCenterX(), s.getCenterY()).id;', id)).toBe(id);
    await drag(page, await center(page, id), 13, 9);
    expect(await geometry(page, id)).toMatchObject({ x: 36, y: 36 });
    expect(await selectedIds(page)).toEqual([id]);
    await setGrid(page, true);
    await place(page, id, 23, 27);
    await drag(page, await center(page, id), 7, 6, { alt: true });
    expect(await geometry(page, id)).toMatchObject({ x: 30, y: 33 });
    expect(await selectedIds(page)).toEqual([id]);
  });

  test('snap to track: only close to the line, highlighted while dragging, not with Alt; no track split', async ({ page }) => {
    const { sig, bal, trk } = await setup(page);
    await setGrid(page, false);
    const trackId = await attr(page, trk, 'rdId');
    expect(trackId).toBeTruthy();
    for (const scale of [1, 1.5]) {
      await inTab(page, 'graph.zoomTo(arg); graph.clearSelection();', scale);
      // dropped 60 px (screen) below the track: no highlight, stays where released
      await place(page, sig, 300, 300);
      let seen: string | null = 'unset';
      const far = 500 + 60 / scale;
      await drag(page, await center(page, sig), 0, (far - 300) * scale, { during: async () => { seen = await snapShown(page); } });
      expect(seen, `no highlight at 60 px, zoom ${scale}`).toBeNull();
      expect(Math.abs((await geometry(page, sig)).y - far), `60 px stays, zoom ${scale}`).toBeLessThanOrEqual(1);
      // 8 px: the track is highlighted during the drag, the drop puts the signal beside the line
      await place(page, sig, 300, 300);
      seen = null;
      const near = 500 + 8 / scale;
      await drag(page, await center(page, sig), 0, (near - 300) * scale, {
        during: async () => {
          await expect(page.locator('.rd-track-snap-highlight')).toHaveCount(1);
          seen = await snapShown(page);
        },
      });
      expect(seen, `highlight at 8 px, zoom ${scale}`).toBe(trackId);
      await expect(page.locator('.rd-track-snap-highlight')).toHaveCount(0);
      expect(await snapShown(page)).toBeNull();
      // nominal signal: below the line, gap 4
      expect((await geometry(page, sig)).y, `snapped, zoom ${scale}`).toBeCloseTo(504, 1);
      expect(await attr(page, sig, 'rdTrackId')).toBe(trackId);
      // Alt held while dragging: the same drop is not snapped, no highlight
      await place(page, sig, 300, 300);
      seen = 'unset';
      await drag(page, await center(page, sig), 0, (near - 300) * scale, { alt: true, during: async () => { seen = await snapShown(page); } });
      expect(seen).toBeNull();
      expect(Math.abs((await geometry(page, sig)).y - near), `alt, zoom ${scale}`).toBeLessThanOrEqual(1);
    }
    // an arrow-key nudge moves a snapped signal exactly 1 px, also away from the track
    await inTab(page, 'graph.zoomTo(1);');
    await place(page, sig, 300, 300);
    await drag(page, await center(page, sig), 0, 208);
    expect((await geometry(page, sig)).y).toBeCloseTo(504, 1);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('ArrowDown');
    expect((await geometry(page, sig)).y).toBeCloseTo(505, 1);

    // a balise dropped on the track: placed on it, the track is not split
    const edges = (await edgesOf(page)).length;
    await place(page, bal, 200, 300);
    const b = await center(page, bal);
    const onTrack = await pagePoint(page, 250, 500);
    await drag(page, b, onTrack.x - b.x, onTrack.y - b.y);
    expect((await edgesOf(page)).length).toBe(edges);
    expect((await edgesOf(page)).find((e) => e.id === trk)).toMatchObject({ source: null, target: null });
    const bg = await geometry(page, bal);
    expect(bg.y + bg.height / 2).toBeCloseTo(500, 1);
    expect(await attr(page, bal, 'rdTrackId')).toBe(trackId);
    // a balise dropped on the signal stays a top-level cell (a symbol is no container)
    await place(page, bal, 200, 300);
    const s = await center(page, sig);
    const b2 = await center(page, bal);
    await drag(page, b2, s.x - b2.x, s.y - b2.y);
    expect(await inTab(page, 'return graph.getDataModel().getCell(arg).parent.id;', bal)).toBe(await inTab(page, 'return graph.getDefaultParent().id;'));
  });

  test('the dragged cell is the one under the pointer, not the selected one', async ({ page }) => {
    const { rect, sig, bal } = await setup(page);
    await setGrid(page, false);
    await place(page, rect, 100, 100);
    await place(page, bal, 232, 124); // just right of the rectangle
    await inTab(page, 'graph.setSelectionCell(graph.getDataModel().getCell(arg));', rect);
    await drag(page, await center(page, bal), 30, 20);
    expect(await geometry(page, rect)).toMatchObject({ x: 100, y: 100 });
    expect(await geometry(page, bal)).toMatchObject({ x: 262, y: 144 });
    expect(await selectedIds(page)).toEqual([bal]);
    // a press on a part of the signal moves the whole signal
    await place(page, sig, 300, 300);
    const part = await inTab<{ x: number; y: number }>(page, `
      const g = graph.getDataModel().getCell(arg); const c = g.children.find((k) => k.isVertex());
      const s = graph.view.getState(c); const r = graph.container.getBoundingClientRect();
      return { x: r.left + s.getCenterX() - graph.container.scrollLeft, y: r.top + s.getCenterY() - graph.container.scrollTop };`, sig);
    await drag(page, part, 40, 0);
    expect(await geometry(page, sig)).toMatchObject({ x: 340, y: 300 });
    expect(await selectedIds(page)).toEqual([sig]);
  });
});

test.describe('connecting (real mouse)', () => {
  /** Hovers `from` (graph point), presses, drags to `to` (graph point), releases. */
  async function connectDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number },
    during?: () => Promise<void>): Promise<void> {
    const p = await pagePoint(page, from.x, from.y);
    const q = await pagePoint(page, to.x, to.y);
    await page.mouse.move(p.x - 15, p.y - 15);
    await page.mouse.move(p.x, p.y, { steps: 4 });
    await page.mouse.down();
    await page.mouse.move((p.x + q.x) / 2, (p.y + q.y) / 2, { steps: 5 });
    await page.mouse.move(q.x, q.y, { steps: 5 });
    if (during) await during();
    await page.mouse.up();
  }

  test('from a connection point, from a hover arrow, by dropping an edge end on a body; ERTMS signal as a whole', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    const { rect: a, sig, bal } = await setup(page);
    const b = await paletteInsert(page, 'general', 'Rectangle');
    await setGrid(page, false);
    await place(page, a, 100, 100);
    await place(page, b, 400, 100);
    await place(page, sig, 300, 300);
    await place(page, bal, 100, 300);
    const base = (await edgesOf(page)).length;

    // hovering shows the 'x' points (draw.io: 16 on a rectangle, a visible image)
    const hp = await pagePoint(page, 160, 130);
    await page.mouse.move(hp.x, hp.y, { steps: 3 });
    const icons = await inTab<{ n: number; src: string }>(page, `
      const ch = graph.getPlugin('ConnectionHandler').constraintHandler;
      return { n: ch.focusIcons.length, src: ch.pointImage.src };`);
    expect(icons.n).toBe(16);
    expect(icons.src).toMatch(/^data:image\/svg\+xml/);

    // 1. from A's top quarter point to B's body: fixed source point, floating target, A not moved;
    //    the target is outlined in draw.io's blue while hovered
    await connectDrag(page, { x: 130, y: 100 }, { x: 460, y: 140 }, async () => {
      expect(await inTab(page, `const m = graph.getPlugin('ConnectionHandler').marker;
        return [m.validColor, m.getValidState() && m.getValidState().cell.id];`)).toEqual(['#00a8ff', b]);
    });
    let added = (await edgesOf(page)).slice(base);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ source: a, target: b });
    expect([added[0].style.exitX, added[0].style.exitY]).toEqual([0.25, 0]);
    expect(added[0].style.entryX ?? null).toBeNull();
    expect(await geometry(page, a)).toMatchObject({ x: 100, y: 100 });
    await page.keyboard.press('ControlOrMeta+z');
    expect((await edgesOf(page)).length).toBe(base);

    // 2. balise point -> ERTMS signal body: connects to the signal group, not to one of its parts
    await connectDrag(page, { x: 112, y: 306 }, { x: 321, y: 313 });
    added = (await edgesOf(page)).slice(base);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ source: bal, target: sig });
    await page.keyboard.press('ControlOrMeta+z');

    // 3. from the signal's right point (connectable as a whole) to rectangle B; the signal stays
    await connectDrag(page, { x: 342, y: 313 }, { x: 430, y: 150 });
    added = (await edgesOf(page)).slice(base);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ source: sig, target: b });
    expect(await geometry(page, sig)).toMatchObject({ x: 300, y: 300 });
    await page.keyboard.press('ControlOrMeta+z');

    // 4. a new edge dropped on the blank canvas ends where it is released (no jump)
    await connectDrag(page, { x: 220, y: 130 }, { x: 263, y: 227 });
    added = (await edgesOf(page)).slice(base);
    expect(added).toHaveLength(1);
    expect(added[0].target).toBeNull();
    expect(Math.abs(added[0].targetPoint![0] - 263)).toBeLessThanOrEqual(1);
    expect(Math.abs(added[0].targetPoint![1] - 227)).toBeLessThanOrEqual(1);

    // 5. its end handle dropped on B's body (not on a point): connected floating (no entry point)
    const edgeId = added[0].id;
    await inTab(page, 'graph.setSelectionCell(graph.getDataModel().getCell(arg));', edgeId);
    await connectDrag(page, { x: 263, y: 227 }, { x: 433, y: 147 });
    const e = (await edgesOf(page)).find((x) => x.id === edgeId)!;
    expect(e).toMatchObject({ source: a, target: b });
    expect(e.style.entryX ?? null).toBeNull();
    expect(e.style.entryY ?? null).toBeNull();

    // 6. a hover arrow dragged onto the balise connects A -> balise
    await inTab(page, 'graph.clearSelection();');
    const c = await center(page, a);
    await page.mouse.move(c.x - 30, c.y - 25);
    await page.mouse.move(c.x + 5, c.y + 3, { steps: 4 });
    // (the east arrow lies on the A -> B edge and is hidden, like draw.io)
    await expect(page.locator('.rd-hover-arrow[data-direction="south"]')).toBeVisible();
    const arrow = (await page.locator('.rd-hover-arrow[data-direction="south"]').boundingBox())!;
    const target = await center(page, bal);
    await page.mouse.move(arrow.x + arrow.width / 2, arrow.y + arrow.height / 2, { steps: 3 });
    await page.mouse.down();
    await page.mouse.move(target.x, target.y - 20, { steps: 6 });
    await page.mouse.move(target.x, target.y, { steps: 4 });
    await page.mouse.up();
    expect((await edgesOf(page)).some((x) => x.source === a && x.target === bal)).toBe(true);
    expect(errors).toEqual([]);
  });
});
