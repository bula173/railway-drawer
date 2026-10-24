/**
 * @file app-target.ts
 * @brief AiTarget of the running app: the ACTIVE diagram tab of the TabManager (resolved on every
 *        call, so a template opened as a new tab becomes the target of the next tool), the shape
 *        catalogue (draw.io palettes, ERTMS library, user libraries), templates (ERTMS + the
 *        user's), image rendering and downloads. Part of the lazy AI chunk.
 */
import { PALETTES, loadPalette } from '../drawio-shapes/palettes';
import { downloadBlob } from '../railway/install-railway-data';
import { installedScenarios } from '../scenarios/install-scenarios';
import { renderXmlToPngBlob, renderXmlToSvgDocument } from '../ui/diagram-image-export';
import { ertmsElementsPaletteDef, loadErtmsLibraryEntries, loadErtmsTemplates } from '../ui/drawio-palette/ertms-source';
import { getDrawioPaletteEngine } from '../ui/drawio-palette/drawio-palette-view';
import { libraryToPaletteDef, readStoredLibraries } from '../ui/drawio-palette/library-adapter';
import { TemplateStore } from '../ui/templates/template-store';
import { openTemplateAsNewDiagram } from '../ui/templates/template-actions';
import type { DiagramTemplate } from '../ui/templates/template-types';
import type { TabData, TabManager } from '../ui/tabs';
import type { AiTarget, CatalogShape, ShapeCatalog } from './target';
import { Graph } from '@maxgraph/core';
import { setupGraph } from '../ui/setup-graph';

let catalogPromise: Promise<CatalogShape[]> | null = null;

/** Every shape of the app's palettes (loaded once per page). */
export const appShapeCatalog: ShapeCatalog = {
  all() {
    catalogPromise ??= (async () => {
      const out: CatalogShape[] = [];
      const add = (paletteTitle: string, entries: CatalogShape['entry'][]): void => {
        for (const entry of entries) out.push({ name: entry.id, title: entry.title, palette: paletteTitle, entry });
      };
      try {
        add('ERTMS', ertmsElementsPaletteDef(await loadErtmsLibraryEntries()).entries);
      } catch (error) {
        console.warn('[AI] ERTMS library not available', error);
      }
      for (const meta of PALETTES) {
        try {
          add(meta.title, (await loadPalette(meta.id)).entries);
        } catch (error) {
          console.warn('[AI] palette not available', meta.id, error);
        }
      }
      for (const lib of readStoredLibraries()) {
        try {
          add(lib.title || 'Library', libraryToPaletteDef(getDrawioPaletteEngine().parseMxLibrary(lib.text), { id: lib.id, title: lib.title || 'Library' }).entries);
        } catch {
          // a broken user library is skipped
        }
      }
      return out;
    })();
    catalogPromise.catch(() => {
      catalogPromise = null;
    });
    return catalogPromise;
  },
};

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Largest PNG side sent to the model (the API downsizes larger images anyway). */
const MAX_PNG_SCALE = 1;

export function tabTarget(tab: TabData, tabManager: TabManager): AiTarget {
  const doc = tab.document;
  return {
    graph: tab.graph,
    tabName: () => doc.getProjectName() || tab.name,
    scriptStore: doc.railwayScript,
    scriptSession: async () => (await import('../railway-script/script-ui')).ensureSession(tab),
    undo: () => tab.graphCommandService.undo(),
    canUndo: () => tab.graphCommandService.canUndo(),
    nextUndoEdit: () => tab.graphCommandService.nextUndoEdit(),
    modelXml: () => doc.serializeToXml(),
    projectXml: () => doc.getProjectXml(),
    catalog: appShapeCatalog,
    templates: async (): Promise<DiagramTemplate[]> => {
      let builtIn: DiagramTemplate[] = [];
      try {
        builtIn = await loadErtmsTemplates();
      } catch (error) {
        console.warn('[AI] ERTMS templates not available', error);
      }
      return [...new TemplateStore().list(), ...builtIn];
    },
    openTemplateInNewTab: (template) => {
      openTemplateAsNewDiagram(tabManager, template);
      return template.name;
    },
    renderPng: async (xml) => blobToBase64(await renderXmlToPngBlob(xml, { scale: MAX_PNG_SCALE, border: 10 })),
    renderSvg: (xml) => renderXmlToSvgDocument(xml, { border: 10 }),
    download: (name, content, mime) => downloadBlob(typeof content === 'string' ? new Blob([content], { type: mime }) : content, name),
    scenarios: () => doc.scenarios,
    scratchGraph: (model) => {
      const graph = new Graph(document.createElement('div'), model);
      setupGraph(graph, 'view');
      return graph;
    },
    // steps hold whole drawings: write the tab cache at once (like the Scenarios panel)
    scenariosChanged: () => {
      tabManager.flushCache();
    },
    showScenario: (scenarioId, index) => {
      const handle = installedScenarios();
      if (!handle) throw new Error('the scenario view is not available');
      if (!handle.viewer.open(tab.id, scenarioId, index)) throw new Error('the scenario could not be shown');
    },
    setTitleBlock: async (input) => (await import('../print/ui/ai-sheets')).aiSetTitleBlock(tab, input),
    exportSheets: async (pages) => (await import('../print/ui/ai-sheets')).aiExportSheets(tab, pages),
    exportScenario: async (scenarioId, format, options) => {
      const handle = installedScenarios();
      if (!handle) throw new Error('scenario export is not available');
      return handle.exportScenarioFile(tab.id, scenarioId, format, options);
    },
  };
}

/** Target = the active tab at the time of each call. */
export function activeTabTarget(tabManager: TabManager): AiTarget | null {
  const tab = tabManager.getActiveTab();
  return tab ? tabTarget(tab, tabManager) : null;
}
