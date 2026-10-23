/**
 * @file help.ts
 * @brief Help menu commands (Keyboard Shortcuts = F1, About) and the generated Help > Keyboard
 *        Shortcuts content: one row per command `help` entry plus the mouse / menu gestures below,
 *        in the sections of HELP_SECTIONS.
 */
import { emit } from '../../core/event-bus';
import { showAboutDialog } from '../app-dialogs';
import { formatShortcut } from '../shortcut-keys';
import type { CommandRegistry } from './registry';
import { HELP_SECTIONS, type Command, type HelpEntry, type HelpSection } from './types';

export const helpCommands: readonly Command[] = [
  {
    id: 'shortcuts',
    label: 'Keyboard Shortcuts',
    shortcut: { key: 'F1' },
    // F1 never opens it on top of another dialog (shortcuts-help.ts checks; its focus trap owns the keys)
    keys: [{ phase: 'bubble', guard: 'none', match: (e) => e.key === 'F1' }],
    help: [{ section: 'Help', order: 10, description: 'Keyboard shortcuts (this dialog)' }],
    run: (ctx) => emit('shortcuts-help-request', ctx.source === 'keyboard' ? { keyboard: true } : undefined),
  },
  { id: 'about', label: 'About', run: () => showAboutDialog() },
];

/** Help rows that are gestures, not commands (mouse, menu navigation). */
const GESTURES: ReadonlyArray<HelpEntry & { keys: (mac: boolean) => string }> = [
  { section: 'View', order: 50, keys: (mac) => (mac ? '⌘+Scroll' : 'Ctrl+Scroll'), description: 'Zoom around the pointer (also pinch)' },
  { section: 'View', order: 60, keys: () => 'Scroll / Shift+Scroll', description: 'Scroll the canvas vertically / horizontally' },
  { section: 'View', order: 70, keys: () => 'Drag on empty canvas', description: 'Pan the canvas' },
  { section: 'View', order: 80, keys: () => 'Space (hold) + drag / middle-drag', description: 'Pan the canvas (also over shapes)' },
  { section: 'View', order: 90, keys: () => 'Shift+drag on empty canvas', description: 'Select with a rectangle (rubber band)' },
  { section: 'Connection arrows (hover a shape)', order: 10, keys: () => 'Click arrow', description: 'Connect to the shape in that direction, or add a connected copy' },
  { section: 'Connection arrows (hover a shape)', order: 20, keys: (mac) => `${mac ? '⌘+Click' : 'Ctrl+Click'} arrow`, description: 'Always add a connected copy' },
  { section: 'Connection arrows (hover a shape)', order: 30, keys: () => 'Shift+Click arrow', description: 'Connect without copying (dangling edge if nothing is there)' },
  { section: 'Connection arrows (hover a shape)', order: 40, keys: (mac) => `${mac ? '⇧⌘' : 'Ctrl+Shift'}+Click arrow`, description: 'Add a copy without an edge' },
  { section: 'Connection arrows (hover a shape)', order: 50, keys: () => 'Drag arrow', description: 'Connect to the shape you drop on, or add a connected copy on blank canvas' },
  { section: 'Connection arrows (hover a shape)', order: 60, keys: (mac) => `${mac ? '⌥' : 'Alt'} (hold)`, description: 'Hide the arrows' },
  { section: 'Menus', order: 10, keys: () => 'Arrow keys', description: 'Move between menus and items' },
  { section: 'Menus', order: 20, keys: () => 'Home / End', description: 'First / last item' },
  { section: 'Menus', order: 30, keys: () => 'Enter / Space', description: 'Run the item' },
];

export interface ShortcutRow {
  keys: string;
  description: string;
}

export interface ShortcutSection {
  section: HelpSection;
  items: ShortcutRow[];
}

/** Help > Keyboard Shortcuts, generated from the registry (keys formatted for the platform). */
export function helpSections(registry: CommandRegistry, mac: boolean): ShortcutSection[] {
  const rows: Array<{ section: HelpSection; order: number; row: ShortcutRow }> = [];
  for (const command of registry.list()) {
    for (const entry of command.help ?? []) {
      const keys = entry.keys ? entry.keys(mac) : command.shortcut ? formatShortcut(command.shortcut, mac) : '';
      rows.push({ section: entry.section, order: entry.order, row: { keys, description: entry.description } });
    }
  }
  for (const g of GESTURES) rows.push({ section: g.section, order: g.order, row: { keys: g.keys(mac), description: g.description } });
  return HELP_SECTIONS.map((section) => ({
    section,
    items: rows
      .filter((r) => r.section === section)
      .sort((a, b) => a.order - b.order)
      .map((r) => r.row),
  })).filter((s) => s.items.length > 0);
}
