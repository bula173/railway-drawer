/**
 * @file user-library-actions.ts
 * @brief User libraries (draw.io `<mxlibrary>` files) as first-class Shapes-tab sections, loaded on
 *        first use: "＋ Add library" (import a file, open from a URL, new empty library), add the
 *        selection or a dragged palette shape to a library, rename and export. Libraries stay
 *        native draw.io libraries: entries are `{xml, w, h, title, aspect}` with uncompressed
 *        `<mxGraphModel>` XML, which draw.io's sidebar opens as is.
 */
import type { Graph } from '@maxgraph/core';
import { readLibraryJson } from '../../drawio-shapes/engine/mxlibrary';
import { extractTemplate } from '../templates/template-extract';
import type { PaletteEntry } from './contracts';

/** One raw `<mxlibrary>` item (draw.io's format). */
export type LibraryItem = Record<string, unknown>;

export interface UserLibraryHost {
  getGraph(): Graph | null;
  importLibraryText(text: string, title: string): string;
  reportError(message: string): void;
}

function escapeXml(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '&#xa;');
}

/** `<mxlibrary>` text for the given items: the JSON body, XML-escaped (well-formed, draw.io reads it). */
export function serializeLibrary(items: LibraryItem[]): string {
  const body = JSON.stringify(items).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<mxlibrary>${body}</mxlibrary>`;
}

/** The raw items of a library text (`<mxlibrary>` or bare JSON array). */
export function libraryItems(text: string): LibraryItem[] {
  const raw = readLibraryJson(text);
  if (!Array.isArray(raw)) throw new Error('Library body must be a JSON array');
  return raw.filter((x): x is LibraryItem => typeof x === 'object' && x !== null);
}

/** Library text with `items` appended (existing items are kept byte-for-byte in JSON form). */
export function appendToLibrary(text: string, items: LibraryItem[]): string {
  return serializeLibrary([...libraryItems(text), ...items]);
}

/** Library text with the item at `index` removed. */
export function removeFromLibrary(text: string, index: number): string {
  const items = libraryItems(text);
  items.splice(index, 1);
  return serializeLibrary(items);
}

/** An empty draw.io library. */
export function emptyLibrary(): string {
  return serializeLibrary([]);
}

/** Library item for the current selection of `graph` (the whole diagram when nothing is selected). */
export function selectionToLibraryItem(graph: Graph, title = ''): LibraryItem | null {
  const t = extractTemplate(graph);
  if (!t || t.cellCount === 0) return null;
  return { xml: t.xml, w: Math.round(t.width), h: Math.round(t.height), aspect: 'fixed', title };
}

/** Library item for a palette entry (draw.io's own representation of a dragged sidebar item). */
export function paletteEntryToLibraryItem(entry: PaletteEntry): LibraryItem {
  let xml = entry.xml;
  if (!xml) {
    const value = escapeXml(entry.value ?? '');
    const style = escapeXml(entry.style ?? '');
    const cell = entry.kind === 'edge'
      ? `<mxCell id="2" value="${value}" style="${style}" edge="1" parent="1"><mxGeometry width="${entry.width}" height="${entry.height}" relative="1" as="geometry"><mxPoint y="${entry.height}" as="sourcePoint"/><mxPoint x="${entry.width}" as="targetPoint"/></mxGeometry></mxCell>`
      : `<mxCell id="2" value="${value}" style="${style}" vertex="1" parent="1"><mxGeometry width="${entry.width}" height="${entry.height}" as="geometry"/></mxCell>`;
    xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cell}</root></mxGraphModel>`;
  }
  return { xml, w: entry.width, h: entry.height, aspect: 'fixed', title: entry.title };
}

/** Saves `text` as `<title>.xml` (a draw.io library file). */
export function downloadLibrary(title: string, text: string): void {
  const blob = new Blob([text], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[\\/:*?"<>|]+/g, '_') || 'library'}.xml`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** File name of a library URL without extension ("Library" when there is none). */
export function titleFromUrl(url: string): string {
  try {
    const name = decodeURIComponent(new URL(url, location.href).pathname.split('/').pop() ?? '');
    return name.replace(/\.(xml|drawiolib)$/i, '') || 'Library';
  } catch {
    return 'Library';
  }
}

/** Small modal text prompt (Enter = OK, Escape = cancel). Resolves null when cancelled. */
export function promptText(title: string, label: string, initial = '', placeholder = ''): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'rd-dp-prompt-overlay';
    const box = document.createElement('div');
    box.className = 'rd-dp-prompt';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', title);
    const head = document.createElement('div');
    head.className = 'rd-dp-prompt-title';
    head.textContent = title;
    const lab = document.createElement('label');
    lab.textContent = label;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = initial;
    input.placeholder = placeholder;
    lab.appendChild(input);
    const buttons = document.createElement('div');
    buttons.className = 'rd-dp-prompt-buttons';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'rd-dp-prompt-ok';
    ok.textContent = 'OK';
    buttons.append(cancel, ok);
    box.append(head, lab, buttons);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    const done = (value: string | null): void => {
      window.removeEventListener('keydown', onKey, true);
      overlay.remove();
      resolve(value);
    };
    // capture phase: keep keys away from the editor's shortcut dispatcher while the prompt is open
    const onKey = (evt: KeyboardEvent): void => {
      if (evt.key === 'Escape') { evt.preventDefault(); evt.stopPropagation(); done(null); }
      else if (evt.key === 'Enter') { evt.preventDefault(); evt.stopPropagation(); done(input.value.trim() || null); }
      else evt.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    cancel.addEventListener('click', () => done(null));
    ok.addEventListener('click', () => done(input.value.trim() || null));
    overlay.addEventListener('mousedown', (evt) => { if (evt.target === overlay) done(null); });
    input.focus();
    input.select();
  });
}

/** Fetches a library from a URL and adds it (errors are reported). */
export async function openLibraryFromUrl(url: string, host: UserLibraryHost): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return host.importLibraryText(text, titleFromUrl(url));
  } catch (err) {
    host.reportError(`Could not open the library at ${url}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/** The "＋ Add library" menu: import file / open URL / new library. */
export function showAddLibraryMenu(
  anchor: HTMLElement,
  actions: { importFile(): void; openUrl(): void; create(): void },
): HTMLElement {
  document.querySelectorAll('.rd-dp-add-menu').forEach((m) => m.remove());
  const menu = document.createElement('div');
  menu.className = 'rd-dp-add-menu';
  menu.setAttribute('role', 'menu');
  const item = (label: string, action: string, run: () => void): void => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'menuitem');
    b.dataset.action = action;
    b.textContent = label;
    b.addEventListener('click', () => { close(); run(); });
    menu.appendChild(b);
  };
  item('Import library file (.xml)…', 'import', actions.importFile);
  item('Open library from URL…', 'url', actions.openUrl);
  item('New empty library…', 'new', actions.create);
  const rect = anchor.getBoundingClientRect();
  menu.style.left = `${Math.round(rect.left)}px`;
  menu.style.bottom = `${Math.round(window.innerHeight - rect.top + 4)}px`;
  document.body.appendChild(menu);
  const onDown = (evt: MouseEvent): void => {
    if (!menu.contains(evt.target as Node) && evt.target !== anchor) close();
  };
  const close = (): void => {
    document.removeEventListener('mousedown', onDown, true);
    menu.remove();
  };
  document.addEventListener('mousedown', onDown, true);
  (menu.firstElementChild as HTMLElement | null)?.focus();
  return menu;
}
