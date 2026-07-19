import '@maxgraph/core/css/common.css';
import './style.css';
import { Editor, Cell } from '@maxgraph/core';
import configXml from './config/railwayConfig.xml?raw';
import { searchShapes, getShapeByName, SHAPES_LIBRARY, loadStencils } from './shapes/shapes-library';
import { createShapeIcon } from './shapes/shape-renderer';
import { registerShapes } from './shapes/shape-registration';
import { loadDrawioFile, mergeShapeLibraries } from './drawio-importer';
import { CommandHistory, SetCellValueCommand, SetGeometryCommand, RemoveCellsCommand, InsertCellCommand } from './command-history';
import { GridManager } from './grid-manager';
import { ConnectorTool } from './connector-tool';
import { SelectionManager } from './selection-manager';
import { AlignmentTools } from './alignment-tools';
import { TransformTools } from './transform-tools';
import { ExportManager } from './export-manager';
import { GroupingManager } from './grouping-manager';
import { LayoutManager } from './layout-manager';
import { DrawioFileHandler } from './drawio-file-handler';
import { TabManager } from './tab-manager';
import { ZOrderManager } from './z-order-manager';
import { SizingManager } from './sizing-manager';
import { LayerManager } from './layer-manager';
import { EdgeRoutingManager } from './edge-routing-manager';
import { ConnectionPointsManager } from './connection-points-manager';
import { ToolboxManager } from './toolbox-manager';
import { ShapeDeduplicator } from './shapes/shape-deduplicator';

// Parse editor configuration
const parser = new DOMParser();
const configElement = parser.parseFromString(configXml, 'text/xml').documentElement;

// Create editor instance
const editor = new Editor(configElement);

// Register all native maxGraph shapes
registerShapes();

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

// Transform tools (rotate, flip)
const transformTools = new TransformTools(editor.graph);

// Export manager
const exportManager = new ExportManager(editor.graph);

// Grouping manager (uses maxGraph's native grouping)
const groupingManager = new GroupingManager(editor.graph);

// Layout manager (uses maxGraph's built-in layout algorithms)
const layoutManager = new LayoutManager(editor.graph);

// Draw.io file handler
const drawioFileHandler = new DrawioFileHandler(editor.graph);

// Tab manager for multiple diagrams
const tabManager = new TabManager(editor.graph);

// Z-order manager (bring to front, send to back)
const zOrderManager = new ZOrderManager(editor.graph);

// Sizing manager (make same size, etc.)
const sizingManager = new SizingManager(editor.graph);

// Layer manager (visibility and locking)
const layerManager = new LayerManager(editor.graph);

// Edge routing manager (orthogonal, direct, curved routing)
const edgeRoutingManager = new EdgeRoutingManager(editor.graph);

// Connection points manager (custom attachment points)
const connectionPointsManager = new ConnectionPointsManager(editor.graph);

// Toolbox manager (shape library and recent shapes)
const toolboxManager = new ToolboxManager(editor.graph);

// App state
let currentTool = 'select';
let selectedCell: Cell | null = null;

// ============= UI SETUP =============

const container = document.getElementById('editor-container')!;

// Menu bar
const menuBar = document.createElement('div');
menuBar.className = 'menu-bar';
const menuItems = [
  {
    label: 'File',
    actions: [
      'New',
      'New Tab',
      'Open',
      'Save',
      'Export as SVG',
      'Export as HTML',
      'Export as PNG',
      'Export as JPG',
      'Export as Draw.io',
      'Import Shapes',
      'Import Draw.io File',
    ],
  },
  { label: 'Edit', actions: ['Undo', 'Redo', 'Cut', 'Copy', 'Paste', 'Delete', 'Group', 'Ungroup'] },
  { label: 'View', actions: ['Zoom In', 'Zoom Out', 'Fit', 'Reset View'] },
  {
    label: 'Stencils',
    actions: [
      'Load AWS Stencils',
      'Load Azure Stencils',
      'Load Google Cloud Stencils',
      'Load Cisco Stencils',
      'Load BPMN Stencils',
    ],
  },
  {
    label: 'Tools',
    actions: [
      'Report Duplicate Shapes',
      'Deduplicate Shapes',
      'Show Recent Shapes',
      'Clear Recent Shapes',
    ],
  },
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
      'Rotate 90°',
      'Rotate -90°',
      'Flip Horizontal',
      'Flip Vertical',
      'Make Same Size',
      'Make Same Width',
      'Make Same Height',
      'Bring to Front',
      'Send to Back',
      'Layout - Hierarchical',
      'Layout - Circle',
      'Layout - Tree',
      'Edge - Orthogonal Routing',
      'Edge - Direct Routing',
      'Edge - Curved Routing',
      'Edge - Add Arrows',
      'Edge - Remove Arrows',
      'Edge - Solid Style',
      'Edge - Dashed Style',
      'Edge - Dotted Style',
      'Connection - Corner Points',
      'Connection - Cardinal Points',
      'Connection - 8-Point Set',
      'Connection - Clear Points',
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

// Feature toolbar
const featureToolbar = document.createElement('div');
featureToolbar.className = 'feature-toolbar';
featureToolbar.innerHTML = `
  <div class="toolbar-section">
    <span class="toolbar-label">Colors</span>
    <button class="toolbar-icon-btn" id="btn-color-palette" title="Color Palette">🎨</button>
  </div>
  <div class="toolbar-section">
    <span class="toolbar-label">Alignment</span>
    <button class="toolbar-icon-btn" id="btn-align-left" title="Align Left">⬅️</button>
    <button class="toolbar-icon-btn" id="btn-align-center" title="Align Center">⬆️</button>
    <button class="toolbar-icon-btn" id="btn-align-right" title="Align Right">➡️</button>
  </div>
  <div class="toolbar-section">
    <span class="toolbar-label">Layout</span>
    <button class="toolbar-icon-btn" id="btn-rulers" title="Toggle Rulers">📐</button>
    <button class="toolbar-icon-btn" id="btn-guides" title="Toggle Guides">📏</button>
  </div>
  <div class="toolbar-section">
    <span class="toolbar-label">Tools</span>
    <button class="toolbar-icon-btn" id="btn-templates" title="Templates">📋</button>
    <button class="toolbar-icon-btn" id="btn-find" title="Find & Replace (Ctrl+H)">🔍</button>
  </div>
`;
container.appendChild(featureToolbar);

// Tab bar
const tabBar = document.createElement('div');
tabBar.className = 'tab-bar';

function updateTabBar() {
  // Clear all tabs and the add button
  while (tabBar.firstChild) {
    tabBar.removeChild(tabBar.firstChild);
  }

  const tabs = tabManager.getAllTabs();
  tabs.forEach((tab) => {
    const tabBtn = document.createElement('div');
    tabBtn.className = `tab ${tab.active ? 'active' : ''}`;
    tabBtn.innerHTML = `
      <span class="tab-name">${tab.name}</span>
      ${tabManager.canCloseTab(tab.id) ? '<button class="tab-close">×</button>' : ''}
    `;

    tabBtn.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('tab-close')) {
        e.stopPropagation();
        if (tabManager.closeTab(tab.id)) {
          updateTabBar();
          const activeTab = tabManager.getActiveTab();
          if (activeTab?.data) {
            tabManager.restoreDiagramData(activeTab.data);
          } else {
            editor.graph.removeCells(editor.graph.getDefaultParent().children || []);
          }
        }
      } else {
        if (tabManager.switchToTab(tab.id)) {
          updateTabBar();
          const activeTab = tabManager.getActiveTab();
          if (activeTab?.data) {
            tabManager.restoreDiagramData(activeTab.data);
          } else {
            editor.graph.removeCells(editor.graph.getDefaultParent().children || []);
          }
        }
      }
    });

    tabBar.appendChild(tabBtn);
  });

  // Add new tab button
  const addBtn = document.createElement('button');
  addBtn.className = 'tab-add-btn';
  addBtn.innerHTML = '+ New Tab';
  addBtn.addEventListener('click', () => {
    tabManager.createTab();
    updateTabBar();
  });
  tabBar.appendChild(addBtn);
}

// Initialize tab bar
updateTabBar();
tabManager.addListener(() => updateTabBar());
container.appendChild(tabBar);

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

// Track loaded stencil categories for styling
let stencilCategories = new Set<string>();

// Build shape categories
function buildShapeCategories() {
  shapesContainer.innerHTML = '';

  // Get unique categories from imported shapes
  const categorySet = new Set<string>();
  importedShapes.forEach((shape) => {
    categorySet.add(shape.category);
  });
  const categories = Array.from(categorySet).sort();

  // Separate original categories from stencil categories
  const originalCategories = categories.filter((c) => !stencilCategories.has(c));
  const newStencilCategories = categories.filter((c) => stencilCategories.has(c));

  // Display in order: original categories first, then stencil categories
  const orderedCategories = [...originalCategories, ...newStencilCategories];

  orderedCategories.forEach((category, index) => {
    const categoryDiv = document.createElement('div');
    const isStencilCategory = stencilCategories.has(category);
    categoryDiv.className = `shape-category ${isStencilCategory ? 'stencil-category' : ''}`;

    // Only first category is expanded, all others collapsed
    const isFirstCategory = index === 0;
    const categoryTitle = document.createElement('div');
    const titleClass = isStencilCategory ? 'category-title stencil-title' : 'category-title';
    categoryTitle.className = titleClass;
    categoryTitle.innerHTML = `<span class="category-toggle">${isFirstCategory ? '▼' : '▶'}</span> ${category}`;
    categoryDiv.appendChild(categoryTitle);

    const shapesGrid = document.createElement('div');
    shapesGrid.className = 'shapes-grid';
    shapesGrid.style.display = isFirstCategory ? 'grid' : 'none';

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

// Right panel - Tabbed interface
const rightPanel = document.createElement('div');
rightPanel.className = 'right-panel';

const panelTabs = document.createElement('div');
panelTabs.className = 'panel-tabs';

const tabs = ['Properties', 'Layers', 'Comments', 'History', 'Animations'];
const tabContents: { [key: string]: HTMLElement } = {};

tabs.forEach((tabName, index) => {
  const tabBtn = document.createElement('button');
  tabBtn.className = `panel-tab-btn ${index === 0 ? 'active' : ''}`;
  tabBtn.textContent = tabName;
  tabBtn.addEventListener('click', () => {
    // Update active tab button
    document.querySelectorAll('.panel-tab-btn').forEach((btn) => {
      btn.classList.remove('active');
    });
    tabBtn.classList.add('active');

    // Update active content
    Object.values(tabContents).forEach((content) => {
      content.classList.remove('active');
    });
    tabContents[tabName].classList.add('active');
  });
  panelTabs.appendChild(tabBtn);

  // Create tab content
  const content = document.createElement('div');
  content.className = `panel-tab-content ${index === 0 ? 'active' : ''}`;
  tabContents[tabName] = content;
});

rightPanel.appendChild(panelTabs);

// Properties tab
const propertyContent = document.createElement('div');
propertyContent.id = 'property-content';
propertyContent.className = 'format-content';
propertyContent.innerHTML = '<p style="color: #999; font-size: 12px;">Click element to edit</p>';
tabContents['Properties'].appendChild(propertyContent);
rightPanel.appendChild(tabContents['Properties']);

// Layers tab
const layersContent = document.createElement('div');
const layersList = document.createElement('div');
layersList.id = 'layers-list';
layersList.className = 'layers-list';
layersContent.appendChild(layersList);

const layerControls = document.createElement('div');
layerControls.className = 'layer-controls';
layerControls.innerHTML = `
  <button id="btn-layer-show-all" class="layer-btn" title="Show All">👁️</button>
  <button id="btn-layer-hide-all" class="layer-btn" title="Hide All">🚫</button>
`;
layersContent.appendChild(layerControls);
tabContents['Layers'].appendChild(layersContent);
rightPanel.appendChild(tabContents['Layers']);

// Comments tab
const commentsContent = document.createElement('div');
commentsContent.id = 'comments-content';
commentsContent.innerHTML = '<p style="color: #999; font-size: 12px;">Select a shape to add comments</p>';
tabContents['Comments'].appendChild(commentsContent);
rightPanel.appendChild(tabContents['Comments']);

// History tab
const historyContent = document.createElement('div');
historyContent.id = 'history-content';
historyContent.innerHTML = '<p style="color: #999; font-size: 12px;">Version snapshots will appear here</p>';
tabContents['History'].appendChild(historyContent);
rightPanel.appendChild(tabContents['History']);

// Animations tab
const animationsContent = document.createElement('div');
animationsContent.id = 'animations-content';
animationsContent.innerHTML = '<p style="color: #999; font-size: 12px;">Select a shape to add animations</p>';
tabContents['Animations'].appendChild(animationsContent);
rightPanel.appendChild(tabContents['Animations']);

workspace.appendChild(rightPanel);

// Enhanced status bar
const statusBar = document.createElement('div');
statusBar.id = 'status-bar';
statusBar.className = 'status-bar';
statusBar.innerHTML = `
  <div class="status-item">
    <span class="status-label">Grid:</span>
    <span class="status-value" id="status-grid">10px</span>
  </div>
  <div class="status-item">
    <span class="status-label">Snap:</span>
    <span class="status-value" id="status-snap">ON</span>
  </div>
  <div class="status-item">
    <span class="status-label">Zoom:</span>
    <span class="status-value" id="status-zoom">100%</span>
  </div>
  <div class="status-item">
    <span class="status-label">Selected:</span>
    <span class="status-value" id="status-selected">0</span>
  </div>
  <div class="status-item">
    <span class="status-label">Pos:</span>
    <span class="status-value" id="status-pos">-</span>
  </div>
`;
container.appendChild(statusBar);

// Helper to update status items
const updateStatusBar = (item: string, value: string) => {
  const element = document.getElementById(`status-${item}`);
  if (element) element.textContent = value;
};

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
  updateStatusBar('snap', grid.isSnapEnabled() ? 'ON' : 'OFF');
});

// Feature toolbar handlers
document.getElementById('btn-color-palette')?.addEventListener('click', () => {
  handleMenuAction('format', 'color_palette');
});

document.getElementById('btn-align-left')?.addEventListener('click', () => {
  const cells = selectionManager.getSelectedCells();
  if (cells.length > 0) {
    alignmentTools.alignLeft(cells);
    updateStatusBar('selected', cells.length.toString());
  }
});

document.getElementById('btn-align-center')?.addEventListener('click', () => {
  const cells = selectionManager.getSelectedCells();
  if (cells.length > 0) {
    alignmentTools.alignHCenter(cells);
    updateStatusBar('selected', cells.length.toString());
  }
});

document.getElementById('btn-align-right')?.addEventListener('click', () => {
  const cells = selectionManager.getSelectedCells();
  if (cells.length > 0) {
    alignmentTools.alignRight(cells);
    updateStatusBar('selected', cells.length.toString());
  }
});

document.getElementById('btn-rulers')?.addEventListener('click', () => {
  handleMenuAction('view', 'rulers');
});

document.getElementById('btn-guides')?.addEventListener('click', () => {
  handleMenuAction('view', 'guides');
});

document.getElementById('btn-templates')?.addEventListener('click', () => {
  handleMenuAction('file', 'templates');
});

document.getElementById('btn-find')?.addEventListener('click', () => {
  handleMenuAction('edit', 'find_replace');
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
    updateLayers();
  } catch (err) {
    console.error('Drop error:', err);
  }
});

// Listen to maxGraph's selection changes
editor.graph.getSelectionModel().addListener('change', (_sender: any, _evt: any) => {
  const selectedCells = editor.graph.getSelectionModel().cells || [];
  selectedCell = selectedCells.length > 0 ? selectedCells[0] : null;
  updateProperties();
  updateLayers();
  updateStatusBar('selected', selectedCells.length.toString());
});

// Update zoom and grid status on scale change
editor.graph.view.addListener('scale', () => {
  const scale = Math.round(editor.graph.view.scale * 100);
  updateStatusBar('zoom', `${scale}%`);
});

// Update grid and snap status
updateStatusBar('grid', `${grid.getGridSize()}px`);
updateStatusBar('snap', grid.isSnapEnabled() ? 'ON' : 'OFF');

// Connector tool with click to activate
editor.graph.addListener('cellClicked', (_sender: any, evt: any) => {
  if (currentTool !== 'connect') return;

  const cell = evt.getProperty('cell');

  if (cell && cell.isVertex && cell.isVertex()) {
    if (!connectorTool.isDrawingConnection()) {
      connectorTool.startConnection(cell, 0, 0);
      statusBar.textContent = 'Click another shape to complete connection';
    } else {
      connectorTool.endConnection(cell, 0, 0);
      statusBar.textContent = '✓ Connection created';
      const command = new InsertCellCommand(connectorTool.getStartCell(), editor.graph, editor.graph.getDefaultParent());
      history.execute(command);
      currentTool = 'select';
      updateToolbarState();
    }
  } else if (connectorTool.isDrawingConnection()) {
    // Cancel connection if clicked on empty area
    connectorTool.resetConnection();
    statusBar.textContent = 'Connection cancelled';
  }
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
  } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    // Arrow key movement (1px at a time, 10px with Shift)
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    const cells = selectionManager.getSelectedCells();

    cells.forEach((cell) => {
      if (cell.geometry) {
        switch (e.key) {
          case 'ArrowUp':
            cell.geometry.y -= step;
            break;
          case 'ArrowDown':
            cell.geometry.y += step;
            break;
          case 'ArrowLeft':
            cell.geometry.x -= step;
            break;
          case 'ArrowRight':
            cell.geometry.x += step;
            break;
        }
      }
    });

    editor.graph.view.refresh();
  }
});

// Initialize button states
updateHistoryButtonStates();
updateToolbarState();

// Draw initial grid
redrawGrid();

// Initialize layers
updateLayers();

// Load popular stencils on startup
(async () => {
  try {
    await loadStencils(['basic', 'arrows', 'flowchart']);
    buildShapeCategories();
  } catch (err) {
    console.warn('Failed to load stencils:', err);
  }
})();

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

function handleRotate(degrees: number) {
  const cells = selectionManager.getSelectedCells();
  if (cells.length > 0) {
    transformTools.rotateMultiple(cells, degrees);
    statusBar.textContent = `Rotated ${degrees}°`;
  } else {
    statusBar.textContent = 'Select shape(s) to rotate';
  }
}

function handleFlip(direction: 'horizontal' | 'vertical') {
  const cells = selectionManager.getSelectedCells();
  if (cells.length > 0) {
    if (direction === 'horizontal') {
      transformTools.flipMultipleHorizontal(cells);
      statusBar.textContent = 'Flipped horizontally';
    } else {
      transformTools.flipMultipleVertical(cells);
      statusBar.textContent = 'Flipped vertically';
    }
  } else {
    statusBar.textContent = 'Select shape(s) to flip';
  }
}

function handleGroup() {
  const cells = selectionManager.getSelectedCells();
  if (cells.length < 2) {
    statusBar.textContent = 'Select at least 2 shapes to group';
    return;
  }

  try {
    groupingManager.groupCells(cells, 'Group');
    selectionManager.clearSelection();
    statusBar.textContent = `✓ Grouped ${cells.length} shapes`;
  } catch (err) {
    statusBar.textContent = `Group failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
  }
}

function handleUngroup() {
  const cells = selectionManager.getSelectedCells();
  if (cells.length === 0) {
    statusBar.textContent = 'Select group(s) to ungroup';
    return;
  }

  try {
    groupingManager.ungroupCells(cells);
    selectionManager.clearSelection();
    statusBar.textContent = `✓ Ungrouped ${cells.length} group(s)`;
  } catch (err) {
    statusBar.textContent = `Ungroup failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
  }
}

function handleLayout(type: 'hierarchical' | 'circle' | 'tree') {
  try {
    layoutManager.applyLayout(type);
    statusBar.textContent = `✓ Applied ${type} layout`;
  } catch (err) {
    statusBar.textContent = `Layout failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
  }
}

function handleExportPNG() {
  try {
    statusBar.textContent = 'Exporting as PNG...';
    exportManager.exportAsPNG('diagram.png', 1);
    statusBar.textContent = '✓ Exported as PNG';
  } catch (err) {
    statusBar.textContent = `PNG export failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
  }
}

function handleExportJPG() {
  try {
    statusBar.textContent = 'Exporting as JPG...';
    exportManager.exportAsJPG('diagram.jpg', 1, 0.9);
    statusBar.textContent = '✓ Exported as JPG';
  } catch (err) {
    statusBar.textContent = `JPG export failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
  }
}

async function handleImportDrawioFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.drawio,.xml';
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      statusBar.textContent = 'Importing Draw.io file...';
      const diagram = await drawioFileHandler.importFromDrawio(file);

      if (!diagram || !diagram.cells) {
        statusBar.textContent = 'Invalid diagram format';
        return;
      }

      // Clear current diagram
      editor.graph.removeCells(editor.graph.getDefaultParent().children || []);

      // Recreate cells from imported diagram
      diagram.cells.forEach((cellData: any) => {
        editor.graph.insertVertex({
          value: cellData.value || '',
          position: [cellData.x, cellData.y],
          size: [cellData.width, cellData.height],
          style: cellData.style || { shape: 'rectangle' },
        });
      });

      // Recreate edges
      if (diagram.edges && diagram.edges.length > 0) {
        const cells = editor.graph.getDefaultParent().children || [];
        diagram.edges.forEach((edgeData: any) => {
          const sourceCell = cells.find((c: any) => c.id === edgeData.source);
          const targetCell = cells.find((c: any) => c.id === edgeData.target);

          if (sourceCell && targetCell) {
            editor.graph.insertEdge({
              source: sourceCell,
              target: targetCell,
              value: edgeData.value || '',
              style: edgeData.style || {},
            });
          }
        });
      }

      history.clear();
      updateHistoryButtonStates();
      selectionManager.clearSelection();
      statusBar.textContent = `✓ Imported ${diagram.cells.length} shapes from ${file.name}`;
    } catch (err) {
      statusBar.textContent = `Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }
  };
  input.click();
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

function updateLayers() {
  const layersList = document.getElementById('layers-list')!;
  layersList.innerHTML = '';

  const parent = editor.graph.getDefaultParent();
  if (!parent || !parent.children) return;

  parent.children.forEach((cell: any) => {
    if (cell.isVertex?.()) {
      // Add to layer manager if not already there
      if (!layerManager.getAllLayers().find((l) => l.id === cell.id)) {
        layerManager.addLayer(cell, cell.value || 'Layer');
      }

      const layer = layerManager.getAllLayers().find((l) => l.id === cell.id);
      if (!layer) return;

      const layerItem = document.createElement('div');
      layerItem.className = `layer-item ${layer.locked ? 'locked' : ''}`;
      layerItem.innerHTML = `
        <button class="layer-visibility" title="Toggle Visibility">${layer.visible ? '👁️' : '🚫'}</button>
        <span class="layer-name">${layer.label}</span>
        <button class="layer-lock" title="Toggle Lock">${layer.locked ? '🔒' : '🔓'}</button>
      `;

      // Visibility toggle
      layerItem.querySelector('.layer-visibility')?.addEventListener('click', (e) => {
        e.stopPropagation();
        layerManager.toggleVisibility(cell.id);
        updateLayers();
      });

      // Lock toggle
      layerItem.querySelector('.layer-lock')?.addEventListener('click', (e) => {
        e.stopPropagation();
        layerManager.toggleLock(cell.id);
        updateLayers();
      });

      // Click to select
      layerItem.addEventListener('click', () => {
        selectionManager.selectCell(cell, false);
      });

      layersList.appendChild(layerItem);
    }
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
    updateLayers();
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
  // Close any existing menus
  const existingMenus = document.querySelectorAll('.context-menu');
  existingMenus.forEach((m) => {
    if (document.body.contains(m)) {
      document.body.removeChild(m);
    }
  });

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.position = 'absolute';
  menu.style.top = (button.getBoundingClientRect().bottom + 5) + 'px';
  menu.style.left = button.getBoundingClientRect().left + 'px';
  menu.style.zIndex = '10000';

  actions.forEach((action) => {
    const item = document.createElement('div');
    item.className = 'menu-option';
    item.textContent = action;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      handleMenuAction(menuLabel, action);
      closeMenu();
    });
    menu.appendChild(item);
  });

  menu.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  document.body.appendChild(menu);

  // Close menu when clicking outside
  const closeMenu = () => {
    if (document.body.contains(menu)) {
      document.body.removeChild(menu);
    }
    document.removeEventListener('click', closeMenuListener);
  };

  const closeMenuListener = () => closeMenu();

  // Use setTimeout to prevent immediate closure
  setTimeout(() => {
    document.addEventListener('click', closeMenuListener);
  }, 0);
}

// Layer panel controls
document.getElementById('btn-layer-show-all')?.addEventListener('click', () => {
  layerManager.showAll();
  updateLayers();
  statusBar.textContent = 'All layers shown';
});

document.getElementById('btn-layer-hide-all')?.addEventListener('click', () => {
  layerManager.hideAll();
  updateLayers();
  statusBar.textContent = 'All layers hidden';
});

async function handleLoadStencil(stencilName: string) {
  try {
    statusBar.textContent = `Loading ${stencilName} stencil...`;

    // Get categories before loading
    const categoriesBefore = new Set(importedShapes.map((s) => s.category));

    await loadStencils([stencilName]);

    // Get categories after loading
    const categoriesAfter = new Set(importedShapes.map((s) => s.category));

    // Add new categories to stencil categories set
    categoriesAfter.forEach((cat) => {
      if (!categoriesBefore.has(cat)) {
        stencilCategories.add(cat);
      }
    });

    buildShapeCategories();
    statusBar.textContent = `✓ ${stencilName.toUpperCase()} shapes loaded (${stencilCategories.size} new categories)`;
  } catch (err) {
    statusBar.textContent = `Failed to load ${stencilName} stencil`;
    console.error('Stencil load error:', err);
  }
}

function handleMenuAction(menu: string, action: string) {
  statusBar.textContent = `${menu} > ${action}`;

  switch (action) {
    case 'New':
      if (confirm('Clear diagram?')) {
        editor.graph.removeCells(editor.graph.getDefaultParent().children || []);
      }
      break;
    case 'New Tab':
      tabManager.createTab();
      updateTabBar();
      statusBar.textContent = '✓ Created new tab';
      break;
    case 'Save':
      exportDiagram('json');
      break;
    case 'Open':
      handleOpenDiagram();
      break;
    case 'Export as SVG':
      try {
        exportManager.exportAsSVG('diagram.svg');
        statusBar.textContent = '✓ Exported as SVG';
      } catch (err) {
        statusBar.textContent = `Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
      }
      break;
    case 'Export as HTML':
      try {
        exportManager.exportAsHTML('diagram.html');
        statusBar.textContent = '✓ Exported as HTML';
      } catch (err) {
        statusBar.textContent = `Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
      }
      break;
    case 'Export as PNG':
      handleExportPNG();
      break;
    case 'Export as JPG':
      handleExportJPG();
      break;
    case 'Export as Draw.io':
      try {
        drawioFileHandler.exportToDrawio('diagram.drawio');
        statusBar.textContent = '✓ Exported as Draw.io file';
      } catch (err) {
        statusBar.textContent = `Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
      }
      break;
    case 'Import Draw.io File':
      handleImportDrawioFile();
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
    case 'Group':
      handleGroup();
      break;
    case 'Ungroup':
      handleUngroup();
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
    case 'Rotate 90°':
      handleRotate(90);
      break;
    case 'Rotate -90°':
      handleRotate(-90);
      break;
    case 'Flip Horizontal':
      handleFlip('horizontal');
      break;
    case 'Flip Vertical':
      handleFlip('vertical');
      break;
    case 'Make Same Size':
      sizingManager.makeSameSize(selectionManager.getSelectedCells());
      statusBar.textContent = 'Made same size';
      break;
    case 'Make Same Width':
      sizingManager.makeSameWidth(selectionManager.getSelectedCells());
      statusBar.textContent = 'Made same width';
      break;
    case 'Make Same Height':
      sizingManager.makeSameHeight(selectionManager.getSelectedCells());
      statusBar.textContent = 'Made same height';
      break;
    case 'Bring to Front':
      zOrderManager.bringToFront(selectionManager.getSelectedCells());
      statusBar.textContent = 'Brought to front';
      break;
    case 'Send to Back':
      zOrderManager.sendToBack(selectionManager.getSelectedCells());
      statusBar.textContent = 'Sent to back';
      break;
    case 'Layout - Hierarchical':
      handleLayout('hierarchical');
      break;
    case 'Layout - Circle':
      handleLayout('circle');
      break;
    case 'Layout - Tree':
      handleLayout('tree');
      break;
    case 'Load AWS Stencils':
      handleLoadStencil('aws');
      break;
    case 'Load Azure Stencils':
      handleLoadStencil('azure');
      break;
    case 'Load Google Cloud Stencils':
      handleLoadStencil('gcp');
      break;
    case 'Load Cisco Stencils':
      handleLoadStencil('cisco');
      break;
    case 'Load BPMN Stencils':
      handleLoadStencil('bpmn');
      break;
    case 'Edge - Orthogonal Routing':
      edgeRoutingManager.applyRoutingToSelection('orthogonal');
      statusBar.textContent = '✓ Applied orthogonal routing to edges';
      break;
    case 'Edge - Direct Routing':
      edgeRoutingManager.applyRoutingToSelection('direct');
      statusBar.textContent = '✓ Applied direct routing to edges';
      break;
    case 'Edge - Curved Routing':
      edgeRoutingManager.applyRoutingToSelection('curved');
      statusBar.textContent = '✓ Applied curved routing to edges';
      break;
    case 'Edge - Add Arrows':
      edgeRoutingManager.applyRoutingToSelection('direct');
      {
        const edges = editor.graph.getDefaultParent().children?.filter((c: any) => c.isEdge?.()) || [];
        edges.forEach((edge: any) => {
          edgeRoutingManager.addArrows(edge, false, true);
        });
      }
      statusBar.textContent = '✓ Added arrows to edges';
      break;
    case 'Edge - Remove Arrows':
      {
        const edges = editor.graph.getDefaultParent().children?.filter((c: any) => c.isEdge?.()) || [];
        edges.forEach((edge: any) => {
          edgeRoutingManager.removeArrows(edge);
        });
      }
      statusBar.textContent = '✓ Removed arrows from edges';
      break;
    case 'Edge - Solid Style':
      {
        const edges = editor.graph.getDefaultParent().children?.filter((c: any) => c.isEdge?.()) || [];
        edges.forEach((edge: any) => {
          edgeRoutingManager.setEdgeStyle(edge, 'solid');
        });
      }
      statusBar.textContent = '✓ Applied solid style to edges';
      break;
    case 'Edge - Dashed Style':
      {
        const edges = editor.graph.getDefaultParent().children?.filter((c: any) => c.isEdge?.()) || [];
        edges.forEach((edge: any) => {
          edgeRoutingManager.setEdgeStyle(edge, 'dashed');
        });
      }
      statusBar.textContent = '✓ Applied dashed style to edges';
      break;
    case 'Edge - Dotted Style':
      {
        const edges = editor.graph.getDefaultParent().children?.filter((c: any) => c.isEdge?.()) || [];
        edges.forEach((edge: any) => {
          edgeRoutingManager.setEdgeStyle(edge, 'dotted');
        });
      }
      statusBar.textContent = '✓ Applied dotted style to edges';
      break;
    case 'Connection - Corner Points':
      connectionPointsManager.applyPointsToSelection('corner');
      statusBar.textContent = '✓ Added corner connection points';
      break;
    case 'Connection - Cardinal Points':
      connectionPointsManager.applyPointsToSelection('cardinal');
      statusBar.textContent = '✓ Added cardinal connection points';
      break;
    case 'Connection - 8-Point Set':
      connectionPointsManager.applyPointsToSelection('8point');
      statusBar.textContent = '✓ Added 8-point connection set';
      break;
    case 'Connection - Clear Points':
      {
        const vertices = editor.graph.getDefaultParent().children?.filter((c: any) => c.isVertex?.()) || [];
        vertices.forEach((vertex: any) => {
          connectionPointsManager.clearConnectionPoints(vertex);
        });
      }
      statusBar.textContent = '✓ Cleared connection points';
      break;
    case 'Report Duplicate Shapes':
      {
        const report = ShapeDeduplicator.generateReport(importedShapes);
        const reportWindow = window.open('', '', 'width=600,height=400');
        if (reportWindow) {
          reportWindow.document.write(`<pre>${report}</pre>`);
          reportWindow.document.title = 'Shape Duplicates Report';
        }
      }
      statusBar.textContent = 'Duplicate shapes report generated';
      break;
    case 'Deduplicate Shapes':
      {
        const duplicates = ShapeDeduplicator.findDuplicates(importedShapes);
        const duplicateCount = duplicates.reduce((sum, g) => sum + g.duplicates.length, 0);
        if (duplicateCount === 0) {
          statusBar.textContent = 'No duplicate shapes found';
        } else {
          const deduped = ShapeDeduplicator.deduplicateShapes(importedShapes);
          importedShapes = deduped;
          buildShapeCategories();
          statusBar.textContent = `✓ Removed ${duplicateCount} duplicate shapes`;
        }
      }
      break;
    case 'Show Recent Shapes':
      {
        const recent = toolboxManager.getRecent();
        if (recent.length === 0) {
          statusBar.textContent = 'No recent shapes';
        } else {
          const recentNames = recent.map((s) => s.label).join(', ');
          statusBar.textContent = `Recent: ${recentNames}`;
        }
      }
      break;
    case 'Clear Recent Shapes':
      toolboxManager.clearRecent();
      statusBar.textContent = '✓ Cleared recent shapes history';
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
