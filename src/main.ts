import '@maxgraph/core/css/common.css';
import './style.css';
import { registerShapes, shapeRegistry, ShapeToolbar } from './shapes';
import { TabManager } from './ui/tabs';
import { StencilManager } from './ui/stencil-manager';
import { LeftPanelTabs } from './ui/left-panel-tabs';
import { CacheService } from './services/cache-service';
import { ProjectNameEditor } from './ui/project-name-editor';
import { ResizablePanels } from './ui/resizable-panels';

// Register built-in shapes
registerShapes();

// ============= PROJECT NAME EDITOR =============

new ProjectNameEditor();

// ============= RESIZABLE PANELS =============

new ResizablePanels();

// ============= TAB MANAGER =============

const tabManager = new TabManager('tabs-container', 'graph-container');
(window as any).__tabManager = tabManager;

// Restore from cache or create new tab
if (CacheService.exists()) {
  tabManager.restoreFromCache();
} else {
  tabManager.createTab('Diagram 1');
}

// ============= GLOBAL KEYBOARD SHORTCUTS =============

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
  if (e.key === 'Delete') {
    e.preventDefault();
    activeTab.graphCommandService.delete();
  }
}, true);

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  tabManager.destroy();
});

// ============= DROP HANDLER =============

const graphContainer = document.getElementById('graph-container')!;

graphContainer.addEventListener('drop', (evt) => {
  graphContainer.classList.remove('drag-over');

  const shapeJson = evt.dataTransfer?.getData('application/x-shape-json');
  if (shapeJson) {
    evt.preventDefault();
    const shape = JSON.parse(shapeJson);

    const activeTab = tabManager.getActiveTab();
    if (!activeTab) return;

    // Convert to graph coordinates
    const pt = activeTab.graph.getPointForEvent(evt as any);

    // Create cell based on shape type
    activeTab.graph.batchUpdate(() => {
      if (shape.type === 'vertex') {
        // ===== VERTEX-BASED SHAPE =====
        // Native maxGraph shape extending Shape class
        // Rendered directly via custom paintVertexShape() method
        // CellRenderer looks up the custom shape class from the style.shape property
        const cell = activeTab.graph.insertVertex(
          activeTab.graph.getDefaultParent(),
          null,
          shape.label,
          pt.x - shape.width / 2,
          pt.y - shape.height / 2,
          shape.width,
          shape.height,
          shape.style as any
        );
        activeTab.graph.setSelectionCells([cell]);
      } else if (shape.type === 'svg') {
        // ===== SVG-BASED SHAPE =====
        // Pure SVG rendered as maxGraph image shape
        // Style contains: shape: 'image', image: <data:image/svg+xml;base64,...>
        // maxGraph renders as <image> element with SVG data URL
        const cell = activeTab.graph.insertVertex(
          activeTab.graph.getDefaultParent(),
          null,
          shape.label,
          pt.x - shape.width / 2,
          pt.y - shape.height / 2,
          shape.width,
          shape.height,
          shape.style as any  // Contains SVG data URL
        );
        activeTab.graph.setSelectionCells([cell]);
      } else {
        console.warn(`Unknown shape type: ${shape.type}`);
      }
    });
  }
}, false);

graphContainer.addEventListener('dragover', (evt) => {
  evt.preventDefault();
  graphContainer.classList.add('drag-over');
}, false);

graphContainer.addEventListener('dragleave', (evt) => {
  if (evt.target === graphContainer) {
    graphContainer.classList.remove('drag-over');
  }
}, false);

// ============= LEFT PANEL TABS =============

const leftPanelTabs = new LeftPanelTabs('leftpanel-container');
leftPanelTabs.registerTabContent('shapes', 'shapes-container');
leftPanelTabs.registerTabContent('stencils', 'stencils-container');
leftPanelTabs.registerTabContent('layers', 'layers-panel');

// ============= SHAPES TOOLBAR & STENCILS =============

const shapesContainer = document.getElementById('shapes-container')!;
const shapeToolbar = new ShapeToolbar(shapesContainer, shapeRegistry);

// Initialize stencil manager in stencils tab
const stencilManager = new StencilManager('stencils-container');

// Register all available stencil groups
shapeRegistry.getGroups().forEach((group) => {
  stencilManager.registerStencil(group, group, true);
});

// Wire stencil toggling to toolbar
stencilManager.setOnToggle(() => {
  const enabledGroups = new Set<string>();
  shapeRegistry.getGroups().forEach((group) => {
    if (stencilManager.isEnabled(group)) {
      enabledGroups.add(group);
    }
  });
  shapeToolbar.setEnabledGroups(enabledGroups);
});

console.log('✓ Railway Drawer with tabs and stencils initialized');
