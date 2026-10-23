/**
 * @file railml-ui.ts
 * @brief railML dialogs and actions (lazy chunk, loaded by install-railml.ts on first use):
 *        File > Export railML 3.2… (checks + non-blocking summary, then download) and
 *        File > Import railML… / File > Open / drop (new tab, warnings dialog).
 */
import { zoomRailwayDrawing } from '../ui/railway-zoom';
import './railml.css';
import type { TabManager } from '../ui/tabs';
import { downloadBlob } from '../railway/install-railway-data';
import { fileBaseName } from '../railway/report';
import { loadErtmsLibraryEntries } from '../ui/drawio-palette/ertms-source';
import type { LibraryEntry } from '../drawio-shapes/engine';
import { getKind } from '../railway/catalogue';
import type { RailmlNotifier } from './install-railml';
import type { RailmlExportResult } from './export';
import { exportRailml } from './export';
import { importRailml } from './import';
import { checkRailmlStructure } from './structure';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

interface DialogParts {
  overlay: HTMLDivElement;
  dialog: HTMLDivElement;
  content: HTMLDivElement;
  actions: HTMLDivElement;
  close: () => void;
}

/** A modal dialog like the route tables dialog (Esc / backdrop / Close). */
function openDialog(title: string, testId: string, onClose?: () => void): DialogParts {
  document.querySelector('.rd-railml-overlay')?.remove();
  const overlay = el('div', 'rd-route-dialog-overlay rd-railml-overlay');
  const dialog = el('div', 'rd-route-dialog rd-railml-dialog');
  dialog.dataset.testid = testId;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', title);
  const content = el('div', 'rd-route-dialog-content');
  const actions = el('div', 'rd-route-dialog-actions');
  dialog.append(el('h3', 'rd-route-dialog-title', title), content, actions);
  overlay.append(dialog);
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
    e.stopPropagation();
  };
  function close(): void {
    window.removeEventListener('keydown', onKey, true);
    overlay.remove();
    onClose?.();
  }
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  window.addEventListener('keydown', onKey, true);
  document.body.append(overlay);
  return { overlay, dialog, content, actions, close };
}

function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', `rd-route-btn ${className}`, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

function list(className: string, items: string[], max = 50): HTMLUListElement {
  const ul = el('ul', `rd-railml-list ${className}`);
  for (const t of items.slice(0, max)) ul.append(el('li', undefined, t));
  if (items.length > max) ul.append(el('li', 'rd-railml-more', `… and ${items.length - max} more`));
  return ul;
}

// ---------------------------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------------------------

/** Summary lines of an export (for the dialog and tests). */
export function exportSummary(r: RailmlExportResult): string[] {
  const c = r.counts;
  // "1 track", "2 tracks"; "points" is the same in both
  const n = (k: string, one: string, many = `${one}s`): string => {
    const count = c[k] ?? 0;
    return `${count} ${count === 1 ? one : many}`;
  };
  return [
    `${n('netElement', 'netElement')}, ${n('netRelation', 'netRelation')}`,
    `${n('track', 'track')}, ${n('switchIS', 'points', 'points')}, ${n('signalIS', 'signal')}, ${n('balise', 'balise')} in ${n('baliseGroup', 'balise group')}`,
    `${n('trainDetectionElement', 'detection point')}, ${n('tvdSection', 'TVD section')}, ${n('bufferStop', 'buffer stop')}, ${n('levelCrossingIS', 'level crossing')}`,
    `${n('route', 'route')}, ${n('overlap', 'overlap')}, ${n('radioBlockCentre', 'RBC')}`,
  ];
}

export function exportActiveTab(tabManager: TabManager, notify: RailmlNotifier): void {
  const tab = tabManager.getActiveTab();
  if (!tab) return;
  const title = tab.document.getProjectName() || tab.name;
  let extension = true;
  const run = (): RailmlExportResult => exportRailml(tab.graph.getDataModel(), { title, extension });
  let result = run();
  const parts = openDialog('Export railML 3.2', 'railml-export-dialog');
  const render = (): void => {
    const r = result;
    const errors = r.issues.filter((i) => i.severity === 'error').length;
    const warnings = r.issues.length - errors;
    const structure = checkRailmlStructure(r.doc);
    const body: HTMLElement[] = [];
    body.push(el('p', 'rd-railml-lead', `${title}: railML 3.2 (topology, functional infrastructure, interlocking routes, visualization of the layout).`));
    body.push(list('rd-railml-counts', exportSummary(r)));
    const checks = el('p', errors > 0 ? 'rd-railml-warn' : 'rd-railml-ok', `Railway checks: ${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}${errors + warnings > 0 ? ' (see the Checks panel)' : ''}.`);
    checks.dataset.testid = 'railml-checks';
    body.push(checks);
    if (r.unplaced.length > 0) {
      body.push(el('h4', 'rd-railml-h', `Not placed on the topology (${r.unplaced.length})`));
      body.push(list('rd-railml-unplaced', r.unplaced.map((p) => p.message)));
    }
    if (r.extensionOnly.length > 0) {
      body.push(el('h4', 'rd-railml-h', `No railML 3.2 element (${r.extensionOnly.length})`));
      body.push(list('rd-railml-extonly', r.extensionOnly.map((p) => p.message)));
    }
    if (r.preserved.restored > 0 || r.preserved.dropped > 0) {
      body.push(el('p', undefined, `Kept from the imported railML file: ${r.preserved.restored} item${r.preserved.restored === 1 ? '' : 's'}${r.preserved.dropped > 0 ? ` (${r.preserved.dropped} dropped: their objects were deleted)` : ''}.`));
    }
    if (structure.length > 0) {
      body.push(el('h4', 'rd-railml-h', 'Structure problems'));
      body.push(list('rd-railml-structure', structure));
    }
    const label = el('label', 'rd-railml-option');
    const box = el('input');
    box.type = 'checkbox';
    box.checked = extension;
    box.className = 'rd-railml-extension';
    box.addEventListener('change', () => {
      extension = box.checked;
      result = run();
      render();
    });
    label.append(box, document.createTextNode(' Include Railway Drawer data (rd: extension: aspects, remarks, styles, LEUs, trains) for a lossless re-import'));
    body.push(label);
    parts.content.replaceChildren(...body);
  };
  const doExport = button('Export', 'rd-railml-export-btn', () => {
    const name = `${fileBaseName(title)}.railml`;
    downloadBlob(new Blob([result.xml], { type: 'application/xml' }), name);
    parts.close();
    notify.success(`Exported ${name} (railML 3.2)`);
  });
  parts.actions.append(doExport, button('Cancel', 'rd-railml-cancel', () => parts.close()));
  render();
  doExport.focus();
}

// ---------------------------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------------------------

export function chooseAndImport(tabManager: TabManager, notify: RailmlNotifier): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.railml,.xml,application/xml,text/xml';
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    file
      .text()
      .then((text) => importIntoNewTab(tabManager, notify, text, file.name))
      .catch((error: unknown) => notify.error(`Could not read ${file.name}: ${error instanceof Error ? error.message : String(error)}`));
  });
  input.click();
}

async function librarySymbols(): Promise<LibraryEntry[] | null> {
  try {
    return await loadErtmsLibraryEntries();
  } catch {
    return null;
  }
}

/** Imports railML text into a new tab; shows the warnings. Resolves with the new tab id (null: failed). */
export async function importIntoNewTab(tabManager: TabManager, notify: RailmlNotifier, text: string, fileName: string): Promise<string | null> {
  const symbols = await librarySymbols();
  let result: ReturnType<typeof importRailml>;
  try {
    result = importRailml(text, { symbols: symbols ?? [] });
  } catch (error) {
    notify.error(`Could not import ${fileName}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
  const warnings = [...result.warnings];
  if (!symbols) warnings.unshift('The ERTMS library could not be loaded: simple shapes are used instead of the ERTMS symbols.');
  const name = result.name || fileName.replace(/\.(railml|xml)$/i, '') || 'railML';
  const tab = tabManager.createTab(name);
  try {
    tab.document.load(result.modelXml);
    tab.document.setProjectName(name);
  } catch (error) {
    tabManager.closeTab(tab.id);
    notify.error(`Could not import ${fileName}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
  tabManager.switchTab(tab.id);
  zoomRailwayDrawing(tab.graph);
  tabManager.flushCache();
  const total = Object.values(result.counts).reduce((s, n) => s + (n ?? 0), 0);
  const summary = Object.entries(result.counts)
    .map(([k, n]) => `${n} ${(n === 1 ? getKind(k)?.label : getKind(k)?.plural)?.toLowerCase() ?? k}`)
    .join(', ');
  if (warnings.length === 0) {
    notify.success(`Imported ${fileName}: ${total} object${total === 1 ? '' : 's'}`);
    return tab.id;
  }
  const parts = openDialog('railML import', 'railml-import-dialog');
  parts.content.append(
    el('p', 'rd-railml-lead', `${fileName} opened in the new tab "${name}": ${summary || 'no railway objects'}. Layout ${result.usedVisualization ? 'from the file’s visualization' : 'generated from the topology'}.`),
    el('h4', 'rd-railml-h', `Notes (${warnings.length})`),
    list('rd-railml-warnings', warnings)
  );
  const ok = button('OK', 'rd-railml-ok-btn', () => parts.close());
  parts.actions.append(ok);
  ok.focus();
  return tab.id;
}
