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

let installed = false;

/** Main toolbar chrome (once). */
export function installToolbar(): void {
  if (installed) return;
  installed = true;
  decorateToolbarButtons(document.getElementById('toolbar-container') ?? document);
  decorateToolbarButtons(document.getElementById('align-menu') ?? document);
  mirrorMenuToggles();
  installAlignMenu();
  // Railway group (the route tool button is src/railway/install-railway-routes.ts)
  document.getElementById('btn-railway-checks')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('railway-checks-request')));
  document.getElementById('btn-km-ruler')?.addEventListener('click', () =>
    window.dispatchEvent(new CustomEvent('railway-route-request', { detail: 'toggleKmRuler' }))
  );
}
