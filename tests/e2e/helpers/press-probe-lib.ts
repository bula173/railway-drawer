/**
 * @file press-probe-lib.ts
 * @brief Real-mouse "press and drag" probe shared by press-to-move.spec.ts (CI regression) and
 *        press-probe.spec.ts (the full grid, run on demand with PRESS_PROBE=1).
 *
 * A sample of every kind of object users drag (draw.io rectangle small/normal, ellipse, text,
 * image, AWS icon, mxgraph.basic stencil, ERTMS signal group, balise, PKP semafor group, turnout,
 * track edge, connector edge, a template group) is laid out; each press point is hovered (resting
 * long enough for the hover arrows), pressed and dragged 30 px with page.mouse, and the outcome is
 * classified: moved / connect / pan / rubber / other-moved / nothing. The model and the scroll
 * position are restored after every press.
 */
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openLeftTab } from '../menu-helpers';

export type Outcome = 'moved' | 'connect' | 'pan' | 'rubber' | 'other-moved' | 'nothing';

export interface ProbeResult {
  sample: string;
  zoom: number;
  /** Fractions (vertex: x/y of the bounds; edge: along the line / perpendicular offset in px). */
  at: [number, number];
  /** Within the connection-point hit tolerance of a point a press may start a connection from. */
  onPoint: boolean;
  outcome: Outcome;
}

export interface Sample {
  name: string;
  /** Cell ids that count as "the object" (the vertex/group, or the edges of a turnout). */
  ids: string[];
  /** The cell whose bounds/line the press points are spread over. */
  probeId: string;
  kind: 'vertex' | 'edge';
}

/** Runs `body` (function body text) with `tab` = the active tab, `graph` and `arg`. */
export async function inTab<T>(page: Page, body: string, arg?: unknown): Promise<T> {
  return page.evaluate(async ({ body, arg }) => {
    const registry = await import('/src/services/service-registry.ts' as string);
    const tab = registry.ServiceRegistry.getTabManager().getActiveTab();
    return new Function('tab', 'graph', 'arg', body)(tab, tab.graph, arg);
  }, { body, arg }) as Promise<T>;
}

export async function freshApp(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
}

const selectedIds = (page: Page): Promise<string[]> =>
  inTab<string[]>(page, 'return graph.getSelectionCells().map((c) => c.id).sort();');

/** Clicks a palette tile; returns the inserted (selected) cell ids. */
async function paletteInsert(page: Page, section: string, title: string): Promise<string[]> {
  await inTab(page, 'graph.clearSelection();');
  const sec = page.locator(`#drawio-palette-container section[data-palette-id="${section}"]`);
  if ((await sec.locator('.rd-dp-header').getAttribute('aria-expanded')) !== 'true') await sec.locator('.rd-dp-header').click();
  await sec.locator(`.rd-dp-item[title="${title}"]`).first().click();
  await expect.poll(async () => (await selectedIds(page)).length).toBeGreaterThan(0);
  return selectedIds(page);
}

/** Inserts a vertex with `style` through the model; returns its id. */
function modelVertex(page: Page, style: string, w: number, h: number, value = ''): Promise<string> {
  return inTab<string>(page, `
    const v = graph.insertVertex(graph.getDefaultParent(), null, arg.value, 0, 0, arg.w, arg.h, arg.style);
    return v.id;`, { style, w, h, value });
}

/** Moves the cells by (dx, dy) so that the bounding box of `ids` starts at (x, y). */
async function placeAt(page: Page, ids: string[], x: number, y: number): Promise<void> {
  await inTab(page, `
    const m = graph.getDataModel(); const cells = arg.ids.map((id) => m.getCell(id));
    const b = graph.getBoundingBoxFromGeometry(cells, true);
    graph.moveCells(cells, arg.x - b.x, arg.y - b.y);
    graph.clearSelection();`, { ids, x, y });
}

/**
 * Lays out the probe samples (grid off, so a drag of a few px is a visible move). `which` limits
 * the samples (names) for the fast CI spec.
 */
export async function setupSamples(page: Page, which?: string[]): Promise<Sample[]> {
  await freshApp(page);
  if (await inTab<boolean>(page, 'return graph.gridEnabled;')) await page.locator('#btn-grid').click();
  const want = (n: string): boolean => !which || which.includes(n);
  const out: Sample[] = [];
  const add = async (name: string, ids: string[], x: number, y: number, kind: 'vertex' | 'edge' = 'vertex', probeId = ids[0]) => {
    await placeAt(page, ids, x, y);
    out.push({ name, ids, probeId, kind });
  };
  if (want('rect-small')) {
    const [id] = await paletteInsert(page, 'general', 'Rectangle');
    await inTab(page, 'const m = graph.getDataModel(); const c = m.getCell(arg); const g = c.getGeometry().clone(); g.width = 40; g.height = 20; m.setGeometry(c, g);', id);
    await add('rect-small', [id], 100, 100);
  }
  if (want('rect')) await add('rect', await paletteInsert(page, 'general', 'Rectangle'), 200, 100);
  if (want('ellipse')) await add('ellipse', await paletteInsert(page, 'general', 'Ellipse'), 380, 100);
  if (want('text')) await add('text', await paletteInsert(page, 'general', 'Text'), 540, 100);
  if (want('image')) {
    await add('image', [await modelVertex(page, 'image;html=1;image=img/lib/clip_art/computers/Database_128x128.png;', 60, 60)], 680, 100);
  }
  if (want('aws')) {
    await add('aws', [await modelVertex(page, 'sketch=0;outlineConnect=0;fontColor=#232F3E;gradientColor=#F78E04;gradientDirection=north;fillColor=#D05C17;strokeColor=#ffffff;dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.lambda;', 78, 78)], 800, 100);
  }
  if (want('stencil')) {
    await add('stencil', [await modelVertex(page, 'shape=mxgraph.basic.4_point_star;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;', 80, 80)], 100, 260);
  }
  if (want('ertms-signal')) await add('ertms-signal', await paletteInsert(page, 'ertms', 'Signal Right 3'), 260, 270);
  if (want('balise')) await add('balise', await paletteInsert(page, 'ertms', 'Single Balise Right'), 400, 280);
  if (want('pkp-semafor')) await add('pkp-semafor', await paletteInsert(page, 'rail-pl', 'Semafor 3-komorowy prawy'), 520, 280);
  if (want('turnout')) {
    const ids = await paletteInsert(page, 'track-layout', 'Turnout 1:9 Left (toe left)');
    // the points leg (rdKind=points) is pressed; both edges count as the turnout
    const leg = await inTab<string>(page, `return arg.find((id) => { const v = graph.getDataModel().getCell(id).value; return v && v.getAttribute && v.getAttribute('rdKind') === 'points'; }) || arg[0];`, ids);
    await add('turnout', ids, 640, 260, 'edge', leg);
  }
  if (want('track')) await add('track', await paletteInsert(page, 'ertms', 'Track'), 100, 440, 'edge');
  if (want('connector')) {
    const ids = await inTab<string[]>(page, `
      const p = graph.getDefaultParent();
      const a = graph.insertVertex(p, null, '', 0, 0, 40, 40, 'rounded=0;whiteSpace=wrap;html=1;');
      const b = graph.insertVertex(p, null, '', 200, 0, 40, 40, 'rounded=0;whiteSpace=wrap;html=1;');
      const e = graph.insertEdge(p, null, '', a, b, 'endArrow=classic;html=1;rounded=0;');
      return [e.id, a.id, b.id];`);
    await placeAt(page, ids, 400, 420);
    out.push({ name: 'connector', ids: [ids[0]], probeId: ids[0], kind: 'edge' });
  }
  if (want('template-group')) {
    await inTab(page, 'graph.clearSelection();');
    await openLeftTab(page, 'templates');
    await page.locator('#templates-panel [data-section="builtin"] .rd-tpl-tile').first().click();
    await page.locator('.rd-tpl-popover [data-action="insert"]').click();
    await expect.poll(async () => (await selectedIds(page)).length).toBeGreaterThan(0);
    // keep the largest inserted group (vertex with children), drop the rest
    const gid = await inTab<string | null>(page, `
      const sel = graph.getSelectionCells();
      const groups = sel.filter((c) => c.isVertex() && (c.children || []).some((k) => k.isVertex()));
      groups.sort((a, b) => b.getGeometry().width * b.getGeometry().height - a.getGeometry().width * a.getGeometry().height);
      const g = groups[0] || null;
      graph.removeCells(sel.filter((c) => c !== g), true);
      graph.clearSelection();
      return g && g.id;`);
    expect(gid, 'the first built-in template holds a group').toBeTruthy();
    await add('template-group', [gid!], 100, 560);
  }
  return out;
}

interface Snapshot { cells: Record<string, string>; scroll: [number, number] }

const SNAPSHOT_FN = `
  const m = graph.getDataModel(); const cells = {};
  const walk = (c) => { for (const k of c.children || []) {
    const g = k.getGeometry();
    cells[k.id] = JSON.stringify([k.parent && k.parent.id, k.source && k.source.id, k.target && k.target.id,
      g ? [g.x, g.y, g.width, g.height, g.sourcePoint && [g.sourcePoint.x, g.sourcePoint.y], g.targetPoint && [g.targetPoint.x, g.targetPoint.y], (g.points || []).map((p) => [p.x, p.y])] : null]);
    walk(k); } };
  walk(m.getRoot());
`;

/** Press points (page coords) over a sample, with the "on a connection point" flag. */
async function pressPoints(page: Page, s: Sample, fr: number[], off: number[]):
  Promise<Array<{ x: number; y: number; at: [number, number]; onPoint: boolean }>> {
  return inTab(page, `
    const m = graph.getDataModel(); const cell = m.getCell(arg.id);
    const st = graph.view.getState(cell);
    const r = graph.container.getBoundingClientRect();
    const sl = graph.container.scrollLeft, stp = graph.container.scrollTop;
    // the cell whose connection points show for a press here (a symbol group for its parts)
    const ch = graph.getPlugin('ConnectionHandler').constraintHandler;
    const pts = [];
    const tol = arg.tol;
    const addPts = (c) => {
      const cs = graph.view.getState(c);
      if (!cs || !c.isVertex() || !c.isConnectable() || graph.isCellSelected(c)) return;
      for (const k of graph.getAllConnectionConstraints(cs, true) || []) {
        const p = graph.getConnectionPoint(cs, k);
        if (p) pts.push({ x: Math.round(p.x - 2.5) + 2.5, y: Math.round(p.y - 2.5) + 2.5, s: cs });
      }
    };
    const walk = (c) => { addPts(c); for (const k of c.children || []) if (k.isVertex()) walk(k); };
    walk(cell);
    // the rule of src/ui/connections.ts isOnSourcePoint: within tol of the 'x' (drawn at whole
    // pixels, ConstraintHandler: Math.round(cp - 2.5)), at most 1 px inward, not in the centre
    const onPoint = (x, y) => pts.some((p) => {
      if (Math.abs(p.x - x) > tol || Math.abs(p.y - y) > tol) return false;
      const c = p.s; const mx = c.width * 0.25, my = c.height * 0.25;
      let kind = false; for (let k = c.cell; k && k.parent; k = k.parent) if (k.value && k.value.getAttribute && k.value.getAttribute('rdKind')) kind = true;
      const small = c.width < 32 || c.height < 32 || kind;
      if (x > c.x + mx && x < c.x + c.width - mx && y > c.y + my && y < c.y + c.height - my) return false;
      const d = [];
      if (Math.abs(p.x - c.x) <= 1.5) d.push(x - p.x);
      if (Math.abs(p.x - c.x - c.width) <= 1.5) d.push(p.x - x);
      if (Math.abs(p.y - c.y) <= 1.5) d.push(y - p.y);
      if (Math.abs(p.y - c.y - c.height) <= 1.5) d.push(p.y - y);
      if (d.length) return Math.max(...d) <= (small ? 0.5 : 1);
      if (small) return false;
      const vx = p.x - c.getCenterX(), vy = p.y - c.getCenterY(); const len = Math.hypot(vx, vy);
      return len >= 1 && ((p.x - x) * vx + (p.y - y) * vy) / len <= 1;
    });
    const out = [];
    // whole page pixels (what the browser delivers); the flag is computed at that pixel
    const push = (x, y, at, flag) => {
      const px = Math.round(r.left + x - sl), py = Math.round(r.top + y - stp);
      const gx = px - r.left + sl, gy = py - r.top + stp;
      out.push({ x: px, y: py, at, onPoint: flag && onPoint(gx, gy) });
    };
    if (arg.kind === 'vertex') {
      for (const fy of arg.fr) for (const fx of arg.fr) push(st.x + st.width * fx, st.y + st.height * fy, [fx, fy], true);
    } else {
      const ap = st.absolutePoints; const a = ap[0], b = ap[ap.length - 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y); const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
      for (const o of arg.off) for (const f of arg.fr) {
        push(a.x + (b.x - a.x) * f + nx * o, a.y + (b.y - a.y) * f + ny * o, [f, o], false);
      }
    }
    return out;`, { id: s.probeId, kind: s.kind, fr, off, tol: SOURCE_POINT_TOL });
}

/** Connection point hit tolerance in screen px (src/ui/connections.ts SOURCE_POINT_TOLERANCE). */
export const SOURCE_POINT_TOL = 3;

/** Presses at `p`, drags 30 px right / 20 px down (in steps), releases; classifies the outcome. */
async function pressAndDrag(page: Page, s: Sample, p: { x: number; y: number }): Promise<Outcome> {
  await page.mouse.move(p.x - 12, p.y - 9);
  await page.mouse.move(p.x, p.y, { steps: 4 });
  // rest like a user: the hover arrows (140 ms) and connection points are shown
  await page.waitForTimeout(220);
  const before = await inTab<Snapshot>(page, `${SNAPSHOT_FN} return { cells, scroll: [graph.container.scrollLeft, graph.container.scrollTop] };`);
  await page.mouse.down();
  await page.mouse.move(p.x + 6, p.y + 4, { steps: 2 });
  await page.mouse.move(p.x + 30, p.y + 20, { steps: 5 });
  const during = await inTab<{ connect: boolean; pan: boolean; rubber: boolean }>(page, `
    const ch = graph.getPlugin('ConnectionHandler');
    const rb = graph.container.querySelector('.mxRubberband');
    return { connect: !!(ch && ch.first), pan: graph.container.classList.contains('rd-panning'),
      rubber: !!rb && rb.style.display !== 'none' && rb.offsetWidth > 0 };`);
  await page.mouse.up();
  await page.waitForTimeout(30);
  const after = await inTab<Snapshot>(page, `${SNAPSHOT_FN} return { cells, scroll: [graph.container.scrollLeft, graph.container.scrollTop] };`);
  const added = Object.keys(after.cells).filter((id) => !(id in before.cells));
  const changed = Object.keys(before.cells).filter((id) => after.cells[id] !== before.cells[id]);
  let outcome: Outcome;
  if (during.connect || added.length > 0) outcome = 'connect';
  else if (during.pan || after.scroll[0] !== before.scroll[0] || after.scroll[1] !== before.scroll[1]) outcome = 'pan';
  else if (during.rubber) outcome = 'rubber';
  else if (s.ids.some((id) => changed.includes(id))) outcome = 'moved';
  else if (changed.length > 0) outcome = 'other-moved';
  else outcome = 'nothing';
  // restore: drop new cells, put the geometries/terminals back, scroll back, nothing selected
  if (added.length > 0 || changed.length > 0) {
    await inTab(page, `
      const m = graph.getDataModel();
      m.beginUpdate();
      try {
        graph.removeCells(arg.added.map((id) => m.getCell(id)).filter(Boolean), true);
        for (const id of arg.changed) {
          const c = m.getCell(id); if (!c) continue;
          const [parent, source, target, g] = JSON.parse(arg.before[id]);
          if (c.parent && c.parent.id !== parent) m.add(m.getCell(parent), c);
          if (c.isEdge()) { m.setTerminal(c, source ? m.getCell(source) : null, true); m.setTerminal(c, target ? m.getCell(target) : null, false); }
          if (g) {
            const geo = c.getGeometry().clone(); [geo.x, geo.y, geo.width, geo.height] = g;
            const P = graph.view.translate.constructor;
            geo.sourcePoint = g[4] ? new P(g[4][0], g[4][1]) : null; geo.targetPoint = g[5] ? new P(g[5][0], g[5][1]) : null;
            geo.points = g[6].map((q) => new P(q[0], q[1]));
            m.setGeometry(c, geo);
          }
        }
      } finally { m.endUpdate(); }`, { added, changed, before: before.cells });
  }
  await inTab(page, 'graph.clearSelection(); graph.container.scrollLeft = arg[0]; graph.container.scrollTop = arg[1];', before.scroll);
  await page.keyboard.press('Escape');
  return outcome;
}

/** Probes every sample at `zoom` over the fraction grid `fr` (edges: perpendicular offsets `off`). */
export async function probe(page: Page, samples: Sample[], zoom: number, fr: number[], off: number[]): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];
  await inTab(page, 'graph.zoomTo(arg); graph.clearSelection();', zoom);
  for (const s of samples) {
    await inTab(page, 'graph.clearSelection(); graph.scrollCellToVisible(graph.getDataModel().getCell(arg), true);', s.probeId);
    for (const p of await pressPoints(page, s, fr, off)) {
      const outcome = await pressAndDrag(page, s, p);
      results.push({ sample: s.name, zoom, at: p.at, onPoint: p.onPoint, outcome });
    }
  }
  return results;
}

/** Text table: one row per sample and zoom, counts per outcome (+ the presses that were not moves). */
export function table(results: ProbeResult[]): string {
  const rows = new Map<string, ProbeResult[]>();
  for (const r of results) {
    const k = `${r.sample} @${r.zoom * 100}%`;
    if (!rows.has(k)) rows.set(k, []);
    rows.get(k)!.push(r);
  }
  const outs: Outcome[] = ['moved', 'connect', 'pan', 'rubber', 'other-moved', 'nothing'];
  const lines = [`| sample | presses | ${outs.join(' | ')} | on point | moved off point | not moved (at) |`, `|${'---|'.repeat(outs.length + 5)}`];
  for (const [k, rs] of rows) {
    const off = rs.filter((r) => !r.onPoint);
    const bad = off.filter((r) => r.outcome !== 'moved').map((r) => `${r.outcome}@${r.at.map((v) => +v.toFixed(2)).join(',')}`);
    lines.push(`| ${k} | ${rs.length} | ${outs.map((o) => rs.filter((r) => r.outcome === o).length).join(' | ')} | ${rs.length - off.length} | ` +
      `${off.length ? Math.round(100 * off.filter((r) => r.outcome === 'moved').length / off.length) : 100}% | ${bad.slice(0, 6).join(' ')}${bad.length > 6 ? ' …' : ''} |`);
  }
  return lines.join('\n');
}
