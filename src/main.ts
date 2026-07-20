import '@maxgraph/core/css/common.css';
import './style.css';
import { Graph, Cell, Geometry } from '@maxgraph/core';
import { PropertiesPanel } from './ui/properties';
import { ToolbarController } from './ui/toolbar';
import { StatusBarController } from './ui/statusbar';
import { registerShapes, shapeRegistry, ShapeToolbar } from './shapes';

// Register built-in shapes
registerShapes();

// ============= GRAPH INITIALIZATION =============

const graphContainer = document.getElementById('graph-container')!;
// Use undefined to let maxGraph use its default plugins (includes resize handlers)
const graph = new Graph(graphContainer);

// Enable core features
graph.cellsMovable = true;
graph.cellsResizable = true;
graph.cellsEditable = false;
graph.cellsSelectable = true;
graph.setConnectable(true);
graph.dropEnabled = true;
graph.setMultigraph(false);

// Handle drops from shapes toolbar
graphContainer.addEventListener('drop', (evt) => {
  graphContainer.classList.remove('drag-over');

  const shapeJson = evt.dataTransfer?.getData('application/x-shape-json');
  if (shapeJson) {
    evt.preventDefault();
    const shape = JSON.parse(shapeJson);

    // Convert to graph coordinates
    const pt = graph.getPointForEvent(evt as any);

    // Create cell
    const prototype = new Cell(shape.label, new Geometry(0, 0, shape.width, shape.height), shape.style);
    prototype.setVertex(true);

    const cellToImport = prototype.clone();
    if (cellToImport.geometry) {
      cellToImport.geometry.x = pt.x - shape.width / 2;
      cellToImport.geometry.y = pt.y - shape.height / 2;
    }

    graph.batchUpdate(() => {
      const cells = graph.importCells([cellToImport], 0, 0);
      graph.setSelectionCells(cells);
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

// ============= UI CONTROLLERS =============

// Controllers initialize their own event listeners in constructors
// @ts-ignore - Intentionally unused, initializes via constructor
new PropertiesPanel(graph, 'property-content');
// @ts-ignore
new ToolbarController(graph);
// @ts-ignore
new StatusBarController(graph);

console.log('✓ Railway Drawer initialized');
