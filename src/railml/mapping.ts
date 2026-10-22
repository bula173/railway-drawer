/**
 * @file mapping.ts
 * @brief How each railway object kind of the catalogue (src/railway/catalogue.ts) maps to railML
 *        3.2, the id prefixes, the enumeration conversions, and which catalogue fields railML
 *        expresses (the others go to the `rd` extension). docs/RAILML.md has the same table.
 */
import type { KindId } from '../railway/catalogue';

export interface KindMapping {
  kind: KindId;
  /** railML element (path below its container), or null when only the rd extension has it. */
  element: string | null;
  /** Container path below `<railML>`. */
  container: string;
  /** Id prefix of exported elements. */
  prefix: string;
  /** Catalogue field keys expressed in railML (the rest go to the rd extension). */
  mapped: readonly string[];
  note: string;
}

export const KIND_MAPPINGS: readonly KindMapping[] = [
  { kind: 'track', element: 'track', container: 'infrastructure/functionalInfrastructure/tracks', prefix: 'trk_', mapped: ['id', 'name'], note: 'linearLocation over its netElements (topology pieces); km start/end also as netElement linearCoordinates' },
  { kind: 'points', element: 'switchIS', container: 'infrastructure/functionalInfrastructure/switchesIS', prefix: 'sw_', mapped: ['id', 'hand', 'km'], note: 'type="ordinarySwitch", continueCourse/branchCourse from the hand, leftBranch/rightBranch -> netRelations; plus switchIL (interlocking)' },
  { kind: 'signal', element: 'signalIS', container: 'infrastructure/functionalInfrastructure/signalsIS', prefix: 'sig_', mapped: ['id', 'signalType', 'direction', 'km', 'routes'], note: 'main/shunting: isTrainMovementSignal + signalConstruction type="light", signalIL@function main/shunting; marker board / ETCS stop marker: isEtcsSignal + signalConstruction type="board"' },
  { kind: 'balise', element: 'balise', container: 'infrastructure/functionalInfrastructure/balises', prefix: 'bal_', mapped: ['id', 'groupId', 'position', 'direction', 'km'], note: 'belongsToBaliseGroup, isEurobalise@positionInGroup = position - 1' },
  { kind: 'baliseGroup', element: 'baliseGroup', container: 'infrastructure/functionalInfrastructure/baliseGroups', prefix: 'bg_', mapped: ['id', 'nidC', 'nidBg', 'count', 'direction', 'km'], note: 'applicationType value="ETCS", isEurobaliseGroup countryID (NID_C) / groupID (NID_BG), numberOfBalisesInGroup' },
  { kind: 'axleCounter', element: 'trainDetectionElement', container: 'infrastructure/functionalInfrastructure/trainDetectionElements', prefix: 'tde_', mapped: ['id', 'km', 'sections'], note: 'type="axleCounter" detectedObject="axle"; sections = tvdSection/hasDemarcatingTraindetector' },
  { kind: 'insulatedJoint', element: 'trainDetectionElement', container: 'infrastructure/functionalInfrastructure/trainDetectionElements', prefix: 'ij_', mapped: ['id', 'km', 'sections'], note: 'type="insulatedRailJoint" (ERTMS "TC" marker); sections = tvdSection/hasDemarcatingTraindetector' },
  { kind: 'trackSection', element: 'tvdSection', container: 'interlocking/assetsForInterlockings/assetsForInterlocking/tvdSections', prefix: 'tvd_', mapped: ['id', 'sectionType'], note: 'technology trackCircuit/axleCounter; geometry only as a visualization projection' },
  { kind: 'bufferStop', element: 'bufferStop', container: 'infrastructure/functionalInfrastructure/bufferStops', prefix: 'bus_', mapped: ['id', 'km'], note: 'spotLocation at the track end' },
  { kind: 'levelCrossing', element: 'levelCrossingIS', container: 'infrastructure/functionalInfrastructure/levelCrossingsIS', prefix: 'lc_', mapped: ['id', 'protection', 'km'], note: 'protection@barriers/@lights/@hasActiveProtection' },
  { kind: 'rbc', element: 'radioBlockCentre', container: 'interlocking/radioBlockCentres', prefix: 'rbc_', mapped: ['id'], note: 'NID_C/NID_RBC in the rd extension (no confirmed 3.2 attribute)' },
  { kind: 'route', element: 'route', container: 'interlocking/assetsForInterlockings/assetsForInterlocking/routes', prefix: 'rt_', mapped: ['id', 'entrySignal', 'exitSignal', 'points', 'sections', 'overlap'], note: 'routeEntry/routeExit refersTo signalIL, facing/trailingSwitchInPosition, hasTvdSection, routeExit/hasOverlap -> overlap; length in the rd extension' },
  { kind: 'leu', element: null, container: '', prefix: 'leu_', mapped: [], note: 'not in railML 3.2 (linesideElectronicUnitsIL is 3.3): rd extension only' },
  { kind: 'train', element: null, container: '', prefix: 'tr_', mapped: [], note: 'a train on the drawing is not infrastructure: rd extension only' },
];

const BY_KIND = new Map(KIND_MAPPINGS.map((m) => [m.kind, m]));

export function mappingOf(kind: KindId): KindMapping {
  return BY_KIND.get(kind)!;
}

/** Kinds without a railML 3.2 element (kept in the rd extension). */
export const UNMAPPED_KINDS: readonly KindId[] = KIND_MAPPINGS.filter((m) => m.element === null).map((m) => m.kind);

/** Kinds with a spotLocation on a netElement. */
export const SPOT_KINDS: ReadonlySet<KindId> = new Set<KindId>(['signal', 'balise', 'baliseGroup', 'axleCounter', 'insulatedJoint', 'bufferStop', 'levelCrossing', 'points', 'leu']);

// ---------------------------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------------------------

/** Level crossing protection -> railML `<protection>` attributes. */
export function protectionToRailml(p: string): Record<string, string> | null {
  switch (p) {
    case 'fullBarriers':
      return { barriers: 'singleFullBarrier', hasActiveProtection: 'true' };
    case 'halfBarriers':
      return { barriers: 'singleHalfBarrier', hasActiveProtection: 'true' };
    case 'lights':
      return { barriers: 'none', lights: 'flashing', hasActiveProtection: 'true' };
    case 'passive':
      return { barriers: 'none', lights: 'none', hasActiveProtection: 'false' };
    default:
      return null;
  }
}

export function protectionFromRailml(e: Element | null): string {
  if (!e) return '';
  const barriers = e.getAttribute('barriers') ?? '';
  const lights = e.getAttribute('lights') ?? '';
  if (barriers === 'singleFullBarrier') return 'fullBarriers';
  if (barriers === 'singleHalfBarrier' || barriers === 'doubleHalfBarrier') return 'halfBarriers';
  if (lights === 'flashing' || lights === 'continuous') return 'lights';
  if (e.getAttribute('hasActiveProtection') === 'false' || (barriers === 'none' && lights === 'none')) return 'passive';
  return '';
}

export function technologyToRailml(sectionType: string): string {
  return sectionType === 'tc' ? 'trackCircuit' : sectionType === 'axleCounter' ? 'axleCounter' : '';
}

export function technologyFromRailml(t: string | null): string {
  return t === 'trackCircuit' ? 'tc' : t === 'axleCounter' ? 'axleCounter' : '';
}
