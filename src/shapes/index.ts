import { CellRenderer } from '@maxgraph/core';
import { ArrowShape } from './arrow';
import { CloudShape } from './cloud';
import { DocumentShape } from './document';
import { DatabaseShape } from './database';
import { TerminatorShape } from './terminator';
import { ActorShape } from './actor';
import { DataShape } from './data';
import { shapeRegistry } from './registry';

export function registerShapes() {
  // Register custom shapes
  CellRenderer.registerShape('customArrow', ArrowShape as any);
  CellRenderer.registerShape('customCloud', CloudShape as any);
  CellRenderer.registerShape('customDocument', DocumentShape as any);
  CellRenderer.registerShape('customDatabase', DatabaseShape as any);
  CellRenderer.registerShape('customTerminator', TerminatorShape as any);
  CellRenderer.registerShape('customActor', ActorShape as any);
  CellRenderer.registerShape('customData', DataShape as any);

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
    style: { filled: false, strokeColor: '#2c3e50', strokeWidth: 2 },
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
    style: { shape: 'customArrow', fillColor: 'none', strokeColor: '#2c3e50', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'arrow_left',
    label: 'Arrow Left',
    icon: '←',
    group: 'Arrows',
    width: 100,
    height: 60,
    style: { fillColor: 'none', strokeColor: '#2c3e50', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'arrow_up',
    label: 'Arrow Up',
    icon: '↑',
    group: 'Arrows',
    width: 60,
    height: 100,
    style: { fillColor: 'none', strokeColor: '#2c3e50', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'arrow_down',
    label: 'Arrow Down',
    icon: '↓',
    group: 'Arrows',
    width: 60,
    height: 100,
    style: { fillColor: 'none', strokeColor: '#2c3e50', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'double_arrow',
    label: 'Double Arrow',
    icon: '⇄',
    group: 'Arrows',
    width: 120,
    height: 60,
    style: { fillColor: 'none', strokeColor: '#2c3e50', strokeWidth: 2 },
  });

  // ===== UML SHAPES =====
  shapeRegistry.register({
    id: 'class',
    label: 'Class',
    icon: '◻',
    group: 'UML',
    width: 140,
    height: 120,
    style: { fillColor: '#e8f4f8', strokeColor: '#0c5aa0' },
  });

  shapeRegistry.register({
    id: 'interface',
    label: 'Interface',
    icon: '⟪I⟫',
    group: 'UML',
    width: 140,
    height: 100,
    style: { fillColor: '#f0f0f0', strokeColor: '#666666' },
  });

  shapeRegistry.register({
    id: 'actor',
    label: 'Actor',
    icon: '👤',
    group: 'UML',
    width: 60,
    height: 100,
    style: { shape: 'customActor', fillColor: '#fff2cc', strokeColor: '#d6b656' },
  });

  shapeRegistry.register({
    id: 'usecase',
    label: 'Use Case',
    icon: '◯',
    group: 'UML',
    width: 100,
    height: 60,
    style: { shape: 'ellipse', fillColor: '#e1d5e7', strokeColor: '#9673a6' },
  });

  shapeRegistry.register({
    id: 'package',
    label: 'Package',
    icon: '📦',
    group: 'UML',
    width: 120,
    height: 100,
    style: { fillColor: '#fce4d6', strokeColor: '#c65911' },
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
}

export { shapeRegistry } from './registry';
export type { ShapeConfig } from './registry';
export { ShapeToolbar } from './toolbar';
