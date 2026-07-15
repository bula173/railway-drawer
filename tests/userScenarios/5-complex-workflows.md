# User Scenario: Complex Workflows

## Overview
This scenario covers realistic, complex workflows where users combine multiple features.

## Scenario 5.1: Create a Simple Flowchart

**User Goal:** Create a flowchart showing a process with multiple steps

**Steps:**
1. **Phase 1: Create shapes**
   - Draw Rectangle "Start" at (200, 50, 100, 60)
   - Draw Rectangle "Process A" at (200, 150, 100, 60)
   - Draw Rectangle "Process B" at (200, 250, 100, 60)
   - Draw Rectangle "End" at (200, 350, 100, 60)

2. **Phase 2: Add labels**
   - Double-click each shape and add its label
   - Adjust colors if needed (optional)

3. **Phase 3: Connect with arrows**
   - Connect Start → Process A
   - Connect Process A → Process B
   - Connect Process B → End

4. **Phase 4: Annotate**
   - Press B to activate brush
   - Add note: "2 hours" near Process A
   - Add note: "1 hour" near Process B

5. **Phase 5: Fine-tune**
   - Select Process A, drag to slightly different position
   - Verify all connectors adjust
   - Check annotations still visible

**Expected Result:**
- ✅ All shapes visible and labeled
- ✅ Connectors link shapes correctly
- ✅ Annotations visible
- ✅ Connectors follow shapes when moved
- ✅ Professional appearance

**Verification Points:**
- [ ] Shape positioning correct
- [ ] Labels clear and readable
- [ ] Connectors smooth and properly angled
- [ ] Annotations visible and readable
- [ ] Overall layout clean
- [ ] No overlapping elements

---

## Scenario 5.2: Create a Complex Diagram with Mixed Operations

**User Goal:** Create a detailed technical diagram with shapes, connectors, and annotations

**Steps:**
1. **Create base shapes**
   - Rectangle "Database" at (100, 100)
   - Circle "Server" at (400, 100)
   - Rectangle "Client" at (700, 100)

2. **Add connectors with labels**
   - Connect Database ↔ Server, label "Query"
   - Connect Server ↔ Client, label "Request/Response"

3. **Highlight important part**
   - Brush tool: Draw red circle around "Server"

4. **Add notes**
   - Brush tool: Write "Critical" near the red circle

5. **Export/Save**
   - Save file (if supported)

**Expected Result:**
- ✅ All elements properly positioned
- ✅ Connectors labeled and styled
- ✅ Annotations/highlights clear
- ✅ Diagram is professional looking
- ✅ Can be saved and reopened

**Verification Points:**
- [ ] All elements visible
- [ ] Connectors with labels
- [ ] Brush annotations visible
- [ ] Color coding clear
- [ ] Layout balanced
- [ ] No rendering issues

---

## Scenario 5.3: Edit Existing Diagram

**User Goal:** Modify an existing diagram after reviewing it

**Steps:**
1. Start with diagram from Scenario 5.1
2. **Changes:**
   - Change "Process A" label to "Process A (Updated)"
   - Change Process A color to light blue
   - Change connector style to dotted
   - Move "Process B" to the right
   - Add new Process C in parallel
   - Add connector from Process A → Process C

3. **Undo problematic changes**
   - Realize Process C shouldn't exist
   - Undo several times until Process C is gone
   - Undo the dotted line change back to solid

**Expected Result:**
- ✅ Label changes apply
- ✅ Color changes visible
- ✅ Connectors update style
- ✅ Shapes move smoothly
- ✅ New connector added
- ✅ Undo history works correctly
- ✅ Can navigate back to specific states

**Verification Points:**
- [ ] All edits apply correctly
- [ ] Visual changes clear
- [ ] Connectors adjust to moved shapes
- [ ] Undo history accurate
- [ ] No lost data during undo
- [ ] Performance acceptable

---

## Scenario 5.4: Undo/Redo Complex Sequence

**User Goal:** Navigate through complex history of many different operations

**Steps:**
1. **Build up complex diagram:**
   - Draw Rectangle A
   - Draw Circle B
   - Connect A → B
   - Draw brush annotation
   - Edit Rectangle A label
   - Change Rectangle A color
   - Draw brush annotation 2
   - Delete brush annotation 1 (if supported)
   - Change connector style
   - Draw Ellipse C
   - Connect B → C

2. **Navigate history:**
   - Current state: 10 operations in history
   - Undo 5 times
   - Redo 3 times
   - Undo 2 times
   - Redo 5 times (to end of history)

3. **Verify:**
   - State is correct at each step
   - No elements duplicated/lost
   - Properties preserved
   - Connectors update correctly

**Expected Result:**
- ✅ Each operation is independent
- ✅ Undo/redo navigates correctly
- ✅ No data loss
- ✅ State at each step is correct
- ✅ Properties preserved
- ✅ Performance acceptable
- ✅ No visual glitches

**Verification Points:**
- [ ] Linear history progression
- [ ] No state corruption
- [ ] All operations undoable
- [ ] Redo restores exact state
- [ ] Properties intact
- [ ] Connectors correct
- [ ] Performance smooth

---

## Scenario 5.5: Large Diagram with Many Elements

**User Goal:** Ensure app handles reasonably large diagrams

**Steps:**
1. Create 20+ shapes arranged in grid
2. Create 15+ connectors between them
3. Add 5+ brush annotations
4. Add 10+ labels
5. Test:
   - Undo/redo with large history
   - Pan/zoom across diagram
   - Performance with many elements

**Expected Result:**
- ✅ All elements render correctly
- ✅ No missing elements
- ✅ Undo/redo works with many items
- ✅ Smooth panning and zooming
- ✅ Responsive to user input
- ✅ No memory issues
- ✅ No significant lag

**Verification Points:**
- [ ] All 40+ elements visible
- [ ] No rendering lag
- [ ] Undo/redo fast
- [ ] Pan/zoom smooth
- [ ] Memory usage reasonable
- [ ] App remains responsive
- [ ] No crashes or errors

---

## Scenario 5.6: Copy/Paste Large Sections

**User Goal:** Reuse diagram sections

**Steps:**
1. Create diagram section with 3 shapes + connectors
2. Select all 3 shapes (area select or Ctrl+click)
3. Copy (Ctrl+C)
4. Paste (Ctrl+V) at new location
5. Verify copies are correct
6. Adjust copied section slightly
7. Undo to remove copy

**Expected Result:**
- ✅ All 3 shapes copied
- ✅ Connectors between copies maintained
- ✅ Duplicates appear at offset position
- ✅ Can position independently
- ✅ Can modify copies without affecting original
- ✅ Undo removes entire copy

**Verification Points:**
- [ ] Copy includes all selected
- [ ] Connectors preserved
- [ ] Offset position reasonable
- [ ] Independent modification works
- [ ] Undo complete removal
- [ ] History handles well

---

## Scenario 5.7: Color-Code Different Sections

**User Goal:** Use colors to organize diagram into logical sections

**Steps:**
1. Create diagram with multiple sections
2. **Section A (red):**
   - 3 rectangles with red fill
   - Red connectors
3. **Section B (blue):**
   - 3 rectangles with blue fill
   - Blue connectors
4. **Section A ↔ B (purple):**
   - Cross-section connectors in purple

5. **Optional: Adjust**
   - Change one red section to orange
   - Change one blue section to cyan

**Expected Result:**
- ✅ Color coding clear and consistent
- ✅ Different sections visually distinct
- ✅ Cross-section connections visible
- ✅ Professional appearance
- ✅ Easy to understand structure

**Verification Points:**
- [ ] All colors applied correctly
- [ ] Color picker works reliably
- [ ] Colors are vibrant and accurate
- [ ] Good contrast for readability
- [ ] Professional appearance

---

## Scenario 5.8: Diagram Review and Feedback

**User Goal:** Review diagram and make corrections based on feedback

**Steps:**
1. Have completed diagram
2. **Review and corrections:**
   - Notice shape is mislabeled → Fix label
   - Find extra connector → Delete it
   - Realize Process A needs substeps → Add new shapes
   - Add annotation "PENDING APPROVAL" via brush
   - Adjust layout to fit better on canvas

3. **Undo if unsure:**
   - "Did I delete the right connector?" → Undo
   - "New layout looks worse" → Undo multiple times

**Expected Result:**
- ✅ All corrections apply
- ✅ Diagram improves
- ✅ Can undo mistakes
- ✅ Final diagram is polished
- ✅ Ready for sharing/export

**Verification Points:**
- [ ] Edits work smoothly
- [ ] Undo helpful for recovery
- [ ] Final result professional
- [ ] No lost work
- [ ] Performance maintained

---

## Scenario 5.9: Keyboard Shortcuts Workflow

**User Goal:** Use keyboard shortcuts for efficiency

**Steps:**
1. Draw shape
2. Press Ctrl+Z → Undo
3. Press Ctrl+Y → Redo
4. Draw shape
5. Press Ctrl+C → Copy
6. Press Ctrl+V → Paste
7. Press B → Activate brush
8. Draw stroke
9. Press Esc → Exit brush
10. Press Delete → Delete selected
11. Press Ctrl+A → Select all

**Expected Result:**
- ✅ All shortcuts work
- ✅ No need for menu navigation
- ✅ Faster workflow
- ✅ Familiar shortcuts (standard apps)

**Verification Points:**
- [ ] All shortcuts responsive
- [ ] Correct actions executed
- [ ] No conflicts between shortcuts
- [ ] Help/docs mention them

---

## Scenario 5.10: Collaborative Review (If Applicable)

**User Goal:** Share diagram for feedback

**Steps:**
1. Create diagram
2. Save/Export
3. Share with team
4. Incorporate feedback
5. Version control (if supported)

**Expected Result:**
- ✅ Can save diagram
- ✅ Can load saved diagram
- ✅ Diagram integrity maintained
- ✅ All elements preserved
- ✅ Can track changes

**Verification Points:**
- [ ] Save/load works
- [ ] Data integrity
- [ ] All elements present after reload
- [ ] Properties preserved
- [ ] History (if saved) restored
