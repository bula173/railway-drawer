/**
 * @file graph-events.ts
 * @brief Typed maxGraph listener helpers that return their disposer.
 *
 * maxGraph's GraphDataModel, GraphSelectionModel and GraphView are EventSources
 * (`addListener(name, fn)` / `removeListener(fn)`); these helpers replace the
 * `as unknown as EventSource` casts and the hand-kept "bound" records, and give every listener
 * a disposer, so per-tab teardown (TabManager.destroyTab, controller destroy()) can release
 * exactly what was added.
 *
 * Note: maxGraph's removeListener(fn) removes `fn` from every event name of that source; the
 * disposers therefore remove the handler they were given from all the names it was added for.
 */
import { InternalEvent, type EventObject, type EventSource, type Graph } from '@maxgraph/core';

/** A maxGraph event handler. */
export type GraphEventHandler = (sender: EventSource, evt: EventObject) => void;

/** Listens to `names` on `source`; returns the disposer. */
export function onGraphEvent(source: EventSource, names: string | readonly string[], handler: GraphEventHandler): () => void {
  for (const name of typeof names === 'string' ? [names] : names) source.addListener(name, handler);
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    source.removeListener(handler);
  };
}

/** Model CHANGE (after every model transaction, also undo/redo). */
export function onModelChange(graph: Graph, handler: GraphEventHandler): () => void {
  return onGraphEvent(graph.getDataModel(), InternalEvent.CHANGE, handler);
}

/** Another model event (UNDO, BEFORE_UNDO, ...). */
export function onModelEvent(graph: Graph, name: string, handler: GraphEventHandler): () => void {
  return onGraphEvent(graph.getDataModel(), name, handler);
}

/** Selection model CHANGE. */
export function onSelectionChange(graph: Graph, handler: GraphEventHandler): () => void {
  return onGraphEvent(graph.getSelectionModel(), InternalEvent.CHANGE, handler);
}

/** View scale / translate changes (zoom, scroll). */
export function onViewTransform(graph: Graph, handler: GraphEventHandler): () => void {
  return onGraphEvent(graph.view, [InternalEvent.SCALE, InternalEvent.TRANSLATE, InternalEvent.SCALE_AND_TRANSLATE], handler);
}

/** The changes of a model CHANGE / UNDO / BEFORE_UNDO event (`edit.changes`, else the `changes` property). */
export function eventChanges(evt: EventObject): unknown[] {
  const edit = evt.getProperty('edit') as { changes?: unknown[] } | undefined;
  const changes = edit?.changes ?? (evt.getProperty('changes') as unknown[] | undefined);
  return Array.isArray(changes) ? changes : [];
}

/** Collects disposers and runs them once (reverse order). */
export class Disposers {
  private readonly items: Array<() => void> = [];

  add(dispose: () => void): void {
    this.items.push(dispose);
  }

  dispose(): void {
    for (const fn of this.items.splice(0).reverse()) {
      try {
        fn();
      } catch (e) {
        console.warn('[dispose] failed:', e);
      }
    }
  }
}
