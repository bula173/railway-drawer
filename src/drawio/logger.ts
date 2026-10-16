/**
 * @file logger.ts
 * @brief Minimal structured logger for the draw.io modules.
 *
 * Same call shape as the React app's `utils/logger` (`level(category, message, data?)`),
 * so the ported modules stay unchanged apart from the import path. `debug` is printed
 * only in dev builds; `info`/`warn`/`error` always go to the console.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function defaultMinLevel(): LogLevel {
  try {
    return import.meta.env?.DEV ? 'debug' : 'info';
  } catch {
    return 'info';
  }
}

let minLevel: LogLevel = defaultMinLevel();

function emit(level: LogLevel, category: string, message: string, data?: unknown): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
  const prefix = `[${category}] ${message}`;
  const sink =
    level === 'error' ? console.error : level === 'warn' ? console.warn : level === 'info' ? console.info : console.debug;
  if (data === undefined) sink(prefix);
  else sink(prefix, data);
}

export const logger = {
  debug: (category: string, message: string, data?: unknown): void => emit('debug', category, message, data),
  info: (category: string, message: string, data?: unknown): void => emit('info', category, message, data),
  warn: (category: string, message: string, data?: unknown): void => emit('warn', category, message, data),
  error: (category: string, message: string, data?: unknown): void => emit('error', category, message, data),
  /** Changes the minimum level that is printed. */
  setLevel(level: LogLevel): void {
    minLevel = level;
  },
};
