# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

railway-drawer is a TypeScript-based web application for displaying and editing railway diagrams using vector graphics. It uses maxGraph for graph visualization and Vite as the build tool.

## Build & Development

**Node.js:** ALWAYS use version from `.nvmrc`. Run `nvm use` if using nvm.

```bash
npm install                    # Install dependencies
npm run dev                    # Start dev server (http://127.0.0.1:3001)
npm run build                  # Build for production (output to dist/)
npm run preview                # Preview production build locally
```

## Project Structure

- **src/main.ts** — Application entry point; initializes graph and UI components
- **src/shapes/.ts** — Custom shape definitions for railway elements (registers with CellRenderer)
- **src/style.css** — Global styling (CSS for UI panels, layout, responsive design)
- **src/index.d.ts** — TypeScript definitions for CSS module imports
- **src/config/** — Configuration files (currently minimal)
- **index.html** — HTML entry point; contains graph container and control buttons

## Architecture

### Graph Hierarchy (maxGraph)
Railway-drawer uses maxGraph's Graph class for visualization:
- **Graph** — Main class providing full-featured graph with default plugins/handlers
- **Cell** — Represents vertices (shapes) or edges (connections) in the diagram
- **Model** — GraphDataModel holds the graph structure (cells and relationships)
- **View** — GraphView renders cells to the DOM (SVG)
- **CellRenderer** — Handles shape rendering; custom shapes registered via `CellRenderer.defaultShapes`

### Key Classes & Patterns

**Shape Registration:**
- Custom shapes extend base shape classes (RectangleShape, EllipseShape)
- Registered in CellRenderer.defaultShapes map: `CellRenderer.defaultShapes['customName'] = CustomShapeClass`
- Shapes override paintBackground() and paintVertexShape() for custom rendering

**Graph Methods (commonly used):**
- `graph.insertVertex()` — Add vertex (shape) to graph
- `graph.insertEdge()` — Add edge (connection) between vertices
- `graph.batchUpdate()` — Wrap multiple model changes for performance
- `graph.fit()` — Fit all cells to view with margin
- `graph.zoomActual()` — Reset zoom to 100%
- `graph.getStylesheet()` — Access/modify cell styles

**Event Handling:**
- InternalEvent.disableContextMenu() — Disable right-click menu
- Selection: Listen to selection changes via graph events (future: implement SelectionHandler)
- Pan/Zoom: RubberBandHandler enables selection; setPanning(true) enables pan mode

### Planned Components (Vanilla TypeScript)

1. **Toolbox** — Panel with draggable railway shape elements
2. **DrawArea** — Main canvas for graph editing
3. **TabPanel** — Multi-tab interface for managing multiple drawings
4. **PropertiesPanel** — Inspector for editing cell properties (position, style, text)
5. **FileManager** — Load/save/export diagrams (XML format compatible with maxGraph)
6. **StatusBar** — Display zoom level, cursor position, selected element info

## TypeScript Configuration

**Strict mode enabled** (`tsconfig.json`):
- `strict: true` — All strict checks active
- `noUnusedLocals`, `noUnusedParameters` — Catch unused code
- `noImplicitReturns`, `noImplicitOverride` — Explicit function contracts
- Target: **ES2020**, Module: **es2020**

**CSS Imports:** CSS files treated as modules via `index.d.ts` type declaration.

## maxGraph 0.10.3 API Notes

**Import Handlers (old "Plugins" API):**
```typescript
import { RubberBandHandler, PanningHandler, SelectionHandler } from '@maxgraph/core';
```
These are instantiated and passed to Graph constructor as array of GraphPluginConstructor[].

**No `getDefaultPlugins()` function** — manually pass handlers/plugins to Graph constructor:
```typescript
new Graph(container, undefined, [RubberBandHandler]);
```

**CSS:**
- Required: `import '@maxgraph/core/css/common.css'` for RubberBandHandler styles

**Constants:**
- No `constants.VERSION` export; use hardcoded string if version display needed
- Access constants via direct imports: `import { constants } from '@maxgraph/core'`

## Common Development Tasks

### Add a new shape element
1. Create shape class extending RectangleShape or EllipseShape in custom-shapes.ts
2. Override paintBackground() or paintVertexShape() for custom appearance
3. Register in CellRenderer.defaultShapes map
4. Add to toolbox config (future: toolboxConfig.json)

### Modify graph styles
- `graph.getStylesheet().putCellStyle()` — Define named style
- Apply via `style: { baseStyleNames: ['myStyle'] }` in insertVertex/insertEdge

### Handle selection/editing
- Add SelectionHandler to Graph plugins for vertex/edge selection
- Add CellEditorHandler for inline text editing
- Listen to selection events via InternalEvent (implement in future PropertiesPanel)

### Save/Load diagrams
- `model.toXml()` or `ModelXmlSerializer.serialize()` — Export to XML
- `ModelXmlSerializer.deserialize()` or `model.fromXml()` — Import from XML
- Store/retrieve via localStorage or file API

## Browser Support

- Modern browsers: Chrome, Edge, Firefox, Safari
- **ES2020** target — no IE support
- Touch/mobile support: depends on maxGraph handlers (PanningHandler, SelectionHandler support touch)

## Dependencies

- **@maxgraph/core@0.10.3** — Graph visualization library (replacing mxGraph)
- **typescript@5.6.3** — TypeScript compiler
- **vite@7.3.3** — Build tool and dev server
- **@vitejs/plugin-react@4.3.1** — React plugin (unused in current vanilla setup; can remove)

## Git & Commits

- Main branch: reference implementation with React
- Current branch: feature/maxgraph-native-app (vanilla TypeScript)
- Commit style: type(scope): subject — see `.claude/rules/git/commit-conventions.md` if available
