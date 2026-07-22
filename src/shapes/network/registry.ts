/**
 * Network shapes registry
 */

import { shapeRegistry } from '../registry';

export function registerNetworkShapes(): void {
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
