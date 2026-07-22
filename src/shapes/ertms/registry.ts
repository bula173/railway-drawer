/**
 * ERTMS (European Rail Traffic Management System) shapes registry
 */

import { shapeRegistry } from '../registry';

export function registerErtmsShapes(): void {
  shapeRegistry.register({
    id: 'ertms-level-marker',
    label: 'ERTMS Level Marker',
    group: 'ERTMS',
    icon: '⬟',
    width: 70,
    height: 70,
    style: { shape: 'customERTMSLevelMarker', fillColor: '#ff9800', strokeColor: '#e65100', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'ertms-speed-restriction',
    label: 'Speed Restriction Marker',
    group: 'ERTMS',
    icon: '◇',
    width: 60,
    height: 60,
    style: { shape: 'customSpeedRestrictionMarker', fillColor: '#ff6b6b', strokeColor: '#cc0000', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'ertms-balise',
    label: 'ERTMS Balise',
    group: 'ERTMS',
    icon: '▭',
    width: 70,
    height: 50,
    style: { shape: 'customERTMSBalise', fillColor: '#1976d2', strokeColor: '#0d47a1', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'ertms-level-crossing',
    label: 'ERTMS Level Crossing',
    group: 'ERTMS',
    icon: '╋',
    width: 80,
    height: 80,
    style: { shape: 'customERTMSLevelCrossing', fillColor: 'none', strokeColor: '#333333', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'ertms-handover-point',
    label: 'ERTMS Handover Point',
    group: 'ERTMS',
    icon: '◉',
    width: 70,
    height: 70,
    style: { shape: 'customERTMSHandoverPoint', fillColor: '#9c27b0', strokeColor: '#6a1b9a', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'ertms-national-transition',
    label: 'National Transition Point',
    group: 'ERTMS',
    icon: '⬠',
    width: 70,
    height: 70,
    style: { shape: 'customNationalTransitionPoint', fillColor: '#4caf50', strokeColor: '#2e7d32', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'ertms-transponder',
    label: 'ERTMS Transponder',
    group: 'ERTMS',
    icon: '◊',
    width: 70,
    height: 50,
    style: { shape: 'customERTMSTransponder', fillColor: '#00bcd4', strokeColor: '#00838f', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'ertms-section-marker',
    label: 'ERTMS Section Marker',
    group: 'ERTMS',
    icon: '⬜',
    width: 100,
    height: 50,
    style: { shape: 'customERTMSSectionMarker', fillColor: '#ffc107', strokeColor: '#ff8f00', strokeWidth: 2 },
  });
}
