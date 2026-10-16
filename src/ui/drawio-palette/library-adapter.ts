/**
 * @file library-adapter.ts
 * @brief Adapts parsed draw.io libraries (`<mxlibrary>`) to palette definitions, and keeps the
 *        user-imported libraries in localStorage (`rd.drawioLibraries`).
 */
import type { LibraryEntry, PaletteDef, PaletteEntry } from './contracts';

export const LIBRARIES_STORAGE_KEY = 'rd.drawioLibraries';

export interface LibraryMeta {
  id: string;
  title: string;
  /** Extra search tags added to every entry (e.g. 'ertms etcs'). */
  tags?: string;
  /** PaletteDef.source; defaults to 'mxlibrary'. */
  source?: string;
}

/** Lowercase ASCII slug for entry ids. */
export function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'item'
  );
}

/** Every `shape=` value inside a model XML or style string (stencil(...) included). */
export function extractShapeNames(text: string): string[] {
  const names = new Set<string>();
  const re = /(?:^|[;"\s])shape=([^;"&<>\s]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) names.add(m[1]);
  return [...names];
}

/** draw.io stores image data URIs in styles without ';base64' (';' ends a style value). */
function imageStyleValue(data: string): string {
  return data.startsWith('data:') ? data.replace(';base64,', ',') : data;
}

/**
 * Palette definition for parsed library entries: `xml` entries become composite (`cells`)
 * tiles, `data` entries image vertices (as draw.io's Sidebar.addLibraryEntries).
 */
export function libraryToPaletteDef(entries: LibraryEntry[], meta: LibraryMeta): PaletteDef {
  const source = meta.source ?? 'mxlibrary';
  const paletteEntries: PaletteEntry[] = [];
  entries.forEach((item, index) => {
    const title = item.title ?? '';
    const tags = [meta.tags, item.tags, title].filter((t): t is string => !!t && t.trim() !== '').join(' ');
    const base = {
      id: `${meta.id}-${index}-${slug(title)}`,
      title,
      width: item.w,
      height: item.h,
      cls: 'a' as const,
      source: `${source}#${index}`,
      ...(tags ? { tags } : {}),
    };
    if (item.xml) {
      paletteEntries.push({ ...base, kind: 'cells', xml: item.xml, shapeNames: extractShapeNames(item.xml) });
    } else if (item.data) {
      const aspect = item.aspect === 'variable' ? '' : 'aspect=fixed;';
      paletteEntries.push({
        ...base,
        kind: 'vertex',
        style: `shape=image;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=0;${aspect}image=${imageStyleValue(item.data)};`,
        shapeNames: ['image'],
      });
    }
  });
  return { id: meta.id, title: meta.title, drawioTag: '', source, entries: paletteEntries };
}

/** A user library as persisted: the raw file text, re-parsed on boot. */
export interface StoredLibrary {
  id: string;
  title: string;
  text: string;
}

export function readStoredLibraries(storage: Storage | null = safeStorage()): StoredLibrary[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(LIBRARIES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (lib): lib is StoredLibrary =>
        typeof lib === 'object' &&
        lib !== null &&
        typeof (lib as StoredLibrary).id === 'string' &&
        typeof (lib as StoredLibrary).title === 'string' &&
        typeof (lib as StoredLibrary).text === 'string'
    );
  } catch {
    return [];
  }
}

/** Returns false when the write failed (storage full or blocked). */
export function writeStoredLibraries(libs: StoredLibrary[], storage: Storage | null = safeStorage()): boolean {
  if (!storage) return false;
  try {
    if (libs.length === 0) storage.removeItem(LIBRARIES_STORAGE_KEY);
    else storage.setItem(LIBRARIES_STORAGE_KEY, JSON.stringify(libs));
    return true;
  } catch {
    return false;
  }
}

export function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
