/**
 * @file scenario-diff.ts
 * @brief Differences between two step snapshots (draw.io `<mxGraphModel>` XML), matched by cell id,
 *        and a highlight copy of a snapshot that shows them.
 *
 * Pure XML (DOMParser), no maxGraph: used by the scenario view ("Show changes"), the PDF and the
 * slides export. Kinds: added (green outline), removed (red ghost at the old place), moved/resized
 * (blue) and changed = style, label or railway data (orange). A cell can be both moved and changed;
 * its highlight is then blue, the summary names both.
 *
 * `buildDiffHighlightXml` never touches the snapshots: it returns a NEW model XML = the current
 * snapshot plus one extra top layer (`rd-diff-layer`) holding outline/ghost cells at absolute
 * coordinates (style key `rdDiff=<kind>`).
 */

export type CellChangeKind = 'added' | 'removed' | 'moved' | 'changed';

export interface CellBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A drawable cell of a snapshot (vertex or edge). */
export interface SnapshotCell {
  id: string;
  parent: string;
  vertex: boolean;
  edge: boolean;
  /** Plain label text (HTML stripped). */
  label: string;
  /** Raw style string. */
  style: string;
  /** App data / draw.io object attributes (everything but id/label/placeholders). */
  data: Record<string, string>;
  /** Geometry as written (relative to the parent). */
  geometry: { x: number; y: number; width: number; height: number; relative: boolean } | null;
  /** Edge points (relative to the parent), sourcePoint/targetPoint included when written. */
  points: Array<{ x: number; y: number }>;
  sourcePoint: { x: number; y: number } | null;
  targetPoint: { x: number; y: number } | null;
  source: string;
  target: string;
}

export interface CellChange {
  id: string;
  /** Highlight kind (moved wins over changed when both apply). */
  kind: CellChangeKind;
  /** Display name: label, else railway ID, else shape name + id. */
  name: string;
  moved: boolean;
  resized: boolean;
  /** Changed label text. */
  labelChanged: boolean;
  /** Changed style keys (sorted). */
  styleKeys: string[];
  /** Changed data attributes (without the `rd` prefix, e.g. `aspects`). */
  dataKeys: string[];
  /** Edge source/target or points changed. */
  rerouted: boolean;
  /** One line for the "Changes" list, e.g. "S2: aspects changed". */
  summary: string;
}

export interface SnapshotDiff {
  changes: CellChange[];
  counts: Record<CellChangeKind, number>;
}

const EPS = 0.5;

function num(value: string | null): number {
  const n = value === null ? 0 : parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function point(el: Element): { x: number; y: number } {
  return { x: num(el.getAttribute('x')), y: num(el.getAttribute('y')) };
}

/** Label HTML -> text (no DOM insertion: DOMParser text/html does not run scripts or load images). */
export function plainLabel(value: string): string {
  if (!/[<&]/.test(value)) return value.replace(/\s+/g, ' ').trim();
  const doc = new DOMParser().parseFromString(`<body>${value.replace(/<br\s*\/?>/gi, ' ')}</body>`, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

const OBJECT_ATTRS_IGNORED = new Set(['id', 'label', 'placeholders', 'tooltip']);

/** Drawable cells of a snapshot by id (layers and the root are skipped). */
export function parseSnapshotCells(xml: string): Map<string, SnapshotCell> {
  const cells = new Map<string, SnapshotCell>();
  if (!xml.trim()) return cells;
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return cells;
  const root = doc.getElementsByTagName('root')[0];
  if (!root) return cells;
  const visit = (node: Element): void => {
    for (const child of Array.from(node.children)) {
      let cellEl: Element | null = null;
      let wrapper: Element | null = null;
      if (child.tagName === 'mxCell') cellEl = child;
      else if (child.tagName === 'object' || child.tagName === 'UserObject') {
        wrapper = child;
        cellEl = Array.from(child.children).find((c) => c.tagName === 'mxCell') ?? null;
      }
      if (!cellEl) continue;
      const id = (wrapper ?? cellEl).getAttribute('id') ?? cellEl.getAttribute('id') ?? '';
      const vertex = cellEl.getAttribute('vertex') === '1';
      const edge = cellEl.getAttribute('edge') === '1';
      if (!id || (!vertex && !edge)) continue;
      const data: Record<string, string> = {};
      if (wrapper) {
        for (const attr of Array.from(wrapper.attributes)) {
          if (!OBJECT_ATTRS_IGNORED.has(attr.name)) data[attr.name] = attr.value;
        }
      }
      const rawLabel = wrapper ? (wrapper.getAttribute('label') ?? '') : (cellEl.getAttribute('value') ?? '');
      const geoEl = Array.from(cellEl.children).find((c) => c.tagName === 'mxGeometry') ?? null;
      const points: Array<{ x: number; y: number }> = [];
      let sourcePoint: { x: number; y: number } | null = null;
      let targetPoint: { x: number; y: number } | null = null;
      if (geoEl) {
        for (const p of Array.from(geoEl.children)) {
          if (p.tagName === 'mxPoint') {
            if (p.getAttribute('as') === 'sourcePoint') sourcePoint = point(p);
            else if (p.getAttribute('as') === 'targetPoint') targetPoint = point(p);
          } else if (p.tagName === 'Array' && p.getAttribute('as') === 'points') {
            for (const q of Array.from(p.children)) if (q.tagName === 'mxPoint') points.push(point(q));
          }
        }
      }
      cells.set(id, {
        id,
        parent: cellEl.getAttribute('parent') ?? '',
        vertex,
        edge,
        // draw.io: the value is HTML only with html=1
        label: /(^|;)html=1(;|$)/.test(cellEl.getAttribute('style') ?? '') ? plainLabel(rawLabel) : rawLabel.replace(/\s+/g, ' ').trim(),
        style: cellEl.getAttribute('style') ?? '',
        data,
        geometry: geoEl
          ? {
              x: num(geoEl.getAttribute('x')),
              y: num(geoEl.getAttribute('y')),
              width: num(geoEl.getAttribute('width')),
              height: num(geoEl.getAttribute('height')),
              relative: geoEl.getAttribute('relative') === '1',
            }
          : null,
        points,
        sourcePoint,
        targetPoint,
        source: cellEl.getAttribute('source') ?? '',
        target: cellEl.getAttribute('target') ?? '',
      });
    }
  };
  visit(root);
  return cells;
}

/** `a=1;b=2;shape` -> map (a bare name = the base style, key `''` list joined). */
export function parseStyleString(style: string): Map<string, string> {
  const out = new Map<string, string>();
  const bases: string[] = [];
  for (const part of style.split(';')) {
    const item = part.trim();
    if (!item) continue;
    const eq = item.indexOf('=');
    if (eq < 0) bases.push(item);
    else out.set(item.slice(0, eq), item.slice(eq + 1));
  }
  if (bases.length) out.set('', bases.join(';'));
  return out;
}

function changedKeys(a: Map<string, string> | Record<string, string>, b: Map<string, string> | Record<string, string>): string[] {
  const ma = a instanceof Map ? a : new Map(Object.entries(a));
  const mb = b instanceof Map ? b : new Map(Object.entries(b));
  const keys = new Set([...ma.keys(), ...mb.keys()]);
  return [...keys].filter((k) => ma.get(k) !== mb.get(k)).sort();
}

const near = (a: number, b: number): boolean => Math.abs(a - b) <= EPS;

function samePoints(a: Array<{ x: number; y: number }>, b: Array<{ x: number; y: number }>): boolean {
  return a.length === b.length && a.every((p, i) => near(p.x, b[i].x) && near(p.y, b[i].y));
}

function samePoint(a: { x: number; y: number } | null, b: { x: number; y: number } | null): boolean {
  if (!a || !b) return a === b;
  return near(a.x, b.x) && near(a.y, b.y);
}

/** `rdAspects` -> `aspects`, `rdNidBg` -> `NID_BG`-like readable `nidBg`. */
function dataKeyName(key: string): string {
  return /^rd[A-Z]/.test(key) ? key.charAt(2).toLowerCase() + key.slice(3) : key;
}

function shapeName(style: string): string {
  const s = parseStyleString(style);
  const shape = s.get('shape') ?? s.get('') ?? '';
  return shape.replace(/^mxgraph\./, '').split(/[.;]/).pop() ?? '';
}

/** Display name of a cell: label, else railway ID, else "<shape> <id>" / "edge <id>". */
export function cellDisplayName(cell: SnapshotCell): string {
  const label = cell.label.length > 40 ? `${cell.label.slice(0, 39)}…` : cell.label;
  if (label) return label;
  if (cell.data.rdId) return cell.data.rdId;
  if (cell.edge) return `Connector ${cell.id}`;
  const shape = shapeName(cell.style);
  return shape ? `${shape} ${cell.id}` : `Shape ${cell.id}`;
}

function joinWords(words: string[]): string {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

function summarize(c: Omit<CellChange, 'summary' | 'kind'> & { added?: boolean; removed?: boolean }): string {
  if (c.added) return `${c.name} added`;
  if (c.removed) return `${c.name} removed`;
  const parts: string[] = [];
  if (c.moved && c.resized) parts.push('moved and resized');
  else if (c.moved) parts.push('moved');
  else if (c.resized) parts.push('resized');
  if (c.rerouted) parts.push('rerouted');
  if (c.labelChanged) parts.push('label changed');
  if (c.dataKeys.length) parts.push(`${joinWords(c.dataKeys)} changed`);
  if (c.styleKeys.length) parts.push(`style changed (${c.styleKeys.slice(0, 4).join(', ')}${c.styleKeys.length > 4 ? ', …' : ''})`);
  return `${c.name}: ${parts.join(', ')}`;
}

/** Compares two step snapshots by cell id. `prevXml` null/'' = everything is added. */
export function diffSnapshots(prevXml: string | null, curXml: string): SnapshotDiff {
  const prev = prevXml ? parseSnapshotCells(prevXml) : new Map<string, SnapshotCell>();
  const cur = parseSnapshotCells(curXml);
  const changes: CellChange[] = [];
  for (const [id, cell] of cur) {
    const old = prev.get(id);
    const name = cellDisplayName(cell);
    if (!old) {
      const base = { id, name, moved: false, resized: false, labelChanged: false, styleKeys: [], dataKeys: [], rerouted: false };
      changes.push({ ...base, kind: 'added', summary: summarize({ ...base, added: true }) });
      continue;
    }
    const g0 = old.geometry;
    const g1 = cell.geometry;
    let moved = false;
    let resized = false;
    let rerouted = false;
    if (cell.edge) {
      rerouted =
        old.source !== cell.source ||
        old.target !== cell.target ||
        !samePoints(old.points, cell.points) ||
        (!cell.source && !samePoint(old.sourcePoint, cell.sourcePoint)) ||
        (!cell.target && !samePoint(old.targetPoint, cell.targetPoint));
    } else if (g0 && g1) {
      moved = !near(g0.x, g1.x) || !near(g0.y, g1.y) || old.parent !== cell.parent;
      resized = !near(g0.width, g1.width) || !near(g0.height, g1.height);
    } else if (!!g0 !== !!g1) {
      moved = true;
    }
    const labelChanged = old.label !== cell.label;
    const styleKeys = changedKeys(parseStyleString(old.style), parseStyleString(cell.style)).map((k) => k || 'base style');
    const dataKeys = changedKeys(old.data, cell.data).map(dataKeyName);
    const geometric = moved || resized || rerouted;
    const other = labelChanged || styleKeys.length > 0 || dataKeys.length > 0;
    if (!geometric && !other) continue;
    const base = { id, name: old.label && labelChanged ? `${cellDisplayName(old)} → ${name}` : name, moved, resized, labelChanged, styleKeys, dataKeys, rerouted };
    changes.push({ ...base, kind: geometric ? 'moved' : 'changed', summary: summarize(base) });
  }
  for (const [id, old] of prev) {
    if (cur.has(id)) continue;
    const base = { id, name: cellDisplayName(old), moved: false, resized: false, labelChanged: false, styleKeys: [], dataKeys: [], rerouted: false };
    changes.push({ ...base, kind: 'removed', summary: summarize({ ...base, removed: true }) });
  }
  const counts: Record<CellChangeKind, number> = { added: 0, removed: 0, moved: 0, changed: 0 };
  for (const c of changes) counts[c.kind]++;
  return { changes, counts };
}

/** Highlight colours (also used by the legend). */
export const DIFF_COLORS: Record<CellChangeKind, string> = {
  added: '#2e7d32',
  removed: '#c62828',
  moved: '#1565c0',
  changed: '#ef6c00',
};

export const DIFF_LABELS: Record<CellChangeKind, string> = {
  added: 'Added',
  removed: 'Removed',
  moved: 'Moved / resized',
  changed: 'Style / label / data changed',
};

/** Absolute position of a cell's origin (sum of the parent vertices' geometries). */
function absoluteOrigin(cells: Map<string, SnapshotCell>, parentId: string): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let guard = 0;
  let p = cells.get(parentId);
  while (p && p.geometry && !p.geometry.relative && guard++ < 100) {
    x += p.geometry.x;
    y += p.geometry.y;
    p = cells.get(p.parent);
  }
  return { x, y };
}

function vertexBounds(cells: Map<string, SnapshotCell>, cell: SnapshotCell): CellBounds | null {
  if (!cell.geometry || cell.geometry.relative) return null;
  const o = absoluteOrigin(cells, cell.parent);
  return { x: o.x + cell.geometry.x, y: o.y + cell.geometry.y, width: cell.geometry.width, height: cell.geometry.height };
}

/** Approximate absolute polyline of an edge (terminal centres + points). */
export function edgePolyline(cells: Map<string, SnapshotCell>, cell: SnapshotCell): Array<{ x: number; y: number }> {
  const o = absoluteOrigin(cells, cell.parent);
  const center = (id: string): { x: number; y: number } | null => {
    const t = cells.get(id);
    const b = t && t.vertex ? vertexBounds(cells, t) : null;
    return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null;
  };
  const abs = (p: { x: number; y: number }): { x: number; y: number } => ({ x: o.x + p.x, y: o.y + p.y });
  const start = center(cell.source) ?? (cell.sourcePoint ? abs(cell.sourcePoint) : null);
  const end = center(cell.target) ?? (cell.targetPoint ? abs(cell.targetPoint) : null);
  const pts = cell.points.map(abs);
  return [...(start ? [start] : []), ...pts, ...(end ? [end] : [])];
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '&#10;');
}

export const DIFF_LAYER_ID = 'rd-diff-layer';

export interface DiffHighlightOptions {
  /**
   * Put the highlight cells at the end of the FIRST layer instead of an own top layer: the image
   * export (thumbnail renderer) only draws the first layer's cells (PDF, slides).
   */
  inFirstLayer?: boolean;
}

/**
 * A copy of `curXml` with highlight cells for `diff` (computed when omitted) in an extra top layer.
 * Returns `curXml` unchanged when there is nothing to highlight or the XML cannot be read.
 */
export function buildDiffHighlightXml(
  prevXml: string | null,
  curXml: string,
  diff: SnapshotDiff = diffSnapshots(prevXml, curXml),
  options: DiffHighlightOptions = {}
): string {
  if (diff.changes.length === 0) return curXml;
  const doc = new DOMParser().parseFromString(curXml, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return curXml;
  const root = doc.getElementsByTagName('root')[0];
  if (!root) return curXml;
  const rootCellId =
    Array.from(root.children).find((c) => c.tagName === 'mxCell' && !c.getAttribute('parent'))?.getAttribute('id') ?? '0';
  const prev = prevXml ? parseSnapshotCells(prevXml) : new Map<string, SnapshotCell>();
  const cur = parseSnapshotCells(curXml);
  const firstLayerId = Array.from(root.children)
    .find((c) => c.tagName === 'mxCell' && c.getAttribute('parent') === rootCellId && c.getAttribute('vertex') !== '1' && c.getAttribute('edge') !== '1')
    ?.getAttribute('id');
  const inFirst = options.inFirstLayer === true && !!firstLayerId;
  const parentId = inFirst ? escapeAttr(firstLayerId!) : DIFF_LAYER_ID;
  const parts: string[] = inFirst ? [] : [`<mxCell id="${DIFF_LAYER_ID}" value="Changes" parent="${escapeAttr(rootCellId)}"/>`];
  let n = 0;
  const PAD = 4;
  for (const change of diff.changes) {
    const cell = change.kind === 'removed' ? prev.get(change.id) : cur.get(change.id);
    const cells = change.kind === 'removed' ? prev : cur;
    if (!cell) continue;
    const color = DIFF_COLORS[change.kind];
    const id = `rd-diff-${++n}`;
    if (cell.edge) {
      const line = edgePolyline(cells, cell);
      if (line.length < 2) continue;
      const style =
        `rdDiff=${change.kind};endArrow=none;startArrow=none;html=1;rounded=0;strokeColor=${color};strokeWidth=6;opacity=45;` +
        (change.kind === 'removed' ? 'dashed=1;dashPattern=6 4;' : '');
      const inner = line.slice(1, -1).map((p) => `<mxPoint x="${p.x}" y="${p.y}"/>`).join('');
      parts.push(
        `<mxCell id="${id}" value="" style="${style}" edge="1" parent="${parentId}"><mxGeometry relative="1" as="geometry">` +
          `<mxPoint x="${line[0].x}" y="${line[0].y}" as="sourcePoint"/><mxPoint x="${line[line.length - 1].x}" y="${line[line.length - 1].y}" as="targetPoint"/>` +
          (inner ? `<Array as="points">${inner}</Array>` : '') +
          `</mxGeometry></mxCell>`
      );
      continue;
    }
    const b = vertexBounds(cells, cell);
    if (!b) continue;
    const ghost = change.kind === 'removed';
    const style =
      `rdDiff=${change.kind};rounded=1;arcSize=6;html=1;whiteSpace=wrap;strokeColor=${color};strokeWidth=${ghost ? 2 : 3};` +
      (ghost
        ? `dashed=1;dashPattern=5 3;fillColor=${color};fillOpacity=18;fontColor=${color};fontSize=10;verticalAlign=middle;`
        : 'fillColor=none;');
    parts.push(
      `<mxCell id="${id}" value="${ghost ? escapeAttr(change.name) : ''}" style="${style}" vertex="1" parent="${parentId}">` +
        `<mxGeometry x="${b.x - PAD}" y="${b.y - PAD}" width="${Math.max(1, b.width) + 2 * PAD}" height="${Math.max(1, b.height) + 2 * PAD}" as="geometry"/></mxCell>`
    );
  }
  const fragment = new DOMParser().parseFromString(`<x>${parts.join('')}</x>`, 'text/xml').documentElement;
  for (const child of Array.from(fragment.children)) root.appendChild(doc.importNode(child, true));
  return new XMLSerializer().serializeToString(doc.documentElement);
}

/** "2 added, 1 removed, 1 moved/resized, 3 changed" (empty kinds omitted); '' = no change. */
export function diffCountsText(counts: Record<CellChangeKind, number>): string {
  const words: Array<[CellChangeKind, string]> = [
    ['added', 'added'],
    ['removed', 'removed'],
    ['moved', 'moved/resized'],
    ['changed', 'changed'],
  ];
  return words
    .filter(([k]) => counts[k] > 0)
    .map(([k, w]) => `${counts[k]} ${w}`)
    .join(', ');
}
