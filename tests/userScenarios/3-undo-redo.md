# User Scenario: Undo/Redo Operations

## Overview
This scenario covers the most critical functionality - users need undo/redo to work reliably with any combination of operations.

## Scenario 3.1: Simple Undo After Drawing Element

**User Goal:** Quickly undo a mistake

**Steps:**
1. Draw a rectangle at (100, 100, 150, 100)
2. User realizes it's in wrong position
3. Press Ctrl+Z (or Cmd+Z on Mac)
4. Verify rectangle disappears

**Expected Result:**
- ✅ Rectangle disappears completely
- ✅ Canvas returns to previous state
- ✅ Undo button in toolbar is disabled (no more history)
- ✅ Redo button in toolbar is enabled

**Verification Points:**
- [ ] Ctrl+Z works
- [ ] Rectangle completely removed
- [ ] No partial rendering
- [ ] Toolbar buttons reflect state
- [ ] No console errors

---

## Scenario 3.2: Simple Redo After Undo

**User Goal:** User changes mind and wants the undo'd action back

**Steps:**
1. From Scenario 3.1: Rectangle is gone after undo
2. Press Ctrl+Y (or Cmd+Y on Mac)
3. Verify rectangle reappears in original position

**Expected Result:**
- ✅ Rectangle reappears exactly where it was
- ✅ Rectangle properties unchanged (color, size, etc.)
- ✅ Position and dimensions identical
- ✅ Redo button is now disabled
- ✅ Undo button is enabled

**Verification Points:**
- [ ] Ctrl+Y works
- [ ] Rectangle reappears correctly
- [ ] All properties preserved
- [ ] Position exact match
- [ ] Toolbar buttons correct

---

## Scenario 3.3: Multiple Undo/Redo Sequence

**User Goal:** Navigate back and forth through multiple steps

**Steps:**
1. Draw Rectangle A at (100, 100)
2. Draw Rectangle B at (300, 100)
3. Draw Circle C at (500, 100)
4. Press Ctrl+Z → Only Circle C should be gone
5. Press Ctrl+Z → Rectangle B should be gone (A remains)
6. Press Ctrl+Z → Rectangle A should be gone (empty canvas)
7. Press Ctrl+Z → No change (at history start)
8. Press Ctrl+Y → Rectangle A reappears
9. Press Ctrl+Y → Rectangle B reappears
10. Press Ctrl+Y → Circle C reappears
11. Press Ctrl+Y → No change (at history end)

**Expected Result:**
- ✅ Each undo/redo removes/adds one element
- ✅ Elements appear in correct order
- ✅ No elements missing or duplicated
- ✅ At history boundaries, Ctrl+Z/Y does nothing
- ✅ All properties preserved

**Verification Points:**
- [ ] Linear progression correct
- [ ] Element count correct at each step
- [ ] LIFO order respected
- [ ] Boundary checks work
- [ ] Properties intact

---

## Scenario 3.4: Undo After Modifying Element

**User Goal:** Undo a property change

**Steps:**
1. Draw Rectangle at (100, 100, 150, 100) with white fill
2. Select rectangle
3. Change fill color to red
4. Press Ctrl+Z
5. Verify rectangle is white again

**Expected Result:**
- ✅ Rectangle fill changes back to white
- ✅ Size, position, stroke unchanged
- ✅ Rectangle still selected
- ✅ Properties panel shows white fill

**Verification Points:**
- [ ] Color property reverted
- [ ] Other properties unchanged
- [ ] Selection maintained
- [ ] UI reflects previous state
- [ ] No partial updates

---

## Scenario 3.5: Mixed Operations - Elements Then Brush

**User Goal:** Work with both shapes and annotations, undo both correctly

**Steps:**
1. Draw Rectangle at (100, 100, 150, 100)
2. Press B to activate brush tool
3. Draw a freehand stroke
4. Press Escape to deactivate brush
5. Press Ctrl+Z
   - Expected: Brush stroke disappears, rectangle remains
6. Press Ctrl+Z
   - Expected: Rectangle disappears, empty canvas
7. Press Ctrl+Y
   - Expected: Rectangle reappears
8. Press Ctrl+Y
   - Expected: Brush stroke reappears

**Expected Result:**
- ✅ Step 5: Stroke gone, rectangle visible
- ✅ Step 6: Canvas empty
- ✅ Step 7: Rectangle back
- ✅ Step 8: Stroke back in exact position
- ✅ All undo/redo work in correct order (LIFO)

**Verification Points:**
- [ ] Brush stroke can be undone
- [ ] Mixed operations respect order
- [ ] Stroke position exact on redo
- [ ] No state conflicts
- [ ] Unified history working

---

## Scenario 3.6: Undo Multiple Brush Strokes

**User Goal:** Undo multiple annotations quickly

**Steps:**
1. Activate brush tool
2. Draw 5 separate brush strokes on canvas
3. Press Ctrl+Z 5 times
4. Verify all strokes disappear one by one
5. Press Ctrl+Y 3 times
6. Verify 3 strokes reappear in correct order

**Expected Result:**
- ✅ Each stroke undone individually (LIFO order)
- ✅ Strokes reappear in reverse order
- ✅ Each stroke in exact original position
- ✅ No stroke duplication or loss
- ✅ Performance acceptable

**Verification Points:**
- [ ] All 5 strokes undo'd
- [ ] LIFO order correct
- [ ] Redo restores correct strokes
- [ ] Positions exact
- [ ] No rendering glitches

---

## Scenario 3.7: Undo Then New Operation (Clear Future)

**User Goal:** Start fresh after undoing - future history should be cleared

**Steps:**
1. Draw Rectangle A at (100, 100)
2. Draw Rectangle B at (300, 100)
3. Draw Circle C at (500, 100)
4. Press Ctrl+Z twice
   - Current state: Only Rectangle A visible
5. Draw Ellipse D at (700, 100) [NEW operation]
6. Press Ctrl+Y
   - Should do nothing (no future history to redo)
7. Press Ctrl+Z
   - Should undo Ellipse D (state back to just Rectangle A)
8. Press Ctrl+Z
   - Should undo Rectangle A (empty canvas)
9. Press Ctrl+Y
   - Should redo Rectangle A

**Expected Result:**
- ✅ Step 5: Ellipse D added, Circle C and B history cleared
- ✅ Step 6: No redo available
- ✅ Step 7: Ellipse D gone
- ✅ Step 8: Rectangle A gone
- ✅ Step 9: Rectangle A back
- ✅ Circle C and B cannot be recovered (history branched)

**Verification Points:**
- [ ] Future history cleared on new op
- [ ] Redo disabled after branching
- [ ] New operation saved correctly
- [ ] History branching correct
- [ ] No lost data beyond branch point

---

## Scenario 3.8: Undo with Copy/Paste

**User Goal:** Undo paste operations

**Steps:**
1. Draw Rectangle A at (100, 100, 150, 100)
2. Select Rectangle A
3. Copy (Ctrl+C)
4. Paste (Ctrl+V) → Rectangle A' appears at (110, 110)
5. Press Ctrl+Z
6. Verify Rectangle A' is gone

**Expected Result:**
- ✅ Rectangle A' disappears
- ✅ Rectangle A still visible and selected
- ✅ Clipboard not cleared
- ✅ Can Ctrl+Y to redo the paste

**Verification Points:**
- [ ] Paste undoes correctly
- [ ] Original element preserved
- [ ] Redo works after undo
- [ ] Clipboard state maintained

---

## Scenario 3.9: Undo Text Editing

**User Goal:** Undo label changes

**Steps:**
1. Draw Rectangle at (100, 100, 150, 100)
2. Double-click → Text edit mode
3. Type "Initial"
4. Click elsewhere → Text saved
5. Press Ctrl+Z
6. Verify label is removed/reset

**Expected Result:**
- ✅ Text editing tracked in history
- ✅ Undo removes the label
- ✅ Rectangle remains
- ✅ Can redo to get text back

**Verification Points:**
- [ ] Text changes saved to history
- [ ] Undo removes text
- [ ] Redo restores text
- [ ] Element properties intact

---

## Scenario 3.10: Performance - Large Undo History

**User Goal:** App maintains performance with many operations

**Steps:**
1. Draw 50 shapes (rapid drawing)
2. System should handle 50+ undo steps
3. Press Ctrl+Z 10 times rapidly
4. Verify each undo happens smoothly
5. Press Ctrl+Y 10 times
6. Verify performance is acceptable
7. Check memory usage is reasonable

**Expected Result:**
- ✅ All 50+ steps undoable
- ✅ No lag or stuttering
- ✅ Redo is fast
- ✅ Memory doesn't explode
- ✅ App remains responsive

**Verification Points:**
- [ ] Large history handled
- [ ] No memory leaks
- [ ] Performance acceptable
- [ ] No skipped undo steps
- [ ] Smooth animation/transitions
