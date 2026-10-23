import type { Graph } from '@maxgraph/core';
import { GraphCommandService } from '../services/graph-command-service';
import { shortcutForAction } from './shortcut-keys';

/**
 * Binds the shared Undo/Redo toolbar buttons to one tab's command history.
 * The buttons are shared by all tabs, so only the active tab's controller may set their
 * state; the TabManager toggles that with setActive() when tabs are switched.
 */
export class UndoRedoController {
  private commandService: GraphCommandService;
  private undoBtn: HTMLButtonElement | null = null;
  private redoBtn: HTMLButtonElement | null = null;
  private active = true;

  constructor(_graph: Graph, commandService: GraphCommandService) {
    this.commandService = commandService;
    this.setupToolbarButtons();
    this.commandService.addListener('stateChanged', () => this.updateButtonStates());
    this.updateButtonStates();
  }

  private setupToolbarButtons(): void {
    // their clicks run the undo / redo commands (toolbar.ts data-command); this controller keeps their state
    this.undoBtn = document.getElementById('btn-undo') as HTMLButtonElement | null;
    this.redoBtn = document.getElementById('btn-redo') as HTMLButtonElement | null;
  }

  /**
   * Marks this tab as the one shown. An active controller immediately reflects its own
   * history in the shared buttons; an inactive one stops touching them.
   */
  setActive(active: boolean): void {
    this.active = active;
    this.updateButtonStates();
  }

  private updateButtonStates(): void {
    if (!this.active) return;
    const canUndo = this.commandService.canUndo();
    const canRedo = this.commandService.canRedo();
    if (this.undoBtn) {
      this.undoBtn.disabled = !canUndo;
      this.undoBtn.title = canUndo ? `Undo (${shortcutForAction('undo')})` : 'Nothing to undo';
    }
    if (this.redoBtn) {
      this.redoBtn.disabled = !canRedo;
      this.redoBtn.title = canRedo ? `Redo (${shortcutForAction('redo')})` : 'Nothing to redo';
    }
    // Edit > Undo / Redo show the same state
    document.querySelector('.menu-dropdown-item[data-action="undo"]')?.setAttribute('aria-disabled', String(!canUndo));
    document.querySelector('.menu-dropdown-item[data-action="redo"]')?.setAttribute('aria-disabled', String(!canRedo));
  }
}
