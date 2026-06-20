/**
 * @file logger.test.ts
 * @brief Unit tests for logging system and log capture utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { logger } from '../logger';

/**
 * Test utility: Capture logs for assertion
 */
class LogCapture {
  private logs: Array<{
    level: string;
    category: string;
    message: string;
    data?: unknown;
  }> = [];

  private originalConsoleDebug: typeof console.debug;
  private originalConsoleInfo: typeof console.info;
  private originalConsoleWarn: typeof console.warn;
  private originalConsoleError: typeof console.error;

  start(): void {
    this.logs = [];

    // Intercept console methods
    this.originalConsoleDebug = console.debug;
    this.originalConsoleInfo = console.info;
    this.originalConsoleWarn = console.warn;
    this.originalConsoleError = console.error;

    console.debug = vi.fn(this.captureLog.bind(this, 'debug'));
    console.info = vi.fn(this.captureLog.bind(this, 'info'));
    console.warn = vi.fn(this.captureLog.bind(this, 'warn'));
    console.error = vi.fn(this.captureLog.bind(this, 'error'));
  }

  stop(): void {
    // Restore original console methods
    console.debug = this.originalConsoleDebug;
    console.info = this.originalConsoleInfo;
    console.warn = this.originalConsoleWarn;
    console.error = this.originalConsoleError;
  }

  private captureLog(level: string, message: string): void {
    // Parse the formatted log message - more flexible regex
    // Format: [timestamp] emoji [CATEGORY] message
    const match = message.match(/\[.*?\]\s[^\[]*\s\[(.*?)\]\s(.*?)(?:\n|$)/);
    if (match) {
      const [, category, msg] = match;
      this.logs.push({ level, category, message: msg || message });
    } else {
      // Fallback: just capture the whole message
      this.logs.push({ level, category: 'unknown', message });
    }
  }

  getLogs(): typeof this.logs {
    return this.logs;
  }

  getLogsByCategory(category: string): typeof this.logs {
    return this.logs.filter(log => log.category === category);
  }

  getLogsByLevel(level: string): typeof this.logs {
    return this.logs.filter(log => log.level === level);
  }

  hasLog(category: string, messageSubstring: string): boolean {
    return this.logs.some(
      log => log.category === category && log.message.includes(messageSubstring)
    );
  }

  hasErrorLog(category: string): boolean {
    return this.logs.some(log => log.level === 'error' && log.category === category);
  }

  clear(): void {
    this.logs = [];
  }
}

describe('Logger System', () => {
  let logCapture: LogCapture;

  beforeEach(() => {
    logCapture = new LogCapture();
    logCapture.start();
    logger.setLevel('debug');
  });

  afterEach(() => {
    logCapture.stop();
  });

  describe('Log Levels', () => {
    it('should log at trace level when enabled', () => {
      logger.setTraceEnabled(true);
      logger.trace('test', 'Trace message');
      expect(logCapture.hasLog('test', 'Trace message')).toBe(true);
    });

    it('should not log trace when disabled', () => {
      logger.setTraceEnabled(false);
      logger.trace('test', 'Trace message');
      expect(logCapture.hasLog('test', 'Trace message')).toBe(false);
    });

    it('should log debug messages', () => {
      logger.debug('test', 'Debug message');
      expect(logCapture.hasLog('test', 'Debug message')).toBe(true);
    });

    it('should log info messages', () => {
      logger.info('test', 'Info message');
      expect(logCapture.hasLog('test', 'Info message')).toBe(true);
    });

    it('should log warning messages', () => {
      logger.warn('test', 'Warning message');
      expect(logCapture.hasLog('test', 'Warning message')).toBe(true);
    });

    it('should log error messages', () => {
      logger.error('test', 'Error message');
      expect(logCapture.hasLog('test', 'Error message')).toBe(true);
    });
  });

  describe('Log Filtering', () => {
    it('should filter logs by category', () => {
      logger.debug('category-a', 'Message A');
      logger.debug('category-b', 'Message B');

      const categoryALogs = logCapture.getLogsByCategory('category-a');
      expect(categoryALogs).toHaveLength(1);
      expect(categoryALogs[0].message).toContain('Message A');
    });

    it('should filter logs by level', () => {
      logger.debug('test', 'Debug message');
      logger.info('test', 'Info message');
      logger.warn('test', 'Warning message');

      const warningLogs = logCapture.getLogsByLevel('warn');
      expect(warningLogs.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect error logs', () => {
      logger.error('critical', 'Critical error');
      expect(logCapture.hasErrorLog('critical')).toBe(true);
    });

    it('should handle category case sensitivity', () => {
      logger.debug('TextEdit', 'Message');
      expect(logCapture.hasLog('TextEdit', 'Message')).toBe(true);
      expect(logCapture.hasLog('textedit', 'Message')).toBe(false);
    });
  });

  describe('Log Level Switching', () => {
    it('should switch log level dynamically', () => {
      logger.setLevel('error');
      logger.debug('test', 'Debug message');
      expect(logCapture.hasLog('test', 'Debug message')).toBe(false);

      logger.setLevel('debug');
      logger.debug('test', 'Debug message 2');
      expect(logCapture.hasLog('test', 'Debug message 2')).toBe(true);
    });

    it('should respect log level hierarchy', () => {
      logger.setLevel('warn');
      logger.debug('test', 'Debug');
      logger.info('test', 'Info');
      logger.warn('test', 'Warning');

      expect(logCapture.hasLog('test', 'Debug')).toBe(false);
      expect(logCapture.hasLog('test', 'Info')).toBe(false);
      expect(logCapture.hasLog('test', 'Warning')).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should return current configuration', () => {
      const config = logger.getConfig();
      expect(config).toHaveProperty('level');
      expect(config).toHaveProperty('enableConsole');
      expect(config).toHaveProperty('enableTimestamp');
      expect(config).toHaveProperty('enableTrace');
    });

    it('should update trace setting', () => {
      logger.setTraceEnabled(true);
      expect(logger.getConfig().enableTrace).toBe(true);

      logger.setTraceEnabled(false);
      expect(logger.getConfig().enableTrace).toBe(false);
    });
  });

  describe('Multiple Categories', () => {
    it('should handle logs from multiple categories', () => {
      logger.debug('text-edit', 'Text editing started');
      logger.debug('pointer', 'Pointer down');
      logger.debug('selection', 'Selection changed');

      const allLogs = logCapture.getLogs();
      expect(allLogs.length).toBeGreaterThanOrEqual(3);

      const textEditLogs = logCapture.getLogsByCategory('text-edit');
      const pointerLogs = logCapture.getLogsByCategory('pointer');
      const selectionLogs = logCapture.getLogsByCategory('selection');

      expect(textEditLogs.length).toBeGreaterThan(0);
      expect(pointerLogs.length).toBeGreaterThan(0);
      expect(selectionLogs.length).toBeGreaterThan(0);
    });
  });
});

/**
 * Export LogCapture for use in other tests
 */
export { LogCapture };
