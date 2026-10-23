/**
 * @file diagram-document.ts
 * @brief The document of one tab: everything a save writes and the browser cache keeps, without UI.
 *
 * A DiagramDocument owns, for one tab graph:
 * - the model reference (`graph`) with its load / serialisation (`load`, `serializeToXml`), the
 *   page settings and grid of the opened file, the PlantUML metadata and the legacy-layer migration
 *   of the last load;
 * - the project file around it (ProjectService): project name and metadata, pages 2..n of the
 *   opened file, the shown page's id, and the registered feature sections (scenarios, Railway
 *   Script: services/project-sections.ts, typed accessors added by the features);
 * - the remote binding slot (the save handler of a tab bound to a provider file, and the binding
 *   restored from the tab cache until the remote session claims it);
 * - the autosave dirty state (what changed since the tab's cache entry was last built).
 *
 * UI around it (notifications, save status, the top-bar title, file downloads) lives in
 * ui/saveload.ts (SaveLoadController = file I/O over a DiagramDocument) and ui/tabs.ts. The view
 * effects of a load (grid background, scroll reset) are injected as DocumentViewHooks, so this
 * module stays in the document layer.
 */
import { Graph, GraphDataModel, Rectangle, xmlUtils } from '@maxgraph/core';
import type { Cell } from '@maxgraph/core';
import { emit } from '../core/event-bus';
import { Disposers, onModelChange } from '../core/graph-events';
import {
  emptyDrawioModelXml,
  exportModelToDrawioXml,
  generatePageId,
  DEFAULT_PAGE_SETTINGS,
  importModelXml,
  sanitizeXmlText,
  type PageSettings,
} from '../services/drawio-xml';
import { ProjectService, type ParsedProject, type ProjectMetadata } from '../services/project-service';
import { projectSections } from '../services/project-sections';
import { migrateLegacyLayers, type LegacyLayerMigration } from '../services/legacy-layers';
import { PlantUmlGroupManager } from '../services/plantuml-group-manager';
import { logger } from '../drawio/logger';

declare module '../core/event-bus' {
  interface AppEventMap {
    /** The drawing pages of the document in `graph` changed: another page is shown, a page was added, renamed or removed. */
    'rd-pages-changed': { graph: Graph };
    /** The page settings (draw.io page format / scale) of the page shown in `graph` changed (a load, setPageSettings, its undo / redo). */
    'rd-page-settings': { graph: Graph };
  }
}

/** One drawing page of the file (`<diagram>`): the main page (index 0) or a kept page 2..n. */
export interface DrawingPage {
  index: number;
  /** The `<diagram id>` ('' when the main page has none yet). */
  id: string;
  name: string;
  shown: boolean;
}

/** `<diagram>` element of a serialized page (null when it does not parse). */
function parseDiagram(diagramXml: string): Element | null {
  const doc = new DOMParser().parseFromString(diagramXml, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return null;
  return doc.documentElement?.nodeName === 'diagram' ? doc.documentElement : null;
}

/** The page `diagramXml` with its content replaced by `modelXml` (uncompressed; attributes kept). */
function replacePageModel(diagramXml: string, modelXml: string): string {
  const diagram = parseDiagram(diagramXml);
  const model = new DOMParser().parseFromString(modelXml, 'text/xml');
  if (!diagram || model.getElementsByTagName('parsererror').length > 0) return diagramXml;
  while (diagram.firstChild) diagram.removeChild(diagram.firstChild);
  model.childNodes.forEach((node) => diagram.appendChild(diagram.ownerDocument.importNode(node, true)));
  // getXml: newlines in attribute values (multi-line labels) must stay escaped
  return xmlUtils.getXml(diagram);
}

/**
 * Undoable change of the shown page's page settings (model.execute; undo / redo swap the values),
 * like draw.io's ChangePageSetup.
 */
class PageSettingsChange {
  constructor(
    private readonly doc: DiagramDocument,
    private settings: PageSettings
  ) {}

  execute(): void {
    const previous = this.doc.getPageSettings();
    this.doc.replacePageSettings(this.settings);
    this.settings = previous;
  }
}

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

/** View effects of a load, supplied by the UI (TabManager): the document layer has no view code. */
export interface DocumentViewHooks {
  /** Applies a loaded page's grid (on/off, size) to the graph and its background. */
  applyGrid?(graph: Graph, settings: { grid?: boolean; gridSize?: number }): void;
  /** Shows a freshly loaded drawing from its origin (scroll position). */
  resetView?(graph: Graph): void;
}

export interface DiagramDocumentOptions {
  /** Undo history of the tab: cleared after a load (a load is not undoable). */
  commandService?: { clearHistory(): void } | null;
  view?: DocumentViewHooks;
}

/** The tab-level fields of a cache entry that the document does not own. */
export interface DocumentCacheContext {
  id: string;
  /** The tab's label. */
  name: string;
  now: number;
  /** The shown tab: re-serialised at least every RESERIALIZE_ACTIVE_MS. */
  active: boolean;
}

/** The shown tab's XML is rebuilt at least this often, even without model events. */
export const RESERIALIZE_ACTIVE_MS = 30_000;

/**
 * Autosave state. The model is serialised again only when it changed (model CHANGE events: edits,
 * undo/redo, loads) or the other inputs of serializeToXml changed (getSerializationFingerprint);
 * a section's cache value only after that section changed (sections with `subscribe`).
 */
interface CacheState {
  modelDirty: boolean;
  /** JSON string of the serialised graph XML, and what it was made from. */
  xmlJson: string | null;
  xmlFingerprint: string;
  xmlAt: number;
  /** JSON of each subscribable section's cache value (undefined: omitted), null: changed since. */
  sectionJson: Map<string, string | undefined | null>;
}

export class DiagramDocument {
  readonly graph: Graph;
  private readonly project = new ProjectService();
  private readonly plantumlGroupManager: PlantUmlGroupManager;
  private readonly commandService: { clearHistory(): void } | null;
  private readonly view: DocumentViewHooks;
  /** Page settings of the loaded draw.io model, written back on save. */
  private pageSettings: PageSettings = {};
  /** What the last load() changed in the file itself (old app layers turned into draw.io layers). */
  private loadMigration: LegacyLayerMigration | null = null;
  /** Set while the tab is bound to a remote file: File > Save / Ctrl+S save there instead. */
  private saveHandler: (() => void) | null = null;
  /** The remote binding read from the tab cache, until the remote session claims it (opaque). */
  private restoredRemote: unknown = undefined;
  /** Cache XML of a tab that failed to restore: written back unchanged until the first edit. */
  private unrestoredXml: string | null = null;
  private readonly nameListeners = new Set<(name: string) => void>();
  private readonly cache: CacheState = { modelDirty: true, xmlJson: null, xmlFingerprint: '', xmlAt: 0, sectionJson: new Map() };
  private readonly disposers = new Disposers();
  /** The drawing page shown in the graph: 0 = the main page, i = kept page `extraPages[i - 1]`. */
  private shownPage = 0;
  /** The main page's model XML while another page is shown. */
  private mainPageXml: string | null = null;
  /** The shown kept page was edited since it was shown (else it is written back unchanged). */
  private shownPageDirty = false;
  private pageListCache: DrawingPage[] | null = null;

  constructor(graph: Graph, opts: DiagramDocumentOptions = {}) {
    this.graph = graph;
    this.commandService = opts.commandService ?? null;
    this.view = opts.view ?? {};
    this.plantumlGroupManager = new PlantUmlGroupManager(graph);
    this.disposers.add(
      onModelChange(graph, () => {
        this.cache.modelDirty = true;
        this.shownPageDirty = true;
        this.unrestoredXml = null;
      })
    );
    for (const section of projectSections()) {
      if (!section.subscribe) continue;
      this.cache.sectionJson.set(section.key, null);
      this.disposers.add(section.subscribe(this.project.section(section.key), () => this.cache.sectionJson.set(section.key, null)));
    }
  }

  /** Releases the model / section listeners (the tab is closed). */
  dispose(): void {
    this.disposers.dispose();
    this.nameListeners.clear();
  }

  // ---- project ------------------------------------------------------------------------------

  /** The state of the registered project section `key` (features add typed accessors). */
  section<T>(key: string): T {
    return this.project.section<T>(key);
  }

  getProjectName(): string {
    return this.project.getProjectName();
  }

  /** The `<diagram>` attributes of the main page written by the sections (share links write them too). */
  getMainPageAttributes(): Record<string, string> {
    return this.project.mainPageAttributes();
  }

  /** Renames the project (Save/Export file names, `<diagram name>`); the listeners are told. */
  setProjectName(name: string): void {
    this.project.setProjectName(name);
    this.pageListCache = null;
    this.nameChanged(name);
  }

  /** Calls `listener` after each rename (also by an opened file); returns the unsubscribe function. */
  onProjectNameChange(listener: (name: string) => void): () => void {
    this.nameListeners.add(listener);
    return () => {
      this.nameListeners.delete(listener);
    };
  }

  private nameChanged(name: string): void {
    for (const listener of [...this.nameListeners]) listener(name);
  }

  getProjectMetadata(): ProjectMetadata {
    return this.project.getProjectMetadata();
  }

  /**
   * Pages 2..n of the opened file and the shown page's id, which only the document holds.
   * The tab cache stores them so a save after a browser reload still writes every page.
   */
  getPreservedPages(): { extraPages: string[]; pageId: string | null } {
    return { extraPages: this.canonicalExtraPages(), pageId: this.project.getPageId() };
  }

  /** Restores what getPreservedPages() returned (from the tab cache); the main page is shown. */
  setPreservedPages(extraPages: string[], pageId: string | null): void {
    this.resetPages();
    this.project.setExtraPages(extraPages);
    this.project.setPageId(pageId);
  }

  /** The main page's model XML (the graph's, unless another page is shown): page 1 of a save / share. */
  getMainPageModelXml(): string {
    return this.shownPage > 0 && this.mainPageXml !== null ? this.mainPageXml : this.serializeToXml();
  }

  /** The kept pages with the shown one (when edited) written in place. */
  private canonicalExtraPages(): string[] {
    const pages = this.project.getExtraPages();
    if (this.shownPage > 0 && this.shownPageDirty && pages[this.shownPage - 1] !== undefined) {
      pages[this.shownPage - 1] = replacePageModel(pages[this.shownPage - 1], this.serializeToXml());
    }
    return pages;
  }

  // ---- drawing pages --------------------------------------------------------------------------
  //
  // The graph shows one drawing page. The main page (index 0) carries the project name and the
  // feature sections (scenarios, Railway Script); pages 2..n are kept as serialized <diagram>
  // elements. Showing another page keeps the main page's model XML and writes an edited page back
  // into its slot, so a save writes every page in the file's order. Scenario step pages are not
  // drawing pages (they belong to the scenarios section).

  private resetPages(): void {
    this.shownPage = 0;
    this.mainPageXml = null;
    this.shownPageDirty = false;
    this.pageListCache = null;
  }

  /** The drawing pages in file order. */
  listPages(): DrawingPage[] {
    if (!this.pageListCache) {
      // page links (data:page/id,…) need the main page's id before the first save
      if (!this.project.getPageId()) this.project.setPageId(generatePageId());
      const pages: DrawingPage[] = [{ index: 0, id: this.project.getPageId() ?? '', name: this.project.getProjectName(), shown: false }];
      this.project.getExtraPages().forEach((xml, i) => {
        const diagram = parseDiagram(xml);
        pages.push({ index: i + 1, id: diagram?.getAttribute('id') ?? '', name: diagram?.getAttribute('name') || `Page ${i + 2}`, shown: false });
      });
      this.pageListCache = pages;
    }
    return this.pageListCache.map((page) => ({ ...page, shown: page.index === this.shownPage }));
  }

  /** Index of the shown drawing page (0: the main page). */
  shownPageIndex(): number {
    return this.shownPage;
  }

  /** The model XML of drawing page `index` (the graph's for the shown page), or null. */
  async getPageModelXml(index: number): Promise<string | null> {
    if (index === this.shownPage) return this.serializeToXml();
    if (index === 0) return this.mainPageXml;
    const xml = this.project.getExtraPages()[index - 1];
    const diagram = xml === undefined ? null : parseDiagram(xml);
    return diagram ? this.project.extractDiagramModelXml(diagram) : null;
  }

  /**
   * Shows drawing page `index` in the graph (not undoable, like a load: the undo history is
   * cleared). Throws, keeping the shown page, when the page cannot be read.
   */
  async showPage(index: number): Promise<void> {
    const pages = this.project.getExtraPages();
    if (index === this.shownPage || index < 0 || index > pages.length) return;
    const targetXml = await this.getPageModelXml(index);
    if (!targetXml) throw new Error(`Page ${index + 1} has no diagram`);
    const current = this.serializeToXml();
    const previous = { shown: this.shownPage, main: this.mainPageXml, dirty: this.shownPageDirty };
    if (this.shownPage === 0) this.mainPageXml = current;
    else if (this.shownPageDirty) pages[this.shownPage - 1] = replacePageModel(pages[this.shownPage - 1], current);
    try {
      this.load(targetXml);
    } catch (error) {
      this.mainPageXml = previous.main;
      throw error;
    }
    this.project.setExtraPages(pages);
    this.shownPage = index;
    if (index === 0) this.mainPageXml = null;
    this.shownPageDirty = false;
    this.pageListCache = null;
    emit('rd-pages-changed', { graph: this.graph });
  }

  /** Adds an empty drawing page (the shown page's page settings) after the last one; returns its index. */
  addPage(name: string): number {
    const pages = this.project.getExtraPages();
    const used = new Set(this.listPages().map((page) => page.id));
    let id: string;
    do id = generatePageId();
    while (used.has(id));
    const doc = new DOMParser().parseFromString('<diagram/>', 'text/xml');
    const diagram = doc.documentElement;
    diagram.setAttribute('id', id);
    diagram.setAttribute('name', name.trim() || `Page ${pages.length + 2}`);
    const empty = emptyDrawioModelXml({ ...this.pageSettings, grid: this.graph.gridEnabled, gridSize: this.graph.gridSize });
    diagram.appendChild(doc.importNode(new DOMParser().parseFromString(empty, 'text/xml').documentElement, true));
    pages.push(xmlUtils.getXml(diagram));
    this.project.setExtraPages(pages);
    this.pageListCache = null;
    this.cache.modelDirty = true;
    emit('rd-pages-changed', { graph: this.graph });
    return pages.length;
  }

  /** Renames drawing page `index` (the main page's name is the project name). */
  renamePage(index: number, name: string): void {
    const text = name.trim();
    if (!text) return;
    if (index === 0) {
      this.setProjectName(text);
    } else {
      const pages = this.project.getExtraPages();
      const diagram = pages[index - 1] === undefined ? null : parseDiagram(pages[index - 1]);
      if (!diagram) return;
      diagram.setAttribute('name', text);
      pages[index - 1] = xmlUtils.getXml(diagram);
      this.project.setExtraPages(pages);
      this.pageListCache = null;
      this.cache.modelDirty = true;
    }
    emit('rd-pages-changed', { graph: this.graph });
  }

  /** Removes drawing page `index` (not the main page); the main page is shown when it was the shown one. */
  async removePage(index: number): Promise<void> {
    if (index <= 0 || index > this.project.getExtraPages().length) return;
    if (this.shownPage === index) await this.showPage(0);
    const pages = this.project.getExtraPages();
    pages.splice(index - 1, 1);
    this.project.setExtraPages(pages);
    if (this.shownPage > index) this.shownPage--;
    this.pageListCache = null;
    this.cache.modelDirty = true;
    emit('rd-pages-changed', { graph: this.graph });
  }

  // ---- page settings ----------------------------------------------------------------------------

  /** The shown page's draw.io page settings (`<mxGraphModel>` attributes; grid: see serializeToXml). */
  getPageSettings(): PageSettings {
    return { ...this.pageSettings, ...(this.pageSettings.extra ? { extra: { ...this.pageSettings.extra } } : {}) };
  }

  /** Changes page settings of the shown page (one undoable model edit, like draw.io's Page Setup). */
  setPageSettings(patch: Partial<PageSettings>): void {
    const next: PageSettings = { ...this.getPageSettings(), ...patch };
    const model = this.graph.getDataModel();
    model.beginUpdate();
    try {
      model.execute(new PageSettingsChange(this, next) as unknown as Parameters<typeof model.execute>[0]);
    } finally {
      model.endUpdate();
    }
  }

  /** Replaces the page settings (PageSettingsChange); the graph's page format follows. */
  replacePageSettings(settings: PageSettings): void {
    this.pageSettings = { ...settings };
    if (settings.pageWidth && settings.pageHeight) this.graph.pageFormat = new Rectangle(0, 0, settings.pageWidth, settings.pageHeight);
    if (settings.pageScale && settings.pageScale > 0) this.graph.pageScale = settings.pageScale;
    emit('rd-page-settings', { graph: this.graph });
  }

  // ---- file ---------------------------------------------------------------------------------

  /** The whole tab as a native draw.io file (`<mxfile>`: shown page plus the preserved pages). */
  getProjectXml(): string {
    return this.project.generateProjectXml(this.getMainPageModelXml(), this.canonicalExtraPages());
  }

  /** Parses a project file's text (draw.io `<mxfile>`, legacy `<project>`, bare model) without applying it. */
  parseProjectXml(xml: string): Promise<ParsedProject> {
    return this.project.parseProjectXml(xml);
  }

  /**
   * Opens a parsed project file into this document: the model (load(); throws and keeps the
   * current diagram when it cannot be decoded), then its name, pages and sections.
   */
  applyParsedProject(parsed: ParsedProject): void {
    this.load(parsed.graphXml);
    this.resetPages();
    this.project.setProjectMetadata(parsed.metadata);
    // Pages 2..n are not shown, but are kept so a save writes them back unchanged
    this.project.setExtraPages(parsed.extraPages);
    this.project.setPageId(parsed.pageId);
    // The file's section values replace the tab's (none in the file: the tab has none afterwards)
    const values = parsed as unknown as Record<string, unknown>;
    for (const section of projectSections()) section.load(this.project.section(section.key), values[section.key]);
    this.nameChanged(parsed.metadata.name);
  }

  /** Downloads `projectXml` as `filename` (browser download). */
  exportToFile(projectXml: string, filename: string): void {
    this.project.exportToFile(projectXml, filename);
  }

  // ---- model --------------------------------------------------------------------------------

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

    logger.debug('SaveLoad', 'Loading XML, length:', xml.length);

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
    // Files of earlier versions: app-only layers (rdLayerId) -> real draw.io layers, once
    const migration = migrateLegacyLayers(scratchModel);

    this.graph.clearSelection();
    this.graph.getDataModel().setRoot(loadedRoot);
    this.applyPageSettings(pageSettings ?? {}, pageSettings !== null);

    // Restore PlantUML metadata
    this.restorePlantUmlMetadata(xml);

    this.graph.refresh();
    // A loaded drawing is shown from its origin (or its top-left when it reaches into negative
    // coordinates), like a freshly opened file in draw.io
    this.view.resetView?.(this.graph);
    this.commandService?.clearHistory();
    this.loadMigration = migration;
    logger.debug('SaveLoad', 'Diagram loaded');
  }

  /**
   * Whether the last load() changed the diagram against its source (old app layers migrated):
   * the tab then has unsaved changes (the cache is rewritten, a remote-bound tab is dirty).
   */
  hasUnsavedLoadChanges(): boolean {
    return this.loadMigration !== null;
  }

  /** What the last load() migrated (old app layers), or null. */
  lastLoadMigration(): LegacyLayerMigration | null {
    return this.loadMigration;
  }

  /**
   * Serializes the diagram as a draw.io `<mxGraphModel>` (plus the PlantUML metadata comment).
   * Used for file save, File > Export and the browser cache.
   */
  serializeToXml(): string {
    // the tab's grid as draw.io reads it (View > Grid / toolbar / Properties > Canvas change it)
    const page: PageSettings = { ...this.pageSettings, grid: this.graph.gridEnabled, gridSize: this.graph.gridSize };
    try {
      logger.debug('SaveLoad', 'Serializing graph...');
      // Image data URLs stay in the output: custom shapes and uploaded images have no other
      // source to be rebuilt from, so stripping them would lose content on reload.
      let xml = exportModelToDrawioXml(this.graph.getDataModel(), {
        stylesheet: this.graph.getStylesheet(),
        page,
        htmlLabels: this.graph.isHtmlLabels(),
      });

      // Embed PlantUML metadata
      xml = this.embedPlantUmlMetadata(xml);

      logger.debug('SaveLoad', 'Serialized, length:', xml.length);
      return xml;
    } catch (e) {
      console.error('[SaveLoad] Serialization error:', e);
      return emptyDrawioModelXml(page);
    }
  }

  /**
   * The inputs of serializeToXml besides the model (page settings, grid, HTML labels, PlantUML
   * metadata): the autosave reuses a tab's serialised XML while these and the model are unchanged.
   */
  getSerializationFingerprint(): string {
    let plantuml: string;
    try {
      plantuml = JSON.stringify(
        this.plantumlGroupManager.getAllPlantUmlGroups().map((group) => [group.getId(), this.plantumlGroupManager.getPlantUmlMetadata(group)])
      );
    } catch {
      plantuml = `unknown:${Date.now()}`; // never equal: serialise again
    }
    return JSON.stringify([this.pageSettings, this.graph.gridEnabled, this.graph.gridSize, this.graph.isHtmlLabels(), plantuml]);
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
      name: this.project.getProjectName(),
      cells: modelXmlToJsonCells(this.serializeToXml()),
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Keeps the page settings of a loaded draw.io model and applies its grid (on/off, size; draw.io's
   * defaults grid=1 gridSize=10 when the attributes are missing) to this tab. Legacy models
   * (`drawio` false) have no page settings: the tab's grid stays.
   */
  private applyPageSettings(settings: PageSettings, drawio = true): void {
    this.pageSettings = { ...settings };
    if (drawio) {
      this.view.applyGrid?.(this.graph, {
        grid: settings.grid ?? DEFAULT_PAGE_SETTINGS.grid,
        gridSize: settings.gridSize ?? DEFAULT_PAGE_SETTINGS.gridSize,
      });
      emit('rd-grid-settings', { graph: this.graph });
    }
    if (settings.pageWidth && settings.pageHeight) {
      this.graph.pageFormat = new Rectangle(0, 0, settings.pageWidth, settings.pageHeight);
    }
    if (settings.pageScale && settings.pageScale > 0) {
      this.graph.pageScale = settings.pageScale;
    }
    emit('rd-page-settings', { graph: this.graph });
  }

  // ---- remote binding -----------------------------------------------------------------------

  /** Replaces what a save does (null: download again). Set by the remote session for bound tabs. */
  setSaveHandler(handler: (() => void) | null): void {
    this.saveHandler = handler;
  }

  /** The remote binding's save, or null when the tab is not bound. */
  getSaveHandler(): (() => void) | null {
    return this.saveHandler;
  }

  /** Keeps the remote binding read from the tab cache (opaque) until the remote session claims it. */
  setRestoredRemote(remote: unknown): void {
    this.restoredRemote = remote;
  }

  /** The cached remote binding, once (undefined when there is none). */
  takeRestoredRemote(): unknown {
    const remote = this.restoredRemote;
    this.restoredRemote = undefined;
    return remote;
  }

  /** The cached remote binding without claiming it (the cache keeps writing it until claimed). */
  peekRestoredRemote(): unknown {
    return this.restoredRemote;
  }

  // ---- tab cache (autosave) -------------------------------------------------------------------

  /**
   * Keeps the cached XML of a tab that failed to restore, so autosave does not overwrite it with
   * the empty model. The first edit of the tab (any model change) makes it a normal tab again.
   */
  keepUnrestoredXml(graphXml: string): void {
    this.unrestoredXml = graphXml;
  }

  /** Restores the document part of a tab cache entry (pages, sections, project name); not the model. */
  restoreCacheEntry(entry: { extraPages?: unknown; pageId?: unknown; projectName?: unknown } & Record<string, unknown>): void {
    // Pages 2..n of the opened file are kept even when page 1 cannot be restored
    const extraPages = Array.isArray(entry.extraPages) ? entry.extraPages.filter((page): page is string => typeof page === 'string') : [];
    const pageId = typeof entry.pageId === 'string' && entry.pageId ? entry.pageId : null;
    this.setPreservedPages(extraPages, pageId);
    // Section values (scenarios, Railway Script) are kept even when the drawing cannot be restored
    for (const section of projectSections()) section.fromCache?.(this.project.section(section.key), entry[section.key]);
    // Each tab's own project (caches of earlier versions: only the active tab's, set by TabManager)
    if (typeof entry.projectName === 'string' && entry.projectName) this.setProjectName(entry.projectName);
  }

  /** JSON string of the graph XML: the cached one unless the document changed (CacheState). */
  private cacheXmlJson(ctx: DocumentCacheContext): string {
    if (this.unrestoredXml !== null) return JSON.stringify(this.unrestoredXml);
    const state = this.cache;
    const fingerprint = this.getSerializationFingerprint();
    const due = ctx.active && ctx.now - state.xmlAt >= RESERIALIZE_ACTIVE_MS;
    if (state.xmlJson === null || state.modelDirty || fingerprint !== state.xmlFingerprint || due) {
      // cleared first: a change while serialising marks the document again
      state.modelDirty = false;
      state.xmlJson = JSON.stringify(this.serializeToXml());
      state.xmlFingerprint = fingerprint;
      state.xmlAt = ctx.now;
    }
    return state.xmlJson;
  }

  /** JSON of a section's cache value (undefined: not written). */
  private sectionCacheJson(key: string, toCache: (state: unknown) => unknown): string | undefined {
    const memo = this.cache.sectionJson.get(key);
    if (memo !== null && this.cache.sectionJson.has(key)) return memo;
    const value = toCache(this.project.section(key));
    const json = value === undefined ? undefined : JSON.stringify(value);
    if (this.cache.sectionJson.has(key)) this.cache.sectionJson.set(key, json);
    return json;
  }

  /**
   * The tab's cache entry (CacheData['tabs'][number]) as JSON, in the key order of earlier
   * versions: id, name, projectName, graphXml, extraPages, pageId, the sections, remote.
   */
  cacheEntryJson(ctx: DocumentCacheContext, remote: unknown): string {
    const { extraPages, pageId } = this.getPreservedPages();
    const head = JSON.stringify({ id: ctx.id, name: ctx.name, projectName: this.getProjectName() });
    // Only written when there is something to keep, so single-page caches stay as they were
    const tail = JSON.stringify({
      ...(extraPages.length > 0 ? { extraPages } : {}),
      ...(pageId ? { pageId } : {}),
    });
    // Another page shown: the main page's XML (a restored tab shows the main page)
    const graphXml = this.shownPage > 0 && this.mainPageXml !== null ? JSON.stringify(this.mainPageXml) : this.cacheXmlJson(ctx);
    const parts = [head.slice(1, -1), `"graphXml":${graphXml}`];
    if (tail !== '{}') parts.push(tail.slice(1, -1));
    for (const section of projectSections()) {
      if (!section.toCache) continue;
      const json = this.sectionCacheJson(section.key, section.toCache);
      if (json !== undefined) parts.push(`${JSON.stringify(section.key)}:${json}`);
    }
    if (remote !== undefined && remote !== null) parts.push(`"remote":${JSON.stringify(remote)}`);
    return `{${parts.join(',')}}`;
  }

  // ---- PlantUML metadata ----------------------------------------------------------------------

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

      logger.debug('SaveLoad', 'Embedding PlantUML metadata for', [plantumlGroups.length, 'groups']);

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

  /** Extract and restore PlantUML metadata from XML after deserialization */
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
        logger.debug('SaveLoad', 'No PlantUML metadata found in XML');
        return;
      }

      const plantumlData: PlantUmlMetadataEntry[] = JSON.parse(json);
      logger.debug('SaveLoad', 'Restoring PlantUML metadata for', [plantumlData.length, 'groups']);

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
          logger.debug('SaveLoad', 'Restored PlantUML metadata for:', data.cellLabel);
        }
      });
    } catch (e) {
      console.warn('[SaveLoad] Failed to restore PlantUML metadata:', e);
    }
  }
}

/**
 * Adds the typed accessor `key` (a registered feature section's state) to DiagramDocument and
 * ProjectService; the feature declares its type by module augmentation (scenarios/project-section.ts).
 */
export function defineSectionAccessor(key: string): void {
  for (const proto of [DiagramDocument.prototype, ProjectService.prototype]) {
    if (Object.getOwnPropertyDescriptor(proto, key)) continue;
    Object.defineProperty(proto, key, {
      get(this: { section<T>(k: string): T }): unknown {
        return this.section(key);
      },
      configurable: true,
    });
  }
}
