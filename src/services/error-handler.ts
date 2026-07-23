/**
 * @file error-handler.ts
 * @brief Centralized error handling and reporting
 * @details Categorizes errors, handles user-facing messages, and logs for debugging
 */

import { ServiceRegistry } from './service-registry';

export type ErrorCategory = 'graph' | 'cache' | 'shape' | 'ui' | 'io' | 'unknown';

export interface AppError {
  category: ErrorCategory;
  message: string;
  originalError?: Error;
  timestamp: number;
  recoverable: boolean;
}

/**
 * Central error handler for the application
 * Provides consistent error categorization, logging, and user feedback
 */
export class ErrorHandler {
  private errors: AppError[] = [];
  private maxErrors = 100;

  /**
   * Handle an error with categorization and user feedback
   */
  handle(
    error: Error | string,
    category: ErrorCategory = 'unknown',
    recoverable = true
  ): AppError {
    const appError: AppError = {
      category,
      message: typeof error === 'string' ? error : error.message,
      originalError: typeof error === 'string' ? undefined : error,
      timestamp: Date.now(),
      recoverable,
    };

    // Store in history for debugging
    this.errors.push(appError);
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    // Log to console for debugging
    this.logError(appError);

    // Show user feedback
    this.showUserFeedback(appError);

    return appError;
  }

  /**
   * Handle error in graph operations
   */
  handleGraphError(error: Error | string, recoverable = true): AppError {
    return this.handle(error, 'graph', recoverable);
  }

  /**
   * Handle error in cache operations
   */
  handleCacheError(error: Error | string, recoverable = true): AppError {
    return this.handle(error, 'cache', recoverable);
  }

  /**
   * Handle error in shape operations
   */
  handleShapeError(error: Error | string, recoverable = true): AppError {
    return this.handle(error, 'shape', recoverable);
  }

  /**
   * Handle error in UI operations
   */
  handleUIError(error: Error | string, recoverable = true): AppError {
    return this.handle(error, 'ui', recoverable);
  }

  /**
   * Handle error in I/O operations
   */
  handleIOError(error: Error | string, recoverable = true): AppError {
    return this.handle(error, 'io', recoverable);
  }

  /**
   * Get error history for debugging
   */
  getErrors(): AppError[] {
    return [...this.errors];
  }

  /**
   * Clear error history
   */
  clearErrors(): void {
    this.errors = [];
  }

  /**
   * Log error to console with category
   */
  private logError(appError: AppError): void {
    const prefix = `[${appError.category.toUpperCase()}]`;
    const level = appError.recoverable ? 'warn' : 'error';

    console[level as 'warn' | 'error'](
      `${prefix} ${appError.message}`,
      appError.originalError || ''
    );
  }

  /**
   * Show user feedback via notification system
   */
  private showUserFeedback(appError: AppError): void {
    const notificationMgr = ServiceRegistry.getNotificationManager();
    if (!notificationMgr) return;

    const userMessage = this.getUserMessage(appError);

    if (appError.recoverable) {
      notificationMgr.warning(userMessage);
    } else {
      notificationMgr.error(userMessage);
    }
  }

  /**
   * Generate user-friendly error message
   */
  private getUserMessage(appError: AppError): string {
    const baseMessage = appError.message || 'An error occurred';

    // Add helpful context based on category
    switch (appError.category) {
      case 'cache':
        return `${baseMessage} - Your work may not be saved. Try refreshing.`;
      case 'graph':
        return `${baseMessage} - There was a problem with the diagram.`;
      case 'shape':
        return `${baseMessage} - Could not load or create shape.`;
      case 'io':
        return `${baseMessage} - File operation failed.`;
      case 'ui':
        return `${baseMessage} - UI error occurred.`;
      default:
        return baseMessage;
    }
  }
}

/**
 * Global error handler instance
 */
export const globalErrorHandler = new ErrorHandler();

/**
 * Global error event listener
 * Catches unhandled promise rejections
 */
window.addEventListener('unhandledrejection', (event) => {
  globalErrorHandler.handle(
    event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
    'unknown',
    false
  );
  event.preventDefault();
});

/**
 * Global error listener for synchronous errors
 */
window.addEventListener('error', (event) => {
  globalErrorHandler.handle(event.error || event.message, 'unknown', false);
});
