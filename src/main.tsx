import './styles/app.css';
import { Graph } from '@maxgraph/core';

// Create app container
const app = document.createElement('div');
app.id = 'app';
document.body.appendChild(app);

// Create layout
app.innerHTML = `
  <div class="app">
    <header class="header">
      <h1>maxGraph - Minimal Example</h1>
    </header>
    <div class="toolbar">
      <button id="btn-undo">Undo</button>
      <button id="btn-redo">Redo</button>
      <button id="btn-delete">Delete</button>
      <button id="btn-clear">Clear</button>
    </div>
    <div class="workspace">
      <aside class="palette">
        <h3>Shapes</h3>
        <div class="shape-item" draggable="true" data-shape="rect">Rectangle</div>
        <div class="shape-item" draggable="true" data-shape="circle">Circle</div>
        <div class="shape-item" draggable="true" data-shape="line">Line</div>
      </aside>
      <div id="graph-container"></div>
    </div>
  </div>
`;

// Initialize graph
const container = document.getElementById('graph-container')!;
const graph = new Graph(container);

// Setup drag-drop
const paletteItems = document.querySelectorAll('.shape-item');

paletteItems.forEach(item => {
  item.addEventListener('dragstart', (e: Event) => {
    const dragEvent = e as DragEvent;
    const shapeType = (item as HTMLElement).dataset.shape;
    dragEvent.dataTransfer!.effectAllowed = 'copy';
    dragEvent.dataTransfer!.setData('shapeType', shapeType!);
  });
});

container.addEventListener('dragover', (e: Event) => {
  const dragEvent = e as DragEvent;
  dragEvent.preventDefault();
  dragEvent.dataTransfer!.dropEffect = 'copy';
});

container.addEventListener('drop', (e: Event) => {
  const dragEvent = e as DragEvent;
  dragEvent.preventDefault();
  const shapeType = dragEvent.dataTransfer!.getData('shapeType');

  const rect = container.getBoundingClientRect();
  const x = dragEvent.clientX - rect.left;
  const y = dragEvent.clientY - rect.top;

  const parent = graph.getDefaultParent();
  let style: any = {};
  let width = 100;
  let height = 60;

  if (shapeType === 'circle') {
    style = { shape: 'ellipse' };
    width = 60;
    height = 60;
  } else if (shapeType === 'line') {
    style = { shape: 'line' };
    width = 100;
    height = 2;
  }

  graph.insertVertex(
    parent,
    null,
    shapeType.charAt(0).toUpperCase() + shapeType.slice(1),
    x - width / 2,
    y - height / 2,
    width,
    height,
    style
  );
});

// Toolbar buttons
document.getElementById('btn-delete')?.addEventListener('click', () => {
  graph.removeCells();
});

document.getElementById('btn-clear')?.addEventListener('click', () => {
  graph.model.clear();
});

document.getElementById('btn-undo')?.addEventListener('click', () => {
  const um = (graph as any).undoManager;
  if (um?.canUndo?.()) {
    um.undo();
  }
});

document.getElementById('btn-redo')?.addEventListener('click', () => {
  const um = (graph as any).undoManager;
  if (um?.canRedo?.()) {
    um.redo();
  }
});

console.log('✅ maxGraph app loaded');
