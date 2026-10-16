# Browser Console Test Commands

Copy and paste these commands into your browser console (F12) to test the properties panel.

## Quick Status Check

```javascript
// Check if property-content element exists
const propContent = document.getElementById('property-content');
console.log('Property content element:', propContent ? '✓ Found' : '✗ Missing');
console.log('Current HTML:', propContent?.innerHTML.substring(0, 100));

// Check if window has graph instance
console.log('Window keys:', Object.keys(window).filter(k => k.includes('graph') || k.includes('editor')));

// Monitor for selection changes
console.log('Monitoring selection changes...');
const observer = setInterval(() => {
  const content = document.getElementById('property-content');
  if (content && content.innerHTML.includes('properties-panel')) {
    console.log('✓ Properties panel detected!');
    clearInterval(observer);
  }
}, 500);

setTimeout(() => clearInterval(observer), 5000);
```

## Test Selection Listener

```javascript
// Add listener for selection changes
document.addEventListener('selectionchange', () => {
  console.log('Selection changed!', window.getSelection?.());
});

console.log('Listeners attached. Now click a shape in the canvas.');
```

## Monitor Property Content Changes

```javascript
// Monitor changes to property-content
const propContent = document.getElementById('property-content');
const observer = new MutationObserver((mutations) => {
  console.log('Property content changed!', {
    length: propContent.innerHTML.length,
    hasPanel: propContent.innerHTML.includes('properties-panel'),
    hasPlaceholder: propContent.innerHTML.includes('Click element'),
    timestamp: new Date().toLocaleTimeString()
  });
});

observer.observe(propContent, {
  childList: true,
  subtree: true,
  characterData: true,
  characterDataOldValue: true
});

console.log('Monitoring property content. Now click shapes...');
```

## Check Graph Instance

```javascript
// Try to find graph in window
const findGraph = () => {
  for (let key in window) {
    if (key.includes('graph') || key.includes('editor')) {
      console.log(`Found: window.${key}`, window[key]);
    }
  }
};

findGraph();
```

## Test Shape Creation and Selection

```javascript
// Check if we can access graph from developer tools
if (window.__RUNTIME_DATA__) {
  console.log('Runtime data found:', window.__RUNTIME_DATA__);
}

// Look for any custom data attributes
const canvas = document.getElementById('editor-container');
console.log('Canvas attributes:', [...(canvas?.attributes || [])].map(a => `${a.name}=${a.value}`));
```

## Monitor All Click Events

```javascript
// Log all clicks in the editor area
document.getElementById('editor-container').addEventListener('click', (e) => {
  console.log('Click detected:', {
    target: e.target?.id || e.target?.className || 'unknown',
    timestamp: new Date().toLocaleTimeString(),
    html: document.getElementById('property-content')?.innerHTML.substring(0, 50)
  });
}, true);

console.log('Click monitoring enabled. Try clicking shapes...');
```

## Test Property Panel Content

```javascript
// Check current property panel content
const propContent = document.getElementById('property-content');
const html = propContent.innerHTML;

console.log('Property Panel Analysis:');
console.log('- Content length:', html.length);
console.log('- Has properties-panel class:', html.includes('properties-panel'));
console.log('- Has section-title:', html.includes('section-title'));
console.log('- Has property-input:', html.includes('property-input'));
console.log('- Has color-picker:', html.includes('color-picker'));
console.log('- Is placeholder:', html.includes('Click element'));
console.log('- Input count:', (html.match(/input/g) || []).length);
console.log('- Button count:', (html.match(/button/g) || []).length);
```

## Debug Selection Model

```javascript
// If graph is accessible via window
if (window.editor && window.editor.graph) {
  const graph = window.editor.graph;
  console.log('Graph found!');
  console.log('- Has getSelectionModel:', typeof graph.getSelectionModel === 'function');
  
  const selModel = graph.getSelectionModel();
  console.log('- Selection model:', selModel);
  console.log('- Current selection:', selModel.cells);
  
  // Try manual selection
  const parent = graph.getDefaultParent();
  if (parent && parent.children && parent.children.length > 0) {
    const firstShape = parent.children[0];
    console.log('- First shape:', firstShape);
    console.log('- Setting selection to first shape...');
    graph.setSelectionCell(firstShape);
    console.log('- After selection, property content:', 
      document.getElementById('property-content').innerHTML.substring(0, 100));
  }
} else {
  console.log('Graph not found in window.editor');
}
```

## Full Debug Report

```javascript
// Generate comprehensive debug report
const generateReport = () => {
  const report = {
    timestamp: new Date().toISOString(),
    propContent: {
      exists: !!document.getElementById('property-content'),
      visible: document.getElementById('property-content')?.offsetHeight > 0,
      contentLength: document.getElementById('property-content')?.innerHTML.length || 0,
      hasPanel: document.getElementById('property-content')?.innerHTML.includes('properties-panel') || false,
      hasPlaceholder: document.getElementById('property-content')?.innerHTML.includes('Click element') || false
    },
    graph: {
      accessible: !!(window.editor && window.editor.graph),
      hasSelectionModel: !!(window.editor?.graph?.getSelectionModel),
      selectedCells: window.editor?.graph?.getSelectionModel?.().cells?.length || 0
    },
    console: {
      logs: []
    }
  };
  
  console.table(report);
  return report;
};

generateReport();
```

## Step-by-Step Debug Test

```javascript
// Run this step by step
console.log('Step 1: Check property-content element');
const elem = document.getElementById('property-content');
console.log(elem ? '✓ Element found' : '✗ Element missing', elem);

console.log('\nStep 2: Check initial content');
console.log('Content:', elem?.innerHTML.substring(0, 50));

console.log('\nStep 3: Check if editor is accessible');
console.log('Window.editor:', window.editor ? '✓' : '✗');

console.log('\nStep 4: Check graph instance');
if (window.editor?.graph) {
  console.log('✓ Graph found');
  const sm = window.editor.graph.getSelectionModel();
  console.log('Selection model exists:', !!sm);
  console.log('Current selection:', sm.cells?.length || 0, 'cells');
} else {
  console.log('✗ Graph not found');
}

console.log('\nStep 5: Check for debug messages in console');
console.log('Look for [DEBUG] messages above');

console.log('\nStep 6: Try clicking a shape now and watch for updates');
```

---

## How to Use

1. Open browser DevTools (F12)
2. Go to Console tab
3. Copy one of the commands above
4. Paste into console
5. Press Enter
6. Follow instructions or watch output
7. Try clicking shapes and observe results

## Expected Debug Output When Clicking Shape

When you click a shape, you should see:

```javascript
[DEBUG] Selection changed: {
  cellCount: 1,
  cell: {...},
  cellValue: "Shape Name",
  timestamp: "14:30:45"
}
[DEBUG] Properties panel updated
[DEBUG PropertiesPanel] updatePanel called with cell: {...}
[DEBUG PropertiesPanel] Cell type - isVertex: true isEdge: false
[DEBUG PropertiesPanel] Rendering vertex properties
[DEBUG PropertiesPanel] Panel updated, content length: 5234
```

If you don't see these messages, the selection listener isn't firing.

---

**Tips**:
- Refresh page if console commands don't work
- Check for JavaScript errors in console (red X icon)
- Make sure to add a shape to canvas before testing
- Debug messages only appear when clicking shapes
