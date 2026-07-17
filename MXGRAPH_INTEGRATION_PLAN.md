# mxGraph Integration Plan

## Overview
Migrate Railway Drawer from custom DrawArea to mxGraph library for native draw.io compatibility.

## Benefits
- ✅ Full draw.io format compatibility
- ✅ Access to millions of ready-made shapes
- ✅ Professional, battle-tested library
- ✅ Users can design in draw.io, use in Railway Drawer
- ✅ Native .drawio file support
- ✅ Better performance and features

## Architecture Changes

### Phase 1: Setup & Research (Current)
- [ ] Install mxGraph and TypeScript types
- [ ] Evaluate mxGraph capabilities vs current DrawArea
- [ ] Document mxGraph API and draw.io format
- [ ] Plan component migration

### Phase 2: Core mxGraph Integration
- [ ] Create MxGraphEditor component (replaces DrawArea)
- [ ] Implement draw.io XML parsing
- [ ] Set up shape library loading
- [ ] Basic rendering and interaction

### Phase 3: Features Implementation
- [ ] Drag-drop from toolbox
- [ ] Element selection and manipulation
- [ ] Undo/redo with mxGraph history
- [ ] Copy/paste functionality
- [ ] Zoom and pan

### Phase 4: File Operations
- [ ] Import .drawio files
- [ ] Export to .drawio format
- [ ] Export to SVG/PNG/PDF
- [ ] File versioning and compatibility

### Phase 5: Toolbox & Shapes
- [ ] Load draw.io shape library
- [ ] Custom shape library management
- [ ] Railway-specific shapes
- [ ] Shape preview and search

### Phase 6: UI Integration
- [ ] Replace old DrawArea with MxGraphEditor
- [ ] Update properties panel
- [ ] Maintain keyboard shortcuts
- [ ] Preserve theme support

### Phase 7: Migration & Testing
- [ ] Migrate existing projects to new format
- [ ] Comprehensive testing
- [ ] Performance optimization
- [ ] Documentation

## File Structure
```
src/
├── components/
│   ├── MxGraphEditor.tsx          (NEW - main editor)
│   ├── MxGraphToolbox.tsx         (NEW - shape library)
│   ├── DrawArea.tsx               (DEPRECATED - keep for reference)
│   └── ...
├── utils/
│   ├── mxGraphUtils.ts            (NEW - utility functions)
│   ├── drawioFormat.ts            (NEW - draw.io format handling)
│   └── shapeLibraryMxGraph.ts     (NEW - shape loading)
├── types/
│   ├── mxgraph.ts                 (NEW - mxGraph types)
│   └── ...
└── ...
```

## Key Decisions

### 1. Library Version
- Use latest stable mxGraph version
- Ensure TypeScript support
- Check draw.io compatibility

### 2. Gradual vs Full Migration
- Start with parallel implementation
- Keep current system working during transition
- Migrate files when ready

### 3. Shape Library Strategy
- Use draw.io's public shape library
- Support custom shapes
- Maintain railway-specific library

### 4. Data Format
- Use native draw.io XML (.drawio)
- Support legacy JSON format for migration
- Version control for compatibility

## Technical Considerations

### mxGraph Setup
```typescript
// Basic mxGraph initialization
import mxgraph from 'mxgraph';
const { mxGraph, mxRubberband, mxKeyHandler } = mxgraph;

// Container setup
<div id="graphContainer" style={{ width: '100%', height: '100%' }} />

// Graph initialization
const graph = new mxGraph(container);
new mxRubberband(graph);
new mxKeyHandler(graph);
```

### Draw.io Format
- XML-based (mxGraph native)
- Includes shapes, connections, styles
- Compatible with draw.io editor
- Can import/export directly

### Shape Library Integration
- Load from draw.io GitHub
- Parse and register shapes
- Support custom shape definitions
- Drag-drop to canvas

## Timeline Estimate
- Phase 1-2: 2-3 days (setup & core)
- Phase 3-4: 3-4 days (features & files)
- Phase 5-6: 2-3 days (UI & integration)
- Phase 7: 2-3 days (migration & testing)
- **Total: 11-16 days**

## Success Criteria
- ✅ Import/export .drawio files
- ✅ Drag-drop shapes from library
- ✅ All existing features working
- ✅ Better shape quality
- ✅ Draw.io compatibility
- ✅ No performance regression
- ✅ TypeScript strict mode

## Rollback Plan
- Keep current DrawArea implementation
- Feature flags for switching
- Parallel file format support
- Can revert if needed

## Next Steps
1. Install mxGraph and dependencies
2. Create MxGraphEditor component skeleton
3. Test basic draw.io file loading
4. Plan detailed API compatibility
