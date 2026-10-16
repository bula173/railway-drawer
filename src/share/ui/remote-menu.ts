/**
 * @file remote-menu.ts
 * @brief Small popup menu (status bar "Stored in:" item: Reload / Unlink / Open in browser).
 */
import { el } from './modal';

export type PopupMenuItem =
  | { label: string; action: string; onSelect: () => void }
  | { label: string; action: string; href: string }
  | { note: string };

let openMenu: { close(): void } | null = null;

/** Opens the menu above `anchor` (bottom-aligned for the status bar); returns its close function. */
export function openPopupMenu(anchor: HTMLElement, items: PopupMenuItem[]): () => void {
  openMenu?.close();
  const menu = el('div', 'rd-remote-menu');
  menu.setAttribute('role', 'menu');
  menu.dataset.testid = 'remote-status-menu';
  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    menu.remove();
    document.removeEventListener('mousedown', onOutside, true);
    window.removeEventListener('keydown', onKey, true);
    if (openMenu === handle) openMenu = null;
  };
  const handle = { close };
  const onOutside = (evt: MouseEvent): void => {
    if (!menu.contains(evt.target as Node) && !anchor.contains(evt.target as Node)) close();
  };
  const onKey = (evt: KeyboardEvent): void => {
    if (evt.key === 'Escape') {
      evt.preventDefault();
      evt.stopPropagation();
      close();
      anchor.focus?.();
    }
  };

  for (const item of items) {
    if ('note' in item) {
      menu.appendChild(el('div', 'rd-remote-menu-note', item.note));
      continue;
    }
    let node: HTMLElement;
    if ('href' in item) {
      const link = el('a', 'rd-remote-menu-item', item.label);
      link.href = item.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.addEventListener('click', () => close());
      node = link;
    } else {
      const btn = el('button', 'rd-remote-menu-item', item.label);
      btn.type = 'button';
      btn.addEventListener('click', () => {
        close();
        item.onSelect();
      });
      node = btn;
    }
    node.setAttribute('role', 'menuitem');
    node.dataset.remoteAction = item.action;
    menu.appendChild(node);
  }

  document.body.appendChild(menu);
  const rect = anchor.getBoundingClientRect();
  const width = menu.offsetWidth || 220;
  menu.style.left = `${Math.max(4, Math.min(rect.left, window.innerWidth - width - 4))}px`;
  menu.style.bottom = `${Math.max(4, window.innerHeight - rect.top + 4)}px`;
  document.addEventListener('mousedown', onOutside, true);
  window.addEventListener('keydown', onKey, true);
  openMenu = handle;
  menu.querySelector<HTMLElement>('.rd-remote-menu-item')?.focus();
  return close;
}
