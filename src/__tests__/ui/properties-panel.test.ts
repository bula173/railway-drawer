/**
 * Regression: PropertiesPanel.update() re-wired every control on each selection change,
 * so after N selection changes one click ran N handlers (rotate 90 added N*90 degrees,
 * flips toggled back and forth). Each tab's panel also edited hidden tabs' cells.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Cell, Graph } from '@maxgraph/core';
import { PropertiesPanel } from '../../ui/properties';
import { createTestGraph, cleanupTestGraph } from '../setup';
import { loadAppDom, clearAppDom } from './app-dom';

describe('PropertiesPanel handlers', () => {
  let graph: Graph;
  let panel: PropertiesPanel;
  let a: Cell;
  let b: Cell;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    loadAppDom();
    graph = createTestGraph();
    document.getElementById('graph-container')!.appendChild(graph.container);
    panel = new PropertiesPanel(graph);
    a = graph.insertVertex(graph.getDefaultParent(), null, 'A', 10, 10, 80, 40);
    b = graph.insertVertex(graph.getDefaultParent(), null, 'B', 200, 10, 80, 40);
  });

  afterEach(() => {
    panel.destroy();
    cleanupTestGraph(graph);
    clearAppDom();
    vi.restoreAllMocks();
  });

  const changeSelectionManyTimes = () => {
    for (let i = 0; i < 6; i++) {
      graph.setSelectionCell(i % 2 === 0 ? a : b);
    }
    graph.setSelectionCell(a);
  };

  it('rotate 90 runs once after several selection changes', () => {
    changeSelectionManyTimes();
    document.getElementById('btn-rotate90')!.click();
    expect(graph.getCellStyle(a).rotation).toBe(90);
    expect(graph.getCellStyle(b).rotation ?? 0).toBe(0);
  });

  it('flip horizontal toggles exactly once per click', () => {
    changeSelectionManyTimes();
    document.getElementById('btn-flipHorizontal')!.click();
    expect(graph.getCellStyle(a).flipH).toBe(true);
    document.getElementById('btn-flipHorizontal')!.click();
    expect(graph.getCellStyle(a).flipH).toBe(false);
  });

  it('a style edit is applied once, to the current selection', () => {
    changeSelectionManyTimes();
    const setStyle = vi.spyOn(graph.model, 'setStyle');
    const fontSize = document.getElementById('prop-fontSize') as HTMLInputElement;
    fontSize.value = '17';
    fontSize.dispatchEvent(new Event('change'));
    expect(setStyle).toHaveBeenCalledTimes(1);
    expect(graph.getCellStyle(a).fontSize).toBe(17);
  });

  it('a hidden tab panel ignores edits', () => {
    graph.setSelectionCell(a);
    graph.container.style.display = 'none';
    document.getElementById('btn-rotate90')!.click();
    expect(graph.getCellStyle(a).rotation ?? 0).toBe(0);
  });

  it('a position edit goes through the model and is undoable', () => {
    graph.setSelectionCell(a);
    const setGeometry = vi.spyOn(graph.model, 'setGeometry');
    const x = document.getElementById('prop-x') as HTMLInputElement;
    x.value = '123';
    x.dispatchEvent(new Event('change'));
    expect(setGeometry).toHaveBeenCalledTimes(1);
    expect(a.getGeometry()?.x).toBe(123);
  });
});
