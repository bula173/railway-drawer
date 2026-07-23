/**
 * @file types/index.ts
 * @brief Central TypeScript type definitions for the application
 * @details Defines all major types used throughout the codebase
 */

// ============= Shape Types =============

/**
 * Shape configuration for both vertex and SVG shapes
 */
export interface ShapeConfig {
  name: string;
  displayName: string;
  group: string;
  type: 'vertex' | 'svg';
  width: number;
  height: number;
  style?: CellStyle;
  description?: string;
  icon?: string;
}

/**
 * Cell styling options
 */
export interface CellStyle {
  shape?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fontSize?: number;
  fontFamily?: string;
  fontColor?: string;
  fillOpacity?: number;
  strokeOpacity?: number;
  rounded?: boolean;
  html?: boolean;
  image?: string;
  perimeter?: (bounds: any, vertex: any, next: any) => any;
  [key: string]: unknown;
}

/**
 * Position and size information
 */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Point in 2D space
 */
export interface Point {
  x: number;
  y: number;
}

// ============= Cache & Persistence Types =============

/**
 * Single tab data in cache
 */
export interface CachedTabData {
  id: string;
  name: string;
  graphXml: string;
}

/**
 * Application state cache
 */
export interface CacheData {
  projectName: string;
  tabs: CachedTabData[];
  activeTabId: string;
  timestamp: number;
}

// ============= Event Types =============

/**
 * Custom event for diagram changes
 */
export interface DiagramChangeEvent {
  type: 'add' | 'remove' | 'modify' | 'property';
  cellId?: string;
  property?: string;
  oldValue?: unknown;
  newValue?: unknown;
}

/**
 * Selection change event
 */
export interface SelectionChangeEvent {
  selected: string[];
  deselected: string[];
}

// ============= UI State Types =============

/**
 * Application-wide UI state
 */
export interface UIState {
  zoom: number;
  panX: number;
  panY: number;
  selectedCells: string[];
  activeTab: string;
  gridEnabled: boolean;
  gridSize: number;
}

/**
 * Tool states for toolbar
 */
export type ToolState = 'select' | 'pencil' | 'brush' | 'eraser' | 'line';

// ============= Custom Shape Types =============

/**
 * Custom shape created by user
 */
export interface CustomShape {
  id: string;
  name: string;
  width: number;
  height: number;
  svgPath: string;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  createdAt: number;
  modifiedAt?: number;
}

// ============= Export Types =============

/**
 * Export options for diagrams
 */
export interface ExportOptions {
  format: 'png' | 'svg' | 'xml';
  quality?: number;
  transparent?: boolean;
  scale?: number;
}

/**
 * Export result
 */
export interface ExportResult {
  format: string;
  data: string | Blob;
  filename: string;
  timestamp: number;
}

// ============= Keyboard & Input Types =============

/**
 * Keyboard shortcut definition
 */
export interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: string;
  description: string;
}

/**
 * Keyboard event context
 */
export interface KeyboardContext {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  target: EventTarget;
}

// ============= Alignment & Distribution =============

/**
 * Alignment direction
 */
export type AlignmentType = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

/**
 * Distribution direction
 */
export type DistributionType = 'horizontal' | 'vertical';

// ============= Theme Types =============

/**
 * Theme configuration
 */
export interface Theme {
  name: string;
  isDark: boolean;
  colors: ThemeColors;
}

/**
 * Theme color palette
 */
export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

// ============= Application Context =============

/**
 * Dependency injection context for controllers
 */
export interface AppContext {
  graph: any; // maxGraph Graph instance
  tabId: string;
  isDarkMode: boolean;
  isReadOnly?: boolean;
}
