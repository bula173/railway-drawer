/**
 * @file schema-order.ts
 * @brief Child element order of the railML 3.2 elements this app writes (from the railML 3 wiki's
 *        schema exports, wiki3.railml.org), so generated and preserved elements are inserted where
 *        the XSD sequence expects them.
 */
import { RAILML_NS, childNamed } from './xml';

const LOCATED = ['name', 'isValid', 'areaLocation', 'linearLocation', 'spotLocation', 'gmlLocations', 'networkLocation', 'designator', 'external', 'typeDesignator'];

export const CHILD_ORDER: Record<string, readonly string[]> = {
  // Wiki 3.2 lists the root children alphabetically; metadata first is what the railML examples use
  railML: ['metadata', 'common', 'infrastructure', 'interlocking', 'rollingstock', 'timetable', 'visualizations'],
  common: ['electrificationSystems', 'organizationalUnits', 'speedProfiles', 'positioning', 'timePeriods', 'projects'],
  positioning: ['geometricPositioningSystems', 'linearPositioningSystems', 'screenPositioningSystems'],
  infrastructure: ['topology', 'geometry', 'functionalInfrastructure', 'physicalFacilities', 'infrastructureStates', 'genericLocations'],
  topology: ['netElements', 'netRelations', 'networks', 'netTravelPaths'],
  netElement: ['name', 'isValid', 'relation', 'elementCollectionUnordered', 'elementCollectionOrdered', 'associatedPositioningSystem', 'designator'],
  netRelation: ['name', 'isValid', 'elementA', 'elementB'],
  functionalInfrastructure: [
    'balises', 'baliseGroups', 'borders', 'bufferStops', 'crossings', 'derailersIS', 'detectors', 'electrifications',
    'etcsAreas', 'etcsLevelTransitions', 'keyLocksIS', 'levelCrossingsIS', 'lines', 'loadingGauges', 'operationalPoints',
    'overCrossings', 'platforms', 'platformEdges', 'radioBlockCentreBorders', 'restrictionAreas', 'serviceSections',
    'signalsIS', 'speeds', 'stoppingPlaces', 'switchesIS', 'tracks', 'trackBeds', 'trackGauges', 'trainDetectionElements',
    'trainProtectionElements', 'trainRadios', 'underCrossings', 'weightLimits', 'mileageChanges', 'tunnelGatesIS',
  ],
  signalIS: [
    ...LOCATED, 'isAnnouncementSignal', 'isCatenarySignal', 'isDangerSignal', 'isEtcsSignal', 'isInformationSignal',
    'isLevelCrossingSignal', 'isMilepost', 'isSpeedSignal', 'isStopPost', 'isTrainMovementSignal', 'isTrainRadioSignal',
    'isVehicleEquipmentSignal', 'connectedWithBaliseGroup', 'protectedByBaliseGroup', 'signalConstruction',
  ],
  switchIS: [...LOCATED, 'leftBranch', 'rightBranch', 'straightBranch', 'turningBranch', 'locationReference'],
  track: [...LOCATED, 'trackBegin', 'trackEnd', 'length', 'belongsToParent'],
  balise: [...LOCATED, 'isEurobalise'],
  baliseGroup: [...LOCATED, 'applicationType', 'connectedWithInfrastructureElement', 'functionalType', 'isEurobaliseGroup'],
  trainDetectionElement: [...LOCATED, 'limitsTrainDetectionElement'],
  bufferStop: LOCATED,
  levelCrossingIS: [...LOCATED, 'crossesElement', 'etcsLevelCrossing', 'linkedSpeedSection', 'protection'],
  interlocking: ['assetsForInterlockings', 'controllers', 'signalBoxes', 'radioBlockCentres', 'specificInfrastructureManagers'],
  assetsForInterlocking: [
    'designator', 'tracksIL', 'endOfTracks', 'tvdSections', 'switchesIL', 'derailersIL', 'movableCrossings', 'levelCrossingsIL',
    'keys', 'keyLocksIL', 'genericDetectors', 'movableBridges', 'tunnelGatesIL', 'signalIndicators', 'routeStatusIndicators',
    'stationIndicators', 'trainNumberFields', 'signalsIL', 'interfaces', 'workZones', 'localOperationAreas', 'shuntingZones',
    'permissionZones', 'routeReleaseGroupsAhead', 'routeReleaseGroupsRear', 'routes', 'conflictingRoutes', 'routeRelations',
    'combinedRoutes', 'overlaps', 'dangerPoints', 'destinationPoints', 'powerSuppliesIL',
  ],
  tvdSection: [
    'designator', 'assetName', 'belongsToOperationalPoint', 'hasCommand', 'hasIndication', 'hasDemarcatingBufferstop',
    'hasExitSignal', 'hasDemarcatingTraindetector', 'hasResetStrategy', 'hasTrainNumberField', 'hasTrackElement',
  ],
  switchIL: [
    'designator', 'assetName', 'belongsToOperationalPoint', 'hasCommand', 'hasIndication', 'refersTo', 'hasGaugeClearanceMarker',
    'hasTvdSection', 'connectedToPowerSupply', 'relatedMovableElement', 'hasFoulingTrainDetectors', 'branchLeft', 'branchRight',
    'branchTip', 'hasPositionRestriction',
  ],
  signalIL: ['designator', 'assetName', 'belongsToOperationalPoint', 'hasCommand', 'hasIndication', 'refersTo', 'protectsBlockExit', 'hasRepeater', 'hasIndicator'],
  route: [
    'designator', 'objectName', 'belongsToOperationalPoint', 'hasCommand', 'hasIndication', 'handlesRouteType',
    'routeActivationSection', 'facingSwitchInPosition', 'trailingSwitchInPosition', 'hasTvdSection', 'routeEntry',
    'intermediateCodePoint', 'hasReleaseGroup', 'switchPositionInDepartureTrack', 'routeExit', 'additionalRelation',
  ],
  overlap: ['designator', 'activeForApproachRoute', 'requiresSwitchInPosition', 'hasTvdSection', 'isLimitedBy', 'overlapRelease'],
  radioBlockCentre: [
    'designator', 'hasName', 'hasCommunicationSettings', 'belongsToOperationalPoint', 'belongsToInfrastructureManager',
    'etcsGeneralData', 'isLimitedByRadioBlockCentreBorder', 'containedTrackAssets', 'hasCommand', 'hasIndication', 'connectedSignalBox',
  ],
  infrastructureVisualization: ['name', 'designator', 'areaElementProjection', 'ellipticalProjection', 'linearElementProjection', 'spotElementProjection'],
};

/**
 * Inserts `child` into `parent` at the place its local name has in the parent's sequence
 * (after its own kind, before later kinds). Unknown names (other namespaces) go last.
 */
export function insertOrdered(parent: Element, child: Element): Element {
  const order = CHILD_ORDER[parent.localName];
  const idx = order && child.namespaceURI === RAILML_NS ? order.indexOf(child.localName) : -1;
  if (idx < 0) {
    parent.appendChild(child);
    return child;
  }
  for (const existing of Array.from(parent.children)) {
    const j = existing.namespaceURI === RAILML_NS ? order!.indexOf(existing.localName) : Infinity;
    if (j > idx || (j < 0 && existing.namespaceURI !== RAILML_NS)) {
      parent.insertBefore(child, existing);
      return child;
    }
  }
  parent.appendChild(child);
  return child;
}

/** The railML child `name` of `parent`, created at its sequence place when missing. */
export function ensureOrdered(parent: Element, name: string): Element {
  return childNamed(parent, name) ?? insertOrdered(parent, parent.ownerDocument.createElementNS(RAILML_NS, name));
}
