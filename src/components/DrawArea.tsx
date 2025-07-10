import React, { useEffect, useRef, useState } from "react";
import { RenderElement } from "./Elements";
import type { DrawElement } from "./Elements";

/**
 * Props for the DrawArea component.
 * @interface DrawAreaProps
 * @property svgRef - Ref to the SVG element.
 * @property GRID_WIDTH - Width of the grid/SVG area.
 * @property GRID_HEIGHT - Height of the grid/SVG area.
 * @property GRID_SIZE - Size of each grid cell.
 * @property elements - Array of drawn elements.
 * @property setElements - Setter for elements.
 * @property hoveredElementId - ID of the currently hovered element.
 * @property setHoveredElementId - Setter for hovered element ID.
 * @property selectedElementIds - Array of selected element IDs.
 * @property setSelectedElementIds - Setter for selected element IDs.
 * @property showGrid - Whether to show the grid.
 * @property zoom - Zoom level (optional).
 */
export interface DrawAreaProps {
  svgRef: React.RefObject<SVGSVGElement | null>;
  GRID_WIDTH: number;
  GRID_HEIGHT: number;
  GRID_SIZE: number;
  elements: DrawElement[];
  setElements: React.Dispatch<React.SetStateAction<DrawElement[]>>;
  hoveredElementId: string | null;
  setHoveredElementId: (id: string | null) => void;
  selectedElementIds: string[];
  setSelectedElementIds: (ids: string[]) => void;
  showGrid: boolean;
  zoom?: number;
}

/**
 * DrawArea component for rendering and interacting with the drawing canvas.
 * Handles selection, dragging, dropping, grid rendering, and zoom.
 * 
 * @component
 * @param {DrawAreaProps} props - The props for DrawArea.
 * @returns {JSX.Element} The rendered SVG drawing area.
 */
const DrawArea: React.FC<DrawAreaProps> = ({
  svgRef,
  GRID_WIDTH,
  GRID_HEIGHT,
  GRID_SIZE,
  elements,
  setElements,
  hoveredElementId,
  setHoveredElementId,
  selectedElementIds,
  setSelectedElementIds,
  showGrid,
  zoom = 1,
}) => {
  /**
   * State for the currently dragged element ID.
   * @type {[string | null, Function]}
   */
  const [draggingId, setDraggingId] = useState<string | null>(null);

  /**
   * Ref for drag offset.
   * @type {React.MutableRefObject<{x: number, y: number}>}
   */
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  /**
   * Ref for the currently dragging element ID.
   * @type {React.MutableRefObject<string | null>}
   */
  const draggingIdRef = useRef<string | null>(null);

  /**
   * Ref to track if history was pushed during drag.
   * @type {React.MutableRefObject<boolean>}
   */
  const hasPushedToHistory = useRef(false);

  /**
   * State for undo/redo history (not used directly).
   * @type {Function}
   */
  const [, setHistory] = useState<DrawElement[][]>([]);

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
    switch (item.draw?.type) {
      case "line":
        // Center a horizontal line at (x, y)
        const lineElement = {
          id: `${item.type}_${Date.now()}`,
          name: item.name,
          type: item.type,
          iconName: item.iconName,
          iconSource: item.iconSource,
          iconSvg: item.iconSvg,
          draw: item.draw,
          shape: item.shape,
          width: item.width,
          height: item.heigh,
          start: { x: x - item.width / 2, y },
          end: { x: x + item.width / 2, y },
          rotation: 0,
        };
        return lineElement;
      case "lines":
        // Center a bounding box for multi-line shapes
        const linesElement = {
          id: `${item.type}_${Date.now()}`,
          name: item.name,
          type: item.type,
          iconName: item.iconName,
          iconSource: item.iconSource,
          iconSvg: item.iconSvg,
          draw: item.draw,
          shape: item.shape,
          width: item.width,
          height: item.heigh,
          start: { x: x - item.width / 2, y: y - item.height / 2 },
          end: { x: x + item.width / 2, y: y + item.height / 2 },
          rotation: 0,
        };
        return linesElement;
      case "icon":
        // Center a rectangle for icons and text
        const iconElement = {
          id: `${item.type}_${Date.now()}`,
          name: item.name,
          type: item.type,
          iconName: item.iconName,
          iconSource: item.iconSource,
          iconSvg: item.iconSvg,
          draw: item.draw,
          shape: item.shape,
          width: item.width,
          height: item.heigh,
          start: { x: x - item.width / 2, y: y - item.height / 2 },
          end: { x: x + item.width / 2, y: y + item.height / 2 },
          rotation: 0,
        };
        return iconElement;
      case "text":
        const textElement = {
          id: `${item.type}_${Date.now()}`,
          name: item.name,
          type: item.type,
          iconName: item.iconName,
          iconSource: item.iconSource,
          iconSvg: item.iconSvg,
          draw: item.draw,
          shape: item.shape,
          width: item.width,
          height: item.heigh,
          start: { x: x, y: y - item.height },
          end: { x: x + item.width, y: y + item.height },
          rotation: 0,
        };
        return textElement;
      default:
        // Fallback: centered rectangle
        const defaultElement = {
          id: `${item.type}_${Date.now()}`,
          name: item.name,
          type: item.type,
          iconName: item.iconName,
          iconSource: item.iconSource,
          iconSvg: item.iconSvg,
          draw: item.draw,
          shape: item.shape,
          width: item.width,
          height: item.heigh,
          start: { x: x, y: y },
          end: { x: x + item.width, y: y + item.height },
        };
        return defaultElement;
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
      className="svg-area"
      style={{ width: "100%", height: "100%", display: "block" }}
      onPointerDown={e => {
        if (e.target === svgRef.current) {
          handleSvgClick();
        }
      }}
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
    >
      <g transform={`scale(${zoom})`}>
        {showGrid && renderGrid()}
        {elements.map(el => (
          <RenderElement
            key={el.id}
            el={el}
            isSelected={el.id === lastSelectedId}
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
};

export default DrawArea;