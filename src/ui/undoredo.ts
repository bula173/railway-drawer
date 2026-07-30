import { GraphCommandService } from '../services/graph-command-service';

export class UndoRedoController {
  private commandService: GraphCommandService;
  private undoBtn: HTMLButtonElement | null = null;
  private redoBtn: HTMLButtonElement | null = null;

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
      this.undoBtn.disabled = true;
    }

    if (this.redoBtn) {
      this.redoBtn.addEventListener('click', () => this.commandService.redo());
      this.redoBtn.disabled = true;
    }
  }

  private updateButtonStates(): void {
    if (this.undoBtn) {
      this.undoBtn.disabled = !this.commandService.canUndo();
    }
    if (this.redoBtn) {
      this.redoBtn.disabled = !this.commandService.canRedo();
    }
  }
}
