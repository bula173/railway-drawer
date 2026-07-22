/**
 * Basic shapes registry
 */

import { shapeRegistry } from '../registry';

export function registerBasicShapes(): void {
  // Basic geometric shapes
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
    id: 'line',
    label: 'Line',
    icon: '─',
    group: 'Basic',
    width: 100,
    height: 10,
    style: { shape: 'customLine', strokeColor: '#2c3e50', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'rounded_rectangle',
    label: 'Rounded Rectangle',
    icon: '⛶',
    group: 'Basic',
    width: 100,
    height: 60,
    style: { rounded: true, fillColor: '#a9d08e', strokeColor: '#70ad47' },
  });

  // Extended shapes
  shapeRegistry.register({
    id: 'hexagon',
    label: 'Hexagon',
    icon: '⬡',
    group: 'Basic',
    width: 100,
    height: 100,
    style: { shape: 'customHexagon', fillColor: '#c5e0b4', strokeColor: '#70ad47' },
  });

  shapeRegistry.register({
    id: 'pentagon',
    label: 'Pentagon',
    icon: '⬠',
    group: 'Basic',
    width: 100,
    height: 100,
    style: { shape: 'customPentagon', fillColor: '#f4b183', strokeColor: '#e67e22' },
  });

  shapeRegistry.register({
    id: 'star',
    label: 'Star',
    icon: '⭐',
    group: 'Basic',
    width: 100,
    height: 100,
    style: { shape: 'customStar', fillColor: '#ffd966', strokeColor: '#f1c232' },
  });

  shapeRegistry.register({
    id: 'trapezoid',
    label: 'Trapezoid',
    icon: '⟂',
    group: 'Basic',
    width: 100,
    height: 80,
    style: { shape: 'customTrapezoid', fillColor: '#e2efda', strokeColor: '#70ad47' },
  });

  shapeRegistry.register({
    id: 'cross',
    label: 'Cross',
    icon: '✚',
    group: 'Basic',
    width: 100,
    height: 100,
    style: { shape: 'customCross', fillColor: '#f8b88b', strokeColor: '#e67e22' },
  });

  shapeRegistry.register({
    id: 'cylinder_basic',
    label: 'Cylinder',
    icon: '🗄',
    group: 'Basic',
    width: 80,
    height: 100,
    style: { shape: 'customCylinder', fillColor: '#b3e5fc', strokeColor: '#0288d1' },
  });

  shapeRegistry.register({
    id: 'oval_basic',
    label: 'Oval',
    icon: '⬭',
    group: 'Basic',
    width: 100,
    height: 80,
    style: { shape: 'customOval', fillColor: '#d4e6f1', strokeColor: '#3498db' },
  });

  shapeRegistry.register({
    id: 'double_rectangle',
    label: 'Double Rect',
    icon: '▦',
    group: 'Basic',
    width: 100,
    height: 60,
    style: { shape: 'customDoubleRectangle', fillColor: '#e1d5e7', strokeColor: '#9673a6' },
  });

  shapeRegistry.register({
    id: 'lozenge',
    label: 'Lozenge',
    icon: '◇',
    group: 'Basic',
    width: 80,
    height: 80,
    style: { shape: 'customLozenge', fillColor: '#ffe6cc', strokeColor: '#ed7d31' },
  });

  shapeRegistry.register({
    id: 'chevron',
    label: 'Chevron',
    icon: '▶',
    group: 'Basic',
    width: 100,
    height: 60,
    style: { shape: 'customChevron', fillColor: '#cfe2f3', strokeColor: '#4472c4' },
  });

  shapeRegistry.register({
    id: 'right_angle',
    label: 'Right Angle',
    icon: '⌟',
    group: 'Basic',
    width: 80,
    height: 80,
    style: { shape: 'customRightAngle', fillColor: 'none', strokeColor: '#2c3e50', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'rounded_rect_basic',
    label: 'Rounded Rect',
    icon: '◫',
    group: 'Basic',
    width: 100,
    height: 60,
    style: { shape: 'customRoundedRectangle', fillColor: '#a9d08e', strokeColor: '#70ad47' },
  });
}
