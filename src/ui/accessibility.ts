/**
 * @file accessibility.ts
 * @brief Accessibility utilities for WCAG 2.1 AA compliance
 * @details Helpers for adding ARIA labels, focus management, and keyboard navigation
 */

/**
 * Add ARIA label to an element
 */
export function setAriaLabel(element: HTMLElement | null, label: string): void {
  if (element) {
    element.setAttribute('aria-label', label);
  }
}

/**
 * Add ARIA description to an element
 */
export function setAriaDescription(element: HTMLElement | null, description: string): void {
  if (element) {
    element.setAttribute('aria-description', description);
  }
}

/**
 * Mark element as a button (for semantic HTML)
 */
export function markAsButton(element: HTMLElement | null): void {
  if (element) {
    element.setAttribute('role', 'button');
    element.setAttribute('tabindex', '0');
  }
}

/**
 * Mark element as requiring attention (error state)
 */
export function markAsInvalid(element: HTMLElement | null, message?: string): void {
  if (element) {
    element.setAttribute('aria-invalid', 'true');
    if (message) {
      element.setAttribute('aria-describedby', `error-${Math.random().toString(36).substr(2, 9)}`);
    }
  }
}

/**
 * Add keyboard event handler for accessible buttons
 */
export function makeAccessibleButton(
  element: HTMLElement | null,
  callback: () => void,
  label?: string
): void {
  if (!element) return;

  if (label) {
    setAriaLabel(element, label);
  }
  markAsButton(element);

  // Handle both click and keyboard
  element.addEventListener('click', callback);
  element.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      callback();
    }
  });
}

/**
 * Announce message to screen readers
 */
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.style.position = 'absolute';
  announcement.style.left = '-10000px';
  announcement.style.width = '1px';
  announcement.style.height = '1px';
  announcement.style.overflow = 'hidden';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement
  setTimeout(() => announcement.remove(), 1000);
}

/**
 * Set focus to an element with optional delay
 */
export function setFocus(element: HTMLElement | null, delay = 0): void {
  if (!element) return;

  if (delay > 0) {
    setTimeout(() => element.focus(), delay);
  } else {
    element.focus();
  }
}

/**
 * Create accessible heading
 */
export function createHeading(text: string, level: 1 | 2 | 3 | 4 | 5 | 6 = 2): HTMLElement {
  const heading = document.createElement(`h${level}`);
  heading.textContent = text;
  return heading;
}

/**
 * Add skip-to-content link
 */
export function addSkipLink(targetSelector: string, linkText = 'Skip to main content'): void {
  const skipLink = document.createElement('a');
  skipLink.href = `#${targetSelector}`;
  skipLink.textContent = linkText;
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
 * Ensure element is keyboard focusable
 */
export function ensureFocusable(element: HTMLElement | null): void {
  if (!element) return;

  // Check if already focusable
  const tabindex = element.getAttribute('tabindex');
  if (tabindex === null && !isFocusableElement(element)) {
    element.setAttribute('tabindex', '0');
  }
}

/**
 * Check if element is natively focusable
 */
function isFocusableElement(element: HTMLElement): boolean {
  const focusableTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
  return focusableTags.includes(element.tagName) || element.hasAttribute('tabindex');
}

/**
 * Apply focus visible styles for keyboard navigation
 */
export function addFocusVisible(): void {
  const style = document.createElement('style');
  style.textContent = `
    *:focus-visible {
      outline: 2px solid #4A90E2;
      outline-offset: 2px;
    }

    *:focus:not(:focus-visible) {
      outline: none;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Add role and aria-label to toolbar button
 */
export function createToolbarButton(
  icon: string,
  label: string,
  title?: string
): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = 'toolbar-btn';
  button.textContent = icon;
  button.setAttribute('aria-label', label);
  if (title) {
    button.setAttribute('title', title);
  }
  return button;
}

/**
 * Create accessible modal dialog
 */
export function createAccessibleDialog(title: string): HTMLElement {
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', `dialog-title-${Math.random().toString(36).substr(2, 9)}`);

  const titleElement = document.createElement('h2');
  titleElement.id = (dialog.getAttribute('aria-labelledby') as string);
  titleElement.textContent = title;

  dialog.appendChild(titleElement);
  return dialog;
}
