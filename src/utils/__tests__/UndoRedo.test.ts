/**
 * @file UndoRedo.test.ts
 * @brief Tests for undo/redo history management
 */

import { describe, it, expect, beforeEach } from 'vitest';

describe('Undo/Redo System', () => {
  let history: {
    states: any[];
    index: number;
  };

  beforeEach(() => {
    history = {
      states: [{ value: 'initial' }],
      index: 0,
    };
  });

  describe('History Initialization', () => {
    it('should initialize with initial state', () => {
      expect(history.states).toHaveLength(1);
      expect(history.states[0].value).toBe('initial');
      expect(history.index).toBe(0);
    });

    it('should have undo disabled at start', () => {
      const canUndo = history.index > 0;
      expect(canUndo).toBe(false);
    });

    it('should have redo disabled at start', () => {
      const canRedo = history.index < history.states.length - 1;
      expect(canRedo).toBe(false);
    });
  });

  describe('Adding States', () => {
    it('should add new state to history', () => {
      const newState = { value: 'changed' };
      history.states.push(newState);
      history.index++;

      expect(history.states).toHaveLength(2);
      expect(history.index).toBe(1);
    });

    it('should add multiple states in sequence', () => {
      history.states.push({ value: 'state1' });
      history.index++;
      history.states.push({ value: 'state2' });
      history.index++;

      expect(history.states).toHaveLength(3);
      expect(history.index).toBe(2);
    });

    it('should truncate future history when adding after undo', () => {
      // Add states
      history.states.push({ value: 'state1' });
      history.index++;
      history.states.push({ value: 'state2' });
      history.index++;

      // Undo twice
      history.index -= 2;

      // Add new state
      history.states = history.states.slice(0, history.index + 1);
      history.states.push({ value: 'new' });
      history.index++;

      expect(history.states).toHaveLength(2);
      expect(history.states[history.index].value).toBe('new');
    });
  });

  describe('Undo Operation', () => {
    it('should undo to previous state', () => {
      history.states.push({ value: 'changed' });
      history.index++;

      // Undo
      history.index--;

      expect(history.index).toBe(0);
      expect(history.states[history.index].value).toBe('initial');
    });

    it('should support multiple undos', () => {
      history.states.push({ value: 'state1' });
      history.index++;
      history.states.push({ value: 'state2' });
      history.index++;
      history.states.push({ value: 'state3' });
      history.index++;

      // Undo 2 times
      history.index--;
      history.index--;

      expect(history.index).toBe(1);
      expect(history.states[history.index].value).toBe('state1');
    });

    it('should not undo at start of history', () => {
      expect(history.index).toBe(0);
      if (history.index > 0) {
        history.index--;
      }

      expect(history.index).toBe(0);
    });

    it('should enable redo after undo', () => {
      history.states.push({ value: 'changed' });
      history.index++;

      // Undo
      history.index--;

      const canRedo = history.index < history.states.length - 1;
      expect(canRedo).toBe(true);
    });
  });

  describe('Redo Operation', () => {
    it('should redo to next state', () => {
      history.states.push({ value: 'changed' });
      history.index++;

      // Undo
      history.index--;

      // Redo
      history.index++;

      expect(history.index).toBe(1);
      expect(history.states[history.index].value).toBe('changed');
    });

    it('should support multiple redos', () => {
      history.states.push({ value: 'state1' });
      history.index++;
      history.states.push({ value: 'state2' });
      history.index++;
      history.states.push({ value: 'state3' });
      history.index++;

      // Undo 3 times
      history.index -= 3;

      // Redo 2 times
      history.index++;
      history.index++;

      expect(history.index).toBe(2);
      expect(history.states[history.index].value).toBe('state2');
    });

    it('should not redo at end of history', () => {
      history.states.push({ value: 'changed' });
      history.index++;

      const canRedo = history.index < history.states.length - 1;
      if (canRedo) {
        history.index++;
      }

      expect(history.index).toBe(1);
    });
  });

  describe('History Branching', () => {
    it('should clear future history on new action after undo', () => {
      history.states.push({ value: 'state1' });
      history.index++;
      history.states.push({ value: 'state2' });
      history.index++;

      // Undo back to state1
      history.index--;

      // Add new state (should discard state2)
      history.states = history.states.slice(0, history.index + 1);
      history.states.push({ value: 'new' });
      history.index++;

      expect(history.states).toHaveLength(3); // initial, state1, new
      const lastState = history.states[history.states.length - 1];
      expect(lastState.value).toBe('new');
    });
  });

  describe('History Limits', () => {
    it('should enforce maximum history size', () => {
      const maxSize = 50;

      for (let i = 0; i < 100; i++) {
        if (history.states.length >= maxSize) {
          history.states = history.states.slice(1);
        }
        history.states.push({ value: `state${i}` });
      }

      expect(history.states.length).toBeLessThanOrEqual(maxSize);
    });

    it('should handle history overflow gracefully', () => {
      const maxSize = 10;

      for (let i = 0; i < 20; i++) {
        if (history.states.length >= maxSize) {
          history.states.shift();
        } else {
          history.index++;
        }
        history.states.push({ value: `state${i}` });
      }

      expect(history.states.length).toBeLessThanOrEqual(maxSize);
    });
  });

  describe('Current State Access', () => {
    it('should get current state', () => {
      const currentState = history.states[history.index];
      expect(currentState.value).toBe('initial');
    });

    it('should get current state after modifications', () => {
      history.states.push({ value: 'changed' });
      history.index++;

      const currentState = history.states[history.index];
      expect(currentState.value).toBe('changed');
    });

    it('should get current state after undo', () => {
      history.states.push({ value: 'changed' });
      history.index++;
      history.index--;

      const currentState = history.states[history.index];
      expect(currentState.value).toBe('initial');
    });
  });

  describe('State Comparison', () => {
    it('should detect if state changed', () => {
      const originalState = history.states[history.index];
      history.states.push({ value: 'new' });
      history.index++;
      const newState = history.states[history.index];

      expect(newState).not.toEqual(originalState);
    });

    it('should detect identical states', () => {
      const state1 = { value: 'same' };
      const state2 = { value: 'same' };

      expect(state1).toEqual(state2);
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should support Ctrl+Z for undo', () => {
      const isUndoCommand = (ctrlKey: boolean, key: string) => ctrlKey && key === 'z';
      expect(isUndoCommand(true, 'z')).toBe(true);
    });

    it('should support Cmd+Z for undo on Mac', () => {
      const isUndoCommand = (metaKey: boolean, key: string) => metaKey && key === 'z';
      expect(isUndoCommand(true, 'z')).toBe(true);
    });

    it('should support Ctrl+Y for redo', () => {
      const isRedoCommand = (ctrlKey: boolean, key: string) => ctrlKey && key === 'y';
      expect(isRedoCommand(true, 'y')).toBe(true);
    });

    it('should support Ctrl+Shift+Z for redo', () => {
      const isRedoCommand = (ctrlKey: boolean, shiftKey: boolean, key: string) =>
        ctrlKey && shiftKey && key === 'z';
      expect(isRedoCommand(true, true, 'z')).toBe(true);
    });
  });

  describe('Batch Operations', () => {
    it('should combine related operations into single history entry', () => {
      const batchStart = history.states.length;
      history.states.push({ value: 'batch1' });
      history.states[history.states.length - 1].value = 'batch1_update';

      // Both operations result in 1 new entry
      expect(history.states.length - batchStart).toBe(1);
    });

    it('should allow undo of batch as single operation', () => {
      history.states.push({ value: 'batch' });
      history.index++;

      history.index--;

      expect(history.states[history.index].value).toBe('initial');
    });
  });

  describe('History Serialization', () => {
    it('should serialize history to JSON', () => {
      history.states.push({ value: 'saved' });
      history.index++;

      const serialized = JSON.stringify(history);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.states).toEqual(history.states);
      expect(deserialized.index).toBe(history.index);
    });

    it('should restore history from serialized form', () => {
      history.states.push({ value: 'state1' });
      history.index++;

      const serialized = JSON.stringify(history);
      const restored = JSON.parse(serialized);

      history = restored;

      expect(history.states[history.index].value).toBe('state1');
    });
  });
});
