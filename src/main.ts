import '@maxgraph/core/css/common.css';
import './style.css';
import { Editor, Cell } from '@maxgraph/core';
import configXml from './config/railwayConfig.xml?raw';
import { searchShapes, getShapeByName, SHAPES_LIBRARY } from './shapes-library';
import { createShapeIcon } from './shape-renderer';
import { loadDrawioFile, mergeShapeLibraries } from './drawio-importer';
import { CommandHistory, SetCellValueCommand, SetGeometryCommand, RemoveCellsCommand, InsertCellCommand } from './command-history';
import { GridManager } from './grid-manager';
import { ConnectorTool } from './connector-tool';
import { SelectionManager } from './selection-manager';
import { AlignmentTools } from './alignment-tools';

// Parse editor configuration
const parser = new DOMParser();
const configElement = parser.parseFromString(configXml, 'text/xml').documentElement;

// Create editor instance
const editor = new Editor(configElement);

// Command history for undo/redo
const history = new CommandHistory();

// Grid manager
const grid = new GridManager(10, true, true);

// Connector tool
const connectorTool = new ConnectorTool(editor.graph);

// Selection manager for multi-select
const selectionManager = new SelectionManager(editor.graph);

// Alignment tools
const alignmentTools = new AlignmentTools(editor.graph);

// App state
let currentTool = 'select';
let selectedCell: Cell | null = null;
let isMouseDown = false;
let mouseDownX = 0;
let mouseDownY = 0;

// ============= UI SETUP =============

const container = document.getElementById('editor-container')!;

// Menu bar
const menuBar = document.createElement('div');
menuBar.className = 'menu-bar';
const menuItems = [
  { label: 'File', actions: ['New', 'Open', 'Save', 'Export as PNG', 'Import Shapes'] },
  { label: 'Edit', actions: ['Undo', 'Redo', 'Cut', 'Copy', 'Paste', 'Delete'] },
  { label: 'View', actions: ['Zoom In', 'Zoom Out', 'Fit', 'Reset View'] },
  {
    label: 'Format',
    actions: [
      'Align Left',
      'Align Center',
      'Align Right',
      'Align Top',
      'Align Middle',
      'Align Bottom',
      'Distribute Horizontally',
      'Distribute Vertically',
    ],
  },
];

// App state for imported shapes
let importedShapes = [...SHAPES_LIBRARY];
menuItems.forEach(({ label, actions }) => {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.className = 'menu-item';
  btn.addEventListener('click', () => showMenu(label, actions, btn));
  menuBar.appendChild(btn);
});
container.appendChild(menuBar);

// Top toolbar
const topToolbar = document.createElement('div');
topToolbar.className = 'top-toolbar';
const toolbarButtons = [
  { id: 'btn-undo', label: '↺', title: 'Undo (Ctrl+Z)' },
  { id: 'btn-redo', label: '↻', title: 'Redo (Ctrl+Y)' },
  { id: 'btn-sep1', label: '|', style: 'separator' },
  { id: 'btn-zoom-in', label: '🔍+', title: 'Zoom In' },
  { id: 'btn-zoom-out', label: '🔍-', title: 'Zoom Out' },
  { id: 'btn-fit', label: '⊡', title: 'Fit' },
  { id: 'btn-sep2', label: '|', style: 'separator' },
  { id: 'btn-grid', label: '⊞', title: 'Toggle Grid (G)', active: true },
  { id: 'btn-snap', label: '◆', title: 'Toggle Snap (S)', active: true },
  { id: 'btn-sep3', label: '|', style: 'separator' },
  { id: 'btn-select', label: '→', title: 'Select Tool' },
  { id: 'btn-connect', label: '⟿', title: 'Connection Tool' },
];

toolbarButtons.forEach(({ id, label, title, style, active }) => {
  const btn = document.createElement('button');
  btn.id = id;
  btn.textContent = label;
  btn.title = title || '';
  btn.className = style === 'separator' ? 'toolbar-separator' : 'toolbar-btn';
  btn.disabled = style === 'separator';
  if (active) btn.classList.add('active');
  topToolbar.appendChild(btn);
});
container.appendChild(topToolbar);

// Workspace
const workspace = document.createElement('div');
workspace.className = 'workspace';
container.appendChild(workspace);

// Left panel - Shapes with categories
const leftPanel = document.createElement('div');
leftPanel.className = 'left-panel';

// Search box
const searchBox = document.createElement('input');
searchBox.type = 'text';
searchBox.placeholder = 'Type / to search';
searchBox.className = 'shape-search';
leftPanel.appendChild(searchBox);

// Shapes container
const shapesContainer = document.createElement('div');
shapesContainer.className = 'shapes-container';
leftPanel.appendChild(shapesContainer);

// Build shape categories
function buildShapeCategories() {
  shapesContainer.innerHTML = '';

  // Get unique categories from imported shapes
  const categorySet = new Set<string>();
  importedShapes.forEach((shape) => {
    categorySet.add(shape.category);
  });
  const categories = Array.from(categorySet).sort();

  categories.forEach((category) => {
    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'shape-category';

    const categoryTitle = document.createElement('div');
    categoryTitle.className = 'category-title';
    categoryTitle.innerHTML = `<span class="category-toggle">▼</span> ${category}`;
    categoryDiv.appendChild(categoryTitle);

    const shapesGrid = document.createElement('div');
    shapesGrid.className = 'shapes-grid';
    shapesGrid.style.display = 'grid';

    const shapes = importedShapes.filter((shape) => shape.category === category);
    shapes.forEach((shapeDef) => {
      const shapeItem = document.createElement('div');
      shapeItem.className = 'shape-item';
      shapeItem.title = shapeDef.label;
      shapeItem.draggable = true;
      shapeItem.dataset.shapeName = shapeDef.name;

      try {
        // Create and add shape icon
        const icon = createShapeIcon(shapeDef);
        shapeItem.appendChild(icon);

        // Add label
        const label = document.createElement('div');
        label.className = 'shape-label';
        label.textContent = shapeDef.label;
        shapeItem.appendChild(label);
      } catch (e) {
        console.error('Error creating shape item:', shapeDef.name, e);
        shapeItem.textContent = shapeDef.label;
      }

      shapeItem.addEventListener('dragstart', (e) => {
        const data = { shape: shapeDef.name };
        (e.dataTransfer as DataTransfer).effectAllowed = 'copy';
        (e.dataTransfer as DataTransfer).setData('application/json', JSON.stringify(data));
      });

      shapesGrid.appendChild(shapeItem);
    });

    categoryDiv.appendChild(shapesGrid);

    // Toggle collapse/expand
    categoryTitle.addEventListener('click', () => {
      const isCollapsed = shapesGrid.style.display === 'none';
      shapesGrid.style.display = isCollapsed ? 'grid' : 'none';
      const toggle = categoryTitle.querySelector('.category-toggle') as HTMLElement;
      if (toggle) {
        toggle.textContent = isCollapsed ? '▼' : '▶';
      }
    });

    shapesContainer.appendChild(categoryDiv);
  });
}

// Search functionality
searchBox.addEventListener('input', (e) => {
  const query = (e.target as HTMLInputElement).value.trim();

  if (query === '') {
    buildShapeCategories();
    return;
  }

  shapesContainer.innerHTML = '';
  const results = searchShapes(query);

  if (results.length === 0) {
    shapesContainer.innerHTML = '<p class="no-results">No shapes found</p>';
    return;
  }

  const resultsDiv = document.createElement('div');
  resultsDiv.className = 'shapes-grid';

  results.forEach((shapeDef) => {
    const shapeItem = document.createElement('div');
    shapeItem.className = 'shape-item';
    shapeItem.title = shapeDef.label;
    shapeItem.draggable = true;
    shapeItem.dataset.shapeName = shapeDef.name;

    try {
      // Create and add shape icon
      const icon = createShapeIcon(shapeDef);
      shapeItem.appendChild(icon);

      // Add label with category
      const label = document.createElement('div');
      label.className = 'shape-label';
      label.textContent = `${shapeDef.label}`;
      shapeItem.appendChild(label);
    } catch (e) {
      console.error('Error creating search result:', shapeDef.name, e);
      shapeItem.textContent = shapeDef.label;
    }

    shapeItem.addEventListener('dragstart', (e) => {
      const data = { shape: shapeDef.name };
      (e.dataTransfer as DataTransfer).effectAllowed = 'copy';
      (e.dataTransfer as DataTransfer).setData('application/json', JSON.stringify(data));
    });

    resultsDiv.appendChild(shapeItem);
  });

  shapesContainer.appendChild(resultsDiv);
});

buildShapeCategories();
workspace.appendChild(leftPanel);

// Canvas
const canvasContainer = document.createElement('div');
canvasContainer.id = 'canvas-container';
canvasContainer.className = 'canvas-container';

const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
svg.setAttribute('width', '100%');
svg.setAttribute('height', '100%');
svg.style.position = 'absolute';
svg.style.top = '0';
svg.style.left = '0';
canvasContainer.appendChild(svg);

editor.graph.container = canvasContainer;
if (editor.graph.view?.canvas && !svg.contains(editor.graph.view.canvas as Node)) {
  svg.appendChild(editor.graph.view.canvas as Node);
}

workspace.appendChild(canvasContainer);

// Right panel - Properties
const rightPanel = document.createElement('div');
rightPanel.className = 'right-panel';

const formatTitle = document.createElement('div');
formatTitle.className = 'panel-title';
formatTitle.textContent = 'Properties';
rightPanel.appendChild(formatTitle);

const propertyContent = document.createElement('div');
propertyContent.id = 'property-content';
propertyContent.className = 'property-content';
propertyContent.innerHTML = '<p style="color: #999; font-size: 12px;">Click element to edit</p>';
rightPanel.appendChild(propertyContent);

workspace.appendChild(rightPanel);

// Status bar
const statusBar = document.createElement('div');
statusBar.id = 'status-bar';
statusBar.className = 'status-bar';
statusBar.textContent = 'Ready';
container.appendChild(statusBar);

// ============= EVENT HANDLERS =============

// Toolbar actions
document.getElementById('btn-undo')?.addEventListener('click', () => {
  if (history.canUndo()) {
    history.undo();
    updateProperties();
    statusBar.textContent = 'Undo';
    updateHistoryButtonStates();
  }
});

document.getElementById('btn-redo')?.addEventListener('click', () => {
  if (history.canRedo()) {
    history.redo();
    updateProperties();
    statusBar.textContent = 'Redo';
    updateHistoryButtonStates();
  }
});

document.getElementById('btn-zoom-in')?.addEventListener('click', () => editor.graph.zoomIn());
document.getElementById('btn-zoom-out')?.addEventListener('click', () => editor.graph.zoomOut());
document.getElementById('btn-fit')?.addEventListener('click', () => editor.graph.fit(20));

document.getElementById('btn-select')?.addEventListener('click', () => {
  currentTool = 'select';
  canvasContainer.style.cursor = 'default';
  updateToolbarState();
  statusBar.textContent = 'Select tool active';
});

document.getElementById('btn-connect')?.addEventListener('click', () => {
  currentTool = 'connect';
  canvasContainer.style.cursor = 'crosshair';
  updateToolbarState();
  statusBar.textContent = 'Connection tool active';
});

document.getElementById('btn-grid')?.addEventListener('click', () => {
  grid.setGridVisible(!grid.isGridVisible());
  document.getElementById('btn-grid')?.classList.toggle('active', grid.isGridVisible());
  redrawGrid();
  statusBar.textContent = `Grid ${grid.isGridVisible() ? 'shown' : 'hidden'}`;
});

document.getElementById('btn-snap')?.addEventListener('click', () => {
  grid.setSnapEnabled(!grid.isSnapEnabled());
  document.getElementById('btn-snap')?.classList.toggle('active', grid.isSnapEnabled());
  statusBar.textContent = `Snap ${grid.isSnapEnabled() ? 'enabled' : 'disabled'}`;
});

// Drag and drop shapes
canvasContainer.addEventListener('dragover', (e) => {
  e.preventDefault();
  canvasContainer.classList.add('drag-over');
});

canvasContainer.addEventListener('dragleave', () => {
  canvasContainer.classList.remove('drag-over');
});

canvasContainer.addEventListener('drop', (e) => {
  e.preventDefault();
  canvasContainer.classList.remove('drag-over');

  try {
    const data = JSON.parse((e.dataTransfer as DataTransfer).getData('application/json'));
    const shapeDef = getShapeByName(data.shape);
    if (!shapeDef) return;

    const rect = canvasContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const posX = x - shapeDef.width / 2;
    const posY = y - shapeDef.height / 2;
    const [snappedX, snappedY] = grid.snapPosition(posX, posY);

    const insertedCell = editor.graph.insertVertex({
      value: shapeDef.label,
      position: [snappedX, snappedY],
      size: [shapeDef.width, shapeDef.height],
      style: {
        shape: shapeDef.shape,
        fillColor: shapeDef.fillColor || '#ffffff',
        strokeColor: shapeDef.strokeColor || '#000000',
        strokeWidth: shapeDef.strokeWidth || 1,
      },
    });

    const command = new InsertCellCommand(insertedCell, editor.graph, editor.graph.getDefaultParent());
    history.execute(command);
    updateHistoryButtonStates();

    statusBar.textContent = `Added ${shapeDef.label}`;
  } catch (err) {
    console.error('Drop error:', err);
  }
});

// Canvas mouse events for selection and connector tool
canvasContainer.addEventListener('mousedown', (e) => {
  isMouseDown = true;
  const rect = canvasContainer.getBoundingClientRect();
  mouseDownX = e.clientX - rect.left;
  mouseDownY = e.clientY - rect.top;

  if (currentTool === 'connect') return;

  // Check if clicking on a cell
  const cell = editor.graph.getCellAt(mouseDownX, mouseDownY);

  if (cell && cell.isVertex && cell.isVertex()) {
    // Click on shape
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+Click: toggle selection
      selectionManager.toggleCell(cell);
    } else {
      // Regular click: select single cell
      selectionManager.selectCell(cell, false);
    }
  } else {
    // Click on empty area: start marquee selection
    if (!e.ctrlKey && !e.metaKey) {
      selectionManager.clearSelection();
      selectionManager.startMarquee(e.clientX, e.clientY, canvasContainer);
    }
  }
});

canvasContainer.addEventListener('mousemove', (e) => {
  if (!isMouseDown) return;

  if (selectionManager.isMarqueeSelecting()) {
    selectionManager.updateMarquee(e.clientX, e.clientY);
  }
});

canvasContainer.addEventListener('mouseup', (_e) => {
  isMouseDown = false;

  if (selectionManager.isMarqueeSelecting()) {
    selectionManager.endMarquee(canvasContainer);
  }
});

// Canvas click handler for connector tool
canvasContainer.addEventListener('click', (e) => {
  if (currentTool !== 'connect') return;

  const rect = canvasContainer.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // Get cell at click position
  const cell = editor.graph.getCellAt(x, y);

  if (cell && cell.isVertex && cell.isVertex()) {
    if (!connectorTool.isDrawingConnection()) {
      connectorTool.startConnection(cell, x, y);
      statusBar.textContent = 'Click another shape to complete connection';
    } else {
      connectorTool.endConnection(cell, x, y);
      statusBar.textContent = 'Connection created';
      currentTool = 'select';
      updateToolbarState();
    }
  } else if (!connectorTool.isDrawingConnection()) {
    // Clicked on empty area without active connection
  } else {
    // Cancel connection
    connectorTool.resetConnection();
    statusBar.textContent = 'Connection cancelled';
  }
});

// Selection listener - use selectionManager
selectionManager.addListener((cells) => {
  selectedCell = cells.length > 0 ? cells[0] : null;
  updateProperties();
  statusBar.textContent = `Selected: ${cells.length} shape(s)`;
});

// Text editing - double-click to edit
let isEditingText = false;
editor.graph.addListener('doubleClick', (_sender: any, evt: any) => {
  const cell = evt.getProperty('cell');
  if (cell && cell.isVertex()) {
    startTextEdit(cell);
  }
});

function startTextEdit(cell: Cell) {
  if (isEditingText) return;
  isEditingText = true;

  const geo = cell.geometry;
  if (!geo) return;

  const canvas = canvasContainer;
  const rect = canvas.getBoundingClientRect();
  const scale = editor.graph.view.scale;
  const translate = editor.graph.view.translate;

  const x = rect.left + (geo.x + translate.x) * scale;
  const y = rect.top + (geo.y + translate.y) * scale;
  const width = geo.width * scale;
  const height = geo.height * scale;

  // Create text editor
  const editor_ = document.createElement('input');
  editor_.type = 'text';
  editor_.value = cell.value || '';
  editor_.style.position = 'fixed';
  editor_.style.left = x + 'px';
  editor_.style.top = y + 'px';
  editor_.style.width = width + 'px';
  editor_.style.height = height + 'px';
  editor_.style.padding = '4px 8px';
  editor_.style.fontSize = '12px';
  editor_.style.fontFamily = 'Helvetica, Arial, sans-serif';
  editor_.style.border = '2px solid #0066cc';
  editor_.style.borderRadius = '2px';
  editor_.style.zIndex = '10000';
  editor_.style.boxSizing = 'border-box';

  document.body.appendChild(editor_);
  editor_.focus();
  editor_.select();

  function finishEdit() {
    const newValue = editor_.value;
    if (newValue !== cell.value) {
      const command = new SetCellValueCommand(cell, editor.graph, newValue);
      history.execute(command);
      updateHistoryButtonStates();
    }
    document.body.removeChild(editor_);
    isEditingText = false;
    updateProperties();
  }

  editor_.addEventListener('blur', finishEdit);
  editor_.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      finishEdit();
    } else if (e.key === 'Escape') {
      document.body.removeChild(editor_);
      isEditingText = false;
    }
  });
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    switch (e.key.toLowerCase()) {
      case 'a':
        e.preventDefault();
        selectAllCells();
        break;
      case 'c':
        e.preventDefault();
        copyCells();
        break;
      case 'x':
        e.preventDefault();
        cutCells();
        break;
      case 'v':
        e.preventDefault();
        pasteCells();
        break;
      case 's':
        e.preventDefault();
        exportDiagram('json');
        break;
      case 'z':
        e.preventDefault();
        history.undo();
        updateProperties();
        updateHistoryButtonStates();
        break;
      case 'y':
        e.preventDefault();
        history.redo();
        updateProperties();
        updateHistoryButtonStates();
        break;
    }
  } else if (e.key === 'Delete') {
    e.preventDefault();
    deleteCells();
  } else if (e.key === 'Escape') {
    if (connectorTool.isDrawingConnection()) {
      connectorTool.resetConnection();
      statusBar.textContent = 'Connection cancelled';
    }
    currentTool = 'select';
    updateToolbarState();
  }
});

// Initialize button states
updateHistoryButtonStates();
updateToolbarState();

// Draw initial grid
redrawGrid();

// ============= FUNCTIONALITY =============

function updateToolbarState() {
  const selectBtn = document.getElementById('btn-select');
  const connectBtn = document.getElementById('btn-connect');
  selectBtn?.classList.toggle('active', currentTool === 'select');
  connectBtn?.classList.toggle('active', currentTool === 'connect');
}

function updateHistoryButtonStates() {
  const undoBtn = document.getElementById('btn-undo');
  const redoBtn = document.getElementById('btn-redo');
  undoBtn?.classList.toggle('disabled', !history.canUndo());
  redoBtn?.classList.toggle('disabled', !history.canRedo());
  (undoBtn as HTMLButtonElement).disabled = !history.canUndo();
  (redoBtn as HTMLButtonElement).disabled = !history.canRedo();
}

function redrawGrid() {
  grid.drawGrid(canvasContainer, 0, 0, 1);
}

function selectAllCells() {
  const parent = editor.graph.getDefaultParent();
  const allCells: any[] = [];
  if (parent && parent.children) {
    parent.children.forEach((cell: any) => {
      if (cell.isVertex && cell.isVertex()) {
        allCells.push(cell);
      }
    });
  }
  selectionManager.selectCells(allCells);
  statusBar.textContent = `Selected all: ${allCells.length} shape(s)`;
}

function updateProperties() {
  const content = document.getElementById('property-content')!;
  if (!selectedCell) {
    content.innerHTML = '<p style="color: #999; font-size: 12px;">Click element to edit</p>';
    return;
  }

  const cell = selectedCell;
  content.innerHTML = `
    <div class="property-group">
      <label>Text</label>
      <input type="text" id="prop-text" value="${cell.value || ''}" class="property-input" />
    </div>
    <div class="property-group">
      <label>Width: <span id="prop-width">80</span></label>
      <input type="range" id="prop-width-input" min="20" max="300" value="${cell.geometry?.width || 80}" class="property-slider" />
    </div>
    <div class="property-group">
      <label>Height: <span id="prop-height">60</span></label>
      <input type="range" id="prop-height-input" min="20" max="300" value="${cell.geometry?.height || 60}" class="property-slider" />
    </div>
    <button id="btn-delete-cell" class="property-btn">Delete</button>
  `;

  document.getElementById('prop-text')?.addEventListener('change', (e) => {
    const newValue = (e.target as HTMLInputElement).value;
    if (newValue !== cell.value) {
      const command = new SetCellValueCommand(cell, editor.graph, newValue);
      history.execute(command);
      updateHistoryButtonStates();
    }
  });

  document.getElementById('prop-width-input')?.addEventListener('input', (e) => {
    const width = parseInt((e.target as HTMLInputElement).value);
    const geo = cell.geometry;
    if (geo) {
      const newGeo = {
        x: geo.x,
        y: geo.y,
        width: width,
        height: geo.height,
      };
      const command = new SetGeometryCommand(cell, editor.graph, newGeo);
      history.execute(command);
      updateHistoryButtonStates();
    }
    document.getElementById('prop-width')!.textContent = width.toString();
  });

  document.getElementById('prop-height-input')?.addEventListener('input', (e) => {
    const height = parseInt((e.target as HTMLInputElement).value);
    const geo = cell.geometry;
    if (geo) {
      const newGeo = {
        x: geo.x,
        y: geo.y,
        width: geo.width,
        height: height,
      };
      const command = new SetGeometryCommand(cell, editor.graph, newGeo);
      history.execute(command);
      updateHistoryButtonStates();
    }
    document.getElementById('prop-height')!.textContent = height.toString();
  });

  document.getElementById('btn-delete-cell')?.addEventListener('click', () => {
    const command = new RemoveCellsCommand([cell], editor.graph);
    history.execute(command);
    updateHistoryButtonStates();
    updateProperties();
  });
}

function copyCells() {
  const cells = selectionManager.getSelectedCells();
  if (cells.length > 0) {
    const cellData = cells.map((cell: any) => ({
      id: cell.id,
      value: cell.value,
      x: cell.geometry?.x,
      y: cell.geometry?.y,
      width: cell.geometry?.width,
      height: cell.geometry?.height,
      style: cell.style,
    }));
    localStorage.setItem('clipboard', JSON.stringify(cellData));
    statusBar.textContent = `Copied ${cells.length} element(s)`;
  }
}

function cutCells() {
  copyCells();
  deleteCells();
}

function pasteCells() {
  try {
    const clipboard = localStorage.getItem('clipboard');
    if (!clipboard) return;

    const cellData = JSON.parse(clipboard);
    const cells = Array.isArray(cellData) ? cellData : [cellData];

    editor.graph.batchUpdate(() => {
      cells.forEach((data: any) => {
        editor.graph.insertVertex({
          value: data.value || 'Pasted',
          position: [data.x + 20, data.y + 20],
          size: [data.width || 80, data.height || 60],
          style: { shape: 'rectangle', fillColor: '#ffffff', strokeColor: '#000000' },
        });
      });
    });

    statusBar.textContent = `Pasted ${cells.length} element(s)`;
  } catch (err) {
    console.error('Paste error:', err);
    statusBar.textContent = 'Paste failed';
  }
}

function deleteCells() {
  const cells = selectionManager.getSelectedCells();
  if (cells.length > 0) {
    const command = new RemoveCellsCommand(cells, editor.graph);
    history.execute(command);
    updateHistoryButtonStates();
    selectionManager.clearSelection();
    statusBar.textContent = `Deleted ${cells.length} element(s)`;
  }
}

function exportDiagram(format: 'json' | 'xml') {
  try {
    const cells = editor.graph.getDefaultParent().children || [];
    const diagramData = {
      version: '1.0',
      cells: cells.map((cell: Cell) => ({
        id: cell.id,
        value: cell.value,
        x: cell.geometry?.x,
        y: cell.geometry?.y,
        width: cell.geometry?.width,
        height: cell.geometry?.height,
        style: cell.style,
      })),
    };

    const data = JSON.stringify(diagramData, null, 2);
    const filename = `diagram.${format}`;

    const blob = new Blob([data], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    statusBar.textContent = `Exported as ${filename}`;
  } catch (err) {
    console.error('Export error:', err);
    statusBar.textContent = 'Export failed';
  }
}

function showMenu(menuLabel: string, actions: string[], button: HTMLElement) {
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.position = 'absolute';
  menu.style.top = (button.getBoundingClientRect().bottom + 5) + 'px';
  menu.style.left = button.getBoundingClientRect().left + 'px';

  actions.forEach((action) => {
    const item = document.createElement('div');
    item.className = 'menu-option';
    item.textContent = action;
    item.addEventListener('click', () => {
      handleMenuAction(menuLabel, action);
      document.body.removeChild(menu);
    });
    menu.appendChild(item);
  });

  document.body.appendChild(menu);
  document.addEventListener('click', () => {
    if (document.body.contains(menu)) {
      document.body.removeChild(menu);
    }
  }, { once: true });
}

function handleMenuAction(menu: string, action: string) {
  statusBar.textContent = `${menu} > ${action}`;

  switch (action) {
    case 'New':
      if (confirm('Clear diagram?')) {
        editor.graph.removeCells(editor.graph.getDefaultParent().children || []);
      }
      break;
    case 'Save':
      exportDiagram('json');
      break;
    case 'Open':
      handleOpenDiagram();
      break;
    case 'Export as PNG':
      statusBar.textContent = 'PNG export not yet implemented';
      break;
    case 'Import Shapes':
      handleImportShapes();
      break;
    case 'Undo':
      if (history.canUndo()) {
        history.undo();
        updateProperties();
        updateHistoryButtonStates();
        statusBar.textContent = 'Undo';
      }
      break;
    case 'Redo':
      if (history.canRedo()) {
        history.redo();
        updateProperties();
        updateHistoryButtonStates();
        statusBar.textContent = 'Redo';
      }
      break;
    case 'Cut':
      cutCells();
      break;
    case 'Copy':
      copyCells();
      break;
    case 'Paste':
      pasteCells();
      break;
    case 'Delete':
      deleteCells();
      break;
    case 'Zoom In':
      editor.graph.zoomIn();
      break;
    case 'Zoom Out':
      editor.graph.zoomOut();
      break;
    case 'Fit':
      editor.graph.fit(20);
      break;
    case 'Reset View':
      editor.graph.zoomActual();
      break;
    case 'Align Left':
      alignmentTools.alignLeft(selectionManager.getSelectedCells());
      statusBar.textContent = 'Aligned left';
      break;
    case 'Align Center':
      alignmentTools.alignHCenter(selectionManager.getSelectedCells());
      statusBar.textContent = 'Aligned center (horizontal)';
      break;
    case 'Align Right':
      alignmentTools.alignRight(selectionManager.getSelectedCells());
      statusBar.textContent = 'Aligned right';
      break;
    case 'Align Top':
      alignmentTools.alignTop(selectionManager.getSelectedCells());
      statusBar.textContent = 'Aligned top';
      break;
    case 'Align Middle':
      alignmentTools.alignVCenter(selectionManager.getSelectedCells());
      statusBar.textContent = 'Aligned middle (vertical)';
      break;
    case 'Align Bottom':
      alignmentTools.alignBottom(selectionManager.getSelectedCells());
      statusBar.textContent = 'Aligned bottom';
      break;
    case 'Distribute Horizontally':
      alignmentTools.distributeHorizontally(selectionManager.getSelectedCells());
      statusBar.textContent = 'Distributed horizontally';
      break;
    case 'Distribute Vertically':
      alignmentTools.distributeVertically(selectionManager.getSelectedCells());
      statusBar.textContent = 'Distributed vertically';
      break;
  }
}

// ============= FILE HANDLERS =============

function handleOpenDiagram() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const diagramData = JSON.parse(content);

        // Clear current diagram
        editor.graph.removeCells(editor.graph.getDefaultParent().children || []);

        // Restore cells
        if (diagramData.cells && Array.isArray(diagramData.cells)) {
          diagramData.cells.forEach((cellData: any) => {
            editor.graph.insertVertex({
              value: cellData.value || '',
              position: [cellData.x || 0, cellData.y || 0],
              size: [cellData.width || 80, cellData.height || 60],
              style: cellData.style || { shape: 'rectangle' },
            });
          });
        }

        // Clear history on load
        history.clear();
        updateHistoryButtonStates();
        updateProperties();
        statusBar.textContent = `✓ Loaded diagram from ${file.name}`;
      } catch (err) {
        console.error('Open error:', err);
        statusBar.textContent = 'Failed to open diagram';
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

async function handleImportShapes() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.drawio,.xml';
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      statusBar.textContent = 'Importing shapes...';
      const shapes = await loadDrawioFile(file);

      if (shapes.length === 0) {
        statusBar.textContent = 'No shapes found in file';
        return;
      }

      // Merge imported shapes with existing library
      importedShapes = mergeShapeLibraries(importedShapes, shapes);

      // Rebuild shape panel
      buildShapeCategories();

      statusBar.textContent = `✓ Imported ${shapes.length} shapes from ${file.name}`;
    } catch (error) {
      statusBar.textContent = `✗ Failed to import: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('Import error:', error);
    }
  };
  input.click();
}

updateToolbarState();
console.log('Standard Editor initialized with shapes library');
