/**
 * C4 Model shapes registry
 */

import { shapeRegistry } from '../registry';

export function registerC4Shapes(): void {
  shapeRegistry.register({
    id: 'person_c4',
    type: 'vertex',
    label: 'Person (C4)',
    icon: '👤',
    group: 'C4',
    width: 100,
    height: 120,
    style: { fillColor: '#08427b', strokeColor: '#08427b', fontColor: '#ffffff' },
  });

  shapeRegistry.register({
    id: 'system_c4',
    type: 'vertex',
    label: 'System (C4)',
    icon: '▬',
    group: 'C4',
    width: 150,
    height: 100,
    style: { fillColor: '#1168bd', strokeColor: '#1168bd', fontColor: '#ffffff' },
  });

  shapeRegistry.register({
    id: 'container_c4',
    type: 'vertex',
    label: 'Container (C4)',
    icon: '📦',
    group: 'C4',
    width: 140,
    height: 100,
    style: { fillColor: '#438dd5', strokeColor: '#1168bd', fontColor: '#ffffff' },
  });

  shapeRegistry.register({
    id: 'component_c4',
    type: 'vertex',
    label: 'Component (C4)',
    icon: '⚙',
    group: 'C4',
    width: 120,
    height: 80,
    style: { fillColor: '#85bbd7', strokeColor: '#438dd5', fontColor: '#ffffff' },
  });
}
