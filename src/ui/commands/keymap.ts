/**
 * @file keymap.ts
 * @brief The one keyboard dispatcher: every shortcut of the registry (commands' `keys`) runs from
 *        here, once, on the active tab.
 *
 * Three document listeners, installed once:
 * - capture-phase keydown (the shell dispatcher): `always` bindings first (Ctrl/Cmd+S also while
 *   typing), then the interceptors (the scenario view takes ←/→/Esc and blocks editing keys),
 *   then — unless shouldIgnoreGraphShortcut says the user is typing, or the key is on the menu
 *   bar / context menu / toolbar dropdowns / left-panel overflow menu, or Delete/Backspace is on
 *   the left-panel tab strip — every matching `graph` binding;
 * - bubble-phase keydown and keyup: the bindings that ran after element handlers before
 *   (elements that stop a key keep it: tab buttons, dialogs, panel inputs), each with its guard.
 * Every matching binding runs, in registration order (Space starts label editing on a single
 * selected shape and, unless that editor took the focus, pan mode).
 */
import { shouldIgnoreGraphShortcut } from '../../core/keyboard-guard';
import type { CommandRegistry } from './registry';
import type { Command, CommandContext, KeyBinding } from './types';

/** Keys on these navigate the menus (menu.ts, context-menu.ts, toolbar.ts, left-panel-tabs.ts), not the diagram. */
const MENU_TARGETS = '#menu-bar, #context-menu, .rd-toolbar-menu, .left-panel-overflow-menu';

/** Returns true when it handled the key (the shell dispatcher stops there). */
export type KeyInterceptor = (e: KeyboardEvent) => boolean;

interface BoundKey {
  command: Command;
  binding: KeyBinding;
}

export class Keymap {
  private readonly interceptors: KeyInterceptor[] = [];
  private installed: (() => void) | null = null;

  constructor(private readonly registry: CommandRegistry) {}

  /** Adds a capture-phase interceptor that runs before the graph bindings (scenario view). */
  addInterceptor(interceptor: KeyInterceptor): () => void {
    this.interceptors.push(interceptor);
    return () => {
      const i = this.interceptors.indexOf(interceptor);
      if (i >= 0) this.interceptors.splice(i, 1);
    };
  }

  /** The bindings of a phase / event type, in registration order. */
  private bindings(phase: KeyBinding['phase'], type: 'keydown' | 'keyup'): BoundKey[] {
    const out: BoundKey[] = [];
    for (const command of this.registry.list()) {
      for (const binding of command.keys ?? []) {
        if (binding.phase === phase && (binding.type ?? 'keydown') === type) out.push({ command, binding });
      }
    }
    return out;
  }

  private fire({ command, binding }: BoundKey, e: KeyboardEvent, ctx: CommandContext): void {
    if (binding.when && !binding.when(e, ctx)) return;
    if (binding.preventDefault !== false) e.preventDefault();
    try {
      this.registry.run(binding.invoke?.(e) ?? command.id, ctx);
    } catch (error) {
      // reported like an exception in its own listener was; the other bindings of the key still run
      reportListenerError(error);
    }
  }

  private guardPasses(binding: KeyBinding, e: KeyboardEvent, ctx: CommandContext): boolean {
    switch (binding.guard) {
      case 'always':
      case 'none':
        return true;
      case 'graph':
        return !!ctx.tab && !shouldIgnoreGraphShortcut(e, ctx.tab.graph);
      case 'text':
        return !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement);
    }
  }

  /** The shell dispatcher (capture phase). */
  readonly onCaptureKeydown = (e: KeyboardEvent): void => {
    const ctx = this.registry.context('keyboard', { event: e });
    if (!ctx.tab) return;
    const bound = this.bindings('capture', 'keydown').filter(({ binding }) => binding.match(e));
    // Save works from anywhere, including while typing in a field
    const always = bound.filter(({ binding }) => binding.guard === 'always');
    if (always.length > 0) {
      always.forEach((b) => this.fire(b, e, ctx));
      return;
    }
    if (this.interceptors.some((intercept) => intercept(e))) return;
    if (shouldIgnoreGraphShortcut(e, ctx.tab.graph)) return;
    if (e.target instanceof Element && e.target.closest(MENU_TARGETS)) return;
    // Delete / Backspace on a left-panel tab closes that tab (left-panel-tabs.ts), never the selection
    if ((e.key === 'Delete' || e.key === 'Backspace') && e.target instanceof Element && e.target.closest('.left-panel-tabbar')) return;
    for (const b of bound) {
      if (b.binding.guard !== 'always' && this.guardPasses(b.binding, e, ctx)) this.fire(b, e, ctx);
    }
  };

  private readonly onBubble = (e: KeyboardEvent): void => {
    const type = e.type === 'keyup' ? 'keyup' : 'keydown';
    const bound = this.bindings('bubble', type).filter(({ binding }) => binding.match(e));
    if (bound.length === 0) return;
    for (const b of bound) {
      // each binding sees the state the previous ones left (an editor that took the focus)
      const ctx = this.registry.context('keyboard', { event: e });
      if (this.guardPasses(b.binding, e, ctx)) this.fire(b, e, ctx);
    }
  };

  /** Installs the document listeners (once); returns the uninstaller. */
  install(target: Document = document): () => void {
    if (this.installed) return this.installed;
    target.addEventListener('keydown', this.onCaptureKeydown, true);
    target.addEventListener('keydown', this.onBubble);
    target.addEventListener('keyup', this.onBubble);
    this.installed = () => {
      target.removeEventListener('keydown', this.onCaptureKeydown, true);
      target.removeEventListener('keydown', this.onBubble);
      target.removeEventListener('keyup', this.onBubble);
      this.installed = null;
    };
    return this.installed;
  }
}

/** Reports an error the way an uncaught exception in an event listener is reported. */
function reportListenerError(error: unknown): void {
  if (typeof globalThis.reportError === 'function') globalThis.reportError(error);
  else
    setTimeout(() => {
      throw error;
    });
}

// ---- key matchers ---------------------------------------------------------------------------------

/** Ctrl or Cmd. */
export const isMod = (e: KeyboardEvent): boolean => e.ctrlKey || e.metaKey;

/** e.key, lower-cased for single characters (Shift turns 'z' into 'Z'). */
export const keyOf = (e: KeyboardEvent): string => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
