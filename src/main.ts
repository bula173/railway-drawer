import '@maxgraph/core/css/common.css';
import './style.css';
import { Cell, Geometry } from '@maxgraph/core';
import { registerShapes, shapeRegistry, ShapeToolbar } from './shapes';
import { TabManager } from './ui/tabs';
import { objectToStyleString } from './utils/styleUtils';

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

    // Convert style object to maxGraph style string
    const styleStr = objectToStyleString(shape.style);

    // Create cell with proper style string
    const prototype = new Cell(shape.label, new Geometry(0, 0, shape.width, shape.height), styleStr as any);
    prototype.setVertex(true);

    const cellToImport = prototype.clone();
    if (cellToImport.geometry) {
      cellToImport.geometry.x = pt.x - shape.width / 2;
      cellToImport.geometry.y = pt.y - shape.height / 2;
    }

    activeTab.graph.batchUpdate(() => {
      const cells = activeTab.graph.importCells([cellToImport], 0, 0);
      activeTab.graph.setSelectionCells(cells);
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
