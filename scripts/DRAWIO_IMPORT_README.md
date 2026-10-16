# Draw.io Shape Importer

Automated scripts to import draw.io shape libraries and generate maxGraph Shape classes.

## Overview

These scripts extract shape definitions from draw.io JavaScript libraries and automatically generate:
- TypeScript Shape classes (extends maxGraph `Shape`)
- Index file for exports
- Registry file with CellRenderer registration
- Palette integration via shapeRegistry

## Usage

### Import a Single Library

```bash
npx ts-node scripts/import-drawio-shapes.ts <libraryName> [outDir] [groupName]
```

**Examples:**

```bash
# Import basic shapes
npx ts-node scripts/import-drawio-shapes.ts mxBasic src/shapes/drawio-basic "Draw.io Basic"

# Import arrow shapes
npx ts-node scripts/import-drawio-shapes.ts mxArrows src/shapes/drawio-arrows "Draw.io Arrows"

# Import flowchart shapes
npx ts-node scripts/import-drawio-shapes.ts mxFlowchart src/shapes/drawio-flowchart "Draw.io Flowchart"

# Import EIP (Enterprise Integration Pattern) shapes
npx ts-node scripts/import-drawio-shapes.ts mxEip src/shapes/drawio-eip "Draw.io EIP"
```

### Import Multiple Libraries at Once

```bash
./scripts/import-all-drawio.sh
```

Edits the script to customize which libraries to import.

## Available Draw.io Libraries

The script can import from any `.js` file in `/Users/Marcin/workspace/workspace_tsx/drawio/src/main/webapp/shapes/`

Popular libraries:

| Library | Size | Description |
|---------|------|-------------|
| mxBasic | 120K | Basic shapes (cross, callouts, wave) |
| mxArrows | 127K | Arrow variations |
| mxFlowchart | 2.8K | Flowchart elements |
| mxEip | 19K | Enterprise Integration Pattern |
| mxAndroid | 45K | Android UI components |
| mxBootstrap | 42K | Bootstrap components |
| mxAWS3D | 281K | AWS 3D icons |
| mxElectrical | 154K | Electrical symbols |
| mxArchiMate3 | 131K | ArchiMate 3 notation |

## How It Works

### 1. Parse Source File
Extracts shape function definitions from draw.io JavaScript:
```javascript
function mxShapeBasicCross(bounds, fill, stroke, strokewidth) { ... }
```

### 2. Extract Paint Methods
Extracts `paintVertexShape`, `paintForeground`, and `paintBackground` methods:
```javascript
mxShapeBasicCross.prototype.paintVertexShape = function(c, x, y, w, h) {
  c.translate(x, y);
  c.begin();
  c.moveTo(...);
  // ...
}
```

### 3. Generate TypeScript Shape Class
Creates maxGraph Shape class with translated canvas operations:
```typescript
export class BasicCrossShape extends Shape {
  override paintVertexShape(c: any, x: number, y: number, w: number, h: number): void {
    c.translate(x, y);
    // ... paint logic translated to maxGraph APIs
  }
}
```

### 4. Register with maxGraph and Palette
- Registers with `CellRenderer` for canvas rendering
- Adds to shape palette via `shapeRegistry`
- Organized into groups for menu organization

## Post-Import Steps

After importing, update `src/shapes/index.ts`:

```typescript
// Add import
import { registerDrawioBasicShapeClasses, registerDrawioBasicShapes } from './drawio-basic/registry';

// Add to registerShapes() function
export function registerShapes() {
  // ... existing registrations ...
  
  registerDrawioBasicShapeClasses();
  registerDrawioBasicShapes();
  
  // ... more registrations ...
}
```

## Customization

### Change Default Colors

Edit the registry file (e.g., `src/shapes/drawio-basic/registry.ts`):

```typescript
style: { 
  shape: 'drawio.basic.cross', 
  fillColor: '#YOUR_COLOR',  // Change this
  strokeColor: '#YOUR_COLOR' // And this
}
```

### Change Icons

Edit the `getIconForShape()` function in the importer script:

```typescript
private static getIconForShape(displayName: string): string {
  const icons: { [key: string]: string } = {
    cross: '✕',
    wave: '〰',
    // Add more mappings
  };
}
```

### Filter Specific Shapes

Modify the importer to skip certain shapes by shape name pattern.

## Generated Files Structure

```
src/shapes/drawio-<libraryName>/
├── index.ts              # Exports all shape classes
├── registry.ts           # Registration & palette setup
├── shape-name-1.ts       # Individual shape class
├── shape-name-2.ts       # Individual shape class
└── ...
```

## Code Translation

The importer translates draw.io canvas operations to maxGraph:

| Draw.io | MaxGraph | Note |
|---------|----------|------|
| `c.begin()` | `c.begin()` | ✓ Compatible |
| `c.moveTo(x, y)` | `c.moveTo(x, y)` | ✓ Compatible |
| `c.lineTo(x, y)` | `c.lineTo(x, y)` | ✓ Compatible |
| `c.arcTo(rx, ry, ...)` | `c.arcTo(rx, ry, ...)` | ✓ Compatible |
| `c.fillAndStroke()` | `c.fillAndStroke()` | ✓ Compatible |
| `mxUtils.getValue(...)` | Direct values | ⚠ Simplified |

## Troubleshooting

### Script not found
```bash
# Make sure you're in the project root
cd /Users/Marcin/workspace/workspace_tsx/railway-drawer
npx ts-node scripts/import-drawio-shapes.ts mxBasic
```

### TypeScript errors after import
Run `npm run build` to check for issues:
```bash
npm run build
```

### Shapes not showing in palette
Make sure you:
1. Generated the registry file
2. Imported and registered in `src/shapes/index.ts`
3. Ran `npm run build` or reloaded dev server

## Examples

### Import Flowchart Shapes
```bash
npx ts-node scripts/import-drawio-shapes.ts mxFlowchart src/shapes/drawio-flowchart "Draw.io Flowchart"
```

Update `src/shapes/index.ts`:
```typescript
import { registerDrawioFlowchartShapeClasses, registerDrawioFlowchartShapes } from './drawio-flowchart/registry';

// In registerShapes():
registerDrawioFlowchartShapeClasses();
registerDrawioFlowchartShapes();
```

### Import AWS Shapes
```bash
npx ts-node scripts/import-drawio-shapes.ts mxAWS3D src/shapes/drawio-aws "AWS Cloud"
```

## Performance Note

Large libraries (e.g., mxAWS3D.js with 281K) may take a moment to parse. This is one-time only.

## Support

For issues or feature requests with the importer, check the script output or review generated files.
