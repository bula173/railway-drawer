/**
 * Flowchart shapes registry
 */

import { shapeRegistry } from '../registry';

export function registerFlowchartShapes(): void {
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

  shapeRegistry.register({
    id: 'delay',
    label: 'Delay',
    icon: '◠',
    group: 'Flowchart',
    width: 100,
    height: 60,
    style: { shape: 'customDelay', fillColor: '#fce4d6', strokeColor: '#c65911' },
  });
}
