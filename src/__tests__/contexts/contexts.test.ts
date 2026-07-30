/**
 * @file contexts.test.ts
 * @brief Tests for context creation and management
 */

import {
  createGraphContext,
  createUIContext,
  createEditingContext,
  createHelpersContext,
  createFeaturesContext,
  createTabContext,
} from '../../contexts';
import type { GraphContext, UIContext, EditingContext, HelpersContext, FeaturesContext } from '../../contexts';

describe('Contexts', () => {
  describe('GraphContext', () => {
    it('should create graph context', () => {
      const mockGraph = { destroy: () => {} } as any;
      const mockCommandService = {} as any;

      const context = createGraphContext('tab-1', mockGraph, mockCommandService);

      expect(context.id).toBe('tab-1');
      expect(context.graph).toBe(mockGraph);
      expect(context.graphCommandService).toBe(mockCommandService);
    });
  });

  describe('UIContext', () => {
    it('should create UI context', () => {
      const mockControllers = {
        propertiesPanel: {} as any,
        toolbarController: {} as any,
        statusBarController: {} as any,
        menuController: {} as any,
        contextMenuController: {} as any,
      };

      const context = createUIContext(
        'tab-1',
        mockControllers.propertiesPanel,
        mockControllers.toolbarController,
        mockControllers.statusBarController,
        mockControllers.menuController,
        mockControllers.contextMenuController
      );

      expect(context.tabId).toBe('tab-1');
      expect(context.propertiesPanel).toBe(mockControllers.propertiesPanel);
      expect(context.toolbarController).toBe(mockControllers.toolbarController);
    });
  });

  describe('EditingContext', () => {
    it('should create editing context', () => {
      const mockControllers = {
        drawingController: {} as any,
        groupingController: {} as any,
        alignmentController: {} as any,
        transformController: {} as any,
        layersController: {} as any,
      };

      const context = createEditingContext(
        'tab-1',
        mockControllers.drawingController,
        mockControllers.groupingController,
        mockControllers.alignmentController,
        mockControllers.transformController,
        mockControllers.layersController
      );

      expect(context.tabId).toBe('tab-1');
      expect(context.drawingController).toBe(mockControllers.drawingController);
      expect(context.groupingController).toBe(mockControllers.groupingController);
    });
  });

  describe('HelpersContext', () => {
    it('should create helpers context', () => {
      const mockControllers = {
        clipboardController: {} as any,
        deleteController: {} as any,
        undoRedoController: {} as any,
        panController: {} as any,
        gridController: {} as any,
        saveLoadController: {} as any,
        canvasProperties: {} as any,
        interactiveUIController: {} as any,
      };

      const context = createHelpersContext(
        'tab-1',
        mockControllers.clipboardController,
        mockControllers.deleteController,
        mockControllers.undoRedoController,
        mockControllers.panController,
        mockControllers.gridController,
        mockControllers.saveLoadController,
        mockControllers.canvasProperties,
        mockControllers.interactiveUIController
      );

      expect(context.tabId).toBe('tab-1');
      expect(context.clipboardController).toBe(mockControllers.clipboardController);
    });
  });

  describe('FeaturesContext', () => {
    it('should create features context with all features', () => {
      const mockFeatures = {
        zoomController: {} as any,
        imageUploadController: {} as any,
        pasteImageController: {} as any,
        gridSnapController: {} as any,
        colorPickerController: {} as any,
        colorPaletteController: {} as any,
        duplicateOffsetController: {} as any,
        exportImageController: {} as any,
      };

      const context = createFeaturesContext('tab-1', mockFeatures);

      expect(context.tabId).toBe('tab-1');
      expect(context.zoomController).toBe(mockFeatures.zoomController);
      expect(context.imageUploadController).toBe(mockFeatures.imageUploadController);
    });

    it('should create features context with partial features', () => {
      const context = createFeaturesContext('tab-1', {
        zoomController: {} as any,
      });

      expect(context.tabId).toBe('tab-1');
      expect(context.zoomController).toBeDefined();
      expect(context.imageUploadController).toBeUndefined();
    });
  });

  describe('TabContext', () => {
    it('should create complete tab context', () => {
      const mockGraph = createGraphContext('tab-1', {} as any, {} as any);
      const mockUI = createUIContext(
        'tab-1',
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any
      );
      const mockEditing = createEditingContext(
        'tab-1',
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any
      );
      const mockHelpers = createHelpersContext(
        'tab-1',
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any
      );
      const mockFeatures = createFeaturesContext('tab-1');

      const context = createTabContext('tab-1', 'Test Tab', mockGraph, mockUI, mockEditing, mockHelpers, mockFeatures);

      expect(context.id).toBe('tab-1');
      expect(context.name).toBe('Test Tab');
      expect(context.graph).toBe(mockGraph);
      expect(context.ui).toBe(mockUI);
      expect(context.editing).toBe(mockEditing);
      expect(context.helpers).toBe(mockHelpers);
      expect(context.features).toBe(mockFeatures);
    });
  });

  describe('context immutability', () => {
    it('should create readonly contexts', () => {
      const context = createGraphContext('tab-1', {} as any, {} as any);

      // TypeScript should prevent reassignment
      expect(() => {
        (context as any).id = 'new-id';
      }).toThrow();
    });
  });
});
