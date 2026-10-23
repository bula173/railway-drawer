/**
 * @file modal.ts
 * @brief The one modal dialog primitive of the app: behaviour only, on the caller's overlay and
 *        dialog elements (so each dialog keeps its own DOM classes, used by tests and the contrast
 *        audits). ui/app-dialogs.ts openAppModal (the themed `.rd-tpl-modal` look) is built on it;
 *        the share, template, railML, route table, Railway Script, scenario, user library, shape
 *        designer, image upload and duplicate dialogs use it directly (it lives in core so the
 *        feature layers may).
 *
 * It gives a dialog: role="dialog" + aria-modal + aria-labelledby (its title) or aria-label; the
 * overlay appended to the page; a focus trap (Tab / Shift+Tab stay inside); Escape = cancel, Enter
 * outside buttons / links / text areas = submit, both only for the topmost open modal (stacking);
 * a press on the backdrop = cancel; keys inside never reach the app's shortcuts (window capture
 * listener, stopPropagation); the focus goes back to the element that had it when it closes.
 * The other dialog code (otherDialogOpen, F1) sees it as `[aria-modal="true"]`.
 *
 * openFloatingPanel is the non-modal variant for floating UI that leaves the app usable (the start
 * card, the route tool panel): role + label, Escape (only while no modal is open), focus return.
 * The More shapes dialog is a modal (openModal on its own backdrop).
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalOptions {
  /** The backdrop element (the caller's classes); appended to `container` by openModal. */
  overlay: HTMLElement;
  /** The dialog element inside the overlay. */
  dialog: HTMLElement;
  /** The title: aria-labelledby (an id is assigned when it has none). */
  labelledBy?: HTMLElement | null;
  /** aria-label when there is no title element. */
  label?: string;
  /** data-testid of the dialog. */
  testId?: string;
  /** Escape and a press on the backdrop (default: close). */
  onCancel?: () => void;
  /** Enter outside buttons, links and text areas (default: nothing). */
  onSubmit?: () => void;
  /** Keys before the default handling (Escape / Enter / Tab); return true when handled. */
  onKey?: (evt: KeyboardEvent) => boolean;
  /** A press on the backdrop cancels (default true). */
  closeOnBackdrop?: boolean;
  /** The backdrop event that cancels: 'mousedown' (default) or 'click'. */
  backdropEvent?: 'mousedown' | 'click';
  /** Tab / Shift+Tab stay in the dialog (default true). */
  trapFocus?: boolean;
  /**
   * Where the overlay goes (default document.body); null: the caller has placed it. A dialog that is
   * shown again opens a new modal on the same elements (close() removes the overlay from the page).
   */
  container?: HTMLElement | null;
}

export interface ModalHandle {
  readonly overlay: HTMLElement;
  readonly dialog: HTMLElement;
  readonly closed: boolean;
  /** Removes the overlay (once), runs the onClose callbacks, gives the focus back. */
  close(): void;
  onClose(callback: () => void): void;
}

/** The open modals, the topmost last, with the release of their listeners. */
const STACK: ModalHandle[] = [];
const RELEASE = new WeakMap<ModalHandle, () => void>();

/** Drops modals whose overlay a caller removed without closing them (no close callbacks run). */
function pruneDetached(): void {
  for (const handle of [...STACK]) {
    if (!handle.overlay.isConnected) RELEASE.get(handle)?.();
  }
}
let labelCounter = 0;

/** Whether `handle` is the topmost open modal (only it handles keys). */
export function isTopModal(handle: ModalHandle): boolean {
  return STACK[STACK.length - 1] === handle;
}

/** The number of open modals (tests, diagnostics). */
export function openModalCount(): number {
  return STACK.length;
}

/** The focusable elements of `root` that are not hidden, in order. */
export function focusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((node) => !node.closest('[hidden]'));
}

/** Opens a modal over the given elements (see the file comment). */
export function openModal(opts: ModalOptions): ModalHandle {
  pruneDetached();
  const previousFocus = document.activeElement as HTMLElement | null;
  const { overlay, dialog } = opts;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  if (opts.labelledBy) {
    if (!opts.labelledBy.id) opts.labelledBy.id = `rd-modal-title-${++labelCounter}`;
    dialog.setAttribute('aria-labelledby', opts.labelledBy.id);
  } else if (opts.label) {
    dialog.setAttribute('aria-label', opts.label);
  }
  if (opts.testId) dialog.dataset.testid = opts.testId;

  const callbacks: Array<() => void> = [];
  let closed = false;
  const cancel = (): void => (opts.onCancel ? opts.onCancel() : handle.close());

  const keyListener = (evt: KeyboardEvent): void => {
    if (!overlay.isConnected || !isTopModal(handle)) return;
    // Typing in the dialog must not trigger the app's shortcuts (document listeners)
    evt.stopPropagation();
    if (opts.onKey?.(evt)) return;
    if (evt.key === 'Escape') {
      evt.preventDefault();
      cancel();
    } else if (evt.key === 'Enter' && !evt.isComposing) {
      const target = evt.target as Element | null;
      if (opts.onSubmit && !(target instanceof HTMLButtonElement) && !(target instanceof HTMLAnchorElement) && !(target instanceof HTMLTextAreaElement)) {
        evt.preventDefault();
        opts.onSubmit();
      }
    } else if (evt.key === 'Tab' && opts.trapFocus !== false) {
      const items = focusableElements(dialog);
      if (items.length === 0) {
        evt.preventDefault();
        return;
      }
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

  const handle: ModalHandle = {
    overlay,
    dialog,
    get closed() {
      return closed;
    },
    close() {
      if (closed) return;
      closed = true;
      release();
      overlay.remove();
      for (const callback of callbacks.splice(0)) callback();
      if (previousFocus && previousFocus.isConnected) previousFocus.focus?.();
    },
    onClose(callback) {
      callbacks.push(callback);
    },
  };

  const release = (): void => {
    window.removeEventListener('keydown', keyListener, true);
    overlay.removeEventListener(backdropEvent, backdropListener);
    const index = STACK.indexOf(handle);
    if (index >= 0) STACK.splice(index, 1);
  };
  const backdropListener = (evt: MouseEvent): void => {
    if (evt.target === overlay) cancel();
  };
  const backdropEvent = opts.backdropEvent ?? 'mousedown';
  if (opts.closeOnBackdrop !== false) overlay.addEventListener(backdropEvent, backdropListener);
  window.addEventListener('keydown', keyListener, true);
  STACK.push(handle);
  RELEASE.set(handle, release);
  if (opts.container !== null) (opts.container ?? document.body).appendChild(overlay);
  return handle;
}

// ---------------------------------------------------------------- non-modal floating panels

export interface FloatingPanelOptions {
  /** The panel element (the caller's classes). */
  element: HTMLElement;
  /** The title: aria-labelledby (an id is assigned when it has none). */
  labelledBy?: HTMLElement | null;
  /** aria-label when there is no title element. */
  label?: string;
  /** data-testid of the panel. */
  testId?: string;
  /** Escape (default: close). */
  onEscape?: () => void;
  /** Escape only while the focus is inside the panel (default false: anywhere on the page). */
  escapeWhenFocusedOnly?: boolean;
  /** Where the element goes (default document.body); null: the caller has placed it. */
  container?: HTMLElement | null;
  /** close() removes the element from the page (default true; false: the caller hides it). */
  removeOnClose?: boolean;
}

export interface FloatingPanelHandle {
  readonly element: HTMLElement;
  readonly closed: boolean;
  /** Releases the Escape listener (once), removes the element (removeOnClose), runs the onClose callbacks, gives the focus back when it was inside. */
  close(): void;
  onClose(callback: () => void): void;
}

/** The open floating panels, the most recent last (only it gets Escape). */
const FLOATING: FloatingPanelHandle[] = [];

/**
 * The non-modal variant (start card, route tool panel): role="dialog" without aria-modal (the app
 * stays usable, no focus trap, no backdrop), aria-labelledby / aria-label, Escape for the most
 * recent panel while no modal is open (a modal over it gets Escape first), and the focus back to the
 * element that had it at open when the focus was inside the panel at close.
 */
export function openFloatingPanel(opts: FloatingPanelOptions): FloatingPanelHandle {
  const { element } = opts;
  const previousFocus = document.activeElement as HTMLElement | null;
  element.setAttribute('role', 'dialog');
  element.removeAttribute('aria-modal');
  if (opts.labelledBy) {
    if (!opts.labelledBy.id) opts.labelledBy.id = `rd-modal-title-${++labelCounter}`;
    element.setAttribute('aria-labelledby', opts.labelledBy.id);
  } else if (opts.label) {
    element.setAttribute('aria-label', opts.label);
  }
  if (opts.testId) element.dataset.testid = opts.testId;
  const callbacks: Array<() => void> = [];
  let closed = false;

  const keyListener = (evt: KeyboardEvent): void => {
    if (evt.key !== 'Escape' || evt.defaultPrevented || evt.isComposing) return;
    pruneDetached();
    if (STACK.length > 0 || FLOATING[FLOATING.length - 1] !== handle || !element.isConnected) return;
    if (opts.escapeWhenFocusedOnly && !element.contains(document.activeElement)) return;
    evt.preventDefault();
    evt.stopPropagation();
    if (opts.onEscape) opts.onEscape();
    else handle.close();
  };

  const handle: FloatingPanelHandle = {
    element,
    get closed() {
      return closed;
    },
    close() {
      if (closed) return;
      closed = true;
      window.removeEventListener('keydown', keyListener, true);
      const index = FLOATING.indexOf(handle);
      if (index >= 0) FLOATING.splice(index, 1);
      const hadFocus = element.contains(document.activeElement);
      if (opts.removeOnClose !== false) element.remove();
      for (const callback of callbacks.splice(0)) callback();
      if (hadFocus && previousFocus && previousFocus.isConnected && !element.contains(previousFocus)) previousFocus.focus?.();
    },
    onClose(callback) {
      callbacks.push(callback);
    },
  };
  window.addEventListener('keydown', keyListener, true);
  FLOATING.push(handle);
  if (opts.container !== null) (opts.container ?? document.body).appendChild(element);
  return handle;
}

/** The number of open floating panels (tests, diagnostics). */
export function openFloatingPanelCount(): number {
  return FLOATING.length;
}
