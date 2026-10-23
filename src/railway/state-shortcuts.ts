/**
 * @file state-shortcuts.ts
 * @brief Keyboard shortcuts for common runtime states of the selected objects (Alt + key; no
 *        dependencies, main-chunk safe). Matched by `KeyboardEvent.code`, because Alt types
 *        characters on macOS (Alt+O = "ø"), so `event.key` would not match. Free of clashes with
 *        the app's bindings (shortcut-keys.ts: only Alt+Shift+A uses Alt) and draw.io's Alt+Shift
 *        ones (Shift is not allowed here). Bound by the `railwayState:` command (ui/commands/
 *        railway.ts, dispatched by the keymap to install-railway-states.ts); shown in the
 *        Railway > Object State menu, the context menu's state submenus and Help > Keyboard Shortcuts.
 */

export interface StateShortcut {
  /** `KeyboardEvent.code` (layout position, not the typed character). */
  code: string;
  /** Key as shown in hints. */
  key: string;
  /** `railway-state-request` command (state-menu.ts). */
  command: string;
  /** Help text. */
  description: string;
}

export const STATE_SHORTCUTS: readonly StateShortcut[] = [
  { code: 'KeyF', key: 'F', command: 'state:free', description: 'Free (sections, tracks, points, routes)' },
  { code: 'KeyO', key: 'O', command: 'state:occupied', description: 'Occupied' },
  { code: 'KeyR', key: 'R', command: 'state:reserved', description: 'Reserved (route set)' },
  { code: 'KeyN', key: 'N', command: 'position:normal', description: 'Points normal' },
  { code: 'KeyV', key: 'V', command: 'position:reverse', description: 'Points reverse' },
  { code: 'Digit1', key: '1', command: 'aspect:stop', description: 'Signal aspect stop' },
  { code: 'Digit2', key: '2', command: 'aspect:proceed', description: 'Signal aspect proceed' },
  { code: 'Digit3', key: '3', command: 'aspect:caution', description: 'Signal aspect caution' },
  { code: 'Digit4', key: '4', command: 'aspect:shunt', description: 'Signal aspect shunt' },
];

/** The state command of a key event (Alt + key, no Ctrl/Cmd/Shift), or null. */
export function stateShortcutCommand(e: Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'code'>): string | null {
  if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return null;
  return STATE_SHORTCUTS.find((s) => s.code === e.code)?.command ?? null;
}
