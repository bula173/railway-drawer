# Shapes System

This folder contains all shape definitions and registrations for the railway-drawer application. The shape system supports two distinct types of shapes with different rendering approaches.

## Architecture Overview

### Two Shape Types

The shape system clearly distinguishes between two shape implementation patterns:

#### 1. **Vertex-Based Shapes** (`type: 'vertex'`)

Native maxGraph shapes that extend Shape classes from @maxgraph/core.

- **Definition**: Custom classes extending `RectangleShape`, `EllipseShape`, or other Shape base classes
- **Rendering**: Direct canvas rendering via custom `paintVertexShape()` methods
- **Icon**: Emoji or text character (scales visually in toolbar)
- **Example**: `BasicRectangle`, `UmlClassShape`, `RailwaySignal`

**File structure**:
```
group/
├── group-shapes.ts    # Shape class definitions (e.g., RectangleShape, CircleShape)
├── registry.ts        # registerGroupShapes() function with shape metadata
└── index.ts          # Exports
```

**Registration pattern**:
```typescript
// In group/registry.ts
shapeRegistry.register({
  id: 'rectangle',
  type: 'vertex',           // Type indicator
  label: 'Rectangle',
  icon: '▭',                // Emoji icon
  group: 'Basic',
  width: 100,
  height: 60,
  style: { fillColor: '#e1d5e7', strokeColor: '#9673a6' },
});
```

**Canvas creation**:
- Vertex-based shapes are created as `graph.insertVertex()` with the registered style
- maxGraph handles rendering via CellRenderer which looks up the custom shape class
- Icon in toolbar displays as emoji/text, scaled CSS for visual consistency

---

#### 2. **SVG-Based Shapes** (`type: 'svg'`)

Pure SVG definitions rendered as image elements on the canvas.

- **Definition**: SVG string stored in dedicated `svg-*.ts` file
- **Rendering**: maxGraph image shape with `data:image/svg+xml` data URL
- **Icon**: Raw SVG string (displays exact shape preview in toolbar)
- **Example**: Arrows (wideArrow, thinArrow, etc.)

**File structure**:
```
group/
├── svg-shapes.ts      # SVG definitions (e.g., const svgArrows = { ... })
├── registry.ts        # registerGroupShapes() with SVG-to-dataURL conversion
└── index.ts          # Exports
```

**Registration pattern**:
```typescript
// In group/registry.ts
const svgToDataUrl = (svg: string) => 
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

shapeRegistry.register({
  id: 'arrow_right',
  type: 'svg',                                // Type indicator
  label: 'Arrow Right',
  icon: svgArrows.wideArrow,                  // Raw SVG string for toolbar
  group: 'Arrows',
  width: 100,
  height: 60,
  style: {
    shape: 'image',                           // Use maxGraph image shape
    image: svgToDataUrl(svgArrows.wideArrow), // Data URL for canvas
  },
});
```

**Canvas creation**:
- SVG-based shapes are created as `graph.insertVertex()` with `shape: 'image'`
- The `image` property contains the SVG as a data URL
- maxGraph renders it as an `<image>` element with the data URL
- Icon in toolbar shows the actual SVG scaled by CSS for preview

---

## Current Shape Groups

| Group | Type | Count | Files |
|-------|------|-------|-------|
| **Arrows** | SVG | 20 | `svg-arrows.ts`, `registry.ts` |
| **Basic** | Vertex | 15+ | `basic-shapes.ts`, `registry.ts` |
| **Flowchart** | Vertex | 9 | `flowchart/` files + shape classes |
| **Cloud** | Vertex | 5 | `cloud/` files + CloudShape, DatabaseShape |
| **DFD** | Vertex | 3 | `dfd/` + shape classes |
| **C4** | Vertex | 4 | `c4/` + shape classes |
| **Network** | Vertex | 5 | `network/` + shape classes |
| **BPMN** | Vertex | 5 | `bpmn/` + BpmnEventShape, etc |
| **UML** | Vertex | 20+ | `uml/` + UmlClassShape, UmlStateShape, etc |
| **Railway** | Vertex | 25+ | `railway/` + RailShape, SignalShape, etc |
| **ERTMS** | Vertex | 8 | `ertms/` + ERTMSBaliseShape, etc |
| **Custom** | Vertex | 1 | `custom/image-shape.ts` |

---

## How to Add a New Shape

### Option 1: Adding a Vertex-Based Shape

**Scenario**: You want to add a new geometry-based shape (e.g., Pentagon).

#### Step 1: Create or use existing shape class
```typescript
// existing: basic/basic-shapes.ts
export class PentagonShape extends RectangleShape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    // Custom rendering logic
  }
}
```

#### Step 2: Register in group registry
```typescript
// basic/registry.ts
export function registerBasicShapes(): void {
  // ... existing shapes ...
  
  shapeRegistry.register({
    id: 'pentagon',
    type: 'vertex',
    label: 'Pentagon',
    icon: '⬠',                    // Emoji icon for toolbar
    group: 'Basic',
    width: 100,
    height: 100,
    style: { shape: 'customPentagon', fillColor: '#f4b183', strokeColor: '#e67e22' },
  });
}
```

#### Step 3: Ensure CellRenderer is updated (in main index.ts)
```typescript
import { PentagonShape } from './basic/basic-shapes';

// In registerShapes():
CellRenderer.registerShape('customPentagon', PentagonShape as any);
```

---

### Option 2: Adding an SVG-Based Shape

**Scenario**: You want to add a new SVG arrow variant or specialized shape.

#### Step 1: Define SVG in svg file
```typescript
// arrows/svg-arrows.ts
export const svgArrows = {
  // ... existing arrows ...
  
  customArrow: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M 1.5 6.3 L 21.8 6.3 L 21.8 6.3 L 30.5 15 L 21.8 23.7 L 21.8 23.7 L 1.5 23.7 L 10.2 15 Z" 
          fill="currentColor" stroke="currentColor" stroke-width="1.3" stroke-miterlimit="10"/>
  </svg>`,
};
```

#### Step 2: Register in group registry
```typescript
// arrows/registry.ts
const svgToDataUrl = (svg: string) => 
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export function registerArrowShapes(): void {
  // ... existing arrows ...
  
  shapeRegistry.register({
    id: 'custom_arrow',
    type: 'svg',
    label: 'Custom Arrow',
    icon: svgArrows.customArrow,              // Raw SVG for toolbar preview
    group: 'Arrows',
    width: 120,
    height: 60,
    style: {
      shape: 'image',
      image: svgToDataUrl(svgArrows.customArrow),
    },
  });
}
```

#### Step 3: No CellRenderer update needed
SVG-based shapes don't require CellRenderer registration—maxGraph handles them as image shapes.

---

## Shape Configuration Reference

### ShapeConfig Interface
```typescript
interface ShapeConfig {
  id: string;              // Unique identifier (kebab-case recommended)
  label: string;           // Display name for toolbar/panels
  type: 'vertex' | 'svg';  // Shape type: vertex-based or SVG-based
  icon: string;            // Emoji (vertex) or SVG string (svg)
  group: string;           // Category for grouping in toolbar
  width: number;           // Default width in pixels
  height: number;          // Default height in pixels
  style: any;              // maxGraph style object
}
```

### Icon Field
- **Vertex shapes**: Use emoji or single character (e.g., `'▭'`, `'●'`, `'🚦'`)
  - Scales visually via CSS in toolbar
  - Pure text/emoji, no rendering complexity

- **SVG shapes**: Use raw SVG string (e.g., `'<svg>...</svg>'`)
  - Must have `viewBox` attribute for consistent scaling
  - Recommended viewBox: `"0 0 32 30"` for consistency
  - Displays actual shape preview in toolbar

### Style Object

**For vertex shapes**:
```typescript
style: {
  fillColor: '#e1d5e7',
  strokeColor: '#9673a6',
  // Other maxGraph style properties
}
```

**For SVG shapes**:
```typescript
style: {
  shape: 'image',
  image: svgToDataUrl(svgString),
  // image contains the data URL
}
```

---

## File Organization

### Adding a new shape group

1. Create folder: `src/shapes/groupname/`
2. Add three files:
   - `shapes.ts` or `svg-shapes.ts` (shape definitions)
   - `registry.ts` (registration function)
   - `index.ts` (exports)

Example: Adding a "Custom Widgets" group
```
shapes/
└── custom-widgets/
    ├── svg-widgets.ts      # SVG definitions
    ├── registry.ts         # registerCustomWidgetShapes()
    └── index.ts           # Export registerCustomWidgetShapes
```

3. Update main `src/shapes/index.ts`:
   - Import `registerCustomWidgetShapes`
   - Call it in `registerShapes()`

4. Update CellRenderer (if vertex-based):
   - Register custom shape classes with CellRenderer

---

## Design Principles

1. **Type clarity**: Every shape must explicitly declare `type: 'vertex'` or `type: 'svg'`
2. **Icon fidelity**: 
   - Vertex icons are emoji/text for simplicity
   - SVG icons show actual shape preview
3. **Modular groups**: Each logical group (Arrows, Railway, UML) is isolated
4. **Consistent registration**: All shapes follow the same registration pattern
5. **No mixing**: A shape is either vertex-based OR SVG-based, never both

---

## Toolbar Rendering

The toolbar (`toolbar.ts`) handles both shape types uniformly:

1. **Vertex shapes**: Icon (emoji) displayed as text, scaled via CSS
2. **SVG shapes**: Icon (SVG string) rendered as `<svg>` element, scaled via CSS

When dragging a shape from toolbar to canvas:
- **Vertex shape** → Creates vertex with CellRenderer-based shape class
- **SVG shape** → Creates vertex with `shape: 'image'` and data URL

Both render correctly on the canvas with their defined styles.

---

## Testing a New Shape

1. **Register the shape** in appropriate group registry
2. **Import/register** with CellRenderer (if vertex)
3. **Run**: `npm run dev`
4. **Drag** shape from toolbar to canvas
5. **Verify**: Shape renders correctly on canvas
6. **Verify**: Icon displays correctly in toolbar
7. **Test**: Resize, rotate, edit text (if applicable)

---

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Shape doesn't appear on canvas | CellRenderer not registered (vertex) | Register shape class with `CellRenderer.registerShape()` |
| Icon doesn't display in toolbar | Missing `icon` field in config | Add emoji or SVG string to `icon` field |
| SVG not rendering | Wrong MIME type in data URL | Use `data:image/svg+xml;charset=utf-8,` |
| Shape stretched on canvas | Aspect ratio mismatch | Ensure `width/height` ratio matches SVG viewBox |
| Icon is cut off | CSS constraints | Check `.shape-icon-svg` CSS sizing |

