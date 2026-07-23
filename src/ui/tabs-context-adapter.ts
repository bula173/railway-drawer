/**
 * @file tabs-context-adapter.ts
 * @brief Adapter to convert between TabData and TabContext
 * @details Enables gradual migration from TabData to context-based architecture
 */

import type { TabData } from './tabs';
import type {
  TabContext,
  GraphContext,
  UIContext,
  EditingContext,
  HelpersContext,
  FeaturesContext,
} from '../contexts';
import {
  createGraphContext,
  createUIContext,
  createEditingContext,
  createHelpersContext,
  createFeaturesContext,
  createTabContext,
} from '../contexts';

/**
 * Convert TabData to TabContext (new architecture)
 * Enables new code to use context-based approach
 */
export function tabDataToContext(tabData: TabData): TabContext {
  const graphCtx: GraphContext = createGraphContext(
    tabData.id,
    tabData.graph,
    tabData.graphCommandService
  );

  const uiCtx: UIContext = createUIContext(
    tabData.id,
    tabData.propertiesPanel,
    tabData.toolbarController,
    tabData.statusBarController,
    tabData.menuController,
    tabData.contextMenuController
  );

  const editingCtx: EditingContext = createEditingContext(
    tabData.id,
    tabData.drawingController,
    tabData.groupingController,
    tabData.alignmentController,
    tabData.transformController,
    tabData.layersController
  );

  const helpersCtx: HelpersContext = createHelpersContext(
    tabData.id,
    tabData.clipboardController,
    tabData.deleteController,
    tabData.undoRedoController,
    tabData.panController,
    tabData.gridController,
    tabData.saveLoadController,
    tabData.canvasProperties,
    tabData.interactiveUIController
  );

  const featuresCtx: FeaturesContext = createFeaturesContext(tabData.id, {
    zoomController: tabData.zoomController,
    imageUploadController: tabData.imageUploadController,
    pasteImageController: tabData.pasteImageController,
    gridSnapController: tabData.gridSnapController,
    colorPickerController: tabData.colorPickerController,
    colorPaletteController: tabData.colorPaletteController,
    duplicateOffsetController: tabData.duplicateOffsetController,
    exportImageController: tabData.exportImageController,
  });

  return createTabContext(
    tabData.id,
    tabData.name,
    graphCtx,
    uiCtx,
    editingCtx,
    helpersCtx,
    featuresCtx
  );
}

/**
 * Convert TabContext back to TabData (backward compatibility)
 * Enables old code to use new context-based tabs
 */
export function contextToTabData(context: TabContext): TabData {
  return {
    id: context.id,
    name: context.name,
    graph: context.graph.graph,
    graphCommandService: context.graph.graphCommandService,
    propertiesPanel: context.ui.propertiesPanel,
    toolbarController: context.ui.toolbarController,
    statusBarController: context.ui.statusBarController,
    clipboardController: context.helpers.clipboardController,
    deleteController: context.helpers.deleteController,
    undoRedoController: context.helpers.undoRedoController,
    panController: context.helpers.panController,
    gridController: context.helpers.gridController,
    saveLoadController: context.helpers.saveLoadController,
    canvasProperties: context.helpers.canvasProperties,
    contextMenuController: context.ui.contextMenuController,
    menuController: context.ui.menuController,
    interactiveUIController: context.helpers.interactiveUIController,
    drawingController: context.editing.drawingController,
    connectionHandler: undefined as any,
    textEditorController: undefined as any,
    edgePropertiesController: undefined as any,
    layersController: context.editing.layersController,
    imageUploadController: context.features.imageUploadController,
    pasteImageController: context.features.pasteImageController,
    zoomController: context.features.zoomController,
    alignmentController: context.editing.alignmentController,
    groupingController: context.editing.groupingController,
    transformController: context.editing.transformController,
    gridSnapController: context.features.gridSnapController,
    colorPickerController: context.features.colorPickerController,
    colorPaletteController: context.features.colorPaletteController,
    duplicateOffsetController: context.features.duplicateOffsetController,
    exportImageController: context.features.exportImageController,
  } as TabData;
}

/**
 * Middleware to add context support to existing TabData
 * Usage: const ctx = withContext(tabData)
 */
export function withContext(tabData: TabData): TabData & { __context: TabContext } {
  return Object.assign(tabData, {
    __context: tabDataToContext(tabData),
  });
}
