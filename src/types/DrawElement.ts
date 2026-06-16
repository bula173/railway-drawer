/**
 * Improved DrawElement types with better separation of concerns
 * Splits domain model from UI state
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * Core geometry - the essential drawing data
 * These properties are always required and serializable
 */
export interface DrawElementGeometry {
  id: string;
  type: 'line' | 'rectangle' | 'circle' | 'polygon' | 'text' | 'curve' | 'custom';
  start: Point;
  end: Point;
}

/**
 * Transform and layout properties
 */
export interface DrawElementTransform {
  rotation?: number;
  mirrorX?: boolean;
  mirrorY?: boolean;
  opacity?: number;
}

/**
 * Visual styling properties
 */
export interface DrawElementStyle {
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  dashArray?: string;
  lineJoin?: 'round' | 'bevel' | 'miter';
  lineCap?: 'round' | 'butt' | 'square';
}

/**
 * Text and labeling properties
 */
export interface DrawElementText {
  label?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  textColor?: string;
  textAlign?: 'start' | 'middle' | 'end';
  textBaseline?: 'hanging' | 'middle' | 'baseline';
}

/**
 * Metadata properties
 */
export interface DrawElementMetadata {
  name?: string;
  layerId?: string;
  groupId?: string;
  locked?: boolean;
  hidden?: boolean;
  customProperties?: Record<string, any>;
}

/**
 * Custom SVG specific properties
 */
export interface DrawElementCustom {
  svgContent?: string;
  svgWidth?: number;
  svgHeight?: number;
  svgAttributes?: Record<string, string>;
}

/**
 * Combined DrawElement type - all required and optional properties properly typed
 */
export type DrawElement = DrawElementGeometry &
  Partial<DrawElementTransform> &
  Partial<DrawElementStyle> &
  Partial<DrawElementText> &
  Partial<DrawElementMetadata> &
  Partial<DrawElementCustom>;

/**
 * Type guard to check if element is a custom SVG element
 */
export const isCustomElement = (el: DrawElement): el is DrawElement => {
  return el.type === 'custom';
};

/**
 * Type guard to check if element has text
 */
export const hasText = (el: DrawElement): el is DrawElement => {
  return !!el.label;
};

/**
 * Helper to create a new element with defaults
 */
export const createDrawElement = (
  overrides: Partial<DrawElement> & { id: string; type: DrawElement['type']; start: Point; end: Point }
): DrawElement => {
  return {
    id: overrides.id,
    type: overrides.type,
    start: overrides.start,
    end: overrides.end,
    fillColor: overrides.fillColor ?? '#ffffff',
    strokeColor: overrides.strokeColor ?? '#000000',
    strokeWidth: overrides.strokeWidth ?? 1,
    opacity: overrides.opacity ?? 1,
    ...overrides,
  };
};

/**
 * Validate element has required properties
 */
export const isValidElement = (el: any): el is DrawElement => {
  return (
    typeof el === 'object' &&
    el !== null &&
    typeof el.id === 'string' &&
    typeof el.type === 'string' &&
    typeof el.start === 'object' &&
    typeof el.start.x === 'number' &&
    typeof el.start.y === 'number' &&
    typeof el.end === 'object' &&
    typeof el.end.x === 'number' &&
    typeof el.end.y === 'number'
  );
};
