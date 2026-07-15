# User Scenario: Connectors and Arrows

## Overview
This scenario covers drawing connectors between shapes to show relationships and flow.

## Scenario 4.1: Simple Connector Between Two Shapes

**User Goal:** Connect two shapes with a line to show relationship

**Steps:**
1. Draw Rectangle A at (100, 100, 150, 100)
2. Draw Rectangle B at (400, 100, 150, 100)
3. Select Rectangle A
4. Connection points appear (dots on edges)
5. Click on right connection point of Rectangle A
6. Drag to left connection point of Rectangle B
7. Release → Connector appears

**Expected Result:**
- ✅ Connection points visible when selected
- ✅ Curved line connects the two rectangles
- ✅ Connector has arrow at end (by default)
- ✅ Connector stays connected if shapes move
- ✅ Right-click connector → Style options

**Verification Points:**
- [ ] Connection points appear/disappear
- [ ] Connector renders smoothly
- [ ] Curved path looks natural
- [ ] Arrow visible
- [ ] Connection sticky (follows shape)

---

## Scenario 4.2: Change Connector Line Style

**User Goal:** Use different line styles for different relationships

**Steps:**
1. Create connector between two rectangles
2. Right-click connector → Connector Style panel opens (or select in properties)
3. In panel, see Line Style options: Solid, Dotted, Dashed
4. Click "Dotted"
5. Connector line becomes dotted
6. Click "Dashed"
7. Connector line becomes dashed
8. Click "Solid"
9. Connector line is solid again

**Expected Result:**
- ✅ Line style panel accessible
- ✅ Solid line is continuous
- ✅ Dotted line has dots
- ✅ Dashed line has dashes
- ✅ Change applies immediately
- ✅ Visual distinction clear

**Verification Points:**
- [ ] Line style buttons work
- [ ] Visual rendering correct
- [ ] Line style persists
- [ ] No rendering artifacts
- [ ] Change doesn't affect arrow

---

## Scenario 4.3: Change Connector Arrow Styles

**User Goal:** Show different relationship types with different arrows

**Steps:**
1. Create connector between Rectangle A → Rectangle B
2. Open connector style panel
3. For "Start Arrow": Select "Circle"
4. For "End Arrow": Select "Diamond"
5. Verify arrow styles change

**Expected Result:**
- ✅ Start arrow is a circle
- ✅ End arrow is a diamond
- ✅ Arrows scale with line width
- ✅ Arrows point in correct direction
- ✅ Options: None, Standard, Block, Classic, Circle, Diamond

**Verification Points:**
- [ ] All arrow types render
- [ ] Correct orientation
- [ ] Proper sizing
- [ ] No overlaps
- [ ] Visual clarity maintained

---

## Scenario 4.4: Change Connector Color and Width

**User Goal:** Highlight important connections or show different types

**Steps:**
1. Create connector
2. In style panel, change line width: 1px → 2px → 4px
3. Change color from black to red
4. Change opacity from 100% to 50%
5. Verify changes appear

**Expected Result:**
- ✅ 1px line is thin
- ✅ 2px line is medium
- ✅ 4px line is thick
- ✅ Color change visible
- ✅ Opacity makes it transparent
- ✅ Changes apply immediately

**Verification Points:**
- [ ] Line width slider works
- [ ] Visual thickness correct
- [ ] Color picker works
- [ ] Opacity affects rendering
- [ ] All changes persist

---

## Scenario 4.5: Label a Connector

**User Goal:** Add text to show what connection represents

**Steps:**
1. Create connector
2. Double-click connector (middle of line)
3. Text input appears
4. Type "depends on"
5. Click elsewhere
6. Label appears on connector

**Expected Result:**
- ✅ Double-click triggers text edit
- ✅ Text appears at midpoint of connector
- ✅ Text is readable
- ✅ Text doesn't obstruct line
- ✅ Text persists

**Verification Points:**
- [ ] Text entry works
- [ ] Label positioned well
- [ ] Font size readable
- [ ] Text background/styling clear
- [ ] Can edit label again

---

## Scenario 4.6: Delete Connector

**User Goal:** Remove a connection

**Steps:**
1. Create connector between two shapes
2. Click connector to select it
3. Press Delete key
4. Connector disappears
5. Both rectangles still exist

**Expected Result:**
- ✅ Connector is removed
- ✅ Shapes remain unchanged
- ✅ Can undo deletion
- ✅ No orphaned states

**Verification Points:**
- [ ] Delete removes connector
- [ ] Shapes unaffected
- [ ] Undo works
- [ ] No console errors

---

## Scenario 4.7: Connector Responds to Shape Movement

**User Goal:** Connections stay attached when shapes move

**Steps:**
1. Draw Rectangle A at (100, 100)
2. Draw Rectangle B at (400, 100)
3. Connect A → B
4. Select Rectangle A
5. Drag to (200, 200)
6. Verify connector endpoint moves with A
7. Drag Rectangle B to (600, 200)
8. Verify connector endpoint moves with B

**Expected Result:**
- ✅ Connector points stick to shapes
- ✅ Connector redraws with new path
- ✅ Arrow stays at correct angle
- ✅ Label (if any) follows connector
- ✅ Smooth animation on move

**Verification Points:**
- [ ] Connection sticky
- [ ] Path recalculates
- [ ] No lag
- [ ] Smooth animation
- [ ] Label follows

---

## Scenario 4.8: Connector Responds to Shape Deletion

**User Goal:** When a connected shape is deleted, connector should too

**Steps:**
1. Create two shapes: A and B
2. Connect A → B
3. Select shape A
4. Press Delete
5. Verify: Shape A is gone, Connector is gone, Shape B remains

**Expected Result:**
- ✅ Shape A deleted
- ✅ Connector automatically deleted
- ✅ Shape B unaffected
- ✅ Can undo to restore both

**Verification Points:**
- [ ] Orphaned connector cleanup
- [ ] Shapes preserved
- [ ] Cascade delete works
- [ ] Undo restores both

---

## Scenario 4.9: Undo Connector Creation

**User Goal:** User draws connector by mistake and undoes it

**Steps:**
1. Create connector between two rectangles
2. Press Ctrl+Z
3. Verify connector disappears
4. Shapes remain

**Expected Result:**
- ✅ Connector removed
- ✅ Both rectangles visible
- ✅ Redo can restore connector

**Verification Points:**
- [ ] Connector undo works
- [ ] Shapes unaffected
- [ ] Redo restores connector exactly
- [ ] Label (if any) restored

---

## Scenario 4.10: Multiple Connectors from Same Shape

**User Goal:** One shape can have multiple outgoing connections

**Steps:**
1. Create Rectangle A at (100, 100)
2. Create Rectangle B at (400, 100)
3. Create Rectangle C at (400, 300)
4. Create Rectangle D at (400, 500)
5. Connect A → B
6. Connect A → C
7. Connect A → D
8. All connectors visible and distinct

**Expected Result:**
- ✅ All 3 connectors drawn
- ✅ Each has own arrow and style
- ✅ No overlapping/confusion
- ✅ Can select any connector independently
- ✅ Each can be styled separately

**Verification Points:**
- [ ] Multiple connectors render
- [ ] Independent selection
- [ ] Independent styling
- [ ] No rendering issues
- [ ] Clear visual hierarchy
