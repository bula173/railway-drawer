/**
 * @file main.ts
 * @brief Application entry point for Railway Drawer
 * @details
 * Initializes the entire Railway Drawer application including:
 * - Shape registration and toolbars
 * - Tab management for multiple diagrams
 * - UI components (stencils, panels, editors)
 * - Event handling (keyboard shortcuts, drag-drop)
 * - Application lifecycle management
 *
 * The application follows a modular architecture where each UI component
 * is responsible for its own initialization and event handling.
 *
 * @author Marcin Kwiatkowski
 * @version 0.6.0
 */

import '@maxgraph/core/css/common.css';
import './style.css';
import { registerShapes, shapeRegistry, ShapeToolbar } from './shapes';
import { ShortcutsHelpController } from './ui/shortcuts-help';
import { TabManager } from './ui/tabs';
import { StencilManager } from './ui/stencil-manager';
import { LeftPanelTabs } from './ui/left-panel-tabs';
import { CacheService } from './services/cache-service';
import { ProjectNameEditor } from './ui/project-name-editor';
import { ResizablePanels } from './ui/resizable-panels';
import { BUILD_ID, BUILD_TIME } from './config/build-id';
import { ShapeDesignerController } from './ui/shape-designer';
import { CustomShapeToolbar } from './ui/custom-shape-toolbar';
import { globalNotificationManager } from './ui/notification';
import { globalSaveStatusIndicator } from './ui/save-status';
import { ServiceRegistry } from './services/service-registry';
import { globalErrorHandler } from './services/error-handler';

/**
 * @brief Register all built-in shape definitions
 * @details Initializes the global shape registry with railway, UML, flowchart,
 * and other predefined shapes. This must be called before creating any diagrams.
 */
try {
  registerShapes();
  globalNotificationManager.success('✓ Railway Drawer initialized');
} catch (error) {
  globalErrorHandler.handleShapeError(error instanceof Error ? error : new Error(String(error)), true);
  globalNotificationManager.error('Failed to load shapes - some shapes may be unavailable');
}

/**
 * @brief Initialize keyboard shortcuts help dialog
 * @details Provides a modal dialog showing all available keyboard shortcuts
 * and commands to the user.
 */
new ShortcutsHelpController();

// ============= PROJECT NAME EDITOR =============

/**
 * @brief Initialize project name editor
 * @details Allows users to edit and display the current project name
 * in the application header.
 */
new ProjectNameEditor();

// ============= RESIZABLE PANELS =============

/**
 * @brief Initialize resizable panel system
 * @details Enables users to resize and rearrange the left panel, right panel,
 * and main graph canvas area using drag-enabled dividers.
 */
new ResizablePanels();

// ============= TAB MANAGER =============

/**
 * @brief Initialize tab manager for multi-diagram support
 * @details Manages multiple diagram tabs, allowing users to create, switch,
 * save, and load different diagrams within the same session.
 * The active tab provides access to the graph instance and command services.
 */
const tabManager = new TabManager('tabs-container', 'graph-container');
// Register with service registry instead of polluting window object
ServiceRegistry.setTabManager(tabManager);
ServiceRegistry.setNotificationManager(globalNotificationManager);
ServiceRegistry.setSaveStatusIndicator(globalSaveStatusIndicator);
// Register error handler (it's active via global event listeners)
ServiceRegistry.register('errorHandler', globalErrorHandler);

/**
 * @brief Restore previous session from cache or create new diagram
 * @details If the application was previously used, restores all tabs and their
 * content from browser cache. Otherwise, creates a new empty diagram for the user.
 */
try {
  if (CacheService.exists()) {
    tabManager.restoreFromCache();
    globalNotificationManager.success('Restored previous diagrams');
  } else {
    tabManager.createTab('Diagram 1');
  }
} catch (error) {
  console.error('Failed to restore from cache:', error);
  globalNotificationManager.error('Failed to restore diagrams. Starting fresh.');
  tabManager.createTab('Diagram 1');
}

/**
 * @brief Set build ID and timestamp in status bar
 * @details Displays the current build identifier (git commit hash or 'dev')
 * and the build timestamp (date and time)
 */
const activeTab = tabManager.getActiveTab();
if (activeTab?.statusBarController) {
  activeTab.statusBarController.setBuildId(BUILD_ID);
  activeTab.statusBarController.setBuildDate(BUILD_TIME);
}

// ============= GLOBAL KEYBOARD SHORTCUTS =============

/**
 * @brief Global keyboard shortcut handler
 * @details Manages application-wide keyboard shortcuts:
 * - Ctrl/Cmd+Z: Undo
 * - Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z: Redo
 * - Ctrl/Cmd+C: Copy
 * - Ctrl/Cmd+X: Cut
 * - Ctrl/Cmd+V: Paste
 * - Ctrl/Cmd+A: Select all
 * - Delete: Delete selected items
 * - Escape: Clear selection
 *
 * Shortcuts are ignored when the user is editing text in input fields.
 */
document.addEventListener('keydown', (e) => {
  // Only handle shortcuts when not typing in an input
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
    return;
  }

  const activeTab = tabManager.getActiveTab();
  if (!activeTab) return;

  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    activeTab.graphCommandService.undo();
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
    e.preventDefault();
    activeTab.graphCommandService.redo();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
    e.preventDefault();
    activeTab.graphCommandService.copy();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
    e.preventDefault();
    activeTab.graphCommandService.cut();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
    e.preventDefault();
    activeTab.graphCommandService.paste();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
    e.preventDefault();
    activeTab.graph.selectAll();
  }
  if (e.key === 'Delete') {
    e.preventDefault();
    activeTab.graphCommandService.delete();
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    activeTab.graph.clearSelection();
  }
}, true);

/**
 * @brief Application cleanup handler
 * @details Ensures all resources are properly released when the page is unloaded,
 * including disposing of graphs, removing event listeners, and clearing cached data.
 */
window.addEventListener('beforeunload', () => {
  try {
    tabManager.destroy();
    globalSaveStatusIndicator.destroy();
    globalNotificationManager.destroy();
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
});

// ============= DROP HANDLER =============

/**
 * @brief Handle drag-and-drop of shapes onto the canvas
 * @details Enables users to drag shapes from the toolbox or stencils panel
 * and drop them onto the graph canvas. The shape is inserted at the drop location.
 */
const graphContainer = document.getElementById('graph-container')!;

/**
 * @brief Process drop event for shape insertion
 * @details Converts the drag coordinates to graph coordinates and creates
 * a new cell (vertex or shape) at the drop location.
 * @param {DragEvent} evt - The drop event with shape data in dataTransfer
 */
graphContainer.addEventListener('drop', (evt) => {
  graphContainer.classList.remove('drag-over');

  const shapeJson = evt.dataTransfer?.getData('application/x-shape-json');
  const customShapeJson = evt.dataTransfer?.getData('application/x-custom-shape');

  if (shapeJson || customShapeJson) {
    evt.preventDefault();

    const activeTab = tabManager.getActiveTab();
    if (!activeTab) return;

    // Convert to graph coordinates
    const pt = activeTab.graph.getPointForEvent(evt as any);

    activeTab.graph.batchUpdate(() => {
      if (shapeJson) {
        const shape = JSON.parse(shapeJson);
        if (shape.type === 'vertex') {
          const cell = activeTab.graph.insertVertex(
            activeTab.graph.getDefaultParent(),
            null,
            '',
            pt.x - shape.width / 2,
            pt.y - shape.height / 2,
            shape.width,
            shape.height,
            shape.style as any
          );
          activeTab.graph.setSelectionCells([cell]);
        }
      } else if (customShapeJson) {
        // Handle custom shape drop
        const customShape = JSON.parse(customShapeJson);
        const svgDataUrl = `data:image/svg+xml,${encodeURIComponent(
          `<svg viewBox="0 0 ${customShape.width} ${customShape.height}" xmlns="http://www.w3.org/2000/svg">
            <path d="${customShape.svgPath}" fill="${customShape.fillColor}" stroke="${customShape.strokeColor}" stroke-width="${customShape.strokeWidth}"/>
          </svg>`
        )}`;

        const cell = activeTab.graph.insertVertex(
          activeTab.graph.getDefaultParent(),
          null,
          '',
          pt.x - customShape.width / 2,
          pt.y - customShape.height / 2,
          customShape.width,
          customShape.height,
          {
            shape: 'image',
            image: svgDataUrl,
            html: false,
          } as any
        );
        activeTab.graph.setSelectionCells([cell]);
      }
    });
  }
}, false);

/**
 * @brief Handle drag-over to enable drop zone highlighting
 * @details Prevents default drag behavior and adds visual feedback
 * to indicate the canvas is a valid drop target.
 * @param {DragEvent} evt - The dragover event
 */
graphContainer.addEventListener('dragover', (evt) => {
  evt.preventDefault();
  graphContainer.classList.add('drag-over');
}, false);

/**
 * @brief Handle drag-leave to remove drop zone highlighting
 * @details Removes visual feedback when the user drags away from the canvas.
 * @param {DragEvent} evt - The dragleave event
 */
graphContainer.addEventListener('dragleave', (evt) => {
  if (evt.target === graphContainer) {
    graphContainer.classList.remove('drag-over');
  }
}, false);

// ============= LEFT PANEL TABS =============

/**
 * @brief Initialize left sidebar tab system
 * @details Manages the tabbed interface for the left panel, allowing users
 * to switch between Shapes, Stencils, and Layers views.
 */
const leftPanelTabs = new LeftPanelTabs('leftpanel-container');
/**
 * @brief Register left panel tab content areas
 * @details Associates tab buttons with their corresponding content containers
 * for shapes, stencils, and layers panels.
 */
leftPanelTabs.registerTabContent('shapes', 'shapes-container');
leftPanelTabs.registerTabContent('stencils', 'stencils-container');
leftPanelTabs.registerTabContent('layers', 'layers-panel');

// ============= SHAPES TOOLBAR & STENCILS =============

/**
 * @brief Initialize shape toolbar
 * @details Creates a dynamic toolbar displaying all available shapes organized by group,
 * with draggable items that can be dropped onto the canvas.
 */
const shapesContainer = document.getElementById('shapes-container')!;
const shapeToolbar = new ShapeToolbar(shapesContainer, shapeRegistry);

/**
 * @brief Initialize stencil manager for shape group visibility
 * @details Allows users to toggle visibility and filtering of shape groups
 * such as Railway, UML, Flowchart, BPMN, etc.
 */
const stencilManager = new StencilManager('stencils-container');

/**
 * @brief Register all available shape groups as stencils
 * @details Dynamically discovers all shape groups from the registry and
 * creates corresponding stencil entries that can be toggled on/off.
 */
shapeRegistry.getGroups().forEach((group) => {
  stencilManager.registerStencil(group, group, true);
});

/**
 * @brief Wire stencil visibility changes to toolbar updates
 * @details When the user toggles stencil visibility, updates the toolbar
 * to show only shapes from enabled groups.
 */
stencilManager.setOnToggle(() => {
  const enabledGroups = new Set<string>();
  shapeRegistry.getGroups().forEach((group) => {
    if (stencilManager.isEnabled(group)) {
      enabledGroups.add(group);
    }
  });
  shapeToolbar.setEnabledGroups(enabledGroups);
});

// ============= CUSTOM SHAPES =============

/**
 * @brief Initialize custom shape designer and toolbar
 * @details Allows users to create and manage custom shapes with visual editor
 * and real-time preview. Custom shapes are stored persistently and can be
 * dragged onto the canvas like built-in shapes.
 */
const activeTabForShapes = tabManager.getActiveTab();
if (activeTabForShapes) {
  const shapeDesigner = new ShapeDesignerController(activeTabForShapes.graph);
  const customShapeToolbar = new CustomShapeToolbar('shapes-container');

  // Wire up event listeners for opening shape designer
  window.addEventListener('open-shape-designer', () => {
    shapeDesigner.openDesigner();
  });

  window.addEventListener('edit-custom-shape', (e: any) => {
    shapeDesigner.openDesigner(e.detail?.shapeId);
  });

  // Refresh custom shapes when tab changes
  window.addEventListener('tab-changed', () => {
    customShapeToolbar.refresh();
  });

  // Services are registered in ServiceRegistry, no need for window globals
  ServiceRegistry.register('shapeDesigner', shapeDesigner);
  ServiceRegistry.register('customShapeToolbar', customShapeToolbar);
}

/**
 * @brief Application initialization complete
 * @details All major components have been initialized and are ready for user interaction.
 * The application is now fully functional.
 */
console.log('✓ Railway Drawer with tabs, stencils, and custom shapes initialized');
