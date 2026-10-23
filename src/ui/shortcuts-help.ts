/**
 * @file shortcuts-help.ts
 * @brief Help > Keyboard Shortcuts (and F1): the app's real bindings, grouped by menu, in the
 *        themed modal (app-dialogs.ts). The rows are generated from the command registry
 *        (ui/commands/help.ts helpSections: each command's shortcut and help entry, plus the mouse /
 *        menu gestures). Opened by the bus event `shortcuts-help-request` (the `shortcuts`
 *        command: Help menu item and F1).
 */
import { off, on, type AppEventMap } from '../core/event-bus';
import { openAppModal, otherDialogOpen, type AppModal } from './app-dialogs';
import { isMacPlatform } from './shortcut-keys';
import { commandRegistry } from './commands/registry';
import { helpSections, type ShortcutSection } from './commands/help';

export type { ShortcutRow, ShortcutSection } from './commands/help';

/** The shortcut sections of the app's commands (exported for tests); keys formatted for this platform. */
export function shortcutSections(mac: boolean = isMacPlatform()): ShortcutSection[] {
  return helpSections(commandRegistry, mac);
}

export class ShortcutsHelpController {
  private modal: AppModal | null = null;
  private readonly onRequest = (detail: AppEventMap['shortcuts-help-request']): void => {
    // F1 never opens it on top of another open dialog (its focus trap owns the keyboard)
    if (detail?.keyboard && otherDialogOpen(this.modal?.overlay ?? null)) return;
    this.show();
  };

  constructor() {
    on('shortcuts-help-request', this.onRequest);
  }

  /** Opens the dialog (or focuses the open one). */
  show(): void {
    if (this.modal && !this.modal.closed && this.modal.overlay.isConnected) {
      this.modal.dialog.querySelector<HTMLButtonElement>('button')?.focus();
      return;
    }
    const modal = openAppModal({ title: 'Keyboard Shortcuts', testId: 'shortcuts-dialog', className: 'rd-shortcuts-dialog' });
    for (const { section, items } of shortcutSections()) {
      const heading = document.createElement('h3');
      heading.className = 'rd-shortcuts-section';
      heading.textContent = section;
      const table = document.createElement('table');
      table.className = 'rd-shortcuts-table';
      for (const { keys, description } of items) {
        const row = document.createElement('tr');
        const keyCell = document.createElement('td');
        const kbd = document.createElement('kbd');
        kbd.className = 'rd-kbd';
        kbd.textContent = keys;
        keyCell.appendChild(kbd);
        const descCell = document.createElement('td');
        descCell.textContent = description;
        row.append(keyCell, descCell);
        table.appendChild(row);
      }
      modal.body.append(heading, table);
    }
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'rd-tpl-btn rd-tpl-btn-primary';
    close.textContent = 'Close';
    close.addEventListener('click', () => modal.close());
    modal.actions.appendChild(close);
    close.focus();
    this.modal = modal;
  }

  destroy(): void {
    off('shortcuts-help-request', this.onRequest);
    this.modal?.close();
    this.modal = null;
  }
}
