/**
 * @file menu.ts
 * @brief The menu bar (installed once by main-editor.ts): WAI-ARIA menubar keyboard pattern,
 *        submenus, shortcut hints; an item runs its `data-action` command from the registry
 *        (ui/commands) on the active tab. Escape closing the menus is the `menus.close` command.
 */
import { installOnce } from '../core/install-once';
import { applyShortcutHints } from './shortcut-keys';
import { commandRegistry } from './commands/registry';
import { syncMenuItemsFromCommands } from './menu-state';

/** Families that run without the graph refresh that follows the other menu actions (as before). */
const NO_REFRESH_PREFIXES = ['exportRailway:', 'railwayRoute:', 'railwayState:'];

/** Runs a menu item's action on the active tab, then refreshes its graph (except the families above). */
export function runMenuAction(action: string): void {
  const ctx = commandRegistry.context('menu');
  commandRegistry.run(action, ctx);
  if (NO_REFRESH_PREFIXES.some((prefix) => action.startsWith(prefix))) return;
  ctx.tab?.graph.refresh();
}

/** Binds the menu bar (once per `#menu-bar` element). */
export function installMenuBar(): void {
  const bar = document.getElementById('menu-bar');
  if (!bar || !installOnce(bar, 'menu-bar')) return;
  // WAI-ARIA menubar roles
  setupMenubarAria();

  // Setup menu item clicks to toggle dropdowns
  const menuItems = document.querySelectorAll<HTMLElement>('.menu-item');
  menuItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const menu = item.getAttribute('data-menu');
      toggleMenu(menu!);
    });
    item.addEventListener('keydown', (e) => onMenubarKeydown(e, item));
  });

  // Setup menu dropdown item clicks (also the generated remote-provider items: delegated)
  document.querySelectorAll<HTMLElement>('.menu-dropdown').forEach((dropdown) => {
    dropdown.addEventListener('click', (e) => {
      const item = (e.target as Element | null)?.closest<HTMLElement>('.menu-dropdown-item');
      if (!item || !dropdown.contains(item)) return;
      e.stopPropagation();
      if (item.getAttribute('aria-disabled') === 'true') return;
      // Items that bring their own handler (File > Open from <provider>…) only close the menu
      if (item.closest('#file-menu-remote-items')) {
        closeAllMenus();
        return;
      }
      const action = item.getAttribute('data-action');
      // Close (and give the focus back to the page) before the action opens a dialog
      closeAllMenus();
      if (action) runMenuAction(action);
    });
    dropdown.addEventListener('keydown', (e) => onMenuKeydown(e, dropdown));
    // Submenu titles: aria-expanded while their list shows (CSS :hover / :focus-within)
    const syncExpanded = (): void => syncSubmenusExpanded(dropdown);
    for (const type of ['focusin', 'focusout', 'mouseover', 'mouseleave']) dropdown.addEventListener(type, () => requestAnimationFrame(syncExpanded));
  });

  // Close menus when clicking elsewhere
  document.addEventListener('click', () => {
    closeAllMenus();
  });
}

function toggleMenu(menu: string, focus: 'first' | 'last' | null = null) {
  const dropdown = document.querySelector(`.menu-dropdown[data-menu="${menu}"]`) as HTMLElement;
  if (dropdown) {
    const wasOpen = dropdown.style.display !== 'none';
    // Close all other menus
    closeAllMenus();
    if (!wasOpen || focus) openMenu(menu, focus);
  }
}

/** Opens one dropdown (the others closed) and optionally focuses its first/last item. */
function openMenu(menu: string, focus: 'first' | 'last' | null): void {
  const dropdown = document.querySelector<HTMLElement>(`.menu-dropdown[data-menu="${menu}"]`);
  const button = document.querySelector<HTMLElement>(`.menu-item[data-menu="${menu}"]`);
  if (!dropdown || !button) return;
  closeAllMenus();
  setupMenuItemsAria(dropdown);
  // check marks / disabled items from the commands (menu-state.ts)
  syncMenuItemsFromCommands(dropdown);
  dropdown.style.display = 'block';
  button.setAttribute('aria-expanded', 'true');
  setRovingButton(button);
  if (focus) {
    const items = visibleMenuItems(dropdown);
    (focus === 'first' ? items[0] : items[items.length - 1])?.focus();
  }
}

/** Closes every dropdown of the menu bar. */
export function closeAllMenus(): void {
  const dropdowns = document.querySelectorAll('.menu-dropdown');
  dropdowns.forEach((dropdown) => {
    (dropdown as HTMLElement).style.display = 'none';
  });
  document.querySelectorAll('.menu-item[aria-expanded="true"]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
}

/** The open dropdown's menu name, or null. */
function openMenuName(): string | null {
  const open = Array.from(document.querySelectorAll<HTMLElement>('.menu-dropdown')).find((d) => d.style.display !== 'none');
  return open?.getAttribute('data-menu') ?? null;
}

/** Keys on a menubar button (File, Edit, ...): WAI-ARIA menubar pattern. */
function onMenubarKeydown(e: KeyboardEvent, button: HTMLElement): void {
  const buttons = menubarButtons();
  const index = buttons.indexOf(button);
  const menu = button.getAttribute('data-menu')!;
  const moveTo = (target: HTMLElement | undefined): void => {
    if (!target) return;
    const wasOpen = openMenuName() !== null;
    setRovingButton(target);
    target.focus();
    if (wasOpen) openMenu(target.getAttribute('data-menu')!, 'first');
  };
  switch (e.key) {
    case 'ArrowDown':
    case 'Enter':
    case ' ':
      e.preventDefault();
      e.stopPropagation();
      openMenu(menu, 'first');
      break;
    case 'ArrowUp':
      e.preventDefault();
      e.stopPropagation();
      openMenu(menu, 'last');
      break;
    case 'ArrowRight':
      e.preventDefault();
      moveTo(buttons[(index + 1) % buttons.length]);
      break;
    case 'ArrowLeft':
      e.preventDefault();
      moveTo(buttons[(index - 1 + buttons.length) % buttons.length]);
      break;
    case 'Home':
      e.preventDefault();
      moveTo(buttons[0]);
      break;
    case 'End':
      e.preventDefault();
      moveTo(buttons[buttons.length - 1]);
      break;
    case 'Escape':
      closeAllMenus();
      break;
  }
}

/** Keys inside an open dropdown (and its submenu). */
function onMenuKeydown(e: KeyboardEvent, dropdown: HTMLElement): void {
  const target = e.target as HTMLElement;
  const menu = dropdown.getAttribute('data-menu')!;
  const button = document.querySelector<HTMLElement>(`.menu-item[data-menu="${menu}"]`);
  const submenu = target.closest<HTMLElement>('.menu-submenu-list');
  const list = submenu ?? dropdown;
  const items = submenu ? visibleMenuItems(submenu, submenu) : visibleMenuItems(dropdown);
  const index = items.indexOf(target);
  const buttons = menubarButtons();
  const buttonIndex = button ? buttons.indexOf(button) : -1;
  const focusItem = (item: HTMLElement | undefined): void => item?.focus();
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      focusItem(items[(index + 1) % items.length]);
      break;
    case 'ArrowUp':
      e.preventDefault();
      focusItem(items[(index - 1 + items.length) % items.length]);
      break;
    case 'Home':
      e.preventDefault();
      focusItem(items[0]);
      break;
    case 'End':
      e.preventDefault();
      focusItem(items[items.length - 1]);
      break;
    case 'Enter':
    case ' ':
      e.preventDefault();
      e.stopPropagation();
      if (target.classList.contains('menu-submenu-title')) {
        const sub = target.parentElement?.querySelector<HTMLElement>('.menu-submenu-list');
        if (sub) focusItem(visibleMenuItems(sub, sub)[0]);
      } else {
        // Focus back on the menubar first: a dialog opened by the item takes it from there and
        // returns it there when it closes
        button?.focus();
        target.click();
      }
      break;
    case 'ArrowRight':
      e.preventDefault();
      if (target.classList.contains('menu-submenu-title')) {
        const sub = target.parentElement?.querySelector<HTMLElement>('.menu-submenu-list');
        if (sub) focusItem(visibleMenuItems(sub, sub)[0]);
      } else if (buttonIndex >= 0) {
        const next = buttons[(buttonIndex + 1) % buttons.length];
        setRovingButton(next);
        openMenu(next.getAttribute('data-menu')!, 'first');
      }
      break;
    case 'ArrowLeft':
      e.preventDefault();
      if (submenu && list !== dropdown) {
        focusItem(submenu.parentElement?.querySelector<HTMLElement>('.menu-submenu-title') ?? undefined);
      } else if (buttonIndex >= 0) {
        const prev = buttons[(buttonIndex - 1 + buttons.length) % buttons.length];
        setRovingButton(prev);
        openMenu(prev.getAttribute('data-menu')!, 'first');
      }
      break;
    case 'Escape':
      e.preventDefault();
      if (submenu) {
        focusItem(submenu.parentElement?.querySelector<HTMLElement>('.menu-submenu-title') ?? undefined);
        e.stopPropagation();
      } else {
        closeAllMenus();
        button?.focus();
      }
      break;
    case 'Tab':
      closeAllMenus();
      break;
  }
}

// ---- WAI-ARIA menubar ---------------------------------------------------------------------------

/** The menubar buttons (File, Edit, View, ...) in order. */
function menubarButtons(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('#menu-bar .menu-item[data-menu]'));
}

/** Roving tabindex: only `button` of the menubar is in the Tab order. */
function setRovingButton(button: HTMLElement): void {
  for (const other of menubarButtons()) other.tabIndex = other === button ? 0 : -1;
}

/**
 * Roles of a dropdown's items (also the generated "Open from <provider>…" items): menuitem unless
 * already a menuitemcheckbox, separators, the (nested) submenus; shortcut hints.
 */
function setupMenuItemsAria(dropdown: HTMLElement): void {
  dropdown.querySelectorAll<HTMLElement>('.menu-dropdown-item').forEach((item) => {
    if (!item.getAttribute('role')) item.setAttribute('role', 'menuitem');
    item.tabIndex = -1;
  });
  dropdown.querySelectorAll<HTMLElement>('.rd-sep').forEach((sep) => sep.setAttribute('role', 'separator'));
  dropdown.querySelectorAll<HTMLElement>('#file-menu-remote-items').forEach((group) => group.setAttribute('role', 'none'));
  dropdown.querySelectorAll<HTMLElement>('.menu-submenu').forEach((submenu) => {
    submenu.setAttribute('role', 'none');
    submenu.removeAttribute('tabindex');
    const title = submenu.querySelector<HTMLElement>('.menu-submenu-title');
    const list = submenu.querySelector<HTMLElement>('.menu-submenu-list');
    if (title) {
      title.setAttribute('role', 'menuitem');
      title.setAttribute('aria-haspopup', 'menu');
      if (!title.hasAttribute('aria-expanded')) title.setAttribute('aria-expanded', 'false');
      title.tabIndex = -1;
    }
    if (list) {
      list.setAttribute('role', 'menu');
      if (title?.textContent) list.setAttribute('aria-label', title.textContent.trim());
    }
  });
  applyShortcutHints(dropdown.querySelectorAll<HTMLElement>('.menu-dropdown-item[data-action]'));
}

/** Static roles of the menubar, its buttons and dropdowns (idempotent). */
function setupMenubarAria(): void {
  const bar = document.getElementById('menu-bar');
  if (!bar) return;
  bar.setAttribute('role', 'menubar');
  bar.setAttribute('aria-label', 'Main menu');
  bar.querySelectorAll<HTMLElement>('.menu-item-container').forEach((c) => c.setAttribute('role', 'none'));
  menubarButtons().forEach((button, i) => {
    const menu = button.getAttribute('data-menu')!;
    const dropdown = bar.querySelector<HTMLElement>(`.menu-dropdown[data-menu="${menu}"]`);
    button.setAttribute('role', 'menuitem');
    button.setAttribute('aria-haspopup', 'menu');
    if (!button.hasAttribute('aria-expanded')) button.setAttribute('aria-expanded', 'false');
    if (!button.id) button.id = `menu-button-${menu}`;
    if (button.getAttribute('tabindex') === null) button.tabIndex = i === 0 ? 0 : -1;
    if (dropdown) {
      if (!dropdown.id) dropdown.id = `menu-${menu}`;
      dropdown.setAttribute('role', 'menu');
      dropdown.setAttribute('aria-labelledby', button.id);
      button.setAttribute('aria-controls', dropdown.id);
      setupMenuItemsAria(dropdown);
    }
  });
}

function syncSubmenusExpanded(dropdown: HTMLElement): void {
  dropdown.querySelectorAll<HTMLElement>('.menu-submenu').forEach((submenu) => {
    const list = submenu.querySelector<HTMLElement>(':scope > .menu-submenu-list');
    const open = !!list && list.getClientRects().length > 0;
    submenu.querySelector(':scope > .menu-submenu-title')?.setAttribute('aria-expanded', String(open));
  });
}

function isShown(node: HTMLElement): boolean {
  return node.getClientRects().length > 0 || node.style.display !== 'none' && !node.hidden && !node.closest('[hidden]');
}

/**
 * The focusable items of a menu in order: menuitem / menuitemcheckbox / submenu titles whose
 * nearest menu is `menu` (submenu children belong to their submenu list), not hidden.
 */
function visibleMenuItems(menu: HTMLElement, scope: HTMLElement = menu): HTMLElement[] {
  return Array.from(scope.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemcheckbox"]')).filter(
    (item) => item.parentElement?.closest('[role="menu"]') === menu && item.style.display !== 'none' && isShown(item)
  );
}
