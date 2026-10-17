/**
 * @file xml.ts
 * @brief railML 3.2 namespaces, id helpers and small DOM helpers shared by the railML export,
 *        import, preservation and structure checks. Pure DOM (DOMParser/XMLSerializer), so every
 *        railML module runs in jsdom.
 */

/** railML 3.2 namespace (default namespace of every railML element). */
export const RAILML_NS = 'https://www.railml.org/schemas/3.2';
export const RAILML_VERSION = '3.2';
export const RAILML_SCHEMA_LOCATION = 'https://www.railml.org/schemas/3.2 https://www.railml.org/schemas/3.2/railml3.xsd';
export const DC_NS = 'http://purl.org/dc/elements/1.1/';
export const GML_NS = 'http://www.opengis.net/gml/3.2';
export const XSI_NS = 'http://www.w3.org/2001/XMLSchema-instance';
export const XMLNS_NS = 'http://www.w3.org/2000/xmlns/';
/**
 * Railway Drawer extension namespace (prefix `rd`): data of the drawing that railML 3.2 cannot
 * express (aspects, remarks, cell styles, LEUs, trains, ...) and the preserved unknown railML.
 */
export const RD_NS = 'https://railwaydrawer.mksystemdesign.org/railml/rd/1';
/** `designator@register` holding our object IDs (`rdId`). */
export const RD_REGISTER = '_RailwayDrawer';
/** The one linear positioning system (km, in metres) of an export. */
export const LPS_ID = 'lps01';

/** A valid NCName (xs:ID) from any text: `S 1/a` -> `S_1_a`, `12` -> `_12`. */
export function ncName(raw: string): string {
  let s = raw
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_.-]/g, '_');
  if (s === '') s = '_';
  if (!/^[A-Za-z_]/.test(s)) s = `_${s}`;
  return s;
}

export function isNcName(s: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(s);
}

/** Hands out unique ids (`base`, `base_2`, ...). */
export class IdAllocator {
  private readonly used = new Set<string>();

  has(id: string): boolean {
    return this.used.has(id);
  }

  /** Reserves `id` exactly; false when taken or not an NCName. */
  claim(id: string): boolean {
    if (!isNcName(id) || this.used.has(id)) return false;
    this.used.add(id);
    return true;
  }

  take(base: string): string {
    const b = ncName(base);
    let id = b;
    for (let n = 2; this.used.has(id); n++) id = `${b}_${n}`;
    this.used.add(id);
    return id;
  }
}

/** Number as railML text: no float noise, `.` decimal point. */
export function num(n: number, digits = 6): string {
  const f = 10 ** digits;
  const r = Math.round(n * f) / f;
  return String(Object.is(r, -0) ? 0 : r);
}

/** Child elements of `parent` with this local name (any namespace). */
export function childrenNamed(parent: Element | null | undefined, localName: string): Element[] {
  if (!parent) return [];
  return Array.from(parent.children).filter((c) => c.localName === localName);
}

export function childNamed(parent: Element | null | undefined, localName: string): Element | null {
  return childrenNamed(parent, localName)[0] ?? null;
}

/** Element at a path of local names below `parent` (first match at each level). */
export function pathNamed(parent: Element | null | undefined, ...names: string[]): Element | null {
  let cur: Element | null = parent ?? null;
  for (const n of names) {
    cur = childNamed(cur, n);
    if (!cur) return null;
  }
  return cur;
}

/** Builder for railML elements of one document. */
export class RailmlWriter {
  constructor(readonly doc: XMLDocument) {}

  el(parent: Element, name: string, attrs: Record<string, string | number | boolean | null | undefined> = {}): Element {
    const e = this.doc.createElementNS(RAILML_NS, name);
    setAttrs(e, attrs);
    parent.appendChild(e);
    return e;
  }

  /** Child of the same name or a new one. */
  ensure(parent: Element, name: string): Element {
    return childNamed(parent, name) ?? this.el(parent, name);
  }
}

export function setAttrs(e: Element, attrs: Record<string, string | number | boolean | null | undefined>): void {
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === '') continue;
    e.setAttribute(k, typeof v === 'number' ? num(v) : String(v));
  }
}

export function parseXml(text: string): XMLDocument {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const err = doc.getElementsByTagName('parsererror')[0];
  if (err) {
    const msg = (err.textContent ?? '').trim().split('\n')[0];
    throw new Error(`The file is not well-formed XML${msg ? `: ${msg}` : ''}`);
  }
  return doc;
}

export function serializeXml(doc: Document | Element): string {
  const text = new XMLSerializer().serializeToString(doc);
  return text.startsWith('<?xml') ? text : `<?xml version="1.0" encoding="UTF-8"?>\n${text}`;
}

/** Indents a serialized document (2 spaces) for readable files; mixed content is left alone. */
export function prettyXml(xml: string): string {
  const body = xml.replace(/^<\?xml[^>]*\?>\s*/, '');
  const tokens = body.split(/(<[^>]+>)/).filter((t) => t.trim() !== '');
  let depth = 0;
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.startsWith('</')) {
      depth--;
      const last = out[out.length - 1];
      // <a>text</a> stays on one line
      if (last !== undefined && !last.trimStart().startsWith('<') && out.length >= 2) {
        const text = out.pop()!.trim();
        out[out.length - 1] += `${text}${t}`;
      } else out.push(`${'  '.repeat(Math.max(0, depth))}${t}`);
    } else if (t.startsWith('<?') || t.startsWith('<!') || t.endsWith('/>')) {
      out.push(`${'  '.repeat(depth)}${t}`);
    } else if (t.startsWith('<')) {
      out.push(`${'  '.repeat(depth)}${t}`);
      depth++;
    } else {
      out.push(t);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n${out.join('\n')}\n`;
}

/** True for text whose root element is `<railML>` (any version), e.g. a `.railml` or `.xml` file. */
export function looksLikeRailml(text: string): boolean {
  const head = text.slice(0, 4096).replace(/<\?xml[^>]*\?>/, '').replace(/<!--[\s\S]*?-->/g, '');
  return /^\s*<(?:[A-Za-z_][\w.-]*:)?railML[\s>]/.test(head);
}
