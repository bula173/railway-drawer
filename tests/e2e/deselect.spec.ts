/**
 * @file deselect.spec.ts
 * @brief Deselecting with the real mouse and keyboard (regression for "after clicking an object it gets selected,
 *        but then I can't deselect it, especially when I edit text"). Light theme, 100 % zoom.
 *
 * For a draw.io rectangle, a text label, an ERTMS signal (group), a track (edge) and a template group: click the
 * object, then a click on the empty canvas or Escape clears the selection. Editing (draw.io rules): a click on the
 * empty canvas while a label / ID editor is open stops the editor (committing the text) and keeps the edited cell
 * selected, a second click deselects; Escape in the editor cancels it; after Enter / Escape a click deselects; a
 * click on another object while editing selects that object. A Properties / Data panel field: a click on the
 * canvas blurs it and deselects; Escape in the field blurs it, a second Escape clears the selection. A click in a
 * group's gap selects the group (press-to-move), a click in the scroll padding outside the drawing or near the
 * canvas edge deselects, a pan drag keeps the selection (a sub-tolerance jitter is still a click), and the
 * multi-selection box (> 10 cells) lets background clicks through.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { inTab, setupSamples } from './helpers/press-probe-lib';
import type { Sample } from './helpers/press-probe-lib';

test.use({ viewport: { width: 1600, height: 1100 }, colorScheme: 'light' });

interface Pt { x: number; y: number }
interface Row { scenario: string; expected: string; actual: string }

const count = (page: Page): Promise<number> => inTab<number>(page, 'return graph.getSelectionCount();');
const selected = (page: Page): Promise<string[]> => inTab<string[]>(page, 'return graph.getSelectionCells().map((c) => c.id).sort();');

/** Which editor is open: 'label' (inline textarea), 'id' (railway ID field), 'mx' (maxGraph cell editor) or ''. */
const editing = (page: Page): Promise<string> => inTab<string>(page, `
  if (graph.isEditing()) return 'mx';
  if (document.querySelector('.rd-id-editor')) return 'id';
  if (tab.textEditorController.editingInput) return 'label';
  return '';`);

/** Client point of graph (view) point (x, y) of the active tab. */
const clientOfView = (page: Page, x: number, y: number): Promise<Pt> => inTab<Pt>(page, `
  const c = graph.container; const r = c.getBoundingClientRect();
  return { x: Math.round(r.left + c.clientLeft + arg.x - c.scrollLeft), y: Math.round(r.top + c.clientTop + arg.y - c.scrollTop) };`, { x, y });

/** Client centre of a cell. */
const centerOf = (page: Page, id: string): Promise<Pt> => inTab<Pt>(page, `
  const s = graph.view.getState(graph.getDataModel().getCell(arg)); const c = graph.container; const r = c.getBoundingClientRect();
  return { x: Math.round(r.left + c.clientLeft + s.getCenterX() - c.scrollLeft), y: Math.round(r.top + c.clientTop + s.getCenterY() - c.scrollTop) };`, id);

/** A client point on the empty canvas inside the drawing's bounds (no cell within 30 px). */
async function emptyInside(page: Page): Promise<Pt> {
  const v = await inTab<Pt>(page, `
    const b = graph.view.getGraphBounds(); const free = (x, y) => {
      for (const s of graph.view.getStates().getValues()) {
        if (!s.cell || !s.cell.parent || !s.cell.parent.parent) continue;
        if (x > s.x - 30 && x < s.x + s.width + 30 && y > s.y - 30 && y < s.y + s.height + 30) return false;
      }
      return true; };
    for (let y = b.y + 40; y < b.y + b.height - 40; y += 10) for (let x = b.x + 40; x < b.x + b.width - 40; x += 10) if (free(x, y)) return { x, y };
    throw new Error('no empty point inside the drawing');`);
  return clientOfView(page, v.x, v.y);
}

/** A client point in the scroll padding right of / below the drawing (outside its bounds). */
async function emptyOutside(page: Page): Promise<Pt> {
  return inTab<Pt>(page, `
    const c = graph.container; const r = c.getBoundingClientRect(); const b = graph.view.getGraphBounds();
    const x = Math.min(r.left + c.clientLeft + c.clientWidth - 40, r.left + c.clientLeft + b.x + b.width - c.scrollLeft + 150);
    return { x: Math.round(x), y: Math.round(r.top + c.clientTop + c.clientHeight - 40) };`);
}

/** A client point 6 px inside the canvas' top-left visible corner (scroll padding). */
const nearEdge = (page: Page): Promise<Pt> => inTab<Pt>(page, `
  const c = graph.container; const r = c.getBoundingClientRect();
  return { x: Math.round(r.left + c.clientLeft + 6), y: Math.round(r.top + c.clientTop + 6) };`);

async function click(page: Page, p: Pt): Promise<void> {
  await page.mouse.move(p.x, p.y, { steps: 2 });
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(60);
}

async function dblclick(page: Page, p: Pt): Promise<void> {
  await page.mouse.move(p.x, p.y, { steps: 2 });
  await page.mouse.dblclick(p.x, p.y);
  await page.waitForTimeout(80);
}

async function clearAll(page: Page): Promise<void> {
  await inTab(page, 'tab.textEditorController.cancelEditing(); tab.textEditorController.cancelIdEditing(); if (graph.isEditing()) graph.stopEditing(true); graph.clearSelection();');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
  await page.mouse.move(5, 5);
}

/** Runs the scenarios, collecting rows; the test fails listing every row that differs. */
class Table {
  rows: Row[] = [];
  async check(scenario: string, expected: string, actual: () => Promise<string>): Promise<void> {
    let got = '';
    // the app settles within a frame or two; poll briefly before recording
    const deadline = Date.now() + 1500;
    for (;;) {
      got = await actual();
      if (got === expected || Date.now() > deadline) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    this.rows.push({ scenario, expected, actual: got });
  }
  bad(): Row[] { return this.rows.filter((r) => r.expected !== r.actual); }
  text(): string { return this.rows.map((r) => `${r.expected === r.actual ? 'ok  ' : 'FAIL'} ${r.scenario}: expected ${r.expected}, got ${r.actual}`).join('\n'); }
}

const state = async (page: Page): Promise<string> => `sel=${await count(page)} edit=${(await editing(page)) || 'none'}`;

let samples: Sample[] = [];
const sample = (name: string): Sample => samples.find((s) => s.name === name)!;

test('click / Escape deselect every kind of object', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  samples = await setupSamples(page, ['rect', 'text', 'ertms-signal', 'track', 'template-group']);
  expect(await inTab<number>(page, 'return graph.view.scale;')).toBe(1);
  const t = new Table();
  const empty = await emptyInside(page);
  for (const s of samples) {
    const at = await centerOf(page, s.probeId);
    await clearAll(page);
    await click(page, at);
    await t.check(`${s.name}: click selects`, 'sel=1 edit=none', () => state(page));
    await click(page, empty);
    await t.check(`${s.name}: click empty canvas deselects`, 'sel=0 edit=none', () => state(page));
    await click(page, at);
    await page.keyboard.press('Escape');
    await t.check(`${s.name}: Escape deselects`, 'sel=0 edit=none', () => state(page));
    // a sub-tolerance jitter (3 px) is still a click
    await click(page, at);
    await page.mouse.move(empty.x, empty.y, { steps: 2 });
    await page.mouse.down();
    await page.mouse.move(empty.x + 2, empty.y + 2);
    await page.mouse.move(empty.x + 3, empty.y + 2);
    await page.mouse.up();
    await t.check(`${s.name}: click with 3 px jitter deselects`, 'sel=0 edit=none', () => state(page));
  }
  console.log(t.text());
  expect(t.bad(), t.text()).toEqual([]);
  expect(errors).toEqual([]);
});

test('editing: a click on the canvas stops the editor first, the next click deselects', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  samples = await setupSamples(page, ['rect', 'text', 'ertms-signal', 'track']);
  const t = new Table();
  const empty = await emptyInside(page);
  const label = (id: string): Promise<string> => inTab<string>(page, 'return graph.convertValueToString(graph.getDataModel().getCell(arg));', id);
  for (const name of ['rect', 'text']) {
    const s = sample(name);
    const at = await centerOf(page, s.probeId);
    // double-click, type, click the empty canvas: committed, still selected; second click deselects
    await clearAll(page);
    await dblclick(page, at);
    await t.check(`${name}: double-click opens the label editor`, 'sel=1 edit=label', () => state(page));
    await page.keyboard.type(`Hello ${name}`);
    await click(page, empty);
    await t.check(`${name}: edit + click empty stops editing, keeps the selection`, 'sel=1 edit=none', () => state(page));
    await t.check(`${name}: the typed label is committed`, `Hello ${name}`, () => label(s.probeId));
    await click(page, empty);
    await t.check(`${name}: second click empty deselects`, 'sel=0 edit=none', () => state(page));
    // Escape cancels the edit; a click then deselects; Escape again with the selection clears it
    await dblclick(page, at);
    await page.keyboard.type('discarded');
    await page.keyboard.press('Escape');
    await t.check(`${name}: Escape in the editor cancels it`, 'sel=1 edit=none', () => state(page));
    await t.check(`${name}: Escape keeps the old label`, `Hello ${name}`, () => label(s.probeId));
    await click(page, empty);
    await t.check(`${name}: after Escape a click empty deselects`, 'sel=0 edit=none', () => state(page));
    await dblclick(page, at);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await t.check(`${name}: Escape (editor), Escape (selection) deselects`, 'sel=0 edit=none', () => state(page));
    // Enter (newline in the label editor), then Ctrl/Cmd+Enter stops editing; a click deselects
    await dblclick(page, at);
    await page.keyboard.press('ControlOrMeta+Enter');
    await t.check(`${name}: Ctrl/Cmd+Enter stops editing`, 'sel=1 edit=none', () => state(page));
    await click(page, empty);
    await t.check(`${name}: after Ctrl+Enter a click empty deselects`, 'sel=0 edit=none', () => state(page));
  }
  // editing, then a click on another object: the selection moves there
  {
    const rect = sample('rect');
    const other = sample('ertms-signal');
    await clearAll(page);
    await dblclick(page, await centerOf(page, rect.probeId));
    await page.keyboard.type('Moved');
    await click(page, await centerOf(page, other.probeId));
    await t.check('rect: edit + click another object selects it', `sel=1 edit=none ${other.probeId}`, async () => `${await state(page)} ${(await selected(page)).join(',')}`);
    await t.check('rect: that edit is committed', 'Moved', () => label(rect.probeId));
  }
  // railway objects: the ID editor
  for (const name of ['ertms-signal', 'track']) {
    const s = sample(name);
    const at = await centerOf(page, s.probeId);
    await clearAll(page);
    await dblclick(page, at);
    await t.check(`${name}: double-click opens the ID editor`, 'sel=1 edit=id', () => state(page));
    await page.getByTestId('rd-id-editor').fill(`${name === 'track' ? 'T' : 'S'}77`);
    await page.keyboard.press('Enter');
    await t.check(`${name}: ID editor Enter commits, keeps the selection`, 'sel=1 edit=none', () => state(page));
    await click(page, empty);
    await t.check(`${name}: after Enter a click empty deselects`, 'sel=0 edit=none', () => state(page));
    await dblclick(page, at);
    await page.getByTestId('rd-id-editor').fill(`${name === 'track' ? 'T' : 'S'}78`);
    await click(page, empty);
    await t.check(`${name}: ID edit + click empty commits, keeps the selection`, 'sel=1 edit=none', () => state(page));
    await click(page, empty);
    await t.check(`${name}: second click empty deselects`, 'sel=0 edit=none', () => state(page));
    await dblclick(page, at);
    await page.keyboard.press('Escape');
    await t.check(`${name}: Escape in the ID editor cancels it`, 'sel=1 edit=none', () => state(page));
    await page.keyboard.press('Escape');
    await t.check(`${name}: second Escape deselects`, 'sel=0 edit=none', () => state(page));
  }
  console.log(t.text());
  expect(t.bad(), t.text()).toEqual([]);
  expect(errors).toEqual([]);
});

test('panel fields, group gaps, scroll padding, pan drags and the multi-selection box', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  samples = await setupSamples(page, ['rect', 'ertms-signal', 'template-group']);
  const t = new Table();
  const empty = await emptyInside(page);
  const rect = await centerOf(page, sample('rect').probeId);
  const signal = await centerOf(page, sample('ertms-signal').probeId);
  const focusIn = (): Promise<string> => page.evaluate(() => {
    const a = document.activeElement;
    return a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement ? 'input' : 'canvas';
  });

  // Properties panel text field
  await clearAll(page);
  await click(page, rect);
  const prop = page.locator('#prop-fillColorText');
  await prop.click();
  await prop.fill('#ffcc00');
  await click(page, empty);
  await t.check('properties field + click empty deselects', 'sel=0 edit=none canvas', async () => `${await state(page)} ${await focusIn()}`);
  await click(page, rect);
  await prop.click();
  await page.keyboard.press('Escape');
  await t.check('properties field: Escape blurs it, keeps the selection', 'sel=1 edit=none canvas', async () => `${await state(page)} ${await focusIn()}`);
  await page.keyboard.press('Escape');
  await t.check('properties field: second Escape deselects', 'sel=0 edit=none', () => state(page));

  // Data panel field (Shift+double-click opens it)
  await clearAll(page);
  await page.keyboard.down('Shift');
  await dblclick(page, signal);
  await page.keyboard.up('Shift');
  const notes = page.locator('#railway-data-panel [data-field="notes"]');
  await notes.click();
  await notes.fill('Note');
  await click(page, empty);
  await t.check('data field + click empty deselects', 'sel=0 edit=none canvas', async () => `${await state(page)} ${await focusIn()}`);
  await click(page, signal);
  await notes.click();
  await page.keyboard.press('Escape');
  await t.check('data field: Escape blurs it, keeps the selection', 'sel=1 edit=none canvas', async () => `${await state(page)} ${await focusIn()}`);
  await page.keyboard.press('Escape');
  await t.check('data field: second Escape deselects', 'sel=0 edit=none', () => state(page));

  // a draw.io group's gap (two shapes 120 px apart, group style paints nothing): a click there selects the group
  // (press-to-move), a click on the empty canvas deselects
  const grp = await inTab<{ id: string; gap: Pt }>(page, `
    const p = graph.getDefaultParent(); const b = graph.view.getGraphBounds(); const s = graph.view.scale, tr = graph.view.translate;
    const x0 = b.x / s - tr.x, y0 = (b.y + b.height) / s - tr.y + 80;
    const a = graph.insertVertex(p, null, '', x0, y0, 40, 40, 'rounded=0;whiteSpace=wrap;html=1;');
    const z = graph.insertVertex(p, null, '', x0 + 160, y0 + 60, 40, 40, 'rounded=0;whiteSpace=wrap;html=1;');
    const g = graph.groupCells(null, 0, [a, z]); graph.getDataModel().setStyle(g, 'group');
    graph.clearSelection(); graph.scrollCellToVisible(g);
    const gs = graph.view.getState(g); const c = graph.container; const r = c.getBoundingClientRect();
    return { id: g.id, gap: { x: Math.round(r.left + c.clientLeft + gs.x + gs.width / 2 - c.scrollLeft), y: Math.round(r.top + c.clientTop + gs.y + gs.height / 2 - c.scrollTop) } };`);
  await clearAll(page);
  await click(page, grp.gap);
  await t.check('group gap click selects the group', `sel=1 ${grp.id}`, async () => `sel=${await count(page)} ${(await selected(page)).join(',')}`);
  await click(page, await emptyOutside(page));
  await t.check('group selected, click empty deselects', 'sel=0 edit=none', () => state(page));

  // the scroll padding outside the drawing, and near the canvas edge
  for (const [name, at] of [['scroll padding outside the drawing', await emptyOutside(page)], ['near the canvas edge', await nearEdge(page)]] as const) {
    await clearAll(page);
    await click(page, rect);
    await click(page, at);
    await t.check(`click ${name} deselects`, 'sel=0 edit=none', () => state(page));
    await dblclick(page, rect);
    await page.keyboard.type('Edge');
    await click(page, at);
    await t.check(`edit + click ${name} stops editing, keeps the selection`, 'sel=1 edit=none', () => state(page));
    await click(page, at);
    await t.check(`edit + second click ${name} deselects`, 'sel=0 edit=none', () => state(page));
  }

  // a pan drag keeps the selection; the next click deselects
  await clearAll(page);
  await click(page, rect);
  await page.mouse.move(empty.x, empty.y);
  await page.mouse.down();
  await page.mouse.move(empty.x + 30, empty.y + 20, { steps: 4 });
  await page.mouse.move(empty.x + 60, empty.y + 40, { steps: 4 });
  await page.mouse.up();
  await t.check('pan drag keeps the selection', 'sel=1 edit=none', () => state(page));
  await click(page, await emptyInside(page));
  await t.check('after a pan a click empty deselects', 'sel=0 edit=none', () => state(page));

  // more than 10 selected cells: one selection box; a click on the empty canvas inside it deselects
  const ids = await inTab<string[]>(page, `
    const p = graph.getDefaultParent(); const b = graph.view.getGraphBounds(); const s = graph.view.scale, tr = graph.view.translate;
    const x0 = (b.x + b.width) / s - tr.x + 120, y0 = b.y / s - tr.y; const out = [];
    for (let i = 0; i < 12; i++) out.push(graph.insertVertex(p, null, '', x0 + (i % 4) * 90, y0 + Math.floor(i / 4) * 90, 40, 40, 'rounded=0;whiteSpace=wrap;html=1;').id);
    graph.clearSelection(); return out;`);
  const inBox = await inTab<Pt>(page, `
    const m = graph.getDataModel(); const a = graph.view.getState(m.getCell(arg[0])); const b = graph.view.getState(m.getCell(arg[5]));
    const c = graph.container; const r = c.getBoundingClientRect();
    return { x: Math.round(r.left + c.clientLeft + (a.x + a.width + b.x) / 2 - c.scrollLeft), y: Math.round(r.top + c.clientTop + (a.y + a.height + b.y) / 2 - c.scrollTop) };`, ids);
  const selectGrid = async () => {
    // rubber band (Shift+drag) around the grid
    const first = await centerOf(page, ids[0]);
    const last = await centerOf(page, ids[11]);
    await page.mouse.move(first.x - 40, first.y - 40);
    await page.keyboard.down('Shift');
    await page.mouse.down();
    await page.mouse.move(last.x + 40, last.y + 40, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.up('Shift');
  };
  await clearAll(page);
  await selectGrid();
  await t.check('rubber band selects 12 cells (one selection box)', 'sel=12 box=1', async () => `sel=${await count(page)} box=${await page.locator('.rd-multi-selection-box').count()}`);
  await click(page, inBox);
  await t.check('click empty inside the selection box deselects', 'sel=0 box=0', async () => `sel=${await count(page)} box=${await page.locator('.rd-multi-selection-box').count()}`);
  await selectGrid();
  await click(page, empty);
  await t.check('click empty outside the selection box deselects', 'sel=0 edit=none', () => state(page));
  await selectGrid();
  await page.keyboard.press('Escape');
  await t.check('selection box: Escape deselects', 'sel=0 edit=none', () => state(page));

  console.log(t.text());
  expect(t.bad(), t.text()).toEqual([]);
  expect(errors).toEqual([]);
});
