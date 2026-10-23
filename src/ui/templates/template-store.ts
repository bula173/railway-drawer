/**
 * @file template-store.ts
 * @brief User templates ("Save as template…") persisted in localStorage `railway-drawer-templates`.
 *
 * Stored as versioned JSON: `{ "version": 1, "templates": [{ id, name, description?, xml, width,
 * height, created, updated }] }`. `xml` is a native draw.io `<mxGraphModel>` (styles verbatim).
 * - A bare array (unversioned) is read as version 1.
 * - A newer version is left untouched: the store is read-only and every write throws, so an
 *   older app never overwrites templates it cannot read.
 * - A failed write (quota exceeded, storage blocked) rolls the change back and throws a
 *   TemplateStorageError (`quota` set for quota errors); the UI shows it as a notification.
 *
 * Templates are exchanged as draw.io libraries (`<mxlibrary>`), so they also open in draw.io's
 * sidebar (File > Open Library): `exportLibrary` / `importLibrary`.
 */
import type { LibraryEntry } from '../drawio-palette/contracts';
import { safeStorage } from '../drawio-palette/library-adapter';
import type { DiagramTemplate } from './template-types';
import { STORAGE_KEYS } from '../../core/storage-keys';

export const TEMPLATES_STORAGE_KEY = STORAGE_KEYS.templates;
export const TEMPLATES_STORAGE_VERSION = 1;
export const MAX_TEMPLATE_NAME = 80;
export const MAX_TEMPLATE_DESCRIPTION = 200;

export class TemplateStorageError extends Error {
  constructor(
    message: string,
    /** True when the browser storage is full. */
    readonly quota: boolean
  ) {
    super(message);
    this.name = 'TemplateStorageError';
  }
}

export interface NewTemplate {
  name: string;
  description?: string;
  xml: string;
  width: number;
  height: number;
}

interface StoredTemplate {
  id: string;
  name: string;
  description?: string;
  xml: string;
  width: number;
  height: number;
  created: number;
  updated: number;
}

interface StoredFile {
  version: number;
  templates: StoredTemplate[];
}

function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; code?: number };
  return (
    e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014
  );
}

function finite(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function toStored(raw: unknown): StoredTemplate | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.name !== 'string' || typeof r.xml !== 'string') return null;
  const now = Date.now();
  return {
    id: r.id,
    name: r.name,
    ...(typeof r.description === 'string' && r.description ? { description: r.description } : {}),
    xml: r.xml,
    width: finite(r.width, 80),
    height: finite(r.height, 80),
    created: typeof r.created === 'number' ? r.created : now,
    updated: typeof r.updated === 'number' ? r.updated : now,
  };
}

function toTemplate(t: StoredTemplate): DiagramTemplate {
  return { ...t, builtIn: false };
}

/** Normalized name: trimmed, inner whitespace collapsed, length-limited. Throws when empty. */
export function normalizeTemplateName(name: string): string {
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, MAX_TEMPLATE_NAME);
  if (!clean) throw new Error('The template name must not be empty');
  return clean;
}

function normalizeDescription(text: string | undefined): string | undefined {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEMPLATE_DESCRIPTION);
  return clean || undefined;
}

function newId(): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `tpl-${Date.now().toString(36)}-${rnd}`;
}

/** Escapes text content for an XML element (the JSON body of `<mxlibrary>`). */
function escapeXmlText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeXmlAttr(text: string): string {
  return escapeXmlText(text).replace(/"/g, '&quot;');
}

/** draw.io stores image data URIs in styles without ';base64' (';' ends a style value). */
function imageEntryXml(entry: LibraryEntry): string {
  const data = (entry.data ?? '').startsWith('data:') ? entry.data!.replace(';base64,', ',') : (entry.data ?? '');
  const aspect = entry.aspect === 'variable' ? '' : 'aspect=fixed;';
  const style = `shape=image;verticalLabelPosition=bottom;verticalAlign=top;imageAspect=0;${aspect}image=${data};`;
  return (
    '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
    `<mxCell id="2" value="" style="${escapeXmlAttr(style)}" vertex="1" parent="1">` +
    `<mxGeometry width="${entry.w}" height="${entry.h}" as="geometry"/></mxCell></root></mxGraphModel>`
  );
}

export class TemplateStore {
  private templates: StoredTemplate[] = [];
  private listeners = new Set<() => void>();
  /** Set when the stored data could not be used (newer version, corrupt JSON). */
  readonly loadWarning: string | null = null;
  private readOnly = false;

  constructor(private readonly storage: Storage | null = safeStorage()) {
    const raw = this.readRaw();
    if (raw === null) return;
    try {
      const parsed: unknown = JSON.parse(raw);
      let list: unknown[] | null = null;
      if (Array.isArray(parsed)) {
        list = parsed;
      } else if (parsed && typeof parsed === 'object') {
        const file = parsed as Partial<StoredFile>;
        const version = typeof file.version === 'number' ? file.version : 0;
        if (version > TEMPLATES_STORAGE_VERSION) {
          this.readOnly = true;
          this.loadWarning = `Templates were saved by a newer version of Railway Drawer (format ${version}) and are not shown.`;
          return;
        }
        list = Array.isArray(file.templates) ? file.templates : [];
      }
      if (!list) throw new Error('not a template list');
      this.templates = list.map(toStored).filter((t): t is StoredTemplate => t !== null);
    } catch {
      // Unreadable data is kept until the next successful save overwrites it
      this.loadWarning = 'Saved templates could not be read.';
    }
  }

  private readRaw(): string | null {
    try {
      return this.storage?.getItem(TEMPLATES_STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }

  /** Writes `next`; on failure the in-memory list stays as it was and this throws. */
  private commit(next: StoredTemplate[]): void {
    if (this.readOnly) {
      throw new TemplateStorageError(this.loadWarning ?? 'Templates are read-only', false);
    }
    if (!this.storage) throw new TemplateStorageError('Browser storage is not available: templates cannot be saved', false);
    const file: StoredFile = { version: TEMPLATES_STORAGE_VERSION, templates: next };
    try {
      this.storage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(file));
    } catch (err) {
      const quota = isQuotaError(err);
      throw new TemplateStorageError(
        quota
          ? 'Browser storage is full: the template was not saved. Delete or export templates, or save the diagram to disk.'
          : `Templates could not be saved: ${err instanceof Error ? err.message : String(err)}`,
        quota
      );
    }
    this.templates = next;
    this.listeners.forEach((fn) => fn());
  }

  /** Called after every successful change. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  list(): DiagramTemplate[] {
    return this.templates.map(toTemplate);
  }

  get(id: string): DiagramTemplate | null {
    const t = this.templates.find((x) => x.id === id);
    return t ? toTemplate(t) : null;
  }

  add(input: NewTemplate): DiagramTemplate {
    const now = Date.now();
    const description = normalizeDescription(input.description);
    const t: StoredTemplate = {
      id: newId(),
      name: normalizeTemplateName(input.name),
      ...(description ? { description } : {}),
      xml: input.xml,
      width: finite(input.width, 80),
      height: finite(input.height, 80),
      created: now,
      updated: now,
    };
    this.commit([...this.templates, t]);
    return toTemplate(t);
  }

  /** Renames a template; `description` undefined keeps the current one, '' clears it. */
  rename(id: string, name: string, description?: string): DiagramTemplate {
    const current = this.templates.find((x) => x.id === id);
    if (!current) throw new Error(`Template ${id} not found`);
    const next: StoredTemplate = { ...current, name: normalizeTemplateName(name), updated: Date.now() };
    if (description !== undefined) {
      const d = normalizeDescription(description);
      if (d) next.description = d;
      else delete next.description;
    }
    this.commit(this.templates.map((x) => (x.id === id ? next : x)));
    return toTemplate(next);
  }

  remove(id: string): void {
    if (!this.templates.some((x) => x.id === id)) return;
    this.commit(this.templates.filter((x) => x.id !== id));
  }

  /**
   * draw.io library (`<mxlibrary>`) with the given templates (default all): JSON entries
   * `{ xml, w, h, title }` (plus `description`, which draw.io ignores), uncompressed XML.
   */
  exportLibrary(ids?: string[]): string {
    const wanted = ids ? new Set(ids) : null;
    const entries = this.templates
      .filter((t) => !wanted || wanted.has(t.id))
      .map((t) => ({
        xml: t.xml,
        w: t.width,
        h: t.height,
        aspect: 'fixed',
        title: t.name,
        ...(t.description ? { description: t.description } : {}),
      }));
    return `<mxlibrary>${escapeXmlText(JSON.stringify(entries))}</mxlibrary>`;
  }

  /**
   * Adds every entry of a draw.io library as a template (`parse` = the engine's parseMxLibrary,
   * which also decompresses draw.io's deflated entries). Image entries become image cells.
   * All or nothing: a failed write adds none.
   */
  importLibrary(text: string, parse: (text: string) => LibraryEntry[], fallbackName = 'Imported template'): DiagramTemplate[] {
    const entries = parse(text);
    const descriptions = readDescriptions(text);
    const now = Date.now();
    const added: StoredTemplate[] = [];
    entries.forEach((entry, i) => {
      const xml = entry.xml ?? (entry.data ? imageEntryXml(entry) : null);
      if (!xml) return;
      let name: string;
      try {
        name = normalizeTemplateName(entry.title ?? '');
      } catch {
        name = `${fallbackName} ${i + 1}`;
      }
      const description = normalizeDescription(descriptions[i]);
      added.push({
        id: newId() + i,
        name,
        ...(description ? { description } : {}),
        xml,
        width: finite(entry.w, 80),
        height: finite(entry.h, 80),
        created: now,
        updated: now,
      });
    });
    if (added.length === 0) throw new Error('The library contains no shapes');
    this.commit([...this.templates, ...added]);
    return added.map(toTemplate);
  }
}

/** `description` keys of a library's JSON entries (draw.io's parser drops unknown keys). */
function readDescriptions(text: string): Array<string | undefined> {
  try {
    const trimmed = text.trim();
    let json = trimmed;
    if (!trimmed.startsWith('[')) {
      const doc = new DOMParser().parseFromString(trimmed, 'application/xml');
      json = doc.documentElement?.textContent ?? '[]';
    }
    const raw: unknown = JSON.parse(json);
    if (!Array.isArray(raw)) return [];
    return raw.map((item) =>
      item && typeof item === 'object' && typeof (item as { description?: unknown }).description === 'string'
        ? (item as { description: string }).description
        : undefined
    );
  } catch {
    return [];
  }
}
