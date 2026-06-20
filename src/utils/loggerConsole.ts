/**
 * @file loggerConsole.ts
 * @brief Expose logger to browser console for runtime debugging
 *
 * Usage in browser console:
 * - logger.setLevel('trace')     // Show all logs including trace
 * - logger.setLevel('debug')     // Show debug and above
 * - logger.setLevel('info')      // Show info and above
 * - logger.setLevel('error')     // Show only errors and warnings
 * - logger.setTraceEnabled(true) // Enable trace logs
 * - logger.getConfig()           // View current log config
 */

import { logger } from './logger';

// Expose logger to global window object for console access
if (typeof window !== 'undefined') {
  (window as any).logger = logger;

  // Print helper message
  console.log('%c🔍 Logger Debugging Tools Available', 'color: #0066cc; font-weight: bold; font-size: 14px;');
  console.log('%cUsage in console:', 'color: #0066cc; font-weight: bold;');
  console.log('  logger.setLevel("trace")     // Show all logs');
  console.log('  logger.setLevel("debug")     // Show debug and above');
  console.log('  logger.setLevel("info")      // Show info and above');
  console.log('  logger.setLevel("warn")      // Show warnings and errors');
  console.log('  logger.setLevel("error")     // Show only errors');
  console.log('  logger.setTraceEnabled(true) // Enable trace logging');
  console.log('  logger.getConfig()           // View current config');
  console.log('%cLogs are persistent (saved in localStorage)', 'color: #666; font-style: italic;');
}

export default logger;
