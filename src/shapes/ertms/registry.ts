/**
 * ERTMS (European Rail Traffic Management System) shapes registry
 */

import { CellRenderer } from '@maxgraph/core';
import { shapeRegistry } from '../registry';
import {
  ERTMSMarkerBoard,
} from './shapes';

/**
 * Register all ERTMS shape classes with CellRenderer
 */
export function registerErtmsShapeClasses(): void {
  CellRenderer.defaultShapes['ERTMSMarkerBoard'] = ERTMSMarkerBoard as any;
}

export function registerErtmsShapes(): void {
  shapeRegistry.register({
    id: 'ertms-custom-track',
    type: 'vertex',
    label: 'ERTMS Track Element',
    group: 'ERTMS',
    icon: '⊟',
    width: 80,
    height: 80,
    style: { shape: 'ERTMSMarkerBoard', fillColor: '#1976d2', strokeColor: '#0d47a1', strokeWidth: 2 },
  });
}
