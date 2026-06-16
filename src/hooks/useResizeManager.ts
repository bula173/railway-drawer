import { useState, useCallback, useRef } from 'react';
import type { DrawElement, Point } from '../components/Elements';
import { logger } from '../utils/logger';

type ResizeHandle = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

interface ResizeState {
  isResizing: boolean;
  handle: ResizeHandle | null;
  startElement: DrawElement | null;
}

interface ResizeOptions {
  minSize?: number;
  onElementResize?: (element: DrawElement) => void;
}

/**
 * Custom hook to manage element resizing logic
 * Handles: resize handles, corner dragging, mirroring
 * Extracted from DrawArea to reduce component complexity
 */
export const useResizeManager = (options: ResizeOptions = {}) => {
  const { minSize = 8, onElementResize } = options;

  // Resize state
  const [resizeState, setResizeState] = useState<ResizeState>({
    isResizing: false,
    handle: null,
    startElement: null,
  });

  // Store resize context
  const resizeContextRef = useRef<{
    startX: number;
    startY: number;
  } | null>(null);

  const startResize = useCallback(
    (element: DrawElement, handle: ResizeHandle, clientX: number, clientY: number) => {
      setResizeState({
        isResizing: true,
        handle,
        startElement: { ...element },
      });

      resizeContextRef.current = {
        startX: clientX,
        startY: clientY,
      };

      logger.debug('ResizeManager', 'Resize started', {
        elementId: element.id,
        handle,
        startPos: { x: clientX, y: clientY },
      });
    },
    []
  );

  const calculateResizedElement = useCallback(
    (
      element: DrawElement,
      handle: ResizeHandle,
      currentX: number,
      currentY: number,
      svgRect: DOMRect
    ): DrawElement | null => {
      if (!resizeContextRef.current || !resizeState.startElement) {
        return null;
      }

      const startEl = resizeState.startElement;
      const dx = currentX - resizeContextRef.current.startX;
      const dy = currentY - resizeContextRef.current.startY;

      let newStart = { ...startEl.start };
      let newEnd = { ...startEl.end };

      // Calculate new positions based on handle
      switch (handle) {
        case 'topLeft':
          newStart = {
            x: startEl.start.x + dx,
            y: startEl.start.y + dy,
          };
          break;
        case 'topRight':
          newStart = {
            x: startEl.start.x,
            y: startEl.start.y + dy,
          };
          newEnd = {
            x: startEl.end.x + dx,
            y: startEl.end.y,
          };
          break;
        case 'bottomLeft':
          newStart = {
            x: startEl.start.x + dx,
            y: startEl.start.y,
          };
          newEnd = {
            x: startEl.end.x,
            y: startEl.end.y + dy,
          };
          break;
        case 'bottomRight':
          newEnd = {
            x: startEl.end.x + dx,
            y: startEl.end.y + dy,
          };
          break;
      }

      // Check minimum size
      const width = Math.abs(newEnd.x - newStart.x);
      const height = Math.abs(newEnd.y - newStart.y);

      if (width < minSize || height < minSize) {
        return null; // Don't update if too small
      }

      // Handle mirroring for custom SVG elements
      let mirrorX = element.mirrorX || false;
      let mirrorY = element.mirrorY || false;

      if (element.type === 'custom') {
        const currentWidth = newEnd.x - newStart.x;
        const currentHeight = newEnd.y - newStart.y;

        if (currentWidth < 0) {
          mirrorX = !mirrorX;
          [newStart.x, newEnd.x] = [newEnd.x, newStart.x];
        }
        if (currentHeight < 0) {
          mirrorY = !mirrorY;
          [newStart.y, newEnd.y] = [newEnd.y, newStart.y];
        }
      }

      return {
        ...element,
        start: newStart,
        end: newEnd,
        mirrorX,
        mirrorY,
      };
    },
    [resizeState.startElement, minSize]
  );

  const updateResize = useCallback(
    (
      element: DrawElement,
      handle: ResizeHandle,
      clientX: number,
      clientY: number,
      svgRect: DOMRect
    ) => {
      const resized = calculateResizedElement(
        element,
        handle,
        clientX,
        clientY,
        svgRect
      );

      if (resized) {
        onElementResize?.(resized);
      }
    },
    [calculateResizedElement, onElementResize]
  );

  const endResize = useCallback(() => {
    setResizeState({
      isResizing: false,
      handle: null,
      startElement: null,
    });
    resizeContextRef.current = null;

    logger.debug('ResizeManager', 'Resize ended');
  }, []);

  const getResizeHandles = useCallback((element: DrawElement): ResizeHandle[] => {
    return ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
  }, []);

  return {
    // State
    isResizing: resizeState.isResizing,
    handle: resizeState.handle,
    startElement: resizeState.startElement,

    // Methods
    startResize,
    updateResize,
    endResize,
    getResizeHandles,
    calculateResizedElement,

    // Config
    minSize,
  };
};
