/**
 * Railway shapes registry
 */

import { shapeRegistry } from '../registry';

export function registerRailwayShapes(): void {
  // Basic railway infrastructure
  shapeRegistry.register({
    id: 'railway-rail',
    type: 'vertex',
    label: 'Rail',
    group: 'Railway',
    icon: '━',
    width: 120,
    height: 40,
    style: { shape: 'customRail', fillColor: 'none', strokeColor: '#333333', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'railway-signal',
    type: 'vertex',
    label: 'Signal',
    group: 'Railway',
    icon: '🚦',
    width: 40,
    height: 80,
    style: { shape: 'customSignal', fillColor: 'none', strokeColor: '#333333', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'railway-switch',
    type: 'vertex',
    label: 'Switch',
    group: 'Railway',
    icon: '⊞',
    width: 80,
    height: 60,
    style: { shape: 'customSwitch', fillColor: 'none', strokeColor: '#333333', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'railway-junction',
    type: 'vertex',
    label: 'Junction',
    group: 'Railway',
    icon: '⊕',
    width: 80,
    height: 80,
    style: { shape: 'customJunction', fillColor: 'none', strokeColor: '#333333', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'railway-platform',
    type: 'vertex',
    label: 'Platform',
    group: 'Railway',
    icon: '▌',
    width: 120,
    height: 50,
    style: { shape: 'customPlatform', fillColor: '#e8f4f9', strokeColor: '#0066cc', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'railway-station',
    type: 'vertex',
    label: 'Station',
    group: 'Railway',
    icon: '🏛',
    width: 100,
    height: 100,
    style: { shape: 'customStation', fillColor: '#fff9e6', strokeColor: '#ff9800', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'railway-crossing',
    type: 'vertex',
    label: 'Crossing',
    group: 'Railway',
    icon: '✕',
    width: 80,
    height: 80,
    style: { shape: 'customCrossing', fillColor: 'none', strokeColor: '#d32f2f', strokeWidth: 3 },
  });

  shapeRegistry.register({
    id: 'railway-tunnel',
    type: 'vertex',
    label: 'Tunnel',
    group: 'Railway',
    icon: '◠',
    width: 120,
    height: 70,
    style: { shape: 'customTunnel', fillColor: '#c0c0c0', strokeColor: '#333333', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'railway-buffer',
    type: 'vertex',
    label: 'Buffer',
    group: 'Railway',
    icon: '⊣',
    width: 80,
    height: 50,
    style: { shape: 'customBuffer', fillColor: '#f0f0f0', strokeColor: '#333333', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'railway-cabin',
    type: 'vertex',
    label: 'Cabin',
    group: 'Railway',
    icon: '▢',
    width: 90,
    height: 110,
    style: { shape: 'customCabin', fillColor: '#e3f2fd', strokeColor: '#1976d2', strokeWidth: 2 },
  });

  // Track Circuit Elements
  shapeRegistry.register({
    id: 'railway-lta',
    type: 'vertex',
    label: 'LTA (Track Area)',
    group: 'Track Circuit',
    icon: '◀',
    width: 30,
    height: 40,
    style: { shape: 'customLTA', fillColor: '#000000', strokeColor: '#000000', strokeWidth: 1 },
  });

  shapeRegistry.register({
    id: 'railway-lto',
    type: 'vertex',
    label: 'LTO (Track Output)',
    group: 'Track Circuit',
    icon: '▶',
    width: 30,
    height: 40,
    style: { shape: 'customLTO', fillColor: 'none', strokeColor: '#000000', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'railway-detection',
    type: 'vertex',
    label: 'Detection Point',
    group: 'Track Circuit',
    icon: '●',
    width: 40,
    height: 40,
    style: { shape: 'customDetectionPoint', fillColor: 'none', strokeColor: '#333333', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'railway-track-section',
    type: 'vertex',
    label: 'Track Section',
    group: 'Track Circuit',
    icon: '─',
    width: 120,
    height: 20,
    style: { shape: 'customTrackSection', fillColor: 'none', strokeColor: '#333333', strokeWidth: 3 },
  });

  shapeRegistry.register({
    id: 'railway-vertical-connector',
    type: 'vertex',
    label: 'Vertical Connector',
    group: 'Track Circuit',
    icon: '│',
    width: 20,
    height: 60,
    style: { shape: 'customVerticalConnector', fillColor: 'none', strokeColor: '#333333', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'railway-eol-marker',
    type: 'vertex',
    label: 'End of Line',
    group: 'Track Circuit',
    icon: '◯',
    width: 40,
    height: 40,
    style: { shape: 'customEOLMarker', fillColor: '#ffffff', strokeColor: '#333333', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'railway-rail-level',
    type: 'vertex',
    label: 'Rail Level',
    group: 'Track Circuit',
    icon: '═',
    width: 100,
    height: 40,
    style: { shape: 'customRailLevel', fillColor: 'none', strokeColor: '#333333', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'railway-sloped-track',
    type: 'vertex',
    label: 'Sloped Track',
    group: 'Track Circuit',
    icon: '⟋',
    width: 100,
    height: 60,
    style: { shape: 'customSlopedTrack', fillColor: 'none', strokeColor: '#333333', strokeWidth: 2 },
  });

  // Rolling Stock & Signaling
  shapeRegistry.register({
    id: 'railway-train',
    type: 'vertex',
    label: 'Train',
    group: 'Rolling Stock',
    icon: '🚂',
    width: 120,
    height: 60,
    style: { shape: 'customTrain', fillColor: '#8b4513', strokeColor: '#000000', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'railway-signal-head',
    type: 'vertex',
    label: 'Signal Head',
    group: 'Signaling',
    icon: '📊',
    width: 50,
    height: 100,
    style: { shape: 'customSignalHead', fillColor: '#f0f0f0', strokeColor: '#333333', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'railway-rbc',
    type: 'vertex',
    label: 'RBC (Radio Block Center)',
    group: 'Signaling',
    icon: '△',
    width: 60,
    height: 70,
    style: { shape: 'customRBC', fillColor: '#4169e1', strokeColor: '#000080', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'railway-communication-line',
    type: 'vertex',
    label: 'GSM-R Communication',
    group: 'Signaling',
    icon: '≈',
    width: 150,
    height: 15,
    style: { shape: 'customCommunicationLine', fillColor: 'none', strokeColor: '#9370db', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'railway-eb-section',
    type: 'vertex',
    label: 'Electronic Block (EB)',
    group: 'Track Circuit',
    icon: '▪',
    width: 140,
    height: 40,
    style: { shape: 'customEBSection', fillColor: '#e8f4f9', strokeColor: '#0066cc', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'railway-wayside-equipment',
    type: 'vertex',
    label: 'Wayside Equipment',
    group: 'Infrastructure',
    icon: '⚙',
    width: 50,
    height: 80,
    style: { shape: 'customWaysideEquipment', fillColor: '#c0c0c0', strokeColor: '#333333', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'railway-track-circuit',
    type: 'vertex',
    label: 'Track Circuit',
    group: 'Track Circuit',
    icon: '⊞',
    width: 140,
    height: 50,
    style: { shape: 'customTrackCircuit', fillColor: 'none', strokeColor: '#333333', strokeWidth: 2 },
  });
}
