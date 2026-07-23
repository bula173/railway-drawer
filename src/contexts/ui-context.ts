/**
 * @file ui-context.ts
 * @brief UI context for UI state and controllers
 * @details Separates UI concerns from graph concerns
 */

import type { PropertiesPanel } from '../ui/properties';
import type { ToolbarController } from '../ui/toolbar';
import type { StatusBarController } from '../ui/statusbar';
import type { MenuController } from '../ui/menu';
import type { ContextMenuController } from '../ui/context-menu';

/**
 * UI controller context
 * Replaces TabData UI-related properties
 */
export interface UIContext {
  readonly tabId: string;
  readonly propertiesPanel: PropertiesPanel;
  readonly toolbarController: ToolbarController;
  readonly statusBarController: StatusBarController;
  readonly menuController: MenuController;
  readonly contextMenuController: ContextMenuController;
}

/**
 * Create UI context
 */
export function createUIContext(
  tabId: string,
  propertiesPanel: PropertiesPanel,
  toolbarController: ToolbarController,
  statusBarController: StatusBarController,
  menuController: MenuController,
  contextMenuController: ContextMenuController
): UIContext {
  return {
    tabId,
    propertiesPanel,
    toolbarController,
    statusBarController,
    menuController,
    contextMenuController,
  };
}

/**
 * Minimal UI state interface
 */
export interface UIState {
  zoom: number;
  panX: number;
  panY: number;
  selectedCellIds: string[];
  isDarkMode: boolean;
  gridEnabled: boolean;
  gridSize: number;
}

/**
 * Create initial UI state
 */
export function createInitialUIState(): UIState {
  return {
    zoom: 1,
    panX: 0,
    panY: 0,
    selectedCellIds: [],
    isDarkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
    gridEnabled: true,
    gridSize: 10,
  };
}
