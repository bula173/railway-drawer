import { createInstallScope, installOnce } from '../core/install-once';
/**
 * @file side-panels.ts
 * @brief Left (Shapes) and right (Format) side panels: collapse/expand (toolbar buttons
 *        `#btn-toggle-left-panel` / `#btn-toggle-right-panel`, View > Shapes Panel / Format Panel,
 *        Ctrl/Cmd+Shift+K / Ctrl/Cmd+Shift+P like draw.io), resize handles (8 px hit area, visible on
 *        hover, keyboard: arrow keys) and the remembered widths + collapsed state (localStorage
 *        `rd.sidePanels`).
 *
 * Narrow screens: the body class `rd-narrow` (set by the start-up code below 900 px) hides both
 * panels by CSS; a toggle then opens a panel for the session only (`rd-panel-open-narrow`), the
 * stored desktop state is not changed.
 */

export type SidePanel = 'left' | 'right';

export const SIDE_PANELS_KEY = 'rd.sidePanels';
export const PANEL_MIN_WIDTH = 180;
export const PANEL_MAX_WIDTH = 520;

interface PanelState {
  width?: number;
  collapsed?: boolean;
}
type StoredPanels = Partial<Record<SidePanel, PanelState>>;

const PANEL_IDS: Record<SidePanel, string> = { left: 'leftpanel-container', right: 'rightpanel-container' };
const BUTTON_IDS: Record<SidePanel, string> = { left: 'btn-toggle-left-panel', right: 'btn-toggle-right-panel' };
const MENU_ACTIONS: Record<SidePanel, string> = { left: 'toggleLeftPanel', right: 'toggleRightPanel' };
const NAMES: Record<SidePanel, string> = { left: 'Shapes panel', right: 'Format panel' };

/** Clamps a panel width to the allowed range. */
export function clampPanelWidth(width: number): number {
  return Math.round(Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, width)));
}

/** The stored state (invalid / missing entries dropped). */
export function readPanelState(storage: Pick<Storage, 'getItem'> | null = safeStorage()): StoredPanels {
  try {
    const raw = storage?.getItem(SIDE_PANELS_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== 'object') return {};
    const out: StoredPanels = {};
    for (const side of ['left', 'right'] as const) {
      const entry = (data as Record<string, unknown>)[side];
      if (!entry || typeof entry !== 'object') continue;
      const { width, collapsed } = entry as Record<string, unknown>;
      const state: PanelState = {};
      if (typeof width === 'number' && Number.isFinite(width)) state.width = clampPanelWidth(width);
      if (typeof collapsed === 'boolean') state.collapsed = collapsed;
      out[side] = state;
    }
    return out;
  } catch {
    return {};
  }
}

function safeStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function writePanelState(side: SidePanel, patch: PanelState): void {
  const all = readPanelState();
  all[side] = { ...all[side], ...patch };
  try {
    safeStorage()?.setItem(SIDE_PANELS_KEY, JSON.stringify(all));
  } catch {
    // session only
  }
}

function panelOf(side: SidePanel): HTMLElement | null {
  return document.getElementById(PANEL_IDS[side]);
}

function isNarrow(): boolean {
  return document.body.classList.contains('rd-narrow');
}

/** True while the panel is shown (not collapsed, not hidden by the narrow layout). */
export function isPanelShown(side: SidePanel): boolean {
  const panel = panelOf(side);
  return !!panel && getComputedStyle(panel).display !== 'none';
}

function syncControls(side: SidePanel): void {
  const shown = isPanelShown(side);
  const button = document.getElementById(BUTTON_IDS[side]);
  if (button) {
    button.setAttribute('aria-pressed', String(shown));
    button.setAttribute('aria-expanded', String(shown));
  }
  document.querySelectorAll(`[data-action="${MENU_ACTIONS[side]}"]`).forEach((item) => item.setAttribute('aria-checked', String(shown)));
}

/** Shows or hides a side panel (remembered, except in the narrow layout). */
export function setPanelShown(side: SidePanel, shown: boolean): void {
  const panel = panelOf(side);
  if (!panel) return;
  if (isNarrow()) {
    panel.classList.toggle('rd-panel-open-narrow', shown);
    if (shown) panel.classList.remove('rd-panel-collapsed');
  } else {
    panel.classList.toggle('rd-panel-collapsed', !shown);
    writePanelState(side, { collapsed: !shown });
  }
  syncControls(side);
  window.dispatchEvent(new Event('resize'));
}

/**
 * Shows the panel when it is hidden, e.g. before an action that needs it (start card "Insert ERTMS
 * symbols" on a narrow screen): in the narrow layout only for the session (`rd-panel-open-narrow`).
 */
export function ensurePanelShown(side: SidePanel): void {
  if (!isPanelShown(side)) setPanelShown(side, true);
}

export function togglePanel(side: SidePanel): void {
  setPanelShown(side, !isPanelShown(side));
}

/** Resize handle on the inner edge of `panel`: mouse drag, arrow keys (16 px, Shift 64 px). */
function attachResizeHandle(side: SidePanel, panel: HTMLElement): void {
  if (panel.querySelector(':scope > .panel-resize-handle')) return;
  const handle = document.createElement('div');
  handle.className = `panel-resize-handle panel-resize-handle-${side === 'left' ? 'right' : 'left'}`;
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', 'vertical');
  handle.setAttribute('aria-label', `Resize the ${NAMES[side]}`);
  handle.setAttribute('aria-valuemin', String(PANEL_MIN_WIDTH));
  handle.setAttribute('aria-valuemax', String(PANEL_MAX_WIDTH));
  handle.tabIndex = 0;
  const setWidth = (width: number, save: boolean): void => {
    const w = clampPanelWidth(width);
    panel.style.width = `${w}px`;
    handle.setAttribute('aria-valuenow', String(w));
    if (save) writePanelState(side, { width: w });
  };
  handle.setAttribute('aria-valuenow', String(Math.round(panel.getBoundingClientRect().width) || PANEL_MIN_WIDTH));

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = panel.getBoundingClientRect().width;
    handle.classList.add('rd-resizing');
    document.body.classList.add('rd-col-resizing');
    const onMove = (ev: MouseEvent): void => {
      const delta = ev.clientX - startX;
      setWidth(side === 'left' ? startWidth + delta : startWidth - delta, false);
    };
    const onUp = (): void => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      handle.classList.remove('rd-resizing');
      document.body.classList.remove('rd-col-resizing');
      setWidth(panel.getBoundingClientRect().width, true);
      window.dispatchEvent(new Event('resize'));
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
  handle.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const step = e.shiftKey ? 64 : 16;
    const grow = (e.key === 'ArrowRight') === (side === 'left');
    setWidth(panel.getBoundingClientRect().width + (grow ? step : -step), true);
    window.dispatchEvent(new Event('resize'));
  });
  panel.style.position = 'relative';
  panel.appendChild(handle);
}

const PAGE = createInstallScope();

/** Restores widths / collapsed state, adds the resize handles and binds the toggle buttons (once). */
export function installSidePanels(): void {
  if (!installOnce(PAGE, 'side-panels')) return;
  const stored = readPanelState();
  for (const side of ['left', 'right'] as const) {
    const panel = panelOf(side);
    if (!panel) continue;
    const state = stored[side];
    if (state?.width) panel.style.width = `${state.width}px`;
    if (state?.collapsed) panel.classList.add('rd-panel-collapsed');
    attachResizeHandle(side, panel);
    document.getElementById(BUTTON_IDS[side])?.addEventListener('click', () => togglePanel(side));
    syncControls(side);
  }
  // The narrow layout (body class) changes what is shown: keep the buttons/menu in step
  new MutationObserver(() => {
    for (const side of ['left', 'right'] as const) {
      if (!isNarrow()) panelOf(side)?.classList.remove('rd-panel-open-narrow');
      syncControls(side);
    }
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
}
