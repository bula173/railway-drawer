# User Scenario: Brush Drawing

## Overview
This scenario covers the brush tool functionality for freehand drawing annotations.

## Scenario 2.1: Draw a Simple Freehand Stroke

**User Goal:** Quickly annotate or sketch on the canvas

**Steps:**
1. Open canvas with some shapes already drawn
2. Press B or click brush tool in toolbar
3. Left panel shows brush options
4. Default brush is "Freehand"
5. Click and drag on canvas to draw a curved line
   - Start: (150, 150)
   - End: (350, 250)
   - Path: curved, ~200px long
6. Release mouse
7. Verify stroke is saved

**Expected Result:**
- ✅ Brush panel appears on left side
- ✅ Cursor changes to crosshair
- ✅ Freehand stroke appears as user drags
- ✅ Stroke is smooth and follows mouse path
- ✅ Stroke is saved after mouse up
- ✅ Can draw multiple strokes without re-selecting brush

**Verification Points:**
- [ ] Brush panel accessible
- [ ] Crosshair cursor visible
- [ ] Real-time stroke preview while drawing
- [ ] Stroke smoothness acceptable
- [ ] Stroke saved to canvas
- [ ] No lag or stuttering

---

## Scenario 2.2: Change Brush Type

**User Goal:** Use different brush styles for different annotation needs

**Steps:**
1. Brush tool is active
2. In left panel, see 5 brush type buttons: Freehand, Pen, Marker, Pencil, Annotation
3. Click "Pen"
4. Draw a stroke (precise, thin)
5. Click "Marker"
6. Draw a stroke (thick, semi-transparent)
7. Click "Pencil"
8. Draw a stroke (sketchy texture)
9. Verify all three strokes look different

**Expected Result:**
- ✅ Pen stroke is precise and thin (1.5px)
- ✅ Marker stroke is thick and semi-transparent (8px, 50% opacity)
- ✅ Pencil stroke has sketchy texture
- ✅ All strokes remain on canvas
- ✅ Visual distinction is clear

**Verification Points:**
- [ ] Brush type buttons work
- [ ] Each brush has correct preset settings
- [ ] Visual differences between brushes clear
- [ ] All strokes persist
- [ ] No rendering issues

---

## Scenario 2.3: Adjust Brush Size

**User Goal:** Make thicker or thinner strokes

**Steps:**
1. Brush tool active, "Freehand" selected
2. In left panel, adjust size slider from 2px to 5px
3. Draw a stroke (5px)
4. Adjust size to 10px
5. Draw another stroke (10px)
6. Adjust size to 1px
7. Draw a thin stroke (1px)

**Expected Result:**
- ✅ Size slider responds to input
- ✅ Size value displays correctly
- ✅ Strokes have correct visual thickness
- ✅ Size change affects next stroke, not previous ones
- ✅ Range is 0.5px to 20px

**Verification Points:**
- [ ] Slider works smoothly
- [ ] Value updates in real-time
- [ ] Stroke thickness matches selected size
- [ ] Size limits enforced
- [ ] UI shows current size value

---

## Scenario 2.4: Change Brush Color

**User Goal:** Draw with different colors for visual distinction

**Steps:**
1. Brush tool active
2. Click color picker in left panel
3. Select red (#FF0000)
4. Draw a red stroke
5. Click color picker again
6. Select blue (#0000FF)
7. Draw a blue stroke
8. Use hex input to enter custom color #00FF00
9. Draw a green stroke

**Expected Result:**
- ✅ Color picker opens
- ✅ Red stroke is clearly red
- ✅ Blue stroke is clearly blue
- ✅ Green stroke is clearly green
- ✅ Colors are vibrant and correct
- ✅ All strokes remain on canvas

**Verification Points:**
- [ ] Color picker accessible
- [ ] Color changes apply to new strokes
- [ ] Hex input works
- [ ] Colors accurate
- [ ] No color bleeding/blending issues

---

## Scenario 2.5: Adjust Stroke Opacity

**User Goal:** Create semi-transparent annotations for layering

**Steps:**
1. Brush tool active
2. Adjust opacity slider from 100% to 50%
3. Draw a stroke at 50% opacity
4. Draw a shape through it (should be visible)
5. Change opacity to 25%
6. Draw another stroke (more transparent)
7. Change opacity back to 100%

**Expected Result:**
- ✅ Opacity slider works (0-100%)
- ✅ 50% opacity stroke is semi-transparent
- ✅ 25% opacity stroke is very faint
- ✅ Shapes visible through transparent strokes
- ✅ 100% opacity stroke is solid

**Verification Points:**
- [ ] Opacity slider responsive
- [ ] Visual transparency correct
- [ ] Opacity value displays
- [ ] Semi-transparent strokes layer correctly
- [ ] No visual artifacts

---

## Scenario 2.6: Use Smoothing and Pressure

**User Goal:** Control stroke smoothness and simulate pressure sensitivity

**Steps:**
1. Brush tool active, Freehand selected
2. Check "Pressure Sensitivity" checkbox
3. Draw a stroke (variable width if device supports pressure)
4. Uncheck pressure
5. Adjust smoothing slider from 0% to 100%
6. Draw stroke at 0% smoothing (jagged)
7. Draw stroke at 50% smoothing (balanced)
8. Draw stroke at 100% smoothing (very smooth)

**Expected Result:**
- ✅ Pressure checkbox toggles
- ✅ Smoothing slider works (0-100%)
- ✅ 0% smoothing shows jagged edges
- ✅ 50% smoothing is balanced
- ✅ 100% smoothing is very smooth
- ✅ Smoothing visually different between levels

**Verification Points:**
- [ ] Checkbox functional
- [ ] Smoothing slider responsive
- [ ] Visual difference between smoothing levels
- [ ] Performance acceptable at 100% smoothing
- [ ] No stroke distortion

---

## Scenario 2.7: Annotation Mode (Temporary Strokes)

**User Goal:** Draw temporary annotations that won't be saved

**Steps:**
1. Brush tool active
2. Select "Annotation" brush type
3. Notice yellow warning: "Annotation strokes are temporary and won't be saved"
4. Draw annotation strokes
5. Switch to another tool
6. Switch back to brush tool
7. Verify annotation strokes are gone

**Expected Result:**
- ✅ Warning message appears
- ✅ Annotation strokes are visually different (or marked)
- ✅ Strokes can be drawn normally
- ✅ Strokes disappear when tool changes
- ✅ User understands they won't be saved

**Verification Points:**
- [ ] Warning message clear
- [ ] Annotation strokes temporary
- [ ] Strokes cleared on tool change
- [ ] Visual distinction from saved strokes
- [ ] User not confused about persistence
