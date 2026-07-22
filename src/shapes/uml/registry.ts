/**
 * UML 2.5 shapes registry
 */

import { shapeRegistry } from '../registry';

export function registerUmlShapes(): void {
  // Class diagrams
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

  // Use case diagrams
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

  // State diagrams
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

  // Activity diagrams
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

  // Sequence diagrams
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
}
