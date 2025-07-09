/**
 * @file Elements.tsx
 * @brief React components and utilities for rendering, editing, and manipulating drawable elements in the railway-drawer app.
 *
 * This file contains:
 * - The DrawElement type definition.
 * - The ElementSVG component for rendering SVG shapes.
 * - The RenderElement component for interactive editing, resizing, rotating, and labeling.
 * - Utility functions for bounding box calculation and mirroring elements.
 *
 * @author
 * @date
 */

import * as LucideIcons from "lucide-react";
import React, { useRef } from "react";
import { RotateCw } from "lucide-react";

// --- Types ---

/**
 * @interface DrawElement
 * @brief Represents a drawable element with geometry, style, and metadata.
 */
export interface DrawElement {
  //Toolbox properties
  id: string;
  name?: string;
  type: string;
  iconName?: string;
  iconSource?: string;
  iconSvg?: string;
  draw?: any;
  shape?: string;
  width?: number;
  height?: number;
  // Element properties
  start: { x: number; y: number };
  end: { x: number; y: number };
  labelOffet?: { dx: number; dy: number };
  rotation?: number;
  text?: string;
  [key: string]: any;
}

/**
 * @function ElementSVG
 * @brief Renders the SVG for a given DrawElement.
 * @param el The element to render.
 * @returns JSX.Element
 */
export const ElementSVG: React.FC<{ el: DrawElement }> = ({ el }) => {
  const draw = el.draw || {};

  switch (draw.type) {
    case "line":
      return (
        <line
          x1={el.start.x}
          y1={el.start.y}
          x2={el.end.x}
          y2={el.start.y}
          stroke={draw.stroke || "black"}
          strokeWidth={draw.strokeWidth || 4}
        />
      );
    case "lines": {
      // Determine the original bounding box of the lines
      const lines = draw.lines || [];
      // Find min/max for x and y among all line endpoints
      const xs = lines.flatMap(l => [l.x1, l.x2]);
      const ys = lines.flatMap(l => [l.y1, l.y2]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const shapeWidth = maxX - minX || 1;
      const shapeHeight = maxY - minY || 1;

      // Target bounding box
      const width = Math.abs(el.end.x - el.start.x);
      const height = Math.abs(el.end.y - el.start.y);
      const cx = (el.start.x + el.end.x) / 2;
      const cy = (el.start.y + el.end.y) / 2;

      const scaleX = width / shapeWidth;
      const scaleY = height / shapeHeight;

      // Mirroring support
      const mirrorScaleX = el.mirrorX ? -1 : 1;
      const mirrorScaleY = el.mirrorY ? -1 : 1;
      const mirrorTranslateX = el.mirrorX ? shapeWidth : 0;
      const mirrorTranslateY = el.mirrorY ? shapeHeight : 0;

      return (
        <g
          transform={`
        translate(${cx - width / 2},${cy - height / 2})
        scale(${scaleX},${scaleY})
        translate(${mirrorTranslateX},${mirrorTranslateY})
        scale(${mirrorScaleX},${mirrorScaleY})
        translate(${-minX},${-minY})
      `}
        >
          {lines.map((l: any, i: number) => (
            <line
              key={i}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              stroke={draw.stroke || "black"}
              strokeWidth={draw.strokeWidth || 4 / Math.max(scaleX, scaleY)}
            />
          ))}
        </g>
      );
    }
    case "custom":
      if (el.shape) {
        // Use fallback size if missing or zero
        const shapeWidth = el.width && el.width > 0 ? el.width : 48;
        const shapeHeight = el.height && el.height > 0 ? el.height : 48;

        const width = Math.abs(el.end.x - el.start.x);
        const height = Math.abs(el.end.y - el.start.y);

        // Prevent division by zero
        const scaleX = shapeWidth ? width / shapeWidth : 1;
        const scaleY = shapeHeight ? height / shapeHeight : 1;

        const mirrorScaleX = el.mirrorX ? -1 : 1;
        const mirrorScaleY = el.mirrorY ? -1 : 1;
        const mirrorTranslateX = el.mirrorX ? shapeWidth : 0;
        const mirrorTranslateY = el.mirrorY ? shapeHeight : 0;

        return (
          <g
            transform={`
      translate(${el.start.x},${el.start.y})
      scale(${scaleX},${scaleY})
      translate(${mirrorTranslateX},${mirrorTranslateY})
      scale(${mirrorScaleX},${mirrorScaleY})
    `}
            dangerouslySetInnerHTML={{ __html: el.shape }}
          />
        );
      } else {
        console.warn("Custom SVG element has no SVG content");
        return null;
      }
    case "icon":
      console.log("cocol icon", { iconName: el.iconName, el });
      const Icon = LucideIcons[el.iconName as keyof typeof LucideIcons];
      const width = Math.abs(el.end.x - el.start.x);
      const height = Math.abs(el.end.y - el.start.y);
      const cx = (el.start.x + el.end.x) / 2;
      const cy = (el.start.y + el.end.y) / 2;
      return Icon ? (
        <Icon x={cx - width / 2} y={cy - height / 2} size={Math.max(width, height)} />
      ) : null;
    case "text":
      const textCx = (el.start.x + el.end.x) / 2;
      const textCy = (el.start.y + el.end.y) / 2;
      return (
        <text x={textCx} y={textCy} fontSize={18} textAnchor="middle" dominantBaseline="middle">
          {el.text || draw.defaultText || "Text"}
        </text>
      );
    default:
      return null;
  }
};

/**
 * @function getElementBoundingRect
 * @brief Calculates the bounding rectangle for a DrawElement.
 * @param el The element to calculate for.
 * @returns An object with x, y, width, and height.
 */
export function getElementBoundingRect(el: DrawElement) {
  const x = Math.min(el.start.x, el.end.x);
  const y = Math.min(el.start.y, el.end.y);
  const width = Math.abs(el.end.x - el.start.x);
  const height = Math.abs(el.end.y - el.start.y);
  return { x, y, width, height };
}

/**
 * @function RenderElement
 * @brief Main component for rendering and interacting with a DrawElement.
 * @param props The props for the element, selection, and handlers.
 * @returns JSX.Element
 */
export function RenderElement({
  el,
  isSelected,
  hoveredElementId,
  setHoveredElementId,
  updateElement,
  handlePointerDown,
}: {
  el: DrawElement;
  isSelected: boolean;
  hoveredElementId: string | null;
  setHoveredElementId: (id: string | null) => void;
  updateElement: (el: DrawElement) => void;
  handlePointerDown: (e: React.PointerEvent, el: DrawElement) => void;
}) {

  const [labelDragging, setLabelDragging] = React.useState(false);
  const [editingLabel, setEditingLabel] = React.useState(false);
  const [editValue, setEditValue] = React.useState(el.name || "");
  const [labelHovered, setLabelHovered] = React.useState(false);
  const [editingText, setEditingText] = React.useState(false);
  const [editTextValue, setEditTextValue] = React.useState(el.text || "");

  // --- Resize Logic ---
  const resizingRef = useRef<{
    handle: string;
    startX: number;
    startY: number;
    startEl: DrawElement;
  } | null>(null);

  function renderResizeHandles(rect: { x: number, y: number, width: number, height: number }) {
    const handles = [
      { x: rect.x, y: rect.y, cursor: "nwse-resize", name: "topLeft" },
      { x: rect.x + rect.width, y: rect.y, cursor: "nesw-resize", name: "topRight" },
      { x: rect.x, y: rect.y + rect.height, cursor: "nesw-resize", name: "bottomLeft" },
      { x: rect.x + rect.width, y: rect.y + rect.height, cursor: "nwse-resize", name: "bottomRight" },
    ];
    return handles.map(h => (
      <rect
        key={h.name}
        x={h.x - 6}
        y={h.y - 6}
        width={12}
        height={12}
        fill="#fff"
        stroke="#1976d2"
        strokeWidth={2}
        cursor={h.cursor}
        onPointerDown={e => handleResizePointerDown(e, h.name)}
      />
    ));
  }

  function handleResizePointerDown(e: React.PointerEvent, handle: string) {
    e.stopPropagation();
    console.log("Resize handle down:", handle, "at", e.clientX, e.clientY, "for element", el.id);
    resizingRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startEl: { ...el },
    };
    window.addEventListener("pointermove", handleResizePointerMove);
    window.addEventListener("pointerup", handleResizePointerUp);
  }

  function handleResizePointerMove(e: PointerEvent) {
    const resize = resizingRef.current;
    if (!resize) return;

    // Get SVG coordinates
    const svg = (e.target as SVGElement).ownerSVGElement || (e.target as SVGSVGElement);
    if (!svg) return;
    const svgRect = svg.getBoundingClientRect();
    const mouseX = e.clientX - svgRect.left;
    const mouseY = e.clientY - svgRect.top;
    const dx = mouseX - (resize.startX - svgRect.left);
    const dy = mouseY - (resize.startY - svgRect.top);

    let newStart = { ...resize.startEl.start };
    let newEnd = { ...resize.startEl.end };

    switch (resize.handle) {
      case "topLeft":
        newStart = { x: resize.startEl.start.x + dx, y: resize.startEl.start.y + dy };
        break;
      case "topRight":
        newStart = { x: resize.startEl.start.x, y: resize.startEl.start.y + dy };
        newEnd = { x: resize.startEl.end.x + dx, y: resize.startEl.end.y };
        break;
      case "bottomLeft":
        newStart = { x: resize.startEl.start.x + dx, y: resize.startEl.start.y };
        newEnd = { x: resize.startEl.end.x, y: resize.startEl.end.y + dy };
        break;
      case "bottomRight":
        newEnd = { x: resize.startEl.end.x + dx, y: resize.startEl.end.y + dy };
        break;
    }

    console.log("Resizing", resize.handle, "to", { newStart, newEnd }, "for element", el.id);

    if (Math.abs(newEnd.x - newStart.x) < 8 || Math.abs(newEnd.y - newStart.y) < 8) return;

    let width = newEnd.x - newStart.x;
    let height = newEnd.y - newStart.y;

    let mirrorX = el.mirrorX || false;
    let mirrorY = el.mirrorY || false;

    // Detect mirroring for custom SVGs
    if (el.type === "custom") {
      if (width < 0) {
        mirrorX = !mirrorX;
        [newStart.x, newEnd.x] = [newEnd.x, newStart.x];
        width = -width;
      }
      if (height < 0) {
        mirrorY = !mirrorY;
        [newStart.y, newEnd.y] = [newEnd.y, newStart.y];
        height = -height;
      }
      updateElement({ ...el, start: newStart, end: newEnd, mirrorX, mirrorY });
    } else {
      // For non-custom, allow negative width/height (mirroring by coordinates)
      updateElement({ ...el, start: newStart, end: newEnd });
    }
  }

  function handleResizePointerUp() {
    console.log("Resize handle up for element", el.id);
    resizingRef.current = null;
    window.removeEventListener("pointermove", handleResizePointerMove);
    window.removeEventListener("pointerup", handleResizePointerUp);
  }

  // --- Main Render ---
  const rect = getElementBoundingRect(el);

  return (
    <g
      onPointerDown={e => {
        if (!labelDragging) handlePointerDown(e, el);
      }}
      onPointerEnter={() => setHoveredElementId(el.id)}
      onPointerLeave={() => setHoveredElementId(null)}
      style={{ cursor: isSelected ? "grab" : "pointer" }}
    >
      {(hoveredElementId === el.id || isSelected || labelHovered) && (
        <rect
          x={rect.x - 4}
          y={rect.y - 4}
          width={rect.width + 8}
          height={rect.height + 8}
          fill="none"
          stroke={isSelected ? "#1976d2" : "#2196f3"}
          strokeWidth={2}
          rx={8}
          pointerEvents="none"
        />
      )}
      {isSelected && renderResizeHandles(rect)}
      <g
        transform={
          el.rotation
            ? `rotate(${el.rotation}, ${(el.start.x + el.end.x) / 2}, ${(el.start.y + el.end.y) / 2})`
            : undefined
        }
      >
        <ElementSVG el={el} />
      </g>
      {el.type !== "text" && el.name && !editingLabel && (labelHovered || isSelected || hoveredElementId === el.id) && (() => {
        const labelX = (el.start.x + el.end.x) / 2 + (el.labelOffset?.dx || 0);
        const labelY = (el.start.y) + (el.labelOffset?.dy || -30);
        const paddingX = 8;
        const paddingY = 4;
        const fontSize = 14;
        const text = el.name;
        const textWidth = text.length * fontSize * 0.6;
        const textHeight = fontSize + 2;
        return (
          <rect
            x={labelX - textWidth / 2 - paddingX}
            y={labelY - textHeight / 2 - paddingY}
            width={textWidth + paddingX * 2}
            height={textHeight + paddingY * 2}
            fill="#fff"
            stroke="#1976d2"
            strokeWidth={1.5}
            rx={6}
            ry={6}
            pointerEvents="none"
          />
        );
      })()}
      {el.type !== "text" && el.name && !editingLabel && (
        <text
          x={(el.start.x + el.end.x) / 2 + (el.labelOffset?.dx || 0)}
          y={(el.start.y) + (el.labelOffset?.dy || -30)}
          fontSize={14}
          textAnchor="middle"
          fill="#333"
          style={{ cursor: "move", userSelect: "none" }}
          onPointerDown={e => {
            e.stopPropagation();
            setLabelDragging(true);
            const svg = (e.target as SVGElement).ownerSVGElement;
            if (!svg) return;
            const startX = e.clientX;
            const startY = e.clientY;
            const startDx = el.labelOffset?.dx || -30;
            const startDy = el.labelOffset?.dy || -30;

            function onMove(ev: PointerEvent) {
              const dx = startDx + (ev.clientX - startX);
              const dy = startDy + (ev.clientY - startY);
              updateElement({ ...el, labelOffset: { dx, dy } });
            }
            function onUp() {
              setLabelDragging(false);
              window.removeEventListener("pointermove", onMove);
              window.removeEventListener("pointerup", onUp);
            }
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
          }}
          onDoubleClick={e => {
            e.stopPropagation();
            setEditingLabel(true);
            setEditValue(el.name || "");
          }}
          onPointerEnter={() => setLabelHovered(true)}
          onPointerLeave={() => setLabelHovered(false)}
        >
          {el.name}
        </text>
      )}
      {el.type !== "text" && editingLabel && (() => {
        const labelX = (el.start.x + el.end.x) / 2 + (el.labelOffset?.dx || 0);
        const labelY = (el.start.y)  + (el.labelOffset?.dy || -30);
        const paddingX = 8;
        const paddingY = 4;
        const fontSize = 14;
        const text = editValue;
        const textWidth = text.length * fontSize * 0.6;
        const textHeight = fontSize + 2;
        return (
          <>
            <rect
              x={labelX - textWidth / 2 - paddingX}
              y={labelY - textHeight / 2 - paddingY}
              width={textWidth + paddingX * 2}
              height={textHeight + paddingY * 2}
              fill="#fff"
              stroke="#1976d2"
              strokeWidth={1.5}
              rx={6}
              ry={6}
              pointerEvents="none"
            />
            <foreignObject
              x={labelX - 50}
              y={labelY - 18}
              width={100}
              height={30}
              onPointerEnter={() => setLabelHovered(true)}
              onPointerLeave={() => setLabelHovered(false)}
            >
              <input
                type="text"
                value={editValue}
                style={{
                  width: "100%",
                  fontSize: 14,
                  textAlign: "center",
                  border: "1px solid #1976d2",
                  borderRadius: 4,
                  padding: "2px 4px",
                }}
                autoFocus
                onChange={e => setEditValue(e.target.value)}
                onBlur={() => {
                  updateElement({ ...el, name: editValue });
                  setEditingLabel(false);
                }}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    updateElement({ ...el, name: editValue });
                    setEditingLabel(false);
                  }
                  if (e.key === "Escape") {
                    setEditingLabel(false);
                  }
                }}
              />
            </foreignObject>
          </>
        );
      })()}
      {isSelected && (
        <g
          style={{ cursor: "pointer" }}
          onPointerDown={e => {
            e.stopPropagation();
            // Calculate new rotation (default 0 if undefined)
            const current = el.rotation || 0;
            const next = (current + 15) % 360;
            updateElement({ ...el, rotation: next });
          }}
          // Position at top-right of selection rectangle
          transform={`translate(${rect.x + rect.width + 10}, ${rect.y - 24})`}
        >
          <rect
            width={24}
            height={24}
            rx={12}
            fill="#fff"
            stroke="#1976d2"
            strokeWidth={1.5}
            opacity={0.95}
          />
          <RotateCw x={4} y={4} size={16} color="#1976d2" />
        </g>
      )}
      {el.type === "text" && !editingText && (
        <text
          x={(el.start.x + el.end.x) / 2}
          y={(el.start.y + el.end.y) / 2}
          fontSize={18}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ cursor: "pointer", userSelect: "none" }}
          onDoubleClick={e => {
            e.stopPropagation();
            setEditingText(true);
            setEditTextValue(el.text || "");
          }}
        >
          {el.text || el.draw?.defaultText || "Text"}
        </text>
      )}
      {el.type === "text" && editingText && (
        <foreignObject
          x={(el.start.x + el.end.x) / 2 - 50}
          y={(el.start.y + el.end.y) / 2 - 15}
          width={100}
          height={30}
        >
          <input
            type="text"
            value={editTextValue}
            style={{
              width: "100%",
              fontSize: 18,
              textAlign: "center",
              border: "1px solid #1976d2",
              borderRadius: 4,
              padding: "2px 4px",
            }}
            autoFocus
            onChange={e => setEditTextValue(e.target.value)}
            onBlur={() => {
              updateElement({ ...el, text: editTextValue });
              setEditingText(false);
            }}
            onKeyDown={e => {
              if (e.key === "Enter") {
                updateElement({ ...el, text: editTextValue });
                setEditingText(false);
              }
              if (e.key === "Escape") {
                setEditingText(false);
              }
            }}
          />
        </foreignObject>
      )}
    </g>
  );
}
