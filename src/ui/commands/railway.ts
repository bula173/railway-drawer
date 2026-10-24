/**
 * @file railway.ts
 * @brief The railway feature's commands (src/railway, reached over the event bus): Railway menu
 *        route tools and toggles (`railwayRoute:<command>`, also the toolbar route tool and km
 *        ruler), Object State items and their Alt shortcuts (`railwayState:<command>`), File >
 *        Export > Railway Data (`exportRailway:<format>`), Edit Data…, Run Checks; and the draw.io
 *        table / lane / fold items of the context menu (`drawio:<action>`).
 */
import { emit } from '../../core/event-bus';
import { shouldIgnoreGraphShortcut } from '../../core/keyboard-guard';
import { STATE_SHORTCUTS, stateShortcutCommand } from '../../railway/state-shortcuts';
import { DRAWIO_MENU_PREFIX, executeDrawioMenuAction } from '../../drawio-shapes/behaviour/menu';
import type { ShortcutSpec } from '../shortcut-keys';
import type { Command } from './types';

export const railwayCommands: readonly Command[] = [
  {
    id: 'railwayRoute:',
    label: 'Railway route command',
    family: true,
    // src/railway/install-railway-routes.ts (RouteCommand)
    run: (ctx) => ctx.arg && emit('railway-route-request', ctx.arg),
  },
  {
    id: 'railwayState:',
    label: 'Object state',
    family: true,
    memberShortcuts: Object.fromEntries(STATE_SHORTCUTS.map((s): [string, ShortcutSpec] => [`railwayState:${s.command}`, { alt: true, key: s.key }])),
    // Alt+F/O/R/N/V/1-4 on the selection (state-shortcuts.ts; event.code: Alt types characters on macOS),
    // after element handlers; only for the canvas (panels use their own keys)
    keys: [
      {
        phase: 'bubble',
        guard: 'none',
        match: (e) => stateShortcutCommand(e) !== null,
        when: (e, ctx) => {
          const graph = ctx.tab?.graph;
          if (!graph || e.defaultPrevented || shouldIgnoreGraphShortcut(e, graph)) return false;
          if (e.target instanceof Element && e.target.closest('#menu-bar, #context-menu, .rd-toolbar-menu, .left-panel-overflow-menu, [role="dialog"]')) return false;
          const focus = document.activeElement;
          return !(focus && focus !== document.body && !graph.container.contains(focus));
        },
        invoke: (e) => `railwayState:${stateShortcutCommand(e)}`,
      },
    ],
    help: STATE_SHORTCUTS.map((s, i) => ({
      section: 'Object states (selected railway objects)' as const,
      order: (i + 1) * 10,
      description: s.description,
      keys: (mac: boolean) => (mac ? `⌥${s.key}` : `Alt+${s.key}`),
    })),
    // src/railway/install-railway-states.ts (also the context menu's State ▸ items); a held key repeats nothing
    run: (ctx) => {
      if (ctx.source === 'keyboard' && (ctx.event as KeyboardEvent | undefined)?.repeat) return;
      emit('railway-state-request', ctx.arg);
    },
  },
  {
    id: 'exportRailway:',
    label: 'Export railway data',
    family: true,
    // File > Export Railway Data > ...: src/railway writes the list
    run: (ctx) => ctx.arg && emit('railway-export-request', ctx.arg),
  },
  {
    id: 'editData',
    label: 'Edit Data…',
    run: (ctx) => {
      // The Data panel edits the selection (src/railway); the context menu selects its cells first
      if (ctx.target && ctx.target.cells.length > 0) ctx.tab?.graph.setSelectionCells(ctx.target.cells);
      emit('railway-edit-data-request');
    },
  },
  {
    id: 'etcsData',
    label: 'ETCS Data…',
    run: (ctx) => {
      // the ETCS editor of the selected balise group (src/railway/etcs); the context menu selects its cells first
      if (ctx.target && ctx.target.cells.length > 0) ctx.tab?.graph.setSelectionCells(ctx.target.cells);
      emit('railway-etcs-request');
    },
  },
  { id: 'railwayChecks', label: 'Run Checks', run: () => emit('railway-checks-request') },
  {
    id: DRAWIO_MENU_PREFIX,
    label: 'draw.io context menu item',
    family: true,
    // table / lane rows and columns, collapse / expand (drawio-shapes/behaviour/menu.ts)
    run: (ctx) => ctx.tab && ctx.arg && void executeDrawioMenuAction(ctx.tab.graph, DRAWIO_MENU_PREFIX + ctx.arg, ctx.target?.cell ?? null),
  },
];
