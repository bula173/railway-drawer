/**
 * @file app-dialogs.ts
 * @brief Themed modal dialogs of the app chrome (the `.rd-tpl-modal` look of the template dialogs):
 *        Save As, confirm, message, About. They replace the native alert()/confirm()/prompt().
 *
 * Behaviour from the one modal primitive (core/modal.ts): role="dialog" + aria-modal +
 * aria-labelledby, a backdrop, focus trapped (Tab/Shift+Tab), Escape cancels, Enter submits (not on
 * buttons/links), focus returns to the opener, only the topmost dialog takes keys, and no key
 * reaches the diagram shortcuts while it is open.
 */
import './templates/templates.css';
import { APP_VERSION, BUILD_ID, BUILD_TIME } from '../config/build-id';
import { openModal } from '../core/modal';
import { setConfirmProvider, type ConfirmOptions } from '../core/confirm';


function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function btn(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', className, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

export interface AppModal {
  overlay: HTMLElement;
  dialog: HTMLElement;
  title: HTMLElement;
  /** Content between the title and the buttons. */
  body: HTMLElement;
  actions: HTMLElement;
  readonly closed: boolean;
  /** Removes the dialog (once) and gives the focus back to the element that had it. */
  close(): void;
}

export interface AppModalOptions {
  title: string;
  testId?: string;
  className?: string;
  /** Escape and a click on the backdrop (default: close). */
  onCancel?: () => void;
  /** Enter outside buttons, links and text areas (default: nothing). */
  onSubmit?: () => void;
}

/** Opens an empty themed modal; the caller fills `body` and `actions` (behaviour: core/modal.ts). */
export function openAppModal(opts: AppModalOptions): AppModal {
  const overlay = el('div', 'rd-tpl-modal-overlay');
  const dialog = el('div', `rd-tpl-modal rd-app-dialog${opts.className ? ` ${opts.className}` : ''}`);
  const title = el('h2', 'rd-tpl-modal-title', opts.title);
  const body = el('div', 'rd-app-dialog-body');
  const actions = el('div', 'rd-tpl-modal-actions');
  dialog.append(title, body, actions);
  overlay.appendChild(dialog);
  const handle = openModal({
    overlay,
    dialog,
    labelledBy: title,
    testId: opts.testId,
    onCancel: opts.onCancel ? () => opts.onCancel!() : undefined,
    onSubmit: opts.onSubmit,
  });
  return {
    overlay,
    dialog,
    title,
    body,
    actions,
    get closed() {
      return handle.closed;
    },
    close: () => handle.close(),
  };
}

/**
 * File > Save As…: asks for the file name (the project name) of the downloaded .drawio file.
 * Resolves the trimmed name, or null when cancelled.
 */
export function promptSaveAs(currentName: string): Promise<string | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (value: string | null): void => {
      if (done) return;
      done = true;
      modal.close();
      resolve(value);
    };
    const submit = (): void => {
      const name = input.value.trim().replace(/\.drawio$/i, '').trim();
      if (!name) {
        error.textContent = 'Please enter a file name.';
        error.hidden = false;
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
      }
      finish(name);
    };
    const modal = openAppModal({ title: 'Save As', testId: 'save-as-dialog', onCancel: () => finish(null), onSubmit: submit });
    const hint = el('p', 'rd-tpl-modal-hint', 'Downloads the diagram as a .drawio file to your computer. It opens in Railway Drawer and in draw.io.');
    hint.id = `${modal.title.id}-hint`;
    modal.dialog.setAttribute('aria-describedby', hint.id);
    const label = el('label', 'rd-tpl-modal-label', 'File name');
    const row = el('span', 'rd-app-dialog-file');
    const input = el('input', 'rd-tpl-modal-input');
    input.type = 'text';
    input.name = 'save-as-name';
    input.value = currentName;
    input.spellcheck = false;
    input.setAttribute('autocomplete', 'off');
    row.append(input, el('span', 'rd-app-dialog-ext', '.drawio'));
    label.appendChild(row);
    const error = el('div', 'rd-tpl-modal-error');
    error.setAttribute('role', 'alert');
    error.hidden = true;
    input.addEventListener('input', () => {
      error.hidden = true;
      input.removeAttribute('aria-invalid');
    });
    modal.body.append(hint, label, error);
    modal.actions.append(btn('Cancel', 'rd-tpl-btn', () => finish(null)), btn('Download', 'rd-tpl-btn rd-tpl-btn-primary', submit));
    input.focus();
    input.select();
  });
}

export type { ConfirmOptions };

/** Yes/no question in the themed modal; resolves true on confirm (Enter), false on cancel (Escape). */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (value: boolean): void => {
      if (done) return;
      done = true;
      modal.close();
      resolve(value);
    };
    const modal = openAppModal({ title: opts.title, testId: opts.testId ?? 'confirm-dialog', onCancel: () => finish(false), onSubmit: () => finish(true) });
    if (opts.message) modal.body.appendChild(el('p', 'rd-app-dialog-text', opts.message));
    const ok = btn(opts.confirmLabel ?? 'OK', `rd-tpl-btn ${opts.danger ? 'rd-tpl-btn-danger' : 'rd-tpl-btn-primary'}`, () => finish(true));
    modal.actions.append(btn(opts.cancelLabel ?? 'Cancel', 'rd-tpl-btn', () => finish(false)), ok);
    ok.focus();
  });
}

// the lower layers ask through core/confirm.ts askConfirm
setConfirmProvider(confirmDialog);

/** Documentation links of Help > About. */
export const ABOUT_LINKS: ReadonlyArray<{ label: string; href: string }> = [
  { label: 'User guide', href: 'https://github.com/bula173/railway-drawer#readme' },
  { label: 'Railway Script', href: 'https://github.com/bula173/railway-drawer/blob/main/docs/RAILWAY-SCRIPT.md' },
  { label: 'railML 3.2 import/export', href: 'https://github.com/bula173/railway-drawer/blob/main/docs/RAILML.md' },
  { label: 'Sharing: GitLab, SharePoint', href: 'https://github.com/bula173/railway-drawer/blob/main/docs/GITLAB.md' },
];

/** Help > About: the version and build of the status bar (config/build-id.ts) and documentation links. */
export function showAboutDialog(): AppModal {
  const modal = openAppModal({ title: 'About Railway Drawer', testId: 'about-dialog', className: 'rd-about-dialog' });
  modal.body.appendChild(
    el('p', 'rd-app-dialog-text', 'Diagram editor for railway signalling (ERTMS/ETCS) layouts. Files are draw.io compatible (.drawio).')
  );
  const facts = el('dl', 'rd-about-facts');
  const fact = (term: string, value: string, testId: string): void => {
    const dd = el('dd', undefined, value);
    dd.dataset.testid = testId;
    facts.append(el('dt', undefined, term), dd);
  };
  fact('Version', APP_VERSION, 'about-version');
  fact('Build', BUILD_ID, 'about-build');
  fact('Built', BUILD_TIME, 'about-built');
  modal.body.appendChild(facts);
  const links = el('ul', 'rd-about-links');
  for (const link of ABOUT_LINKS) {
    const li = el('li');
    const a = el('a', undefined, link.label);
    a.href = link.href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    li.appendChild(a);
    links.appendChild(li);
  }
  modal.body.appendChild(links);
  const close = btn('Close', 'rd-tpl-btn rd-tpl-btn-primary', () => modal.close());
  modal.actions.append(close);
  close.focus();
  return modal;
}

/** An open modal dialog (app dialogs, template / step editors, share, More shapes) other than `own`. */
export function otherDialogOpen(own: Element | null): boolean {
  const open = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"], .rd-tpl-modal, .rd-dp-menu[role="dialog"]'))
    .filter((el) => !el.hidden && el.isConnected && el.getClientRects().length > 0);
  return open.some((el) => !own || !own.contains(el));
}
