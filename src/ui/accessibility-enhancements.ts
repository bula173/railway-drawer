/**
 * @file accessibility-enhancements.ts
 * @brief Apply accessibility enhancements throughout the application
 * @details WCAG 2.1 AA compliance improvements
 */

import { setAriaLabel, announce, addFocusVisible } from './accessibility';

/**
 * Initialize all accessibility enhancements
 * Call this during application startup
 */
export function initializeAccessibility(): void {
  // Add focus-visible styling
  addFocusVisible();

  // Enhance toolbar buttons with ARIA labels
  enhanceToolbarAccessibility();

  // Enhance menu items with ARIA labels
  enhanceMenuAccessibility();

  // Enhance form inputs
  enhanceFormAccessibility();

  // Enhance panels and containers
  enhancePanelAccessibility();

  console.log('[Accessibility] WCAG 2.1 AA enhancements applied');
}

/**
 * Add ARIA labels to toolbar buttons
 */
function enhanceToolbarAccessibility(): void {
  const buttonLabels: Record<string, string> = {
    'btn-zoom-in': 'Zoom in (Ctrl++)',
    'btn-zoom-out': 'Zoom out (Ctrl+-)',
    'btn-pan-left': 'Pan left',
    'btn-pan-right': 'Pan right',
    'btn-undo': 'Undo (Ctrl+Z)',
    'btn-redo': 'Redo (Ctrl+Y)',
    'btn-delete': 'Delete (Del)',
    'btn-grid': 'Toggle grid',
    'btn-format-painter': 'Format painter (copy/paste style)',
    'btn-draw-rect': 'Draw rectangle',
    'btn-draw-ellipse': 'Draw ellipse',
    'btn-draw-diamond': 'Draw diamond',
    'btn-draw-line': 'Draw line',
    'btn-draw-connector': 'Draw connector',
    'btn-add-element': 'Add element',
    'btn-select': 'Select tool',
    'btn-pencil': 'Pencil tool',
    'btn-brush': 'Brush tool',
    'btn-eraser': 'Eraser tool',
    'btn-line-tool': 'Line tool',
    'btn-upload-image': 'Upload image',
    'btn-fullscreen': 'Toggle fullscreen',
    'btn-shape-designer': 'Design custom shapes',
    'btn-more-options': 'More options',
  };

  Object.entries(buttonLabels).forEach(([id, label]) => {
    const btn = document.getElementById(id);
    if (btn) {
      setAriaLabel(btn, label);
      btn.setAttribute('role', 'button');
      btn.setAttribute('tabindex', '0');
    }
  });
}

/**
 * Add ARIA labels to menu items
 */
function enhanceMenuAccessibility(): void {
  const menuItems = document.querySelectorAll('.menu-dropdown-item');
  menuItems.forEach((item) => {
    const action = item.getAttribute('data-action');
    if (action) {
      item.setAttribute('role', 'menuitem');
      item.setAttribute('tabindex', '0');
    }
  });

  const menuButtons = document.querySelectorAll('.menu-item');
  menuButtons.forEach((btn) => {
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
  });
}

/**
 * Add ARIA labels to form inputs
 */
function enhanceFormAccessibility(): void {
  const inputs = document.querySelectorAll('input[type="text"], input[type="number"], textarea, select');
  inputs.forEach((input) => {
    // Ensure input has associated label
    const label = input.parentElement?.querySelector('label');
    if (label && !input.id) {
      input.id = `input-${Math.random().toString(36).substr(2, 9)}`;
      label.setAttribute('for', input.id);
    }

    // Add aria-invalid support for validation
    if (input.hasAttribute('required')) {
      input.setAttribute('aria-required', 'true');
    }
  });

  // Ensure color inputs have labels
  const colorInputs = document.querySelectorAll('input[type="color"]');
  colorInputs.forEach((input, i) => {
    if (!input.id) {
      input.id = `color-input-${i}`;
      input.setAttribute('aria-label', `Color picker ${i + 1}`);
    }
  });
}

/**
 * Add ARIA labels to panels and containers
 */
function enhancePanelAccessibility(): void {
  // Left panel
  const leftPanel = document.getElementById('leftpanel-container');
  if (leftPanel) {
    leftPanel.setAttribute('role', 'complementary');
    leftPanel.setAttribute('aria-label', 'Shapes and stencils panel');
  }

  // Right panel (properties)
  const rightPanel = document.getElementById('rightpanel-container');
  if (rightPanel) {
    rightPanel.setAttribute('role', 'complementary');
    rightPanel.setAttribute('aria-label', 'Properties inspector');
  }

  // Canvas container
  const canvas = document.getElementById('graph-container');
  if (canvas) {
    canvas.setAttribute('role', 'main');
    canvas.setAttribute('aria-label', 'Drawing canvas');
  }

  // Tab headers
  const tabHeaders = document.querySelectorAll('.panel-header');
  tabHeaders.forEach((header) => {
    header.setAttribute('role', 'heading');
    header.setAttribute('aria-level', '2');
  });
}

/**
 * Announce action to screen readers
 */
export function announceAction(action: string): void {
  announce(`${action} completed`, 'polite');
}

/**
 * Announce important messages (errors, warnings)
 */
export function announceMessage(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  announce(message, priority);
}

/**
 * Set up skip links for keyboard navigation
 */
export function setupSkipLinks(): void {
  const skipLink = document.createElement('a');
  skipLink.href = '#graph-container';
  skipLink.textContent = 'Skip to drawing canvas';
  skipLink.style.position = 'absolute';
  skipLink.style.top = '-40px';
  skipLink.style.left = '0';
  skipLink.style.background = '#000';
  skipLink.style.color = '#fff';
  skipLink.style.padding = '8px';
  skipLink.style.zIndex = '100';

  skipLink.addEventListener('focus', () => {
    skipLink.style.top = '0';
  });

  skipLink.addEventListener('blur', () => {
    skipLink.style.top = '-40px';
  });

  document.body.insertBefore(skipLink, document.body.firstChild);
}

/**
 * Test accessibility compliance
 * Returns list of potential issues
 */
export function testAccessibility(): string[] {
  const issues: string[] = [];

  // Check for images without alt text
  const images = document.querySelectorAll('img');
  images.forEach((img) => {
    if (!img.hasAttribute('alt')) {
      issues.push(`Image missing alt text: ${img.src}`);
    }
  });

  // Check for buttons without labels
  const buttons = document.querySelectorAll('button');
  buttons.forEach((btn) => {
    if (!btn.getAttribute('aria-label') && !btn.textContent?.trim()) {
      issues.push(`Button missing label: ${btn.id || btn.className}`);
    }
  });

  // Check for form inputs without labels
  const inputs = document.querySelectorAll('input, select, textarea');
  inputs.forEach((input) => {
    if (!input.id || !document.querySelector(`label[for="${input.id}"]`)) {
      issues.push(`Form input missing label: ${input.id || input.className}`);
    }
  });

  // Check color contrast (basic check)
  const textElements = document.querySelectorAll('button, a, label, p, div');
  let lowContrastCount = 0;
  textElements.forEach((el) => {
    const style = window.getComputedStyle(el);
    const bgColor = style.backgroundColor;
    const textColor = style.color;
    // Note: This is a simplified check; a real contrast checker would be more thorough
    if (bgColor === textColor || bgColor === 'rgba(0, 0, 0, 0)') {
      lowContrastCount++;
    }
  });

  if (lowContrastCount > 0) {
    issues.push(`Found ${lowContrastCount} elements with potential contrast issues`);
  }

  return issues;
}
