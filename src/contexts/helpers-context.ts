/**
 * @file helpers-context.ts
 * @brief Context for helper/utility controllers
 * @details Groups utility and helper functionality
 */

import type { ClipboardController } from '../ui/clipboard';
import type { DeleteController } from '../ui/delete';
import type { UndoRedoController } from '../ui/undoredo';
import type { PanController } from '../ui/pan';
import type { GridController } from '../ui/grid';
import type { SaveLoadController } from '../ui/saveload';
import type { CanvasProperties } from '../ui/canvas-properties';
import type { InteractiveUIController } from '../ui/interactive-ui';

/**
 * Helper/utility controller context
 * Replaces TabData helper-related properties
 */
export interface HelpersContext {
  readonly tabId: string;
  readonly clipboardController: ClipboardController;
  readonly deleteController: DeleteController;
  readonly undoRedoController: UndoRedoController;
  readonly panController: PanController;
  readonly gridController: GridController;
  readonly saveLoadController: SaveLoadController;
  readonly canvasProperties: CanvasProperties;
  readonly interactiveUIController: InteractiveUIController;
}

/**
 * Create helpers context
 */
export function createHelpersContext(
  tabId: string,
  clipboardController: ClipboardController,
  deleteController: DeleteController,
  undoRedoController: UndoRedoController,
  panController: PanController,
  gridController: GridController,
  saveLoadController: SaveLoadController,
  canvasProperties: CanvasProperties,
  interactiveUIController: InteractiveUIController
): HelpersContext {
  return {
    tabId,
    clipboardController,
    deleteController,
    undoRedoController,
    panController,
    gridController,
    saveLoadController,
    canvasProperties,
    interactiveUIController,
  };
}
