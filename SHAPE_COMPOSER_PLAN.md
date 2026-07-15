# Shape Composer Feature - Implementation Plan

## Overview
Create a visual and configuration-based shape composition system allowing users to:
- Compose custom shapes from primitives (circle, line, rectangle, polygon, path, text, arc)
- Edit shapes visually (drag/position) and via config forms
- Save to custom library with export/import
- Use composed shapes in main canvas like regular elements

## Phase 1: Data Structures & Types

### 1.1 Shape Primitives
```typescript
// src/types/shapeComposer.ts

type ShapePrimitive = 'circle' | 'line' | 'rectangle' | 'polygon' | 'path' | 'text' | 'arc';

interface PrimitiveElement {
  id: string;                    // Unique within composition
  type: ShapePrimitive;
  x: number;
  y: number;
  
  // Common properties
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  rotation?: number;             // Degrees
  
  // Type-specific properties
  circle?: {
    radius: number;
  };
  line?: {
    x2: number;
    y2: number;
  };
  rectangle?: {
    width: number;
    height: number;
    rx?: number;                  // Border radius
  };
  polygon?: {
    points: Array<{x: number; y: number}>;
  };
  path?: {
    d: string;                    // SVG path data
  };
  text?: {
    content: string;
    fontSize: number;
    fontFamily?: string;
    textAnchor?: 'start' | 'middle' | 'end';
  };
  arc?: {
    radius: number;
    startAngle: number;
    endAngle: number;
  };
}

interface ComposedShape {
  id: string;                    // Unique shape ID
  name: string;                  // User-friendly name
  description?: string;
  elements: PrimitiveElement[];  // Composed of these primitives
  width: number;                 // Bounding box
  height: number;
  createdAt: number;
  updatedAt: number;
}

interface ShapeLibrary {
  version: '1.0';
  shapes: ComposedShape[];
  metadata?: {
    createdBy?: string;
    exportedAt?: number;
  };
}
```

### 1.2 Composer State
```typescript
interface ShapeComposerState {
  isOpen: boolean;
  mode: 'create' | 'edit';
  currentShape?: ComposedShape;
  selectedElement?: string;      // ID of selected primitive
  
  // Canvas state within composer
  zoom: number;
  panOffset: { x: number; y: number };
}
```

---

## Phase 2: Component Architecture

### 2.1 Main Composer Component
**File**: `src/components/ShapeComposer/ShapeComposerDialog.tsx`

```typescript
<ShapeComposerDialog>
  ├── Header (title, close button)
  ├── Main Layout (two columns)
  │   ├── Canvas Area
  │   │   ├── ComposerCanvas (SVG drawing area)
  │   │   └── Toolbar (zoom, pan, grid toggle)
  │   └── Right Sidebar
  │       ├── PrimitiveToolbox (available primitives to add)
  │       ├── PropertiesEditor (for selected primitive)
  │       └── ElementsList (tree of current primitives)
  └── Footer (Save, Cancel, Export buttons)
```

### 2.2 Composer Canvas
**File**: `src/components/ShapeComposer/ComposerCanvas.tsx`

- Render composed shape primitives on SVG canvas
- Handle primitive selection (click)
- Handle primitive manipulation (drag, resize with handles)
- Show grid, measurements, snap-to-grid
- Support multi-select (Shift+Click)
- Keyboard shortcuts (Delete, Duplicate)

### 2.3 Primitive Toolbox
**File**: `src/components/ShapeComposer/PrimitiveToolbox.tsx`

- Draggable buttons for each primitive type
- Drag onto canvas to add new primitive
- Click to add with defaults

### 2.4 Properties Editor
**File**: `src/components/ShapeComposer/PrimitivePropertiesEditor.tsx`

Tabs/sections for each primitive type:
- **Common**: fill, stroke, strokeWidth, opacity, rotation
- **Circle**: radius
- **Line**: x2, y2
- **Rectangle**: width, height, rx
- **Polygon**: point editing UI
- **Path**: SVG path data input
- **Text**: content, fontSize, fontFamily, textAnchor
- **Arc**: radius, startAngle, endAngle

### 2.5 Elements List
**File**: `src/components/ShapeComposer/ElementsList.tsx`

- Tree view of all primitives in shape
- Visual preview icons
- Click to select
- Context menu (duplicate, delete, move up/down)
- Drag to reorder (z-index)

### 2.6 Shape Library Manager
**File**: `src/components/ShapeComposer/ShapeLibraryManager.tsx`

- Dialog/panel showing all saved custom shapes
- Preview thumbnails
- Edit/Delete/Duplicate options
- Export as JSON
- Import from JSON

---

## Phase 3: Shape Library Management

### 3.1 Storage Manager
**File**: `src/utils/shapeLibraryManager.ts`

```typescript
class ShapeLibraryManager {
  // localStorage persistence
  loadLibrary(): ShapeLibrary
  saveLibrary(library: ShapeLibrary): void
  
  // CRUD operations
  createShape(shape: ComposedShape): void
  updateShape(id: string, shape: ComposedShape): void
  deleteShape(id: string): void
  getShape(id: string): ComposedShape | null
  getAllShapes(): ComposedShape[]
  
  // Import/Export
  exportLibrary(filename?: string): void
  importLibrary(file: File): Promise<ShapeLibrary>
  exportShape(id: string, filename?: string): void
  importShape(file: File): Promise<ComposedShape>
}
```

### 3.2 SVG Generator
**File**: `src/utils/shapeComposerSvgGenerator.ts`

```typescript
function generateSVGFromShape(shape: ComposedShape): string {
  // Convert composed shape to inline SVG
  // Used for rendering in toolbox and canvas
}

function generateToolboxItem(shape: ComposedShape): ToolboxItem {
  // Convert composed shape to toolbox-compatible format
  // Returns ToolboxItem with generated SVG
}
```

---

## Phase 4: Toolbox Integration

### 4.1 Add Custom Shapes to Toolbox
- Load custom shapes on app startup
- Merge with standard toolboxConfig
- Display in "Custom Shapes" group
- Drag-drop to canvas like regular elements

### 4.2 Update RailwayDrawerApp
```typescript
// After loading toolboxConfig
const loadCustomShapes = async () => {
  const library = shapeLibraryManager.loadLibrary();
  const customItems = library.shapes.map(shape => 
    generateToolboxItem(shape)
  );
  setToolbox([...toolbox, ...customItems]);
};
```

---

## Phase 5: UI Integration

### 5.1 Add Menu Item
**In RailwayDrawerApp or TopToolbar**:
- "Tools" menu → "Shape Composer" → Opens ShapeComposerDialog
- Or standalone button in TopToolbar

### 5.2 Shortcut Keys
- `Shift+N`: New custom shape
- `Shift+L`: Open shape library
- In composer: `Delete` to remove primitive, `D` to duplicate

### 5.3 Status Bar Integration
- Show "Shape Composer open" status
- Display bounds of composed shape
- Show primitive count

---

## Phase 6: Export/Import Format

### 6.1 Shape Library JSON
```json
{
  "version": "1.0",
  "shapes": [
    {
      "id": "custom_platform",
      "name": "Platform",
      "description": "Railway platform/station",
      "elements": [
        {
          "id": "rect1",
          "type": "rectangle",
          "x": 0, "y": 0,
          "rectangle": { "width": 200, "height": 80 },
          "fill": "#f0f0f0",
          "stroke": "#333"
        }
      ],
      "width": 200,
      "height": 80,
      "createdAt": 1234567890,
      "updatedAt": 1234567890
    }
  ],
  "metadata": {
    "createdBy": "user@example.com",
    "exportedAt": 1234567890
  }
}
```

### 6.2 Individual Shape Export
- Single shape as JSON
- Portable, can be shared/imported

---

## Phase 7: Testing

### 7.1 Unit Tests
- `ShapeComposerDialog.test.tsx`: Rendering, state management
- `ComposerCanvas.test.tsx`: Primitive rendering, selection, manipulation
- `PrimitivePropertiesEditor.test.tsx`: Form inputs, property updates
- `shapeLibraryManager.test.ts`: CRUD, import/export

### 7.2 Integration Tests
- Create shape → Save → Appears in toolbox → Drag to canvas
- Edit shape → Update in library → Updates in toolbox
- Export → Import → Shapes match

---

## Phase 8: Implementation Order

1. **Types & Data Structures** (Phase 1)
   - Define types, interfaces
   - No UI yet

2. **Shape Library Manager** (Phase 3)
   - Storage, CRUD, import/export
   - No UI yet

3. **SVG Generator Utilities** (Phase 4)
   - Convert composed shapes to SVG/toolbox items

4. **Composer Canvas & Primitives** (Phase 2)
   - ComposerCanvas (render, select, drag primitives)
   - PrimitiveToolbox (add new primitives)
   - ElementsList (manage primitives)

5. **Properties Editor** (Phase 2)
   - Forms for each primitive type
   - Update canvas in real-time

6. **Main Composer Dialog** (Phase 2)
   - Assemble all components
   - Save/Load workflow

7. **Library Manager UI** (Phase 2)
   - View/manage saved shapes
   - Export/Import

8. **Toolbox Integration** (Phase 4)
   - Load custom shapes on startup
   - Render in toolbox

9. **Menu Integration** (Phase 5)
   - Add to menu/toolbar
   - Keyboard shortcuts

10. **Testing** (Phase 7)
    - Unit tests for each component
    - Integration tests end-to-end

---

## Key Design Decisions

### 1. Canvas Interaction Model
- **Visual Editing**: Drag primitives on canvas, resize with handles
- **Config Editing**: Edit properties in sidebar forms
- Both modes sync in real-time

### 2. Primitive Representation
- Each primitive is independent (not nested/grouped)
- Z-index determines render order
- Canvas uses absolute positioning

### 3. Storage Strategy
- localStorage for active library (quick access)
- JSON export for portability and backup
- Version field for future compatibility

### 4. Toolbox Integration
- Custom shapes appear as regular ToolboxItems
- SVG generated on-the-fly from composition
- Can edit original shape → all instances update

### 5. Extensibility
- Add new primitive types by extending ShapePrimitive enum
- Add properties in PrimitiveElement interface
- Add form in PrimitivePropertiesEditor

---

## Files to Create

```
src/
├── types/
│   └── shapeComposer.ts          # Type definitions
├── utils/
│   ├── shapeLibraryManager.ts    # CRUD, import/export
│   └── shapeComposerSvgGenerator.ts  # SVG generation
├── components/
│   ├── ShapeComposer/
│   │   ├── ShapeComposerDialog.tsx
│   │   ├── ComposerCanvas.tsx
│   │   ├── PrimitiveToolbox.tsx
│   │   ├── PrimitivePropertiesEditor.tsx
│   │   ├── ElementsList.tsx
│   │   ├── ShapeLibraryManager.tsx
│   │   ├── styles/
│   │   │   └── shapeComposer.css
│   │   └── __tests__/
│   │       ├── ShapeComposerDialog.test.tsx
│   │       ├── ComposerCanvas.test.tsx
│   │       └── shapeLibraryManager.test.ts
```

---

## Success Criteria

- ✅ Users can compose shapes from primitives visually
- ✅ All primitive types work (circle, line, rectangle, polygon, path, text, arc)
- ✅ Properties editable in real-time
- ✅ Composed shapes save to library
- ✅ Library persists in localStorage
- ✅ Export/import shapes as JSON files
- ✅ Custom shapes appear in toolbox
- ✅ Drag custom shapes to canvas like regular elements
- ✅ All tests passing (unit + integration)
- ✅ No performance degradation

---

## Risk Mitigation

1. **Canvas Performance**: Limit to 100 primitives per shape
2. **Undo/Redo**: Implement history for composer actions
3. **Data Loss**: Auto-save to localStorage every change
4. **Import Corruption**: Validate imported JSON schema
5. **Browser Storage**: Handle quota exceeded gracefully
