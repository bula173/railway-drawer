/**
 * @file features-context.ts
 * @brief Context for optional/advanced features
 * @details Groups feature-specific controllers
 */

import type { ZoomController } from '../ui/zoom';
import type { ImageUploadController } from '../ui/image-upload';
import type { PasteImageController } from '../ui/paste-image';
import type { GridSnapController } from '../ui/grid-snap';
import type { ColorPickerController } from '../ui/color-picker';
import type { ColorPaletteController } from '../ui/color-palette';
import type { DuplicateOffsetController } from '../ui/duplicate-offset';
import type { ExportImageController } from '../ui/export-image';

/**
 * Optional features context
 * Replaces TabData feature-related properties
 */
export interface FeaturesContext {
  readonly tabId: string;
  readonly zoomController?: ZoomController;
  readonly imageUploadController?: ImageUploadController;
  readonly pasteImageController?: PasteImageController;
  readonly gridSnapController?: GridSnapController;
  readonly colorPickerController?: ColorPickerController;
  readonly colorPaletteController?: ColorPaletteController;
  readonly duplicateOffsetController?: DuplicateOffsetController;
  readonly exportImageController?: ExportImageController;
}

/**
 * Create features context
 */
export function createFeaturesContext(
  tabId: string,
  options: {
    zoomController?: ZoomController;
    imageUploadController?: ImageUploadController;
    pasteImageController?: PasteImageController;
    gridSnapController?: GridSnapController;
    colorPickerController?: ColorPickerController;
    colorPaletteController?: ColorPaletteController;
    duplicateOffsetController?: DuplicateOffsetController;
    exportImageController?: ExportImageController;
  } = {}
): FeaturesContext {
  return {
    tabId,
    ...options,
  };
}

/**
 * Check if a feature is available
 */
export function hasFeature(
  context: FeaturesContext,
  feature: keyof Omit<FeaturesContext, 'tabId'>
): boolean {
  return context[feature] !== undefined;
}
