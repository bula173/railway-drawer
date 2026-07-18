/**
 * Command History Manager
 * Implements undo/redo functionality for diagram editing
 */

export interface Command {
  execute(): void;
  undo(): void;
  redo(): void;
  description?: string;
}

export class CommandHistory {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private listeners: Array<(changed: boolean) => void> = [];
  private batchMode = false;
  private batchCommands: Command[] = [];

  execute(command: Command): void {
    if (this.batchMode) {
      this.batchCommands.push(command);
      return;
    }

    command.execute();
    this.undoStack.push(command);
    this.redoStack = [];
    this.notifyListeners();
  }

  undo(): void {
    if (this.undoStack.length === 0) return;

    const command = this.undoStack.pop()!;
    command.undo();
    this.redoStack.push(command);
    this.notifyListeners();
  }

  redo(): void {
    if (this.redoStack.length === 0) return;

    const command = this.redoStack.pop()!;
    command.redo();
    this.undoStack.push(command);
    this.notifyListeners();
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  startBatch(): void {
    this.batchMode = true;
    this.batchCommands = [];
  }

  endBatch(description?: string): void {
    if (!this.batchMode) return;
    this.batchMode = false;

    if (this.batchCommands.length > 0) {
      const batchCommand: Command = {
        execute: () => {
          this.batchCommands.forEach((cmd) => cmd.execute());
        },
        undo: () => {
          for (let i = this.batchCommands.length - 1; i >= 0; i--) {
            this.batchCommands[i].undo();
          }
        },
        redo: () => {
          this.batchCommands.forEach((cmd) => cmd.redo());
        },
        description: description || `Batch operation (${this.batchCommands.length} changes)`,
      };

      this.undoStack.push(batchCommand);
      this.redoStack = [];
      this.notifyListeners();
    }

    this.batchCommands = [];
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notifyListeners();
  }

  addListener(callback: (changed: boolean) => void): void {
    this.listeners.push(callback);
  }

  removeListener(callback: (changed: boolean) => void): void {
    this.listeners = this.listeners.filter((l) => l !== callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.canUndo() || this.canRedo()));
  }
}

// Command implementations for common operations

export class SetCellValueCommand implements Command {
  private oldValue: any;
  private newValue: any;

  constructor(
    private cell: any,
    private graph: any,
    newValue: any,
  ) {
    this.oldValue = cell.value;
    this.newValue = newValue;
  }

  execute(): void {
    this.graph.model.setValue(this.cell, this.newValue);
  }

  undo(): void {
    this.graph.model.setValue(this.cell, this.oldValue);
  }

  redo(): void {
    this.execute();
  }

  description = 'Edit cell text';
}

export class SetGeometryCommand implements Command {
  private oldGeometry: any;
  private newGeometry: any;

  constructor(
    private cell: any,
    private graph: any,
    newGeometry: any,
  ) {
    this.oldGeometry = { ...cell.geometry };
    this.newGeometry = { ...newGeometry };
  }

  execute(): void {
    this.graph.model.setGeometry(this.cell, this.newGeometry);
  }

  undo(): void {
    this.graph.model.setGeometry(this.cell, this.oldGeometry);
  }

  redo(): void {
    this.execute();
  }

  description = 'Change cell geometry';
}

export class RemoveCellsCommand implements Command {
  private removedCells: any[];
  private removedEdges: any[];

  constructor(
    cells: any[],
    private graph: any,
  ) {
    this.removedCells = [...cells];
    this.removedEdges = [];

    cells.forEach((cell) => {
      this.graph.model.getEdges(cell).forEach((edge: any) => {
        this.removedEdges.push({
          edge,
          source: edge.source,
          target: edge.target,
        });
      });
    });
  }

  execute(): void {
    this.graph.removeCells(this.removedCells);
  }

  undo(): void {
    this.graph.addCells(this.removedCells);
    this.removedEdges.forEach(({ edge, source, target }) => {
      this.graph.model.setTerminal(edge, source, true);
      this.graph.model.setTerminal(edge, target, false);
    });
  }

  redo(): void {
    this.execute();
  }

  description = 'Delete cells';
}

export class InsertCellCommand implements Command {
  constructor(
    private cell: any,
    private graph: any,
    private parent: any,
  ) {}

  execute(): void {
    this.graph.addCell(this.cell, this.parent);
  }

  undo(): void {
    this.graph.removeCells([this.cell]);
  }

  redo(): void {
    this.execute();
  }

  description = 'Insert cell';
}
