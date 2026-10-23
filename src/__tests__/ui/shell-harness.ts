/**
 * @file shell-harness.ts
 * @brief The shell's command wiring for unit tests that drive the real DOM (loadAppDom): the app
 *        commands on `getActiveTab`, the keymap, the menu bar and the toolbar's command buttons,
 *        as main-editor.ts installs them.
 */
import { installCommands } from '../../ui/commands';
import { installMenuBar } from '../../ui/menu';
import { bindCommandButtons } from '../../ui/toolbar';
import type { TabData } from '../../ui/tabs';

/** Installs the shell wiring; returns the uninstaller of the keymap (the DOM bindings go with the DOM). */
export function installShellForTest(getActiveTab: () => TabData | null): () => void {
  const uninstall = installCommands(getActiveTab);
  installMenuBar();
  bindCommandButtons(document);
  return uninstall;
}
