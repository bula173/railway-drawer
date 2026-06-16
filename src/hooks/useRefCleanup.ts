import { useRef, useEffect, useCallback } from 'react';
import { logger } from '../utils/logger';

/**
 * Custom hook to safely manage refs with automatic cleanup
 * Prevents memory leaks from unbounded ref growth
 */
export const useRefCleanup = <T,>(initialValue: T | null = null) => {
  const ref = useRef(initialValue);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      logger.debug('RefCleanup', 'Cleaning up ref on unmount');
      ref.current = null;
    };
  }, []);

  return ref;
};

/**
 * Custom hook to manage a Map of refs with automatic cleanup
 * Prevents unbounded growth of ref Maps (e.g., drawAreaRefs)
 */
export const useRefMap = <K, V,>() => {
  const refMap = useRef<Map<K, V>>(new Map());

  const set = useCallback((key: K, value: V | null) => {
    if (value === null) {
      refMap.current.delete(key);
      logger.debug('RefMap', 'Deleted ref', { keyType: typeof key });
    } else {
      refMap.current.set(key, value);
      logger.debug('RefMap', 'Set ref', {
        keyType: typeof key,
        mapSize: refMap.current.size,
      });
    }
  }, []);

  const get = useCallback((key: K) => {
    return refMap.current.get(key) || null;
  }, []);

  const has = useCallback((key: K) => {
    return refMap.current.has(key);
  }, []);

  const delete_ = useCallback((key: K) => {
    const deleted = refMap.current.delete(key);
    if (deleted) {
      logger.debug('RefMap', 'Deleted ref', {
        mapSize: refMap.current.size,
      });
    }
    return deleted;
  }, []);

  const clear = useCallback(() => {
    const size = refMap.current.size;
    refMap.current.clear();
    logger.debug('RefMap', 'Cleared all refs', { clearedCount: size });
  }, []);

  const size = useCallback(() => refMap.current.size, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      logger.debug('RefMap', 'Cleaning up ref map on unmount', {
        finalSize: refMap.current.size,
      });
      refMap.current.clear();
    };
  }, []);

  return {
    set,
    get,
    has,
    delete: delete_,
    clear,
    size,
    map: refMap.current, // For advanced usage if needed
  };
};

/**
 * Custom hook for safe event listener management
 * Ensures listeners are removed on unmount or dependency changes
 */
export const useEventListener = <K extends keyof HTMLElementEventMap>(
  element: HTMLElement | Window | null | undefined,
  eventName: K,
  handler: (event: HTMLElementEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions
) => {
  useEffect(() => {
    if (!element) {
      logger.debug('EventListener', 'Skipping listener - no element');
      return;
    }

    logger.debug('EventListener', 'Added listener', {
      eventName,
      hasElement: !!element,
    });

    element.addEventListener(eventName, handler as EventListener, options);

    // Cleanup
    return () => {
      logger.debug('EventListener', 'Removed listener', { eventName });
      element.removeEventListener(eventName, handler as EventListener, options);
    };
  }, [element, eventName, handler, options]);
};

/**
 * Custom hook to throttle callback execution
 * Reduces event handler firing frequency
 */
export const useThrottledCallback = <T extends (...args: any[]) => void>(
  callback: T,
  delayMs: number = 200
): T => {
  const lastCallRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return ((...args: any[]) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallRef.current;

    if (timeSinceLastCall >= delayMs) {
      lastCallRef.current = now;
      callback(...args);
    } else {
      // Schedule the callback for later
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        lastCallRef.current = Date.now();
        callback(...args);
      }, delayMs - timeSinceLastCall);
    }
  }) as T;
};

/**
 * Custom hook to debounce callback execution
 * Waits for silence before executing callback
 */
export const useDebouncedCallback = <T extends (...args: any[]) => void>(
  callback: T,
  delayMs: number = 500
): T => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return ((...args: any[]) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callback(...args);
      timeoutRef.current = null;
    }, delayMs);
  }) as T;
};
