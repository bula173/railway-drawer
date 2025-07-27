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

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableTimestamp: boolean;
}

class Logger {
  private config: LogConfig = {
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'warn',
    enableConsole: true,
    enableTimestamp: true,
  };

  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.config.level];
  }

  private formatMessage(level: LogLevel, category: string, message: string, data?: any): string {
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
      case 'debug': return '🔧';
      case 'info': return 'ℹ️';
      case 'warn': return '⚠️';
      case 'error': return '❌';
      default: return '📝';
    }
  }

  private log(level: LogLevel, category: string, message: string, data?: any): void {
    if (!this.shouldLog(level) || !this.config.enableConsole) {
      return;
    }

    const formatted = this.formatMessage(level, category, message, data);
    
    switch (level) {
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

  debug(category: string, message: string, data?: any): void {
    this.log('debug', category, message, data);
  }

  info(category: string, message: string, data?: any): void {
    this.log('info', category, message, data);
  }

  warn(category: string, message: string, data?: any): void {
    this.log('warn', category, message, data);
  }

  error(category: string, message: string, data?: any): void {
    this.log('error', category, message, data);
  }

  configure(config: Partial<LogConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Create and export singleton logger instance
export const logger = new Logger();

// Export convenience functions for common logging patterns
export const logToolboxConfig = (config: any) => 
  logger.info('toolbox', 'Loading toolbox configuration', {
    totalItems: config.length,
    pointElement: config.find((item: any) => item.id === 'point'),
    trackElement: config.find((item: any) => item.id === 'track')
  });

export const logTabChange = (activeTabId: string, hasRef: boolean, elementsCount: number, selectedElementId?: string) =>
  logger.debug('tabs', 'Active tab changed', {
    activeTabId,
    hasRef,
    elementsCount,
    selectedElementId
  });

export const logElementSync = (operation: string, count: number, details?: any) =>
  logger.debug('elements', `${operation}: ${count} elements`, details);

export const logClipboard = (operation: 'copy' | 'paste', count: number, source: 'global' | 'local' = 'global') =>
  logger.debug('clipboard', `${operation} (${source}): ${count} elements`);

export const logError = (category: string, message: string, error: Error | any) =>
  logger.error(category, message, { error: error.message || error, stack: error.stack });
