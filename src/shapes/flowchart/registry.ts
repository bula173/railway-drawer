/**
 * Flowchart shapes registry
 */

import { shapeRegistry } from '../registry';

export function registerFlowchartShapes(): void {
  shapeRegistry.register({
    id: 'process',
    type: 'vertex',
    label: 'Process',
    icon: '▬',
    group: 'Flowchart',
    width: 100,
    height: 60,
    style: { fillColor: '#dda0dd', strokeColor: '#8b008b' },
  });

  shapeRegistry.register({
    id: 'decision',
    type: 'vertex',
    label: 'Decision',
    icon: '◇',
    group: 'Flowchart',
    width: 100,
    height: 100,
    style: { shape: 'diamond', fillColor: '#ffd700', strokeColor: '#ffa500' },
  });

  shapeRegistry.register({
    id: 'cylinder',
    type: 'vertex',
    label: 'Cylinder',
    icon: '⊗',
    group: 'Flowchart',
    width: 80,
    height: 80,
    style: { shape: 'cylinder', fillColor: '#87ceeb', strokeColor: '#4682b4' },
  });

  shapeRegistry.register({
    id: 'parallelogram',
    type: 'vertex',
    label: 'Parallelogram',
    icon: '⬠',
    group: 'Flowchart',
    width: 100,
    height: 60,
    style: { fillColor: '#98fb98', strokeColor: '#228b22' },
  });

  shapeRegistry.register({
    id: 'document',
    type: 'vertex',
    label: 'Document',
    icon: '📄',
    group: 'Flowchart',
    width: 80,
    height: 100,
    style: { shape: 'customDocument', fillColor: '#ffecb3', strokeColor: '#fbc02d' },
  });

  shapeRegistry.register({
    id: 'data',
    type: 'vertex',
    label: 'Data',
    icon: '⬡',
    group: 'Flowchart',
    width: 100,
    height: 60,
    style: { shape: 'customData', fillColor: '#b3e5fc', strokeColor: '#0288d1' },
  });

  shapeRegistry.register({
    id: 'terminator',
    type: 'vertex',
    label: 'Terminator',
    icon: '◠',
    group: 'Flowchart',
    width: 100,
    height: 60,
    style: { shape: 'customTerminator', fillColor: '#ffcccc', strokeColor: '#cc0000' },
  });

  shapeRegistry.register({
    id: 'loop',
    type: 'vertex',
    label: 'Loop',
    icon: '↻',
    group: 'Flowchart',
    width: 100,
    height: 80,
    style: { fillColor: '#ffe0b2', strokeColor: '#ff6f00' },
  });

  shapeRegistry.register({
    id: 'delay',
    type: 'vertex',
    label: 'Delay',
    icon: '◠',
    group: 'Flowchart',
    width: 100,
    height: 60,
    style: { shape: 'customDelay', fillColor: '#fce4d6', strokeColor: '#c65911' },
  });
}
