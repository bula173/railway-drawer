import { useCallback, useState, useRef, useEffect } from 'react';
import type { DrawElement } from '../components/Elements';
import { useSelectionManager } from './useSelectionManager';
import { useDragManager } from './useDragManager';
import { useResizeManager } from './useResizeManager';
import { useHistoryManager } from './useHistoryManager';
import { logger } from '../utils/logger';

/**
 * Unified hook that combines all DrawArea manager hooks
 * Simplifies DrawArea by centralizing complex logic
 *
 * This hook is designed to work with DrawArea and provides:
 * - Selection management
 * - Drag operations
 * - Resize operations
 * - Undo/redo history
 * - Coordination between managers
 */
export const useDrawAreaIntegration = (initialElements: DrawElement[] = []) => {
  // Core drawing state
  const [elements, setElements] = useState<DrawElement[]>(initialElements);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [showGrid, setShowGrid] = useState(true);

  // Manager hooks
  const selection = useSelectionManager({
    elements,
    onSelectionChange: useCallback((ids: string[]) => {
      logger.debug('DrawAreaIntegration', 'Selection changed', { count: ids.length });
    }, []),
  });

  const drag = useDragManager({
    gridSize: 40,
    snapToGrid: true,
    onElementsDrag: useCallback((draggedElements: DrawElement[]) => {
      // Update elements when dragging
      setElements(prev =>
        prev.map(el =>
          draggedElements.find(de => de.id === el.id) || el
        )
      );
    }, []),
  });

  const resize = useResizeManager({
    minSize: 8,
    onElementResize: useCallback((element: DrawElement) => {
      setElements(prev =>
        prev.map(el => (el.id === element.id ? element : el))
      );
    }, []),
  });

  const history = useHistoryManager(elements, {
    maxSize: 50,
    onChange: useCallback((newState: DrawElement[]) => {
      setElements(newState);
    }, []),
  });

  // Coordinate between managers
  const updateElement = useCallback((element: DrawElement) => {
    setElements(prev =>
      prev.map(el => (el.id === element.id ? element : el))
    );
    history.pushToHistory(prev => [...prev, element], 'Element updated');
  }, [history]);

  const deleteElements = useCallback((ids: string[]) => {
    const newElements = elements.filter(el => !ids.includes(el.id));
    setElements(newElements);
    history.pushToHistory(newElements, 'Elements deleted');
    selection.clearSelection();
  }, [elements, history, selection]);

  const addElement = useCallback((element: DrawElement) => {
    const newElements = [...elements, element];
    setElements(newElements);
    history.pushToHistory(newElements, 'Element added');
  }, [elements, history]);

  const copySelectedElements = useCallback(() => {
    const toCopy = selection.getSelectedElements();
    logger.info('DrawAreaIntegration', 'Copied elements', { count: toCopy.length });
    return toCopy;
  }, [selection]);

  const deleteSelectedElements = useCallback(() => {
    deleteElements(selection.selectedElementIds);
  }, [deleteElements, selection.selectedElementIds]);

  const selectAllElements = useCallback(() => {
    selection.selectElements(elements.map(el => el.id));
  }, [elements, selection]);

  const startDragSelection = useCallback((x: number, y: number) => {
    selection.startAreaSelection(x, y);
  }, [selection]);

  const updateDragSelection = useCallback((x: number, y: number) => {
    selection.updateAreaSelection(x, y);
  }, [selection]);

  const endDragSelection = useCallback(() => {
    selection.endAreaSelection();
  }, [selection]);

  return {
    // Core state
    elements,
    setElements,
    backgroundColor,
    setBackgroundColor,
    showGrid,
    setShowGrid,

    // Selection manager
    ...selection,
    selectAllElements,
    deleteSelectedElements,
    copySelectedElements,

    // Drag manager
    ...drag,
    startDragSelection,
    updateDragSelection,
    endDragSelection,

    // Resize manager
    ...resize,

    // History manager
    ...history,

    // Element operations
    updateElement,
    deleteElements,
    addElement,

    // Integration helpers
    getElementsForRendering: () => elements,
    getSelectedElementsData: () => selection.getSelectedElements(),
  };
};
