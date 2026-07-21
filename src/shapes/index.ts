import { CellRenderer } from '@maxgraph/core';
import { ArrowShape } from './arrow';
import { LineShape } from './line';
import { CloudShape } from './cloud';
import { DocumentShape } from './document';
import { DatabaseShape } from './database';
import { TerminatorShape } from './terminator';
import { ActorShape } from './actor';
import { DataShape } from './data';
import { BpmnEventShape } from './bpmn-event';
import { BpmnTaskShape } from './bpmn-task';
import { BpmnGatewayShape } from './bpmn-gateway';
import { UmlClassShape } from './uml-class';
import { UmlUsecaseShape } from './uml-usecase';
import { UmlStateShape, UmlInitialStateShape, UmlFinalStateShape } from './uml-state';
import { UmlComponentShape, UmlArtifactShape } from './uml-component';
import { UmlPackageShape, UmlObjectShape } from './uml-package';
import { UmlActivityShape, UmlForkJoinShape, UmlDecisionShape, UmlMergeShape } from './uml-activity';
import { UmlLifelineShape, UmlActivationBoxShape, UmlMessageArrowShape, UmlCombinedFragmentShape, UmlInteractionUseShape, UmlNoteShape } from './uml-sequence';
import { HexagonShape, PentagonShape, StarShape, TrapezoidShape, CrossShape, CylinderShape, SimpleArrowShape, OvalShape, DoubleRectangleShape, ParallelogramShape, DelayShape, ChevronShape, RightAngleShape, LozengeShape, RoundedRectangleShape } from './basic-shapes';
import { RailShape, SignalShape, SwitchShape, JunctionShape, PlatformShape, StationShape, CrossingShape, TunnelShape, BufferShape, CabinShape, LTAShape, LTOShape, DetectionPointShape, TrackSectionShape, VerticalConnectorShape, EOLMarkerShape, RailLevelShape, SlopedTrackShape, TrainShape, SignalHeadShape, RBCShape, CommunicationLineShape, EBSectionShape, WaysideEquipmentShape, TrackCircuitShape } from './railway-shapes';
import { railwayShapes } from './railway';
import { shapeRegistry } from './registry';

export function registerShapes() {
  // Register basic shapes
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

  // Register custom shapes
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

  // ===== BASIC SHAPES =====
  shapeRegistry.register({
    id: 'rectangle',
    label: 'Rectangle',
    icon: '▭',
    group: 'Basic',
    width: 100,
    height: 60,
    style: { fillColor: '#e1d5e7', strokeColor: '#9673a6' },
  });

  shapeRegistry.register({
    id: 'circle',
    label: 'Circle',
    icon: '●',
    group: 'Basic',
    width: 80,
    height: 80,
    style: { shape: 'ellipse', fillColor: '#d4e6f1', strokeColor: '#3498db' },
  });

  shapeRegistry.register({
    id: 'diamond',
    label: 'Diamond',
    icon: '◇',
    group: 'Basic',
    width: 80,
    height: 80,
    style: { shape: 'diamond', fillColor: '#f9e79f', strokeColor: '#f39c12' },
  });

  shapeRegistry.register({
    id: 'triangle',
    label: 'Triangle',
    icon: '△',
    group: 'Basic',
    width: 80,
    height: 80,
    style: { shape: 'triangle', fillColor: '#f8b88b', strokeColor: '#e67e22' },
  });

  shapeRegistry.register({
    id: 'line',
    label: 'Line',
    icon: '─',
    group: 'Basic',
    width: 100,
    height: 10,
    style: { shape: 'customLine', strokeColor: '#2c3e50', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'rounded_rectangle',
    label: 'Rounded Rectangle',
    icon: '⛶',
    group: 'Basic',
    width: 100,
    height: 60,
    style: { rounded: true, fillColor: '#a9d08e', strokeColor: '#70ad47' },
  });

  // ===== FLOWCHART SHAPES =====
  shapeRegistry.register({
    id: 'process',
    label: 'Process',
    icon: '▬',
    group: 'Flowchart',
    width: 100,
    height: 60,
    style: { fillColor: '#dda0dd', strokeColor: '#8b008b' },
  });

  shapeRegistry.register({
    id: 'decision',
    label: 'Decision',
    icon: '◇',
    group: 'Flowchart',
    width: 100,
    height: 100,
    style: { shape: 'diamond', fillColor: '#ffd700', strokeColor: '#ffa500' },
  });

  shapeRegistry.register({
    id: 'cylinder',
    label: 'Cylinder',
    icon: '⊗',
    group: 'Flowchart',
    width: 80,
    height: 80,
    style: { shape: 'cylinder', fillColor: '#87ceeb', strokeColor: '#4682b4' },
  });

  shapeRegistry.register({
    id: 'parallelogram',
    label: 'Parallelogram',
    icon: '⬠',
    group: 'Flowchart',
    width: 100,
    height: 60,
    style: { fillColor: '#98fb98', strokeColor: '#228b22' },
  });

  shapeRegistry.register({
    id: 'document',
    label: 'Document',
    icon: '📄',
    group: 'Flowchart',
    width: 80,
    height: 100,
    style: { shape: 'customDocument', fillColor: '#ffecb3', strokeColor: '#fbc02d' },
  });

  shapeRegistry.register({
    id: 'data',
    label: 'Data',
    icon: '⬡',
    group: 'Flowchart',
    width: 100,
    height: 60,
    style: { shape: 'customData', fillColor: '#b3e5fc', strokeColor: '#0288d1' },
  });

  shapeRegistry.register({
    id: 'terminator',
    label: 'Terminator',
    icon: '◠',
    group: 'Flowchart',
    width: 100,
    height: 60,
    style: { shape: 'customTerminator', fillColor: '#ffcccc', strokeColor: '#cc0000' },
  });

  shapeRegistry.register({
    id: 'loop',
    label: 'Loop',
    icon: '↻',
    group: 'Flowchart',
    width: 100,
    height: 80,
    style: { fillColor: '#ffe0b2', strokeColor: '#ff6f00' },
  });

  // ===== ARROWS & CONNECTORS =====
  shapeRegistry.register({
    id: 'arrow_right',
    label: 'Arrow Right',
    icon: '→',
    group: 'Arrows',
    width: 100,
    height: 60,
    style: { shape: 'customArrow', filled: false, strokeColor: '#2c3e50', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'arrow_left',
    label: 'Arrow Left',
    icon: '←',
    group: 'Arrows',
    width: 100,
    height: 60,
    style: { shape: 'customArrow', filled: false, strokeColor: '#2c3e50', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'arrow_up',
    label: 'Arrow Up',
    icon: '↑',
    group: 'Arrows',
    width: 60,
    height: 100,
    style: { shape: 'customArrow', filled: false, strokeColor: '#2c3e50', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'arrow_down',
    label: 'Arrow Down',
    icon: '↓',
    group: 'Arrows',
    width: 60,
    height: 100,
    style: { shape: 'customArrow', filled: false, strokeColor: '#2c3e50', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'double_arrow',
    label: 'Double Arrow',
    icon: '⇄',
    group: 'Arrows',
    width: 120,
    height: 60,
    style: { shape: 'customArrow', filled: false, strokeColor: '#2c3e50', strokeWidth: 2 },
  });

  // ===== UML 2.5 SHAPES (CLASS DIAGRAMS) =====
  shapeRegistry.register({
    id: 'uml_class',
    label: 'Class',
    icon: '◻',
    group: 'UML',
    width: 140,
    height: 120,
    style: { shape: 'customUmlClass', fillColor: '#e8f4f8', strokeColor: '#0c5aa0' },
  });

  shapeRegistry.register({
    id: 'uml_interface',
    label: 'Interface',
    icon: '⟪I⟫',
    group: 'UML',
    width: 140,
    height: 100,
    style: { shape: 'customUmlClass', fillColor: '#f0f0f0', strokeColor: '#666666' },
  });

  shapeRegistry.register({
    id: 'uml_object',
    label: 'Object',
    icon: '🔹',
    group: 'UML',
    width: 140,
    height: 80,
    style: { shape: 'customUmlObject', fillColor: '#fff9e6', strokeColor: '#d4a500' },
  });

  shapeRegistry.register({
    id: 'uml_component',
    label: 'Component',
    icon: '⚙',
    group: 'UML',
    width: 140,
    height: 100,
    style: { shape: 'customUmlComponent', fillColor: '#e8f4f8', strokeColor: '#0c5aa0' },
  });

  shapeRegistry.register({
    id: 'uml_artifact',
    label: 'Artifact',
    icon: '📋',
    group: 'UML',
    width: 100,
    height: 120,
    style: { shape: 'customUmlArtifact', fillColor: '#fce4d6', strokeColor: '#c65911' },
  });

  shapeRegistry.register({
    id: 'uml_package',
    label: 'Package',
    icon: '📦',
    group: 'UML',
    width: 120,
    height: 100,
    style: { shape: 'customUmlPackage', fillColor: '#fce4d6', strokeColor: '#c65911' },
  });

  // ===== UML 2.5 SHAPES (USE CASE DIAGRAMS) =====
  shapeRegistry.register({
    id: 'uml_actor',
    label: 'Actor',
    icon: '👤',
    group: 'UML',
    width: 60,
    height: 100,
    style: { shape: 'customActor', fillColor: '#fff2cc', strokeColor: '#d6b656' },
  });

  shapeRegistry.register({
    id: 'uml_usecase',
    label: 'Use Case',
    icon: '◯',
    group: 'UML',
    width: 100,
    height: 60,
    style: { shape: 'customUmlUsecase', fillColor: '#e1d5e7', strokeColor: '#9673a6' },
  });

  // ===== UML 2.5 SHAPES (STATE DIAGRAMS) =====
  shapeRegistry.register({
    id: 'uml_state',
    label: 'State',
    icon: '◐',
    group: 'UML',
    width: 100,
    height: 80,
    style: { shape: 'customUmlState', fillColor: '#b3e5fc', strokeColor: '#0288d1' },
  });

  shapeRegistry.register({
    id: 'uml_initial_state',
    label: 'Initial State',
    icon: '●',
    group: 'UML',
    width: 40,
    height: 40,
    style: { shape: 'customUmlInitialState', fillColor: '#000000', strokeColor: '#000000' },
  });

  shapeRegistry.register({
    id: 'uml_final_state',
    label: 'Final State',
    icon: '◯●',
    group: 'UML',
    width: 40,
    height: 40,
    style: { shape: 'customUmlFinalState', fillColor: '#ffffff', strokeColor: '#000000' },
  });

  // ===== UML 2.5 SHAPES (ACTIVITY DIAGRAMS) =====
  shapeRegistry.register({
    id: 'uml_activity',
    label: 'Activity',
    icon: '▬',
    group: 'UML',
    width: 120,
    height: 80,
    style: { shape: 'customUmlActivity', fillColor: '#b3e5fc', strokeColor: '#0288d1' },
  });

  shapeRegistry.register({
    id: 'uml_fork_join',
    label: 'Fork/Join',
    icon: '▮▮',
    group: 'UML',
    width: 120,
    height: 20,
    style: { shape: 'customUmlForkJoin', fillColor: 'none', strokeColor: '#000000', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'uml_decision',
    label: 'Decision',
    icon: '◇',
    group: 'UML',
    width: 80,
    height: 80,
    style: { shape: 'customUmlDecision', fillColor: '#ffd966', strokeColor: '#f1c232' },
  });

  shapeRegistry.register({
    id: 'uml_merge',
    label: 'Merge',
    icon: '◆',
    group: 'UML',
    width: 80,
    height: 80,
    style: { shape: 'customUmlMerge', fillColor: '#c5e1a5', strokeColor: '#9ccc65' },
  });

  // ===== UML 2.5 SHAPES (SEQUENCE DIAGRAMS) =====
  shapeRegistry.register({
    id: 'uml_lifeline',
    label: 'Lifeline',
    icon: '⬚',
    group: 'UML',
    width: 100,
    height: 200,
    style: { shape: 'customUmlLifeline', fillColor: '#e8f4f8', strokeColor: '#0c5aa0' },
  });

  shapeRegistry.register({
    id: 'uml_activation_box',
    label: 'Activation Box',
    icon: '▭',
    group: 'UML',
    width: 40,
    height: 100,
    style: { shape: 'customUmlActivationBox', fillColor: '#ffffff', strokeColor: '#0c5aa0' },
  });

  shapeRegistry.register({
    id: 'uml_message_arrow',
    label: 'Message',
    icon: '→',
    group: 'UML',
    width: 100,
    height: 20,
    style: { shape: 'customUmlMessageArrow', filled: false, strokeColor: '#0c5aa0', strokeWidth: 1.5 },
  });

  shapeRegistry.register({
    id: 'uml_combined_fragment',
    label: 'Combined Fragment',
    icon: '□',
    group: 'UML',
    width: 200,
    height: 120,
    style: { shape: 'customUmlCombinedFragment', fillColor: '#ffffff', strokeColor: '#0c5aa0' },
  });

  shapeRegistry.register({
    id: 'uml_interaction_use',
    label: 'Interaction Use',
    icon: '⟨⟩',
    group: 'UML',
    width: 140,
    height: 80,
    style: { shape: 'customUmlInteractionUse', fillColor: '#ffffff', strokeColor: '#0c5aa0' },
  });

  shapeRegistry.register({
    id: 'uml_note',
    label: 'Note',
    icon: '📝',
    group: 'UML',
    width: 100,
    height: 80,
    style: { shape: 'customUmlNote', fillColor: '#ffffcc', strokeColor: '#d4a500' },
  });

  // ===== CLOUD/AWS SHAPES =====
  shapeRegistry.register({
    id: 'cloud',
    label: 'Cloud',
    icon: '☁',
    group: 'Cloud',
    width: 120,
    height: 80,
    style: { shape: 'customCloud', fillColor: '#cfe2f3', strokeColor: '#4472c4' },
  });

  shapeRegistry.register({
    id: 'database',
    label: 'Database',
    icon: '🗄',
    group: 'Cloud',
    width: 80,
    height: 100,
    style: { shape: 'customDatabase', fillColor: '#e2efda', strokeColor: '#70ad47' },
  });

  shapeRegistry.register({
    id: 'server',
    label: 'Server',
    icon: '🖥',
    group: 'Cloud',
    width: 100,
    height: 80,
    style: { fillColor: '#deebf7', strokeColor: '#2f5496' },
  });

  shapeRegistry.register({
    id: 'bucket',
    label: 'S3 Bucket',
    icon: '🪣',
    group: 'Cloud',
    width: 80,
    height: 80,
    style: { fillColor: '#fff2cc', strokeColor: '#d6b656' },
  });

  shapeRegistry.register({
    id: 'queue',
    label: 'Queue',
    icon: '█',
    group: 'Cloud',
    width: 80,
    height: 60,
    style: { fillColor: '#fce4d6', strokeColor: '#c65911' },
  });

  // ===== DATA FLOW DIAGRAM SHAPES =====
  shapeRegistry.register({
    id: 'process_dfd',
    label: 'Process (DFD)',
    icon: '◻',
    group: 'DFD',
    width: 80,
    height: 60,
    style: { fillColor: '#d5a6bd', strokeColor: '#76448a' },
  });

  shapeRegistry.register({
    id: 'entity_dfd',
    label: 'Entity (DFD)',
    icon: '▭',
    group: 'DFD',
    width: 100,
    height: 60,
    style: { fillColor: '#b4c7e7', strokeColor: '#5b9bd5' },
  });

  shapeRegistry.register({
    id: 'datastore_dfd',
    label: 'Data Store (DFD)',
    icon: '▬',
    group: 'DFD',
    width: 100,
    height: 60,
    style: { fillColor: '#c6e0b4', strokeColor: '#70ad47' },
  });

  // ===== C4 MODEL SHAPES =====
  shapeRegistry.register({
    id: 'person_c4',
    label: 'Person (C4)',
    icon: '👤',
    group: 'C4',
    width: 100,
    height: 120,
    style: { fillColor: '#08427b', strokeColor: '#08427b', fontColor: '#ffffff' },
  });

  shapeRegistry.register({
    id: 'system_c4',
    label: 'System (C4)',
    icon: '▬',
    group: 'C4',
    width: 150,
    height: 100,
    style: { fillColor: '#1168bd', strokeColor: '#1168bd', fontColor: '#ffffff' },
  });

  shapeRegistry.register({
    id: 'container_c4',
    label: 'Container (C4)',
    icon: '📦',
    group: 'C4',
    width: 140,
    height: 100,
    style: { fillColor: '#438dd5', strokeColor: '#1168bd', fontColor: '#ffffff' },
  });

  shapeRegistry.register({
    id: 'component_c4',
    label: 'Component (C4)',
    icon: '⚙',
    group: 'C4',
    width: 120,
    height: 80,
    style: { fillColor: '#85bbd7', strokeColor: '#438dd5', fontColor: '#ffffff' },
  });

  // ===== NETWORK SHAPES =====
  shapeRegistry.register({
    id: 'router',
    label: 'Router',
    icon: '📡',
    group: 'Network',
    width: 80,
    height: 60,
    style: { fillColor: '#f4b084', strokeColor: '#ed7d31' },
  });

  shapeRegistry.register({
    id: 'switch',
    label: 'Switch',
    icon: '⧉',
    group: 'Network',
    width: 80,
    height: 60,
    style: { fillColor: '#c5e0b4', strokeColor: '#70ad47' },
  });

  shapeRegistry.register({
    id: 'firewall',
    label: 'Firewall',
    icon: '🛡',
    group: 'Network',
    width: 80,
    height: 60,
    style: { fillColor: '#f8cbad', strokeColor: '#ed7d31' },
  });

  shapeRegistry.register({
    id: 'client',
    label: 'Client',
    icon: '💻',
    group: 'Network',
    width: 80,
    height: 60,
    style: { fillColor: '#b4c7e7', strokeColor: '#5b9bd5' },
  });

  shapeRegistry.register({
    id: 'mobile_device',
    label: 'Mobile Device',
    icon: '📱',
    group: 'Network',
    width: 60,
    height: 100,
    style: { fillColor: '#e2efda', strokeColor: '#70ad47' },
  });

  // ===== BPMN (Business Process Model and Notation) SHAPES =====
  shapeRegistry.register({
    id: 'bpmn_event',
    label: 'Event',
    icon: '●',
    group: 'BPMN',
    width: 60,
    height: 60,
    style: { shape: 'customBpmnEvent', fillColor: '#fff2cc', strokeColor: '#d6b656' },
  });

  shapeRegistry.register({
    id: 'bpmn_task',
    label: 'Task',
    icon: '▬',
    group: 'BPMN',
    width: 120,
    height: 80,
    style: { shape: 'customBpmnTask', fillColor: '#b3e5fc', strokeColor: '#0288d1' },
  });

  shapeRegistry.register({
    id: 'bpmn_gateway',
    label: 'Gateway',
    icon: '◇',
    group: 'BPMN',
    width: 80,
    height: 80,
    style: { shape: 'customBpmnGateway', fillColor: '#f8b88b', strokeColor: '#e67e22' },
  });

  shapeRegistry.register({
    id: 'bpmn_subprocess',
    label: 'Subprocess',
    icon: '⬚',
    group: 'BPMN',
    width: 140,
    height: 100,
    style: { shape: 'customBpmnTask', fillColor: '#d4e6f1', strokeColor: '#3498db', dashed: true },
  });

  shapeRegistry.register({
    id: 'bpmn_data_object',
    label: 'Data Object',
    icon: '📄',
    group: 'BPMN',
    width: 80,
    height: 100,
    style: { fillColor: '#e2efda', strokeColor: '#70ad47' },
  });

  // ===== EXTENDED BASIC SHAPES =====
  shapeRegistry.register({
    id: 'hexagon',
    label: 'Hexagon',
    icon: '⬡',
    group: 'Basic',
    width: 100,
    height: 100,
    style: { shape: 'customHexagon', fillColor: '#c5e0b4', strokeColor: '#70ad47' },
  });

  shapeRegistry.register({
    id: 'pentagon',
    label: 'Pentagon',
    icon: '⬠',
    group: 'Basic',
    width: 100,
    height: 100,
    style: { shape: 'customPentagon', fillColor: '#f4b183', strokeColor: '#e67e22' },
  });

  shapeRegistry.register({
    id: 'star',
    label: 'Star',
    icon: '⭐',
    group: 'Basic',
    width: 100,
    height: 100,
    style: { shape: 'customStar', fillColor: '#ffd966', strokeColor: '#f1c232' },
  });

  shapeRegistry.register({
    id: 'trapezoid',
    label: 'Trapezoid',
    icon: '⟂',
    group: 'Basic',
    width: 100,
    height: 80,
    style: { shape: 'customTrapezoid', fillColor: '#e2efda', strokeColor: '#70ad47' },
  });

  shapeRegistry.register({
    id: 'cross',
    label: 'Cross',
    icon: '✚',
    group: 'Basic',
    width: 100,
    height: 100,
    style: { shape: 'customCross', fillColor: '#f8b88b', strokeColor: '#e67e22' },
  });

  shapeRegistry.register({
    id: 'cylinder_basic',
    label: 'Cylinder',
    icon: '🗄',
    group: 'Basic',
    width: 80,
    height: 100,
    style: { shape: 'customCylinder', fillColor: '#b3e5fc', strokeColor: '#0288d1' },
  });

  shapeRegistry.register({
    id: 'oval_basic',
    label: 'Oval',
    icon: '⬭',
    group: 'Basic',
    width: 100,
    height: 80,
    style: { shape: 'customOval', fillColor: '#d4e6f1', strokeColor: '#3498db' },
  });

  shapeRegistry.register({
    id: 'double_rectangle',
    label: 'Double Rect',
    icon: '▦',
    group: 'Basic',
    width: 100,
    height: 60,
    style: { shape: 'customDoubleRectangle', fillColor: '#e1d5e7', strokeColor: '#9673a6' },
  });

  shapeRegistry.register({
    id: 'lozenge',
    label: 'Lozenge',
    icon: '◇',
    group: 'Basic',
    width: 80,
    height: 80,
    style: { shape: 'customLozenge', fillColor: '#ffe6cc', strokeColor: '#ed7d31' },
  });

  shapeRegistry.register({
    id: 'chevron',
    label: 'Chevron',
    icon: '▶',
    group: 'Basic',
    width: 100,
    height: 60,
    style: { shape: 'customChevron', fillColor: '#cfe2f3', strokeColor: '#4472c4' },
  });

  shapeRegistry.register({
    id: 'delay',
    label: 'Delay',
    icon: '◠',
    group: 'Flowchart',
    width: 100,
    height: 60,
    style: { shape: 'customDelay', fillColor: '#fce4d6', strokeColor: '#c65911' },
  });

  shapeRegistry.register({
    id: 'right_angle',
    label: 'Right Angle',
    icon: '⌟',
    group: 'Basic',
    width: 80,
    height: 80,
    style: { shape: 'customRightAngle', fillColor: 'none', strokeColor: '#2c3e50', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'rounded_rect_basic',
    label: 'Rounded Rect',
    icon: '◫',
    group: 'Basic',
    width: 100,
    height: 60,
    style: { shape: 'customRoundedRectangle', fillColor: '#a9d08e', strokeColor: '#70ad47' },
  });

  // ===== RAILWAY SHAPES =====
  railwayShapes.forEach((shape) => {
    shapeRegistry.register(shape);
  });
}

export { shapeRegistry } from './registry';
export type { ShapeConfig } from './registry';
export { ShapeToolbar } from './toolbar';
