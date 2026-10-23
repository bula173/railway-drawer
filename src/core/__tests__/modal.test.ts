/**
 * The one modal primitive (core/modal.ts): dialog semantics, focus trap, Escape / Enter, stacking,
 * backdrop, focus return, keys kept from the page, custom keys first.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openFloatingPanel, openFloatingPanelCount, openModal, openModalCount, isTopModal, type ModalOptions } from '../modal';

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

describe('openFloatingPanel (non-modal variant)', () => {
  const esc = (target: EventTarget = document.body): KeyboardEvent => {
    const evt = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    target.dispatchEvent(evt);
    return evt;
  };
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('is a labelled dialog without aria-modal; Esc anywhere closes it and removes it', () => {
    const panel = document.createElement('div');
    panel.className = 'my-panel';
    const title = document.createElement('h2');
    panel.appendChild(title);
    const handle = openFloatingPanel({ element: panel, labelledBy: title, testId: 'p' });
    expect(panel.isConnected).toBe(true);
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.hasAttribute('aria-modal')).toBe(false);
    expect(panel.getAttribute('aria-labelledby')).toBe(title.id);
    expect(panel.className).toBe('my-panel');
    expect(openFloatingPanelCount()).toBe(1);
    const closed = vi.fn();
    handle.onClose(closed);
    expect(esc().defaultPrevented).toBe(true);
    expect(handle.closed).toBe(true);
    expect(panel.isConnected).toBe(false);
    expect(closed).toHaveBeenCalledOnce();
    expect(openFloatingPanelCount()).toBe(0);
    expect(esc().defaultPrevented).toBe(false);
  });

  it('a modal over it gets Escape first; the most recent panel only; onEscape replaces close', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    const onA = vi.fn();
    const ha = openFloatingPanel({ element: a, label: 'A', onEscape: onA });
    const hb = openFloatingPanel({ element: b, label: 'B', container: null, removeOnClose: false });
    document.body.appendChild(b);
    const overlay = document.createElement('div');
    const dialog = document.createElement('div');
    overlay.appendChild(dialog);
    const modal = openModal({ overlay, dialog, label: 'M' });
    esc(dialog);
    expect(modal.closed).toBe(true);
    expect(hb.closed).toBe(false);
    esc();
    expect(hb.closed).toBe(true);
    expect(b.isConnected).toBe(true); // removeOnClose: false
    expect(onA).not.toHaveBeenCalled();
    esc();
    expect(onA).toHaveBeenCalledOnce();
    expect(ha.closed).toBe(false);
    ha.close();
  });

  it('gives the focus back when it was inside at close; escapeWhenFocusedOnly', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const panel = document.createElement('div');
    const inner = document.createElement('button');
    panel.appendChild(inner);
    const handle = openFloatingPanel({ element: panel, label: 'P', escapeWhenFocusedOnly: true });
    esc();
    expect(handle.closed).toBe(false);
    inner.focus();
    esc(inner);
    expect(handle.closed).toBe(true);
    expect(document.activeElement).toBe(opener);
  });
});
