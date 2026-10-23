/**
 * @file dark-mode.ts
 * @brief App theme (light/dark) for the maxGraph editor, following draw.io's dark mode.
 *
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG. Licensed under the Apache
 * License, Version 2.0. Behaviour after jgraph/drawio v32.4.1 src/main/webapp/js/grapheditor/
 * Editor.js:340-430 (Editor.darkMode, Editor.darkColor = '#121212', Editor.isDarkMode) and
 * EditorUi's "Appearance" setting (light / dark / automatic = follow the system).
 *
 * - The preference ('light' | 'dark' | 'auto') is stored in localStorage `rd.theme`; 'auto' (no
 *   stored value) follows `prefers-color-scheme`. index.html applies it before first paint.
 * - The resolved theme is written to `<html data-theme>` and `color-scheme` (the app chrome's
 *   --rd-* color tokens in src/styles/variables.css switch on `:root[data-theme="dark"]`) and to
 *   the diagram renderer via
 *   setDrawioDarkMode (light-dark(), default colors and adaptive colors, see graph-compat.ts).
 * - View > "Dark Mode" (`[data-action="toggleDarkMode"]`) toggles between light and dark.
 */

import { emit } from '../../core/event-bus';
import { setDrawioDarkMode } from '../engine/graph-compat';
import { STORAGE_KEYS } from '../../core/storage-keys';
import { getStorage } from '../../core/safe-storage';

export type ThemePreference = 'light' | 'dark' | 'auto';
export type Theme = 'light' | 'dark';

/** localStorage key of the persisted preference (index.html reads the same key). */
export const THEME_STORAGE_KEY = STORAGE_KEYS.theme;

/** Fired on `window` after the theme changed; detail: the resolved Theme. */
export const THEME_CHANGE_EVENT = 'rd-theme-change' as const;

const DARK_QUERY = '(prefers-color-scheme: dark)';

function storage(): Storage | null {
  try {
    return getStorage('local');
  } catch {
    return null;
  }
}

function systemPrefersDark(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches;
  } catch {
    return false;
  }
}

/** The stored preference, 'auto' when none (or storage is unavailable). */
export function getThemePreference(): ThemePreference {
  try {
    const value = storage()?.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'auto';
  } catch {
    return 'auto';
  }
}

/** Resolves a preference to the theme to render ('auto' -> system setting). */
export function resolveTheme(pref: ThemePreference = getThemePreference()): Theme {
  if (pref === 'auto') return systemPrefersDark() ? 'dark' : 'light';
  return pref;
}

/** Editor.isDarkMode(): the theme currently applied to the document. */
export function isDarkMode(doc: Document = document): boolean {
  return doc.documentElement.getAttribute('data-theme') === 'dark';
}

function syncMenuItems(doc: Document, theme: Theme): void {
  doc.querySelectorAll<HTMLElement>('[data-action="toggleDarkMode"]').forEach((item) => {
    item.setAttribute('role', 'menuitemcheckbox');
    item.setAttribute('aria-checked', theme === 'dark' ? 'true' : 'false');
  });
}

/** Applies `theme` to the document chrome and the diagram renderer. */
export function applyTheme(theme: Theme, doc: Document = document): void {
  const root = doc.documentElement;
  const changed = root.getAttribute('data-theme') !== theme;
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;
  syncMenuItems(doc, theme);
  setDrawioDarkMode(theme === 'dark');

  if (changed && typeof window !== 'undefined') {
    emit(THEME_CHANGE_EVENT, theme);
  }
}

/** Persists `pref` ('auto' clears the stored value) and applies the resolved theme. */
export function setThemePreference(pref: ThemePreference, doc: Document = document): Theme {
  try {
    const s = storage();
    if (pref === 'auto') s?.removeItem(THEME_STORAGE_KEY);
    else s?.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // storage full or blocked: the theme still applies for this page load
  }
  const theme = resolveTheme(pref);
  applyTheme(theme, doc);
  return theme;
}

/** View > Dark Mode: switches between light and dark and stores the explicit choice. */
export function toggleDarkMode(doc: Document = document): Theme {
  return setThemePreference(isDarkMode(doc) ? 'light' : 'dark', doc);
}

/**
 * Applies the stored/system theme and binds the View menu item and the system preference
 * listener. Call once per page (global, not per tab). Returns a dispose function.
 */
export function installDarkModeToggle(doc: Document = document): () => void {
  applyTheme(resolveTheme(), doc);

  const onClick = (e: Event): void => {
    const target = e.target as Element | null;
    if (target?.closest?.('[data-action="toggleDarkMode"]')) toggleDarkMode(doc);
  };
  doc.addEventListener('click', onClick, true);

  let media: MediaQueryList | null = null;
  const onSystemChange = (): void => {
    if (getThemePreference() === 'auto') applyTheme(resolveTheme('auto'), doc);
  };
  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      media = window.matchMedia(DARK_QUERY);
      media.addEventListener?.('change', onSystemChange);
    }
  } catch {
    media = null;
  }

  return () => {
    doc.removeEventListener('click', onClick, true);
    media?.removeEventListener?.('change', onSystemChange);
  };
}
