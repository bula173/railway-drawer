/**
 * @file sync.ts
 * @brief Drawing -> text: compares the generated cells of a tab with the snapshot taken after the
 *        last apply/sync and writes the user's drawing edits into the script's YAML document
 *        (eemeli/yaml Document API: comments and the style of untouched nodes are kept):
 *        - a moved object near its track -> `at` (km of its projection, metres) and `track`; a
 *          snapped object's new `rdKm`/`rdTrackId` win; far from any track -> `x`/`y` (centre),
 *        - a moved track -> `lane` (on the lane grid) or `y`, and `x` when moved sideways,
 *        - data edits (Data panel) -> the matching script keys (km -> at, signalType -> type, ...),
 *        - deleted generated cells -> the item is removed,
 *        - new railway objects on a script track (palette inserts) and new routes between script
 *          signals (Route tool) -> appended to their list.
 *        Points legs, section lines, route paths and generated members (balises of a group given
 *        by a count, buffer stops given as "start"/"end") are derived: moving them changes nothing.
 */
import { Document, isMap, isScalar, isSeq, parseDocument, Scalar } from 'yaml';
import type { YAMLMap, YAMLSeq } from 'yaml';
import type { Cell, GraphDataModel } from '@maxgraph/core';
import type { KindId } from '../railway/catalogue';
import { getKind, parseNumber, splitRefList } from '../railway/catalogue';
import type { Pt } from '../railway/geometry';
import { centerOf, trackPolyline } from '../railway/geometry';
import { formatChainage, kmAtPoint, kmScaleOf } from '../railway/km';
import { allCells, getCellKind, isElementValue, readObjectId } from '../railway/object-data';
import { parsePointsList } from '../railway/routes';
import { SNAP_DISTANCE } from '../railway/snap';
import { collectObjects } from '../railway/validation';
import type { RailObject } from '../railway/validation';
import { adoptableCells, generatedCells, scriptKeyOf } from './apply';
import { COMPUTED_FIELDS, EXTRA_ATTRS, ON_TRACK_KINDS, listForKind, matchKey, scriptKeysForField } from './language';
import type { ScriptModel, ScriptObject, TrackObject } from './model';
import type { JsonPath } from './validate';

export interface SnapshotEntry {
  obj: ScriptObject;
  cell: Cell;
  centre: Pt | null;
  line: Pt[] | null;
  attrs: Record<string, string>;
}

export type Snapshot = Map<string, SnapshotEntry>;

function attrsOf(cell: Cell): Record<string, string> {
  const v = cell.getValue();
  const out: Record<string, string> = {};
  if (isElementValue(v)) for (const a of Array.from(v.attributes)) out[a.name] = a.value;
  return out;
}

/** The live cell of each script object: its generated cell, else an unmarked object with its kind and ID. */
export function matchCells(model: GraphDataModel, sm: ScriptModel): Map<string, Cell> {
  const { byKey } = generatedCells(model);
  const adoptable = adoptableCells(model);
  const out = new Map<string, Cell>();
  for (const [mk, obj] of sm.byMatch) {
    const cell = byKey.get(obj.key) ?? adoptable.get(mk);
    if (cell) out.set(mk, cell);
  }
  return out;
}

export function takeSnapshot(model: GraphDataModel, sm: ScriptModel): Snapshot {
  const snap: Snapshot = new Map();
  for (const [mk, cell] of matchCells(model, sm)) {
    const obj = sm.byMatch.get(mk)!;
    snap.set(mk, { obj, cell, centre: cell.isEdge() ? null : centerOf(cell), line: cell.isEdge() ? trackPolyline(cell) : null, attrs: attrsOf(cell) });
  }
  return snap;
}

// ---------------------------------------------------------------------------------------------
// Edits
// ---------------------------------------------------------------------------------------------

export type ScriptEdit =
  | { op: 'set'; path: JsonPath; value: unknown; format?: 'km' }
  | { op: 'unset'; path: JsonPath }
  | { op: 'delete'; path: JsonPath }
  | { op: 'append'; list: string; item: Record<string, unknown> };

const r3 = (n: number): number => Math.round(n * 1000) / 1000;
const r1 = (n: number): number => Math.round(n * 10) / 10;

function moved(a: Pt | null, b: Pt | null): boolean {
  if (!a || !b) return false;
  return Math.hypot(a.x - b.x, a.y - b.y) > 0.5;
}

/** Key of `obj`'s item for field `field`: the one written in the document, else the canonical one. */
function keyIn(doc: Document, obj: ScriptObject, field: string): string {
  const keys = scriptKeysForField(obj.kind, field);
  const item = doc.getIn(obj.path, true);
  if (isMap(item)) for (const k of keys) if (item.has(k)) return k;
  return keys[0];
}

/** Script value for a catalogue field's stored text. */
function scriptValue(kind: KindId, field: string, text: string): unknown {
  const f = getKind(kind)?.fields.find((x) => x.key === field);
  if (!f) return text;
  if (f.type === 'km' || f.type === 'number' || f.type === 'integer') {
    const n = parseNumber(text, f.type);
    return n === null ? text : n;
  }
  if (f.type === 'refList') return splitRefList(text);
  return text;
}

export interface SyncContext {
  doc: Document;
  model: GraphDataModel;
  script: ScriptModel;
  snapshot: Snapshot;
}

/** The edits that bring the script in line with the drawing. */
export function drawingEdits(ctx: SyncContext): ScriptEdit[] {
  const { doc, model, script, snapshot } = ctx;
  const edits: ScriptEdit[] = [];
  const live = matchCells(model, script);
  const objects = collectObjects(model);
  const byCell = new Map(objects.map((o) => [o.cell, o]));
  const trackObj = (id: string): RailObject | undefined => objects.find((o) => o.kind.id === 'track' && o.id.toUpperCase() === id.toUpperCase());
  const scriptTrack = (id: string): TrackObject | undefined => script.tracks.find((t) => t.id.toUpperCase() === id.toUpperCase());

  for (const [mk, before] of snapshot) {
    const obj = before.obj;
    const cell = live.get(mk);
    const inModel = cell && model.contains(cell);
    if (!inModel) {
      if (!obj.generatedFrom) edits.push({ op: 'delete', path: obj.path });
      continue;
    }
    if (obj.generatedFrom) continue;
    const now = attrsOf(cell);
    const def = getKind(obj.kind)!;
    const set = (field: string, value: unknown, format?: 'km'): void => {
      edits.push({ op: 'set', path: [...obj.path, keyIn(doc, obj, field)], value, format });
    };
    const handled = new Set<string>();

    // ---- position
    if (obj.kind === 'track') {
      const a = before.line;
      const b = trackPolyline(cell);
      if (a && b && a.length > 0 && b.length > 0 && moved(a[0], b[0])) {
        const dx = b[0].x - a[0].x;
        const dy = b[0].y - a[0].y;
        const t = obj as TrackObject;
        if (Math.abs(dy) > 0.5) {
          const laneNow = (b[0].y - script.page.originY) / script.page.laneSpacing;
          if (Math.abs(laneNow - Math.round(laneNow)) < 0.01 && t.y === undefined) {
            edits.push({ op: 'set', path: [...obj.path, 'lane'], value: Math.round(laneNow) });
          } else edits.push({ op: 'set', path: [...obj.path, 'y'], value: r1(b[0].y) });
        }
        if (Math.abs(dx) > 0.5) edits.push({ op: 'set', path: [...obj.path, 'x'], value: r1(b[0].x) });
      }
    } else if (cell.isVertex() && ON_TRACK_KINDS.has(obj.kind) && obj.kind !== 'points') {
      const c = centerOf(cell);
      const kmAttr = 'rdKm';
      const trackAttr = 'rdTrackId';
      const kmChanged = (now[kmAttr] ?? '') !== (before.attrs[kmAttr] ?? '');
      const trackChanged = (now[trackAttr] ?? '') !== (before.attrs[trackAttr] ?? '');
      if (moved(before.centre, c) || kmChanged || trackChanged) {
        let trackId = (now[trackAttr] || obj.trackId || '').trim();
        let km: number | null = kmChanged ? parseNumber(now[kmAttr], 'km') : null;
        let onTrack = kmChanged && !!scriptTrack(trackId);
        if (!onTrack && c) {
          // nearest script track within the snap distance (its own first)
          const candidates = [trackId, ...script.tracks.map((t) => t.id)].filter((x, i, arr) => x && arr.indexOf(x) === i);
          for (const id of candidates) {
            const t = trackObj(id);
            const scale = t ? kmScaleOf(t) : null;
            const k = scale ? kmAtPoint(scale, c, SNAP_DISTANCE + 20) : null;
            if (k !== null) {
              km = k;
              trackId = t!.id;
              onTrack = true;
              break;
            }
          }
        }
        if (onTrack && km !== null) {
          const st = scriptTrack(trackId)!;
          const existing = doc.getIn([...obj.path, 'at'], true);
          set('km', isScalar(existing) && typeof existing.value === 'string' ? formatChainage(km) : r3(km), 'km');
          if (st.id.toUpperCase() !== (obj.trackId ?? '').toUpperCase()) edits.push({ op: 'set', path: [...obj.path, 'track'], value: st.id });
          for (const k of ['x', 'y']) if (doc.hasIn([...obj.path, k])) edits.push({ op: 'unset', path: [...obj.path, k] });
        } else if (c && moved(before.centre, c)) {
          edits.push({ op: 'set', path: [...obj.path, 'x'], value: r1(c.x) });
          edits.push({ op: 'set', path: [...obj.path, 'y'], value: r1(c.y) });
        }
      }
      handled.add('km').add('trackId');
    } else if (cell.isVertex() && obj.kind === 'rbc') {
      const c = centerOf(cell);
      if (c && moved(before.centre, c)) {
        edits.push({ op: 'set', path: [...obj.path, 'x'], value: r1(c.x) });
        edits.push({ op: 'set', path: [...obj.path, 'y'], value: r1(c.y) });
      }
    }

    // ---- data
    if (obj.kind === 'route') {
      const changed = (attr: string): boolean => (now[attr] ?? '') !== (before.attrs[attr] ?? '');
      if (changed('rdEntrySignal')) set('entrySignal', now.rdEntrySignal ?? '');
      if (changed('rdExitSignal')) set('exitSignal', now.rdExitSignal ?? '');
      if (changed('rdPoints')) {
        const via = Object.fromEntries(parsePointsList(now.rdPoints).entries.map((e) => [e.id, e.position]));
        const at = doc.hasIn([...obj.path, 'points']) ? 'points' : 'via';
        edits.push(Object.keys(via).length > 0 ? { op: 'set', path: [...obj.path, at], value: at === 'points' ? now.rdPoints : via } : { op: 'unset', path: [...obj.path, at] });
      }
      for (const field of ['overlap', 'sections', 'notes']) {
        const attr = def.fields.find((f) => f.key === field)!.attr;
        if (changed(attr)) {
          const v = now[attr] ?? '';
          edits.push(v ? { op: 'set', path: [...obj.path, keyIn(doc, obj, field)], value: scriptValue('route', field, v) } : { op: 'unset', path: [...obj.path, keyIn(doc, obj, field)] });
        }
      }
      continue;
    }
    const computed = new Set(COMPUTED_FIELDS[obj.kind] ?? []);
    for (const f of def.fields) {
      if (f.key === 'id' || handled.has(f.key) || computed.has(f.key)) continue;
      if (obj.kind === 'baliseGroup' && f.key === 'count') continue;
      if (obj.kind === 'axleCounter' && f.key === 'sections') continue;
      const a = before.attrs[f.attr] ?? '';
      const b = now[f.attr] ?? '';
      if (a === b) continue;
      if (obj.kind === 'track' && (f.key === 'kmStart' || f.key === 'kmEnd')) {
        const key = keyIn(doc, obj, f.key);
        const metresKey = f.key === 'kmStart' ? ['start', 'StartPos'] : ['end', 'EndPos'];
        const item = doc.getIn(obj.path, true);
        const mKey = isMap(item) ? metresKey.find((k) => item.has(k)) : undefined;
        const n = parseNumber(b, 'km');
        if (n === null) continue;
        if (mKey && !(isMap(item) && item.has(key))) edits.push({ op: 'set', path: [...obj.path, mKey], value: r1(n * 1000) });
        else edits.push({ op: 'set', path: [...obj.path, key], value: r3(n), format: 'km' });
        continue;
      }
      if (obj.kind === 'track' && f.key === 'length') continue;
      const key = keyIn(doc, obj, f.key);
      edits.push(b === '' ? { op: 'unset', path: [...obj.path, key] } : { op: 'set', path: [...obj.path, key], value: scriptValue(obj.kind, f.key, b) });
    }
    for (const [key, attr] of Object.entries(EXTRA_ATTRS[obj.kind] ?? {})) {
      if (key === 'track' || key === 'at' || key === 'lane' || key === 'to') continue;
      const a = before.attrs[attr] ?? '';
      const b = now[attr] ?? '';
      if (a !== b) edits.push(b === '' ? { op: 'unset', path: [...obj.path, key] } : { op: 'set', path: [...obj.path, key], value: b });
    }
  }

  // ---- routes from/to a deleted signal go too (they could not be drawn any more)
  const deletedSignals = new Set(
    edits.filter((e): e is Extract<ScriptEdit, { op: 'delete' }> => e.op === 'delete').map((e) => [...snapshot.values()].find((s) => s.obj.path === e.path)?.obj).filter((o) => o?.kind === 'signal').map((o) => o!.id.toUpperCase())
  );
  if (deletedSignals.size > 0) {
    for (const r of script.routes) {
      const gone = deletedSignals.has(r.from.toUpperCase()) || deletedSignals.has(r.to.toUpperCase());
      if (gone && !edits.some((e) => e.op === 'delete' && e.path === r.path)) edits.push({ op: 'delete', path: r.path });
    }
  }

  // ---- new objects: unmarked railway cells on a script track, routes between script signals
  const known = new Set(script.byMatch.keys());
  for (const cell of allCells(model)) {
    if (scriptKeyOf(cell)) continue;
    const kind = getCellKind(cell);
    const id = kind ? readObjectId(cell) : '';
    if (!kind || !id || known.has(matchKey(kind, id))) continue;
    const o = byCell.get(cell);
    if (!o) continue;
    if (kind === 'route') {
      const from = o.values.entrySignal ?? '';
      const to = o.values.exitSignal ?? '';
      if (!script.byMatch.has(matchKey('signal', from)) || !script.byMatch.has(matchKey('signal', to))) continue;
      const item: Record<string, unknown> = { id, from: script.byMatch.get(matchKey('signal', from))!.id, to: script.byMatch.get(matchKey('signal', to))!.id };
      const via = parsePointsList(o.values.points).entries.filter((e) => e.position === 'reverse');
      if (via.length > 0) item.via = Object.fromEntries(via.map((e) => [e.id, e.position]));
      edits.push({ op: 'append', list: 'routes', item });
      known.add(matchKey(kind, id));
      continue;
    }
    if (!ON_TRACK_KINDS.has(kind) || kind === 'points' || kind === 'baliseGroup' || !cell.isVertex()) continue;
    const st = scriptTrack(o.values.trackId ?? '');
    if (!st) continue;
    let km = parseNumber(o.values.km, 'km');
    const c = centerOf(cell);
    if (km === null && c) {
      const t = trackObj(st.id);
      const scale = t ? kmScaleOf(t) : null;
      km = scale ? kmAtPoint(scale, c) : null;
    }
    if (km === null) continue;
    const item: Record<string, unknown> = { id, track: st.id, at: r3(km) };
    const computed = new Set(COMPUTED_FIELDS[kind] ?? []);
    for (const f of getKind(kind)!.fields) {
      if (['id', 'km', 'trackId'].includes(f.key) || computed.has(f.key)) continue;
      const v = o.values[f.key];
      if (v) item[scriptKeysForField(kind, f.key)[0]] = scriptValue(kind, f.key, v);
    }
    edits.push({ op: 'append', list: listForKind(kind), item });
    known.add(matchKey(kind, id));
  }
  return edits;
}

// ---------------------------------------------------------------------------------------------
// Writing edits into the document
// ---------------------------------------------------------------------------------------------

function kmScalar(value: number): Scalar {
  const s = new Scalar(value);
  s.minFractionDigits = 3;
  return s;
}

/** Applies the edits to `doc` (in place). Deletions run last, highest index first. */
export function applyEdits(doc: Document, edits: ScriptEdit[]): void {
  for (const e of edits) {
    if (e.op === 'set') {
      const existing = doc.getIn(e.path, true);
      if (isScalar(existing) && (typeof e.value !== 'object' || e.value === null)) {
        if (e.format === 'km' && typeof e.value === 'number') {
          existing.value = e.value;
          existing.minFractionDigits = 3;
        } else existing.value = e.value;
        continue;
      }
      const node = e.format === 'km' && typeof e.value === 'number' ? kmScalar(e.value) : doc.createNode(e.value);
      const parent = doc.getIn(e.path.slice(0, -1), true);
      if (isMap(parent) && (parent as YAMLMap).flow && isMap(node)) (node as YAMLMap).flow = true;
      if (isSeq(node) && isMap(parent) && (parent as YAMLMap).flow) (node as YAMLSeq).flow = true;
      doc.setIn(e.path, node);
    } else if (e.op === 'unset') {
      if (doc.hasIn(e.path)) doc.deleteIn(e.path);
    } else if (e.op === 'append') {
      const node = doc.createNode(e.item) as YAMLMap;
      node.flow = true;
      const list = doc.getIn([e.list], true);
      if (isSeq(list)) list.add(node);
      else {
        const seq = doc.createNode([]) as YAMLSeq;
        seq.add(node);
        doc.setIn([e.list], seq);
      }
    }
  }
  const deletes = edits.filter((e): e is Extract<ScriptEdit, { op: 'delete' }> => e.op === 'delete');
  // deepest / highest index first, so earlier deletions do not shift later paths
  deletes.sort((a, b) => {
    for (let i = 0; i < Math.min(a.path.length, b.path.length); i++) {
      const x = a.path[i];
      const y = b.path[i];
      if (x === y) continue;
      if (typeof x === 'number' && typeof y === 'number') return y - x;
      return String(y).localeCompare(String(x));
    }
    return b.path.length - a.path.length;
  });
  for (const d of deletes) if (doc.hasIn(d.path)) doc.deleteIn(d.path);
}

/** Source text of a scalar value, in the style of the scalar it replaces. */
function scalarSource(existing: Scalar, value: unknown, json: boolean, km: boolean): string {
  if (typeof value === 'number') {
    const digits = km ? Math.max(3, existing.minFractionDigits ?? 0) : existing.minFractionDigits ?? 0;
    return digits > 0 && Number.isFinite(value) ? value.toFixed(digits) : String(value);
  }
  if (typeof value === 'boolean' || value === null) return String(value);
  const text = String(value);
  if (json || existing.type === Scalar.QUOTE_DOUBLE) return JSON.stringify(text);
  if (existing.type === Scalar.QUOTE_SINGLE) return `'${text.replace(/'/g, "''")}'`;
  // plain when YAML reads it back as the same string
  const plain = new Document(text).toString().trimEnd();
  return plain;
}

/**
 * The new text after the edits. Changed values of existing scalars are spliced into the original
 * text (everything else stays byte for byte: comments, alignment, quoting); edits that change the
 * structure (new keys, deleted or appended items) re-serialize the document (comments kept,
 * spacing normalized by the YAML printer).
 */
export function editText(text: string, edits: ScriptEdit[], json: boolean): string {
  const doc = parseDocument(text);
  const splices: Array<{ from: number; to: number; text: string }> = [];
  const rest: ScriptEdit[] = [];
  for (const e of edits) {
    if (e.op === 'set' && (typeof e.value !== 'object' || e.value === null)) {
      const node = doc.getIn(e.path, true);
      if (isScalar(node) && node.range && node.type !== Scalar.BLOCK_FOLDED && node.type !== Scalar.BLOCK_LITERAL) {
        splices.push({ from: node.range[0], to: node.range[1], text: scalarSource(node, e.value, json, e.format === 'km') });
        continue;
      }
    }
    rest.push(e);
  }
  splices.sort((a, b) => b.from - a.from);
  let out = text;
  for (const sp of splices) out = out.slice(0, sp.from) + sp.text + out.slice(sp.to);
  if (rest.length === 0) return out;
  const doc2 = parseDocument(out);
  applyEdits(doc2, rest);
  return documentText(doc2, json);
}

/** The document as text: YAML (comments kept) or JSON when the script was written as JSON. */
export function documentText(doc: Document, json: boolean): string {
  if (json) return `${JSON.stringify(doc.toJS(), null, 2)}\n`;
  return doc.toString({ lineWidth: 0, flowCollectionPadding: true });
}
