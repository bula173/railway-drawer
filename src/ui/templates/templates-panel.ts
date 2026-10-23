/**
 * @file templates-panel.ts
 * @brief The left panel's Templates tab: search, built-in "ERTMS templates" and the user's
 *        "My templates" (rename, delete, import/export as a draw.io library).
 *
 * Click a tile -> popover ("Insert into diagram", "Open as new diagram", and Rename…/Delete… for
 * user templates). Enter on a focused tile opens the same popover. Dragging a tile onto the
 * canvas inserts it at the drop point (dataTransfer type TEMPLATE_DRAG_TYPE = template id).
 */
import { reportLoadFailure } from '../../core/load-failure';
import type { Graph } from '@maxgraph/core';
import './templates.css';
import { logger } from '../../drawio/logger';
import { onDrawioColorModeChange } from '../../drawio-shapes/engine/graph-compat';
import type { LibraryEntry, PaletteEntry } from '../drawio-palette/contracts';
import { getDrawioThumbnailRenderer } from '../drawio-palette/drawio-palette-view';
import { insertTemplate } from './template-actions';
import type { TemplateNotifier } from './template-actions';
import { confirmTemplateDialog, promptTemplateDetails } from './template-dialogs';
import type { TemplateStore } from './template-store';
import { templateMatches, templateToPaletteEntry } from './template-types';
import type { DiagramTemplate } from './template-types';

export const TEMPLATE_DRAG_TYPE = 'application/x-rd-template';
export const TEMPLATE_THUMB_WIDTH = 200;
export const TEMPLATE_THUMB_HEIGHT = 120;
/** Hover preview size (the whole layout, readable labels). */
export const TEMPLATE_PREVIEW_WIDTH = 480;
export const TEMPLATE_PREVIEW_HEIGHT = 300;
export const TEMPLATES_EXPORT_FILE = 'railway-drawer-templates.xml';

export interface TemplateThumbnails {
  thumbnail(entry: PaletteEntry, width: number, height: number): Promise<SVGSVGElement>;
  forget(entryId: string): void;
}

export interface TemplatesPanelOptions {
  container: HTMLElement;
  store: TemplateStore;
  /** The built-in templates (ERTMS scenarios). */
  loadBuiltIns: () => Promise<DiagramTemplate[]>;
  /** Graph that insertions go to (the active tab's). */
  getGraph: () => Graph | null;
  openAsNewDiagram: (template: DiagramTemplate) => void;
  /** "Save selection…" button (the app's Save as template… action). */
  saveAsTemplate: () => void;
  /** draw.io library parser (the engine's parseMxLibrary). */
  parseLibrary: (text: string) => LibraryEntry[];
  notify: TemplateNotifier;
  /** Element that accepts template drops (e.g. #graph-container). */
  dropTarget?: HTMLElement;
  thumbnails?: TemplateThumbnails;
}

export interface TemplatesPanel {
  readonly element: HTMLElement;
  /** Resolves when the built-in templates are listed. */
  readonly ready: Promise<void>;
  setSearch(query: string): void;
  getTemplate(id: string): DiagramTemplate | null;
  insert(template: DiagramTemplate, at?: { x: number; y: number }): void;
  handleDrop(evt: DragEvent): boolean;
  /** Re-reads the user templates. */
  refresh(): void;
  destroy(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className: string, text: string, label?: string): HTMLButtonElement {
  const b = el('button', className, text);
  b.type = 'button';
  if (label) {
    b.setAttribute('aria-label', label);
    b.title = label;
  }
  return b;
}

function downloadText(text: string, fileName: string): void {
  const blob = new Blob([text], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function createTemplatesPanel(options: TemplatesPanelOptions): TemplatesPanel {
  const { store, notify } = options;
  const thumbnails: TemplateThumbnails = options.thumbnails ?? getDrawioThumbnailRenderer();
  let builtIns: DiagramTemplate[] = [];
  let builtInState: 'loading' | 'ready' | 'error' = 'loading';
  let query = '';
  let destroyed = false;

  const root = el('div', 'rd-tpl-panel');
  const toolbar = el('div', 'rd-tpl-toolbar');
  const search = el('input', 'rd-tpl-search');
  search.type = 'search';
  search.placeholder = 'Search templates';
  search.setAttribute('aria-label', 'Search templates');
  toolbar.appendChild(search);
  const list = el('div', 'rd-tpl-list');

  const builtInSection = el('section', 'rd-tpl-section');
  builtInSection.dataset.section = 'builtin';
  const builtInHeader = el('div', 'rd-tpl-section-header');
  const builtInTitle = el('h3', 'rd-tpl-section-title', 'ERTMS templates');
  builtInHeader.appendChild(builtInTitle);
  const builtInGrid = el('div', 'rd-tpl-grid');
  builtInSection.append(builtInHeader, builtInGrid);

  const userSection = el('section', 'rd-tpl-section');
  userSection.dataset.section = 'user';
  const userHeader = el('div', 'rd-tpl-section-header');
  const userTitle = el('h3', 'rd-tpl-section-title', 'My templates');
  const userActions = el('div', 'rd-tpl-section-actions');
  const saveBtn = button('rd-tpl-btn rd-tpl-btn-small rd-tpl-save', 'Save…', 'Save selection as template…');
  const importBtn = button('rd-tpl-btn rd-tpl-btn-small rd-tpl-import', 'Import…', 'Import templates from a draw.io library');
  const exportBtn = button('rd-tpl-btn rd-tpl-btn-small rd-tpl-export', 'Export…', 'Export my templates as a draw.io library');
  const fileInput = el('input');
  fileInput.type = 'file';
  fileInput.accept = '.xml,.drawiolib,application/xml,text/xml';
  fileInput.hidden = true;
  userActions.append(saveBtn, importBtn, exportBtn, fileInput);
  userHeader.append(userTitle, userActions);
  const userGrid = el('div', 'rd-tpl-grid');
  userSection.append(userHeader, userGrid);

  list.append(userSection, builtInSection);
  root.append(toolbar, list);
  options.container.appendChild(root);

  const popover = el('div', 'rd-tpl-popover');
  popover.setAttribute('role', 'menu');
  popover.hidden = true;
  document.body.appendChild(popover);

  // ------------------------------------------------------------------ thumbnails

  const pendingThumbs = new WeakMap<HTMLElement, PaletteEntry>();
  // Rendered thumbnails, re-rendered when the colour mode (app theme) changes
  const renderedThumbs = new Map<HTMLElement, PaletteEntry>();
  const stopColorModeWatch = onDrawioColorModeChange(() => {
    if (destroyed) return;
    for (const [host, entry] of [...renderedThumbs]) {
      renderedThumbs.delete(host);
      if (!host.isConnected) continue;
      pendingThumbs.set(host, entry);
      renderThumb(host);
    }
  });
  const observer =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(
          (records) => {
            for (const record of records) {
              if (!record.isIntersecting) continue;
              observer?.unobserve(record.target);
              renderThumb(record.target as HTMLElement);
            }
          },
          { root: null, rootMargin: '200px' }
        )
      : null;

  function renderThumb(host: HTMLElement): void {
    const entry = pendingThumbs.get(host);
    if (!entry) return;
    pendingThumbs.delete(host);
    thumbnails
      .thumbnail(entry, TEMPLATE_THUMB_WIDTH, TEMPLATE_THUMB_HEIGHT)
      .then((svg) => {
        if (destroyed) return;
        host.replaceChildren(svg);
        host.classList.add('rd-tpl-thumb-ready');
        renderedThumbs.set(host, entry);
      })
      .catch((err: unknown) => {
        host.classList.add('rd-tpl-thumb-error');
        host.textContent = '?';
        logger.warn('templates', `Thumbnail failed for ${entry.id}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }

  // ------------------------------------------------------------------ actions

  function findTemplate(id: string): DiagramTemplate | null {
    return builtIns.find((t) => t.id === id) ?? store.get(id);
  }

  function doInsert(template: DiagramTemplate, at?: { x: number; y: number }): void {
    const graph = options.getGraph();
    if (!graph) return;
    try {
      insertTemplate(graph, template, at);
    } catch (err) {
      notify.error(`Could not insert "${template.name}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function doOpen(template: DiagramTemplate): void {
    try {
      options.openAsNewDiagram(template);
    } catch (err) {
      notify.error(`Could not open "${template.name}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function doRename(template: DiagramTemplate): Promise<void> {
    const details = await promptTemplateDetails({
      heading: 'Rename template',
      name: template.name,
      description: template.description ?? '',
      confirmLabel: 'Rename',
    });
    if (!details) return;
    try {
      store.rename(template.id, details.name, details.description);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function doDelete(template: DiagramTemplate): Promise<void> {
    if (!(await confirmTemplateDialog(`Delete template "${template.name}"?`))) return;
    try {
      store.remove(template.id);
      thumbnails.forget(templateToPaletteEntry(template).id);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : String(err));
    }
  }

  // ------------------------------------------------------------------ popover

  let popoverFor: HTMLElement | null = null;

  function hidePopover(): void {
    popover.hidden = true;
    popover.replaceChildren();
    popoverFor?.classList.remove('rd-tpl-tile-active');
    popoverFor = null;
  }

  /** When the popover was last opened: the scroll that brought its tile into view must not close it. */
  let popoverShownAt = 0;

  function showPopover(template: DiagramTemplate, tile: HTMLElement): void {
    popoverShownAt = performance.now();
    hidePopover();
    popoverFor = tile;
    tile.classList.add('rd-tpl-tile-active');
    const item = (text: string, action: string, run: () => void): HTMLButtonElement => {
      const b = button('rd-tpl-popover-item', text);
      b.dataset.action = action;
      b.setAttribute('role', 'menuitem');
      b.addEventListener('click', (evt) => {
        evt.stopPropagation();
        hidePopover();
        run();
      });
      return b;
    };
    popover.append(
      item('Insert into diagram', 'insert', () => doInsert(template)),
      item('Open as new diagram', 'open', () => doOpen(template))
    );
    if (!template.builtIn) {
      popover.append(
        el('div', 'rd-tpl-popover-separator'),
        item('Rename…', 'rename', () => void doRename(template)),
        item('Delete…', 'delete', () => void doDelete(template))
      );
    }
    popover.hidden = false;
    const rect = tile.getBoundingClientRect();
    const width = popover.offsetWidth || 180;
    const height = popover.offsetHeight || 80;
    const left = Math.min(Math.max(4, rect.left + 8), Math.max(4, window.innerWidth - width - 4));
    const below = rect.top + Math.min(rect.height, TEMPLATE_THUMB_HEIGHT + 8);
    const top = below + height > window.innerHeight - 4 ? Math.max(4, rect.top - height) : below;
    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
    (popover.querySelector('button') as HTMLButtonElement | null)?.focus();
  }

  const onDocMouseDown = (evt: MouseEvent): void => {
    if (popover.hidden) return;
    const target = evt.target as Node;
    if (popover.contains(target) || popoverFor?.contains(target)) return;
    hidePopover();
  };
  const onDocKeyDown = (evt: KeyboardEvent): void => {
    if (!popover.hidden && evt.key === 'Escape') {
      const tile = popoverFor;
      hidePopover();
      tile?.focus();
    }
  };
  document.addEventListener('mousedown', onDocMouseDown);
  document.addEventListener('keydown', onDocKeyDown);
  list.addEventListener('scroll', () => {
    hidePreview();
    if (performance.now() - popoverShownAt > 300) hidePopover();
  });

  // ------------------------------------------------------------------ hover preview

  const preview = el('div', 'rd-tpl-preview');
  preview.hidden = true;
  preview.setAttribute('aria-hidden', 'true');
  document.body.appendChild(preview);
  let previewTimer: ReturnType<typeof setTimeout> | null = null;
  let previewToken = 0;

  function hidePreview(): void {
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = null;
    previewToken++;
    preview.hidden = true;
    preview.replaceChildren();
  }

  function showPreview(template: DiagramTemplate, entry: PaletteEntry, tile: HTMLElement): void {
    hidePreview();
    if (!thumbnails) return;
    const token = previewToken;
    previewTimer = setTimeout(() => {
      thumbnails
        .thumbnail(entry, TEMPLATE_PREVIEW_WIDTH, TEMPLATE_PREVIEW_HEIGHT)
        .then((svg) => {
          if (token !== previewToken || destroyed || !tile.isConnected) return;
          preview.replaceChildren(svg, el('div', 'rd-tpl-preview-title', template.name));
          const r = tile.getBoundingClientRect();
          const panel = root.getBoundingClientRect();
          const left = Math.max(panel.right, r.right) + 8;
          preview.hidden = false;
          const h = preview.offsetHeight || TEMPLATE_PREVIEW_HEIGHT;
          preview.style.left = `${Math.round(Math.min(left, window.innerWidth - TEMPLATE_PREVIEW_WIDTH - 24))}px`;
          preview.style.top = `${Math.round(Math.max(8, Math.min(r.top, window.innerHeight - h - 8)))}px`;
        })
        .catch(() => undefined);
    }, 450);
  }

  // ------------------------------------------------------------------ tiles

  function createTile(template: DiagramTemplate): HTMLElement {
    const entry = templateToPaletteEntry(template);
    const tile = el('div', 'rd-tpl-tile');
    tile.dataset.templateId = template.id;
    tile.tabIndex = 0;
    tile.draggable = true;
    tile.setAttribute('role', 'button');
    tile.setAttribute('aria-haspopup', 'menu');
    tile.setAttribute('aria-label', template.name);
    tile.title = [template.name, template.description, template.originalName && template.originalName !== template.name ? `(${template.originalName})` : '']
      .filter(Boolean)
      .join('\n');

    const thumb = el('div', 'rd-tpl-thumb');
    thumb.style.width = `${TEMPLATE_THUMB_WIDTH}px`;
    thumb.style.height = `${TEMPLATE_THUMB_HEIGHT}px`;
    tile.addEventListener('mouseenter', () => showPreview(template, entry, tile));
    tile.addEventListener('mouseleave', hidePreview);
    tile.addEventListener('mousedown', hidePreview);
    pendingThumbs.set(thumb, entry);
    if (observer) observer.observe(thumb);
    else renderThumb(thumb);

    const text = el('div', 'rd-tpl-text');
    text.appendChild(el('div', 'rd-tpl-name', template.name));
    if (template.description) text.appendChild(el('div', 'rd-tpl-desc', template.description));
    tile.append(thumb, text);

    if (!template.builtIn) {
      const actions = el('div', 'rd-tpl-tile-actions');
      const rename = button('rd-tpl-icon-btn rd-tpl-rename', '✎', `Rename "${template.name}"`);
      rename.addEventListener('click', (evt) => {
        evt.stopPropagation();
        hidePopover();
        void doRename(template);
      });
      const del = button('rd-tpl-icon-btn rd-tpl-delete', '×', `Delete "${template.name}"`);
      del.addEventListener('click', (evt) => {
        evt.stopPropagation();
        hidePopover();
        void doDelete(template);
      });
      actions.append(rename, del);
      tile.appendChild(actions);
    }

    tile.addEventListener('click', () => {
      if (popoverFor === tile) hidePopover();
      else showPopover(template, tile);
    });
    tile.addEventListener('keydown', (evt) => {
      if (evt.target !== tile) return;
      if (evt.key === 'Enter' || evt.key === ' ') {
        evt.preventDefault();
        showPopover(template, tile);
      }
    });
    tile.addEventListener('dragstart', (evt) => {
      hidePopover();
      hidePreview();
      if (!evt.dataTransfer) return;
      evt.dataTransfer.effectAllowed = 'copy';
      evt.dataTransfer.setData(TEMPLATE_DRAG_TYPE, template.id);
      if (thumb.querySelector('svg') && typeof evt.dataTransfer.setDragImage === 'function') {
        evt.dataTransfer.setDragImage(thumb, TEMPLATE_THUMB_WIDTH / 2, TEMPLATE_THUMB_HEIGHT / 2);
      }
    });
    return tile;
  }

  function fillGrid(grid: HTMLElement, templates: DiagramTemplate[], emptyText: string): number {
    grid.replaceChildren();
    const shown = templates.filter((t) => templateMatches(t, query));
    for (const t of shown) grid.appendChild(createTile(t));
    if (shown.length === 0) {
      grid.appendChild(el('div', 'rd-tpl-empty', templates.length === 0 ? emptyText : 'No matching templates'));
    }
    return shown.length;
  }

  function renderUser(): void {
    const templates = store.list();
    const n = fillGrid(userGrid, templates, 'No templates yet. Select shapes and use Save as template…');
    userTitle.textContent = templates.length > 0 ? `My templates (${query ? `${n}/` : ''}${templates.length})` : 'My templates';
    exportBtn.disabled = templates.length === 0;
  }

  function renderBuiltIn(): void {
    if (builtInState === 'loading') {
      builtInGrid.replaceChildren(el('div', 'rd-tpl-empty', 'Loading…'));
      return;
    }
    if (builtInState === 'error') {
      builtInGrid.replaceChildren(el('div', 'rd-tpl-empty', 'Could not load the ERTMS templates'));
      return;
    }
    const n = fillGrid(builtInGrid, builtIns, 'No built-in templates');
    builtInTitle.textContent = `ERTMS templates (${query ? `${n}/` : ''}${builtIns.length})`;
  }

  function renderAll(): void {
    hidePopover();
    renderUser();
    renderBuiltIn();
  }

  function setSearch(q: string): void {
    query = q;
    if (search.value !== q) search.value = q;
    renderAll();
  }
  search.addEventListener('input', () => setSearch(search.value));

  const unsubscribe = store.subscribe(() => {
    if (!destroyed) {
      hidePopover();
      renderUser();
    }
  });

  // ------------------------------------------------------------------ import / export / save

  saveBtn.addEventListener('click', () => options.saveAsTemplate());
  exportBtn.addEventListener('click', () => {
    if (store.list().length === 0) return;
    downloadText(store.exportLibrary(), TEMPLATES_EXPORT_FILE);
  });
  importBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    file
      .text()
      .then((text) => {
        const added = store.importLibrary(text, options.parseLibrary, file.name.replace(/\.(xml|drawiolib)$/i, ''));
        notify.success(`Imported ${added.length} ${added.length === 1 ? 'template' : 'templates'} from "${file.name}"`);
      })
      .catch((err: unknown) => {
        notify.error(`Could not import "${file.name}": ${err instanceof Error ? err.message : String(err)}`);
      });
  });

  // ------------------------------------------------------------------ drop

  function handleDrop(evt: DragEvent): boolean {
    const id = evt.dataTransfer?.getData(TEMPLATE_DRAG_TYPE);
    if (!id) return false;
    const template = findTemplate(id);
    if (!template) return false;
    evt.preventDefault();
    evt.stopPropagation();
    const graph = options.getGraph();
    if (!graph) return false;
    const pt = graph.getPointForEvent(evt as unknown as MouseEvent, false);
    doInsert(template, { x: pt.x, y: pt.y });
    return true;
  }
  const onDragOver = (evt: DragEvent): void => {
    if (evt.dataTransfer?.types && Array.from(evt.dataTransfer.types).includes(TEMPLATE_DRAG_TYPE)) {
      evt.preventDefault();
      evt.dataTransfer.dropEffect = 'copy';
    }
  };
  const onDrop = (evt: DragEvent): void => {
    handleDrop(evt);
  };
  if (options.dropTarget) {
    options.dropTarget.addEventListener('dragover', onDragOver);
    options.dropTarget.addEventListener('drop', onDrop, true);
  }

  // ------------------------------------------------------------------ build

  renderAll();
  const ready = options
    .loadBuiltIns()
    .then((templates) => {
      builtIns = templates;
      builtInState = 'ready';
    })
    .catch((err: unknown) => {
      builtInState = 'error';
      reportLoadFailure('error', 'templates', 'ERTMS templates failed to load', err);
    })
    .then(() => {
      if (!destroyed) renderBuiltIn();
    });

  function destroy(): void {
    destroyed = true;
    hidePreview();
    preview.remove();
    stopColorModeWatch();
    renderedThumbs.clear();
    unsubscribe();
    observer?.disconnect();
    document.removeEventListener('mousedown', onDocMouseDown);
    document.removeEventListener('keydown', onDocKeyDown);
    if (options.dropTarget) {
      options.dropTarget.removeEventListener('dragover', onDragOver);
      options.dropTarget.removeEventListener('drop', onDrop, true);
    }
    popover.remove();
    root.remove();
  }

  return {
    element: root,
    ready,
    setSearch,
    getTemplate: findTemplate,
    insert: doInsert,
    handleDrop,
    refresh: renderUser,
    destroy,
  };
}
