import { CellRenderer } from '@maxgraph/core';
import { ArrowShape } from './arrows/arrow';
import { LineShape } from './basic/line';
import { CloudShape } from './cloud/cloud';
import { DocumentShape } from './flowchart/document';
import { DatabaseShape } from './cloud/database';
import { TerminatorShape } from './flowchart/terminator';
import { ActorShape } from './uml/actor';
import { DataShape } from './flowchart/data';
import { BpmnEventShape } from './bpmn/bpmn-event';
import { BpmnTaskShape } from './bpmn/bpmn-task';
import { BpmnGatewayShape } from './bpmn/bpmn-gateway';
import { UmlClassShape } from './uml/uml-class';
import { UmlUsecaseShape } from './uml/uml-usecase';
import { UmlStateShape, UmlInitialStateShape, UmlFinalStateShape } from './uml/uml-state';
import { UmlComponentShape, UmlArtifactShape } from './uml/uml-component';
import { UmlPackageShape, UmlObjectShape } from './uml/uml-package';
import { UmlActivityShape, UmlForkJoinShape, UmlDecisionShape, UmlMergeShape } from './uml/uml-activity';
import { UmlLifelineShape, UmlActivationBoxShape, UmlMessageArrowShape, UmlCombinedFragmentShape, UmlInteractionUseShape, UmlNoteShape } from './uml/uml-sequence';
import { HexagonShape, PentagonShape, StarShape, TrapezoidShape, CrossShape, CylinderShape, SimpleArrowShape, OvalShape, DoubleRectangleShape, ParallelogramShape, DelayShape, ChevronShape, RightAngleShape, LozengeShape, RoundedRectangleShape } from './basic/basic-shapes';
import { RailShape, SignalShape, SwitchShape, JunctionShape, PlatformShape, StationShape, CrossingShape, TunnelShape, BufferShape, CabinShape, LTAShape, LTOShape, DetectionPointShape, TrackSectionShape, VerticalConnectorShape, EOLMarkerShape, RailLevelShape, SlopedTrackShape, TrainShape, SignalHeadShape, RBCShape, CommunicationLineShape, EBSectionShape, WaysideEquipmentShape, TrackCircuitShape, ERTMSLevelMarkerShape, SpeedRestrictionMarkerShape, ERTMSBaliseShape, ERTMSLevelCrossingShape, ERTMSHandoverPointShape, NationalTransitionPointShape, ERTMSTransponderShape, ERTMSSectionMarkerShape } from './railway/railway-shapes';
import { ImageShape } from './custom/image-shape';
import { registerArrowShapes } from './arrows';
import { registerBasicShapes } from './basic';
import { registerFlowchartShapes } from './flowchart';
import { registerCloudShapes } from './cloud';
import { registerDfdShapes } from './dfd';
import { registerC4Shapes } from './c4';
import { registerNetworkShapes } from './network';
import { registerBpmnShapes } from './bpmn';
import { registerUmlShapes } from './uml';
import { registerRailwayShapes } from './railway';
import { registerErtmsShapes } from './ertms';
import { registerCustomShapes } from './custom';

export function registerShapes() {
  // Register basic vertex-based shapes with CellRenderer
  CellRenderer.registerShape('customHexagon', HexagonShape as any);
  CellRenderer.registerShape('customPentagon', PentagonShape as any);
  CellRenderer.registerShape('customStar', StarShape as any);
  CellRenderer.registerShape('customTrapezoid', TrapezoidShape as any);
  CellRenderer.registerShape('customCross', CrossShape as any);
  CellRenderer.registerShape('customCylinder', CylinderShape as any);
  CellRenderer.registerShape('customSimpleArrow', SimpleArrowShape as any);
  CellRenderer.registerShape('customOval', OvalShape as any);
  CellRenderer.registerShape('customDoubleRectangle', DoubleRectangleShape as any);
  CellRenderer.registerShape('customParallelogram', ParallelogramShape as any);
  CellRenderer.registerShape('customDelay', DelayShape as any);
  CellRenderer.registerShape('customChevron', ChevronShape as any);
  CellRenderer.registerShape('customRightAngle', RightAngleShape as any);
  CellRenderer.registerShape('customLozenge', LozengeShape as any);
  CellRenderer.registerShape('customRoundedRectangle', RoundedRectangleShape as any);

  // Register custom utility shapes
  CellRenderer.registerShape('customLine', LineShape as any);
  CellRenderer.registerShape('customArrow', ArrowShape as any);
  CellRenderer.registerShape('customCloud', CloudShape as any);
  CellRenderer.registerShape('customDocument', DocumentShape as any);
  CellRenderer.registerShape('customDatabase', DatabaseShape as any);
  CellRenderer.registerShape('customTerminator', TerminatorShape as any);
  CellRenderer.registerShape('customActor', ActorShape as any);
  CellRenderer.registerShape('customData', DataShape as any);
  CellRenderer.registerShape('customBpmnEvent', BpmnEventShape as any);
  CellRenderer.registerShape('customBpmnTask', BpmnTaskShape as any);
  CellRenderer.registerShape('customBpmnGateway', BpmnGatewayShape as any);

  // Register UML shapes
  CellRenderer.registerShape('customUmlClass', UmlClassShape as any);
  CellRenderer.registerShape('customUmlUsecase', UmlUsecaseShape as any);
  CellRenderer.registerShape('customUmlState', UmlStateShape as any);
  CellRenderer.registerShape('customUmlInitialState', UmlInitialStateShape as any);
  CellRenderer.registerShape('customUmlFinalState', UmlFinalStateShape as any);
  CellRenderer.registerShape('customUmlComponent', UmlComponentShape as any);
  CellRenderer.registerShape('customUmlArtifact', UmlArtifactShape as any);
  CellRenderer.registerShape('customUmlPackage', UmlPackageShape as any);
  CellRenderer.registerShape('customUmlObject', UmlObjectShape as any);
  CellRenderer.registerShape('customUmlActivity', UmlActivityShape as any);
  CellRenderer.registerShape('customUmlForkJoin', UmlForkJoinShape as any);
  CellRenderer.registerShape('customUmlDecision', UmlDecisionShape as any);
  CellRenderer.registerShape('customUmlMerge', UmlMergeShape as any);
  CellRenderer.registerShape('customUmlLifeline', UmlLifelineShape as any);
  CellRenderer.registerShape('customUmlActivationBox', UmlActivationBoxShape as any);
  CellRenderer.registerShape('customUmlMessageArrow', UmlMessageArrowShape as any);
  CellRenderer.registerShape('customUmlCombinedFragment', UmlCombinedFragmentShape as any);
  CellRenderer.registerShape('customUmlInteractionUse', UmlInteractionUseShape as any);
  CellRenderer.registerShape('customUmlNote', UmlNoteShape as any);

  // Register Railway shapes
  CellRenderer.registerShape('customRail', RailShape as any);
  CellRenderer.registerShape('customSignal', SignalShape as any);
  CellRenderer.registerShape('customSwitch', SwitchShape as any);
  CellRenderer.registerShape('customJunction', JunctionShape as any);
  CellRenderer.registerShape('customPlatform', PlatformShape as any);
  CellRenderer.registerShape('customStation', StationShape as any);
  CellRenderer.registerShape('customCrossing', CrossingShape as any);
  CellRenderer.registerShape('customTunnel', TunnelShape as any);
  CellRenderer.registerShape('customBuffer', BufferShape as any);
  CellRenderer.registerShape('customCabin', CabinShape as any);
  CellRenderer.registerShape('customLTA', LTAShape as any);
  CellRenderer.registerShape('customLTO', LTOShape as any);
  CellRenderer.registerShape('customDetectionPoint', DetectionPointShape as any);
  CellRenderer.registerShape('customTrackSection', TrackSectionShape as any);
  CellRenderer.registerShape('customVerticalConnector', VerticalConnectorShape as any);
  CellRenderer.registerShape('customEOLMarker', EOLMarkerShape as any);
  CellRenderer.registerShape('customRailLevel', RailLevelShape as any);
  CellRenderer.registerShape('customSlopedTrack', SlopedTrackShape as any);
  CellRenderer.registerShape('customTrain', TrainShape as any);
  CellRenderer.registerShape('customSignalHead', SignalHeadShape as any);
  CellRenderer.registerShape('customRBC', RBCShape as any);
  CellRenderer.registerShape('customCommunicationLine', CommunicationLineShape as any);
  CellRenderer.registerShape('customEBSection', EBSectionShape as any);
  CellRenderer.registerShape('customWaysideEquipment', WaysideEquipmentShape as any);
  CellRenderer.registerShape('customTrackCircuit', TrackCircuitShape as any);

  // Register ERTMS shapes
  CellRenderer.registerShape('customERTMSLevelMarker', ERTMSLevelMarkerShape as any);
  CellRenderer.registerShape('customSpeedRestrictionMarker', SpeedRestrictionMarkerShape as any);
  CellRenderer.registerShape('customERTMSBalise', ERTMSBaliseShape as any);
  CellRenderer.registerShape('customERTMSLevelCrossing', ERTMSLevelCrossingShape as any);
  CellRenderer.registerShape('customERTMSHandoverPoint', ERTMSHandoverPointShape as any);
  CellRenderer.registerShape('customNationalTransitionPoint', NationalTransitionPointShape as any);
  CellRenderer.registerShape('customERTMSTransponder', ERTMSTransponderShape as any);
  CellRenderer.registerShape('customERTMSSectionMarker', ERTMSSectionMarkerShape as any);

  // Register image shape
  CellRenderer.registerShape('customImage', ImageShape as any);

  // Register all shape groups via their registry functions
  registerBasicShapes();
  registerFlowchartShapes();
  registerArrowShapes();
  registerCloudShapes();
  registerDfdShapes();
  registerC4Shapes();
  registerNetworkShapes();
  registerBpmnShapes();
  registerUmlShapes();
  registerRailwayShapes();
  registerErtmsShapes();
  registerCustomShapes();
}

export { shapeRegistry } from './registry';
export type { ShapeConfig } from './registry';
export { ShapeToolbar } from './toolbar';
