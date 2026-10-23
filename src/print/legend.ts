/**
 * @file legend.ts
 * @brief The legend of a sheet, generated from the symbols used on its page: railway objects by
 *        kind (`rdKind`, labels of the railway catalogue; signals also by type) and shapes inserted
 *        from a library with titles (the ERTMS library: matched by their style). Each entry keeps
 *        one sample cell (style + size) that the exports draw as its symbol.
 */
import { KINDS } from '../railway/catalogue';
import { SHEET_REF_ATTR } from './sheet-refs';

export interface LegendEntry {
  key: string;
  label: string;
  /** Style of the sample cell. */
  style: string;
  width: number;
  height: number;
  /** An edge (drawn as a line). */
  edge: boolean;
  count: number;
}

/** Style entries that do not change the symbol (labels, app data). */
const IGNORED_STYLE_KEYS = /^(rd[A-Z].*|html|whiteSpace|labelPosition|verticalLabelPosition|align|verticalAlign|fontSize|fontColor|fontStyle|fontFamily|labelBackgroundColor|spacing.*|points|aspect|rotation|editable|movable|resizable)$/;

/** A style string reduced to what identifies the symbol (sorted keys, label / app keys dropped). */
export function symbolStyleKey(style: string | null | undefined): string {
  const parts: string[] = [];
  for (const item of (style ?? '').split(';')) {
    const t = item.trim();
    if (!t) continue;
    const eq = t.indexOf('=');
    const key = eq < 0 ? t : t.slice(0, eq);
    if (IGNORED_STYLE_KEYS.test(key)) continue;
    parts.push(t);
  }
  return parts.sort().join(';');
}

/** Index of library entries with a title: symbol style key -> title (first vertex of single-shape entries). */
export function libraryTitleIndex(entries: ReadonlyArray<{ title: string; xml?: string }>): Map<string, string> {
  const index = new Map<string, string>();
  for (const entry of entries) {
    const title = entry.title?.trim();
    if (!title || !entry.xml) continue;
    const doc = new DOMParser().parseFromString(entry.xml, 'text/xml');
    const vertices = Array.from(doc.getElementsByTagName('mxCell')).filter((c) => c.getAttribute('vertex') === '1');
    // a library symbol is one shape (or a group whose first shape carries the look)
    if (vertices.length === 0 || vertices.length > 3) continue;
    const key = symbolStyleKey(vertices[0].getAttribute('style'));
    if (key && !index.has(key)) index.set(key, title);
  }
  return index;
}

const KIND_LABELS = new Map<string, string>(KINDS.map((k) => [k.id, k.label]));
const SIGNAL_TYPES = new Map<string, string>(
  (KINDS.find((k) => k.id === 'signal')?.fields.find((f) => f.key === 'signalType')?.options ?? []).map((o) => [o.value, o.label])
);

/** The legend entries of a page (`<mxGraphModel>` XML), in order of first appearance. */
export function buildLegend(modelXml: string, library: ReadonlyMap<string, string> = new Map()): LegendEntry[] {
  const doc = new DOMParser().parseFromString(modelXml, 'text/xml');
  const root = doc.getElementsByTagName('root')[0];
  if (!root) return [];
  const entries = new Map<string, LegendEntry>();
  for (const node of Array.from(root.getElementsByTagName('mxCell'))) {
    const wrapper = node.parentElement && node.parentElement !== root && node.parentElement.nodeName !== 'root' ? node.parentElement : null;
    const vertex = node.getAttribute('vertex') === '1';
    const edge = node.getAttribute('edge') === '1';
    if (!vertex && !edge) continue;
    if (wrapper?.hasAttribute(SHEET_REF_ATTR)) continue;
    const style = node.getAttribute('style') ?? '';
    const kind = wrapper?.getAttribute('rdKind') ?? '';
    let key = '';
    let label = '';
    if (kind && KIND_LABELS.has(kind)) {
      const subtype = kind === 'signal' ? (wrapper?.getAttribute('rdSignalType') ?? '') : '';
      key = `kind:${kind}:${subtype}`;
      label = subtype && SIGNAL_TYPES.has(subtype) ? SIGNAL_TYPES.get(subtype)! : KIND_LABELS.get(kind)!;
    } else {
      const title = library.get(symbolStyleKey(style));
      if (!title) continue;
      key = `lib:${title}`;
      label = title;
    }
    const existing = entries.get(key);
    if (existing) {
      existing.count++;
      continue;
    }
    const geo = Array.from(node.children).find((c) => c.nodeName === 'mxGeometry');
    const width = Number(geo?.getAttribute('width')) || 40;
    const height = Number(geo?.getAttribute('height')) || 40;
    entries.set(key, { key, label, style, width, height, edge, count: 1 });
  }
  return [...entries.values()];
}

/** `<mxGraphModel>` XML with the legend entry's sample symbol (for the image renderer). */
export function legendSymbolModelXml(entry: LegendEntry): string {
  const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const style = esc(entry.style);
  const cell = entry.edge
    ? `<mxCell id="2" style="${style}" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="0" y="10" as="sourcePoint"/><mxPoint x="60" y="10" as="targetPoint"/></mxGeometry></mxCell>`
    : `<mxCell id="2" value="" style="${style}" vertex="1" parent="1"><mxGeometry x="0" y="0" width="${entry.width}" height="${entry.height}" as="geometry"/></mxCell>`;
  return `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cell}</root></mxGraphModel>`;
}
