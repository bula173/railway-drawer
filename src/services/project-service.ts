import { xmlUtils } from '@maxgraph/core';
import { buildMxfile, emptyDrawioModelXml, generatePageId, sanitizeXmlText } from './drawio-xml';
import { InflateLimitError, MAX_INFLATED_BYTES, NoCompressionStreamError, inflateRawBytes } from './deflate-stream';
import { projectSections, type ClaimedPage } from './project-sections';
import { logger } from '../drawio/logger';

export interface ProjectMetadata {
  name: string;
  version: string;
  createdAt: string;
  modifiedAt: string;
}

/** Version of this app's project file format, written to mxfile@version. */
export const PROJECT_FORMAT_VERSION = '1.0';

/** The `host` attribute this app writes on <mxfile>. */
const PROJECT_HOST = 'railway-drawer';

/** The `agent` attribute this app writes on <mxfile>. */
const PROJECT_AGENT = 'railway-drawer/1.0';

export interface ParsedProject {
  metadata: ProjectMetadata;
  /** Model XML of the first page, which is the one loaded into the graph. */
  graphXml: string;
  /** Pages 2..n of a multi-page mxfile that are not scenario steps, as serialized <diagram> elements, kept unchanged. */
  extraPages: string[];
  /** Names of the pages in `extraPages` (or "Page N" when unnamed), for telling the user. */
  extraPageNames: string[];
  /** Id of the loaded page's <diagram>, reused when saving; null when it had none. */
  pageId: string | null;
  // Feature sections add their parsed values here (project-sections.ts, declaration merging):
  // `scenarios` (scenarios/project-section.ts), `railwayScript` (railway-script/project-section.ts)
}

export class ProjectService {
  /** Pages of the opened file that are not shown; written back unchanged by generateProjectXml(). */
  private extraPages: string[] = [];
  /** Id of the shown page's <diagram>; kept between saves so files diff cleanly. */
  private pageId: string | null = null;
  /**
   * State of the registered feature sections (project-sections.ts), by key: the scenarios (one
   * page per step after the shown page) and the Railway Script (an attribute of the shown page).
   * The features add typed accessors (`scenarios`, `railwayScript`).
   */
  private readonly sectionStates = new Map<string, unknown>(projectSections().map((s) => [s.key, s.create()]));

  private projectMetadata: ProjectMetadata = {
    name: 'Untitled Diagram',
    version: PROJECT_FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
  };

  /** The state of the registered section `key` (project-sections.ts). */
  section<T>(key: string): T {
    if (!this.sectionStates.has(key)) throw new Error(`Project section "${key}" is not registered`);
    return this.sectionStates.get(key) as T;
  }

  setProjectName(name: string): void {
    this.projectMetadata.name = name;
    this.projectMetadata.modifiedAt = new Date().toISOString();
  }

  getProjectName(): string {
    return this.projectMetadata.name;
  }

  getProjectMetadata(): ProjectMetadata {
    return { ...this.projectMetadata };
  }

  /**
   * Wraps the model XML of the shown page (a draw.io `<mxGraphModel>`, optionally followed by
   * comments such as the PlantUML metadata) into a native draw.io `<mxfile>`. The scenario step
   * pages follow it, then the preserved pages of the opened file (`extraPages`), unchanged.
   */
  generateProjectXml(graphXml: string): string {
    // The shown page's id must not collide with the ids of the preserved pages
    const usedIds = new Set<string>();
    for (const pageXml of this.extraPages) {
      const id = new DOMParser().parseFromString(pageXml, 'text/xml').documentElement?.getAttribute('id');
      if (id) usedIds.add(id);
    }
    if (!this.pageId || usedIds.has(this.pageId)) {
      do {
        this.pageId = generatePageId();
      } while (usedIds.has(this.pageId));
    }
    usedIds.add(this.pageId);
    const sections = projectSections();
    const sectionPages = sections.flatMap((s) => s.pages?.(this.sectionStates.get(s.key), usedIds) ?? []);
    const attributes = Object.assign({}, ...sections.map((s) => s.mainPageAttributes(this.sectionStates.get(s.key)))) as Record<string, string>;

    let model: Element | null = null;
    const comments: string[] = [];
    const graphDoc = new DOMParser().parseFromString(graphXml, 'text/xml');
    if (graphDoc.getElementsByTagName('parsererror').length === 0 && graphDoc.documentElement) {
      // Top-level comments (e.g. PLANTUML_METADATA after the model) are siblings of the model
      // element; they are kept inside <diagram>, where draw.io ignores them.
      graphDoc.childNodes.forEach((node) => {
        if (node.nodeType === Node.COMMENT_NODE) comments.push(node.nodeValue ?? '');
      });
      model = graphDoc.documentElement;
    } else {
      console.error('[Project] The graph XML is not valid; saving an empty page');
    }
    if (!model) {
      model = new DOMParser().parseFromString(emptyDrawioModelXml(), 'text/xml').documentElement;
    }

    return buildMxfile(
      [{ id: this.pageId, name: this.projectMetadata.name, model, comments, attributes }],
      [...sectionPages, ...this.extraPages],
      {
        host: PROJECT_HOST,
        modified: this.projectMetadata.modifiedAt,
        agent: PROJECT_AGENT,
        version: this.projectMetadata.version,
      }
    );
  }

  /**
   * Parses a project file (.railwaydrawer / .drawio mxfile, legacy <project>, or a bare model).
   * Resolves only with a model that parsed successfully; otherwise rejects with a user-readable
   * error, so callers never replace the current diagram with an empty or broken one.
   * Compressed draw.io pages (base64 + raw deflate + URI encoding) are decompressed.
   * Only the first page (<diagram>) of an mxfile is loaded; the other pages are returned as
   * `extraPages` so the caller can warn about them and keep them for saving.
   * A foreign mxfile (e.g. from draw.io) carries the editor's own version in mxfile@version,
   * so for those the metadata gets this app's PROJECT_FORMAT_VERSION instead.
   */
  async parseProjectXml(xml: string): Promise<ParsedProject> {
    // Files written before control characters were filtered on save are otherwise unreadable
    xml = sanitizeXmlText(xml);
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');

    if (doc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('The file is not valid XML');
    }

    const rootEl = doc.documentElement;
    let metadata: ProjectMetadata;
    let graphXml: string | null = null;
    const extraPages: string[] = [];
    const extraPageNames: string[] = [];
    let pageId: string | null = null;
    const sections = projectSections();
    // Section values; null: not an mxfile (each section's empty value)
    let mainPage: Element | undefined;
    let claimed: Map<string, ClaimedPage[]> | null = null;

    // Handle mxfile format (standard draw.io)
    if (rootEl.nodeName === 'mxfile') {
      // Pages are the direct <diagram> children of <mxfile>
      const pages = Array.from(rootEl.children).filter((el) => el.nodeName === 'diagram');
      const diagramEl = pages[0];
      mainPage = diagramEl;
      claimed = new Map(sections.map((s) => [s.key, []]));
      for (const [index, page] of pages.slice(1).entries()) {
        // Pages of a section (scenario steps) go back to it; one that cannot be read stays a kept page
        const owner = sections.find((s) => s.claimsPage?.(page));
        if (owner) {
          try {
            const pageXml = await this.extractDiagramModelXml(page);
            if (pageXml !== null) {
              ProjectService.validateGraphModelXml(pageXml);
              if (!/^\s*<mxGraphModel[\s>/]/.test(pageXml)) throw new Error('not a draw.io model');
              claimed.get(owner.key)!.push({ page, xml: pageXml });
              continue;
            }
          } catch (error) {
            console.warn(`[Project] Keeping an unreadable ${owner.key} page as a page:`, page.getAttribute('name'), error);
          }
        }
        // getXml: newlines in attribute values (multi-line labels) must stay escaped
        extraPages.push(xmlUtils.getXml(page));
        extraPageNames.push(page.getAttribute('name') || `Page ${index + 2}`);
      }
      const isOwnFile = rootEl.getAttribute('host') === PROJECT_HOST;
      metadata = {
        name: diagramEl?.getAttribute('name') || 'Untitled Diagram',
        version: (isOwnFile && rootEl.getAttribute('version')) || PROJECT_FORMAT_VERSION,
        createdAt: new Date().toISOString(),
        modifiedAt: rootEl.getAttribute('modified') || new Date().toISOString(),
      };
      if (diagramEl) {
        pageId = diagramEl.getAttribute('id') || null;
        graphXml = await this.extractDiagramModelXml(diagramEl);
      }
    }
    // Handle legacy project format
    else if (rootEl.nodeName === 'project') {
      metadata = {
        name: rootEl.getAttribute('name') || 'Untitled Diagram',
        version: rootEl.getAttribute('version') || '1.0',
        createdAt: rootEl.getAttribute('createdAt') || new Date().toISOString(),
        modifiedAt: rootEl.getAttribute('modifiedAt') || new Date().toISOString(),
      };

      const diagramEl = rootEl.getElementsByTagName('diagram')[0];
      if (diagramEl) {
        graphXml = await this.extractDiagramModelXml(diagramEl);
      }
    } else {
      // Try to treat as mxGraphModel or GraphDataModel directly
      metadata = {
        name: 'Untitled Diagram',
        version: '1.0',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      };
      graphXml = xml;
    }

    if (graphXml === null) {
      throw new Error('The file does not contain a diagram');
    }
    ProjectService.validateGraphModelXml(graphXml);

    const parsed: Record<string, unknown> = { metadata, graphXml, extraPages, extraPageNames, pageId };
    for (const s of sections) parsed[s.key] = claimed ? s.parse(mainPage, claimed.get(s.key) ?? []) : s.empty();
    return parsed as unknown as ParsedProject;
  }

  /**
   * Throws unless `xml` is well-formed and its root is a graph model (<mxGraphModel> or <GraphDataModel>).
   */
  static validateGraphModelXml(xml: string): void {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    if (doc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('The diagram data is not valid XML');
    }
    const rootName = doc.documentElement?.nodeName;
    if (rootName !== 'mxGraphModel' && rootName !== 'GraphDataModel') {
      throw new Error(`Unsupported diagram format (<${rootName ?? 'empty'}>)`);
    }
  }

  /**
   * Returns the model XML of one <diagram> page: the uncompressed model element (plus any
   * comments stored next to it, e.g. PlantUML metadata), or the decompressed text content.
   */
  private async extractDiagramModelXml(diagramEl: Element): Promise<string | null> {
    const graphModel =
      diagramEl.getElementsByTagName('mxGraphModel')[0] ??
      diagramEl.getElementsByTagName('GraphDataModel')[0];

    if (graphModel) {
      // getXml: newlines in attribute values (multi-line labels) must stay escaped
      let graphXml = xmlUtils.getXml(graphModel);
      diagramEl.childNodes.forEach((node) => {
        if (node.nodeType === Node.COMMENT_NODE) {
          graphXml += '\n' + new XMLSerializer().serializeToString(node);
        }
      });
      return graphXml;
    }

    const compressed = diagramEl.textContent?.trim();
    if (!compressed) {
      return null;
    }
    return sanitizeXmlText(await ProjectService.decompressDiagram(compressed));
  }

  /**
   * Largest inflated size (bytes) of one compressed page. Real pages, even with embedded
   * images, stay far below it; a crafted "deflate bomb" would otherwise exhaust memory.
   */
  static maxInflatedBytes = MAX_INFLATED_BYTES;

  /**
   * Decodes draw.io's compressed page format: base64 -> raw deflate -> URI-encoded XML.
   */
  static async decompressDiagram(data: string): Promise<string> {
    let binary: string;
    try {
      binary = atob(data.replace(/\s+/g, ''));
    } catch {
      throw new Error('The diagram data is neither XML nor compressed draw.io data');
    }

    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const limit = ProjectService.maxInflatedBytes;
    let inflated: string;
    try {
      inflated = new TextDecoder().decode(await inflateRawBytes(bytes, limit));
    } catch (error) {
      if (error instanceof NoCompressionStreamError) {
        throw new Error(
          'This browser cannot open compressed draw.io files. In draw.io, turn off File > Properties > Compressed and save again.'
        );
      }
      if (error instanceof InflateLimitError) {
        throw new Error(
          `The compressed page is too large to open (over ${Math.round(limit / (1024 * 1024))} MB uncompressed)`
        );
      }
      throw new Error('The compressed diagram data is corrupt');
    }

    try {
      return decodeURIComponent(inflated);
    } catch {
      // Very old draw.io versions compressed the XML without URI-encoding it first
      return inflated;
    }
  }

  exportToFile(projectXml: string, filename: string): void {
    try {
      const blob = new Blob([projectXml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `${this.projectMetadata.name}.railwaydrawer`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      logger.debug('Project', 'Exported to file:', filename);
    } catch (error) {
      console.error('[Project] Export failed:', error);
      throw error;
    }
  }

  /**
   * Reads and parses a project file. Does not change this service's metadata: the caller applies
   * it with setProjectMetadata() only after the diagram was actually loaded.
   */
  async importFromFile(file: File): Promise<ParsedProject> {
    const xml = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
    return this.parseProjectXml(xml);
  }

  setProjectMetadata(metadata: ProjectMetadata): void {
    this.projectMetadata = { ...metadata };
  }

  /** Sets the pages (serialized <diagram> elements) that generateProjectXml() writes after the shown one. */
  setExtraPages(pages: string[]): void {
    this.extraPages = [...pages];
  }

  /** Pages 2..n of the opened file (serialized <diagram> elements), written back on save. */
  getExtraPages(): string[] {
    return [...this.extraPages];
  }

  /** Sets the id written on the shown page's <diagram> (null: generate a new one). */
  setPageId(pageId: string | null): void {
    this.pageId = pageId;
  }

  /** Id of the shown page's <diagram>, or null when none was loaded or generated yet. */
  getPageId(): string | null {
    return this.pageId;
  }
}
