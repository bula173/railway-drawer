/**
 * @file template-actions.ts
 * @brief What a template tile does: insert into the current diagram, open as a new diagram tab,
 *        and the "Save as template…" flow.
 */
import type { Cell, Graph } from '@maxgraph/core';
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
 * one undoable edit, with their draw.io styles verbatim; selects and returns them.
 */
export function insertTemplate(graph: Graph, template: DiagramTemplate, at?: { x: number; y: number }): Cell[] {
  const entry = templateToPaletteEntry(template);
  const inserted = insertEntry(graph, entry, at);
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
  createTab(name: string): { id: string; saveLoadController: { load(xml: string): void; setProjectName?(name: string): void } };
  switchTab(tabId: string): void;
  closeTab(tabId: string): void;
}

/** Opens the template in a new tab named after it; returns the tab id. Throws if it cannot load. */
export function openTemplateAsNewDiagram(host: TemplateTabHost, template: DiagramTemplate): string {
  const tab = host.createTab(template.name);
  try {
    tab.saveLoadController.load(wrapModelXml(template.xml));
  } catch (err) {
    host.closeTab(tab.id);
    throw err;
  }
  // The tab's project is named after the template too: top-bar title, Save/Export file names
  tab.saveLoadController.setProjectName?.(template.name);
  host.switchTab(tab.id);
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
