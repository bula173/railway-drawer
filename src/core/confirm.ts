/**
 * @file confirm.ts
 * @brief A yes/no question to the user for the lower layers: features ask through `askConfirm`, the
 *        UI shell provides the themed dialog (ui/app-dialogs.ts registers `confirmDialog` when it
 *        loads, at boot), so a feature never imports the shell for it.
 */

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button (deleting, discarding). */
  danger?: boolean;
  testId?: string;
}

export type ConfirmProvider = (opts: ConfirmOptions) => Promise<boolean>;

let provider: ConfirmProvider | null = null;

/** The shell's dialog (ui/app-dialogs.ts). */
export function setConfirmProvider(next: ConfirmProvider | null): void {
  provider = next;
}

/** Asks the question; resolves true on confirm. Without a provider (no UI) nothing is confirmed. */
export function askConfirm(opts: ConfirmOptions): Promise<boolean> {
  return provider ? provider(opts) : Promise.resolve(false);
}
