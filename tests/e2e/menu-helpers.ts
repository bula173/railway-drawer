/**
 * Menu helpers shared by the e2e specs: items inside File > Import / Export (and the nested
 * Railway Data / Scenario submenus) are only visible while their submenu is hovered or focused.
 */
import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/** Hovers the submenu titles that contain `item` (outermost first), so the item is visible. */
export async function revealMenuItem(item: Locator): Promise<void> {
  const names = await item.evaluate((node) => {
    const chain: string[] = [];
    for (let s = node.closest('.menu-submenu'); s; s = s.parentElement?.closest('.menu-submenu') ?? null) {
      chain.unshift(s.getAttribute('data-submenu') ?? '');
    }
    return chain;
  });
  for (const name of names) {
    await item.page().locator(`.menu-submenu[data-submenu="${name}"] > .menu-submenu-title`).hover();
  }
}

/** Opens menu `menu` (File, Railway, ...) and clicks its item `action` (inside submenus too). */
export async function clickMenuItem(page: Page, menu: string, action: string): Promise<void> {
  await page.locator(`.menu-item[data-menu="${menu}"]`).click();
  const item = page.locator(`.menu-dropdown[data-menu="${menu}"] [data-action="${action}"]`);
  await revealMenuItem(item);
  await item.click();
}

/**
 * Activates a left-panel tab (`data-tab`: shapes, ertms, templates, layers, plantuml, railwayScript)
 * from the tab strip, or from its "»" overflow menu when it does not fit in the row.
 */
export async function openLeftTab(page: Page, tab: string): Promise<void> {
  const button = page.locator(`.left-panel-tab-btn[data-tab="${tab}"]`);
  if (!(await button.isVisible())) {
    await page.locator('.left-panel-tab-more').click();
    await page.locator(`.left-panel-overflow-item[data-tab="${tab}"]`).click();
  } else {
    await button.click();
  }
  await expect(button).toHaveClass(/\bactive\b/);
}

/** The labels of the left-panel tabs that are open (in the row or in the "»" menu), in order. */
export async function leftTabLabels(page: Page): Promise<string[]> {
  return page
    .locator('.left-panel-tab-btn')
    .evaluateAll((btns) => btns.filter((b) => (b as HTMLElement).style.display !== 'none').map((b) => b.querySelector('span')?.textContent ?? ''));
}
