/**
 * @file service-registry.ts
 * @brief Service locator for dependency injection
 * @details Central registry for application services, replacing window globals
 */

import type { AppServices } from './app-services';

export type { AppServices };

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

  static getTabManager(): AppServices['tabManager'] | undefined {
    return ServiceRegistry.get<AppServices['tabManager']>('tabManager');
  }

  static setTabManager(tabManager: AppServices['tabManager']): void {
    ServiceRegistry.register('tabManager', tabManager);
  }

  static getNotificationManager(): AppServices['notificationManager'] | undefined {
    return ServiceRegistry.get<AppServices['notificationManager']>('notificationManager');
  }

  static setNotificationManager(manager: AppServices['notificationManager']): void {
    ServiceRegistry.register('notificationManager', manager);
  }

  static getSaveStatusIndicator(): AppServices['saveStatusIndicator'] | undefined {
    return ServiceRegistry.get<AppServices['saveStatusIndicator']>('saveStatusIndicator');
  }

  static setSaveStatusIndicator(indicator: AppServices['saveStatusIndicator']): void {
    ServiceRegistry.register('saveStatusIndicator', indicator);
  }
}
