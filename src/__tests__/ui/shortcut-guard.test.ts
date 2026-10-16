/**
 * Regression: Delete/Backspace and clipboard shortcuts fired while the user typed in a field
 * (inputs, contentEditable label editor), deleting the selected cell.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Graph } from '@maxgraph/core';
import { DeleteController, shouldIgnoreGraphShortcut } from '../../ui/delete';
import { ClipboardController } from '../../ui/clipboard';
import { createTestGraph, cleanupTestGraph } from '../setup';

describe('graph shortcut focus guard', () => {
  let graph: Graph;
  let input: HTMLInputElement;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    graph = createTestGraph();
    document.body.appendChild(graph.container);
    input = document.createElement('input');
    document.body.appendChild(input);
  });

  afterEach(() => {
    input.remove();
    graph.container.remove();
    cleanupTestGraph(graph);
    vi.restoreAllMocks();
  });

  const keydown = (target: EventTarget, key: string) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  };

  it('Delete typed in an input does not delete the selected cell', () => {
    new DeleteController(graph);
    new ClipboardController(graph);
    const cell = graph.insertVertex(graph.getDefaultParent(), null, 'A', 10, 10, 80, 40);
    graph.setSelectionCell(cell);

    input.focus();
    const event = keydown(input, 'Delete');
    keydown(input, 'Backspace');

    expect(shouldIgnoreGraphShortcut(event, graph)).toBe(true);
    expect(graph.getDataModel().contains(cell)).toBe(true);
    expect(event.defaultPrevented).toBe(false);
  });

  it('ignores shortcuts from contentEditable and select elements', () => {
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    // jsdom does not implement isContentEditable
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    const select = document.createElement('select');
    document.body.append(editable, select);

    let event = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true });
    editable.dispatchEvent(event);
    expect(shouldIgnoreGraphShortcut(event, graph)).toBe(true);

    event = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true });
    select.dispatchEvent(event);
    expect(shouldIgnoreGraphShortcut(event, graph)).toBe(true);

    editable.remove();
    select.remove();
  });

  it('does not ignore shortcuts aimed at the canvas', () => {
    input.blur();
    const event = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true });
    graph.container.dispatchEvent(event);
    expect(shouldIgnoreGraphShortcut(event, graph)).toBe(false);
  });
});
