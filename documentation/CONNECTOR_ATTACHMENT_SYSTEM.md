# Connector Attachment System

## Overview

Connectors can now be **detached** from shapes and exist as **standalone elements**. Each connector end (start/end) can be independently attached or detached.

## Features

### 1. **Detachable Connector Ends**
- Each connector has two ends: **Start** and **End**
- Each end can be **Attached** (follows shape) or **Detached** (free to move)
- Independently control attachment state for each end
- Detached ends stay at fixed positions even if their original shape moves

### 2. **Attachment States**

#### Attached End
```
Shape ━━━━━━━ (connector follows shape edge)
      ↑ Attached - moves with shape
```

#### Detached End
```
X Position ━━━━━━━ Shape
↑ Free point      ↑ Shape can move independently
```

### 3. **Standalone Connectors**
Connectors can exist:
- **Both ends attached** - Traditional connector between two shapes
- **One end attached** - Connector from shape to free point
- **Both ends detached** - Pure line that can exist anywhere
- **No shapes referenced** - Orphaned connector (after shapes deleted)

## User Interface

### Attachment Controls in Properties Panel

When a connector is selected, the properties panel shows:

```
┌─────────────────────────────────┐
│ Connector Properties            │
├─────────────────────────────────┤
│ Label: [text input]             │
│                                 │
│ Attachment                      │
│ ┌─────────────────────────────┐ │
│ │ Start:  ✓ Attached          │ │
│ │ [Detach Start]              │ │
│ │                             │ │
│ │ End:    ◯ Detached          │ │
│ │ [Attach End]                │ │
│ └─────────────────────────────┘ │
│                                 │
│ Line Style                      │
│ ... (rest of styling options)   │
└─────────────────────────────────┘
```

### Status Indicators

- **✓ Attached** - Blue background, endpoint follows connected shape
- **◯ Detached** - Orange background, endpoint is free to move

## Data Structure

### DrawElement Connector Properties

```typescript
interface DrawElement {
  type: 'connector';
  dimensionality: '1D';
  
  // Attachment information
  fromElementId?: string;      // ID of source shape (if attached)
  toElementId?: string;        // ID of target shape (if attached)
  fromAttached?: boolean;      // Is start endpoint attached? (default: true)
  toAttached?: boolean;        // Is end endpoint attached? (default: true)
  
  // Endpoint coordinates
  start: {x: number; y: number};  // Start position
  end: {x: number; y: number};    // End position
  
  // Style and metadata
  connectorStyle?: ConnectorStyle;
  name?: string;  // Label text
}
```

## Behavior

### When Endpoint is Attached
1. Connector looks up the connected shape in the elements array
2. Calculates the closest point on shape edge toward the other endpoint
3. Endpoint follows shape as it moves/resizes
4. User cannot drag this endpoint independently

### When Endpoint is Detached
1. Connector uses the stored `start` or `end` coordinate
2. Endpoint stays at fixed position (doesn't follow shape)
3. Original shape can be moved/resized without affecting connector
4. User can drag the connector to reposition the endpoint

### When Both Endpoints Detached
1. Connector becomes a pure standalone line
2. Can be moved and positioned anywhere
3. Exists independently of any shapes
4. Can be styled and labeled like any connector

## Workflows

### Detach a Connector End

1. Click connector to select it
2. Properties panel shows attachment status
3. Click "Detach Start" or "Detach End"
4. Selected end becomes free to move
5. Status indicator changes to "◯ Detached"

### Reattach a Connector End

1. Click connector to select it
2. Click "Attach Start" or "Attach End"
3. Connector searches for appropriate shape
4. End snaps back to connected shape edge
5. Status indicator changes to "✓ Attached"

### Move Detached Connector

1. Detach one or both ends
2. Click and drag the connector line
3. Entire connector moves
4. Endpoints update new positions
5. Attached ends still follow their shapes

### Create Standalone Line

1. Create connector between two shapes
2. Detach both ends ("Detach Start" + "Detach End")
3. Connector becomes pure line
4. Can be moved/styled independently
5. No attachment to any shapes

## Technical Implementation

### Endpoint Calculation

```typescript
const getConnectorEndpoints = (connector) => {
  const fromIsAttached = connector.fromAttached !== false && !!connector.fromElementId;
  const toIsAttached = connector.toAttached !== false && !!connector.toElementId;
  
  // Get attached shapes if applicable
  const fromShape = fromIsAttached ? findElement(connector.fromElementId) : null;
  const toShape = toIsAttached ? findElement(connector.toElementId) : null;
  
  // Calculate endpoints
  if (fromShape) {
    fromPoint = calculateClosestEdgePoint(fromShape, toPoint);
  } else {
    fromPoint = connector.start; // Use stored position if detached
  }
  
  if (toShape) {
    toPoint = calculateClosestEdgePoint(toShape, fromPoint);
  } else {
    toPoint = connector.end; // Use stored position if detached
  }
  
  return {from: fromPoint, to: toPoint};
}
```

### Moving Detached Connectors

Detached connector endpoints are updated like any other element:
- Drag connector → updates `connector.start` and `connector.end`
- Renders at new position
- If one end is attached, that end still follows its shape

## Examples

### Example 1: Partial Attachment
```
Shape A ━━━━━━━━ (Detached Point)
 ↑ Start attached    ↑ End detached at (500, 300)
```

Data:
```json
{
  "fromElementId": "shape-A",
  "fromAttached": true,
  "toElementId": null,
  "toAttached": false,
  "start": {...calculated...},
  "end": {"x": 500, "y": 300}
}
```

### Example 2: Standalone Line
```
(100, 100) ━━━━━━━ (500, 200)
  ↑ Free point      ↑ Free point
```

Data:
```json
{
  "fromElementId": null,
  "fromAttached": false,
  "toElementId": null,
  "toAttached": false,
  "start": {"x": 100, "y": 100},
  "end": {"x": 500, "y": 200}
}
```

### Example 3: Both Attached (Traditional)
```
Shape A ━━━━━━━ Shape B
 ↑ Start attached  ↑ End attached
```

Data:
```json
{
  "fromElementId": "shape-A",
  "fromAttached": true,
  "toElementId": "shape-B",
  "toAttached": true,
  "start": {...calculated...},
  "end": {...calculated...}
}
```

## Use Cases

1. **Network Diagrams** - Partially connected networks where some nodes aren't connected to shapes
2. **Flowcharts** - Branches that connect to text annotations (not shapes)
3. **Annotations** - Lines pointing to specific locations without being bound
4. **Templates** - Generic connector patterns that can be customized
5. **Annotations & Notes** - Connectors from shapes to free-floating text/labels
6. **Flexible Layouts** - Connectors that survive shape deletion (detach automatically)

## Future Enhancements

1. **Smart Detach on Delete** - When connected shape is deleted, auto-detach connector
2. **Visual Feedback** - Show anchor points with different colors (green=attached, gray=detached)
3. **Drag to Detach** - Drag connector endpoint away from shape to detach
4. **Drag to Attach** - Drag detached endpoint onto shape to reattach
5. **Context Menu** - Right-click menu for quick attach/detach actions
6. **Reconnection** - UI to choose which shape to reattach to

## Testing Checklist

- [ ] Create connector between two shapes
- [ ] Detach start endpoint - connector follows end shape only
- [ ] Detach end endpoint - connector follows start shape only
- [ ] Detach both endpoints - connector becomes pure line
- [ ] Move shape with attached endpoint - connector follows
- [ ] Move shape with detached endpoint - connector stays in place
- [ ] Drag detached connector - moves the line
- [ ] Reattach endpoint - snaps back to shape
- [ ] Delete connected shape - connector can exist without it
- [ ] Save/load project with detached connectors
- [ ] Multiple connectors with mixed attachment states
- [ ] Undo/redo attach/detach operations

## API Reference

### Attachment Methods

```typescript
// Detach connector start
onDetachStart(): void

// Detach connector end
onDetachEnd(): void

// Reattach connector start to its original shape
onAttachStart(): void

// Reattach connector end to its original shape
onAttachEnd(): void
```

### Properties

```typescript
// Is start endpoint currently attached?
fromAttached?: boolean

// Is end endpoint currently attached?
toAttached?: boolean

// When fromAttached=false, use this position
start: {x: number; y: number}

// When toAttached=false, use this position
end: {x: number; y: number}
```

## Implementation Status

✅ **Completed:**
- Attachment state tracking (fromAttached, toAttached)
- Detach/attach controls in properties panel
- Smart endpoint calculation for mixed attachment
- Standalone connector support
- UI status indicators

🔄 **Future:**
- Auto-detach when shapes deleted
- Drag-to-detach gestures
- Drag-to-attach gestures
- Visual anchor point indicators
- Context menu integration
