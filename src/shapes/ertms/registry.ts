/**
 * ERTMS (European Rail Traffic Management System) shapes registry
 */

import { shapeRegistry } from '../registry';

export function registerErtmsShapes(): void {
  shapeRegistry.register({
    id: 'ertms-level-marker',
    type: 'vertex',
    label: 'ERTMS Level Marker',
    group: 'ERTMS',
    icon: '⬟',
    width: 70,
    height: 70,
    style: { shape: 'customERTMSLevelMarker', fillColor: '#ff9800', strokeColor: '#e65100', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'ertms-speed-restriction',
    type: 'vertex',
    label: 'Speed Restriction Marker',
    group: 'ERTMS',
    icon: '◇',
    width: 60,
    height: 60,
    style: { shape: 'customSpeedRestrictionMarker', fillColor: '#ff6b6b', strokeColor: '#cc0000', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'ertms-balise',
    type: 'vertex',
    label: 'ERTMS Balise',
    group: 'ERTMS',
    icon: '▭',
    width: 70,
    height: 50,
    style: { shape: 'customERTMSBalise', fillColor: '#1976d2', strokeColor: '#0d47a1', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'ertms-level-crossing',
    type: 'vertex',
    label: 'ERTMS Level Crossing',
    group: 'ERTMS',
    icon: '╋',
    width: 80,
    height: 80,
    style: { shape: 'customERTMSLevelCrossing', fillColor: 'none', strokeColor: '#333333', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'ertms-handover-point',
    type: 'vertex',
    label: 'ERTMS Handover Point',
    group: 'ERTMS',
    icon: '◉',
    width: 70,
    height: 70,
    style: { shape: 'customERTMSHandoverPoint', fillColor: '#9c27b0', strokeColor: '#6a1b9a', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'ertms-national-transition',
    type: 'vertex',
    label: 'National Transition Point',
    group: 'ERTMS',
    icon: '⬠',
    width: 70,
    height: 70,
    style: { shape: 'customNationalTransitionPoint', fillColor: '#4caf50', strokeColor: '#2e7d32', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'ertms-transponder',
    type: 'vertex',
    label: 'ERTMS Transponder',
    group: 'ERTMS',
    icon: '◊',
    width: 70,
    height: 50,
    style: { shape: 'customERTMSTransponder', fillColor: '#00bcd4', strokeColor: '#00838f', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'ertms-section-marker',
    type: 'vertex',
    label: 'ERTMS Section Marker',
    group: 'ERTMS',
    icon: '⬜',
    width: 100,
    height: 50,
    style: { shape: 'customERTMSSectionMarker', fillColor: '#ffc107', strokeColor: '#ff8f00', strokeWidth: 2 },
  });
}
