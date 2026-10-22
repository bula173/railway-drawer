/**
 * @file more-shapes-dialog.ts
 * @brief The draw.io library part of the "More shapes…" dialog (loaded on first open), like
 *        draw.io's MoreShapesDialog: draw.io's categories (Standard, Software, Networking, Business,
 *        Other, plus Legacy), one checkbox per library, a filter field, and a preview pane with the
 *        library's size, attribution/trademark note (ⓘ) and sample thumbnails. A checkbox shows or
 *        hides all palettes of the library in the Shapes tab right away (persisted).
 */
import './more-shapes-dialog.css';
import type { CatalogueLibrary, PaletteEntry } from '../../drawio-shapes/palettes';
import type { PaletteViewInternals } from './view-internals';

/** Sample tiles in the preview pane. */
export const PREVIEW_TILES = 24;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export interface LibrarySection {
  title: string;
  libraries: CatalogueLibrary[];
}

/**
 * draw.io's More shapes sections with the catalogue's library data; libraries draw.io does not
 * list there (legacy palettes) go to "Legacy". Libraries without own sections are dropped.
 */
export function librarySections(ctx: PaletteViewInternals): LibrarySection[] {
  const catalogue = ctx.catalogue;
  if (!catalogue) return [];
  const byId = new Map(catalogue.libraries.map((l) => [l.id, l]));
  const listed = new Set<string>();
  const usable = (id: string): boolean => byId.has(id) && ctx.libraryPalettes(id).length > 0;
  const sections: LibrarySection[] = catalogue.categories.map((cat) => ({
    title: cat.title,
    libraries: cat.libraries.filter((l) => usable(l.id)).map((l) => {
      listed.add(l.id);
      return { ...(byId.get(l.id) as CatalogueLibrary), title: l.title };
    }),
  }));
  const legacy = catalogue.libraries.filter((l) => !listed.has(l.id) && usable(l.id)).map((l) => ({
    ...l,
    title: l.title.includes('legacy') ? l.title : `${l.title} (legacy)`,
  }));
  if (legacy.length > 0) sections.push({ title: 'Legacy', libraries: legacy });
  return sections.filter((s) => s.libraries.length > 0);
}

/** Renders the library chooser into `host` (part of the More shapes dialog). */
export function renderLibraryChooser(host: HTMLElement, ctx: PaletteViewInternals): void {
  host.replaceChildren();
  const sections = librarySections(ctx);
  if (sections.length === 0) {
    host.textContent = 'No draw.io libraries available.';
    return;
  }
  const filter = el('input', 'rd-dp-lib-filter');
  filter.type = 'search';
  filter.placeholder = 'Filter libraries';
  filter.setAttribute('aria-label', 'Filter libraries');
  const columns = el('div', 'rd-dp-lib-columns');
  const listEl = el('div', 'rd-dp-lib-list');
  const preview = el('div', 'rd-dp-lib-preview');
  preview.appendChild(el('div', 'rd-dp-lib-hint', 'Select a library to see its shapes. Checked libraries appear in the Shapes tab.'));
  columns.append(listEl, preview);
  host.append(filter, columns);

  const rows: Array<{ row: HTMLElement; text: string; section: HTMLElement }> = [];
  let previewToken = 0;

  async function showPreview(lib: CatalogueLibrary): Promise<void> {
    const token = ++previewToken;
    preview.replaceChildren();
    preview.dataset.library = lib.id;
    preview.appendChild(el('div', 'rd-dp-lib-preview-title', lib.title));
    const palettes = ctx.libraryPalettes(lib.id);
    preview.appendChild(el('div', 'rd-dp-lib-preview-meta',
      `${lib.count} shapes${palettes.length > 1 ? ` in ${palettes.length} palettes` : ''}`));
    if (lib.attribution) {
      const note = el('div', 'rd-dp-lib-notice', `ⓘ ${lib.attribution}`);
      if (lib.notice) note.title = `Notice: ${lib.notice}`;
      preview.appendChild(note);
    }
    if (lib.vendorIcons) {
      preview.appendChild(el('div', 'rd-dp-lib-preview-meta', 'Vendor icons keep their colours in dark mode.'));
    }
    const grid = el('div', 'rd-dp-lib-preview-grid');
    preview.appendChild(grid);
    const entries: PaletteEntry[] = [];
    for (const id of palettes) {
      if (entries.length >= PREVIEW_TILES) break;
      const list = await ctx.loadEntries(id);
      if (token !== previewToken) return;
      entries.push(...list.slice(0, PREVIEW_TILES - entries.length));
    }
    for (const entry of entries) {
      const cell = el('div', 'rd-dp-lib-preview-thumb');
      cell.title = entry.title;
      grid.appendChild(cell);
      ctx.thumbnail(entry, 40).then((svg) => {
        if (token === previewToken) cell.replaceChildren(svg);
      }).catch(() => { cell.textContent = '?'; });
    }
  }

  for (const section of sections) {
    const sec = el('div', 'rd-dp-lib-section');
    sec.appendChild(el('div', 'rd-dp-menu-section', section.title));
    for (const lib of section.libraries) {
      // a row, not a <label>: clicking the name previews the library, only the checkbox toggles it
      const row = el('div', 'rd-dp-lib-row');
      row.dataset.libraryId = lib.id;
      row.tabIndex = -1;
      const box = el('input');
      box.type = 'checkbox';
      box.checked = ctx.isLibraryVisible(lib.id);
      box.dataset.libraryId = lib.id;
      box.setAttribute('aria-label', `Show ${lib.title} in the Shapes tab`);
      box.addEventListener('change', () => ctx.setLibraryVisible(lib.id, box.checked));
      const title = el('span', 'rd-dp-lib-title', lib.title);
      const count = el('span', 'rd-dp-lib-count', String(lib.count));
      row.append(box, title, count);
      if (lib.attribution) {
        const info = el('span', 'rd-dp-info', 'ⓘ');
        info.title = lib.attribution;
        info.setAttribute('aria-label', lib.attribution);
        row.appendChild(info);
      }
      row.addEventListener('mouseenter', () => void showPreview(lib));
      row.addEventListener('focusin', () => void showPreview(lib));
      row.addEventListener('click', () => void showPreview(lib));
      sec.appendChild(row);
      rows.push({ row, text: `${lib.title} ${lib.id} ${section.title}`.toLowerCase(), section: sec });
    }
    listEl.appendChild(sec);
  }

  filter.addEventListener('input', () => {
    const terms = filter.value.toLowerCase().split(/\s+/).filter(Boolean);
    const visibleSections = new Set<HTMLElement>();
    for (const r of rows) {
      const hit = terms.every((t) => r.text.includes(t));
      r.row.hidden = !hit;
      if (hit) visibleSections.add(r.section);
    }
    for (const sec of Array.from(listEl.children)) (sec as HTMLElement).hidden = !visibleSections.has(sec as HTMLElement);
  });
}
