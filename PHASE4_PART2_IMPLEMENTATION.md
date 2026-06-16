# Phase 4 Part 2: DrawArea Hook Integration Implementation Guide

**Status:** Ready to Execute  
**Risk Level:** Medium (Large component, but hooks are fully tested)  
**Approach:** Gradual, incremental integration with validation at each step  
**Effort:** 2-3 days of focused work  

---

## ⚠️ Critical Safety Rules

**Before Starting:**
1. ✅ Ensure all 114 tests pass: `npm test`
2. ✅ Commit current state: `git add . && git commit -m "WIP: Before Phase 4 Part 2"`
3. ✅ Create a branch: `git checkout -b phase-4-part-2-integration`
4. ✅ Read this entire guide before starting
5. ✅ Have INTEGRATION_GUIDE.md open for reference

**During Integration:**
1. ✅ Complete ONE manager hook integration at a time
2. ✅ Test after EVERY change
3. ✅ If tests fail, STOP and debug immediately
4. ✅ Commit working state after each manager
5. ✅ Review changes before committing: `git diff`

**If Anything Breaks:**
```bash
# Immediate rollback
git reset --hard <last-working-commit>

# Do NOT continue until issue is fixed
```

---

## Phase 4 Part 2a: useSelectionManager Integration

### Step 1: Add Hook to DrawArea (5 min)

**File:** `src/components/DrawArea.tsx`

**Add import at top:**
```typescript
import { useSelectionManager } from '../hooks/useSelectionManager';
```

**Add hook after other hooks (after line ~260):**
```typescript
// Add this after useState declarations, before other logic
const selection = useSelectionManager({
  elements,
  onSelectionChange: useCallback((ids: string[]) => {
    logger.debug('DrawArea', 'Selection changed', { count: ids.length });
  }, []),
});
```

### Step 2: Test Hook Addition (2 min)

```bash
npm test
```

Expected: ✅ All 114 tests still pass

If tests fail, revert and debug:
```bash
git diff
git reset --hard
```

### Step 3: Replace Selection State Declarations (15 min)

**Find and REMOVE these lines (~176-232):**
```typescript
const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
const selectedElements = useMemo(() => ..., [elements, selectedElementIds]);
const selectionCanGroup = selectedElementIds.length > 1;
const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
const [isAreaSelecting, setIsAreaSelecting] = useState(false);
const [selectionStart, setSelectionStart] = useState<...>(null);
const [selectionEnd, setSelectionEnd] = useState<...>(null);
const selectionEndRef = useRef<...>(null);
```

**Replace with:**
```typescript
// Selection is now managed by useSelectionManager hook
const selectedElements = useMemo(
  () => selection.getSelectedElements(),
  [selection.selectedElementIds]
);
const selectionCanGroup = selection.selectedElementIds.length > 1;
```

### Step 4: Test State Removal (2 min)

```bash
npm test
```

Expected: ✅ All 114 tests still pass

If compilation errors, revert and try again:
```bash
git diff  # See what went wrong
git reset --hard
```

### Step 5: Replace Selection Handlers (30 min)

**Find these functions and replace them:**

**OLD: handlePointerDown (lines ~1650-1803)**
```typescript
function handlePointerDown(e: React.PointerEvent, el: DrawElement) {
  // OLD: lots of logic for selection
  setSelectedElementIds(
    e.ctrlKey || e.metaKey
      ? selectedElementIds.includes(el.id)
        ? selectedElementIds.filter(id => id !== el.id)
        : [...selectedElementIds, el.id]
      : [el.id]
  );
  // ... more code
}
```

**NEW: handlePointerDown**
```typescript
function handlePointerDown(e: React.PointerEvent, el: DrawElement) {
  // Use selection manager instead
  selection.selectElement(el.id, e.ctrlKey || e.metaKey);
  
  // Rest of the function remains the same (drag logic, etc.)
  // ... existing drag setup code
}
```

**OLD: Hover state changes**
Look for: `setHoveredElementId(el.id)` and `setHoveredElementId(null)`

**NEW: Replace with:**
```typescript
selection.setHoveredElementId(el.id);
selection.clearHover();
```

**OLD: Area selection start (lines ~1803-1850)**
```typescript
function handleSvgPointerDown(e: React.PointerEvent) {
  // ...
  setIsAreaSelecting(true);
  setSelectionStart({ x: svgX, y: svgY });
  setSelectionEnd({ x: svgX, y: svgY });
  setSelectedElementIds([]); // Clear selection
}
```

**NEW: Area selection start**
```typescript
function handleSvgPointerDown(e: React.PointerEvent) {
  // ...
  selection.startAreaSelection(svgX, svgY);
}
```

**OLD: Area selection update**
```typescript
// In handlePointerMove or similar
setSelectionEnd({ x: svgX, y: svgY });
```

**NEW: Area selection update**
```typescript
selection.updateAreaSelection(svgX, svgY);
```

**OLD: Area selection end**
```typescript
// When releasing mouse
setIsAreaSelecting(false);
```

**NEW: Area selection end**
```typescript
selection.endAreaSelection();
```

### Step 6: Test Handler Replacement (2 min)

```bash
npm test
```

Expected: ✅ All 114 tests still pass

### Step 7: Replace All References to Old State (20 min)

**Find and replace these patterns throughout DrawArea.tsx:**

| Old | New |
|-----|-----|
| `selectedElementIds` | `selection.selectedElementIds` |
| `hoveredElementId` | `selection.hoveredElementId` |
| `isAreaSelecting` | `selection.isAreaSelecting` |
| `selectionStart` | `selection.selectionRect` (if accessing rect) |
| `selectionEnd` | `selection.selectionRect` (if accessing rect) |
| `setHoveredElementId` | `selection.setHoveredElementId` |

**Use Find and Replace (Ctrl+H) carefully:**
1. Find: `selectedElementIds.includes(`
2. Replace: `selection.selectedElementIds.includes(`
3. **Preview each change before replacing**

### Step 8: Test Complete Integration (2 min)

```bash
npm test
```

Expected: ✅ All 114 tests passing

### Step 9: Manual Testing (10 min)

```bash
npm run dev
# Browser: http://localhost:3000
```

Test these manually:
- ✅ Click element → selects it (blue outline)
- ✅ Ctrl+click → multi-select
- ✅ Click and drag → area select
- ✅ Hover → shows hover outline
- ✅ Clear selection by clicking empty canvas

### Step 10: Commit Phase 4 Part 2a (2 min)

```bash
git diff --stat  # Review what changed
git add src/components/DrawArea.tsx
git commit -m "Phase 4 Part 2a: Integrate useSelectionManager into DrawArea"
```

---

## Phase 4 Part 2b: useDragManager Integration

**Effort:** 1-2 hours  
**Same process as Part 2a:**

1. Add hook import and initialization
2. Run tests
3. Remove drag state declarations
4. Replace drag handlers
5. Replace all references
6. Test compilation
7. Manual testing
8. Commit

**Key replacements:**
- `draggingId` → `drag.draggingElementId`
- `dragOffset` → managed internally in hook
- `handlePointerMove` logic → `drag.updateDragPosition()`
- Grid snapping → automatic in hook with `snapToGrid: true`

---

## Phase 4 Part 2c: useResizeManager Integration

**Effort:** 1-2 hours  
**Same process:**

1. Add hook
2. Remove state
3. Replace handlers
4. Test
5. Commit

**Key replacements:**
- Resize handle logic → `resize.startResize()`
- Mirroring handling → automatic in hook
- Min size enforcement → automatic in hook

---

## Phase 4 Part 2d: useHistoryManager Integration

**Effort:** 1-2 hours  
**Same process:**

1. Add hook
2. Remove `history` and `historyIndex` state
3. Replace `pushToHistory()` calls with `history.pushToHistory()`
4. Replace undo/redo logic with `history.undo()` and `history.redo()`
5. Test
6. Commit

---

## Final Verification (When All 4 Managers Integrated)

```bash
# Check file size reduction
wc -l src/components/DrawArea.tsx  # Should be ~600 lines (was 2,927)

# Verify all tests pass
npm test  # All 114+ tests should pass

# Manual smoke test
npm run dev
# Test: selection, drag, resize, undo/redo, copy/paste, all works
```

---

## Troubleshooting

### Issue: Tests fail after adding hook

**Solution:**
1. Check if imports are correct
2. Verify hook initialization has correct props
3. Look at error message carefully
4. Run: `npm test -- --reporter=verbose` for more details
5. If stuck, revert: `git reset --hard`

### Issue: Compilation errors after replacement

**Common causes:**
- Typo in hook API call
- Missing destructuring
- Wrong property name

**Solution:**
1. Check hook documentation: `useSelectionManager.ts` docstring
2. Compare with `DrawAreaRefactored.tsx` for examples
3. Fix and recompile

### Issue: Selection stops working

**Debug steps:**
1. Add console log: `console.log('Selection:', selection.selectedElementIds);`
2. Click an element, check console
3. Check if `selection.selectElement()` is being called
4. Verify hook is initialized correctly

### Issue: Can't rollback

```bash
# If you need to go back to clean state
git reset --hard origin/main
git checkout phase-4-part-2-integration  # Start over if on different branch
```

---

## Reference Files

- **DrawAreaRefactored.tsx** - Reference implementation showing how to use all hooks
- **INTEGRATION_GUIDE.md** - Original detailed integration guide
- **Hook docs** - Read the docstrings in each hook file

---

## Success Criteria

When Phase 4 Part 2 is complete:

✅ DrawArea.tsx is ~600 lines (down from 2,927)  
✅ All 114+ tests pass  
✅ All functionality works the same:
  - Selection (single, multi, area)
  - Dragging with grid snapping
  - Resizing with mirroring
  - Undo/redo
  - Copy/paste
  - Delete
  - All keyboard shortcuts

✅ Code is cleaner and easier to understand  
✅ State management is centralized in hooks  

---

## Next Steps After Phase 4 Part 2

Once all 4 managers are integrated:

1. **Optional Phase 4 Part 3**: Extract additional managers
   - ClipboardManager
   - ContextMenuManager
   - KeyboardManager

2. **Phase 8 Completion**: Add integration tests
   - Test full workflows
   - Test edge cases

3. **Production Release**: Code complete with professional architecture

---

## Timeline

- **Phase 4 Part 2a** (Selection): 1-2 hours
- **Phase 4 Part 2b** (Drag): 1-2 hours
- **Phase 4 Part 2c** (Resize): 1-2 hours
- **Phase 4 Part 2d** (History): 1-2 hours
- **Total**: 4-8 hours spread over 2-3 days

---

## Remember

1. **Take it slow** - one manager at a time
2. **Test frequently** - after each change
3. **Commit often** - checkpoint after each manager
4. **Use references** - DrawAreaRefactored.tsx and hook docstrings
5. **Ask for help** - if stuck, review the hook documentation

You've got this! 🚀
