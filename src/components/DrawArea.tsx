import React, { useEffect, useRef, useState } from "react";
import { RenderElement } from "./Elements";
import type { DrawElement } from "./Elements";

// --- Types ---
export interface DrawAreaProps {
  svgRef: React.RefObject<SVGSVGElement>;
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
  zoom?: number; // <-- add zoom prop
}

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
  zoom = 1, // <-- default zoom to 1
}) => {
  // --- State and Refs ---
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [history, setHistory] = useState<DrawElement[][]>([]);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const draggingIdRef = useRef<string | null>(null);
  const hasPushedToHistory = useRef(false);

  // --- Effects ---
  useEffect(() => {
    draggingIdRef.current = draggingId;
  }, [draggingId]);

  // --- Undo/Redo and Delete ---
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

  // --- History Helper ---
  function pushToHistoryAndSetElements(updater: React.SetStateAction<DrawElement[]>) {
    setHistory(prev => [...prev, elements.map(el => ({ ...el }))]);
    setElements(updater);
  }

  // --- Selection Handler ---
  function handlePointerDown(e: React.PointerEvent, el: DrawElement) {
    if (e.ctrlKey || e.metaKey) {
      setSelectedElementIds((prev: string[]) => {
        if (prev.includes(el.id)) {
          return prev.filter((id: string) => id !== el.id);
        } else {
          return [...prev, el.id];
        }
      });
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

  // --- Dragging Logic ---
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

  function handlePointerUp() {
    setDraggingId(null);
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  }

  // --- SVG Click Handler (deselect) ---
  function handleSvgClick() {
    setSelectedElementIds([]);
    setDraggingId(null);
    setHoveredElementId(null);
  }

  // --- Grid Rendering ---
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

  // --- Drop Handler: Create and center element here ---
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

  // --- Helper: Center element based on type ---
  function createCenteredElement(item: any, x: number, y: number): DrawElement {

    // Handle by draw type
    switch (item.draw?.type) {
      case "line":
        // Center a horizontal line at (x, y)
        const lineElement = {
        // Toolbox item properties
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
        // Element properties
          start: { x: x - item.width / 2, y },
          end: { x: x + item.width / 2, y },
          rotation: 0,
        };
        console.log("[CREATE] Centered line element:", lineElement);
        return lineElement;
      case "lines":
        // Center a bounding box for multi-line shapes
        const linesElement = {
        // Toolbox item properties
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
        // Element properties
          start: { x: x - item.width / 2, y: y - item.height / 2 },
          end: { x: x + item.width / 2, y: y + item.height / 2 },
          rotation: 0,
        };
        console.log("[CREATE] Centered lines element:", linesElement);
        return linesElement;
      case "icon":
        // Center a rectangle for icons and text
              console.log("draw icon", { iconName: item.iconName });

        const iconElement = {
        // Toolbox item properties
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
        // Element properties
          start: { x: x - item.width / 2, y: y - item.height / 2 },
          end: { x: x + item.width / 2, y: y + item.height / 2 },
          rotation: 0,
        };
        console.log("[CREATE] Centered icon element:", iconElement);
        return iconElement;
      case "text":
        const textElement = {
        // Toolbox item properties
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
        // Element properties
          start: { x: x, y: y - item.height },
          end: { x: x + item.width, y: y + item.height },
          rotation: 0,
        };
        console.log("[CREATE] Centered text element:", textElement);
        return textElement;
      default:
        // Fallback: centered rectangle
        const defaultElement = {
        // Toolbox item properties
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
        // Element properties
          start: { x: x, y: y },
          end: { x: x + item.width, y: y + item.height },
        };
        console.log("[CREATE] Centered default element:", defaultElement);
        return defaultElement;
    }
  }

  // --- Main Render ---
  const lastSelectedId = selectedElementIds.length > 0 ? selectedElementIds[selectedElementIds.length - 1] : null;

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
            handlePointerDown={handlePointerDown} // <-- pass this!
          />
        ))}
      </g>
    </svg>
  );
};

export default DrawArea;