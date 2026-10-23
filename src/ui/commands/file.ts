/**
 * @file file.ts
 * @brief File menu commands: New, Open, Save (Ctrl/Cmd+S), Save As, Import (draw.io file in a new
 *        tab, image as custom shape), Export (.drawio, PNG, SVG), Save as Template, Print.
 *        railML / Railway Script / Railway Data / Scenario items: railml.ts, script.ts,
 *        railway.ts, scenarios.ts; Share: share.ts.
 */
import { emit } from '../../core/event-bus';
import { isRailmlFile, requestRailmlOpen } from '../../railml/install-railml';
import { promptSaveAs } from '../app-dialogs';
import { ServiceRegistry } from '../../services/service-registry';
import { logger } from '../../drawio/logger';
import type { TabData } from '../tabs';
import { isMod, keyOf } from './keymap';
import type { Command } from './types';

/** File > Open…: a draw.io / project file into the active tab; railML opens in a new tab (src/railml). */
function openProject(tab: TabData): void {
  logger.debug('Menu', 'Opening file dialog...');
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.railwaydrawer,.drawio,.xml,.railml';
  input.onchange = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    logger.debug('Menu', 'File selected:', target.files);
    const file = target.files?.[0];
    if (file) {
      logger.debug('Menu', 'Loading file:', file.name);
      // railML (root <railML>): imported into a new tab by src/railml
      const railml = await isRailmlFile(file);
      if (railml !== null) {
        requestRailmlOpen(railml, file.name);
        return;
      }
      try {
        await tab.saveLoadController.loadProjectFromFile(file);
        logger.debug('Menu', 'File loaded successfully');
      } catch (error) {
        // SaveLoadController already showed the error to the user and kept the current diagram
        console.error('[Menu] Error loading file:', error);
      }
    } else {
      logger.debug('Menu', 'No file selected');
    }
  };
  input.click();
}

/** File > Import > draw.io File (New Tab)…: like Open, into a new tab (the current diagram stays). */
function importDrawioFile(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.drawio,.xml,.railwaydrawer';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    const railml = await isRailmlFile(file);
    if (railml !== null) {
      requestRailmlOpen(railml, file.name);
      return;
    }
    const tabManager = ServiceRegistry.getTabManager();
    if (!tabManager) return;
    const tab = tabManager.openNewTab();
    try {
      await tab.saveLoadController.loadProjectFromFile(file);
    } catch (error) {
      // SaveLoadController showed the error; the new tab stays empty
      console.error('[Menu] Import failed:', error);
    }
  };
  input.click();
}

/**
 * File > Save As…: asks for the file name in the themed dialog, renames the active tab's project
 * (top-bar title, tab label when it was the project name) and downloads the .drawio file. It always
 * downloads, also for a tab bound to a remote file.
 */
async function saveProjectAs(tab: TabData): Promise<void> {
  const name = await promptSaveAs(tab.document.getProjectName() || 'Untitled Diagram');
  if (name === null) return;
  const tabManager = ServiceRegistry.getTabManager();
  if (tabManager) tabManager.renameActiveProject(name);
  else tab.document.setProjectName(name);
  tab.saveLoadController.saveProjectToDisk();
}

export const fileCommands: readonly Command[] = [
  {
    id: 'new',
    label: 'New',
    // Like draw.io: a new, empty diagram in its own tab (the current one stays as it is)
    run: () => void ServiceRegistry.getTabManager()?.openNewTab(),
  },
  { id: 'open', label: 'Open…', run: (ctx) => ctx.tab && openProject(ctx.tab) },
  {
    id: 'save',
    label: 'Save',
    shortcut: { mod: true, key: 'S' },
    // Works from anywhere, including while typing in a field
    keys: [{ phase: 'capture', guard: 'always', match: (e) => isMod(e) && keyOf(e) === 's' }],
    help: [{ section: 'File', order: 10, description: 'Save (download the .drawio file, or save back to GitLab/SharePoint)' }],
    // A tab bound to a remote file saves back there (DiagramDocument save handler), else downloads
    run: (ctx) => ctx.tab?.saveLoadController.saveProject(),
  },
  { id: 'saveAs', label: 'Save As…', run: (ctx) => ctx.tab && void saveProjectAs(ctx.tab) },
  { id: 'export', label: 'Download .drawio', run: (ctx) => void ctx.tab?.saveLoadController.save() },
  { id: 'exportPng', label: 'PNG Image…', run: (ctx) => void ctx.tab?.exportImageController.exportToPNG() },
  { id: 'exportSvg', label: 'SVG Image…', run: (ctx) => void ctx.tab?.exportImageController.exportToSVG() },
  { id: 'importDrawio', label: 'draw.io File (New Tab)…', run: () => importDrawioFile() },
  {
    id: 'importImage',
    label: 'Image as Custom Shape…',
    // src/ui/image-upload.ts: Upload Custom Shape Image dialog (also the toolbar's image button)
    run: (ctx) => ctx.tab?.imageUploadController.openUploadDialog(),
  },
  {
    id: 'saveAsTemplate',
    label: 'Save as Template…',
    // main-editor.ts asks for a name and stores the selection (or the whole diagram)
    run: () => emit('save-template-request'),
  },
  { id: 'print', label: 'Print', run: () => window.print() },
];
