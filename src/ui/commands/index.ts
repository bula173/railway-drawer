/**
 * @file index.ts
 * @brief The app's commands (registered once by main-editor.ts) and the registry / keymap API.
 *
 * Registration order is the dispatch order of key bindings that share a key (edit.startEditing
 * before view.panStart: Space on one selected shape starts label editing, not pan mode).
 */
import { commandRegistry, type CommandRegistry } from './registry';
import { Keymap } from './keymap';
import { fileCommands } from './file';
import { editCommands } from './edit';
import { viewCommands } from './view';
import { arrangeCommands } from './arrange';
import { railwayCommands } from './railway';
import { railmlCommands, scenarioCommands, scriptCommands, shareCommands } from './features';
import { helpCommands } from './help';
import type { TabData } from '../tabs';

export { commandRegistry, CommandRegistry } from './registry';
export { Keymap } from './keymap';
export type { Command, CommandContext, CommandSource, ContextMenuTarget, KeyBinding } from './types';

/** All app commands, in registration (= key dispatch) order. */
export const APP_COMMANDS = [
  ...fileCommands,
  ...editCommands,
  ...viewCommands,
  ...arrangeCommands,
  ...railwayCommands,
  ...scenarioCommands,
  ...scriptCommands,
  ...railmlCommands,
  ...shareCommands,
  ...helpCommands,
];

/** Registers the app commands into `registry` (once). */
export function registerAppCommands(registry: CommandRegistry = commandRegistry): void {
  if (registry.has('save')) return;
  registry.register(APP_COMMANDS);
}

/** The app keymap over the app registry (installed once by main-editor.ts). */
export const appKeymap = new Keymap(commandRegistry);

/**
 * Registers the commands, points them at the active tab of `getActiveTab` and installs the one
 * keyboard dispatcher (main-editor.ts; unit tests with a TabManager).
 */
export function installCommands(getActiveTab: () => TabData | null): () => void {
  registerAppCommands(commandRegistry);
  commandRegistry.setActiveTabProvider(getActiveTab);
  return appKeymap.install();
}
