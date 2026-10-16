/**
 * @file event-manager.ts
 * @brief Safe event listener management with automatic cleanup
 * @details Tracks all event listeners and enables bulk removal
 */

/**
 * Manages event listeners with automatic tracking and cleanup
 *
 * Usage:
 *   const eventMgr = new EventManager();
 *   eventMgr.on(element, 'click', handler);  // Tracked
 *   // ... later ...
 *   eventMgr.removeAll();  // Removes all tracked listeners
 */
export class EventManager {
  private listeners: Array<{
    element: EventTarget;
    event: string;
    handler: EventListenerOrEventListenerObject;
    options?: boolean | AddEventListenerOptions;
  }> = [];

  /**
   * Add listener and track it for cleanup
   */
  on(
    element: EventTarget | null | undefined,
    event: string,
    handler: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void {
    if (!element) return;

    element.addEventListener(event, handler, options);
    this.listeners.push({ element, event, handler, options });
  }

  /**
   * Remove specific listener
   */
  off(
    element: EventTarget | null | undefined,
    event: string,
    handler: EventListenerOrEventListenerObject
  ): void {
    if (!element) return;

    element.removeEventListener(event, handler);

    // Remove from tracking
    this.listeners = this.listeners.filter(
      (listener) =>
        !(
          listener.element === element &&
          listener.event === event &&
          listener.handler === handler
        )
    );
  }

  /**
   * Remove all tracked listeners
   */
  removeAll(): void {
    this.listeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.listeners = [];
  }

  /**
   * Get count of tracked listeners
   */
  count(): number {
    return this.listeners.length;
  }

  /**
   * Clear without removing listeners (use with caution)
   */
  clear(): void {
    this.listeners = [];
  }
}
