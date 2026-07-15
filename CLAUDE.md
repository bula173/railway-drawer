# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
- `npm run dev` — Start Vite dev server (port 3000, HMR enabled)
- `npm run build` — Production build to `/dist` with sourcemaps
- `npm run preview` — Serve production build locally for testing

### Testing
- `npm run test` — Run tests in watch mode (Vitest)
- `npm run test:run` — Run all tests once (CI mode, 114 tests, all passing)
- `npm run test:ui` — Visual test interface with Vitest UI
- `npm run test:coverage` — Generate coverage report
- `npm run test:e2e` — Run Playwright E2E tests
- `npm run test:e2e:headed` — E2E tests with browser visible

### Code Quality
- `npm run lint` — Run ESLint checks
- `npm run lint:fix` — Auto-fix ESLint violations
- `npm run typecheck` — TypeScript type checking without emit
- `npm run ci` — Full CI pipeline (lint → typecheck → tests → build)

---

## Architecture Overview

### Application Structure
```
RailwayDrawerApp (main orchestrator)
├── TopToolbar (zoom, grid, brush tools)
├── TabPanel (multi-tab workspace management)
│   └── DrawArea (SVG canvas with complex element system)
├── Toolbox (drag-drop element library)
├── DrawioPropertiesPanel (tabbed: General/Style/Text/Arrange)
├── AlignmentToolbar (element alignment/distribution)
├── ConnectorPanel (connector type selection)
├── BrushPanel (brush stroke configuration)
├── EditMenu (undo/redo/copy/paste)
├── FloatingLayersPanel (element layers)
└── StatusBar (info display)
```

### Data Flow
1. **Toolbox** → User drags element → **DrawArea** creates DrawElement
2. **DrawArea** manages:
   - Element selection (1D objects like connectors vs 2D shapes)
   - Canvas manipulation (zoom, pan, grid snap)
   - Element modification (resize, rotate, position)
3. **DrawioPropertiesPanel** binds to selected element → updates DrawArea
4. **TabPanel** manages multiple canvas instances independently
5. **File operations** (save/load/export) serialize tabs to FileData format

---

## Key Data Models

### DrawElement (Core Object Type)
```typescript
{
  id: string;              // Unique identifier
  type: 'shape' | 'connector' | 'brush' | 'text';
  x: number; y: number;    // Position
  width: number; height: number;
  rotation: number;        // Degrees
  shape: string;           // SVG content or shape ID
  styles: ElementStyles;   // Colors, strokes, fills
  shapeElements?: ShapeElement[];  // Sub-elements (for complex shapes)
  textRegions?: TextRegion[];      // Editable text within shapes
  connectorType?: string;  // For connectors: 'straight', 'bezier', etc.
}
```

### Dimensionality Architecture
- **2D Objects** (shapes, rectangles, circles): Full manipulation (resize, rotate)
- **1D Objects** (connectors): Linear manipulation (length, angle, endpoints)
- Selection and UI differs based on dimensionality

### ToolboxItem (Reusable Element)
```typescript
{
  id: string;
  name: string;
  type: 'custom' | 'ertms' | 'rail';
  group: 'General' | 'ERTMS' | 'Signals' | etc;
  shapeElements: ShapeElement[];
  width: number; height: number;
  dimensionality: '1D' | '2D';
}
```

---

## Critical Architecture Decisions

### 1. Unified Element System
- **Connectors** are DrawElements (type='connector'), not separate objects
- Allows treating all drawable things uniformly
- Enables copy/paste/properties for connectors like shapes

### 2. ERTMS SVG Enhancement
- Base64-encoded SVGs in `src/config/ertmsSvgUrls.json`
- Runtime enhancement via `enhanceToolboxWithRemoteSvgs()`
- Can upgrade to external hosting (GitHub, CDN) by changing `baseUrl`
- Automatic fallback to inline SVGs if enhancement fails

### 3. Two-Level Selection
- **Level 1**: Select DrawElement (shows bounding box)
- **Level 2**: Click again to select specific ShapeElement within (for text editing)
- Enables precise editing of complex shapes with multiple components

### 4. Properties Panel Tabs
- **General**: Element name, ID, dimensionality
- **Style**: Colors, strokes, fills, opacity
- **Text**: Text regions within shapes
- **Arrange**: Position, size, rotation, stacking order

---

## Component Interaction Patterns

### Adding New Elements to Toolbox
1. Edit `src/assets/toolboxConfig.json` with element definition
2. Include SVG shape, dimensions, and grouping
3. System auto-loads on app startup
4. For ERTMS elements: Add to `src/config/ertmsSvgUrls.json` for enhanced SVG

### Modifying Element Properties
1. User selects element on canvas (DrawArea selection)
2. DrawioPropertiesPanel reflects current element
3. User edits property → fires onChange
4. onChange updates DrawArea state → re-renders element

### Creating New Connectors
1. Select connector tool from TopToolbar
2. Click two points on canvas
3. ConnectorPanel lets user choose style (straight, bezier, etc.)
4. Element stored as DrawElement with type='connector'

---

## File I/O & Persistence

### Saving/Loading
- `utils/storageManager.ts` handles localStorage persistence
- Each tab serializes to `DrawAreaTab` (elements + metadata)
- `FileData` format includes version, timestamp, all tabs
- Supports JSON export/import for sharing

### Export Formats
- **PNG/JPG**: html-to-image library
- **SVG**: Native SVG rendering with cleanup
- **PDF**: jsPDF with canvas rendering

---

## State Management

### Global State (RailwayDrawerApp)
- Toolbox items
- Active tabs
- Global clipboard (for cross-tab copy/paste)
- Themes and UI preferences

### Local State (DrawArea)
- Elements array
- Selection state
- Zoom/pan
- Undo/redo history

### Property Panel State
- Selected element reference
- Active tab (General/Style/Text/Arrange)
- Property edit values

---

## Testing Approach

### Test Structure
- **53 unit tests** in `src/components/__tests__/` (all passing)
- **Vitest** for unit/component tests with React Testing Library
- **Playwright** for E2E tests
- All tests run in CI on Ubuntu, Windows, macOS with Node 18 & 20

### Key Test Patterns
- Mock file operations (`mock-file-ops.ts`)
- Mock clipboard (`navigator.clipboard`)
- Render components with props, interact, assert
- No console errors or React act() warnings

### Running Tests
```bash
npm run test:run          # All tests once
npm run test:coverage     # With coverage report
npm run test:e2e          # Playwright headless
npm run test:e2e:headed   # Playwright with browser visible
```

---

## Performance Considerations

### Optimizations in Place
- **Debounced updates** for frequent property changes
- **Memoized calculations** for expensive geometry operations
- **SVG caching** for remote ERTMS SVG loading
- **Code splitting** in Vite build (vendor chunks for React, utils, etc.)
- **Lazy loading** of features (Playwright for E2E, jsPDF for export)

### Canvas Rendering
- DrawArea uses React ref to SVG element (not declarative rendering)
- Direct manipulation for performance on large element counts
- Zoom/pan don't re-render all elements, just transform viewport

---

## Common Development Tasks

### Adding a New Shape Type
1. Create SVG in Figma/draw.io/Inkscape
2. Add entry to `src/assets/toolboxConfig.json`
3. Define dimensions and grouping
4. Test drag onto canvas in dev server
5. Add unit test in `__tests__/`

### Implementing New Tool
1. Add tool type to `DrawTool` in `src/types/index.ts`
2. Add UI button in TopToolbar or menu
3. Handle tool selection in RailwayDrawerApp
4. Add mouse/keyboard handlers in DrawArea
5. Create corresponding panel (e.g., ConnectorPanel, BrushPanel)

### Debugging Canvas Rendering
- Open browser DevTools → Elements tab
- Inspect generated SVG structure
- Check `DrawArea.tsx` render logic
- Use logger system: `logger.debug('DrawArea', 'message', data)`

### Working with Custom Shapes (Future: Shape Composer)
- Planned feature to compose shapes from primitives
- Will store in custom library with export/import
- Integrate with existing toolbox system

---

## Recent Improvements & Architecture

### Connectors Refactoring
- **Before**: Separate connector state from elements
- **After**: Connectors are DrawElements with type='connector'
- **Benefit**: Unified copy/paste/properties, simpler state management
- Related memory: [Connectors unified architecture](../memory/refactor_connectors_as_elements.md)

### Dimensionality Architecture
- **1D vs 2D** distinction affects UI (selection, resize, properties)
- Connectors are 1D (start/end points)
- Shapes are 2D (full bounding box manipulation)
- Related memory: [Dimensionality architecture](../memory/dimensionality_architecture.md)

### ERTMS SVG Quality
- Improved signal diagrams from simple shapes to realistic signals
- Added proper balise representations (ground transponders)
- Signal Heads: Vertical signals with colored lights
- Balises: Ground-level transponders with antennas
- Related memory: [ERTMS SVG Quality](../memory/ertms_svg_quality.md)

---

## Important Files & Modules

### Core Components
- `RailwayDrawerApp.tsx` — Main app orchestrator (400+ lines, many responsibilities)
- `DrawArea.tsx` — SVG canvas with element manipulation
- `Toolbox.tsx` — Drag-drop element library
- `DrawioPropertiesPanel.tsx` — Properties editor with tabs
- `Elements.tsx` — SVG element rendering system

### Utilities
- `utils/logger.ts` — Structured logging (use instead of console.log)
- `utils/storageManager.ts` — localStorage persistence
- `utils/toolboxEnhancer.ts` — ERTMS SVG enhancement system
- `utils/svgLoader.ts` — SVG fetching with caching
- `utils/connectorStyles.ts` — Connector type definitions
- `utils/brushTools.ts` — Brush stroke presets and config

### Configuration
- `src/assets/toolboxConfig.json` — Toolbox element definitions
- `src/config/ertmsSvgUrls.json` — ERTMS SVG URLs/data URIs
- `vite.config.ts` — Vite build config with vendor code splitting
- `eslint.config.js` — ESLint rules (TypeScript, React hooks)

### Types
- `src/types/index.ts` — Centralized type definitions
- Re-exports from components (DrawElement, ToolboxItem, etc.)
- App constants (GRID_SIZE, zoom limits, etc.)

---

## Debugging Tips

### Enable Detailed Logging
```typescript
import { logger } from './utils/logger';
logger.debug('ComponentName', 'message', { data });
logger.error('ComponentName', 'error', { error });
```

### Inspect Element State
- DrawArea stores elements in ref → inspect via React DevTools
- Check DrawElement.id matches selection
- Verify styles applied to SVG (check CSS vs inline)

### Common Issues
1. **Element not appearing**: Check z-index, opacity, or position off-canvas
2. **Text not editable**: Verify textRegions array in element
3. **Connector not drawing**: Check start/end points are valid
4. **Style not applying**: Check for conflicting CSS or vector-effect

---

## Future Features & Roadmap

### Planned: Shape Composer
- Compose custom shapes from primitives (circle, line, rectangle, polygon, text, arc)
- Visual drag-drop editor + configuration-based
- Export/import custom shape library
- Integrate with toolbox system

### Known Limitations
- Element containers may disappear on style changes (monitored)
- Large SVG exports have performance implications
- Mobile touch interactions need refinement

---

## Development Workflow

### Before Starting
```bash
npm install              # Install dependencies
npm run typecheck        # Verify types
npm run lint:fix         # Auto-fix style issues
```

### Development Loop
```bash
npm run dev              # Start dev server
# Edit code → Vite HMR auto-reloads
npm run test             # Watch tests as you code
```

### Before Committing
```bash
npm run typecheck        # Type safety
npm run lint             # Code style
npm run test:run         # All tests pass
npm run build            # Production build works
```

### Full CI Pipeline (Local)
```bash
npm run ci               # Runs: lint → typecheck → tests → e2e → build
```

---

## Key Technologies & Versions

- **React 19.1.0** — UI framework with hooks, concurrent rendering
- **TypeScript 5.8** — Full type safety, strict mode enabled
- **Vite 8.0** — Ultra-fast build, HMR development
- **Vitest 4.1** — Modern test runner (Jest-compatible)
- **React Testing Library** — Component testing, accessibility focus
- **TailwindCSS 3.4** — Utility-first CSS
- **Lucide Icons** — SVG icon library

---

## Getting Help

### Locate Code
- Use IDE search (`Cmd+F` / `Ctrl+F`) for symbol names
- Most types defined in `src/types/index.ts` — start there
- Component hierarchy visible in `RailwayDrawerApp.tsx`

### Understanding Features
- Check README.md for user-facing feature descriptions
- Memory system in `.claude/projects/.../memory/` has architectural notes
- Test files (`__tests__/`) demonstrate expected behavior

### Debugging
- Enable logger in specific components
- Use React DevTools to inspect component hierarchy
- Browser DevTools → Elements tab for SVG inspection
