/**
 * @file preserve.ts
 * @brief Lossless keeping of railML content the importer does not understand, so a re-export
 *        writes it back: whole unknown elements (by their parent path or by the railML id of the
 *        mapped element they belong to) and unknown attributes of mapped elements.
 *
 * The store is one XML string (`<rd:preserved>`) kept on the diagram's root cell as the draw.io
 * data attribute `rdRailml` (draw.io's "Edit Data" of the diagram; saved in .drawio files, the
 * cache and share links, and kept by draw.io itself).
 */
import type { GraphDataModel } from '@maxgraph/core';
import { insertOrdered } from './schema-order';
import { RAILML_NS, RD_NS, XMLNS_NS, parseXml } from './xml';

/** Attribute of the root cell's value holding the store. */
export const PRESERVED_ATTR = 'rdRailml';

export interface PreservedElement {
  /** Parent path of local names below `<railML>` (`infrastructure/functionalInfrastructure`), '' = the root. */
  path?: string;
  /** railML id of the mapped element the element belongs to. */
  owner?: string;
  node: Element;
}

export interface PreservedAttribute {
  owner: string;
  ns: string | null;
  name: string;
  value: string;
}

export class PreservedStore {
  readonly elements: PreservedElement[] = [];
  readonly attributes: PreservedAttribute[] = [];

  get size(): number {
    return this.elements.length + this.attributes.length;
  }

  addElement(node: Element, where: { path?: string; owner?: string }): void {
    this.elements.push({ ...where, node });
  }

  addAttributes(owner: string, el: Element, known: ReadonlySet<string>, defaults: Record<string, string> = {}): void {
    for (const a of Array.from(el.attributes)) {
      if (a.namespaceURI === XMLNS_NS || a.name === 'xmlns' || a.name.startsWith('xmlns:')) continue;
      if (a.namespaceURI === null && (known.has(a.localName) || defaults[a.localName] === a.value)) continue;
      this.attributes.push({ owner, ns: a.namespaceURI, name: a.name, value: a.value });
    }
  }

  serialize(): string {
    if (this.size === 0) return '';
    const doc = document.implementation.createDocument(RD_NS, 'rd:preserved', null);
    const root = doc.documentElement;
    root.setAttribute('version', '1');
    for (const e of this.elements) {
      const w = doc.createElementNS(RD_NS, 'rd:element');
      if (e.path !== undefined) w.setAttribute('path', e.path);
      if (e.owner) w.setAttribute('owner', e.owner);
      w.appendChild(doc.importNode(e.node, true));
      root.appendChild(w);
    }
    for (const a of this.attributes) {
      const w = doc.createElementNS(RD_NS, 'rd:attribute');
      w.setAttribute('owner', a.owner);
      w.setAttribute('name', a.name);
      if (a.ns) w.setAttribute('ns', a.ns);
      w.setAttribute('value', a.value);
      root.appendChild(w);
    }
    return new XMLSerializer().serializeToString(doc);
  }

  static parse(text: string | null | undefined): PreservedStore {
    const store = new PreservedStore();
    if (!text) return store;
    let doc: XMLDocument;
    try {
      doc = parseXml(text);
    } catch {
      return store;
    }
    for (const child of Array.from(doc.documentElement.children)) {
      if (child.namespaceURI !== RD_NS) continue;
      if (child.localName === 'element' && child.firstElementChild) {
        store.elements.push({
          path: child.hasAttribute('path') ? child.getAttribute('path')! : undefined,
          owner: child.getAttribute('owner') ?? undefined,
          node: child.firstElementChild,
        });
      } else if (child.localName === 'attribute') {
        const owner = child.getAttribute('owner');
        const name = child.getAttribute('name');
        if (owner && name) store.attributes.push({ owner, name, ns: child.getAttribute('ns'), value: child.getAttribute('value') ?? '' });
      }
    }
    return store;
  }
}

/** The store kept on a model's root cell. */
export function readPreserved(model: GraphDataModel): PreservedStore {
  const value = model.getRoot()?.getValue() as unknown;
  if (typeof value === 'object' && value !== null && (value as Node).nodeType === 1) {
    return PreservedStore.parse((value as Element).getAttribute(PRESERVED_ATTR));
  }
  return PreservedStore.parse(null);
}

/** Path of local names from below `<railML>` down to `el` itself. */
export function pathOf(el: Element): string {
  const parts: string[] = [];
  for (let e: Element | null = el; e && e.parentElement; e = e.parentElement) parts.unshift(e.localName);
  return parts.join('/');
}

export interface ApplyResult {
  restored: number;
  /** Preserved items whose owner is no longer exported (object deleted). */
  dropped: number;
}

/** Writes the store back into an exported document (`byId`: exported elements by railML id). */
export function applyPreserved(root: Element, store: PreservedStore, ids: Map<string, Element>): ApplyResult {
  const doc = root.ownerDocument;
  const result: ApplyResult = { restored: 0, dropped: 0 };
  // `<id>/<child>`: the (first) child of that name of the element with the id
  const byId = {
    get(owner: string): Element | undefined {
      const [id, child] = owner.split('/');
      const el = ids.get(id);
      if (!el || !child) return el;
      return Array.from(el.children).find((c) => c.localName === child && c.namespaceURI === RAILML_NS);
    },
  };
  for (const a of store.attributes) {
    const el = byId.get(a.owner);
    if (!el) {
      result.dropped++;
      continue;
    }
    if (a.ns) el.setAttributeNS(a.ns, a.name, a.value);
    else el.setAttribute(a.name, a.value);
    result.restored++;
  }
  for (const e of store.elements) {
    let parent: Element | null = null;
    if (e.owner) parent = byId.get(e.owner) ?? null;
    else if (e.path !== undefined) {
      parent = root;
      for (const name of e.path.split('/').filter((s) => s !== '')) {
        const next: Element | null = Array.from(parent.children).find((c) => c.localName === name && c.namespaceURI === RAILML_NS) ?? null;
        parent = next ?? insertOrdered(parent, doc.createElementNS(RAILML_NS, name));
      }
    }
    if (!parent) {
      result.dropped++;
      continue;
    }
    insertOrdered(parent, doc.importNode(e.node, true) as Element);
    result.restored++;
  }
  return result;
}
