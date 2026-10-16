import { xmlUtils } from '@maxgraph/core';
import { buildMxfile, emptyDrawioModelXml, generatePageId, sanitizeXmlText } from './drawio-xml';
import { ScenarioSet } from '../scenarios/scenario-model';
import type { ScenarioData } from '../scenarios/scenario-model';
import {
  assembleScenarios,
  buildScenarioPages,
  isScenarioStepPage,
  scenarioIndexAttributes,
} from '../scenarios/scenario-format';
import type { ScenarioStepPage } from '../scenarios/scenario-format';

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
  /** Scenarios rebuilt from the step pages and the main page's index (see scenario-format.ts). */
  scenarios: ScenarioData[];
}

export class ProjectService {
  /** Pages of the opened file that are not shown; written back unchanged by generateProjectXml(). */
  private extraPages: string[] = [];
  /** Id of the shown page's <diagram>; kept between saves so files diff cleanly. */
  private pageId: string | null = null;
  /** Scenarios of this diagram; written as one page per step after the shown page. */
  readonly scenarios = new ScenarioSet();

  private projectMetadata: ProjectMetadata = {
    name: 'Untitled Diagram',
    version: PROJECT_FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
  };

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
    const scenarios = this.scenarios.list();
    const scenarioPages = buildScenarioPages(scenarios, usedIds);

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
      [{ id: this.pageId, name: this.projectMetadata.name, model, comments, attributes: scenarioIndexAttributes(scenarios) }],
      [...scenarioPages, ...this.extraPages],
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
    let scenarios: ScenarioData[] = [];

    // Handle mxfile format (standard draw.io)
    if (rootEl.nodeName === 'mxfile') {
      // Pages are the direct <diagram> children of <mxfile>
      const pages = Array.from(rootEl.children).filter((el) => el.nodeName === 'diagram');
      const diagramEl = pages[0];
      const stepPages: ScenarioStepPage[] = [];
      for (const [index, page] of pages.slice(1).entries()) {
        // Scenario steps become scenarios again; a step page that cannot be read stays a kept page
        if (isScenarioStepPage(page)) {
          try {
            const stepXml = await this.extractDiagramModelXml(page);
            if (stepXml !== null) {
              ProjectService.validateGraphModelXml(stepXml);
              if (!/^\s*<mxGraphModel[\s>/]/.test(stepXml)) throw new Error('not a draw.io model');
              stepPages.push({ page, xml: stepXml });
              continue;
            }
          } catch (error) {
            console.warn('[Project] Keeping an unreadable scenario step page as a page:', page.getAttribute('name'), error);
          }
        }
        // getXml: newlines in attribute values (multi-line labels) must stay escaped
        extraPages.push(xmlUtils.getXml(page));
        extraPageNames.push(page.getAttribute('name') || `Page ${index + 2}`);
      }
      scenarios = assembleScenarios(diagramEl, stepPages);
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

    return { metadata, graphXml, extraPages, extraPageNames, pageId, scenarios };
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
  static maxInflatedBytes = 100 * 1024 * 1024;

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

    if (typeof DecompressionStream === 'undefined') {
      throw new Error(
        'This browser cannot open compressed draw.io files. In draw.io, turn off File > Properties > Compressed and save again.'
      );
    }

    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const stream = new DecompressionStream('deflate-raw');
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();

    const write = (async () => {
      await writer.write(bytes);
      await writer.close();
    })();
    const limit = ProjectService.maxInflatedBytes;
    let tooLarge = false;
    const read = (async () => {
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.length;
        if (total > limit) {
          tooLarge = true;
          await reader.cancel();
          throw new Error('too large');
        }
      }
      const out = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.length;
      }
      return new TextDecoder().decode(out);
    })();

    let inflated: string;
    try {
      [, inflated] = await Promise.all([write, read]);
    } catch {
      if (tooLarge) {
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
      console.log('[Project] Exported to file:', filename);
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
