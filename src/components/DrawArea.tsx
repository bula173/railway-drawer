import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { RenderElement } from "./Elements";
import type { DrawElement } from "./Elements";

/**
 * Methods exposed by DrawArea component through ref
 */
export interface DrawAreaRef {
  getSvgElement: () => SVGSVGElement | null;
  getElements: () => DrawElement[];
  setElements: (elements: DrawElement[]) => void;
  setGridVisible: (visible: boolean) => void;
  getGridVisible: () => boolean;
  getSelectedElement: () => DrawElement | undefined;
  copySelectedElements: () => void;
  pasteElements: (position?: { x: number; y: number }) => void;
  getCopiedElements: () => DrawElement[];
  setCopiedElements: (elements: DrawElement[]) => void;
}

/**
 * Props for the DrawArea component.
 * Only layout/grid/zoom props are needed after refactor.
 */
export interface DrawAreaProps {
  GRID_WIDTH: number;
  GRID_HEIGHT: number;
  GRID_SIZE: number;
  zoom?: number;
  setSelectedElement?: (el?: DrawElement) => void;
}

/**
 * DrawArea component for rendering and interacting with the drawing canvas.
 * Handles selection, dragging, dropping, grid rendering, and zoom.
 * Creates and manages its own SVG element internally.
 * 
 * @component
 * @param {DrawAreaProps} props - The props for DrawArea.
 * @param {React.Ref<DrawAreaRef>} ref - Ref to expose DrawArea methods.
 * @returns {JSX.Element} The rendered SVG drawing area.
 */
const DrawArea = forwardRef<DrawAreaRef, DrawAreaProps>(({
  GRID_WIDTH,
  GRID_HEIGHT,
  GRID_SIZE,
  zoom = 1,
  setSelectedElement,
}, ref) => {
  // Internal state for elements and UI
  const [elements, setElements] = useState<DrawElement[]>([]);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [backgroundColor, setBackgroundColor] = useState<string>("#ffffff");
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [, setHistory] = useState<DrawElement[][]>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const hasPushedToHistory = useRef(false);

  // Area selection state
  const [isAreaSelecting, setIsAreaSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null);
  const selectionEndRef = useRef<{ x: number; y: number } | null>(null); // Add this ref

  // Add panning state to the existing state variables
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Add this ref to store initial positions of all selected elements
  const initialSelectedPositions = useRef<Map<string, { start: { x: number; y: number }, end: { x: number; y: number } }>>(new Map());
  const [copiedElements, setCopiedElements] = useState<DrawElement[]>([]);

  /**
   * Expose methods through ref
   */
  useImperativeHandle(ref, () => ({
    getSvgElement: () => svgRef.current,
    getElements: () => elements,
    setElements: (els: DrawElement[]) => setElements(els),
    setGridVisible: (visible: boolean) => setShowGrid(visible),
    getGridVisible: () => showGrid,
    getSelectedElement: () => {
      if (!selectedElementIds.length) return undefined;
      return elements.find(el => el.id === selectedElementIds[selectedElementIds.length - 1]);
    },
    copySelectedElements,
    pasteElements,
    getCopiedElements: () => copiedElements,
    setCopiedElements: (els: DrawElement[]) => setCopiedElements(els),
  }), [elements, showGrid, selectedElementIds, copiedElements]);

  /**
   * Sync elements with grid visibility state
   */
  useEffect(() => {
    setElements(prev => prev.map(el => ({ ...el, gridEnabled: showGrid })));
  }, [showGrid]);

  // Pass these properties to elements
  elements.forEach((el) => {
    el.gridEnabled = showGrid;
    el.backgroundColor = backgroundColor;
    el.setGridEnabled = setShowGrid;
    el.setBackgroundColor = setBackgroundColor;
  });

  /**
   * Effect to keep draggingIdRef in sync with draggingId.
   */
  useEffect(() => {
    draggingIdRef.current = draggingId;
  }, [draggingId]);

  /**
   * Effect to handle keyboard shortcuts for delete and undo.
   */
  useEffect(() => {
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
  }, [selectedElementIds, elements, setSelectedElement, copiedElements]);

  /**
   * Pushes the current elements to history and updates elements.
   */
  function pushToHistoryAndSetElements(updater: React.SetStateAction<DrawElement[]>) {
    setHistory(prev => [...prev, elements.map(el => ({ ...el }))]);
    setElements(updater);
  }

  /**
   * Check if an element intersects with the selection rectangle
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
    console.log("renderSelectionRectangle called:", { 
      isAreaSelecting, 
      selectionStart, 
      selectionEnd 
    });

    if (!isAreaSelecting || !selectionStart || !selectionEnd) return null;

    const x = Math.min(selectionStart.x, selectionEnd.x);
    const y = Math.min(selectionStart.y, selectionEnd.y);
    const width = Math.abs(selectionEnd.x - selectionStart.x);
    const height = Math.abs(selectionEnd.y - selectionStart.y);

    console.log("Selection rectangle:", { x, y, width, height });

    return (
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="rgba(255, 0, 0, 0.3)" // Change to red to make it more visible
        stroke="rgba(255, 0, 0, 0.8)"
        strokeWidth={3} // Make it thicker
        strokeDasharray="10,5" // Make dashes bigger
        pointerEvents="none"
      />
    );
  }

  /**
   * Handles double click detection and panning start
   */
  function handleSvgPointerDown(e: React.PointerEvent) {
    console.log("handleSvgPointerDown called");
    
    if (e.target !== svgRef.current && e.target !== e.currentTarget) {
      console.log("Click not on SVG background");
      return;
    }

    // Check if middle mouse button or holding space for panning
    const shouldPan = e.button === 1 || e.shiftKey; // Middle mouse or Shift key for panning

    if (shouldPan) {
      console.log("Starting panning");
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      window.addEventListener("pointermove", handlePanMove);
      window.addEventListener("pointerup", handlePanUp);
      return;
    }

    if (!isPanning) {
      console.log("Starting area selection");
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) return;

      const clientX = e.clientX - svgRect.left;
      const clientY = e.clientY - svgRect.top;
      const x = (clientX - panOffset.x) / zoom;
      const y = (clientY - panOffset.y) / zoom;

      console.log("Selection start coordinates:", { x, y });

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
          console.log("Area selection move blocked:", { isSelecting, isPanning });
          return;
        }

        const svgRect = svgRef.current?.getBoundingClientRect();
        if (!svgRect) return;

        const clientX = e.clientX - svgRect.left;
        const clientY = e.clientY - svgRect.top;
        const x = (clientX - panOffset.x) / zoom;
        const y = (clientY - panOffset.y) / zoom;

        console.log("Selection end coordinates:", { x, y });
        
        // Store in both state and ref
        setSelectionEnd({ x, y });
        selectionEndRef.current = { x, y };
      };

      const areaSelectionUp = (e: PointerEvent) => {
        console.log("handleAreaSelectionUp called");
        
        if (isPanning) return; // Don't process if we're panning

        const currentStart = selectionData;
        const currentEnd = selectionEndRef.current || selectionData; // Fallback to start if no movement
        
        const selRect = {
          x: Math.min(currentStart.x, currentEnd.x),
          y: Math.min(currentStart.y, currentEnd.y),
          width: Math.abs(currentEnd.x - currentStart.x),
          height: Math.abs(currentEnd.y - currentStart.y)
        };

        console.log("Selection completed:", selRect);

        // Check if this was just a click (very small movement)
        const isClick = selRect.width < 5 && selRect.height < 5;

        if (isClick) {
          console.log("Detected as click - clearing selection");
          if (!e.ctrlKey && !e.metaKey) {
            setSelectedElementIds([]);
            setSelectedElement?.(undefined);
            setHoveredElementId(null);
            setDraggingId(null);
          }
        } else {
          console.log("Detected as area selection");
          
          // Find all elements that intersect with the selection rectangle
          const elementsInSelection = elements.filter(el => isElementInSelection(el, selRect));
          const newSelectedIds = elementsInSelection.map(el => el.id);

          console.log("Elements in selection:", newSelectedIds);

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
        console.log("Area selection cleanup");
        isSelecting = false;
        selectionEndRef.current = null;
        setIsAreaSelecting(false);
        setSelectionStart(null);
        setSelectionEnd(null);
        window.removeEventListener("pointermove", areaSelectionMove);
        window.removeEventListener("pointerup", areaSelectionUp);
      };

      // Add event listeners with the closure functions
      console.log("Adding event listeners for area selection");
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
    console.log("[DROP] Dropped item:", item, "at", { x, y });
    setElements(prev => {
      const newElement = createCenteredElement(item, x, y);
      console.log("[CREATE] New element created:", newElement);
      return [
        ...prev,
        newElement
      ];
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
    const baseElement = {
      id: `${item.type}_${Date.now()}`,
      name: item.name,
      type: item.type,
      iconName: item.iconName,
      iconSource: item.iconSource,
      iconSvg: item.iconSvg,
      draw: item.draw,
      shape: item.shape,
      width: item.width,
      height: item.height,
      rotation: 0,
      gridEnabled: showGrid,
      backgroundColor,
      setGridEnabled: setShowGrid,
      setBackgroundColor,
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

  // Move these functions INSIDE the DrawArea component, before the return statement

  /**
   * Copy selected elements to clipboard
   */
  function copySelectedElements() {
    const elementsToCopy = elements.filter(el => selectedElementIds.includes(el.id));
    
    if (elementsToCopy.length === 0) return;
    
    // Create deep copies with new IDs but preserve relative positions
    const copiedElementsData = elementsToCopy.map(el => ({
      ...el,
      // Don't change ID yet - will be done during paste
      originalId: el.id
    }));
    
    setCopiedElements(copiedElementsData);
    
    // Also put in system clipboard for cross-application copying
    try {
      const clipboardData = {
        type: 'railway-drawer-elements',
        elements: copiedElementsData,
        timestamp: Date.now()
      };
      navigator.clipboard.writeText(JSON.stringify(clipboardData));
      console.log(`Copied ${elementsToCopy.length} elements`);
    } catch (error) {
      console.warn('Could not write to system clipboard:', error);
    }
  }

  /**
   * Calculate bounding box of multiple elements
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
      const left = Math.min(el.start.x, el.end.x);
      const right = Math.max(el.start.x, el.end.x);
      const top = Math.min(el.start.y, el.end.y);
      const bottom = Math.max(el.start.y, el.end.y);
      
      minX = Math.min(minX, left);
      minY = Math.min(minY, top);
      maxX = Math.max(maxX, right);
      maxY = Math.max(maxY, bottom);
    });
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * Paste elements at current mouse position or center of viewport
   */
  function pasteElements(pastePosition?: { x: number; y: number }) {
    if (copiedElements.length === 0) return;
    
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
      return {
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
        // Remove the originalId property
        originalId: undefined
      };
    });
    
    // Add to history before making changes
    pushToHistoryAndSetElements(prev => [...prev, ...newElements]);
    
    // Select the newly pasted elements
    const newElementIds = newElements.map(el => el.id);
    setSelectedElementIds(newElementIds);
    
    if (newElementIds.length === 1) {
      setSelectedElement?.(newElements[0]);
    } else {
      setSelectedElement?.(undefined);
    }
    
    console.log(`Pasted ${newElements.length} elements at (${targetX.toFixed(1)}, ${targetY.toFixed(1)})`);
  }

  /**
   * Handle context menu (right-click)
   */
  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    
    // You can implement a context menu here
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;
    
    const x = (e.clientX - svgRect.left - panOffset.x) / zoom;
    const y = (e.clientY - svgRect.top - panOffset.y) / zoom;
    
    // For now, just paste at right-click position if we have copied elements
    if (copiedElements.length > 0) {
      pasteElements({ x, y });
    }
  }

  // --- Main Render ---
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
      <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoom})`}>
        {showGrid && renderGrid()}
        
        {/* Render elements */}
        {elements.map(el => (
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
        ))}
        
        {/* Render invisible bounding rectangles for selected elements */}
        {elements.map(el => {
          if (!selectedElementIds.includes(el.id)) return null;
          
          const left = Math.min(el.start.x, el.end.x);
          const top = Math.min(el.start.y, el.end.y);
          const width = Math.abs(el.end.x - el.start.x);
          const height = Math.abs(el.end.y - el.start.y);
          
          return (
            <rect
              key={`bounding-${el.id}`}
              x={left - 5} // Add 5px padding
              y={top - 5}
              width={width + 10}
              height={height + 10}
              fill="transparent"
              stroke="none"
              style={{ cursor: 'move' }}
              onPointerDown={(e) => handlePointerDown(e, el)}
            />
          );
        })}
        
        {/* Render selection outline rectangles for visual feedback */}
        {elements.map(el => {
          if (!selectedElementIds.includes(el.id)) return null;
          
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
              strokeWidth={1 / zoom} // Adjust for zoom
              strokeDasharray={`${3 / zoom},${3 / zoom}`}
              pointerEvents="none"
            />
          );
        })}
        
        {/* Render area selection rectangle */}
        {renderSelectionRectangle()}
      </g>
    </svg>
  );
});

DrawArea.displayName = 'DrawArea';

export default DrawArea;