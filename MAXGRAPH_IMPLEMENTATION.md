# maxGraph Integration Implementation Guide

## Overview

Complete implementation of maxGraph (v0.24.0) as the unified diagram engine for Railway Drawer, replacing the custom DrawArea system. This provides professional-grade diagram capabilities with draw.io compatibility.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   RailwayDrawerApp                          │
│                   (main orchestrator)                       │
└────────────────┬────────────────────────────────────────────┘
                 │
        ┌────────┴──────────────┐
        │                       │
┌───────▼──────────┐   ┌────────▼─────────────┐
│  TabPanel        │   │   Toolbox (draw.io)  │
│  (multiple tabs) │   │   (grid layout)      │
└────────┬─────────┘   └──────────────────────┘
         │
    ┌────▼────────────────────────────────────┐
    │   MaxGraphTabIntegration                │
    │   (per-tab component)                   │
    ├──────────────────────────────────────────┤
    │ ┌─────────────────────────────────────┐ │
    │ │  MaxGraphEditorCore                 │ │
    │ │  (graph engine - @maxgraph/core)    │ │
    │ │                                     │ │
    │ │  Features:                          │ │
    │ │  • Vertex/Edge creation             │ │
    │ │  • Selection & manipulation         │ │
    │ │  • Undo/redo (native)               │ │
    │ │  • Copy/paste                       │ │
    │ │  • Zoom & pan                       │ │
    │ │  • Grid & snap-to-grid              │ │
    │ │  • Keyboard shortcuts               │ │
    │ └─────────────────────────────────────┘ │
    │ ┌─────────────────────────────────────┐ │
    │ │  MaxGraphPropertiesPanel            │ │
    │ │  (General/Style/Arrange tabs)       │ │
    │ └─────────────────────────────────────┘ │
    └──────────────────────────────────────────┘
```

## Core Components

### 1. MaxGraphEditorCore.tsx
**Main diagram editor component**
- Uses `@maxgraph/core` Graph class as foundation
- Manages UndoManager for history
- Handles keyboard shortcuts (Ctrl+Z/Y, Ctrl+C/V, Ctrl+A, Del, Ctrl+D)
- Ref-based API for parent component integration
- Dark mode support
- Grid and snap-to-grid configuration

**API:**
```typescript
interface MaxGraphEditorCoreRef {
  getXml(): string;
  setXml(xml: string): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  addShape(item: ToolboxItem, x: number, y: number): Cell;
  getSelectedCells(): Cell[];
  deleteSelected(): void;
  copy(): void;
  paste(): void;
  getZoom(): number;
  setZoom(scale: number): void;
  zoomIn(): void;
  zoomOut(): void;
  fitWindow(): void;
  selectAll(): void;
}
```

### 2. MaxGraphAdapter.tsx
**Bridge between maxGraph and Railway Drawer**
- `cellToDrawElement()`: Convert maxGraph Cell to DrawElement
- `drawElementToCellStyle()`: Convert DrawElement to maxGraph style string
- `parseStyle()`: Parse style string to object
- `parseElementStyles()`: Extract ElementStyles from maxGraph style
- `applySvgShape()`: Apply SVG to cell
- `createCellFromToolboxItem()`: Create cell from toolbox item
- `getAllCellsAsDrawElements()`: Export all cells as DrawElements
- `getSelectedAsDrawElements()`: Get selection as DrawElements

### 3. MaxGraphShapeManager.ts
**Shape registration and caching**
- Register toolbox items as shapes
- SVG preprocessing and caching
- LRU cache eviction (max 100 shapes)
- Shape metadata tracking
- `createCellFromShape()`: Create cells from cached shapes
- `applySvgToCell()`: Apply SVG to existing cells

### 4. MaxGraphPropertiesPanel.tsx
**Properties editor for selected cells**
- **General tab**: Name, ID, Type
- **Style tab**: Fill color, stroke color, stroke width, opacity
- **Arrange tab**: Position (X/Y), size (width/height), rotation
- Real-time updates to cells
- Color picker with hex input
- Numeric validation
- Dark mode support

### 5. MaxGraphTabIntegration.tsx
**Integration layer for TabPanel**
- Drop-in replacement for DrawArea
- Drag-drop shape handling
- Zoom controls
- Action toolbar (undo/redo/select all/copy/paste/delete)
- Properties panel integration
- Model change tracking

### 6. maxGraphUtils.ts
**Utility functions for maxGraph**
- `createVertex()`, `createEdge()`: Cell creation
- `getCellStyleAsObject()`, `updateCellStyle()`: Style management
- `duplicateCells()`: Clone cells with offset
- `alignCells()`: Align cells (left/center/right/top/middle/bottom)
- `distributeCells()`: Distribute cells evenly
- `serializeGraph()`: Export to JSON
- `deserializeGraph()`: Import from JSON
- `getGraphStats()`: Calculate vertex/edge counts

### 7. maxGraphDragDrop.ts
**Drag-drop integration**
- `setupMaxGraphDragDrop()`: Initialize drop handlers
- `makeDraggable()`: Make toolbox items draggable
- `handleDragOver()`, `handleDrop()`: Event handlers
- `getDropPosition()`: Convert screen to graph coordinates

### 8. maxGraphFileOps.ts
**File I/O for draw.io format**
- `exportAsDrawioXml()`: Export to .drawio XML
- `createDrawioFile()`: Create file metadata
- `saveFileToLocalStorage()`: Persist to localStorage
- `loadFileFromLocalStorage()`: Load from localStorage
- `listLocalFiles()`: List all saved files
- `downloadDrawioFile()`: Download as .drawio
- `importDrawioFile()`: Import .drawio files
- `applyDrawioFileToGraph()`: Load file to graph
- `createBackup()`: Backup creation
- `getFileSizeInfo()`: Size calculations

### 9. MaxGraphFileDialog.tsx
**Professional file manager UI**
- **Current tab**: Save current drawing, export to .drawio
- **Open tab**: List, load, delete saved files
- **New tab**: Import .drawio files
- File metadata display
- Confirmation dialogs
- Dark mode support

### 10. MaxGraphDemo.tsx
**Comprehensive demo component**
- Interactive shape palette
- Action buttons for all operations
- Live feature demonstration
- Properties panel integration
- File dialog integration

## Features

### Drawing
- ✅ Create vertices (shapes) and edges (connectors)
- ✅ Select single/multiple cells
- ✅ Drag and move cells
- ✅ Resize and rotate cells
- ✅ Delete cells

### Editing
- ✅ Undo/redo history
- ✅ Copy/paste cells
- ✅ Duplicate with offset
- ✅ Align cells (L/C/R/T/M/B)
- ✅ Distribute cells (H/V)

### Styling
- ✅ Fill color picker
- ✅ Stroke color picker
- ✅ Stroke width
- ✅ Opacity slider
- ✅ Font and text properties

### Navigation
- ✅ Zoom in/out/fit
- ✅ Pan and scroll
- ✅ Grid and snap-to-grid
- ✅ Select all

### File Operations
- ✅ Save to localStorage
- ✅ Load from localStorage
- ✅ Export to .drawio format
- ✅ Import .drawio files
- ✅ File listing and management
- ✅ Backup creation

### Keyboard Shortcuts
- `Ctrl+Z` / `Cmd+Z`: Undo
- `Ctrl+Y` / `Cmd+Y` or `Ctrl+Shift+Z`: Redo
- `Ctrl+C` / `Cmd+C`: Copy
- `Ctrl+V` / `Cmd+V`: Paste
- `Ctrl+A` / `Cmd+A`: Select all
- `Delete` / `Backspace`: Delete selected
- `Ctrl+D` / `Cmd+D`: Duplicate selected

## Integration with Existing System

### Toolbox Integration
- Drag shapes from ToolboxDrawIO to canvas
- MIME type: `application/railway-item`
- Automatic coordinate conversion
- SVG shape support

### Properties Panel
- Select cell → Properties panel updates
- Edit properties → Cell updates in real-time
- Three-tab interface matches original system

### File System
- localStorage backend for persistence
- Automatic file naming and metadata
- Draw.io format compatibility

### TabPanel Integration
- One MaxGraphTabIntegration per tab
- Independent graph state per tab
- Tab switching preserves content

## Build & Deploy

### Build
```bash
npm run build
# Output: dist/
# Size: ~1.3 MB (vendor bundles optimized)
```

### Development
```bash
npm run dev
# Auto-reload on file changes (Vite HMR)
```

### Testing
```bash
npm run test          # Watch mode
npm run test:run      # CI mode (114 tests pass)
npm run test:coverage # Coverage report
```

## Performance

### Optimizations
- ✅ Debounced updates for frequent changes
- ✅ Memoized calculations
- ✅ SVG caching in shape manager
- ✅ Code splitting via Vite
- ✅ LRU cache for shapes
- ✅ Direct DOM manipulation for zoom/pan

### Memory
- Shape cache: max 100 items with LRU eviction
- Graph instances: isolated per tab
- Event listeners: properly cleaned up

## Browser Support
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- iOS Safari 14+

## Dependencies
- `@maxgraph/core`: v0.24.0
- `react`: v19.1.0
- `typescript`: v5.8
- `vite`: v8.0

## Next Steps & Future Work

### Short Term
1. ✅ Complete maxGraph migration (Phase 1-8)
2. ✅ Full keyboard shortcut support
3. ✅ Shape system integration
4. ✅ Properties panel
5. ✅ File operations
6. ✅ Testing framework

### Medium Term
1. Layout algorithms (auto-arrange)
2. Custom shape editor
3. Connector routing improvements
4. Multi-select alignment tools
5. Layer management UI
6. Undo/redo polish

### Long Term
1. Collaborative editing
2. Cloud storage backend
3. SVG animation support
4. Advanced theming
5. Plugin system
6. Mobile app version

## Troubleshooting

### Graph Not Rendering
- Check container element exists and has dimensions
- Verify maxGraph CSS is loaded
- Check for JavaScript errors in console

### Drag-Drop Not Working
- Verify drag source sets MIME type correctly
- Check container has pointer-events enabled
- Verify drop handler coordinates calculation

### Performance Issues
- Monitor graph size (cells count)
- Check for memory leaks in dev tools
- Profile with React DevTools

## Documentation
- API docs: In-code JSDoc comments
- Examples: See MaxGraphDemo.tsx
- Tests: See MaxGraphIntegration.test.ts
- Migration guide: See MAXGRAPH_MIGRATION_PLAN.md
