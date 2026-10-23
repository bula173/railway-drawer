/**
 * @file menu-state.ts
 * @brief Menu and toolbar state of the active session (one view, TabManager's session views):
 *        Undo / Redo buttons and Edit > Undo / Redo follow the shown tab's history, View > Grid /
 *        the grid button / Properties > Canvas show its grid. A background tab's history never
 *        touches them (session.ts). Opening a menu also syncs its items from the commands'
 *        isEnabled / isChecked (syncMenuItemsFromCommands).
 */
import { ActiveSessionBinding, type DiagramSession } from './session';
import { syncGridUi } from './grid-toggle';
import { shortcutForAction } from './shortcut-keys';
import { commandRegistry } from './commands/registry';

export class MenuStateView {
  private readonly binding: ActiveSessionBinding<DiagramSession>;

  constructor() {
    this.binding = new ActiveSessionBinding<DiagramSession>((session, disposers) => {
      const update = (): void => syncUndoRedo(session);
      session.graphCommandService.addListener('stateChanged', update);
      disposers.add(() => session.graphCommandService.removeListener('stateChanged', update));
      update();
      // View > Grid, toolbar and Properties > Canvas show this tab's grid (per tab, from its file)
      syncGridUi(session.graph);
    });
  }

  /** Unbinds the view (TabManager's views are destroyed). */
  destroy(): void {
    this.binding.dispose();
  }
}

/** The Undo/Redo toolbar buttons and Edit > Undo / Redo show `session`'s history. */
function syncUndoRedo(session: DiagramSession): void {
  const canUndo = session.graphCommandService.canUndo();
  const canRedo = session.graphCommandService.canRedo();
  const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement | null;
  const redoBtn = document.getElementById('btn-redo') as HTMLButtonElement | null;
  if (undoBtn) {
    undoBtn.disabled = !canUndo;
    undoBtn.title = canUndo ? `Undo (${shortcutForAction('undo')})` : 'Nothing to undo';
  }
  if (redoBtn) {
    redoBtn.disabled = !canRedo;
    redoBtn.title = canRedo ? `Redo (${shortcutForAction('redo')})` : 'Nothing to redo';
  }
  document.querySelector('.menu-dropdown-item[data-action="undo"]')?.setAttribute('aria-disabled', String(!canUndo));
  document.querySelector('.menu-dropdown-item[data-action="redo"]')?.setAttribute('aria-disabled', String(!canRedo));
}

/**
 * The items of an opened menu from their commands: aria-checked of the check items
 * (role=menuitemcheckbox) from isChecked, aria-disabled from isEnabled, on the active tab.
 */
export function syncMenuItemsFromCommands(menu: ParentNode): void {
  const ctx = commandRegistry.context('menu');
  menu.querySelectorAll<HTMLElement>('.menu-dropdown-item[data-action]').forEach((item) => {
    const action = item.dataset.action!;
    if (item.getAttribute('role') === 'menuitemcheckbox') {
      const checked = commandRegistry.isChecked(action, ctx);
      if (checked !== null) item.setAttribute('aria-checked', String(checked));
    }
    const enabled = commandRegistry.isEnabled(action, ctx);
    if (enabled !== null) item.setAttribute('aria-disabled', String(!enabled));
  });
}
