# User Scenario: Edge Cases and Error Recovery

## Overview
This scenario covers unusual situations, edge cases, and how the app should handle them gracefully.

## Scenario 6.1: Undo at History Boundary

**User Goal:** Understand what happens when undo is not available

**Steps:**
1. Open fresh canvas (no operations)
2. Press Ctrl+Z multiple times
3. Verify nothing happens
4. Check toolbar: Undo button should be disabled/greyed out

**Expected Result:**
- ✅ Ctrl+Z does nothing at history start
- ✅ Undo button is disabled
- ✅ No error message or beep
- ✅ Graceful no-op

**Verification Points:**
- [ ] No error on invalid undo
- [ ] Button state indicates inability
- [ ] Smooth handling
- [ ] User not confused

---

## Scenario 6.2: Redo at History Boundary

**User Goal:** Understand what happens when redo is not available

**Steps:**
1. Create a shape
2. Do NOT undo
3. Press Ctrl+Y multiple times
4. Verify nothing happens
5. Check toolbar: Redo button should be disabled

**Expected Result:**
- ✅ Ctrl+Y does nothing (no future history)
- ✅ Redo button is disabled
- ✅ No error
- ✅ Graceful no-op

**Verification Points:**
- [ ] No error on invalid redo
- [ ] Button disabled when appropriate
- [ ] Smooth behavior
- [ ] Clear feedback

---

## Scenario 6.3: Undo After New Operation (History Branching)

**User Goal:** Understand history branching - new operation clears future history

**Steps:**
1. Draw Rectangle A
2. Draw Rectangle B
3. Press Ctrl+Z (back to just A)
4. Draw Circle C (NEW operation)
5. Press Ctrl+Y
6. Verify: Does nothing (Rectangle B is gone from history)
7. Press Ctrl+Z
8. Back to just Rectangle A
9. Rectangle B cannot be recovered

**Expected Result:**
- ✅ Rectangle B history is cleared
- ✅ Redo does nothing in step 5
- ✅ Can undo to go back to A
- ✅ Cannot recover Rectangle B
- ✅ This is standard branching behavior (like Git)

**Verification Points:**
- [ ] Future history cleared
- [ ] No way to recover lost branch
- [ ] User understands implication
- [ ] Could show warning if desired

---

## Scenario 6.4: Rapid Undo/Redo Sequence

**User Goal:** App handles rapid keypresses smoothly

**Steps:**
1. Create a shape
2. Rapidly press Ctrl+Z then Ctrl+Y repeatedly (10+ times fast)
3. Monitor for:
   - Lag or stuttering
   - Missed keystrokes
   - State corruption
   - Visual glitches

**Expected Result:**
- ✅ Smooth operation throughout
- ✅ No dropped keypresses
- ✅ No lag or stuttering
- ✅ State remains consistent
- ✅ Visual rendering smooth

**Verification Points:**
- [ ] No stuttering/lag
- [ ] All keystrokes registered
- [ ] State correct throughout
- [ ] Animation smooth
- [ ] Performance acceptable

---

## Scenario 6.5: Very Long History (Memory Test)

**User Goal:** Ensure app handles large undo stacks

**Steps:**
1. Draw 100+ shapes (rapid clicking)
2. Create 100+ operations in history
3. Try Ctrl+Z/Y throughout
4. Check browser memory usage
5. Verify app remains responsive

**Expected Result:**
- ✅ All 100+ operations undoable
- ✅ Memory usage reasonable (< 500MB)
- ✅ No noticeable lag
- ✅ App responsive throughout
- ✅ No crashes

**Verification Points:**
- [ ] Large history supported
- [ ] Memory usage acceptable
- [ ] No memory leaks
- [ ] Performance maintained
- [ ] Graceful degradation if limits hit

---

## Scenario 6.6: Delete Shape with Active Connector

**User Goal:** App cleans up orphaned connectors

**Steps:**
1. Create Rectangle A and Rectangle B
2. Connect A → B
3. Select Rectangle A
4. Press Delete
5. Verify:
   - Rectangle A is gone
   - Connector is automatically removed
   - Rectangle B remains

**Expected Result:**
- ✅ Shape deleted
- ✅ Connector automatically deleted
- ✅ No orphaned connectors
- ✅ Cascade delete works
- ✅ Can undo to restore both

**Verification Points:**
- [ ] Orphaned connector cleanup
- [ ] Cascade delete correct
- [ ] Undo restores connection
- [ ] No dangling references
- [ ] No visual artifacts

---

## Scenario 6.7: Brush Stroke Outside Visible Canvas

**User Goal:** Strokes can extend beyond visible area, pan to see them

**Steps:**
1. Pan canvas far to one side
2. Draw brush stroke at edge
3. Stroke should be partially or fully outside view
4. Pan back to see stroke
5. Stroke should be exactly where it was drawn

**Expected Result:**
- ✅ Stroke drawn at exact coordinates
- ✅ Stroke persists beyond visible bounds
- ✅ Can pan to view it
- ✅ Undo removes it from anywhere on canvas
- ✅ No clipping artifacts

**Verification Points:**
- [ ] Stroke drawn at exact location
- [ ] Persists outside visible area
- [ ] Pan reveals stroke
- [ ] No rendering at wrong location
- [ ] Undo works from any view

---

## Scenario 6.8: Element at Canvas Edge

**User Goal:** Shapes can touch or be at edge

**Steps:**
1. Draw Rectangle at x=0, y=0 (top-left corner)
2. Draw Circle at x=canvas_width, y=canvas_height (bottom-right corner)
3. Draw Connector between them
4. Move both shapes around
5. Undo movements

**Expected Result:**
- ✅ Shapes at edges render correctly
- ✅ Resize handles visible
- ✅ Connector spans correctly
- ✅ Can select and move shapes at edges
- ✅ Undo works

**Verification Points:**
- [ ] Edge positioning works
- [ ] No clipping at edges
- [ ] UI elements visible
- [ ] Connectors render correctly
- [ ] Interaction works

---

## Scenario 6.9: Degenerate Shapes (Very Small or Large)

**User Goal:** Shapes can be arbitrarily sized

**Steps:**
1. Draw very small shape (1x1 px)
2. Try to select and resize it
3. Draw very large shape (2000x2000 px)
4. Try to pan and zoom
5. Undo both

**Expected Result:**
- ✅ Small shape visible (might be hard to select)
- ✅ Large shape renders
- ✅ Zoom helps with small shapes
- ✅ Pan handles large shapes
- ✅ Undo works for both

**Verification Points:**
- [ ] Extreme sizes handled
- [ ] No rendering errors
- [ ] Pan/zoom helpful
- [ ] Undo correct
- [ ] No performance issues

---

## Scenario 6.10: Simultaneous Selection Edge Cases

**User Goal:** Understand selection behavior

**Steps:**
1. Draw 5 shapes
2. Click shape A → selected
3. Ctrl+Click shape B → A and B selected
4. Click empty space → all deselected
5. Drag selection box over 3 shapes → all 3 selected
6. Delete selected → all 3 removed
7. Ctrl+Z → all 3 restored

**Expected Result:**
- ✅ Single selection works
- ✅ Multi-selection works
- ✅ Selection clearing works
- ✅ Area selection works
- ✅ Bulk delete works
- ✅ Undo restores all

**Verification Points:**
- [ ] Selection logic correct
- [ ] Multi-selection visual clear
- [ ] Bulk operations work
- [ ] Undo handles bulk ops
- [ ] No orphaned selections

---

## Scenario 6.11: Undo Text Editing In Progress

**User Goal:** What happens if user presses Ctrl+Z while editing text?

**Steps:**
1. Draw shape
2. Double-click to edit text
3. Type "Hello"
4. While still in edit mode, press Ctrl+Z
5. Verify behavior:
   - Does it undo the shape? 
   - Does it undo individual characters?
   - Does it exit edit mode?

**Expected Result:**
- ✅ Clear behavior (ideally undo characters, not shape)
- ✅ User not confused
- ✅ Can recover text if needed
- ✅ Exit edit mode cleanly if undoing shape

**Verification Points:**
- [ ] Undo behavior clear
- [ ] Documented if non-obvious
- [ ] Consistent with user expectations
- [ ] No state corruption

---

## Scenario 6.12: Performance Under Stress

**User Goal:** Ensure app doesn't crash under heavy use

**Steps:**
1. Perform many rapid operations:
   - Draw 50 shapes quickly
   - Create 30 connectors
   - Add 20 brush annotations
   - Undo/redo rapidly
2. Monitor:
   - CPU usage
   - Memory usage
   - Frame rate
   - Responsiveness

**Expected Result:**
- ✅ No crashes
- ✅ CPU < 80%
- ✅ Memory < 1GB
- ✅ Frame rate > 30fps
- ✅ Remains responsive

**Verification Points:**
- [ ] Stress test passed
- [ ] No memory leaks
- [ ] Performance acceptable
- [ ] Graceful under load
- [ ] Clear degradation if needed

---

## Scenario 6.13: Undo/Redo with Browser Back Button

**User Goal:** Browser back button doesn't interfere with app

**Steps:**
1. Create shapes and operations
2. Try browser back button
3. Verify:
   - Either: Goes to previous page (if no history)
   - Or: Handled by app (if using history API)

**Expected Result:**
- ✅ Clear behavior
- ✅ User not confused
- ✅ App not broken
- ✅ Browser navigation works
- ✅ App undo/redo independent

**Verification Points:**
- [ ] Browser interaction clear
- [ ] No conflicts
- [ ] Navigation works
- [ ] App state preserved

---

## Scenario 6.14: Recovery from Error States

**User Goal:** If app encounters error, can recover gracefully

**Steps:**
1. Intentionally break something (if possible):
   - Draw shapes
   - Induce JavaScript error (console)
   - Try to undo
2. Verify app behavior:
   - Does it show error?
   - Can user continue?
   - Can they undo?

**Expected Result:**
- ✅ Error shown clearly (console if not critical)
- ✅ App continues to work
- ✅ Undo/redo still functional
- ✅ Data not lost
- ✅ No cascading errors

**Verification Points:**
- [ ] Error handling graceful
- [ ] App recoverable
- [ ] Data preserved
- [ ] Clear error messages
- [ ] Logging for debugging
