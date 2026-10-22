/**
 * @file export.ts
 * @brief railML 3.2 export of one diagram (model only, runs in jsdom).
 *
 * - **Topology**: every topology piece (topology.ts: track pieces between junctions, cuts and ends;
 *   points legs; sections drawn as their own lines) is one `<netElement>`, oriented in the nominal
 *   direction (increasing x, vertical: increasing y), so railML `applicationDirection="normal"`
 *   (intrinsic 0 -> 1) is our nominal direction. Length in metres (track `rdLength`/km scale; drawing
 *   units where unknown). Ends get the km of their track as `linearCoordinate`s of the linear
 *   positioning system `lps01` (metres). `<netRelation>`s join the pieces at every node, navigability
 *   from the route tool's `passage()` (Both / None, e.g. between the two branches of points).
 * - **Functional infrastructure / interlocking**: see mapping.ts (KIND_MAPPINGS); locations are
 *   `spotLocation`s on the netElement the object lies on (topology `locate`), points on the toe
 *   piece at the junction.
 * - **Visualization**: cell centres / piece polylines as `infrastructureVisualization` projections
 *   (drawing units, y down), so a re-import restores the layout.
 * - **rd extension** (`rd:railwayDrawer`, last child of the root, optional): data railML cannot hold.
 * - **Preserved** unknown railML of an imported file is written back (preserve.ts).
 */
import { applyProjectDefaults, readCountryId } from '../railway/project-settings';
import type { Cell, GraphDataModel } from '@maxgraph/core';
import type { KindId } from '../railway/catalogue';
import { ALL_DATA_ATTRS, KIND_ATTR, parseNumber, splitRefList } from '../railway/catalogue';
import type { Pt } from '../railway/geometry';
import { centerOf } from '../railway/geometry';
import { kmAtAlong, kmScaleOf } from '../railway/km';
import { isElementValue, readAttr } from '../railway/object-data';
import { findRoutePaths, parsePointsList } from '../railway/routes';
import type { TopoPiece } from '../railway/topology';
import { buildTopology, forwardIsNominal, isNominalDirection, junctionHand, linkLine, locateObject, passage, projectPoint } from '../railway/topology';
import type { Issue, RailObject } from '../railway/validation';
import { collectObjects, indexObjects, validateModel } from '../railway/validation';
import { BASE_STYLE_ATTR, RUNTIME_STATE_ATTRS, parseBaseStyles, styleWithoutState } from '../railway/states';
import { parseStyleString, styleToString } from '../services/drawio-xml';
import { KIND_MAPPINGS, mappingOf, protectionToRailml, technologyToRailml } from './mapping';
import type { ApplyResult } from './preserve';
import { PreservedStore, applyPreserved, readPreserved } from './preserve';
import { ensureOrdered, insertOrdered } from './schema-order';
import {
  DC_NS,
  GML_NS,
  IdAllocator,
  LPS_ID,
  RAILML_NS,
  RAILML_SCHEMA_LOCATION,
  RAILML_VERSION,
  RD_NS,
  RD_REGISTER,
  XMLNS_NS,
  XSI_NS,
  num,
  prettyXml,
  serializeXml,
  setAttrs,
} from './xml';

/** Cell value attribute keeping the railML id an object was imported with (stable re-export). */
export const RAILML_ID_ATTR = 'rdRailmlId';
/** Cell value attribute keeping the signalIL/switchIL id of an imported signal/points. */
export const RAILML_IL_ID_ATTR = 'rdRailmlIlId';
/** Cell value attribute of a route keeping its railML TVD sections when they are not drawn. */
export const RAILML_TVD_ATTR = 'rdRailmlTvdSections';
/** Cell value attribute keeping the netElement ids an imported link was drawn from. */
export const RAILML_NE_ATTR = 'rdRailmlNetElements';

export interface RailmlExportOptions {
  title?: string;
  creator?: string;
  /** ISO date for `dc:date` (default: now). */
  date?: string;
  /** Write the `rd:railwayDrawer` extension (default true). Off = pure railML 3.2. */
  extension?: boolean;
  /** Preserved railML (default: the store on the model's root cell). */
  preserved?: PreservedStore;
  /** Indented output (default true). */
  pretty?: boolean;
}

export interface ExportProblem {
  kind: KindId;
  id: string;
  cellId: string;
  message: string;
}

export interface RailmlExportResult {
  xml: string;
  doc: XMLDocument;
  /** railML elements written, by element name. */
  counts: Record<string, number>;
  /** Objects that could not be placed on the topology (written without a location). */
  unplaced: ExportProblem[];
  /** Objects only in the rd extension (no railML 3.2 element), or skipped without it. */
  extensionOnly: ExportProblem[];
  /** Railway checks run before the export. */
  issues: Issue[];
  preserved: ApplyResult;
}

interface Ne {
  id: string;
  piece: TopoPiece;
  /** netElement orientation is opposite to the piece's drawing direction. */
  flipped: boolean;
  /** Topology nodes at intrinsic 0 and 1. */
  n0: number;
  n1: number;
  line: Pt[];
  metres: number;
  km0: number | null;
  km1: number | null;
}

interface SpotLoc {
  ne: Ne;
  coord: number;
  forwardNominal: boolean;
}

function describe(o: RailObject): string {
  return o.id ? `${o.kind.label} ${o.id}` : `${o.kind.label} (cell ${o.cellId})`;
}

/** Kinds written as `trainDetectionElement` that demarcate TVD sections (their `sections` field). */
const DETECTOR_KINDS: ReadonlySet<string> = new Set(['axleCounter', 'insulatedJoint']);

/** Exports the model as a railML 3.2 document. */
export function exportRailml(model: GraphDataModel, options: RailmlExportOptions = {}): RailmlExportResult {
  const extension = options.extension !== false;
  // Stable order (kind, then natural ID): independent of the z-order of the drawing
  const kindOrder = new Map(KIND_MAPPINGS.map((m, i) => [m.kind, i]));
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  // balise groups without NID_C: the diagram's default country (project-settings.ts)
  const objects = applyProjectDefaults(collectObjects(model), readCountryId(model)).sort(
    (a, b) => (kindOrder.get(a.kind.id) ?? 99) - (kindOrder.get(b.kind.id) ?? 99) || collator.compare(a.id, b.id) || collator.compare(a.cellId, b.cellId)
  );
  const issues = validateModel(model);
  const index = indexObjects(objects);
  const topo = buildTopology(objects);
  const ids = new IdAllocator();
  const counts: Record<string, number> = {};
  const unplaced: ExportProblem[] = [];
  const extensionOnly: ExportProblem[] = [];
  const problem = (list: ExportProblem[], o: RailObject, message: string): void => {
    list.push({ kind: o.kind.id, id: o.id, cellId: o.cellId, message });
  };
  const byKindId = (kind: KindId, id: string): RailObject | undefined => index.get(kind)?.get(id.trim().toUpperCase());

  // ---- ids: imported ids first (stable), then generated ones from rdId
  const railId = new Map<RailObject, string>();
  for (const o of objects) {
    const pre = readAttr(o.cell, RAILML_ID_ATTR).trim();
    if (pre && ids.claim(pre)) railId.set(o, pre);
  }
  const preferredIl = new Map<RailObject, string>();
  for (const o of objects) {
    const pre = readAttr(o.cell, RAILML_IL_ID_ATTR).trim();
    if (pre && ids.claim(pre)) preferredIl.set(o, pre);
  }
  // netElement ids of imported links (in order along the link), when the link still has as many pieces
  const preferredNe = new Map<number, string>();
  for (const o of objects) {
    const want = readAttr(o.cell, RAILML_NE_ATTR).split(/\s+/).filter((x) => x);
    const pieces = topo.pieces.filter((p) => p.linkCellId === o.cellId);
    if (want.length === 0 || want.length !== pieces.length) continue;
    pieces.forEach((p, i) => {
      if (ids.claim(want[i])) preferredNe.set(p.id, want[i]);
    });
  }
  for (const o of objects) {
    if (!railId.has(o)) railId.set(o, ids.take(`${mappingOf(o.kind.id).prefix}${o.id || `c${o.cellId}`}`));
  }
  const idOf = (o: RailObject): string => railId.get(o)!;

  // ---- netElements
  const nes: Ne[] = [];
  const nesOfLink = new Map<string, Ne[]>();
  const nesOfPiece = new Map<number, Ne>();
  const scaleOfLink = new Map<string, ReturnType<typeof kmScaleOf>>();
  const linkObj = (cellId: string): RailObject | undefined => objects.find((x) => x.cellId === cellId);
  for (const piece of topo.pieces) {
    const link = linkObj(piece.linkCellId)!;
    const list = nesOfLink.get(piece.linkCellId) ?? [];
    const start = piece.line[0];
    const end = piece.line[piece.line.length - 1];
    const flipped = !isNominalDirection({ x: end.x - start.x, y: end.y - start.y });
    const line = flipped ? [...piece.line].reverse() : piece.line;
    const base = (link.id || `c${link.cellId}`).trim();
    const ne: Ne = {
      id: preferredNe.get(piece.id) ?? ids.take(`ne_${base}_${list.length + 1}`),
      piece,
      flipped,
      n0: flipped ? piece.b : piece.a,
      n1: flipped ? piece.a : piece.b,
      line,
      metres: piece.length * (piece.metresPerUnit ?? 1),
      km0: null,
      km1: null,
    };
    // km of the ends on their track's scale (only ends lying on that track's line)
    const kmOwner = link.kind.id === 'points' ? undefined : link.kind.id === 'trackSection' && !piece.trackId ? link : byKindId('track', piece.trackId) ?? link;
    if (kmOwner) {
      if (!scaleOfLink.has(kmOwner.cellId)) scaleOfLink.set(kmOwner.cellId, kmScaleOf(kmOwner));
      const scale = scaleOfLink.get(kmOwner.cellId);
      if (scale) {
        const at = (p: Pt): number | null => {
          const pr = projectPoint(p, scale.line);
          return pr.distance <= 1 ? Math.round(kmAtAlong(scale, pr.along) * 1e6) / 1e6 : null;
        };
        ne.km0 = at(line[0]);
        ne.km1 = at(line[line.length - 1]);
      }
    }
    list.push(ne);
    nesOfLink.set(piece.linkCellId, list);
    nesOfPiece.set(piece.id, ne);
    nes.push(ne);
  }

  // ---- netRelations at every node
  interface Rel {
    id: string;
    a: Ne;
    b: Ne;
    posA: 0 | 1;
    posB: 0 | 1;
    navigable: boolean;
    node: number;
  }
  const rels: Rel[] = [];
  const relAt = new Map<string, Rel>();
  const relKey = (node: number, p: number, q: number): string => `${node}:${Math.min(p, q)}:${Math.max(p, q)}`;
  for (const node of topo.nodes) {
    const pieces = [...new Set(node.pieces)];
    for (let i = 0; i < pieces.length; i++) {
      for (let j = i + 1; j < pieces.length; j++) {
        let a = nesOfPiece.get(pieces[i])!;
        let b = nesOfPiece.get(pieces[j])!;
        if (b.id < a.id) [a, b] = [b, a];
        const rel: Rel = {
          id: ids.take(`nr_${a.id.replace(/^ne_/, '')}_${b.id.replace(/^ne_/, '')}`),
          a,
          b,
          posA: a.n0 === node.id ? 0 : 1,
          posB: b.n0 === node.id ? 0 : 1,
          navigable: passage(topo, node.id, a.piece.id, b.piece.id).ok,
          node: node.id,
        };
        rels.push(rel);
        relAt.set(relKey(node.id, a.piece.id, b.piece.id), rel);
      }
    }
  }

  // ---- locations
  const spotOf = (o: RailObject): SpotLoc | null => {
    if (o.kind.id === 'points') {
      const node = topo.nodes.find((n) => n.points?.cellId === o.cellId);
      if (node?.points) {
        const ne = nesOfPiece.get(node.points.toe)!;
        return { ne, coord: ne.n0 === node.id ? 0 : 1, forwardNominal: true };
      }
    }
    const loc = locateObject(topo, o);
    if (!loc) return null;
    const ne = nesOfPiece.get(loc.piece)!;
    const t = ne.piece.length > 0 ? loc.along / ne.piece.length : 0;
    return { ne, coord: Math.max(0, Math.min(1, ne.flipped ? 1 - t : t)), forwardNominal: forwardIsNominal(ne.piece, loc.along) };
  };

  // ---- document
  const doc = document.implementation.createDocument(RAILML_NS, 'railML', null);
  const root = doc.documentElement;
  root.setAttributeNS(XMLNS_NS, 'xmlns:dc', DC_NS);
  root.setAttributeNS(XMLNS_NS, 'xmlns:gml', GML_NS);
  root.setAttributeNS(XMLNS_NS, 'xmlns:xsi', XSI_NS);
  if (extension) root.setAttributeNS(XMLNS_NS, 'xmlns:rd', RD_NS);
  root.setAttribute('version', RAILML_VERSION);
  root.setAttributeNS(XSI_NS, 'xsi:schemaLocation', RAILML_SCHEMA_LOCATION);
  const byId = new Map<string, Element>();
  const el = (parent: Element, name: string, attrs: Record<string, string | number | boolean | null | undefined> = {}): Element => {
    const e = doc.createElementNS(RAILML_NS, name);
    setAttrs(e, attrs);
    insertOrdered(parent, e);
    const id = e.getAttribute('id');
    if (id) byId.set(id, e);
    return e;
  };
  const count = (name: string): void => {
    counts[name] = (counts[name] ?? 0) + 1;
  };

  const meta = el(root, 'metadata');
  const dc = (name: string, text: string): void => {
    const e = doc.createElementNS(DC_NS, `dc:${name}`);
    e.textContent = text;
    meta.appendChild(e);
  };
  dc('title', options.title?.trim() || 'Railway Drawer diagram');
  dc('creator', options.creator?.trim() || 'Railway Drawer');
  dc('date', options.date ?? new Date().toISOString());

  const measures = nes.flatMap((n) => [n.km0, n.km1]).filter((k): k is number => k !== null);
  for (const o of objects) {
    const km = parseNumber(o.values.km, 'km');
    if (km !== null) measures.push(km);
  }
  if (measures.length > 0) {
    const common = el(root, 'common', { id: 'co01' });
    const lpss = ensureOrdered(ensureOrdered(common, 'positioning'), 'linearPositioningSystems');
    const lps = el(lpss, 'linearPositioningSystem', {
      id: LPS_ID,
      units: 'm',
      startMeasure: num(Math.min(...measures) * 1000, 3),
      endMeasure: num(Math.max(...measures) * 1000, 3),
      linearReferencingMethod: 'absolute',
    });
    el(lps, 'name', { name: 'km', language: 'en' });
  }

  const infra = el(root, 'infrastructure', { id: 'is01' });
  const linearCoordinate = (parent: Element, km: number | null): void => {
    if (km !== null) el(parent, 'linearCoordinate', { positioningSystemRef: LPS_ID, measure: num(km * 1000, 3) });
  };
  if (nes.length > 0) {
    const topology = el(infra, 'topology');
    const neList = el(topology, 'netElements');
    for (const ne of nes) {
      const e = el(neList, 'netElement', { id: ne.id, length: num(ne.metres, 3) });
      const aps = el(e, 'associatedPositioningSystem', { id: `${ne.id}_aps` });
      const ic0 = el(aps, 'intrinsicCoordinate', { id: `${ne.id}_ic0`, intrinsicCoord: '0' });
      linearCoordinate(ic0, ne.km0);
      const ic1 = el(aps, 'intrinsicCoordinate', { id: `${ne.id}_ic1`, intrinsicCoord: '1' });
      linearCoordinate(ic1, ne.km1);
      count('netElement');
    }
    if (rels.length > 0) {
      const relList = el(topology, 'netRelations');
      for (const r of rels) {
        const e = el(relList, 'netRelation', { id: r.id, positionOnA: String(r.posA), positionOnB: String(r.posB), navigability: r.navigable ? 'Both' : 'None' });
        el(e, 'elementA', { ref: r.a.id });
        el(e, 'elementB', { ref: r.b.id });
        count('netRelation');
      }
    }
    const network = el(el(topology, 'networks'), 'network', { id: 'nw01' });
    const level = el(network, 'level', { id: 'lv01', descriptionLevel: 'Micro' });
    for (const ne of nes) el(level, 'networkResource', { ref: ne.id });
    for (const r of rels) el(level, 'networkResource', { ref: r.id });
  }

  const fi = (): Element => ensureOrdered(infra, 'functionalInfrastructure');
  const designated = (parent: Element, o: RailObject, displayName?: string): void => {
    const shown = (displayName ?? o.id).trim();
    if (shown) el(parent, 'name', { name: shown, language: 'en' });
    if (o.id) el(parent, 'designator', { register: RD_REGISTER, entry: o.id });
  };
  const spotLocation = (parent: Element, o: RailObject, loc: SpotLoc | null, withDirection: boolean): void => {
    if (!loc) return;
    let dir: string | null = null;
    if (withDirection) {
      const d = (o.values.direction ?? '').trim();
      // Travelling in the netElement direction (0 -> 1) is nominal when...
      const normalIsNominal = loc.ne.flipped ? !loc.forwardNominal : loc.forwardNominal;
      dir = d === 'nominal' || d === 'reverse' ? ((d === 'nominal') === normalIsNominal ? 'normal' : 'reverse') : 'both';
    }
    const sl = el(parent, 'spotLocation', { id: `${idOf(o)}_sl`, netElementRef: loc.ne.id, intrinsicCoord: num(loc.coord), applicationDirection: dir });
    linearCoordinate(sl, parseNumber(o.values.km, 'km'));
  };
  const derivedTrack = new Map<RailObject, string>();
  const locs = new Map<RailObject, SpotLoc | null>();
  const located = (o: RailObject): SpotLoc | null => {
    if (!locs.has(o)) {
      const loc = spotOf(o);
      locs.set(o, loc);
      if (loc) derivedTrack.set(o, loc.ne.piece.trackId || (loc.ne.piece.pointsCellId ? '' : loc.ne.piece.linkId));
    }
    return locs.get(o)!;
  };

  // tracks
  for (const o of objects.filter((x) => x.kind.id === 'track')) {
    const e = el(ensureOrdered(fi(), 'tracks'), 'track', { id: idOf(o), type: 'mainTrack' });
    designated(e, o, (o.values.name ?? '').trim() || o.id);
    const list = nesOfLink.get(o.cellId) ?? [];
    if (list.length > 0) {
      const ll = el(e, 'linearLocation', { id: `${idOf(o)}_ll` });
      list.forEach((ne, i) => {
        el(ll, 'associatedNetElement', {
          netElementRef: ne.id,
          keepsOrientation: String(!ne.flipped),
          intrinsicCoordBegin: ne.flipped ? '1' : '0',
          intrinsicCoordEnd: ne.flipped ? '0' : '1',
          sequence: String(i + 1),
        });
      });
    } else problem(unplaced, o, `${describe(o)} has no centre line (too short or no geometry): written without location`);
    count('track');
  }

  // switches
  const handOf = new Map<string, 'left' | 'right'>();
  for (const o of objects.filter((x) => x.kind.id === 'points')) {
    const node = topo.nodes.find((n) => n.points?.cellId === o.cellId);
    let hand = (o.values.hand ?? '').trim() as 'left' | 'right' | '';
    if (node?.points && hand === '') {
      hand = junctionHand(topo, node.id) ?? '';
    }
    if (hand) handOf.set(o.id.toUpperCase(), hand);
    const e = el(ensureOrdered(fi(), 'switchesIS'), 'switchIS', {
      id: idOf(o),
      type: 'ordinarySwitch',
      continueCourse: hand ? (hand === 'left' ? 'right' : 'left') : null,
      branchCourse: hand || null,
    });
    designated(e, o);
    const loc = located(o);
    spotLocation(e, o, loc, false);
    if (!loc) problem(unplaced, o, `${describe(o)} is not at a points junction of the tracks: written without location`);
    if (node?.points && hand) {
      const j = node.points;
      const toNormal = relAt.get(relKey(node.id, j.toe, j.normal));
      const toReverse = relAt.get(relKey(node.id, j.toe, j.reverse));
      const left = hand === 'left' ? toReverse : toNormal;
      const right = hand === 'left' ? toNormal : toReverse;
      if (left) el(e, 'leftBranch', { netRelationRef: left.id });
      if (right) el(e, 'rightBranch', { netRelationRef: right.id });
    }
    count('switchIS');
  }

  // signals
  for (const o of objects.filter((x) => x.kind.id === 'signal')) {
    const type = (o.values.signalType ?? '').trim();
    const light = type === 'main' || type === 'shunting';
    const board = type === 'markerBoard' || type === 'etcsStopMarker';
    const e = el(ensureOrdered(fi(), 'signalsIS'), 'signalIS', { id: idOf(o), isSwitchable: light ? 'true' : board ? 'false' : null });
    designated(e, o);
    const loc = located(o);
    spotLocation(e, o, loc, true);
    if (!loc) problem(unplaced, o, `${describe(o)} is not on a track: written without location`);
    if (board) el(e, 'isEtcsSignal');
    if (light) el(e, 'isTrainMovementSignal');
    if (light || board) el(e, 'signalConstruction', { type: light ? 'light' : 'board', positionAtTrack: loc ? 'right' : null });
    count('signalIS');
  }

  // balise groups (before balises: their ids are referenced)
  for (const o of objects.filter((x) => x.kind.id === 'baliseGroup')) {
    const countN = parseNumber(o.values.count, 'integer');
    const e = el(ensureOrdered(fi(), 'baliseGroups'), 'baliseGroup', { id: idOf(o), numberOfBalisesInGroup: countN !== null ? String(countN) : null });
    designated(e, o);
    spotLocation(e, o, located(o), true);
    el(e, 'applicationType', { value: 'ETCS' });
    const nidC = parseNumber(o.values.nidC, 'integer');
    const nidBg = parseNumber(o.values.nidBg, 'integer');
    if (nidC !== null && nidBg !== null) el(e, 'isEurobaliseGroup', { countryID: String(nidC), groupID: String(nidBg) });
    count('baliseGroup');
  }
  for (const o of objects.filter((x) => x.kind.id === 'balise')) {
    const group = o.values.groupId ? byKindId('baliseGroup', o.values.groupId) : undefined;
    const e = el(ensureOrdered(fi(), 'balises'), 'balise', { id: idOf(o), belongsToBaliseGroup: group ? idOf(group) : null });
    designated(e, o);
    const loc = located(o);
    spotLocation(e, o, loc, true);
    if (!loc) problem(unplaced, o, `${describe(o)} is not on a track: written without location`);
    const pos = parseNumber(o.values.position, 'integer');
    if (pos !== null && pos >= 1) el(e, 'isEurobalise', { positionInGroup: String(pos - 1) });
    count('balise');
  }

  const simpleSpot = (kind: KindId, container: string, name: string, attrs: (o: RailObject) => Record<string, string | null>, extra?: (e: Element, o: RailObject) => void): void => {
    for (const o of objects.filter((x) => x.kind.id === kind)) {
      const e = el(ensureOrdered(fi(), container), name, { id: idOf(o), ...attrs(o) });
      designated(e, o);
      const loc = located(o);
      spotLocation(e, o, loc, false);
      if (!loc) problem(unplaced, o, `${describe(o)} is not on a track: written without location`);
      extra?.(e, o);
      count(name);
    }
  };
  simpleSpot('axleCounter', 'trainDetectionElements', 'trainDetectionElement', () => ({ type: 'axleCounter', detectedObject: 'axle' }));
  simpleSpot('insulatedJoint', 'trainDetectionElements', 'trainDetectionElement', () => ({ type: 'insulatedRailJoint' }));
  simpleSpot('bufferStop', 'bufferStops', 'bufferStop', () => ({}));
  simpleSpot('levelCrossing', 'levelCrossingsIS', 'levelCrossingIS', () => ({}), (e, o) => {
    const p = protectionToRailml((o.values.protection ?? '').trim());
    if (p) el(e, 'protection', p);
  });

  // ---- interlocking
  let ail: Element | null = null;
  const assets = (): Element => {
    if (!ail) ail = el(ensureOrdered(ensureOrdered(root, 'interlocking'), 'assetsForInterlockings'), 'assetsForInterlocking', { id: 'ail01' });
    return ail;
  };
  const isTvd = (id: string): boolean => !!byKindId('trackSection', id);
  for (const o of objects.filter((x) => x.kind.id === 'trackSection')) {
    const e = el(ensureOrdered(assets(), 'tvdSections'), 'tvdSection', { id: idOf(o), technology: technologyToRailml((o.values.sectionType ?? '').trim()) });
    if (o.id) el(e, 'designator', { register: RD_REGISTER, entry: o.id });
    // detection points bounding the section: axle counters and insulated rail joints (TC)
    for (const ac of objects.filter((x) => DETECTOR_KINDS.has(x.kind.id) && splitRefList(x.values.sections).some((s) => s.toUpperCase() === o.id.toUpperCase()))) {
      el(e, 'hasDemarcatingTraindetector', { ref: idOf(ac) });
    }
    count('tvdSection');
  }
  const trackRefOfPiece = (pieceId: number): string | null => {
    const t = byKindId('track', topo.pieces[pieceId].trackId);
    return t ? idOf(t) : null;
  };
  const ilOf = new Map<RailObject, string>();
  for (const o of objects.filter((x) => x.kind.id === 'points')) {
    const node = topo.nodes.find((n) => n.points?.cellId === o.cellId);
    const id = preferredIl.get(o) ?? ids.take(`il_${idOf(o)}`);
    ilOf.set(o, id);
    const e = el(ensureOrdered(assets(), 'switchesIL'), 'switchIL', { id });
    if (o.id) el(e, 'designator', { register: RD_REGISTER, entry: o.id });
    el(e, 'refersTo', { ref: idOf(o) });
    const hand = handOf.get(o.id.toUpperCase());
    if (node?.points && hand) {
      const j = node.points;
      const toe = trackRefOfPiece(j.toe);
      const normal = trackRefOfPiece(j.normal) ?? toe;
      const reverse = trackRefOfPiece(j.reverse) ?? toe;
      const left = hand === 'left' ? reverse : normal;
      const right = hand === 'left' ? normal : reverse;
      if (left) el(e, 'branchLeft', { ref: left });
      if (right) el(e, 'branchRight', { ref: right });
    }
    count('switchIL');
  }
  for (const o of objects.filter((x) => x.kind.id === 'signal')) {
    const type = (o.values.signalType ?? '').trim();
    const id = preferredIl.get(o) ?? ids.take(`il_${idOf(o)}`);
    ilOf.set(o, id);
    const e = el(ensureOrdered(assets(), 'signalsIL'), 'signalIL', { id, function: type === 'main' || type === 'shunting' ? type : null });
    if (o.id) el(e, 'designator', { register: RD_REGISTER, entry: o.id });
    el(e, 'refersTo', { ref: idOf(o) });
    count('signalIL');
  }
  const routeExt = new Map<RailObject, Record<string, string>>();
  for (const o of objects.filter((x) => x.kind.id === 'route')) {
    const ext: Record<string, string> = {};
    routeExt.set(o, ext);
    const entry = o.values.entrySignal ? byKindId('signal', o.values.entrySignal) : undefined;
    const exit = o.values.exitSignal ? byKindId('signal', o.values.exitSignal) : undefined;
    if (!entry || !exit) {
      problem(extensionOnly, o, `${describe(o)} has no entry or exit signal: only in the rd extension`);
      continue;
    }
    const e = el(ensureOrdered(assets(), 'routes'), 'route', { id: idOf(o) });
    if (o.id) el(e, 'designator', { register: RD_REGISTER, entry: o.id });
    // facing or trailing: from the path through the drawing
    const sections = splitRefList(o.values.sections);
    const paths = findRoutePaths(topo, entry, exit, { maxPaths: 16 }).paths;
    const path = paths.find((p) => p.sections.map((s) => s.toUpperCase()).join(',') === sections.map((s) => s.toUpperCase()).join(',')) ?? paths[0];
    const trailing = new Set<string>();
    if (path) {
      for (let i = 1; i < path.steps.length; i++) {
        const prev = topo.pieces[path.steps[i - 1].piece];
        const nodeId = path.steps[i - 1].forward ? prev.b : prev.a;
        const j = topo.nodes[nodeId].points;
        if (j && j.toe !== prev.id) trailing.add(j.pointsId.toUpperCase());
      }
    }
    const pl = parsePointsList(o.values.points);
    let pointsMapped = pl.invalid.length === 0;
    for (const p of pl.entries) {
      const sw = byKindId('points', p.id);
      const hand = handOf.get(p.id.toUpperCase());
      if (!sw || !hand) {
        pointsMapped = false;
        continue;
      }
      const inPosition = p.position === 'reverse' ? hand : hand === 'left' ? 'right' : 'left';
      const tag = trailing.has(p.id.toUpperCase()) ? 'trailingSwitchInPosition' : 'facingSwitchInPosition';
      const f = el(e, tag, { id: ids.take(`${idOf(o)}_${idOf(sw)}`), inPosition });
      el(f, 'refersToSwitch', { ref: ilOf.get(sw)! });
    }
    if (!pointsMapped && o.values.points) ext.rdPoints = o.values.points;
    const tvdList = splitRefList(readAttr(o.cell, RAILML_TVD_ATTR));
    if (sections.every(isTvd)) for (const s of sections) el(e, 'hasTvdSection', { ref: idOf(byKindId('trackSection', s)!) });
    else {
      ext.rdSections = o.values.sections;
      for (const s of tvdList.filter(isTvd)) el(e, 'hasTvdSection', { ref: idOf(byKindId('trackSection', s)!) });
    }
    const re = el(e, 'routeEntry', { id: `${idOf(o)}_entry` });
    el(re, 'refersTo', { ref: ilOf.get(entry)! });
    const rx = el(e, 'routeExit', { id: `${idOf(o)}_exit` });
    el(rx, 'refersTo', { ref: ilOf.get(exit)! });
    const overlap = splitRefList(o.values.overlap);
    if (overlap.length > 0) {
      if (overlap.every(isTvd)) {
        const ovId = ids.take(`ov_${idOf(o)}`);
        el(rx, 'hasOverlap', { ref: ovId });
        const ov = el(ensureOrdered(assets(), 'overlaps'), 'overlap', { id: ovId });
        el(ov, 'activeForApproachRoute', { ref: idOf(o) });
        for (const s of overlap) el(ov, 'hasTvdSection', { ref: idOf(byKindId('trackSection', s)!) });
        count('overlap');
      } else ext.rdOverlap = o.values.overlap;
    }
    count('route');
  }
  for (const o of objects.filter((x) => x.kind.id === 'rbc')) {
    const e = el(ensureOrdered(ensureOrdered(root, 'interlocking'), 'radioBlockCentres'), 'radioBlockCentre', { id: idOf(o) });
    if (o.id) el(e, 'designator', { register: RD_REGISTER, entry: o.id });
    count('radioBlockCentre');
  }

  // ---- visualization
  const exportedIds = new Set(byId.keys());
  const vis = doc.createElementNS(RAILML_NS, 'infrastructureVisualization');
  vis.setAttribute('id', 'vis01');
  const coord = (parent: Element, p: Pt): void => {
    el(parent, 'coordinate', { x: num(p.x, 2), y: num(p.y, 2) });
  };
  for (const ne of nes) {
    const e = el(vis, 'linearElementProjection', { id: `vis_${ne.id}`, refersToElement: ne.id });
    for (const p of ne.line) coord(e, p);
  }
  const linkSections = new Set<RailObject>();
  for (const o of objects) {
    if (o.kind.id === 'track' || o.kind.id === 'points' || o.kind.id === 'route' || !exportedIds.has(idOf(o))) continue;
    if (o.kind.id === 'trackSection' && (nesOfLink.get(o.cellId)?.length ?? 0) > 0) {
      linkSections.add(o);
      const line = linkLine(o);
      if (line) {
        const e = el(vis, 'linearElementProjection', { id: `vis_${idOf(o)}`, refersToElement: idOf(o) });
        for (const p of line) coord(e, p);
      }
      continue;
    }
    const c = centerOf(o.cell);
    if (!c) continue;
    coord(el(vis, 'spotElementProjection', { id: `vis_${idOf(o)}`, refersToElement: idOf(o) }), c);
  }
  // inserted now (preserved projections of an imported file belong to it), removed again when empty
  const visHome = ensureOrdered(ensureOrdered(root, 'visualizations'), 'infrastructureVisualizations');
  insertOrdered(visHome, vis);
  byId.set('vis01', vis);

  // ---- rd extension
  const unmappedKeys = (o: RailObject): string[] => {
    const keys: string[] = [];
    if (o.kind.id === 'balise' && o.values.groupId && !byKindId('baliseGroup', o.values.groupId)) keys.push('groupId');
    if (DETECTOR_KINDS.has(o.kind.id) && !splitRefList(o.values.sections).every(isTvd)) keys.push('sections');
    if (o.kind.id === 'levelCrossing' && o.values.protection && !protectionToRailml(o.values.protection.trim())) keys.push('protection');
    if (o.kind.id === 'points' && o.values.hand && !handOf.has(o.id.toUpperCase())) keys.push('hand');
    return keys;
  };
  if (extension) {
    const ext = doc.createElementNS(RD_NS, 'rd:railwayDrawer');
    ext.setAttribute('version', '1');
    for (const o of objects) {
      const attrs = extensionAttrs(o, {
        exported: exportedIds.has(idOf(o)),
        loc: locs.has(o) ? locs.get(o)! : undefined,
        derivedTrack: derivedTrack.get(o),
        routeExt: routeExt.get(o),
        legOrSection: o.kind.id === 'points' || linkSections.has(o) ? nesOfLink.get(o.cellId) : undefined,
        unmappedKeys: unmappedKeys(o),
      });
      if (!attrs) continue;
      const e = doc.createElementNS(RD_NS, 'rd:object');
      e.setAttribute('kind', o.kind.id);
      if (exportedIds.has(idOf(o))) e.setAttribute('ref', idOf(o));
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
      ext.appendChild(e);
    }
    if (ext.children.length > 0) root.appendChild(ext);
  }
  for (const o of objects) {
    if (o.kind.id === 'leu' || o.kind.id === 'train') {
      problem(extensionOnly, o, extension ? `${describe(o)}: no railML 3.2 element, kept in the rd extension` : `${describe(o)}: no railML 3.2 element, not exported`);
    }
  }

  const preserved = applyPreserved(root, options.preserved ?? readPreserved(model), byId);
  if (vis.children.length === 0) vis.remove();
  if (visHome.children.length === 0) visHome.parentElement!.remove();
  const raw = serializeXml(doc);
  return { xml: options.pretty === false ? raw : prettyXml(raw), doc, counts, unplaced, extensionOnly, issues, preserved };
}

interface ExtContext {
  exported: boolean;
  loc: SpotLoc | null | undefined;
  derivedTrack: string | undefined;
  routeExt: Record<string, string> | undefined;
  legOrSection: Ne[] | undefined;
  /** Mapped fields that could not be written this time (e.g. a reference to a missing object). */
  unmappedKeys: string[];
}

/** Attributes of an object's `rd:object` (data railML does not hold), or null when there are none. */
function extensionAttrs(o: RailObject, ctx: ExtContext): Record<string, string> | null {
  const m = mappingOf(o.kind.id);
  const out: Record<string, string> = {};
  const mapped = new Set(m.mapped);
  if (!ctx.exported) mapped.clear();
  // conditional mappings
  if (!ctx.loc) {
    mapped.delete('km');
    mapped.delete('direction');
  }
  for (const key of ctx.unmappedKeys) mapped.delete(key);
  if (o.kind.id === 'signal' && o.values.signalType === 'etcsStopMarker') mapped.delete('signalType');
  if (o.kind.id === 'baliseGroup' && (parseNumber(o.values.nidC, 'integer') === null || parseNumber(o.values.nidBg, 'integer') === null)) {
    mapped.delete('nidC');
    mapped.delete('nidBg');
  }
  for (const key of ['km', 'count', 'position', 'nidC', 'nidBg']) {
    const f = o.kind.fields.find((x) => x.key === key);
    if (f && o.values[key] && parseNumber(o.values[key], f.type) === null) mapped.delete(key);
  }
  if (o.kind.id === 'route') mapped.delete('length');
  for (const f of o.kind.fields) {
    const v = o.values[f.key] ?? '';
    if (f.key === 'trackId') {
      // derived from the netElement the object lies on; written when that would not give it back
      if (ctx.exported && ctx.loc) {
        if ((ctx.derivedTrack ?? '').toUpperCase() !== v.trim().toUpperCase()) out[f.attr] = v;
      } else if (v) out[f.attr] = v;
      continue;
    }
    if (v === '' || mapped.has(f.key)) continue;
    out[f.attr] = v;
  }
  if (ctx.routeExt) Object.assign(out, ctx.routeExt);
  if (ctx.legOrSection && ctx.legOrSection.length > 0) {
    out.netElements = ctx.legOrSection.map((ne) => `${ne.id}:${ne.flipped ? '-' : '+'}`).join(' ');
  }
  const cell: Cell = o.cell;
  if (o.kind.id !== 'route' && (!cell.children || cell.children.length === 0)) {
    const raw = cell.getStyle() as Parameters<typeof styleToString>[0];
    const parsed = (typeof raw === 'string' ? parseStyleString(raw) : raw) as Record<string, unknown> | null | undefined;
    // runtime states are not infrastructure: the drawn colours, not the state's (src/railway/states.ts)
    const drawn = parsed ? styleWithoutState(parsed, parseBaseStyles(readAttr(cell, BASE_STYLE_ATTR))['']) : parsed;
    const style = styleToString(drawn as Parameters<typeof styleToString>[0]);
    if (style) out.style = style;
    const geo = cell.getGeometry();
    if (cell.isVertex() && geo) {
      out.w = num(Number(geo.width) || 0, 2);
      out.h = num(Number(geo.height) || 0, 2);
    }
  }
  if (!ctx.exported || o.kind.id === 'leu' || o.kind.id === 'train') {
    const c = centerOf(cell);
    if (c) {
      out.x = num(c.x, 2);
      out.y = num(c.y, 2);
    }
  }
  const value = cell.getValue();
  if (isElementValue(value) && o.kind.id !== 'route') {
    for (const a of Array.from(value.attributes)) {
      if (a.name === 'id' || a.name === KIND_ATTR || a.name === RAILML_ID_ATTR || a.name === RAILML_NE_ATTR || a.name === RAILML_IL_ID_ATTR || a.name === RAILML_TVD_ATTR || ALL_DATA_ATTRS.has(a.name) || RUNTIME_STATE_ATTRS.has(a.name)) continue;
      if (a.name === 'label' && a.value === '') continue;
      out[`v_${a.name}`] = a.value;
    }
  }
  // only geometry/style for mapped objects with nothing else: still useful (layout round trip)
  return Object.keys(out).length > 0 ? out : null;
}
