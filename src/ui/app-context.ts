/**
 * @file app-context.ts
 * @brief The application's shell objects, provided once by main-editor.ts, instead of `window`
 *        globals (`window.__leftPanelTabs`, `window.__saveStatusIndicator`).
 *
 * Code that is created per tab (MenuController, ...) or deep inside the shell reads it with
 * appContext(); install functions get what they need as parameters. Absent (null) until
 * main-editor.ts has built the shell, and in unit tests that do not provide one.
 */
import type { TabManager } from './tabs';
import type { NotificationManager } from './notification';
import type { SaveStatusIndicator } from './save-status';
import type { LeftPanelTabs } from './left-panel-tabs';

export interface AppContext {
  readonly tabManager: TabManager;
  readonly notify: NotificationManager;
  readonly saveStatus: SaveStatusIndicator;
  readonly leftPanelTabs: LeftPanelTabs;
}

let current: AppContext | null = null;

/** Sets the application context (main-editor.ts, once the shell exists; tests). */
export function provideAppContext(context: AppContext | null): void {
  current = context;
}

/** The application context, or null before main-editor.ts provided it. */
export function appContext(): AppContext | null {
  return current;
}
