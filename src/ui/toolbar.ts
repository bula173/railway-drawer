/**
 * @file toolbar.ts
 * @brief The main toolbar (installed once by main-editor.ts): each button runs its `data-command`
 *        from the command registry (ui/commands) on the active tab; one inline-SVG icon set
 *        (`data-icon`, no emoji), the accessible name (`data-label` -> aria-label) and a tooltip with
 *        the shortcut (`data-shortcut` = a command id), the Align/Distribute dropdown (`#btn-align`
 *        -> `#align-menu`, items `#btn-align-*` / `#btn-distribute-*`), and toggle buttons mirroring
 *        a menu item's aria-checked (`data-mirror-action`, e.g. km Ruler) as aria-pressed.
 */
import { createInstallScope, installOnce } from '../core/install-once';
import { shortcutForAction } from './shortcut-keys';
import { commandRegistry } from './commands/registry';
import type { CommandSource } from './commands/types';

import { createToolbarIcon } from '../core/icons';

/**
 * Inline icons of other chrome (top bar, panels, dialogs): each `[data-rd-icon]` element inside `root`
 * gets its `TOOLBAR_ICONS` svg prepended once (size `data-rd-icon-size`, default 16). An element without
 * text and without aria-label is named by its title. Title and text are otherwise left alone.
 */
export function applyInlineIcons(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-rd-icon]').forEach((el) => {
    if (!el.querySelector(':scope > svg.rd-icon')) setInlineIcon(el, el.dataset.rdIcon ?? '');
  });
}

/** Sets (or replaces) the inline icon of `el`, e.g. a toggle's eye / eye-off. */
export function setInlineIcon(el: HTMLElement, name: string): void {
  el.querySelector(':scope > svg.rd-icon')?.remove();
  el.dataset.rdIcon = name;
  const icon = createToolbarIcon(name, Number(el.dataset.rdIconSize) || 16);
  if (!icon) return;
  icon.classList.add('rd-icon');
  el.prepend(icon);
  if (!el.textContent?.trim() && !el.getAttribute('aria-label') && el.title) el.setAttribute('aria-label', el.title);
}

/** Icon, aria-label and tooltip ("Undo (Ctrl+Z)") of each `[data-icon]` button inside `root`. */
export function decorateToolbarButtons(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-icon]').forEach((button) => {
    const icon = createToolbarIcon(button.dataset.icon ?? '');
    if (icon && !button.querySelector(':scope > svg')) button.prepend(icon);
    const label = button.dataset.label ?? button.getAttribute('aria-label') ?? button.title;
    if (!label) return;
    button.setAttribute('aria-label', label);
    const shortcut = button.dataset.shortcut ? shortcutForAction(button.dataset.shortcut) : null;
    button.title = shortcut ? `${label} (${shortcut})` : label;
  });
}

/** Toggle buttons that follow a menu item's aria-checked (`data-mirror-action`) as aria-pressed. */
function mirrorMenuToggles(): void {
  document.querySelectorAll<HTMLElement>('[data-mirror-action]').forEach((button) => {
    const item = document.querySelector<HTMLElement>(`.menu-dropdown [data-action="${button.dataset.mirrorAction}"]`);
    if (!item) return;
    const sync = (): void => button.setAttribute('aria-pressed', item.getAttribute('aria-checked') === 'true' ? 'true' : 'false');
    sync();
    new MutationObserver(sync).observe(item, { attributes: true, attributeFilter: ['aria-checked'] });
  });
}

/** The Align/Distribute dropdown: a small role=menu popup below `#btn-align`. */
function installAlignMenu(): void {
  const button = document.getElementById('btn-align');
  const menu = document.getElementById('align-menu');
  if (!button || !menu) return;
  const items = (): HTMLElement[] => Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'));
  const close = (focusButton: boolean): void => {
    if (menu.hidden) return;
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (focusButton) button.focus();
  };
  const open = (focus: 'first' | 'last' | null): void => {
    const r = button.getBoundingClientRect();
    menu.style.left = `${Math.round(r.left)}px`;
    menu.style.top = `${Math.round(r.bottom + 2)}px`;
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    const list = items();
    if (focus) (focus === 'first' ? list[0] : list[list.length - 1])?.focus();
  };
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menu.hidden) open('first');
    else close(false);
  });
  button.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      open(e.key === 'ArrowDown' ? 'first' : 'last');
    }
  });
  menu.addEventListener('keydown', (e) => {
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLElement);
    const move = (to: number): void => {
      e.preventDefault();
      list[(to + list.length) % list.length]?.focus();
    };
    if (e.key === 'ArrowDown') move(i + 1);
    else if (e.key === 'ArrowUp') move(i - 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(list.length - 1);
    else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === 'Tab') close(false);
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      (document.activeElement as HTMLElement | null)?.click();
    }
  });
  // The items run their align / distribute commands (bindCommandButtons); the menu just closes after them
  menu.addEventListener('click', (e) => {
    if ((e.target as Element).closest('[role="menuitem"]')) close(true);
  });
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target as Node) && e.target !== button) close(false);
  });
  window.addEventListener('resize', () => close(false));
}

/**
 * Every `[data-command]` button inside `root` runs its command on the active tab when clicked
 * (bound on the button itself, so it runs before the Align dropdown's own close handler).
 */
export function bindCommandButtons(root: ParentNode = document, signal?: AbortSignal, source: CommandSource = 'toolbar'): void {
  root.querySelectorAll<HTMLElement>('[data-command]').forEach((button) => {
    button.addEventListener('click', (e) => {
      const id = button.dataset.command;
      if (id) commandRegistry.run(id, commandRegistry.context(source, { event: e }));
    }, { signal });
  });
}

const PAGE = createInstallScope();

/** Main toolbar chrome (once). */
export function installToolbar(): void {
  if (!installOnce(PAGE, 'toolbar')) return;
  decorateToolbarButtons(document.getElementById('toolbar-container') ?? document);
  decorateToolbarButtons(document.getElementById('align-menu') ?? document);
  // top bar (logo, Share) and the Properties panel's text alignment buttons
  applyInlineIcons(document.querySelector('.top-bar') ?? document);
  applyInlineIcons(document.getElementById('property-content') ?? document);
  mirrorMenuToggles();
  installAlignMenu();
  bindCommandButtons(document.getElementById('toolbar-container') ?? document);
  bindCommandButtons(document.getElementById('align-menu') ?? document);
}
