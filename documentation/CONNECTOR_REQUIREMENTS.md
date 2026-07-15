# Connector Requirements & Best Practices

Based on industry standards (Draw.io, Miro, Figma, Lucidchart, Visio), comprehensive connector system should include:

## PRIORITY 1: CRITICAL (MVP)

### 1.1 Connection Points
- **Multiple Connection Points**: Shapes should have 4+ connection points (top, bottom, left, right, corners)
- **Smart Point Selection**: Automatically snap to nearest connection point
- **Visual Indicators**: Show connection points when hovering over shape
- **Connection Point Feedback**: Highlight available points when dragging connector
- **Dynamic Points**: Connection points adapt to shape size/rotation

### 1.2 Connector Labels
- **Text Labels**: Add label to connectors
- **Label Positioning**: Above, below, or middle of line
- **Label Editing**: Double-click to edit
- **Background**: Optional label background for readability
- **Persistence**: Labels saved with connector

### 1.3 Connector Deletion & Cleanup
- **Delete Operation**: Delete connector with Delete key or context menu
- **Shape Deletion**: When connected shape deleted, handle gracefully
  - Option 1: Delete connector automatically
  - Option 2: Detach connector and keep it
- **Undo/Redo**: Full support for connector operations

### 1.4 Visual States & Feedback
- **Idle State**: Normal appearance
- **Hover State**: Highlight connector when mouse over
- **Selected State**: Clear visual indication (already implemented)
- **Dragging State**: Show live preview of connector endpoint
- **Connection Preview**: Show which shape will be connected before release

### 1.5 Connector Selection & Interaction
- **Click to Select**: Click connector line to select it
- **Keyboard Delete**: Delete selected connector with Delete key
- **Copy/Paste**: Support copying connector with Ctrl+C
- **Snap to Grid**: Connector endpoints snap to grid when dragging shapes
- **Right-Click Menu**: Context menu with connector options

## PRIORITY 2: IMPORTANT (Enhancements)

### 2.1 Connector Routing Modes
- **Straight Line**: Direct path (current implementation)
- **Orthogonal**: Manhattan routing (right angles only)
- **Curved**: Smooth Bezier curves
- **Smart Routing**: Auto-avoid obstacles
- **Routing Mode Selector**: UI control to change routing

### 2.2 Waypoints & Path Editing
- **Manual Waypoints**: Add points to change connector path
- **Drag Waypoints**: Click and drag to reposition
- **Add/Remove Points**: Insert points along path
- **Path Optimization**: Auto-optimize path to minimize crossings

### 2.3 Advanced Styling
- **Line Caps**: Butt, round, square
- **Line Joins**: Miter, round, bevel
- **Custom Colors**: Full color picker
- **Gradient Fills**: Gradient arrows/lines
- **Shadow/Effects**: Drop shadow on connectors

### 2.4 Connector Groups & Layers
- **Connector Grouping**: Group connectors together
- **Layer Support**: Connectors on specific layers
- **Z-ordering**: Send forward/backward
- **Connector Bundles**: Group similar connectors

## PRIORITY 3: NICE TO HAVE (Advanced)

### 3.1 Automatic Routing
- **Conflict Avoidance**: Auto-route to avoid crossing other connectors
- **Path Optimization**: Find optimal path through diagram
- **Global Routing**: Apply routing style to all connectors
- **Route Animation**: Animate path changes

### 3.2 Connection Types
- **Bidirectional Connectors**: Arrows at both ends
- **Flow Indicators**: Direction and flow information
- **Connection Rules**: Define valid connections
- **Auto-align**: Automatically align connector segments

### 3.3 Advanced Labels
- **Multiple Labels**: Labels at different positions
- **Label Styling**: Font, size, color per label
- **Auto-wrapping**: Text wrapping on long labels
- **Label Background**: Customizable background style

### 3.4 Export & Integration
- **Format Support**: Export connector data in various formats
- **Integration**: Connectors in template system
- **Presets**: Predefined connector styles
- **Connector Libraries**: Save/load connector patterns

## Technical Implementation Notes

### Data Structure
```typescript
interface DrawElement {
  id: string;
  type: 'connector';
  fromElementId: string;
  toElementId: string;
  fromPoint?: string; // 'top' | 'bottom' | 'left' | 'right' | 'center'
  toPoint?: string;
  label?: string;
  labelPosition?: 'above' | 'below' | 'middle';
  routingMode?: 'straight' | 'orthogonal' | 'curved';
  waypoints?: Array<{x: number; y: number}>; // For orthogonal/curved
  connectorStyle?: {
    lineStyle: 'solid' | 'dotted' | 'dashed';
    lineWidth: 1 | 2 | 3 | 4;
    lineColor?: string;
    startArrow: ArrowStyle;
    endArrow: ArrowStyle;
    opacity?: number;
    lineCap?: 'butt' | 'round' | 'square';
    lineJoin?: 'miter' | 'round' | 'bevel';
  };
  start: {x: number; y: number}; // Auto-calculated based on connection point
  end: {x: number; y: number};
}
```

### Connection Points per Shape
- **Rectangle/Square**: 4 points (top, bottom, left, right) + 4 corners + center = 9 points
- **Circle/Ellipse**: 12 points around circumference + center
- **Line/Arrow**: 2 endpoints
- **Text**: 4 cardinal points + center
- **Custom Shapes**: User-defined connection points

### Rendering Strategy
1. Render connectors behind elements (lower z-index)
2. Highlight connection points on hover
3. Show preview line during drag
4. Render labels on top
5. Show waypoint handles when selected

## Success Metrics
- ✅ User can connect any two shapes intuitively
- ✅ Connectors stay properly connected when shapes move
- ✅ Clear visual feedback at all interaction stages
- ✅ All connector operations are undoable
- ✅ Connector data persists correctly
- ✅ Performance remains good with many connectors
- ✅ Connectors work with all shape types
- ✅ Mobile/touch friendly connector interactions

## Implementation Roadmap
1. **Phase 1**: Multiple connection points + labels + deletion (this session)
2. **Phase 2**: Orthogonal routing + waypoints + better UI feedback
3. **Phase 3**: Advanced styling + connector groups
4. **Phase 4**: Automatic routing + export features
