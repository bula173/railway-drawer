import { useState, useCallback, useRef } from 'react';
import type { DrawElement } from '../components/Elements';
import { pruneHistory } from '../utils/performanceUtils';
import { logger } from '../utils/logger';

interface HistoryEntry {
  state: DrawElement[];
  timestamp: number;
  label?: string;
}

interface HistoryOptions {
  maxSize?: number;
  onChange?: (state: DrawElement[]) => void;
}

/**
 * Custom hook to manage undo/redo history
 * Handles: snapshot capture, history navigation, pruning
 * Extracted from DrawArea to reduce component complexity
 */
export const useHistoryManager = (
  initialState: DrawElement[] = [],
  options: HistoryOptions = {}
) => {
  const { maxSize = 50, onChange } = options;

  // History state
  const [history, setHistory] = useState<HistoryEntry[]>([
    {
      state: initialState,
      timestamp: Date.now(),
      label: 'Initial',
    },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Debounce ref for capturing snapshots
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const getCurrentState = useCallback((): DrawElement[] => {
    return history[historyIndex]?.state || initialState;
  }, [history, historyIndex, initialState]);

  const pushToHistory = useCallback(
    (newState: DrawElement[], label?: string) => {
      // Remove any future history after current index (when user performs action after undo)
      const trimmedHistory = history.slice(0, historyIndex + 1);

      const entry: HistoryEntry = {
        state: [...newState], // Clone to avoid mutations
        timestamp: Date.now(),
        label,
      };

      const newHistory = [...trimmedHistory, entry];
      const prunedHistory = pruneHistory(newHistory, maxSize);

      setHistory(prunedHistory);
      setHistoryIndex(prunedHistory.length - 1);

      onChange?.(newState);

      logger.debug('HistoryManager', 'Pushed to history', {
        currentIndex: prunedHistory.length - 1,
        totalEntries: prunedHistory.length,
        label,
        elementCount: newState.length,
      });
    },
    [history, historyIndex, maxSize, onChange]
  );

  const undo = useCallback(() => {
    if (historyIndex <= 0) {
      logger.debug('HistoryManager', 'Cannot undo - at beginning');
      return false;
    }

    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    onChange?.(history[newIndex].state);

    logger.info('HistoryManager', '↶ Undo', {
      from: historyIndex,
      to: newIndex,
      label: history[newIndex].label,
    });

    return true;
  }, [historyIndex, history, onChange]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) {
      logger.debug('HistoryManager', 'Cannot redo - at end');
      return false;
    }

    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    onChange?.(history[newIndex].state);

    logger.info('HistoryManager', '↷ Redo', {
      from: historyIndex,
      to: newIndex,
      label: history[newIndex].label,
    });

    return true;
  }, [historyIndex, history, onChange]);

  const canUndo = useCallback(() => historyIndex > 0, [historyIndex]);

  const canRedo = useCallback(() => historyIndex < history.length - 1, [historyIndex, history]);

  const clear = useCallback(() => {
    setHistory([
      {
        state: initialState,
        timestamp: Date.now(),
        label: 'Initial',
      },
    ]);
    setHistoryIndex(0);

    logger.debug('HistoryManager', 'History cleared');
  }, [initialState]);

  const debounceCapture = useCallback(
    (newState: DrawElement[], delayMs: number = 500, label?: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        pushToHistory(newState, label);
        debounceTimerRef.current = null;
      }, delayMs);
    },
    [pushToHistory]
  );

  const getHistoryStats = useCallback(() => {
    return {
      currentIndex: historyIndex,
      totalEntries: history.length,
      canUndo: canUndo(),
      canRedo: canRedo(),
      maxSize,
      lastLabel: history[historyIndex]?.label,
    };
  }, [historyIndex, history, canUndo, canRedo, maxSize]);

  return {
    // State
    currentState: getCurrentState(),
    history,
    historyIndex,

    // Methods
    pushToHistory,
    undo,
    redo,
    clear,
    debounceCapture,

    // Query
    canUndo,
    canRedo,
    getHistoryStats,
    getCurrentState,

    // Config
    maxSize,
  };
};
