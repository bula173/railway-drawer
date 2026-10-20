/**
 * @file ux-batch.spec.ts
 * @brief UX review batch 1 (any port): menubar keyboard pattern + shortcut hints, Help > Keyboard
 *        Shortcuts and About (real version), Properties panel states none / canvas / cell (also a
 *        group selected by a click in its gap) with the selection header, zoom select in sync, "+"
 *        opens and shows "Diagram <n>", context menu kept inside the window with Delete last,
 *        themed Save As (Enter / Esc), Share dialog with collapsed provider settings, no start
 *        toast, Undo/Redo buttons following the undo history.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const APP_VERSION = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')).version as string;

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
  }, { body, arg });
}

const focusedAction = (page: Page): Promise<string | null> =>
  page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('data-action') ?? null);

test('menubar: WAI-ARIA roles, arrow keys, Home/End, Enter, Escape returns focus; shortcut hints', async ({ page }) => {
  await freshApp(page);
  const file = page.locator('.menu-item[data-menu="file"]');
  await expect(page.locator('#menu-bar')).toHaveAttribute('role', 'menubar');
  await expect(file).toHaveAttribute('aria-haspopup', 'menu');
  await expect(file).toHaveAttribute('aria-expanded', 'false');

  await file.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.menu-dropdown[data-menu="file"]')).toBeVisible();
  await expect(file).toHaveAttribute('aria-expanded', 'true');
  expect(await focusedAction(page)).toBe('new');
  await page.keyboard.press('ArrowDown');
  expect(await focusedAction(page)).toBe('open');
  await page.keyboard.press('End');
  expect(await focusedAction(page)).toBe('print');
  await page.keyboard.press('Home');
  expect(await focusedAction(page)).toBe('new');
  await page.keyboard.press('ArrowUp');
  expect(await focusedAction(page)).toBe('print');
  await expect(page.locator('.menu-dropdown[data-menu="file"] [data-action="new"]')).toHaveAttribute('role', 'menuitem');

  // ArrowRight / ArrowLeft move between the menus
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.menu-dropdown[data-menu="edit"]')).toBeVisible();
  await expect(page.locator('.menu-dropdown[data-menu="file"]')).toBeHidden();
  expect(await focusedAction(page)).toBe('undo');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.menu-dropdown[data-menu="file"]')).toBeVisible();

  // Escape closes and gives the focus back to the menubar button
  await page.keyboard.press('Escape');
  await expect(page.locator('.menu-dropdown[data-menu="file"]')).toBeHidden();
  await expect(file).toBeFocused();
  await expect(file).toHaveAttribute('aria-expanded', 'false');

  // Shortcut hints from the real bindings (Ctrl, or Cmd symbols on macOS)
  const hint = (action: string) => page.locator(`.menu-dropdown-item[data-action="${action}"] kbd.rd-kbd`);
  await expect(hint('copy')).toHaveText(/^(Ctrl\+C|⌘C)$/);
  await expect(hint('undo')).toHaveText(/^(Ctrl\+Z|⌘Z)$/);
  await expect(hint('save')).toHaveText(/^(Ctrl\+S|⌘S)$/);
  await expect(hint('delete')).toHaveText('Delete');
  await expect(hint('zoomIn')).toHaveText(/^(Ctrl\+\+|⌘\+)$/);
  await expect(hint('shortcuts')).toHaveText('F1');
  await expect(page.locator('#context-menu [data-action="ungroup"] kbd')).toHaveText(/^(Ctrl\+Shift\+G|⇧⌘G)$/);

  // Enter runs an item: Help > Keyboard Shortcuts
  await page.locator('.menu-item[data-menu="help"]').focus();
  await page.keyboard.press('Enter');
  expect(await focusedAction(page)).toBe('shortcuts');
  await page.keyboard.press('Enter');
  const shortcuts = page.locator('[data-testid="shortcuts-dialog"]');
  await expect(shortcuts).toBeVisible();
  await expect(shortcuts).toHaveAttribute('role', 'dialog');
  await expect(shortcuts).toContainText(/Ctrl\+Z|⌘Z/);
  await expect(shortcuts).toContainText('Select all');
  await page.keyboard.press('Escape');
  await expect(shortcuts).toHaveCount(0);
  // Preferences (a stub) is gone
  await expect(page.locator('[data-action="preferences"]')).toHaveCount(0);
});

test('Help > Keyboard Shortcuts (mouse) and Help > About with the real version', async ({ page }) => {
  await freshApp(page);
  await page.locator('.menu-item[data-menu="help"]').click();
  await page.locator('.menu-dropdown-item[data-action="shortcuts"]').click();
  await expect(page.locator('[data-testid="shortcuts-dialog"]')).toBeVisible();
  await page.locator('[data-testid="shortcuts-dialog"] button', { hasText: 'Close' }).click();
  await expect(page.locator('[data-testid="shortcuts-dialog"]')).toHaveCount(0);

  let nativeDialogs = 0;
  page.on('dialog', (d) => {
    nativeDialogs++;
    void d.dismiss();
  });
  await expect(page.locator('#status-version')).toHaveText(APP_VERSION);
  await page.locator('.menu-item[data-menu="help"]').click();
  await page.locator('.menu-dropdown-item[data-action="about"]').click();
  const about = page.locator('[data-testid="about-dialog"]');
  await expect(about).toBeVisible();
  await expect(about.locator('[data-testid="about-version"]')).toHaveText(APP_VERSION);
  await expect(about.locator('[data-testid="about-build"]')).toHaveText((await page.locator('#status-build').textContent())!);
  await expect(about.locator('a[href*="github.com"]').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(about).toHaveCount(0);
  expect(nativeDialogs).toBe(0);
});

test('Properties panel: none / canvas / cell, group selected via its gap, header names the selection', async ({ page }) => {
  await freshApp(page);
  const content = page.locator('#property-content');
  // nothing selected at launch: only the hint, not the Text editor
  await expect(content).toHaveAttribute('data-state', 'none');
  await expect(page.locator('#prop-placeholder')).toBeVisible();
  await expect(page.locator('#prop-editor')).toBeHidden();
  await expect(page.locator('#canvas-props')).toBeHidden();

  // two shapes far apart, grouped into a transparent group
  await inTab(page, `
    const parent = graph.getDefaultParent();
    const a = graph.insertVertex({ parent, id: 'A', value: '', position: [100, 100], size: [60, 40] });
    const b = graph.insertVertex({ parent, id: 'B', value: '', position: [300, 100], size: [60, 40] });
    const g = graph.groupCells(null, 0, [a, b]);
    graph.getDataModel().setStyle(g, { fillColor: 'none', strokeColor: 'none' });
    graph.getDataModel().setValue(g, '');
    graph.clearSelection();
  `);
  const origin = await inTab<{ x: number; y: number }>(page, `
    const r = graph.container.getBoundingClientRect();
    const t = graph.view.translate, s = graph.view.scale;
    return { x: r.left - graph.container.scrollLeft + t.x * s, y: r.top - graph.container.scrollTop + t.y * s };
  `);
  // empty canvas -> Canvas Properties
  await page.mouse.click(origin.x + 500, origin.y + 330);
  await expect(page.locator('#canvas-props')).toBeVisible();
  await expect(content).toHaveAttribute('data-state', 'canvas');
  await expect(page.locator('#prop-placeholder')).toBeHidden();

  // click on shape A selects the group: cell state, header "Group"
  await page.mouse.click(origin.x + 130, origin.y + 120);
  await expect(page.locator('#status-selected')).toHaveText('1');
  await expect(content).toHaveAttribute('data-state', 'cell');
  await expect(page.locator('#prop-selection-header')).toHaveText('Group');
  // the Style tab is shown first (like draw.io's Format panel)
  await expect(page.locator('.prop-tab[data-tab="style"]')).toHaveClass(/active/);
  // a click in the group's gap keeps the group selected and does not switch to Canvas Properties
  await page.mouse.click(origin.x + 230, origin.y + 120);
  await page.waitForTimeout(150);
  await expect(page.locator('#status-selected')).toHaveText('1');
  await expect(content).toHaveAttribute('data-state', 'cell');
  await expect(page.locator('#canvas-props')).toBeHidden();
  await expect(page.locator('#prop-placeholder')).toBeHidden();

  // multi-selection and a railway object
  await inTab(page, `
    const parent = graph.getDefaultParent();
    const c = graph.insertVertex({ parent, id: 'C', value: 'C', position: [100, 300], size: [40, 40] });
    const d = graph.insertVertex({ parent, id: 'D', value: 'D', position: [200, 300], size: [40, 40] });
    graph.setSelectionCells([c, d]);
  `);
  await expect(page.locator('#prop-selection-header')).toHaveText('2 shapes');
  await page.keyboard.press('Escape');
  await expect(content).toHaveAttribute('data-state', 'none');
  await expect(page.locator('#prop-placeholder')).toBeVisible();
});

test('zoom select shows 100% at launch and follows every zoom change', async ({ page }) => {
  await freshApp(page);
  const select = page.locator('#zoom-level');
  await expect(select).toHaveValue('100');
  await expect(page.locator('#status-zoom')).toHaveText('100%');
  await page.locator('#btn-zoom-in').click();
  await expect(select).toHaveValue('120');
  await expect(select.locator('option:checked')).toHaveText('120%');
  await expect(page.locator('#status-zoom')).toHaveText('120%');
  await page.locator('#btn-zoom-out').click();
  await expect(select).toHaveValue('100');
  await select.selectOption('50');
  await expect(page.locator('#status-zoom')).toHaveText('50%');
  // menu zoom and fit
  await page.locator('.menu-item[data-menu="view"]').click();
  await page.locator('.menu-dropdown-item[data-action="zoomActual"]').click();
  await expect(select).toHaveValue('100');
  await inTab(page, `graph.insertVertex({ parent: graph.getDefaultParent(), value: 'X', position: [0, 0], size: [2000, 1500] });`);
  await page.locator('.menu-item[data-menu="view"]').click();
  await page.locator('.menu-dropdown-item[data-action="fitWindow"]').click();
  const shown = (await page.locator('#status-zoom').textContent())!.replace('%', '');
  expect(Number(shown)).toBeLessThan(100);
  await expect(select).toHaveValue(shown);
});

test('"+" opens and shows a new tab "Diagram <n>" with the title in sync; File > New likewise', async ({ page }) => {
  await freshApp(page);
  const tabs = page.locator('#tabs-container .tab-button');
  const title = page.locator('.document-title');
  await expect(tabs.nth(0)).toHaveText(/Diagram 1/);
  await expect(title).toHaveText('Diagram 1');
  await page.locator('#tabs-container .tab-new-btn').click();
  await expect(tabs).toHaveCount(2);
  await expect(tabs.nth(1)).toHaveClass(/active/);
  await expect(tabs.nth(1).locator('.tab-label')).toHaveText('Diagram 2');
  await expect(title).toHaveText('Diagram 2');
  let nativeDialogs = 0;
  page.on('dialog', (d) => {
    nativeDialogs++;
    void d.dismiss();
  });
  await page.locator('.menu-item[data-menu="file"]').click();
  await page.locator('.menu-dropdown-item[data-action="new"]').click();
  await expect(tabs).toHaveCount(3);
  await expect(tabs.nth(2)).toHaveClass(/active/);
  await expect(tabs.nth(2).locator('.tab-label')).toHaveText('Diagram 3');
  await expect(title).toHaveText('Diagram 3');
  expect(nativeDialogs).toBe(0);
  await tabs.nth(0).click();
  await expect(title).toHaveText('Diagram 1');
});

test('context menu: 13px items, shortcut hints, Delete last after a separator, kept inside the window', async ({ page }) => {
  await freshApp(page);
  await inTab(page, `graph.insertVertex({ parent: graph.getDefaultParent(), id: 'R', value: 'R', position: [40, 40], size: [80, 40] });`);
  const origin = await inTab<{ x: number; y: number }>(page, `
    const r = graph.container.getBoundingClientRect();
    const t = graph.view.translate, s = graph.view.scale;
    return { x: r.left - graph.container.scrollLeft + t.x * s, y: r.top - graph.container.scrollTop + t.y * s };
  `);
  const menu = page.locator('#context-menu');
  await page.mouse.click(origin.x + 80, origin.y + 60, { button: 'right' });
  await expect(menu).toBeVisible();
  const visible = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('#context-menu > *'))
      .filter((n) => getComputedStyle(n).display !== 'none')
      .map((n) => n.getAttribute('data-action') ?? (n.classList.contains('rd-sep') || n.hasAttribute('data-drawio-menu') ? 'sep' : '?'))
  );
  expect(visible[visible.length - 1]).toBe('delete');
  expect(visible[visible.length - 2]).toBe('sep');
  expect(visible[0]).toBe('cut');
  await expect(menu.locator('[data-action="delete"]')).toHaveCSS('font-size', '13px');
  await expect(menu.locator('[data-action="copy"]')).toHaveCSS('font-size', '13px');
  await expect(menu.locator('[data-action="copy"] kbd')).toHaveText(/^(Ctrl\+C|⌘C)$/);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();

  // near the bottom-right corner of the window: flipped/clamped inside the viewport
  const viewport = page.viewportSize()!;
  const box = (await page.locator('#graph-container').boundingBox())!;
  await page.mouse.click(box.x + box.width - 3, box.y + box.height - 3, { button: 'right' });
  await expect(menu).toBeVisible();
  const rect = (await menu.boundingBox())!;
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.y).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width);
  expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height);
  await page.keyboard.press('Escape');
});

test('File > Save As: themed dialog, Escape cancels, Enter downloads <name>.drawio and renames', async ({ page }) => {
  await freshApp(page);
  const openSaveAs = async () => {
    await page.locator('.menu-item[data-menu="file"]').click();
    await page.locator('.menu-dropdown-item[data-action="saveAs"]').click();
  };
  await openSaveAs();
  const dialog = page.locator('[data-testid="save-as-dialog"]');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('role', 'dialog');
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog.locator('.rd-tpl-modal-title')).toHaveText('Save As');
  await expect(dialog).toContainText('.drawio file');
  await expect(page.locator('.rd-tpl-modal-overlay')).toBeVisible();
  const input = dialog.locator('input[name="save-as-name"]');
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('Diagram 1');
  // focus stays in the dialog
  for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="save-as-dialog"]'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.document-title')).toHaveText('Diagram 1');

  await openSaveAs();
  await input.fill('Station plan');
  const [download] = await Promise.all([page.waitForEvent('download'), input.press('Enter')]);
  expect(download.suggestedFilename()).toBe('Station plan.drawio');
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.document-title')).toHaveText('Station plan');
  await expect(page.locator('#tabs-container .tab-button.active .tab-label')).toHaveText('Station plan');
  await expect(page.locator('.save-status')).toContainText('Saved to Station plan.drawio');
});

test('Share dialog: one "Not configured", admin steps and provider settings collapsed', async ({ page }) => {
  await freshApp(page);
  await page.locator('#share-btn').click();
  const dialog = page.locator('[data-testid="share-dialog"]');
  await expect(dialog).toBeVisible();
  for (const id of ['sharepoint', 'gitlab']) {
    const section = dialog.locator(`[data-testid="share-provider-${id}"]`);
    const statusLine = section.locator('.rd-share-hint').first();
    const text = (await statusLine.textContent()) ?? '';
    expect(text.match(/not configured/gi) ?? []).toHaveLength(1);
    expect(text).not.toContain('VITE_');
    await expect(section.locator(`[data-testid="share-provider-${id}-howto"]`)).not.toHaveAttribute('open', '');
    await expect(section.locator(`[data-testid="share-provider-${id}-howto"] p`).first()).toBeHidden();
  }
  await expect(dialog.locator('[data-testid="share-provider-gitlab-settings"]')).not.toHaveAttribute('open', '');
  await expect(dialog.locator('[data-testid="share-provider-gitlab-settings"] input[data-setting="url"]')).toBeHidden();
});

test('no start-up toast; save status wording; Undo/Redo buttons follow the undo history', async ({ page }) => {
  await freshApp(page);
  await page.waitForTimeout(800);
  await expect(page.locator('.notification', { hasText: 'initialized' })).toHaveCount(0);
  await expect(page.locator('.save-status')).toHaveText(/^(Saved in browser|)$/);
  await expect(page.locator('#status-remote-item')).toBeHidden();

  const undo = page.locator('#btn-undo');
  const redo = page.locator('#btn-redo');
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();
  await expect(undo).toHaveAttribute('aria-label', 'Undo');
  await expect(undo.locator('svg')).toHaveCount(1);
  await page.locator('#btn-draw-rect').click();
  await expect(undo).toBeEnabled();
  await expect(page.locator('.menu-dropdown-item[data-action="undo"]')).toHaveAttribute('aria-disabled', 'false');
  await undo.click();
  await expect(undo).toBeDisabled();
  await expect(redo).toBeEnabled();
  await expect(page.locator('.menu-dropdown-item[data-action="undo"]')).toHaveAttribute('aria-disabled', 'true');
  await redo.click();
  await expect(redo).toBeDisabled();
  await expect(undo).toBeEnabled();
  // the toolbar's More options (⋮) stub is gone
  await expect(page.locator('#btn-more-options')).toHaveCount(0);
});
