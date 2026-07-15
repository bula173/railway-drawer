# User Scenario: Basic Drawing

## Overview
This scenario covers the most basic use case - a user opening the app and drawing simple shapes.

## Scenario 1.1: Draw a Single Rectangle

**User Goal:** Create a simple rectangular shape on the canvas

**Steps:**
1. Open http://localhost:3000
2. Default tool is "Select" - user doesn't need to select anything
3. Click on toolbox → Select "Rectangle" tool
4. Click and drag on canvas to create a rectangle
   - Start position: (100, 100)
   - End position: (300, 200)

**Expected Result:**
- ✅ Blue rectangle appears on canvas
- ✅ Rectangle has default fill (white) and stroke (black)
- ✅ Rectangle has resize handles on corners
- ✅ Rectangle can be selected/deselected

**Verification Points:**
- [ ] Rectangle dimensions correct
- [ ] Position correct
- [ ] Visual appearance matches design system
- [ ] No console errors

---

## Scenario 1.2: Draw Multiple Shapes

**User Goal:** Create a diagram with multiple connected shapes

**Steps:**
1. Start with empty canvas
2. Draw Rectangle 1 at (100, 100, 150, 100)
3. Draw Circle 1 at (400, 100, 80)
4. Draw Hexagon 1 at (700, 100, 60)
5. Click on canvas to deselect

**Expected Result:**
- ✅ All three shapes appear on canvas
- ✅ Each shape has selection handles when selected
- ✅ Shapes don't interfere with each other
- ✅ Z-order is maintained

**Verification Points:**
- [ ] All shapes visible
- [ ] Proper spacing
- [ ] No overlapping issues
- [ ] Selection works independently

---

## Scenario 1.3: Draw with Different Colors

**User Goal:** Create colored shapes for different purposes

**Steps:**
1. Select Rectangle tool
2. Draw a rectangle at (100, 100, 150, 100)
3. Right-click → Select color → Choose red (#FF0000)
4. Draw another rectangle at (300, 100, 150, 100)
5. Right-click → Select color → Choose blue (#0000FF)
6. Draw a third rectangle at (500, 100, 150, 100)

**Expected Result:**
- ✅ First rectangle is red
- ✅ Second rectangle is blue
- ✅ Third rectangle uses default color (or previously selected)
- ✅ Colors are clearly distinguishable

**Verification Points:**
- [ ] Color picker works
- [ ] Colors applied correctly
- [ ] Color persists across operations
- [ ] Can change fill and stroke colors independently

---

## Scenario 1.4: Draw with Different Sizes

**User Goal:** Create shapes with varying stroke widths

**Steps:**
1. Draw Rectangle 1 with default stroke (2px)
2. Select Rectangle 1 → Change stroke to 5px
3. Draw Rectangle 2 → Check if it uses new stroke width
4. Change stroke back to 2px
5. Draw Rectangle 3

**Expected Result:**
- ✅ Rectangle 1 has 2px stroke
- ✅ Rectangle 2 has 5px stroke (or new default if not persistent)
- ✅ Rectangle 3 has 2px stroke
- ✅ Stroke width visually distinct

**Verification Points:**
- [ ] Stroke width changes applied
- [ ] Visual difference clear
- [ ] Stroke width doesn't affect shape dimensions
- [ ] Changes are consistent

---

## Scenario 1.5: Label a Shape

**User Goal:** Add descriptive text to a shape

**Steps:**
1. Draw a rectangle at (100, 100, 150, 100)
2. Double-click the rectangle
3. Type "Process A"
4. Click elsewhere or press Enter
5. Verify text appears inside rectangle

**Expected Result:**
- ✅ Text entry field appears on double-click
- ✅ Text can be typed
- ✅ Text is centered in shape
- ✅ Text size is readable
- ✅ Text persists after deselection

**Verification Points:**
- [ ] Double-click triggers text edit mode
- [ ] Text appears in shape
- [ ] Text is properly positioned
- [ ] No console errors
- [ ] Text saved when editing ends
