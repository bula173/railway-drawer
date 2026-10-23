/**
 * @file drawio-stencil-autoload.ts
 * @brief Loads the draw.io stencil sets a graph's cells need, whenever cells or styles change.
 *
 * Covers every way content reaches a tab graph (file open, cache restore, paste, palette insert,
 * undo, style edits): the model's CHANGE event lists the changed cells, their `shape=` names go
 * to the stencil engine's ensureStencilsForXml, and the graph is refreshed once a set was loaded
 * (named stencils such as mxgraph.basic.flash render as rectangles until then).
 */
import { InternalEvent } from '@maxgraph/core';
import type { Cell, EventObject, EventSource, Graph } from '@maxgraph/core';
import { ensureStencilsForXml } from '../drawio-shapes/engine';
import { logger } from '../drawio/logger';

function styleText(cell: Cell): string | null {
  const style = cell.getStyle() as unknown;
  if (typeof style === 'string') return style;
  if (style && typeof style === 'object') {
    const shape = (style as Record<string, unknown>).shape;
    if (typeof shape === 'string' && shape) return `shape=${shape};`;
  }
  return null;
}

function collectStyles(cell: Cell | null | undefined, out: string[], depth = 0): void {
  if (!cell || depth > 200) return;
  const text = styleText(cell);
  if (text && text.includes('shape=')) out.push(text);
  for (const child of cell.children ?? []) collectStyles(child, out, depth + 1);
}

/** Style strings (with a `shape=`) of the cells touched by a model edit. */
export function stylesOfChanges(changes: readonly unknown[]): string[] {
  const out: string[] = [];
  for (const change of changes) {
    const c = change as { root?: Cell; child?: Cell; cell?: Cell; style?: unknown };
    if (c.root) collectStyles(c.root, out);
    else if (c.child) collectStyles(c.child, out);
    else if (c.cell && 'style' in c) collectStyles(c.cell, out);
  }
  return out;
}

async function ensureAndRefresh(graph: Graph, styles: string[]): Promise<void> {
  if (styles.length === 0) return;
  try {
    const loaded = await ensureStencilsForXml(styles);
    if (loaded.length > 0 && graph.container) graph.refresh();
  } catch (error) {
    logger.warn('stencil-autoload', 'Could not load stencils', error);
  }
}

/** Watches the graph's model and loads missing stencil sets. Returns an uninstall function. */
export function installStencilAutoload(graph: Graph): () => void {
  const model = graph.getDataModel() as unknown as EventSource;
  const listener = (_sender: EventSource, evt: EventObject): void => {
    const edit = evt.getProperty('edit') as { changes?: unknown[] } | undefined;
    const styles = stylesOfChanges(edit?.changes ?? []);
    if (styles.length > 0) void ensureAndRefresh(graph, styles);
  };
  model.addListener(InternalEvent.CHANGE, listener);
  return () => model.removeListener(listener);
}
