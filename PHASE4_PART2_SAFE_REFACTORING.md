# Phase 4 Part 2: Safe DrawArea Refactoring Guide

**Status:** Ready for Careful Execution  
**Approach:** Methodical, function-by-function integration  
**Validation:** Tests run after every major change  
**Complexity:** High (2,927 lines, 500+ state references)  

---

## ⚠️ Critical Notes

DrawArea.tsx is a **large, critical component** with:
- 2,927 lines of code
- 500+ references to `selectedElementIds`
- 50+ references to `setSelectedElementIds`
- 30+ references to `hoveredElementId`
- Complex interdependencies between selection, drag, resize, and keyboard logic

**This refactoring should be done carefully**, with tests running after each logical step.

---

## Phase 4 Part 2a: Selection Manager Integration (Safe Approach)

### Prerequisites
```bash
# 1. Ensure all tests pass
npm test  # Should show 114 passing

# 2. Create a feature branch
git checkout -b phase-4-part-2a-selection

# 3. Understand the hook API
cat src/hooks/useSelectionManager.ts  # Review the public API
```

### Step-by-Step Safe Refactoring

#### Step 1: Add Hook and Wrapper Methods (5-10 min)

**Goal:** Add the hook without changing any logic

**Action:** At the top of DrawArea component, after elements state:
```typescript
// After: const [elements, setElements] = useState<DrawElement[]>([]);

// Add useSelectionManager hook
const selection = useSelectionManager({
  elements,
  onSelectionChange: useCallback((ids: string[]) => {
    logger.debug('DrawArea', 'Selection changed via hook', { count: ids.length });
  }, []),
});

// Create wrapper functions to gradually transition from old to new
const wrapSelectElements = (ids: string[]) => selection.selectElements(ids);
const wrapClearSelection = () => selection.clearSelection();
const wrapSetHoveredElementId = (id: string | null) => {
  if (id === null) {
    selection.clearHover();
  } else {
    selection.setHoveredElementId(id);
  }
};
```

**Test:** Run `npm test` after this step
- Expected: 114 tests passing
- If not, revert this step

#### Step 2: Update useRef Dependencies (5 min)

**Goal:** Create a memoized version for use in callbacks

**Action:** Add a useMemo wrapper for the selection object:
```typescript
const selectionApi = useMemo(() => ({
  selectElements: (ids: string[]) => selection.selectElements(ids),
  clearSelection: () => selection.clearSelection(),
  setHoveredElementId: (id: string | null) => {
    if (id === null) selection.clearHover();
    else selection.setHoveredElementId(id);
  },
  startAreaSelection: (x: number, y: number) => selection.startAreaSelection(x, y),
  updateAreaSelection: (x: number, y: number) => selection.updateAreaSelection(x, y),
  endAreaSelection: () => selection.endAreaSelection(),
  getSelectedElementIds: () => selection.selectedElementIds,
  getSelectedElements: () => selection.getSelectedElements(),
}), [selection]);
```

**Test:** Run `npm test` after this step

#### Step 3: Refactor deleteSelectedElements (10 min)

**Goal:** Update one complete function to use the hook

**Current code** (lines ~588-608):
```typescript
const deleteSelectedElements = useCallback(() => {
  if (selectedElementIds.length > 0) {
    pushToHistoryAndSetElements(prev => 
      prev.filter(element => !selectedElementIds.includes(element.id))
    );
    setSelectedElementIds([]);
    setHoveredElementId(null);
    // ...
  }
}, [selectedElementIds, ...]);
```

**New code:**
```typescript
const deleteSelectedElements = useCallback(() => {
  if (selection.selectedElementIds.length > 0) {
    pushToHistoryAndSetElements(prev =>
      prev.filter(element => !selection.selectedElementIds.includes(element.id))
    );
    selection.clearSelection();
    selection.clearHover();
    // ...
  }
}, [selection, pushToHistoryAndSetElements, ...]);
```

**Test:** 
```bash
npm test
# Expected: 114 tests passing
```

**If tests fail:**
```bash
git diff src/components/DrawArea.tsx
# Review the exact change
git checkout src/components/DrawArea.tsx  # Revert
# Try the change again more carefully
```

#### Step 4: Refactor selectAllElements (5 min)

**Current code**:
```typescript
const selectAllElements = useCallback(() => {
  const allIds = elements.map(el => el.id);
  setSelectedElementIds(allIds);
  onStateChange?.();
}, [elements, onStateChange]);
```

**New code**:
```typescript
const selectAllElements = useCallback(() => {
  const allIds = elements.map(el => el.id);
  selection.selectElements(allIds);
  onStateChange?.();
}, [elements, selection, onStateChange]);
```

**Test:** `npm test` - 114 tests passing

#### Step 5: Refactor copySelectedElements (5 min)

**Search for:** `const copySelectedElements = useCallback`

**Replace** all references to `selectedElementIds` in this function with `selection.selectedElementIds`

**Test:** `npm test`

#### Step 6: Refactor cutSelectedElements (5 min)

**Similar to copySelectedElements:**
- Replace `selectedElementIds` → `selection.selectedElementIds`
- Replace `setSelectedElementIds([])` → `selection.clearSelection()`

**Test:** `npm test`

#### Step 7: Update ref dependencies (10 min)

**Find:** All `useCallback` hooks with `[selectedElementIds, ...]` dependencies

**Action:** Update dependencies to include `selection` instead

Example:
```typescript
// OLD
}, [selectedElementIds, pushToHistoryAndSetElements, ...]

// NEW  
}, [selection, pushToHistoryAndSetElements, ...]
```

**Critical functions to update:**
- Line ~719: useEffect with selectedElementIds
- Line ~782: Large useCallback with keyboard handlers
- Line ~1305: Context menu useCallback
- Line ~1627: Keyboard events useCallback

**Test after each dependency update:** `npm test`

#### Step 8: Replace Area Selection Calls (15 min)

**Find all** instances of:
- `setIsAreaSelecting(true)` → `selection.startAreaSelection(x, y)`
- `setIsAreaSelecting(false)` → `selection.endAreaSelection()`
- `setSelectionStart` → remove (handled by hook)
- `setSelectionEnd` → remove (handled by hook)

**Test:** `npm test` after each replacement

#### Step 9: Replace Hover State Calls (10 min)

**Find all** instances of:
- `setHoveredElementId(elementId)` → `selection.setHoveredElementId(elementId)`
- `setHoveredElementId(null)` → `selection.clearHover()`

**Common locations:**
- Hover handlers in SVG rendering
- Pointer move events
- Element selection logic

**Test:** `npm test` after replacements

#### Step 10: Update selectedElements Derivation (5 min)

**Update** the useMemo for selectedElements to use hook:
```typescript
const selectedElements = useMemo(
  () => elements.filter(el => selection.selectedElementIds.includes(el.id)),
  [elements, selection.selectedElementIds]
);
```

**Test:** `npm test`

#### Step 11: Replace All State References (30 min)

This is the bulk replacement step. Use Find & Replace carefully:

**In VS Code:**
1. Press Ctrl+H (Find and Replace)
2. For each pattern below, review each match before replacing

**Patterns to replace:**

| Find | Replace | Notes |
|------|---------|-------|
| `selectedElementIds.includes(` | `selection.selectedElementIds.includes(` | Check context |
| `selectedElementIds.length` | `selection.selectedElementIds.length` | Check context |
| `selectedElementIds.map(` | `selection.selectedElementIds.map(` | Check context |
| `selectedElementIds.filter(` | `selection.selectedElementIds.filter(` | Check context |
| `[...selectedElementIds` | `[...selection.selectedElementIds` | Check context |
| `hoveredElementId` | `selection.hoveredElementId` | If reading value |
| `isAreaSelecting` | `selection.isAreaSelecting` | If reading value |

**Test after each pattern:** `npm test`

#### Step 12: Remove Old State Declarations (10 min)

**Delete these lines:**
```typescript
const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
const [isAreaSelecting, setIsAreaSelecting] = useState(false);
const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null);
const selectionEndRef = useRef<{ x: number; y: number } | null>(null);
```

**Test:** `npm test` - Should show 114 tests passing

### Phase 4 Part 2a Completion Checklist

- [ ] Hook imported and initialized
- [ ] deleteSelectedElements refactored
- [ ] selectAllElements refactored
- [ ] copySelectedElements refactored
- [ ] cutSelectedElements refactored
- [ ] All callback dependencies updated
- [ ] Area selection calls replaced
- [ ] Hover state calls replaced
- [ ] selectedElements derivation updated
- [ ] All state references replaced  
- [ ] Old state declarations removed
- [ ] All 114+ tests passing
- [ ] Manual testing:
  - [ ] Click element → selects
  - [ ] Ctrl+click → multi-select
  - [ ] Drag rectangle → area select
  - [ ] Hover → shows hover state
  - [ ] Delete → removes selection
  - [ ] Select All → selects all elements

### Commit Phase 4 Part 2a

```bash
git add src/components/DrawArea.tsx
git commit -m "Phase 4 Part 2a: Integrate useSelectionManager into DrawArea

- Replace selectedElementIds state with useSelectionManager hook
- Replace setSelectedElementIds calls with hook methods
- Replace hoveredElementId state with hook
- Replace area selection state with hook
- Update all callbacks to use hook API
- All 114+ tests passing
- Selection, multi-select, area select, and hover working correctly"
```

---

## Key Validation Points

### After Each Step
```bash
npm test
# Watch for:
# - 114 tests passing
# - No compilation errors
# - No type errors
```

### Mid-Refactoring Manual Test
```bash
npm run dev
# In browser:
# - Click an element → blue outline
# - Ctrl+click → multi-select
# - Draw rectangle → area select
# - Hover → hover outline
```

### Final Validation
```bash
npm test                    # All tests pass
npm run build               # Build succeeds
npm run typecheck           # No type errors
npm run lint                # No lint errors
```

---

## Troubleshooting

### Issue: Tests fail after a step

**Solution:**
1. Review the git diff: `git diff src/components/DrawArea.tsx`
2. Look at the specific test failure
3. Revert the change: `git checkout src/components/DrawArea.tsx`
4. Try the change again more carefully
5. Reference DrawAreaRefactored.tsx for the correct API usage

### Issue: "selectedElementIds is not defined"

**Cause:** Some code still references old variable

**Solution:**
1. Look at the test error for the line number
2. Replace that reference with `selection.selectedElementIds`
3. Run tests again

### Issue: "Cannot read properties of undefined"

**Cause:** Hook not properly initialized or dependency missing

**Solution:**
1. Verify hook initialization: `const selection = useSelectionManager({...})`
2. Verify hook is initialized BEFORE it's used
3. Check callback dependencies include `selection`

---

## Expected Outcome

When Phase 4 Part 2a is complete:

✅ DrawArea uses useSelectionManager hook for all selection logic  
✅ Old selectedElementIds, hoveredElementId state removed  
✅ All 114+ tests passing  
✅ Selection, multi-select, area select working  
✅ Code is cleaner and more maintainable  

**Phase 4 Part 2a Result:**
- Selection logic consolidated into hook (220 lines)
- ~50 lines of old state declarations removed
- ~200 lines of selection logic removed from component
- Cleaner DrawArea component (still large, but progressing toward 600 lines)

---

## Next Phases (After 2a)

- **Phase 4 Part 2b:** Integrate useDragManager (similar process)
- **Phase 4 Part 2c:** Integrate useResizeManager (similar process)
- **Phase 4 Part 2d:** Integrate useHistoryManager (similar process)

---

## Reference Files

- `src/hooks/useSelectionManager.ts` - Hook API reference
- `src/components/DrawAreaRefactored.tsx` - Complete reference implementation
- `PHASE4_PART2_IMPLEMENTATION.md` - Overview guide

---

Good luck! This is detailed work, but breaking it into these steps makes it manageable and safe. Remember: **test after every significant change**.
