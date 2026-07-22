/**
 * Cloud/AWS shapes registry
 */

import { shapeRegistry } from '../registry';

export function registerCloudShapes(): void {
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
}
