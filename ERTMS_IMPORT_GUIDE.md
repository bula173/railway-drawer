# ERTMS Draw.io Import Guide

## Overview

Import complex, editable shapes from draw.io ERTMS library as **fully editable components** that users can modify through the Properties Panel.

## Architecture

### 1. **ComplexShape Base Class** (`src/shapes/complex-shape.ts`)

Foundation for composable shapes with multiple editable components:

```typescript
export class SignalShape extends ComplexShape {
  constructor() {
    super();

    // Register editable components
    this.registerComponent({
      id: 'light-red',
      type: 'vertex',
      style: 'fillColor=#e00000;strokeColor=#404040;',
      value: 'Red Light',
      editable: true, // User can modify through Properties Panel
    });

    this.registerComponent({
      id: 'light-green',
      type: 'vertex',
      style: 'fillColor=#00e000;strokeColor=#404040;',
      value: 'Green Light',
      editable: true,
    });
  }

  paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    // Render shape based on component styles
    const redStyle = this.getComponent('light-red')?.style;
    const greenStyle = this.getComponent('light-green')?.style;
    // ... render lights
  }
}
```

### 2. **Draw.io Parser** (`src/shapes/ertms/drawio-parser.ts`)

Parses draw.io XML exports:

```typescript
const shape = parseDrawioShape(xmlString, 'Signal Left', 43, 24);
// Returns: { title, width, height, cells: [...] }

const components = extractComponents(shape);
// Extract editable cells from shape definition
```

### 3. **ERTMS Shapes** (`src/shapes/ertms/ertms-shapes.ts`)

Pre-built complex shapes from draw.io:

- `SignalLeftShape` - 3-light signal (editable colors)
- `TrainShape` - Train with ETCS label
- `TrackShape` - Railway track with 3 components
- `BaliseShape` - Track circuit marker

## How It Works

### Example: Editing a Signal's Light Color

1. **User double-clicks signal shape** on canvas
2. **Properties Panel updates** showing components:
   - Light 1: fillColor, strokeColor
   - Light 2: fillColor, strokeColor
   - Light 3: fillColor, strokeColor

3. **User changes "Light 3" fillColor** from `#e00000` to `#ffff00`
4. **Component updates**: `updateComponent('light-3', { style: 'fillColor=#ffff00;...' })`
5. **Shape re-renders** with new color

### Data Structure

```typescript
// Component represents one editable part of shape
interface ShapeComponent {
  id: string;              // 'light-1', 'rail-left', etc
  type: 'vertex'|'edge'|'text';
  style?: string;          // 'fillColor=#e00000;strokeColor=#404040;'
  value?: string;          // 'Red Light' - display name
  x?: number; y?: number;  // Position offset
  width?: number;          // Dimensions
  editable: boolean;       // Show in Properties Panel
}
```

## Import Workflow

### Step 1: Parse Draw.io Library

```bash
npx ts-node tools/drawio-importer.ts path/to/ERTMS.xml
# Generates: src/shapes/ertms/shapes-config.ts
```

### Step 2: Create Shape Classes

For each shape in config, create a class extending `ComplexShape`:

```typescript
export class PointLeftShape extends ComplexShape {
  constructor() {
    super();
    // Register components from draw.io definition
    this.registerComponent({
      id: 'rail-main',
      type: 'edge',
      style: 'strokeColor=#333333;strokeWidth=2;',
      editable: true,
    });
  }

  paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    // Implement rendering based on components
  }
}
```

### Step 3: Register with Shapes System

```typescript
// src/shapes/ertms/registry.ts
import { PointLeftShape } from './ertms-shapes';

export function registerErtmsShapes() {
  CellRenderer.registerShape('ertms-point-left', PointLeftShape as any);
  
  shapeRegistry.registerShape('ERTMS', {
    name: 'Point Left',
    shape: PointLeftShape,
    width: 53, height: 74,
    category: 'Track Infrastructure'
  });
}
```

## User Editing Experience

### Properties Panel Integration

When user selects an ERTMS shape:

**Current:**
```
📝 Text Tab
- Font Family: Arial
- Font Size: 12
- Font Weight: Normal
- Text Color: #000000
- ...16 more properties
```

**With Complex Shapes:**
```
📝 Components Tab (NEW)
- light-red:
  - fillColor: #e00000
  - strokeColor: #404040
  - visible: true
- light-green:
  - fillColor: #00e000
  - strokeColor: #404040
  - visible: true
- light-yellow:
  - fillColor: #ffff00
  - strokeColor: #404040
  - visible: true
```

### Shape Designer (Optional)

Create a shape designer that:
- Displays component tree
- Shows each component's style/geometry
- Allows adding/removing components
- Exports as new shape template

## Benefits

✅ **No Manual Rendering** - Use draw.io designs directly  
✅ **Fully Editable** - Users modify any component  
✅ **Properties Panel Integration** - Seamless UI  
✅ **Reusable Components** - Build complex systems  
✅ **Scalable** - Add 100+ shapes easily  

## Example: Complete Signal Shape

```typescript
export class Signal4LightShape extends ComplexShape {
  constructor() {
    super();
    
    const lights = [
      { id: 'light-1', color: '#ffffff', label: 'White/Spare' },
      { id: 'light-2', color: '#ffffff', label: 'White' },
      { id: 'light-3', color: '#ffff00', label: 'Yellow' },
      { id: 'light-4', color: '#e00000', label: 'Red' }
    ];

    lights.forEach(light => {
      this.registerComponent({
        id: light.id,
        type: 'vertex',
        style: `fillColor=${light.color};strokeColor=#404040;`,
        value: light.label,
        editable: true,
      });
    });
  }

  paintVertexShape(c: any, x: number, y: number, w: number, h: number) {
    // Draw background
    c.setFillColor('none');
    c.setStrokeColor('#404040');
    c.rect(x, y, w, h);
    c.stroke();

    // Draw each light with current component color
    const lightSize = 8;
    const spacing = 2;
    let currentY = y + 2;

    this.components.forEach((comp) => {
      if (this.visibleComponents.has(comp.id)) {
        const color = comp.style?.match(/fillColor=([^;]+)/)?.[1] || '#ffffff';
        c.setFillColor(color);
        c.setStrokeColor('#404040');
        c.ellipse(x + (w - lightSize) / 2, currentY, lightSize, lightSize);
        c.fillAndStroke();
        currentY += lightSize + spacing;
      }
    });
  }
}
```

## Next Steps

1. ✅ ComplexShape base class created
2. ✅ Draw.io parser ready
3. ✅ Example ERTMS shapes implemented
4. **TODO:** Register in shapes system
5. **TODO:** Add to toolbar
6. **TODO:** Create shape editor UI
7. **TODO:** Test with full ERTMS library

## Status

Ready to implement! Components are in place for:
- Parsing draw.io shapes
- Defining complex/composite shapes  
- Editing individual components
- Full Properties Panel integration
