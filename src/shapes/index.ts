import { CellRenderer } from '@maxgraph/core';
import { ArrowShape } from './arrow';
import { shapeRegistry } from './registry';

export function registerShapes() {
  // Register custom arrow shape
  CellRenderer.registerShape('customArrow', ArrowShape as any);

  // Register default shapes in registry
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
    id: 'arrow',
    label: 'Arrow',
    icon: '→',
    group: 'Connectors',
    width: 100,
    height: 60,
    style: { shape: 'customArrow', fillColor: 'none', strokeColor: '#2c3e50', strokeWidth: 2 },
  });
}

export { shapeRegistry } from './registry';
export type { ShapeConfig } from './registry';
export { ShapeToolbar } from './toolbar';
