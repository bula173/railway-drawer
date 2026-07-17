# Complete maxGraph Migration Plan

## Vision
Replace entire custom DrawArea system with maxGraph as the unified diagram engine for Railway Drawer.

## Why maxGraph?
- ✅ Modern TypeScript-first API
- ✅ Full feature parity with mxGraph
- ✅ Active maintenance and development
- ✅ Native ES6+ architecture
- ✅ Built-in: undo/redo, copy/paste, selection, manipulation
- ✅ Professional diagram engine (used by draw.io)
- ✅ Comprehensive shape system
- ✅ Event-driven architecture
- ✅ Style management
- ✅ Layout algorithms

## Current Architecture to Replace
```
OLD (Custom React-based):
RailwayDrawerApp
├── DrawArea (custom SVG manipulation)
├── Toolbox (shape library)
├── Properties Panel (element editing)
├── Tab Panel (multi-canvas)
└── Various custom tools (undo/redo, copy/paste, etc.)

NEW (maxGraph-based):
RailwayDrawerApp
├── maxGraph Editor (core diagram engine)
├── Toolbox (drag-drop to maxGraph canvas)
├── Properties Panel (edit maxGraph cells)
├── Tab Panel (multiple maxGraph instances)
└── Built-in features (native undo/redo, etc.)
```

## Migration Phases

### Phase 1: Foundation & Setup (1-2 days)
- [ ] Install maxGraph and types
- [ ] Create MaxGraphEditorCore component
- [ ] Set up basic graph container
- [ ] Test initialization and basic rendering
- [ ] Document maxGraph API patterns

### Phase 2: Basic Editor Features (2-3 days)
- [ ] Vertex/edge creation and manipulation
- [ ] Selection and multi-selection
- [ ] Drag/move/resize functionality
- [ ] Delete/cut/copy/paste
- [ ] Undo/redo (native maxGraph)
- [ ] Zoom and pan
- [ ] Grid and snap-to-grid

### Phase 3: Shape System (2-3 days)
- [ ] Load railway shapes into maxGraph
- [ ] Configure shape styles and defaults
- [ ] Custom shape rendering
- [ ] Connector types and styling
- [ ] Text regions and editing
- [ ] SVG-based shapes

### Phase 4: Properties & Styling (1-2 days)
- [ ] Properties panel integration
- [ ] Cell style editing
- [ ] Colors, strokes, fills
- [ ] Text properties
- [ ] Rotation and alignment
- [ ] Layer management

### Phase 5: Advanced Features (2-3 days)
- [ ] Alignment and distribution
- [ ] Connector routing algorithms
- [ ] Layout engine integration
- [ ] Custom tools and handlers
- [ ] Keyboard shortcuts
- [ ] Context menus

### Phase 6: File Operations (1-2 days)
- [ ] Export graph to draw.io format
- [ ] Import draw.io files
- [ ] Save/load from localStorage
- [ ] XML serialization/deserialization
- [ ] File versioning

### Phase 7: Integration (1-2 days)
- [ ] Replace DrawArea completely
- [ ] Update TabPanel for maxGraph
- [ ] Wire up toolbox
- [ ] Integrate properties panel
- [ ] Update menu system

### Phase 8: Testing & Polish (2-3 days)
- [ ] Unit tests
- [ ] Integration tests
- [ ] Performance optimization
- [ ] UI polish and refinement
- [ ] Documentation

**Total Timeline: 2-3 weeks**

## Key Components to Build

### 1. MaxGraphEditorCore
```typescript
interface MaxGraphEditorCoreProps {
  initialXml?: string;
  shapes?: ToolboxItem[];
  onModelChange?: (xml: string) => void;
}

// Provides:
- graph: Graph instance
- getXml(): string
- setXml(xml: string): void
- addVertex(shape): Cell
- addEdge(source, target): Cell
- undo/redo methods
- getSelectedCells(): Cell[]
- etc.
```

### 2. MaxGraphToolbox
- Drag-drop shapes to canvas
- Uses maxGraph's built-in drag handlers
- Integration with maxGraph styles

### 3. MaxGraphPropertiesPanel
- Edit selected cell properties
- Update maxGraph cell styles
- Real-time preview

### 4. MaxGraphTabPanel
- Multiple maxGraph instances
- Tab switching
- Independent graph state

## maxGraph API Reference

### Core Classes
- `Graph` - Main diagram editor
- `Cell` - Base for vertices and edges
- `Geometry` - Position and size
- `Style` - Styling properties
- `UndoManager` - Undo/redo
- `ClipboardHandler` - Copy/paste
- `EventSource` - Event system

### Key Features
- Selection
- Zoom and pan
- Snap to grid
- Alignment
- Distribution
- Routing
- Layout algorithms
- Formatting
- Styles
- Validation
- Geometry

## Migration Strategy

### 1. Parallel Development (Week 1)
- Build maxGraph foundation
- Keep old DrawArea working
- Create feature parity tests

### 2. Feature Migration (Week 2)
- Migrate features one by one
- Test each feature thoroughly
- Update toolbox and panels

### 3. Integration (Week 2-3)
- Remove old DrawArea
- Update all references
- Final testing and polish

### 4. Cleanup (Week 3)
- Remove unused code
- Update documentation
- Performance optimization

## Benefits of Complete Migration

### Code Quality
- ✅ Remove ~2000 lines of custom drawing code
- ✅ Leverage battle-tested diagram engine
- ✅ Full TypeScript support
- ✅ Cleaner component architecture

### Features
- ✅ Better performance
- ✅ More powerful features out-of-box
- ✅ Professional diagram capabilities
- ✅ Better accessibility

### Maintenance
- ✅ Less code to maintain
- ✅ Follow maxGraph updates
- ✅ Use community patterns
- ✅ Better third-party compatibility

### User Experience
- ✅ More responsive
- ✅ Better multi-touch support
- ✅ Professional polish
- ✅ Better cross-browser support

## Risk Mitigation

### Testing Strategy
- Unit tests for each component
- Integration tests for workflows
- E2E tests for user paths
- Performance benchmarks

### Rollback Plan
- Git branches for each phase
- Can revert to old DrawArea if needed
- Keep tests passing always
- Incremental commits

### Documentation
- maxGraph API documentation
- Component architecture docs
- Migration guide
- Developer onboarding

## Success Criteria

- [ ] All features working identically
- [ ] Tests passing (>90% coverage)
- [ ] Performance improved or maintained
- [ ] Code size reduced
- [ ] Documentation complete
- [ ] Team trained on new architecture
- [ ] Production deployment successful

## Next Steps

1. Install maxGraph: `npm install maxgraph`
2. Create MaxGraphEditorCore component
3. Build basic functionality
4. Migrate features incrementally
5. Test thoroughly
6. Deploy with confidence

## Resources

- maxGraph Docs: https://maxgraph.github.io/maxGraph/
- API Reference: https://maxgraph.github.io/maxGraph/api-docs/
- Examples: https://maxgraph.github.io/maxGraph/docs/examples
- GitHub: https://github.com/maxGraph/maxGraph
