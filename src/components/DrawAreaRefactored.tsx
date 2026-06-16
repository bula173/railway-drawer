/**
 * DrawAreaRefactored.tsx
 *
 * This is a reference implementation showing how to use manager hooks
 * to replace DrawArea's complex state management.
 *
 * This file demonstrates the pattern without modifying the original DrawArea.
 * It can be:
 * 1. Used as a learning resource
 * 2. Gradually migrated into the real DrawArea
 * 3. Compared with original for validation
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { DrawElement } from './Elements';
import { useSelectionManager } from '../hooks/useSelectionManager';
import { useDragManager } from '../hooks/useDragManager';
import { useResizeManager } from '../hooks/useResizeManager';
import { useHistoryManager } from '../hooks/useHistoryManager';
import { logger } from '../utils/logger';

interface DrawAreaRefactoredProps {
  elements: DrawElement[];
  onElementsChange: (elements: DrawElement[]) => void;
  onStateChange?: (state: any) => void;
}

/**
 * Reference implementation of DrawArea using manager hooks
 *
 * This shows the pattern for integrating:
 * - useSelectionManager for selection/hover logic
 * - useDragManager for drag operations
 * - useResizeManager for resize operations
 * - useHistoryManager for undo/redo
 *
 * Key benefits:
 * - Reduced state declarations (from ~20 to ~5)
 * - Clearer separation of concerns
 * - Easier to test and maintain
 * - Easier to understand data flow
 */
export const DrawAreaRefactored: React.FC<DrawAreaRefactoredProps> = ({
  elements: initialElements,
  onElementsChange,
  onStateChange,
}) => {
  // Core drawing state
  const [elements, setElements] = useState<DrawElement[]>(initialElements);
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [showGrid, setShowGrid] = useState(true);

  // UI state (not extracted to hooks - keep UI state local)
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  // Manager hooks
  const selection = useSelectionManager({
    elements,
    onSelectionChange: useCallback((ids: string[]) => {
      logger.debug('DrawAreaRefactored', 'Selection changed', { count: ids.length });
    }, []),
  });

  const drag = useDragManager({
    gridSize: 40,
    snapToGrid: true,
    onElementsDrag: useCallback((draggedElements: DrawElement[]) => {
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
      onElementsChange?.(newState);
    }, [onElementsChange]),
  });

  // Derived state
  const selectedElements = useMemo(
    () => elements.filter(el => selection.selectedElementIds.includes(el.id)),
    [elements, selection.selectedElementIds]
  );

  // Operations
  const updateElement = useCallback((element: DrawElement) => {
    const newElements = elements.map(el => (el.id === element.id ? element : el));
    setElements(newElements);
    history.pushToHistory(newElements, 'Element updated');
  }, [elements, history]);

  const deleteSelectedElements = useCallback(() => {
    const newElements = elements.filter(el => !selection.selectedElementIds.includes(el.id));
    setElements(newElements);
    history.pushToHistory(newElements, 'Elements deleted');
    selection.clearSelection();
  }, [elements, selection, history]);

  const selectAllElements = useCallback(() => {
    selection.selectElements(elements.map(el => el.id));
  }, [elements, selection]);

  // Handlers
  const handleElementClick = useCallback((el: DrawElement, ctrlKey: boolean) => {
    selection.selectElement(el.id, ctrlKey);
  }, [selection]);

  const handleDragStart = useCallback((el: DrawElement, x: number, y: number, svgRect: DOMRect) => {
    drag.startDrag(el.id, x, y, svgRect);
    drag.recordInitialPositions([el]);
  }, [drag]);

  const handleResizeStart = useCallback((el: DrawElement, handle: string, x: number, y: number) => {
    resize.startResize(el, handle as any, x, y);
  }, [resize]);

  const handleUndo = useCallback(() => {
    if (history.canUndo()) {
      history.undo();
    }
  }, [history]);

  const handleRedo = useCallback(() => {
    if (history.canRedo()) {
      history.redo();
    }
  }, [history]);

  // References
  const svgRef = useRef<SVGSVGElement>(null);

  // Render (simplified - would use RenderElement component)
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>
        <button onClick={handleSelectAll}>Select All</button>
        <button onClick={deleteSelectedElements} disabled={selection.selectedElementIds.length === 0}>
          Delete
        </button>
        <button onClick={handleUndo} disabled={!history.canUndo()}>
          Undo
        </button>
        <button onClick={handleRedo} disabled={!history.canRedo()}>
          Redo
        </button>
        <span style={{ marginLeft: '16px' }}>
          Selected: {selection.selectedElementIds.length} | Total: {elements.length}
        </span>
      </div>

      {/* Canvas */}
      <svg
        ref={svgRef}
        style={{
          flex: 1,
          backgroundColor,
          cursor: isPanning ? 'grabbing' : 'default',
        }}
      >
        {/* Render elements and selection UI */}
        <g>
          {/* Selection rectangle during area selection */}
          {selection.isAreaSelecting && selection.selectionRect && (
            <rect
              x={selection.selectionRect.x}
              y={selection.selectionRect.y}
              width={selection.selectionRect.width}
              height={selection.selectionRect.height}
              fill="rgba(121, 141, 242, 0.1)"
              stroke="rgba(121, 141, 242, 0.8)"
              strokeWidth={2}
              pointerEvents="none"
            />
          )}
        </g>
      </svg>
    </div>
  );
};

/**
 * INTEGRATION CHECKLIST for DrawArea
 *
 * This component demonstrates how to use the manager hooks.
 * To integrate into the real DrawArea:
 *
 * 1. Add imports:
 *    - import { useSelectionManager } from '../hooks/useSelectionManager';
 *    - import { useDragManager } from '../hooks/useDragManager';
 *    - import { useResizeManager } from '../hooks/useResizeManager';
 *    - import { useHistoryManager } from '../hooks/useHistoryManager';
 *
 * 2. Remove state declarations for:
 *    - selectedElementIds, setSelectedElementIds
 *    - hoveredElementId, setHoveredElementId
 *    - isAreaSelecting, setIsAreaSelecting
 *    - selectionStart, setSelectionStart
 *    - selectionEnd, setSelectionEnd
 *    - draggingId, setDraggingId
 *    - history, setHistory
 *    - historyIndex, setHistoryIndex
 *
 * 3. Replace handler functions:
 *    - handlePointerDown -> use drag.startDrag() and selection.selectElement()
 *    - handlePointerMove -> use drag.updateDragPosition()
 *    - handlePointerUp -> use drag.endDrag()
 *    - handleSvgPointerDown -> use selection.startAreaSelection()
 *    - History operations -> use history.pushToHistory(), undo(), redo()
 *
 * 4. Update component logic:
 *    - Replace selectedElementIds with selection.selectedElementIds
 *    - Replace hoveredElementId with selection.hoveredElementId
 *    - Replace drag state with drag.isDragging
 *    - Replace history state with history.currentState
 *
 * 5. Test:
 *    - Run npm test - all tests should pass
 *    - Verify selection works (click, Ctrl+click, area select)
 *    - Verify dragging works with grid snapping
 *    - Verify resizing works
 *    - Verify undo/redo works
 *
 * 6. Commit:
 *    - git add src/components/DrawArea.tsx
 *    - git commit -m "Phase 4 Part 2a: Integrate useSelectionManager"
 */
