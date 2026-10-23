/**
 * The one modal primitive (core/modal.ts): dialog semantics, focus trap, Escape / Enter, stacking,
 * backdrop, focus return, keys kept from the page, custom keys first.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openModal, openModalCount, isTopModal, type ModalOptions } from '../modal';

function parts(): { overlay: HTMLElement; dialog: HTMLElement; title: HTMLElement; first: HTMLButtonElement; input: HTMLInputElement; last: HTMLButtonElement } {
  const overlay = document.createElement('div');
  overlay.className = 'my-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'my-dialog';
  const title = document.createElement('h2');
  title.textContent = 'Title';
  const first = document.createElement('button');
  const input = document.createElement('input');
  const last = document.createElement('button');
  dialog.append(title, first, input, last);
  overlay.append(dialog);
  return { overlay, dialog, title, first, input, last };
}

const key = (target: EventTarget, k: string, init: KeyboardEventInit = {}): KeyboardEvent => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
};

describe('openModal', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function open(extra: Partial<ModalOptions> = {}) {
    const p = parts();
    const handle = openModal({ overlay: p.overlay, dialog: p.dialog, labelledBy: p.title, testId: 'probe', ...extra });
    return { ...p, handle };
  }

  it('is a labelled modal dialog appended to the page, keeping the caller classes', () => {
    const { overlay, dialog, title, handle } = open();
    expect(overlay.isConnected).toBe(true);
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe(title.id);
    expect(title.id).not.toBe('');
    expect(dialog.dataset.testid).toBe('probe');
    expect(dialog.className).toBe('my-dialog');
    handle.close();
    expect(overlay.isConnected).toBe(false);
    expect(handle.closed).toBe(true);
  });

  it('Escape cancels, Enter submits outside buttons, keys do not reach the page, Tab is trapped', () => {
    const onCancel = vi.fn();
    const onSubmit = vi.fn();
    const page = vi.fn();
    document.addEventListener('keydown', page);
    const { first, input, last, handle } = open({ onCancel, onSubmit });
    input.focus();
    expect(key(input, 'Enter').defaultPrevented).toBe(true);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    key(first, 'Enter');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    key(input, 'Escape');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(page).not.toHaveBeenCalled();
    last.focus();
    expect(key(last, 'Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
    expect(key(first, 'Tab', { shiftKey: true }).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
    handle.close();
    document.removeEventListener('keydown', page);
  });

  it('only the topmost modal takes keys; closing returns the focus to the opener', () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const base = openModalCount();
    const cancelLower = vi.fn();
    const lower = open({ onCancel: cancelLower });
    lower.input.focus();
    const upper = open();
    expect(openModalCount()).toBe(base + 2);
    expect(isTopModal(upper.handle)).toBe(true);
    key(document.body, 'Escape');
    expect(upper.handle.closed).toBe(true);
    expect(cancelLower).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(lower.input);
    lower.handle.close();
    expect(document.activeElement).toBe(opener);
    expect(openModalCount()).toBe(base);
  });

  it('backdrop press cancels (mousedown or click), not inside the dialog; custom keys come first', () => {
    const onCancel = vi.fn();
    const onKey = vi.fn((e: KeyboardEvent) => e.key === 'Escape');
    const { overlay, dialog, handle } = open({ onCancel, onKey, backdropEvent: 'click' });
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onCancel).not.toHaveBeenCalled();
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    key(dialog, 'Escape');
    expect(onKey).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
    handle.close();
  });

  it('runs onClose callbacks once; an overlay removed without close() is released on the next open', () => {
    const closed = vi.fn();
    const a = open();
    a.handle.onClose(closed);
    a.handle.close();
    a.handle.close();
    expect(closed).toHaveBeenCalledTimes(1);
    const base = openModalCount();
    const stale = open();
    stale.overlay.remove();
    const fresh = open();
    expect(openModalCount()).toBe(base + 1);
    expect(isTopModal(fresh.handle)).toBe(true);
    fresh.handle.close();
  });
});
