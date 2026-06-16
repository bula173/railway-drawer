import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHistoryManager } from '../useHistoryManager';
import type { DrawElement } from '../../components/Elements';

describe('useHistoryManager', () => {
  const mockElements: DrawElement[] = [
    {
      id: 'el-1',
      type: 'rectangle',
      start: { x: 0, y: 0 },
      end: { x: 100, y: 100 },
    },
  ];

  const mockElements2: DrawElement[] = [
    {
      id: 'el-1',
      type: 'rectangle',
      start: { x: 10, y: 10 },
      end: { x: 110, y: 110 },
    },
  ];

  describe('Basic History', () => {
    it('should initialize with initial state', () => {
      const { result } = renderHook(() =>
        useHistoryManager(mockElements)
      );

      expect(result.current.currentState).toEqual(mockElements);
      expect(result.current.historyIndex).toBe(0);
    });

    it('should push to history', () => {
      const { result } = renderHook(() =>
        useHistoryManager(mockElements)
      );

      act(() => {
        result.current.pushToHistory(mockElements2, 'moved element');
      });

      expect(result.current.historyIndex).toBe(1);
      expect(result.current.history).toHaveLength(2);
    });

    it('should get current state', () => {
      const { result } = renderHook(() =>
        useHistoryManager(mockElements)
      );

      act(() => {
        result.current.pushToHistory(mockElements2);
      });

      expect(result.current.getCurrentState()).toEqual(mockElements2);
    });
  });

  describe('Undo/Redo', () => {
    it('should undo to previous state', () => {
      const { result } = renderHook(() =>
        useHistoryManager(mockElements)
      );

      act(() => {
        result.current.pushToHistory(mockElements2);
      });
      expect(result.current.currentState).toEqual(mockElements2);

      act(() => {
        result.current.undo();
      });
      expect(result.current.currentState).toEqual(mockElements);
    });

    it('should redo to next state', () => {
      const { result } = renderHook(() =>
        useHistoryManager(mockElements)
      );

      act(() => {
        result.current.pushToHistory(mockElements2);
      });

      act(() => {
        result.current.undo();
      });
      expect(result.current.currentState).toEqual(mockElements);

      act(() => {
        result.current.redo();
      });
      expect(result.current.currentState).toEqual(mockElements2);
    });

    it('should not undo at beginning', () => {
      const { result } = renderHook(() =>
        useHistoryManager(mockElements)
      );

      let canUndo: boolean;
      act(() => {
        canUndo = result.current.undo();
      });

      expect(canUndo!).toBe(false);
    });

    it('should not redo at end', () => {
      const { result } = renderHook(() =>
        useHistoryManager(mockElements)
      );

      let canRedo: boolean;
      act(() => {
        canRedo = result.current.redo();
      });

      expect(canRedo!).toBe(false);
    });
  });

  describe('Query Methods', () => {
    it('should report canUndo correctly', () => {
      const { result } = renderHook(() =>
        useHistoryManager(mockElements)
      );

      expect(result.current.canUndo()).toBe(false);

      act(() => {
        result.current.pushToHistory(mockElements2);
      });

      expect(result.current.canUndo()).toBe(true);
    });

    it('should report canRedo correctly', () => {
      const { result } = renderHook(() =>
        useHistoryManager(mockElements)
      );

      expect(result.current.canRedo()).toBe(false);

      act(() => {
        result.current.pushToHistory(mockElements2);
      });

      expect(result.current.canRedo()).toBe(false);

      act(() => {
        result.current.undo();
      });

      expect(result.current.canRedo()).toBe(true);
    });
  });

  describe('History Management', () => {
    it('should prune history to max size', () => {
      const { result } = renderHook(() =>
        useHistoryManager(mockElements, { maxSize: 3 })
      );

      act(() => {
        for (let i = 0; i < 5; i++) {
          result.current.pushToHistory(mockElements2);
        }
      });

      // Should not exceed max size
      expect(result.current.history.length).toBeLessThanOrEqual(3);
    });

    it('should clear history', () => {
      const { result } = renderHook(() =>
        useHistoryManager(mockElements)
      );

      act(() => {
        result.current.pushToHistory(mockElements2);
        result.current.clear();
      });

      expect(result.current.history).toHaveLength(1);
      expect(result.current.historyIndex).toBe(0);
    });

    it('should maintain state after undo/redo cycle', () => {
      const { result } = renderHook(() =>
        useHistoryManager(mockElements)
      );

      act(() => {
        result.current.pushToHistory(mockElements2, 'state 2');
      });

      const stateAfterPush = result.current.currentState;

      act(() => {
        result.current.undo();
      });

      act(() => {
        result.current.redo();
      });

      const stateAfterRedoState = result.current.currentState;
      expect(stateAfterRedoState).toEqual(stateAfterPush);
    });
  });

  describe('History Stats', () => {
    it('should provide history stats', () => {
      const { result } = renderHook(() =>
        useHistoryManager(mockElements)
      );

      act(() => {
        result.current.pushToHistory(mockElements2, 'label');
      });

      const stats = result.current.getHistoryStats();

      expect(stats.currentIndex).toBe(1);
      expect(stats.totalEntries).toBe(2);
      expect(stats.canUndo).toBe(true);
      expect(stats.canRedo).toBe(false);
      expect(stats.lastLabel).toBe('label');
    });
  });
});
