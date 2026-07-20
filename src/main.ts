import '@maxgraph/core/css/common.css';
import './style.css';
import { registerShapes, shapeRegistry, ShapeToolbar } from './shapes';
import { TabManager } from './ui/tabs';

// Register built-in shapes
registerShapes();

// ============= TAB MANAGER =============

const tabManager = new TabManager('tabs-container', 'graph-container');
tabManager.createTab('Diagram 1');

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

    // Create cell with style object (not string)
    const styleObj = shape.style as any;

    activeTab.graph.batchUpdate(() => {
      const cell = activeTab.graph.insertVertex(
        activeTab.graph.getDefaultParent(),
        null,
        shape.label,
        pt.x - shape.width / 2,
        pt.y - shape.height / 2,
        shape.width,
        shape.height,
        styleObj
      );
      activeTab.graph.setSelectionCells([cell]);
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

// ============= SHAPES TOOLBAR =============

const shapesContainer = document.getElementById('shapes-container')!;
// @ts-ignore
new ShapeToolbar(shapesContainer, shapeRegistry);

console.log('✓ Railway Drawer with tabs initialized');
