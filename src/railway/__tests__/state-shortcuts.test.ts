/**
 * Object state shortcuts (Alt + key by event.code): no clash with the app's bindings, dispatch on
 * the active tab's selection (one undo step), ignored while typing / outside the canvas, shown in
 * the menu hints and Help.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cell } from '@maxgraph/core';
import { TabManager } from '../../ui/tabs';
import type { TabData } from '../../ui/tabs';
import { loadAppDom, clearAppDom } from '../../__tests__/ui/app-dom';
import { ACTION_SHORTCUTS, formatShortcut } from '../../ui/shortcut-keys';
import { shortcutSections } from '../../ui/shortcuts-help';
import { buildDataValue, readAttr } from '../object-data';
import { installRailwayStates } from '../install-railway-states';
import type { RailwayStatesHandle } from '../install-railway-states';
import { STATE_SHORTCUTS, stateShortcutCommand } from '../state-shortcuts';
import { STATE_SCHEME } from '../states';

const notify = { success: vi.fn(), warning: vi.fn(), error: vi.fn() };

describe('state shortcut table', () => {
  it('Alt + key by event.code, no Ctrl/Cmd/Shift; commands exist in the scheme', () => {
    expect(stateShortcutCommand({ altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, code: 'KeyO' })).toBe('state:occupied');
    // macOS: Alt+O types "ø" (event.key), the code still matches
    expect(stateShortcutCommand({ altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, code: 'Digit2' })).toBe('aspect:proceed');
    expect(stateShortcutCommand({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, code: 'KeyO' })).toBeNull();
    expect(stateShortcutCommand({ altKey: true, ctrlKey: false, metaKey: false, shiftKey: true, code: 'KeyA' })).toBeNull();
    expect(stateShortcutCommand({ altKey: true, ctrlKey: true, metaKey: false, shiftKey: false, code: 'KeyO' })).toBeNull();
    for (const s of STATE_SHORTCUTS) {
      const [dim, value] = s.command.split(':') as ['state' | 'aspect' | 'position', string];
      const scheme = dim === 'aspect' ? STATE_SCHEME.signal : dim === 'position' ? STATE_SCHEME.points : STATE_SCHEME.section;
      expect(scheme[dim]!.options.some((o) => o.value === value), s.command).toBe(true);
    }
    expect(new Set(STATE_SHORTCUTS.map((s) => s.code)).size).toBe(STATE_SHORTCUTS.length);
  });

  it('no clash with the other bindings; menu hints and Help list them', () => {
    const key = (s: { mod?: boolean; shift?: boolean; alt?: boolean; key: string }): string => `${!!s.mod}|${!!s.shift}|${!!s.alt}|${s.key.toUpperCase()}`;
    const others = Object.entries(ACTION_SHORTCUTS).filter(([a]) => !a.startsWith('railwayState:'));
    const used = new Set(others.map(([, s]) => key(s)));
    for (const s of STATE_SHORTCUTS) expect(used.has(key({ alt: true, key: s.key })), s.key).toBe(false);
    expect(formatShortcut(ACTION_SHORTCUTS['railwayState:state:occupied'], false)).toBe('Alt+O');
    expect(formatShortcut(ACTION_SHORTCUTS['railwayState:position:reverse'], true)).toBe('⌥V');
    const help = shortcutSections(false).find((s) => s.section.startsWith('Object states'))!;
    expect(help.items.map((i) => i.keys)).toEqual(['Alt+F', 'Alt+O', 'Alt+R', 'Alt+N', 'Alt+V', 'Alt+1', 'Alt+2', 'Alt+3', 'Alt+4']);
  });
});

describe('state shortcuts dispatch', () => {
  let tabManager: TabManager | null = null;
  let states: RailwayStatesHandle | null = null;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    vi.stubGlobal('ResizeObserver', class { observe(): void {} unobserve(): void {} disconnect(): void {} });
    loadAppDom();
    for (const fn of Object.values(notify)) fn.mockClear();
  });

  afterEach(() => {
    states?.destroy();
    tabManager?.destroy();
    states = null;
    tabManager = null;
    clearAppDom();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function start(): TabData {
    tabManager = new TabManager('tabs-container', 'graph-container');
    const tab = tabManager.createTab('States');
    states = installRailwayStates(tabManager, notify);
    return tab;
  }

  function section(tab: TabData): Cell {
    let cell!: Cell;
    tab.graph.batchUpdate(() => {
      cell = tab.graph.insertEdge(tab.graph.getDefaultParent(), null, buildDataValue('', { kind: 'trackSection', values: { id: 'TC1' } }), null, null, { endArrow: 'none', strokeWidth: 4 });
      cell.getGeometry()!.setTerminalPoint({ x: 0, y: 100 } as never, true);
      cell.getGeometry()!.setTerminalPoint({ x: 200, y: 100 } as never, false);
    });
    return cell;
  }

  const press = (code: string, init: KeyboardEventInit = {}, target: EventTarget = document.body): KeyboardEvent => {
    const e = new KeyboardEvent('keydown', { code, key: 'ø', altKey: true, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(e);
    return e;
  };

  it('Alt+O / Alt+F set the state of the selection (one undo step each); typing in a field is left alone', () => {
    const tab = start();
    const tc = section(tab);
    tab.graphCommandService.clearHistory();
    tab.graph.setSelectionCell(tc);
    const e = press('KeyO');
    expect(e.defaultPrevented).toBe(true);
    expect(readAttr(tc, 'rdState')).toBe('occupied');
    tab.graphCommandService.undo();
    expect(readAttr(tc, 'rdState')).toBe('');
    tab.graphCommandService.redo();
    press('KeyF');
    expect(readAttr(tc, 'rdState')).toBe('free');

    // in a text field: not a state shortcut (the character is typed)
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    const typed = press('KeyO', {}, input);
    expect(typed.defaultPrevented).toBe(false);
    expect(readAttr(tc, 'rdState')).toBe('free');
    input.remove();

    // Alt+Shift+O is not one of them
    press('KeyO', { shiftKey: true });
    expect(readAttr(tc, 'rdState')).toBe('free');
  });

  it('nothing selected: a hint instead of a change', () => {
    start();
    press('KeyO');
    expect(notify.warning).toHaveBeenCalledWith(expect.stringContaining('Select a track section'));
  });
});
