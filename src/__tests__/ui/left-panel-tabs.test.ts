/**
 * left-panel-tabs.ts: closeable tabs (PlantUML, ERTMS) have a real close button that is not nested in
 * the tab's button (valid HTML, keyboard reachable, "Close <tab> tab"), Delete on the tab closes it,
 * and the » overflow menu has a "Close <tab>" item.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LeftPanelTabs } from '../../ui/left-panel-tabs';

let tabs: LeftPanelTabs;
let panel: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<div id="left-panel"><div id="c-shapes"></div><div id="c-plantuml"></div><div id="c-ertms"></div></div>';
  panel = document.getElementById('left-panel')!;
  tabs = new LeftPanelTabs('left-panel');
  tabs.registerTabContent('shapes', 'c-shapes');
  tabs.registerTabContent('plantuml', 'c-plantuml');
  tabs.registerTabContent('ertms', 'c-ertms');
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

const tab = (id: string): HTMLElement => panel.querySelector<HTMLElement>(`.left-panel-tab-btn[data-tab="${id}"]`)!;

describe('LeftPanelTabs close buttons', () => {
  it('no button inside a button; closeable tabs get a labelled close button', () => {
    expect(panel.querySelectorAll('button button')).toHaveLength(0);
    for (const id of ['plantuml', 'ertms']) {
      const close = tab(id).querySelector<HTMLButtonElement>(':scope > button.tab-close-btn')!;
      expect(close.type).toBe('button');
      expect(close.tabIndex).toBe(0);
      expect(close.getAttribute('aria-label')).toBe(`Close ${id === 'plantuml' ? 'PlantUML' : 'ERTMS'} tab`);
    }
    expect(tab('shapes').querySelector('.tab-close-btn')).toBeNull();
    expect(tab('shapes').querySelector('button.left-panel-tab-label span')?.textContent).toBe('Shapes');
  });

  it('click on the tab switches, the close button closes without switching', () => {
    const visibility: Array<[string, boolean]> = [];
    tabs.onTabVisibilityChange((id, v) => visibility.push([id, v]));
    tab('plantuml').querySelector<HTMLButtonElement>('.left-panel-tab-label')!.click();
    expect(tabs.getActiveTab()).toBe('plantuml');
    tab('plantuml').querySelector<HTMLButtonElement>('.tab-close-btn')!.click();
    expect(tabs.isTabHidden('plantuml')).toBe(true);
    expect(tabs.getActiveTab()).toBe('shapes');
    expect(visibility).toEqual([['plantuml', false]]);
    expect(document.activeElement).toBe(tab('shapes').querySelector('.left-panel-tab-label'));
  });

  it('Delete on a closeable tab closes it (and does not reach document listeners); not on others', () => {
    const reached = vi.fn();
    document.addEventListener('keydown', reached);
    const ertms = tab('ertms').querySelector<HTMLButtonElement>('.left-panel-tab-label')!;
    ertms.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));
    expect(tabs.isTabHidden('ertms')).toBe(true);
    expect(reached).not.toHaveBeenCalled();
    tab('shapes').querySelector<HTMLButtonElement>('.left-panel-tab-label')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    expect(tab('shapes').style.display).toBe('');
    document.removeEventListener('keydown', reached);
  });

  it('» menu lists a "Close <tab>" item after a closeable overflow tab; Delete there closes too', () => {
    const bar = panel.querySelector<HTMLElement>('.left-panel-tabbar')!;
    Object.defineProperty(bar, 'clientWidth', { configurable: true, value: 150 });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 60, height: 20, top: 0, left: 0, right: 60, bottom: 20, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
    tabs.layoutTabs();
    const more = panel.querySelector<HTMLButtonElement>('.left-panel-tab-more')!;
    expect(more.hidden).toBe(false);
    more.click();
    const menu = panel.querySelector<HTMLElement>('.left-panel-overflow-menu')!;
    const close = menu.querySelector<HTMLButtonElement>('.left-panel-overflow-close[data-tab="plantuml"]')!;
    expect(close.getAttribute('role')).toBe('menuitem');
    expect(close.textContent).toBe('Close PlantUML');
    expect(close.previousElementSibling?.getAttribute('data-tab')).toBe('plantuml');
    close.click();
    expect(tabs.isTabHidden('plantuml')).toBe(true);
    expect(menu.hidden).toBe(true);

    tabs.showTab('plantuml');
    tabs.switchTab('shapes');
    more.click();
    const item = menu.querySelector<HTMLButtonElement>('.left-panel-overflow-item[data-tab="plantuml"]')!;
    item.focus();
    item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));
    expect(tabs.isTabHidden('plantuml')).toBe(true);
  });
});
