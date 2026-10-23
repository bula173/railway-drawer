/**
 * @file saveload.ts
 * @brief File I/O of one tab over its DiagramDocument (document/diagram-document.ts): File > Save /
 *        Ctrl+S (download, or the remote binding's save), File > Open of a file or file text,
 *        File > Export (.drawio), with the user-facing notifications, the save status and the
 *        top-bar title. The document state itself (model, project, pages, sections) is the
 *        document's.
 */
// Feature sections of the project file (scenarios, Railway Script): registered before any DiagramDocument exists
import '../scenarios/project-section';
import '../railway-script/project-section';
import '../print/project-section';
import type { Graph } from '@maxgraph/core';
import { DiagramDocument } from '../document/diagram-document';
import { resetCanvasScroll } from './canvas-scroll';
import { applyGridSettings } from './grid-toggle';
import { globalNotificationManager } from './notification';
import { globalSaveStatusIndicator } from './save-status';
import { logger } from '../drawio/logger';

export { modelXmlToJsonCells, type JsonExport, type JsonExportCell } from '../document/diagram-document';

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
  readonly document: DiagramDocument;
  /** Told after a file from disk was opened into this tab (the remote session unbinds the tab). */
  private localFileOpenedListeners = new Set<() => void>();
  private readonly stopNameListener: () => void;

  constructor(document: DiagramDocument) {
    this.document = document;
    // The top-bar title follows the shown tab's project name (renames and opened files)
    this.stopNameListener = document.onProjectNameChange((name) => this.updateProjectNameUI(name));
    // Ctrl/Cmd+S is dispatched once, to the active tab, by the `save` command (ui/commands keymap).
    // A per-controller `document` listener here downloaded one file per open tab.
    // The .save-status element is owned by globalSaveStatusIndicator; writing it directly
    // from here overwrote autosave error messages.
  }

  destroy(): void {
    this.stopNameListener();
    this.localFileOpenedListeners.clear();
  }

  /**
   * Ctrl/Cmd+S and File > Save. A tab bound to a remote file (SharePoint, ...) saves back there
   * through the document's save handler set by the remote session; otherwise the file is downloaded.
   */
  saveProject(): void {
    const handler = this.document.getSaveHandler();
    if (handler) {
      handler();
      return;
    }
    this.saveProjectToDisk();
  }

  /** Downloads the tab as a file, whatever saveProject() is bound to. */
  saveProjectToDisk(): void {
    try {
      logger.debug('SaveLoad', 'Starting save...');
      const projectXml = this.document.getProjectXml();
      logger.debug('SaveLoad', 'Project XML generated, length:', projectXml.length);
      // A draw.io file (<mxfile>): .drawio, like Export As… and the Share dialog's download
      const filename = `${this.document.getProjectName() || 'diagram'}.drawio`;
      logger.debug('SaveLoad', 'Filename:', filename);
      this.document.exportToFile(projectXml, filename);
      this.markAsSavedToDisk(filename);
      logger.debug('SaveLoad', 'Project saved as', filename);
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
      logger.debug('SaveLoad', 'Starting file import:', file.name);
      const result = await this.document.parseProjectXml(xml);
      logger.debug('SaveLoad', 'File imported, metadata:', result.metadata);
      // Model first (the current diagram is kept when it fails), then name, pages and sections
      this.document.applyParsedProject(result);
      // A file whose old app layers were migrated differs from the file on disk: unsaved
      if (this.document.hasUnsavedLoadChanges()) globalSaveStatusIndicator.setUnsaved();
      else this.markAsSavedToDisk(file.name);
      this.reportLoadMigration(file.name);
      if (result.extraPageNames.length > 0) {
        const names = result.extraPageNames.map((name) => `"${name}"`).join(', ');
        globalNotificationManager.warning(
          `Opened ${file.name}: only the first page is shown. Not loaded: ${names}. ` +
            'They are kept unchanged when you save.'
        );
      } else if (!opts.quiet) {
        globalNotificationManager.success(`Opened ${file.name}`);
      }
      logger.debug('SaveLoad', 'Project loaded:', result.metadata.name);
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
    const xml = this.document.getProjectXml();
    const name = this.document.getProjectName() || 'diagram';
    this.document.exportToFile(xml, `${name}.drawio`);
    logger.debug('SaveLoad', 'Diagram exported');
    return xml;
  }

  /** Tells the user once that the old layers of `name` were converted. */
  private reportLoadMigration(name: string): void {
    const m = this.document.lastLoadMigration();
    if (!m || m.createdLayers === 0) return;
    globalNotificationManager.info(
      `${name}: the ${m.layers} layers of an earlier Railway Drawer version were converted to ` +
        'draw.io layers (see the Layers panel). Save to keep the change.'
    );
  }

  /**
   * Shows the project name in the top-bar title, only while this tab is the shown one (each tab
   * has its own project; TabManager.switchTab shows the new tab's). Not while it is being edited.
   */
  private updateProjectNameUI(name: string): void {
    const container = this.document.graph.container;
    if (!container || !container.isConnected || container.style.display === 'none') return;
    const titleElement = document.querySelector('.document-title') as HTMLElement | null;
    if (titleElement && !titleElement.querySelector('input')) {
      titleElement.textContent = name;
    }
  }

  /** Save status "Saved to <target>" (file name or storage provider) after a real save/open. */
  markAsSavedToDisk(target?: string): void {
    globalSaveStatusIndicator.setSavedToDisk(target);
  }
}

/** A tab's DiagramDocument with the view effects of a load (grid background, scroll reset) wired. */
export function createTabDocument(graph: Graph, commandService: { clearHistory(): void } | null = null): DiagramDocument {
  return new DiagramDocument(graph, {
    commandService,
    view: { applyGrid: applyGridSettings, resetView: resetCanvasScroll },
  });
}
