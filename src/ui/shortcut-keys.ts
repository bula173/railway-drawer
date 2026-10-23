/**
 * @file shortcut-keys.ts
 * @brief Formatting of the keyboard shortcuts for menus (right-aligned `<kbd>` hints), the context
 *        menu, toolbar tooltips and Help > Keyboard Shortcuts.
 *
 * The shortcuts themselves are the commands' (ui/commands: `Command.shortcut`, the Object State
 * items' `memberShortcuts`), and so are the key bindings that run them (`Command.keys`, dispatched
 * by ui/commands/keymap.ts): a menu hint can no longer drift from the binding.
 */
import { commandRegistry } from './commands/registry';

export interface ShortcutSpec {
  /** Ctrl (Windows/Linux) or Cmd (macOS); the handlers accept either. */
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
  /** Key as shown (upper-case letter, digit, '+', '-', 'Delete', 'F1', ...). */
  key: string;
}

/** The shortcut of a menu / context-menu / toolbar action (its command), or null. */
export function shortcutSpecFor(action: string): ShortcutSpec | null {
  return commandRegistry.shortcutFor(action);
}

/** True on Apple platforms (Cmd instead of Ctrl, symbol modifiers). */
export function isMacPlatform(nav: Pick<Navigator, 'platform' | 'userAgent'> | undefined = globalThis.navigator): boolean {
  if (!nav) return false;
  return /Mac|iPhone|iPad|iPod/i.test(nav.platform || nav.userAgent || '');
}

/** "Ctrl+Shift+G" elsewhere, "⇧⌘G" on macOS (Apple's modifier order: ⌃ ⌥ ⇧ ⌘). */
export function formatShortcut(spec: ShortcutSpec, mac: boolean = isMacPlatform()): string {
  if (mac) {
    return `${spec.alt ? '⌥' : ''}${spec.shift ? '⇧' : ''}${spec.mod ? '⌘' : ''}${spec.key}`;
  }
  const parts: string[] = [];
  if (spec.mod) parts.push('Ctrl');
  if (spec.alt) parts.push('Alt');
  if (spec.shift) parts.push('Shift');
  parts.push(spec.key);
  return parts.join('+');
}

/** `aria-keyshortcuts` value ("Control+Shift+G", "Meta+Z", "Delete"). */
export function ariaKeyShortcut(spec: ShortcutSpec, mac: boolean = isMacPlatform()): string {
  const parts: string[] = [];
  if (spec.mod) parts.push(mac ? 'Meta' : 'Control');
  if (spec.alt) parts.push('Alt');
  if (spec.shift) parts.push('Shift');
  parts.push(spec.key === '+' ? 'Plus' : spec.key === '-' ? 'Minus' : spec.key);
  return parts.join('+');
}

/** The shortcut text of a menu action, or null when it has none. */
export function shortcutForAction(action: string, mac: boolean = isMacPlatform()): string | null {
  const spec = shortcutSpecFor(action);
  return spec ? formatShortcut(spec, mac) : null;
}

/**
 * For the items whose `data-action` has a shortcut: puts the item's text into `.rd-menu-label` and
 * appends a right-aligned `<kbd class="rd-kbd">` hint (idempotent: items keep one label/hint).
 * Text-only changes of an item (Lock/Unlock) then go to its label: see `setMenuItemLabel`.
 */
export function applyShortcutHints(items: ArrayLike<HTMLElement>, mac: boolean = isMacPlatform()): void {
  for (const item of Array.from(items)) {
    const action = item.getAttribute('data-action') ?? '';
    const spec = shortcutSpecFor(action);
    if (!spec || item.querySelector(':scope > kbd.rd-kbd')) continue;
    ensureMenuLabel(item);
    const kbd = document.createElement('kbd');
    kbd.className = 'rd-kbd';
    kbd.textContent = formatShortcut(spec, mac);
    // The label already names the command; the shortcut is announced via aria-keyshortcuts
    kbd.setAttribute('aria-hidden', 'true');
    item.appendChild(kbd);
    item.setAttribute('aria-keyshortcuts', ariaKeyShortcut(spec, mac));
  }
}

function ensureMenuLabel(item: HTMLElement): HTMLElement {
  const existing = item.querySelector<HTMLElement>(':scope > .rd-menu-label');
  if (existing) return existing;
  const label = document.createElement('span');
  label.className = 'rd-menu-label';
  while (item.firstChild) label.appendChild(item.firstChild);
  item.appendChild(label);
  return label;
}

/** Changes the visible text of a menu item without dropping its shortcut hint. */
export function setMenuItemLabel(item: HTMLElement, text: string): void {
  ensureMenuLabel(item).textContent = text;
}
