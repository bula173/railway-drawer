/**
 * @file editing-context.ts
 * @brief Context for editing operations and related controllers
 * @details Groups all editing-related functionality
 */

import type { DrawingController } from '../ui/drawing';
import type { GroupingController } from '../ui/grouping';
import type { AlignmentController } from '../ui/alignment';
import type { TransformController } from '../ui/transform';
import type { LayersController } from '../ui/layers';

/**
 * Editing context containing all editing-related controllers
 * Replaces TabData editing-related properties
 */
export interface EditingContext {
  readonly tabId: string;
  readonly drawingController: DrawingController;
  readonly groupingController: GroupingController;
  readonly alignmentController: AlignmentController;
  readonly transformController: TransformController;
  readonly layersController: LayersController;
}

/**
 * Create editing context
 */
export function createEditingContext(
  tabId: string,
  drawingController: DrawingController,
  groupingController: GroupingController,
  alignmentController: AlignmentController,
  transformController: TransformController,
  layersController: LayersController
): EditingContext {
  return {
    tabId,
    drawingController,
    groupingController,
    alignmentController,
    transformController,
    layersController,
  };
}

/**
 * Editing mode type
 */
export type EditingMode = 'select' | 'draw' | 'text' | 'transform';

/**
 * Editing state
 */
export interface EditingState {
  mode: EditingMode;
  isEditing: boolean;
  selectedCount: number;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Create initial editing state
 */
export function createInitialEditingState(): EditingState {
  return {
    mode: 'select',
    isEditing: false,
    selectedCount: 0,
    canUndo: false,
    canRedo: false,
  };
}
