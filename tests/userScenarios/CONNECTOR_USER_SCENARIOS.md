# Connector Feature - User Scenarios

## Scenario 1: Creating a Simple Connector Between Two Shapes

**Setup:**
- User has drawn two rectangles on the canvas
- Shape A (left), Shape B (right)

**Steps:**
1. User hovers over Shape A → connection points appear (light blue circles on shape border)
2. User positions mouse over one of the connection points (e.g., right edge of Shape A)
3. User clicks and holds the mouse button on the connection point
4. **DRAG LINE APPEARS**: A dashed blue preview line starts from that exact point on Shape A's border
5. User drags mouse toward Shape B
6. As preview line gets close to Shape B (within ~50px):
   - Shape B's border turns GREEN to indicate it's a valid drop target
   - Preview line continues to follow cursor
7. User releases mouse button while hovering over Shape B
8. **CONNECTOR CREATED**: Solid black connector line appears from Shape A's border to Shape B's border
9. Both shapes return to normal state (green border disappears)

---

## Scenario 2: Connector Starts Exactly at Shape Border

**Visual Requirement:**
- Connection point circles are rendered ON the shape's edge (border)
- Preview line originates from this exact point on the border
- Connector line connects border-to-border (not center-to-center)

**Connection Points Position:**
- Top edge: mid-point, left 1/4, right 1/4
- Bottom edge: mid-point, left 1/4, right 1/4
- Left edge: mid-point, top 1/4, bottom 1/4
- Right edge: mid-point, top 1/4, bottom 1/4

---

## Scenario 3: Visual Feedback During Drag

**While Dragging (Before Release):**
- Preview line color: Dashed blue (#0066ff)
- Source shape: No highlight change
- Target shape (when close): **GREEN border (2px, solid)**
- Mouse cursor: 'grab' or 'crosshair'

**Conditions for Target Highlight:**
- Distance from preview line endpoint to any shape < 50px
- Shape is not the source shape
- Show only the CLOSEST shape in green

---

## Scenario 4: Failed Connection (Release in Empty Space)

**Steps:**
1. User clicks connection point and drags
2. Preview line follows cursor into empty space
3. No shape gets highlighted (no green border)
4. User releases mouse button
5. **RESULT**: Preview line disappears, no connector created
6. User can try again

---

## Scenario 5: Undo/Redo Connector Creation

**Steps:**
1. User creates a connector between Shape A and B
2. User presses Ctrl+Z (Undo)
3. **RESULT**: Connector disappears, shapes remain
4. User presses Ctrl+Y (Redo)
5. **RESULT**: Connector reappears in same position

---

## Scenario 6: Dragging Shape With Connector

**Steps:**
1. Connector exists between Shape A and Shape B
2. User selects and drags Shape A to a new position
3. **RESULT**: Connector line updates in real-time, stays attached to Shape A's border
4. When Shape A stops moving, connector is saved with new positions

---

## Visual Requirements Summary

### Connection Points
- Position: On shape border (not inside shape)
- Color when visible: Light blue (#4a90ff) or gray
- Size: 6px radius circle
- Hover cursor: 'grab'
- Visibility: Show on shape hover OR when shape is selected

### Preview Line (While Dragging)
- Color: Dashed blue (#0066ff, opacity 60%)
- Style: `stroke-dasharray="5,5"`
- Width: 2px
- Originates from: Exact connection point on source shape border
- Ends at: Current mouse position

### Target Shape Highlight (When Close)
- Border color: GREEN (#00cc00 or #22ff22)
- Border width: 2px
- Border style: Solid (not dashed)
- Trigger distance: ~50px from shape edge
- Shows only when: Preview line is within range of shape

### Final Connector Line
- Color: Black (#000000)
- Style: Solid line
- Width: 2px
- Arrow: Arrow head at end (pointing away from source)
- Start point: Connection point on Shape A border
- End point: Connection point on Shape B border

---

## Implementation Steps (Detailed)

### Step 1: Fix Connection Point Positioning
- Ensure connection points render ON shape border
- Calculate correct X,Y coordinates based on shape bounds
- Test with rotated shapes

### Step 2: Implement Drag-to-Connect
- When connection point clicked: start drag mode
- Track mouse position with document-level mousemove listener
- Update preview line coordinates in real-time
- Calculate distance to all other shapes

### Step 3: Add Target Detection
- Get preview line end position (mouse position)
- For each shape: calculate distance from endpoint to shape bounds
- If distance < 50px: mark as potential target (green border)
- Only show ONE green border (closest shape)

### Step 4: Implement Release Logic
- On mouseup: check if valid target shape is highlighted
- If YES: create connector from source to target
- If NO: cancel (preview line disappears)
- Clean up: remove preview line, remove green borders

### Step 5: Add History Support
- Connector creation: add to history
- Shape movement: update connector positions and save to history
- Undo/Redo: restore connector list

### Step 6: Test Scenarios
- Test 1: Simple connector creation
- Test 2: Failed drops (release in empty space)
- Test 3: Moving shapes with connectors
- Test 4: Undo/Redo connectors
- Test 5: Multiple connectors between same shapes
- Test 6: Connector from different connection points

---

## Current Issues to Fix

1. ❌ Connection points not starting on shape border
2. ❌ No green highlight when dragging near shapes
3. ❌ Connector not updating when shapes move
4. ❌ Need to track target shape during drag

---

## Success Criteria

✅ User can click connection point on shape border  
✅ Preview line originates from exact border point  
✅ Preview line follows mouse cursor  
✅ Target shape highlights green when preview line is close  
✅ Releasing over target shape creates connector  
✅ Releasing in empty space cancels operation  
✅ Connector updates when shapes move  
✅ Undo/Redo works with connectors  
✅ No errors in console  
