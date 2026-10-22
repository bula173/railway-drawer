/**
 * Side panels (src/ui/side-panels.ts): stored state is validated and clamped, collapse/expand is
 * remembered (not in the narrow layout), toggle buttons / View menu items follow, resize handles
 * are keyboard operable.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import {
  PANEL_MAX_WIDTH,
  PANEL_MIN_WIDTH,
  SIDE_PANELS_KEY,
  clampPanelWidth,
  ensurePanelShown,
  installSidePanels,
  readPanelState,
  setPanelShown,
  togglePanel,
} from '../../ui/side-panels';

const storage = (value: string | null): Pick<Storage, 'getItem'> => ({ getItem: () => value });

describe('stored panel state', () => {
  it('drops invalid entries and clamps widths', () => {
    expect(readPanelState(storage(null))).toEqual({});
    expect(readPanelState(storage('not json'))).toEqual({});
    expect(readPanelState(storage('[1]'))).toEqual({});
    expect(readPanelState(storage(JSON.stringify({ left: { width: 9999, collapsed: true }, right: { width: 'x', collapsed: 1 }, other: {} })))).toEqual({
      left: { width: PANEL_MAX_WIDTH, collapsed: true },
      right: {},
    });
    expect(clampPanelWidth(10)).toBe(PANEL_MIN_WIDTH);
    expect(clampPanelWidth(300.4)).toBe(300);
  });
});

describe('collapse / expand', () => {
  beforeAll(() => {
    localStorage.setItem(SIDE_PANELS_KEY, JSON.stringify({ left: { width: 300 }, right: { collapsed: true } }));
    document.head.innerHTML = `<style>
      .rd-panel-collapsed { display: none; }
      body.rd-narrow .left-panel:not(.rd-panel-open-narrow), body.rd-narrow .right-panel:not(.rd-panel-open-narrow) { display: none; }
    </style>`;
    document.body.innerHTML = `
      <button id="btn-toggle-left-panel"></button><button id="btn-toggle-right-panel"></button>
      <div class="menu-dropdown"><div data-action="toggleLeftPanel"></div><div data-action="toggleRightPanel"></div></div>
      <div id="leftpanel-container" class="left-panel"></div><div id="rightpanel-container" class="right-panel"></div>`;
    installSidePanels();
  });
  beforeEach(() => document.body.classList.remove('rd-narrow'));

  const left = (): HTMLElement => document.getElementById('leftpanel-container')!;
  const right = (): HTMLElement => document.getElementById('rightpanel-container')!;
  const stored = (): Record<string, { width?: number; collapsed?: boolean }> => JSON.parse(localStorage.getItem(SIDE_PANELS_KEY) ?? '{}');

  it('restores the stored width and collapsed state; controls follow', () => {
    expect(left().style.width).toBe('300px');
    expect(right().classList.contains('rd-panel-collapsed')).toBe(true);
    expect(document.getElementById('btn-toggle-right-panel')!.getAttribute('aria-pressed')).toBe('false');
    expect(document.querySelector('[data-action="toggleRightPanel"]')!.getAttribute('aria-checked')).toBe('false');
    expect(document.getElementById('btn-toggle-left-panel')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('toggles by button and function, remembered', () => {
    document.getElementById('btn-toggle-right-panel')!.click();
    expect(right().classList.contains('rd-panel-collapsed')).toBe(false);
    expect(stored().right.collapsed).toBe(false);
    togglePanel('left');
    expect(left().classList.contains('rd-panel-collapsed')).toBe(true);
    expect(stored().left).toEqual({ width: 300, collapsed: true });
    expect(document.querySelector('[data-action="toggleLeftPanel"]')!.getAttribute('aria-checked')).toBe('false');
    setPanelShown('left', true);
  });

  it('narrow layout: toggles open a panel for the session only', () => {
    document.body.classList.add('rd-narrow');
    expect(getComputedStyle(left()).display).toBe('none');
    togglePanel('left');
    expect(left().classList.contains('rd-panel-open-narrow')).toBe(true);
    expect(getComputedStyle(left()).display).not.toBe('none');
    expect(stored().left.collapsed).toBe(false);
    togglePanel('left');
    expect(getComputedStyle(left()).display).toBe('none');
    expect(stored().left.collapsed).toBe(false);
  });

  it('ensurePanelShown: opens a hidden panel (narrow: session only), leaves a shown one alone', () => {
    document.body.classList.add('rd-narrow');
    ensurePanelShown('left');
    expect(left().classList.contains('rd-panel-open-narrow')).toBe(true);
    expect(getComputedStyle(left()).display).not.toBe('none');
    expect(stored().left.collapsed).toBe(false);
    ensurePanelShown('left');
    expect(left().classList.contains('rd-panel-open-narrow')).toBe(true);
    togglePanel('left');
    document.body.classList.remove('rd-narrow');
    ensurePanelShown('left');
    expect(left().classList.contains('rd-panel-collapsed')).toBe(false);
  });

  it('resize handle: separator with keyboard steps, saved', () => {
    const handle = left().querySelector<HTMLElement>('.panel-resize-handle')!;
    expect(handle.getAttribute('role')).toBe('separator');
    expect(handle.tabIndex).toBe(0);
    // jsdom has no layout: getBoundingClientRect().width is 0, so a step from 0 clamps to the minimum
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(left().style.width).toBe(`${PANEL_MIN_WIDTH}px`);
    expect(stored().left.width).toBe(PANEL_MIN_WIDTH);
    expect(handle.getAttribute('aria-valuenow')).toBe(String(PANEL_MIN_WIDTH));
  });
});
