/**
 * @file template-actions.ts
 * @brief What a template tile does: insert into the current diagram, open as a new diagram tab,
 *        and the "Save as template…" flow.
 */
import { zoomRailwayDrawing } from '../railway-zoom';
import type { Cell, Graph } from '@maxgraph/core';
import type { KindId } from '../../railway/catalogue';
import { prepareClonedCells } from '../../railway/clone';
import { withSnapSuspended } from '../../railway/snap';
import { getDrawioPaletteEngine } from '../drawio-palette/drawio-palette-view';
import { insertEntry, wrapModelXml } from '../drawio-palette/entry-cells';
import { promptTemplateDetails } from './template-dialogs';
import type { TemplateDetails, TemplateDetailsOptions } from './template-dialogs';
import { extractTemplate } from './template-extract';
import type { TemplateStore } from './template-store';
import { templateToPaletteEntry } from './template-types';
import type { DiagramTemplate } from './template-types';

export interface TemplateNotifier {
  success(message: string, options?: { action?: { label: string; callback: () => void } }): unknown;
  error(message: string): unknown;
  info(message: string): unknown;
}

/**
 * Inserts the template's cells centred on `at` (graph coordinates; default the view centre) as
 * one undoable edit, with their draw.io styles verbatim; selects and returns them. Railway IDs
 * that are taken in the diagram are renumbered (references follow), and snap to track does not
 * move the template's symbols (they are drawn exactly). `onRenamed` receives the renamed IDs per kind
 * (old upper-case ID -> new ID).
 */
export function insertTemplate(
  graph: Graph,
  template: DiagramTemplate,
  at?: { x: number; y: number },
  onRenamed?: (renamed: Map<KindId, Map<string, string>>) => void
): Cell[] {
  const entry = templateToPaletteEntry(template);
  const inserted = withSnapSuspended(() =>
    insertEntry(graph, entry, at, (cells) => {
      const renamed = prepareClonedCells(graph.getDataModel(), cells);
      onRenamed?.(renamed);
    }));
  if (inserted.length > 0) {
    // Named stencils not loaded yet (the autoload also does this for tab graphs)
    getDrawioPaletteEngine()
      .ensureStencilsForXml(template.xml)
      .then(() => graph.refresh())
      .catch(() => undefined);
  }
  return inserted;
}

/** The part of TabManager that "Open as new diagram" needs. */
export interface TemplateTabHost {
  createTab(name: string): { id: string; document: { load(xml: string): void; setProjectName?(name: string): void } };
  switchTab(tabId: string): void;
  closeTab(tabId: string): void;
}

/** Opens the template in a new tab named after it; returns the tab id. Throws if it cannot load. */
export function openTemplateAsNewDiagram(host: TemplateTabHost, template: DiagramTemplate): string {
  const tab = host.createTab(template.name);
  try {
    tab.document.load(wrapModelXml(template.xml));
  } catch (err) {
    host.closeTab(tab.id);
    throw err;
  }
  // The tab's project is named after the template too: top-bar title, Save/Export file names
  tab.document.setProjectName?.(template.name);
  host.switchTab(tab.id);
  // railway symbols are small: open zoomed in (150-200 %, src/ui/railway-zoom.ts)
  const graph = (tab as { graph?: Graph }).graph;
  if (graph) zoomRailwayDrawing(graph);
  return tab.id;
}

export interface SaveAsTemplateOptions {
  graph: Graph;
  store: TemplateStore;
  notify: TemplateNotifier;
  /** Called by the notification's "Show" action (e.g. switch to the Templates tab). */
  onShow?: () => void;
  /** Dialog (replaceable in tests). */
  prompt?: (opts: TemplateDetailsOptions) => Promise<TemplateDetails | null>;
}

/**
 * "Save as template…": the selection (or, with nothing selected, the whole diagram) is captured,
 * then the user names it. Resolves with the saved template, or null (cancelled, empty, failed).
 */
export async function saveAsTemplate(opts: SaveAsTemplateOptions): Promise<DiagramTemplate | null> {
  const { graph, store, notify } = opts;
  const selected = graph.getSelectionCount();
  const extracted = extractTemplate(graph);
  if (!extracted) {
    notify.info('The diagram is empty: draw or select shapes to save them as a template.');
    return null;
  }
  const hint =
    selected > 0
      ? selected === 1
        ? '1 selected shape (with its contents)'
        : `${selected} selected shapes (with the connections between them)`
      : 'Nothing selected: the whole diagram is saved';
  const details = await (opts.prompt ?? promptTemplateDetails)({ heading: 'Save as template', hint, confirmLabel: 'Save' });
  if (!details) return null;
  try {
    const template = store.add({ ...details, xml: extracted.xml, width: extracted.width, height: extracted.height });
    notify.success(
      `Template "${template.name}" saved`,
      opts.onShow ? { action: { label: 'Show', callback: opts.onShow } } : undefined
    );
    return template;
  } catch (err) {
    notify.error(err instanceof Error ? err.message : String(err));
    return null;
  }
}
