/**
 * @file edit.ts
 * @brief Edit menu commands and the editing keys: Undo / Redo, Cut / Copy / Paste, Delete,
 *        Duplicate, Select All / Vertices / Edges / None, Escape (clear the selection), arrow-key
 *        nudge, Enter / Space (label editing), and the context menu's own variants (they act on the
 *        right-clicked cells; Paste at the click position), Lock, Edit Style, Set as Default Style.
 */
import type { Cell } from '@maxgraph/core';
import { ClipboardService } from '../../services/clipboard-service';
import { selectEdges, selectNone, selectVertices } from '../arrange-commands';
import { duplicateCells } from '../duplicate-offset';
import { toggleCellsLocked } from '../cell-lock';
import { scrollSelectionIntoView } from '../canvas-scroll';
import { logger } from '../../drawio/logger';
import { isMod, keyOf } from './keymap';
import type { Command, CommandContext } from './types';

/** The cells a context-menu command acts on (the right-clicked selection), without nulls. */
export function targetCells(ctx: CommandContext): Cell[] {
  const t = ctx.target;
  if (!t) return [];
  // currentCell may be null here (canvas menu); dropped like before
  return (t.cells.length > 0 ? t.cells : [t.cell]).filter((cell): cell is Cell => !!cell);
}

/** Arrow key -> unit move (draw.io nudge). */
const ARROW_NUDGE: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export const editCommands: readonly Command[] = [
  {
    id: 'undo',
    label: 'Undo',
    shortcut: { mod: true, key: 'Z' },
    keys: [{ phase: 'capture', guard: 'graph', match: (e) => isMod(e) && keyOf(e) === 'z' && !e.shiftKey }],
    help: [{ section: 'Edit', order: 10, description: 'Undo' }],
    isEnabled: (ctx) => ctx.tab?.graphCommandService.canUndo() ?? false,
    run: (ctx) => ctx.tab?.graphCommandService.undo(),
  },
  {
    id: 'redo',
    label: 'Redo',
    shortcut: { mod: true, key: 'Y' },
    keys: [{ phase: 'capture', guard: 'graph', match: (e) => isMod(e) && (keyOf(e) === 'y' || (e.shiftKey && keyOf(e) === 'z')) }],
    help: [
      {
        section: 'Edit',
        order: 20,
        description: 'Redo',
        keys: (mac) => (mac ? '⌘Y / ⇧⌘Z' : 'Ctrl+Y / Ctrl+Shift+Z'),
      },
    ],
    isEnabled: (ctx) => ctx.tab?.graphCommandService.canRedo() ?? false,
    run: (ctx) => ctx.tab?.graphCommandService.redo(),
  },
  {
    id: 'cut',
    label: 'Cut',
    shortcut: { mod: true, key: 'X' },
    keys: [{ phase: 'capture', guard: 'graph', match: (e) => isMod(e) && keyOf(e) === 'x' }],
    help: [{ section: 'Edit', order: 30, description: 'Cut' }],
    run: (ctx) => {
      if (ctx.target && ctx.tab) ClipboardService.getInstance().cut(targetCellsWithNull(ctx), ctx.tab.graph);
      else ctx.tab?.graphCommandService.cut();
    },
  },
  {
    id: 'copy',
    label: 'Copy',
    shortcut: { mod: true, key: 'C' },
    keys: [{ phase: 'capture', guard: 'graph', match: (e) => isMod(e) && keyOf(e) === 'c' }],
    help: [{ section: 'Edit', order: 40, description: 'Copy' }],
    run: (ctx) => {
      if (ctx.target && ctx.tab) ClipboardService.getInstance().copy(targetCellsWithNull(ctx), ctx.tab.graph);
      else ctx.tab?.graphCommandService.copy();
    },
  },
  {
    id: 'paste',
    label: 'Paste',
    shortcut: { mod: true, key: 'V' },
    keys: [{ phase: 'capture', guard: 'graph', match: (e) => isMod(e) && keyOf(e) === 'v' }],
    help: [{ section: 'Edit', order: 50, description: 'Paste' }],
    run: (ctx) => {
      if (ctx.target && ctx.tab) {
        // the context menu pastes where it was opened
        const rect = document.getElementById('graph-container')?.getBoundingClientRect();
        const offsetX = rect ? ctx.target.clientX - rect.left : 20;
        const offsetY = rect ? ctx.target.clientY - rect.top : 20;
        ClipboardService.getInstance().paste(ctx.tab.graph, offsetX, offsetY);
      } else ctx.tab?.graphCommandService.paste();
    },
  },
  {
    id: 'duplicate',
    label: 'Duplicate',
    shortcut: { mod: true, key: 'D' },
    keys: [{ phase: 'bubble', guard: 'graph', match: (e) => isMod(e) && e.key === 'd' }],
    help: [{ section: 'Edit', order: 60, description: 'Duplicate' }],
    run: (ctx) => {
      const tab = ctx.tab;
      if (!tab) return;
      // Ctrl/Cmd+D: DuplicateOffsetController (offset copy); Edit > Duplicate and the context menu:
      // railway IDs renumbered (src/railway/clone.ts), one undo step
      if (ctx.source === 'keyboard') tab.duplicateOffsetController.duplicateOnce();
      else duplicateCells(tab.graph, ctx.target ? targetCells(ctx) : tab.graph.getSelectionCells());
    },
  },
  {
    id: 'delete',
    label: 'Delete',
    shortcut: { key: 'Delete' },
    keys: [
      {
        phase: 'capture',
        guard: 'graph',
        match: (e) => e.key === 'Delete' || e.key === 'Backspace',
        when: (_e, ctx) => (ctx.tab?.graph.getSelectionCount() ?? 0) > 0,
      },
    ],
    help: [{ section: 'Edit', order: 70, description: 'Delete the selection', keys: () => 'Delete / Backspace' }],
    run: (ctx) => {
      const tab = ctx.tab;
      if (!tab) return;
      // the context menu deletes the cells it acts on (draw.io deleteCells: locked ones stay)
      if (ctx.target) tab.graph.removeCells(tab.graph.getDeletableCells(targetCells(ctx)));
      else tab.graphCommandService.delete();
    },
  },
  {
    id: 'selectAll',
    label: 'Select All',
    shortcut: { mod: true, key: 'A' },
    keys: [{ phase: 'capture', guard: 'graph', match: (e) => isMod(e) && keyOf(e) === 'a' && !e.shiftKey }],
    help: [{ section: 'Edit', order: 80, description: 'Select all' }],
    // draw.io: the layer's cells and their descendants
    run: (ctx) => ctx.tab?.graphCommandService.selectAll(),
  },
  {
    id: 'selectVertices',
    label: 'Select Vertices',
    shortcut: { mod: true, shift: true, key: 'I' },
    keys: [{ phase: 'capture', guard: 'graph', match: (e) => isMod(e) && e.shiftKey && !e.altKey && keyOf(e) === 'i' }],
    help: [{ section: 'Edit', order: 90, description: 'Select vertices (shapes)' }],
    run: (ctx) => ctx.tab && selectVertices(ctx.tab.graph),
  },
  {
    id: 'selectEdges',
    label: 'Select Edges',
    shortcut: { mod: true, shift: true, key: 'E' },
    keys: [{ phase: 'capture', guard: 'graph', match: (e) => isMod(e) && e.shiftKey && !e.altKey && keyOf(e) === 'e' }],
    help: [{ section: 'Edit', order: 100, description: 'Select edges (connectors)' }],
    run: (ctx) => ctx.tab && selectEdges(ctx.tab.graph),
  },
  {
    id: 'selectNone',
    label: 'Select None',
    shortcut: { mod: true, shift: true, key: 'A' },
    keys: [{ phase: 'capture', guard: 'graph', match: (e) => isMod(e) && e.shiftKey && !e.altKey && keyOf(e) === 'a' }],
    help: [{ section: 'Edit', order: 110, description: 'Select none' }],
    run: (ctx) => ctx.tab && selectNone(ctx.tab.graph),
  },
  {
    id: 'edit.clearSelection',
    label: 'Clear Selection',
    shortcut: { key: 'Esc' },
    keys: [{ phase: 'capture', guard: 'graph', match: (e) => e.key === 'Escape' }],
    help: [{ section: 'Edit', order: 120, description: 'Clear the selection' }],
    run: (ctx) => {
      // hides the connection arrows and cancels a connection dragged from one (hover-arrows.ts)
      ctx.tab?.hoverArrowsController.escape();
      ctx.tab?.graph.clearSelection();
    },
  },
  {
    id: 'edit.nudge',
    label: 'Move the Selection',
    keys: [
      {
        phase: 'capture',
        guard: 'graph',
        match: (e) => e.key in ARROW_NUDGE && !isMod(e) && !e.altKey,
        // not while the focus is on a panel control that uses the arrows itself (lists, buttons, ...)
        when: (_e, ctx) => {
          const focus = document.activeElement;
          const graph = ctx.tab?.graph;
          const focusOnCanvas = !focus || focus === document.body || !!graph?.container.contains(focus);
          return focusOnCanvas && !!graph && graph.getSelectionCount() > 0;
        },
      },
    ],
    help: [
      { section: 'Edit', order: 130, description: 'Move the selection by 1 px', keys: () => 'Arrow keys' },
      { section: 'Edit', order: 140, description: 'Move the selection by the grid size', keys: () => 'Shift+Arrow keys' },
    ],
    // Like draw.io: 1 px, Shift: one grid step; locked cells stay; the nudged selection stays in view
    run: (ctx) => {
      const tab = ctx.tab;
      const e = ctx.event as KeyboardEvent | undefined;
      const nudge = e ? ARROW_NUDGE[e.key] : undefined;
      if (!tab || !e || !nudge) return;
      const step = e.shiftKey ? tab.graph.getGridSize() || 10 : 1;
      if (tab.graphCommandService.nudge(nudge[0] * step, nudge[1] * step)) scrollSelectionIntoView(tab.graph);
    },
  },
  {
    id: 'edit.startEditing',
    label: 'Edit Label',
    keys: [
      {
        phase: 'bubble',
        guard: 'graph',
        match: (e) => e.key === 'Enter' || e.key === ' ',
        when: (_e, ctx) => {
          const cells = ctx.tab?.graph.getSelectionCells() ?? [];
          return cells.length === 1 && !!cells[0].isVertex && cells[0].isVertex();
        },
      },
    ],
    // Enter / Space on one selected shape: the label editor (text-editor.ts)
    run: (ctx) => {
      const cell = ctx.tab?.graph.getSelectionCells()[0];
      if (cell) ctx.tab?.textEditorController.startInlineEditing(cell);
    },
  },
  {
    id: 'lock',
    label: 'Lock',
    // context menu: draw.io lockUnlock (locked=1 style key, one undoable edit)
    run: (ctx) => ctx.tab && toggleCellsLocked(ctx.tab.graph, targetCells(ctx)),
  },
  {
    id: 'editStyle',
    label: 'Edit Style',
    run: () => {
      logger.debug('ContextMenu', 'Edit Style - Selecting Text tab');
      document.querySelector<HTMLElement>('.prop-tab[data-tab="style"]')?.click();
    },
  },
  {
    id: 'setDefaultStyle',
    label: 'Set as Default Style',
    run: () => logger.debug('ContextMenu', 'Set as Default Style - Not yet implemented'),
  },
];

/** The context-menu cells as ClipboardService takes them (a null right-clicked cell is passed on, as before). */
function targetCellsWithNull(ctx: CommandContext): Cell[] {
  const t = ctx.target!;
  return (t.cells.length > 0 ? t.cells : [t.cell]) as Cell[];
}
