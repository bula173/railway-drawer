/**
 * @file import.ts
 * @brief railML 3.2 import: a railML document -> a new draw.io diagram model (`<mxGraphModel>`
 *        XML) with railway objects drawn with the ERTMS library symbols, their rd* data, and the
 *        routes on the Routes layer. Model only (DOM + maxGraph model), runs in jsdom.
 *
 * Layout: the `infrastructureVisualization` projections when every netElement has one (our own
 * exports), otherwise a schematic layout from the topology (left to right along each netElement,
 * lengths from km/`length`, the diverging branch of each switch one lane below/above: right-hand
 * branches below when the switch faces the nominal direction: the hand is read from the toe,
 * railway/hand.ts).
 *
 * Content the importer does not map is kept in a PreservedStore on the root cell (preserve.ts) and
 * written back by the export.
 */
import { Cell, GraphDataModel } from '@maxgraph/core';
import type { KindId } from '../railway/catalogue';
import { formatStoredNumber, getKind } from '../railway/catalogue';
import type { Pt } from '../railway/geometry';
import { centerOf } from '../railway/geometry';
import type { Hand } from '../railway/hand';
import { legSide } from '../railway/hand';
import { ID_PLACEHOLDER, buildDataValue } from '../railway/object-data';
import { ensureRoutesLayer, routeEdgeStyle, routeGeometry, simplifyLine } from '../railway/route-store';
import { findRoutePaths, formatPointsList } from '../railway/routes';
import { snapOffset } from '../railway/snap';
import { buildTopology, directionAt, isNominalDirection, pointAlong, polylineLength, subPolyline } from '../railway/topology';
import { collectObjects, indexObjects } from '../railway/validation';
import { exportModelToDrawioXml, importDrawioXmlIntoModel, registerDrawioCodecs } from '../services/drawio-xml';
import type { LibraryEntry } from '../drawio-shapes/engine';
import { RAILML_ID_ATTR, RAILML_IL_ID_ATTR, RAILML_NE_ATTR, RAILML_TVD_ATTR } from './export';
import { protectionFromRailml, technologyFromRailml } from './mapping';
import { PRESERVED_ATTR, PreservedStore, pathOf } from './preserve';
import { BALISE_GROUP_STYLE, ModelBuilder, SECTION_LINE_STYLE, Symbols, defaultSize, fallbackStyle } from './schematic';
import { DC_NS, RAILML_NS, RD_NS, RD_REGISTER, childNamed, childrenNamed, parseXml, pathNamed } from './xml';

export interface RailmlImportOptions {
  /** ERTMS library entries (public/libraries/ertms.xml) for the symbols; built-in shapes without. */
  symbols?: LibraryEntry[];
}

export interface RailmlImportResult {
  /** draw.io `<mxGraphModel>` of the new diagram. */
  modelXml: string;
  model: GraphDataModel;
  /** Diagram name (dc:title). */
  name: string;
  warnings: string[];
  /** Objects created, by kind. */
  counts: Partial<Record<KindId, number>>;
  /** Unknown railML items kept for the re-export. */
  preserved: number;
  /** Layout from the file's visualization (else generated). */
  usedVisualization: boolean;
}

// ---------------------------------------------------------------------------------------------
// What the importer understands (everything else is preserved)
// ---------------------------------------------------------------------------------------------

const CONTAINERS: Record<string, readonly string[]> = {
  railML: ['metadata', 'common', 'infrastructure', 'interlocking', 'visualizations'],
  common: ['positioning'],
  positioning: ['linearPositioningSystems'],
  linearPositioningSystems: ['linearPositioningSystem'],
  infrastructure: ['topology', 'functionalInfrastructure'],
  topology: ['netElements', 'netRelations', 'networks'],
  netElements: ['netElement'],
  netRelations: ['netRelation'],
  functionalInfrastructure: ['tracks', 'switchesIS', 'signalsIS', 'balises', 'baliseGroups', 'trainDetectionElements', 'bufferStops', 'levelCrossingsIS'],
  tracks: ['track'],
  switchesIS: ['switchIS'],
  signalsIS: ['signalIS'],
  balises: ['balise'],
  baliseGroups: ['baliseGroup'],
  trainDetectionElements: ['trainDetectionElement'],
  bufferStops: ['bufferStop'],
  levelCrossingsIS: ['levelCrossingIS'],
  interlocking: ['assetsForInterlockings', 'radioBlockCentres'],
  assetsForInterlockings: ['assetsForInterlocking'],
  assetsForInterlocking: ['tvdSections', 'switchesIL', 'signalsIL', 'routes', 'overlaps'],
  tvdSections: ['tvdSection'],
  switchesIL: ['switchIL'],
  signalsIL: ['signalIL'],
  routes: ['route'],
  overlaps: ['overlap'],
  radioBlockCentres: ['radioBlockCentre'],
  visualizations: ['infrastructureVisualizations'],
  infrastructureVisualizations: ['infrastructureVisualization'],
};

interface ItemRule {
  children: readonly string[];
  attrs: readonly string[];
}

const LOC = ['name', 'designator', 'spotLocation'];
const ITEMS: Record<string, ItemRule> = {
  track: { children: ['name', 'designator', 'linearLocation'], attrs: ['id'] },
  switchIS: { children: [...LOC, 'leftBranch', 'rightBranch'], attrs: ['id', 'continueCourse', 'branchCourse'] },
  signalIS: { children: [...LOC, 'isEtcsSignal', 'isTrainMovementSignal', 'signalConstruction'], attrs: ['id', 'isSwitchable'] },
  balise: { children: [...LOC, 'isEurobalise'], attrs: ['id', 'belongsToBaliseGroup'] },
  baliseGroup: { children: [...LOC, 'applicationType', 'isEurobaliseGroup'], attrs: ['id', 'numberOfBalisesInGroup'] },
  trainDetectionElement: { children: LOC, attrs: ['id', 'type', 'detectedObject'] },
  bufferStop: { children: LOC, attrs: ['id'] },
  levelCrossingIS: { children: [...LOC, 'protection'], attrs: ['id'] },
  tvdSection: { children: ['designator', 'hasDemarcatingTraindetector'], attrs: ['id', 'technology'] },
  switchIL: { children: ['designator', 'refersTo', 'branchLeft', 'branchRight'], attrs: ['id'] },
  signalIL: { children: ['designator', 'refersTo'], attrs: ['id', 'function'] },
  route: { children: ['designator', 'facingSwitchInPosition', 'trailingSwitchInPosition', 'hasTvdSection', 'routeEntry', 'routeExit'], attrs: ['id'] },
  overlap: { children: ['designator', 'activeForApproachRoute', 'hasTvdSection'], attrs: ['id'] },
  radioBlockCentre: { children: ['designator'], attrs: ['id'] },
};

/** Attributes the export writes with these values anyway (not worth preserving). */
const DEFAULT_ATTRS: Record<string, Record<string, string>> = {
  track: { type: 'mainTrack' },
  switchIS: { type: 'ordinarySwitch' },
};

/** Attributes known only with these values (others, e.g. signalIL@function="exit", are preserved). */
const KNOWN_VALUES: Record<string, Record<string, readonly string[]>> = {
  signalIL: { function: ['main', 'shunting'] },
  tvdSection: { technology: ['axleCounter', 'trackCircuit'] },
  trainDetectionElement: { type: ['axleCounter', 'axleCountingCircuit', 'insulatedRailJoint'], detectedObject: ['axle'] },
};

/**
 * Children the export writes once per item: their unknown attributes and children are preserved
 * with the owner `<item id>/<child name>`.
 */
const CHILD_RULES: Record<string, ItemRule> = {
  spotLocation: { children: ['linearCoordinate'], attrs: ['id', 'netElementRef', 'intrinsicCoord', 'applicationDirection'] },
  linearLocation: { children: ['associatedNetElement'], attrs: ['id'] },
  leftBranch: { children: [], attrs: ['netRelationRef'] },
  rightBranch: { children: [], attrs: ['netRelationRef'] },
  signalConstruction: { children: [], attrs: ['type', 'positionAtTrack'] },
  protection: { children: [], attrs: ['barriers', 'lights', 'hasActiveProtection'] },
  isEurobalise: { children: [], attrs: ['positionInGroup'] },
  isEurobaliseGroup: { children: [], attrs: ['countryID', 'groupID'] },
  routeEntry: { children: ['refersTo'], attrs: ['id'] },
  routeExit: { children: ['refersTo', 'hasOverlap'], attrs: ['id'] },
};

/** Keeps what the export of a mapped item would not write again. */
function preserveItem(store: PreservedStore, el: Element): void {
  const id = el.getAttribute('id') ?? '';
  const rule = ITEMS[el.localName];
  if (!id || !rule) return;
  let firstName = true;
  const seen = new Set<string>();
  for (const child of Array.from(el.children)) {
    const name = child.localName;
    let ours = child.namespaceURI === RAILML_NS && rule.children.includes(name);
    if (ours && name === 'designator') ours = child.getAttribute('register') === RD_REGISTER;
    if (ours && name === 'name') ours = firstName && child.getAttribute('language') !== null;
    if (name === 'name') firstName = false;
    const childRule = CHILD_RULES[name];
    if (ours && childRule && seen.has(name)) ours = false;
    if (!ours) {
      store.addElement(child, { owner: id });
      continue;
    }
    seen.add(name);
    if (childRule) {
      const owner = `${id}/${name}`;
      for (const grand of Array.from(child.children)) {
        if (grand.namespaceURI !== RAILML_NS || !childRule.children.includes(grand.localName)) store.addElement(grand, { owner });
      }
      store.addAttributes(owner, child, new Set(childRule.attrs));
    }
  }
  const known = new Set(rule.attrs);
  const values = KNOWN_VALUES[el.localName] ?? {};
  for (const [attr, ok] of Object.entries(values)) {
    const v = el.getAttribute(attr);
    if (v !== null && !ok.includes(v)) known.delete(attr);
  }
  store.addAttributes(id, el, known, DEFAULT_ATTRS[el.localName]);
}

/** Id of our visualization in exports (owner of preserved projections). */
const VIS_ID = 'vis01';

// ---------------------------------------------------------------------------------------------
// Parsed model
// ---------------------------------------------------------------------------------------------

interface NeData {
  id: string;
  length: number | null;
  m0: number | null;
  m1: number | null;
  line: Pt[] | null;
}

interface RelData {
  id: string;
  a: string;
  b: string;
  posA: 0 | 1;
  posB: 0 | 1;
}

interface Loc {
  ne: string;
  coord: number;
  dir: string;
  km: number | null;
}

interface Item {
  kind: KindId;
  railId: string;
  el: Element;
  values: Record<string, string>;
  loc: Loc | null;
  ext: Record<string, string> | null;
  /** Id of the signalIL/switchIL of a signal/points. */
  ilId?: string;
  /** Route: its railML TVD sections (hasTvdSection). */
  tvdSections?: string;
}

/** Imports a railML document. Throws when it is not readable railML. */
export function importRailml(text: string, options: RailmlImportOptions = {}): RailmlImportResult {
  const doc = parseXml(text);
  const root = doc.documentElement;
  if (root.localName !== 'railML') throw new Error(`Not a railML file: the root element is <${root.localName}>`);
  const warnings: string[] = [];
  const version = root.getAttribute('version') ?? '';
  if (root.namespaceURI !== RAILML_NS || (version && version !== '3.2')) {
    warnings.push(`The file is railML ${version || '(no version)'} in namespace ${root.namespaceURI ?? '(none)'}; it is read as railML 3.2, unknown parts are kept unchanged.`);
  }
  const store = new PreservedStore();

  // ---- containers: unknown children preserved by path
  const firstOnly = new Set(['assetsForInterlocking', 'infrastructureVisualization']);
  const walk = (el: Element): void => {
    const known = CONTAINERS[el.localName];
    const seen = new Set<string>();
    for (const child of Array.from(el.children)) {
      if (el.localName === 'metadata') {
        if (!(child.namespaceURI === DC_NS && ['title', 'creator', 'date'].includes(child.localName))) store.addElement(child, { path: pathOf(el) });
        continue;
      }
      if (child.namespaceURI === RD_NS && child.localName === 'railwayDrawer' && el === root) continue;
      if (child.localName === 'networks' && child.namespaceURI === RAILML_NS) continue;
      const ok = child.namespaceURI === RAILML_NS && known?.includes(child.localName) && !(firstOnly.has(child.localName) && seen.has(child.localName));
      if (!ok) {
        store.addElement(child, { path: pathOf(el) });
        continue;
      }
      seen.add(child.localName);
      if (CONTAINERS[child.localName] || child.localName === 'metadata') walk(child);
    }
  };
  walk(root);

  // ---- extension
  const extByRef = new Map<string, Record<string, string>>();
  const extFree: Record<string, string>[] = [];
  const extEl = Array.from(root.children).find((c) => c.namespaceURI === RD_NS && c.localName === 'railwayDrawer') ?? null;
  for (const o of Array.from(extEl?.children ?? [])) {
    if (o.namespaceURI !== RD_NS || o.localName !== 'object') continue;
    const attrs: Record<string, string> = {};
    for (const a of Array.from(o.attributes)) attrs[a.name] = a.value;
    if (attrs.ref) extByRef.set(attrs.ref, attrs);
    else extFree.push(attrs);
  }
  const hasExtension = extEl !== null;

  // ---- positioning systems: measures in metres
  const units = new Map<string, number>();
  for (const lps of childrenNamed(pathNamed(root, 'common', 'positioning', 'linearPositioningSystems'), 'linearPositioningSystem')) {
    const u = (lps.getAttribute('units') ?? 'm').trim();
    units.set(lps.getAttribute('id') ?? '', u === 'km' ? 1000 : u === 'm' || u === '' ? 1 : NaN);
    if (u !== 'km' && u !== 'm' && u !== '') warnings.push(`Positioning system ${lps.getAttribute('id') ?? ''} uses units "${u}": its measures are not used for km`);
  }
  readSpotUnits = units;

  // ---- topology
  const infra = childNamed(root, 'infrastructure');
  const topology = childNamed(infra, 'topology');
  const nes = new Map<string, NeData>();
  for (const ne of childrenNamed(childNamed(topology, 'netElements'), 'netElement')) {
    const id = ne.getAttribute('id');
    if (!id) continue;
    let m0: number | null = null;
    let m1: number | null = null;
    for (const aps of childrenNamed(ne, 'associatedPositioningSystem')) {
      for (const ic of childrenNamed(aps, 'intrinsicCoordinate')) {
        const lc = childNamed(ic, 'linearCoordinate');
        const measure = measureOf(lc, units);
        const t = numAttr(ic, 'intrinsicCoord');
        if (measure === null || t === null) continue;
        if (t === 0 && m0 === null) m0 = measure;
        if (t === 1 && m1 === null) m1 = measure;
      }
    }
    nes.set(id, { id, length: numAttr(ne, 'length'), m0, m1, line: null });
  }
  const rels: RelData[] = [];
  const relById = new Map<string, RelData>();
  for (const r of childrenNamed(childNamed(topology, 'netRelations'), 'netRelation')) {
    const a = childNamed(r, 'elementA')?.getAttribute('ref') ?? '';
    const b = childNamed(r, 'elementB')?.getAttribute('ref') ?? '';
    if (!nes.has(a) || !nes.has(b)) {
      warnings.push(`netRelation ${r.getAttribute('id') ?? '?'} names an unknown netElement: ignored`);
      continue;
    }
    const rel: RelData = { id: r.getAttribute('id') ?? '', a, b, posA: r.getAttribute('positionOnA') === '0' ? 0 : 1, posB: r.getAttribute('positionOnB') === '0' ? 0 : 1 };
    rels.push(rel);
    if (rel.id) relById.set(rel.id, rel);
  }

  // ---- items
  const items: Item[] = [];
  const itemByRailId = new Map<string, Item>();
  const fi = childNamed(infra, 'functionalInfrastructure');
  const ail = pathNamed(root, 'interlocking', 'assetsForInterlockings', 'assetsForInterlocking');
  const readItem = (el: Element, kind: KindId): Item | null => {
    const railId = el.getAttribute('id') ?? '';
    preserveItem(store, el);
    const item: Item = { kind, railId, el, values: { id: designation(el) || railId }, loc: readSpot(el), ext: extByRef.get(railId) ?? null };
    if (!railId) warnings.push(`A <${el.localName}> has no id: imported, but references to it are lost`);
    items.push(item);
    if (railId) itemByRailId.set(railId, item);
    return item;
  };
  const each = (parent: Element | null, container: string, name: string, kind: KindId, fn?: (item: Item) => void): void => {
    for (const el of childrenNamed(childNamed(parent, container), name)) {
      const item = readItem(el, kind);
      if (item && fn) fn(item);
    }
  };
  each(fi, 'tracks', 'track', 'track', (it) => {
    const name = childNamed(it.el, 'name')?.getAttribute('name') ?? '';
    if (name && name !== it.values.id) it.values.name = name;
  });
  each(fi, 'switchesIS', 'switchIS', 'points', (it) => {
    const hand = it.el.getAttribute('branchCourse');
    if (hand === 'left' || hand === 'right') it.values.hand = hand;
  });
  each(fi, 'signalsIS', 'signalIS', 'signal', (it) => {
    if (childNamed(it.el, 'isEtcsSignal')) it.values.signalType = 'markerBoard';
    else if (childNamed(it.el, 'isTrainMovementSignal')) it.values.signalType = 'main';
  });
  each(fi, 'baliseGroups', 'baliseGroup', 'baliseGroup', (it) => {
    const n = it.el.getAttribute('numberOfBalisesInGroup');
    if (n) it.values.count = n;
    const eu = childNamed(it.el, 'isEurobaliseGroup');
    if (eu?.getAttribute('countryID')) it.values.nidC = eu.getAttribute('countryID')!;
    if (eu?.getAttribute('groupID')) it.values.nidBg = eu.getAttribute('groupID')!;
  });
  each(fi, 'balises', 'balise', 'balise', (it) => {
    const pos = numAttr(childNamed(it.el, 'isEurobalise'), 'positionInGroup');
    if (pos !== null) it.values.position = String(pos + 1);
  });
  for (const el of childrenNamed(childNamed(fi, 'trainDetectionElements'), 'trainDetectionElement')) {
    const type = el.getAttribute('type');
    if (type === 'insulatedRailJoint') {
      readItem(el, 'insulatedJoint');
      continue;
    }
    if (type && type !== 'axleCounter' && type !== 'axleCountingCircuit') {
      store.addElement(el, { path: pathOf(el.parentElement!) });
      continue;
    }
    readItem(el, 'axleCounter');
  }
  each(fi, 'bufferStops', 'bufferStop', 'bufferStop');
  each(fi, 'levelCrossingsIS', 'levelCrossingIS', 'levelCrossing', (it) => {
    const p = protectionFromRailml(childNamed(it.el, 'protection'));
    if (p) it.values.protection = p;
  });
  each(ail, 'tvdSections', 'tvdSection', 'trackSection', (it) => {
    const t = technologyFromRailml(it.el.getAttribute('technology'));
    if (t) it.values.sectionType = t;
  });
  each(pathNamed(root, 'interlocking'), 'radioBlockCentres', 'radioBlockCentre', 'rbc');

  // IL objects that only point at IS objects
  const ilTarget = new Map<string, Item>();
  const ilFunction = new Map<string, string>();
  const ilOwn = (el: Element): void => preserveItem(store, el);
  for (const name of ['switchIL', 'signalIL'] as const) {
    for (const el of childrenNamed(childNamed(ail, `${name === 'switchIL' ? 'switchesIL' : 'signalsIL'}`), name)) {
      ilOwn(el);
      const target = itemByRailId.get(childNamed(el, 'refersTo')?.getAttribute('ref') ?? '');
      const id = el.getAttribute('id') ?? '';
      if (target && id) {
        ilTarget.set(id, target);
        target.ilId ??= id;
      }
      if (name === 'signalIL' && target && el.getAttribute('function') === 'shunting' && target.values.signalType === 'main') target.values.signalType = 'shunting';
      if (name === 'signalIL' && target) ilFunction.set(target.railId, el.getAttribute('function') ?? '');
    }
  }
  // axle counters / insulated joints bound sections
  for (const it of items.filter((x) => x.kind === 'trackSection')) {
    for (const d of childrenNamed(it.el, 'hasDemarcatingTraindetector')) {
      const ac = itemByRailId.get(d.getAttribute('ref') ?? '');
      if (ac?.kind === 'axleCounter' || ac?.kind === 'insulatedJoint') ac.values.sections = ac.values.sections ? `${ac.values.sections}, ${it.values.id}` : it.values.id;
    }
  }
  // balise group membership
  for (const it of items.filter((x) => x.kind === 'balise')) {
    const g = itemByRailId.get(it.el.getAttribute('belongsToBaliseGroup') ?? '');
    if (g?.kind === 'baliseGroup') it.values.groupId = g.values.id;
  }

  // routes
  const overlaps = new Map<string, Element>();
  for (const ov of childrenNamed(childNamed(ail, 'overlaps'), 'overlap')) {
    ilOwn(ov);
    if (ov.getAttribute('id')) overlaps.set(ov.getAttribute('id')!, ov);
  }
  const rdIdOf = (railRef: string | null | undefined): string => itemByRailId.get(railRef ?? '')?.values.id ?? '';
  const signalOf = (ref: string | null): Item | undefined => ilTarget.get(ref ?? '') ?? itemByRailId.get(ref ?? '');
  each(ail, 'routes', 'route', 'route', (it) => {
    const entry = signalOf(childNamed(childNamed(it.el, 'routeEntry'), 'refersTo')?.getAttribute('ref') ?? null);
    const exitEl = childNamed(it.el, 'routeExit');
    const exit = signalOf(childNamed(exitEl, 'refersTo')?.getAttribute('ref') ?? null);
    if (entry) it.values.entrySignal = entry.values.id;
    if (exit) it.values.exitSignal = exit.values.id;
    if (!entry || !exit) warnings.push(`Route ${it.values.id}: entry or exit signal not found`);
    const points: Array<{ id: string; position: 'normal' | 'reverse' }> = [];
    for (const tag of ['facingSwitchInPosition', 'trailingSwitchInPosition']) {
      for (const f of childrenNamed(it.el, tag)) {
        const sw = ilTarget.get(childNamed(f, 'refersToSwitch')?.getAttribute('ref') ?? '') ?? itemByRailId.get(childNamed(f, 'refersToSwitch')?.getAttribute('ref') ?? '');
        if (!sw) continue;
        const branch = sw.el.getAttribute('branchCourse');
        points.push({ id: sw.values.id, position: branch && f.getAttribute('inPosition') === branch ? 'reverse' : 'normal' });
      }
    }
    if (points.length > 0) it.values.points = formatPointsList(points);
    const sections = childrenNamed(it.el, 'hasTvdSection').map((h) => rdIdOf(h.getAttribute('ref'))).filter((s) => s);
    if (sections.length > 0) it.values.sections = it.tvdSections = sections.join(', ');
    const ov = overlaps.get(childNamed(exitEl, 'hasOverlap')?.getAttribute('ref') ?? '');
    const ovSections = childrenNamed(ov, 'hasTvdSection').map((h) => rdIdOf(h.getAttribute('ref'))).filter((s) => s);
    if (ovSections.length > 0) it.values.overlap = ovSections.join(', ');
  });
  for (const ext of extFree) {
    const kind = ext.kind as KindId;
    if (!getKind(kind)) continue;
    items.push({ kind, railId: '', el: root, values: {}, loc: null, ext });
  }

  // ---- extension values override (only fields railML does not hold are in it)
  for (const it of items) {
    const kind = getKind(it.kind)!;
    for (const f of kind.fields) {
      const v = it.ext?.[f.attr];
      if (v === undefined) continue;
      if (v === '') delete it.values[f.key];
      else it.values[f.key] = v;
    }
  }

  // ---- ownership of netElements
  const owner = new Map<string, { item: Item; role: 'track' | 'leg' | 'section'; forward: boolean }>();
  const chainOf = new Map<Item, Array<{ ne: string; forward: boolean }>>();
  for (const it of items.filter((x) => x.kind === 'track')) {
    const refs = childrenNamed(childNamed(it.el, 'linearLocation'), 'associatedNetElement')
      .map((a, i) => ({ a, i, seq: numAttr(a, 'sequence') }))
      .sort((x, y) => (x.seq ?? x.i) - (y.seq ?? y.i))
      .map(({ a }) => ({ ne: a.getAttribute('netElementRef') ?? '', forward: !(numAttr(a, 'intrinsicCoordBegin') === 1 && numAttr(a, 'intrinsicCoordEnd') === 0) }))
      .filter((r) => nes.has(r.ne) && !owner.has(r.ne));
    for (const r of refs) owner.set(r.ne, { item: it, role: 'track', forward: r.forward });
    chainOf.set(it, refs);
  }
  for (const it of items) {
    const list = it.ext?.netElements;
    if (!list || (it.kind !== 'points' && it.kind !== 'trackSection')) continue;
    const refs = list
      .split(/\s+/)
      .map((s) => ({ ne: s.replace(/:[+-]$/, ''), forward: !s.endsWith(':-') }))
      .filter((r) => nes.has(r.ne) && !owner.has(r.ne));
    for (const r of refs) owner.set(r.ne, { item: it, role: it.kind === 'points' ? 'leg' : 'section', forward: r.forward });
    chainOf.set(it, refs);
  }

  // ---- switches: toe, diverging netElement, node
  interface SwitchInfo {
    item: Item;
    toe: string;
    toeEnd: 0 | 1;
    diverging: string | null;
    divergingEnd: 0 | 1;
    hand: Hand;
  }
  const switches: SwitchInfo[] = [];
  for (const it of items.filter((x) => x.kind === 'points')) {
    const left = relById.get(childNamed(it.el, 'leftBranch')?.getAttribute('netRelationRef') ?? '');
    const right = relById.get(childNamed(it.el, 'rightBranch')?.getAttribute('netRelationRef') ?? '');
    const branch = it.el.getAttribute('branchCourse') === 'left' ? 'left' : 'right';
    let toe: string | null = null;
    if (left && right) toe = [left.a, left.b].find((n) => n === right.a || n === right.b) ?? null;
    const rel = branch === 'left' ? left ?? right : right ?? left;
    if (!toe && rel && it.loc) toe = rel.a === it.loc.ne || rel.b === it.loc.ne ? it.loc.ne : null;
    if (!rel || !toe) {
      if (!it.ext?.netElements) warnings.push(`Points ${it.values.id}: branches not found in the topology; drawn without a leg`);
      continue;
    }
    const toeEnd = rel.a === toe ? rel.posA : rel.posB;
    const div = rel.a === toe ? rel.b : rel.a;
    const divEnd = rel.a === toe ? rel.posB : rel.posA;
    switches.push({ item: it, toe, toeEnd, diverging: div, divergingEnd: divEnd, hand: branch });
    if (!it.loc) it.loc = { ne: toe, coord: toeEnd, dir: 'both', km: null };
    if (!owner.has(div)) {
      owner.set(div, { item: it, role: 'leg', forward: true });
      chainOf.set(it, [{ ne: div, forward: true }]);
    }
  }

  // ---- geometry: visualization or generated layout
  const vis = pathNamed(root, 'visualizations', 'infrastructureVisualizations', 'infrastructureVisualization');
  const linearVis = new Map<string, Pt[]>();
  const spotVis = new Map<string, Pt>();
  for (const p of Array.from(vis?.children ?? [])) {
    const ref = p.getAttribute('refersToElement') ?? '';
    const pts = childrenNamed(p, 'coordinate')
      .map((c) => ({ x: numAttr(c, 'x'), y: numAttr(c, 'y') ?? 0 }))
      .filter((c): c is Pt => c.x !== null);
    const knownRef = nes.has(ref) || itemByRailId.has(ref);
    if (p.namespaceURI !== RAILML_NS || !knownRef || !['linearElementProjection', 'spotElementProjection'].includes(p.localName)) {
      if (p.namespaceURI !== RAILML_NS || !['name', 'designator'].includes(p.localName)) store.addElement(p, { owner: VIS_ID });
      continue;
    }
    if (p.localName === 'linearElementProjection' && pts.length >= 2) linearVis.set(ref, pts);
    if (p.localName === 'spotElementProjection' && pts.length >= 1) spotVis.set(ref, pts[0]);
  }
  const usedVisualization = nes.size > 0 ? [...nes.keys()].every((id) => linearVis.has(id)) : spotVis.size > 0;
  const legSplit = new Map<string, Pt[]>(); // diverging netElement in a track: the leg part
  if (usedVisualization) {
    for (const ne of nes.values()) ne.line = linearVis.get(ne.id)!;
  } else {
    generateLayout(nes, rels, switches);
    if (vis && nes.size > 0) warnings.push('The visualization does not cover every netElement: a schematic layout was generated instead.');
  }
  // diverging netElements that belong to a track: a short leg at the switch, the rest is track
  for (const sw of switches) {
    if (!sw.diverging || owner.get(sw.diverging)?.role !== 'track') continue;
    const ne = nes.get(sw.diverging)!;
    const line = ne.line!;
    const len = polylineLength(line);
    const atStart = sw.divergingEnd === 0;
    // generated layout: the leg is the diagonal up to the bend; drawn layouts: a short piece
    const bend = !usedVisualization && line.length === 3 ? (atStart ? dist(line[0], line[1]) : dist(line[1], line[2])) : null;
    const legLen = bend ?? Math.min(40, len / 3);
    const leg = atStart ? subPolyline(line, 0, legLen) : subPolyline(line, len - legLen, len);
    legSplit.set(sw.diverging, leg);
    ne.line = atStart ? subPolyline(line, legLen, len) : subPolyline(line, 0, len - legLen);
    chainOf.set(sw.item, [{ ne: `__leg__${sw.diverging}`, forward: true }]);
  }

  // ---- track ids of netElements (for trackId of objects)
  const trackOfNe = (ne: string): string => {
    const o = owner.get(ne);
    if (o?.role === 'track') return o.item.values.id;
    if (o?.role === 'section') return o.item.values.trackId ?? '';
    return '';
  };

  // ---- cells
  const symbols = new Symbols(options.symbols ?? []);
  const b = new ModelBuilder();
  const counts: Partial<Record<KindId, number>> = {};
  const parking: Item[] = [];
  const centres = new Map<Item, Pt>();
  const lineOfChain = (refs: Array<{ ne: string; forward: boolean }>): Pt[] => {
    const out: Pt[] = [];
    for (const r of refs) {
      const base = r.ne.startsWith('__leg__') ? legSplit.get(r.ne.slice(7))! : nes.get(r.ne)?.line;
      if (!base) continue;
      let part = r.forward ? base : [...base].reverse();
      if (out.length > 0) {
        const last = out[out.length - 1];
        const d0 = dist(last, part[0]);
        const d1 = dist(last, part[part.length - 1]);
        if (d1 < d0) part = [...part].reverse();
        out.push(...(dist(last, part[0]) < 0.5 ? part.slice(1) : part));
      } else out.push(...part);
    }
    return simplifyLine(out);
  };

  const dataAttrs = (it: Item): Record<string, string> => {
    const kind = getKind(it.kind)!;
    const attrs: Record<string, string> = { rdKind: it.kind };
    const values = it.values;
    for (const f of kind.fields) if (values[f.key]) attrs[f.attr] = values[f.key];
    if (it.railId) attrs[RAILML_ID_ATTR] = it.railId;
    if (it.ilId) attrs[RAILML_IL_ID_ATTR] = it.ilId;
    for (const [k, v] of Object.entries(it.ext ?? {})) if (k.startsWith('v_')) attrs[k.slice(2)] = v;
    return attrs;
  };
  const count = (k: KindId): void => {
    counts[k] = (counts[k] ?? 0) + 1;
  };

  // spot positions
  const spotPoint = (it: Item, size: { w: number; h: number }): Pt | null => {
    const v = usedVisualization ? spotVis.get(it.railId) : undefined;
    if (v) return v;
    if (it.ext?.x && it.ext?.y) return { x: Number(it.ext.x), y: Number(it.ext.y) };
    if (!it.loc) return null;
    const ne = nes.get(it.loc.ne);
    if (!ne?.line) return null;
    const full = fullLine(ne, legSplit, switches);
    const len = polylineLength(full);
    const along = it.loc.coord * len;
    const p = pointAlong(full, along);
    const dir = directionAt(full, along);
    const off = snapOffset(it.kind, it.values.direction ?? '', { x: 0, y: 0, width: size.w, height: size.h }, dir);
    return { x: p.x + off.x, y: p.y + off.y };
  };
  // directions and km from the location
  for (const it of items) {
    if (!it.loc) continue;
    if (it.loc.km !== null && it.values.km === undefined && !(it.ext && 'rdKm' in it.ext)) it.values.km = formatStoredNumber(it.loc.km / 1000);
    if (['signal', 'balise', 'baliseGroup'].includes(it.kind) && it.values.direction === undefined && !(it.ext && 'rdDirection' in it.ext)) {
      const ne = nes.get(it.loc.ne);
      if (ne?.line && (it.loc.dir === 'normal' || it.loc.dir === 'reverse')) {
        const full = fullLine(ne, legSplit, switches);
        const nominalForward = isNominalDirection(directionAt(full, it.loc.coord * polylineLength(full)));
        it.values.direction = (it.loc.dir === 'normal') === nominalForward ? 'nominal' : 'reverse';
      }
    }
    if (it.values.trackId === undefined && !(it.ext && 'rdTrackId' in it.ext) && it.kind !== 'trackSection') {
      const t = trackOfNe(it.loc.ne);
      if (t) it.values.trackId = t;
    }
  }
  // signal route lists
  for (const r of items.filter((x) => x.kind === 'route')) {
    const sig = items.find((s) => s.kind === 'signal' && s.values.id.toUpperCase() === (r.values.entrySignal ?? '').toUpperCase());
    if (sig && !(sig.ext && 'rdRoutes' in sig.ext)) sig.values.routes = sig.values.routes ? `${sig.values.routes}, ${r.values.id}` : r.values.id;
  }

  // links: tracks, legs, sections
  for (const it of items) {
    if (it.kind !== 'track' && it.kind !== 'points' && it.kind !== 'trackSection') continue;
    const refs = chainOf.get(it);
    if (!refs || refs.length === 0) continue;
    const line = lineOfChain(refs);
    if (line.length < 2) continue;
    if (it.kind === 'track') deriveTrackData(it, refs, nes, hasExtension);
    const style = it.ext?.style ?? (it.kind === 'track' ? symbols.trackStyle() : it.kind === 'points' ? symbols.pointsStyle() : SECTION_LINE_STYLE);
    const neIds = refs.map((r) => r.ne).filter((n) => !n.startsWith('__leg__'));
    b.edge({ ...dataAttrs(it), ...(neIds.length > 0 ? { [RAILML_NE_ATTR]: neIds.join(' ') } : {}) }, style, line);
    if (it.kind === 'track') count('track');
    else count(it.kind);
    it.values.__drawn = '1';
  }
  // netElements without owner: plain tracks
  const anonymous: string[] = [];
  for (const ne of nes.values()) {
    if (owner.has(ne.id) || !ne.line) continue;
    anonymous.push(ne.id);
    b.edge({ rdKind: 'track', rdId: ne.id, [RAILML_NE_ATTR]: ne.id }, symbols.trackStyle(), ne.line);
    count('track');
  }
  if (anonymous.length > 0) warnings.push(`${anonymous.length} netElement${anonymous.length === 1 ? '' : 's'} belong to no track: drawn as tracks named after the netElement (${anonymous.slice(0, 5).join(', ')}${anonymous.length > 5 ? ', …' : ''})`);

  // spot objects and the rest
  for (const it of items) {
    if (it.values.__drawn || it.kind === 'route') continue;
    if (it.kind === 'points') {
      // no leg drawn: compact points vertex at the junction
      const p = spotPoint(it, { w: 16, h: 16 });
      if (p) b.vertex(dataAttrs(it), it.ext?.style ?? 'rhombus;whiteSpace=wrap;html=1;fillColor=#a5a5a5;strokeColor=#404040;', p, sizeOf(it, 16, 16));
      else parking.push(it);
      count('points');
      continue;
    }
    if (it.kind === 'baliseGroup') continue; // after the balises
    const sym = it.ext?.style ? null : symbols.forItem(it);
    const size = sym ? { w: sym.w, h: sym.h } : sizeOf(it, ...defaultSize(it.kind));
    const p = spotPoint(it, size);
    if (!p) {
      parking.push(it);
      continue;
    }
    centres.set(it, p);
    if (sym) b.symbol(sym, dataAttrs(it), p, it.values.id);
    else b.vertex(dataAttrs(it), it.ext?.style ?? fallbackStyle(it.kind), p, size, !it.ext?.style && !it.ext?.v_label);
    count(it.kind);
  }
  // balise groups: around their balises (or at their own location)
  for (const it of items.filter((x) => x.kind === 'baliseGroup')) {
    const members = items.filter((x) => x.kind === 'balise' && (x.values.groupId ?? '').toUpperCase() === it.values.id.toUpperCase() && centres.has(x)).map((x) => centres.get(x)!);
    const own = spotPoint(it, sizeOf(it, 24, 24));
    let size = sizeOf(it, 24, 24);
    let p = own;
    if (members.length > 0 && !it.ext?.w) {
      const xs = members.map((m) => m.x);
      const ys = members.map((m) => m.y);
      size = { w: Math.max(...xs) - Math.min(...xs) + 24, h: Math.max(...ys) - Math.min(...ys) + 24 };
      p = own && usedVisualization ? own : { x: (Math.max(...xs) + Math.min(...xs)) / 2, y: (Math.max(...ys) + Math.min(...ys)) / 2 };
    }
    if (!p) {
      parking.push(it);
      continue;
    }
    b.vertex(dataAttrs(it), it.ext?.style ?? BALISE_GROUP_STYLE, p, size, !it.ext?.style && !it.ext?.v_label, true);
    count('baliseGroup');
  }
  // objects without a place: a row below the drawing
  if (parking.length > 0) {
    const y = b.maxY() + 100;
    parking.forEach((it, i) => {
      const sym = it.ext?.style ? null : symbols.forItem(it);
      const p = { x: 40 + i * 70, y };
      if (sym) b.symbol(sym, dataAttrs(it), p, it.values.id);
      else b.vertex(dataAttrs(it), it.ext?.style ?? fallbackStyle(it.kind), p, sizeOf(it, ...defaultSize(it.kind)), !it.ext?.style && !it.ext?.v_label);
      count(it.kind);
    });
    warnings.push(`${parking.length} object${parking.length === 1 ? ' has' : 's have'} no location on the topology and ${parking.length === 1 ? 'was' : 'were'} put in a row below the drawing: ${parking.map((p) => `${getKind(p.kind)!.label} ${p.values.id || p.railId}`).slice(0, 8).join(', ')}${parking.length > 8 ? ', …' : ''}`);
  }

  // ---- model, then routes (paths through the drawn topology)
  registerDrawioCodecs();
  const model = new GraphDataModel();
  importDrawioXmlIntoModel(b.toXml(), model);
  const routeItems = items.filter((x) => x.kind === 'route');
  if (routeItems.length > 0) {
    const objects = collectObjects(model);
    const index = indexObjects(objects);
    const topo = buildTopology(objects);
    model.beginUpdate();
    try {
      const layer = ensureRoutesLayer(model);
      for (const r of routeItems) {
        const entry = index.get('signal')?.get((r.values.entrySignal ?? '').toUpperCase());
        const exit = index.get('signal')?.get((r.values.exitSignal ?? '').toUpperCase());
        let line: Pt[] | null = null;
        // with our extension the drawing's sections are in rdSections and the TVD list is the railML one
        let tvdList: string | null = r.ext?.rdSections && r.tvdSections ? r.tvdSections : null;
        if (entry && exit) {
          const paths = findRoutePaths(topo, entry, exit, { maxPaths: 16 }).paths;
          const want = (r.values.sections ?? '').toUpperCase().replace(/\s+/g, '');
          const path = paths.find((p) => p.sections.join(',').toUpperCase() === want) ?? paths[0];
          // TVD sections that are not drawn: the route takes the drawing's sections (as the Route tool
          // would), the railML TVD list is kept on the route for the export
          const drawn = new Set(topo.pieces.flatMap((p) => [p.sectionId, p.trackId, p.linkId].map((x) => x.toUpperCase())));
          const listed = (r.values.sections ?? '').split(',').map((x) => x.trim()).filter((x) => x);
          if (path && listed.length > 0 && !listed.every((x) => drawn.has(x.toUpperCase())) && !r.ext?.rdSections) {
            tvdList = listed.join(', ');
            r.values.sections = path.sections.join(', ');
            warnings.push(`Route ${r.values.id}: TVD section${listed.length === 1 ? '' : 's'} ${tvdList} ${listed.length === 1 ? 'is' : 'are'} not drawn; the route's sections are taken from the drawing (${r.values.sections || '—'}), the railML TVD list is kept for the export`);
          }
          if (path) line = path.line;
          else {
            const a = centerOf(entry.cell);
            const c = centerOf(exit.cell);
            if (a && c) line = [a, c];
            warnings.push(`Route ${r.values.id}: no path from ${entry.id} to ${exit.id} in the drawing; drawn as a straight line`);
          }
        }
        const value = buildDataValue('', { kind: 'route', values: stripInternal(r.values) }) as Element;
        value.setAttribute('label', ID_PLACEHOLDER);
        value.setAttribute('placeholders', '1');
        if (r.railId) value.setAttribute(RAILML_ID_ATTR, r.railId);
        if (tvdList) value.setAttribute(RAILML_TVD_ATTR, tvdList);
        const edge = new Cell(value, routeGeometry(line ?? [{ x: 0, y: 0 }, { x: 40, y: 0 }]), routeEdgeStyle());
        edge.setEdge(true);
        model.add(layer, edge);
        count('route');
      }
    } finally {
      model.endUpdate();
    }
  }
  if (store.size > 0) {
    const rootCell = model.getRoot()!;
    const value = document.implementation.createDocument(null, null, null).createElement('object');
    value.setAttribute('label', '');
    value.setAttribute(PRESERVED_ATTR, store.serialize());
    rootCell.setValue(value);
    warnings.push(`${store.size} railML item${store.size === 1 ? '' : 's'} this editor does not show (e.g. ${describePreserved(store)}) ${store.size === 1 ? 'is' : 'are'} kept and written back by File > Export railML.`);
  }
  const title = Array.from(childNamed(root, 'metadata')?.children ?? []).find((c) => c.namespaceURI === DC_NS && c.localName === 'title')?.textContent?.trim() ?? '';
  return { modelXml: exportModelToDrawioXml(model), model, name: title, warnings, counts, preserved: store.size, usedVisualization };
}

function describePreserved(store: PreservedStore): string {
  const names = [...new Set([...store.elements.map((e) => `<${e.node.localName}>`), ...store.attributes.map((a) => `@${a.name}`)])];
  return names.slice(0, 4).join(', ') + (names.length > 4 ? ', …' : '');
}

function stripInternal(values: Record<string, string>): Record<string, string> {
  const out = { ...values };
  delete out.__drawn;
  return out;
}

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

function numAttr(el: Element | null | undefined, name: string): number | null {
  const v = el?.getAttribute(name);
  if (v === null || v === undefined || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function designation(el: Element): string {
  const ds = childrenNamed(el, 'designator');
  const ours = ds.find((d) => d.getAttribute('register') === RD_REGISTER) ?? ds[0];
  const entry = ours?.getAttribute('entry')?.trim();
  if (entry) return entry;
  return childNamed(el, 'name')?.getAttribute('name')?.trim() ?? '';
}

function readSpot(el: Element): Loc | null {
  const sl = childNamed(el, 'spotLocation');
  if (!sl) return null;
  const ne = sl.getAttribute('netElementRef');
  if (!ne) return null;
  const lc = childNamed(sl, 'linearCoordinate');
  return { ne, coord: Math.max(0, Math.min(1, numAttr(sl, 'intrinsicCoord') ?? 0)), dir: sl.getAttribute('applicationDirection') ?? 'both', km: measureOf(lc, readSpotUnits) };
}

/** Units of the positioning systems of the document being read (metres per unit). */
let readSpotUnits = new Map<string, number>();

/** A linearCoordinate's measure in metres (null: none, or a positioning system in other units). */
function measureOf(lc: Element | null, units: Map<string, number>): number | null {
  const m = numAttr(lc, 'measure');
  if (m === null) return null;
  const f = units.get(lc?.getAttribute('positioningSystemRef') ?? '') ?? 1;
  return Number.isFinite(f) ? m * f : null;
}

/** Line of a netElement including a leg split off it (for positions along it). */
function fullLine(ne: NeData, legSplit: Map<string, Pt[]>, switches: Array<{ diverging: string | null; divergingEnd: 0 | 1 }>): Pt[] {
  const leg = legSplit.get(ne.id);
  if (!leg) return ne.line!;
  const atStart = switches.find((s) => s.diverging === ne.id)?.divergingEnd === 0;
  return atStart ? [...leg, ...ne.line!.slice(1)] : [...ne.line!, ...leg.slice(1)];
}

/**
 * km start/end of a track from its first and last netElement ends, length from the netElement
 * lengths. Not for files with our rd extension: it holds the track's own values (or their absence).
 */
function deriveTrackData(it: Item, refs: Array<{ ne: string; forward: boolean }>, nes: Map<string, NeData>, hasExtension: boolean): void {
  const first = nes.get(refs[0].ne);
  const last = nes.get(refs[refs.length - 1].ne);
  if (!first || !last || hasExtension) return;
  const startM = refs[0].forward ? first.m0 : first.m1;
  const endM = refs[refs.length - 1].forward ? last.m1 : last.m0;
  if (startM !== null && endM !== null && it.values.kmStart === undefined && it.values.kmEnd === undefined) {
    it.values.kmStart = formatStoredNumber(startM / 1000);
    it.values.kmEnd = formatStoredNumber(endM / 1000);
  }
  if (it.values.length === undefined && it.values.kmStart === undefined) {
    const metres = refs.reduce((s, r) => s + (nes.get(r.ne)?.length ?? 0), 0);
    if (metres > 0) it.values.length = formatStoredNumber(Math.round(metres * 1000) / 1000);
  }
}

function sizeOf(it: Item, w: number, h: number): { w: number; h: number } {
  const ew = Number(it.ext?.w);
  const eh = Number(it.ext?.h);
  return { w: Number.isFinite(ew) && ew > 0 ? ew : w, h: Number.isFinite(eh) && eh > 0 ? eh : h };
}

// ---------------------------------------------------------------------------------------------
// Generated schematic layout
// ---------------------------------------------------------------------------------------------

function generateLayout(nes: Map<string, NeData>, rels: RelData[], switches: Array<{ toe: string; toeEnd: 0 | 1; diverging: string | null; divergingEnd: 0 | 1; hand: Hand }>): void {
  const key = (ne: string, end: 0 | 1): string => `${ne}:${end}`;
  const parent = new Map<string, string>();
  const find = (k: string): string => {
    let r = k;
    while (parent.has(r) && parent.get(r) !== r) r = parent.get(r)!;
    parent.set(k, r);
    return r;
  };
  const union = (a: string, b: string): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };
  for (const ne of nes.values()) {
    parent.set(key(ne.id, 0), key(ne.id, 0));
    parent.set(key(ne.id, 1), key(ne.id, 1));
  }
  for (const r of rels) union(key(r.a, r.posA), key(r.b, r.posB));
  const lengthOf = (ne: NeData): number => {
    if (ne.m0 !== null && ne.m1 !== null && ne.m0 !== ne.m1) return Math.abs(ne.m1 - ne.m0);
    return ne.length && ne.length > 0 ? ne.length : 100;
  };
  // diverging: cluster of the switch + netElement -> hand
  const diverging = new Map<string, Hand>();
  for (const s of switches) if (s.diverging) diverging.set(`${find(key(s.toe, s.toeEnd))}|${s.diverging}`, s.hand);
  const adj = new Map<string, Array<{ ne: NeData; from: 0 | 1 }>>();
  for (const ne of nes.values()) {
    for (const end of [0, 1] as const) {
      const c = find(key(ne.id, end));
      const list = adj.get(c) ?? [];
      list.push({ ne, from: end });
      adj.set(c, list);
    }
  }
  const pos = new Map<string, { x: number; lane: number }>();
  const order = [...nes.values()].sort((a, b) => (a.m0 ?? Infinity) - (b.m0 ?? Infinity));
  let laneBase = 0;
  for (const startNe of order) {
    const start = find(key(startNe.id, 0));
    if (pos.has(start)) continue;
    pos.set(start, { x: 0, lane: laneBase });
    const queue = [start];
    let minLane = laneBase;
    let maxLane = laneBase;
    const placed: string[] = [start];
    while (queue.length > 0) {
      const c = queue.shift()!;
      const here = pos.get(c)!;
      for (const { ne, from } of adj.get(c) ?? []) {
        const other = find(key(ne.id, from === 0 ? 1 : 0));
        if (pos.has(other)) continue;
        const sign = from === 0 ? 1 : -1;
        const hand = diverging.get(`${c}|${ne.id}`);
        // the leg heads in x direction `sign`; side from the hand read from the toe (hand.ts)
        const lane = here.lane + (hand ? legSide(hand, sign) : 0);
        pos.set(other, { x: here.x + sign * lengthOf(ne), lane });
        minLane = Math.min(minLane, lane);
        maxLane = Math.max(maxLane, lane);
        placed.push(other);
        queue.push(other);
      }
    }
    // make the component start at lane laneBase
    const shift = laneBase - minLane;
    const minX = Math.min(...placed.map((p) => pos.get(p)!.x));
    for (const p of placed) {
      const v = pos.get(p)!;
      pos.set(p, { x: v.x - minX, lane: v.lane + shift });
    }
    laneBase += maxLane - minLane + 2;
  }
  const span = Math.max(1, ...[...pos.values()].map((p) => p.x));
  const scale = Math.min(2, Math.max(0.05, 1200 / span));
  const at = (ne: NeData, end: 0 | 1): Pt => {
    const p = pos.get(find(key(ne.id, end)))!;
    return { x: Math.round(40 + p.x * scale), y: 80 + p.lane * 80 };
  };
  const switchEnds = new Map<string, 0 | 1>();
  for (const s of switches) if (s.diverging) switchEnds.set(s.diverging, s.divergingEnd);
  for (const ne of nes.values()) {
    const p0 = at(ne, 0);
    const p1 = at(ne, 1);
    if (p0.y === p1.y) {
      ne.line = [p0, p1];
      continue;
    }
    const dx = p1.x - p0.x;
    const k = Math.sign(dx || 1) * Math.min(Math.abs(dx) / 2, 60);
    const swEnd = switchEnds.get(ne.id);
    ne.line = swEnd === 1 ? [p0, { x: p1.x - k, y: p0.y }, p1] : [p0, { x: p0.x + k, y: p1.y }, p1];
  }
}
