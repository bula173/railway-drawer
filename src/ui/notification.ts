/**
 * @file notification.ts
 * @brief Notification/Toast system for user feedback
 */

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface NotificationOptions {
  duration?: number;
  action?: { label: string; callback: () => void };
}

export class NotificationManager {
  private container: HTMLElement;
  private notifications: Map<string, HTMLElement> = new Map();
  private nextId = 0;

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'notification-container';
    document.body.appendChild(this.container);
  }

  show(message: string, type: NotificationType = 'info', options: NotificationOptions = {}): string {
    const id = `notification-${this.nextId++}`;
    const duration = options.duration ?? (type === 'error' ? 6000 : type === 'success' ? 3000 : 5000);

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.setAttribute('role', 'status');
    notification.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

    const content = document.createElement('div');
    content.className = 'notification-content';
    content.textContent = message;

    notification.appendChild(content);

    if (options.action) {
      const actionBtn = document.createElement('button');
      actionBtn.className = 'notification-action';
      actionBtn.textContent = options.action.label;
      actionBtn.onclick = () => {
        options.action?.callback();
        this.dismiss(id);
      };
      notification.appendChild(actionBtn);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'notification-close';
    closeBtn.innerHTML = '✕';
    closeBtn.onclick = () => this.dismiss(id);
    notification.appendChild(closeBtn);

    this.container.appendChild(notification);
    this.notifications.set(id, notification);

    // Animate in
    requestAnimationFrame(() => {
      notification.classList.add('show');
    });

    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }

    return id;
  }

  dismiss(id: string): void {
    const notification = this.notifications.get(id);
    if (notification) {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.remove();
        this.notifications.delete(id);
      }, 300);
    }
  }

  info(message: string, options?: NotificationOptions): string {
    return this.show(message, 'info', options);
  }

  success(message: string, options?: NotificationOptions): string {
    return this.show(message, 'success', options);
  }

  warning(message: string, options?: NotificationOptions): string {
    return this.show(message, 'warning', options);
  }

  error(message: string, options?: NotificationOptions): string {
    return this.show(message, 'error', options);
  }

  destroy(): void {
    this.container.remove();
    this.notifications.clear();
  }
}

export const globalNotificationManager = new NotificationManager();
