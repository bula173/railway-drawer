/** core/confirm.ts: the lower layers ask through askConfirm; the UI shell's dialog answers. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { askConfirm, setConfirmProvider } from '../confirm';

describe('askConfirm', () => {
  afterEach(() => setConfirmProvider(null));

  it('asks the registered provider', async () => {
    const provider = vi.fn(async () => true);
    setConfirmProvider(provider);
    await expect(askConfirm({ title: 'Replace the script', confirmLabel: 'Replace' })).resolves.toBe(true);
    expect(provider).toHaveBeenCalledWith({ title: 'Replace the script', confirmLabel: 'Replace' });
  });

  it('confirms nothing without a UI', async () => {
    await expect(askConfirm({ title: 'x' })).resolves.toBe(false);
  });

  it('the app dialog registers itself when ui/app-dialogs.ts loads', async () => {
    await import('../../ui/app-dialogs');
    const answer = askConfirm({ title: 'Delete?', testId: 'probe-confirm' });
    const dialog = document.querySelector<HTMLElement>('[data-testid="probe-confirm"]');
    expect(dialog).not.toBeNull();
    dialog!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await expect(answer).resolves.toBe(false);
  });
});
