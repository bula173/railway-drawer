/**
 * @file error-handler.test.ts
 * @brief Tests for ErrorHandler service
 */

import { ErrorHandler } from '../../services/error-handler';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
  });

  describe('handle', () => {
    it('should handle error with default category', () => {
      const error = new Error('Test error');
      const result = errorHandler.handle(error);

      expect(result.message).toBe('Test error');
      expect(result.category).toBe('unknown');
      expect(result.recoverable).toBe(true);
    });

    it('should handle error with specific category', () => {
      const error = new Error('Graph error');
      const result = errorHandler.handleGraphError(error);

      expect(result.category).toBe('graph');
    });

    it('should handle string errors', () => {
      const result = errorHandler.handle('String error message');

      expect(result.message).toBe('String error message');
      expect(result.originalError).toBeUndefined();
    });

    it('should mark errors as recoverable or not', () => {
      const recoverable = errorHandler.handleCacheError('Cache error', true);
      const unrecoverable = errorHandler.handleGraphError('Graph error', false);

      expect(recoverable.recoverable).toBe(true);
      expect(unrecoverable.recoverable).toBe(false);
    });
  });

  describe('error categories', () => {
    it('should handle graph errors', () => {
      const result = errorHandler.handleGraphError('Graph issue');
      expect(result.category).toBe('graph');
    });

    it('should handle cache errors', () => {
      const result = errorHandler.handleCacheError('Cache issue');
      expect(result.category).toBe('cache');
    });

    it('should handle shape errors', () => {
      const result = errorHandler.handleShapeError('Shape issue');
      expect(result.category).toBe('shape');
    });

    it('should handle UI errors', () => {
      const result = errorHandler.handleUIError('UI issue');
      expect(result.category).toBe('ui');
    });

    it('should handle IO errors', () => {
      const result = errorHandler.handleIOError('IO issue');
      expect(result.category).toBe('io');
    });
  });

  describe('error history', () => {
    it('should store error history', () => {
      errorHandler.handle('Error 1');
      errorHandler.handle('Error 2');
      errorHandler.handle('Error 3');

      const errors = errorHandler.getErrors();
      expect(errors).toHaveLength(3);
    });

    it('should maintain max error limit', () => {
      // Add more than default limit (100)
      for (let i = 0; i < 110; i++) {
        errorHandler.handle(`Error ${i}`);
      }

      const errors = errorHandler.getErrors();
      expect(errors.length).toBeLessThanOrEqual(100);
    });

    it('should clear error history', () => {
      errorHandler.handle('Error 1');
      errorHandler.handle('Error 2');

      expect(errorHandler.getErrors()).toHaveLength(2);

      errorHandler.clearErrors();
      expect(errorHandler.getErrors()).toHaveLength(0);
    });
  });

  describe('error timestamps', () => {
    it('should include timestamp with each error', () => {
      const before = Date.now();
      const result = errorHandler.handle('Test error');
      const after = Date.now();

      expect(result.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.timestamp).toBeLessThanOrEqual(after);
    });
  });
});
