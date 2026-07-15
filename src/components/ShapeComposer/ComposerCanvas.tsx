/**
 * @file ComposerCanvas.tsx
 * @brief Visual canvas for composing shapes from primitives
 *
 * Allows users to visually edit primitive elements:
 * - Click to select primitives
 * - Drag to move
 * - Resize handles for scaling
 * - Grid snapping support
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { PrimitiveElement, ComposedShape } from '../../types/shapeComposer';
import { logger } from '../../utils/logger';
import './styles/composerCanvas.css';

export interface ComposerCanvasProps {
  shape: ComposedShape;
  selectedElementId?: string;
  onSelectElement?: (id: string | undefined) => void;
  onUpdateElement?: (id: string, updates: Partial<PrimitiveElement>) => void;
  onDeleteElement?: (id: string) => void;
  zoom?: number;
  showGrid?: boolean;
  snapToGrid?: boolean;
  gridSize?: number;
}

interface DragState {
  isPanning: boolean;
  isMoving: boolean;
  isResizing: boolean;
  startX: number;
  startY: number;
  elementId?: string;
  handle?: string;
}

/**
 * Canvas for composing shapes from primitives
 */
export const ComposerCanvas: React.FC<ComposerCanvasProps> = ({
  shape,
  selectedElementId,
  onSelectElement,
  onUpdateElement,
  onDeleteElement,
  zoom = 1,
  showGrid = true,
  snapToGrid = true,
  gridSize = 40,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragState, setDragState] = useState<DragState>({
    isPanning: false,
    isMoving: false,
    isResizing: false,
    startX: 0,
    startY: 0,
  });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  // Snap value to grid
  const snapToGridValue = useCallback(
    (value: number): number => {
      if (!snapToGrid) return value;
      return Math.round(value / gridSize) * gridSize;
    },
    [snapToGrid, gridSize]
  );

  // Get SVG coordinates from mouse event
  const getSVGCoordinates = useCallback(
    (e: React.MouseEvent<SVGSVGElement>): { x: number; y: number } => {
      if (!svgRef.current) return { x: 0, y: 0 };

      const svg = svgRef.current;
      const rect = svg.getBoundingClientRect();
      const x = (e.clientX - rect.left - panOffset.x) / zoom;
      const y = (e.clientY - rect.top - panOffset.y) / zoom;

      return { x, y };
    },
    [panOffset, zoom]
  );

  // Handle canvas click (select/deselect)
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (dragState.isMoving || dragState.isResizing) return;

      const coords = getSVGCoordinates(e);

      // Check if clicking on an element
      let clickedElementId: string | undefined;
      for (const element of [...shape.elements].reverse()) {
        if (isPointInElement(coords.x, coords.y, element)) {
          clickedElementId = element.id;
          break;
        }
      }

      onSelectElement?.(clickedElementId);
    },
    [shape.elements, dragState, getSVGCoordinates, onSelectElement]
  );

  // Handle mouse down (start drag/pan)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const coords = getSVGCoordinates(e);

      // Check for element interaction
      let elementId: string | undefined;
      let handle: string | undefined;

      for (const element of [...shape.elements].reverse()) {
        if (element.id === selectedElementId) {
          handle = getResizeHandle(coords.x, coords.y, element);
          if (handle) {
            elementId = element.id;
            break;
          }
          if (isPointInElement(coords.x, coords.y, element)) {
            elementId = element.id;
            break;
          }
        }
      }

      if (e.button === 2 || (e.ctrlKey && !elementId)) {
        // Right-click or Ctrl+Click = pan mode
        setDragState({
          isPanning: true,
          isMoving: false,
          isResizing: false,
          startX: e.clientX,
          startY: e.clientY,
        });
      } else if (elementId && handle) {
        // Resize mode
        setDragState({
          isPanning: false,
          isMoving: false,
          isResizing: true,
          startX: coords.x,
          startY: coords.y,
          elementId,
          handle,
        });
      } else if (elementId) {
        // Move mode
        setDragState({
          isPanning: false,
          isMoving: true,
          isResizing: false,
          startX: coords.x,
          startY: coords.y,
          elementId,
        });
      }
    },
    [shape.elements, selectedElementId, getSVGCoordinates]
  );

  // Handle mouse move (drag)
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!dragState.isPanning && !dragState.isMoving && !dragState.isResizing) {
        return;
      }

      if (dragState.isPanning) {
        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;
        setPanOffset(prev => ({
          x: prev.x + dx,
          y: prev.y + dy,
        }));
        setDragState(prev => ({
          ...prev,
          startX: e.clientX,
          startY: e.clientY,
        }));
        return;
      }

      const coords = getSVGCoordinates(e);
      const element = shape.elements.find(e => e.id === dragState.elementId);
      if (!element) return;

      if (dragState.isMoving) {
        const dx = coords.x - dragState.startX;
        const dy = coords.y - dragState.startY;

        onUpdateElement?.(element.id, {
          x: snapToGridValue(element.x + dx),
          y: snapToGridValue(element.y + dy),
        });

        setDragState(prev => ({
          ...prev,
          startX: coords.x,
          startY: coords.y,
        }));
      } else if (dragState.isResizing && dragState.handle) {
        handleResize(element, dragState.handle, coords.x, coords.y);
        setDragState(prev => ({
          ...prev,
          startX: coords.x,
          startY: coords.y,
        }));
      }
    },
    [dragState, shape.elements, getSVGCoordinates, snapToGridValue, onUpdateElement]
  );

  // Handle mouse up (end drag)
  const handleMouseUp = useCallback(() => {
    setDragState({
      isPanning: false,
      isMoving: false,
      isResizing: false,
      startX: 0,
      startY: 0,
    });
  }, []);

  // Handle resize
  const handleResize = (element: PrimitiveElement, handle: string, x: number, y: number) => {
    const updates: Partial<PrimitiveElement> = {};

    switch (handle) {
      case 'nw': // top-left
        updates.x = snapToGridValue(Math.min(x, element.x + getElementWidth(element) - 10));
        updates.y = snapToGridValue(Math.min(y, element.y + getElementHeight(element) - 10));
        if (element.rectangle) {
          updates.rectangle = {
            ...element.rectangle,
            width: Math.max(10, element.rectangle.width + (dragState.startX - x)),
            height: Math.max(10, element.rectangle.height + (dragState.startY - y)),
          };
        }
        break;
      case 'ne': // top-right
        updates.y = snapToGridValue(Math.min(y, element.y + getElementHeight(element) - 10));
        if (element.rectangle) {
          updates.rectangle = {
            ...element.rectangle,
            width: Math.max(10, x - element.x),
            height: Math.max(10, element.rectangle.height + (dragState.startY - y)),
          };
        }
        break;
      case 'sw': // bottom-left
        updates.x = snapToGridValue(Math.min(x, element.x + getElementWidth(element) - 10));
        if (element.rectangle) {
          updates.rectangle = {
            ...element.rectangle,
            width: Math.max(10, element.rectangle.width + (dragState.startX - x)),
            height: Math.max(10, y - element.y),
          };
        }
        break;
      case 'se': // bottom-right
        if (element.rectangle) {
          updates.rectangle = {
            ...element.rectangle,
            width: Math.max(10, x - element.x),
            height: Math.max(10, y - element.y),
          };
        }
        break;
    }

    if (Object.keys(updates).length > 0) {
      onUpdateElement?.(element.id, updates);
    }
  };

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedElementId) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onDeleteElement?.(selectedElementId);
      } else if (e.key === 'd' && e.ctrlKey) {
        // Duplicate
        e.preventDefault();
        const element = shape.elements.find(el => el.id === selectedElementId);
        if (element) {
          const newElement: PrimitiveElement = {
            ...element,
            id: `${element.id}_${Date.now()}`,
            x: element.x + gridSize,
            y: element.y + gridSize,
          };
          onUpdateElement?.(newElement.id, newElement);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, shape.elements, gridSize, onDeleteElement, onUpdateElement]);

  // Render grid
  const renderGrid = useMemo(() => {
    if (!showGrid) return null;

    const gridLines = [];
    for (let i = 0; i <= shape.width; i += gridSize) {
      gridLines.push(
        <line key={`v${i}`} x1={i} y1={0} x2={i} y2={shape.height} className="grid-line" />
      );
    }
    for (let i = 0; i <= shape.height; i += gridSize) {
      gridLines.push(
        <line key={`h${i}`} x1={0} y1={i} x2={shape.width} y2={i} className="grid-line" />
      );
    }
    return gridLines;
  }, [showGrid, shape.width, shape.height, gridSize]);

  // Render primitives
  const renderPrimitives = useMemo(() => {
    return shape.elements
      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
      .map(element => (
        <g key={element.id}>
          {renderPrimitive(element)}
          {selectedElementId === element.id && renderSelectionBox(element)}
        </g>
      ));
  }, [shape.elements, selectedElementId]);

  return (
    <div className="composer-canvas-container">
      <svg
        ref={svgRef}
        className="composer-canvas"
        width={shape.width}
        height={shape.height}
        viewBox={`0 0 ${shape.width} ${shape.height}`}
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={e => e.preventDefault()}
        style={{
          cursor: dragState.isPanning ? 'grab' : dragState.isResizing ? 'pointer' : 'default',
          transform: `scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`,
          transformOrigin: '0 0',
        }}
      >
        {renderGrid}
        {renderPrimitives}
      </svg>
    </div>
  );
};

// Helper functions

function isPointInElement(x: number, y: number, element: PrimitiveElement): boolean {
  const padding = 5;
  const width = getElementWidth(element);
  const height = getElementHeight(element);

  return (
    x >= element.x - padding &&
    x <= element.x + width + padding &&
    y >= element.y - padding &&
    y <= element.y + height + padding
  );
}

function getElementWidth(element: PrimitiveElement): number {
  if (element.circle) return element.circle.radius * 2;
  if (element.rectangle) return element.rectangle.width;
  if (element.line) return Math.abs(element.line.x2 - element.x);
  return 0;
}

function getElementHeight(element: PrimitiveElement): number {
  if (element.circle) return element.circle.radius * 2;
  if (element.rectangle) return element.rectangle.height;
  if (element.line) return Math.abs(element.line.y2 - element.y);
  return 0;
}

function getResizeHandle(x: number, y: number, element: PrimitiveElement): string | undefined {
  if (element.type !== 'rectangle') return undefined;

  const handles = [
    { name: 'nw', x: element.x, y: element.y },
    { name: 'ne', x: element.x + getElementWidth(element), y: element.y },
    { name: 'sw', x: element.x, y: element.y + getElementHeight(element) },
    { name: 'se', x: element.x + getElementWidth(element), y: element.y + getElementHeight(element) },
  ];

  const handleSize = 6;
  for (const handle of handles) {
    if (Math.abs(x - handle.x) < handleSize && Math.abs(y - handle.y) < handleSize) {
      return handle.name;
    }
  }
  return undefined;
}

function renderPrimitive(element: PrimitiveElement): React.ReactNode {
  const baseProps = {
    fill: element.fill || 'none',
    stroke: element.stroke || '#000',
    strokeWidth: element.strokeWidth || 1,
    opacity: element.opacity ?? 1,
  };

  switch (element.type) {
    case 'circle':
      return (
        <circle
          cx={element.x}
          cy={element.y}
          r={element.circle?.radius || 10}
          {...baseProps}
        />
      );
    case 'rectangle':
      return (
        <rect
          x={element.x}
          y={element.y}
          width={element.rectangle?.width || 50}
          height={element.rectangle?.height || 50}
          rx={element.rectangle?.rx || 0}
          {...baseProps}
        />
      );
    case 'line':
      return (
        <line
          x1={element.x}
          y1={element.y}
          x2={element.line?.x2 || element.x + 50}
          y2={element.line?.y2 || element.y}
          {...baseProps}
        />
      );
    default:
      return null;
  }
}

function renderSelectionBox(element: PrimitiveElement): React.ReactNode {
  const width = getElementWidth(element);
  const height = getElementHeight(element);
  const handleSize = 6;

  return (
    <>
      <rect
        x={element.x - 2}
        y={element.y - 2}
        width={width + 4}
        height={height + 4}
        fill="none"
        stroke="#0066cc"
        strokeWidth={2}
        strokeDasharray="4"
        pointerEvents="none"
      />
      {/* Resize handles */}
      <circle cx={element.x} cy={element.y} r={handleSize / 2} fill="#0066cc" className="resize-handle" />
      <circle cx={element.x + width} cy={element.y} r={handleSize / 2} fill="#0066cc" className="resize-handle" />
      <circle cx={element.x} cy={element.y + height} r={handleSize / 2} fill="#0066cc" className="resize-handle" />
      <circle
        cx={element.x + width}
        cy={element.y + height}
        r={handleSize / 2}
        fill="#0066cc"
        className="resize-handle"
      />
    </>
  );
}
