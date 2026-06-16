import { useState, useCallback, useRef } from 'react';
import type { DrawElement, Point } from '../components/Elements';
import { logger } from '../utils/logger';

interface DragState {
  isDragging: boolean;
  draggingElementId: string | null;
  offset: Point;
}

interface DragOptions {
  gridSize?: number;
  snapToGrid?: boolean;
  onElementsDrag?: (elements: DrawElement[], offset: Point) => void;
}

/**
 * Custom hook to manage element dragging logic
 * Handles: pointer events, grid snapping, offset tracking
 * Extracted from DrawArea to reduce component complexity
 */
export const useDragManager = (options: DragOptions = {}) => {
  const { gridSize = 40, snapToGrid = true, onElementsDrag } = options;

  // Drag state
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggingElementId: null,
    offset: { x: 0, y: 0 },
  });

  // Track initial positions for dragging multiple elements
  const initialPositionsRef = useRef<Map<string, { start: Point; end: Point }>>(new Map());

  const snapToGridValue = useCallback(
    (value: number): number => {
      if (!snapToGrid) return value;
      return Math.round(value / gridSize) * gridSize;
    },
    [gridSize, snapToGrid]
  );

  const startDrag = useCallback(
    (elementId: string, clientX: number, clientY: number, svgRect: DOMRect) => {
      setDragState({
        isDragging: true,
        draggingElementId: elementId,
        offset: {
          x: clientX - svgRect.left,
          y: clientY - svgRect.top,
        },
      });

      logger.debug('DragManager', 'Drag started', {
        elementId,
        x: clientX - svgRect.left,
        y: clientY - svgRect.top,
      });
    },
    []
  );

  const recordInitialPositions = useCallback(
    (elements: DrawElement[]) => {
      initialPositionsRef.current.clear();
      elements.forEach(el => {
        initialPositionsRef.current.set(el.id, {
          start: { ...el.start },
          end: { ...el.end },
        });
      });
    },
    []
  );

  const getInitialPosition = useCallback((elementId: string) => {
    return initialPositionsRef.current.get(elementId);
  }, []);

  const calculateDragOffset = useCallback(
    (
      clientX: number,
      clientY: number,
      svgRect: DOMRect,
      dragStartOffset: Point
    ): Point => {
      const currentX = clientX - svgRect.left;
      const currentY = clientY - svgRect.top;

      let offsetX = currentX - dragStartOffset.x;
      let offsetY = currentY - dragStartOffset.y;

      // Apply grid snapping
      if (snapToGrid) {
        offsetX = snapToGridValue(offsetX);
        offsetY = snapToGridValue(offsetY);
      }

      return { x: offsetX, y: offsetY };
    },
    [snapToGrid, snapToGridValue]
  );

  const updateDragPosition = useCallback(
    (clientX: number, clientY: number, svgRect: DOMRect, draggedElements: DrawElement[]) => {
      const offset = calculateDragOffset(
        clientX,
        clientY,
        svgRect,
        dragState.offset
      );

      // Calculate new positions for dragged elements
      const updatedElements = draggedElements.map(el => {
        const initialPos = getInitialPosition(el.id);
        if (!initialPos) return el;

        return {
          ...el,
          start: {
            x: initialPos.start.x + offset.x,
            y: initialPos.start.y + offset.y,
          },
          end: {
            x: initialPos.end.x + offset.x,
            y: initialPos.end.y + offset.y,
          },
        };
      });

      onElementsDrag?.(updatedElements, offset);
    },
    [dragState.offset, calculateDragOffset, getInitialPosition, onElementsDrag]
  );

  const endDrag = useCallback(() => {
    setDragState({
      isDragging: false,
      draggingElementId: null,
      offset: { x: 0, y: 0 },
    });
    initialPositionsRef.current.clear();

    logger.debug('DragManager', 'Drag ended');
  }, []);

  return {
    // State
    isDragging: dragState.isDragging,
    draggingElementId: dragState.draggingElementId,

    // Methods
    startDrag,
    updateDragPosition,
    endDrag,
    recordInitialPositions,
    getInitialPosition,
    calculateDragOffset,

    // Config
    gridSize,
    snapToGrid,
  };
};
