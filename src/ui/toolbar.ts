/**
 * @file toolbar.ts
 * @brief The main toolbar's chrome (installed once by main-editor.ts; the per-tab controllers bind
 *        the buttons' actions by id): one inline-SVG icon set (`data-icon`, no emoji), the
 *        accessible name (`data-label` -> aria-label) and a tooltip with the shortcut
 *        (`data-shortcut` = an `ACTION_SHORTCUTS` key), the Align/Distribute dropdown
 *        (`#btn-align` -> `#align-menu`, its items are AlignmentController's `#btn-align-*` /
 *        `#btn-distribute-*`), and toggle buttons mirroring a menu item's aria-checked
 *        (`data-mirror-action`, e.g. km Ruler) as aria-pressed.
 */
import { emit } from '../core/event-bus';
import { createInstallScope, installOnce } from '../core/install-once';
import { shortcutForAction } from './shortcut-keys';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** 24x24 stroke icons (currentColor, stroke 2, round caps): SVG child markup per icon name. */
export const TOOLBAR_ICONS: Readonly<Record<string, string>> = {
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  zoomIn: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/><path d="M8 11h6M11 8v6"/>',
  zoomOut: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/><path d="M8 11h6"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="m6 7 1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
  rect: '<rect x="4" y="6" width="16" height="12" rx="1"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="8.5" ry="6"/>',
  diamond: '<path d="M12 3 21 12 12 21 3 12Z"/>',
  line: '<path d="M5 19 19 5"/>',
  connect: '<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/><path d="M9 6h4a2 2 0 0 1 2 2v4"/><path d="m12 9 3 3 3-3"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="m21 16-5-5-9 8"/>',
  grid: '<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
  painter: '<rect x="4" y="3" width="13" height="6" rx="1"/><path d="M17 6h3v5h-8v3"/><rect x="10" y="14" width="4" height="7" rx="1"/>',
  align: '<path d="M4 3v18"/><rect x="8" y="6" width="12" height="4" rx="1"/><rect x="8" y="14" width="7" height="4" rx="1"/>',
  alignLeft: '<path d="M4 3v18"/><rect x="8" y="6" width="12" height="4" rx="1"/><rect x="8" y="14" width="7" height="4" rx="1"/>',
  alignCenter: '<path d="M12 3v18"/><rect x="5" y="6" width="14" height="4" rx="1"/><rect x="8" y="14" width="8" height="4" rx="1"/>',
  alignRight: '<path d="M20 3v18"/><rect x="4" y="6" width="12" height="4" rx="1"/><rect x="9" y="14" width="7" height="4" rx="1"/>',
  alignTop: '<path d="M3 4h18"/><rect x="6" y="8" width="4" height="12" rx="1"/><rect x="14" y="8" width="4" height="7" rx="1"/>',
  alignMiddle: '<path d="M3 12h18"/><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="8" width="4" height="8" rx="1"/>',
  alignBottom: '<path d="M3 20h18"/><rect x="6" y="4" width="4" height="12" rx="1"/><rect x="14" y="9" width="4" height="7" rx="1"/>',
  distributeH: '<path d="M3 3v18M21 3v18"/><rect x="9" y="7" width="6" height="10" rx="1"/>',
  distributeV: '<path d="M3 3h18M3 21h18"/><rect x="7" y="9" width="10" height="6" rx="1"/>',
  route: '<circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/><path d="M7 19h3a3 3 0 0 0 3-3V8a3 3 0 0 1 3-3h1"/>',
  checks: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="m9 13 2 2 4-4"/>',
  ruler: '<rect x="2" y="8" width="20" height="8" rx="1"/><path d="M6 8v3M10 8v4M14 8v3M18 8v4"/>',
  fullscreen: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  panelLeft: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  panelRight: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  // top bar and panels (same 24x24 stroke style; no emoji anywhere in the chrome)
  train: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 10h14"/><circle cx="9" cy="13.5" r="1"/><circle cx="15" cy="13.5" r="1"/><path d="m8 21 2-4M16 21l-2-4"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  textLeft: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
  textCenter: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
  textRight: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
  valignTop: '<path d="M4 4h16"/><path d="M12 20V8"/><path d="m8 12 4-4 4 4"/>',
  valignMiddle: '<path d="M4 12h16"/><path d="M12 3v5M12 16v5"/><path d="m9 5 3 3 3-3M9 19l3-3 3 3"/>',
  valignBottom: '<path d="M4 20h16"/><path d="M12 4v12"/><path d="m8 12 4 4 4-4"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path d="M3 3l18 18"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8Z"/><path d="M14 3v5h5"/>',
  folder: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/>',
  folders: '<path d="M7 8V6a1 1 0 0 1 1-1h4l2 2h6a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-2"/><path d="M3 10a1 1 0 0 1 1-1h4l2 2h5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  logOut: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h4"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  arrowUp: '<path d="M12 20V5"/><path d="m6 11 6-6 6 6"/>',
  arrowDown: '<path d="M12 4v15"/><path d="m6 13 6 6 6-6"/>',
  toFront: '<path d="M4 4h16"/><path d="M12 21V9"/><path d="m7 14 5-5 5 5"/>',
  toBack: '<path d="M4 20h16"/><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/>',
  closePath: '<path d="M5 18 9 6l7 3 3 9Z"/>',
};

/** An `<svg>` icon (aria-hidden) for `name`, or null when unknown. */
export function createToolbarIcon(name: string, size = 18): SVGSVGElement | null {
  const body = TOOLBAR_ICONS[name];
  if (body === undefined) return null;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.innerHTML = body;
  return svg;
}

/**
 * Inline icons of other chrome (top bar, panels, dialogs): each `[data-rd-icon]` element inside `root`
 * gets its `TOOLBAR_ICONS` svg prepended once (size `data-rd-icon-size`, default 16). An element without
 * text and without aria-label is named by its title. Title and text are otherwise left alone.
 */
export function applyInlineIcons(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-rd-icon]').forEach((el) => {
    if (!el.querySelector(':scope > svg.rd-icon')) setInlineIcon(el, el.dataset.rdIcon ?? '');
  });
}

/** Sets (or replaces) the inline icon of `el`, e.g. a toggle's eye / eye-off. */
export function setInlineIcon(el: HTMLElement, name: string): void {
  el.querySelector(':scope > svg.rd-icon')?.remove();
  el.dataset.rdIcon = name;
  const icon = createToolbarIcon(name, Number(el.dataset.rdIconSize) || 16);
  if (!icon) return;
  icon.classList.add('rd-icon');
  el.prepend(icon);
  if (!el.textContent?.trim() && !el.getAttribute('aria-label') && el.title) el.setAttribute('aria-label', el.title);
}

/** Icon, aria-label and tooltip ("Undo (Ctrl+Z)") of each `[data-icon]` button inside `root`. */
export function decorateToolbarButtons(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-icon]').forEach((button) => {
    const icon = createToolbarIcon(button.dataset.icon ?? '');
    if (icon && !button.querySelector(':scope > svg')) button.prepend(icon);
    const label = button.dataset.label ?? button.getAttribute('aria-label') ?? button.title;
    if (!label) return;
    button.setAttribute('aria-label', label);
    const shortcut = button.dataset.shortcut ? shortcutForAction(button.dataset.shortcut) : null;
    button.title = shortcut ? `${label} (${shortcut})` : label;
  });
}

/** Toggle buttons that follow a menu item's aria-checked (`data-mirror-action`) as aria-pressed. */
function mirrorMenuToggles(): void {
  document.querySelectorAll<HTMLElement>('[data-mirror-action]').forEach((button) => {
    const item = document.querySelector<HTMLElement>(`.menu-dropdown [data-action="${button.dataset.mirrorAction}"]`);
    if (!item) return;
    const sync = (): void => button.setAttribute('aria-pressed', item.getAttribute('aria-checked') === 'true' ? 'true' : 'false');
    sync();
    new MutationObserver(sync).observe(item, { attributes: true, attributeFilter: ['aria-checked'] });
  });
}

/** The Align/Distribute dropdown: a small role=menu popup below `#btn-align`. */
function installAlignMenu(): void {
  const button = document.getElementById('btn-align');
  const menu = document.getElementById('align-menu');
  if (!button || !menu) return;
  const items = (): HTMLElement[] => Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'));
  const close = (focusButton: boolean): void => {
    if (menu.hidden) return;
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (focusButton) button.focus();
  };
  const open = (focus: 'first' | 'last' | null): void => {
    const r = button.getBoundingClientRect();
    menu.style.left = `${Math.round(r.left)}px`;
    menu.style.top = `${Math.round(r.bottom + 2)}px`;
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    const list = items();
    if (focus) (focus === 'first' ? list[0] : list[list.length - 1])?.focus();
  };
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menu.hidden) open('first');
    else close(false);
  });
  button.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      open(e.key === 'ArrowDown' ? 'first' : 'last');
    }
  });
  menu.addEventListener('keydown', (e) => {
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLElement);
    const move = (to: number): void => {
      e.preventDefault();
      list[(to + list.length) % list.length]?.focus();
    };
    if (e.key === 'ArrowDown') move(i + 1);
    else if (e.key === 'ArrowUp') move(i - 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(list.length - 1);
    else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === 'Tab') close(false);
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      (document.activeElement as HTMLElement | null)?.click();
    }
  });
  // The items' actions are AlignmentController's (per tab); the menu just closes after them
  menu.addEventListener('click', (e) => {
    if ((e.target as Element).closest('[role="menuitem"]')) close(true);
  });
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target as Node) && e.target !== button) close(false);
  });
  window.addEventListener('resize', () => close(false));
}

const PAGE = createInstallScope();

/** Main toolbar chrome (once). */
export function installToolbar(): void {
  if (!installOnce(PAGE, 'toolbar')) return;
  decorateToolbarButtons(document.getElementById('toolbar-container') ?? document);
  decorateToolbarButtons(document.getElementById('align-menu') ?? document);
  // top bar (logo, Share) and the Properties panel's text alignment buttons
  applyInlineIcons(document.querySelector('.top-bar') ?? document);
  applyInlineIcons(document.getElementById('property-content') ?? document);
  mirrorMenuToggles();
  installAlignMenu();
  // Railway group (the route tool button is src/railway/install-railway-routes.ts)
  document.getElementById('btn-railway-checks')?.addEventListener('click', () => emit('railway-checks-request'));
  document.getElementById('btn-km-ruler')?.addEventListener('click', () =>
    emit('railway-route-request', 'toggleKmRuler')
  );
}
