/**
 * @file ux-batch3.spec.ts
 * @brief UX batch 3: double-click edits a railway ID in place (references renumbered), draw.io-blue selection,
 *        railway templates open zoomed in (>= 150 %), one selection box after a template insert (a drag moves
 *        all), route tool guidance (reachable exits), one-click scenario step + inline rename (and the step view
 *        is not blank on a zoomed / scrolled drawing), Arrange / Edit menu items, Esc closes More shapes (F1 not
 *        over a modal), no 404 on load (folding icons), compact left tab strip. Runs on any port.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { clickMenuItem, openLeftTab } from './menu-helpers';

const PALETTE = '#drawio-palette-container';

async function inGraph<T>(page: Page, body: string, arg?: unknown): Promise<T> {
  return page.evaluate(async ({ body, arg }) => {
    const registry = await import('/src/services/service-registry.ts' as string);
    const tab = registry.ServiceRegistry.getTabManager().getActiveTab();
    return new Function('graph', 'tab', 'arg', body)(tab.graph, tab, arg);
  }, { body, arg }) as Promise<T>;
}

async function fresh(page: Page, width = 1440, height = 900): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
  await page.locator(`${PALETTE} section[data-palette-id="ertms"] .rd-dp-item`).first().waitFor();
}

/** Railway data attributes of the object with this rdId (any layer). */
function attrsOf(page: Page, rdId: string): Promise<Record<string, string> | null> {
  return inGraph(page, `
    const all = Object.values(graph.getDataModel().cells);
    const cell = all.find((c) => c.value && c.value.nodeType === 1 && c.value.getAttribute('rdId') === arg);
    if (!cell) return null;
    const out = { cellId: cell.id };
    for (const a of Array.from(cell.value.attributes)) if (a.name.startsWith('rd') || a.name === 'label') out[a.name] = a.value;
    return out;`, rdId);
}

/** Client point of the centre of the cell with this id (scrolled into view). */
function cellCenterClient(page: Page, cellId: string): Promise<{ x: number; y: number }> {
  return inGraph(page, `
    const cell = graph.getDataModel().getCell(arg);
    graph.scrollCellToVisible(cell, true);
    const st = graph.view.getState(cell);
    const c = graph.container, r = c.getBoundingClientRect();
    return { x: r.left + c.clientLeft + st.getCenterX() - c.scrollLeft, y: r.top + c.clientTop + st.getCenterY() - c.scrollTop };`, cellId);
}

const railObj = (id: string, attrs: string, style: string, geo: string, edge = false): string =>
  `<object label="" id="${id}" ${attrs}><mxCell style="${style}" ${edge ? 'edge="1"' : 'vertex="1"'} parent="1">${geo}</mxCell></object>`;
const railLine = (x1: number, y1: number, x2: number, y2: number): string =>
  `<mxGeometry relative="1" as="geometry"><mxPoint x="${x1}" y="${y1}" as="sourcePoint"/><mxPoint x="${x2}" y="${y2}" as="targetPoint"/></mxGeometry>`;
const railBox = (cx: number, cy: number): string => `<mxGeometry x="${cx - 10}" y="${cy - 10}" width="20" height="20" as="geometry"/>`;
const TRACK = 'endArrow=none;html=1;strokeWidth=4;';
const SIGNAL = 'triangle;whiteSpace=wrap;html=1;fillColor=#000000;';
/** ertms-routes.spec.ts layout plus S4 facing the other way (no exit for S1, no route from it). */
const RAIL_LAYOUT = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
${railObj('t1', 'rdKind="track" rdId="T1" rdKmStart="10" rdKmEnd="10.5"', TRACK, railLine(0, 100, 500, 100), true)}
${railObj('t2', 'rdKind="track" rdId="T2" rdKmStart="20" rdKmEnd="20.35"', TRACK, railLine(150, 180, 500, 180), true)}
${railObj('w1', 'rdKind="points" rdId="W1" rdPosition="normal" rdTrackId="T1"', TRACK, railLine(150, 100, 230, 180), true)}
${railObj('s1', 'rdKind="signal" rdId="S1" rdDirection="nominal" rdTrackId="T1"', SIGNAL, railBox(40, 114))}
${railObj('s2', 'rdKind="signal" rdId="S2" rdDirection="nominal" rdTrackId="T1"', SIGNAL, railBox(450, 114))}
${railObj('s3', 'rdKind="signal" rdId="S3" rdDirection="nominal" rdTrackId="T2"', SIGNAL, railBox(440, 194))}
${railObj('s4', 'rdKind="signal" rdId="S4" rdDirection="reverse" rdTrackId="T1"', `${SIGNAL}direction=west;`, railBox(320, 86))}
</root></mxGraphModel>`;

async function loadLayout(page: Page): Promise<void> {
  await inGraph(page, 'tab.saveLoadController.load(arg);', RAIL_LAYOUT);
  await expect.poll(() => inGraph<number>(page, 'return graph.getDefaultParent().children.length;')).toBe(7);
}

async function clickCell(page: Page, cellId: string): Promise<void> {
  const p = await cellCenterClient(page, cellId);
  await page.mouse.click(p.x, p.y);
}

/** Colours (stroke/fill) drawn in the overlay pane (selection borders, handles). */
function overlayColours(page: Page): Promise<string[]> {
  return inGraph<string[]>(page, `
    const pane = graph.view.getOverlayPane();
    const out = new Set();
    for (const el of pane.querySelectorAll('*')) for (const a of ['stroke', 'fill']) {
      const v = el.getAttribute(a);
      if (v && v !== 'none' && v !== 'transparent') out.add(v.toLowerCase());
    }
    return [...out];`);
}

test.describe('UX batch 3', () => {
  test('double-click edits a railway ID in place; references follow; Shift opens Data; plain shapes edit labels', async ({ page }) => {
    await fresh(page);
    await loadLayout(page);
    // a route S1 -> S3 with the route tool
    await page.locator('#btn-route-tool').click();
    await clickCell(page, 's1');
    await clickCell(page, 's3');
    await page.locator('.rd-route-tool .rd-route-create').click();
    await expect.poll(async () => (await attrsOf(page, 'R1'))?.rdEntrySignal).toBe('S1');
    await page.keyboard.press('Escape');
    await expect(page.locator('.rd-route-tool')).toHaveCount(0);

    // double-click S1 -> ID field with S1, rename to S10 (Enter)
    const s1 = await cellCenterClient(page, 's1');
    await page.mouse.dblclick(s1.x, s1.y);
    const editor = page.getByTestId('rd-id-editor');
    await expect(editor).toBeFocused();
    await expect(editor).toHaveValue('S1');
    await editor.fill('S10');
    await page.keyboard.press('Enter');
    await expect(editor).toHaveCount(0);
    expect((await attrsOf(page, 'S10'))?.cellId).toBe('s1');
    expect((await attrsOf(page, 'R1'))?.rdEntrySignal).toBe('S10');
    // one undo step
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => (await attrsOf(page, 'R1'))?.rdEntrySignal).toBe('S1');
    await page.keyboard.press('ControlOrMeta+y');
    await expect.poll(async () => (await attrsOf(page, 'R1'))?.rdEntrySignal).toBe('S10');

    // a duplicate ID is refused, the field stays open with the reason; Esc cancels
    const s2 = await cellCenterClient(page, 's2');
    await page.mouse.dblclick(s2.x, s2.y);
    await editor.fill('s3');
    await page.keyboard.press('Enter');
    await expect(editor).toHaveAttribute('aria-invalid', 'true');
    await expect(editor).toHaveAttribute('title', /already used by another signal/);
    await page.keyboard.press('Escape');
    await expect(editor).toHaveCount(0);
    expect((await attrsOf(page, 'S2'))?.cellId).toBe('s2');

    // Shift+double-click opens the Data panel for the object
    await page.mouse.click(s2.x, s2.y);
    await page.keyboard.down('Shift');
    await page.mouse.dblclick(s2.x, s2.y);
    await page.keyboard.up('Shift');
    await expect(page.locator('#railway-data-panel')).toBeVisible();
    await expect(editor).toHaveCount(0);

    // plain draw.io shapes keep label editing
    const rect = await inGraph<string>(page, "return graph.insertVertex({ parent: graph.getDefaultParent(), value: 'Box', position: [100, 300], size: [120, 60] }).id;");
    const r = await cellCenterClient(page, rect);
    await page.mouse.dblclick(r.x, r.y);
    await expect(page.locator('body > textarea')).toHaveValue('Box');
    await expect(editor).toHaveCount(0);
    await page.keyboard.press('Escape');
    // diagram labels are not text-selectable
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('.rd-graph-canvas svg')!).userSelect)).toBe('none');
  });

  test('selection in draw.io blue on the light and the dark canvas, never green', async ({ page }) => {
    await fresh(page);
    const id = await inGraph<string>(page, "const v = graph.insertVertex({ parent: graph.getDefaultParent(), value: 'A', position: [100, 100], size: [120, 60] }); graph.setSelectionCell(v); return v.id;");
    expect(id).toBeTruthy();
    let colours = await overlayColours(page);
    expect(colours).toContain('#0f8bd0');
    expect(colours.filter((c) => c === '#00ff00')).toEqual([]);
    await clickMenuItem(page, 'view', 'toggleDarkMode');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await inGraph(page, 'graph.clearSelection(); graph.setSelectionCell(graph.getDefaultParent().children[0]);');
    colours = await overlayColours(page);
    expect(colours).toContain('#29b6f2');
    expect(colours.filter((c) => c === '#00ff00')).toEqual([]);
    await page.locator('#graph-container').screenshot({ path: test.info().outputPath('selection-dark.png') });
  });

  test('a template opens zoomed in (150-200 %); inserted into a drawing it is one selection box and a drag moves it all', async ({ page }) => {
    await fresh(page);
    await openLeftTab(page, 'templates');
    const tile = page.locator('#templates-panel .rd-tpl-tile:visible').first();
    await tile.click();
    await page.locator('.rd-tpl-popover [data-action="open"]').click();
    await expect.poll(() => page.locator('#tabs-container .tab-button').count()).toBe(2);
    await expect.poll(() => inGraph<number>(page, 'return graph.view.scale;')).toBeGreaterThanOrEqual(1.5);
    expect(await inGraph<number>(page, 'return graph.view.scale;')).toBeLessThanOrEqual(2);

    // a drawing with one rectangle (not empty: no zoom), then insert the template
    await page.locator('#tabs-container .tab-button').first().click();
    await inGraph(page, "graph.insertVertex({ parent: graph.getDefaultParent(), value: 'X', position: [40, 40], size: [80, 40] }); graph.clearSelection();");
    await tile.click();
    await page.locator('.rd-tpl-popover [data-action="insert"]').click();
    await expect.poll(() => inGraph<number>(page, 'return graph.getSelectionCount();')).toBeGreaterThan(10);
    expect(await inGraph<number>(page, 'return graph.view.scale;')).toBe(1);
    const box = page.locator('#graph-container .rd-multi-selection-box');
    await expect(box).toHaveCount(1);
    expect(await inGraph<number>(page, "return graph.getSelectionCells().filter((c) => graph.getPlugin('SelectionCellsHandler').getHandler(c)).length;")).toBe(0);
    await page.mouse.move(10, 10);
    await page.locator('#graph-container').screenshot({ path: test.info().outputPath('template-inserted.png') });

    // drag one selected shape: every selected cell moves by the same delta
    const before = await inGraph<Record<string, [number, number]>>(page, `
      const out = {};
      // top-level selected cells (children of a selected group keep their relative geometry)
      const sel = new Set(graph.getSelectionCells());
      const top = (c) => { for (let p = c.parent; p; p = p.parent) if (sel.has(p)) return false; return true; };
      for (const c of sel) { const g = c.getGeometry(); if (g && !g.relative && top(c)) out[c.id] = [g.x, g.y]; }
      return out;`);
    const target = await inGraph<string>(page, `
      const cells = graph.getSelectionCells().filter((c) => c.isVertex());
      cells.sort((a, b) => b.getGeometry().width * b.getGeometry().height - a.getGeometry().width * a.getGeometry().height);
      return cells[0].id;`);
    const from = await cellCenterClient(page, target);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 30, from.y + 20, { steps: 5 });
    await page.mouse.move(from.x + 60, from.y + 40, { steps: 5 });
    await page.mouse.up();
    await expect.poll(() => inGraph<number>(page, `const g = graph.getDataModel().getCell(arg).getGeometry(); return g.x;`, target)).not.toBe(before[target][0]);
    const after = await inGraph<Record<string, [number, number]>>(page, `
      const out = {};
      for (const id of Object.keys(arg)) { const g = graph.getDataModel().getCell(id).getGeometry(); out[id] = [g.x, g.y]; }
      return out;`, before);
    const deltas = new Set(Object.keys(before).map((k) => `${Math.round(after[k][0] - before[k][0])},${Math.round(after[k][1] - before[k][1])}`));
    expect([...deltas]).toHaveLength(1);
    expect([...deltas][0]).not.toBe('0,0');
  });

  test('route tool: reachable exit signals highlighted, the rest dimmed, "no route" before a click, Esc cancels', async ({ page }) => {
    await fresh(page);
    await loadLayout(page);
    await page.locator('#btn-route-tool').click();
    const tool = page.locator('.rd-route-tool');
    await clickCell(page, 's1');
    await expect(tool.locator('.rd-route-status')).toContainText('Start: S1 — click one of the 2 highlighted exit signals (S2, S3)');
    const targets = page.locator('.rd-route-overlay .rd-route-hl-target');
    await expect(targets).toHaveCount(2);
    expect((await targets.evaluateAll((n) => n.map((e) => e.getAttribute('data-signal')))).sort()).toEqual(['S2', 'S3']);
    await expect(page.locator('.rd-route-overlay .rd-route-dim')).toHaveCount(1);
    await expect(page.locator('.rd-route-overlay .rd-route-dim')).toHaveAttribute('data-signal', 'S4');
    await page.screenshot({ path: test.info().outputPath('route-guidance.png') });
    // Esc cancels the start signal, the tool stays
    await page.keyboard.press('Escape');
    await expect(tool.locator('.rd-route-status')).toHaveText('Click the start (entry) signal.');
    await expect(targets).toHaveCount(0);
    // S4 faces left: nothing to reach, said before any further click
    await clickCell(page, 's4');
    await expect(tool.locator('.rd-route-status')).toContainText('no route in the signal direction');
    await expect(page.locator('.rd-route-overlay .rd-route-dim')).toHaveCount(3);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(tool).toHaveCount(0);
  });

  test('one-click scenario step with inline rename and details; the step view shows a zoomed, scrolled drawing', async ({ page }) => {
    await fresh(page);
    await loadLayout(page);
    await page.locator('[data-right-panel="scenarios"]').click();
    const panel = page.locator('#scenarios-panel');
    await expect(panel.locator('.rd-scn-new')).toBeVisible();
    await panel.locator('.rd-scn-new').click();
    await page.locator('.rd-tpl-modal input[name="template-name"]').fill('Wjazd');
    await page.locator('.rd-tpl-modal .rd-tpl-btn-primary').click();
    await expect(panel.locator('.rd-scn-add-hint')).toContainText('object states first');
    // one click: captured as "Step 1", the name field focused in the row (no dialog)
    await panel.locator('.rd-scn-add-step').click();
    const nameInput = page.getByTestId('scenario-step-name-input');
    await expect(nameInput).toBeFocused();
    await expect(nameInput).toHaveValue('Step 1');
    await expect(page.locator('[data-testid="scenario-step-editor"]')).toHaveCount(0);
    await page.keyboard.type('Pociąg wjeżdża');
    await page.keyboard.press('Enter');
    await expect(panel.locator('.rd-scn-step-name')).toHaveText(['Pociąg wjeżdża']);
    // second step: Esc keeps the default name
    await inGraph(page, "graph.moveCells([graph.getDataModel().getCell('s2')], 0, 40);");
    await panel.locator('.rd-scn-add-step').click();
    await expect(nameInput).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(panel.locator('.rd-scn-step-name')).toHaveText(['Pociąg wjeżdża', 'Step 2']);
    // optional details in the row
    await panel.locator('.rd-scn-step-details-toggle').nth(1).click();
    const details = page.getByTestId('scenario-step-details');
    await details.locator('textarea[name="step-inline-text"]').fill('# Krok 2\n- S2 przesunięty');
    await details.locator('input[name="step-inline-description"]').click();
    await expect(panel.locator('.rd-scn-step').nth(1).locator('.rd-scn-badge-text')).toHaveCount(1);
    // the dialog is still there for previews: Edit… in the row
    await details.locator('.rd-scn-step-open-editor').click();
    await expect(page.locator('[data-testid="scenario-step-editor"] textarea[name="step-text"]')).toHaveValue('# Krok 2\n- S2 przesunięty');
    await page.keyboard.press('Escape');

    // step view of a zoomed and scrolled drawing: the drawing is in view (was blank)
    // (the live view away from the origin: zoomed in and scrolled to S2)
    await inGraph(page, "graph.zoomTo(1.8, true); graph.scrollCellToVisible(graph.getDataModel().getCell('s2'), true);");
    expect(await inGraph<number>(page, 'return graph.container.scrollLeft;')).toBeGreaterThan(100);
    const view = page.locator('[data-testid="scenario-view"]');
    await expect(async () => {
      await panel.locator('.rd-scn-step').nth(1).locator('.rd-scn-step-num').click();
      await expect(view).toBeVisible({ timeout: 1000 });
    }).toPass();
    await expect.poll(() => view.evaluate((v) => {
      const host = v.querySelector('.rd-scn-view-host') as HTMLElement;
      const hr = host.getBoundingClientRect();
      let visible = 0;
      for (const e of Array.from(host.querySelectorAll('svg path, svg rect, svg ellipse'))) {
        const r = e.getBoundingClientRect();
        if (r.width + r.height >= 2 && r.right > hr.left && r.left < hr.right && r.bottom > hr.top && r.top < hr.bottom) visible++;
      }
      return visible;
    })).toBeGreaterThan(3);
    await page.screenshot({ path: test.info().outputPath('scenario-view.png') });
    await page.locator('.rd-scn-exit').click();
    await expect(view).toBeHidden();
  });

  test('Arrange and Edit menus like draw.io', async ({ page }) => {
    await fresh(page);
    const ids = await inGraph<string[]>(page, `
      const p = graph.getDefaultParent();
      const a = graph.insertVertex({ parent: p, value: 'A', position: [100, 100], size: [80, 40] });
      const b = graph.insertVertex({ parent: p, value: 'B', position: [260, 160], size: [80, 60] });
      graph.insertEdge({ parent: p, source: a, target: b });
      graph.setSelectionCells([a, b]);
      return [a.id, b.id];`);
    const geo = (id: string): Promise<{ x: number; y: number; w: number; h: number }> =>
      inGraph(page, 'const g = graph.getDataModel().getCell(arg).getGeometry(); return { x: g.x, y: g.y, w: g.width, h: g.height };', id);
    const style = (id: string): Promise<Record<string, unknown>> => inGraph(page, 'return { ...graph.getDataModel().getCell(arg).getStyle() };', id);
    const select = (list: string[]): Promise<void> => inGraph(page, 'graph.setSelectionCells(arg.map((id) => graph.getDataModel().getCell(id)));', list);

    // Align ▸ Top / Distribute ▸ Horizontally
    await clickMenuItem(page, 'arrange', 'alignTop');
    expect((await geo(ids[1])).y).toBe((await geo(ids[0])).y);
    await clickMenuItem(page, 'arrange', 'alignMiddle');
    await clickMenuItem(page, 'arrange', 'distributeHorizontally');
    // Group / Ungroup
    await select(ids);
    await clickMenuItem(page, 'arrange', 'group');
    // like draw.io, the edge between the grouped shapes goes into the group too
    await expect.poll(() => inGraph<number>(page, 'return graph.getSelectionCell().getChildCount();')).toBe(3);
    await clickMenuItem(page, 'arrange', 'ungroup');
    await expect.poll(() => inGraph<number>(page, 'return graph.getSelectionCount();')).toBe(3);
    // Rotate 90°, Flip, Lock/Unlock
    await select([ids[0]]);
    await clickMenuItem(page, 'arrange', 'rotate90');
    expect((await style(ids[0])).rotation).toBe(90);
    await clickMenuItem(page, 'arrange', 'flipHorizontal');
    expect((await style(ids[0])).flipH).toBe(true);
    await clickMenuItem(page, 'arrange', 'flipVertical');
    expect((await style(ids[0])).flipV).toBe(true);
    await clickMenuItem(page, 'arrange', 'toggleLock');
    expect((await style(ids[0])).locked).toBeTruthy();
    await clickMenuItem(page, 'arrange', 'rotate90');
    expect((await style(ids[0])).rotation).toBe(90);
    await clickMenuItem(page, 'arrange', 'toggleLock');
    expect((await style(ids[0])).locked).toBeFalsy();
    // one undo step per command
    await page.keyboard.press('ControlOrMeta+z');
    expect((await style(ids[0])).locked).toBeTruthy();

    // Edit: Duplicate (+ shortcut hint), Select Vertices / Edges / None
    await expect(page.locator('.menu-dropdown[data-menu="edit"] [data-action="duplicate"] .rd-kbd')).toHaveText(/D$/);
    await select([ids[1]]);
    const count = await inGraph<number>(page, 'return graph.getDefaultParent().children.length;');
    await clickMenuItem(page, 'edit', 'duplicate');
    await expect.poll(() => inGraph<number>(page, 'return graph.getDefaultParent().children.length;')).toBe(count + 1);
    await clickMenuItem(page, 'edit', 'selectEdges');
    expect(await inGraph<boolean[]>(page, 'return graph.getSelectionCells().map((c) => c.isEdge());')).toEqual([true]);
    await clickMenuItem(page, 'edit', 'selectVertices');
    expect(await inGraph<number>(page, 'return graph.getSelectionCells().filter((c) => c.isVertex()).length;')).toBe(3);
    await clickMenuItem(page, 'edit', 'selectNone');
    expect(await inGraph<number>(page, 'return graph.getSelectionCount();')).toBe(0);
    // keyboard: Ctrl/Cmd+Shift+E selects the edges, Ctrl/Cmd+Shift+A none
    await page.locator('#graph-container').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('ControlOrMeta+Shift+E');
    await expect.poll(() => inGraph<number>(page, 'return graph.getSelectionCount();')).toBe(1);
    await page.keyboard.press('ControlOrMeta+Shift+A');
    await expect.poll(() => inGraph<number>(page, 'return graph.getSelectionCount();')).toBe(0);

    // the submenus follow the menubar keyboard pattern: Arrange, ↓ to "Align", → opens it
    await page.locator('.menu-item[data-menu="arrange"]').click();
    const align = page.locator('.menu-dropdown[data-menu="arrange"] .menu-submenu[data-submenu="align"] .menu-submenu-title');
    await expect(align).toHaveAttribute('aria-haspopup', /.+/);
    await page.keyboard.press('Escape');
  });

  test('Esc closes More shapes; F1 does not open over a dialog; no 404 on load; compact left tabs', async ({ page }) => {
    const failed: string[] = [];
    page.on('response', (r) => {
      if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
    });
    await fresh(page);
    // groups render (folding icons) in the palette and on the canvas
    await page.locator(`${PALETTE} section[data-palette-id="ertms"] .rd-dp-item[title="Signal Right 3"]`).click();
    await page.waitForTimeout(500);
    expect(failed).toEqual([]);

    // More shapes: Esc closes it
    await page.locator(`${PALETTE} .rd-dp-more`).click();
    const more = page.locator(`${PALETTE} .rd-dp-menu`);
    await expect(more).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(more).toBeHidden();
    // the selection stays (Esc went to the dialog, not to the canvas)
    expect(await inGraph<number>(page, 'return graph.getSelectionCount();')).toBe(1);

    // F1 never over an open dialog
    await clickMenuItem(page, 'file', 'saveAs');
    const saveAs = page.locator('.rd-tpl-modal[role="dialog"], [role="dialog"][aria-modal="true"]').first();
    await expect(saveAs).toBeVisible();
    await page.keyboard.press('F1');
    await expect(page.getByTestId('shortcuts-dialog')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="dialog"][aria-modal="true"]')).toHaveCount(0);
    await page.locator('#graph-container').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('F1');
    await expect(page.getByTestId('shortcuts-dialog')).toBeVisible();
    await page.keyboard.press('Escape');

    // 1440 px: every common tab fits the left strip (inactive ones as icons with tooltips)
    await expect(page.locator('.left-panel-tab-more')).toBeHidden();
    await expect(page.locator('.left-panel-tab-btn[data-tab="railwayScript"]')).toBeVisible();
    await expect(page.locator('.left-panel-tab-btn[data-tab="railwayScript"]')).toHaveAttribute('title', /Railway Script/);
    // the right switch labels keep their own space
    const gaps = await page.locator('.right-panel-switch-btn').evaluateAll((btns) => btns.map((b) => {
      const span = document.createRange();
      span.selectNodeContents(b);
      const text = span.getBoundingClientRect();
      const box = b.getBoundingClientRect();
      return Math.round(text.left - box.left);
    }));
    expect(gaps.every((g) => g >= 4)).toBe(true);
    expect(failed).toEqual([]);
  });
});
