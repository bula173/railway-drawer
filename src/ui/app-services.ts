/**
 * @file app-services.ts
 * @brief Types of the shell's well-known services in the ServiceRegistry (declaration merging into
 *        services/service-registry.ts, which must not import the UI layer).
 */
import type { TabManager } from './tabs';
import type { NotificationManager } from './notification';
import type { SaveStatusIndicator } from './save-status';

declare module '../services/app-services' {
  interface AppServices {
    tabManager: TabManager;
    notificationManager: NotificationManager;
    saveStatusIndicator: SaveStatusIndicator;
  }
}

export {};
