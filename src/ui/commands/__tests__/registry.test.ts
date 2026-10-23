/**
 * The command registry (ui/commands): every menu / context-menu / toolbar item of index.html has a
 * command, shortcuts are unique, every shown shortcut has a key binding and a Help row, the keymap
 * runs bindings on the active tab with the shell's guards.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadAppDom, clearAppDom } from '../../../__tests__/ui/app-dom';
import { ensureDrawioMenuItems } from '../../../drawio-shapes/behaviour/menu';
import { STATE_SHORTCUTS } from '../../../railway/state-shortcuts';
import { formatShortcut, shortcutSpecFor, type ShortcutSpec } from '../../shortcut-keys';
import { APP_COMMANDS, commandRegistry, registerAppCommands, CommandRegistry, Keymap } from '../index';
import { helpSections } from '../help';
import type { TabData } from '../../tabs';

const keyOf = (s: ShortcutSpec): string => `${!!s.mod}|${!!s.shift}|${!!s.alt}|${s.key.toUpperCase()}`;

describe('app commands', () => {
  beforeAll(() => registerAppCommands());
  afterEach(() => clearAppDom());

  it('every data-action and data-command of the app shell resolves to a command', () => {
    loadAppDom();
    ensureDrawioMenuItems(document.getElementById('context-menu'));
    const ids = new Set<string>();
    document.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => ids.add(el.dataset.action!));
    document.querySelectorAll<HTMLElement>('[data-command]').forEach((el) => ids.add(el.dataset.command!));
    expect(ids.size).toBeGreaterThan(100);
    const missing = [...ids].filter((id) => !commandRegistry.has(id));
    expect(missing).toEqual([]);
  });

  it('command ids are unique and shortcuts are not shared', () => {
    expect(new Set(APP_COMMANDS.map((c) => c.id)).size).toBe(APP_COMMANDS.length);
    const specs: Array<[string, ShortcutSpec]> = [];
    for (const c of APP_COMMANDS) {
      if (c.shortcut) specs.push([c.id, c.shortcut]);
      for (const [id, spec] of Object.entries(c.memberShortcuts ?? {})) specs.push([id, spec]);
    }
    const seen = new Map<string, string>();
    for (const [id, spec] of specs) {
      const key = keyOf(spec);
      expect(seen.get(key), `${id} and ${seen.get(key)} share ${formatShortcut(spec, false)}`).toBeUndefined();
      seen.set(key, id);
    }
    expect(specs.length).toBeGreaterThan(30);
  });

  it('every command with a shown shortcut has a key binding and appears in Help with that key', () => {
    for (const mac of [false, true]) {
      const rows = helpSections(commandRegistry, mac).flatMap((s) => s.items);
      for (const c of APP_COMMANDS.filter((x) => x.shortcut)) {
        expect(c.keys?.length ?? 0, `${c.id} has no key binding`).toBeGreaterThan(0);
        expect(c.help?.length ?? 0, `${c.id} is not in Help`).toBeGreaterThan(0);
        const shown = formatShortcut(c.shortcut!, mac);
        const own = c.help!.map((h) => (h.keys ? h.keys(mac) : shown));
        expect(own.some((keys) => keys.includes(shown)), `${c.id}: ${shown} in ${own.join(', ')}`).toBe(true);
        expect(rows.some((r) => own.includes(r.keys)), c.id).toBe(true);
      }
      // the Object State items' Alt keys too
      for (const s of STATE_SHORTCUTS) {
        expect(rows.some((r) => r.keys === formatShortcut({ alt: true, key: s.key }, mac))).toBe(true);
      }
    }
  });

  it('Help keeps the sections and the menu hints keep the shortcuts of before', () => {
    const sections = helpSections(commandRegistry, false);
    expect(sections.map((s) => s.section)).toEqual([
      'File',
      'Edit',
      'View',
      'Arrange',
      'Connection arrows (hover a shape)',
      'Object states (selected railway objects)',
      'Menus',
      'Help',
    ]);
    expect(sections.find((s) => s.section === 'Edit')!.items.map((i) => i.keys)).toEqual([
      'Ctrl+Z',
      'Ctrl+Y / Ctrl+Shift+Z',
      'Ctrl+X',
      'Ctrl+C',
      'Ctrl+V',
      'Ctrl+D',
      'Delete / Backspace',
      'Ctrl+A',
      'Ctrl+Shift+I',
      'Ctrl+Shift+E',
      'Ctrl+Shift+A',
      'Esc',
      'Arrow keys',
      'Shift+Arrow keys',
    ]);
    const hints: Record<string, string> = {
      save: 'Ctrl+S',
      duplicate: 'Ctrl+D',
      group: 'Ctrl+G',
      ungroup: 'Ctrl+Shift+G',
      zoomIn: 'Ctrl++',
      zoomOut: 'Ctrl+-',
      zoomActual: 'Ctrl+0',
      fitWindow: 'Ctrl+1',
      toggleConnectionArrows: 'Alt+Shift+A',
      toggleLeftPanel: 'Ctrl+Shift+K',
      toggleRightPanel: 'Ctrl+Shift+P',
      shortcuts: 'F1',
      'railwayState:aspect:stop': 'Alt+1',
    };
    for (const [id, text] of Object.entries(hints)) expect(formatShortcut(shortcutSpecFor(id)!, false), id).toBe(text);
    expect(shortcutSpecFor('print')).toBeNull();
  });
});

describe('Keymap', () => {
  function setup() {
    const registry = new CommandRegistry();
    const keymap = new Keymap(registry);
    const graph = { isEditing: () => false, getSelectionCount: () => 1, container: document.createElement('div') };
    registry.setActiveTabProvider(() => ({ graph }) as unknown as TabData);
    const ran: string[] = [];
    const mk = (id: string, phase: 'capture' | 'bubble', guard: 'always' | 'graph' | 'text' | 'none', key: string) => ({
      id,
      label: id,
      keys: [{ phase, guard, match: (e: KeyboardEvent) => e.key === key }],
      run: () => void ran.push(id),
    });
    registry.register([
      mk('save', 'capture', 'always', 's'),
      mk('copy', 'capture', 'graph', 'c'),
      mk('first', 'bubble', 'graph', ' '),
      mk('second', 'bubble', 'graph', ' '),
      mk('zoom', 'bubble', 'text', '+'),
    ]);
    const uninstall = keymap.install();
    const press = (target: EventTarget, key: string): KeyboardEvent => {
      const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      target.dispatchEvent(e);
      return e;
    };
    return { keymap, ran, press, uninstall };
  }

  it('runs the bindings with the shell guards: Save while typing, graph keys not; every match in order', () => {
    const { ran, press, uninstall, keymap } = setup();
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    expect(press(input, 's').defaultPrevented).toBe(true);
    expect(press(input, 'c').defaultPrevented).toBe(false);
    expect(press(input, '+').defaultPrevented).toBe(false);
    input.blur();
    press(document.body, 'c');
    press(document.body, ' ');
    press(document.body, '+');
    expect(ran).toEqual(['save', 'copy', 'first', 'second', 'zoom']);
    // menus keep their keys; interceptors (scenario view) take the graph keys first
    const menu = document.createElement('div');
    menu.id = 'menu-bar';
    document.body.append(menu);
    press(menu, 'c');
    const stop = keymap.addInterceptor((e) => e.key === 'c');
    press(document.body, 'c');
    stop();
    expect(ran).toEqual(['save', 'copy', 'first', 'second', 'zoom']);
    uninstall();
    press(document.body, 'c');
    expect(ran).toHaveLength(5);
    input.remove();
    menu.remove();
  });

  it('a throwing command is reported and the other bindings of the key still run', () => {
    const registry = new CommandRegistry();
    const keymap = new Keymap(registry);
    registry.setActiveTabProvider(() => ({ graph: { isEditing: () => false } }) as unknown as TabData);
    const ran: string[] = [];
    registry.register([
      { id: 'boom', label: 'boom', keys: [{ phase: 'bubble', guard: 'none', match: () => true }], run: () => { throw new Error('boom'); } },
      { id: 'ok', label: 'ok', keys: [{ phase: 'bubble', guard: 'none', match: () => true }], run: () => void ran.push('ok') },
    ]);
    const reported = vi.fn();
    vi.stubGlobal('reportError', reported);
    const uninstall = keymap.install();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
    uninstall();
    vi.unstubAllGlobals();
    expect(reported).toHaveBeenCalledTimes(1);
    expect(ran).toEqual(['ok']);
  });

  it('a family command gets the rest of the id as its argument', () => {
    const registry = new CommandRegistry();
    const got: Array<string | undefined> = [];
    registry.register([{ id: 'fam:', label: 'fam', family: true, run: (ctx) => void got.push(ctx.arg) }]);
    expect(registry.run('fam:a:b')).toBe(true);
    expect(registry.run('fam:')).toBe(false);
    expect(registry.run('other')).toBe(false);
    expect(got).toEqual(['a:b']);
  });
});
