# 1D vs 2D Element Architecture

## Overview

Elements in Railway Drawer now properly distinguish between **1D objects** (lines, connectors) and **2D objects** (shapes, rectangles). This creates a more intuitive and professional UX aligned with industry standards.

## Property: `dimensionality`

Added to `DrawElement` interface:
```typescript
dimensionality?: '1D' | '2D'; // Default: '2D'
```

### Values
- **`'1D'`** - Linear objects (connectors, lines, arrows)
  - No bounding box highlight
  - No resize handles
  - No rotation handle
  - No connection points
  - Selection shown by changing line color to blue
  - Can be moved by dragging the line itself
  
- **`'2D'`** (default) - Spatial objects (shapes, rectangles, circles)
  - Bounding box highlight when selected/hovered
  - Resize handles visible when selected
  - Rotation handle visible when selected
  - Connection points for attaching connectors
  - Selection shown by blue outline

## Element Type Examples

### 2D Elements
- Rectangles
- Circles
- Ellipses
- Polygons
- Text boxes
- Images
- Groups

**Properties:**
- Selection: Blue outline + handles
- Interaction: Resize, rotate, label
- Visual: Bounding box on hover

### 1D Elements
- Connectors
- Lines
- Arrows
- Tracks

**Properties:**
- Selection: Line color changes to blue
- Interaction: Draggable, editable label, style properties
- Visual: No bounding box, no handles

## Behavior Differences

### Selection Visual Feedback

#### 2D Objects
```
┌─────────────────┐
│ [  Shape Area  ]│  ← Blue selection outline
│ with handles    │     + resize handles
│ and rotation    │     + rotation handle
└─────────────────┘
```

#### 1D Objects (Connectors)
```
Before Selection: ────────────────  (original color, e.g., black)

After Selection:  ╔════════════════  (line turns blue #0066ff)
                  (no handles, just color change)
```

### Interaction Patterns

#### 2D Object Selected
- Click and drag to move entire shape
- Drag resize handles to resize
- Drag rotation handle to rotate
- Show connection points for connectors
- Edit properties (fill, stroke, etc.)

#### 1D Object (Connector) Selected
- Click and drag line to move entire connector
- Line changes to blue color
- Edit label in properties panel
- Edit style (line width, arrows, etc.)
- No resize or rotation options

## Implementation Details

### DrawElement Interface Update
```typescript
interface DrawElement {
  id: string;
  type: string;
  dimensionality?: '1D' | '2D'; // NEW PROPERTY
  // ... rest of properties
}
```

### Connector Creation (1D)
```typescript
const newConnectorElement: DrawElement = {
  id: `connector-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  type: 'connector',
  dimensionality: '1D',  // Set to 1D
  // ... rest of connector properties
};
```

### Shape Creation (2D - Default)
```typescript
// Default behavior - no dimensionality specified defaults to 2D
const newShape: DrawElement = {
  id: `shape-${Date.now()}`,
  type: 'rectangle',
  // dimensionality defaults to '2D'
  // ... rest of shape properties
};
```

## Visual Changes

### RenderElement.tsx
- Skip rendering selection highlight for 1D objects
- Skip rendering resize handles for 1D objects
- Skip rendering rotation handle for 1D objects
- Skip rendering connection points for 1D objects

### ConnectorRenderer.tsx
- Selection indicated by line color change to blue (#0066ff)
- No border highlight or additional overlays
- Line itself becomes the interactive element
- Clean, minimal visual feedback

## User Experience Improvements

### Before (All Elements Treated Same)
- Connectors had bounding boxes like shapes
- Connectors had resize handles
- Confusing UI with unnecessary controls
- Hard to distinguish line from shape selection

### After (1D vs 2D Architecture)
- ✅ Connectors appear as simple colored lines
- ✅ Selection shown naturally by changing line color
- ✅ Only relevant controls shown for each element type
- ✅ Intuitive, professional appearance
- ✅ Consistent with industry standards (Draw.io, Figma, Miro)

## Benefits

1. **Cleaner UI** - Only show relevant controls
2. **Intuitive** - Users understand what each control does
3. **Professional** - Matches industry-standard tools
4. **Performance** - Less rendering for 1D objects
5. **Maintainable** - Clear distinction in code logic
6. **Extensible** - Easy to add more element types

## Future Extensions

With this architecture, it's easy to add new element types:

```typescript
// Potential future 1D objects
dimensionality: '1D'
type: 'line'      // Simple line
type: 'arrow'     // Arrow line
type: 'curve'     // Curved path
type: 'path'      // Complex path

// Potential future 2D objects
dimensionality: '2D'
type: 'group'     // Group of shapes
type: 'image'     // Image element
type: 'table'     // Table element
```

## Testing Checklist

- [ ] Create connector - verify it's 1D
- [ ] Select connector - verify line turns blue (not border highlight)
- [ ] Create shape - verify it's 2D (default)
- [ ] Select shape - verify bounding box and handles show
- [ ] Hover shape - verify blue outline
- [ ] Drag connector - verify it moves smoothly
- [ ] Drag shape - verify it resizes with handles
- [ ] Rotate shape - verify rotation handle works
- [ ] No handles on connectors when selected
- [ ] Connectors have labels, shapes have connection points
- [ ] Undo/redo works for both 1D and 2D

## Code References

**Files Modified:**
- `Elements.tsx` - Added dimensionality check in render conditions
- `DrawArea.tsx` - Set dimensionality='1D' on connector creation
- `ConnectorRenderer.tsx` - Changed selection feedback to line color

**Key Functions:**
- `renderSelectionHighlight()` - Skips 1D objects
- `renderResizeHandles()` - Skips 1D objects
- `renderRotationHandle()` - Skips 1D objects
- `renderConnectionPoints()` - Skips 1D objects
- ConnectorRenderer line color logic - Uses blue for selected 1D objects

## Backward Compatibility

- Existing shapes default to 2D (no dimensionality set)
- Existing connectors updated to have dimensionality='1D'
- No breaking changes to serialization
- dimensionality is optional property

## Related Standards

This architecture aligns with:
- **Draw.io/Diagrams.net** - Connectors as separate first-class objects
- **Miro** - Connectors display as simple lines
- **Figma** - Lines/connectors with minimal UI
- **Lucidchart** - 1D connectors vs 2D shapes distinction
- **UML/Technical Diagrams** - Standard connector behavior
