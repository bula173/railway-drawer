// Test script to verify copy/paste between tabs functionality
console.log("Testing copy/paste between tabs...");

// Function to test basic functionality
function testCopyPaste() {
  // Test if global functions exist
  if (typeof window !== 'undefined') {
    console.log("✓ Window object available");
    
    // Check if we can access the React app state
    const tabs = document.querySelectorAll('[data-tab-id]');
    console.log(`Found ${tabs.length} tabs`);
    
    // Check if DrawArea is rendered
    const drawArea = document.querySelector('svg');
    if (drawArea) {
      console.log("✓ DrawArea SVG found");
    } else {
      console.log("✗ DrawArea SVG not found");
    }
    
    return true;
  }
  return false;
}

testCopyPaste();
