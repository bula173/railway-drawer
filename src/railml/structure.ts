/**
 * @file structure.ts
 * @brief Structural checks of a railML 3.2 document for the parts this app writes: required
 *        elements and attributes, enumerations, unique NCName ids and resolvable references.
 *        Not an XSD validation (no validator in the browser); scripts/railml/validate.ts runs
 *        xmllint against the official XSD when it is available locally.
 */
import { RAILML_NS, childrenNamed, isNcName } from './xml';

const ENUMS: Record<string, Record<string, readonly string[]>> = {
  netRelation: { navigability: ['AB', 'BA', 'Both', 'None'], positionOnA: ['0', '1'], positionOnB: ['0', '1'] },
  spotLocation: { applicationDirection: ['both', 'normal', 'reverse'] },
  linearLocation: { applicationDirection: ['both', 'normal', 'reverse'] },
  track: { type: ['mainTrack', 'secondaryTrack', 'sidingTrack', 'connectingTrack'] },
  switchIS: {
    type: ['doubleSwitchCrossing', 'switchCrossingPart', 'insideCurvedSwitch', 'ordinarySwitch', 'outsideCurvedSwitch', 'singleSwitchCrossing'],
    continueCourse: ['left', 'right'],
    branchCourse: ['left', 'right'],
  },
  signalConstruction: { type: ['board', 'light', 'pole', 'semaphore', 'virtual'], positionAtTrack: ['above', 'left', 'right'] },
  trainDetectionElement: { type: ['axleCounter', 'axleCountingCircuit', 'clearancePoint', 'insulatedRailJoint', 'trackCircuit', 'virtualClearancePoint'], detectedObject: ['axle', 'endOfTrain', 'train', 'wheel'] },
  protection: { barriers: ['doubleHalfBarrier', 'none', 'singleFullBarrier', 'singleHalfBarrier'], lights: ['continuous', 'flashing', 'none'], acoustic: ['bell', 'none'] },
  facingSwitchInPosition: { inPosition: ['left', 'right'] },
  trailingSwitchInPosition: { inPosition: ['left', 'right'] },
  signalIL: {
    function: ['barrage', 'block', 'blockInterface', 'distant', 'entry', 'exit', 'group', 'intermediate', 'intermediateStop', 'junction', 'lineInterface', 'main', 'main+shunting', 'repeater', 'shunting'],
  },
  tvdSection: { technology: ['axleCounter', 'trackCircuit'] },
  level: { descriptionLevel: ['Macro', 'Meso', 'Micro'] },
};

/** Required attributes per element (only elements this app writes). */
const REQUIRED_ATTRS: Record<string, readonly string[]> = {
  railML: ['version'],
  common: ['id'],
  infrastructure: ['id'],
  linearPositioningSystem: ['id'],
  netElement: ['id'],
  associatedPositioningSystem: ['id'],
  intrinsicCoordinate: ['id', 'intrinsicCoord'],
  linearCoordinate: ['positioningSystemRef', 'measure'],
  netRelation: ['id', 'positionOnA', 'positionOnB'],
  elementA: ['ref'],
  elementB: ['ref'],
  network: ['id'],
  level: ['id'],
  networkResource: ['ref'],
  spotLocation: ['id', 'netElementRef'],
  linearLocation: ['id'],
  associatedNetElement: ['netElementRef', 'keepsOrientation'],
  name: ['name', 'language'],
  designator: ['register', 'entry'],
  track: ['id', 'type'],
  switchIS: ['id'],
  leftBranch: ['netRelationRef'],
  rightBranch: ['netRelationRef'],
  signalIS: ['id'],
  balise: ['id'],
  baliseGroup: ['id'],
  isEurobaliseGroup: ['countryID', 'groupID'],
  trainDetectionElement: ['id'],
  bufferStop: ['id'],
  levelCrossingIS: ['id'],
  assetsForInterlocking: ['id'],
  tvdSection: ['id'],
  hasDemarcatingTraindetector: ['ref'],
  switchIL: ['id'],
  signalIL: ['id'],
  refersTo: ['ref'],
  branchLeft: ['ref'],
  branchRight: ['ref'],
  route: ['id'],
  routeEntry: ['id'],
  routeExit: ['id'],
  facingSwitchInPosition: ['id'],
  trailingSwitchInPosition: ['id'],
  refersToSwitch: ['ref'],
  hasTvdSection: ['ref'],
  hasOverlap: ['ref'],
  overlap: ['id'],
  activeForApproachRoute: ['ref'],
  radioBlockCentre: ['id'],
  infrastructureVisualization: ['id'],
  linearElementProjection: ['id', 'refersToElement'],
  spotElementProjection: ['id', 'refersToElement'],
  coordinate: ['x'],
};

/** Required children with their minimum count (and maximum, when limited). */
const REQUIRED_CHILDREN: Record<string, ReadonlyArray<[string, number, number?]>> = {
  netElement: [['associatedPositioningSystem', 1]],
  associatedPositioningSystem: [['intrinsicCoordinate', 1]],
  netRelation: [['elementA', 1, 1], ['elementB', 1, 1]],
  topology: [['netElements', 1, 1], ['networks', 1, 1]],
  linearLocation: [['associatedNetElement', 1]],
  baliseGroup: [['applicationType', 1]],
  switchIL: [['refersTo', 1, 2], ['branchLeft', 1, 1], ['branchRight', 1, 1]],
  route: [['routeEntry', 1, 1], ['routeExit', 1, 1]],
  linearElementProjection: [['coordinate', 2]],
  spotElementProjection: [['coordinate', 1, 1]],
  assetsForInterlockings: [['assetsForInterlocking', 1]],
  infrastructureVisualizations: [['infrastructureVisualization', 1]],
};

/** Reference attributes and the element names they may point to (null = any element with that id). */
const REFS: Record<string, Record<string, readonly string[] | null>> = {
  elementA: { ref: ['netElement'] },
  elementB: { ref: ['netElement'] },
  networkResource: { ref: ['netElement', 'netRelation'] },
  spotLocation: { netElementRef: ['netElement'] },
  associatedNetElement: { netElementRef: ['netElement'] },
  linearCoordinate: { positioningSystemRef: ['linearPositioningSystem'] },
  leftBranch: { netRelationRef: ['netRelation'] },
  rightBranch: { netRelationRef: ['netRelation'] },
  balise: { belongsToBaliseGroup: ['baliseGroup'] },
  hasDemarcatingTraindetector: { ref: ['trainDetectionElement'] },
  hasTvdSection: { ref: ['tvdSection'] },
  refersToSwitch: { ref: ['switchIL'] },
  hasOverlap: { ref: ['overlap'] },
  activeForApproachRoute: { ref: ['route'] },
  linearElementProjection: { refersToElement: null },
  spotElementProjection: { refersToElement: null },
};

/** refersTo targets depend on the parent. */
const REFERS_TO: Record<string, readonly string[]> = {
  switchIL: ['switchIS'],
  signalIL: ['signalIS'],
  routeEntry: ['signalIL', 'signalIS'],
  routeExit: ['signalIL', 'signalIS'],
};

/** Problems found (empty = structurally fine). Elements outside the railML namespace are skipped. */
export function checkRailmlStructure(doc: Document): string[] {
  const out: string[] = [];
  const root = doc.documentElement;
  if (root.localName !== 'railML' || root.namespaceURI !== RAILML_NS) out.push(`Root must be <railML> in ${RAILML_NS}`);
  if (root.getAttribute('version') !== '3.2') out.push('railML@version must be "3.2"');
  const all = Array.from(root.getElementsByTagNameNS(RAILML_NS, '*'));
  if (root.namespaceURI === RAILML_NS) all.unshift(root);
  const ids = new Map<string, Element>();
  for (const el of all) {
    const id = el.getAttribute('id');
    if (id === null) continue;
    if (!isNcName(id)) out.push(`<${el.localName}> id "${id}" is not an NCName`);
    if (ids.has(id)) out.push(`Duplicate id "${id}" (<${ids.get(id)!.localName}> and <${el.localName}>)`);
    else ids.set(id, el);
  }
  const where = (el: Element): string => {
    const id = el.getAttribute('id') ?? el.parentElement?.getAttribute('id');
    return `<${el.localName}>${id ? ` (${id})` : ''}`;
  };
  for (const el of all) {
    const name = el.localName;
    for (const a of REQUIRED_ATTRS[name] ?? []) {
      if (!el.hasAttribute(a) || el.getAttribute(a) === '') out.push(`${where(el)} has no @${a}`);
    }
    for (const [a, values] of Object.entries(ENUMS[name] ?? {})) {
      const v = el.getAttribute(a);
      if (v !== null && !values.includes(v) && !/^other:\w{2,}$/.test(v)) out.push(`${where(el)} @${a}="${v}" is not one of ${values.join(', ')}`);
    }
    for (const [child, min, max] of REQUIRED_CHILDREN[name] ?? []) {
      const n = childrenNamed(el, child).filter((c) => c.namespaceURI === RAILML_NS).length;
      if (n < min) out.push(`${where(el)} needs at least ${min} <${child}>`);
      if (max !== undefined && n > max) out.push(`${where(el)} has more than ${max} <${child}>`);
    }
    const refs: Record<string, readonly string[] | null> = { ...(REFS[name] ?? {}) };
    if (name === 'refersTo' && el.parentElement && REFERS_TO[el.parentElement.localName]) refs.ref = REFERS_TO[el.parentElement.localName];
    if ((name === 'branchLeft' || name === 'branchRight') && el.parentElement?.localName === 'switchIL') refs.ref = ['track'];
    for (const [a, targets] of Object.entries(refs)) {
      const v = el.getAttribute(a);
      if (!v) continue;
      const target = ids.get(v);
      if (!target) out.push(`${where(el)} @${a}="${v}" refers to no element`);
      else if (targets && !targets.includes(target.localName)) out.push(`${where(el)} @${a}="${v}" refers to a <${target.localName}>, expected ${targets.join(' or ')}`);
    }
    if (name === 'intrinsicCoordinate' || name === 'spotLocation') {
      const t = el.getAttribute('intrinsicCoord');
      if (t !== null && !(Number(t) >= 0 && Number(t) <= 1)) out.push(`${where(el)} @intrinsicCoord="${t}" is outside 0..1`);
    }
  }
  return out;
}
