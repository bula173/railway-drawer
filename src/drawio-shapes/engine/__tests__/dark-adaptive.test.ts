/**
 * Dark-mode adaptive rendering of diagram colours: which plain colours invert, the contrast floors
 * for strokes / text, stencil colours, interaction feedback, and that only the rendering changes.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Graph } from '@maxgraph/core';
import type { Cell, CellStyle, Shape } from '@maxgraph/core';
import {
  DARK_MIN_CANVAS_TEXT_CONTRAST,
  DARK_MIN_GRAPHICS_CONTRAST,
  DARK_PAGE_BACKGROUND,
  adaptiveDarkColor,
  contrastRatio,
  ensureContrast,
  getInverseColor,
  isSaturatedColor,
  parseColor,
  resolveColorValue,
  resolveHtmlLabelColors,
} from '../colors';
import {
  drawioColorModeKey,
  installDrawioCompat,
  onDrawioColorModeChange,
  resolveStyleColors,
  setDrawioDarkMode,
  setGraphColorMode,
} from '../graph-compat';
import { stencilColor } from '../stencil-fixes';
import { feedbackColor } from '../handle-colors';

const CANVAS = DARK_PAGE_BACKGROUND;
const DARK = { dark: true } as const;

const ratio = (a: string, b: string = CANVAS): number => contrastRatio(a, b) ?? 0;

let container: HTMLElement | undefined;
let graph: Graph | undefined;

beforeAll(() => {
  const proto = SVGElement.prototype as unknown as { getBBox?: () => DOMRect };
  if (!proto.getBBox) proto.getBBox = () => ({ x: 0, y: 0, width: 10, height: 10 }) as DOMRect;
});

afterEach(() => {
  graph?.destroy();
  graph = undefined;
  container?.remove();
  container = undefined;
  setDrawioDarkMode(false);
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

describe('adaptiveDarkColor: neutral colours invert, saturated colours are kept', () => {
  it('black -> light, white -> dark, greys and pale pastels invert like draw.io', () => {
    expect(adaptiveDarkColor('#000000')).toBe('#ededed');
    expect(adaptiveDarkColor('black')).toBe('#ededed');
    expect(adaptiveDarkColor('#ffffff')).toBe('#121212');
    expect(adaptiveDarkColor('#333333')).toBe(getInverseColor('#333333'));
    expect(adaptiveDarkColor('#404040')).toBe('#b6b6b6');
    // draw.io's pale fills (chroma < 0.3) become dark tints
    expect(adaptiveDarkColor('#dae8fc')).toBe(getInverseColor('#dae8fc'));
    expect(adaptiveDarkColor('#fff2cc')).toBe(getInverseColor('#fff2cc'));
  });

  it('keeps saturated colours (signal red / green / yellow, track colours)', () => {
    for (const c of ['#e00000', '#ff0000', '#00cc00', '#008000', '#ffff00', '#ffcc00', '#0000ff', '#6c8ebf']) {
      expect(isSaturatedColor(c)).toBe(true);
      expect(adaptiveDarkColor(c)).toBe(c);
    }
    // draw.io would turn yellow into a near-black olive
    expect(getInverseColor('#ffff00')).toBe('#323200');
  });

  it("leaves 'none', var() and unparseable values alone", () => {
    expect(adaptiveDarkColor('none')).toBe('none');
    expect(adaptiveDarkColor('transparent')).toBe('transparent');
    expect(resolveColorValue('none', 'strokeColor', undefined, DARK)).toBe('none');
    expect(resolveColorValue('var(--x, #000000)', 'strokeColor', undefined, DARK)).toBe('#000000');
  });

  it('resolveColorValue: light-dark() takes the dark side, default the dark defaults, plain colours adapt', () => {
    expect(resolveColorValue('light-dark(#ffffff, #323200)', 'fillColor', undefined, DARK)).toBe('#323200');
    expect(resolveColorValue('light-dark(#ffffff, #323200)', 'fillColor')).toBe('#ffffff');
    expect(resolveColorValue('default', 'strokeColor', undefined, DARK)).toBe('#ffffff');
    expect(resolveColorValue('default', 'fillColor', undefined, DARK)).toBe('#121212');
    expect(resolveColorValue('#000000', 'strokeColor', undefined, DARK)).toBe('#ededed');
    expect(resolveColorValue('#e00000', 'fillColor', undefined, DARK)).toBe('#e00000');
    // light theme and adaptiveColors 'simple' / 'none' are untouched
    expect(resolveColorValue('#000000', 'strokeColor')).toBe('#000000');
    expect(resolveColorValue('#000000', 'strokeColor', undefined, { dark: true, adaptive: 'simple' })).toBe('#000000');
    expect(resolveColorValue('#000000', 'strokeColor', undefined, { dark: true, adaptive: 'none' })).toBe('#000000');
  });
});

describe('ensureContrast / contrastRatio', () => {
  it('measures WCAG contrast', () => {
    expect(ratio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(ratio('#5f5f5f')).toBeLessThan(3);
    expect(contrastRatio('none', CANVAS)).toBeNull();
  });

  it('lightens low-contrast colours on the dark canvas, keeping the hue', () => {
    const grey = ensureContrast('#5f5f5f', CANVAS, DARK_MIN_GRAPHICS_CONTRAST);
    expect(ratio(grey)).toBeGreaterThanOrEqual(DARK_MIN_GRAPHICS_CONTRAST);
    const blue = parseColor(ensureContrast('#0000ff', CANVAS, DARK_MIN_GRAPHICS_CONTRAST))!;
    expect(blue.b).toBeGreaterThan(blue.r);
    expect(ratio(ensureContrast('#0000ff', CANVAS, DARK_MIN_GRAPHICS_CONTRAST))).toBeGreaterThanOrEqual(DARK_MIN_GRAPHICS_CONTRAST);
    // darkens on light backgrounds
    expect(ratio(ensureContrast('#ffff00', '#ffffff', 3), '#ffffff')).toBeGreaterThanOrEqual(3);
  });

  it('returns readable and unparseable colours unchanged', () => {
    expect(ensureContrast('#ededed', CANVAS, 4.5)).toBe('#ededed');
    expect(ensureContrast('none', CANVAS, 4.5)).toBe('none');
    expect(ensureContrast('#000000', 'none', 4.5)).toBe('#000000');
  });
});

describe('resolveStyleColors in dark mode: contrast floors on the resolved style', () => {
  it('strokes reach 4.5:1 on the canvas (ERTMS track light-dark(#a5a5a5, #5f5f5f))', () => {
    const st = resolveStyleColors({ strokeColor: 'light-dark(#a5a5a5, #5f5f5f)', fillColor: 'none' }, DARK);
    expect(ratio(st.strokeColor)).toBeGreaterThanOrEqual(DARK_MIN_GRAPHICS_CONTRAST);
    expect(st.fillColor).toBe('none');
  });

  it('text on the canvas reaches 7:1; text on a fill reads on the fill', () => {
    const onCanvas = resolveStyleColors({ fontColor: '#0000ff', fillColor: 'none' }, DARK);
    expect(ratio(onCanvas.fontColor)).toBeGreaterThanOrEqual(DARK_MIN_CANVAS_TEXT_CONTRAST);
    // white text on a kept red fill stays white, black text on yellow stays black
    expect(resolveStyleColors({ fontColor: '#ffffff', fillColor: '#e00000' }, DARK).fontColor).toBe('#ffffff');
    expect(resolveStyleColors({ fontColor: '#000000', fillColor: '#ffff00' }, DARK).fontColor).toBe('#000000');
    // default black text on a default white fill: light text on the dark fill
    const plain = resolveStyleColors({ fontColor: '#000000', fillColor: '#ffffff', strokeColor: '#000000' }, DARK);
    expect(plain).toEqual({ fontColor: '#ededed', fillColor: '#121212', strokeColor: '#ededed' });
    // a label outside the shape is measured against the canvas
    const outside = resolveStyleColors({ fontColor: '#000000', fillColor: '#ffff00', verticalLabelPosition: 'bottom' }, DARK);
    expect(ratio(outside.fontColor)).toBeGreaterThanOrEqual(DARK_MIN_CANVAS_TEXT_CONTRAST);
  });

  it('light theme keeps every value exactly', () => {
    const style = { strokeColor: 'light-dark(#a5a5a5, #5f5f5f)', fontColor: '#0000ff', fillColor: '#ffffff' };
    expect(resolveStyleColors({ ...style })).toEqual({ strokeColor: '#a5a5a5', fontColor: '#0000ff', fillColor: '#ffffff' });
  });

  it('HTML label text colours get the floor against their background', () => {
    const html = '<span style="color: #0000ff">A</span><font color="#333333">B</font>';
    const out = resolveHtmlLabelColors(html, DARK, { background: CANVAS, min: DARK_MIN_CANVAS_TEXT_CONTRAST });
    const colors = [...out.matchAll(/(?:color: |color=")(#[0-9a-f]{6})/g)].map((m) => m[1]);
    expect(colors).toHaveLength(2);
    for (const c of colors) expect(ratio(c)).toBeGreaterThanOrEqual(DARK_MIN_CANVAS_TEXT_CONTRAST);
    expect(resolveHtmlLabelColors(html)).toBe(html);
  });
});

describe('graphs: only the rendering changes', () => {
  it('cell styles keep the stored values; the rendered SVG uses the adaptive colours', () => {
    const g = newGraph();
    const track = insert(g, { strokeColor: 'light-dark(#a5a5a5, #5f5f5f)', fillColor: '#e00000', fontColor: '#000000' } as CellStyle, 'S1');
    setDrawioDarkMode(true);
    const st = g.view.getState(track)!.style;
    expect(ratio(String(st.strokeColor))).toBeGreaterThanOrEqual(DARK_MIN_GRAPHICS_CONTRAST);
    expect(st.fillColor).toBe('#e00000');
    expect(String(track.style.strokeColor)).toBe('light-dark(#a5a5a5, #5f5f5f)');
    expect(track.style.fontColor).toBe('#000000');
    setDrawioDarkMode(false);
    expect(g.view.getState(track)!.style.strokeColor).toBe('#a5a5a5');
  });

  it('a graph pinned to light (exports) renders the light colours in dark mode', () => {
    const g = newGraph();
    const cell = insert(g, { strokeColor: '#000000', fillColor: '#ffffff' } as CellStyle);
    setGraphColorMode(g, false);
    setDrawioDarkMode(true);
    expect(g.view.getState(cell)!.style.strokeColor).toBe('#000000');
    expect(g.view.getState(cell)!.style.fillColor).toBe('#ffffff');
  });

  it('stencil colours of their own (literals, defaults) adapt; colours from the cell are not adapted twice', () => {
    const g = newGraph();
    setGraphColorMode(g, true);
    const node = document.createElementNS(null, 'strokecolor');
    const fillNode = document.createElementNS(null, 'fillcolor');
    const shape = { style: { fillColor: '#121212' }, stroke: '#ededed', fill: '#121212', state: { view: { graph: g } } } as unknown as Shape;
    expect(ratio(stencilColor(shape, node, '#000000')!)).toBeGreaterThanOrEqual(DARK_MIN_GRAPHICS_CONTRAST);
    expect(stencilColor(shape, fillNode, '#ffffff')).toBe('#121212');
    expect(stencilColor(shape, fillNode, '#e00000')).toBe('#e00000');
    expect(stencilColor(shape, node, 'stroke')).toBe('#ededed');
    expect(stencilColor(shape, fillNode, 'fill')).toBe('#121212');
    // light graph: the stencil's literal colours as in draw.io
    setGraphColorMode(g, false);
    expect(stencilColor(shape, node, '#000000')).toBe('#000000');
    expect(stencilColor(shape, node, 'light-dark(#000000, #ffffff)')).toBe('#000000');
  });

  it('interaction feedback: blue drop-target / connect colours become readable in dark mode only', () => {
    const g = newGraph();
    expect(feedbackColor(g, '#0000FF')).toBe('#0000FF');
    setGraphColorMode(g, true);
    expect(ratio(feedbackColor(g, '#0000FF'))).toBeGreaterThanOrEqual(DARK_MIN_GRAPHICS_CONTRAST);
    expect(feedbackColor(g, '#00FF00')).toBe('#00FF00');
  });

  it('colour mode key and change notifications (thumbnail caches re-render)', () => {
    let calls = 0;
    const stop = onDrawioColorModeChange(() => calls++);
    expect(drawioColorModeKey()).toBe('');
    setDrawioDarkMode(true);
    expect(drawioColorModeKey()).toBe('dark-auto');
    setDrawioDarkMode(true);
    setDrawioDarkMode(false);
    stop();
    setDrawioDarkMode(true);
    expect(calls).toBe(2);
  });
});
