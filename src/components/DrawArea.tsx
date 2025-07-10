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
  selectedElement?: DrawElement;
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
  selectedElement,
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

  /**
   * Expose methods through ref
   */
  useImperativeHandle(ref, () => ({
    getSvgElement: () => svgRef.current,
    getElements: () => elements,
    setElements: (els: DrawElement[]) => setElements(els),
    setGridVisible: (visible: boolean) => setShowGrid(visible),
    getGridVisible: () => showGrid, // Make sure this returns the actual showGrid state
    getSelectedElement: () => {
      if (!selectedElementIds.length) return undefined;
      return elements.find(el => el.id === selectedElementIds[selectedElementIds.length - 1]);
    },
  }), [elements, showGrid, selectedElementIds]); // Make sure showGrid is in the dependency array

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
      }
      // Undo (Ctrl+Z)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
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
  }, [selectedElementIds, elements]);

  /**
   * Pushes the current elements to history and updates elements.
   * @function
   * @param {React.SetStateAction<DrawElement[]>} updater - The updater for elements.
   */
  function pushToHistoryAndSetElements(updater: React.SetStateAction<DrawElement[]>) {
    setHistory(prev => [...prev, elements.map(el => ({ ...el }))]);
    setElements(updater);
  }

  /**
   * Handles pointer down for selection and drag start.
   * @function
   * @param {React.PointerEvent} e - The pointer event.
   * @param {DrawElement} el - The element being interacted with.
   */
  function handlePointerDown(e: React.PointerEvent, el: DrawElement) {
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
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  /**
   * Handles pointer move for dragging elements.
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

    const dx = e.clientX - svgRect.left - dragOffset.current.x;
    const dy = e.clientY - svgRect.top - dragOffset.current.y;
    setElements(prev =>
      prev.map(el =>
        el.id === currentDraggingId
          ? {
              ...el,
              start: { x: dx, y: dy },
              end: {
                x: dx + (el.end.x - el.start.x),
                y: dy + (el.end.y - el.start.y),
              },
            }
          : el
      )
    );
  }

  /**
   * Handles pointer up to end dragging.
   * @function
   */
  function handlePointerUp() {
    setDraggingId(null);
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  }

  /**
   * Handles SVG background click to deselect all.
   * @function
   */
  function handleSvgClick() {
    setSelectedElementIds([]);
    setDraggingId(null);
    setHoveredElementId(null);
    
    // Clear external selection when clicking on empty space
    setSelectedElement?.(undefined);
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
    const x = e.clientX - svgRect.left;
    const y = e.clientY - svgRect.top;
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

  /**
   * The last selected element ID.
   * @type {string | null}
   */
  const lastSelectedId = selectedElementIds.length > 0 ? selectedElementIds[selectedElementIds.length - 1] : null;

  // --- Main Render ---
  return (
      <svg
        ref={svgRef}
        width={GRID_WIDTH}
        height={GRID_HEIGHT}
        style={{ background: backgroundColor, width: "100%", height: "100%", display: "block" }}
        tabIndex={0}
        onClick={handleSvgClick}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
      >
        <g transform={`scale(${zoom})`}>
          {showGrid && renderGrid()}
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
        </g>
      </svg>
  );
});

DrawArea.displayName = 'DrawArea';

export default DrawArea;