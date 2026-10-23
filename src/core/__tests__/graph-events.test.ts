import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { Graph, InternalEvent } from '@maxgraph/core';
import { Disposers, eventChanges, onGraphEvent, onModelChange, onModelEvent, onSelectionChange, onViewTransform } from '../graph-events';

const SRC = join(__dirname, '..', '..');

describe('graph listener helpers', () => {
  it('model, selection and view listeners fire until disposed', () => {
    const graph = new Graph(document.createElement('div'));
    try {
      const model = vi.fn();
      const undo = vi.fn();
      const selection = vi.fn();
      const view = vi.fn();
      const offs = new Disposers();
      offs.add(onModelChange(graph, (_s, evt) => model(eventChanges(evt).length)));
      offs.add(onModelEvent(graph, InternalEvent.UNDO, undo));
      offs.add(onSelectionChange(graph, selection));
      offs.add(onViewTransform(graph, view));
      const v = graph.insertVertex(graph.getDefaultParent(), null, 'a', 0, 0, 10, 10);
      graph.setSelectionCell(v);
      graph.view.setScale(2);
      graph.view.setTranslate(5, 5);
      expect(model).toHaveBeenCalledWith(1);
      expect(undo).toHaveBeenCalled();
      expect(selection).toHaveBeenCalledTimes(1);
      expect(view).toHaveBeenCalledTimes(2);
      offs.dispose();
      offs.dispose(); // idempotent
      const calls = [model, undo, selection, view].map((f) => f.mock.calls.length);
      graph.insertVertex(graph.getDefaultParent(), null, 'b', 0, 0, 10, 10);
      graph.clearSelection();
      graph.view.setScale(1);
      expect([model, undo, selection, view].map((f) => f.mock.calls.length)).toEqual(calls);
    } finally {
      graph.destroy();
    }
  });

  it('onGraphEvent disposer removes the handler from every name it was added for', () => {
    const graph = new Graph(document.createElement('div'));
    try {
      const fn = vi.fn();
      const off = onGraphEvent(graph.view, [InternalEvent.SCALE, InternalEvent.TRANSLATE], fn);
      graph.view.setScale(3);
      off();
      graph.view.setTranslate(1, 1);
      graph.view.setScale(1);
      expect(fn).toHaveBeenCalledTimes(1);
    } finally {
      graph.destroy();
    }
  });

  it('src has no `as unknown as EventSource` casts left', () => {
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
          if (name !== '__tests__') walk(path);
        } else if (name.endsWith('.ts')) {
          const code = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
          if (/as unknown as EventSource/.test(code)) offenders.push(relative(SRC, path));
        }
      }
    };
    walk(SRC);
    expect(offenders).toEqual([]);
  });
});
