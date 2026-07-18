import { CommandHistory, SetCellValueCommand } from '../command-history';

describe('CommandHistory', () => {
  let history: CommandHistory;

  beforeEach(() => {
    history = new CommandHistory();
  });

  describe('execute', () => {
    it('should execute a command and add to undo stack', () => {
      const mockCommand = {
        execute: jest.fn(),
        undo: jest.fn(),
        redo: jest.fn(),
      };

      history.execute(mockCommand);

      expect(mockCommand.execute).toHaveBeenCalled();
      expect(history.canUndo()).toBe(true);
      expect(history.canRedo()).toBe(false);
    });

    it('should clear redo stack after new command', () => {
      const cmd1 = { execute: jest.fn(), undo: jest.fn(), redo: jest.fn() };
      const cmd2 = { execute: jest.fn(), undo: jest.fn(), redo: jest.fn() };

      history.execute(cmd1);
      history.undo();
      expect(history.canRedo()).toBe(true);

      history.execute(cmd2);
      expect(history.canRedo()).toBe(false);
    });
  });

  describe('undo', () => {
    it('should undo last command', () => {
      const mockCommand = {
        execute: jest.fn(),
        undo: jest.fn(),
        redo: jest.fn(),
      };

      history.execute(mockCommand);
      history.undo();

      expect(mockCommand.undo).toHaveBeenCalled();
      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(true);
    });

    it('should do nothing if no commands to undo', () => {
      expect(() => history.undo()).not.toThrow();
      expect(history.canUndo()).toBe(false);
    });
  });

  describe('redo', () => {
    it('should redo last undone command', () => {
      const mockCommand = {
        execute: jest.fn(),
        undo: jest.fn(),
        redo: jest.fn(),
      };

      history.execute(mockCommand);
      history.undo();
      history.redo();

      expect(mockCommand.redo).toHaveBeenCalled();
      expect(history.canRedo()).toBe(false);
      expect(history.canUndo()).toBe(true);
    });

    it('should do nothing if no commands to redo', () => {
      expect(() => history.redo()).not.toThrow();
      expect(history.canRedo()).toBe(false);
    });
  });

  describe('batch operations', () => {
    it('should create a batch command from multiple commands', () => {
      const cmd1 = { execute: jest.fn(), undo: jest.fn(), redo: jest.fn() };
      const cmd2 = { execute: jest.fn(), undo: jest.fn(), redo: jest.fn() };

      history.startBatch();
      history.execute(cmd1);
      history.execute(cmd2);
      history.endBatch('batch operation');

      // After endBatch, should have one batch command on undo stack
      expect(history.canUndo()).toBe(true);

      // Undo the batch, which calls undo on all batched commands
      history.undo();
      expect(cmd1.undo).toHaveBeenCalled();
      expect(cmd2.undo).toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should clear undo and redo stacks', () => {
      const cmd = { execute: jest.fn(), undo: jest.fn(), redo: jest.fn() };

      history.execute(cmd);
      expect(history.canUndo()).toBe(true);

      history.clear();
      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(false);
    });
  });

  describe('listeners', () => {
    it('should notify listeners on command execution', () => {
      const listener = jest.fn();
      history.addListener(listener);

      const cmd = { execute: jest.fn(), undo: jest.fn(), redo: jest.fn() };
      history.execute(cmd);

      expect(listener).toHaveBeenCalledWith(true);
    });

    it('should remove listener when requested', () => {
      const listener = jest.fn();
      history.addListener(listener);
      history.removeListener(listener);

      const cmd = { execute: jest.fn(), undo: jest.fn(), redo: jest.fn() };
      history.execute(cmd);

      expect(listener).not.toHaveBeenCalled();
    });
  });
});

describe('SetCellValueCommand', () => {
  it('should update cell value', () => {
    const mockCell = { value: 'old' };
    const mockGraph = { model: { setValue: jest.fn() } };
    const cmd = new SetCellValueCommand(mockCell, mockGraph, 'new');

    cmd.execute();
    expect(mockGraph.model.setValue).toHaveBeenCalledWith(mockCell, 'new');

    cmd.undo();
    expect(mockGraph.model.setValue).toHaveBeenCalledWith(mockCell, 'old');

    cmd.redo();
    expect(mockGraph.model.setValue).toHaveBeenCalledWith(mockCell, 'new');
  });
});
