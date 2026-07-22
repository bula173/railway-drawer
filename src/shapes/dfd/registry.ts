/**
 * Data Flow Diagram shapes registry
 */

import { shapeRegistry } from '../registry';

export function registerDfdShapes(): void {
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
}
