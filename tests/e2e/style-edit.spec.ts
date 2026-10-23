/**
 * @file style-edit.spec.ts
 * @brief Bug "I cannot edit i.e. line color when I take drawing from template": line color, fill,
 *        stroke width and dash edits through the properties panel on cells inserted from an ERTMS
 *        template, a user template and the draw.io / ERTMS palettes.
 *
 * Checks the cell's own style in the model (only the edited keys change: `none` values, base
 * style names and the other draw.io keys stay) and the rendered SVG. Cells inside groups are
 * reached like in draw.io: the first click selects the group, the next click the child.
 *
 * The graph is read through the dev server's module graph (`import('/src/...')` returns the
 * module instance the app uses); Playwright always runs against `vite` (playwright.config.ts).
 * Runs on any port.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { autosaveText } from './autosave-cache';
import { openLeftTab } from './menu-helpers';

/** Runs `body` (function body text) with `graph` = the active tab's graph and `arg`. */
async function inGraph<T>(page: Page, body: string, arg?: unknown): Promise<T> {
  return page.evaluate(async ({ body, arg }) => {
    const registry = await import('/src/services/service-registry.ts' as string);
    const graph = registry.ServiceRegistry.getTabManager().getActiveTab().graph;
    return new Function('graph', 'arg', body)(graph, arg);
  }, { body, arg }) as Promise<T>;
}

/** Shared helpers defined in the page: point where a cell is hit, style/SVG of a cell. */
const PAGE_HELPERS = `
  const model = graph.getDataModel();
  const cellById = (id) => model.getCell(id);
  const ancestors = (cell) => { const out = []; for (let p = cell.parent; p; p = p.parent) out.push(p); return out; };
  // a page point where graph.getCellAt hits exactly this cell, away from the selection handles of
  // its top-level ancestor
  const hitPoint = (cell) => {
    const top = ancestors(cell).filter((a) => a.isVertex()).pop();
    graph.scrollCellToVisible(top || cell, true);
    const s = graph.view.getState(cell);
    if (!s) return null;
    const ts = top ? graph.view.getState(top) : null;
    const pts = [];
    if (cell.isEdge()) {
      const p = s.absolutePoints;
      for (let i = 0; i + 1 < p.length; i++) for (let t = 0.1; t < 0.95; t += 0.05) pts.push([p[i].x + (p[i + 1].x - p[i].x) * t, p[i].y + (p[i + 1].y - p[i].y) * t]);
    } else {
      for (let tx = 0.2; tx < 0.85; tx += 0.1) for (let ty = 0.2; ty < 0.85; ty += 0.1) pts.push([s.x + s.width * tx, s.y + s.height * ty]);
    }
    const r = graph.container.getBoundingClientRect();
    // connection points: a click there starts the connection handler, which selects the cell
    // itself (no group propagation)
    const constraints = cell.isVertex() ? (graph.getAllConnectionConstraints(s, true) || []) : [];
    const cps = constraints.map((c) => graph.getConnectionPoint(s, c)).filter(Boolean);
    const nodes = [s.shape && s.shape.node, s.text && s.text.node].filter(Boolean);
    for (const [x, y] of pts) {
      if (graph.getCellAt(x, y) !== cell) continue;
      if (cps.some((p) => Math.abs(p.x - x) < 12 && Math.abs(p.y - y) < 12)) continue;
      const el = document.elementFromPoint(r.left + x - graph.container.scrollLeft, r.top + y - graph.container.scrollTop);
      if (!el || !nodes.some((n) => n.contains(el))) continue;
      if (ts && (x - ts.x < 10 || ts.x + ts.width - x < 10 || y - ts.y < 10 || ts.y + ts.height - y < 10)) continue;
      if (x - graph.container.scrollLeft < 5 || y - graph.container.scrollTop < 5) continue;
      if (x - graph.container.scrollLeft > graph.container.clientWidth - 5 || y - graph.container.scrollTop > graph.container.clientHeight - 5) continue;
      return { x: r.left + x - graph.container.scrollLeft, y: r.top + y - graph.container.scrollTop };
    }
    return null;
  };
  const ownStyle = (cell) => JSON.parse(JSON.stringify(cell.getStyle() || {}));
  // the stroke/fill painted by the cell's shape (edges: the visible path; vertices: the first
  // painted element)
  const painted = (cell) => {
    const node = graph.view.getState(cell)?.shape?.node;
    if (!node) return null;
    const els = [...node.querySelectorAll('path, rect, ellipse, polygon, polyline')].filter((e) => e.getAttribute('visibility') !== 'hidden');
    return els.map((e) => ({ tag: e.tagName, stroke: e.getAttribute('stroke'), fill: e.getAttribute('fill'), width: e.getAttribute('stroke-width'), dash: e.getAttribute('stroke-dasharray') }));
  };
`;

interface Painted { tag: string; stroke: string | null; fill: string | null; width: string | null; dash: string | null }

function helpers(body: string): string {
  return PAGE_HELPERS + body;
}

async function freshApp(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
}

async function selectionIds(page: Page): Promise<string[]> {
  return inGraph<string[]>(page, 'return graph.getSelectionCells().map((c) => c.id);');
}

async function ownStyleOf(page: Page, id: string): Promise<Record<string, unknown>> {
  return inGraph(page, helpers('return ownStyle(cellById(arg));'), id);
}

async function paintedOf(page: Page, id: string): Promise<Painted[]> {
  return inGraph(page, helpers('return painted(cellById(arg));'), id);
}

/** Clicks the cell like a user: repeated clicks go one group level deeper (draw.io). */
async function clickCell(page: Page, id: string): Promise<void> {
  const at = await inGraph<{ x: number; y: number } | null>(page, helpers('return hitPoint(cellById(arg));'), id);
  expect(at, `no clickable point for cell ${id}`).not.toBeNull();
  for (let i = 0; i < 6; i++) {
    await page.mouse.click(at!.x, at!.y);
    if ((await selectionIds(page)).join() === id) return;
    await page.waitForTimeout(350); // not a double click
  }
  expect(await selectionIds(page)).toEqual([id]);
}

async function openStyleTab(page: Page): Promise<void> {
  await page.locator('.prop-tab[data-tab="style"]').click();
}

async function setNumber(page: Page, selector: string, value: string): Promise<void> {
  await page.locator(selector).fill(value);
  await page.locator(selector).dispatchEvent('change');
}

/** Line color, width and dash through the Style tab; asserts model and SVG. */
async function editLine(page: Page, id: string, color: string): Promise<void> {
  await openStyleTab(page);
  await page.locator('#prop-strokeColor').fill(color);
  await expect.poll(async () => (await ownStyleOf(page, id)).strokeColor).toBe(color);
  await setNumber(page, '#prop-strokeWidth', '3');
  await expect.poll(async () => (await ownStyleOf(page, id)).strokeWidth).toBe(3);
  await page.locator('#prop-lineStyle').selectOption('dashed');
  await expect.poll(async () => (await ownStyleOf(page, id)).dashed).toBe(1);
  const painted = await paintedOf(page, id);
  const line = painted.find((p) => p.stroke === color);
  expect(line, JSON.stringify(painted)).toBeTruthy();
  const scale = await inGraph<number>(page, 'return graph.view.scale;');
  expect(Number(line!.width)).toBeCloseTo(3 * scale, 5);
  expect(line!.dash).toBeTruthy();
}

test.describe('style edits on inserted templates and palette shapes', () => {
  test('ERTMS template: line color/width/dash of a line, fill and line of a shape inside a group', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await freshApp(page);

    await openLeftTab(page, 'templates');
    await page.locator('#templates-panel [data-section="builtin"] .rd-tpl-tile').first().click();
    await page.locator('.rd-tpl-popover [data-action="insert"]').click();
    await expect.poll(async () => (await selectionIds(page)).length).toBeGreaterThan(10);
    await inGraph(page, 'graph.clearSelection(); graph.zoomTo(2);');

    // A top-level line (edge) of the template: light-dark() color, endArrow=none
    const edge = await inGraph<{ id: string; style: Record<string, unknown> } | null>(page, helpers(`
      for (const c of graph.getDefaultParent().children) {
        if (c.isEdge() && String(c.style.strokeColor).startsWith('light-dark') && c.style.endArrow === 'none' && hitPoint(c)) return { id: c.id, style: ownStyle(c) };
      }
      return null;`));
    expect(edge).not.toBeNull();
    await clickCell(page, edge!.id);

    // The panels show the drawn color (light side of light-dark())
    await openStyleTab(page);
    const shown = await page.locator('#prop-strokeColor').inputValue();
    expect(shown).toMatch(/^#[0-9a-f]{6}$/);
    expect(String(edge!.style.strokeColor).toLowerCase()).toContain(shown);
    await expect(page.locator('#edge-line-color')).toHaveValue(shown);
    await expect(page.locator('#edge-target-arrow')).toHaveValue('none');

    await editLine(page, edge!.id, '#ff0000');
    const edited = await ownStyleOf(page, edge!.id);
    // only the edited keys changed: no arrow heads, edgeStyle and the other keys kept
    expect(edited).toEqual({ ...edge!.style, strokeColor: '#ff0000', strokeWidth: 3, dashed: 1 });
    const painted = await paintedOf(page, edge!.id);
    expect(painted.filter((p) => p.tag === 'path' && p.fill === '#ff0000'), 'no arrow head').toHaveLength(0);

    // the connector panel edits the same key
    await page.locator('#edge-line-color').fill('#00aa00');
    await expect.poll(async () => (await ownStyleOf(page, edge!.id)).strokeColor).toBe('#00aa00');
    expect((await paintedOf(page, edge!.id)).some((p) => p.stroke === '#00aa00')).toBe(true);
    expect((await ownStyleOf(page, edge!.id)).endArrow).toBe('none');

    // undo restores the template's light-dark() color (shortcuts are ignored while a field has focus)
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('ControlOrMeta+z');
    await page.keyboard.press('ControlOrMeta+z');
    await page.keyboard.press('ControlOrMeta+z');
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => (await ownStyleOf(page, edge!.id)).strokeColor).toBe(edge!.style.strokeColor);

    // A shape inside a group: first click selects the group, the next one the child
    const child = await inGraph<{ id: string; group: string; style: Record<string, unknown> } | null>(page, helpers(`
      let best = null;
      for (const g of graph.getDefaultParent().children) {
        if (!g.isVertex() || !(g.style.baseStyleNames || []).includes('group')) continue;
        for (const k of g.children || []) {
          if (!k.isVertex() || !hitPoint(k)) continue;
          const s = graph.view.getState(g);
          if (!best || s.width * s.height > best.area) best = { area: s.width * s.height, id: k.id, group: g.id, style: ownStyle(k) };
        }
      }
      return best;`));
    expect(child).not.toBeNull();
    const at = await inGraph<{ x: number; y: number }>(page, helpers('return hitPoint(cellById(arg));'), child!.id);
    await page.mouse.click(at.x, at.y);
    expect(await selectionIds(page)).toEqual([child!.group]);
    await page.waitForTimeout(350);
    await page.mouse.click(at.x, at.y);
    expect(await selectionIds(page)).toEqual([child!.id]);

    await openStyleTab(page);
    await page.locator('#prop-fillColor').fill('#ffcc00');
    await expect.poll(async () => (await ownStyleOf(page, child!.id)).fillColor).toBe('#ffcc00');
    // the fill edit kept the child's other keys (e.g. strokeColor=none, base style names)
    expect(await ownStyleOf(page, child!.id)).toEqual({ ...child!.style, fillColor: '#ffcc00' });
    await editLine(page, child!.id, '#0000ff');
    expect((await paintedOf(page, child!.id)).some((p) => p.fill === '#ffcc00')).toBe(true);

    // A vertex without a line (strokeColor=none): editing its fill must not add an outline
    const noLine = await inGraph<{ id: string; style: Record<string, unknown> } | null>(page, helpers(`
      const all = Object.values(model.cells);
      const c = all.find((c) => c.isVertex() && c.style && c.style.strokeColor === 'none' && c.style.fillColor && c.style.fillColor !== 'none');
      return c ? { id: c.id, style: ownStyle(c) } : null;`));
    expect(noLine).not.toBeNull();
    await inGraph(page, 'graph.setSelectionCell(graph.getDataModel().getCell(arg));', noLine!.id);
    await expect(page.locator('#prop-useLine')).not.toBeChecked();
    await page.locator('#prop-fillColor').fill('#123456');
    await expect.poll(async () => (await ownStyleOf(page, noLine!.id)).fillColor).toBe('#123456');
    expect(await ownStyleOf(page, noLine!.id)).toEqual({ ...noLine!.style, fillColor: '#123456' });
    const noLinePainted = await paintedOf(page, noLine!.id);
    expect(noLinePainted.every((p) => p.stroke === null || p.stroke === 'none' || p.stroke === 'transparent'), JSON.stringify(noLinePainted)).toBe(true);

    // the autosave writes the explicit colors
    await expect.poll(async () => autosaveText(page), { timeout: 15_000 })
      .toContain('#123456');

    expect(pageErrors).toEqual([]);
  });

  test('user template: line color of a line and of a shape inside a group', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      const xml = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
        '<mxCell id="g" value="" style="group" vertex="1" connectable="0" parent="1"><mxGeometry x="0" y="0" width="200" height="120" as="geometry"/></mxCell>' +
        '<mxCell id="box" value="" style="rounded=0;whiteSpace=wrap;html=1;fillColor=none;strokeColor=light-dark(#000000,#ffffff);" vertex="1" parent="g"><mxGeometry x="40" y="30" width="120" height="60" as="geometry"/></mxCell>' +
        '<mxCell id="line" value="" style="endArrow=none;html=1;strokeColor=default;strokeWidth=2;" edge="1" parent="1"><mxGeometry width="50" height="50" relative="1" as="geometry"><mxPoint x="0" y="200" as="sourcePoint"/><mxPoint x="200" y="200" as="targetPoint"/></mxGeometry></mxCell>' +
        '</root></mxGraphModel>';
      localStorage.setItem('railway-drawer-templates', JSON.stringify({
        version: 1,
        templates: [{ id: 'tpl-test', name: 'Box and line', xml, width: 200, height: 200, created: 1, updated: 1 }],
      }));
    });
    await page.reload();
    await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);

    await openLeftTab(page, 'templates');
    await page.locator('#templates-panel [data-section="user"] .rd-tpl-tile').first().click();
    await page.locator('.rd-tpl-popover [data-action="insert"]').click();
    await expect.poll(async () => (await selectionIds(page)).length).toBe(2);
    const ids = await inGraph<{ group: string; box: string; line: string }>(page, `
      graph.clearSelection();
      const cells = graph.getDefaultParent().children;
      const group = cells.find((c) => c.isVertex());
      const line = cells.find((c) => c.isEdge());
      return { group: group.id, box: group.children[0].id, line: line.id };`);

    // the line: strokeColor=default -> explicit color, arrow stays off
    await clickCell(page, ids.line);
    await openStyleTab(page);
    await expect(page.locator('#prop-strokeColor')).toHaveValue('#000000');
    await editLine(page, ids.line, '#cc0000');
    expect(await ownStyleOf(page, ids.line)).toEqual({ endArrow: 'none', html: true, strokeColor: '#cc0000', strokeWidth: 3, dashed: 1 });

    // the box inside the group: group first, then the box
    await clickCell(page, ids.box);
    await openStyleTab(page);
    await expect(page.locator('#prop-useFill')).not.toBeChecked();
    await editLine(page, ids.box, '#00aa00');
    const box = await ownStyleOf(page, ids.box);
    expect(box.fillColor).toBe('none');
    expect(box.strokeColor).toBe('#00aa00');
    // the group itself is unchanged (still invisible)
    expect(await ownStyleOf(page, ids.group)).toEqual({ baseStyleNames: ['group'] });

    expect(pageErrors).toEqual([]);
  });

  test('draw.io and ERTMS palette shapes: line, shape, stencil and grouped ERTMS element', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await freshApp(page);
    const insert = async (palette: string, title: string): Promise<string[]> => {
      await inGraph(page, 'graph.clearSelection();');
      const section = page.locator(`#drawio-palette-container section[data-palette-id="${palette}"]`);
      if ((await section.locator('.rd-dp-header').getAttribute('aria-expanded')) !== 'true') {
        await section.locator('.rd-dp-header').click();
      }
      await section.locator(`.rd-dp-item[title="${title}"]`).first().click();
      await expect.poll(async () => (await selectionIds(page)).length).toBeGreaterThan(0);
      return selectionIds(page);
    };

    // General > Line (endArrow=none): the line color must not bring back the arrow head
    const [line] = await insert('general', 'Line');
    await editLine(page, line, '#ff00ff');
    expect(await ownStyleOf(page, line)).toEqual({ endArrow: 'none', html: true, strokeColor: '#ff00ff', strokeWidth: 3, dashed: 1 });

    // General > Hexagon: fill and line
    const [hexagon] = await insert('general', 'Hexagon');
    await openStyleTab(page);
    await page.locator('#prop-fillColor').fill('#aabbcc');
    await editLine(page, hexagon, '#112233');
    expect((await ownStyleOf(page, hexagon)).shape).toBe('hexagon');
    expect((await paintedOf(page, hexagon)).some((p) => p.fill === '#aabbcc')).toBe(true);

    // Flowchart > Decision: a named stencil (colors come from the style)
    const [decision] = await insert('flowchart', 'Decision');
    await editLine(page, decision, '#445566');
    expect((await ownStyleOf(page, decision)).shape).toBe('mxgraph.flowchart.decision');

    // ERTMS > Signal Left 3: grouped element; edit a part of it after entering the group
    const [signal] = await insert('ertms', 'Signal Left 3');
    const part = await inGraph<string | null>(page, helpers(`
      graph.clearSelection();
      graph.zoomTo(3);
      const top = cellById(arg);
      const queue = [...(top.children || [])];
      while (queue.length) { const c = queue.shift(); if (c.isEdge() && hitPoint(c)) return c.id; queue.push(...(c.children || [])); }
      queue.push(...(top.children || []));
      while (queue.length) { const c = queue.shift(); if (hitPoint(c)) return c.id; queue.push(...(c.children || [])); }
      return null;`), signal);
    expect(part).not.toBeNull();
    await clickCell(page, part!);
    await editLine(page, part!, '#778899');

    expect(pageErrors).toEqual([]);
  });
});
