/**
 * @file registry.ts
 * @brief The command registry: one Command per menu / context-menu / toolbar / keyboard action,
 *        run against the active tab. The menus (menu.ts), the context menu (context-menu.ts), the
 *        toolbar (toolbar.ts) and the keymap (keymap.ts) dispatch through it; menu shortcut hints,
 *        toolbar tooltips and Help > Keyboard Shortcuts read the shortcuts from it.
 */
import type { TabData } from '../tabs';
import type { ShortcutSpec } from '../shortcut-keys';
import type { Command, CommandContext, CommandSource, ContextMenuTarget } from './types';

export class CommandRegistry {
  private readonly commands = new Map<string, Command>();
  private readonly families: Command[] = [];
  private activeTab: () => TabData | null = () => null;

  /** Registers commands (ids are unique: a second registration of an id throws). */
  register(commands: readonly Command[]): void {
    for (const command of commands) {
      if (this.commands.has(command.id)) throw new Error(`Command "${command.id}" is registered twice`);
      this.commands.set(command.id, command);
      if (command.family) this.families.push(command);
    }
  }

  /** Where the commands find the active tab (main-editor.ts: the TabManager's). */
  setActiveTabProvider(provider: () => TabData | null): void {
    this.activeTab = provider;
  }

  /** All commands, in registration order. */
  list(): Command[] {
    return Array.from(this.commands.values());
  }

  /** The command of an id: the exact one, else the family whose prefix it starts with. */
  resolve(id: string): { command: Command; arg?: string } | null {
    const exact = this.commands.get(id);
    if (exact && !exact.family) return { command: exact };
    const family = this.families.find((f) => id.startsWith(f.id) && id.length > f.id.length);
    return family ? { command: family, arg: id.slice(family.id.length) } : null;
  }

  has(id: string): boolean {
    return this.resolve(id) !== null;
  }

  /** The context of an invocation from `source` on the active tab. */
  context(source: CommandSource, extra: { event?: Event; target?: ContextMenuTarget } = {}): CommandContext {
    return { tab: this.activeTab(), source, ...extra };
  }

  /**
   * Runs `id` (unknown ids are ignored; returns false). isEnabled is not checked here: it drives the
   * menus' aria-disabled (the menus skip disabled items), a key or API call always runs the command.
   * Errors propagate to the caller (like an exception in the event listener the command replaced).
   */
  run(id: string, ctx: Omit<CommandContext, 'arg'> = this.context('api')): boolean {
    const resolved = this.resolve(id);
    if (!resolved) return false;
    const full: CommandContext = resolved.arg !== undefined ? { ...ctx, arg: resolved.arg } : ctx;
    resolved.command.run(full);
    return true;
  }

  /** The shown shortcut of `id` (menus, tooltips), or null. */
  shortcutFor(id: string): ShortcutSpec | null {
    const exact = this.commands.get(id);
    if (exact?.shortcut) return exact.shortcut;
    const resolved = this.resolve(id);
    return resolved?.command.memberShortcuts?.[id] ?? null;
  }

  isChecked(id: string, ctx: CommandContext = this.context('api')): boolean | null {
    const resolved = this.resolve(id);
    if (!resolved?.command.isChecked) return null;
    return resolved.command.isChecked(resolved.arg !== undefined ? { ...ctx, arg: resolved.arg } : ctx);
  }

  isEnabled(id: string, ctx: CommandContext = this.context('api')): boolean | null {
    const resolved = this.resolve(id);
    if (!resolved?.command.isEnabled) return null;
    return resolved.command.isEnabled(resolved.arg !== undefined ? { ...ctx, arg: resolved.arg } : ctx);
  }
}

/** The app's registry (filled by ui/commands/index.ts registerAppCommands). */
export const commandRegistry = new CommandRegistry();
