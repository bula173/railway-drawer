/**
 * @file ux-batch2a.spec.ts
 * @brief UX batch 2a: the Railway menu (mouse + keyboard), File > Import / Export submenus (nested,
 *        WAI-ARIA keys), the toolbar (SVG icons only, accessible names, shortcut tooltips, grid toggle
 *        in step with View > Grid, Align/Distribute dropdown, no freehand tools), collapsible and
 *        resizable side panels (toolbar, View menu, Ctrl/Cmd+Shift+K / P, remembered after reload,
 *        `body.rd-narrow` hook) and the left tab strip's "»" overflow menu.
 *
 * Runs on any port.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { clickMenuItem } from './menu-helpers';

async function freshApp(page: Page, storage: Record<string, string> = {}): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.evaluate((items) => {
    localStorage.clear();
    for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v);
  }, storage);
  await page.reload();
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
}

const focused = (page: Page): Promise<{ action: string | null; text: string }> =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return {
      action: el?.getAttribute('data-action') ?? null,
      text: (el?.querySelector('.rd-menu-label')?.textContent ?? el?.textContent ?? '').trim(),
    };
  });

test('Railway menu: route tools, data, checks and toggles; mouse and keyboard; gone from View/Extras', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await freshApp(page);
  const railway = page.locator('.menu-item[data-menu="railway"]');
  await expect(page.locator('#menu-bar .menu-item')).toHaveText(['File', 'Edit', 'View', 'Arrange', 'Railway', 'Extras', 'Help']);

  // mouse
  await railway.click();
  const dropdown = page.locator('.menu-dropdown[data-menu="railway"]');
  await expect(dropdown).toBeVisible();
  const actions = await dropdown.locator('.menu-dropdown-item').evaluateAll((items) => items.map((i) => i.getAttribute('data-action')));
  expect(actions).toEqual([
    'railwayRoute:tool',
    'railwayRoute:routeTable',
    'railwayRoute:conflictTable',
    'railwayRoute:updateRoutes',
    'railwayRoute:recalcKm',
    'editData',
    'railwayChecks',
    'railwayScriptEditor',
    // Railway > Object State ▸ (nested submenus, src/railway/install-railway-states.ts)
    'railwayState:state:free',
    'railwayState:state:occupied',
    'railwayState:state:reserved',
    'railwayState:state:overlap',
    'railwayState:state:locked',
    'railwayState:state:disturbed',
    'railwayState:aspect:stop',
    'railwayState:aspect:proceed',
    'railwayState:aspect:caution',
    'railwayState:aspect:shunt',
    'railwayState:aspect:dark',
    'railwayState:position:normal',
    'railwayState:position:reverse',
    'railwayState:position:moving',
    'railwayState:position:outOfControl',
    'railwayState:setRoute',
    'railwayState:occupyRoute',
    'railwayState:releaseRoute',
    'railwayState:occupyUnderTrain',
    'railwayState:reset',
    'railwayState:resetAll',
    'railwayState:toggleLegend',
    'railwayRoute:toggleSnap',
    'railwayRoute:toggleRoutes',
    'railwayRoute:toggleKmRuler',
  ]);
  await dropdown.locator('[data-action="railwayChecks"]').click();
  await expect(page.locator('#railway-checks-panel')).toBeVisible();
  await clickMenuItem(page, 'railway', 'railwayScriptEditor');
  await expect(page.locator('[data-testid="railway-script-text"]')).toBeVisible();

  // nothing railway left in View / Extras, no "Edit Style" in Extras, no emoji in the menus
  for (const menu of ['view', 'extras']) {
    const items = await page.locator(`.menu-dropdown[data-menu="${menu}"] .menu-dropdown-item`).evaluateAll((n) => n.map((i) => i.getAttribute('data-action') ?? ''));
    expect(items.filter((a) => a.startsWith('railway') || a === 'editData' || a === 'editStyle')).toEqual([]);
  }
  const menuText = await page.locator('#menu-bar').evaluate((n) => n.textContent ?? '');
  expect(menuText).not.toMatch(/\p{Extended_Pictographic}/u);

  // keyboard: File -> ... -> Railway, ↓ opens on Route Tool, End = km Ruler, Enter toggles it
  await page.locator('.menu-item[data-menu="file"]').focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await expect(railway).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(dropdown).toBeVisible();
  expect((await focused(page)).action).toBe('railwayRoute:tool');
  await page.keyboard.press('End');
  expect((await focused(page)).action).toBe('railwayRoute:toggleKmRuler');
  const ruler = dropdown.locator('[data-action="railwayRoute:toggleKmRuler"]');
  await expect(ruler).toHaveAttribute('aria-checked', 'false');
  await page.keyboard.press('Enter');
  await expect(dropdown).toBeHidden();
  await expect(ruler).toHaveAttribute('aria-checked', 'true');
  // the toolbar's km ruler button follows
  await expect(page.locator('#btn-km-ruler')).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('File menu: Import / Export submenus (nested) by mouse and keyboard', async ({ page }) => {
  await freshApp(page);
  const file = page.locator('.menu-item[data-menu="file"]');
  const top = await page.locator('.menu-dropdown[data-menu="file"]').evaluate((d) =>
    Array.from(d.children)
      .filter((c) => c.matches('.menu-dropdown-item, .menu-submenu'))
      .map((c) => c.getAttribute('data-action') ?? `▸${c.getAttribute('data-submenu')}`)
  );
  expect(top).toEqual(['new', 'open', 'save', 'saveAs', 'saveAsTemplate', '▸import', '▸export', 'share', 'print']);

  // mouse: Export > Railway Data > ...
  await file.click();
  await expect(page.locator('[data-action="exportRailway:signals"]')).toBeHidden();
  await page.locator('.menu-submenu[data-submenu="export"] > .menu-submenu-title').hover();
  await expect(page.locator('[data-action="exportPng"]')).toBeVisible();
  await page.locator('.menu-submenu[data-submenu="export-railway-data"] > .menu-submenu-title').hover();
  await expect(page.locator('[data-action="exportRailway:xlsx"]')).toBeVisible();
  await page.locator('.menu-submenu[data-submenu="export-scenario"] > .menu-submenu-title').hover();
  await expect(page.locator('[data-action="exportScenarioPdf"]')).toBeVisible();
  await expect(page.locator('[data-action="exportRailway:xlsx"]')).toBeHidden();
  await page.keyboard.press('Escape');

  // Export > Download .drawio still downloads the diagram
  const [download] = await Promise.all([page.waitForEvent('download'), clickMenuItem(page, 'file', 'export')]);
  expect(download.suggestedFilename()).toMatch(/\.drawio$/);

  // keyboard: → opens a submenu on its first item, ← / Esc go back to its title
  await file.focus();
  await page.keyboard.press('ArrowDown');
  expect((await focused(page)).action).toBe('new');
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowDown');
  expect(await focused(page)).toEqual({ action: null, text: 'Import' });
  const importTitle = page.locator('.menu-submenu[data-submenu="import"] > .menu-submenu-title');
  await expect(importTitle).toHaveAttribute('aria-haspopup', 'menu');
  await page.keyboard.press('ArrowRight');
  expect((await focused(page)).action).toBe('importDrawio');
  await expect(importTitle).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('End');
  expect((await focused(page)).action).toBe('importImage');
  await page.keyboard.press('ArrowLeft');
  expect(await focused(page)).toEqual({ action: null, text: 'Import' });
  await page.keyboard.press('ArrowDown');
  expect(await focused(page)).toEqual({ action: null, text: 'Export' });
  await page.keyboard.press('ArrowRight');
  expect((await focused(page)).action).toBe('export');
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowDown');
  expect(await focused(page)).toEqual({ action: null, text: 'Railway Data' });
  await page.keyboard.press('Enter');
  expect((await focused(page)).action).toBe('exportRailway:signals');
  await page.keyboard.press('Escape');
  expect(await focused(page)).toEqual({ action: null, text: 'Railway Data' });
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  expect((await focused(page)).action).toBe('exportScenarioPdf');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  expect(await focused(page)).toEqual({ action: null, text: 'Export' });
  await page.keyboard.press('Escape');
  await expect(page.locator('.menu-dropdown[data-menu="file"]')).toBeHidden();
  await expect(file).toBeFocused();

  // Import > Image as Custom Shape… opens the image upload dialog
  await clickMenuItem(page, 'file', 'importImage');
  await expect(page.locator('#image-upload-modal')).toBeVisible();
});

test('toolbar: SVG icons only, accessible names with shortcuts, grid toggle, align dropdown, no freehand tools', async ({ page }) => {
  await freshApp(page);
  const toolbar = page.locator('#toolbar-container');
  expect(await toolbar.evaluate((n) => n.textContent ?? '')).not.toMatch(/\p{Extended_Pictographic}/u);
  const buttons = await toolbar.locator('button').evaluateAll((list) =>
    list
      .filter((b) => (b as HTMLElement).offsetParent !== null)
      .map((b) => {
        const r = b.getBoundingClientRect();
        const disabled = (b as HTMLButtonElement).disabled;
        return { id: b.id, label: b.getAttribute('aria-label') ?? '', title: b.getAttribute('title') ?? '', w: r.width, h: r.height, svg: !!b.querySelector('svg'), disabled };
      })
  );
  expect(buttons.length).toBeGreaterThanOrEqual(15);
  for (const b of buttons) {
    expect(b.label, b.id).not.toBe('');
    // disabled Undo/Redo say "Nothing to undo" (undoredo.ts)
    if (!b.disabled) expect(b.title.startsWith(b.label), b.id).toBe(true);
    else expect(b.title, b.id).not.toBe('');
    expect(b.svg, b.id).toBe(true);
    expect(b.w, b.id).toBeGreaterThanOrEqual(24);
    expect(b.h, b.id).toBeGreaterThanOrEqual(24);
  }
  expect(buttons.find((b) => b.id === 'btn-toggle-right-panel')?.title).toMatch(/^Format panel \((Ctrl\+Shift\+P|⇧⌘P)\)$/);
  // removed: duplicates and the freehand tools (their raster overlay never saved anything)
  for (const id of ['btn-add-element', 'btn-pan-left', 'btn-pan-right', 'btn-shape-designer', 'btn-distribute', 'btn-pencil', 'btn-brush', 'btn-eraser', 'btn-line-tool', 'btn-select']) {
    await expect(page.locator(`#${id}`)).toHaveCount(0);
  }
  await expect(page.locator('[data-tool], #drawing-canvas')).toHaveCount(0);
  // groups with separators
  await expect(toolbar.locator('[role="group"]')).toHaveCount(6);

  // grid toggle = View > Grid = Properties > Canvas grid (shown + snapping)
  const grid = page.locator('#btn-grid');
  await expect(grid).toHaveAttribute('aria-pressed', 'true');
  await grid.click();
  await expect(grid).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-action="showGrid"]')).toHaveAttribute('aria-checked', 'false');
  expect(await page.evaluate(() => document.querySelector('#graph-container > div[style*="block"]')?.classList.contains('rd-grid-on'))).toBe(false);
  await clickMenuItem(page, 'view', 'showGrid');
  await expect(grid).toHaveAttribute('aria-pressed', 'true');

  // align / distribute dropdown: two shapes, Align Top, keyboard Escape
  await page.locator('#btn-draw-rect').click();
  await page.locator('#btn-draw-ellipse').click();
  await page.evaluate(async () => {
    const registry = await import('/src/services/service-registry.ts' as string);
    const graph = registry.ServiceRegistry.getTabManager().getActiveTab().graph;
    const cells = graph.getDefaultParent().children;
    graph.batchUpdate(() => {
      const g = cells[1].geometry.clone();
      g.x += 200;
      g.y += 70;
      graph.getDataModel().setGeometry(cells[1], g);
    });
    graph.setSelectionCells(cells);
  });
  const align = page.locator('#btn-align');
  await expect(align).toHaveAttribute('aria-haspopup', 'menu');
  await align.click();
  const menu = page.locator('#align-menu');
  await expect(menu).toBeVisible();
  await expect(menu.locator('[role="menuitem"]')).toHaveCount(8);
  await expect(page.locator('#btn-align-top')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(align).toBeFocused();
  await align.click();
  await menu.locator('#btn-align-top').click();
  await expect(menu).toBeHidden();
  const ys = await page.evaluate(async () => {
    const registry = await import('/src/services/service-registry.ts' as string);
    const graph = registry.ServiceRegistry.getTabManager().getActiveTab().graph;
    return graph.getDefaultParent().children.map((c: { geometry: { y: number } }) => c.geometry.y);
  });
  expect(ys[0]).toBe(ys[1]);
});

test('side panels: collapse/expand by toolbar, View menu and shortcuts; widths and state remembered', async ({ page }) => {
  await freshApp(page);
  const left = page.locator('#leftpanel-container');
  const right = page.locator('#rightpanel-container');
  const leftBtn = page.locator('#btn-toggle-left-panel');
  const rightBtn = page.locator('#btn-toggle-right-panel');
  await expect(leftBtn).toHaveAttribute('aria-pressed', 'true');

  // toolbar button
  await leftBtn.click();
  await expect(left).toBeHidden();
  await expect(leftBtn).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-action="toggleLeftPanel"]')).toHaveAttribute('aria-checked', 'false');
  // shortcut (draw.io: Ctrl+Shift+P = Format panel, Ctrl+Shift+K = Shapes)
  await page.locator('#graph-container').click({ position: { x: 300, y: 300 } });
  await page.keyboard.press('ControlOrMeta+Shift+P');
  await expect(right).toBeHidden();
  await expect(rightBtn).toHaveAttribute('aria-pressed', 'false');

  // remembered after reload
  await page.reload();
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
  await expect(left).toBeHidden();
  await expect(right).toBeHidden();
  await page.keyboard.press('ControlOrMeta+Shift+K');
  await expect(left).toBeVisible();
  await clickMenuItem(page, 'view', 'toggleRightPanel');
  await expect(right).toBeVisible();
  await expect(page.locator('[data-action="toggleRightPanel"]')).toHaveAttribute('aria-checked', 'true');

  // resize handle: >= 8 px hit area, visible on hover, drag, remembered
  const handle = left.locator('.panel-resize-handle');
  const box = (await handle.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(8);
  const before = (await left.boundingBox())!.width;
  await handle.hover();
  await expect.poll(() => handle.evaluate((n) => getComputedStyle(n, '::after').backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + 200, { steps: 5 });
  await page.mouse.up();
  const after = (await left.boundingBox())!.width;
  expect(Math.round(after - before)).toBe(80);
  await page.reload();
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
  expect(Math.round((await left.boundingBox())!.width)).toBe(Math.round(after));
  // keyboard resize
  await left.locator('.panel-resize-handle').focus();
  await page.keyboard.press('ArrowLeft');
  expect(Math.round((await left.boundingBox())!.width)).toBe(Math.round(after) - 16);

  // narrow layout hook: body.rd-narrow hides both panels; a toggle opens one for the session
  await page.evaluate(() => document.body.classList.add('rd-narrow'));
  await expect(left).toBeHidden();
  await expect(right).toBeHidden();
  await expect(leftBtn).toHaveAttribute('aria-pressed', 'false');
  await leftBtn.click();
  await expect(left).toBeVisible();
  await page.evaluate(() => document.body.classList.remove('rd-narrow'));
  await expect(right).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('rd.sidePanels') ?? '{}').left.collapsed)).toBe(false);
});

test('left tab strip: one row, the tabs that do not fit are in the » menu', async ({ page }) => {
  await freshApp(page);
  const bar = page.locator('.left-panel-tabbar');
  const tabs = bar.locator('.left-panel-tab-btn:visible');
  // one row
  const tops = await tabs.evaluateAll((list) => [...new Set(list.map((b) => Math.round(b.getBoundingClientRect().top)))]);
  expect(tops).toHaveLength(1);
  const more = page.locator('.left-panel-tab-more');
  // the default panel fits every common tab: inactive tabs as icons (tooltip + aria-label), no »
  await expect(more).toBeHidden();
  await expect(bar).toHaveClass(/rd-tabs-compact/);
  await expect(page.locator('.left-panel-tab-btn[data-tab="railwayScript"]')).toBeVisible();
  await expect(page.locator('.left-panel-tab-btn[data-tab="railwayScript"] .left-panel-tab-icon')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Railway Script', exact: true })).toBeVisible();
  // a narrow panel puts the rest behind »
  await page.evaluate(() => localStorage.setItem('rd.sidePanels', JSON.stringify({ left: { width: 180 } })));
  await page.reload();
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
  await expect(more).toBeVisible();
  await expect(tabs.first()).toHaveText('Shapes');
  const shown = await tabs.allTextContents();
  await more.click();
  const items = page.locator('.left-panel-overflow-item');
  const overflow = await items.allTextContents();
  // every tab is in the row or in the menu (the compact row keeps a later, narrower tab when a wider one does not fit)
  expect([...shown, ...overflow].map((t) => t.replace('×', '')).sort()).toEqual(['Layers', 'PlantUML', 'Railway Script', 'Shapes', 'Templates']);
  expect(overflow).toContain('PlantUML');
  // keyboard: first item focused, Escape returns to »
  await expect(items.first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.left-panel-overflow-menu')).toBeHidden();
  await expect(more).toBeFocused();
  // choosing a tab puts it into the row (active)
  await more.click();
  await page.locator('.left-panel-overflow-item[data-tab="plantuml"]').click();
  await expect(page.locator('.left-panel-tab-btn[data-tab="plantuml"]')).toBeVisible();
  await expect(page.locator('.left-panel-tab-btn[data-tab="plantuml"]')).toHaveClass(/active/);
  await expect(page.locator('#plantuml-panel')).toBeVisible();
  // PlantUML is closeable and comes back from Extras > PlantUML Editor
  await clickMenuItem(page, 'extras', 'plantumlEditor');
  const plantuml = page.locator('.left-panel-tab-btn[data-tab="plantuml"]');
  await expect(plantuml).toBeVisible();
  await plantuml.locator('.tab-close-btn').click();
  await expect(plantuml).toBeHidden();
  // the remaining tabs fit (no »), PlantUML is in no menu
  await expect(more).toBeHidden();
  await expect(page.locator('.left-panel-overflow-item[data-tab="plantuml"]:visible')).toHaveCount(0);
  await clickMenuItem(page, 'extras', 'plantumlEditor');
  await expect(plantuml).toBeVisible();

  // a wide panel shows every tab, no »
  await page.evaluate(() => localStorage.setItem('rd.sidePanels', JSON.stringify({ left: { width: 520 } })));
  await page.reload();
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
  await expect(more).toBeHidden();
  await expect(page.locator('.left-panel-tab-btn:visible')).toHaveCount(5);
});
