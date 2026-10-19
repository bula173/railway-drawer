/**
 * Test helpers for the Railway Script: a test graph with undo history, snap to track and a script
 * session using the real ERTMS library entries.
 */
import type { Cell, Graph } from '@maxgraph/core';
import { createTestGraph } from '../../__tests__/setup';
import { GraphCommandService } from '../../services/graph-command-service';
import { readAttr } from '../../railway/object-data';
import { installSnapToTrack } from '../../railway/snap';
import { collectObjects } from '../../railway/validation';
import type { RailObject } from '../../railway/validation';
import { ertmsEntries } from '../../railml/__tests__/helpers';
import { RailwayScriptStore } from '../script-store';
import { ScriptSession, setSymbolsLoader } from '../session';

export interface Fixture {
  graph: Graph;
  commands: GraphCommandService;
  store: RailwayScriptStore;
  session: ScriptSession;
  destroy(): void;
}

export function fixture(text = ''): Fixture {
  setSymbolsLoader(async () => ertmsEntries());
  const graph = createTestGraph();
  const commands = new GraphCommandService(graph);
  const unsnap = installSnapToTrack(graph, () => true);
  const store = new RailwayScriptStore();
  store.set(text, 'load');
  const session = new ScriptSession(graph, store, { syncDelay: 0 });
  return {
    graph,
    commands,
    store,
    session,
    destroy() {
      session.destroy();
      unsnap();
      commands.destroy();
      graph.destroy();
    },
  };
}

export function objects(graph: Graph): Map<string, RailObject> {
  return new Map(collectObjects(graph.getDataModel()).map((o) => [`${o.kind.id}:${o.id}`, o]));
}

export function cellOf(graph: Graph, key: string): Cell {
  const o = objects(graph).get(key);
  if (!o) throw new Error(`no ${key}`);
  return o.cell;
}

export function attr(graph: Graph, key: string, name: string): string {
  return readAttr(cellOf(graph, key), name);
}
