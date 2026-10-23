/**
 * @file drawio-palette-view.ts
 * @brief draw.io-style shape sidebar for the maxGraph editor: collapsible palettes in draw.io
 *        order, search over titles and tags, "More shapes…" visibility menu, real-rendered
 *        thumbnails, hover preview, click/drag insertion and user library import.
 */
import { reportLoadFailure } from '../../core/load-failure';
import { openModal } from '../../core/modal';
import type { ModalHandle } from '../../core/modal';
import type { Cell, Graph } from '@maxgraph/core';
import './drawio-palette.css';
import { logger } from '../../drawio/logger';
import { onDrawioColorModeChange } from '../../drawio-shapes/engine/graph-compat';
import { fallbackEngine } from './contracts';
import type { PaletteDef, PaletteEngine, PaletteEntry, PaletteMeta } from './contracts';
import { entrySignature, insertEntry } from './entry-cells';
import {
  libraryToPaletteDef,
  readStoredLibraries,
  safeStorage,
  slug,
  writeStoredLibraries,
} from './library-adapter';
import type { StoredLibrary } from './library-adapter';
import { THUMB_SIZE, ThumbnailRenderer } from './thumbnail-renderer';
import { loadPalette, loadPaletteCatalogue } from '../../drawio-shapes/palettes';
import type { PaletteCatalogue } from '../../drawio-shapes/palettes';
import type { PaletteViewInternals } from './view-internals';
import { STORAGE_KEYS } from '../../core/storage-keys';

export const VISIBLE_STORAGE_KEY = STORAGE_KEYS.drawioPalettesVisible;
export const EXPANDED_STORAGE_KEY = STORAGE_KEYS.drawioPalettesExpanded;
/** dataTransfer type of a palette drag: `<paletteId>\n<entryId>`. */
export const PALETTE_DRAG_TYPE = 'application/x-rd-drawio-entry';

/** A palette whose definition is loaded on demand (e.g. `loadPalette(id)`). */
export interface LazyPaletteSource extends PaletteMeta {
  load(): Promise<PaletteDef>;
}

export type PaletteSource = PaletteDef | LazyPaletteSource;

/** Modifier keys of a palette click / Enter (click-insert.ts maps them to draw.io's directions). */
export interface PaletteClickModifiers {
  alt: boolean;
  shift: boolean;
  /** Ctrl or Cmd */
  mod: boolean;
}

function clickModifiers(evt: MouseEvent | KeyboardEvent): PaletteClickModifiers {
  return { alt: evt.altKey, shift: evt.shiftKey, mod: evt.ctrlKey || evt.metaKey };
}

export interface DrawioPaletteViewOptions {
  container: HTMLElement;
  /** The graph insertions go to (the active tab's graph); null disables insertion. */
  getGraph: () => Graph | null;
  /** Built-in palettes in draw.io order (General, Misc, Advanced, Basic, Arrows, Flowchart, ...). */
  palettes: PaletteSource[];
  /** Palettes after the built-in ones (e.g. ERTMS from `libraryToPaletteDef`). */
  extraLibraries?: PaletteSource[];
  /** Engine functions (contracts 4/5); default: the shared engine (see setDrawioPaletteEngine). */
  engine?: PaletteEngine;
  /** Element that accepts drops of palette entries (e.g. #graph-container). */
  dropTarget?: HTMLElement;
  /** Palettes expanded on first use (default: the first palette, and 'ertms'). */
  defaultExpanded?: string[];
  /** Palettes whose tiles show their title under the thumbnail (e.g. ['ertms']). */
  captionPalettes?: string[];
  /**
   * Placement of a click insert (no drop point): centre point and an optional cell to connect the
   * new vertex to (one undoable edit with the insert). Default: the view centre.
   */
  clickPlacement?: (
    graph: Graph,
    entry: PaletteEntry,
    modifiers: PaletteClickModifiers
  ) => { at: { x: number; y: number }; connectFrom?: Cell } | null;
  /** Called after an insertion (e.g. to focus the graph). */
  onInsert?: (entry: PaletteEntry) => void;
  /**
   * Changes the new top-level cells of an entry before they are added (same undoable edit),
   * e.g. pre-assigns railway object kinds to ERTMS library entries.
   */
  prepareInsert?: (graph: Graph, cells: Cell[], entry: PaletteEntry) => void;
  /** User-visible error reporting (default: logger + alert-free status line). */
  onError?: (message: string) => void;
  /**
   * Extra show/hide toggles listed in the "More shapes…" menu after the draw.io palettes
   * (e.g. the app's own shape groups), so one menu controls every library in the Shapes tab.
   */
  extraMenuItems?: PaletteMenuItem[];
  /** Load stored user libraries and show "Import library…" (default true). */
  userLibraries?: boolean;
  /** Show the "More shapes…" menu (default true). */
  showMoreMenu?: boolean;
  /**
   * Suffix for the localStorage keys of the visible/expanded flags, so a second view (e.g. the
   * ERTMS-only tab) keeps its own state. Default: the shared keys.
   */
  storageKeySuffix?: string;
  /**
   * Adds every other draw.io library (the generated catalogue, loaded lazily) as hidden sections
   * that "More shapes…" turns on, and searches them all. Default: when the More shapes menu is shown.
   */
  catalogue?: boolean;
  /** Catalogue palettes another section already shows (e.g. 'basic', merged into General). */
  skipCataloguePalettes?: string[];
}

export interface PaletteMenuItem {
  id: string;
  title: string;
  isChecked(): boolean;
  setChecked(checked: boolean): void;
}

export interface DrawioPaletteView {
  readonly element: HTMLElement;
  /** Resolves when every visible palette has been loaded and rendered. */
  readonly ready: Promise<void>;
  setSearch(query: string): void;
  isPaletteVisible(id: string): boolean;
  setPaletteVisible(id: string, visible: boolean): void;
  setExpanded(id: string, expanded: boolean): void;
  /** Adds a user library from `<mxlibrary>` text, persists it and returns its palette id. */
  importLibraryText(text: string, title: string): string;
  removeLibrary(id: string): void;
  /** Resolves once the draw.io catalogue sections exist (immediately without a catalogue). */
  readonly catalogueReady: Promise<void>;
  /** Resolves when the latest search over all draw.io libraries has rendered. */
  readonly globalSearchDone: Promise<void>;
  /** Shows or hides every palette of a draw.io library ("More shapes" entry), e.g. 'aws4'. */
  setLibraryVisible(libraryId: string, visible: boolean): void;
  isLibraryVisible(libraryId: string): boolean;
  /** Opens the More shapes dialog. */
  openMoreShapes(): void;
  /** Creates an empty user library and returns its palette id. */
  createLibrary(title: string): string;
  /** Renames a user library. */
  renameLibrary(id: string, title: string): void;
  /** Adds the graph's selection to a user library; false when nothing is selected. */
  addSelectionToLibrary(id: string): Promise<boolean>;
  /** Adds a palette entry (e.g. dragged from another section) to a user library. */
  addEntryToLibrary(id: string, entry: PaletteEntry): Promise<void>;
  /** The `<mxlibrary>` text of a user library (what Export saves). */
  getLibraryText(id: string): string | null;
  /** Downloads a user library as a draw.io library file. */
  exportLibrary(id: string): void;
  /** Fetches a draw.io library from a URL and adds it; resolves its palette id (null on error). */
  openLibraryUrl(url: string): Promise<string | null>;
  /** Inserts an entry into the current graph (default: at the view centre). */
  insert(entry: PaletteEntry, at?: { x: number; y: number }): void;
  /** Drop handler for `dropTarget`-like elements; returns true when it inserted an entry. */
  handleDrop(evt: DragEvent): boolean;
  getEntry(paletteId: string, entryId: string): PaletteEntry | null;
  destroy(): void;
}

// ---------------------------------------------------------------------------------------------
// Shared engine and renderer (one hidden graph per page)
// ---------------------------------------------------------------------------------------------

let sharedEngine: PaletteEngine = fallbackEngine;
let sharedRenderer: ThumbnailRenderer | null = null;

/** Sets the engine used by the palette UI and `renderEntryForParity`. */
export function setDrawioPaletteEngine(engine: PaletteEngine): void {
  sharedEngine = engine;
  sharedRenderer?.setEngine(engine);
}

export function getDrawioPaletteEngine(): PaletteEngine {
  return sharedEngine;
}

function getRenderer(): ThumbnailRenderer {
  if (!sharedRenderer) sharedRenderer = new ThumbnailRenderer(sharedEngine);
  return sharedRenderer;
}

/** The shared thumbnail renderer (one hidden graph per page), e.g. for the Templates tab. */
export function getDrawioThumbnailRenderer(): ThumbnailRenderer {
  return getRenderer();
}

/** Image exports: renders an entry at a fixed scale with the palette's hidden graph. */
export function renderEntryForParity(
  entry: PaletteEntry,
  scale: number,
  opts: { exportLayout?: boolean; border?: number; light?: boolean } = {},
): Promise<SVGSVGElement> {
  const light = opts.light ? { light: true } : {};
  return getRenderer().render(
    entry,
    opts.exportLayout ? { exportScale: scale, border: opts.border ?? 0, ...light } : { scale, border: opts.border ?? 0, ...light },
  );
}

/** Test helper: drops the shared renderer and its hidden graph. */
export function resetDrawioPaletteRenderer(): void {
  sharedRenderer?.destroy();
  sharedRenderer = null;
}

// ---------------------------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------------------------

function readFlags(key: string): Record<string, boolean> {
  const storage = safeStorage();
  if (!storage) return {};
  try {
    const parsed: unknown = JSON.parse(storage.getItem(key) ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'boolean') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function writeFlags(key: string, flags: Record<string, boolean>): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(flags));
  } catch {
    // storage full or blocked: the setting lasts for this page only
  }
}

function isLazy(source: PaletteSource): source is LazyPaletteSource {
  return typeof (source as LazyPaletteSource).load === 'function';
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ---------------------------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------------------------

interface Category {
  id: string;
  title: string;
  defaultVisible: boolean;
  removable: boolean;
  source: PaletteSource;
  def: PaletteDef | null;
  loading: Promise<void> | null;
  root: HTMLElement;
  header: HTMLButtonElement;
  body: HTMLElement;
  items: Array<{ entry: PaletteEntry; node: HTMLElement; text: string }>;
  /** draw.io library of a catalogue section. */
  library?: string;
  catalogue?: boolean;
}

export function createDrawioPaletteView(options: DrawioPaletteViewOptions): DrawioPaletteView {
  if (options.engine) setDrawioPaletteEngine(options.engine);
  const engine = (): PaletteEngine => sharedEngine;
  const renderer = getRenderer();
  const reportError =
    options.onError ??
    ((message: string) => {
      logger.error('drawio-palette', message);
      status.textContent = message;
      status.hidden = false;
    });

  const visibleKey = VISIBLE_STORAGE_KEY + (options.storageKeySuffix ?? '');
  const expandedKey = EXPANDED_STORAGE_KEY + (options.storageKeySuffix ?? '');
  const userLibraries = options.userLibraries ?? true;
  const useCatalogue = options.catalogue ?? options.showMoreMenu !== false;
  const visibleFlags = readFlags(visibleKey);
  const expandedFlags = readFlags(expandedKey);
  const firstId = options.palettes[0]?.id;
  const defaultExpanded = new Set(options.defaultExpanded ?? [firstId, 'ertms'].filter((x): x is string => !!x));
  const captioned = new Set(options.captionPalettes ?? []);

  const root = el('div', 'rd-drawio-palette');
  const toolbar = el('div', 'rd-dp-toolbar');
  const search = el('input', 'rd-dp-search');
  search.type = 'search';
  search.placeholder = 'Search shapes';
  search.setAttribute('aria-label', 'Search shapes');
  toolbar.appendChild(search);
  const list = el('div', 'rd-dp-list');
  const status = el('div', 'rd-dp-status');
  status.hidden = true;
  const footer = el('div', 'rd-dp-footer');
  const moreBtn = el('button', 'rd-dp-more', 'More shapes…');
  moreBtn.type = 'button';
  const importBtn = el('button', 'rd-dp-import', '＋ Add library');
  importBtn.title = 'Add a draw.io library: import a .xml file, open one from a URL or start an empty one';
  importBtn.type = 'button';
  const fileInput = el('input');
  fileInput.type = 'file';
  fileInput.accept = '.xml,.drawiolib,application/xml,text/xml';
  fileInput.hidden = true;
  footer.append(moreBtn, importBtn, fileInput);
  moreBtn.hidden = options.showMoreMenu === false;
  importBtn.hidden = !userLibraries;
  footer.hidden = moreBtn.hidden && importBtn.hidden;
  // "More shapes…": a modal (core/modal.ts) on its own backdrop, placed in the palette root while open
  const menuBackdrop = el('div', 'rd-dp-menu-backdrop');
  const menu = el('div', 'rd-dp-menu');
  menu.hidden = true;
  menu.tabIndex = -1;
  menuBackdrop.appendChild(menu);
  const preview = el('div', 'rd-dp-preview');
  preview.hidden = true;
  root.append(toolbar, status, list, footer);
  document.body.appendChild(preview);
  options.container.appendChild(root);

  const categories: Category[] = [];
  const byId = new Map<string, Category>();
  let query = '';
  let destroyed = false;

  // Thumbnails are rendered when their tile scrolls into view
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

  function renderThumb(host: HTMLElement): void {
    const entry = pendingThumbs.get(host);
    if (!entry) return;
    pendingThumbs.delete(host);
    renderer
      .thumbnail(entry, THUMB_SIZE)
      .then((svg) => {
        if (destroyed) return;
        host.replaceChildren(svg);
        host.classList.add('rd-dp-thumb-ready');
        renderedThumbs.set(host, entry);
      })
      .catch((err: unknown) => {
        host.classList.add('rd-dp-thumb-error');
        host.textContent = '?';
        logger.warn('drawio-palette', `Thumbnail failed for ${entry.id}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }

  function isVisible(cat: Category): boolean {
    return visibleFlags[cat.id] ?? cat.defaultVisible;
  }

  function isExpanded(cat: Category): boolean {
    return expandedFlags[cat.id] ?? defaultExpanded.has(cat.id);
  }

  // ------------------------------------------------------------------ insertion

  function doInsert(entry: PaletteEntry, at?: { x: number; y: number }, mods?: PaletteClickModifiers): void {
    const graph = options.getGraph();
    if (!graph) return;
    try {
      const prepare = options.prepareInsert;
      const prep = prepare ? (cells: Cell[]) => prepare(graph, cells, entry) : undefined;
      // A click (no drop point): placement next to the selection / on a track / free spot
      const placed = !at && mods !== undefined ? options.clickPlacement?.(graph, entry, mods) ?? null : null;
      let inserted: Cell[] = [];
      const model = graph.getDataModel();
      model.beginUpdate();
      try {
        inserted = insertEntry(graph, entry, placed?.at ?? at, prep, !placed);
        const source = placed?.connectFrom;
        const target = inserted[0];
        if (source && target && inserted.length === 1 && target.isVertex()) {
          graph.insertEdge(graph.getDefaultParent(), null, '', source, target);
        }
      } finally {
        model.endUpdate();
      }
      if (inserted.length === 0) return;
      graph.setSelectionCells(inserted);
      // Stencils the thumbnails have not loaded yet: repaint once they arrive
      engine()
        .ensureStencilsForXml(entry.xml ?? [entry.style ?? ''])
        .then(() => {
          if (!destroyed) graph.refresh();
        })
        .catch(() => undefined);
      options.onInsert?.(entry);
    } catch (err) {
      reportError(`Could not insert "${entry.title}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function getEntry(paletteId: string, entryId: string): PaletteEntry | null {
    const cat = byId.get(paletteId);
    return cat?.def?.entries.find((e) => e.id === entryId) ?? null;
  }

  function handleDrop(evt: DragEvent): boolean {
    const data = evt.dataTransfer?.getData(PALETTE_DRAG_TYPE);
    if (!data) return false;
    const [paletteId, entryId] = data.split('\n');
    const entry = getEntry(paletteId, entryId ?? '');
    if (!entry) return false;
    evt.preventDefault();
    evt.stopPropagation();
    const graph = options.getGraph();
    if (!graph) return false;
    // graph coordinates of the drop point (no grid offset; insertEntry snaps the top-left)
    const pt = graph.getPointForEvent(evt as unknown as MouseEvent, false);
    doInsert(entry, { x: pt.x, y: pt.y });
    return true;
  }

  const onDragOver = (evt: DragEvent): void => {
    if (evt.dataTransfer?.types && Array.from(evt.dataTransfer.types).includes(PALETTE_DRAG_TYPE)) {
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

  // ------------------------------------------------------------------ hover preview

  let previewTimer: ReturnType<typeof setTimeout> | null = null;
  let previewToken = 0;

  function hidePreview(): void {
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = null;
    previewToken++;
    preview.hidden = true;
    preview.replaceChildren();
  }

  function showPreview(entry: PaletteEntry, anchor: HTMLElement): void {
    hidePreview();
    const token = previewToken;
    previewTimer = setTimeout(() => {
      renderer
        .render(entry, { width: 200, height: 200, maxScale: 1, border: 4 })
        .then((svg) => {
          if (token !== previewToken || destroyed) return;
          const title = el('div', 'rd-dp-preview-title', entry.title);
          preview.replaceChildren(svg, title);
          const rect = anchor.getBoundingClientRect();
          const rootRect = root.getBoundingClientRect();
          preview.style.left = `${Math.round(Math.max(rootRect.right, rect.right) + 8)}px`;
          preview.style.top = `${Math.round(Math.max(8, rect.top))}px`;
          preview.hidden = false;
        })
        .catch(() => undefined);
    }, 400);
  }

  // ------------------------------------------------------------------ categories

  function createItem(cat: Category, entry: PaletteEntry): HTMLElement {
    const item = el('div', 'rd-dp-item');
    item.tabIndex = 0;
    item.draggable = true;
    item.dataset.entryId = entry.id;
    item.dataset.kind = entry.kind;
    item.title = entry.title;
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', entry.title || entry.id);
    const thumb = el('div', 'rd-dp-thumb');
    thumb.style.width = `${THUMB_SIZE}px`;
    thumb.style.height = `${THUMB_SIZE}px`;
    item.appendChild(thumb);
    if (captioned.has(cat.id) && entry.title) item.appendChild(el('span', 'rd-dp-caption', entry.caption ?? entry.title));
    pendingThumbs.set(thumb, entry);
    if (observer) observer.observe(thumb);
    else renderThumb(thumb);

    item.addEventListener('click', (evt) => {
      hidePreview();
      doInsert(entry, undefined, clickModifiers(evt));
    });
    item.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter' || evt.key === ' ') {
        evt.preventDefault();
        doInsert(entry, undefined, clickModifiers(evt));
      }
    });
    item.addEventListener('dragstart', (evt) => {
      hidePreview();
      if (!evt.dataTransfer) return;
      evt.dataTransfer.effectAllowed = 'copy';
      evt.dataTransfer.setData(PALETTE_DRAG_TYPE, `${cat.id}\n${entry.id}`);
      if (thumb.querySelector('svg') && typeof evt.dataTransfer.setDragImage === 'function') {
        evt.dataTransfer.setDragImage(thumb, THUMB_SIZE / 2, THUMB_SIZE / 2);
      }
    });
    item.addEventListener('mouseenter', () => showPreview(entry, item));
    item.addEventListener('mouseleave', hidePreview);
    return item;
  }

  function fillCategory(cat: Category): void {
    if (!cat.def) return;
    cat.body.replaceChildren();
    cat.items = cat.def.entries.map((entry) => {
      const node = createItem(cat, entry);
      cat.body.appendChild(node);
      return { entry, node, text: `${entry.title} ${entry.tags ?? ''}`.toLowerCase() };
    });
    if (cat.items.length === 0) cat.body.appendChild(el('div', 'rd-dp-empty', 'No shapes'));
  }

  function loadCategory(cat: Category): Promise<void> {
    if (cat.def) return Promise.resolve();
    if (cat.loading) return cat.loading;
    const source = cat.source;
    cat.body.replaceChildren(el('div', 'rd-dp-empty', 'Loading…'));
    cat.loading = (isLazy(source) ? source.load() : Promise.resolve(source))
      .then((def) => {
        if (destroyed) return;
        cat.def = def;
        fillCategory(cat);
        applyFilter();
      })
      .catch((err: unknown) => {
        cat.loading = null;
        cat.body.replaceChildren(el('div', 'rd-dp-empty', 'Could not load this palette'));
        reportLoadFailure('error', 'drawio-palette', `Palette ${cat.id} failed to load`, err);
      });
    return cat.loading;
  }

  function addCategory(source: PaletteSource, removable: boolean, before?: Node): Category {
    const meta = source as Partial<PaletteMeta> & { id: string; title: string };
    const catRoot = el('section', 'rd-dp-category');
    if (captioned.has(meta.id)) catRoot.classList.add('rd-dp-captioned');
    catRoot.dataset.paletteId = meta.id;
    const header = el('button', 'rd-dp-header');
    header.type = 'button';
    const label = el('span', 'rd-dp-header-title', meta.title);
    header.appendChild(label);
    const body = el('div', 'rd-dp-body');
    catRoot.append(header, body);
    const cat: Category = {
      id: meta.id,
      title: meta.title,
      defaultVisible: meta.defaultVisible ?? true,
      removable,
      source,
      def: isLazy(source) ? null : source,
      loading: null,
      root: catRoot,
      header,
      body,
      items: [],
    };
    if (removable) {
      const tools: Array<[string, string, string, () => void]> = [
        ['rd-dp-lib-add', '＋', `Add the selected shapes to "${meta.title}"`, () => void addSelectionToLibrary(cat.id)],
        ['rd-dp-lib-rename', '✎', `Rename library "${meta.title}"`, () => renameLibraryInteractive(cat.id)],
        ['rd-dp-lib-export', '⤓', `Export library "${meta.title}" (draw.io .xml)`, () => exportLibrary(cat.id)],
      ];
      for (const [cls, glyph, tip, run] of tools) {
        const b = el('span', `rd-dp-lib-tool ${cls}`, glyph);
        b.setAttribute('role', 'button');
        b.title = tip;
        b.setAttribute('aria-label', tip);
        b.addEventListener('click', (evt) => {
          evt.stopPropagation();
          run();
        });
        header.appendChild(b);
      }
      installLibraryDropTarget(catRoot, meta.id);
      const remove = el('span', 'rd-dp-remove', '×');
      remove.setAttribute('role', 'button');
      remove.title = `Remove library "${meta.title}"`;
      remove.addEventListener('click', (evt) => {
        evt.stopPropagation();
        removeLibrary(cat.id);
      });
      header.appendChild(remove);
    }
    header.addEventListener('click', () => setExpanded(cat.id, !catRoot.classList.contains('rd-dp-expanded')));
    catRoot.classList.toggle('rd-dp-expanded', isExpanded(cat));
    header.setAttribute('aria-expanded', String(isExpanded(cat)));
    if (before) list.insertBefore(catRoot, before);
    else list.appendChild(catRoot);
    categories.push(cat);
    byId.set(cat.id, cat);
    if (cat.def) fillCategory(cat);
    return cat;
  }

  function setExpanded(id: string, expanded: boolean): void {
    const cat = byId.get(id);
    if (!cat) return;
    cat.root.classList.toggle('rd-dp-expanded', expanded);
    cat.header.setAttribute('aria-expanded', String(expanded));
    expandedFlags[id] = expanded;
    writeFlags(expandedKey, expandedFlags);
    if (expanded) void loadCategory(cat);
  }

  // ------------------------------------------------------------------ search and visibility

  function applyFilter(): void {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    root.classList.toggle('rd-dp-searching', terms.length > 0);
    // Search lists a shape once: an entry with the same cells as an earlier match is hidden
    const matched = new Set<string>();
    for (const cat of categories) {
      const visible = isVisible(cat);
      if (!visible) {
        cat.root.hidden = true;
        continue;
      }
      if (terms.length === 0) {
        cat.root.hidden = false;
        for (const item of cat.items) item.node.hidden = false;
        continue;
      }
      let matches = 0;
      for (const item of cat.items) {
        let hit = terms.every((t) => item.text.includes(t));
        if (hit) {
          const sig = entrySignature(item.entry);
          if (matched.has(sig)) hit = false;
          else matched.add(sig);
        }
        item.node.hidden = !hit;
        if (hit) matches++;
      }
      cat.root.hidden = matches === 0;
    }
  }

  function setSearch(q: string): void {
    query = q;
    if (search.value !== q) search.value = q;
    if (q.trim()) {
      // search covers every visible palette: load the ones not opened yet
      for (const cat of categories) if (isVisible(cat)) void loadCategory(cat);
    }
    applyFilter();
    scheduleGlobalSearch();
  }

  // ------------------------------------------------------------------ search over all draw.io libraries

  const searchResults = el('div', 'rd-dp-search-results');
  searchResults.hidden = true;
  let globalSearchTimer: ReturnType<typeof setTimeout> | null = null;
  let globalSearchToken = 0;
  /** Resolves when the latest global search finished rendering (tests). */
  let globalSearchDone: Promise<void> = Promise.resolve();

  function scheduleGlobalSearch(): void {
    if (globalSearchTimer) clearTimeout(globalSearchTimer);
    const token = ++globalSearchToken;
    if (!useCatalogue || !query.trim()) {
      searchResults.hidden = true;
      searchResults.replaceChildren();
      globalSearchDone = Promise.resolve();
      return;
    }
    globalSearchDone = new Promise<void>((resolve) => {
      globalSearchTimer = setTimeout(() => {
        globalSearchTimer = null;
        Promise.all([import('./global-search'), ensureCatalogue()])
          .then(([m]) => (token === globalSearchToken && !destroyed ? m.renderGlobalSearch(searchResults, query, internals(), () => token === globalSearchToken) : undefined))
          .catch((err: unknown) => reportLoadFailure('warn', 'drawio-palette', 'Library search failed', err))
          .finally(resolve);
      }, 150);
    });
  }

  search.addEventListener('input', () => setSearch(search.value));

  function setPaletteVisible(id: string, visible: boolean): void {
    const cat = byId.get(id);
    if (!cat) return;
    visibleFlags[id] = visible;
    writeFlags(visibleKey, visibleFlags);
    if (visible && (isExpanded(cat) || query.trim())) void loadCategory(cat);
    applyFilter();
    syncMenu();
  }

  function syncMenu(): void {
    menu.replaceChildren();
    const head = el('div', 'rd-dp-menu-head');
    head.appendChild(el('span', 'rd-dp-menu-title', 'More shapes'));
    const close = el('button', 'rd-dp-menu-close', '×');
    close.type = 'button';
    close.title = 'Close';
    close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', () => closeMoreShapes());
    head.appendChild(close);
    menu.appendChild(head);
    menu.appendChild(el('div', 'rd-dp-menu-section', 'In the Shapes tab'));
    for (const cat of categories) {
      if (cat.catalogue) continue;
      const row = el('label', 'rd-dp-menu-row');
      const box = el('input');
      box.type = 'checkbox';
      box.checked = isVisible(cat);
      box.dataset.paletteId = cat.id;
      box.addEventListener('change', () => setPaletteVisible(cat.id, box.checked));
      row.append(box, document.createTextNode(` ${cat.title}`));
      menu.appendChild(row);
    }
    const extra = options.extraMenuItems ?? [];
    if (extra.length > 0) menu.appendChild(el('div', 'rd-dp-menu-separator'));
    for (const item of extra) {
      const row = el('label', 'rd-dp-menu-row');
      const box = el('input');
      box.type = 'checkbox';
      box.checked = item.isChecked();
      box.dataset.menuItemId = item.id;
      box.addEventListener('change', () => item.setChecked(box.checked));
      row.append(box, document.createTextNode(` ${item.title}`));
      menu.appendChild(row);
    }
    if (useCatalogue) {
      const host = el('div', 'rd-dp-libraries');
      host.textContent = 'Loading the draw.io libraries…';
      menu.appendChild(host);
      Promise.all([import('./more-shapes-dialog'), ensureCatalogue()])
        .then(([m]) => {
          if (!destroyed && host.isConnected) m.renderLibraryChooser(host, internals());
        })
        .catch((err: unknown) => {
          host.textContent = 'The draw.io libraries could not be loaded.';
          logger.warn('drawio-palette', 'More shapes failed', { error: err instanceof Error ? err.message : String(err) });
        });
    }
  }

  // The modal primitive gives it role=dialog + aria-modal, the focus trap, Esc (before the shortcut
  // dispatcher, so the canvas selection stays), a press on the backdrop = close, and the focus
  // back to where it was (the More shapes button)
  let menuModal: ModalHandle | null = null;
  function openMoreShapes(): void {
    syncMenu();
    if (menuModal && !menuModal.closed) return;
    menu.hidden = false;
    const modal = openModal({ overlay: menuBackdrop, dialog: menu, label: 'More shapes', testId: 'more-shapes-dialog', container: root });
    menuModal = modal;
    modal.onClose(() => {
      menu.hidden = true;
      if (menuModal === modal) menuModal = null;
      if (document.activeElement === document.body && moreBtn.isConnected) moreBtn.focus();
    });
    menu.focus({ preventScroll: true });
  }

  function closeMoreShapes(): void {
    menuModal?.close();
  }

  moreBtn.addEventListener('click', (evt) => {
    evt.stopPropagation();
    if (menuModal && !menuModal.closed) closeMoreShapes();
    else openMoreShapes();
  });

  // ------------------------------------------------------------------ user libraries

  let stored: StoredLibrary[] = userLibraries ? readStoredLibraries() : [];

  function addLibraryCategory(lib: StoredLibrary): void {
    const entries = engine().parseMxLibrary(lib.text);
    const def = libraryToPaletteDef(entries, { id: lib.id, title: lib.title, source: lib.title });
    const cat = addCategory({ ...def, defaultVisible: true } as PaletteDef & PaletteMeta, true);
    setExpandedSilently(cat, isExpanded(cat) || !(lib.id in expandedFlags));
  }

  function setExpandedSilently(cat: Category, expanded: boolean): void {
    cat.root.classList.toggle('rd-dp-expanded', expanded);
    cat.header.setAttribute('aria-expanded', String(expanded));
  }

  function importLibraryText(text: string, title: string): string {
    const cleanTitle = title.replace(/\.(xml|drawiolib)$/i, '').trim() || 'Library';
    // Parse first: an invalid file is rejected before anything is stored
    engine().parseMxLibrary(text);
    let id = `lib-${slug(cleanTitle)}`;
    for (let n = 2; byId.has(id); n++) id = `lib-${slug(cleanTitle)}-${n}`;
    const lib: StoredLibrary = { id, title: cleanTitle, text };
    addLibraryCategory(lib);
    stored = [...stored, lib];
    if (!writeStoredLibraries(stored)) {
      reportError(`Library "${cleanTitle}" was added but could not be saved (browser storage full or blocked)`);
    }
    applyFilter();
    syncMenu();
    return id;
  }

  function removeLibrary(id: string): void {
    const cat = byId.get(id);
    if (!cat || !cat.removable) return;
    cat.root.remove();
    categories.splice(categories.indexOf(cat), 1);
    byId.delete(id);
    stored = stored.filter((lib) => lib.id !== id);
    writeStoredLibraries(stored);
    delete visibleFlags[id];
    delete expandedFlags[id];
    writeFlags(visibleKey, visibleFlags);
    writeFlags(expandedKey, expandedFlags);
    syncMenu();
  }

  type LibraryActions = typeof import('./user-library-actions');
  function withLibraryActions<T>(run: (m: LibraryActions) => T | Promise<T>): Promise<T | undefined> {
    return import('./user-library-actions')
      .then(run)
      .catch((err: unknown) => {
        reportError(`Library action failed: ${err instanceof Error ? err.message : String(err)}`);
        return undefined;
      });
  }

  /** Replaces a user library's title and/or text, re-renders its section and persists it. */
  function updateLibrary(id: string, patch: { title?: string; text?: string }): void {
    const lib = stored.find((l) => l.id === id);
    const cat = byId.get(id);
    if (!lib || !cat) return;
    const next: StoredLibrary = { ...lib, ...patch };
    if (patch.text !== undefined) {
      cat.def = libraryToPaletteDef(engine().parseMxLibrary(next.text), { id, title: next.title, source: next.title });
      fillCategory(cat);
    }
    if (patch.title !== undefined) {
      cat.title = next.title;
      const label = cat.header.querySelector('.rd-dp-header-title');
      if (label) label.textContent = next.title;
    }
    stored = stored.map((l) => (l.id === id ? next : l));
    if (!writeStoredLibraries(stored)) {
      reportError(`Library "${next.title}" was changed but could not be saved (browser storage full or blocked)`);
    }
    applyFilter();
  }

  function createLibrary(title: string): string {
    return importLibraryText('<mxlibrary>[]</mxlibrary>', title);
  }

  function renameLibrary(id: string, title: string): void {
    const clean = title.trim();
    if (clean) updateLibrary(id, { title: clean });
  }

  function renameLibraryInteractive(id: string): void {
    const lib = stored.find((l) => l.id === id);
    if (!lib) return;
    void withLibraryActions((m) => m.promptText('Rename library', 'Library name', lib.title)).then((title) => {
      if (title) renameLibrary(id, title);
    });
  }

  function getLibraryText(id: string): string | null {
    return stored.find((l) => l.id === id)?.text ?? null;
  }

  function exportLibrary(id: string): void {
    const lib = stored.find((l) => l.id === id);
    if (!lib) return;
    void withLibraryActions((m) => m.downloadLibrary(lib.title, lib.text));
  }

  async function addSelectionToLibrary(id: string): Promise<boolean> {
    const graph = options.getGraph();
    const lib = stored.find((l) => l.id === id);
    if (!graph || !lib) return false;
    if (graph.getSelectionCount() === 0) {
      reportError('Select the shapes to add to the library first (or drag them onto it).');
      return false;
    }
    const added = await withLibraryActions((m) => {
      const item = m.selectionToLibraryItem(graph);
      if (!item) return false;
      updateLibrary(id, { text: m.appendToLibrary(lib.text, [item]) });
      return true;
    });
    if (added) setExpanded(id, true);
    return added === true;
  }

  async function addEntryToLibrary(id: string, entry: PaletteEntry): Promise<void> {
    const lib = stored.find((l) => l.id === id);
    if (!lib) return;
    await withLibraryActions((m) => updateLibrary(id, { text: m.appendToLibrary(lib.text, [m.paletteEntryToLibraryItem(entry)]) }));
    setExpanded(id, true);
  }

  function openLibraryUrl(url: string): Promise<string | null> {
    return withLibraryActions((m) => m.openLibraryFromUrl(url, { getGraph: options.getGraph, importLibraryText, reportError })).then((r) => r ?? null);
  }

  /**
   * A user library section accepts: palette tiles dragged from other sections (HTML drag and drop)
   * and shapes dragged from the canvas (a maxGraph move gesture released over the section).
   */
  function installLibraryDropTarget(section: HTMLElement, id: string): void {
    section.addEventListener('dragover', (evt) => {
      if (evt.dataTransfer?.types && Array.from(evt.dataTransfer.types).includes(PALETTE_DRAG_TYPE)) {
        evt.preventDefault();
        evt.dataTransfer.dropEffect = 'copy';
        section.classList.add('rd-dp-drop-hover');
      }
    });
    section.addEventListener('dragleave', () => section.classList.remove('rd-dp-drop-hover'));
    section.addEventListener('drop', (evt) => {
      section.classList.remove('rd-dp-drop-hover');
      const data = evt.dataTransfer?.getData(PALETTE_DRAG_TYPE);
      if (!data) return;
      evt.preventDefault();
      evt.stopPropagation();
      const [paletteId, entryId] = data.split('\n');
      if (paletteId === id) return;
      const entry = getEntry(paletteId, entryId ?? '');
      if (entry) void addEntryToLibrary(id, entry);
    });
    const onRelease = (): void => {
      const graph = options.getGraph();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = graph ? (graph.getPlugin('SelectionHandler') as any) : null;
      if (!graph || !handler || handler.first == null || graph.getSelectionCount() === 0) return;
      // cancel the move on the canvas: the cells are copied into the library instead
      handler.reset();
      void addSelectionToLibrary(id);
    };
    section.addEventListener('pointerup', onRelease);
    section.addEventListener('mouseup', onRelease);
  }

  importBtn.addEventListener('click', () => {
    void withLibraryActions((m) => {
      m.showAddLibraryMenu(importBtn, {
        importFile: () => fileInput.click(),
        openUrl: () => {
          void m.promptText('Open library from URL', 'Library URL (draw.io .xml)', '', 'https://…/library.xml').then((url) => {
            if (url) void openLibraryUrl(url);
          });
        },
        create: () => {
          void m.promptText('New library', 'Library name', 'My shapes').then((title) => {
            if (title) createLibrary(title);
          });
        },
      });
    });
  });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    file
      .text()
      .then((text) => importLibraryText(text, file.name))
      .catch((err: unknown) => {
        reportError(`Could not import "${file.name}": ${err instanceof Error ? err.message : String(err)}`);
      });
  });

  // ------------------------------------------------------------------ build

  for (const source of options.palettes) addCategory(source, false);
  for (const source of options.extraLibraries ?? []) addCategory(source, false);
  // draw.io's other libraries go here (after the built-in sections, before the user libraries)
  const catalogueAnchor = document.createComment('draw.io libraries');
  list.appendChild(catalogueAnchor);
  for (const lib of stored) {
    try {
      addLibraryCategory(lib);
    } catch (err) {
      logger.warn('drawio-palette', `Stored library "${lib.title}" could not be parsed`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  list.appendChild(searchResults);

  const ready = Promise.all(
    categories.filter((cat) => isVisible(cat)).map((cat) => loadCategory(cat))
  ).then(() => undefined);

  // ------------------------------------------------------------------ draw.io catalogue (lazy)

  let catalogue: PaletteCatalogue | null = null;
  const skipCatalogue = new Set(options.skipCataloguePalettes ?? []);

  function addCataloguePalettes(c: PaletteCatalogue): void {
    if (destroyed) return;
    catalogue = c;
    const libs = new Map(c.libraries.map((l) => [l.id, l]));
    for (const p of c.palettes) {
      if (byId.has(p.id) || skipCatalogue.has(p.id)) continue;
      const cat = addCategory({ id: p.id, title: p.title, defaultVisible: false, load: () => loadPalette(p.id) }, false, catalogueAnchor);
      cat.catalogue = true;
      cat.library = p.library;
      cat.root.classList.add('rd-dp-catalogue');
      cat.root.dataset.library = p.library;
      const info = libs.get(p.library)?.attribution;
      if (info) {
        const badge = el('span', 'rd-dp-info', 'ⓘ');
        badge.title = info;
        badge.setAttribute('aria-label', info);
        cat.header.appendChild(badge);
      }
      if (isVisible(cat) && (isExpanded(cat) || query.trim())) void loadCategory(cat);
    }
    applyFilter();
  }

  // The catalogue (~120 kB) is fetched only when needed: More shapes, a search, or a stored choice
  // that shows a draw.io library; first paint never waits for it.
  let cataloguePromise: Promise<void> | null = null;
  function ensureCatalogue(): Promise<void> {
    if (!useCatalogue) return Promise.resolve();
    if (!cataloguePromise) {
      cataloguePromise = loadPaletteCatalogue()
        .then(addCataloguePalettes)
        .catch((err: unknown) => {
          cataloguePromise = null;
          reportLoadFailure('warn', 'drawio-palette', 'draw.io library catalogue failed to load', err);
        });
    }
    return cataloguePromise;
  }
  if (Object.entries(visibleFlags).some(([id, shown]) => shown && !byId.has(id))) void ensureCatalogue();

  applyFilter();
  syncMenu();

  function libraryCategories(libraryId: string): Category[] {
    return categories.filter((cat) => cat.catalogue && cat.library === libraryId);
  }

  function setLibraryVisible(libraryId: string, visible: boolean): void {
    if (useCatalogue && !catalogue) {
      void ensureCatalogue().then(() => {
        if (catalogue) setLibraryVisible(libraryId, visible);
      });
      return;
    }
    const cats = libraryCategories(libraryId);
    for (const cat of cats) {
      visibleFlags[cat.id] = visible;
      if (visible && (isExpanded(cat) || query.trim())) void loadCategory(cat);
    }
    // a newly shown library opens its first palette
    if (visible && cats.length > 0 && !cats.some((c) => isExpanded(c))) setExpanded(cats[0].id, true);
    writeFlags(visibleKey, visibleFlags);
    applyFilter();
    scheduleGlobalSearch();
  }

  function isLibraryVisible(libraryId: string): boolean {
    return libraryCategories(libraryId).some((cat) => isVisible(cat));
  }

  function internals(): PaletteViewInternals {
    return {
      catalogue,
      isLibraryVisible,
      setLibraryVisible,
      libraryPalettes: (libraryId) => libraryCategories(libraryId).map((c) => c.id),
      isPaletteVisible: (id) => {
        const cat = byId.get(id);
        return cat ? isVisible(cat) : false;
      },
      loadEntries: async (paletteId) => {
        const cat = byId.get(paletteId);
        if (!cat) return [];
        await loadCategory(cat);
        return cat.def?.entries ?? [];
      },
      createTile: (paletteId, entry) => {
        const cat = byId.get(paletteId);
        return cat ? createItem(cat, entry) : null;
      },
      thumbnail: (entry, size) => renderer.thumbnail(entry, size),
      shownSignatures: () => {
        const out = new Set<string>();
        for (const cat of categories) {
          if (!isVisible(cat)) continue;
          for (const item of cat.items) if (!item.node.hidden) out.add(entrySignature(item.entry));
        }
        return out;
      },
      revealPalette: (paletteId) => {
        const cat = byId.get(paletteId);
        if (!cat) return;
        if (cat.library) setLibraryVisible(cat.library, true);
        setExpanded(paletteId, true);
        cat.root.scrollIntoView?.({ block: 'start' });
      },
    };
  }

  function destroy(): void {
    destroyed = true;
    stopColorModeWatch();
    renderedThumbs.clear();
    hidePreview();
    observer?.disconnect();
    closeMoreShapes();
    if (options.dropTarget) {
      options.dropTarget.removeEventListener('dragover', onDragOver);
      options.dropTarget.removeEventListener('drop', onDrop, true);
    }
    preview.remove();
    root.remove();
  }

  return {
    element: root,
    ready,
    get catalogueReady() {
      return ensureCatalogue();
    },
    get globalSearchDone() {
      return globalSearchDone;
    },
    setLibraryVisible,
    isLibraryVisible,
    openMoreShapes,
    createLibrary,
    renameLibrary,
    addSelectionToLibrary,
    addEntryToLibrary,
    getLibraryText,
    exportLibrary,
    openLibraryUrl,
    setSearch,
    isPaletteVisible: (id) => {
      const cat = byId.get(id);
      return cat ? isVisible(cat) : false;
    },
    setPaletteVisible,
    setExpanded,
    importLibraryText,
    removeLibrary,
    insert: doInsert,
    handleDrop,
    getEntry,
    destroy,
  };
}
