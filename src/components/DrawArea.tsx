/**
 * @file DrawArea.tsx
 * @brief Interactive SVG drawing area component for railway diagram creation.
 * 
 * This component provides a full-featured drawing canvas with element manipulation,
 * selection, drag-and-drop, copy/paste, zoom, pan, and area selection capabilities.
 * 
 * @author Railway Drawer Team
 * @date 2025
 * @version 1.0
 */

import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback, useMemo } from "react";
import { RenderElement, getRotatedBoundingRect, synchronizeTextRegionsWithSVG, expandSVGRectForText, syncTextRegionsWithSVG, syncUnifiedElement } from "./Elements";
import type { DrawElement } from "./Elements";
import { snapToConnectionPoint, getConnectionPointsGrid } from "../utils/connectionManager";
import { ConnectorRenderer } from "./ConnectorRenderer";
import type { ToolboxItem } from "./Toolbox";
import type { DrawTool, Layer } from "../types";
import type { Connector, ConnectorStyle } from "../utils/connectorStyles";
import type { BrushConfig } from "../utils/brushTools";
import { logger } from "../utils/logger";
import { snapPointToGrid } from "../utils/index";
import { findSnapPoint } from "../utils/trackUtils";
import { useSelectionManager } from "../hooks/useSelectionManager";

/**
 * @interface DrawAreaRef
 * @brief Methods exposed by DrawArea component through ref
 * @details Provides external access to DrawArea's internal functionality
 */
export interface DrawAreaRef {
  /** @brief Gets the underlying SVG element */
  getSvgElement: () => SVGSVGElement | null;
  /** @brief Gets all drawing elements */
  getElements: () => DrawElement[];
  /** @brief Sets drawing elements */
  setElements: (elements: DrawElement[]) => void;
  /** @brief Updates drawing elements with history tracking for undo/redo */
  updateElements: (elements: DrawElement[]) => void;
  /** @brief Sets grid visibility */
  setGridVisible: (visible: boolean) => void;
  /** @brief Gets grid visibility state */
  getGridVisible: () => boolean;
  /** @brief Sets background color */
  setBackgroundColor: (color: string) => void;
  /** @brief Gets background color */
  getBackgroundColor: () => string;
  /** @brief Gets currently selected element */
  getSelectedElement: () => DrawElement | undefined;
  /** @brief Gets all selected element IDs */
  getSelectedElementIds: () => string[];
  /** @brief Copies selected elements to internal clipboard and returns them */
  copySelectedElements: () => DrawElement[] | undefined;
  /** @brief Cuts selected elements to internal clipboard and returns them */
  cutSelectedElements: () => DrawElement[] | undefined;
  /** @brief Pastes elements from internal clipboard */
  pasteElements: (position?: { x: number; y: number }) => void;
  /** @brief Unified paste logic that handles system clipboard and internal elements */
  performUnifiedPaste: (e?: ClipboardEvent) => Promise<boolean>;
  /** @brief Gets copied elements */
  getCopiedElements: () => DrawElement[];
  /** @brief Sets copied elements */
  setCopiedElements: (els: DrawElement[]) => void;
  // Edit operations
  /** @brief Undo the last action */
  undo: () => void;
  /** @brief Redo the last undone action */
  redo: () => void;
  /** @brief Delete selected elements */
  deleteSelectedElements: () => void;
  /** @brief Select all elements */
  selectAllElements: () => void;
  /** @brief Check if undo is available */
  canUndo: () => boolean;
  /** @brief Check if redo is available */
  canRedo: () => boolean;
  /** @brief Sends the specified element to the front */
  handleSendToFront: (elementId: string) => void;
  /** @brief Sends the specified element to the back */
  handleSendToBack: (elementId: string) => void;
}

/**
 * @interface DrawAreaProps
 * @brief Props for the DrawArea component
 * @details Contains layout, grid, and zoom configuration for the drawing area
 */
export interface DrawAreaProps {
  /** @brief Width of the drawing grid */
  GRID_WIDTH: number;
  /** @brief Height of the drawing grid */
  GRID_HEIGHT: number;
  /** @brief Size of each grid cell */
  GRID_SIZE: number;
  /** @brief Current zoom level (optional, defaults to 1.0) */
  zoom?: number;
  /** @brief Callback for when element selection changes */
  setSelectedElement?: (el?: DrawElement) => void;
  /** @brief Whether to disable internal keyboard handlers (for global handling) */
  disableKeyboardHandlers?: boolean;
  /** @brief Currently active drawing tool */
  activeTool?: DrawTool;
  /** @brief Available drawing layers */
  layers?: Layer[];
  /** @brief ID of the currently active layer */
  activeLayerId?: string;
  /** @brief Callback for when internal state changes (for edit menu updates) */
  onStateChange?: () => void;
  /** @brief Callback when DrawArea has unsaved changes ready to persist */
  onReadyToSave?: () => void;
  /** @brief Callback when canvas needs to expand to fit elements */
  onCanvasExpand?: (bounds: { maxX: number; maxY: number; minX?: number; minY?: number }) => void;
  /** @brief Whether brush tool is active */
  brushMode?: boolean;
  /** @brief Brush configuration */
  brushConfig?: BrushConfig;
  /** @brief Callback for when a connector is selected */
  onConnectorSelected?: (connectorId: string | undefined) => void;
}

/**
 * @component DrawArea
 * @brief Interactive SVG drawing canvas for railway diagrams
 * 
 * Provides comprehensive drawing functionality including:
 * - Element selection and manipulation
 * - Drag and drop from toolbox
 * - Copy/paste with keyboard shortcuts
 * - Area selection with rectangle
 * - Zoom and pan capabilities
 * - Grid display and snapping
 * - Undo/redo history
 * 
 * @param props Component properties
 * @param ref Forwarded ref for external access to component methods
 * @returns JSX.Element The rendered SVG drawing area
 */
const DrawArea = forwardRef<DrawAreaRef, DrawAreaProps>(({
  GRID_WIDTH,
  GRID_HEIGHT,
  GRID_SIZE,
  zoom = 1,
  setSelectedElement,
  onConnectorsChange,
  disableKeyboardHandlers = false,
  activeTool = 'select',
  layers = [{ id: 'default', name: 'Background Layer', visible: true, locked: false }],
  activeLayerId = 'default',
  onStateChange,
  onReadyToSave,
  onCanvasExpand,
  brushMode = false,
  brushConfig,
}, ref) => {
  /** @brief Internal drawing elements state */
  const [elements, setElements] = useState<DrawElement[]>([]);
  
  // Debug: Track when elements actually change
  useEffect(() => {
    logger.debug("DrawArea", "🔥 ELEMENTS STATE:", {
      count: elements.length,
      elementIds: elements.map(el => el.id)
    });
  }, [elements]);

  /**
   * @brief Debounced callback when DrawArea is ready to save
   * @details Waits 500ms after last element change before notifying parent
   */
  useEffect(() => {
    if (readyToSaveTimerRef.current) {
      clearTimeout(readyToSaveTimerRef.current);
    }

    readyToSaveTimerRef.current = setTimeout(() => {
      if (onReadyToSave) {
        onReadyToSave();
      }
    }, 500);

    return () => {
      if (readyToSaveTimerRef.current) {
        clearTimeout(readyToSaveTimerRef.current);
      }
    };
  }, [elements]); // Only depend on elements, not the callback

  // Phase 4b: Initialize selection manager (others will be integrated in future work)
  const selectionManager = useSelectionManager({
    elements,
    onSelectionChange: useCallback((ids: string[]) => {
      setSelectedElementIds(ids);
    }, []),
  });

  /** @brief IDs of currently selected elements */
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const selectedElements = useMemo(() => elements.filter(el => selectedElementIds.includes(el.id)), [elements, selectedElementIds]);
  const selectionCanGroup = selectedElementIds.length > 1;
  const selectionCanUngroup = selectedElements.some(el => Boolean(el.groupId));
  /** @brief Character to start editing with */
  const [editingStartChar, setEditingStartChar] = useState<string | undefined>(undefined);
  /** @brief ID of element currently being hovered */
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  /** @brief ID of element currently being dragged */
  const [draggingId, setDraggingId] = useState<string | null>(null);
  /** @brief Ref to track dragging ID across renders */
  const draggingIdRef = useRef<string | null>(null);
  /** @brief Offset for drag operations */
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  /** @brief Background color of the drawing area */
  const [backgroundColor, setBackgroundColor] = useState<string>("#ffffff");
  /** @brief Whether grid is visible */
  const [showGrid, setShowGrid] = useState<boolean>(true);
  /** @brief Unified history state (elements + brush strokes together; connectors are now elements) */
  interface HistoryState {
    elements: DrawElement[];
    brushStrokes: any[]; // BrushStroke[]
    timestamp: number;
  }

  const [history, setHistory] = useState<HistoryState[]>([]);
  /** @brief Current position in history for redo functionality */
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Initialize history with current state on mount
  useEffect(() => {
    if (history.length === 0) {
      logger.info("DrawArea", "🔧 Initializing unified history", {
        currentElements: elements.length,
        currentBrushStrokes: brushStrokes.length,
      });
      const initialSnapshot: HistoryState = {
        elements: createDeepElementsSnapshot(elements),
        brushStrokes: [...brushStrokes],
        timestamp: Date.now(),
      };
      setHistory([initialSnapshot]);
      setHistoryIndex(0);
    }
  }, []); // Only run once on mount

  // Validate and fix history state inconsistencies
  useEffect(() => {
    if (history.length > 0 && historyIndex >= history.length) {
      logger.warn("DrawArea", "🔧 Fixing corrupted history state", {
        historyIndex,
        historyLength: history.length,
        fixingTo: Math.max(0, history.length - 1)
      });
      setHistoryIndex(Math.max(0, history.length - 1));
    }
  }, [history.length, historyIndex]);

  /** @brief Reference to the SVG element */
  const svgRef = useRef<SVGSVGElement | null>(null);
  /** @brief Flag to prevent duplicate history entries */
  const hasPushedToHistory = useRef(false);
  /** @brief Ref to track connector start point reliably across closures */
  const connectorStartRef = useRef<{ elementId: string; point: { x: number; y: number } } | null>(null);
  /** @brief Ref to track target shape for connector */
  const targetShapeRef = useRef<string | null>(null);
  /** @brief Ref to track which connector endpoint is being dragged */
  const draggingConnectorRef = useRef<{ id: string; endpoint: 'start' | 'end' } | null>(null);
  /** @brief Ref to track current mouse position during connector drag for accurate endpoint */
  const connectorCurrentPosRef = useRef<{ x: number; y: number } | null>(null);
  /** @brief State to track target shape when dragging connector endpoint */
  const [connectorDragTargetShape, setConnectorDragTargetShape] = useState<string | null>(null);
  /** @brief Ref to track target shape when dragging connector endpoint */
  const connectorDragTargetRef = useRef<{ shapeId: string; pointIndex: number } | null>(null);
  /** @brief Track which connector endpoint is being interacted with */
  const [hoveredConnectorEnd, setHoveredConnectorEnd] = useState<{ connectorId: string; endpoint: 'start' | 'end' } | null>(null);

  /** @brief Area selection state */
  const [isAreaSelecting, setIsAreaSelecting] = useState(false);
  /** @brief Start position of area selection */
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  /** @brief End position of area selection */
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null);
  /** @brief Ref for selection end position to avoid stale closures */
  const selectionEndRef = useRef<{ x: number; y: number } | null>(null);

  /** @brief Measure tool state */
  const [measureStart, setMeasureStart] = useState<{ x: number; y: number } | null>(null);
  /** @brief Current measure end position */
  const [measureEnd, setMeasureEnd] = useState<{ x: number; y: number } | null>(null);

  /** @brief Panning state */
  const [isPanning, setIsPanning] = useState(false);
  /** @brief Start position of pan operation */
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  /** @brief Current pan offset */
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  /** @brief Map storing initial positions during multi-element drag */
  const initialSelectedPositions = useRef<Map<string, { start: { x: number; y: number }, end: { x: number; y: number } }>>(new Map());
  /** @brief Elements stored in clipboard for copy/paste */
  const [copiedElements, setCopiedElements] = useState<DrawElement[]>([]);
  /** @brief Context menu state */
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    elementId: string | null;
    type: 'element' | 'canvas' | 'selection';
  } | null>(null);
  /** @brief Ref to track the last drop operation to prevent React StrictMode duplicates */
  const lastDropRef = useRef<{ timestamp: number; itemType: string; x: number; y: number } | null>(null);
  /** @brief Ref to track processed element IDs to prevent React StrictMode duplicates */
  const processedElementIds = useRef<Set<string>>(new Set());
  /** @brief Debounce timer for onReadyToSave callback */
  const readyToSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  /** @brief State to track pending canvas expansion bounds */
  const [expansionBounds, setExpansionBounds] = useState<{ maxX: number; maxY: number; minX?: number; minY?: number } | null>(null);

  /** @brief Alignment guides state for auto-positioning */
  const [alignmentGuides, setAlignmentGuides] = useState<{
    verticalLines: number[];
    horizontalLines: number[];
  }>({ verticalLines: [], horizontalLines: [] });

  /** @brief Connector creation state */
  const [connectorStartPoint, setConnectorStartPoint] = useState<{ elementId: string; point: { x: number; y: number } } | null>(null);
  const [connectorPreview, setConnectorPreview] = useState<{ x: number; y: number } | null>(null);

  /** @brief Quick-connect menu state */
  const [quickConnectMenu, setQuickConnectMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    sourceElementId: string;
  } | null>(null);

  /** @brief Target shape during connector drag (for green highlight) */
  const [targetShapeForConnector, setTargetShapeForConnector] = useState<string | null>(null);

  /** @brief Brush stroke state */
  const [brushStrokes, setBrushStrokes] = useState<Array<{ id: string; points: Array<{ x: number; y: number }>; config: any }>>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Array<{ x: number; y: number }>>([]);

  // Note: Connectors are now part of elements[], so history is updated when elements change

  /**
   * @brief Use effect to call parent's onCanvasExpand when bounds change
   * This defers the parent state update out of the event handler to prevent React warnings
   */
  useEffect(() => {
    if (expansionBounds && onCanvasExpand) {
      onCanvasExpand(expansionBounds);
      setExpansionBounds(null);
    }
  }, [expansionBounds, onCanvasExpand]);

  /**
   * @brief Check if elements exceed canvas bounds and queue parent expansion
   * @param elementsToCheck The elements to check bounds for
   */
  const checkAndExpandCanvas = useCallback((elementsToCheck: DrawElement[]) => {
    if (!onCanvasExpand || elementsToCheck.length === 0) return;
    
    let maxX = -Infinity;
    let maxY = -Infinity;
    let minX = Infinity;
    let minY = Infinity;
    
    elementsToCheck.forEach(el => {
      const startX = Math.min(el.start.x, el.end?.x || el.start.x);
      const startY = Math.min(el.start.y, el.end?.y || el.start.y);
      const endX = Math.max(el.start.x, el.end?.x || el.start.x);
      const endY = Math.max(el.start.y, el.end?.y || el.start.y);
      
      const elementMinX = startX;
      const elementMinY = startY;
      const elementMaxX = endX + (el.width || 0);
      const elementMaxY = endY + (el.height || 0);
      
      minX = Math.min(minX, elementMinX);
      minY = Math.min(minY, elementMinY);
      maxX = Math.max(maxX, elementMaxX);
      maxY = Math.max(maxY, elementMaxY);
    });
    
    // Ensure we have valid values
    if (!isFinite(minX)) minX = 0;
    if (!isFinite(minY)) minY = 0;
    if (!isFinite(maxX)) maxX = 0;
    if (!isFinite(maxY)) maxY = 0;
    
    // Check if we need to expand (with smaller margin during drag for responsive expansion)
    const EXPANSION_MARGIN = draggingId ? 50 : 100;
    
    // Log for debugging
    if (draggingId) {
      logger.info("DrawArea", "🎯 Drag bounds check:", {
        bounds: { minX, minY, maxX, maxY },
        gridSize: { GRID_WIDTH, GRID_HEIGHT },
        margin: EXPANSION_MARGIN,
        shouldExpand: minX < EXPANSION_MARGIN || minY < EXPANSION_MARGIN || 
                     maxX > GRID_WIDTH - EXPANSION_MARGIN || maxY > GRID_HEIGHT - EXPANSION_MARGIN
      });
    }
    
    // Expand if elements go beyond any edge (left, right, top, bottom)
    if (minX < EXPANSION_MARGIN || minY < EXPANSION_MARGIN || 
        maxX > GRID_WIDTH - EXPANSION_MARGIN || maxY > GRID_HEIGHT - EXPANSION_MARGIN) {
      logger.info("DrawArea", "📐 Expanding canvas for bounds:", { minX, minY, maxX, maxY });
      // Queue the expansion instead of calling directly (prevents React warning)
      setExpansionBounds({ maxX, maxY, minX, minY });
    }
  }, [onCanvasExpand, GRID_WIDTH, GRID_HEIGHT, draggingId]);

  /**
   * @brief Detect alignment guides when dragging elements
   * @details Finds elements within 20px and suggests alignment
   * @returns Object with suggested position adjustments and visual guides
   */
  const detectAlignmentGuides = useCallback((draggedElements: DrawElement[], allElements: DrawElement[], threshold: number = 20) => {
    const verticalLines: number[] = [];
    const horizontalLines: number[] = [];
    let bestAlignmentX: number | null = null;
    let bestAlignmentY: number | null = null;
    let bestDistanceX = threshold;
    let bestDistanceY = threshold;

    // Get bounds of dragged elements
    let draggedMinX = Infinity, draggedMaxX = -Infinity;
    let draggedMinY = Infinity, draggedMaxY = -Infinity;

    draggedElements.forEach(el => {
      const minX = Math.min(el.start.x, el.end?.x || el.start.x);
      const maxX = Math.max(el.start.x, el.end?.x || el.start.x);
      const minY = Math.min(el.start.y, el.end?.y || el.start.y);
      const maxY = Math.max(el.start.y, el.end?.y || el.start.y);
      
      draggedMinX = Math.min(draggedMinX, minX);
      draggedMaxX = Math.max(draggedMaxX, maxX);
      draggedMinY = Math.min(draggedMinY, minY);
      draggedMaxY = Math.max(draggedMaxY, maxY);
    });

    // Check against other elements for alignment
    allElements.forEach(el => {
      // Skip dragged elements
      if (draggedElements.some(d => d.id === el.id)) return;

      const elementMinX = Math.min(el.start.x, el.end?.x || el.start.x);
      const elementMaxX = Math.max(el.start.x, el.end?.x || el.start.x);
      const elementMinY = Math.min(el.start.y, el.end?.y || el.start.y);
      const elementMaxY = Math.max(el.start.y, el.end?.y || el.start.y);

      // Check vertical alignments (left, center, right)
      [elementMinX, (elementMinX + elementMaxX) / 2, elementMaxX].forEach(alignX => {
        const distLeft = Math.abs(draggedMinX - alignX);
        const distCenter = Math.abs((draggedMinX + draggedMaxX) / 2 - alignX);
        const distRight = Math.abs(draggedMaxX - alignX);

        [distLeft, distCenter, distRight].forEach(dist => {
          if (dist < bestDistanceX && dist <= threshold) {
            bestDistanceX = dist;
            bestAlignmentX = alignX;
            if (!verticalLines.includes(alignX)) {
              verticalLines.push(alignX);
            }
          }
        });
      });

      // Check horizontal alignments (top, center, bottom)
      [elementMinY, (elementMinY + elementMaxY) / 2, elementMaxY].forEach(alignY => {
        const distTop = Math.abs(draggedMinY - alignY);
        const distCenter = Math.abs((draggedMinY + draggedMaxY) / 2 - alignY);
        const distBottom = Math.abs(draggedMaxY - alignY);

        [distTop, distCenter, distBottom].forEach(dist => {
          if (dist < bestDistanceY && dist <= threshold) {
            bestDistanceY = dist;
            bestAlignmentY = alignY;
            if (!horizontalLines.includes(alignY)) {
              horizontalLines.push(alignY);
            }
          }
        });
      });
    });

    return {
      verticalLines,
      horizontalLines,
      bestAlignmentX,
      bestAlignmentY,
      hasAlignment: bestAlignmentX !== null || bestAlignmentY !== null,
    };
  }, []);

  /**
   * @brief Create a deep copy of a DrawElement preserving all properties
   * @param element The element to deep copy
   * @returns A complete deep copy of the element
   */
  const createDeepElementCopy = useCallback((element: DrawElement): DrawElement => {
    return {
      ...element,
      // Deep copy coordinate objects
      start: { ...element.start },
      end: { ...element.end },
      // Deep copy arrays if they exist
      textRegions: element.textRegions ? element.textRegions.map((region: any) => ({ ...region })) : undefined,
      shapeElements: element.shapeElements ? element.shapeElements.map((shape: any) => ({ ...shape })) : undefined,
      // Preserve functions by binding to current context
      setGridEnabled: setShowGrid,
      setBackgroundColor: setBackgroundColor,
      // Preserve all other properties
      gridEnabled: showGrid,
      backgroundColor: backgroundColor,
    };
  }, [showGrid, backgroundColor, setShowGrid, setBackgroundColor]);

  /**
   * @brief Create a complete deep copy of the entire elements array
   * @param elements The elements array to deep copy
   * @returns A complete deep copy of all elements with proper preservation
   */
  const createDeepElementsSnapshot = useCallback((elements: DrawElement[]): DrawElement[] => {
    return elements.map(element => createDeepElementCopy(element));
  }, [createDeepElementCopy]);

  /**
   * @brief Add unified state to history (elements + brush strokes)
   * @details Saves a complete snapshot of both elements and brush strokes
   * Note: Connectors are now part of elements[], so they're saved automatically
   */
  const pushToHistory = useCallback((newElements: DrawElement[], newBrushStrokes?: any[]) => {
    const strokesToSave = newBrushStrokes !== undefined ? newBrushStrokes : brushStrokes;

    // Check for actual changes
    const elementsChanged = newElements.length !== elements.length ||
      !newElements.every((el, idx) => el.id === elements[idx]?.id);
    const strokesChanged = strokesToSave.length !== brushStrokes.length;

    if (!elementsChanged && !strokesChanged) {
      logger.debug("DrawArea", "No changes detected, skipping history");
      return;
    }

    // Create new history entry
    const historyState: HistoryState = {
      elements: createDeepElementsSnapshot(newElements),
      brushStrokes: [...strokesToSave],
      timestamp: Date.now(),
    };

    // Clear future history and add new state
    const newHistory = [...history.slice(0, historyIndex + 1), historyState];
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);

    logger.info("DrawArea", "📝 Added to unified history", {
      historyLength: newHistory.length,
      historyIndex: newHistory.length - 1,
      elements: historyState.elements.length,
      brushStrokes: historyState.brushStrokes.length,
    });

    onStateChange?.();
  }, [history, historyIndex, elements, brushStrokes, createDeepElementsSnapshot, onStateChange]);

  /**
   * @brief Add current state to history and update elements (legacy compatibility)
   * @param updater Function or value to update elements state
   * @details Kept for compatibility with existing code
   */
  const pushToHistoryAndSetElements = useCallback((updater: React.SetStateAction<DrawElement[]>) => {
    // Calculate the new state first
    const newElements = typeof updater === 'function' ? updater(elements) : updater;

    logger.info("DrawArea", "📝 Adding to history and updating elements", {
      currentHistoryIndex: historyIndex,
      currentHistoryLength: history.length,
      currentElements: elements.length,
      newElements: newElements.length,
    });

    // Update elements
    setElements(newElements);

    // Save to unified history
    pushToHistory(newElements);
  }, [elements, historyIndex, history.length, setElements, pushToHistory]);

  /**
   * @brief Undo the last action
   * @details Restores the previous state from unified history
   */
  const undo = useCallback(() => {
    if (historyIndex <= 0) {
      logger.warn("DrawArea", "🔄 Cannot undo - at history start");
      return;
    }

    const newIndex = historyIndex - 1;
    const previousState = history[newIndex];

    if (!previousState) {
      logger.warn("DrawArea", "🔄 Cannot undo - invalid history state");
      return;
    }

    logger.info("DrawArea", "🔄 Applying undo", {
      fromIndex: historyIndex,
      toIndex: newIndex,
      restoringElements: previousState.elements.length,
      restoringBrushStrokes: previousState.brushStrokes.length,
    });

    setElements(createDeepElementsSnapshot(previousState.elements));
    setBrushStrokes([...previousState.brushStrokes]);
    setHistoryIndex(newIndex);
    onStateChange?.();
  }, [history, historyIndex, onStateChange, createDeepElementsSnapshot]);

  /**
   * @brief Delete selected elements
   * @details Removes all selected elements from the canvas and adds to history
   */
  const deleteSelectedElements = useCallback(() => {
    logger.info("DrawArea", "🗑️ Delete selected elements called", {
      selectedCount: selectedElementIds.length,
      selectedIds: selectedElementIds
    });

    if (selectedElementIds.length > 0) {
      pushToHistoryAndSetElements(prev =>
        prev.filter(element => !selectedElementIds.includes(element.id))
      );
      selectionManager.clearSelection();
      if (setSelectedElement) {
        setSelectedElement(undefined);
      }
      onStateChange?.();
      logger.info("DrawArea", "🗑️ Delete completed");
    } else {
      logger.warn("DrawArea", "🗑️ No elements selected for deletion");
    }
  }, [selectedElementIds, pushToHistoryAndSetElements, setSelectedElement, onStateChange, selectionManager]);

  /**
   * @brief Select all elements
   * @details Selects all elements on the canvas
   */
  const selectAllElements = useCallback(() => {
    const allIds = elements.map(el => el.id);
    selectionManager.selectElements(allIds);
    onStateChange?.();
  }, [elements, onStateChange, selectionManager]);

  /**
   * @brief Redo the last undone action
   * @details Restores the next state from unified history
   */
  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) {
      logger.warn("DrawArea", "🔄 Cannot redo - at history end");
      return;
    }

    const newIndex = historyIndex + 1;
    const nextState = history[newIndex];

    if (!nextState) {
      logger.warn("DrawArea", "🔄 Cannot redo - invalid history state");
      return;
    }

    logger.info("DrawArea", "🔄 Applying redo", {
      fromIndex: historyIndex,
      toIndex: newIndex,
      restoringElements: nextState.elements.length,
      restoringBrushStrokes: nextState.brushStrokes.length,
    });

    setElements(createDeepElementsSnapshot(nextState.elements));
    setBrushStrokes([...nextState.brushStrokes]);
    setHistoryIndex(newIndex);
    onStateChange?.();
  }, [history, historyIndex, onStateChange, createDeepElementsSnapshot]);

  /**
   * @brief Copy selected elements to internal clipboard
   * @details Creates deep copies of selected elements and stores them for pasting.
   * Also attempts to store in system clipboard for cross-application copying.
   */
  const copySelectedElements = useCallback(() => {
    const elementsToCopy = elements.filter(el => selectedElementIds.includes(el.id));
    
    if (elementsToCopy.length === 0) {
      logger.warn('DrawArea', 'No elements selected for copying');
      return;
    }
    
    // Create deep copies preserving all element properties
    const copiedElementsData = elementsToCopy.map(el => {
      // Create a clean deep copy of the element
      const elementCopy = {
        ...el,
        // Preserve all properties including functions (use current context functions)
        gridEnabled: el.gridEnabled ?? showGrid,
        backgroundColor: el.backgroundColor ?? backgroundColor,
        setGridEnabled: setShowGrid,
        setBackgroundColor: setBackgroundColor,
        // Deep copy start and end positions
        start: { ...el.start },
        end: { ...el.end },
        // Preserve other properties with safe defaults
        textRegions: el.textRegions ? [...el.textRegions] : undefined,
        rotation: el.rotation ?? 0,
        width: el.width,
        height: el.height,
        type: el.type,
        name: el.name,
        iconName: el.iconName,
        iconSource: el.iconSource,
        iconSvg: el.iconSvg,
        draw: el.draw,
        shape: el.shape,
        // Don't change ID yet - will be done during paste
        originalId: el.id
      };
      
      return elementCopy;
    });
    
    // Update state synchronously 
    setCopiedElements(copiedElementsData);
    onStateChange?.();
    
    // Write sentinel to system clipboard to prioritize internal elements during paste
    try {
      navigator.clipboard.writeText('RAILWAY_DRAWER_COPY');
    } catch {
      logger.warn('DrawArea', 'Failed to write sentinel to system clipboard');
    }
    
    logger.info('DrawArea', `Copied ${elementsToCopy.length} elements to internal clipboard`);
    
    // Return the copied elements for immediate use
    return copiedElementsData;
  }, [elements, selectedElementIds, showGrid, backgroundColor, setShowGrid, setBackgroundColor, setCopiedElements, onStateChange]);

  /**
   * @brief Cut selected elements to internal clipboard
   * @details Creates deep copies of selected elements, stores them for pasting, and removes originals.
   * Also attempts to store in system clipboard for cross-application cutting.
   */
  const cutSelectedElements = useCallback(() => {
    const elementsToCopy = elements.filter(el => selectedElementIds.includes(el.id));
    
    if (elementsToCopy.length === 0) {
      logger.warn('DrawArea', 'No elements selected for cutting');
      return;
    }
    
    // Create deep copies preserving all element properties (same as copy)
    const copiedElementsData = elementsToCopy.map(el => {
      const elementCopy = {
        ...el,
        gridEnabled: el.gridEnabled ?? showGrid,
        backgroundColor: el.backgroundColor ?? backgroundColor,
        setGridEnabled: setShowGrid,
        setBackgroundColor: setBackgroundColor,
        start: { ...el.start },
        end: { ...el.end },
        textRegions: el.textRegions ? [...el.textRegions] : undefined,
        rotation: el.rotation ?? 0,
        width: el.width,
        height: el.height,
        type: el.type,
        name: el.name,
        iconName: el.iconName,
        iconSource: el.iconSource,
        iconSvg: el.iconSvg,
        draw: el.draw,
        shape: el.shape,
        originalId: el.id
      };
      
      return elementCopy;
    });
    
    // Update clipboard state
    setCopiedElements(copiedElementsData);
    
    // Remove the original elements (this is what makes it "cut" instead of "copy")
    pushToHistoryAndSetElements(prev => prev.filter(el => !selectedElementIds.includes(el.id)));
    setSelectedElementIds([]);
    setHoveredElementId(null);
    setSelectedElement?.(undefined);
    onStateChange?.();
    
    // Write sentinel to system clipboard to prioritize internal elements during paste
    try {
      navigator.clipboard.writeText('RAILWAY_DRAWER_COPY');
    } catch {
      logger.warn('DrawArea', 'Failed to write sentinel to system clipboard');
    }
    
    logger.info('DrawArea', `Cut ${elementsToCopy.length} elements to internal clipboard`);
    
    // Return the cut elements for immediate use
    return copiedElementsData;
  }, [elements, selectedElementIds, showGrid, backgroundColor, setShowGrid, setBackgroundColor, setCopiedElements, pushToHistoryAndSetElements, setSelectedElementIds, setHoveredElementId, setSelectedElement, onStateChange]);

  /**
   * @brief Calculate bounding box of multiple elements
   * @param elements Array of elements to calculate bounds for
   * @returns Rectangle with x, y, width, height of bounding box
   */
  const calculateElementsBounds = useCallback((elements: DrawElement[]) => {
    if (elements.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    elements.forEach(el => {
      // Validate element has required properties
      if (!el.start || !el.end || 
          typeof el.start.x !== 'number' || typeof el.start.y !== 'number' ||
          typeof el.end.x !== 'number' || typeof el.end.y !== 'number') {
        logger.warn('DrawArea', 'Invalid element found while calculating bounds:', { el });
        return;
      }
      
      const left = Math.min(el.start.x, el.end.x);
      const right = Math.max(el.start.x, el.end.x);
      const top = Math.min(el.start.y, el.end.y);
      const bottom = Math.max(el.start.y, el.end.y);
      
      minX = Math.min(minX, left);
      minY = Math.min(minY, top);
      maxX = Math.max(maxX, right);
      maxY = Math.max(maxY, bottom);
    });
    
    // Handle case where no valid elements were found
    if (minX === Infinity || minY === Infinity || maxX === -Infinity || maxY === -Infinity) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }, []);

  /**
   * @brief Paste elements from clipboard at specified position
   * @param pastePosition Optional position to paste at, defaults to offset from original
   * @details Creates new elements with unique IDs and pastes them with a small offset
   * from the original elements for easy visibility.
   */
  const pasteElements = useCallback((pastePosition?: { x: number; y: number }) => {
    if (copiedElements.length === 0) {
      logger.warn('DrawArea', 'No elements in clipboard to paste');
      return;
    }
    
    // Calculate paste position
    let offsetX = 0;
    let offsetY = 0;
    
    if (pastePosition) {
      // If explicit position provided, use it
      offsetX = pastePosition.x;
      offsetY = pastePosition.y;
    } else {
      // Default: offset from original by 30px down and right
      const PASTE_OFFSET = 30;
      offsetX = PASTE_OFFSET;
      offsetY = PASTE_OFFSET;
    }
    
    // Create new elements with new IDs and offset positions
    const newElements = copiedElements.map(el => {
      const newId = `${el.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create new element preserving all properties
      const newElement = {
        ...el,
        id: newId,
        start: {
          x: el.start.x + offsetX,
          y: el.start.y + offsetY
        },
        end: {
          x: el.end.x + offsetX,
          y: el.end.y + offsetY
        },
        // Ensure all properties are preserved
        gridEnabled: showGrid, // Use current grid state
        backgroundColor: backgroundColor, // Use current background
        setGridEnabled: setShowGrid,
        setBackgroundColor: setBackgroundColor,
        // Deep copy text regions if they exist
        textRegions: el.textRegions ? el.textRegions.map((region: unknown) => ({ ...(region as Record<string, unknown>) })) : undefined,
        // Remove the originalId property
        originalId: undefined
      };
      
      return newElement;
    });
    
    // Validate elements before adding
    const validElements = newElements.filter(el => 
      el.id && el.type && el.start && el.end &&
      typeof el.start.x === 'number' && typeof el.start.y === 'number' &&
      typeof el.end.x === 'number' && typeof el.end.y === 'number'
    );
    
    if (validElements.length !== newElements.length) {
      logger.warn('DrawArea', `${newElements.length - validElements.length} invalid elements filtered out during paste`);
    }
    
    if (validElements.length === 0) {
      logger.error('DrawArea', 'No valid elements to paste');
      return;
    }
    
    // Add to history before making changes
    pushToHistoryAndSetElements(prev => {
      const newElements = [...prev, ...validElements];
      
      // Check if canvas needs to expand
      checkAndExpandCanvas(newElements);
      
      return newElements;
    });
    
    // Select the newly pasted elements
    const newElementIds = validElements.map(el => el.id);
    selectionManager.selectElements(newElementIds);

    if (newElementIds.length === 1) {
      setSelectedElement?.(validElements[0]);
    } else {
      setSelectedElement?.(undefined);
    }

    logger.info('DrawArea', `Pasted ${validElements.length} elements with offset (${offsetX.toFixed(1)}, ${offsetY.toFixed(1)})`);
  }, [copiedElements, calculateElementsBounds, pushToHistoryAndSetElements, selectionManager, setSelectedElement, svgRef, panOffset, zoom, showGrid, backgroundColor, setShowGrid, setBackgroundColor, GRID_WIDTH, GRID_HEIGHT]);

  /**
   * @brief Create an image element from base64 data URL
   */
  const createImageElement = useCallback((dataUrl: string, mimeType: string) => {
    const img = new Image();
    img.onload = () => {
      // Get center of visible canvas area
      const scrollParent = svgRef.current?.parentElement;
      
      const centerX = scrollParent ? scrollParent.scrollLeft + (scrollParent.clientWidth / 2) / zoom : GRID_WIDTH / 2;
      const centerY = scrollParent ? scrollParent.scrollTop + (scrollParent.clientHeight / 2) / zoom : GRID_HEIGHT / 2;
      
      // Create new element with default size (200x200 or scaled to maintain aspect)
      const defaultSize = 200;
      let width = defaultSize;
      let height = defaultSize;
      
      // Maintain aspect ratio
      if (img.width > img.height) {
        height = (defaultSize * img.height) / img.width;
      } else {
        width = (defaultSize * img.width) / img.height;
      }
      
      const newElement: DrawElement = {
        id: `image_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'image',
        start: {
          x: centerX - width / 2,
          y: centerY - height / 2,
        },
        end: {
          x: centerX + width / 2,
          y: centerY + height / 2,
        },
        width,
        height,
        strokeColor: '#000000',
        fillColor: '#ffffff',
        strokeWidth: 0,
        data: {
          dataUrl,
          mimeType,
          originalWidth: img.width,
          originalHeight: img.height,
        },
      };

      // Add to elements and history
      pushToHistoryAndSetElements(prev => [...prev, newElement]);
      onStateChange?.();
      
      logger.info('DrawArea', '🖼️ Image pasted:', {
        type: mimeType,
        width,
        height,
        position: { x: newElement.start.x, y: newElement.start.y }
      });
    };
    img.src = dataUrl;
  }, [GRID_WIDTH, GRID_HEIGHT, zoom, pushToHistoryAndSetElements, onStateChange]);

  /**
   * @brief Create an image element from SVG text
   */
  const createImageElementFromSVG = useCallback((svgText: string) => {
    try {
      // Parse SVG to get dimensions
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
      
      if (svgDoc.documentElement.nodeName === 'parsererror') {
        logger.error('DrawArea', 'Invalid SVG');
        return;
      }

      const svgElement = svgDoc.documentElement;
      const viewBox = svgElement.getAttribute('viewBox');
      let width = 200;
      let height = 200;
      
      // Try to get dimensions from viewBox or attributes
      if (viewBox) {
        const [, , vbWidth, vbHeight] = viewBox.split(/\s+/).map(Number);
        width = vbWidth || 200;
        height = vbHeight || 200;
      } else {
        const w = svgElement.getAttribute('width');
        const h = svgElement.getAttribute('height');
        if (w && h) {
          width = parseFloat(w) || 200;
          height = parseFloat(h) || 200;
        }
      }

      // Get center of visible canvas area
      const scrollParent = svgRef.current?.parentElement;
      const centerX = scrollParent ? scrollParent.scrollLeft + (scrollParent.clientWidth / 2) / zoom : GRID_WIDTH / 2;
      const centerY = scrollParent ? scrollParent.scrollTop + (scrollParent.clientHeight / 2) / zoom : GRID_HEIGHT / 2;

      // Scale to reasonable size if too large
      const maxSize = 300;
      if (width > maxSize || height > maxSize) {
        const scale = Math.min(maxSize / width, maxSize / height);
        width *= scale;
        height *= scale;
      }

      const newElement: DrawElement = {
        id: `svg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'image',
        start: {
          x: centerX - width / 2,
          y: centerY - height / 2,
        },
        end: {
          x: centerX + width / 2,
          y: centerY + height / 2,
        },
        width,
        height,
        strokeColor: '#000000',
        fillColor: '#ffffff',
        strokeWidth: 0,
        data: {
          svgText,
          mimeType: 'image/svg+xml',
          originalWidth: width,
          originalHeight: height,
        },
      };

      // Add to elements and history
      pushToHistoryAndSetElements(prev => [...prev, newElement]);
      onStateChange?.();
      
      logger.info('DrawArea', '🖼️ SVG pasted:', {
        width,
        height,
        position: { x: newElement.start.x, y: newElement.start.y }
      });
    } catch (error) {
      logger.error('DrawArea', 'Error parsing SVG:', { error });
    }
  }, [GRID_WIDTH, GRID_HEIGHT, zoom, pushToHistoryAndSetElements, onStateChange]);

  /**
   * @brief Unified paste function used by both keyboard shortcuts and context menu
   * @details Priority: event items → system clipboard → local copy
   * IMPORTANT: Both Ctrl+V and context menu paste use this same logic
   */
  /**
   * @brief Unified paste logic that handles both system clipboard and internal elements
   * @param e Optional ClipboardEvent (from Ctrl+V/paste event)
   * @returns Promise<boolean> True if something was pasted
   */
  const performUnifiedPaste = useCallback(async (e?: ClipboardEvent): Promise<boolean> => {
    try {
      logger.info("DrawArea", "🎯 Unified paste triggered", { hasEvent: !!e });
      
      // Step 0: Check if we have internal elements and a "sentinel" on the system clipboard.
      // If the user just did a "Copy" inside the app, we prioritize those elements.
      let hasSentinel = false;
      if (copiedElements.length > 0) {
        if (e?.clipboardData) {
          hasSentinel = e.clipboardData.getData('text/plain') === 'RAILWAY_DRAWER_COPY';
        } else {
          try {
            const text = await navigator.clipboard.readText();
            hasSentinel = text === 'RAILWAY_DRAWER_COPY';
          } catch { /* ignore */ }
        }
      }

      if (hasSentinel) {
        if (e) e.preventDefault();
        logger.info("DrawArea", '📌 Sentinel found: Prioritizing internal elements');
        pasteElements();
        return true;
      }
      
      // Step 1: Try event clipboard items first (from Ctrl+V)
      // We must extract files/items synchronously before any 'await'
      if (e?.clipboardData) {
        const clipboardData = e.clipboardData;
        const items = clipboardData.items;
        const files = clipboardData.files;
        
        logger.info("DrawArea", "📦 Paste event data", { 
          itemCount: items?.length, 
          fileCount: files?.length,
          types: clipboardData.types 
        });

        // 1.1 Priority: Images (as files or items)
        let imageFile: File | null = null;
        let imageType: string = '';

        // Check files first (often more reliable for screenshots)
        if (files && files.length > 0) {
          for (let i = 0; i < files.length; i++) {
            if (files[i].type.startsWith('image/')) {
              imageFile = files[i];
              imageType = files[i].type;
              break;
            }
          }
        }

        // Check items if no file found
        if (!imageFile && items && items.length > 0) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
              imageFile = items[i].getAsFile();
              imageType = items[i].type;
              break;
            }
          }
        }

        if (imageFile) {
          if (e) e.preventDefault();
          logger.info("DrawArea", `🖼️ Found image in event clipboard`, { type: imageType });
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target?.result as string);
            reader.readAsDataURL(imageFile!);
          });
          createImageElement(dataUrl, imageType);
          return true;
        }

        // 1.2 Priority: SVG text
        if (items && items.length > 0) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].type === 'text/plain') {
              // We have to use getAsString, which is async/callback based.
              // We've already checked for images so it's safe to await here now.
              const text = await new Promise<string>((resolve) => {
                items[i].getAsString(resolve);
              });
              
              if (text.trim().startsWith('<svg')) {
                if (e) e.preventDefault();
                logger.info("DrawArea", '📊 Found SVG in event clipboard');
                createImageElementFromSVG(text);
                return true;
              }
            }
          }
        }
      }

      // Step 2: Try system clipboard (Async API)
      // This is used for menu-initiated paste or if event data was missing
      logger.info("DrawArea", '📌 Attempting system clipboard');
      
      try {
        // Try images via Clipboard API FIRST (prioritize images)
        if (navigator.clipboard.read) {
          try {
            const clipboardData = await navigator.clipboard.read();
            for (const item of clipboardData) {
              const imageType = item.types.find(t => t.startsWith('image/'));
              if (imageType) {
                if (e) e.preventDefault();
                logger.info("DrawArea", `🖼️ Found image in system clipboard`, { type: imageType });
                const blob = await item.getType(imageType);
                const dataUrl = await new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onload = (event) => resolve(event.target?.result as string);
                  reader.readAsDataURL(blob);
                });
                createImageElement(dataUrl, imageType);
                return true;
              }
            }
          } catch {
            logger.info("DrawArea", 'clipboard.read failed (normal if no visual content)');
          }
        }

        // Try SVG text second
        try {
          const text = await navigator.clipboard.readText();
          if (text && text.trim().startsWith('<svg')) {
            if (e) e.preventDefault();
            logger.info("DrawArea", '📊 Found SVG in system clipboard');
            createImageElementFromSVG(text);
            return true;
          }
        } catch {
          logger.info("DrawArea", 'readText failed or was empty');
        }
      } catch (error) {
        logger.error("DrawArea", 'Error reading system clipboard', { error });
      }

      // Step 3: Final fallback to local elements
      if (copiedElements.length > 0) {
        if (e) e.preventDefault();
        logger.info("DrawArea", '📌 Fallback: Using local copied elements');
        pasteElements();
        return true;
      }
      
      logger.warn("DrawArea", '⚠️ No content found to paste');
      return false;
    } catch (error) {
      logger.error("DrawArea", '❌ Paste error', { error });
      return false;
    }
  }, [copiedElements, createImageElement, createImageElementFromSVG, pasteElements]);

  /**
   * @brief Handle pasting from system clipboard via Ctrl+V
   */
  const handlePasteImage = useCallback(async (e: ClipboardEvent) => {
    if (disableKeyboardHandlers) return;
    await performUnifiedPaste(e);
  }, [disableKeyboardHandlers, performUnifiedPaste]);

  /**
   * @brief Handle connector start from connection point
   * @param elementId The element ID where connector starts
   * @param point The connection point coordinates
   */
  const handleConnectorStart = useCallback((elementId: string, point: { x: number; y: number }) => {
    const startData = { elementId, point };
    setConnectorStartPoint(startData);
    connectorStartRef.current = startData;
    targetShapeRef.current = null; // Reset target for this drag
    setConnectorPreview(point);

    const handlePointerMove = (e: PointerEvent) => {
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) return;

      const clientX = e.clientX - svgRect.left;
      const clientY = e.clientY - svgRect.top;
      const x = (clientX - panOffset.x) / zoom;
      const y = (clientY - panOffset.y) / zoom;

      const currentPos = { x, y };
      connectorCurrentPosRef.current = currentPos;
      setConnectorPreview(currentPos);

      const DETECTION_RANGE = 80;
      let closestShape: string | null = null;
      let minDistance = DETECTION_RANGE;

      console.log('🔍 DETECTION: cursor at', { x, y }, 'checking', elements.length, 'elements, excluding', elementId);

      for (const el of elements) {
        if (el.id === elementId) continue;
        const bounds = getRotatedBoundingRect(el);

        // Extract min/max coordinates from bounds
        const minX = Math.min(bounds.topLeft.x, bounds.topRight.x, bounds.bottomLeft.x, bounds.bottomRight.x);
        const maxX = Math.max(bounds.topLeft.x, bounds.topRight.x, bounds.bottomLeft.x, bounds.bottomRight.x);
        const minY = Math.min(bounds.topLeft.y, bounds.topRight.y, bounds.bottomLeft.y, bounds.bottomRight.y);
        const maxY = Math.max(bounds.topLeft.y, bounds.topRight.y, bounds.bottomLeft.y, bounds.bottomRight.y);

        const closestX = Math.max(minX, Math.min(x, maxX));
        const closestY = Math.max(minY, Math.min(y, maxY));
        const dx = x - closestX;
        const dy = y - closestY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        console.log(`  Element ${el.id}: bounds=[${minX},${maxX}]x[${minY},${maxY}], distance=${distance.toFixed(1)}`);

        if (distance < minDistance) {
          minDistance = distance;
          closestShape = el.id;
          console.log(`    ✅ New closest at ${distance.toFixed(1)}px`);
        }
      }

      if (closestShape !== targetShapeRef.current) {
        console.log('🎨 TARGET UPDATE:', { old: targetShapeRef.current, new: closestShape, distance: minDistance });
      }

      console.log('📍 POINTER MOVE - Setting target:', { closestShape, minDistance });
      setTargetShapeForConnector(closestShape);
      targetShapeRef.current = closestShape;
      console.log('📍 After set - targetShapeRef.current is now:', targetShapeRef.current);
    };

    const handlePointerUp = (e: PointerEvent) => {
      console.log('🔴🔴🔴 POINTER UP FIRED 🔴🔴🔴');
      const startPoint = connectorStartRef.current;
      const targetShapeId = targetShapeRef.current;

      console.log('📌 Reading refs:', {
        startPoint: !!startPoint,
        targetShapeRef_current: targetShapeRef.current
      });
      console.log('🔴 CONNECTOR RELEASE:', {
        hasStartPoint: !!startPoint,
        targetShapeId,
        elementCount: elements.length,
        allElementIds: elements.map(el => el.id)
      });

      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);

      if (!startPoint) {
        console.log('❌ No start point, aborting connector creation');
        connectorStartRef.current = null;
        targetShapeRef.current = null;
        setConnectorStartPoint(null);
        setConnectorPreview(null);
        setTargetShapeForConnector(null);
        return;
      }

      // Create connector regardless of whether there's a target shape
      // If there's a target, use its center; otherwise use the mouse release point
      let toElementId: string | undefined = undefined;
      let toPoint = connectorCurrentPosRef.current || connectorPreview || startPoint.point;

      if (targetShapeId) {
        console.log('🔍 Looking for target element:', targetShapeId);
        const targetElement = elements.find(el => el.id === targetShapeId);
        console.log('✅ Found target element:', !!targetElement);

        if (targetElement) {
          toElementId = targetElement.id;
          const targetCenterX = (targetElement.start.x + targetElement.end.x) / 2;
          const targetCenterY = (targetElement.start.y + targetElement.end.y) / 2;
          toPoint = { x: targetCenterX, y: targetCenterY };
        }
      } else {
        console.log('⚠️  No target shape - creating free-end connector');
      }

      // Calculate connection point indices for attached endpoints
      let fromPointIndex: number | undefined = undefined;
      let toPointIndex: number | undefined = undefined;

      // Find which point on the start element is closest to the start position
      if (startPoint.elementId) {
        const startElement = elements.find(el => el.id === startPoint.elementId);
        if (startElement) {
          const startPoints = getConnectionPointsGrid(startElement);
          let minDist = Infinity;
          for (let i = 0; i < startPoints.length; i++) {
            const dist = Math.hypot(
              startPoints[i].x - startPoint.point.x,
              startPoints[i].y - startPoint.point.y
            );
            if (dist < minDist) {
              minDist = dist;
              fromPointIndex = i;
            }
          }
        }
      }

      // Find which point on the target element is closest to the end position
      if (toElementId) {
        const toElement = elements.find(el => el.id === toElementId);
        if (toElement) {
          const toPoints = getConnectionPointsGrid(toElement);
          let minDist = Infinity;
          for (let i = 0; i < toPoints.length; i++) {
            const dist = Math.hypot(
              toPoints[i].x - toPoint.x,
              toPoints[i].y - toPoint.y
            );
            if (dist < minDist) {
              minDist = dist;
              toPointIndex = i;
            }
          }
        }
      }

      // Create connector as a DrawElement with type === 'connector'
      const newConnectorElement: DrawElement = {
        id: `connector-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'connector',
        dimensionality: '1D',
        start: startPoint.point,
        end: toPoint,
        fromElementId: startPoint.elementId || undefined,
        toElementId: toElementId,
        fromAttached: !!startPoint.elementId,
        toAttached: !!toElementId,
        fromPointIndex,
        toPointIndex,
        connectorStyle: {
          lineWidth: 2,
          color: '#000000',
          lineStyle: 'solid',
          opacity: 1,
          startArrow: 'none',
          endArrow: 'standard'
        }
      };

      console.log('📍 CREATING CONNECTOR ELEMENT:', newConnectorElement);
      // Add connector to elements array
      pushToHistoryAndSetElements(prev => {
        console.log('📊 Previous elements:', prev.length);
        const updated = [...prev, newConnectorElement];
        console.log('📊 Updated elements:', updated.length);
        return updated;
      });
      logger.info('interaction', 'Connector created', {
        from: startPoint.elementId || 'free',
        to: toElementId || 'free'
      });

      connectorStartRef.current = null;
      targetShapeRef.current = null;
      connectorCurrentPosRef.current = null;
      setConnectorStartPoint(null);
      setConnectorPreview(null);
      setTargetShapeForConnector(null);
    };

    // Add listeners for both pointer and mouse events for better compatibility
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    logger.debug('interaction', 'Connector drag started', { elementId, point });
  }, [elements, panOffset, zoom]);

  // Note: Connector creation is now handled entirely through elements array
  // No separate handleConnectorFinish or handleConnectorSelect needed

  /**
   * @brief Handle brush stroke start
   */
  const handleBrushStart = useCallback((e: React.PointerEvent) => {
    if (!brushMode) return;

    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    setIsDrawing(true);
    setCurrentStroke([{ x, y }]);
  }, [brushMode, zoom]);

  /**
   * @brief Handle brush stroke movement
   */
  const handleBrushMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawing || !brushMode) return;

    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    setCurrentStroke(prev => [...prev, { x, y }]);
  }, [isDrawing, brushMode, zoom]);

  /**
   * @brief Handle brush stroke finish
   */
  const handleBrushEnd = useCallback(() => {
    if (!isDrawing || currentStroke.length < 2) {
      setIsDrawing(false);
      setCurrentStroke([]);
      return;
    }

    const newStroke = {
      id: `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      points: currentStroke,
      config: brushConfig,
    };

    // Add new stroke to current brush strokes
    const updatedBrushStrokes = [...brushStrokes, newStroke];

    // Update brush strokes and save to unified history
    setBrushStrokes(updatedBrushStrokes);

    // Save the complete state (elements + new brush stroke) to unified history
    pushToHistory(elements, updatedBrushStrokes);

    setIsDrawing(false);
    setCurrentStroke([]);

    logger.debug('interaction', 'Brush stroke created', {
      strokeId: newStroke.id,
      pointCount: currentStroke.length,
      brushType: brushConfig?.type,
    });
  }, [isDrawing, currentStroke, brushConfig, brushStrokes, elements, pushToHistory]);

  /**
   * @brief Handle right-click context menu
   * @param e The mouse event
   * @details Shows context menu with cut, copy, delete, and z-order options
   */
  const handleContextMenu = useCallback((e: React.MouseEvent, elementId?: string) => {
    e.preventDefault();
    
    // Close any existing context menu first
    setContextMenu(null);
    
    // If right-clicking on a selected group, show selection menu
    if (elementId && selectedElementIds.includes(elementId) && selectedElementIds.length > 1) {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        elementId: null,
        type: 'selection',
      });
      return;
    }

    // If right-clicking on an element, show element context menu
    if (elementId) {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        elementId,
        type: 'element',
      });
    } else if (selectedElementIds.length > 1) {
      // Right-clicking on empty canvas with a multi-selection should still surface the selection menu
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        elementId: null,
        type: 'selection',
      });
    } else if (selectedElementIds.length === 1) {
      // Right-clicking on empty canvas while a single element is selected should still show element actions
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        elementId: selectedElementIds[0],
        type: 'element',
      });
    } else if (selectedElementIds.length === 0) {
      // Right-clicking on empty canvas with no selection - show canvas menu
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        elementId: null,
        type: 'canvas',
      });
    }
  }, [selectedElementIds]);

  const groupSelectedElements = useCallback(() => {
    if (selectedElementIds.length <= 1) return;
    const groupId = `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
    pushToHistoryAndSetElements(prev => prev.map(el => (
      selectedElementIds.includes(el.id)
        ? { ...el, groupId }
        : el
    )));
    setContextMenu(null);
  }, [selectedElementIds, pushToHistoryAndSetElements]);

  const ungroupSelectedElements = useCallback(() => {
    if (selectedElementIds.length === 0) return;
    pushToHistoryAndSetElements(prev => prev.map(el => (
      selectedElementIds.includes(el.id)
        ? { ...el, groupId: undefined }
        : el
    )));
    setContextMenu(null);
  }, [selectedElementIds, pushToHistoryAndSetElements]);

  /**
   * @brief Close context menu when clicking elsewhere
   */
  useEffect(() => {
    const handleClick = () => {
      setContextMenu(null);
      setQuickConnectMenu(null);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  /**
   * @brief Handle cut operation from context menu
   */
  const handleCut = useCallback((elementId: string) => {
    const element = elements.find(el => el.id === elementId);
    if (!element) return;
    
    setCopiedElements([createDeepElementCopy(element)]);
    setElements(prev => prev.filter(el => el.id !== elementId));
    setSelectedElementIds([]);
    setContextMenu(null);
  }, [elements, createDeepElementCopy]);

  /**
   * @brief Handle copy operation from context menu
   */
  const handleCopy = useCallback((elementId: string) => {
    const element = elements.find(el => el.id === elementId);
    if (!element) return;
    
    setCopiedElements([createDeepElementCopy(element)]);
    setContextMenu(null);
  }, [elements, createDeepElementCopy]);

  /**
   * @brief Handle delete operation from context menu
   */
  const handleDelete = useCallback((elementId: string) => {
    setElements(prev => prev.filter(el => el.id !== elementId));
    setSelectedElementIds([]);
    setContextMenu(null);
  }, []);

  /**
   * @brief Handle send to back operation from context menu
   */
  const handleSendToBack = useCallback((elementId: string) => {
    setElements(prev => {
      const element = prev.find(el => el.id === elementId);
      if (!element) return prev;
      
      const filtered = prev.filter(el => el.id !== elementId);
      return [element, ...filtered];
    });
    setContextMenu(null);
  }, []);

  /**
   * @brief Handle send to front operation from context menu
   */
  const handleSendToFront = useCallback((elementId: string) => {
    setElements(prev => {
      const element = prev.find(el => el.id === elementId);
      if (!element) return prev;
      
      const filtered = prev.filter(el => el.id !== elementId);
      return [...filtered, element];
    });
    setContextMenu(null);
  }, []);

  /**
   * @brief Handle cut selection from context menu
   */
  const handleCutSelection = useCallback(() => {
    cutSelectedElements();
    setContextMenu(null);
  }, [cutSelectedElements]);

  /**
   * @brief Handle copy selection from context menu
   */
  const handleCopySelection = useCallback(() => {
    copySelectedElements();
    setContextMenu(null);
  }, [copySelectedElements]);

  /**
   * @brief Handle delete selection from context menu
   */
  const handleDeleteSelection = useCallback(() => {
    deleteSelectedElements();
    setContextMenu(null);
  }, [deleteSelectedElements]);

  /**
   * @brief Handle send selection to front from context menu
   */
  const handleSendSelectionToFront = useCallback(() => {
    setElements(prev => {
      const selected = prev.filter(el => selectedElementIds.includes(el.id));
      const nonSelected = prev.filter(el => !selectedElementIds.includes(el.id));
      return [...nonSelected, ...selected];
    });
    setContextMenu(null);
  }, [selectedElementIds]);

  /**
   * @brief Handle send selection to back from context menu
   */
  const handleSendSelectionToBack = useCallback(() => {
    setElements(prev => {
      const selected = prev.filter(el => selectedElementIds.includes(el.id));
      const nonSelected = prev.filter(el => !selectedElementIds.includes(el.id));
      return [...selected, ...nonSelected];
    });
    setContextMenu(null);
  }, [selectedElementIds]);

  /**
   * @brief Handle paste from context menu - uses unified paste logic
   */
  const handlePasteFromContextMenu = useCallback(async () => {
    logger.info("DrawArea", '🍽️ Context menu paste clicked');
    setContextMenu(null);
    
    // Use unified paste logic (no event object since it's from menu)
    await performUnifiedPaste();
  }, [performUnifiedPaste]);

  /**
   * @brief Expose methods through ref for external component access
   * @details Provides imperative access to DrawArea functionality from parent components
   */
  useImperativeHandle(ref, () => ({
    getSvgElement: () => svgRef.current,
    getElements: () => elements,
    getBrushStrokes: () => brushStrokes,
    setBrushStrokes: (strokes: any[]) => {
      setBrushStrokes(strokes);
    },
    setElements: (els: DrawElement[]) => {
      setElements(els);
    },
    updateElements: (els: DrawElement[]) => {
      pushToHistoryAndSetElements(els);
    },
    setGridVisible: (visible: boolean) => setShowGrid(visible),
    getGridVisible: () => showGrid,
    setBackgroundColor: (color: string) => {
      setBackgroundColor(color);
      if (svgRef.current) {
        svgRef.current.style.backgroundColor = color;
      }
    },
    getBackgroundColor: () => backgroundColor,
    getSelectedElement: () => {
      if (!selectedElementIds.length) return undefined;
      return elements.find(el => el.id === selectedElementIds[selectedElementIds.length - 1]);
    },
    getSelectedElementIds: () => selectedElementIds,
    copySelectedElements,
    cutSelectedElements,
    pasteElements,
    performUnifiedPaste,
    getCopiedElements: () => copiedElements,
    setCopiedElements: (els: DrawElement[]) => setCopiedElements(els),
    // Edit operations
    undo,
    redo,
    deleteSelectedElements,
    selectAllElements,
    canUndo: () => {
      const result = historyIndex > 0 && history.length > 1;
      logger.info("DrawArea", "🔍 canUndo check", {
        historyIndex,
        historyLength: history.length,
        result
      });
      return result;
    },
    canRedo: () => {
      const result = historyIndex >= 0 && historyIndex < history.length - 1;
      logger.info("DrawArea", "🔍 canRedo check", {
        historyIndex,
        historyLength: history.length,
        result
      });
      return result;
    },
    /** @brief Sends the specified element to the front */
    handleSendToFront: (elementId: string) => handleSendToFront(elementId),
    /** @brief Sends the specified element to the back */
    handleSendToBack: (elementId: string) => handleSendToBack(elementId),
  }), [elements, showGrid, backgroundColor, selectedElementIds, copiedElements, copySelectedElements, cutSelectedElements, pasteElements, performUnifiedPaste, undo, redo, deleteSelectedElements, selectAllElements, historyIndex, history]);

  /**
   * @brief Synchronize elements with grid visibility state
   * @details Updates all elements when grid visibility changes
   */
  useEffect(() => {
    setElements(prev => prev.map(el => ({ ...el, gridEnabled: showGrid })));
  }, [showGrid]);

  // Pass global properties to all elements
  elements.forEach((el) => {
    el.gridEnabled = showGrid;
    el.backgroundColor = backgroundColor;
    el.setGridEnabled = setShowGrid;
    el.setBackgroundColor = setBackgroundColor;
  });

  /**
   * @brief Keep draggingIdRef in sync with draggingId state
   * @details Prevents stale closure issues in event handlers
   */
  useEffect(() => {
    draggingIdRef.current = draggingId;
  }, [draggingId]);

  /**
   * @brief Handle keyboard shortcuts for element operations
   * @details Implements Delete, Ctrl+C (copy), Ctrl+V (paste), and Ctrl+Z (undo)
   */
  useEffect(() => {
    // Skip adding keyboard handlers if disabled (global handling enabled)
    if (disableKeyboardHandlers) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Don't intercept if textarea or contentEditable is focused (let it handle input normally)
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement?.tagName === 'TEXTAREA' || activeElement?.contentEditable === 'true') {
        return;
      }

      // Auto-enter text editing if typing on a selected shape
      if (
        selectedElementIds.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        e.key.length === 1 &&
        e.key !== ' '
      ) {
        const selectedElement = elements.find(el => el.id === selectedElementIds[0]);
        if (selectedElement) {
          e.preventDefault();
          console.log('⌨️ Keystroke on selected shape, entering text edit:', e.key);
          setEditingStartChar(e.key);

          // Clear the editingStartChar after a brief moment to prevent duplicate triggering
          // This prevents the useEffect in Elements from firing multiple times with the same character
          setTimeout(() => {
            setEditingStartChar(undefined);
          }, 100);
          return;
        }
      }

      // Delete selected elements
      if (e.key === "Delete") {
        e.preventDefault();
        deleteSelectedElements();
      }

      // Copy selected elements (Ctrl+C)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && selectedElementIds.length > 0) {
        e.preventDefault();
        // Use simple copy logic like context menu
        const elementsToCopy = elements.filter(el => selectedElementIds.includes(el.id));
        const copiedElementsData = elementsToCopy.map(el => createDeepElementCopy(el));
        setCopiedElements(copiedElementsData);
        onStateChange?.();
      }
      
      // Cut selected elements (Ctrl+X)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x" && selectedElementIds.length > 0) {
        e.preventDefault();
        // Copy first
        const elementsToCut = elements.filter(el => selectedElementIds.includes(el.id));
        const copiedElementsData = elementsToCut.map(el => createDeepElementCopy(el));
        setCopiedElements(copiedElementsData);
        // Then delete
        pushToHistoryAndSetElements(prev => prev.filter(el => !selectedElementIds.includes(el.id)));
        setSelectedElementIds([]);
        setHoveredElementId(null);
        setSelectedElement?.(undefined);
        onStateChange?.();
      }
      
      // Paste elements (Ctrl+V)
      // Note: Ctrl+V triggers both keydown AND paste events
      // The paste event is handled by handlePasteImage, so we just prevent default here
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        e.preventDefault();
        // The paste event will be triggered by the browser and handlePasteImage will catch it
      }
      
      // Undo (Ctrl+Z)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      
      // Redo (Ctrl+Shift+Z or Ctrl+Y)
      if ((e.ctrlKey || e.metaKey) && ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y")) {
        e.preventDefault();
        redo();
      }

      // Select All (Ctrl+A)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        selectAllElements();
      }
    }
    
    // Add listener for paste events with focus management
    const handlePasteWithFocus = (e: ClipboardEvent) => {
      if (disableKeyboardHandlers) return;
      
      // Ensure SVG has focus before processing paste
      if (svgRef.current && document.activeElement !== svgRef.current) {
        svgRef.current.focus();
      }
      handlePasteImage(e);
    };
    
    // Handle delete connector event from properties panel
    const handleDeleteConnector = (event: Event) => {
      const customEvent = event as CustomEvent<{ connectorId: string }>;
      const connectorId = customEvent.detail.connectorId;
      pushToHistoryAndSetElements(prev =>
        prev.filter(el => el.id !== connectorId)
      );
      setSelectedElementIds([]);
      setSelectedElement?.(undefined);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("paste", handlePasteWithFocus as any);
    window.addEventListener("deleteConnector", handleDeleteConnector);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("paste", handlePasteWithFocus as any);
      window.removeEventListener("deleteConnector", handleDeleteConnector);
    };
  }, [selectedElementIds, elements, setSelectedElement, copiedElements, disableKeyboardHandlers, pasteElements, pushToHistoryAndSetElements, undo, redo, deleteSelectedElements, selectAllElements, createDeepElementCopy, setCopiedElements, setHoveredElementId, onStateChange, handlePasteImage]);

  /**
   * @brief Check if an element intersects with a selection rectangle
   * @param element The element to test
   * @param selRect The selection rectangle with x, y, width, height
   * @returns True if element intersects with selection rectangle
   */
  function isElementInSelection(element: DrawElement, selRect: { x: number; y: number; width: number; height: number }): boolean {
    const elLeft = Math.min(element.start.x, element.end.x);
    const elRight = Math.max(element.start.x, element.end.x);
    const elTop = Math.min(element.start.y, element.end.y);
    const elBottom = Math.max(element.start.y, element.end.y);

    return !(elRight < selRect.x || 
             elLeft > selRect.x + selRect.width || 
             elBottom < selRect.y || 
             elTop > selRect.y + selRect.height);
  }

  /**
   * Handles pointer down for selection and drag start.
   * @function
   * @param {React.PointerEvent} e - The pointer event.
   * @param {DrawElement} el - The element being interacted with.
   */
  function handlePointerDown(e: React.PointerEvent, el: DrawElement) {
    // Focus the SVG to ensure keyboard events and paste commands are received
    if (svgRef.current) {
      svgRef.current.focus();
    }
    
    e.stopPropagation(); // Prevent SVG click handler

    const groupMemberIds = el.groupId
      ? elements.filter(member => member.groupId === el.groupId).map(member => member.id)
      : [];

    let newSelectionIds: string[] = [];
    const multiSelectClick = selectedElementIds.length > 1 && selectedElementIds.includes(el.id) && !(e.ctrlKey || e.metaKey);

    if (multiSelectClick) {
      newSelectionIds = selectedElementIds;
    } else if (groupMemberIds.length > 1) {
      if (e.ctrlKey || e.metaKey) {
        const groupFullySelected = groupMemberIds.every(id => selectedElementIds.includes(id));
        newSelectionIds = groupFullySelected
          ? selectedElementIds.filter(id => !groupMemberIds.includes(id))
          : [...new Set([...selectedElementIds, ...groupMemberIds])];
      } else {
        newSelectionIds = groupMemberIds;
      }
    } else {
      if (e.ctrlKey || e.metaKey) {
        newSelectionIds = selectedElementIds.includes(el.id)
          ? selectedElementIds.filter((id: string) => id !== el.id)
          : [...selectedElementIds, el.id];
      } else {
        newSelectionIds = [el.id];
      }
    }

    if (newSelectionIds.length === 0) {
      newSelectionIds = [el.id];
    }

    selectionManager.selectElements(newSelectionIds);
    const newSelectedElement = newSelectionIds.length === 1
      ? elements.find(element => element.id === newSelectionIds[0])
      : undefined;
    setSelectedElement?.(newSelectedElement);
    
    setDraggingId(el.id);

    hasPushedToHistory.current = false;
    const svgRect = svgRef.current?.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - (svgRect?.left ?? 0) - el.start.x,
      y: e.clientY - (svgRect?.top ?? 0) - el.start.y,
    };

    // Store initial positions of all selected elements
    const currentSelectedIds = newSelectionIds;
    initialSelectedPositions.current.clear();
    elements.forEach(element => {
      if (currentSelectedIds.includes(element.id)) {
        initialSelectedPositions.current.set(element.id, {
          start: { ...element.start },
          end: { ...element.end }
        });
      }
    });

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  /**
   * Renders the selection rectangle during area selection
   */
  function renderSelectionRectangle() {
    if (!isAreaSelecting || !selectionStart || !selectionEnd) return null;

    const x = Math.min(selectionStart.x, selectionEnd.x);
    const y = Math.min(selectionStart.y, selectionEnd.y);
    const width = Math.abs(selectionEnd.x - selectionStart.x);
    const height = Math.abs(selectionEnd.y - selectionStart.y);

    return (
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="rgba(121, 141, 242, 0.3)"
        stroke="rgba(21, 79, 225, 0.8)"
        strokeWidth={3}
        strokeDasharray="10,5"
        pointerEvents="none"
      />
    );
  }

  /**
   * @brief Renders the measurement line and label
   */
  function renderMeasurementGuide() {
    if (!measureStart || !measureEnd) return null;

    const dx = measureEnd.x - measureStart.x;
    const dy = measureEnd.y - measureStart.y;
    const distance = Math.round(Math.sqrt(dx * dx + dy * dy));

    // Guard against invalid zoom values
    if (!zoom || zoom <= 0) {
      return null;
    }

    const safeZoom = Math.max(zoom, 0.01);
    const rectWidth = Math.max(60 / safeZoom, 1);
    const rectHeight = Math.max(24 / safeZoom, 1);
    const maxRx = Math.min(rectWidth, rectHeight) / 2;
    const safeRx = Math.min(4 / safeZoom, maxRx);

    return (
      <g className="measurement-guide" pointerEvents="none">
        <line
          x1={measureStart.x}
          y1={measureStart.y}
          x2={measureEnd.x}
          y2={measureEnd.y}
          stroke="#ef4444"
          strokeWidth={Math.max(2 / safeZoom, 0.5)}
          strokeDasharray={`${Math.max(5 / safeZoom, 1)},${Math.max(5 / safeZoom, 1)}`}
        />
        <circle cx={measureStart.x} cy={measureStart.y} r={Math.max(4 / safeZoom, 0.5)} fill="#ef4444" />
        <circle cx={measureEnd.x} cy={measureEnd.y} r={Math.max(4 / safeZoom, 0.5)} fill="#ef4444" />

        {/* Distance label */}
        <g transform={`translate(${(measureStart.x + measureEnd.x) / 2}, ${(measureStart.y + measureEnd.y) / 2})`}>
          <rect
            x={-rectWidth / 2}
            y={-rectHeight / 2}
            width={rectWidth}
            height={rectHeight}
            fill="white"
            stroke="#ef4444"
            strokeWidth={Math.max(1 / safeZoom, 0.25)}
            rx={safeRx}
          />
          <text
            x={0}
            y={0}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#ef4444"
            fontSize={Math.max(12 / safeZoom, 8)}
            fontWeight="bold"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {distance}
          </text>
        </g>
      </g>
    );
  }

  /**
   * Handles double click detection and panning start
   */
  function handleSvgPointerDown(e: React.PointerEvent) {
    // Focus the SVG to ensure keyboard events and paste commands are received
    if (svgRef.current) {
      svgRef.current.focus();
    }

    // Always clear measurement when starting a new action
    setMeasureStart(null);
    setMeasureEnd(null);

    if (e.target !== svgRef.current && e.target !== e.currentTarget) {
      return;
    }

    // Check if middle mouse button or holding space for panning
    const shouldPan = e.button === 1 || e.shiftKey; // Middle mouse or Shift key for panning

    if (shouldPan) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      window.addEventListener("pointermove", handlePanMove);
      window.addEventListener("pointerup", handlePanUp);
      return;
    }

    // Only handle left mouse button for selection/measurement
    if (e.button !== 0) {
      return;
    }

    if (activeTool === 'measure') {
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) return;

      const clientX = e.clientX - svgRect.left;
      const clientY = e.clientY - svgRect.top;
      const x = (clientX - panOffset.x) / zoom;
      const y = (clientY - panOffset.y) / zoom;

      const snapped = snapPointToGrid({ x, y }, GRID_SIZE);
      setMeasureStart(snapped);
      setMeasureEnd(snapped);

      const measureMove = (moveEvent: PointerEvent) => {
        const moveSvgRect = svgRef.current?.getBoundingClientRect();
        if (!moveSvgRect) return;

        const moveClientX = moveEvent.clientX - moveSvgRect.left;
        const moveClientY = moveEvent.clientY - moveSvgRect.top;
        const moveX = (moveClientX - panOffset.x) / zoom;
        const moveY = (moveClientY - panOffset.y) / zoom;

        setMeasureEnd(snapPointToGrid({ x: moveX, y: moveY }, GRID_SIZE));
      };

      const measureUp = () => {
        window.removeEventListener("pointermove", measureMove);
        window.removeEventListener("pointerup", measureUp);
      };

      window.addEventListener("pointermove", measureMove);
      window.addEventListener("pointerup", measureUp);
      return;
    }

    // Connector tool is handled by data-connector-element-id click detection in SVG onPointerDown
    // above, so we skip it here to avoid conflicts
    if (activeTool === 'connector') {
      return;
    }

    if (!isPanning) {
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) return;

      const clientX = e.clientX - svgRect.left;
      const clientY = e.clientY - svgRect.top;
      const x = (clientX - panOffset.x) / zoom;
      const y = (clientY - panOffset.y) / zoom;

      // Set state
      setIsAreaSelecting(true);
      setSelectionStart({ x, y });
      setSelectionEnd({ x, y });

      if (!e.ctrlKey && !e.metaKey) {
        setSelectedElementIds([]);
        setSelectedElement?.(undefined);
      }

      // Create local flags for the event handlers
      const selectionData = { x, y };
      let isSelecting = true;

      // Create closures that use local variables instead of state
      const areaSelectionMove = (e: PointerEvent) => {
        if (!isSelecting || isPanning) {
          return;
        }

        const svgRect = svgRef.current?.getBoundingClientRect();
        if (!svgRect) return;

        const clientX = e.clientX - svgRect.left;
        const clientY = e.clientY - svgRect.top;
        const x = (clientX - panOffset.x) / zoom;
        const y = (clientY - panOffset.y) / zoom;
        
        // Store in both state and ref
        setSelectionEnd({ x, y });
        selectionEndRef.current = { x, y };
      };

      const areaSelectionUp = (e: PointerEvent) => {
        if (isPanning) return; // Don't process if we're panning

        const currentStart = selectionData;
        const currentEnd = selectionEndRef.current || selectionData; // Fallback to start if no movement
        
        const selRect = {
          x: Math.min(currentStart.x, currentEnd.x),
          y: Math.min(currentStart.y, currentEnd.y),
          width: Math.abs(currentEnd.x - currentStart.x),
          height: Math.abs(currentEnd.y - currentStart.y)
        };

        // Check if this was just a click (very small movement)
        const isClick = selRect.width < 5 && selRect.height < 5;

        if (isClick) {
          if (!e.ctrlKey && !e.metaKey) {
            selectionManager.clearSelection();
            setSelectedElement?.(undefined);
            setDraggingId(null);
          }
        } else {
          // Find all elements that intersect with the selection rectangle
          const elementsInSelection = elements.filter(el => isElementInSelection(el, selRect));
          const newSelectedIds = elementsInSelection.map(el => el.id);

          if (e.ctrlKey || e.metaKey) {
            // Add to existing selection
            const combinedSelection = [...new Set([...selectedElementIds, ...newSelectedIds])];
            selectionManager.selectElements(combinedSelection);
            if (combinedSelection.length === 1) {
              const selectedEl = elements.find(el => el.id === combinedSelection[0]);
              setSelectedElement?.(selectedEl);
            } else {
              setSelectedElement?.(undefined);
            }
          } else {
            // Replace selection
            selectionManager.selectElements(newSelectedIds);
            if (newSelectedIds.length === 1) {
              const selectedEl = elements.find(el => el.id === newSelectedIds[0]);
              setSelectedElement?.(selectedEl);
            } else {
              setSelectedElement?.(undefined);
            }
          }
        }

        // Clean up
        isSelecting = false;
        selectionEndRef.current = null;
        setIsAreaSelecting(false);
        setSelectionStart(null);
        setSelectionEnd(null);
        window.removeEventListener("pointermove", areaSelectionMove);
        window.removeEventListener("pointerup", areaSelectionUp);
      };

      // Add event listeners with the closure functions
      window.addEventListener("pointermove", areaSelectionMove);
      window.addEventListener("pointerup", areaSelectionUp);
    }
  }

  /**
   * Handles panning movement
   */
  function handlePanMove(e: PointerEvent) {
    if (!isPanning || !panStart) return;

    const deltaX = e.clientX - panStart.x;
    const deltaY = e.clientY - panStart.y;

    setPanOffset(prev => ({
      x: prev.x + deltaX,
      y: prev.y + deltaY
    }));

    setPanStart({ x: e.clientX, y: e.clientY });
  }

  /**
   * Handles panning end
   */
  function handlePanUp() {
    setIsPanning(false);
    setPanStart(null);
    window.removeEventListener("pointermove", handlePanMove);
    window.removeEventListener("pointerup", handlePanUp);
  }

  
  /**
   * Handles pointer move to update dragging elements.
   * @function
   * @param {PointerEvent} e - The pointer event.
   */
  function handlePointerMove(e: PointerEvent) {
    const currentDraggingId = draggingIdRef.current;
    if (!currentDraggingId) return;
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;

    // Add the pre-drag state to history only once when we start moving
    if (!hasPushedToHistory.current) {
      logger.info("DrawArea", "🎯 Drag started, adding pre-drag state to history", {
        draggedElementId: currentDraggingId,
        selectedCount: selectedElementIds.length
      });
      
      // Store the current state (before any changes) to history
      pushToHistoryAndSetElements(prev => prev);
      hasPushedToHistory.current = true;
    }

    // Calculate the new position for the dragged element
    const dx = (e.clientX - svgRect.left) / zoom - dragOffset.current.x;
    const dy = (e.clientY - svgRect.top) / zoom - dragOffset.current.y;
    
    // Get the initial position of the dragged element
    const initialDraggedPos = initialSelectedPositions.current.get(currentDraggingId);
    if (!initialDraggedPos) return;

    // Calculate the movement delta
    let deltaX = dx - initialDraggedPos.start.x;
    let deltaY = dy - initialDraggedPos.start.y;

    // Smart Tracks Snapping
    const draggedEl = elements.find(el => el.id === currentDraggingId);
    if (draggedEl?.isLineBased) {
      // Snap start point
      const targetStart = { x: initialDraggedPos.start.x + deltaX, y: initialDraggedPos.start.y + deltaY };
      const snappedStart = findSnapPoint(targetStart, elements, currentDraggingId);

      if (snappedStart.snapped) {
        deltaX = snappedStart.x - initialDraggedPos.start.x;
        deltaY = snappedStart.y - initialDraggedPos.start.y;
      } else {
        // Snap end point if start didn't snap
        const targetEnd = { x: initialDraggedPos.end.x + deltaX, y: initialDraggedPos.end.y + deltaY };
        const snappedEnd = findSnapPoint(targetEnd, elements, currentDraggingId);
        if (snappedEnd.snapped) {
          deltaX = snappedEnd.x - initialDraggedPos.end.x;
          deltaY = snappedEnd.y - initialDraggedPos.end.y;
        }
      }
    }

    // Connection Point Snapping (for all shapes)
    if (draggedEl) {
      const targetStart = { x: initialDraggedPos.start.x + deltaX, y: initialDraggedPos.start.y + deltaY };
      const snappedStart = snapToConnectionPoint(targetStart, elements, currentDraggingId);

      if (snappedStart.x !== targetStart.x || snappedStart.y !== targetStart.y) {
        // Snapped to a connection point
        deltaX = snappedStart.x - initialDraggedPos.start.x;
        deltaY = snappedStart.y - initialDraggedPos.start.y;
      }
    }

    // Detect alignment guides for auto-positioning
    const draggedElements = selectedElementIds
      .map(id => elements.find(el => el.id === id))
      .filter((el): el is DrawElement => el !== undefined);
    
    const guides = detectAlignmentGuides(draggedElements, elements);
    setAlignmentGuides({
      verticalLines: guides.verticalLines,
      horizontalLines: guides.horizontalLines,
    });

    // Auto-scroll the parent container when dragging near edges
    const scrollableParent = svgRef.current?.parentElement;
    if (scrollableParent) {
      const SCROLL_THRESHOLD = 60; // Distance from edge to trigger scrolling
      const rect = scrollableParent.getBoundingClientRect();

      // Calculate scroll velocity based on distance from edge (closer = faster)
      let scrollLeftDelta = 0;
      let scrollTopDelta = 0;

      // Horizontal scrolling
      if (e.clientX > rect.right - SCROLL_THRESHOLD) {
        // Near right edge
        const distFromEdge = rect.right - e.clientX;
        scrollLeftDelta = Math.max(5, 15 - distFromEdge);
      } else if (e.clientX < rect.left + SCROLL_THRESHOLD) {
        // Near left edge
        const distFromEdge = e.clientX - rect.left;
        scrollLeftDelta = -Math.max(5, 15 - distFromEdge);
      }

      // Vertical scrolling (independent of horizontal)
      if (e.clientY > rect.bottom - SCROLL_THRESHOLD) {
        // Near bottom edge
        const distFromEdge = rect.bottom - e.clientY;
        scrollTopDelta = Math.max(5, 15 - distFromEdge);
      } else if (e.clientY < rect.top + SCROLL_THRESHOLD) {
        // Near top edge
        const distFromEdge = e.clientY - rect.top;
        scrollTopDelta = -Math.max(5, 15 - distFromEdge);
      }

      // Apply scrolling
      if (scrollLeftDelta !== 0) {
        scrollableParent.scrollLeft += scrollLeftDelta;
      }
      if (scrollTopDelta !== 0) {
        scrollableParent.scrollTop += scrollTopDelta;
      }
    }

    // Detect shape overlap when dragging connector endpoint
    if (draggingConnectorRef.current && svgRect) {
      const connector = elements.find(el => el.id === draggingConnectorRef.current?.id);

      if (connector?.type === 'connector') {
        // Calculate current endpoint position in SVG coordinates
        const currentSVGX = (e.clientX - svgRect.left) / zoom;
        const currentSVGY = (e.clientY - svgRect.top) / zoom;
        const endpointPos = { x: currentSVGX, y: currentSVGY };

        console.log('🔍 Checking overlap at:', endpointPos);

        let overlappingShape: { shapeId: string; pointIndex: number } | null = null;

        for (const el of elements) {
          if (el.id === connector.id || el.type === 'connector' || el.dimensionality === '1D') continue;

          // Get shape bounds with margin for detection
          const OVERLAP_MARGIN = 20; // 20px margin for detection
          const minX = Math.min(el.start.x, el.end.x) - OVERLAP_MARGIN;
          const maxX = Math.max(el.start.x, el.end.x) + OVERLAP_MARGIN;
          const minY = Math.min(el.start.y, el.end.y) - OVERLAP_MARGIN;
          const maxY = Math.max(el.start.y, el.end.y) + OVERLAP_MARGIN;

          console.log(`  Shape ${el.id}: bounds [${minX},${maxX}]x[${minY},${maxY}], endpoint at [${endpointPos.x},${endpointPos.y}]`);

          // Check if endpoint is inside shape bounds (with margin)
          if (endpointPos.x >= minX && endpointPos.x <= maxX &&
              endpointPos.y >= minY && endpointPos.y <= maxY) {
            console.log(`    ✅ OVERLAP DETECTED with margin!`);
            // Find closest connection point on this shape
            const points = getConnectionPointsGrid(el);
            let closestIdx = 0;
            let minDist = Infinity;
            for (let i = 0; i < points.length; i++) {
              const dist = Math.hypot(points[i].x - endpointPos.x, points[i].y - endpointPos.y);
              if (dist < minDist) {
                minDist = dist;
                closestIdx = i;
              }
            }
            overlappingShape = { shapeId: el.id, pointIndex: closestIdx };
            console.log(`    Using connection point ${closestIdx}`);
            break;
          }
        }

        // Update target shape
        if (overlappingShape?.shapeId !== connectorDragTargetRef.current?.shapeId) {
          console.log('🎨 Target shape updated:', overlappingShape?.shapeId);
          connectorDragTargetRef.current = overlappingShape;
          setConnectorDragTargetShape(overlappingShape?.shapeId || null);
        }
      }
    }

    setElements(prev => {
      const updated = prev.map(el => {
        // Move all selected elements by the same delta
        if (selectedElementIds.includes(el.id)) {
          const initialPos = initialSelectedPositions.current.get(el.id);
          if (initialPos) {
            // Check if dragging specific endpoint of a connector
            const isDraggingConnectorEndpoint = draggingConnectorRef.current?.id === el.id;
            const draggingEndpoint = isDraggingConnectorEndpoint ? draggingConnectorRef.current.endpoint : null;

            // For connectors with attachment state, only move detached endpoints
            const isConnector = el.type === 'connector';
            const fromAttached = isConnector && el.fromAttached !== false;
            const toAttached = isConnector && el.toAttached !== false;

            // If dragging specific endpoint, only move that endpoint
            if (isDraggingConnectorEndpoint && draggingEndpoint) {
              let newStart = el.start;
              let newEnd = el.end;
              let newFromPointIndex = el.fromPointIndex;
              let newToPointIndex = el.toPointIndex;

              // Current mouse position in SVG space
              const currentSVGX = (e.clientX - svgRect.left) / zoom;
              const currentSVGY = (e.clientY - svgRect.top) / zoom;

              if (draggingEndpoint === 'start') {
                // Set endpoint directly to current mouse position
                newStart = {
                  x: currentSVGX,
                  y: currentSVGY
                };
                newFromPointIndex = undefined;

                // Snap to target shape if nearby
                if (connectorDragTargetRef.current) {
                  const targetShape = elements.find(s => s.id === connectorDragTargetRef.current?.shapeId);
                  if (targetShape) {
                    const points = getConnectionPointsGrid(targetShape);
                    const pointIndex = connectorDragTargetRef.current.pointIndex;
                    if (pointIndex >= 0 && pointIndex < points.length) {
                      newStart = points[pointIndex];
                      newFromPointIndex = pointIndex;
                    }
                  }
                }
              } else {
                // Set endpoint directly to current mouse position
                newEnd = {
                  x: currentSVGX,
                  y: currentSVGY
                };
                newToPointIndex = undefined;

                // Snap to target shape if nearby
                if (connectorDragTargetRef.current) {
                  const targetShape = elements.find(s => s.id === connectorDragTargetRef.current?.shapeId);
                  if (targetShape) {
                    const points = getConnectionPointsGrid(targetShape);
                    const pointIndex = connectorDragTargetRef.current.pointIndex;
                    if (pointIndex >= 0 && pointIndex < points.length) {
                      newEnd = points[pointIndex];
                      newToPointIndex = pointIndex;
                    }
                  }
                }
              }

              return {
                ...el,
                start: newStart,
                end: newEnd,
                fromPointIndex: newFromPointIndex,
                toPointIndex: newToPointIndex
              };
            }

            // For regular connector dragging (whole connector, not endpoint), move both
            return {
              ...el,
              start: {
                x: initialPos.start.x + deltaX,
                y: initialPos.start.y + deltaY
              },
              end: {
                x: initialPos.end.x + deltaX,
                y: initialPos.end.y + deltaY
              }
            };
          }
        }
        return el;
      });

      // Check if canvas needs to expand during drag
      checkAndExpandCanvas(updated);

      return updated;
    });
  }

  /**
   * Handles pointer up to end dragging.
   * @function
   */
  function handlePointerUp() {
    // Handle attaching connector to target shape if one was detected
    if (draggingConnectorRef.current && connectorDragTargetRef.current) {
      const connector = elements.find(el => el.id === draggingConnectorRef.current?.id);
      const targetShape = elements.find(el => el.id === connectorDragTargetRef.current?.shapeId);

      if (connector?.type === 'connector' && targetShape) {
        const endpoint = draggingConnectorRef.current.endpoint;
        const pointIndex = connectorDragTargetRef.current.pointIndex;

        pushToHistoryAndSetElements(prev => prev.map(el => {
          if (el.id === connector.id) {
            if (endpoint === 'start') {
              return {
                ...el,
                fromElementId: targetShape.id,
                fromAttached: true,
                fromPointIndex: pointIndex
              };
            } else {
              return {
                ...el,
                toElementId: targetShape.id,
                toAttached: true,
                toPointIndex: pointIndex
              };
            }
          }
          return el;
        }));
      }
    }

    // Clean up drag state - history was already handled in handlePointerMove
    if (draggingId) {
      logger.info("DrawArea", "🎯 Drag operation completed", {
        draggedElementId: draggingId,
        selectedCount: selectedElementIds.length,
        historyAlreadyUpdated: hasPushedToHistory.current
      });

      // Check if canvas needs to expand after drag
      checkAndExpandCanvas(elements);
    }

    setDraggingId(null);
    draggingConnectorRef.current = null; // Clear connector endpoint drag state
    connectorDragTargetRef.current = null; // Clear connector drag target
    setConnectorDragTargetShape(null);
    setHoveredConnectorEnd(null); // Clear hovered endpoint
    // Clear alignment guides
    setAlignmentGuides({ verticalLines: [], horizontalLines: [] });
    initialSelectedPositions.current.clear(); // Clear stored positions
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  }

  /**
   * Renders connection points on shapes - only shown when connector tool is active
   */
  function renderConnectionSuggestions() {
    // Only show suggestions when dragging a shape
    if (!draggingIdRef.current) return null;

    const PROXIMITY_THRESHOLD = 60; // Show suggestions within 60px
    const draggingElement = elements.find(el => el.id === draggingIdRef.current);

    if (!draggingElement) return null;

    const dragCenterX = (draggingElement.start.x + draggingElement.end.x) / 2;
    const dragCenterY = (draggingElement.start.y + draggingElement.end.y) / 2;

    const suggestionLines: JSX.Element[] = [];

    // Find nearby connection points and draw suggestion lines
    elements.forEach(el => {
      if (el.type === 'connector' || el.dimensionality === '1D' || el.id === draggingElement.id) return;

      const points = getConnectionPointsGrid(el);
      points.forEach((point) => {
        const distance = Math.hypot(point.x - dragCenterX, point.y - dragCenterY);
        if (distance < PROXIMITY_THRESHOLD) {
          suggestionLines.push(
            <line
              key={`suggestion-${draggingElement.id}-${el.id}-${point.x}-${point.y}`}
              x1={dragCenterX}
              y1={dragCenterY}
              x2={point.x}
              y2={point.y}
              stroke="#22c55e"
              strokeWidth={2}
              strokeDasharray="5,5"
              opacity={0.6}
              pointerEvents="none"
            />
          );
        }
      });
    });

    return <g className="connection-suggestions">{suggestionLines}</g>;
  }

  function renderConnectionPoints() {
    // Show connection points when using connector tool OR when dragging a shape
    const shouldShowConnectionPoints = activeTool === 'connector' || !!draggingIdRef.current;

    if (!shouldShowConnectionPoints) return null;

    const PROXIMITY_THRESHOLD = 60; // Show suggestions within 60px
    const draggingElement = draggingIdRef.current ? elements.find(el => el.id === draggingIdRef.current) : null;

    return (
      <g className="connection-points" pointerEvents="none">
        {elements.map(el => {
          if (el.type === 'connector' || el.dimensionality === '1D') return null;

          const points = getConnectionPointsGrid(el);

          // If dragging, check proximity to highlight suitable connection points
          let proximityPoints: Set<number> = new Set();
          if (draggingElement && draggingElement.id !== el.id) {
            const dragCenterX = (draggingElement.start.x + draggingElement.end.x) / 2;
            const dragCenterY = (draggingElement.start.y + draggingElement.end.y) / 2;

            points.forEach((point, idx) => {
              const distance = Math.hypot(point.x - dragCenterX, point.y - dragCenterY);
              if (distance < PROXIMITY_THRESHOLD) {
                proximityPoints.add(idx);
              }
            });
          }

          return (
            <g key={`conn-points-${el.id}`}>
              {points.map((point, idx) => {
                const isProximate = proximityPoints.has(idx);
                return (
                  <circle
                    key={`conn-point-${el.id}-${idx}`}
                    cx={point.x}
                    cy={point.y}
                    r={isProximate ? 5 : 3}
                    fill={isProximate ? "#22c55e" : "#6366f1"}
                    opacity={isProximate ? 0.8 : 0.5}
                    stroke={isProximate ? "#16a34a" : "#6366f1"}
                    strokeWidth={isProximate ? 2 : 1}
                  />
                );
              })}
            </g>
          );
        })}
      </g>
    );
  }

  /**
   * Renders the grid lines for the SVG area with major and minor grid lines.
   * @function
   * @returns {JSX.Element} The rendered grid with major (50x50, darker) and minor (10x10, lighter) lines.
   */
  function renderGrid() {
    const MINOR_GRID_SIZE = 10; // Lighter grid every 10px
    const MAJOR_GRID_SIZE = 50; // Darker grid every 50px
    
    return (
      <g>
        {/* Minor grid lines - horizontal (10px intervals) */}
        {Array.from({ length: Math.ceil(GRID_HEIGHT / MINOR_GRID_SIZE) }).map((_, i) => (
          <line
            key={`minor-h-${i}`}
            x1={0}
            y1={i * MINOR_GRID_SIZE}
            x2={GRID_WIDTH}
            y2={i * MINOR_GRID_SIZE}
            stroke="#f0f0f0"
            strokeWidth={0.5}
          />
        ))}
        {/* Minor grid lines - vertical (10px intervals) */}
        {Array.from({ length: Math.ceil(GRID_WIDTH / MINOR_GRID_SIZE) }).map((_, i) => (
          <line
            key={`minor-v-${i}`}
            x1={i * MINOR_GRID_SIZE}
            y1={0}
            x2={i * MINOR_GRID_SIZE}
            y2={GRID_HEIGHT}
            stroke="#f0f0f0"
            strokeWidth={0.5}
          />
        ))}
        {/* Major grid lines - horizontal (50px intervals) */}
        {Array.from({ length: Math.ceil(GRID_HEIGHT / MAJOR_GRID_SIZE) }).map((_, i) => (
          <line
            key={`major-h-${i}`}
            x1={0}
            y1={i * MAJOR_GRID_SIZE}
            x2={GRID_WIDTH}
            y2={i * MAJOR_GRID_SIZE}
            stroke="#d0d0d0"
            strokeWidth={1}
          />
        ))}
        {/* Major grid lines - vertical (50px intervals) */}
        {Array.from({ length: Math.ceil(GRID_WIDTH / MAJOR_GRID_SIZE) }).map((_, i) => (
          <line
            key={`major-v-${i}`}
            x1={i * MAJOR_GRID_SIZE}
            y1={0}
            x2={i * MAJOR_GRID_SIZE}
            y2={GRID_HEIGHT}
            stroke="#d0d0d0"
            strokeWidth={1}
          />
        ))}
      </g>
    );
  }

  /**
   * Handles drop event to create a new element at the drop position.
   * @function
   * @param {React.DragEvent<SVGSVGElement>} e - The drag event.
   */
  function handleDrop(e: React.DragEvent<SVGSVGElement>) {
    e.preventDefault();
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;
    const data = e.dataTransfer.getData("application/railway-item");
    if (!data) return;
    const item = JSON.parse(data);
    const x = (e.clientX - svgRect.left) / zoom;
    const y = (e.clientY - svgRect.top) / zoom;
    
    const currentTimestamp = Date.now();
    const dropOperation = {
      timestamp: currentTimestamp,
      itemType: item.type,
      x: Math.round(x),
      y: Math.round(y)
    };
    
    // Check if this is a duplicate drop operation (React StrictMode protection)
    if (lastDropRef.current && 
        Math.abs(currentTimestamp - lastDropRef.current.timestamp) < 100 && // Within 100ms
        dropOperation.itemType === lastDropRef.current.itemType &&
        Math.abs(dropOperation.x - lastDropRef.current.x) < 5 && // Within 5px
        Math.abs(dropOperation.y - lastDropRef.current.y) < 5) {
      return;
    }
    
    lastDropRef.current = dropOperation;
    
    // Create the element
    const newElement = createCenteredElement(item, x, y);
    
    logger.info("DrawArea", "🚀 CREATING NEW ELEMENT:", {
      elementId: newElement.id,
      elementType: newElement.type,
      hasShapeElements: !!newElement.shapeElements,
      shapeElementsCount: newElement.shapeElements?.length || 0,
      fullShapeElementsData: newElement.shapeElements ? {
        elementRef: newElement.shapeElements,
        elements: newElement.shapeElements.map((se, index) => ({
          index: index,
          id: se.id,
          svg: se.svg, // Full SVG content
          svgLength: se.svg.length,
          elementRef: se
        }))
      } : null
    });
    
    // Use pushToHistoryAndSetElements to ensure proper undo/redo tracking
    pushToHistoryAndSetElements(prev => {
      // Check if we've already processed this specific element ID (React StrictMode protection)
      if (processedElementIds.current.has(newElement.id)) {
        return prev;
      }
      
      // Mark this element as processed
      processedElementIds.current.add(newElement.id);
      
      // Clean up old processed IDs periodically to prevent memory leaks
      if (processedElementIds.current.size > 100) {
        processedElementIds.current.clear();
        processedElementIds.current.add(newElement.id);
      }
      
      const newElements = [...prev, newElement];
      
      // Check if canvas needs to expand
      checkAndExpandCanvas(newElements);
      
      return newElements;
    });
  }

  /**
   * Helper to create a new element centered at (x, y) based on item type.
   * @function
   * @param {any} item - The toolbox item data.
   * @param {number} x - X coordinate.
   * @param {number} y - Y coordinate.
   * @returns {DrawElement} The new element.
   */
  function createCenteredElement(item: unknown, x: number, y: number): DrawElement {
    const toolboxItem = item as ToolboxItem & {
      type?: string;
      iconName?: string;
      iconSource?: string;
      draw?: unknown;
      properties?: Record<string, {
        type: string;
        label?: string;
        default?: any;
        options?: string[];
      }>;
    };
    // Only apply default styles for elements that don't have their own styling
    // Custom elements with SVG shapes should preserve their original colors
    const hasCustomShape = toolboxItem.shape && toolboxItem.type === "custom";
    const hasShapeElements = toolboxItem.shapeElements && toolboxItem.shapeElements.length > 0;
    
    // Don't apply default styles to custom elements or elements with shapeElements
    const shouldApplyDefaultStyles = !hasCustomShape && !hasShapeElements;
    
    const defaultStyles = shouldApplyDefaultStyles ? {
      fill: "#3b82f6", // blue-500
      stroke: "#1e293b", // slate-800
      strokeWidth: 2,
      opacity: 1,
    } : undefined;

    logger.info("DrawArea", "🔧 Creating element from toolbox item:", {
      itemId: toolboxItem.id,
      itemName: toolboxItem.name,
      originalShapeElements: toolboxItem.shapeElements ? {
        count: toolboxItem.shapeElements.length,
        arrayReference: toolboxItem.shapeElements, // Log the actual reference
        elements: toolboxItem.shapeElements.map((el: unknown, index: number) => ({
          index: index,
          id: (el as Record<string, unknown>).id,
          svgLength: ((el as Record<string, unknown>).svg as string)?.length,
          svg: (el as Record<string, unknown>).svg, // Show full SVG content to see if they're identical
          elementReference: el // Log the actual element reference
        }))
      } : null
    });

    const baseElement = {
      id: `${toolboxItem.type || 'element'}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: toolboxItem.name,
      type: toolboxItem.type || 'unknown',
      layerId: activeLayerId,
      iconName: toolboxItem.iconName,
      iconSource: toolboxItem.iconSource,
      iconSvg: toolboxItem.iconSvg,
      draw: toolboxItem.draw,
      shape: toolboxItem.shape,
      shapeElements: toolboxItem.shapeElements ? (() => {
        // Deep copy and synchronize textRegions with SVG coordinates
        const copiedShapeElements = JSON.parse(JSON.stringify(toolboxItem.shapeElements));
        return copiedShapeElements.map((shapeElement: unknown) => {
          const element = shapeElement as Record<string, unknown>;
          if (element.textRegions && Array.isArray(element.textRegions) && element.textRegions.length > 0) {
            // Apply synchronization and expansion for text regions
            const expandedShapeElement = expandSVGRectForText(shapeElement as Parameters<typeof expandSVGRectForText>[0]);
            return synchronizeTextRegionsWithSVG(expandedShapeElement);
          }
          return shapeElement;
        });
      })() : undefined,
      width: toolboxItem.width,
      height: toolboxItem.height,
      rotation: 0,
      gridEnabled: showGrid,
      backgroundColor,
      setGridEnabled: setShowGrid,
      setBackgroundColor,
      // Transfer complex property from toolbox item to element
      complex: toolboxItem.complex,
      // Transfer dimensionality from toolbox item (2D or 1D)
      dimensionality: (toolboxItem as any).dimensionality || '2D',
      // Store element definition for properties panel
      elementDefinition: toolboxItem.properties ? { properties: toolboxItem.properties } : undefined,
      ...(defaultStyles && { styles: defaultStyles }),
    };
    
    // Initialize custom properties with their default values
    if (toolboxItem.properties) {
      Object.entries(toolboxItem.properties).forEach(([key, propDef]: [string, any]) => {
        if (propDef.default !== undefined) {
          (baseElement as any)[key] = propDef.default;
        }
      });
    }

    switch ((toolboxItem.draw as Record<string, unknown>)?.type) {
      case "line": {
        let lineElement: DrawElement = {
          ...baseElement,
          start: { x: x - toolboxItem.width / 2, y },
          end: { x: x + toolboxItem.width / 2, y },
        };
        if (lineElement.shapeElements) {
          lineElement = syncTextRegionsWithSVG(lineElement);
        }
        return lineElement;
      }
      case "lines": {
        let linesElement: DrawElement = {
          ...baseElement,
          start: { x: x - toolboxItem.width / 2, y: y - toolboxItem.height / 2 },
          end: { x: x + toolboxItem.width / 2, y: y + toolboxItem.height / 2 },
        };
        if (linesElement.shapeElements) {
          linesElement = syncTextRegionsWithSVG(linesElement);
        }
        return linesElement;
      }
      case "icon": {
        let iconElement: DrawElement = {
          ...baseElement,
          start: { x: x - toolboxItem.width / 2, y: y - toolboxItem.height / 2 },
          end: { x: x + toolboxItem.width / 2, y: y + toolboxItem.height / 2 },
        };
        if (iconElement.shapeElements) {
          iconElement = syncTextRegionsWithSVG(iconElement);
        }
        return iconElement;
      }
      case "text": {
        let textElement: DrawElement = {
          ...baseElement,
          start: { x: x, y: y - toolboxItem.height },
          end: { x: x + toolboxItem.width, y: y + toolboxItem.height },
        };
        if (textElement.shapeElements) {
          textElement = syncTextRegionsWithSVG(textElement);
        }
        return textElement;
      }
      default: {
        let newElement: DrawElement = {
          ...baseElement,
          start: { x: x, y: y },
          end: { x: x + toolboxItem.width, y: y + toolboxItem.height },
        };
        
        // Apply synchronization for unified elements (like UML classes)
        if (newElement.unified && newElement.shapeElements) {
          newElement = syncUnifiedElement(newElement);
        }
        
        // Apply general textRegion synchronization
        if (newElement.shapeElements) {
          newElement = syncTextRegionsWithSVG(newElement);
        }
        
        return newElement;
      }
    }
  }

  /** @brief Main SVG render with all interactive features */
  return (
    <>
    <svg
      ref={svgRef}
      className="draw-area"
      data-testid="draw-area"
      width={GRID_WIDTH * zoom}
      height={GRID_HEIGHT * zoom}
      style={{
        background: backgroundColor,
        minWidth: GRID_WIDTH * zoom,
        minHeight: GRID_HEIGHT * zoom,
        display: "block",
        cursor: isPanning ? 'grabbing' : brushMode ? 'crosshair' : activeTool === 'connector' ? 'crosshair' : 'default'
      }}
      tabIndex={0}
      onPointerDown={(e) => {
        svgRef.current?.focus();

        // Check if click was on a connection point
        const target = e.target as SVGElement;
        if (target.getAttribute && target.getAttribute('data-connector-element-id')) {
          const elementId = target.getAttribute('data-connector-element-id');
          const x = parseFloat(target.getAttribute('data-connector-x') || '0');
          const y = parseFloat(target.getAttribute('data-connector-y') || '0');
          console.log('🎯 Connection point clicked!', { elementId, x, y });
          handleConnectorStart(elementId || '', { x, y });
          return;
        }

        if (brushMode) {
          handleBrushStart(e);
        } else if (activeTool === 'connector') {
          // Allow free connector drawing from any point
          const svg = svgRef.current;
          if (!svg) return;

          const rect = svg.getBoundingClientRect();
          const x = (e.clientX - rect.left - panOffset.x) / zoom;
          const y = (e.clientY - rect.top - panOffset.y) / zoom;

          console.log('🎯 Connector started at free point:', { x, y });
          handleConnectorStart('', { x, y }); // Empty elementId means free start
          return;
        } else {
          handleSvgPointerDown(e);
        }
      }}
      onPointerMove={brushMode ? handleBrushMove : undefined}
      onPointerUp={brushMode ? handleBrushEnd : undefined}
      onContextMenu={handleContextMenu}
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Main drawing transform group - handles pan and zoom */}
      <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoom})`}>
        {/* Page boundaries - A4 page grid */}
        {(() => {
          const A4_WIDTH = 794;
          const A4_HEIGHT = 1123;
          
          // Only show page guides if there are elements that extend beyond the first page
          let maxX = A4_WIDTH;
          let maxY = A4_HEIGHT;
          
          elements.forEach(el => {
            const endX = Math.max(el.start.x, el.end?.x || el.start.x);
            const endY = Math.max(el.start.y, el.end?.y || el.start.y);
            const elementMaxX = endX + (el.width || 0);
            const elementMaxY = endY + (el.height || 0);
            
            maxX = Math.max(maxX, elementMaxX);
            maxY = Math.max(maxY, elementMaxY);
          });
          
          const pagesWide = Math.ceil(maxX / A4_WIDTH);
          const pagesTall = Math.ceil(maxY / A4_HEIGHT);
          const pageGuides = [];
          
          // Only show page guides if we have more than one page
          if (pagesWide > 1 || pagesTall > 1) {
            // Vertical page boundaries
            for (let i = 1; i < pagesWide; i++) {
              pageGuides.push(
                <line
                  key={`page-v-${i}`}
                  x1={i * A4_WIDTH}
                  y1={0}
                  x2={i * A4_WIDTH}
                  y2={GRID_HEIGHT}
                  stroke="#3b82f6"
                  strokeWidth={2 / zoom}
                  strokeDasharray={`${10 / zoom} ${5 / zoom}`}
                  opacity={0.3}
                />
              );
            }
            
            // Horizontal page boundaries
            for (let i = 1; i < pagesTall; i++) {
              pageGuides.push(
                <line
                  key={`page-h-${i}`}
                  x1={0}
                  y1={i * A4_HEIGHT}
                  x2={GRID_WIDTH}
                  y2={i * A4_HEIGHT}
                  stroke="#3b82f6"
                  strokeWidth={2 / zoom}
                  strokeDasharray={`${10 / zoom} ${5 / zoom}`}
                  opacity={0.3}
                />
              );
            }
          }
          
          return <g className="page-guides">{pageGuides}</g>;
        })()}
        
        {/* Grid lines */}
        {showGrid && renderGrid()}

        {/* Connection points for connector tool */}
        {renderConnectionSuggestions()}
        {renderConnectionPoints()}

        {/* Alignment guides for auto-positioning */}
        <g className="alignment-guides" pointerEvents="none">
          {/* Vertical alignment guides */}
          {alignmentGuides.verticalLines.map((x, idx) => (
            <line
              key={`align-v-${idx}`}
              x1={x}
              y1={0}
              x2={x}
              y2={GRID_HEIGHT}
              stroke="#f59e0b"
              strokeWidth={1 / zoom}
              strokeDasharray={`${4 / zoom},${4 / zoom}`}
              opacity={0.6}
            />
          ))}
          {/* Horizontal alignment guides */}
          {alignmentGuides.horizontalLines.map((y, idx) => (
            <line
              key={`align-h-${idx}`}
              x1={0}
              y1={y}
              x2={GRID_WIDTH}
              y2={y}
              stroke="#f59e0b"
              strokeWidth={1 / zoom}
              strokeDasharray={`${4 / zoom},${4 / zoom}`}
              opacity={0.6}
            />
          ))}
        </g>
        
        {/* Render all drawing elements */}
        {elements.map(el => {
          // Layer visibility check
          const elementLayer = layers.find(l => l.id === (el.layerId || 'default'));
          if (elementLayer && !elementLayer.visible) return null;

          return (
            <RenderElement
              key={el.id}
              el={el}
              isSelected={selectedElementIds.includes(el.id)}
              hoveredElementId={hoveredElementId}
              setHoveredElementId={setHoveredElementId}
              allElements={elements}
              startEditingWithChar={selectedElementIds.includes(el.id) ? editingStartChar : undefined}
              updateElement={updated => {
                // Layer lock check
                if (elementLayer?.locked) {
                  logger.warn("DrawArea", "Attempted to update element on locked layer", { layerId: elementLayer.id });
                  return;
                }

                // Use pushToHistoryAndSetElements for property changes to enable undo
                logger.info("DrawArea", "🔧 Element property updated", {
                  elementId: updated.id,
                  elementType: updated.type
                });
                pushToHistoryAndSetElements(prev => prev.map(e => e.id === updated.id ? updated : e));
              }}
              handlePointerDown={(e, element) => {
                // Layer lock check for pointer down
                if (elementLayer?.locked) {
                  return;
                }
                handlePointerDown(e, element || el);
              }}
              onContextMenu={(e) => {
                if (elementLayer?.locked) return;
                handleContextMenu(e, el.id);
              }}
              onConnectorStart={handleConnectorStart}
              targetConnectorShapeId={targetShapeForConnector}
            />
          );
        })}
        
        {/* Invisible bounding rectangles for easier selection of selected elements */}
        {elements.map(el => {
          if (!selectedElementIds.includes(el.id)) return null;
          
          // Layer visibility check
          const elementLayer = layers.find(l => l.id === (el.layerId || 'default'));
          if (elementLayer && (!elementLayer.visible || elementLayer.locked)) return null;

          if (el.rotation) {
            // For rotated elements, calculate axis-aligned bounds that encompass the rotated element
            const rotatedRect = getRotatedBoundingRect(el);
            const corners = [
              rotatedRect.topLeft,
              rotatedRect.topRight,
              rotatedRect.bottomLeft,
              rotatedRect.bottomRight
            ];
            
            const minX = Math.min(...corners.map(c => c.x));
            const minY = Math.min(...corners.map(c => c.y));
            const maxX = Math.max(...corners.map(c => c.x));
            const maxY = Math.max(...corners.map(c => c.y));
            
            return (
              <rect
                key={`bounding-${el.id}`}
                x={minX - 5} // Add 5px padding for easier clicking
                y={minY - 5}
                width={maxX - minX + 10}
                height={maxY - minY + 10}
                fill="transparent"
                stroke="none"
                style={{ cursor: 'move' }}
                onPointerDown={(e) => handlePointerDown(e, el)}
                onContextMenu={(e) => {
                  if (elementLayer?.locked) return;
                  handleContextMenu(e, el.id);
                }}
              />
            );
          } else {
            // For non-rotated elements, use the original approach
            const left = Math.min(el.start.x, el.end.x);
            const top = Math.min(el.start.y, el.end.y);
            const width = Math.abs(el.end.x - el.start.x);
            const height = Math.abs(el.end.y - el.start.y);
            
            return (
              <rect
                key={`bounding-${el.id}`}
                x={left - 5} // Add 5px padding for easier clicking
                y={top - 5}
                width={width + 10}
                height={height + 10}
                fill="transparent"
                stroke="none"
                style={{ cursor: 'move' }}
                onPointerDown={(e) => handlePointerDown(e, el)}
                onContextMenu={(e) => {
                  if (elementLayer?.locked) return;
                  handleContextMenu(e, el.id);
                }}
              />
            );
          }
        })}
        
        {/* Visual selection outline rectangles - exactly at shape edges */}
        {elements.map(el => {
          if (!selectedElementIds.includes(el.id)) return null;

          // Layer visibility check
          const elementLayer = layers.find(l => l.id === (el.layerId || 'default'));
          if (elementLayer && !elementLayer.visible) return null;

          if (el.rotation) {
            // For rotated elements, use a polygon at exact shape edges
            const rotatedRect = getRotatedBoundingRect(el);
            const points = [
              rotatedRect.topLeft,
              rotatedRect.topRight,
              rotatedRect.bottomRight,
              rotatedRect.bottomLeft
            ];

            const pointsStr = points.map(p => `${p.x},${p.y}`).join(' ');

            return (
              <polygon
                key={`selection-outline-${el.id}`}
                points={pointsStr}
                fill="none"
                stroke="rgba(0, 123, 255, 0.8)"
                strokeWidth={1 / zoom}
                pointerEvents="none"
              />
            );
          } else {
            // For non-rotated elements, use the rect approach
            const left = Math.min(el.start.x, el.end.x);
            const top = Math.min(el.start.y, el.end.y);
            const width = Math.abs(el.end.x - el.start.x);
            const height = Math.abs(el.end.y - el.start.y);

            // For line-based elements (1D), show selection border as thicker line
            if (el.isLineBased || el.dimensionality === '1D') {
              return (
                <line
                  key={`selection-outline-${el.id}`}
                  x1={el.start.x}
                  y1={el.start.y}
                  x2={el.end.x}
                  y2={el.end.y}
                  stroke="rgba(0, 123, 255, 0.8)"
                  strokeWidth={8 / zoom}
                  strokeLinecap="round"
                  pointerEvents="none"
                />
              );
            }

            // Try to get actual visual bounds based on SVG content
            let actualBounds = { left, top, width, height };

            if (el.type === 'custom' && el.shapeElements && el.shapeElements.length > 0) {
              try {
                // Calculate bounds from all shape elements
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                let foundBounds = false;

                el.shapeElements.forEach(elem => {
                  if (elem.svg) {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(`<svg>${elem.svg}</svg>`, 'image/svg+xml');
                    const svgElems = doc.querySelectorAll('rect, circle, ellipse, line, polygon, path');

                    svgElems.forEach(el => {
                      const tag = el.tagName.toLowerCase();
                      let x = 0, y = 0, w = 0, h = 0;

                      if (tag === 'rect') {
                        x = parseFloat(el.getAttribute('x') || '0');
                        y = parseFloat(el.getAttribute('y') || '0');
                        w = parseFloat(el.getAttribute('width') || '0');
                        h = parseFloat(el.getAttribute('height') || '0');
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x + w);
                        maxY = Math.max(maxY, y + h);
                        foundBounds = true;
                      } else if (tag === 'circle') {
                        const cx = parseFloat(el.getAttribute('cx') || '0');
                        const cy = parseFloat(el.getAttribute('cy') || '0');
                        const r = parseFloat(el.getAttribute('r') || '0');
                        minX = Math.min(minX, cx - r);
                        minY = Math.min(minY, cy - r);
                        maxX = Math.max(maxX, cx + r);
                        maxY = Math.max(maxY, cy + r);
                        foundBounds = true;
                      } else if (tag === 'ellipse') {
                        const cx = parseFloat(el.getAttribute('cx') || '0');
                        const cy = parseFloat(el.getAttribute('cy') || '0');
                        const rx = parseFloat(el.getAttribute('rx') || '0');
                        const ry = parseFloat(el.getAttribute('ry') || '0');
                        minX = Math.min(minX, cx - rx);
                        minY = Math.min(minY, cy - ry);
                        maxX = Math.max(maxX, cx + rx);
                        maxY = Math.max(maxY, cy + ry);
                        foundBounds = true;
                      } else if (tag === 'polygon') {
                        const points = el.getAttribute('points') || '';
                        const coords = points.split(/[\s,]+/).filter(p => p).map(parseFloat);
                        for (let i = 0; i < coords.length; i += 2) {
                          minX = Math.min(minX, coords[i]);
                          maxX = Math.max(maxX, coords[i]);
                          minY = Math.min(minY, coords[i + 1]);
                          maxY = Math.max(maxY, coords[i + 1]);
                          foundBounds = true;
                        }
                      } else if (tag === 'line') {
                        const x1 = parseFloat(el.getAttribute('x1') || '0');
                        const y1 = parseFloat(el.getAttribute('y1') || '0');
                        const x2 = parseFloat(el.getAttribute('x2') || '0');
                        const y2 = parseFloat(el.getAttribute('y2') || '0');
                        minX = Math.min(minX, x1, x2);
                        maxX = Math.max(maxX, x1, x2);
                        minY = Math.min(minY, y1, y2);
                        maxY = Math.max(maxY, y1, y2);
                        foundBounds = true;
                      }
                    });
                  }
                });

                if (foundBounds && minX !== Infinity && maxX > minX && maxY > minY) {
                  // Scale the SVG bounds to match the current canvas size
                  const svgWidth = el.width || 48;
                  const svgHeight = el.height || 48;
                  const scaleX = width / svgWidth;
                  const scaleY = height / svgHeight;

                  actualBounds = {
                    left: left + (minX * scaleX),
                    top: top + (minY * scaleY),
                    width: (maxX - minX) * scaleX,
                    height: (maxY - minY) * scaleY
                  };
                }
              } catch (e) {
                // If bounds calculation fails, fall back to basic bounds
              }
            }

            return (
              <rect
                key={`selection-outline-${el.id}`}
                x={actualBounds.left}
                y={actualBounds.top}
                width={actualBounds.width}
                height={actualBounds.height}
                fill="none"
                stroke="rgba(0, 123, 255, 0.8)"
                strokeWidth={1 / zoom}
                pointerEvents="none"
              />
            );
          }
        })}

        {/* Connector drag target highlight */}
        {connectorDragTargetShape && (() => {
          const targetEl = elements.find(el => el.id === connectorDragTargetShape);
          if (!targetEl || targetEl.dimensionality === '1D') return null;

          const left = Math.min(targetEl.start.x, targetEl.end.x);
          const top = Math.min(targetEl.start.y, targetEl.end.y);
          const width = Math.abs(targetEl.end.x - targetEl.start.x);
          const height = Math.abs(targetEl.end.y - targetEl.start.y);

          return (
            <>
              <rect
                key={`connector-drag-target-${connectorDragTargetShape}`}
                x={left - 3}
                y={top - 3}
                width={width + 6}
                height={height + 6}
                fill="none"
                stroke="#22c55e"
                strokeWidth={2 / zoom}
                pointerEvents="none"
              />
              {/* Highlight connection points on target shape */}
              {(() => {
                const points = getConnectionPointsGrid(targetEl);
                return (
                  <g>
                    {points.map((point, idx) => (
                      <circle
                        key={`target-conn-point-${connectorDragTargetShape}-${idx}`}
                        cx={point.x}
                        cy={point.y}
                        r={5}
                        fill="#22c55e"
                        opacity={0.7}
                        pointerEvents="none"
                      />
                    ))}
                  </g>
                );
              })()}
            </>
          );
        })()}

        {/* Area selection rectangle */}
        {renderSelectionRectangle()}

        {/* Measurement tool guide */}
        {renderMeasurementGuide()}

        {/* Connector Preview Line (while dragging) */}
        {connectorStartPoint && connectorPreview && (() => {
          const dx = connectorPreview.x - connectorStartPoint.point.x;
          const dy = connectorPreview.y - connectorStartPoint.point.y;
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);

          return (
            <g>
              {/* Line from start to mouse */}
              <line
                x1={connectorStartPoint.point.x}
                y1={connectorStartPoint.point.y}
                x2={connectorPreview.x}
                y2={connectorPreview.y}
                stroke="#0066ff"
                strokeWidth={2}
                strokeDasharray="5,5"
                opacity={0.6}
                pointerEvents="none"
              />

              {/* Arrow pointing toward mouse */}
              <g transform={`translate(${connectorPreview.x}, ${connectorPreview.y}) rotate(${angle + 180})`}>
                <path
                  d="M 0 0 L 8 -4 L 8 4 Z"
                  fill="#0066ff"
                  opacity={0.8}
                  pointerEvents="none"
                />
              </g>
            </g>
          );
        })()}

        {/* Connectors - Always receives latest elements array so recalculates on any change */}
        {(() => {
          const connectorElements = elements.filter(el => el.type === 'connector');
          const selectedConnectorId = connectorElements.find(c => selectedElementIds.includes(c.id))?.id;
          return (
            <ConnectorRenderer
              connectors={connectorElements}
              selectedConnectorId={selectedConnectorId}
              hoveredConnectorEnd={hoveredConnectorEnd}
              onEndpointHover={(connectorId, endpoint) => {
                if (connectorId && endpoint) {
                  setHoveredConnectorEnd({ connectorId, endpoint });
                } else {
                  setHoveredConnectorEnd(null);
                }
              }}
              onEndpointPointerDown={(connectorId, endpoint, clickPosScreen) => {
                const connector = elements.find(el => el.id === connectorId);
                if (!connector) return;

                setSelectedElementIds([connectorId]);
                setSelectedElement?.(connector);

                const svgRect = svgRef.current?.getBoundingClientRect();
                if (!svgRect) return;

                // Convert screen coordinates to SVG coordinates
                const clickSvgX = (clickPosScreen.x - panOffset.x) / zoom;
                const clickSvgY = (clickPosScreen.y - panOffset.y) / zoom;

                // Set up endpoint drag
                draggingConnectorRef.current = { id: connectorId, endpoint };
                setHoveredConnectorEnd({ connectorId, endpoint });

                setDraggingId(connectorId);
                hasPushedToHistory.current = false;

                // Store initial position
                initialSelectedPositions.current.clear();
                initialSelectedPositions.current.set(connectorId, {
                  start: { ...connector.start },
                  end: { ...connector.end }
                });

                // Set drag offset
                dragOffset.current = {
                  x: clickSvgX,
                  y: clickSvgY
                };

                // Add event listeners
                window.addEventListener("pointermove", handlePointerMove);
                window.addEventListener("pointerup", handlePointerUp);
              }}
              onConnectorClick={(connectorId, clickPosScreen) => {
                const connector = elements.find(el => el.id === connectorId);
                setSelectedElementIds([connectorId]);
                setSelectedElement?.(connector);

                const svgRect = svgRef.current?.getBoundingClientRect();
                if (!svgRect) return;

                // Convert SVG coords to client space for dragOffset calculation
                // clickPosScreen is already in client space (from ConnectorRenderer)
                const clickX = clickPosScreen.x;
                const clickY = clickPosScreen.y;

                // Convert to SVG space for distance calculations
                const clickSvgX = (clickX - panOffset.x) / zoom;
                const clickSvgY = (clickY - panOffset.y) / zoom;
                const clickSvgPos = { x: clickSvgX, y: clickSvgY };

                // Determine which endpoint is closer to the click
                if (connector?.type === 'connector') {
                  const distToStart = Math.hypot(clickSvgPos.x - connector.start.x, clickSvgPos.y - connector.start.y);
                  const distToEnd = Math.hypot(clickSvgPos.x - connector.end.x, clickSvgPos.y - connector.end.y);
                  const lineLength = Math.hypot(connector.end.x - connector.start.x, connector.end.y - connector.start.y);
                  const threshold = lineLength / 2;

                  // Determine which endpoint to move
                  if (distToStart < threshold) {
                    draggingConnectorRef.current = { id: connectorId, endpoint: 'start' };
                    setHoveredConnectorEnd({ connectorId, endpoint: 'start' });
                    logger.debug('DrawArea', 'Connector endpoint detected: start', { distToStart, threshold });
                  } else if (distToEnd < threshold) {
                    draggingConnectorRef.current = { id: connectorId, endpoint: 'end' };
                    setHoveredConnectorEnd({ connectorId, endpoint: 'end' });
                    logger.debug('DrawArea', 'Connector endpoint detected: end', { distToEnd, threshold });
                  } else {
                    // Middle of line - move whole connector
                    draggingConnectorRef.current = null;
                    setHoveredConnectorEnd({ connectorId, endpoint: 'start' }); // Highlight start endpoint for feedback
                    logger.debug('DrawArea', 'Connector middle clicked - highlighting start endpoint', { distToStart, distToEnd });
                  }

                  // Set up dragging (similar to handlePointerDown)
                  setDraggingId(connectorId);
                  hasPushedToHistory.current = false;

                  // Store initial position
                  initialSelectedPositions.current.clear();
                  initialSelectedPositions.current.set(connectorId, {
                    start: { ...connector.start },
                    end: { ...connector.end }
                  });

                  // Calculate drag offset in client space (same as handlePointerDown for shapes)
                  // offset = click client pos - element start in SVG space converted back to client space
                  dragOffset.current = {
                    x: clickX - (svgRect.left + panOffset.x + connector.start.x * zoom),
                    y: clickY - (svgRect.top + panOffset.y + connector.start.y * zoom)
                  };

                  // Add event listeners
                  window.addEventListener("pointermove", handlePointerMove);
                  window.addEventListener("pointerup", handlePointerUp);
                }
              }}
              onEndpointDoubleClick={(connectorId, endpoint) => {
                const connector = elements.find(el => el.id === connectorId);
                if (!connector) return;

                const isStart = endpoint === 'start';
                const elementId = isStart ? connector.fromElementId : connector.toElementId;
                const isAttached = isStart ? connector.fromAttached : connector.toAttached;

                if (isAttached && elementId) {
                  // Detach the endpoint
                  pushToHistoryAndSetElements(prev => prev.map(el => {
                    if (el.id === connectorId) {
                      if (isStart) {
                        return {
                          ...el,
                          fromElementId: undefined,
                          fromAttached: false,
                          fromPointIndex: undefined
                        };
                      } else {
                        return {
                          ...el,
                          toElementId: undefined,
                          toAttached: false,
                          toPointIndex: undefined
                        };
                      }
                    }
                    return el;
                  }));
                }
              }}
              allElements={elements}
              zoom={zoom}
            />
          );
        })()}

        {/* Brush Strokes */}
        <g className="brush-strokes">
          {brushStrokes.map(stroke => {
            const pathData = stroke.points
              .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
              .join(' ');

            return (
              <path
                key={stroke.id}
                d={pathData}
                stroke={stroke.config.color}
                strokeWidth={stroke.config.size}
                opacity={stroke.config.opacity}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ pointerEvents: 'none' }}
              />
            );
          })}

          {/* Current stroke being drawn */}
          {isDrawing && currentStroke.length > 1 && (
            <path
              d={currentStroke
                .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
                .join(' ')}
              stroke={brushConfig?.color || '#000000'}
              strokeWidth={brushConfig?.size || 2}
              opacity={brushConfig?.opacity || 1}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ pointerEvents: 'none' }}
            />
          )}
        </g>
      </g>
    </svg>

    {/* Quick-Connect Menu */}
    {quickConnectMenu && quickConnectMenu.visible && (
      <div
        style={{
          position: 'fixed',
          left: quickConnectMenu.x + 10,
          top: quickConnectMenu.y + 10,
          zIndex: 10000,
          background: 'white',
          border: '1px solid #ddd',
          borderRadius: '4px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          minWidth: '120px'
        }}
      >
        {[
          { type: 'rectangle', label: 'Rectangle', icon: '▭' },
          { type: 'circle', label: 'Circle', icon: '●' },
          { type: 'triangle', label: 'Triangle', icon: '▲' },
        ].map(shape => (
          <button
            key={shape.type}
            onClick={() => {
              // Create new shape connected to source
              const sourceEl = elements.find(el => el.id === quickConnectMenu.sourceElementId);
              if (!sourceEl) return;

              // Calculate position for new shape (to the right)
              const newX = sourceEl.end.x + 100;
              const newY = sourceEl.start.y;

              const newElement: DrawElement = {
                id: `${shape.type}-${Date.now()}`,
                type: shape.type as any,
                start: { x: newX, y: newY },
                end: { x: newX + 100, y: newY + 80 },
                style: {},
                name: shape.label
              };

              // Add element to canvas
              pushToHistoryAndSetElements(prev => [...prev, newElement]);

              // Create connector from source to new shape as a DrawElement
              const newConnectorElement: DrawElement = {
                id: `connector-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                type: 'connector',
                start: {
                  x: sourceEl.end.x,
                  y: (sourceEl.start.y + sourceEl.end.y) / 2
                },
                end: {
                  x: newX,
                  y: (newY + newY + 80) / 2
                },
                fromElementId: quickConnectMenu.sourceElementId,
                toElementId: newElement.id,
                connectorStyle: {
                  lineWidth: 2,
                  color: '#000000',
                  lineStyle: 'solid',
                  opacity: 1,
                  startArrow: 'none',
                  endArrow: 'standard'
                }
              };

              // Add connector and new element to elements array
              pushToHistoryAndSetElements(prev => [...prev, newElement, newConnectorElement]);
              setQuickConnectMenu(null);
              logger.info('interaction', 'Quick-connect shape created', {
                shapeType: shape.type,
                connectedTo: quickConnectMenu.sourceElementId
              });
            }}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 12px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '13px',
              color: '#333',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <span style={{ marginRight: '8px' }}>{shape.icon}</span>
            {shape.label}
          </button>
        ))}
      </div>
    )}

    {/* Context Menu */}
    {contextMenu && (
      <div
        style={{
          position: 'fixed',
          left: contextMenu.x,
          top: contextMenu.y,
          zIndex: 10000,
        }}
        className="bg-white rounded-lg shadow-2xl border border-slate-200 py-1 min-w-[160px]"
        onContextMenu={(e) => e.preventDefault()}
      >
        {contextMenu.type === 'element' && contextMenu.elementId && (
          <>
            <button
              onClick={() => handleCut(contextMenu.elementId!)}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
            >
              <span>✂️</span> Cut
            </button>
            <button
              onClick={() => handleCopy(contextMenu.elementId!)}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
            >
              <span>📋</span> Copy
            </button>
            <div className="border-t border-slate-200 my-1" />
            <button
              onClick={() => handleDelete(contextMenu.elementId!)}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <span>🗑️</span> Delete
            </button>
            <div className="border-t border-slate-200 my-1" />
            <button
              onClick={() => handleSendToFront(contextMenu.elementId!)}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
            >
              <span>⬆️</span> Send to Front
            </button>
            <button
              onClick={() => handleSendToBack(contextMenu.elementId!)}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
            >
              <span>⬇️</span> Send to Back
            </button>
          </>
        )}
        {contextMenu.type === 'selection' && (
          <>
            <button
              onClick={handleCutSelection}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
            >
              <span>✂️</span> Cut
            </button>
            <button
              onClick={handleCopySelection}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
            >
              <span>📋</span> Copy
            </button>
            <div className="border-t border-slate-200 my-1" />
            <button
              onClick={handleDeleteSelection}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <span>🗑️</span> Delete
            </button>
            <div className="border-t border-slate-200 my-1" />
            <button
              onClick={handleSendSelectionToFront}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
            >
              <span>⬆️</span> Send to Front
            </button>
            <button
              onClick={handleSendSelectionToBack}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
            >
              <span>⬇️</span> Send to Back
            </button>
          </>
        )}
        {contextMenu.type === 'canvas' && (
          <button
            onClick={() => {
              handlePasteFromContextMenu();
            }}
            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
          >
            <span>📋</span> Paste
          </button>
        )}
        {(contextMenu.type === 'element' || contextMenu.type === 'selection') && (
          <>
            {((contextMenu.type === 'element' && contextMenu.elementId) || contextMenu.type === 'selection') && (
              <div className="border-t border-slate-200 my-1" />
            )}
            <button
              onClick={groupSelectedElements}
              disabled={!selectionCanGroup}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 disabled:opacity-40"
            >
              <span>🧩</span> Group Selection
            </button>
            <button
              onClick={ungroupSelectedElements}
              disabled={!selectionCanUngroup}
              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 disabled:opacity-40"
            >
              <span>🧵</span> Ungroup Selection
            </button>
          </>
        )}
      </div>
    )}
    </>
  );
});

DrawArea.displayName = 'DrawArea';

export default DrawArea;