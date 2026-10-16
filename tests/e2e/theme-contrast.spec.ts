/**
 * @file theme-contrast.spec.ts
 * @brief Light and dark theme of the legacy editor chrome: every visible text-bearing element of
 *        every major surface must have a WCAG 2.x contrast ratio of at least 4.5 between its
 *        computed text color and its effective background (3 for large text and for symbol-only
 *        "icon" text; disabled controls are exempt).
 *
 * The effective background is found by walking up the ancestors and alpha-compositing their
 * background colors until an opaque one is reached. Diagram content (the tab graphs, palette /
 * template / step thumbnails, SVG) is not app chrome and is skipped: cells keep their own styles.
 *
 * The theme is set both ways the app supports: localStorage `rd.theme` before load (with the
 * opposite system preference emulated, so the explicit choice must win) and View > Dark Mode at
 * runtime. Screenshots of both themes go to test-results/theme-contrast/.
 *
 * Runs on any port (no draw.io server is involved).
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

type Theme = 'light' | 'dark';

interface Offender {
  surface: string;
  selector: string;
  text: string;
  color: string;
  background: string;
  ratio: number;
  required: number;
}

const SHOT_DIR = 'test-results/theme-contrast';
const HEXAGON = '#drawio-palette-container section[data-palette-id="general"] .rd-dp-item[title="Hexagon"]';
const ERTMS_SIGNAL = '#drawio-palette-container section[data-palette-id="ertms"] .rd-dp-item[title="Signal Left 3"]';

/** Runs in the page: contrast offenders inside the elements matched by `rootSelectors`. */
function auditInPage(rootSelectors: string[]): Omit<Offender, 'surface'>[] {
  interface Rgba { r: number; g: number; b: number; a: number }
  const parse = (value: string): Rgba | null => {
    const m = /rgba?\(([^)]+)\)/.exec(value);
    if (!m) return null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (top: Rgba, bottom: Rgba): Rgba => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  });
  const lum = (c: Rgba): number => {
    const ch = (v: number): number => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
  };
  const ratioOf = (a: Rgba, b: Rgba): number => {
    const la = lum(a);
    const lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };
  const hex = (c: Rgba): string =>
    '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

  /** Effective background: ancestors' backgrounds composited until an opaque one; null = image. */
  const effectiveBackground = (el: Element): Rgba | null => {
    const layers: Rgba[] = [];
    for (let n: Element | null = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none' && n !== document.documentElement) return null;
      const bg = parse(cs.backgroundColor);
      if (bg && bg.a > 0) {
        layers.push(bg);
        if (bg.a >= 1) break;
      }
    }
    let result: Rgba = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) result = over(layers[i], result);
    return result;
  };

  const SKIP = [
    '#graph-container > div[id^="graph-tab-"]',
    '.rd-scn-view-host',
    '.rd-dp-thumb',
    '.rd-tpl-thumb',
    '.rd-scn-thumb',
    'svg',
    'canvas',
    'option',
  ].join(',');
  const PICTO_ONLY = /^[\p{Extended_Pictographic}\p{Emoji_Component}️‍\s]+$/u;
  const TEXT_INPUT = /^(text|number|search|email|url|tel|password|)$/;

  const describe = (el: Element): string => {
    const parts: string[] = [];
    for (let n: Element | null = el; n && parts.length < 4 && n !== document.body; n = n.parentElement) {
      let part = n.tagName.toLowerCase();
      if (n.id) {
        parts.unshift(`${part}#${n.id}`);
        break;
      }
      const cls = Array.from(n.classList).slice(0, 2);
      if (cls.length) part += '.' + cls.join('.');
      for (const attr of ['data-action', 'data-tab', 'data-menu', 'name', 'type']) {
        const v = n.getAttribute(attr);
        if (v) {
          part += `[${attr}="${v}"]`;
          break;
        }
      }
      parts.unshift(part);
    }
    return parts.join(' > ');
  };

  const textOf = (el: Element): string => {
    if (el instanceof HTMLInputElement) return TEXT_INPUT.test(el.type) ? el.value : '';
    if (el instanceof HTMLTextAreaElement) return el.value;
    if (el instanceof HTMLSelectElement) return el.selectedOptions[0]?.textContent ?? '';
    let text = '';
    for (const child of Array.from(el.childNodes)) if (child.nodeType === Node.TEXT_NODE) text += child.textContent ?? '';
    return text;
  };

  const out: Omit<Offender, 'surface'>[] = [];
  const seen = new Set<Element>();
  for (const rootSelector of rootSelectors) {
    for (const root of Array.from(document.querySelectorAll(rootSelector))) {
      for (const el of [root, ...Array.from(root.querySelectorAll('*'))]) {
        if (seen.has(el)) continue;
        seen.add(el);
        if (el.closest(SKIP)) continue;
        const text = textOf(el).replace(/\s+/g, ' ').trim();
        if (!text || PICTO_ONLY.test(text)) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) continue;
        const visible = (el as Element & { checkVisibility?: (o: object) => boolean }).checkVisibility?.({
          checkOpacity: true,
          checkVisibilityCSS: true,
        });
        if (visible === false) continue;
        if (el.closest(':disabled, [aria-disabled="true"], .disabled, [inert]')) continue;

        const cs = getComputedStyle(el);
        const bg = effectiveBackground(el);
        const fgRaw = parse(cs.color);
        if (!bg || !fgRaw) continue;
        let opacity = 1;
        for (let n: Element | null = el; n; n = n.parentElement) opacity *= Number(getComputedStyle(n).opacity || 1);
        const fg = over({ ...fgRaw, a: fgRaw.a * opacity }, bg);

        const size = parseFloat(cs.fontSize);
        const weight = Number(cs.fontWeight) || 400;
        const large = size >= 24 || (size >= 18.66 && weight >= 700);
        const symbolOnly = !/[\p{L}\p{N}]/u.test(text);
        const required = large || symbolOnly ? 3 : 4.5;
        const ratio = ratioOf(fg, bg);
        if (ratio + 1e-6 < required) {
          out.push({
            selector: describe(el),
            text: text.slice(0, 40),
            color: hex(fg),
            background: hex(bg),
            ratio: Math.round(ratio * 100) / 100,
            required,
          });
        }
      }
    }
  }
  return out;
}

class Auditor {
  readonly offenders: Offender[] = [];
  readonly surfaces: string[] = [];
  constructor(private readonly page: Page, private readonly theme: Theme) {}

  async check(surface: string, ...roots: string[]): Promise<void> {
    // Let transitions (hover backgrounds, slide-ins) settle
    await this.page.waitForTimeout(350);
    const found = await this.page.evaluate(auditInPage, roots.length ? roots : ['#app-container']);
    this.surfaces.push(surface);
    for (const o of found) this.offenders.push({ surface: `${this.theme}: ${surface}`, ...o });
  }

  async shot(name: string): Promise<void> {
    await this.page.screenshot({ path: `${SHOT_DIR}/${this.theme}-${name}.png` });
  }

  report(): string {
    return this.offenders
      .map((o) => `${o.surface} | ${o.selector} | "${o.text}" | ${o.color} on ${o.background} = ${o.ratio} (< ${o.required})`)
      .join('\n');
  }
}

async function openApp(page: Page, theme: Theme): Promise<void> {
  // The opposite system preference: the stored choice must win over prefers-color-scheme
  await page.emulateMedia({ colorScheme: theme === 'dark' ? 'light' : 'dark' });
  await page.goto('/');
  await page.evaluate((t) => {
    localStorage.clear();
    localStorage.setItem('rd.theme', t);
  }, theme);
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-editor', 'legacy');
  await expect(page.locator('#tabs-container .tab-button.active')).toHaveCount(1);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await page.locator(HEXAGON).waitFor();
}

async function openMenu(page: Page, menu: string): Promise<void> {
  await page.locator(`.menu-item[data-menu="${menu}"]`).click();
  await expect(page.locator(`.menu-dropdown[data-menu="${menu}"]`)).toBeVisible();
}

async function closeMenus(page: Page): Promise<void> {
  await page.locator('.status-bar').click({ position: { x: 4, y: 4 } });
  await expect(page.locator('.menu-dropdown:visible')).toHaveCount(0);
}

async function fillTemplateDialog(page: Page, name: string): Promise<void> {
  const dialog = page.locator('.rd-tpl-modal');
  await expect(dialog).toBeVisible();
  await dialog.locator('input[name="template-name"]').fill(name);
  await dialog.locator('.rd-tpl-btn-primary').click();
  await expect(dialog).toHaveCount(0);
}

async function auditAllSurfaces(page: Page, a: Auditor): Promise<void> {
  await a.check('main window (Shapes tab, nothing selected)');
  await a.shot('main');

  // Menus
  for (const menu of ['file', 'edit', 'view', 'arrange', 'extras', 'help']) {
    await openMenu(page, menu);
    if (menu === 'file') {
      await page.locator('.menu-submenu-title').hover();
      await a.check('File menu + Export Railway Data submenu', '.menu-dropdown[data-menu="file"]');
      await a.shot('menu-file');
    } else {
      await a.check(`${menu} menu`, `.menu-dropdown[data-menu="${menu}"]`);
    }
    await closeMenus(page);
  }

  // Canvas properties (click on the empty canvas)
  await page.locator('#graph-container').click({ position: { x: 20, y: 20 } });
  await a.check('Properties: canvas', '#rightpanel-container');

  // Properties of a selected shape: Text / Style / Arrange
  await page.locator(HEXAGON).click();
  await expect(page.locator('#prop-editor')).toBeVisible();
  await a.check('Properties: Text tab', '#rightpanel-container');
  await a.shot('properties-text');
  await page.locator('.prop-tab[data-tab="style"]').click();
  await a.check('Properties: Style tab', '#rightpanel-container');
  await a.shot('properties-style');
  await page.locator('.prop-tab[data-tab="arrange"]').click();
  await a.check('Properties: Arrange tab', '#rightpanel-container');

  // Context menu on the selected shape
  const box = await page.locator('#graph-container').boundingBox();
  if (!box) throw new Error('no graph container');
  await page.locator('#graph-container').click({ button: 'right', position: { x: box.width / 2, y: box.height / 2 } });
  await expect(page.locator('#context-menu')).toBeVisible();
  await page.locator('#context-menu [data-action="copy"]').hover();
  await a.check('context menu', '#context-menu');
  await a.shot('context-menu');
  await page.keyboard.press('Escape');
  await page.locator('.status-bar').click({ position: { x: 4, y: 4 } });

  // Left panel tabs
  await page.locator('.left-panel-tab-btn', { hasText: 'Templates' }).click();
  await page.locator('#templates-panel .rd-tpl-tile').first().waitFor();
  await a.check('left: Templates tab', '#leftpanel-container');
  await page.locator('.left-panel-tab-btn', { hasText: 'Layers' }).click();
  await a.check('left: Layers tab', '#leftpanel-container');
  await page.locator('.left-panel-tab-btn', { hasText: 'PlantUML' }).click();
  await a.check('left: PlantUML tab', '#leftpanel-container');
  await a.shot('plantuml');
  await openMenu(page, 'view');
  await page.locator('[data-action="toggleErtmsTab"]').click();
  await page.locator('#ertms-panel .rd-dp-item').first().waitFor();
  await a.check('left: ERTMS tab', '#leftpanel-container');
  await page.locator('.left-panel-tab-btn', { hasText: 'Shapes' }).click();

  // Right panel: Data (railway object selected), Checks, Scenarios
  await page.locator(ERTMS_SIGNAL).click();
  await page.locator('[data-right-panel="data"]').click();
  await expect(page.locator('#railway-data-panel')).toBeVisible();
  await a.check('right: Data panel (signal selected)', '#rightpanel-container');
  await a.shot('data');
  await page.locator('[data-right-panel="checks"]').click();
  await page.locator('#railway-checks-panel button', { hasText: 'Run checks' }).click();
  await a.check('right: Checks panel', '#rightpanel-container');
  await page.locator('[data-right-panel="scenarios"]').click();
  await a.check('right: Scenarios panel (empty)', '#rightpanel-container');

  // Scenario + step editor
  await page.locator('#scenarios-panel .rd-scn-new').click();
  await a.check('scenario name dialog', '.rd-tpl-modal');
  await fillTemplateDialog(page, 'Wjazd pociągu');
  await page.locator('#scenarios-panel .rd-scn-add-step').click();
  const editor = page.locator('.rd-scn-editor');
  await expect(editor).toBeVisible();
  await editor.locator('input[name="template-name"]').fill('Krok 1');
  await editor.locator('textarea[name="step-uml"]').fill('@startuml\nAlice -> Bob: MA request\nnote right: km 12+345\n@enduml');
  await editor.locator('textarea[name="step-text"]').fill('# Krok 1\n\n- **Signal** S1 `red`\n- [x] done\n\n> quote');
  await page.waitForTimeout(500);
  await a.check('scenario step editor', '.rd-scn-editor');
  await a.shot('step-editor');
  await editor.locator('.rd-tpl-btn-primary').click();
  await expect(editor).toHaveCount(0);
  await page.locator('#scenarios-panel .rd-scn-toggle').first().click().catch(() => undefined);
  await a.check('right: Scenarios panel (1 scenario, 1 step)', '#rightpanel-container');

  // Scenario view (banner + side panel)
  await page.locator('#scenarios-panel .rd-scn-play').first().click();
  await expect(page.locator('[data-testid="scenario-view"]')).toBeVisible();
  await a.check('scenario view (banner, side panel)', '[data-testid="scenario-view"]', '.rd-scn-side');
  await a.shot('scenario-view');
  await page.locator('.rd-scn-exit').click();
  await expect(page.locator('[data-testid="scenario-view"]')).toBeHidden();
  await page.locator('[data-right-panel="properties"]').click();

  // Save as Template dialog, also with its validation error
  await openMenu(page, 'file');
  await page.locator('.menu-dropdown-item[data-action="saveAsTemplate"]').click();
  const tpl = page.locator('.rd-tpl-modal');
  await expect(tpl).toBeVisible();
  await tpl.locator('input[name="template-name"]').fill('');
  await tpl.locator('input[name="template-name"]').press('Enter');
  await expect(tpl.locator('.rd-tpl-modal-error')).toBeVisible();
  await a.check('Save as Template dialog (with error)', '.rd-tpl-modal');
  await a.shot('template-dialog');
  await page.keyboard.press('Escape');
  await expect(tpl).toHaveCount(0);

  // Share dialog
  await page.locator('#share-btn').click();
  const share = page.locator('.rd-share-modal').first();
  await expect(share).toBeVisible();
  await a.check('Share dialog', '.rd-share-modal');
  await a.shot('share');
  await page.keyboard.press('Escape');
  await expect(page.locator('.rd-share-modal')).toHaveCount(0);

  // Help > Keyboard Shortcuts
  await openMenu(page, 'help');
  await page.locator('.menu-dropdown-item[data-action="shortcuts"]').click();
  await page.waitForTimeout(200);
  const shortcutRoots = await page.evaluate(() => {
    const dialogs = Array.from(document.body.children).filter(
      (n) => n instanceof HTMLElement && n.id !== 'app-container' && getComputedStyle(n).position === 'fixed' && /Keyboard/i.test(n.textContent ?? ''),
    );
    dialogs.forEach((d, i) => d.setAttribute('data-rd-audit', `shortcuts-${i}`));
    return dialogs.length;
  });
  if (shortcutRoots > 0) await a.check('Keyboard Shortcuts dialog', '[data-rd-audit^="shortcuts-"]');
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.querySelectorAll('[data-rd-audit^="shortcuts-"]').forEach((n) => n.remove()));

  // Toolbar dialogs: custom shape image upload, shape designer
  await page.locator('#btn-upload-image').click();
  await expect(page.locator('#image-upload-modal')).toBeVisible();
  await a.check('Upload Custom Shape Image dialog', '#image-upload-modal');
  await page.locator('#image-upload-modal button', { hasText: 'Close' }).click();
  await expect(page.locator('#image-upload-modal')).toBeHidden();
  await page.locator('#btn-shape-designer').click();
  const designer = page.locator('.shape-designer-modal').first();
  await expect(designer).toBeVisible();
  await a.check('Shape designer', '.shape-designer-modal');
  await a.shot('shape-designer');
  await designer.locator('.designer-close').first().click();
  await expect(page.locator('.shape-designer-modal:visible')).toHaveCount(0);

  // Notifications of every type
  await page.evaluate(async () => {
    // Dev server only (like style-edit.spec.ts)
    const registry = await import('/src/services/service-registry.ts' as string);
    const n = registry.ServiceRegistry.getNotificationManager() as {
      info(m: string, o?: object): void;
      success(m: string, o?: object): void;
      warning(m: string, o?: object): void;
      error(m: string, o?: object): void;
    };
    n.info('Info notification', { duration: 0 });
    n.success('Success notification', { duration: 0 });
    n.warning('Warning notification', { duration: 0, action: { label: 'Undo', callback: () => undefined } });
    n.error('Error notification', { duration: 0 });
  });
  await expect(page.locator('.notification')).toHaveCount(4);
  await page.waitForTimeout(400);
  await a.check('notifications', '.notification-container');
  await a.shot('notifications');

  // The whole window once more (status bar, tab bar, toolbar after all the changes)
  await a.check('main window (after the tour)');
}

test.describe('theme contrast', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`${theme} theme (localStorage rd.theme): all surfaces meet WCAG AA contrast`, async ({ page }) => {
      test.setTimeout(180_000);
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));
      await page.setViewportSize({ width: 1440, height: 900 });
      await openApp(page, theme);
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(theme);

      const a = new Auditor(page, theme);
      await auditAllSurfaces(page, a);
      await test.info().attach(`contrast-${theme}.txt`, { body: a.report() || 'no offenders', contentType: 'text/plain' });
      expect(a.surfaces.length).toBeGreaterThan(25);
      expect(a.offenders, `contrast offenders:\n${a.report()}`).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  }

  test('View > Dark Mode switches the chrome at runtime, both ways', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openApp(page, 'light');
    const bodyBg = (): Promise<string> => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const lightBg = await bodyBg();

    await openMenu(page, 'view');
    await page.locator('[data-action="toggleDarkMode"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => localStorage.getItem('rd.theme'))).toBe('dark');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('dark');
    expect(await bodyBg()).not.toBe(lightBg);
    await closeMenus(page);

    const dark = new Auditor(page, 'dark');
    await page.locator(HEXAGON).click();
    await dark.check('main window after View > Dark Mode');
    await openMenu(page, 'view');
    await dark.check('View menu after View > Dark Mode', '.menu-dropdown[data-menu="view"]');
    await expect(page.locator('[data-action="toggleDarkMode"]')).toHaveAttribute('aria-checked', 'true');

    // The canvas grid follows the theme (no light grid tile on the dark canvas)
    const grid = await page.evaluate(() => {
      const div = document.querySelector<HTMLElement>('#graph-container > div[id^="graph-tab-"]');
      const cs = div ? getComputedStyle(div) : null;
      return { bg: cs?.backgroundColor ?? '', image: cs?.backgroundImage ?? '' };
    });
    expect(grid.bg).toBe('rgb(18, 18, 18)');
    expect(grid.image).toContain('424242');

    await page.locator('[data-action="toggleDarkMode"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await closeMenus(page);
    const light = new Auditor(page, 'light');
    await light.check('main window after switching back to light');
    expect(await bodyBg()).toBe(lightBg);

    const offenders = [...dark.offenders, ...light.offenders];
    expect(offenders, `contrast offenders:\n${[dark.report(), light.report()].filter(Boolean).join('\n')}`).toEqual([]);
  });
});
