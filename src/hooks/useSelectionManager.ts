import { useState, useCallback, useRef } from 'react';
import type { DrawElement } from '../components/Elements';
import { logger } from '../utils/logger';

interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UseSelectionManagerOptions {
  elements: DrawElement[];
  onSelectionChange?: (selectedIds: string[]) => void;
  selectionThreshold?: number;
}

/**
 * Custom hook to manage element selection logic
 * Handles: multi-select, click selection, area selection, hover state
 * Extracted from DrawArea to reduce component complexity
 */
export const useSelectionManager = (
  options: UseSelectionManagerOptions
) => {
  const { elements, onSelectionChange, selectionThreshold = 5 } = options;

  // Selection state
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);

  // Area selection state
  const [isAreaSelecting, setIsAreaSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null);

  // Track if we started dragging (to distinguish from click)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const updateSelection = useCallback(
    (newIds: string[]) => {
      setSelectedElementIds(newIds);
      onSelectionChange?.(newIds);

      logger.debug('SelectionManager', 'Selection changed', {
        selectedCount: newIds.length,
        selectedIds: newIds,
      });
    },
    [onSelectionChange]
  );

  const selectElement = useCallback(
    (elementId: string, addToSelection: boolean = false) => {
      if (addToSelection) {
        setSelectedElementIds(prev =>
          prev.includes(elementId)
            ? prev.filter(id => id !== elementId)
            : [...prev, elementId]
        );
      } else {
        setSelectedElementIds([elementId]);
      }
    },
    []
  );

  const selectElements = useCallback(
    (elementIds: string[], clearPrevious: boolean = true) => {
      if (clearPrevious) {
        updateSelection(elementIds);
      } else {
        updateSelection([...selectedElementIds, ...elementIds]);
      }
    },
    [selectedElementIds, updateSelection]
  );

  const clearSelection = useCallback(() => {
    updateSelection([]);
  }, [updateSelection]);

  const toggleElement = useCallback(
    (elementId: string) => {
      setSelectedElementIds(prev =>
        prev.includes(elementId)
          ? prev.filter(id => id !== elementId)
          : [...prev, elementId]
      );
    },
    []
  );

  const startAreaSelection = useCallback((x: number, y: number) => {
    setIsAreaSelecting(true);
    setSelectionStart({ x, y });
    setSelectionEnd({ x, y });
    dragStartRef.current = { x, y };
    clearSelection();

    logger.debug('SelectionManager', 'Area selection started', { x, y });
  }, [clearSelection]);

  const updateAreaSelection = useCallback((x: number, y: number) => {
    // Only start selection if we've moved far enough
    if (dragStartRef.current) {
      const dx = Math.abs(x - dragStartRef.current.x);
      const dy = Math.abs(y - dragStartRef.current.y);
      if (dx < selectionThreshold && dy < selectionThreshold) {
        return;
      }
    }

    setIsAreaSelecting(true);
    setSelectionEnd({ x, y });
  }, [selectionThreshold]);

  const endAreaSelection = useCallback(() => {
    if (!isAreaSelecting || !selectionStart || !selectionEnd) {
      setIsAreaSelecting(false);
      dragStartRef.current = null;
      return;
    }

    // Calculate selection rectangle
    const minX = Math.min(selectionStart.x, selectionEnd.x);
    const maxX = Math.max(selectionStart.x, selectionEnd.x);
    const minY = Math.min(selectionStart.y, selectionEnd.y);
    const maxY = Math.max(selectionStart.y, selectionEnd.y);

    // Find elements within selection
    const selectedIds = elements
      .filter(el => {
        const elMinX = Math.min(el.start.x, el.end.x);
        const elMaxX = Math.max(el.start.x, el.end.x);
        const elMinY = Math.min(el.start.y, el.end.y);
        const elMaxY = Math.max(el.start.y, el.end.y);

        return (
          elMinX < maxX &&
          elMaxX > minX &&
          elMinY < maxY &&
          elMaxY > minY
        );
      })
      .map(el => el.id);

    updateSelection(selectedIds);
    setIsAreaSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
    dragStartRef.current = null;

    logger.debug('SelectionManager', 'Area selection ended', {
      selectedCount: selectedIds.length,
    });
  }, [isAreaSelecting, selectionStart, selectionEnd, elements, updateSelection]);

  const getSelectedElements = useCallback((): DrawElement[] => {
    return elements.filter(el => selectedElementIds.includes(el.id));
  }, [elements, selectedElementIds]);

  const getSelectionRect = useCallback((): SelectionRect | null => {
    if (!selectionStart || !selectionEnd) return null;

    const x = Math.min(selectionStart.x, selectionEnd.x);
    const y = Math.min(selectionStart.y, selectionEnd.y);
    const width = Math.abs(selectionEnd.x - selectionStart.x);
    const height = Math.abs(selectionEnd.y - selectionStart.y);

    return { x, y, width, height };
  }, [selectionStart, selectionEnd]);

  return {
    // State
    selectedElementIds,
    hoveredElementId,
    isAreaSelecting,
    selectionRect: getSelectionRect(),

    // Selection methods
    selectElement,
    selectElements,
    clearSelection,
    toggleElement,
    updateSelection,

    // Area selection methods
    startAreaSelection,
    updateAreaSelection,
    endAreaSelection,

    // Query methods
    getSelectedElements,
    isSelected: (id: string) => selectedElementIds.includes(id),
    isHovered: (id: string) => hoveredElementId === id,

    // Hover methods
    setHoveredElementId,
    clearHover: () => setHoveredElementId(null),
  };
};
