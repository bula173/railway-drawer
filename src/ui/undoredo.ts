import { GraphCommandService } from '../services/graph-command-service';

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

  constructor(_graph: any, commandService: GraphCommandService) {
    this.commandService = commandService;
    this.setupToolbarButtons();
    this.commandService.addListener('stateChanged', () => this.updateButtonStates());
    this.updateButtonStates();
  }

  private setupToolbarButtons(): void {
    this.undoBtn = document.getElementById('btn-undo') as HTMLButtonElement | null;
    this.redoBtn = document.getElementById('btn-redo') as HTMLButtonElement | null;

    if (this.undoBtn) {
      this.undoBtn.addEventListener('click', () => this.commandService.undo());
    }

    if (this.redoBtn) {
      this.redoBtn.addEventListener('click', () => this.commandService.redo());
    }
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
    if (this.undoBtn) {
      this.undoBtn.disabled = !this.commandService.canUndo();
    }
    if (this.redoBtn) {
      this.redoBtn.disabled = !this.commandService.canRedo();
    }
  }
}
