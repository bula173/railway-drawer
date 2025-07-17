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

import React, { useRef } from "react";
import { RotateCw } from "lucide-react";
import "../styles/elements.css";
// --- Types ---

/**
 * @interface ElementStyles
 * @brief Represents styling properties for drawable elements.
 */
export interface ElementStyles {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  opacity?: number;
  strokeOpacity?: number;
  fillOpacity?: number;
}

/**
 * @function getElementStyleProps
 * @brief Converts ElementStyles to SVG style props
 * @param styles The element styles
 * @returns SVG style props object
 */
export function getElementStyleProps(styles?: ElementStyles): Record<string, any> {
  if (!styles) return {};
  
  const styleProps: Record<string, any> = {};
  if (styles.fill !== undefined) styleProps.fill = styles.fill;
  if (styles.stroke !== undefined) styleProps.stroke = styles.stroke;
  if (styles.strokeWidth !== undefined) styleProps.strokeWidth = styles.strokeWidth;
  if (styles.strokeDasharray !== undefined) styleProps.strokeDasharray = styles.strokeDasharray;
  if (styles.opacity !== undefined) styleProps.opacity = styles.opacity;
  if (styles.strokeOpacity !== undefined) styleProps.strokeOpacity = styles.strokeOpacity;
  if (styles.fillOpacity !== undefined) styleProps.fillOpacity = styles.fillOpacity;
  
  return styleProps;
}

/**
 * @function applyStylesToSVGString
 * @brief Applies styles to SVG string content
 * @param svgContent The SVG content as string
 * @param styles The styles to apply
 * @returns Modified SVG content
 */
export function applyStylesToSVGString(svgContent: string, styles?: ElementStyles): string {
  if (!styles || !svgContent) return svgContent;
  
  try {
    // Clean up the SVG content - remove any trailing commas or invalid characters
    let cleanSvgContent = svgContent.trim();
    if (cleanSvgContent.endsWith(',')) {
      cleanSvgContent = cleanSvgContent.slice(0, -1);
    }
    
    // Parse SVG and apply styles
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${cleanSvgContent}</svg>`, "image/svg+xml");
    
    // Check for parsing errors
    const parserError = svgDoc.querySelector("parsererror");
    if (parserError) {
      console.warn("SVG parsing error, returning original content:", parserError.textContent);
      return svgContent;
    }
    
    const svgElement = svgDoc.querySelector("svg");
    
    if (svgElement) {
      // Apply styles to all shape elements
      const shapeElements = svgElement.querySelectorAll("rect, circle, ellipse, line, polyline, polygon, path");
      shapeElements.forEach(elem => {
        // Only override attributes if the style value is explicitly set
        if (styles.fill !== undefined && styles.fill !== "") {
          elem.setAttribute("fill", styles.fill);
        }
        if (styles.stroke !== undefined && styles.stroke !== "") {
          elem.setAttribute("stroke", styles.stroke);
        }
        if (styles.strokeWidth !== undefined) {
          elem.setAttribute("stroke-width", styles.strokeWidth.toString());
        }
        if (styles.strokeDasharray !== undefined && styles.strokeDasharray !== "") {
          elem.setAttribute("stroke-dasharray", styles.strokeDasharray);
        }
        if (styles.opacity !== undefined) {
          elem.setAttribute("opacity", styles.opacity.toString());
        }
        if (styles.strokeOpacity !== undefined) {
          elem.setAttribute("stroke-opacity", styles.strokeOpacity.toString());
        }
        if (styles.fillOpacity !== undefined) {
          elem.setAttribute("fill-opacity", styles.fillOpacity.toString());
        }
      });
      
      return svgElement.innerHTML;
    }
  } catch (error) {
    console.warn("Error applying styles to SVG:", error);
    return svgContent;
  }
  
  return svgContent;
}

/**
 * @interface DrawElement
 * @brief Represents a drawable element with geometry, style, and metadata.
 */
export interface DrawElement {
  // Core properties
  id: string;
  name?: string;
  type: string;
  
  // Styling properties
  styles?: ElementStyles;
  
  // Toolbox properties
  iconSvg?: string;
  iconName?: string;
  iconSource?: string;
  shape?: string;
  width?: number;
  height?: number;
  draw?: any;
  
  // Element geometry
  start: { x: number; y: number };
  end: { x: number; y: number };
  labelOffset?: { dx: number; dy: number };
  rotation?: number;
  
  // Content properties
  text?: string;
  textRegions?: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    fontSize?: number;
    align?: 'left' | 'center' | 'right';
  }[];
  
  // Global properties (for draw area)
  gridEnabled?: boolean;
  backgroundColor?: string;
  setGridEnabled?: (enabled: boolean) => void;
  setBackgroundColor?: (color: string) => void;
  
  // Mirror properties
  mirrorX?: boolean;
  mirrorY?: boolean;
  
  // Allow additional properties
  [key: string]: any;
}

/**
 * @function ElementSVG
 * @brief Renders the SVG for a given DrawElement.
 * @param el The element to render.
 * @returns JSX.Element
 */
export const ElementSVG: React.FC<{ el: DrawElement }> = ({ el }) => {

  switch (el.type) {
   
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

        // Apply styles to the SVG content
        const styledShape = applyStylesToSVGString(el.shape, el.styles);
        
        // Debug logging
        if (el.styles) {
          console.log("Element with styles:", el.id, "Original:", el.shape?.slice(0, 100), "Styled:", styledShape.slice(0, 100));
        }

        return (
          <g
            transform={`
      translate(${el.start.x},${el.start.y})
      scale(${scaleX},${scaleY})
      translate(${mirrorTranslateX},${mirrorTranslateY})
      scale(${mirrorScaleX},${mirrorScaleY})
    `}
          >
            <g dangerouslySetInnerHTML={{ __html: styledShape }} />
          </g>
        );
      } else {
        console.warn("Custom SVG element has no SVG content");
        return null;
      }
    case "text":
      const textCx = (el.start.x + el.end.x) / 2;
      const textCy = (el.start.y + el.end.y) / 2;
      return (
        <text 
          x={textCx} 
          y={textCy} 
          fontSize={18} 
          textAnchor="middle" 
          dominantBaseline="middle"
          {...getElementStyleProps(el.styles)}
        >
          {"Text"}
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
  
  // For custom elements, check if the shape extends beyond the defined bounds
  if (el.type === "custom" && el.shape) {
    // Parse SVG content to find actual bounds
    const parser = new DOMParser();
    const svgContent = `<svg>${el.shape}</svg>`;
    const svgDoc = parser.parseFromString(svgContent, "image/svg+xml");
    const svgElement = svgDoc.querySelector("svg");
    
    if (svgElement) {
      // Get all elements and calculate their bounds
      const elements = svgElement.querySelectorAll("*");
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      
      elements.forEach(elem => {
        const tagName = elem.tagName.toLowerCase();
        
        // Extract coordinates based on element type
        let elemBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        
        switch (tagName) {
          case "rect":
            const rectX = parseFloat(elem.getAttribute("x") || "0");
            const rectY = parseFloat(elem.getAttribute("y") || "0");
            const rectW = parseFloat(elem.getAttribute("width") || "0");
            const rectH = parseFloat(elem.getAttribute("height") || "0");
            elemBounds = { minX: rectX, minY: rectY, maxX: rectX + rectW, maxY: rectY + rectH };
            break;
            
          case "circle":
            const cx = parseFloat(elem.getAttribute("cx") || "0");
            const cy = parseFloat(elem.getAttribute("cy") || "0");
            const r = parseFloat(elem.getAttribute("r") || "0");
            elemBounds = { minX: cx - r, minY: cy - r, maxX: cx + r, maxY: cy + r };
            break;
            
          case "line":
            const x1 = parseFloat(elem.getAttribute("x1") || "0");
            const y1 = parseFloat(elem.getAttribute("y1") || "0");
            const x2 = parseFloat(elem.getAttribute("x2") || "0");
            const y2 = parseFloat(elem.getAttribute("y2") || "0");
            elemBounds = { minX: Math.min(x1, x2), minY: Math.min(y1, y2), maxX: Math.max(x1, x2), maxY: Math.max(y1, y2) };
            break;
            
          case "polygon":
            const points = elem.getAttribute("points") || "";
            const coords = points.split(/[\s,]+/).filter(p => p).map(parseFloat);
            if (coords.length >= 2) {
              const xs = coords.filter((_, i) => i % 2 === 0);
              const ys = coords.filter((_, i) => i % 2 === 1);
              elemBounds = { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
            }
            break;
            
          case "ellipse":
            const ecx = parseFloat(elem.getAttribute("cx") || "0");
            const ecy = parseFloat(elem.getAttribute("cy") || "0");
            const erx = parseFloat(elem.getAttribute("rx") || "0");
            const ery = parseFloat(elem.getAttribute("ry") || "0");
            elemBounds = { minX: ecx - erx, minY: ecy - ery, maxX: ecx + erx, maxY: ecy + ery };
            break;
        }
        
        minX = Math.min(minX, elemBounds.minX);
        minY = Math.min(minY, elemBounds.minY);
        maxX = Math.max(maxX, elemBounds.maxX);
        maxY = Math.max(maxY, elemBounds.maxY);
      });
      
      // If we found actual bounds, use them to adjust the bounding rect
      if (minX !== Infinity && maxX !== -Infinity) {
        const originalWidth = el.width || 48;
        const originalHeight = el.height || 48;
        const actualWidth = maxX - minX;
        const actualHeight = maxY - minY;
        
        // Calculate scale factors
        const scaleX = width / originalWidth;
        const scaleY = height / originalHeight;
        
        // Apply scale to actual bounds
        const scaledActualWidth = actualWidth * scaleX;
        const scaledActualHeight = actualHeight * scaleY;
        const scaledMinX = minX * scaleX;
        const scaledMinY = minY * scaleY;
        
        // Adjust bounding rect to include actual content
        return {
          x: x + scaledMinX,
          y: y + scaledMinY,
          width: scaledActualWidth,
          height: scaledActualHeight
        };
      }
    }
  }
  
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
  // --- State ---
  const [labelDragging, setLabelDragging] = React.useState(false);
  const [editingLabel, setEditingLabel] = React.useState(false);
  const [editValue, setEditValue] = React.useState(el.name || "");
  const [labelHovered, setLabelHovered] = React.useState(false);
  const [editingText, setEditingText] = React.useState(false);
  const [editTextValue, setEditTextValue] = React.useState(el.text || "");
  // Text region editing state
  const [editingTextRegion, setEditingTextRegion] = React.useState<number | null>(null);
  const [editRegionValue, setEditRegionValue] = React.useState("");

  // --- Resize Logic ---
  const resizingRef = useRef<{
    handle: string;
    startX: number;
    startY: number;
    startEl: DrawElement;
  } | null>(null);

  /**
   * @function renderResizeHandles
   * @brief Renders resize handles at the corners of the element's bounding rectangle.
   * @param rect The bounding rectangle with x, y, width, and height properties.
   * @returns Array of JSX elements representing resize handles.
   */
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
        className={`resize-handle ${h.cursor.replace('-resize', '-resize')}`}
        x={h.x - 6}
        y={h.y - 6}
        onPointerDown={e => handleResizePointerDown(e, h.name)}
      />
    ));
  }

  /**
   * @function handleResizePointerDown
   * @brief Handles the start of a resize operation when a resize handle is clicked.
   * @param e The pointer event from the resize handle.
   * @param handle The name of the resize handle ("topLeft", "topRight", etc.).
   */
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

  /**
   * @function handleResizePointerMove
   * @brief Handles mouse movement during a resize operation.
   * @param e The pointer event containing current mouse position.
   * @description Updates element start/end coordinates based on which handle is being dragged.
   * Handles mirroring for custom SVG elements when dimensions become negative.
   */
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

  /**
   * @function handleResizePointerUp
   * @brief Cleans up resize operation when mouse is released.
   * @description Removes event listeners and clears the resizing reference.
   */
  function handleResizePointerUp() {
    console.log("Resize handle up for element", el.id);
    resizingRef.current = null;
    window.removeEventListener("pointermove", handleResizePointerMove);
    window.removeEventListener("pointerup", handleResizePointerUp);
  }

  // --- Helper Functions ---
  
  /**
   * @function renderSelectionHighlight
   * @brief Renders a blue outline around the element when hovered or selected.
   * @returns JSX element for the selection highlight or null if not shown.
   * @description Shows different colors for selected vs hovered states.
   */
  function renderSelectionHighlight() {
    const rect = getElementBoundingRect(el);
    const shouldShow = hoveredElementId === el.id || isSelected || labelHovered;
    
    if (!shouldShow) return null;
    
    return (
      <rect
        className={`element-selection-highlight ${isSelected ? 'selected' : 'hovered'}`}
        x={rect.x - 4}
        y={rect.y - 4}
        width={rect.width + 8}
        height={rect.height + 8}
      />
    );
  }

  /**
   * @function renderRotationHandle
   * @brief Renders a rotation button for selected elements.
   * @returns JSX element for the rotation handle or null if element is not selected.
   * @description Positioned at the top-right of the element's bounding box.
   */
  function renderRotationHandle() {
    if (!isSelected) return null;
    
    const rect = getElementBoundingRect(el);
    
    return (
      <g
        className="rotation-handle-container"
        onPointerDown={e => {
          e.stopPropagation();
          const current = el.rotation || 0;
          const next = (current + 15) % 360;
          updateElement({ ...el, rotation: next });
        }}
        transform={`translate(${rect.x + rect.width + 10}, ${rect.y - 24})`}
      >
        <rect className="rotation-handle-bg" />
        <RotateCw x={4} y={4} size={16} color="#1976d2" />
      </g>
    );
  }

  /**
   * @function renderElementContent
   * @brief Renders the main SVG content of the element with optional rotation.
   * @returns JSX element containing the ElementSVG component.
   * @description Applies rotation transform around the element's center if rotation is set.
   */
  function renderElementContent() {
    const transform = el.rotation
      ? `rotate(${el.rotation}, ${(el.start.x + el.end.x) / 2}, ${(el.start.y + el.end.y) / 2})`
      : undefined;
    
    return (
      <g transform={transform}>
        <ElementSVG el={el} />
      </g>
    );
  }

  /**
   * @function renderLabelBackground
   * @brief Renders a white background rectangle behind element labels.
   * @returns JSX element for the label background or null if not shown.
   * @description Only shown for non-text elements with names when hovered or selected.
   */
  function renderLabelBackground() {
    const shouldShow = el.type !== "text" && el.name && !editingLabel && 
                      (labelHovered || isSelected || hoveredElementId === el.id);
    
    if (!shouldShow) return null;
    
    const labelX = (el.start.x + el.end.x) / 2 + (el.labelOffset?.dx || 0);
    const labelY = (el.start.y) + (el.labelOffset?.dy || -30);
    const paddingX = 8;
    const paddingY = 4;
    const fontSize = 14;
    const text = el.name || "";
    const textWidth = text.length * fontSize * 0.6;
    const textHeight = fontSize + 2;
    
    return (
      <rect
        className="element-label-background"
        x={labelX - textWidth / 2 - paddingX}
        y={labelY - textHeight / 2 - paddingY}
        width={textWidth + paddingX * 2}
        height={textHeight + paddingY * 2}
      />
    );
  }

  /**
   * @function handleLabelDrag
   * @brief Handles dragging of element labels to reposition them.
   * @param e The pointer event from the label text element.
   * @description Sets up move and up event listeners to track label position changes.
   */
  function handleLabelDrag(e: React.PointerEvent) {
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
  }

  /**
   * @function handleLabelDoubleClick
   * @brief Handles double-click on labels to enter edit mode.
   * @param e The mouse event from the label text element.
   */
  function handleLabelDoubleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setEditingLabel(true);
    setEditValue(el.name || "");
  }

  /**
   * @function renderLabel
   * @brief Renders the label text for non-text elements.
   * @returns JSX element for the label text or null if not applicable.
   * @description Supports dragging and double-click editing. Only shown for elements with names.
   */
  function renderLabel() {
    if (el.type === "text" || !el.name || editingLabel) return null;
    
    return (
      <text
        className="element-label"
        x={(el.start.x + el.end.x) / 2 + (el.labelOffset?.dx || 0)}
        y={(el.start.y) + (el.labelOffset?.dy || -30)}
        onPointerDown={handleLabelDrag}
        onDoubleClick={handleLabelDoubleClick}
        onPointerEnter={() => setLabelHovered(true)}
        onPointerLeave={() => setLabelHovered(false)}
      >
        {el.name}
      </text>
    );
  }

  /**
   * @function handleLabelEdit
   * @brief Updates the element's name and exits label editing mode.
   * @param newValue The new label text value.
   */
  function handleLabelEdit(newValue: string) {
    updateElement({ ...el, name: newValue });
    setEditingLabel(false);
  }

  /**
   * @function renderLabelEditor
   * @brief Renders an input field for editing element labels.
   * @returns JSX elements for the label editor or null if not in edit mode.
   * @description Shows a text input with background when editing labels.
   */
  function renderLabelEditor() {
    if (el.type === "text" || !editingLabel) return null;
    
    const labelX = (el.start.x + el.end.x) / 2 + (el.labelOffset?.dx || 0);
    const labelY = (el.start.y) + (el.labelOffset?.dy || -30);
    const paddingX = 8;
    const paddingY = 4;
    const fontSize = 14;
    const text = editValue;
    const textWidth = text.length * fontSize * 0.6;
    const textHeight = fontSize + 2;
    
    return (
      <>
        <rect
          className="element-label-background"
          x={labelX - textWidth / 2 - paddingX}
          y={labelY - textHeight / 2 - paddingY}
          width={textWidth + paddingX * 2}
          height={textHeight + paddingY * 2}
        />
        <foreignObject
          className="foreign-object-container"
          x={labelX - 50}
          y={labelY - 18}
          onPointerEnter={() => setLabelHovered(true)}
          onPointerLeave={() => setLabelHovered(false)}
        >
          <input
            type="text"
            className="label-input"
            value={editValue}
            autoFocus
            onChange={e => setEditValue(e.target.value)}
            onBlur={() => handleLabelEdit(editValue)}
            onKeyDown={e => {
              if (e.key === "Enter") handleLabelEdit(editValue);
              if (e.key === "Escape") setEditingLabel(false);
            }}
          />
        </foreignObject>
      </>
    );
  }

  /**
   * @function handleTextDoubleClick
   * @brief Handles double-click on text elements to enter edit mode.
   * @param e The mouse event from the text element.
   */
  function handleTextDoubleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setEditingText(true);
    setEditTextValue(el.text || "");
  }

  /**
   * @function renderTextContent
   * @brief Renders the text content for text-type elements.
   * @returns JSX element for the text content or null if not applicable.
   * @description Only shown for text elements when not in edit mode.
   */
  function renderTextContent() {
    if (el.type !== "text" || editingText) return null;
    
    return (
      <text
        className="element-text-content"
        x={(el.start.x + el.end.x) / 2}
        y={(el.start.y + el.end.y) / 2}
        onDoubleClick={handleTextDoubleClick}
      >
        {"Text"}
      </text>
    );
  }

  /**
   * @function handleTextEdit
   * @brief Updates the element's text content and exits text editing mode.
   * @param newValue The new text content value.
   */
  function handleTextEdit(newValue: string) {
    updateElement({ ...el, text: newValue });
    setEditingText(false);
  }

  /**
   * @function renderTextEditor
   * @brief Renders an input field for editing text element content.
   * @returns JSX element for the text editor or null if not in edit mode.
   * @description Shows a text input when editing text elements.
   */
  function renderTextEditor() {
    if (el.type !== "text" || !editingText) return null;
    
    return (
      <foreignObject
        className="foreign-object-container"
        x={(el.start.x + el.end.x) / 2 - 50}
        y={(el.start.y + el.end.y) / 2 - 15}
      >
        <input
          type="text"
          className="text-input"
          value={editTextValue}
          autoFocus
          onChange={e => setEditTextValue(e.target.value)}
          onBlur={() => handleTextEdit(editTextValue)}
          onKeyDown={e => {
            if (e.key === "Enter") handleTextEdit(editTextValue);
            if (e.key === "Escape") setEditingText(false);
          }}
        />
      </foreignObject>
    );
  }

  /**
   * @function handleTextRegionDoubleClick
   * @brief Handles double-click on text regions to enter edit mode.
   * @param regionIndex The index of the text region being edited.
   * @param e The mouse event.
   */
  function handleTextRegionDoubleClick(regionIndex: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (!el.textRegions) return;
    
    setEditingTextRegion(regionIndex);
    setEditRegionValue(el.textRegions[regionIndex].text);
  }

  /**
   * @function handleTextRegionEdit
   * @brief Updates a text region's content and exits edit mode.
   * @param regionIndex The index of the region being edited.
   * @param newValue The new text value.
   */
  function handleTextRegionEdit(regionIndex: number, newValue: string) {
    if (!el.textRegions) return;
    
    const updatedRegions = [...el.textRegions];
    updatedRegions[regionIndex] = { ...updatedRegions[regionIndex], text: newValue };
    
    updateElement({ ...el, textRegions: updatedRegions });
    setEditingTextRegion(null);
  }

  /**
   * @function renderTextRegions
   * @brief Renders interactive text regions for complex shapes like UML classes.
   * @returns Array of JSX elements for text regions.
   */
  function renderTextRegions() {
    if (!el.textRegions) return null;

    const shapeWidth = el.width && el.width > 0 ? el.width : 48;
    const shapeHeight = el.height && el.height > 0 ? el.height : 48;
    const width = Math.abs(el.end.x - el.start.x);
    const height = Math.abs(el.end.y - el.start.y);
    const scaleX = shapeWidth ? width / shapeWidth : 1;
    const scaleY = shapeHeight ? height / shapeHeight : 1;
    const scaleFactor = Math.min(scaleX, scaleY); // Use uniform scaling to avoid distortion

    return el.textRegions.map((region, index) => {
      const scaledX = el.start.x + (region.x * scaleX);
      const scaledY = el.start.y + (region.y * scaleY);
      const scaledWidth = region.width * scaleX;
      const scaledHeight = region.height * scaleY;

      if (editingTextRegion === index) {
        // Render textarea for editing
        return (
          <foreignObject
            key={`region-edit-${index}`}
            x={scaledX}
            y={scaledY - 5}
            width={scaledWidth}
            height={Math.max(scaledHeight, 20)}
          >
            <textarea
              className="label-input"
              value={editRegionValue}
              autoFocus
              style={{
                fontSize: `${(region.fontSize || 12) * scaleFactor}px`,
                textAlign: region.align || 'center',
                background: 'rgba(255, 255, 255, 0.9)',
                border: '1px solid #1976d2',
                width: '100%',
                height: '100%',
                resize: 'none',
              }}
              onChange={e => setEditRegionValue(e.target.value)}
              onBlur={() => handleTextRegionEdit(index, editRegionValue)}
              onKeyDown={e => {
                if (e.key === "Escape") setEditingTextRegion(null);
              }}
            />
          </foreignObject>
        );
      }

      // Render clickable text region
      const lines: string[] = (region.text || '').split('\n');
      return (
        <g key={`region-${index}`}>
          {/* Invisible clickable area */}
          <rect
            x={scaledX}
            y={scaledY}
            width={scaledWidth}
            height={scaledHeight}
            fill="transparent"
            style={{ cursor: "text" }}
            onDoubleClick={e => handleTextRegionDoubleClick(index, e)}
          />
          {/* Text content */}
          {/* Render multi-line text content */}
          <g key={`region-${index}-lines`}>
            {lines.map((line: string, lineIndex: number) => (
              <text
                key={`region-${index}-line-${lineIndex}`}
                x={scaledX + (region.align === 'left' ? 5 : region.align === 'right' ? scaledWidth - 5 : scaledWidth / 2)}
                y={scaledY + scaledHeight / 2 + lineIndex * (region.fontSize || 12) * Math.min(scaleX, scaleY)}
                fontSize={(region.fontSize || 12) * Math.min(scaleX, scaleY)}
                textAnchor={region.align || 'center'}
                dominantBaseline="middle"
                fill="#000"
                className="shape-text-region"
              >
                {line}
              </text>
            ))}
          </g>
        </g>
      );
    });
  }

  // --- Main Render ---
  const rect = getElementBoundingRect(el);

  return (
    <g
      className={`element-container ${isSelected ? 'selected' : ''}`}
      onPointerDown={e => {
        if (!labelDragging) handlePointerDown(e, el);
      }}
      onPointerEnter={() => setHoveredElementId(el.id)}
      onPointerLeave={() => setHoveredElementId(null)}
    >
      {renderSelectionHighlight()}
      {isSelected && renderResizeHandles(rect)}
      {renderElementContent()}
      {renderTextRegions()}
      {renderLabelBackground()}
      {renderLabel()}
      {renderLabelEditor()}
      {renderRotationHandle()}
      {renderTextContent()}
      {renderTextEditor()}
    </g>
  );
}

