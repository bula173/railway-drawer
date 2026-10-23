/**
 * UX batch 1: shortcut hints, context-menu placement, Properties panel states and header, ERTMS
 * display titles, themed Save As / confirm dialogs, railML summary plurals.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { Graph } from '@maxgraph/core';
import type { Cell } from '@maxgraph/core';
import { applyShortcutHints, ariaKeyShortcut, formatShortcut, setMenuItemLabel, shortcutSpecFor } from '../../ui/shortcut-keys';
import { registerAppCommands } from '../../ui/commands';
import { placeContextMenu } from '../../ui/context-menu';
import { selectionTitle, setPropertiesPanelState } from '../../ui/properties-state';
import { ertmsDisplayEntry, ertmsDisplayTitle, POINTS_SEARCH_TAGS } from '../../ui/ertms-display';
import { confirmDialog, promptSaveAs, showAboutDialog } from '../../ui/app-dialogs';
import { setRailwayData } from '../../railway/object-data';
import { exportSummary } from '../../railml/railml-ui';
import type { RailmlExportResult } from '../../railml/export';
import type { PaletteEntry } from '../../ui/drawio-palette';
import { APP_VERSION } from '../../config/build-id';

registerAppCommands();

afterEach(() => {
  document.body.innerHTML = '';
});

describe('shortcut hints', () => {
  it('formats Ctrl on Windows/Linux and Cmd symbols on macOS', () => {
    expect(formatShortcut(shortcutSpecFor('undo')!, false)).toBe('Ctrl+Z');
    expect(formatShortcut(shortcutSpecFor('ungroup')!, false)).toBe('Ctrl+Shift+G');
    expect(formatShortcut(shortcutSpecFor('ungroup')!, true)).toBe('⇧⌘G');
    expect(formatShortcut(shortcutSpecFor('toggleConnectionArrows')!, true)).toBe('⌥⇧A');
    expect(formatShortcut(shortcutSpecFor('delete')!, false)).toBe('Delete');
    expect(ariaKeyShortcut(shortcutSpecFor('zoomIn')!, false)).toBe('Control+Plus');
    expect(ariaKeyShortcut(shortcutSpecFor('copy')!, true)).toBe('Meta+C');
  });

  it('adds one right-aligned <kbd> per item with a shortcut and keeps it when the label changes', () => {
    document.body.innerHTML = '<div data-action="copy">Copy</div><div data-action="lock">Lock</div>';
    const items = document.querySelectorAll<HTMLElement>('[data-action]');
    applyShortcutHints(items, false);
    applyShortcutHints(items, false);
    const copy = items[0];
    expect(copy.querySelectorAll('kbd.rd-kbd')).toHaveLength(1);
    expect(copy.querySelector('.rd-menu-label')!.textContent).toBe('Copy');
    expect(copy.querySelector('kbd')!.textContent).toBe('Ctrl+C');
    expect(copy.getAttribute('aria-keyshortcuts')).toBe('Control+C');
    expect(items[1].querySelector('kbd')).toBeNull();
    setMenuItemLabel(copy, 'Copy all');
    expect(copy.querySelector('.rd-menu-label')!.textContent).toBe('Copy all');
    expect(copy.querySelector('kbd')!.textContent).toBe('Ctrl+C');
  });
});

describe('context menu placement', () => {
  it('opens at the pointer when it fits', () => {
    expect(placeContextMenu(100, 100, 200, 300, 1280, 800)).toEqual({ left: 100, top: 100 });
  });

  it('flips left/up near the bottom-right corner and stays inside the window', () => {
    expect(placeContextMenu(1270, 790, 200, 300, 1280, 800)).toEqual({ left: 1070, top: 490 });
    // taller than the space above and below: clamped to the window
    expect(placeContextMenu(10, 100, 200, 900, 1280, 800)).toEqual({ left: 10, top: 4 });
  });
});

describe('Properties panel state', () => {
  const panelDom = (): void => {
    document.body.innerHTML = `<div id="property-content">
      <h2 id="prop-selection-header" hidden></h2>
      <p id="prop-placeholder">hint</p>
      <div id="canvas-props" style="display:none"></div>
      <div id="prop-editor" style="display:none"></div>
      <div id="edge-properties" style="display:block"></div>
    </div>`;
  };
  const shown = (id: string): boolean => document.getElementById(id)!.style.display !== 'none';

  it('shows exactly one of none / canvas / cell', () => {
    panelDom();
    setPropertiesPanelState('none');
    expect([shown('prop-placeholder'), shown('canvas-props'), shown('prop-editor'), shown('edge-properties')]).toEqual([true, false, false, false]);
    expect(document.getElementById('prop-selection-header')!.hidden).toBe(true);
    setPropertiesPanelState('canvas');
    expect([shown('prop-placeholder'), shown('canvas-props'), shown('prop-editor')]).toEqual([false, true, false]);
    setPropertiesPanelState('cell', 'Signal S1');
    expect([shown('prop-placeholder'), shown('canvas-props'), shown('prop-editor')]).toEqual([false, false, true]);
    expect(document.getElementById('prop-editor')!.style.display).toBe('flex');
    const header = document.getElementById('prop-selection-header')!;
    expect(header.hidden).toBe(false);
    expect(header.textContent).toBe('Signal S1');
    expect(document.getElementById('property-content')!.dataset.state).toBe('cell');
  });

  it('names the selection: railway object, label, group, several cells', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const graph = new Graph(container);
    const parent = graph.getDefaultParent();
    const signal = graph.insertVertex({ parent, value: 'S', position: [0, 0], size: [20, 20] });
    setRailwayData(graph.getDataModel(), [signal], { kind: 'signal', values: { id: 'S1' } });
    const box = graph.insertVertex({ parent, value: '<b>Station</b> A', position: [50, 0], size: [20, 20] });
    const plain = graph.insertVertex({ parent, value: '', position: [100, 0], size: [20, 20] });
    const edge = graph.insertEdge({ parent, source: box, target: plain });
    expect(selectionTitle(graph, [signal])).toBe('Signal S1');
    expect(selectionTitle(graph, [box])).toBe('Station A');
    expect(selectionTitle(graph, [plain])).toBe('Shape');
    expect(selectionTitle(graph, [box, plain, signal])).toBe('3 shapes');
    expect(selectionTitle(graph, [box, edge])).toBe('2 items');
    const group = graph.groupCells(null as unknown as Cell, 0, [box, plain]);
    expect(selectionTitle(graph, [group])).toBe('Group');
    graph.destroy();
  });
});

describe('ERTMS display titles (ertms.xml unchanged)', () => {
  it('fixes stray spaces and the "SIgnal" typo, keeps acronyms', () => {
    expect(ertmsDisplayTitle('SIgnal Right 4')).toBe('Signal Right 4');
    expect(ertmsDisplayTitle('Line ')).toBe('Line');
    expect(ertmsDisplayTitle('SSP Curve')).toBe('SSP Curve');
    expect(ertmsDisplayTitle('TC')).toBe('TC');
  });

  it('adds switch / turnout / zwrotnica as search tags of the points entries', () => {
    const entry = (title: string): PaletteEntry => ({ id: 'ertms-1-x', title, kind: 'cells', width: 10, height: 10, tags: 'ertms etcs', shapeNames: [], cls: 'library', source: 'libraries/ertms.xml#1' }) as unknown as PaletteEntry;
    expect(ertmsDisplayEntry(entry('Point Left')).tags).toBe(`ertms etcs ${POINTS_SEARCH_TAGS}`);
    expect(ertmsDisplayEntry(entry('Signal Left 3')).tags).toBe('ertms etcs signal semafor sygnalizator');
    expect(ertmsDisplayEntry(entry('Balise Left')).tags).toContain('balisa');
    expect(ertmsDisplayEntry(entry('Train Connected')).tags).toContain('pociąg');
    expect(ertmsDisplayEntry(entry('Track')).tags).toContain(' tor');
    expect(ertmsDisplayEntry(entry('Gradient')).tags).toBe('ertms etcs');
    expect(ertmsDisplayEntry(entry('SIgnal Right 4')).title).toBe('Signal Right 4');
  });
});

describe('themed dialogs', () => {
  const key = (k: string, target: EventTarget = document.activeElement ?? document.body): void => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  };

  it('Save As: Enter downloads with the typed name, Escape cancels; focus returns', async () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const pending = promptSaveAs('Plan');
    const dialog = document.querySelector('[data-testid="save-as-dialog"]')!;
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.textContent).toContain('.drawio');
    const input = dialog.querySelector('input')!;
    expect(document.activeElement).toBe(input);
    input.value = 'Station A.drawio';
    key('Enter', input);
    expect(await pending).toBe('Station A');
    expect(document.querySelector('[data-testid="save-as-dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);

    const cancelled = promptSaveAs('Plan');
    key('Escape');
    expect(await cancelled).toBeNull();
  });

  it('confirm resolves true on Enter and false on Escape', async () => {
    const yes = confirmDialog({ title: 'Delete layer', message: 'Sure?', danger: true });
    key('Enter', document.querySelector('[data-testid="confirm-dialog"]')!);
    expect(await yes).toBe(true);
    const no = confirmDialog({ title: 'Delete layer' });
    key('Escape');
    expect(await no).toBe(false);
  });

  it('About shows the version of the status bar source', () => {
    const modal = showAboutDialog();
    expect(modal.dialog.querySelector('[data-testid="about-version"]')!.textContent).toBe(APP_VERSION);
    expect(modal.dialog.querySelectorAll('a[href^="https://"]').length).toBeGreaterThan(0);
    modal.close();
  });
});

describe('railML export summary', () => {
  it('uses singular forms for one and "points" for switches', () => {
    const lines = exportSummary({ counts: { track: 1, switchIS: 1, signalIS: 2, balise: 1, baliseGroup: 1 } } as unknown as RailmlExportResult);
    expect(lines[1]).toBe('1 track, 1 points, 2 signals, 1 balise in 1 balise group');
    expect(lines[0]).toBe('0 netElements, 0 netRelations');
  });
});
