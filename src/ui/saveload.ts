import { Graph, GraphDataModel, Rectangle } from '@maxgraph/core';
import type { Cell } from '@maxgraph/core';
import {
  emptyDrawioModelXml,
  exportModelToDrawioXml,
  importModelXml,
  sanitizeXmlText,
  type PageSettings,
} from '../services/drawio-xml';
import { ProjectService } from '../services/project-service';
import { PlantUmlGroupManager } from '../services/plantuml-group-manager';
import { GraphCommandService } from '../services/graph-command-service';
import type { ScenarioSet } from '../scenarios/scenario-model';
import { globalNotificationManager } from './notification';
import { globalSaveStatusIndicator } from './save-status';

/** One cell of exportAsJson(), read from the draw.io XML the tab saves. */
export interface JsonExportCell {
  id: string;
  parent: string | null;
  /** Label (`value`, or the `label` attribute of an `<object>`/`<UserObject>`). */
  value: string;
  /** draw.io style string, exactly as saved. */
  style: string | null;
  vertex: boolean;
  edge: boolean;
  source: string | null;
  target: string | null;
  geometry: { x: number; y: number; width: number; height: number; relative: boolean; points?: Array<{ x: number; y: number }> } | null;
  /** Data attributes of an `<object>`/`<UserObject>` value (railway data `rdKind`, `rdId`, ...). */
  data?: Record<string, string>;
}

/** The JSON document of exportAsJson(). */
export interface JsonExport {
  format: 'railway-drawer-cells';
  version: 1;
  name: string;
  cells: JsonExportCell[];
}

const OBJECT_ATTRIBUTES_SKIPPED = new Set(['id', 'label', 'placeholders']);

function numberAttr(el: Element, name: string): number {
  const n = parseFloat(el.getAttribute(name) ?? '');
  return Number.isFinite(n) ? n : 0;
}

/** Cells of a draw.io `<mxGraphModel>` as plain objects (document order = z-order). */
export function modelXmlToJsonCells(modelXml: string): JsonExportCell[] {
  const doc = new DOMParser().parseFromString(modelXml, 'application/xml');
  const root = doc.getElementsByTagName('root')[0];
  if (!root) return [];
  const cells: JsonExportCell[] = [];
  for (const node of Array.from(root.children)) {
    const wrapper = node.nodeName === 'mxCell' ? null : node;
    const cell = wrapper ? wrapper.getElementsByTagName('mxCell')[0] : node;
    if (!cell) continue;
    const geo = Array.from(cell.children).find((c) => c.nodeName === 'mxGeometry') ?? null;
    const points = geo
      ? Array.from(geo.getElementsByTagName('mxPoint'))
          .filter((p) => !p.getAttribute('as') && p.parentElement?.getAttribute('as') === 'points')
          .map((p) => ({ x: numberAttr(p, 'x'), y: numberAttr(p, 'y') }))
      : [];
    const data: Record<string, string> = {};
    if (wrapper) {
      for (const attr of Array.from(wrapper.attributes)) {
        if (!OBJECT_ATTRIBUTES_SKIPPED.has(attr.name)) data[attr.name] = attr.value;
      }
    }
    cells.push({
      id: (wrapper ?? cell).getAttribute('id') ?? '',
      parent: cell.getAttribute('parent'),
      value: (wrapper ? wrapper.getAttribute('label') : cell.getAttribute('value')) ?? '',
      style: cell.getAttribute('style'),
      vertex: cell.getAttribute('vertex') === '1',
      edge: cell.getAttribute('edge') === '1',
      source: cell.getAttribute('source'),
      target: cell.getAttribute('target'),
      geometry: geo
        ? {
            x: numberAttr(geo, 'x'),
            y: numberAttr(geo, 'y'),
            width: numberAttr(geo, 'width'),
            height: numberAttr(geo, 'height'),
            relative: geo.getAttribute('relative') === '1',
            ...(points.length > 0 ? { points } : {}),
          }
        : null,
      ...(wrapper ? { data } : {}),
    });
  }
  return cells;
}

/** One entry of the PlantUML metadata comment embedded by embedPlantUmlMetadata(). */
interface PlantUmlMetadataEntry {
  cellId: string;
  cellLabel: unknown;
  plantumlSource: string;
  diagramType: string;
  createdAt: number;
  lastModified: number;
}

/** Current marker: base64 of the UTF-8 encoded JSON. */
const PLANTUML_METADATA_UTF8_MARKER = 'PLANTUML_METADATA_UTF8';
/** Legacy marker: plain btoa() of the JSON (Latin-1 only). Still read for older files and caches. */
const PLANTUML_METADATA_LEGACY_MARKER = 'PLANTUML_METADATA';

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToUtf8(base64: string): string {
  const binary = atob(base64);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

function readFileText(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Failed to read file'));
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export class SaveLoadController {
  private graph: Graph;
  private projectService: ProjectService;
  private plantumlGroupManager: PlantUmlGroupManager;
  private commandService: GraphCommandService | null;
  /** Page settings of the loaded draw.io model, written back on save. */
  private pageSettings: PageSettings = {};
  /** Set while the tab is bound to a remote file: saveProject() saves there instead. */
  private saveHandler: (() => void) | null = null;
  /** Told after a file from disk was opened into this tab (the remote session unbinds the tab). */
  private localFileOpenedListeners = new Set<() => void>();

  constructor(graph: Graph, commandService: GraphCommandService | null = null) {
    this.graph = graph;
    this.commandService = commandService;
    this.projectService = new ProjectService();
    this.plantumlGroupManager = new PlantUmlGroupManager(graph);
    // Ctrl/Cmd+S is dispatched once, to the active tab, by the global shortcut handler in main-editor.ts.
    // A per-controller `document` listener here downloaded one file per open tab.
    // The .save-status element is owned by globalSaveStatusIndicator; writing it directly
    // from here overwrote autosave error messages.
  }

  /**
   * Ctrl/Cmd+S and File > Save. A tab bound to a remote file (SharePoint, ...) saves back there
   * through the handler set by the remote session; otherwise the file is downloaded.
   */
  saveProject(): void {
    if (this.saveHandler) {
      this.saveHandler();
      return;
    }
    this.saveProjectToDisk();
  }

  /** Replaces what saveProject() does (null: download again). Used for remote-file tabs. */
  setSaveHandler(handler: (() => void) | null): void {
    this.saveHandler = handler;
  }

  /** The whole tab as a native draw.io file (`<mxfile>`: shown page plus the preserved pages). */
  getProjectXml(): string {
    return this.projectService.generateProjectXml(this.serializeToXml());
  }

  /** Downloads the tab as a file, whatever saveProject() is bound to. */
  saveProjectToDisk(): void {
    try {
      console.log('[SaveLoad] Starting save...');
      const graphXml = this.serializeToXml();
      console.log('[SaveLoad] Graph serialized, length:', graphXml.length);
      const projectXml = this.projectService.generateProjectXml(graphXml);
      console.log('[SaveLoad] Project XML generated, length:', projectXml.length);
      const filename = `${this.projectService.getProjectName() || 'diagram'}.railwaydrawer`;
      console.log('[SaveLoad] Filename:', filename);
      this.projectService.exportToFile(projectXml, filename);
      this.markAsSavedToDisk();
      console.log('[SaveLoad] Project saved as', filename);
    } catch (error) {
      console.error('[SaveLoad] Save failed:', error);
    }
  }

  /**
   * Opens a project file into this graph. On any failure the current diagram is kept,
   * the user sees an error notification, and the returned promise rejects.
   */
  async loadProjectFromFile(file: File): Promise<void> {
    let xml: string;
    try {
      xml = await readFileText(file);
    } catch (error) {
      globalNotificationManager.error(`Could not open ${file.name}: the file could not be read`);
      throw error;
    }
    await this.loadProjectXml(xml, file.name);
    this.localFileOpenedListeners.forEach((listener) => listener());
  }

  /** Calls `listener` after each successful loadProjectFromFile (File > Open); returns the unsubscribe function. */
  onLocalFileOpened(listener: () => void): () => void {
    this.localFileOpenedListeners.add(listener);
    return () => {
      this.localFileOpenedListeners.delete(listener);
    };
  }

  /**
   * Opens a project file's text (draw.io `<mxfile>`, legacy `<project>`, bare model) into this
   * graph, like loadProjectFromFile. `quiet` skips the success notification (the caller reports).
   */
  async loadProjectXml(xml: string, sourceName: string, opts: { quiet?: boolean } = {}): Promise<void> {
    const file = { name: sourceName };
    try {
      console.log('[SaveLoad] Starting file import:', file.name);
      const result = await this.projectService.parseProjectXml(xml);
      console.log('[SaveLoad] File imported, metadata:', result.metadata);
      console.log('[SaveLoad] Deserializing graph...');

      // Use the same load method that works for cache
      this.load(result.graphXml);

      console.log('[SaveLoad] Graph deserialized');
      this.projectService.setProjectMetadata(result.metadata);
      // Pages 2..n are not shown, but are kept so a save writes them back unchanged
      this.projectService.setExtraPages(result.extraPages);
      this.projectService.setPageId(result.pageId);
      // The file's scenarios replace the tab's (none in the file: the tab has none afterwards)
      this.projectService.scenarios.replaceAll(result.scenarios);
      this.updateProjectNameUI(result.metadata.name);
      this.markAsSavedToDisk();
      if (result.extraPageNames.length > 0) {
        const names = result.extraPageNames.map((name) => `"${name}"`).join(', ');
        globalNotificationManager.warning(
          `Opened ${file.name}: only the first page is shown. Not loaded: ${names}. ` +
            'They are kept unchanged when you save.'
        );
      } else if (!opts.quiet) {
        globalNotificationManager.success(`Opened ${file.name}`);
      }
      console.log('[SaveLoad] Project loaded:', result.metadata.name);
    } catch (error) {
      console.error('[SaveLoad] Failed to load project:', error);
      const reason = error instanceof Error ? error.message : String(error);
      globalNotificationManager.error(`Could not open ${file.name}: ${reason}`);
      throw error;
    }
  }

  /**
   * File > Export: downloads the diagram as a native draw.io file (`<mxfile>`), which
   * draw.io (web and desktop) opens directly.
   */
  save(): string {
    const xml = this.projectService.generateProjectXml(this.serializeToXml());
    const name = this.projectService.getProjectName() || 'diagram';
    this.projectService.exportToFile(xml, `${name}.drawio`);
    console.log('[SaveLoad] Diagram exported');
    return xml;
  }

  /**
   * Replaces the diagram with the model in `xml`.
   * The XML is fully decoded into a scratch model first; the current diagram is only replaced
   * once that succeeded, otherwise this throws and the diagram is left untouched.
   * The load is not undoable: the undo history is cleared afterwards.
   */
  load(xml: string): void {
    if (!xml || xml.trim().length === 0) {
      console.warn('[SaveLoad] Empty XML, skipping load');
      return;
    }

    console.log('[SaveLoad] Loading XML, length:', xml.length);

    // Caches written before control characters were filtered on save are otherwise unreadable
    xml = sanitizeXmlText(xml);
    ProjectService.validateGraphModelXml(xml);

    // Native draw.io <mxGraphModel>, or the legacy <GraphDataModel> of earlier versions
    const scratchModel = new GraphDataModel();
    const emptyRoot = scratchModel.getRoot();
    const pageSettings = importModelXml(xml, scratchModel);
    const loadedRoot = scratchModel.getRoot();
    if (!loadedRoot || loadedRoot === emptyRoot) {
      throw new Error('The diagram data contains no cells');
    }

    this.graph.clearSelection();
    this.graph.getDataModel().setRoot(loadedRoot);
    this.applyPageSettings(pageSettings ?? {});

    // Restore PlantUML metadata
    this.restorePlantUmlMetadata(xml);

    this.graph.refresh();
    this.commandService?.clearHistory();
    console.log('[SaveLoad] Diagram loaded');
  }


  /**
   * Serializes the diagram as a draw.io `<mxGraphModel>` (plus the PlantUML metadata comment).
   * Used for file save, File > Export and the browser cache.
   */
  serializeToXml(): string {
    const page: PageSettings = { ...this.pageSettings, gridSize: this.graph.gridSize };
    try {
      console.log('[SaveLoad] Serializing graph...');
      // Image data URLs stay in the output: custom shapes and uploaded images have no other
      // source to be rebuilt from, so stripping them would lose content on reload.
      let xml = exportModelToDrawioXml(this.graph.getDataModel(), {
        stylesheet: this.graph.getStylesheet(),
        page,
        htmlLabels: this.graph.isHtmlLabels(),
      });

      // Embed PlantUML metadata
      xml = this.embedPlantUmlMetadata(xml);

      console.log('[SaveLoad] Serialized, length:', xml.length);
      return xml;
    } catch (e) {
      console.error('[SaveLoad] Serialization error:', e);
      return emptyDrawioModelXml(page);
    }
  }

  /** Keeps the page settings of a loaded draw.io model and applies the grid size. */
  private applyPageSettings(settings: PageSettings): void {
    this.pageSettings = { ...settings };
    if (settings.gridSize && settings.gridSize > 0) {
      this.graph.gridSize = settings.gridSize;
    }
    if (settings.pageWidth && settings.pageHeight) {
      this.graph.pageFormat = new Rectangle(0, 0, settings.pageWidth, settings.pageHeight);
    }
    if (settings.pageScale && settings.pageScale > 0) {
      this.graph.pageScale = settings.pageScale;
    }
  }

  /**
   * The tab's cells as JSON (root, layers, vertices, edges in z-order: id, parent, value, draw.io
   * style string, vertex/edge, source/target, geometry, `<object>` data). Read from the same draw.io
   * XML a save writes, so it matches the .drawio file. Not offered in the menu: File > Export As…
   * (.drawio) is the exchange format; this is for scripts and tests.
   */
  exportAsJson(): string {
    const data: JsonExport = {
      format: 'railway-drawer-cells',
      version: 1,
      name: this.projectService.getProjectName(),
      cells: modelXmlToJsonCells(this.serializeToXml()),
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Pages 2..n of the opened file and the shown page's id, which only this controller holds.
   * The tab cache stores them so a save after a browser reload still writes every page.
   */
  getPreservedPages(): { extraPages: string[]; pageId: string | null } {
    return { extraPages: this.projectService.getExtraPages(), pageId: this.projectService.getPageId() };
  }

  /** Scenarios of this tab (saved as step pages in the file and in the tab cache). */
  getScenarios(): ScenarioSet {
    return this.projectService.scenarios;
  }

  /** Restores what getPreservedPages() returned (from the tab cache). */
  setPreservedPages(extraPages: string[], pageId: string | null): void {
    this.projectService.setExtraPages(extraPages);
    this.projectService.setPageId(pageId);
  }

  setProjectName(name: string): void {
    this.projectService.setProjectName(name);
    this.updateProjectNameUI(name);
  }

  getProjectName(): string {
    return this.projectService.getProjectName();
  }

  private updateProjectNameUI(name: string): void {
    const titleElement = document.querySelector('.document-title') as HTMLElement;
    if (titleElement) {
      titleElement.textContent = name;
    }
  }

  markAsSavedToDisk(): void {
    globalSaveStatusIndicator.setSavedToDisk();
  }

  /**
   * Embed PlantUML metadata into XML before serialization.
   * The authoritative copy is the group cell's `rdPlantUml` style key (written by
   * exportModelToDrawioXml), which survives a re-save in draw.io; this comment is kept for
   * earlier versions of the app, which read only the comment.
   */
  private embedPlantUmlMetadata(xml: string): string {
    try {
      const plantumlGroups = this.plantumlGroupManager.getAllPlantUmlGroups();
      if (plantumlGroups.length === 0) return xml;

      console.log('[SaveLoad] Embedding PlantUML metadata for', plantumlGroups.length, 'groups');

      // Create a root element to hold PlantUML data
      const plantumlData = plantumlGroups.map((group) => {
        const metadata = this.plantumlGroupManager.getPlantUmlMetadata(group);
        return {
          cellId: group.getId(),
          cellLabel: group.getValue(),
          plantumlSource: metadata?.plantumlSource || '',
          diagramType: metadata?.diagramType || '',
          createdAt: metadata?.createdAt || 0,
          lastModified: metadata?.lastModified || 0,
        };
      });

      // Store PlantUML metadata as JSON in a comment at the end
      // UTF-8 base64: plain btoa() throws on characters outside Latin-1 (e.g. Polish 'ą', 'ł')
      const comment = `\n<!-- ${PLANTUML_METADATA_UTF8_MARKER}:${utf8ToBase64(JSON.stringify(plantumlData))} -->`;
      return xml + comment;
    } catch (e) {
      console.warn('[SaveLoad] Failed to embed PlantUML metadata:', e);
      return xml; // Return original XML on failure
    }
  }

  /**
   * Extract and restore PlantUML metadata from XML after deserialization
   */
  private restorePlantUmlMetadata(xml: string): void {
    try {
      const utf8Match = xml.match(new RegExp(`<!-- ${PLANTUML_METADATA_UTF8_MARKER}:(.+?) -->`));
      const legacyMatch = utf8Match ? null : xml.match(new RegExp(`<!-- ${PLANTUML_METADATA_LEGACY_MARKER}:(.+?) -->`));
      let json: string;
      if (utf8Match?.[1]) {
        json = base64ToUtf8(utf8Match[1]);
      } else if (legacyMatch?.[1]) {
        json = atob(legacyMatch[1]);
      } else {
        console.log('[SaveLoad] No PlantUML metadata found in XML');
        return;
      }

      const plantumlData: PlantUmlMetadataEntry[] = JSON.parse(json);
      console.log('[SaveLoad] Restoring PlantUML metadata for', plantumlData.length, 'groups');

      const model = this.graph.model;
      const cells: Record<string, Cell> = model.cells || {};

      plantumlData.forEach((data: PlantUmlMetadataEntry) => {
        const cell = cells[data.cellId];
        // The cell's own rdPlantUml style key (read by importModelXml) takes precedence
        if (cell && !this.plantumlGroupManager.hasPlantUmlMetadata(cell)) {
          this.plantumlGroupManager.setPlantUmlMetadata(cell, {
            plantumlSource: data.plantumlSource,
            diagramType: data.diagramType,
            createdAt: data.createdAt,
            lastModified: data.lastModified,
          });
          console.log('[SaveLoad] Restored PlantUML metadata for:', data.cellLabel);
        }
      });
    } catch (e) {
      console.warn('[SaveLoad] Failed to restore PlantUML metadata:', e);
    }
  }
}
