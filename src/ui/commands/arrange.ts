/**
 * @file arrange.ts
 * @brief Arrange menu, Align dropdown and context-menu commands: z-order (one undoable edit each),
 *        align / distribute (AlignmentController), Group / Ungroup (Ctrl/Cmd+G, Ctrl/Cmd+Shift+G),
 *        Rotate 90°, Flip, Lock/Unlock, and the transform keys (Ctrl/Cmd+H / J / R, Shift+R).
 */
import { flipSelection, rotateSelection90, toggleSelectionLocked } from '../arrange-commands';
import { groupSelection, ungroupSelection } from '../grouping';
import { logger } from '../../drawio/logger';
import type { TabData } from '../tabs';
import { isMod } from './keymap';
import type { Command, CommandContext } from './types';

const onTab =
  (fn: (tab: TabData, ctx: CommandContext) => void) =>
  (ctx: CommandContext): void => {
    if (ctx.tab) fn(ctx.tab, ctx);
  };

/** Ctrl/Cmd + exactly `key` (e.key: Shift makes it upper case), not while typing. */
const modKey = (key: string) => [{ phase: 'bubble' as const, guard: 'graph' as const, match: (e: KeyboardEvent) => isMod(e) && e.key === key }];

export const arrangeCommands: readonly Command[] = [
  // Same commands as the canvas context menu (GraphCommandService): one undoable edit each
  { id: 'toFront', label: 'To Front', run: onTab((tab) => tab.graphCommandService.toFront()) },
  { id: 'toBack', label: 'To Back', run: onTab((tab) => tab.graphCommandService.toBack()) },
  { id: 'bringForward', label: 'Bring Forward', run: onTab((tab) => tab.graphCommandService.bringForward()) },
  { id: 'sendBackward', label: 'Send Backward', run: onTab((tab) => tab.graphCommandService.sendBackward()) },
  // Align / distribute: Arrange menu and the toolbar Align dropdown (cloned geometries, one undo step)
  { id: 'alignLeft', label: 'Align left', run: onTab((tab) => tab.alignmentController.alignLeft()) },
  { id: 'alignCenter', label: 'Align center', run: onTab((tab) => tab.alignmentController.alignCenter()) },
  { id: 'alignRight', label: 'Align right', run: onTab((tab) => tab.alignmentController.alignRight()) },
  { id: 'alignTop', label: 'Align top', run: onTab((tab) => tab.alignmentController.alignTop()) },
  { id: 'alignMiddle', label: 'Align middle', run: onTab((tab) => tab.alignmentController.alignMiddle()) },
  { id: 'alignBottom', label: 'Align bottom', run: onTab((tab) => tab.alignmentController.alignBottom()) },
  { id: 'distributeHorizontally', label: 'Distribute horizontally', run: onTab((tab) => tab.alignmentController.distributeHorizontally()) },
  { id: 'distributeVertically', label: 'Distribute vertically', run: onTab((tab) => tab.alignmentController.distributeVertically()) },
  {
    id: 'group',
    label: 'Group',
    shortcut: { mod: true, key: 'G' },
    keys: modKey('g'),
    help: [{ section: 'Arrange', order: 10, description: 'Group' }],
    run: onTab((tab, ctx) => {
      if (ctx.target) {
        logger.debug('ContextMenu', 'Group action - selectedCells:', [ctx.target.cells.length, 'graphSelection:', tab.graph.getSelectionCells().length]);
        // the graph selection = the cells the context menu acts on
        tab.graph.setSelectionCells(ctx.target.cells);
      }
      // draw.io: 2+ vertices into a group, one undoable edit (locked cells skipped)
      groupSelection(tab.graph);
    }),
  },
  {
    id: 'ungroup',
    label: 'Ungroup',
    shortcut: { mod: true, shift: true, key: 'G' },
    keys: [{ phase: 'bubble', guard: 'graph', match: (e) => isMod(e) && e.shiftKey && e.key === 'G' }],
    help: [{ section: 'Arrange', order: 20, description: 'Ungroup' }],
    run: onTab((tab) => void ungroupSelection(tab.graph)),
  },
  { id: 'rotate90', label: 'Rotate 90°', run: onTab((tab) => rotateSelection90(tab.graph)) },
  { id: 'flipHorizontal', label: 'Flip Horizontal', run: onTab((tab) => flipSelection(tab.graph, 'flipH')) },
  { id: 'flipVertical', label: 'Flip Vertical', run: onTab((tab) => flipSelection(tab.graph, 'flipV')) },
  { id: 'toggleLock', label: 'Lock/Unlock', run: onTab((tab) => toggleSelectionLocked(tab.graph)) },
  // ---- transform keys (TransformController: geometry flips / rotation of the selection)
  {
    id: 'transform.flipHorizontal',
    label: 'Flip horizontally',
    shortcut: { mod: true, key: 'H' },
    keys: modKey('h'),
    help: [{ section: 'Arrange', order: 30, description: 'Flip horizontally' }],
    run: onTab((tab) => tab.transformController.flipHorizontal()),
  },
  {
    id: 'transform.flipVertical',
    label: 'Flip vertically',
    shortcut: { mod: true, key: 'J' },
    keys: modKey('j'),
    help: [{ section: 'Arrange', order: 40, description: 'Flip vertically' }],
    run: onTab((tab) => tab.transformController.flipVertical()),
  },
  {
    id: 'transform.rotateCW',
    label: 'Rotate 90° clockwise',
    shortcut: { mod: true, key: 'R' },
    keys: modKey('r'),
    help: [{ section: 'Arrange', order: 50, description: 'Rotate 90° clockwise' }],
    run: onTab((tab) => tab.transformController.rotate90CW()),
  },
  {
    id: 'transform.rotateCCW',
    label: 'Rotate 90° counter-clockwise',
    shortcut: { mod: true, shift: true, key: 'R' },
    keys: [{ phase: 'bubble', guard: 'graph', match: (e) => isMod(e) && e.shiftKey && e.key === 'R' }],
    help: [{ section: 'Arrange', order: 60, description: 'Rotate 90° counter-clockwise' }],
    run: onTab((tab) => tab.transformController.rotate90CCW()),
  },
];
