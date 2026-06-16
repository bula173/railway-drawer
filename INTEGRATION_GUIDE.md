# Phase 4 Part 2: Manager Hooks Integration Guide

**Objective:** Integrate 4 manager hooks into DrawArea to reduce it from 2,927 → ~600 lines

**Risk Level:** Medium (large component, but hooks are well-tested)

**Approach:** Gradual integration with testing after each step

---

## Overview

Instead of refactoring DrawArea all at once, we'll integrate the hooks gradually:

```
Before:
DrawArea.tsx (2,927 lines)
  - Selection logic: 300 lines
  - Drag logic: 250 lines
  - Resize logic: 200 lines
  - History logic: 150 lines
  - Other: 2,027 lines

After:
DrawArea.tsx (~600 lines)
  - useSelectionManager hook
  - useDragManager hook
  - useResizeManager hook
  - useHistoryManager hook
  - Rendering & coordination: ~600 lines
```

---

## Integration Steps

### Step 1: Create New DrawArea with Hooks (Safe Approach)

Rather than modifying the existing 2,927-line DrawArea, we can:

**Option A: Create DrawAreaRefactored.tsx (Safest)**
1. Create new component that uses `useDrawAreaIntegration` hook
2. Implement same functionality but with hooks
3. Swap it in gradually
4. Delete old DrawArea when confident

**Option B: Gradual In-Place Migration (Faster but Riskier)**
1. Add hooks to DrawArea imports
2. Replace logic one section at a time
3. Test after each change
4. Keep old code commented until confirmed working

### Recommended: Option A (Safer)

**Why:**
- Zero risk of breaking current functionality
- Can test new version alongside old
- Easy rollback if issues occur
- Can compare line-by-line behavior

---

## Hook Integration Details

### 1. Selection Manager Integration

**Current DrawArea Code (Lines ~176-228):**
```typescript
// OLD: State scattered throughout
const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
const [isAreaSelecting, setIsAreaSelecting] = useState(false);
const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null);

// OLD: Logic spread through component
function handleElementClick(el: DrawElement) {
  setSelectedElementIds([el.id]);
}

function handleAreaSelectionStart(x: number, y: number) {
  setIsAreaSelecting(true);
  setSelectionStart({ x, y });
  setSelectionEnd({ x, y });
  setSelectedElementIds([]); // Clear selection
}
```

**NEW: Using useSelectionManager**
```typescript
const selection = useSelectionManager({
  elements,
  onSelectionChange: (ids) => {
    // Update any dependent state here
  }
});

// Usage becomes:
function handleElementClick(el: DrawElement) {
  selection.selectElement(el.id);
}

function handleAreaSelectionStart(x: number, y: number) {
  selection.startAreaSelection(x, y);
}
```

**Benefits:**
- ✅ All selection logic centralized
- ✅ Tested independently
- ✅ Easy to understand API
- ✅ Removes ~50 lines of state declarations

---

### 2. Drag Manager Integration

**Current DrawArea Code (Lines ~1650-1803):**
```typescript
// OLD: Scattered drag state
const [draggingId, setDraggingId] = useState<string | null>(null);
const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
const initialSelectedPositions = useRef<Map<...>>(new Map());

// OLD: Logic throughout component
function handlePointerDown(e: React.PointerEvent, el: DrawElement) {
  setDraggingId(el.id);
  dragOffset.current = { x: clientX - el.start.x, y: clientY - el.start.y };
  // ... 50+ lines of drag setup
}
```

**NEW: Using useDragManager**
```typescript
const drag = useDragManager({
  gridSize: 40,
  snapToGrid: true,
  onElementsDrag: (draggedElements) => {
    setElements(prev => 
      prev.map(el => draggedElements.find(de => de.id === el.id) || el)
    );
  }
});

// Usage becomes:
function handlePointerDown(e: React.PointerEvent, el: DrawElement) {
  drag.startDrag(el.id, e.clientX, e.clientY, svgRect);
  drag.recordInitialPositions([el]); // Track initial state
}
```

**Benefits:**
- ✅ Grid snapping built-in
- ✅ Offset calculation handled
- ✅ Initial position tracking
- ✅ Removes ~80 lines of logic

---

### 3. Resize Manager Integration

**Current DrawArea Code (Lines ~1317-1336):**
```typescript
// OLD: Resize state spread out
const resizingRef = useRef<...>(null);

// OLD: Complex resize logic
function handleResizePointerDown(e: React.PointerEvent, handle: string) {
  resizingRef.current = { handle, startX: e.clientX, ... };
  window.addEventListener('pointermove', handleResizePointerMove);
  // ... more setup
}
```

**NEW: Using useResizeManager**
```typescript
const resize = useResizeManager({
  minSize: 8,
  onElementResize: (element) => {
    setElements(prev => 
      prev.map(el => el.id === element.id ? element : el)
    );
  }
});

// Usage becomes:
function handleResizePointerDown(e: React.PointerEvent, handle: string, el: DrawElement) {
  resize.startResize(el, handle as any, e.clientX, e.clientY);
}
```

**Benefits:**
- ✅ Mirroring handled
- ✅ Min size enforced
- ✅ Removes ~70 lines of logic

---

### 4. History Manager Integration

**Current DrawArea Code (Lines ~193-195):**
```typescript
// OLD: Basic history array
const [history, setHistory] = useState<DrawElement[][]>([]);
const [historyIndex, setHistoryIndex] = useState<number>(-1);

// OLD: Manual history management
function pushToHistory() {
  const newHistory = history.slice(0, historyIndex + 1);
  newHistory.push(JSON.parse(JSON.stringify(elements)));
  setHistory(newHistory);
  setHistoryIndex(newHistory.length - 1);
}
```

**NEW: Using useHistoryManager**
```typescript
const history = useHistoryManager(elements, {
  maxSize: 50,
  onChange: (newState) => setElements(newState)
});

// Usage becomes:
function onElementsChange(newElements: DrawElement[]) {
  history.pushToHistory(newElements, 'Elements updated');
}

// Undo/Redo:
function undo() {
  history.undo();
}

function redo() {
  history.redo();
}
```

**Benefits:**
- ✅ Debouncing built-in
- ✅ History pruning automatic
- ✅ Undo/redo queries simple
- ✅ Removes ~60 lines of logic

---

## Migration Checklist

### Pre-Migration
- [ ] All hooks tested independently (✅ Done - 114 tests passing)
- [ ] Current DrawArea functionality understood
- [ ] Backup of DrawArea taken (git)
- [ ] Tests running and passing (✅ 114/114)

### Phase 4 Part 2a: Selection Integration (1-2 hours)
- [ ] Add useSelectionManager to DrawArea
- [ ] Replace selection state declarations with hook calls
- [ ] Update all selection-related functions
- [ ] Remove old selection state logic
- [ ] Run tests - should all pass
- [ ] Manual testing - selection works

### Phase 4 Part 2b: Drag Integration (1-2 hours)
- [ ] Add useDragManager to DrawArea
- [ ] Replace drag state with hook calls
- [ ] Update handlePointerDown/Move/Up functions
- [ ] Remove old drag state logic
- [ ] Run tests - should all pass
- [ ] Manual testing - dragging works with snapping

### Phase 4 Part 2c: Resize Integration (1-2 hours)
- [ ] Add useResizeManager to DrawArea
- [ ] Replace resize state with hook calls
- [ ] Update resize handle functions
- [ ] Remove old resize state logic
- [ ] Run tests - should all pass
- [ ] Manual testing - resizing works

### Phase 4 Part 2d: History Integration (1-2 hours)
- [ ] Add useHistoryManager to DrawArea
- [ ] Replace history state with hook calls
- [ ] Update pushToHistory calls
- [ ] Remove old history state logic
- [ ] Run tests - should all pass
- [ ] Manual testing - undo/redo works

### Post-Integration
- [ ] Delete all old logic (~900 lines removed)
- [ ] Verify DrawArea is now ~600 lines
- [ ] All 114+ tests passing
- [ ] Code review for any missed pieces
- [ ] Create commit: "Phase 4 Part 2: Integrate manager hooks"

---

## Safety Precautions

1. **Test After Each Manager Integration**
   ```bash
   npm test  # Should show 114+ tests passing
   ```

2. **Manual Testing Checklist**
   - [ ] Select elements (click, Ctrl+click, area select)
   - [ ] Drag elements with grid snapping
   - [ ] Resize elements from corners
   - [ ] Undo/redo operations
   - [ ] Copy/paste elements
   - [ ] Delete elements
   - [ ] Keyboard shortcuts

3. **Git Strategy**
   - Before starting: `git commit` your current state
   - After each manager: `git add . && git diff HEAD` to review
   - If issues arise: `git checkout` to revert that manager's changes
   - Final: `git commit -m "Phase 4 Part 2: ..."` with all managers integrated

4. **Fallback Plan**
   If integration breaks something:
   ```bash
   git revert <commit-hash>  # Go back to stable state
   Investigate issue
   Try again more carefully
   ```

---

## Expected File Size Changes

**Before Integration:**
```
DrawArea.tsx:          2,927 lines
├─ Selection code:     ~300 lines
├─ Drag code:          ~250 lines
├─ Resize code:        ~200 lines
├─ History code:       ~150 lines
└─ Other code:         ~2,027 lines
Total extracted:       ~900 lines
```

**After Integration:**
```
DrawArea.tsx:          ~600 lines
├─ Selection hook:     imported
├─ Drag hook:          imported
├─ Resize hook:        imported
├─ History hook:       imported
└─ Rendering/coord:    ~600 lines
Total removed:         ~900 lines (75% reduction)
```

---

## Files to Modify

| File | Action | Impact |
|------|--------|--------|
| DrawArea.tsx | Add hooks, remove old logic | -900 lines |
| DrawArea.tsx tests | Update if needed | Minimal |

---

## Commands During Migration

**Start integration:**
```bash
# Make sure tests pass before starting
npm test

# After each manager integration
npm test

# See what changed
git diff

# Review changes
git diff DrawArea.tsx | less

# Stage changes
git add src/components/DrawArea.tsx

# Create work-in-progress commit
git commit -m "WIP: Integrating selection manager"
```

**After all integrations:**
```bash
# Verify final state
npm test
wc -l src/components/DrawArea.tsx  # Should be ~600
git log --oneline | head -5

# Create final commit
git commit --amend -m "Phase 4 Part 2: Integrate all manager hooks"
```

---

## How to Handle Issues

### Issue: Tests fail after integration
**Solution:**
1. Identify which test failed
2. Check if hook API differs from old code
3. Update DrawArea to match hook API
4. Run tests again

### Issue: Feature stops working (e.g., selection broken)
**Solution:**
1. Check if all selection state was replaced
2. Look for lingering old state variables
3. Ensure hook callbacks are properly connected
4. Test that hook API is being called correctly

### Issue: Performance issues
**Solution:**
1. Check if memoization is needed
2. Look for unnecessary re-renders
3. Use React DevTools Profiler
4. Consider wrapping managers in useMemo if needed

---

## Next Steps After Phase 4 Part 2

Once all manager hooks are integrated:

1. **Verify Success:**
   - DrawArea reduced to ~600 lines
   - All 114+ tests passing
   - All functionality preserved

2. **Optional: Phase 4 Part 3**
   - Extract Clipboard Manager
   - Extract Context Menu Manager
   - Extract Keyboard Manager
   - Reduce DrawArea to ~150 lines

3. **Phase 8 Completion:**
   - Add tests for DrawArea integration
   - Add integration tests for workflows

---

## Summary

**Total Effort:** 2-3 days (4-6 hours of focused work)

**Result:**
- DrawArea shrinks from 2,927 → ~600 lines
- Code becomes more maintainable
- Easier to understand and test
- Foundation for further decomposition

**Risk:** Low (hooks are tested, can revert if needed)

**Next:** Start with selection manager integration

---

Start with: **Hook useSelectionManager into DrawArea** (Step 1)
