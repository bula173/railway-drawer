/**
 * @file shapeComposer.ts
 * @brief Type definitions for Shape Composer feature
 *
 * Defines all types and interfaces for composing custom shapes
 * from geometric primitives (circle, line, rectangle, etc.)
 */

export type ShapePrimitive = 'circle' | 'line' | 'rectangle' | 'polygon' | 'path' | 'text' | 'arc';

/**
 * Individual geometric primitive within a composed shape
 */
export interface PrimitiveElement {
  id: string;                    // Unique within composition
  type: ShapePrimitive;
  x: number;                     // Position
  y: number;

  // Common properties
  fill?: string;                 // Color
  stroke?: string;               // Border color
  strokeWidth?: number;
  opacity?: number;              // 0-1
  rotation?: number;             // Degrees (0-360)
  zIndex?: number;               // Stacking order

  // Type-specific properties
  circle?: {
    radius: number;
  };
  line?: {
    x2: number;
    y2: number;
  };
  rectangle?: {
    width: number;
    height: number;
    rx?: number;                  // Border radius
  };
  polygon?: {
    points: Array<{ x: number; y: number }>;
  };
  path?: {
    d: string;                    // SVG path data
  };
  text?: {
    content: string;
    fontSize: number;
    fontFamily?: string;
    textAnchor?: 'start' | 'middle' | 'end';
    dominantBaseline?: 'auto' | 'central' | 'middle';
  };
  arc?: {
    radius: number;
    startAngle: number;           // Degrees
    endAngle: number;             // Degrees
  };
}

/**
 * Complete composed shape with metadata
 */
export interface ComposedShape {
  id: string;                    // Unique shape ID
  name: string;                  // User-friendly name
  description?: string;
  elements: PrimitiveElement[];  // Primitives that make up this shape
  width: number;                 // Bounding box width
  height: number;                // Bounding box height
  createdAt: number;             // Timestamp
  updatedAt: number;             // Timestamp
  group?: string;                // Category (e.g., "Custom", "Infrastructure")
}

/**
 * Serializable shape library
 */
export interface ShapeLibrary {
  version: string;
  shapes: ComposedShape[];
  metadata?: {
    createdBy?: string;
    exportedAt?: number;
    description?: string;
  };
}

/**
 * State for shape composer dialog/editor
 */
export interface ShapeComposerState {
  isOpen: boolean;
  mode: 'create' | 'edit';
  currentShape?: ComposedShape;
  selectedElementId?: string;    // ID of selected primitive

  // Canvas state
  zoom: number;
  panOffset: { x: number; y: number };
  showGrid: boolean;
  snapToGrid: boolean;
}

/**
 * Undo/redo action for shape composition
 */
export interface ComposerAction {
  type: 'add' | 'delete' | 'update' | 'move' | 'select';
  elementId?: string;
  oldState?: PrimitiveElement | ComposedShape;
  newState?: PrimitiveElement | ComposedShape;
  timestamp: number;
}

/**
 * Validation result for composed shapes
 */
export interface ComposerValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
