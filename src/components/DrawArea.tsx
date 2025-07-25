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

import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { RenderElement, getRotatedBoundingRect } from "./Elements";
import type { DrawElement } from "./Elements";

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
  /** @brief Gets copied elements */
  getCopiedElements: () => DrawElement[];
  /** @brief Sets copied elements */
  setCopiedElements: (elements: DrawElement[]) => void;
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
  disableKeyboardHandlers = false,
}, ref) => {
  /** @brief Internal drawing elements state */
  const [elements, setElements] = useState<DrawElement[]>([]);
  
  // Debug: Track when elements actually change
  useEffect(() => {
    console.log("🔥 ELEMENTS STATE:", {
      count: elements.length,
      elementIds: elements.map(el => el.id)
    });
  }, [elements]);
  /** @brief IDs of currently selected elements */
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
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
  /** @brief Undo/redo history stack */
  const [, setHistory] = useState<DrawElement[][]>([]);
  /** @brief Reference to the SVG element */
  const svgRef = useRef<SVGSVGElement | null>(null);
  /** @brief Flag to prevent duplicate history entries */
  const hasPushedToHistory = useRef(false);

  /** @brief Area selection state */
  const [isAreaSelecting, setIsAreaSelecting] = useState(false);
  /** @brief Start position of area selection */
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  /** @brief End position of area selection */
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null);
  /** @brief Ref for selection end position to avoid stale closures */
  const selectionEndRef = useRef<{ x: number; y: number } | null>(null);

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
  /** @brief Ref to track the last drop operation to prevent React StrictMode duplicates */
  const lastDropRef = useRef<{ timestamp: number; itemType: string; x: number; y: number } | null>(null);
  /** @brief Ref to track processed element IDs to prevent React StrictMode duplicates */
  const processedElementIds = useRef<Set<string>>(new Set());

  /**
   * @brief Expose methods through ref for external component access
   * @details Provides imperative access to DrawArea functionality from parent components
   */
  useImperativeHandle(ref, () => ({
    getSvgElement: () => svgRef.current,
    getElements: () => elements,
    setElements: (els: DrawElement[]) => {
      setElements(els);
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
    getCopiedElements: () => copiedElements,
    setCopiedElements: (els: DrawElement[]) => setCopiedElements(els),
  }), [elements, showGrid, selectedElementIds, copiedElements]);

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
      // Delete selected elements
      if ((e.key === "Delete") && selectedElementIds.length > 0) {
        pushToHistoryAndSetElements(prev => prev.filter(el => !selectedElementIds.includes(el.id)));
        setSelectedElementIds([]);
        setHoveredElementId(null);
        setSelectedElement?.(undefined);
      }
      
      // Copy selected elements (Ctrl+C)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && selectedElementIds.length > 0) {
        e.preventDefault();
        copySelectedElements();
      }
      
      // Paste elements (Ctrl+V)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v" && copiedElements.length > 0) {
        e.preventDefault();
        pasteElements();
      }
      
      // Undo (Ctrl+Z)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        setHistory(prev => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          setElements(last);
          return prev.slice(0, -1);
        });
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedElementIds, elements, setSelectedElement, copiedElements, disableKeyboardHandlers]);

  /**
   * @brief Add current state to history and update elements
   * @param updater Function or value to update elements state
   * @details Creates a snapshot of current elements before making changes for undo functionality
   */
  function pushToHistoryAndSetElements(updater: React.SetStateAction<DrawElement[]>) {
    setHistory(prev => [...prev, elements.map(el => ({ ...el }))]);
    setElements(updater);
  }

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
    e.stopPropagation(); // Prevent SVG click handler

    if (e.ctrlKey || e.metaKey) {
      setSelectedElementIds(
        selectedElementIds.includes(el.id)
          ? selectedElementIds.filter((id: string) => id !== el.id)
          : [...selectedElementIds, el.id]
      );
    } else {
      setSelectedElementIds([el.id]);
    }
    
    // Update external selection context
    setSelectedElement?.(el);
    
    setDraggingId(el.id);

    hasPushedToHistory.current = false;
    const svgRect = svgRef.current?.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - (svgRect?.left ?? 0) - el.start.x,
      y: e.clientY - (svgRect?.top ?? 0) - el.start.y,
    };

    // Store initial positions of all selected elements
    const currentSelectedIds = selectedElementIds.includes(el.id) ? selectedElementIds : [el.id];
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
   * Handles double click detection and panning start
   */
  function handleSvgPointerDown(e: React.PointerEvent) {
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
            setSelectedElementIds([]);
            setSelectedElement?.(undefined);
            setHoveredElementId(null);
            setDraggingId(null);
          }
        } else {
          // Find all elements that intersect with the selection rectangle
          const elementsInSelection = elements.filter(el => isElementInSelection(el, selRect));
          const newSelectedIds = elementsInSelection.map(el => el.id);

          if (e.ctrlKey || e.metaKey) {
            // Add to existing selection
            const combinedSelection = [...new Set([...selectedElementIds, ...newSelectedIds])];
            setSelectedElementIds(combinedSelection);
            if (combinedSelection.length === 1) {
              const selectedEl = elements.find(el => el.id === combinedSelection[0]);
              setSelectedElement?.(selectedEl);
            } else {
              setSelectedElement?.(undefined);
            }
          } else {
            // Replace selection
            setSelectedElementIds(newSelectedIds);
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

    if (!hasPushedToHistory.current) {
      setHistory(prev => [...prev, elements.map(el => ({ ...el }))]);
      hasPushedToHistory.current = true;
    }

    // Calculate the new position for the dragged element
    const dx = (e.clientX - svgRect.left) / zoom - dragOffset.current.x;
    const dy = (e.clientY - svgRect.top) / zoom - dragOffset.current.y;
    
    // Get the initial position of the dragged element
    const initialDraggedPos = initialSelectedPositions.current.get(currentDraggingId);
    if (!initialDraggedPos) return;

    // Calculate the movement delta
    const deltaX = dx - initialDraggedPos.start.x;
    const deltaY = dy - initialDraggedPos.start.y;

    setElements(prev =>
      prev.map(el => {
        // Move all selected elements by the same delta
        if (selectedElementIds.includes(el.id)) {
          const initialPos = initialSelectedPositions.current.get(el.id);
          if (initialPos) {
            return {
              ...el,
              start: { 
                x: initialPos.start.x + deltaX, 
                y: initialPos.start.y + deltaY 
              },
              end: {
                x: initialPos.end.x + deltaX,
                y: initialPos.end.y + deltaY,
              },
            };
          }
        }
        return el;
      })
    );
  }

  /**
   * Handles pointer up to end dragging.
   * @function
   */
  function handlePointerUp() {
    setDraggingId(null);
    initialSelectedPositions.current.clear(); // Clear stored positions
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  }

  /**
   * Renders the grid lines for the SVG area.
   * @function
   * @returns {JSX.Element} The rendered grid.
   */
  function renderGrid() {
    return (
      <g>
        {Array.from({ length: Math.ceil(GRID_WIDTH / GRID_SIZE) }).map((_, i) => (
          <line
            key={`v-${i}`}
            x1={i * GRID_SIZE}
            y1={0}
            x2={i * GRID_SIZE}
            y2={GRID_HEIGHT}
            stroke="#e0e0e0"
            strokeWidth={1}
          />
        ))}
        {Array.from({ length: Math.ceil(GRID_HEIGHT / GRID_SIZE) }).map((_, i) => (
          <line
            key={`h-${i}`}
            x1={0}
            y1={i * GRID_SIZE}
            x2={GRID_WIDTH}
            y2={i * GRID_SIZE}
            stroke="#e0e0e0"
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
    
    console.log("🚀 CREATING NEW ELEMENT:", {
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
    
    setElements(prev => {
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
      
      return [...prev, newElement];
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
  function createCenteredElement(item: any, x: number, y: number): DrawElement {
    // Only apply default styles for elements that don't have their own styling
    // Custom elements with SVG shapes should preserve their original colors
    const hasCustomShape = item.shape && item.type === "custom";
    
    const defaultStyles = hasCustomShape ? undefined : {
      fill: "#3b82f6", // blue-500
      stroke: "#1e293b", // slate-800
      strokeWidth: 2,
      opacity: 1,
    };

    console.log("🔧 Creating element from toolbox item:", {
      itemId: item.id,
      itemName: item.name,
      originalShapeElements: item.shapeElements ? {
        count: item.shapeElements.length,
        arrayReference: item.shapeElements, // Log the actual reference
        elements: item.shapeElements.map((el: any, index: number) => ({
          index: index,
          id: el.id,
          svgLength: el.svg.length,
          svg: el.svg, // Show full SVG content to see if they're identical
          elementReference: el // Log the actual element reference
        }))
      } : null
    });

    const baseElement = {
      id: `${item.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: item.name,
      type: item.type,
      iconName: item.iconName,
      iconSource: item.iconSource,
      iconSvg: item.iconSvg,
      draw: item.draw,
      shape: item.shape,
      shapeElements: item.shapeElements ? JSON.parse(JSON.stringify(item.shapeElements)) : undefined, // Deep copy to avoid reference sharing
      width: item.width,
      height: item.height,
      rotation: 0,
      gridEnabled: showGrid,
      backgroundColor,
      setGridEnabled: setShowGrid,
      setBackgroundColor,
      ...(defaultStyles && { styles: defaultStyles }),
      ...(item.textRegions && { textRegions: item.textRegions }),
    };

    switch (item.draw?.type) {
      case "line":
        return {
          ...baseElement,
          start: { x: x - item.width / 2, y },
          end: { x: x + item.width / 2, y },
        };
      case "lines":
        return {
          ...baseElement,
          start: { x: x - item.width / 2, y: y - item.height / 2 },
          end: { x: x + item.width / 2, y: y + item.height / 2 },
        };
      case "icon":
        return {
          ...baseElement,
          start: { x: x - item.width / 2, y: y - item.height / 2 },
          end: { x: x + item.width / 2, y: y + item.height / 2 },
        };
      case "text":
        return {
          ...baseElement,
          start: { x: x, y: y - item.height },
          end: { x: x + item.width, y: y + item.height },
        };
      default:
        return {
          ...baseElement,
          start: { x: x, y: y },
          end: { x: x + item.width, y: y + item.height },
        };
    }
  }

  /**
   * @brief Copy selected elements to internal clipboard
   * @details Creates deep copies of selected elements and stores them for pasting.
   * Also attempts to store in system clipboard for cross-application copying.
   */
  function copySelectedElements() {
    const elementsToCopy = elements.filter(el => selectedElementIds.includes(el.id));
    
    if (elementsToCopy.length === 0) {
      console.warn('No elements selected for copying');
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
    
    // Also put in system clipboard for cross-application copying
    try {
      const clipboardData = {
        type: 'railway-drawer-elements',
        elements: copiedElementsData,
        timestamp: Date.now()
      };
      navigator.clipboard.writeText(JSON.stringify(clipboardData));
      console.log(`Copied ${elementsToCopy.length} elements to clipboard`);
    } catch (error) {
      console.warn('Could not write to system clipboard:', error);
    }
    
    // Return the copied elements for immediate use
    return copiedElementsData;
  }

  /**
   * @brief Cut selected elements to internal clipboard
   * @details Creates deep copies of selected elements, stores them for pasting, and removes originals.
   * Also attempts to store in system clipboard for cross-application cutting.
   */
  function cutSelectedElements() {
    const elementsToCopy = elements.filter(el => selectedElementIds.includes(el.id));
    
    if (elementsToCopy.length === 0) {
      console.warn('No elements selected for cutting');
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
    
    // Also put in system clipboard
    try {
      const clipboardData = {
        type: 'railway-drawer-elements',
        elements: copiedElementsData,
        timestamp: Date.now(),
        operation: 'cut' // Mark as cut operation
      };
      navigator.clipboard.writeText(JSON.stringify(clipboardData));
      console.log(`Cut ${elementsToCopy.length} elements to clipboard`);
    } catch (error) {
      console.warn('Could not write to system clipboard:', error);
    }
    
    // Return the cut elements for immediate use
    return copiedElementsData;
  }

  /**
   * @brief Calculate bounding box of multiple elements
   * @param elements Array of elements to calculate bounds for
   * @returns Rectangle with x, y, width, height of bounding box
   */
  function calculateElementsBounds(elements: DrawElement[]) {
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
        console.warn('Invalid element found while calculating bounds:', el);
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
  }

  /**
   * @brief Paste elements from clipboard at specified position
   * @param pastePosition Optional position to paste at, defaults to center of viewport
   * @details Creates new elements with unique IDs, centers them at target position,
   * and adds them to the drawing area while selecting them.
   */
  function pasteElements(pastePosition?: { x: number; y: number }) {
    if (copiedElements.length === 0) {
      console.warn('No elements in clipboard to paste');
      return;
    }
    
    // Calculate paste position
    let targetX, targetY;
    
    if (pastePosition) {
      targetX = pastePosition.x;
      targetY = pastePosition.y;
    } else {
      // Default to center of visible area
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (svgRect) {
        targetX = (svgRect.width / 2 - panOffset.x) / zoom;
        targetY = (svgRect.height / 2 - panOffset.y) / zoom;
      } else {
        targetX = GRID_WIDTH / 2;
        targetY = GRID_HEIGHT / 2;
      }
    }
    
    // Calculate the bounding box of copied elements
    const bounds = calculateElementsBounds(copiedElements);
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    
    // Calculate offset to center the group at target position
    const offsetX = targetX - centerX;
    const offsetY = targetY - centerY;
    
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
        textRegions: el.textRegions ? el.textRegions.map(region => ({ ...region })) : undefined,
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
      console.warn(`${newElements.length - validElements.length} invalid elements filtered out during paste`);
    }
    
    if (validElements.length === 0) {
      console.error('No valid elements to paste');
      return;
    }
    
    // Add to history before making changes
    pushToHistoryAndSetElements(prev => [...prev, ...validElements]);
    
    // Select the newly pasted elements
    const newElementIds = validElements.map(el => el.id);
    setSelectedElementIds(newElementIds);
    
    if (newElementIds.length === 1) {
      setSelectedElement?.(validElements[0]);
    } else {
      setSelectedElement?.(undefined);
    }
    
    console.log(`Pasted ${validElements.length} elements at (${targetX.toFixed(1)}, ${targetY.toFixed(1)})`);
  }

  /**
   * @brief Handle right-click context menu
   * @param e The mouse event
   * @details Shows context menu and allows pasting at right-click position
   */
  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    
    // Calculate click position in drawing coordinates
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;
    
    const x = (e.clientX - svgRect.left - panOffset.x) / zoom;
    const y = (e.clientY - svgRect.top - panOffset.y) / zoom;
    
    // For now, just paste at right-click position if we have copied elements
    if (copiedElements.length > 0) {
      pasteElements({ x, y });
    }
  }

  /** @brief Main SVG render with all interactive features */
  return (
    <svg
      ref={svgRef}
      width={GRID_WIDTH}
      height={GRID_HEIGHT}
      style={{ 
        background: backgroundColor, 
        width: "100%", 
        height: "100%", 
        display: "block",
        cursor: isPanning ? 'grabbing' : 'default'
      }}
      tabIndex={0}
      onPointerDown={handleSvgPointerDown}
      onContextMenu={handleContextMenu}
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Main drawing transform group - handles pan and zoom */}
      <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoom})`}>
        {/* Grid lines */}
        {showGrid && renderGrid()}
        
        {/* Render all drawing elements */}
        {elements.map(el => {
          return (
            <RenderElement
              key={el.id}
              el={el}
              isSelected={selectedElementIds.includes(el.id)}
              hoveredElementId={hoveredElementId}
              setHoveredElementId={setHoveredElementId}
              updateElement={updated =>
                setElements(prev => prev.map(e => e.id === updated.id ? updated : e))
              }
              handlePointerDown={handlePointerDown}
            />
          );
        })}
        
        {/* Invisible bounding rectangles for easier selection of selected elements */}
        {elements.map(el => {
          if (!selectedElementIds.includes(el.id)) return null;
          
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
              />
            );
          }
        })}
        
        {/* Visual selection outline rectangles */}
        {elements.map(el => {
          if (!selectedElementIds.includes(el.id)) return null;
          
          if (el.rotation) {
            // For rotated elements, use a polygon to show proper rotated outline
            const rotatedRect = getRotatedBoundingRect(el);
            const padding = 2;
            
            // Calculate padded corners (expand outward from center)
            const center = rotatedRect.center;
            const corners = [
              rotatedRect.topLeft,
              rotatedRect.topRight, 
              rotatedRect.bottomRight,
              rotatedRect.bottomLeft
            ];
            
            // Expand each corner outward from center by padding amount
            const paddedCorners = corners.map(corner => {
              const dx = corner.x - center.x;
              const dy = corner.y - center.y;
              const length = Math.sqrt(dx * dx + dy * dy);
              if (length === 0) return corner;
              const scale = (length + padding) / length;
              return {
                x: center.x + dx * scale,
                y: center.y + dy * scale
              };
            });
            
            const points = paddedCorners.map(p => `${p.x},${p.y}`).join(' ');
            
            return (
              <polygon
                key={`selection-outline-${el.id}`}
                points={points}
                fill="none"
                stroke="rgba(0, 123, 255, 0.8)"
                strokeWidth={1 / zoom} // Adjust stroke width for zoom
                strokeDasharray={`${3 / zoom},${3 / zoom}`}
                pointerEvents="none"
              />
            );
          } else {
            // For non-rotated elements, use the original rect approach
            const left = Math.min(el.start.x, el.end.x);
            const top = Math.min(el.start.y, el.end.y);
            const width = Math.abs(el.end.x - el.start.x);
            const height = Math.abs(el.end.y - el.start.y);
            
            return (
              <rect
                key={`selection-outline-${el.id}`}
                x={left - 2}
                y={top - 2}
                width={width + 4}
                height={height + 4}
                fill="none"
                stroke="rgba(0, 123, 255, 0.8)"
                strokeWidth={1 / zoom} // Adjust stroke width for zoom
                strokeDasharray={`${3 / zoom},${3 / zoom}`}
                pointerEvents="none"
              />
            );
          }
        })}
        
        {/* Area selection rectangle */}
        {renderSelectionRectangle()}
      </g>
    </svg>
  );
});

DrawArea.displayName = 'DrawArea';

export default DrawArea;