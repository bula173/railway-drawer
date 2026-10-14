/**
 * Regression: undo/redo used to record undo and redo replays as new edits
 * (it listened to the model CHANGE event), so history went wrong after the first undo.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Graph } from '@maxgraph/core';
import { GraphCommandService } from '../../services/graph-command-service';
import { createTestGraph, cleanupTestGraph } from '../setup';

describe('GraphCommandService undo/redo', () => {
  let graph: Graph;
  let service: GraphCommandService;

  const vertexCount = () => graph.getChildVertices(graph.getDefaultParent()).length;
  const insert = (label: string) =>
    graph.batchUpdate(() => {
      graph.insertVertex(graph.getDefaultParent(), null, label, 10, 10, 80, 40);
    });

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    graph = createTestGraph();
    service = new GraphCommandService(graph);
  });

  afterEach(() => {
    service.destroy();
    cleanupTestGraph(graph);
    vi.restoreAllMocks();
  });

  it('undo then redo restores the edit', () => {
    insert('A');
    expect(vertexCount()).toBe(1);

    service.undo();
    expect(vertexCount()).toBe(0);
    expect(service.canRedo()).toBe(true);

    service.redo();
    expect(vertexCount()).toBe(1);
    expect(service.canRedo()).toBe(false);
    expect(service.canUndo()).toBe(true);
  });

  it('two undos step back two edits and do not re-apply anything', () => {
    insert('A');
    insert('B');
    expect(vertexCount()).toBe(2);

    service.undo();
    expect(vertexCount()).toBe(1);
    service.undo();
    expect(vertexCount()).toBe(0);
    expect(service.canUndo()).toBe(false);

    // A further undo is a no-op, not a replay of the previous undo
    service.undo();
    expect(vertexCount()).toBe(0);

    service.redo();
    service.redo();
    expect(vertexCount()).toBe(2);
    expect(service.canRedo()).toBe(false);
  });

  it('clearHistory makes a load-style change non-undoable', () => {
    insert('A');
    service.clearHistory();
    expect(service.canUndo()).toBe(false);
    service.undo();
    expect(vertexCount()).toBe(1);
  });

  it('destroy detaches the undo handler from the graph', () => {
    service.destroy();
    insert('A');
    expect(service.canUndo()).toBe(false);
  });
});
