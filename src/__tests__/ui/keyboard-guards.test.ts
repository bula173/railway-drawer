/**
 * Regression: per-tab controllers bound `document` keydown handlers without the editing guard, so
 * Space (pan, start label edit) and Ctrl+D/H/G typed in a text field were swallowed or acted on
 * the diagram. Also: the "Duplicate Multiple Times" dialog left a `document` keydown listener
 * behind for good every time it was opened.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Graph } from '@maxgraph/core';
import { PanController } from '../../ui/pan';
import { TextEditorController } from '../../ui/text-editor';
import { TransformController } from '../../ui/transform';
import { GroupingController } from '../../ui/grouping';
import { DuplicateOffsetController } from '../../ui/duplicate-offset';
import { createTestGraph, cleanupTestGraph } from '../setup';

describe('document keyboard handlers respect text editing', () => {
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
    document.body.innerHTML = '';
    cleanupTestGraph(graph);
    vi.restoreAllMocks();
  });

  const keydown = (target: EventTarget, key: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
  };

  it('Space typed in an input is not swallowed by pan mode or label editing', () => {
    const pan = new PanController(graph);
    const enablePan = vi.spyOn(pan, 'enablePan');
    new TextEditorController(graph);
    const cell = graph.insertVertex(graph.getDefaultParent(), null, 'A', 10, 10, 80, 40);
    graph.setSelectionCell(cell);

    input.focus();
    const event = keydown(input, ' ');

    expect(event.defaultPrevented).toBe(false);
    expect(enablePan).not.toHaveBeenCalled();
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('Space on the canvas still enables pan mode', () => {
    const pan = new PanController(graph);
    const enablePan = vi.spyOn(pan, 'enablePan');

    input.blur();
    const event = keydown(graph.container, ' ');

    expect(event.defaultPrevented).toBe(true);
    expect(enablePan).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+D/H/G typed in an input do not change the diagram', () => {
    const transform = new TransformController(graph);
    const grouping = new GroupingController(graph);
    const duplicate = new DuplicateOffsetController(graph);
    const flip = vi.spyOn(transform, 'flipHorizontal');
    const group = vi.spyOn(grouping, 'group');
    const dup = vi.spyOn(duplicate, 'duplicateOnce');
    const a = graph.insertVertex(graph.getDefaultParent(), null, 'A', 10, 10, 80, 40);
    const b = graph.insertVertex(graph.getDefaultParent(), null, 'B', 110, 10, 80, 40);
    graph.setSelectionCells([a, b]);

    input.focus();
    const events = ['d', 'h', 'g'].map((key) => keydown(input, key, { ctrlKey: true }));

    events.forEach((event) => expect(event.defaultPrevented).toBe(false));
    expect(dup).not.toHaveBeenCalled();
    expect(flip).not.toHaveBeenCalled();
    expect(group).not.toHaveBeenCalled();
    expect(graph.getChildVertices(graph.getDefaultParent())).toHaveLength(2);
  });

  it('the duplicate dialog removes its document Escape listener when it closes', () => {
    const multiBtn = document.createElement('button');
    multiBtn.id = 'btn-duplicate-multi';
    document.body.appendChild(multiBtn);
    const controller = new DuplicateOffsetController(graph);

    const added: EventListenerOrEventListenerObject[] = [];
    const removed: EventListenerOrEventListenerObject[] = [];
    const add = document.addEventListener.bind(document);
    const remove = document.removeEventListener.bind(document);
    vi.spyOn(document, 'addEventListener').mockImplementation((type, listener, options) => {
      if (type === 'keydown' && listener) added.push(listener);
      add(type, listener, options);
    });
    vi.spyOn(document, 'removeEventListener').mockImplementation((type, listener, options) => {
      if (type === 'keydown' && listener) removed.push(listener);
      remove(type, listener, options);
    });

    multiBtn.click();
    expect(document.body.textContent).toContain('Duplicate Multiple Times');
    keydown(document.body, 'Escape');
    expect(document.body.textContent).not.toContain('Duplicate Multiple Times');

    // Open again, then close the tab with the dialog still open
    multiBtn.click();
    controller.destroy();
    expect(document.body.textContent).not.toContain('Duplicate Multiple Times');

    expect(added).toHaveLength(2);
    expect(removed).toEqual(added);
  });
});
