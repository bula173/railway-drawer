import React from 'react';
import type { Notification } from '../hooks/useNotification';

interface NotificationDisplayProps {
  notifications: Notification[];
  onRemove: (id: string) => void;
}

export const NotificationDisplay: React.FC<NotificationDisplayProps> = ({
  notifications,
  onRemove,
}) => {
  const getBackgroundColor = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return '#4caf50';
      case 'error':
        return '#f44336';
      case 'warning':
        return '#ff9800';
      case 'info':
      default:
        return '#2196f3';
    }
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
      default:
        return 'ℹ';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {notifications.map(notification => (
        <div
          key={notification.id}
          style={{
            backgroundColor: getBackgroundColor(notification.type),
            color: 'white',
            padding: '16px',
            marginBottom: '12px',
            borderRadius: '4px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            pointerEvents: 'auto',
            maxWidth: '400px',
            animation: 'slideIn 0.3s ease-out',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ fontSize: '20px', lineHeight: '1.5', flexShrink: 0 }}>
              {getIcon(notification.type)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                {notification.message}
              </div>
              {notification.details && (
                <div style={{ fontSize: '12px', opacity: 0.9 }}>
                  {notification.details}
                </div>
              )}
              {notification.action && (
                <button
                  onClick={() => {
                    notification.action?.onClick();
                    onRemove(notification.id);
                  }}
                  style={{
                    marginTop: '8px',
                    padding: '6px 12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    border: '1px solid rgba(255, 255, 255, 0.4)',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '600',
                  }}
                >
                  {notification.action.label}
                </button>
              )}
            </div>
            <button
              onClick={() => onRemove(notification.id)}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: '20px',
                padding: '0',
                lineHeight: '1.5',
                opacity: 0.7,
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.opacity = '1';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.opacity = '0.7';
              }}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};
