/**
 * @file template-dialogs.ts
 * @brief Small modal dialogs of the Templates feature: name + description prompt and a confirm.
 *
 * Enter confirms, Escape cancels. While a dialog is open its window-level capture listener stops
 * key events from reaching the app's shortcut dispatcher (Delete, Ctrl+Z, ... on the diagram).
 */
import './templates.css';
import { MAX_TEMPLATE_DESCRIPTION, MAX_TEMPLATE_NAME } from './template-store';

export interface TemplateDetails {
  name: string;
  description: string;
}

export interface TemplateDetailsOptions {
  heading: string;
  /** Line under the heading (e.g. "3 selected shapes"). */
  hint?: string;
  name?: string;
  description?: string;
  confirmLabel?: string;
  /** Placeholder of the name field (default: a template example). */
  namePlaceholder?: string;
  /** Label of the dialog (default: the heading). */
  label?: string;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

interface ModalParts {
  overlay: HTMLElement;
  dialog: HTMLElement;
  actions: HTMLElement;
  close: () => void;
}

function openModal(heading: string, onKey: (evt: KeyboardEvent) => void, label: string): ModalParts {
  const previousFocus = document.activeElement as HTMLElement | null;
  const overlay = el('div', 'rd-tpl-modal-overlay');
  const dialog = el('div', 'rd-tpl-modal');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', label);
  const title = el('h2', 'rd-tpl-modal-title', heading);
  const actions = el('div', 'rd-tpl-modal-actions');
  dialog.append(title);
  overlay.appendChild(dialog);
  const keyListener = (evt: KeyboardEvent): void => {
    // Typing in the dialog must not trigger diagram shortcuts (document capture listener)
    evt.stopPropagation();
    onKey(evt);
  };
  window.addEventListener('keydown', keyListener, true);
  document.body.appendChild(overlay);
  return {
    overlay,
    dialog,
    actions,
    close: () => {
      window.removeEventListener('keydown', keyListener, true);
      overlay.remove();
      previousFocus?.focus?.();
    },
  };
}

/** Asks for a template name (required) and description. Resolves null when cancelled. */
export function promptTemplateDetails(opts: TemplateDetailsOptions): Promise<TemplateDetails | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (value: TemplateDetails | null): void => {
      if (done) return;
      done = true;
      modal.close();
      resolve(value);
    };
    const submit = (): void => {
      const name = nameInput.value.trim();
      if (!name) {
        error.textContent = 'Please enter a name.';
        error.hidden = false;
        nameInput.setAttribute('aria-invalid', 'true');
        nameInput.focus();
        return;
      }
      finish({ name, description: descInput.value.trim() });
    };
    const modal = openModal(
      opts.heading,
      (evt) => {
        if (evt.key === 'Escape') {
          evt.preventDefault();
          finish(null);
        } else if (evt.key === 'Enter' && !evt.isComposing && !(evt.target instanceof HTMLButtonElement)) {
          evt.preventDefault();
          submit();
        }
      },
      opts.label ?? opts.heading
    );
    if (opts.hint) modal.dialog.appendChild(el('p', 'rd-tpl-modal-hint', opts.hint));

    const nameLabel = el('label', 'rd-tpl-modal-label', 'Name');
    const nameInput = el('input', 'rd-tpl-modal-input');
    nameInput.type = 'text';
    nameInput.name = 'template-name';
    nameInput.maxLength = MAX_TEMPLATE_NAME;
    nameInput.placeholder = opts.namePlaceholder ?? 'e.g. Station layout with 2 points';
    nameInput.value = opts.name ?? '';
    nameInput.required = true;
    nameLabel.appendChild(nameInput);

    const descLabel = el('label', 'rd-tpl-modal-label', 'Description (optional)');
    const descInput = el('input', 'rd-tpl-modal-input');
    descInput.type = 'text';
    descInput.name = 'template-description';
    descInput.maxLength = MAX_TEMPLATE_DESCRIPTION;
    descInput.value = opts.description ?? '';
    descLabel.appendChild(descInput);

    const error = el('div', 'rd-tpl-modal-error');
    error.setAttribute('role', 'alert');
    error.hidden = true;
    nameInput.addEventListener('input', () => {
      error.hidden = true;
      nameInput.removeAttribute('aria-invalid');
    });

    const cancel = el('button', 'rd-tpl-btn', 'Cancel');
    cancel.type = 'button';
    cancel.addEventListener('click', () => finish(null));
    const ok = el('button', 'rd-tpl-btn rd-tpl-btn-primary', opts.confirmLabel ?? 'Save');
    ok.type = 'button';
    ok.addEventListener('click', submit);
    modal.actions.append(cancel, ok);
    modal.dialog.append(nameLabel, descLabel, error, modal.actions);
    modal.overlay.addEventListener('mousedown', (evt) => {
      if (evt.target === modal.overlay) finish(null);
    });
    nameInput.focus();
    nameInput.select();
  });
}

/** Yes/no question; resolves true on confirm. */
export function confirmTemplateDialog(message: string, confirmLabel = 'Delete'): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (value: boolean): void => {
      if (done) return;
      done = true;
      modal.close();
      resolve(value);
    };
    const modal = openModal(
      message,
      (evt) => {
        if (evt.key === 'Escape') {
          evt.preventDefault();
          finish(false);
        } else if (evt.key === 'Enter') {
          evt.preventDefault();
          finish(document.activeElement !== cancel);
        }
      },
      message
    );
    const cancel = el('button', 'rd-tpl-btn', 'Cancel');
    cancel.type = 'button';
    cancel.addEventListener('click', () => finish(false));
    const ok = el('button', 'rd-tpl-btn rd-tpl-btn-danger', confirmLabel);
    ok.type = 'button';
    ok.addEventListener('click', () => finish(true));
    modal.actions.append(cancel, ok);
    modal.dialog.append(modal.actions);
    modal.overlay.addEventListener('mousedown', (evt) => {
      if (evt.target === modal.overlay) finish(false);
    });
    ok.focus();
  });
}
