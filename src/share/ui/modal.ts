/**
 * @file modal.ts
 * @brief Accessible modal for the share dialogs: role="dialog" + aria-modal + aria-labelledby,
 *        focus moves in and is trapped (Tab/Shift+Tab), Escape and the overlay close it, focus
 *        returns to the opener. A window capture listener keeps key presses away from the app's
 *        diagram shortcuts (Delete, Ctrl+Z, ...) while it is open.
 */
import '../share.css';

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(label: string, className = 'rd-share-btn', onClick?: () => void): HTMLButtonElement {
  const btn = el('button', className, label);
  btn.type = 'button';
  if (onClick) btn.addEventListener('click', onClick);
  return btn;
}

export interface Modal {
  overlay: HTMLElement;
  dialog: HTMLElement;
  body: HTMLElement;
  footer: HTMLElement;
  /** Closes (once); runs the onClose callbacks. */
  close(): void;
  onClose(callback: () => void): void;
  readonly closed: boolean;
}

let modalCounter = 0;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function openModal(opts: { title: string; testId?: string; className?: string }): Modal {
  const previousFocus = document.activeElement as HTMLElement | null;
  const id = `rd-share-modal-${++modalCounter}`;
  const overlay = el('div', 'rd-share-overlay');
  const dialog = el('div', `rd-share-modal${opts.className ? ` ${opts.className}` : ''}`);
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', `${id}-title`);
  if (opts.testId) dialog.dataset.testid = opts.testId;
  const header = el('div', 'rd-share-modal-header');
  const title = el('h2', 'rd-share-modal-title', opts.title);
  title.id = `${id}-title`;
  const closeBtn = button('✕', 'rd-share-close');
  closeBtn.setAttribute('aria-label', 'Close');
  header.append(title, closeBtn);
  const body = el('div', 'rd-share-modal-body');
  const footer = el('div', 'rd-share-modal-footer');
  dialog.append(header, body, footer);
  overlay.appendChild(dialog);

  const callbacks: Array<() => void> = [];
  let closed = false;

  const focusables = (): HTMLElement[] =>
    Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((node) => !node.closest('[hidden]'));

  const keyListener = (evt: KeyboardEvent): void => {
    if (!overlay.isConnected) return;
    // Only the topmost dialog handles keys
    const overlays = document.querySelectorAll('.rd-share-overlay');
    if (overlays[overlays.length - 1] !== overlay) return;
    evt.stopPropagation();
    if (evt.key === 'Escape') {
      evt.preventDefault();
      modal.close();
    } else if (evt.key === 'Tab') {
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (evt.shiftKey && (active === first || !dialog.contains(active))) {
        evt.preventDefault();
        last.focus();
      } else if (!evt.shiftKey && (active === last || !dialog.contains(active))) {
        evt.preventDefault();
        first.focus();
      }
    }
  };

  const modal: Modal = {
    overlay,
    dialog,
    body,
    footer,
    get closed() {
      return closed;
    },
    close() {
      if (closed) return;
      closed = true;
      window.removeEventListener('keydown', keyListener, true);
      overlay.remove();
      callbacks.forEach((cb) => cb());
      if (previousFocus && previousFocus.isConnected) previousFocus.focus?.();
    },
    onClose(callback) {
      callbacks.push(callback);
    },
  };

  closeBtn.addEventListener('click', () => modal.close());
  overlay.addEventListener('mousedown', (evt) => {
    if (evt.target === overlay) modal.close();
  });
  window.addEventListener('keydown', keyListener, true);
  document.body.appendChild(overlay);
  return modal;
}

/** Copies text; falls back to a selected textarea + execCommand on plain-http pages. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // permission denied: try the fallback
  }
  const area = el('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

/** Downloads a blob as `filename`. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** File-name-safe version of a title. */
export function safeFileName(name: string, fallback = 'diagram'): string {
  let cleaned = '';
  for (const ch of name) cleaned += ch.charCodeAt(0) < 32 || '\\/:*?"<>|#%'.includes(ch) ? ' ' : ch;
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return (cleaned || fallback).slice(0, 120);
}
