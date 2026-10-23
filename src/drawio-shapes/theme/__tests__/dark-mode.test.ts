import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { registerAppCommands } from '../../../ui/commands';
import { installMenuBar } from '../../../ui/menu';
import { Graph } from '@maxgraph/core';
import type { Cell, CellStyle } from '@maxgraph/core';
import { getInverseColor, resolveColorValue, resolveHtmlLabelColors } from '../../engine/colors';
import {
  getDrawioDarkMode,
  installDrawioCompat,
  setDrawioDarkMode,
  setGraphAdaptiveColors,
  setGraphColorMode,
} from '../../engine/graph-compat';
import {
  THEME_STORAGE_KEY,
  getThemePreference,
  installDarkModeToggle,
  isDarkMode,
  setThemePreference,
  toggleDarkMode,
} from '../dark-mode';

let container: HTMLElement;
let graph: Graph | undefined;

beforeAll(() => {
  const proto = SVGElement.prototype as unknown as { getBBox?: () => DOMRect };
  if (!proto.getBBox) proto.getBBox = () => ({ x: 0, y: 0, width: 10, height: 10 }) as DOMRect;
});

afterEach(() => {
  graph?.destroy();
  graph = undefined;
  container?.remove();
  setDrawioDarkMode(false);
  localStorage.removeItem(THEME_STORAGE_KEY);
  document.documentElement.removeAttribute('data-theme');
});

function newGraph(): Graph {
  container = document.createElement('div');
  document.body.appendChild(container);
  graph = new Graph(container);
  installDrawioCompat(graph);
  return graph;
}

function insert(g: Graph, style: CellStyle, value: string | null = null): Cell {
  let cell: Cell | undefined;
  g.batchUpdate(() => {
    cell = g.insertVertex({ parent: g.getDefaultParent(), position: [10, 10], size: [80, 40], value, style });
  });
  return cell!;
}

describe('dark mode color resolution (colors.ts)', () => {
  it('light-dark() resolves to the dark value in dark mode and the light value otherwise', () => {
    expect(resolveColorValue('light-dark(#111111, #eeeeee)', 'fontColor')).toBe('#111111');
    expect(resolveColorValue('light-dark(#111111, #eeeeee)', 'fontColor', undefined, { dark: true })).toBe('#eeeeee');
    // nested + var() fallback (Graph.shapeBackgroundColor)
    expect(
      resolveColorValue('light-dark(#ffffff, var(--ge-dark-color, #121212))', 'fillColor', undefined, { dark: true }),
    ).toBe('#121212');
  });

  it('default colors invert like Graph.shapeForegroundColor / shapeBackgroundColor', () => {
    const dark = { dark: true };
    expect(resolveColorValue('default', 'fillColor', undefined, dark)).toBe('#121212');
    expect(resolveColorValue('default', 'strokeColor', undefined, dark)).toBe('#ffffff');
    expect(resolveColorValue('default', 'fontColor', undefined, dark)).toBe('#ffffff');
    // default<Key>=invert swaps back to the light value in dark mode
    expect(resolveColorValue('default', 'fontColor', 'invert', dark)).toBe('#000000');
    expect(resolveColorValue('default', 'fillColor', 'page', dark)).toBe('#121212');
  });

  it("adaptive colors: 'auto' inverts plain colors with mxUtils.getInverseColor, 'simple' keeps them, 'none' ignores dark", () => {
    expect(getInverseColor('#ffffff')).toBe('#121212');
    expect(getInverseColor('#000000')).toBe('#ededed');
    expect(getInverseColor('transparent')).toBe('transparent');
    expect(resolveColorValue('#dae8fc', 'fillColor', undefined, { dark: true })).toBe(getInverseColor('#dae8fc'));
    expect(resolveColorValue('#dae8fc', 'fillColor', undefined, { dark: true, adaptive: 'simple' })).toBe('#dae8fc');
    expect(resolveColorValue('none', 'fillColor', undefined, { dark: true })).toBe('none');
    expect(resolveColorValue('light-dark(#111111, #eeeeee)', 'fontColor', undefined, { dark: true, adaptive: 'none' })).toBe(
      '#111111',
    );
    expect(resolveColorValue('default', 'fillColor', undefined, { dark: true, adaptive: 'none' })).toBe('#ffffff');
  });

  it('HTML labels: light-dark() picks the side, plain colors invert in dark auto mode', () => {
    const html = '<font style="color: light-dark(rgb(224, 0, 0), rgb(237, 237, 237));">A</font><span style="color: #000000">B</span>';
    expect(resolveHtmlLabelColors(html)).toBe(
      '<font style="color: rgb(224, 0, 0);">A</font><span style="color: #000000">B</span>',
    );
    const dark = resolveHtmlLabelColors(html, { dark: true });
    expect(dark).toContain('rgb(237, 237, 237)');
    expect(dark).toContain('color: #ededed');
    expect(dark).not.toContain('light-dark(');
  });
});

describe('dark mode on a graph (graph-compat.ts)', () => {
  it('switches resolved styles to the dark values and back, keeping cell.style', () => {
    const g = newGraph();
    const cell = insert(g, {
      fillColor: 'light-dark(#ffffff, #323200)',
      strokeColor: '#000000',
      fontColor: 'default',
    } as CellStyle);
    expect(g.view.getState(cell)!.style.fillColor).toBe('#ffffff');
    expect(container.style.getPropertyValue('color-scheme')).toBe('light');

    setDrawioDarkMode(true);
    expect(getDrawioDarkMode()).toBe(true);
    let st = g.view.getState(cell)!.style;
    expect(st.fillColor).toBe('#323200');
    expect(st.strokeColor).toBe('#ededed');
    expect(st.fontColor).toBe('#ffffff');
    expect(container.style.getPropertyValue('color-scheme')).toBe('dark');
    expect(container.innerHTML).toContain('#323200');
    // The model keeps draw.io's values: saving is unaffected by the theme
    expect(String(cell.style.fillColor)).toBe('light-dark(#ffffff, #323200)');
    expect(cell.style.fontColor).toBe('default');

    setDrawioDarkMode(false);
    st = g.view.getState(cell)!.style;
    expect(st.fillColor).toBe('#ffffff');
    expect(st.strokeColor).toBe('#000000');
    expect(st.fontColor).toBe('#000000');
    expect(container.style.getPropertyValue('color-scheme')).toBe('light');
  });

  it('resolves light-dark() in HTML labels to the dark value', () => {
    const g = newGraph();
    g.setHtmlLabels(true);
    insert(g, {} as CellStyle, '<font style="color: light-dark(rgb(224, 0, 0), rgb(201, 202, 203));">Stop</font>');
    expect(container.innerHTML).toContain('rgb(224, 0, 0)');
    setDrawioDarkMode(true);
    expect(container.innerHTML).toContain('rgb(201, 202, 203)');
    expect(container.innerHTML).not.toContain('light-dark(');
  });

  it('dark HTML label text below the minimum contrast is lightened (rendering only)', () => {
    const g = newGraph();
    g.setHtmlLabels(true);
    const cell = insert(g, { fillColor: 'none' } as CellStyle, '<font style="color: light-dark(rgb(224, 0, 0), rgb(1, 2, 3));">Stop</font>');
    setDrawioDarkMode(true);
    expect(container.innerHTML).not.toContain('rgb(1, 2, 3)');
    expect(String(cell.value)).toContain('rgb(1, 2, 3)');
  });

  it('per-graph overrides: pinned light mode and adaptiveColors=none', () => {
    const g = newGraph();
    const cell = insert(g, { fillColor: '#dae8fc' } as CellStyle);
    setGraphColorMode(g, false);
    setDrawioDarkMode(true);
    expect(g.view.getState(cell)!.style.fillColor).toBe('#dae8fc');
    setGraphColorMode(g, null);
    expect(g.view.getState(cell)!.style.fillColor).toBe(getInverseColor('#dae8fc'));
    setGraphAdaptiveColors(g, 'none');
    expect(g.view.getState(cell)!.style.fillColor).toBe('#dae8fc');
    expect(container.style.getPropertyValue('color-scheme')).toBe('light');
  });
});

describe('theme preference and View > Dark Mode toggle (dark-mode.ts)', () => {
  it('persists the preference and applies it to <html> and the renderer', () => {
    expect(getThemePreference()).toBe('auto');
    setThemePreference('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(getDrawioDarkMode()).toBe(true);
    expect(toggleDarkMode()).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(getDrawioDarkMode()).toBe(false);
    setThemePreference('auto');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('the menu item toggles dark mode (its command, ui/commands) and reflects the state', () => {
    const bar = document.createElement('div');
    bar.id = 'menu-bar';
    bar.innerHTML = '<div class="menu-dropdown" data-menu="view"><div class="menu-dropdown-item" data-action="toggleDarkMode"></div></div>';
    document.body.appendChild(bar);
    const item = bar.querySelector<HTMLElement>('[data-action="toggleDarkMode"]')!;
    registerAppCommands();
    installMenuBar();
    const dispose = installDarkModeToggle();
    try {
      expect(isDarkMode()).toBe(false);
      expect(item.getAttribute('aria-checked')).toBe('false');
      item.click();
      expect(isDarkMode()).toBe(true);
      expect(item.getAttribute('aria-checked')).toBe('true');
      expect(getDrawioDarkMode()).toBe(true);
      item.click();
      expect(isDarkMode()).toBe(false);
    } finally {
      dispose();
      bar.remove();
    }
  });
});
