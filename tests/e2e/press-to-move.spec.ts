/**
 * @file press-to-move.spec.ts
 * @brief Press anywhere on an object and drag: it moves (real mouse, draw.io feel). Regression for
 *        "clicking an object draws an arrow instead of moving it, or it cannot be moved".
 *
 * Every kind of object (draw.io rectangle small/normal, ellipse, text, image, AWS icon,
 * mxgraph.basic stencil, ERTMS signal group, balise, PKP semafor group, turnout, track, connector,
 * template group) is hovered (resting for the hover arrows), pressed over a grid of points incl.
 * near the edges and corners, and dragged 30 px: each press moves the object unless it is exactly
 * on a visible connection point (within SOURCE_POINT_TOLERANCE screen px; a new connection then
 * starts, as in draw.io). Also: a selected shape moves even from a point (draw.io shows no points
 * on a selected cell), a press on a point of an unselected shape still connects, the empty
 * background pans and Shift+drag draws the rubber band. The full 5x5 grid at 100 % / 200 % is
 * tests/e2e/helpers/press-probe.spec.ts (PRESS_PROBE=1).
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { freshApp, inTab, probe, setupSamples, table } from './helpers/press-probe-lib';

test.use({ viewport: { width: 1600, height: 1100 } });

test('a press anywhere inside every kind of object moves it (100 %, small ones at 200 %)', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  const samples = await setupSamples(page);
  const results = await probe(page, samples, 1, [0.06, 0.5, 0.94], [-3, 0, 3]);
  const small = samples.filter((s) => ['rect-small', 'ellipse', 'balise', 'pkp-semafor', 'track'].includes(s.name));
  results.push(...await probe(page, small, 2, [0.06, 0.5, 0.94], [-4, 0, 4]));
  const bad = results.filter((r) => !r.onPoint && r.outcome !== 'moved');
  expect(bad, table(results)).toEqual([]);
  // every kind took part, and most presses are off the points
  expect(new Set(results.map((r) => r.sample)).size).toBe(14);
  expect(results.filter((r) => !r.onPoint).length).toBeGreaterThan(results.length * 0.7);
  expect(errors).toEqual([]);
});

test('connection points: on a point of an unselected shape connects, a selected shape moves; background pans, Shift+drag selects', async ({ page }) => {
  const [rect] = await setupSamples(page, ['rect']);
  const box = await inTab<{ x: number; y: number; w: number; h: number }>(page, `
    const s = graph.view.getState(graph.getDataModel().getCell(arg)); const r = graph.container.getBoundingClientRect();
    return { x: r.left + s.x - graph.container.scrollLeft, y: r.top + s.y - graph.container.scrollTop, w: s.width, h: s.height };`, rect.probeId);
  const edges = () => inTab<number>(page, 'return (graph.getDefaultParent().children || []).filter((c) => c.isEdge()).length;');
  const geo = () => inTab<number[]>(page, 'const g = graph.getDataModel().getCell(arg).getGeometry(); return [g.x, g.y];', rect.probeId);
  // approached from inside the shape (the points show while it is hovered)
  const dragFrom = async (x: number, y: number, mods: string[] = []) => {
    await page.mouse.move(x + 10, y + 12);
    await page.mouse.move(x, y, { steps: 4 });
    await page.waitForTimeout(200);
    for (const m of mods) await page.keyboard.down(m);
    await page.mouse.down();
    await page.mouse.move(x + 15, y + 40, { steps: 3 });
    await page.mouse.move(x + 30, y + 80, { steps: 4 });
    await page.mouse.up();
    for (const m of mods) await page.keyboard.up(m);
  };
  // on the top quarter point of the unselected rectangle: a new edge, the shape stays
  const before = await geo();
  await dragFrom(Math.round(box.x + box.w / 4), Math.round(box.y));
  expect(await edges()).toBe(1);
  expect(await geo()).toEqual(before);
  await page.keyboard.press('ControlOrMeta+z');
  expect(await edges()).toBe(0);
  // 2 px inside the edge there, and 5 px beside it: moves
  await inTab(page, 'graph.clearSelection();');
  await dragFrom(Math.round(box.x + box.w / 4), Math.round(box.y) + 2);
  expect(await edges()).toBe(0);
  expect(await geo()).not.toEqual(before);
  await page.keyboard.press('ControlOrMeta+z');
  expect(await geo()).toEqual(before);
  await inTab(page, 'graph.clearSelection();');
  await dragFrom(box.x + box.w / 4 + 5, box.y + 5);
  expect(await edges()).toBe(0);
  expect(await geo()).not.toEqual(before);
  await page.keyboard.press('ControlOrMeta+z');
  // selected: the same point moves the shape (no points on a selected cell, like draw.io)
  await inTab(page, 'graph.setSelectionCell(graph.getDataModel().getCell(arg));', rect.probeId);
  await dragFrom(Math.round(box.x + box.w / 4), Math.round(box.y));
  expect(await edges()).toBe(0);
  expect(await geo()).not.toEqual(before);
  await page.keyboard.press('ControlOrMeta+z');
  // the empty background pans; Shift+drag there draws the rubber band (selects the shape)
  await inTab(page, 'graph.clearSelection();');
  const scroll = () => inTab<number[]>(page, 'return [graph.container.scrollLeft, graph.container.scrollTop];');
  const s0 = await scroll();
  await dragFrom(box.x + box.w + 120, box.y + box.h + 120);
  expect(await scroll()).not.toEqual(s0);
  expect(await geo()).toEqual(before);
  const b2 = await inTab<{ x: number; y: number }>(page, `
    const s = graph.view.getState(graph.getDataModel().getCell(arg)); const r = graph.container.getBoundingClientRect();
    return { x: r.left + s.x - graph.container.scrollLeft, y: r.top + s.y - graph.container.scrollTop };`, rect.probeId);
  await page.mouse.move(b2.x - 20, b2.y - 20);
  await page.keyboard.down('Shift');
  await page.mouse.down();
  await page.mouse.move(b2.x + box.w + 20, b2.y + box.h + 20, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
  expect(await inTab<string[]>(page, 'return graph.getSelectionCells().map((c) => c.id);')).toEqual([rect.probeId]);
  expect(await geo()).toEqual(before);
});

/** Page point of graph-view point (x, y) (state coordinates). */
async function pagePt(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  return inTab(page, 'const r = graph.container.getBoundingClientRect(); return { x: r.left + arg.x - graph.container.scrollLeft, y: r.top + arg.y - graph.container.scrollTop };', { x, y });
}

/** Hover, press, drag (dx, dy) in steps, release (optional modifier held throughout). */
async function drag(page: Page, p: { x: number; y: number }, dx: number, dy: number, mod?: string): Promise<void> {
  await page.mouse.move(p.x + 6, p.y + 6);
  await page.mouse.move(p.x, p.y, { steps: 3 });
  await page.waitForTimeout(180);
  if (mod) await page.keyboard.down(mod);
  await page.mouse.down();
  await page.mouse.move(p.x + dx / 3, p.y + dy / 3, { steps: 3 });
  await page.mouse.move(p.x + dx, p.y + dy, { steps: 5 });
  await page.mouse.up();
  if (mod) await page.keyboard.up(mod);
}

const geoOf = (page: Page, id: string): Promise<number[]> => inTab<number[]>(page, `
  const c = graph.getDataModel().getCell(arg); const g = c.getGeometry();
  return c.isEdge() ? [g.sourcePoint.x, g.sourcePoint.y, g.targetPoint.x, g.targetPoint.y] : [g.x, g.y, g.width, g.height];`, id);
const selection = (page: Page): Promise<string[]> => inTab<string[]>(page, 'return graph.getSelectionCells().map((c) => c.id).sort();');

test('selection: Shift+click toggles like Ctrl/Cmd; Alt+click selects the cell behind (cycling)', async ({ page }) => {
  await freshApp(page);
  const [a, b] = await inTab<string[]>(page, `
    const p = graph.getDefaultParent();
    const a = graph.insertVertex(p, null, 'A', 100, 100, 120, 80, 'rounded=0;whiteSpace=wrap;html=1;');
    const b = graph.insertVertex(p, null, 'B', 160, 130, 120, 80, 'rounded=0;whiteSpace=wrap;html=1;fillColor=#dae8fc;');
    graph.clearSelection(); return [a.id, b.id];`);
  const centre = async (id: string) => inTab<{ x: number; y: number }>(page, 'const s = graph.view.getState(graph.getDataModel().getCell(arg)); return { x: s.getCenterX(), y: s.getCenterY() };', id);
  const ca = await pagePt(page, (await centre(a)).x - 30, (await centre(a)).y - 20);
  const cb = await pagePt(page, (await centre(b)).x + 30, (await centre(b)).y + 20);
  await page.mouse.click(ca.x, ca.y);
  expect(await selection(page)).toEqual([a]);
  await page.keyboard.down('Shift');
  await page.mouse.click(cb.x, cb.y);
  expect(await selection(page)).toEqual([a, b].sort());
  await page.mouse.click(ca.x, ca.y);
  await page.keyboard.up('Shift');
  expect(await selection(page)).toEqual([b]);
  // the overlap: B on top; Alt+click -> A behind it; again -> back to B
  const ov = await pagePt(page, (await centre(a)).x + 20, (await centre(a)).y + 20);
  await inTab(page, 'graph.clearSelection();');
  await page.mouse.click(ov.x, ov.y);
  expect(await selection(page)).toEqual([b]);
  const altClick = async () => {
    await page.keyboard.down('Alt');
    await page.mouse.click(ov.x, ov.y);
    await page.keyboard.up('Alt');
  };
  await altClick();
  expect(await selection(page)).toEqual([a]);
  await altClick();
  expect(await selection(page)).toEqual([b]);
});

test('railway objects: a selected small symbol moves (no resize) from its body; a signal beside a track moves itself; members follow', async ({ page }) => {
  const samples = await setupSamples(page, ['balise', 'pkp-semafor', 'track', 'turnout']);
  const by = (n: string) => samples.find((s) => s.name === n)!;
  // selected small symbols: a press on the body moves, the size stays (only the bottom-right sizer, outside)
  for (const name of ['balise', 'pkp-semafor']) {
    const id = by(name).probeId;
    await inTab(page, 'graph.setSelectionCell(graph.getDataModel().getCell(arg));', id);
    const g0 = await geoOf(page, id);
    const c = await inTab<{ x: number; y: number }>(page, 'const s = graph.view.getState(graph.getDataModel().getCell(arg)); return { x: s.getCenterX(), y: s.getCenterY() };', id);
    await drag(page, await pagePt(page, c.x, c.y), 30, 20);
    const g1 = await geoOf(page, id);
    expect(g1.slice(2), `${name} size`).toEqual(g0.slice(2));
    expect(g1.slice(0, 2), `${name} moved`).not.toEqual(g0.slice(0, 2));
    await page.keyboard.press('Escape');
  }
  // a signal whose centre lies in the track's hit halo (4 px from the line): the signal moves
  const trk = by('track').probeId;
  const sig = await inTab<string>(page, `
    const m = graph.getDataModel(); const t = m.getCell(arg); const g = t.getGeometry();
    const v = graph.insertVertex(graph.getDefaultParent(), null, '', g.sourcePoint.x + 60, g.sourcePoint.y + 4 - 13, 42, 26, 'group;');
    const doc = document.implementation.createDocument(null, null, null); const o = doc.createElement('object'); o.setAttribute('rdKind', 'signal'); o.setAttribute('label', '');
    m.setValue(v, o);
    graph.insertVertex(v, null, '', 0, 0, 10, 26, 'rounded=0;');
    graph.clearSelection(); return v.id;`, trk);
  const sg0 = await geoOf(page, sig);
  const t0 = await geoOf(page, trk);
  const sc = await inTab<{ x: number; y: number }>(page, 'const s = graph.view.getState(graph.getDataModel().getCell(arg)); return { x: s.getCenterX(), y: s.getCenterY() };', sig);
  await drag(page, await pagePt(page, sc.x, sc.y), 0, -60);
  expect(await geoOf(page, trk)).toEqual(t0);
  expect(await geoOf(page, sig)).not.toEqual(sg0);
  // a turnout's points leg moves with its track
  const turnout = by('turnout');
  const track = turnout.ids.find((i) => i !== turnout.probeId)!;
  const leg0 = await geoOf(page, turnout.probeId);
  const tr = await inTab<{ x: number; y: number }>(page, 'const s = graph.view.getState(graph.getDataModel().getCell(arg)); const p = s.absolutePoints; return { x: p[0].x + (p[p.length - 1].x - p[0].x) * 0.9, y: p[0].y + (p[p.length - 1].y - p[0].y) * 0.9 };', track);
  await drag(page, await pagePt(page, tr.x, tr.y), 20, 40);
  const leg1 = await geoOf(page, turnout.probeId);
  expect(leg1[1] - leg0[1], 'leg followed the track').toBeGreaterThan(20);
});
