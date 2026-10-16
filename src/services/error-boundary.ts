/**
 * @file error-boundary.ts
 * @brief Error boundary for wrapping UI sections with error recovery
 * @details Catches errors in specific UI sections and allows graceful recovery
 */

import { ServiceRegistry } from './service-registry';

/**
 * Configuration for error boundary
 */
export interface ErrorBoundaryConfig {
  name: string;
  fallbackUI?: (error: Error, retry: () => void) => HTMLElement;
  onError?: (error: Error) => void;
  recoverable?: boolean;
}

/**
 * Error boundary wrapper for UI components
 * Catches errors and displays recovery UI
 */
export class ErrorBoundary {
  private config: ErrorBoundaryConfig;
  private container: HTMLElement | null = null;
  private originalContent: HTMLElement | null = null;
  private currentError: Error | null = null;

  constructor(config: ErrorBoundaryConfig) {
    this.config = {
      recoverable: true,
      ...config,
    };
  }

  /**
   * Wrap a function with error handling
   */
  async catch<T>(fn: () => T | Promise<T>): Promise<T | null> {
    try {
      return await Promise.resolve(fn());
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  /**
   * Wrap an element with error boundary
   */
  wrap(container: HTMLElement, renderFn: () => HTMLElement): HTMLElement {
    this.container = container;
    this.originalContent = container.cloneNode(true) as HTMLElement;

    try {
      const content = renderFn();
      container.innerHTML = '';
      container.appendChild(content);
      this.currentError = null;
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
    }

    return container;
  }

  /**
   * Retry the last failed operation
   */
  retry(): void {
    if (this.originalContent && this.container) {
      this.container.innerHTML = '';
      this.container.appendChild(this.originalContent.cloneNode(true));
      this.currentError = null;
    }
  }

  /**
   * Handle error and show recovery UI
   */
  private handleError(error: Error): void {
    this.currentError = error;

    // Notify error handler
    const errorHandler = ServiceRegistry.get<any>('errorHandler');
    if (errorHandler) {
      errorHandler.handle(error, 'ui', this.config.recoverable);
    }

    // Call custom error handler if provided
    if (this.config.onError) {
      this.config.onError(error);
    }

    // Show fallback UI
    if (this.container && this.config.recoverable) {
      this.showFallbackUI(error);
    }
  }

  /**
   * Display fallback UI with retry option
   */
  private showFallbackUI(error: Error): void {
    if (!this.container) return;

    let fallbackUI: HTMLElement;

    if (this.config.fallbackUI) {
      fallbackUI = this.config.fallbackUI(error, () => this.retry());
    } else {
      fallbackUI = this.createDefaultFallbackUI(error);
    }

    this.container.innerHTML = '';
    this.container.appendChild(fallbackUI);
  }

  /**
   * Create default fallback UI
   */
  private createDefaultFallbackUI(error: Error): HTMLElement {
    const container = document.createElement('div');
    container.style.padding = '16px';
    container.style.background = '#ffebee';
    container.style.border = '1px solid #f44336';
    container.style.borderRadius = '4px';
    container.style.color = '#c62828';

    const title = document.createElement('h3');
    title.textContent = `${this.config.name} Error`;
    title.style.margin = '0 0 8px 0';

    const message = document.createElement('p');
    message.textContent = error.message;
    message.style.margin = '0 0 12px 0';
    message.style.fontSize = '13px';

    const retryBtn = document.createElement('button');
    retryBtn.textContent = 'Try Again';
    retryBtn.style.padding = '6px 12px';
    retryBtn.style.background = '#f44336';
    retryBtn.style.color = 'white';
    retryBtn.style.border = 'none';
    retryBtn.style.borderRadius = '3px';
    retryBtn.style.cursor = 'pointer';
    retryBtn.onclick = () => this.retry();

    container.appendChild(title);
    container.appendChild(message);
    container.appendChild(retryBtn);

    return container;
  }

  /**
   * Get current error if any
   */
  getError(): Error | null {
    return this.currentError;
  }

  /**
   * Clear error state
   */
  clearError(): void {
    this.currentError = null;
  }
}

/**
 * Create error boundary for a specific UI section
 */
export function createErrorBoundary(name: string, _container?: HTMLElement): ErrorBoundary {
  return new ErrorBoundary({ name, recoverable: true });
}
