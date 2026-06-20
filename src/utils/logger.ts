/**
 * @file logger.ts
 * @brief Centralized logging utility for the Railway Drawer application
 * 
 * Provides structured logging with configurable levels and consistent formatting.
 * Helps with debugging while maintaining clean production builds.
 * 
 * @author Railway Drawer Team
 * @date 2025
 * @version 1.0
 */

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

interface LogConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableTimestamp: boolean;
  enableTrace: boolean;
  maxDataSize: number; // Max characters to display for data objects
}

class Logger {
  private config: LogConfig = {
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'error',
    enableConsole: process.env.NODE_ENV === 'development',
    enableTimestamp: true,
    enableTrace: false,
    maxDataSize: 500,
  };

  private levels: Record<LogLevel, number> = {
    trace: 0,
    debug: 1,
    info: 2,
    warn: 3,
    error: 4,
  };

  constructor() {
    // Allow configuring log level via localStorage for debugging
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const savedLevel = localStorage.getItem('LOG_LEVEL') as LogLevel | null;
        const savedTrace = localStorage.getItem('ENABLE_TRACE');
        if (savedLevel) this.config.level = savedLevel;
        if (savedTrace === 'true') this.config.enableTrace = true;
      } catch (e) {
        // localStorage may not be available in test environments
      }
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.config.level];
  }

  private formatMessage(level: LogLevel, category: string, message: string, data?: unknown): string {
    const timestamp = this.config.enableTimestamp ? new Date().toISOString() : '';
    const prefix = timestamp ? `[${timestamp}]` : '';
    const emoji = this.getEmoji(level);
    
    let formatted = `${prefix} ${emoji} [${category.toUpperCase()}] ${message}`;
    
    if (data) {
      formatted += '\n' + JSON.stringify(data, null, 2);
    }
    
    return formatted;
  }

  private getEmoji(level: LogLevel): string {
    switch (level) {
      case 'trace': return '🔍';
      case 'debug': return '🔧';
      case 'info': return 'ℹ️';
      case 'warn': return '⚠️';
      case 'error': return '❌';
      default: return '📝';
    }
  }

  private truncateData(data: unknown): unknown {
    if (!data) return data;
    const str = JSON.stringify(data);
    if (str.length > this.config.maxDataSize) {
      return { ...data, _truncated: `Data truncated (${str.length} chars, max: ${this.config.maxDataSize})` };
    }
    return data;
  }

  private log(level: LogLevel, category: string, message: string, data?: unknown): void {
    if (!this.shouldLog(level) || !this.config.enableConsole) {
      return;
    }

    // Skip trace logs if not explicitly enabled
    if (level === 'trace' && !this.config.enableTrace) {
      return;
    }

    const truncatedData = this.truncateData(data);
    const formatted = this.formatMessage(level, category, message, truncatedData);

    switch (level) {
      case 'trace':
      case 'debug':
        console.debug(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
        console.error(formatted);
        break;
    }
  }

  /**
   * @brief Trace-level logging for detailed execution flow tracking
   * @param category Log category/module name
   * @param message Trace message
   * @param data Optional data to log
   */
  trace(category: string, message: string, data?: unknown): void {
    this.log('trace', category, message, data);
  }

  /**
   * @brief Debug-level logging for development debugging
   * @param category Log category/module name
   * @param message Debug message
   * @param data Optional data to log
   */
  debug(category: string, message: string, data?: unknown): void {
    this.log('debug', category, message, data);
  }

  /**
   * @brief Info-level logging for general information
   * @param category Log category/module name
   * @param message Info message
   * @param data Optional data to log
   */
  info(category: string, message: string, data?: unknown): void {
    this.log('info', category, message, data);
  }

  /**
   * @brief Warning-level logging for potential issues
   * @param category Log category/module name
   * @param message Warning message
   * @param data Optional data to log
   */
  warn(category: string, message: string, data?: unknown): void {
    this.log('warn', category, message, data);
  }

  /**
   * @brief Error-level logging for critical issues
   * @param category Log category/module name
   * @param message Error message
   * @param data Optional data to log
   */
  error(category: string, message: string, data?: unknown): void {
    this.log('error', category, message, data);
  }

  /**
   * @brief Set log level dynamically
   * @param level The new log level to use
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('LOG_LEVEL', level);
      } catch (e) {
        // localStorage may not be available in test environments
      }
    }
    this.info('logger', `Log level set to: ${level}`);
  }

  /**
   * @brief Enable or disable trace logging
   * @param enabled Whether to enable trace logging
   */
  setTraceEnabled(enabled: boolean): void {
    this.config.enableTrace = enabled;
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('ENABLE_TRACE', String(enabled));
      } catch (e) {
        // localStorage may not be available in test environments
      }
    }
    this.info('logger', `Trace logging ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * @brief Get current log configuration
   */
  getConfig(): LogConfig {
    return { ...this.config };
  }

  configure(config: Partial<LogConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Create and export singleton logger instance
export const logger = new Logger();

/**
 * Export convenience functions for common logging patterns
 */

export const logToolboxConfig = (config: unknown[]) =>
  logger.info('toolbox', 'Loading toolbox configuration', {
    totalItems: (config as any[]).length,
    pointElement: (config as any[]).find((item: any) => item.id === 'point'),
    trackElement: (config as any[]).find((item: any) => item.id === 'track')
  });

export const logTabChange = (activeTabId: string, hasRef: boolean, elementsCount: number, selectedElementId?: string) =>
  logger.debug('tabs', 'Active tab changed', {
    activeTabId,
    hasRef,
    elementsCount,
    selectedElementId
  });

export const logElementSync = (operation: string, count: number, details?: unknown) =>
  logger.debug('elements', `${operation}: ${count} elements`, details);

export const logClipboard = (operation: 'copy' | 'paste', count: number, source: 'global' | 'local' = 'global') =>
  logger.debug('clipboard', `${operation} (${source}): ${count} elements`);

export const logError = (category: string, message: string, error: Error | unknown) =>
  logger.error(category, message, { error: (error as Error).message || error, stack: (error as Error).stack });

/**
 * Text editing event logging
 */
export const logTextEditingStart = (elementId: string, triggerChar?: string, currentText?: string) =>
  logger.debug('text-edit', 'Text editing started', {
    elementId,
    triggerChar,
    currentText,
    timestamp: new Date().toISOString()
  });

export const logTextEditingChange = (elementId: string, oldValue: string, newValue: string) =>
  logger.trace('text-edit', 'Text value changed', {
    elementId,
    oldValue: oldValue.substring(0, 50) + (oldValue.length > 50 ? '...' : ''),
    newValue: newValue.substring(0, 50) + (newValue.length > 50 ? '...' : ''),
    oldLength: oldValue.length,
    newLength: newValue.length
  });

export const logTextEditingSaved = (elementId: string, finalValue: string, duration: number) =>
  logger.debug('text-edit', 'Text editing saved', {
    elementId,
    finalValue: finalValue.substring(0, 50) + (finalValue.length > 50 ? '...' : ''),
    duration: `${duration}ms`
  });

/**
 * Mouse/Pointer event logging
 */
export const logPointerDown = (elementId: string, position: { x: number; y: number }, isSelected: boolean) =>
  logger.trace('pointer', 'Pointer down', { elementId, position, isSelected });

export const logPointerUp = (elementId: string, duration: number) =>
  logger.trace('pointer', 'Pointer up', { elementId, duration: `${duration}ms` });

export const logDoubleClick = (elementId: string) =>
  logger.debug('interaction', 'Double-click detected', { elementId });

/**
 * Selection logging
 */
export const logSelectionChange = (selectedIds: string[], count: number) =>
  logger.trace('selection', 'Selection changed', { selectedIds, count });

/**
 * Undo/Redo logging
 */
export const logUndoRedo = (action: 'undo' | 'redo', historyIndex: number, historyLength: number) =>
  logger.debug('history', `${action} executed`, { historyIndex, historyLength });

/**
 * Keyboard logging
 */
export const logKeystroke = (key: string, ctrlKey: boolean, metaKey: boolean, isOnSelected: boolean) =>
  logger.trace('keyboard', 'Keystroke', { key, ctrlKey, metaKey, isOnSelected });
