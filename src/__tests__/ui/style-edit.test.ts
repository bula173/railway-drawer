/**
 * Bug "I cannot edit i.e. line color when I take drawing from template": the properties panels
 * wrote graph.getCellStyle(cell) (the resolved style) back into the cell, which deleted every
 * `none` value (maxGraph's Stylesheet.getCellStyle), the base style names and light-dark()
 * colors, and the Style tab had no line color at all. Edits now change only the edited keys of
 * the cell's own style (style-edit.ts), like draw.io's setCellStyles.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Cell, Geometry, Graph, InternalEvent, Point } from '@maxgraph/core';
import type { CellStyle } from '@maxgraph/core';
import {
  applyStyleToCells,
  dashPatternOf,
  dashPatternStyle,
  effectiveColor,
  linePatternOf,
  linePatternStyle,
  ownStyleCopy,
  setCellStyleValues,
  toColorInputValue,
} from '../../ui/style-edit';
import { PropertiesPanel } from '../../ui/properties';
import { EdgePropertiesController } from '../../ui/edge-properties';
import { configureDiagramRendering } from '../../ui/diagram-graph-setup';
import { exportModelToDrawioXml, parseDrawioStyle } from '../../services/drawio-xml';
import { createTestGraph, cleanupTestGraph } from '../setup';
import { loadAppDom, clearAppDom } from './app-dom';

const TEMPLATE_LINE = 'vsdxID=17;edgeStyle=none;startArrow=none;endArrow=none;startSize=5;endSize=5;' +
  'strokeColor=light-dark(#e00000, #5f5f5f);shadow=0;html=1;labelBackgroundColor=#ffffff;rounded=0;strokeWidth=6;';
const TEMPLATE_SHAPE = 'vsdxID=73;fillColor=#000000;gradientColor=none;strokeColor=none;shadow=0;' +
  'labelBackgroundColor=none;rounded=0;html=1;whiteSpace=wrap;';

function addVertex(graph: Graph, style: string, parent = graph.getDefaultParent()): Cell {
  return graph.insertVertex(parent, null, '', 10, 10, 80, 40, parseDrawioStyle(style));
}

function addEdge(graph: Graph, style: string, parent = graph.getDefaultParent()): Cell {
  const edge = new Cell('', new Geometry(), parseDrawioStyle(style));
  edge.setEdge(true);
  const geo = edge.getGeometry()!;
  geo.relative = true;
  geo.setTerminalPoint(new Point(0, 100), true);
  geo.setTerminalPoint(new Point(200, 100), false);
  return graph.addCell(edge, parent);
}

function own(cell: Cell): Record<string, unknown> {
  return ownStyleCopy(cell);
}

function change(id: string, value: string): void {
  const input = document.getElementById(id) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('change'));
}

describe('style-edit helpers', () => {
  let graph: Graph;

  beforeEach(() => {
    graph = createTestGraph();
    configureDiagramRendering(graph);
  });

  afterEach(() => cleanupTestGraph(graph));

  it('the resolved style drops none values (why writing it back was wrong)', () => {
    const shape = addVertex(graph, TEMPLATE_SHAPE);
    const resolved = graph.getCellStyle(shape) as Record<string, unknown>;
    expect(resolved.strokeColor).toBeUndefined();
    expect(effectiveColor(resolved, 'strokeColor')).toBe('none');
    expect(effectiveColor(resolved, 'fillColor')).toBe('#000000');
  });

  it('changes only the edited keys of the own style', () => {
    const shape = addVertex(graph, `text;${TEMPLATE_SHAPE}`);
    const before = own(shape);
    applyStyleToCells(graph, [shape], (style) => { style.fillColor = '#00ff00'; });
    expect(own(shape)).toEqual({ ...before, fillColor: '#00ff00' });
    expect(own(shape).baseStyleNames).toEqual(['text']);
    expect(own(shape).strokeColor).toBe('none');
  });

  it('replaces light-dark() with the explicit color and keeps arrows off', () => {
    const line = addEdge(graph, TEMPLATE_LINE);
    const before = own(line);
    setCellStyleValues(graph, [line], { strokeColor: '#ff0000' });
    expect(own(line)).toEqual({ ...before, strokeColor: '#ff0000' });
    const resolved = graph.getCellStyle(line) as Record<string, unknown>;
    expect(resolved.endArrow).toBeUndefined(); // none
    expect(resolved.strokeColor).toBe('#ff0000');
  });

  it('null/undefined remove keys; unchanged cells are not touched', () => {
    const line = addEdge(graph, 'endArrow=none;dashed=1;dashPattern=1 2;');
    const setStyle = vi.spyOn(graph.getDataModel(), 'setStyle');
    expect(setCellStyleValues(graph, [line], { dashed: 1 })).toEqual([]);
    expect(setStyle).not.toHaveBeenCalled();
    setCellStyleValues(graph, [line], { dashed: null, dashPattern: undefined });
    expect(own(line)).toEqual({ endArrow: 'none' });
  });

  it('one undoable edit for several cells', () => {
    const a = addVertex(graph, TEMPLATE_SHAPE);
    const b = addVertex(graph, TEMPLATE_SHAPE);
    const edits: unknown[] = [];
    graph.getDataModel().addListener(InternalEvent.UNDO, (_s: unknown, evt: { getProperty(n: string): unknown }) => edits.push(evt.getProperty('edit')));
    setCellStyleValues(graph, [a, b], { strokeColor: '#123456' });
    expect(edits).toHaveLength(1);
  });

  it('keeps the draw.io keys on export (only the edited key differs)', () => {
    const line = addEdge(graph, TEMPLATE_LINE);
    setCellStyleValues(graph, [line], { strokeColor: '#ff0000' });
    const xml = exportModelToDrawioXml(graph.getDataModel());
    expect(xml).toContain('endArrow=none');
    expect(xml).toContain('startArrow=none');
    expect(xml).toContain('edgeStyle=none');
    expect(xml).toContain('strokeColor=#ff0000');
    expect(xml).not.toContain('light-dark(#e00000');
  });

  it('toColorInputValue', () => {
    expect(toColorInputValue('#E00000', '#000000')).toBe('#e00000');
    expect(toColorInputValue('#abc', '#000000')).toBe('#aabbcc');
    expect(toColorInputValue('a5a5a5', '#000000')).toBe('#a5a5a5');
    expect(toColorInputValue('#11223344', '#000000')).toBe('#112233');
    expect(toColorInputValue('rgb(255, 0, 16)', '#000000')).toBe('#ff0010');
    expect(toColorInputValue('White', '#000000')).toBe('#ffffff');
    expect(toColorInputValue('none', '#ffffff')).toBe('#ffffff');
    expect(toColorInputValue('light-dark(#000, #fff)', '#123456')).toBe('#123456');
    expect(toColorInputValue(undefined, '#000000')).toBe('#000000');
  });

  it('line patterns as draw.io writes them; dash patterns need dashed=1', () => {
    expect(linePatternStyle('solid')).toEqual({ dashed: null, dashPattern: null });
    expect(linePatternStyle('dashed')).toEqual({ dashed: 1, dashPattern: null });
    expect(linePatternStyle('dotted')).toEqual({ dashed: 1, dashPattern: '1 2' });
    expect(linePatternOf({})).toBe('solid');
    expect(linePatternOf({ dashed: 1 })).toBe('dashed');
    expect(linePatternOf({ dashed: true, dashPattern: '1 2' })).toBe('dotted');
    expect(dashPatternStyle('5,3')).toEqual({ dashed: 1, dashPattern: '5 3' });
    expect(dashPatternStyle('none')).toEqual({ dashed: null, dashPattern: null });
    expect(dashPatternOf({ dashed: 1 })).toBe('3 3');
    expect(dashPatternOf({ dashed: 0, dashPattern: '1 2' })).toBe('none');
  });
});

describe('properties panels on draw.io / template cells', () => {
  let graph: Graph;
  let panel: PropertiesPanel;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    loadAppDom();
    graph = createTestGraph();
    configureDiagramRendering(graph);
    document.getElementById('graph-container')!.appendChild(graph.container);
    panel = new PropertiesPanel(graph);
    new EdgePropertiesController(graph);
  });

  afterEach(() => {
    panel.destroy();
    cleanupTestGraph(graph);
    clearAppDom();
    vi.restoreAllMocks();
  });

  it('shows the drawn line color of a light-dark() line and changes it', () => {
    const line = addEdge(graph, TEMPLATE_LINE);
    graph.setSelectionCell(line);
    expect((document.getElementById('prop-strokeColor') as HTMLInputElement).value).toBe('#e00000');
    expect((document.getElementById('prop-useLine') as HTMLInputElement).checked).toBe(true);
    const before = own(line);
    change('prop-strokeColor', '#ff0000');
    expect(own(line)).toEqual({ ...before, strokeColor: '#ff0000' });
    expect((document.getElementById('prop-strokeColorText') as HTMLInputElement).value).toBe('#ff0000');
  });

  it('a fill edit keeps strokeColor=none (no black outline appears)', () => {
    const shape = addVertex(graph, TEMPLATE_SHAPE);
    graph.setSelectionCell(shape);
    expect((document.getElementById('prop-useLine') as HTMLInputElement).checked).toBe(false);
    const before = own(shape);
    change('prop-fillColor', '#ffcc00');
    expect(own(shape)).toEqual({ ...before, fillColor: '#ffcc00' });
  });

  it('line checkbox, width, line style and dash pattern', () => {
    const shape = addVertex(graph, TEMPLATE_SHAPE);
    graph.setSelectionCell(shape);
    change('prop-strokeColor', '#0000ff');
    const useLine = document.getElementById('prop-useLine') as HTMLInputElement;
    expect(useLine.checked).toBe(true);
    useLine.checked = false;
    useLine.dispatchEvent(new Event('change'));
    expect(own(shape).strokeColor).toBe('none');
    useLine.checked = true;
    useLine.dispatchEvent(new Event('change'));
    expect(own(shape).strokeColor).toBe('#0000ff');
    change('prop-strokeWidth', '2.5');
    expect(own(shape).strokeWidth).toBe(2.5);
    change('prop-lineStyle', 'dotted');
    expect(own(shape)).toMatchObject({ dashed: 1, dashPattern: '1 2' });
    change('prop-dashPattern', '8 4');
    expect(own(shape)).toMatchObject({ dashed: 1, dashPattern: '8 4' });
    change('prop-lineStyle', 'solid');
    expect(own(shape).dashed).toBeUndefined();
    expect(own(shape).dashPattern).toBeUndefined();
    expect(own(shape).gradientColor).toBe('none');
  });

  it('applies to every selected cell, keeping base style names', () => {
    const a = addVertex(graph, 'text;html=1;strokeColor=none;fillColor=none;');
    const b = addVertex(graph, 'ellipse;whiteSpace=wrap;html=1;');
    graph.setSelectionCells([a, b]);
    change('prop-strokeColor', '#00aa00');
    expect(own(a)).toEqual({ baseStyleNames: ['text'], html: true, strokeColor: '#00aa00', fillColor: 'none' });
    expect(own(b)).toEqual({ baseStyleNames: ['ellipse'], whiteSpace: 'wrap', html: true, strokeColor: '#00aa00' });
  });

  it('a group selection edits the group cell only (draw.io); its children keep their style', () => {
    const group = addVertex(graph, 'group');
    const child = addVertex(graph, TEMPLATE_SHAPE, group);
    const before = own(child);
    graph.setSelectionCell(group);
    change('prop-strokeColor', '#ff0000');
    expect(own(group)).toEqual({ baseStyleNames: ['group'], strokeColor: '#ff0000' });
    expect(own(child)).toEqual(before);
  });

  it('connector panel: shows endArrow=none as None and keeps it on a color edit', () => {
    const line = addEdge(graph, TEMPLATE_LINE);
    const other = addEdge(graph, 'endArrow=classic;html=1;');
    graph.setSelectionCells([line, other]);
    expect((document.getElementById('edge-target-arrow') as HTMLSelectElement).value).toBe('none');
    expect((document.getElementById('edge-line-color') as HTMLInputElement).value).toBe('#e00000');
    expect((document.getElementById('edge-line-width') as HTMLInputElement).value).toBe('6');
    const before = own(line);
    change('edge-line-color', '#00ff00');
    expect(own(line)).toEqual({ ...before, strokeColor: '#00ff00' });
    expect(own(other)).toEqual({ endArrow: 'classic', html: true, strokeColor: '#00ff00' });
  });

  it('connector panel: None arrow is written explicitly (the default edge style has an arrow)', () => {
    const edge = addEdge(graph, 'html=1;');
    graph.setSelectionCell(edge);
    expect((document.getElementById('edge-target-arrow') as HTMLSelectElement).value).toBe('classic');
    change('edge-target-arrow', 'none');
    expect(own(edge).endArrow).toBe('none');
    expect((graph.getCellStyle(edge) as CellStyle).endArrow).toBeUndefined();
    change('edge-line-style', 'dashed');
    expect(own(edge)).toEqual({ html: true, endArrow: 'none', dashed: 1 });
  });
});
