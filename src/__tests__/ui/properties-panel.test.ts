/**
 * Regression: PropertiesPanel.update() re-wired every control on each selection change,
 * so after N selection changes one click ran N handlers (rotate 90 added N*90 degrees,
 * flips toggled back and forth). Each tab's panel also edited hidden tabs' cells.
 * The Arrange buttons (rotate / flip, z-order, snap to grid, copy size, lock) are `data-command`
 * buttons running the registry's commands (source 'panel'), one undo step each.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Cell, Graph, InternalEvent, UndoManager } from '@maxgraph/core';
import type { EventObject } from '@maxgraph/core';
import { PropertiesPanel } from '../../ui/properties';
import { bindCommandButtons } from '../../ui/toolbar';
import { commandRegistry } from '../../ui/commands/registry';
import { registerAppCommands } from '../../ui/commands';
import { GraphCommandService } from '../../services/graph-command-service';
import { hasLockedStyle, installCellLocking } from '../../ui/cell-lock';
import type { TabData } from '../../ui/tabs';
import { createTestGraph, cleanupTestGraph } from '../setup';
import { loadAppDom, clearAppDom } from './app-dom';

describe('PropertiesPanel handlers', () => {
  let graph: Graph;
  let panel: PropertiesPanel;
  let a: Cell;
  let b: Cell;
  let buttons: AbortController;
  let undo: UndoManager;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    loadAppDom();
    graph = createTestGraph();
    document.getElementById('graph-container')!.appendChild(graph.container);
    panel = new PropertiesPanel(graph);
    registerAppCommands();
    const tab = { graph, graphCommandService: new GraphCommandService(graph) } as unknown as TabData;
    commandRegistry.setActiveTabProvider(() => tab);
    buttons = new AbortController();
    bindCommandButtons(document.getElementById('property-content')!, buttons.signal, 'panel');
    installCellLocking(graph);
    undo = new UndoManager();
    graph.getDataModel().addListener(InternalEvent.UNDO, (_s: unknown, evt: EventObject) => undo.undoableEditHappened(evt.getProperty('edit')));
    a = graph.insertVertex(graph.getDefaultParent(), null, 'A', 10, 10, 80, 40);
    b = graph.insertVertex(graph.getDefaultParent(), null, 'B', 200, 10, 80, 40);
  });

  afterEach(() => {
    buttons.abort();
    commandRegistry.setActiveTabProvider(() => null);
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

  const click = (id: string): void => document.getElementById(id)!.click();

  it('every Arrange button names a registered command', () => {
    for (const id of ['btn-toFront', 'btn-toBack', 'btn-bringForward', 'btn-sendBackward', 'btn-rotate90', 'btn-flipHorizontal',
      'btn-flipVertical', 'btn-snap-to-grid', 'btn-copySize', 'btn-lock', 'btn-group', 'btn-ungroup']) {
      const command = document.getElementById(id)!.dataset.command;
      expect(command, id).toBeTruthy();
      expect(commandRegistry.has(command!), id).toBe(true);
    }
  });

  it('z-order buttons keep the relative order of the selection, one undo step each', () => {
    const c = graph.insertVertex(graph.getDefaultParent(), null, 'C', 300, 10, 80, 40);
    const order = (): string[] => graph.getDefaultParent().children.map((x) => x.value as string);
    undo.clear();
    graph.setSelectionCells([a, b]);
    click('btn-toBack');
    expect(order()).toEqual(['A', 'B', 'C']);
    graph.setSelectionCells([a, b]);
    click('btn-toFront');
    expect(order()).toEqual(['C', 'A', 'B']);
    const steps = undo.history.length;
    graph.setSelectionCell(c);
    click('btn-bringForward');
    expect(order()).toEqual(['A', 'C', 'B']);
    click('btn-sendBackward');
    expect(order()).toEqual(['C', 'A', 'B']);
    expect(undo.history.length).toBe(steps + 2);
    undo.undo();
    expect(order()).toEqual(['A', 'C', 'B']);
  });

  it('rotate / flip refresh the field and the pressed state; one undo step each', () => {
    undo.clear();
    graph.setSelectionCell(a);
    click('btn-rotate90');
    expect((document.getElementById('prop-rotation') as HTMLInputElement).value).toBe('90');
    click('btn-flipVertical');
    expect(document.getElementById('btn-flipVertical')!.classList.contains('rd-btn-on')).toBe(true);
    expect(undo.history.length).toBe(2);
    undo.undo();
    expect(graph.getCellStyle(a).flipV).toBeFalsy();
    expect(document.getElementById('btn-flipVertical')!.classList.contains('rd-btn-on')).toBe(false);
  });

  it('snap to grid moves the selected vertices onto the grid through the model, one undo step', () => {
    graph.gridSize = 10;
    const m = graph.getDataModel();
    const ga = a.getGeometry()!.clone(); ga.x = 13; ga.y = 27; m.setGeometry(a, ga);
    const gb = b.getGeometry()!.clone(); gb.x = 204; gb.y = 6; m.setGeometry(b, gb);
    undo.clear();
    graph.setSelectionCells([a, b]);
    click('btn-snap-to-grid');
    expect([a.getGeometry()!.x, a.getGeometry()!.y, b.getGeometry()!.x, b.getGeometry()!.y]).toEqual([10, 30, 200, 10]);
    expect(undo.history.length).toBe(1);
    undo.undo();
    expect([a.getGeometry()!.x, a.getGeometry()!.y, b.getGeometry()!.x, b.getGeometry()!.y]).toEqual([13, 27, 204, 6]);
  });

  it('copy size gives the other selected vertices the first one\'s size, one undo step; locked cells keep theirs', () => {
    const c = graph.insertVertex(graph.getDefaultParent(), null, 'C', 300, 10, 30, 30);
    const d = graph.insertVertex(graph.getDefaultParent(), null, 'D', 400, 10, 50, 20, 'locked=1;');
    const ga = a.getGeometry()!.clone(); ga.width = 120; ga.height = 60; graph.getDataModel().setGeometry(a, ga);
    undo.clear();
    graph.setSelectionCells([a, b, c, d]);
    click('btn-copySize');
    expect([b.getGeometry()!.width, b.getGeometry()!.height, c.getGeometry()!.width, c.getGeometry()!.height]).toEqual([120, 60, 120, 60]);
    expect([d.getGeometry()!.width, d.getGeometry()!.height]).toEqual([50, 20]);
    expect(b.getGeometry()!.x).toBe(200);
    expect(undo.history.length).toBe(1);
  });

  it('lock toggles through the command and the button follows (also on undo)', () => {
    undo.clear();
    graph.setSelectionCell(a);
    click('btn-lock');
    expect(hasLockedStyle(a)).toBe(true);
    expect(document.getElementById('btn-lock')!.textContent).toBe('Unlock');
    expect(undo.history.length).toBe(1);
    undo.undo();
    expect(hasLockedStyle(a)).toBe(false);
    expect(document.getElementById('btn-lock')!.textContent).toBe('Lock');
  });
});
