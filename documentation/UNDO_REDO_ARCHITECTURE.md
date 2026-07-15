# Undo/Redo Architecture Design

## Problem Statement

The current implementation has separate history stacks for elements and brush strokes, leading to inconsistent undo/redo behavior when both types of operations exist.

## Design Decision: Unified History

**Approach:** Each undo/redo step represents a complete canvas state snapshot containing BOTH elements AND brush strokes.

### Why Unified History?

1. **Simplicity** - Single linear history, clear LIFO semantics
2. **Consistency** - No priority conflicts between different operation types
3. **User Expectation** - Standard behavior in Figma, Adobe apps, etc.
4. **Prevents Edge Cases** - No ambiguity about which history to restore

### Architecture

```typescript
interface HistoryState {
  elements: DrawElement[];
  brushStrokes: BrushStroke[];
  timestamp: number;
}

// Single history array
const [history, setHistory] = useState<HistoryState[]>([{
  elements: [],
  brushStrokes: [],
  timestamp: Date.now()
}]);
const [historyIndex, setHistoryIndex] = useState(0);
```

## Scenarios and Expected Behavior

### Scenario 1: Draw Element Only
```
Initial: history = [{elements: [], brushStrokes: [], t:0}], index = 0
→ Draw rect: history = [{...}, {elements: [rect], brushStrokes: [], t:1}], index = 1
→ Undo: history unchanged, index = 0 (back to empty canvas)
→ Redo: history unchanged, index = 1 (back to rect)
```

### Scenario 2: Draw Brush Only
```
Initial: history = [{elements: [], brushStrokes: [], t:0}], index = 0
→ Draw stroke: history = [{...}, {elements: [], brushStrokes: [stroke1], t:1}], index = 1
→ Undo: history unchanged, index = 0 (back to empty canvas)
→ Redo: history unchanged, index = 1 (back to stroke)
```

### Scenario 3: Mixed Operations (Element → Brush → Element)
```
Initial: history = [{elements: [], brushStrokes: [], t:0}], index = 0

→ Draw rect:
  history = [{...}, {elements: [rect], brushStrokes: [], t:1}]
  index = 1

→ Draw stroke:
  history = [{...}, {...}, {elements: [rect], brushStrokes: [stroke1], t:2}]
  index = 2

→ Draw circle:
  history = [{...}, {...}, {...}, {elements: [rect, circle], brushStrokes: [stroke1], t:3}]
  index = 3

→ Undo (Ctrl+Z):
  index = 2 (circle removed, back to rect + stroke)

→ Undo (Ctrl+Z):
  index = 1 (stroke removed, back to rect only)

→ Undo (Ctrl+Z):
  index = 0 (rect removed, empty canvas)

→ Redo (Ctrl+Y):
  index = 1 (rect restored)

→ Redo (Ctrl+Y):
  index = 2 (stroke restored)

→ Redo (Ctrl+Y):
  index = 3 (circle restored)
```

### Scenario 4: Undo Then New Operation (Clears Future)
```
Initial: history = [{}, {rect}, {rect+stroke}, {rect+circle}], index = 3

→ Undo:
  index = 2

→ Draw ellipse (NEW operation):
  Clear future history: history = [{}, {rect}, {rect+stroke}, {rect+ellipse}]
  index = 3 (overwrites the "rect+circle" state)
```

### Scenario 5: Undo at History Start
```
Initial: history = [...], index = 0
→ Undo: Should be no-op, index remains 0
→ canUndo() returns false
```

### Scenario 6: Redo at History End
```
Initial: history = [...], index = history.length - 1
→ Redo: Should be no-op, index remains at end
→ canRedo() returns false
```

## Implementation Details

### When to Save to History

1. **Element Operations**
   - Add element
   - Delete element
   - Modify element (position, size, rotation, label, style, etc.)
   - Move element to front/back

2. **Brush Operations**
   - Complete brush stroke (on mouse up)

3. **NOT saved to history**
   - Selection changes
   - Hover states
   - In-progress brush strokes (only final stroke saved)
   - Pan/zoom operations

### Push to History Function

```typescript
const pushToHistory = (newState: HistoryState) => {
  // Remove any future history if we're not at the end
  const newHistory = history.slice(0, historyIndex + 1);
  
  // Add new state
  newHistory.push(newState);
  
  // Update history and index
  setHistory(newHistory);
  setHistoryIndex(newHistory.length - 1);
};
```

### Undo/Redo Functions

```typescript
const undo = () => {
  if (historyIndex > 0) {
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    restoreState(history[newIndex]);
    onStateChange?.();
  }
};

const redo = () => {
  if (historyIndex < history.length - 1) {
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    restoreState(history[newIndex]);
    onStateChange?.();
  }
};

const restoreState = (state: HistoryState) => {
  setElements(createDeepSnapshot(state.elements));
  setBrushStrokes([...state.brushStrokes]);
};
```

### canUndo / canRedo

```typescript
const canUndo = () => historyIndex > 0;
const canRedo = () => historyIndex < history.length - 1;
```

## Migration from Current Implementation

### Current State (BROKEN)
- Two separate histories: elementHistory and brushHistory
- Conflicting index pointers causing sync issues
- Unclear priority when both histories have operations

### Steps to Fix

1. **Remove separate histories**
   - Delete brushHistory state
   - Delete brushHistoryIndex state
   - Delete elementHistory state  
   - Delete elementHistoryIndex state

2. **Create unified history**
   - Add single `history` state (array of HistoryState)
   - Add single `historyIndex` state

3. **Update all operations**
   - pushToHistoryAndSetElements → creates snapshot with current brushStrokes
   - handleBrushEnd → creates snapshot with new brush stroke
   - All element modifications → create snapshots

4. **Rewrite undo/redo**
   - Single code path for both element and brush operations
   - No priority logic needed

## Testing Strategy

### Unit Tests
- Individual scenario tests (1-6 above)
- Boundary conditions (start/end of history)
- Large history handling

### Integration Tests
- Mixed operation sequences
- Undo/redo after mode switches
- History clearing on new operations

### Smoke Tests
- Basic draw + undo works
- Basic brush + undo works
- Mixed operations work
