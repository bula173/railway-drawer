/**
 * @file service-registry.ts
 * @brief Service locator for dependency injection
 * @details Central registry for application services, replacing window globals
 */

import type { TabManager } from '../ui/tabs';
import { NotificationManager } from '../ui/notification';
import { SaveStatusIndicator } from '../ui/save-status';

/**
 * Central service registry using Service Locator pattern
 * Replaces window.__tabManager, window.__shapeDesigner, etc.
 *
 * Usage:
 *   const tabManager = ServiceRegistry.getTabManager();
 *   const notificationMgr = ServiceRegistry.getNotificationManager();
 */
export class ServiceRegistry {
  private static instance: ServiceRegistry | null = null;
  private services: Map<string, unknown> = new Map();

  private constructor() {}

  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  /**
   * Register a service with the registry
   */
  static register<T>(key: string, service: T): void {
    ServiceRegistry.getInstance().services.set(key, service);
  }

  /**
   * Get a registered service
   */
  static get<T>(key: string): T | undefined {
    return ServiceRegistry.getInstance().services.get(key) as T | undefined;
  }

  /**
   * Check if a service is registered
   */
  static has(key: string): boolean {
    return ServiceRegistry.getInstance().services.has(key);
  }

  /**
   * Clear all registered services
   */
  static clear(): void {
    ServiceRegistry.getInstance().services.clear();
  }

  // ============= Convenience Methods =============

  static getTabManager(): TabManager | undefined {
    return ServiceRegistry.get<TabManager>('tabManager');
  }

  static setTabManager(tabManager: TabManager): void {
    ServiceRegistry.register('tabManager', tabManager);
  }

  static getNotificationManager(): NotificationManager | undefined {
    return ServiceRegistry.get<NotificationManager>('notificationManager');
  }

  static setNotificationManager(manager: NotificationManager): void {
    ServiceRegistry.register('notificationManager', manager);
  }

  static getSaveStatusIndicator(): SaveStatusIndicator | undefined {
    return ServiceRegistry.get<SaveStatusIndicator>('saveStatusIndicator');
  }

  static setSaveStatusIndicator(indicator: SaveStatusIndicator): void {
    ServiceRegistry.register('saveStatusIndicator', indicator);
  }
}

/**
 * Alias for convenience
 */
export const ServiceLocator = ServiceRegistry;
