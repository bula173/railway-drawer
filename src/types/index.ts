/**
 * @file types.ts
 * @brief Centralized type definitions for the Railway Drawer application
 * 
 * Contains all shared interfaces, types, and constants used throughout the application.
 * Helps maintain consistency and provides a single source of truth for type definitions.
 * 
 * @author Railway Drawer Team
 * @date 2025
 * @version 1.0
 */

import type { DrawElement, ElementStyles, ShapeElement } from '../components/Elements';
import type { DrawAreaRef } from '../components/DrawArea';
import type { ToolboxItem } from '../components/Toolbox';
import type { DrawAreaTab } from '../components/TabPanel';

// Define TextRegion interface here since it's not exported from Elements
export interface TextRegion {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  fontFamily?: string;
  fill?: string;
  textAnchor?: 'start' | 'middle' | 'end';
  dominantBaseline?: 'auto' | 'central' | 'middle';
}

// Re-export types for convenience
export type { DrawElement, ElementStyles, ShapeElement, DrawAreaRef, ToolboxItem, DrawAreaTab };

// Application-wide constants
export const APP_CONSTANTS = {
  GRID_SIZE: 40,
  DEFAULT_ZOOM: 1,
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 5,
  DEFAULT_CANVAS_WIDTH: 800,
  DEFAULT_CANVAS_HEIGHT: 600,
  DEFAULT_BACKGROUND_COLOR: '#ffffff',
  SNAP_THRESHOLD: 10,
} as const;

// Menu and UI types
export type MenuType = 'file' | 'toolbox' | null;

export type PropertiesTabType = 'general' | 'style' | 'text' | 'arrange';

// Application state interfaces
export interface AppState {
  activeMenu: MenuType;
  selectedElement: DrawElement | null;
  globalCopiedElements: DrawElement[];
  zoom: number;
  panOffset: { x: number; y: number };
}

// File operation types
export interface FileData {
  version: string;
  timestamp: string;
  tabs: DrawAreaTab[];
  metadata?: {
    appVersion: string;
    createdBy: string;
    [key: string]: unknown;
  };
}

// Error types
export interface AppError {
  code: string;
  message: string;
  category: 'file' | 'element' | 'clipboard' | 'ui' | 'validation';
  details?: unknown;
}

// Event types
export interface ElementChangeEvent {
  type: 'create' | 'update' | 'delete' | 'select' | 'deselect';
  element: DrawElement;
  previousElement?: DrawElement;
  timestamp: number;
}

export interface TabChangeEvent {
  fromTabId?: string;
  toTabId: string;
  timestamp: number;
}

// Utility types
export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type Rectangle = Point & Size;
export type Transform = { 
  rotation: number; 
  scale: number; 
  translate: Point; 
};

// Component prop types for better reusability
export interface BaseComponentProps {
  className?: string;
  'data-testid'?: string;
}

export interface DrawAreaProps extends BaseComponentProps {
  GRID_WIDTH: number;
  GRID_HEIGHT: number;
  GRID_SIZE: number;
  zoom: number;
}

export interface PropertiesPanelProps extends BaseComponentProps {
  drawAreaRef?: React.RefObject<DrawAreaRef | null>;
  selectedElement?: DrawElement | null;
  onElementChange?: (element: DrawElement | undefined) => void;
  onChangeName?: (elementId: string, name: string) => void;
}

// Validation schemas (for future use with libraries like Zod)
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Performance monitoring types
export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

// Feature flags (for gradual rollouts)
export interface FeatureFlags {
  enableAdvancedTextEditing: boolean;
  enableMultipleSelection: boolean;
  enableUndoRedo: boolean;
  enableRealTimeCollaboration: boolean;
}

// Default feature flags
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  enableAdvancedTextEditing: true,
  enableMultipleSelection: true,
  enableUndoRedo: false,
  enableRealTimeCollaboration: false,
} as const;
