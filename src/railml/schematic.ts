/**
 * @file schematic.ts
 * @brief Cell creation for generated schematic drawings, shared by the railML import (import.ts)
 *        and the Railway Script (src/railway-script/build.ts): the ERTMS library symbols for a
 *        railway object (`Symbols`), fallback styles/sizes for kinds without a symbol, and a
 *        draw.io `<mxGraphModel>` builder (`ModelBuilder`) that writes tracks/legs as edges, simple
 *        objects as vertices and library entries as their (grouped) cells with the data on the top
 *        cell. Pure DOM, runs in jsdom.
 */
import type { KindId } from '../railway/catalogue';
import type { Pt } from '../railway/geometry';
import { ID_PLACEHOLDER } from '../railway/object-data';
import type { LibraryEntry } from '../drawio-shapes/engine';
import { parseXml } from './xml';

/** Default size of a kind drawn without a library symbol. */
export function defaultSize(kind: KindId): [number, number] {
  switch (kind) {
    case 'axleCounter':
      return [10, 10];
    case 'bufferStop':
      return [6, 24];
    case 'levelCrossing':
      return [30, 40];
    case 'rbc':
      return [50, 30];
    case 'leu':
      return [34, 18];
    case 'signal':
      return [20, 20];
    case 'balise':
      return [12, 12];
    case 'trackSection':
      return [10, 12];
    case 'train':
      return [50, 20];
    default:
      return [24, 24];
  }
}

export const SECTION_LINE_STYLE = 'endArrow=none;html=1;rounded=0;strokeWidth=2;strokeColor=#0050ef;';
export const BALISE_GROUP_STYLE = 'rounded=1;whiteSpace=wrap;html=1;fillColor=none;dashed=1;strokeColor=#404040;verticalAlign=top;labelPosition=center;verticalLabelPosition=bottom;fontSize=9;';

/** Style of a kind drawn without a library symbol. */
export function fallbackStyle(kind: KindId): string {
  switch (kind) {
    case 'axleCounter':
      return 'ellipse;whiteSpace=wrap;html=1;fillColor=#000000;strokeColor=#000000;labelPosition=center;verticalLabelPosition=top;align=center;verticalAlign=bottom;fontSize=9;';
    case 'bufferStop':
      return 'rounded=0;whiteSpace=wrap;html=1;fillColor=#000000;strokeColor=none;labelPosition=center;verticalLabelPosition=top;align=center;verticalAlign=bottom;fontSize=9;';
    case 'signal':
      return 'triangle;whiteSpace=wrap;html=1;fillColor=#000000;';
    case 'balise':
      return 'triangle;whiteSpace=wrap;html=1;textShadow=0;shadow=0;';
    default:
      return 'rounded=0;whiteSpace=wrap;html=1;fontSize=9;';
  }
}

// ---------------------------------------------------------------------------------------------
// ERTMS library symbols
// ---------------------------------------------------------------------------------------------

export interface LibrarySymbol {
  title: string;
  xml: string;
  w: number;
  h: number;
}

const FALLBACK_TRACK_STYLE = 'edgeStyle=none;startArrow=none;endArrow=none;strokeColor=light-dark(#e00000, #5f5f5f);html=1;rounded=0;strokeWidth=6;';
const FALLBACK_POINTS_STYLE = 'edgeStyle=none;startArrow=none;endArrow=none;strokeColor=#a5a5a5;html=1;rounded=0;strokeWidth=6;';

/** The ERTMS library entries (public/libraries/ertms.xml) by title, for railway objects. */
export class Symbols {
  private readonly byTitle = new Map<string, LibrarySymbol>();

  constructor(entries: LibraryEntry[]) {
    for (const e of entries) {
      if (!e.xml) continue;
      const t = e.title.trim().toLowerCase().replace(/\s+/g, ' ');
      if (!this.byTitle.has(t)) this.byTitle.set(t, { title: e.title, xml: e.xml, w: e.w, h: e.h });
    }
  }

  get(title: string): LibrarySymbol | null {
    return this.byTitle.get(title) ?? null;
  }

  private edgeStyle(title: string, fallback: string): string {
    const s = this.get(title);
    if (!s) return fallback;
    const cell = Array.from(parseXml(s.xml).getElementsByTagName('mxCell')).find((c) => c.getAttribute('edge') === '1');
    return cell?.getAttribute('style') ?? fallback;
  }

  trackStyle(): string {
    return this.edgeStyle('track', FALLBACK_TRACK_STYLE);
  }

  pointsStyle(): string {
    return this.edgeStyle('point right', FALLBACK_POINTS_STYLE);
  }

  /** Library title used for an object (null: no symbol, drawn with the fallback style). */
  titleFor(it: { kind: KindId; values: Record<string, string> }): string | null {
    const dir = it.values.direction;
    switch (it.kind) {
      case 'signal': {
        if (dir === 'reverse') return this.get('signal left 3') ? 'signal left 3' : null;
        if (it.values.aspects === '4' && this.get('signal right 4')) return 'signal right 4';
        return this.get('signal right 3') ? 'signal right 3' : null;
      }
      case 'balise': {
        const t = dir === 'reverse' ? 'balise left' : 'single balise right';
        return this.get(t) ? t : null;
      }
      case 'trackSection':
        return this.get('tc') ? 'tc' : null;
      case 'train':
        return this.get('train') ? 'train' : null;
      default:
        return null;
    }
  }

  forItem(it: { kind: KindId; values: Record<string, string> }): LibrarySymbol | null {
    const t = this.titleFor(it);
    return t ? this.get(t) : null;
  }
}

// ---------------------------------------------------------------------------------------------
// draw.io model builder
// ---------------------------------------------------------------------------------------------

export function r2(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/**
 * Writes a draw.io `<mxGraphModel>` cell by cell. Ids are `<prefix>-<n>` unless `useId()` names
 * the next one (library entries: their child cells get `<id>-<entry cell id>`).
 */
export class ModelBuilder {
  private readonly doc = document.implementation.createDocument(null, null, null);
  private readonly rootEl: Element;
  private n = 0;
  private bottom = 0;
  private forcedId: string | null = null;

  constructor(private readonly idPrefix = 'rml') {
    const model = this.doc.createElement('mxGraphModel');
    this.doc.appendChild(model);
    this.rootEl = this.doc.createElement('root');
    model.appendChild(this.rootEl);
    const c0 = this.doc.createElement('mxCell');
    c0.setAttribute('id', '0');
    const c1 = this.doc.createElement('mxCell');
    c1.setAttribute('id', '1');
    c1.setAttribute('parent', '0');
    this.rootEl.append(c0, c1);
  }

  /** The id of the next cell written (edge/vertex/symbol). */
  useId(id: string): void {
    this.forcedId = id;
  }

  private nextId(): string {
    const forced = this.forcedId;
    this.forcedId = null;
    return forced ?? `${this.idPrefix}-${++this.n}`;
  }

  maxY(): number {
    return this.bottom;
  }

  private wrap(cell: Element, id: string, attrs: Record<string, string>): Element {
    const obj = this.doc.createElement('object');
    obj.setAttribute('label', attrs.label ?? '');
    for (const [k, v] of Object.entries(attrs)) if (k !== 'label') obj.setAttribute(k, v);
    obj.setAttribute('id', id);
    obj.appendChild(cell);
    return obj;
  }

  private geometry(attrs: Record<string, string>): Element {
    const g = this.doc.createElement('mxGeometry');
    for (const [k, v] of Object.entries(attrs)) g.setAttribute(k, v);
    g.setAttribute('as', 'geometry');
    return g;
  }

  edge(attrs: Record<string, string>, style: string, line: Pt[]): void {
    const cell = this.doc.createElement('mxCell');
    cell.setAttribute('style', style);
    cell.setAttribute('edge', '1');
    cell.setAttribute('parent', '1');
    const g = this.geometry({ relative: '1' });
    const pt = (p: Pt, as?: string): Element => {
      const e = this.doc.createElement('mxPoint');
      e.setAttribute('x', r2(p.x));
      e.setAttribute('y', r2(p.y));
      if (as) e.setAttribute('as', as);
      return e;
    };
    g.appendChild(pt(line[0], 'sourcePoint'));
    g.appendChild(pt(line[line.length - 1], 'targetPoint'));
    if (line.length > 2) {
      const arr = this.doc.createElement('Array');
      arr.setAttribute('as', 'points');
      for (const p of line.slice(1, -1)) arr.appendChild(pt(p));
      g.appendChild(arr);
    }
    cell.appendChild(g);
    for (const p of line) this.bottom = Math.max(this.bottom, p.y);
    this.rootEl.appendChild(this.wrap(cell, this.nextId(), attrs));
  }

  vertex(attrs: Record<string, string>, style: string, centre: Pt, size: { w: number; h: number }, idLabel = false, toBack = false): void {
    const cell = this.doc.createElement('mxCell');
    cell.setAttribute('style', style);
    cell.setAttribute('vertex', '1');
    cell.setAttribute('parent', '1');
    cell.appendChild(this.geometry({ x: r2(centre.x - size.w / 2), y: r2(centre.y - size.h / 2), width: r2(size.w), height: r2(size.h) }));
    const a = { ...attrs };
    if (idLabel && a.label === undefined) {
      a.label = ID_PLACEHOLDER;
      a.placeholders = '1';
    }
    this.bottom = Math.max(this.bottom, centre.y + size.h / 2);
    const el = this.wrap(cell, this.nextId(), a);
    // after the two layer cells: drawn behind the rest
    if (toBack) this.rootEl.insertBefore(el, this.rootEl.children[2] ?? null);
    else this.rootEl.appendChild(el);
  }

  /** Inserts a library entry centred on `centre`; the data goes on its top cell. */
  symbol(sym: LibrarySymbol, attrs: Record<string, string>, centre: Pt, idText: string): void {
    const src = parseXml(sym.xml);
    const cells = Array.from(src.getElementsByTagName('root')[0]?.children ?? []);
    const idMap = new Map<string, string>();
    const forced = this.forcedId !== null;
    const prefix = this.nextId();
    const idOf = (el: Element): string => el.getAttribute('id') ?? '';
    const inner = (el: Element): Element => (el.nodeName === 'mxCell' ? el : el.getElementsByTagName('mxCell')[0] ?? el);
    for (const el of cells) {
      const id = idOf(el);
      if (id === '0' || id === '1') continue;
      idMap.set(id, `${prefix}-${id}`);
    }
    const tops = cells.filter((el) => idMap.has(idOf(el)) && inner(el).getAttribute('parent') === '1');
    // with useId() the entry's top cell gets that id itself (it names the object's cell)
    if (forced && tops.length > 0) idMap.set(idOf(tops[0]), prefix);
    const x = centre.x - sym.w / 2;
    const y = centre.y - sym.h / 2;
    let dataPlaced = false;
    for (const el of cells) {
      const id = idOf(el);
      if (!idMap.has(id)) continue;
      let node = this.doc.importNode(el, true) as Element;
      const mx = inner(node);
      const parentId = mx.getAttribute('parent') ?? '1';
      mx.setAttribute('parent', parentId === '1' ? '1' : idMap.get(parentId) ?? '1');
      for (const k of ['source', 'target']) {
        const t = mx.getAttribute(k);
        if (t) mx.setAttribute(k, idMap.get(t) ?? t);
      }
      if (parentId === '1') {
        const g = Array.from(mx.children).find((c) => c.nodeName === 'mxGeometry');
        if (g && g.getAttribute('relative') !== '1') {
          g.setAttribute('x', r2((Number(g.getAttribute('x')) || 0) + x));
          g.setAttribute('y', r2((Number(g.getAttribute('y')) || 0) + y));
        }
      }
      // a fixed "S4"-like text inside a signal shows the signal's ID instead
      if (mx.getAttribute('style')?.startsWith('text;') && idText && node === mx) mx.setAttribute('value', idText);
      if (!dataPlaced && tops.includes(el)) {
        dataPlaced = true;
        if (node.nodeName === 'mxCell') {
          const label = node.getAttribute('value') ?? '';
          node.removeAttribute('value');
          node.removeAttribute('id');
          node = this.wrap(node, idMap.get(id)!, { label, ...attrs });
        } else {
          // the library entry's own railway presets (rdKind, rdAspects, ...) give way to the object's data
          for (const name of node.getAttributeNames()) if (/^rd[A-Z]/.test(name)) node.removeAttribute(name);
          for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
          node.setAttribute('id', idMap.get(id)!);
        }
      } else node.setAttribute('id', idMap.get(id)!);
      this.rootEl.appendChild(node);
    }
    this.bottom = Math.max(this.bottom, centre.y + sym.h / 2);
  }

  toXml(): string {
    return new XMLSerializer().serializeToString(this.doc);
  }
}
