import { useState, useCallback, useRef } from 'react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  details?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number; // ms, 0 = persistent
}

/**
 * Hook for managing toast/notification notifications
 * Provides centralized error and success feedback to users
 */
export const useNotification = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const idRef = useRef(0);
  const timeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const addNotification = useCallback(
    (notification: Omit<Notification, 'id'>) => {
      const id = `notification-${idRef.current++}`;
      const fullNotification: Notification = {
        ...notification,
        id,
        duration: notification.duration ?? 5000,
      };

      setNotifications(prev => [...prev, fullNotification]);

      // Auto-remove after duration
      const duration = fullNotification.duration ?? 0;
      if (duration > 0) {
        const timeout = setTimeout(() => {
          removeNotification(id);
        }, duration);

        timeoutRef.current.set(id, timeout);
      }

      return id;
    },
    []
  );

  const removeNotification = useCallback((id: string) => {
    // Clear timeout if exists
    const timeout = timeoutRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutRef.current.delete(id);
    }

    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const success = useCallback(
    (message: string, options?: Partial<Omit<Notification, 'id' | 'type' | 'message'>>) =>
      addNotification({ ...options, type: 'success', message }),
    [addNotification]
  );

  const error = useCallback(
    (message: string, details?: string, options?: Partial<Omit<Notification, 'id' | 'type' | 'message' | 'details'>>) =>
      addNotification({ ...options, type: 'error', message, details }),
    [addNotification]
  );

  const warning = useCallback(
    (message: string, options?: Partial<Omit<Notification, 'id' | 'type' | 'message'>>) =>
      addNotification({ ...options, type: 'warning', message }),
    [addNotification]
  );

  const info = useCallback(
    (message: string, options?: Partial<Omit<Notification, 'id' | 'type' | 'message'>>) =>
      addNotification({ ...options, type: 'info', message }),
    [addNotification]
  );

  return {
    notifications,
    addNotification,
    removeNotification,
    success,
    error,
    warning,
    info,
  };
};
