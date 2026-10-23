/**
 * @file narrow-screen.ts
 * @brief Narrow screens (< NARROW_MAX_WIDTH + 1 px, e.g. phones): `body.rd-narrow` (the side panels
 *        are hidden for it, so the canvas keeps the width) and a dismissible "works best on a larger
 *        screen" banner (dismissal stored in localStorage `rd.narrowBanner.dismissed`).
 */
import './narrow-screen.css';
import { readItem, writeItem } from '../core/safe-storage';
import { STORAGE_KEYS } from '../core/storage-keys';

export const NARROW_MAX_WIDTH = 899;
export const NARROW_BANNER_KEY = STORAGE_KEYS.narrowBannerDismissed;
export const NARROW_CLASS = 'rd-narrow';

function bannerDismissed(): boolean {
  try {
    return readItem(NARROW_BANNER_KEY) === '1';
  } catch {
    return false;
  }
}

/** Installs the class and the banner; returns the uninstaller. */
export function installNarrowScreen(win: Window = window): () => void {
  const query = win.matchMedia(`(max-width: ${NARROW_MAX_WIDTH}px)`);
  const banner = document.createElement('div');
  banner.className = 'rd-narrow-banner';
  banner.setAttribute('role', 'status');
  const text = document.createElement('span');
  text.textContent = 'Railway Drawer works best on a larger screen (900 px or wider). The side panels are hidden.';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'rd-narrow-banner-close';
  close.textContent = '×';
  close.title = 'Dismiss';
  close.setAttribute('aria-label', 'Dismiss');
  banner.append(text, close);
  banner.hidden = true;
  document.body.appendChild(banner);

  const apply = (): void => {
    const narrow = query.matches;
    document.body.classList.toggle(NARROW_CLASS, narrow);
    banner.hidden = !narrow || bannerDismissed();
    win.dispatchEvent(new Event('resize'));
  };
  close.addEventListener('click', () => {
    try {
      writeItem(NARROW_BANNER_KEY, '1');
    } catch {
      // session only
    }
    banner.hidden = true;
  });
  query.addEventListener('change', apply);
  apply();
  return () => {
    query.removeEventListener('change', apply);
    banner.remove();
    document.body.classList.remove(NARROW_CLASS);
  };
}
