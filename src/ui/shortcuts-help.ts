/**
 * @file shortcuts-help.ts
 * @brief Help > Keyboard Shortcuts (and F1): the app's real bindings, grouped by menu, in the
 *        themed modal (app-dialogs.ts). Opened by F1 and by the window event
 *        `shortcuts-help-request` (MenuController, data-action="shortcuts").
 */
import { off, on } from '../core/event-bus';
import { openAppModal, otherDialogOpen, type AppModal } from './app-dialogs';
import { ACTION_SHORTCUTS, formatShortcut, isMacPlatform, type ShortcutSpec } from './shortcut-keys';
import { STATE_SHORTCUTS } from '../railway/state-shortcuts';

export interface ShortcutRow {
  keys: string;
  description: string;
}

export interface ShortcutSection {
  section: string;
  items: ShortcutRow[];
}

/** The shortcut sections (exported for tests); keys formatted for this platform. */
export function shortcutSections(mac: boolean = isMacPlatform()): ShortcutSection[] {
  const k = (action: string): string => formatShortcut(ACTION_SHORTCUTS[action], mac);
  const f = (spec: ShortcutSpec): string => formatShortcut(spec, mac);
  const click = mac ? '⌘+Click' : 'Ctrl+Click';
  return [
    {
      section: 'File',
      items: [{ keys: k('save'), description: 'Save (download the .drawio file, or save back to GitLab/SharePoint)' }],
    },
    {
      section: 'Edit',
      items: [
        { keys: k('undo'), description: 'Undo' },
        { keys: `${k('redo')} / ${f({ mod: true, shift: true, key: 'Z' })}`, description: 'Redo' },
        { keys: k('cut'), description: 'Cut' },
        { keys: k('copy'), description: 'Copy' },
        { keys: k('paste'), description: 'Paste' },
        { keys: k('duplicate'), description: 'Duplicate' },
        { keys: 'Delete / Backspace', description: 'Delete the selection' },
        { keys: k('selectAll'), description: 'Select all' },
        { keys: k('selectVertices'), description: 'Select vertices (shapes)' },
        { keys: k('selectEdges'), description: 'Select edges (connectors)' },
        { keys: k('selectNone'), description: 'Select none' },
        { keys: 'Esc', description: 'Clear the selection' },
        { keys: 'Arrow keys', description: 'Move the selection by 1 px' },
        { keys: 'Shift+Arrow keys', description: 'Move the selection by the grid size' },
      ],
    },
    {
      section: 'View',
      items: [
        { keys: k('zoomIn'), description: 'Zoom in' },
        { keys: k('zoomOut'), description: 'Zoom out' },
        { keys: k('zoomActual'), description: 'Reset zoom (100%)' },
        { keys: k('fitWindow'), description: 'Fit to window' },
        { keys: mac ? '⌘+Scroll' : 'Ctrl+Scroll', description: 'Zoom around the pointer (also pinch)' },
        { keys: 'Scroll / Shift+Scroll', description: 'Scroll the canvas vertically / horizontally' },
        { keys: 'Drag on empty canvas', description: 'Pan the canvas' },
        { keys: 'Space (hold) + drag / middle-drag', description: 'Pan the canvas (also over shapes)' },
        { keys: 'Shift+drag on empty canvas', description: 'Select with a rectangle (rubber band)' },
        { keys: k('toggleConnectionArrows'), description: 'Connection Arrows on/off' },
        { keys: k('toggleLeftPanel'), description: 'Shapes panel on/off' },
        { keys: k('toggleRightPanel'), description: 'Format panel on/off' },
      ],
    },
    {
      section: 'Arrange',
      items: [
        { keys: k('group'), description: 'Group' },
        { keys: k('ungroup'), description: 'Ungroup' },
        { keys: f({ mod: true, key: 'H' }), description: 'Flip horizontally' },
        { keys: f({ mod: true, key: 'J' }), description: 'Flip vertically' },
        { keys: f({ mod: true, key: 'R' }), description: 'Rotate 90° clockwise' },
        { keys: f({ mod: true, shift: true, key: 'R' }), description: 'Rotate 90° counter-clockwise' },
      ],
    },
    {
      section: 'Connection arrows (hover a shape)',
      items: [
        { keys: 'Click arrow', description: 'Connect to the shape in that direction, or add a connected copy' },
        { keys: `${click} arrow`, description: 'Always add a connected copy' },
        { keys: 'Shift+Click arrow', description: 'Connect without copying (dangling edge if nothing is there)' },
        { keys: `${mac ? '⇧⌘' : 'Ctrl+Shift'}+Click arrow`, description: 'Add a copy without an edge' },
        { keys: 'Drag arrow', description: 'Connect to the shape you drop on, or add a connected copy on blank canvas' },
        { keys: `${mac ? '⌥' : 'Alt'} (hold)`, description: 'Hide the arrows' },
      ],
    },
    {
      section: 'Object states (selected railway objects)',
      items: STATE_SHORTCUTS.map((s) => ({ keys: f({ alt: true, key: s.key }), description: s.description })),
    },
    {
      section: 'Menus',
      items: [
        { keys: 'Arrow keys', description: 'Move between menus and items' },
        { keys: 'Home / End', description: 'First / last item' },
        { keys: 'Enter / Space', description: 'Run the item' },
        { keys: 'Esc', description: 'Close the menu' },
      ],
    },
    {
      section: 'Help',
      items: [{ keys: k('shortcuts'), description: 'Keyboard shortcuts (this dialog)' }],
    },
  ];
}

export class ShortcutsHelpController {
  private modal: AppModal | null = null;
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'F1') {
      e.preventDefault();
      // never on top of another open dialog (its focus trap owns the keyboard)
      if (otherDialogOpen(this.modal?.overlay ?? null)) return;
      this.show();
    }
  };
  private readonly onRequest = (): void => this.show();

  constructor() {
    document.addEventListener('keydown', this.onKeyDown);
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
    document.removeEventListener('keydown', this.onKeyDown);
    off('shortcuts-help-request', this.onRequest);
    this.modal?.close();
    this.modal = null;
  }
}
