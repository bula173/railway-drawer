# maxGraph 0.10.3 API Reference

Complete reference of native maxGraph APIs organized by feature area. Use these native functions instead of implementing workarounds.

## Graph Class - Core Methods

### Grid Management
- `graph.gridSize: number` — Property: grid spacing in pixels (default: 10)
- `graph.gridEnabled: boolean` — Property: toggle grid visibility (read/write)
- `graph.setGridEnabled(enabled: boolean): void` — Enable/disable grid rendering
- `graph.snap(value: number): number` — Align value to grid (returns snapped coordinate)

### Canvas/Container
- `graph.getContainer(): HTMLElement` — Get the graph's DOM container
- `graph.setShadowVisible(visible: boolean): void` — Toggle shadow rendering
- `graph.setBackgroundImage(image: Image): void` — Set canvas background
- `graph.isMouseDown: boolean` — Property: check if mouse button pressed

### Cell Operations
- `graph.insertVertex(parent, id, value, x, y, width, height, style): Cell` — Add vertex (shape)
- `graph.insertEdge(parent, id, value, source, target, style): Cell` — Add edge (connection)
- `graph.removeCells(cells): Cell[]` — Delete cells and return removed array
- `graph.importCells(cells, dx, dy, target, evt): Cell[]` — Import/paste cells with offset
- `graph.cloneCells(cells, includeChildren): Cell[]` — Deep clone cells
- `graph.getDefaultParent(): Cell` — Get root cell for adding shapes
- `graph.refresh(cell?: Cell): void` — Redraw graph or specific cell
- `graph.getModel(): GraphDataModel` — Access graph data model

### Selection
- `graph.getSelectionCells(): Cell[]` — Get currently selected cells
- `graph.setSelectionCells(cells: Cell[]): void` — Select specific cells
- `graph.getSelectionModel(): GraphSelectionModel` — Access selection manager
- `graph.clearSelection(): void` — Deselect all cells
- `graph.isSelectionEmpty(): boolean` — Check if nothing selected

### Styling
- `graph.getCellStyle(cell): CellStyle` — Get style object of cell
- `graph.getStylesheet(): Stylesheet` — Access style sheet
- `graph.stylesheet.putCellStyle(name, style): void` — Define named style
- `graph.getView(): GraphView` — Access graph view/renderer

### Zoom & Pan
- `graph.getView().getScale(): number` — Get current zoom level
- `graph.getView().setScale(scale: number): void` — Set zoom level
- `graph.zoomIn(): void` — Zoom in (typically 20% increment)
- `graph.zoomOut(): void` — Zoom out (typically 20% decrement)
- `graph.zoomActual(): void` — Reset zoom to 100%
- `graph.zoomToFit(): void` — Fit all cells to view
- `graph.fit(margin?: number): void` — Fit cells with margin

### Geometry/Layout
- `graph.getView().getBounds(cells): Rectangle` — Get bounding box of cells
- `graph.getView().validate(): void` — Recalculate layout
- `graph.getView().scaleAndTranslate(sx, sy, tx, ty): void` — Apply transform
- `graph.getView().translate: Object` — Property: pan offset {x, y}

### Undo/Redo
- `graph.getUndoManager(): UndoManager` — Access undo/redo manager
- `graph.undoManager.undo(): void` — Undo last action
- `graph.undoManager.redo(): void` — Redo action
- `graph.undoManager.canUndo(): boolean` — Check undo available
- `graph.undoManager.canRedo(): boolean` — Check redo available
- `graph.undoManager.clear(): void` — Clear history
- `graph.undoManager.addListener('undoableEdit', handler): void` — Listen for changes

### Graph State
- `graph.cellsMovable: boolean` — Property: allow vertex dragging
- `graph.cellsResizable: boolean` — Property: allow vertex resizing
- `graph.cellsEditable: boolean` — Property: allow text editing
- `graph.cellsSelectable: boolean` — Property: allow selection
- `graph.dropEnabled: boolean` — Property: allow drag-drop
- `graph.setConnectable(enabled: boolean): void` — Enable edge creation
- `graph.setMultigraph(enabled: boolean): void` — Allow multiple edges between vertices
- `graph.batchUpdate(): void` — Wrap in `batchUpdate(() => {...})` for performance

### Events/Listeners
- `graph.addListener(event, handler): void` — Listen to graph events
- `graph.removeListener(handler): void` — Remove listener
- `InternalEvent.disableContextMenu(container): void` — Disable right-click menu
- Event types: 'click', 'dblclick', 'change', 'resize', 'move', 'select', 'cellsAdded', 'cellsRemoved'

## GraphDataModel Class

### Cell Management
- `model.setValue(cell, value): void` — Set cell text/label
- `model.setStyle(cell, style): void` — Apply style to cell
- `model.setGeometry(cell, geometry): void` — Update position/size
- `model.getParent(cell): Cell` — Get parent cell
- `model.getChildCount(cell): number` — Count children
- `model.getChildAt(cell, index): Cell` — Get child by index

### Batch Operations
- `model.beginUpdate(): void` — Start transaction
- `model.endUpdate(): void` — End transaction (triggers refresh)
- `model.batchUpdate(() => {...})` — Execute in transaction

## GraphView Class

### Rendering & Panes
- `view.canvas: HTMLCanvasElement` — Access rendering canvas
- `view.backgroundPane: HTMLElement` — Background SVG/DOM element
- `view.rendering: boolean` — Property: enable/disable rendering
- `view.setRendering(enabled: boolean): void` — Toggle rendering
- `view.validateBackground(): void` — Redraw background
- `view.validateGraphBounds(): void` — Recalculate bounds

### Viewport/Scale
- `view.getGraphBounds(): Rectangle` — Bounds of all cells
- `view.getScale(): number` — Current zoom level (1.0 = 100%)
- `view.setScale(scale: number): void` — Set zoom level
- `view.getTranslate(): {x, y}` — Get pan offset
- `view.setTranslate(tx, ty): void` — Set pan offset
- `view.scaleAndTranslate(sx, sy, tx, ty): void` — Apply scale + translate

### Cell Coordinates
- `view.getState(cell): CellState` — Get rendered state (position, size)
- `view.getBounds(cells): Rectangle` — Get bounding box
- `view.getAllCellBounds(cells): Rectangle[]` — Get bounds of each cell

## Handlers (Input Processing)

### Built-in Handlers
Include in Graph constructor as plugins:

```typescript
new Graph(container, undefined, [
  RubberBandHandler,    // Selection box
  PanningHandler,       // Pan with spacebar/middle-mouse
  SelectionHandler,     // Vertex/edge selection with handles
  ConnectionHandler,    // Edge creation by dragging from vertex
  EdgeHandler,          // Edge routing/control points
  CellEditorHandler,    // Inline text editing
  CellHighlight,        // Highlight on hover/drag-over
]);
```

### Handler Methods
- `handler.setPanningEnabled(enabled): void` — Enable/disable panning
- `handler.isEnabled(): boolean` — Check if active
- `handler.setEnabled(enabled): void` — Enable/disable handler

## CellRenderer & Shapes

### Shape Registration
- `CellRenderer.registerShape(name, shapeClass): void` — Register custom shape
- `CellRenderer.defaultShapes: Map<string, Shape>` — Built-in shapes registry
- Built-in shapes: 'rectangle', 'ellipse', 'line', 'image', 'connector', 'text'

### Shape Base Class
- `Shape.paintBackground(c, x, y, w, h)` — Draw fill
- `Shape.paintVertexShape(c, x, y, w, h)` — Draw outline/shape
- `Shape.paintForeground(c, x, y, w, h)` — Draw overlay elements

### Canvas Methods (for painting)
- `c.fillRect(x, y, w, h)` — Fill rectangle
- `c.strokeRect(x, y, w, h)` — Draw rectangle outline
- `c.fillEllipse(x, y, w, h)` — Fill ellipse
- `c.strokeEllipse(x, y, w, h)` — Draw ellipse outline
- `c.moveTo(x, y)` — Move drawing cursor
- `c.lineTo(x, y)` — Draw line
- `c.arcTo(rx, ry, angle, largeArc, sweep, x, y)` — Draw arc
- `c.stroke()` / `c.fill()` — Finalize path
- `c.setStrokeColor(color)` / `c.setFillColor(color)` — Set colors
- `c.setStrokeWidth(width)` — Set line width
- `c.setDashed(dashed)` — Toggle dashed line

## Copy/Paste/Delete

### Clipboard Operations (use graph methods)
- `graph.cloneCells(cells, includeChildren?: boolean): Cell[]` — Clone cells (returns new array)
- `graph.importCells(cells, dx, dy, target?, evt?): Cell[]` — Paste with offset
- `graph.removeCells(cells?, includeEdges?: boolean): Cell[]` — Delete cells

### Correct Pattern
```typescript
// Copy
const cloned = graph.cloneCells(selected);
clipboard.push(...cloned);

// Paste
const imported = graph.importCells(clipboard, 10, 10);
graph.setSelectionCells(imported);

// Delete
graph.removeCells(selected);
```

## Undo/Redo

### UndoManager
- `new UndoManager(graph)` — Create undo manager
- `undoManager.undoableEditHappened(edit)` — Record change
- `undoManager.undo()` — Undo
- `undoManager.redo()` — Redo
- `undoManager.canUndo(): boolean` — Check undo available
- `undoManager.canRedo(): boolean` — Check redo available
- `undoManager.addListener('undoableEdit', handler)` — Listen for changes

### Automatic Tracking
UndoManager automatically tracks:
- Cell creation/deletion (insertVertex, insertEdge, removeCells)
- Style changes (model.setStyle)
- Geometry changes (model.setGeometry, cell.geometry updates)
- Text changes (model.setValue)

You only need to call `undoableEditHappened()` for manual changes.

## Selection & Text Editing

### Selection Model
- `selectionModel.getChangedSelection(): Cell[]` — Get cells added to selection
- `selectionModel.getRemovedSelection(): Cell[]` — Get cells removed from selection
- `selectionModel.isSelected(cell): boolean` — Check if cell selected
- `selectionModel.addListener('change', handler)` — Listen to selection changes

### Text Editing
- Enabled by: `graph.cellsEditable = true`
- Enabled by handler: `CellEditorHandler` in plugins
- Double-click to edit or call: `graph.startEditingAtCell(cell)`
- Listen: `graph.addListener('startEdit', handler)` / `'stopEdit'`

## Style System

### CellStyle Object (use native objects, not strings)
```typescript
const style = {
  shape: 'rectangle',        // Shape type
  fillColor: '#ffffff',      // Fill color
  strokeColor: '#000000',    // Border color
  strokeWidth: 2,            // Border width
  rounded: 1,                // Corner radius (0-1, not pixels)
  fontSize: 12,              // Text font size
  fontFamily: 'Arial',       // Font name
  align: 'center',           // Text alignment: 'left', 'center', 'right'
  verticalAlign: 'middle',   // Vertical: 'top', 'middle', 'bottom'
  dashed: false,             // Dashed border
  opacity: 100,              // 0-100
  textOpacity: 100,          // 0-100
  rotation: 0,               // Degrees
  shadow: false,             // Drop shadow
};
```

### Pass Style to insertVertex
```typescript
// CORRECT: Use style object directly
const vertex = graph.insertVertex(
  parent, null, 'Label',
  10, 10, 80, 60,
  { shape: 'rectangle', fillColor: '#ff0000', strokeWidth: 2 }
);

// WRONG: Don't convert to string
// const styleStr = 'shape=rectangle;fillColor=#ff0000';
```

## Common Patterns

### Shape Registration
```typescript
import { RectangleShape } from '@maxgraph/core';

class MyShape extends RectangleShape {
  paintVertexShape(c, x, y, w, h) {
    // Custom drawing
  }
}

CellRenderer.registerShape('myShape', MyShape);

// Use in style
graph.insertVertex(parent, null, 'Label', 10, 10, 80, 60, {
  shape: 'myShape'
});
```

### Batch Update Performance
```typescript
graph.batchUpdate(() => {
  for (let i = 0; i < 1000; i++) {
    graph.insertVertex(parent, null, 'Cell ' + i, 10, 10, 80, 60);
  }
});
```

### Grid Toggle
```typescript
// CORRECT: Use native property
graph.gridEnabled = true;
graph.setGridEnabled(true);

// WRONG: Don't use custom CSS backgrounds
// container.style.background = 'repeating-linear-gradient(...)';
```

### Canvas Size
```typescript
// Set container dimensions
const container = graph.getContainer();
container.style.width = '800px';
container.style.height = '600px';

// Set background color
container.style.backgroundColor = '#ffffff';

// Fit to view
graph.fit(10);  // 10px margin
```

### Pan & Zoom
```typescript
// Zoom
graph.zoomIn();
graph.zoomOut();
graph.zoomActual();
graph.zoomToFit();

// Pan
graph.getView().translate = { x: 100, y: 50 };

// Get current zoom
const scale = graph.getView().getScale();

// Fit to selection
const bounds = graph.getView().getBounds(graph.getSelectionCells());
graph.zoomToFit(bounds);
```

### Keyboard Shortcuts
```typescript
document.addEventListener('keydown', (e) => {
  // Ctrl+Z / Cmd+Z = Undo
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    graph.undoManager.undo();
  }
  
  // Ctrl+Y / Cmd+Y = Redo
  if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
    e.preventDefault();
    graph.undoManager.redo();
  }
  
  // Delete = Remove cells
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    graph.removeCells(graph.getSelectionCells());
  }
  
  // Ctrl+C = Copy
  if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
    e.preventDefault();
    clipboard = graph.cloneCells(graph.getSelectionCells());
  }
  
  // Ctrl+V = Paste
  if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
    e.preventDefault();
    const imported = graph.importCells(clipboard, 10, 10);
    graph.setSelectionCells(imported);
  }
});
```

## Deprecated/Wrong Patterns (Avoid)

| Wrong | Correct |
|-------|---------|
| `cell.clone()` | `graph.cloneCells([cell])[0]` |
| `handler.isEnabled()` → check property | `handler.panning` or handler state |
| CSS background grid patterns | `graph.gridEnabled = true` |
| `style: 'shape=rect;color=#fff'` | `style: { shape: 'rectangle', fillColor: '#fff' }` |
| Manual canvas size on container | Use native graph methods + CSS container |
| Custom event handlers instead of graph.addListener | Use `graph.addListener(event, handler)` |
| Casting `(graph as any).method()` | Check if method exists in native API |

## Reference Links

- maxGraph GitHub: https://github.com/maxGraph/maxGraph
- API Docs: https://maxgraph.github.io/maxGraph/api-docs/
- Examples: https://maxgraph.github.io/maxGraph/examples/

---

**Last Updated:** 2026-07-21
**maxGraph Version:** 0.10.3
