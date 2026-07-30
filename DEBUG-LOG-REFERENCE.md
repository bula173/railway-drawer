# Debug Log Reference Guide

## Console Output Flow

When you click a shape, you should see this sequence of debug messages:

### 1. Click Detection
```
[DEBUG cellClicked] Cell clicked: {
  cell: "Rectangle",
  tool: "select",
  timestamp: "14:30:45"
}
```
✅ **Means**: The click event was detected on the shape
❌ **If Missing**: Click handler not working, check if shape is clickable

---

### 2. Selection Set
```
[DEBUG cellClicked] Selected cell: Rectangle
```
✅ **Means**: `graph.setSelectionCell()` was called successfully
❌ **If Missing**: Selection not being set, check if shape is vertex

---

### 3. Selection Model Change
```
[DEBUG] Selection changed: {
  cellCount: 1,
  cell: {...},
  cellValue: "Rectangle",
  timestamp: "14:30:45"
}
```
✅ **Means**: Selection model detected the change
❌ **If Missing**: Selection model listener not firing

---

### 4. Status Bar Update
```
[DEBUG] Status bar updated with selection count: 1
```
✅ **Means**: Status bar received the selection event
❌ **If Missing**: updateStatusBar() not working

---

### 5. Properties Panel Call
```
[DEBUG] Calling propertiesPanel.updatePanel()
```
✅ **Means**: About to call the properties panel update method
❌ **If Missing**: propertiesPanel variable is null or code didn't reach this point

---

### 6. Panel Method Execution
```
[DEBUG PropertiesPanel] updatePanel called
[DEBUG PropertiesPanel] cell: {...}
[DEBUG PropertiesPanel] contentElement: <div id="property-content" class="format-content">...</div>
```
✅ **Means**: updatePanel() method is executing with correct parameters
❌ **If Missing**: Method not called or threw error before logging

---

### 7. Cell Type Detection
```
[DEBUG PropertiesPanel] Cell type - isVertex: true isEdge: false
```
✅ **Means**: Cell type detected correctly
❌ **If Missing**: Cell methods not available

---

### 8. Rendering Start
```
[DEBUG PropertiesPanel] Rendering vertex properties
```
✅ **Means**: Rendering the appropriate panel type
❌ **If Missing**: Cell type check failed

---

### 9. Panel Display Update
```
[DEBUG PropertiesPanel] Panel display set to block, content length: 5234
```
✅ **Means**: Panel content updated and display set
❌ **If Missing**: Content element or style update failed

---

### 10. Completion
```
[DEBUG] Properties panel updated successfully
```
✅ **Means**: Everything succeeded
❌ **If Missing**: An error occurred

---

## Error Messages & Solutions

### [ERROR] Properties panel is null/undefined!
```
[ERROR] Properties panel is null/undefined!
```
**Cause**: propertiesPanel variable not initialized
**Solution**: Check if PropertiesPanelManager was instantiated before selection listener

---

### [ERROR] Properties panel update failed: TypeError
```
[ERROR] Properties panel update failed: TypeError: Cannot read property 'innerHTML' of null
```
**Cause**: Content element not found
**Solution**: Check if `property-content` div exists in HTML, or element was removed

---

### [ERROR PropertiesPanel] Content element not found!
```
[ERROR PropertiesPanel] Content element not found! ID: property-content
[ERROR PropertiesPanel] Element lookup result: null
```
**Cause**: getElementById('property-content') returned null
**Solution**: 
1. Check HTML - is the div present?
2. Is the div created dynamically? If so, timing issue
3. Is another script removing the element?

---

### [ERROR PropertiesPanel] updatePanel threw error
```
[ERROR PropertiesPanel] updatePanel threw error: [Error message]
[ERROR PropertiesPanel] Stack: [Stack trace]
```
**Cause**: Unhandled exception in updatePanel()
**Solution**: Share the full error message and stack trace

---

## Troubleshooting by Missing Message

### Missing: [DEBUG cellClicked]
→ Click event not firing
- ✓ Check if shape is selectable
- ✓ Check if click handler is attached
- ✓ Try different shapes

### Missing: [DEBUG] Selection changed
→ Selection listener not firing
- ✓ Check if setSelectionCell() was called
- ✓ Verify selection model listener is attached
- ✓ Check browser console for JavaScript errors

### Missing: [DEBUG] Calling propertiesPanel.updatePanel()
→ Code not reaching that line
- ✓ Check if propertiesPanel is null (see error message)
- ✓ Check if selection listener code executed

### Missing: [DEBUG PropertiesPanel] updatePanel called
→ Method not being invoked OR throwing error before first log
- ✓ Check previous message for errors
- ✓ Check if propertiesPanel instance is valid

### Missing: [DEBUG PropertiesPanel] contentElement
→ Content element not found
- ✓ Verify element exists in DOM
- ✓ Check HTML structure
- ✓ Look for error message about element not found

### Missing: Panel is not visible but logs show success
→ CSS/display issue
- ✓ Check if panel is hidden by CSS (display: none, visibility: hidden)
- ✓ Check z-index - is panel behind something?
- ✓ Check if parent is hidden

---

## Quick Diagnostic Commands

### Check Element Exists
```javascript
const elem = document.getElementById('property-content');
console.log('Element exists:', !!elem);
console.log('Element visible:', elem?.offsetHeight > 0);
console.log('Element display:', window.getComputedStyle(elem).display);
```

### Check PropertiesPanel Instance
```javascript
console.log('Type:', typeof window.propertiesPanel);
console.log('Instance:', window.propertiesPanel);
console.log('Has updatePanel:', typeof window.propertiesPanel?.updatePanel);
```

### Manually Trigger Update
```javascript
const cell = window.editor.graph.getDefaultParent().children[0];
window.propertiesPanel?.updatePanel(cell);
```

### Check Selection
```javascript
const selModel = window.editor.graph.getSelectionModel();
console.log('Selection:', selModel.cells);
console.log('First cell:', selModel.cells?.[0]);
```

---

## Test Checklist

When debugging, verify in order:

- [ ] Shape is clickable (cursor changes to move)
- [ ] cellClicked event fires (see `[DEBUG cellClicked]`)
- [ ] Selection listener fires (see `[DEBUG] Selection changed`)
- [ ] Status bar shows selection count
- [ ] propertiesPanel.updatePanel() is called
- [ ] Content element exists and is accessible
- [ ] Cell type is detected correctly
- [ ] Rendering method is called
- [ ] Panel display is set to block
- [ ] Panel content is visible on screen

---

## Report Format

When sharing debugging information, include:

1. **What you did**: "Clicked a rectangle shape"
2. **What you expected**: "Properties panel should show"
3. **What happened**: "Placeholder text remained"
4. **Console output**: Paste all [DEBUG] and [ERROR] messages
5. **Missing messages**: Which debug messages didn't appear

Example:
```
I clicked a rectangle but properties didn't show.

Console shows:
✓ [DEBUG cellClicked] Cell clicked
✓ [DEBUG] Selection changed
✗ [DEBUG] Calling propertiesPanel.updatePanel() - MISSING
✓ [DEBUG] Status bar updated

The message about calling updatePanel is missing!
```

---

**Last Updated**: 2026-07-20  
**Version**: Enhanced Logging v2
