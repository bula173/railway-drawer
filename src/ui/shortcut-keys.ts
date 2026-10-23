/**
 * @file shortcut-keys.ts
 * @brief The app's real keyboard bindings, formatted for menus (right-aligned `<kbd>` hints),
 *        the context menu and Help > Keyboard Shortcuts.
 *
 * The bindings themselves live in the handlers: the capture-phase dispatcher in main-editor.ts
 * (Ctrl/Cmd+Z/Y/Shift+Z/C/X/V/A/S, Delete, Escape, Alt+Shift+A), ZoomController (Ctrl/Cmd +/-/0/1),
 * GroupingController (Ctrl/Cmd+G, Ctrl/Cmd+Shift+G), DuplicateOffsetController (Ctrl/Cmd+D) and
 * ShortcutsHelpController (F1), install-railway-states.ts (Alt+F/O/R/N/V/1-4: object states, table in
 * src/railway/state-shortcuts.ts). Keep this table in step with them: it only describes them.
 */
import { STATE_SHORTCUTS } from '../railway/state-shortcuts';

export interface ShortcutSpec {
  /** Ctrl (Windows/Linux) or Cmd (macOS); the handlers accept either. */
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
  /** Key as shown (upper-case letter, digit, '+', '-', 'Delete', 'F1', ...). */
  key: string;
}

/** Menu / context-menu `data-action` -> its keyboard shortcut. */
export const ACTION_SHORTCUTS: Readonly<Record<string, ShortcutSpec>> = {
  save: { mod: true, key: 'S' },
  undo: { mod: true, key: 'Z' },
  redo: { mod: true, key: 'Y' },
  cut: { mod: true, key: 'X' },
  copy: { mod: true, key: 'C' },
  paste: { mod: true, key: 'V' },
  delete: { key: 'Delete' },
  selectAll: { mod: true, key: 'A' },
  selectVertices: { mod: true, shift: true, key: 'I' },
  selectEdges: { mod: true, shift: true, key: 'E' },
  selectNone: { mod: true, shift: true, key: 'A' },
  duplicate: { mod: true, key: 'D' },
  group: { mod: true, key: 'G' },
  ungroup: { mod: true, shift: true, key: 'G' },
  zoomIn: { mod: true, key: '+' },
  zoomOut: { mod: true, key: '-' },
  zoomActual: { mod: true, key: '0' },
  fitWindow: { mod: true, key: '1' },
  toggleConnectionArrows: { alt: true, shift: true, key: 'A' },
  toggleLeftPanel: { mod: true, shift: true, key: 'K' },
  toggleRightPanel: { mod: true, shift: true, key: 'P' },
  shortcuts: { key: 'F1' },
  // Railway > Object State ▸ items (`railwayState:<command>`)
  ...Object.fromEntries(STATE_SHORTCUTS.map((s): [string, ShortcutSpec] => [`railwayState:${s.command}`, { alt: true, key: s.key }])),
};

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
  const spec = ACTION_SHORTCUTS[action];
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
    const spec = ACTION_SHORTCUTS[action];
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
