/**
 * @file commands.ts
 * @brief Boot step (main-editor.ts): the commands run on the TabManager's active tab and the one
 *        keyboard dispatcher is installed (ui/commands). The commands themselves are registered by
 *        bootShell (menu hints and toolbar tooltips need them before the chrome is decorated).
 */
import type { TabManager } from '../ui/tabs';
import { appKeymap, commandRegistry } from '../ui/commands';
import type { ScenariosHandle } from '../scenarios/install-scenarios';

/** The one keyboard dispatcher on the active tab, the scenario view's keys first. */
export function bootKeyboard(tabManager: TabManager, scenarios: Pick<ScenariosHandle, 'handleKeydown'>): void {
  /**
   * @brief The one keyboard dispatcher (ui/commands/keymap.ts)
   * @details Every shortcut is a key binding of a registered command (ui/commands/*.ts) and runs once,
   * on the active tab: Ctrl/Cmd+S also while typing; the graph shortcuts not while the user types
   * (shouldIgnoreGraphShortcut), nor on the menus. The scenario view takes ←/→/Home/End/Esc first and
   * blocks the editing shortcuts (the drawing is hidden).
   */
  commandRegistry.setActiveTabProvider(() => tabManager.getActiveTab());
  appKeymap.addInterceptor((e) => scenarios.handleKeydown(e));
  appKeymap.install();
}
