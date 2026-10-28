/**
 * @file action-menu.ts
 * @brief The small menu buttons of the scenarios UI: "⋯" (more actions) of the Scenarios panel rows
 *        and the labelled "Export ▾" of the panel rows and of the scenario view banner.
 *
 * A button (aria-haspopup=menu) with a text menu of actions (role=menu). The items keep their own
 * classes (e.g. `rd-scn-edit`), so they stay addressable; the menu is position: fixed under the
 * button, so a scrolling panel does not clip it. One menu is open at a time. Keys: Enter / Space /
 * ↓ on the button open it (↑: last item), ↑/↓/Home/End move, Esc closes and returns the focus to the
 * button, Tab closes; a click outside closes. Keys inside the menu never reach the shell's shortcuts.
 */
import './scenarios.css';

export interface MenuAction {
  className: string;
  label: string;
  title?: string;
  disabled?: boolean;
  danger?: boolean;
  run: () => void;
}

export interface MenuButtonOptions {
  /** Accessible name and tooltip of the button. */
  label: string;
  /** Classes of the button (default `rd-scn-more`). */
  className?: string;
  /** Visible content of the button (default "⋯"); a node keeps e.g. an aria-hidden "▾". */
  content?: string | Node[];
  /** Tooltip (default: `label`). */
  title?: string;
  /** Disabled button (the tooltip says why). */
  disabled?: boolean;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** The menu currently open (one at a time). */
let openMenu: { menu: HTMLElement; button: HTMLButtonElement } | null = null;

function onDocumentPointerDown(e: Event): void {
  const open = openMenu;
  if (open && !open.menu.contains(e.target as Node) && !open.button.contains(e.target as Node)) closeActionMenu();
}

/** Closes the open menu (optionally focusing its button again). */
export function closeActionMenu(focusButton = false): void {
  const open = openMenu;
  if (!open) return;
  openMenu = null;
  document.removeEventListener('mousedown', onDocumentPointerDown, true);
  open.menu.hidden = true;
  open.button.setAttribute('aria-expanded', 'false');
  if (focusButton) open.button.focus();
}

/** Closes the open menu when it lives inside `root` (re-render, scroll, view closed). */
export function closeActionMenuWithin(root: HTMLElement | null): void {
  if (openMenu && root?.contains(openMenu.menu)) closeActionMenu();
}

/** A menu button with its menu (wrapped in `.rd-scn-menu-wrap`). */
export function actionMenu(options: MenuButtonOptions, actions: MenuAction[]): HTMLElement {
  const wrap = el('div', 'rd-scn-menu-wrap');
  const button = el('button', options.className ?? 'rd-scn-more');
  const content = options.content ?? '⋯';
  if (typeof content === 'string') button.textContent = content;
  else button.append(...content);
  button.type = 'button';
  button.title = options.title ?? options.label;
  button.setAttribute('aria-label', options.label);
  button.setAttribute('aria-haspopup', 'menu');
  button.setAttribute('aria-expanded', 'false');
  button.disabled = !!options.disabled;
  const menu = el('div', 'rd-scn-menu');
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', options.label);
  menu.hidden = true;
  const items: HTMLButtonElement[] = [];
  for (const action of actions) {
    const item = el('button', `rd-scn-menu-item ${action.className}${action.danger ? ' rd-scn-danger' : ''}`, action.label);
    item.type = 'button';
    item.setAttribute('role', 'menuitem');
    if (action.title) item.title = action.title;
    item.disabled = !!action.disabled;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      closeActionMenu();
      action.run();
    });
    items.push(item);
    menu.appendChild(item);
  }
  const enabled = (): HTMLButtonElement[] => items.filter((i) => !i.disabled);
  const open = (focus: 'first' | 'last'): void => {
    closeActionMenu();
    const r = button.getBoundingClientRect();
    menu.hidden = false;
    const w = menu.offsetWidth || 160;
    menu.style.left = `${Math.max(4, Math.min(r.right - w, window.innerWidth - w - 4))}px`;
    const h = menu.offsetHeight || 0;
    menu.style.top = `${r.bottom + 2 + h > window.innerHeight ? Math.max(4, r.top - h - 2) : r.bottom + 2}px`;
    button.setAttribute('aria-expanded', 'true');
    openMenu = { menu, button };
    document.addEventListener('mousedown', onDocumentPointerDown, true);
    const list = enabled();
    (focus === 'first' ? list[0] : list[list.length - 1])?.focus();
  };
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    if (openMenu?.menu === menu) closeActionMenu();
    else open('first');
  });
  button.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      open(e.key === 'ArrowDown' ? 'first' : 'last');
    } else if (e.key === 'Enter' || e.key === ' ') {
      // the button's own activation (click) opens the menu; no shell shortcut may act on the key
      e.stopPropagation();
    }
  });
  menu.addEventListener('keydown', (e) => {
    // keys in the menu belong to the menu (no label editing / nudging of the drawing behind it)
    e.stopPropagation();
    const list = enabled();
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      closeActionMenu(true);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = list[(i + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length];
      next?.focus();
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      (e.key === 'Home' ? list[0] : list[list.length - 1])?.focus();
    } else if (e.key === 'Tab') {
      closeActionMenu();
    }
  });
  // clicks inside the menu must not reach the row (present / expand)
  menu.addEventListener('click', (e) => e.stopPropagation());
  wrap.append(button, menu);
  return wrap;
}

export type ScenarioExportFormat = 'pdf' | 'slides' | 'html';

const EXPORT_ITEMS: { format: ScenarioExportFormat; className: string; label: string; title: string }[] = [
  { format: 'pdf', className: 'rd-scn-export-menu-pdf', label: 'PDF…', title: 'Title page, one or more pages per step' },
  { format: 'slides', className: 'rd-scn-export-menu-slides', label: 'Slides (HTML)…', title: 'HTML slideshow, one step per slide' },
  { format: 'html', className: 'rd-scn-export-menu-html', label: 'HTML document…', title: 'One HTML file with the drawings, UML and text of all steps' },
];

/**
 * The labelled "Export ▾" menu button of a scenario: PDF…, Slides (HTML)…, HTML document….
 * Disabled with the tooltip "Add a step first" when the scenario has no steps.
 */
export function exportMenu(
  scenarioName: string,
  stepCount: number,
  run: (format: ScenarioExportFormat) => void,
  options: { formats?: ScenarioExportFormat[]; className?: string } = {}
): HTMLElement {
  const formats = options.formats ?? ['pdf', 'slides', 'html'];
  const icon = el('span', 'rd-scn-export-icon', '⇩');
  icon.setAttribute('aria-hidden', 'true');
  const caret = el('span', 'rd-scn-export-caret', '▾');
  caret.setAttribute('aria-hidden', 'true');
  return actionMenu(
    {
      label: `Export ${scenarioName}`,
      className: `rd-scn-export-btn ${options.className ?? ''}`.trim(),
      content: [icon, el('span', 'rd-scn-export-text', 'Export'), caret],
      title: stepCount === 0 ? 'Add a step first' : 'Export the scenario as PDF, slides or an HTML document',
      disabled: stepCount === 0,
    },
    EXPORT_ITEMS.filter((item) => formats.includes(item.format)).map((item) => ({
      className: item.className,
      label: item.label,
      title: item.title,
      run: () => run(item.format),
    }))
  );
}
