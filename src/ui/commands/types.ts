/**
 * @file types.ts
 * @brief The command model of the shell: every menu item, context-menu item, toolbar button and
 *        keyboard shortcut runs a registered Command (ui/commands/registry.ts) against the active
 *        tab. The `data-action` / `data-command` value of an item is its command id.
 */
import type { Cell } from '@maxgraph/core';
import type { TabData } from '../tabs';
import type { ShortcutSpec } from '../shortcut-keys';

/** Where a command was invoked from (a few commands act on the context-menu target instead of the selection). */
export type CommandSource = 'menu' | 'contextMenu' | 'toolbar' | 'keyboard' | 'api';

/** The cell(s) a context-menu command acts on and where the menu was opened. */
export interface ContextMenuTarget {
  /** The right-clicked cell (null: the canvas menu). */
  cell: Cell | null;
  /** The cells the menu acts on (the selection it made or kept). */
  cells: Cell[];
  /** Client coordinates of the right-click (paste position). */
  clientX: number;
  clientY: number;
}

export interface CommandContext {
  /** The active tab (graph, command service, document, controllers); null before the first tab. */
  readonly tab: TabData | null;
  readonly source: CommandSource;
  /** The triggering event (keyboard shortcuts: the KeyboardEvent). */
  readonly event?: Event;
  /** Context-menu invocations. */
  readonly target?: ContextMenuTarget;
  /** For a family command (`railwayState:`), the rest of the invoked id (`aspect:stop`). */
  readonly arg?: string;
}

/**
 * Guard of a key binding, evaluated when the key is pressed:
 * - `always`: also while typing in a field (Ctrl/Cmd+S);
 * - `graph`: not while the user types (shouldIgnoreGraphShortcut: inputs, contentEditable, IME,
 *   the cell editor); capture bindings also skip keys on the menus / toolbar dropdowns and
 *   Delete/Backspace on the left-panel tab strip (the shell dispatcher's rules);
 * - `text`: not when the key's target is an `<input>` / `<textarea>` (zoom keys);
 * - `none`: always (Escape closing menus, releasing Space).
 */
export type KeyGuard = 'always' | 'graph' | 'text' | 'none';

export interface KeyBinding {
  /** keydown (default) or keyup. */
  type?: 'keydown' | 'keyup';
  /**
   * `capture`: the shell dispatcher (document capture phase, before element handlers);
   * `bubble`: after element handlers (document bubble phase; elements that stop the key keep it).
   */
  phase: 'capture' | 'bubble';
  guard: KeyGuard;
  /** Whether the event is this binding's key (exact modifiers / key / code). */
  match(e: KeyboardEvent): boolean;
  /** Further condition, checked at dispatch time after the guard (selection, focus, ...). */
  when?(e: KeyboardEvent, ctx: CommandContext): boolean;
  /** preventDefault() before running (default true). */
  preventDefault?: boolean;
  /** The id to run for this event (a family member, e.g. `railwayState:aspect:stop`); default the command's. */
  invoke?(e: KeyboardEvent): string;
}

/** Sections of Help > Keyboard Shortcuts, in their order. */
export const HELP_SECTIONS = [
  'File',
  'Edit',
  'View',
  'Arrange',
  'Connection arrows (hover a shape)',
  'Object states (selected railway objects)',
  'Menus',
  'Help',
] as const;

export type HelpSection = (typeof HELP_SECTIONS)[number];

/** A row of Help > Keyboard Shortcuts. */
export interface HelpEntry {
  section: HelpSection;
  /** Position in the section (rows are sorted by it; gestures without a command interleave). */
  order: number;
  description: string;
  /** The keys as shown; default: the command's formatted `shortcut`. */
  keys?: (mac: boolean) => string;
}

export interface Command {
  /** The `data-action` / `data-command` value (a family: its prefix ending in ':'). */
  readonly id: string;
  readonly label: string;
  run(ctx: CommandContext): void;
  isEnabled?(ctx: CommandContext): boolean;
  isChecked?(ctx: CommandContext): boolean;
  /** The shortcut shown in menus, tooltips and Help (the bindings in `keys` may accept more). */
  readonly shortcut?: ShortcutSpec;
  /** The key bindings that run it (none: menu / toolbar only). */
  readonly keys?: readonly KeyBinding[];
  /** Help > Keyboard Shortcuts rows (a command with a `shortcut` must have one). */
  readonly help?: readonly HelpEntry[];
  /** A family: the id is a prefix (`railwayState:`), the rest is passed as `ctx.arg`. */
  readonly family?: boolean;
  /** Shortcuts of a family's members, by full id (Railway > Object State ▸ items). */
  readonly memberShortcuts?: Readonly<Record<string, ShortcutSpec>>;
}
