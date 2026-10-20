/**
 * Menu helpers shared by the e2e specs: items inside File > Import / Export (and the nested
 * Railway Data / Scenario submenus) are only visible while their submenu is hovered or focused.
 */
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
