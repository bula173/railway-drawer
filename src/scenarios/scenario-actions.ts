/**
 * @file scenario-actions.ts
 * @brief Drawing <-> step snapshot: capture the live drawing as a step, and the one deliberate
 *        (confirmed, undoable) way back, "Replace drawing with this step".
 */
import { GraphDataModel } from '@maxgraph/core';
import type { Graph } from '@maxgraph/core';
import { importModelXml, sanitizeXmlText } from '../services/drawio-xml';

/** The tab's whole drawing as a draw.io `<mxGraphModel>` (as saved: layers, page settings, PlantUML metadata). */
export function captureDrawing(source: { serializeToXml(): string }): string {
  return source.serializeToXml();
}

/**
 * Replaces the live drawing with a step snapshot as ONE undoable edit (a model root change, which
 * the tab's UndoManager records like any other edit), so Ctrl+Z brings the previous drawing back.
 * The snapshot is decoded into a scratch model first: on error nothing is changed.
 */
export function replaceDrawingWithSnapshot(graph: Graph, xml: string): void {
  const scratch = new GraphDataModel();
  const emptyRoot = scratch.getRoot();
  importModelXml(sanitizeXmlText(xml), scratch);
  const root = scratch.getRoot();
  if (!root || root === emptyRoot) throw new Error('The step contains no cells');
  graph.clearSelection();
  graph.getDataModel().setRoot(root);
  graph.refresh();
}
