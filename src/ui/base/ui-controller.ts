/**
 * @file ui-controller.ts
 * @brief Base class for all UI controllers with lifecycle management
 * @details Provides standardized destroy/cleanup pattern for all UI components
 */

interface TrackedListener {
  element: EventTarget;
  event: string;
  handler: EventListenerOrEventListenerObject;
  options?: boolean | AddEventListenerOptions;
}

/**
 * Abstract base class for UI controllers
 * All UI controllers should extend this class to ensure proper cleanup
 */
export abstract class UIController {
  private _trackedListeners: TrackedListener[] = [];
  /**
   * Initialize the controller
   * Called after construction, allows async initialization
   */
  async initialize(): Promise<void> {
    // Override in subclasses if needed
  }

  /**
   * Clean up resources before disposal
   * MUST be called before discarding controller instance
   * Subclasses should:
   * - Remove event listeners
   * - Clear timers/intervals
   * - Nullify object references
   * - Remove DOM elements if created
   * - Dispose external resources (graphs, canvases)
   */
  abstract destroy(): void;

  /**
   * Check if controller is still valid (not destroyed)
   */
  protected isDestroyed(): boolean {
    return (this as any)._destroyed === true;
  }

  /**
   * Mark controller as destroyed to prevent use after destruction
   */
  protected setDestroyed(): void {
    (this as any)._destroyed = true;
  }

  /**
   * Helper to safely remove event listener with tracking
   * Usage: this.removeListener(element, 'click', handler)
   */
  protected removeListener(
    element: HTMLElement | Window | Document | EventTarget | null | undefined,
    event: string,
    handler: EventListenerOrEventListenerObject
  ): void {
    if (element) {
      element.removeEventListener(event, handler);
    }
  }

  /**
   * Helper to add tracked event listener
   * Usage: this.addListener(element, 'click', handler)
   */
  protected addListener(
    element: HTMLElement | Window | Document | EventTarget | null | undefined,
    event: string,
    handler: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void {
    if (element) {
      element.addEventListener(event, handler, options);
    }
  }

  /**
   * Helper to add listener and track for cleanup
   * Usage: this.trackListener(element, 'click', handler)
   */
  protected trackListener(
    element: HTMLElement | Window | Document | EventTarget | null | undefined,
    event: string,
    handler: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void {
    if (element) {
      this._trackedListeners.push({ element, event, handler, options });
      element.addEventListener(event, handler, options);
    }
  }

  /**
   * Remove all tracked listeners (call in destroy())
   */
  protected removeTrackedListeners(): void {
    this._trackedListeners.forEach((listener) => {
      listener.element.removeEventListener(listener.event, listener.handler);
    });
    this._trackedListeners = [];
  }
}
