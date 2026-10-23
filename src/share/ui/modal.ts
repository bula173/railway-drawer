/**
 * @file modal.ts
 * @brief The share dialogs' modal (header with ✕, body, footer; `.rd-share-*` classes) on the app's
 *        one modal primitive (core/modal.ts): role="dialog" + aria-modal + aria-labelledby, focus
 *        trap, Escape and the overlay close it, focus returns to the opener, keys stay away from
 *        the diagram shortcuts.
 */
import '../share.css';
import { openModal as openAppModalBehaviour } from '../../core/modal';

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

export function openModal(opts: { title: string; testId?: string; className?: string }): Modal {
  const overlay = el('div', 'rd-share-overlay');
  const dialog = el('div', `rd-share-modal${opts.className ? ` ${opts.className}` : ''}`);
  const header = el('div', 'rd-share-modal-header');
  const title = el('h2', 'rd-share-modal-title', opts.title);
  const closeBtn = button('✕', 'rd-share-close');
  closeBtn.setAttribute('aria-label', 'Close');
  header.append(title, closeBtn);
  const body = el('div', 'rd-share-modal-body');
  const footer = el('div', 'rd-share-modal-footer');
  dialog.append(header, body, footer);
  overlay.appendChild(dialog);
  // behaviour: the app's one modal primitive (Escape and the backdrop close it)
  const handle = openAppModalBehaviour({ overlay, dialog, labelledBy: title, testId: opts.testId });
  closeBtn.addEventListener('click', () => handle.close());
  return {
    overlay,
    dialog,
    body,
    footer,
    get closed() {
      return handle.closed;
    },
    close: () => handle.close(),
    onClose: (callback) => handle.onClose(callback),
  };
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
