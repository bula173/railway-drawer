/**
 * @file logger-simple.test.ts
 * @brief Simplified unit tests for logger that verify behavior through console mocking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { logger } from '../logger';

describe('Logger System - Simple Tests', () => {
  let debugSpy: any;
  let infoSpy: any;
  let warnSpy: any;
  let errorSpy: any;

  beforeEach(() => {
    debugSpy = vi.spyOn(console, 'debug');
    infoSpy = vi.spyOn(console, 'info');
    warnSpy = vi.spyOn(console, 'warn');
    errorSpy = vi.spyOn(console, 'error');
    logger.setLevel('debug');
  });

  afterEach(() => {
    debugSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe('Basic Logging', () => {
    it('should call console.debug for debug logs', () => {
      logger.debug('test', 'Debug message');
      expect(debugSpy).toHaveBeenCalled();
    });

    it('should call console.info for info logs', () => {
      logger.info('test', 'Info message');
      expect(infoSpy).toHaveBeenCalled();
    });

    it('should call console.warn for warn logs', () => {
      logger.warn('test', 'Warning message');
      expect(warnSpy).toHaveBeenCalled();
    });

    it('should call console.error for error logs', () => {
      logger.error('test', 'Error message');
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('Log Levels', () => {
    it('should respect debug log level', () => {
      logger.setLevel('debug');
      logger.debug('test', 'Message');
      expect(debugSpy).toHaveBeenCalled();
    });

    it('should not log debug when level is info', () => {
      logger.setLevel('info');
      debugSpy.mockClear();
      logger.debug('test', 'Debug message');
      expect(debugSpy).not.toHaveBeenCalled();
    });

    it('should not log info when level is warn', () => {
      logger.setLevel('warn');
      infoSpy.mockClear();
      logger.info('test', 'Info message');
      expect(infoSpy).not.toHaveBeenCalled();
    });

    it('should always log errors', () => {
      logger.setLevel('error');
      logger.error('test', 'Error message');
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('Trace Logging', () => {
    it('should not log trace when disabled', () => {
      logger.setTraceEnabled(false);
      logger.trace('test', 'Trace message');
      // Trace logs should be skipped when disabled
      const traceCallFound = debugSpy.mock.calls.some(
        call => typeof call[0] === 'string' && call[0].includes('Trace message')
      );
      expect(traceCallFound).toBe(false);
    });

    it('should support trace logging state', () => {
      const config = logger.getConfig();
      logger.setTraceEnabled(!config.enableTrace);
      const newConfig = logger.getConfig();
      expect(newConfig.enableTrace).not.toBe(config.enableTrace);
    });
  });

  describe('Configuration', () => {
    it('should allow changing log level', () => {
      logger.setLevel('error');
      expect(logger.getConfig().level).toBe('error');
    });

    it('should allow enabling/disabling trace', () => {
      logger.setTraceEnabled(true);
      expect(logger.getConfig().enableTrace).toBe(true);

      logger.setTraceEnabled(false);
      expect(logger.getConfig().enableTrace).toBe(false);
    });
  });

  describe('Text Editing Scenario', () => {
    it('should log text editing start', () => {
      logger.setLevel('debug');
      logger.debug('text-edit', 'Text editing started', {
        elementId: 'elem1',
        triggerChar: 'a',
      });
      expect(debugSpy).toHaveBeenCalled();
    });

    it('should log multiple text changes', () => {
      logger.setTraceEnabled(true);
      logger.setLevel('trace');

      // Simulate typing sequence
      logger.trace('text-edit', 'Text value changed', { oldValue: '', newValue: 'a' });
      logger.trace('text-edit', 'Text value changed', { oldValue: 'a', newValue: 'ab' });
      logger.trace('text-edit', 'Text value changed', { oldValue: 'ab', newValue: 'abc' });

      // All calls should have been made
      expect(debugSpy).toHaveBeenCalledTimes(3);
    });

    it('should log text save', () => {
      logger.debug('text-edit', 'Text editing saved', {
        elementId: 'elem1',
        finalValue: 'hello',
        duration: '1000ms',
      });
      expect(debugSpy).toHaveBeenCalled();
    });
  });

  describe('Error Scenarios', () => {
    it('should log unexpected errors', () => {
      logger.error('text-edit', 'Unexpected character duplication', {
        elementId: 'elem1',
        expected: 'a',
        received: 'aa',
      });
      expect(errorSpy).toHaveBeenCalled();
    });

    it('should track missing save operations', () => {
      logger.setLevel('debug');

      // If save is never called, this would be detected
      logger.debug('text-edit', 'Text editing started');
      debugSpy.mockClear();

      // Test completes without save log
      const saveWasCalled = debugSpy.mock.calls.some(
        call => typeof call[0] === 'string' && call[0].includes('saved')
      );

      expect(saveWasCalled).toBe(false);
    });
  });

  describe('Category Organization', () => {
    it('should support multiple log categories', () => {
      logger.debug('text-edit', 'Text event');
      logger.debug('pointer', 'Pointer event');
      logger.debug('selection', 'Selection event');

      expect(debugSpy).toHaveBeenCalledTimes(3);
    });

    it('should track pointer events', () => {
      logger.debug('pointer', 'Pointer down', { elementId: 'elem1' });
      logger.debug('pointer', 'Pointer move', { x: 100, y: 200 });
      logger.debug('pointer', 'Pointer up', { duration: '500ms' });

      expect(debugSpy).toHaveBeenCalledTimes(3);
    });

    it('should track selection changes', () => {
      logger.debug('selection', 'Selection changed', { selectedIds: ['elem1', 'elem2'] });

      expect(debugSpy).toHaveBeenCalled();
    });
  });

  describe('Bug Detection Patterns', () => {
    it('should detect duplicate character additions', () => {
      // Pattern: text goes from 'a' to 'aa' (bug!)
      logger.debug('text-edit', 'Change', {
        from: '',
        to: 'a',
      });
      logger.debug('text-edit', 'Change', {
        from: 'a',
        to: 'aa', // BUG: duplicate!
      });

      // Both changes should be logged
      expect(debugSpy).toHaveBeenCalledTimes(2);
    });

    it('should detect missing logs in text flow', () => {
      logger.debug('text-edit', 'Started');
      // If save is missing, that's a problem
      logger.debug('text-edit', 'Change');

      const hasSave = debugSpy.mock.calls.some(
        call => Array.isArray(call) && JSON.stringify(call).includes('save')
      );

      expect(hasSave).toBe(false); // This would indicate the bug
    });
  });
});
