/**
 * @file tabs.ts
 * @brief Boot step 2 (main-editor.ts): the theme, the TabManager with its session views, the tabs of
 *        the browser cache (or a first "Diagram 1"), the top-bar project name and the status bar's
 *        version. Returns the TabManager the later steps work with.
 */
import { TabManager } from '../ui/tabs';
import { CacheService } from '../services/cache-service';
import { ProjectNameEditor } from '../ui/project-name-editor';
import { APP_VERSION, BUILD_ID, BUILD_TIME } from '../config/build-id';
import { globalNotificationManager } from '../ui/notification';
import { globalSaveStatusIndicator } from '../ui/save-status';
import { ServiceRegistry } from '../services/service-registry';
import { globalErrorHandler } from '../services/error-handler';
import { installDarkModeToggle } from '../drawio-shapes/theme/dark-mode';

/** Theme, TabManager (+ service registry), the restored or a new first tab, project name editor, status bar version. */
export function bootTabs(): TabManager {
  /**
   * @brief Initialize tab manager for multi-diagram support
   * @details Manages multiple diagram tabs, allowing users to create, switch,
   * save, and load different diagrams within the same session.
   * The active tab provides access to the graph instance and command services.
   */
  installDarkModeToggle();
  const tabManager = new TabManager('tabs-container', 'graph-container');
  // Register with service registry instead of polluting window object
  ServiceRegistry.setTabManager(tabManager);
  ServiceRegistry.setNotificationManager(globalNotificationManager);
  ServiceRegistry.setSaveStatusIndicator(globalSaveStatusIndicator);
  // Register error handler (it's active via global event listeners)
  ServiceRegistry.register('errorHandler', globalErrorHandler);

  /**
   * @brief Restore previous session from cache or create new diagram
   * @details If the application was previously used, restores all tabs and their
   * content from browser cache. Otherwise, creates a new empty diagram for the user.
   */
  try {
    if (CacheService.exists()) {
      // Read before restoring: autosave clears the marker once a save succeeds again
      const staleSince = CacheService.getStaleSince();
      if (tabManager.restoreFromCache()) {
        if (staleSince === null) {
          globalNotificationManager.success('Restored previous diagrams');
        } else {
          // Autosave failed (e.g. storage full) after the restored snapshot was written
          globalNotificationManager.warning(
            `Restored diagrams may be out of date: autosave failed from ${new Date(staleSince).toLocaleString()}, ` +
              'so later changes were not kept.'
          );
        }
      } else {
        // Corrupt or old-version cache: CacheService dropped it
        globalNotificationManager.warning('Saved session could not be restored. Starting fresh.');
      }
    }
  } catch (error) {
    console.error('Failed to restore from cache:', error);
    globalNotificationManager.error('Failed to restore diagrams. Starting fresh.');
  }
  // Always end up with at least one tab (and so with the tab bar's "+" button)
  if (tabManager.getAllTabs().length === 0) {
    // "Diagram 1", its project (top-bar title) too
    tabManager.openNewTab();
  }

  /**
   * @brief Project name in the top bar (click to rename)
   * @details The name goes to the active tab's project (Save/Export file names) and the tab cache.
   */
  new ProjectNameEditor(tabManager);

  /**
   * @brief Set build ID and timestamp in status bar
   * @details Displays the current build identifier (git commit hash or 'dev')
   * and the build timestamp (date and time)
   */
  // One source for the status bar and Help > About (config/build-id.ts, package.json version)
  tabManager.views.statusBar.setVersion(APP_VERSION);
  tabManager.views.statusBar.setBuildId(BUILD_ID);
  tabManager.views.statusBar.setBuildDate(BUILD_TIME);
  return tabManager;
}
