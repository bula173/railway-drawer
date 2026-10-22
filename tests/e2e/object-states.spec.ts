/**
 * @file object-states.spec.ts
 * @brief Runtime object states with real right-clicks: a track section -> State ▸ Occupied turns
 *        red (rendered stroke, saved file has rdState="occupied" + strokeColor), Reset State
 *        restores it, one Ctrl+Z step; signal Aspect ▸ Proceed paints its lamps green; points
 *        Position ▸ Normal / Reverse fades / shows the diverging leg; route Set / Occupy / Release;
 *        Railway > Object State items and the legend; a scenario step diff lists "TC2: free →
 *        occupied"; the state colours are rendered unchanged in the dark theme. Screenshots in
 *        test-results/object-states/. Any port; the layout is loaded with saveLoadController.load.
 */
import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { clickMenuItem } from './menu-helpers';

async function inGraph<T>(page: Page, body: string, arg?: unknown): Promise<T> {
  return page.evaluate(async ({ body, arg }) => {
    const registry = await import('/src/services/service-registry.ts' as string);
    const tab = registry.ServiceRegistry.getTabManager().getActiveTab();
    return new Function('graph', 'tab', 'arg', body)(tab.graph, tab, arg);
  }, { body, arg }) as Promise<T>;
}

const obj = (id: string, attrs: string, style: string, geo: string, edge = false, parent = '1'): string =>
  `<object label="" id="${id}" ${attrs}><mxCell style="${style}" ${edge ? 'edge="1"' : 'vertex="1"'} parent="${parent}">${geo}</mxCell></object>`;
const line = (...pts: number[]): string => {
  const inner = pts.length > 4
    ? `<Array as="points">${Array.from({ length: (pts.length - 4) / 2 }, (_, i) => `<mxPoint x="${pts[2 + i * 2]}" y="${pts[3 + i * 2]}"/>`).join('')}</Array>`
    : '';
  return `<mxGeometry relative="1" as="geometry"><mxPoint x="${pts[0]}" y="${pts[1]}" as="sourcePoint"/><mxPoint x="${pts[pts.length - 2]}" y="${pts[pts.length - 1]}" as="targetPoint"/>${inner}</mxGeometry>`;
};
const SECTION = 'edgeStyle=none;endArrow=none;html=1;strokeColor=#000000;strokeWidth=6;';
const LAMP = 'ellipse;fillColor=#ffffff;strokeColor=#404040;';
const SIGNAL = 'triangle;whiteSpace=wrap;html=1;fillColor=#000000;';

/**
 *   S1>  TC1    W1          TC2          S2>     y=100
 *   ===========*========================
 *               \
 *                *=========TC3========== S3>     y=180
 *   Route R1 (Routes layer, drawn as a line at y=60): S1 -> S3 over TC1, TC3, W1 reverse.
 */
const LAYOUT = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
${obj('tc1', 'rdKind="trackSection" rdId="TC1"', SECTION, line(0, 100, 150, 100), true)}
${obj('tc2', 'rdKind="trackSection" rdId="TC2"', SECTION, line(150, 100, 500, 100), true)}
${obj('tc3', 'rdKind="trackSection" rdId="TC3"', SECTION, line(230, 180, 500, 180), true)}
${obj('w1', 'rdKind="points" rdId="W1" rdPosition="normal"', 'edgeStyle=none;endArrow=none;strokeColor=#a5a5a5;strokeWidth=6;', line(150, 100, 230, 180), true)}
<object label="" id="s1" rdKind="signal" rdId="S1" rdDirection="nominal"><mxCell style="group" vertex="1" connectable="0" parent="1"><mxGeometry x="20" y="112" width="40" height="20" as="geometry"/></mxCell></object>
<mxCell id="s1a" style="${LAMP}" vertex="1" parent="s1"><mxGeometry x="10" y="2" width="14" height="14" as="geometry"/></mxCell>
<mxCell id="s1b" style="${LAMP}" vertex="1" parent="s1"><mxGeometry x="24" y="2" width="14" height="14" as="geometry"/></mxCell>
<mxCell id="s1m" style="endArrow=none;strokeColor=#404040;strokeWidth=2;" edge="1" parent="s1">${line(0, 9, 10, 9)}</mxCell>
${obj('s2', 'rdKind="signal" rdId="S2" rdDirection="nominal"', SIGNAL, '<mxGeometry x="440" y="110" width="20" height="20" as="geometry"/>')}
${obj('s3', 'rdKind="signal" rdId="S3" rdDirection="nominal"', SIGNAL, '<mxGeometry x="430" y="190" width="20" height="20" as="geometry"/>')}
<mxCell id="rd-routes" value="Routes" parent="0"/>
${obj('r1', 'rdKind="route" rdId="R1" rdEntrySignal="S1" rdExitSignal="S3" rdPoints="W1:reverse" rdSections="TC1, TC3"', 'edgeStyle=none;endArrow=block;strokeColor=#ff8f00;strokeWidth=5;opacity=60;movable=0;', line(40, 60, 440, 60), true, 'rd-routes')}
</root></mxGraphModel>`;

/** Client point of a graph point. */
async function clientPoint(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  return inGraph(page, `
    const s = graph.view.scale, t = graph.view.translate, c = graph.container;
    const r = c.getBoundingClientRect();
    return { x: r.left + (arg.x + t.x) * s - c.scrollLeft, y: r.top + (arg.y + t.y) * s - c.scrollTop };`, { x, y });
}

async function rightClick(page: Page, x: number, y: number): Promise<void> {
  const p = await clientPoint(page, x, y);
  await page.mouse.click(p.x, p.y, { button: 'right' });
  await expect(page.locator('#context-menu')).toBeVisible();
}

/** Opens a state submenu of the context menu by hovering it and clicks one of its values. */
async function pickState(page: Page, submenu: 'state' | 'aspect' | 'position', value: string): Promise<void> {
  const sub = page.locator(`#context-menu .rd-ctx-sub[data-state-submenu="${submenu}"]`);
  await sub.hover();
  await expect(sub).toHaveAttribute('aria-expanded', 'true');
  await sub.locator(`[data-state-cmd="${submenu}:${value}"]`).click();
  await expect(page.locator('#context-menu')).toBeHidden();
}

/** Data attribute of a cell. */
const attr = (page: Page, id: string, name: string): Promise<string> =>
  inGraph(page, 'const c = graph.getDataModel().getCell(arg.id); return c.value.getAttribute(arg.name) ?? "";', { id, name });

/** A key of a cell's own style. */
const styleKey = (page: Page, id: string, key: string): Promise<unknown> =>
  inGraph(page, 'const s = graph.getDataModel().getCell(arg.id).getStyle(); return s && typeof s === "object" ? s[arg.key] ?? null : null;', { id, key });

/**
 * What the view draws: stroke / fill / opacity of the shape's visible element (maxGraph adds an
 * invisible white hit-detection path to edges, skipped here).
 */
const rendered = (page: Page, id: string): Promise<{ stroke: string; fill: string; opacity: string }> =>
  inGraph(page, `
    const st = graph.view.getState(graph.getDataModel().getCell(arg));
    const node = st.shape.node;
    const els = [node, ...node.querySelectorAll('path, ellipse, rect')].filter((e) => e.getAttribute('visibility') !== 'hidden');
    const real = (v) => !!v && !['white', 'transparent', 'none'].includes(v.toLowerCase());
    const strokeEl = els.find((e) => real(e.getAttribute('stroke')));
    const fillEl = els.find((e) => real(e.getAttribute('fill')));
    const op = node.getAttribute('opacity') ?? strokeEl?.getAttribute('stroke-opacity') ?? strokeEl?.getAttribute('opacity') ?? '';
    return {
      stroke: (strokeEl?.getAttribute('stroke') || '').toLowerCase(),
      fill: (fillEl?.getAttribute('fill') || '').toLowerCase(),
      opacity: String(op),
    };`, id);

async function openApp(page: Page, theme: 'light' | 'dark' = 'light'): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.evaluate((t) => {
    localStorage.clear();
    localStorage.setItem('rd.theme', t);
  }, theme);
  await page.reload();
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
  await inGraph(page, 'tab.saveLoadController.load(arg); graph.container.scrollLeft -= 60; graph.container.scrollTop -= 60;', LAYOUT);
}

test('track section, signal, points: right-click states, save, reset, undo', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openApp(page);

  // TC2 -> State ▸ Occupied: red, saved in the file
  await rightClick(page, 400, 100);
  const stateSub = page.locator('#context-menu .rd-ctx-sub[data-state-submenu="state"]');
  await expect(stateSub).toBeVisible();
  await expect(page.locator('#context-menu .rd-ctx-sub[data-state-submenu="aspect"]')).toHaveCount(0);
  await stateSub.hover();
  await expect(stateSub.locator('[data-state-cmd="state:free"]')).toHaveAttribute('aria-checked', 'true');
  await expect(stateSub.locator('[role="menuitemradio"]')).toHaveText([/Free/, /Occupied/, /Reserved/, /Overlap/, /Locked/, /Disturbed/]);
  await stateSub.locator('[data-state-cmd="state:occupied"]').click();
  expect(await attr(page, 'tc2', 'rdState')).toBe('occupied');
  expect(await styleKey(page, 'tc2', 'strokeColor')).toBe('#ff0000');
  expect((await rendered(page, 'tc2')).stroke).toBe('#ff0000');
  // thicker than drawn (6 -> 9): occupied differs from a track drawn red
  expect(await styleKey(page, 'tc2', 'strokeWidth')).toBe(9);

  const [download] = await Promise.all([page.waitForEvent('download'), clickMenuItem(page, 'file', 'save')]);
  const saved = await readFile((await download.path())!, 'utf8');
  const tc2Xml = /<object [^>]*id="tc2"[^>]*>\s*<mxCell [^>]*>/.exec(saved)?.[0] ?? '';
  expect(tc2Xml).toContain('rdState="occupied"');
  expect(tc2Xml).toContain('rdBaseStyle=');
  expect(tc2Xml).toMatch(/<mxCell [^>]*style="[^"]*strokeColor=#ff0000/);

  // the radio shows the current state; Reset State restores the drawn style
  await rightClick(page, 400, 100);
  await stateSub.hover();
  await expect(stateSub.locator('[data-state-cmd="state:occupied"]')).toHaveAttribute('aria-checked', 'true');
  await page.locator('#context-menu [data-state-cmd="reset"]').click();
  expect(await attr(page, 'tc2', 'rdState')).toBe('');
  expect(await attr(page, 'tc2', 'rdBaseStyle')).toBe('');
  expect(await styleKey(page, 'tc2', 'strokeColor')).toBe('#000000');
  // one undo step brings the state back, redo removes it again
  await page.locator('#graph-container').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('ControlOrMeta+z');
  expect(await attr(page, 'tc2', 'rdState')).toBe('occupied');
  expect(await styleKey(page, 'tc2', 'strokeColor')).toBe('#ff0000');
  await page.keyboard.press('ControlOrMeta+z');
  expect(await attr(page, 'tc2', 'rdState')).toBe('');
  expect(await styleKey(page, 'tc2', 'strokeColor')).toBe('#000000');

  // Signal S1 (lamp group): Aspect ▸ Proceed paints both lamps green, the mast keeps its colour
  await rightClick(page, 52, 121);
  await expect(page.locator('#context-menu .rd-ctx-sub[data-state-submenu="state"]')).toHaveCount(0);
  await pickState(page, 'aspect', 'proceed');
  expect(await attr(page, 's1', 'rdAspect')).toBe('proceed');
  for (const lamp of ['s1a', 's1b']) expect((await rendered(page, lamp)).fill).toBe('#00c853');
  expect((await rendered(page, 's1m')).stroke).toBe('#404040');

  // Points W1: Position ▸ Normal fades the diverging leg, Reverse draws it
  await rightClick(page, 190, 140);
  await expect(page.locator('#context-menu .rd-ctx-sub[data-state-submenu="state"]')).toBeVisible();
  await pickState(page, 'position', 'normal');
  expect(await styleKey(page, 'w1', 'opacity')).toBe(30);
  expect(Number((await rendered(page, 'w1')).opacity)).toBeCloseTo(0.3, 2);
  await rightClick(page, 190, 140);
  await pickState(page, 'position', 'reverse');
  expect(await attr(page, 'w1', 'rdPosition')).toBe('reverse');
  expect(await styleKey(page, 'w1', 'opacity')).toBeNull();
  expect((await rendered(page, 'w1')).opacity).not.toBe('0.3');

  // multi-selection: TC1 + TC3 locked together (one undo step)
  await inGraph(page, "graph.setSelectionCells(['tc1', 'tc3'].map((id) => graph.getDataModel().getCell(id)));");
  await rightClick(page, 75, 100);
  await pickState(page, 'state', 'locked');
  expect([await attr(page, 'tc1', 'rdState'), await attr(page, 'tc3', 'rdState')]).toEqual(['locked', 'locked']);
  await page.locator('#graph-container').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('ControlOrMeta+z');
  expect([await attr(page, 'tc1', 'rdState'), await attr(page, 'tc3', 'rdState')]).toEqual(['', '']);

  // Data panel: the state select of the selected section
  await inGraph(page, "graph.setSelectionCells([graph.getDataModel().getCell('tc3')]);");
  await page.locator('[data-right-panel="data"]').click();
  const select = page.locator('#rd-rw-f-state');
  await expect(select).toHaveValue('free');
  await select.selectOption('disturbed');
  expect(await attr(page, 'tc3', 'rdState')).toBe('disturbed');
  expect(await styleKey(page, 'tc3', 'dashPattern')).toBe('2 2');
  await page.locator('[data-right-panel="properties"]').click();
  expect(errors).toEqual([]);
});

test('route Set / Occupy / Release, Railway menu, legend, scenario diff, dark theme', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openApp(page);

  // Right-click on the route edge (on the lower track, where only the route lies on top)
  await rightClick(page, 350, 60);
  await expect(page.locator('#context-menu [data-state-cmd="setRoute"]')).toBeVisible();
  await page.locator('#context-menu [data-state-cmd="setRoute"]').click();
  expect(await attr(page, 'r1', 'rdState')).toBe('reserved');
  expect(await attr(page, 'tc1', 'rdState')).toBe('reserved');
  expect(await attr(page, 'tc3', 'rdState')).toBe('reserved');
  expect(await attr(page, 'tc2', 'rdState')).toBe('');
  expect(await attr(page, 'w1', 'rdPosition')).toBe('reverse');
  expect(await attr(page, 's1', 'rdAspect')).toBe('proceed');
  expect((await rendered(page, 'tc1')).stroke).toBe('#009e00');
  expect((await rendered(page, 'r1')).stroke).toBe('#009e00');
  expect((await rendered(page, 's1a')).fill).toBe('#00c853');
  await page.locator('#graph-container').screenshot({ path: 'test-results/object-states/light-route-set.png' });

  // Railway > Object State > Occupy Route (route still selected)
  await clickMenuItem(page, 'railway', 'railwayState:occupyRoute');
  expect(await attr(page, 'tc1', 'rdState')).toBe('occupied');
  expect(await attr(page, 'r1', 'rdState')).toBe('occupied');
  expect(await attr(page, 's1', 'rdAspect')).toBe('stop');
  expect((await rendered(page, 'tc3')).stroke).toBe('#ff0000');

  // Release: free, stop, points back to normal (the position before Set Route)
  await rightClick(page, 350, 60);
  await page.locator('#context-menu [data-state-cmd="releaseRoute"]').click();
  expect(await attr(page, 'r1', 'rdState')).toBe('free');
  expect(await attr(page, 'tc1', 'rdState')).toBe('free');
  expect(await attr(page, 'w1', 'rdPosition')).toBe('normal');
  expect(await styleKey(page, 'tc1', 'strokeColor')).toBe('#000000');

  // Legend (Railway > Object State > State Legend), kept over the canvas
  await clickMenuItem(page, 'railway', 'railwayState:toggleLegend');
  const legend = page.locator('[data-testid="state-legend"]');
  await expect(legend).toBeVisible();
  await expect(legend).toContainText('Occupied');
  await expect(legend).toContainText('Proceed');
  await expect(page.locator('.menu-dropdown-item[data-action="railwayState:toggleLegend"]')).toHaveAttribute('aria-checked', 'true');

  // Scenario: step 1 = all free, step 2 = TC2 occupied + S2 proceed -> "Show changes" names them
  await page.locator('[data-right-panel="scenarios"]').click();
  const panel = page.locator('#scenarios-panel');
  await panel.locator('.rd-scn-new').click();
  const dialog = page.locator('.rd-tpl-modal');
  await dialog.locator('input[name="template-name"]').fill('Occupancy');
  await dialog.locator('.rd-tpl-btn-primary').click();
  await expect(dialog).toHaveCount(0);
  for (const name of ['Free', 'Occupied']) {
    if (name === 'Occupied') {
      await rightClick(page, 400, 100);
      await pickState(page, 'state', 'occupied');
      await rightClick(page, 450, 120);
      await pickState(page, 'aspect', 'proceed');
    }
    await panel.locator('.rd-scn-add-step').click();
    const editor = page.locator('[data-testid="scenario-step-editor"]');
    await editor.locator('input[name="template-name"]').fill(name);
    await editor.locator('.rd-tpl-btn-primary').click();
    await expect(editor).toHaveCount(0);
  }
  await panel.locator('.rd-scn-step').nth(1).click();
  await expect(page.locator('[data-testid="scenario-view"]')).toBeVisible();
  await page.locator('.rd-scn-diff-toggle').check();
  const changes = page.locator('[data-testid="scenario-side-panel"] .rd-scn-side-changes li');
  await expect(changes.filter({ hasText: 'TC2: free → occupied' })).toHaveCount(1);
  await expect(changes.filter({ hasText: 'S2: aspect stop → proceed' })).toHaveCount(1);
  await expect(changes).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid="scenario-view"]')).toBeHidden();

  // Dark theme: the stored colours are drawn unchanged (saturated colours are kept)
  await clickMenuItem(page, 'view', 'toggleDarkMode');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect((await rendered(page, 'tc2')).stroke).toBe('#ff0000');
  expect((await rendered(page, 's2')).fill).toBe('#00c853');
  expect(await styleKey(page, 'tc2', 'strokeColor')).toBe('#ff0000');
  await rightClick(page, 350, 60);
  await page.locator('#context-menu [data-state-cmd="setRoute"]').click();
  expect((await rendered(page, 'tc1')).stroke).toBe('#009e00');
  await page.locator('#graph-container').screenshot({ path: 'test-results/object-states/dark-route-set.png' });

  // Reset All States
  await clickMenuItem(page, 'railway', 'railwayState:resetAll');
  for (const id of ['tc1', 'tc2', 'tc3', 'r1']) expect(await attr(page, id, 'rdState')).toBe('');
  expect(await attr(page, 's2', 'rdAspect')).toBe('');
  expect(errors).toEqual([]);
});
