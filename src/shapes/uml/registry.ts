/**
 * UML 2.5 shapes registry
 */

import { shapeRegistry } from '../registry';

export function registerUmlShapes(): void {
  // Class diagrams
  shapeRegistry.register({
    id: 'uml_class',
    type: 'vertex',
    label: 'Class',
    icon: '◻',
    group: 'UML',
    width: 140,
    height: 120,
    style: { shape: 'customUmlClass', fillColor: '#e8f4f8', strokeColor: '#0c5aa0' },
  });

  shapeRegistry.register({
    id: 'uml_interface',
    type: 'vertex',
    label: 'Interface',
    icon: '⟪I⟫',
    group: 'UML',
    width: 140,
    height: 100,
    style: { shape: 'customUmlClass', fillColor: '#f0f0f0', strokeColor: '#666666' },
  });

  shapeRegistry.register({
    id: 'uml_object',
    type: 'vertex',
    label: 'Object',
    icon: '🔹',
    group: 'UML',
    width: 140,
    height: 80,
    style: { shape: 'customUmlObject', fillColor: '#fff9e6', strokeColor: '#d4a500' },
  });

  shapeRegistry.register({
    id: 'uml_component',
    type: 'vertex',
    label: 'Component',
    icon: '⚙',
    group: 'UML',
    width: 140,
    height: 100,
    style: { shape: 'customUmlComponent', fillColor: '#e8f4f8', strokeColor: '#0c5aa0' },
  });

  shapeRegistry.register({
    id: 'uml_artifact',
    type: 'vertex',
    label: 'Artifact',
    icon: '📋',
    group: 'UML',
    width: 100,
    height: 120,
    style: { shape: 'customUmlArtifact', fillColor: '#fce4d6', strokeColor: '#c65911' },
  });

  shapeRegistry.register({
    id: 'uml_package',
    type: 'vertex',
    label: 'Package',
    icon: '📦',
    group: 'UML',
    width: 120,
    height: 100,
    style: { shape: 'customUmlPackage', fillColor: '#fce4d6', strokeColor: '#c65911' },
  });

  // Use case diagrams
  shapeRegistry.register({
    id: 'uml_actor',
    type: 'vertex',
    label: 'Actor',
    icon: '👤',
    group: 'UML',
    width: 60,
    height: 100,
    style: { shape: 'customActor', fillColor: '#fff2cc', strokeColor: '#d6b656' },
  });

  shapeRegistry.register({
    id: 'uml_usecase',
    type: 'vertex',
    label: 'Use Case',
    icon: '◯',
    group: 'UML',
    width: 100,
    height: 60,
    style: { shape: 'customUmlUsecase', fillColor: '#e1d5e7', strokeColor: '#9673a6' },
  });

  // State diagrams
  shapeRegistry.register({
    id: 'uml_state',
    type: 'vertex',
    label: 'State',
    icon: '◐',
    group: 'UML',
    width: 100,
    height: 80,
    style: { shape: 'customUmlState', fillColor: '#b3e5fc', strokeColor: '#0288d1' },
  });

  shapeRegistry.register({
    id: 'uml_initial_state',
    type: 'vertex',
    label: 'Initial State',
    icon: '●',
    group: 'UML',
    width: 40,
    height: 40,
    style: { shape: 'customUmlInitialState', fillColor: '#000000', strokeColor: '#000000' },
  });

  shapeRegistry.register({
    id: 'uml_final_state',
    type: 'vertex',
    label: 'Final State',
    icon: '◯●',
    group: 'UML',
    width: 40,
    height: 40,
    style: { shape: 'customUmlFinalState', fillColor: '#ffffff', strokeColor: '#000000' },
  });

  // Activity diagrams
  shapeRegistry.register({
    id: 'uml_activity',
    type: 'vertex',
    label: 'Activity',
    icon: '▬',
    group: 'UML',
    width: 120,
    height: 80,
    style: { shape: 'customUmlActivity', fillColor: '#b3e5fc', strokeColor: '#0288d1' },
  });

  shapeRegistry.register({
    id: 'uml_fork_join',
    type: 'vertex',
    label: 'Fork/Join',
    icon: '▮▮',
    group: 'UML',
    width: 120,
    height: 20,
    style: { shape: 'customUmlForkJoin', fillColor: 'none', strokeColor: '#000000', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'uml_decision',
    type: 'vertex',
    label: 'Decision',
    icon: '◇',
    group: 'UML',
    width: 80,
    height: 80,
    style: { shape: 'customUmlDecision', fillColor: '#ffd966', strokeColor: '#f1c232' },
  });

  shapeRegistry.register({
    id: 'uml_merge',
    type: 'vertex',
    label: 'Merge',
    icon: '◆',
    group: 'UML',
    width: 80,
    height: 80,
    style: { shape: 'customUmlMerge', fillColor: '#c5e1a5', strokeColor: '#9ccc65' },
  });

  // Sequence diagrams
  shapeRegistry.register({
    id: 'uml_lifeline',
    type: 'vertex',
    label: 'Lifeline',
    icon: '⬚',
    group: 'UML',
    width: 100,
    height: 200,
    style: { shape: 'customUmlLifeline', fillColor: '#e8f4f8', strokeColor: '#0c5aa0' },
  });

  shapeRegistry.register({
    id: 'uml_activation_box',
    type: 'vertex',
    label: 'Activation Box',
    icon: '▭',
    group: 'UML',
    width: 40,
    height: 100,
    style: { shape: 'customUmlActivationBox', fillColor: '#ffffff', strokeColor: '#0c5aa0' },
  });

  shapeRegistry.register({
    id: 'uml_message_arrow',
    type: 'vertex',
    label: 'Message',
    icon: '→',
    group: 'UML',
    width: 100,
    height: 20,
    style: { shape: 'customUmlMessageArrow', filled: false, strokeColor: '#0c5aa0', strokeWidth: 1.5 },
  });

  shapeRegistry.register({
    id: 'uml_combined_fragment',
    type: 'vertex',
    label: 'Combined Fragment',
    icon: '□',
    group: 'UML',
    width: 200,
    height: 120,
    style: { shape: 'customUmlCombinedFragment', fillColor: '#ffffff', strokeColor: '#0c5aa0' },
  });

  shapeRegistry.register({
    id: 'uml_interaction_use',
    type: 'vertex',
    label: 'Interaction Use',
    icon: '⟨⟩',
    group: 'UML',
    width: 140,
    height: 80,
    style: { shape: 'customUmlInteractionUse', fillColor: '#ffffff', strokeColor: '#0c5aa0' },
  });

  shapeRegistry.register({
    id: 'uml_note',
    type: 'vertex',
    label: 'Note',
    icon: '📝',
    group: 'UML',
    width: 100,
    height: 80,
    style: { shape: 'customUmlNote', fillColor: '#ffffcc', strokeColor: '#d4a500' },
  });

  // PlantUML participant types
  shapeRegistry.register({
    id: 'plantuml_participant',
    type: 'vertex',
    label: 'Participant',
    icon: '▭',
    group: 'PlantUML',
    width: 100,
    height: 40,
    style: { shape: 'customPlantUmlParticipant', fillColor: '#e8f4f8', strokeColor: '#0c5aa0' },
  });

  shapeRegistry.register({
    id: 'plantuml_actor',
    type: 'vertex',
    label: 'Actor',
    icon: '👤',
    group: 'PlantUML',
    width: 60,
    height: 100,
    style: { shape: 'customPlantUmlActor', fillColor: '#fff2cc', strokeColor: '#d6b656' },
  });

  shapeRegistry.register({
    id: 'plantuml_boundary',
    type: 'vertex',
    label: 'Boundary',
    icon: '◯',
    group: 'PlantUML',
    width: 80,
    height: 100,
    style: { shape: 'customPlantUmlBoundary', fillColor: '#e8f4f8', strokeColor: '#0c5aa0' },
  });

  shapeRegistry.register({
    id: 'plantuml_control',
    type: 'vertex',
    label: 'Control',
    icon: '◆',
    group: 'PlantUML',
    width: 80,
    height: 100,
    style: { shape: 'customPlantUmlControl', fillColor: '#f8e8f4', strokeColor: '#8b0c5a' },
  });

  shapeRegistry.register({
    id: 'plantuml_entity',
    type: 'vertex',
    label: 'Entity',
    icon: '▯',
    group: 'PlantUML',
    width: 80,
    height: 100,
    style: { shape: 'customPlantUmlEntity', fillColor: '#f4f8e8', strokeColor: '#5aa00c' },
  });

  shapeRegistry.register({
    id: 'plantuml_database',
    type: 'vertex',
    label: 'Database',
    icon: '◧',
    group: 'PlantUML',
    width: 80,
    height: 100,
    style: { shape: 'customPlantUmlDatabase', fillColor: '#ffe8e8', strokeColor: '#a00c0c' },
  });

  shapeRegistry.register({
    id: 'plantuml_collections',
    type: 'vertex',
    label: 'Collections',
    icon: '▦',
    group: 'PlantUML',
    width: 80,
    height: 100,
    style: { shape: 'customPlantUmlCollections', fillColor: '#e8e8f4', strokeColor: '#0c0ca0' },
  });

  shapeRegistry.register({
    id: 'plantuml_queue',
    type: 'vertex',
    label: 'Queue',
    icon: '▬',
    group: 'PlantUML',
    width: 80,
    height: 100,
    style: { shape: 'customPlantUmlQueue', fillColor: '#f4e8e8', strokeColor: '#8b5a0c' },
  });
}
