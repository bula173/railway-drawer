import { useEffect, useCallback, useRef } from 'react';
import { logger } from '../utils/logger';

export interface KeyboardHandler {
  key: string;
  modifiers: ('ctrl' | 'shift' | 'alt' | 'meta')[];
  handler: (event: KeyboardEvent) => void;
  description?: string;
}

/**
 * Centralized keyboard shortcut management
 * Prevents duplicate handlers and provides single source of truth for shortcuts
 */
export const useKeyboardShortcuts = (
  handlers: KeyboardHandler[],
  enabled: boolean = true,
  options: { capture?: boolean } = {}
) => {
  const handlersRef = useRef<Map<string, KeyboardHandler>>(new Map());

  const normalizeKey = useCallback((key: string): string => {
    // Normalize key names for consistency
    const lowerKey = key.toLowerCase();
    if (lowerKey === ' ') return 'space';
    if (lowerKey === 'delete') return 'delete';
    if (lowerKey === 'enter') return 'enter';
    if (lowerKey === 'escape') return 'escape';
    if (lowerKey === 'arrowup') return 'arrowup';
    if (lowerKey === 'arrowdown') return 'arrowdown';
    if (lowerKey === 'arrowleft') return 'arrowleft';
    if (lowerKey === 'arrowright') return 'arrowright';
    return lowerKey;
  }, []);

  const getHandlerKey = useCallback((handler: KeyboardHandler): string => {
    const modifiers = handler.modifiers.sort().join('+');
    return modifiers ? `${modifiers}+${handler.key}` : handler.key;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // Build handler map
    handlersRef.current.clear();
    handlers.forEach(h => {
      const key = getHandlerKey(h);
      handlersRef.current.set(key, h);
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = normalizeKey(event.key);
      const modifiers: ('ctrl' | 'shift' | 'alt' | 'meta')[] = [];

      if (event.ctrlKey || event.metaKey) modifiers.push('ctrl');
      if (event.shiftKey) modifiers.push('shift');
      if (event.altKey) modifiers.push('alt');

      const sortedModifiers = modifiers.sort();
      const handlerKey = sortedModifiers.length
        ? `${sortedModifiers.join('+')}+${key}`
        : key;

      const handler = handlersRef.current.get(handlerKey);
      if (handler) {
        event.preventDefault();
        logger.debug('Keyboard', `Shortcut triggered: ${handlerKey}`, {
          description: handler.description,
        });
        handler.handler(event);
      }
    };

    window.addEventListener('keydown', handleKeyDown, options.capture ?? false);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, options.capture ?? false);
    };
  }, [handlers, enabled, getHandlerKey, normalizeKey, options.capture]);
};
