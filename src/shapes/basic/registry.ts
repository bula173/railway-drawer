/**
 * Basic shapes registry - Vertex-based geometric shapes
 */

import { shapeRegistry } from '../registry';
import { CellRenderer } from '@maxgraph/core';
import {
  RectangleShapeVertex,
  CircleShapeVertex,
  DiamondShapeVertex,
  TriangleShapeVertex,
  EllipseShapeVertex,
  RoundedRectangleShapeVertex,
  HexagonShapeVertex,
  PentagonShapeVertex,
  StarShapeVertex,
  TrapezoidShapeVertex,
  CrossShapeVertex,
  CylinderShapeVertex,
  OvalShapeVertex,
  DoubleRectangleShapeVertex,
  LosangeShapeVertex,
  ChevronShapeVertex,
  RightAngleShapeVertex,
  LineShapeVertex,
} from './shape-classes';

// Register all shape classes with CellRenderer
export function registerBasicShapeClasses(): void {
  CellRenderer.defaultShapes['rectangle-shape'] = RectangleShapeVertex as any;
  CellRenderer.defaultShapes['circle-shape'] = CircleShapeVertex as any;
  CellRenderer.defaultShapes['diamond-shape'] = DiamondShapeVertex as any;
  CellRenderer.defaultShapes['triangle-shape'] = TriangleShapeVertex as any;
  CellRenderer.defaultShapes['ellipse-shape'] = EllipseShapeVertex as any;
  CellRenderer.defaultShapes['rounded-rectangle-shape'] = RoundedRectangleShapeVertex as any;
  CellRenderer.defaultShapes['hexagon-shape'] = HexagonShapeVertex as any;
  CellRenderer.defaultShapes['pentagon-shape'] = PentagonShapeVertex as any;
  CellRenderer.defaultShapes['star-shape'] = StarShapeVertex as any;
  CellRenderer.defaultShapes['trapezoid-shape'] = TrapezoidShapeVertex as any;
  CellRenderer.defaultShapes['cross-shape'] = CrossShapeVertex as any;
  CellRenderer.defaultShapes['cylinder-shape'] = CylinderShapeVertex as any;
  CellRenderer.defaultShapes['oval-shape'] = OvalShapeVertex as any;
  CellRenderer.defaultShapes['double-rectangle-shape'] = DoubleRectangleShapeVertex as any;
  CellRenderer.defaultShapes['lozenge-shape'] = LosangeShapeVertex as any;
  CellRenderer.defaultShapes['chevron-shape'] = ChevronShapeVertex as any;
  CellRenderer.defaultShapes['right-angle-shape'] = RightAngleShapeVertex as any;
  CellRenderer.defaultShapes['line-shape'] = LineShapeVertex as any;
}

export function registerBasicShapes(): void {
  // Basic geometric shapes - Vertex-based
  shapeRegistry.register({
    id: 'rectangle',
    type: 'vertex',
    label: 'Rectangle',
    icon: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="4" width="28" height="22" fill="none" stroke="black" stroke-width="1.3"/>
    </svg>`,
    group: 'Basic',
    width: 100,
    height: 60,
    style: {
      shape: 'rectangle-shape',
      fillColor: 'none',
      strokeColor: '#000000',
    },
  });

  shapeRegistry.register({
    id: 'circle',
    type: 'vertex',
    label: 'Circle',
    icon: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="15" r="13" fill="none" stroke="black" stroke-width="1.3"/>
    </svg>`,
    group: 'Basic',
    width: 80,
    height: 80,
    style: {
      shape: 'circle-shape',
      fillColor: 'none',
      strokeColor: '#000000',
    },
  });

  shapeRegistry.register({
    id: 'diamond',
    type: 'vertex',
    label: 'Diamond',
    icon: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
      <path d="M 16 2 L 28 15 L 16 28 L 4 15 Z" fill="none" stroke="black" stroke-width="1.3"/>
    </svg>`,
    group: 'Basic',
    width: 80,
    height: 80,
    style: {
      shape: 'diamond-shape',
      fillColor: 'none',
      strokeColor: '#000000',
    },
  });

  shapeRegistry.register({
    id: 'triangle',
    type: 'vertex',
    label: 'Triangle',
    icon: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
      <path d="M 16 2 L 28 26 L 4 26 Z" fill="none" stroke="black" stroke-width="1.3"/>
    </svg>`,
    group: 'Basic',
    width: 80,
    height: 80,
    style: {
      shape: 'triangle-shape',
      fillColor: 'none',
      strokeColor: '#000000',
    },
  });

  shapeRegistry.register({
    id: 'ellipse',
    type: 'vertex',
    label: 'Ellipse',
    icon: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="16" cy="15" rx="13" ry="11" fill="none" stroke="black" stroke-width="1.3"/>
    </svg>`,
    group: 'Basic',
    width: 100,
    height: 80,
    style: {
      shape: 'ellipse-shape',
      fillColor: 'none',
      strokeColor: '#000000',
    },
  });

  shapeRegistry.register({
    id: 'rounded_rectangle',
    type: 'vertex',
    label: 'Rounded Rectangle',
    icon: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="4" width="28" height="22" rx="4" ry="4" fill="none" stroke="black" stroke-width="1.3"/>
    </svg>`,
    group: 'Basic',
    width: 100,
    height: 60,
    style: {
      shape: 'rounded-rectangle-shape',
      fillColor: 'none',
      strokeColor: '#000000',
    },
  });

  shapeRegistry.register({
    id: 'hexagon',
    type: 'vertex',
    label: 'Hexagon',
    icon: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
      <path d="M 16 2 L 26 7.5 L 26 22.5 L 16 28 L 6 22.5 L 6 7.5 Z" fill="none" stroke="black" stroke-width="1.3"/>
    </svg>`,
    group: 'Basic',
    width: 100,
    height: 100,
    style: {
      shape: 'hexagon-shape',
      fillColor: 'none',
      strokeColor: '#000000',
    },
  });

  shapeRegistry.register({
    id: 'pentagon',
    type: 'vertex',
    label: 'Pentagon',
    icon: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
      <path d="M 16 2 L 27 11 L 23 27 L 9 27 L 5 11 Z" fill="none" stroke="black" stroke-width="1.3"/>
    </svg>`,
    group: 'Basic',
    width: 100,
    height: 100,
    style: {
      shape: 'pentagon-shape',
      fillColor: 'none',
      strokeColor: '#000000',
    },
  });

  shapeRegistry.register({
    id: 'star',
    type: 'vertex',
    label: 'Star',
    icon: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
      <path d="M 16 2 L 20 12 L 30 12 L 22 18 L 26 28 L 16 22 L 6 28 L 10 18 L 2 12 L 12 12 Z" fill="none" stroke="black" stroke-width="1.3"/>
    </svg>`,
    group: 'Basic',
    width: 100,
    height: 100,
    style: {
      shape: 'star-shape',
      fillColor: 'none',
      strokeColor: '#000000',
    },
  });

  shapeRegistry.register({
    id: 'trapezoid',
    type: 'vertex',
    label: 'Trapezoid',
    icon: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
      <path d="M 8 4 L 24 4 L 28 26 L 4 26 Z" fill="none" stroke="black" stroke-width="1.3"/>
    </svg>`,
    group: 'Basic',
    width: 100,
    height: 80,
    style: {
      shape: 'trapezoid-shape',
      fillColor: 'none',
      strokeColor: '#000000',
    },
  });

  shapeRegistry.register({
    id: 'cross',
    type: 'vertex',
    label: 'Cross',
    icon: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="4" width="8" height="22" fill="none" stroke="black" stroke-width="1.3"/>
      <rect x="4" y="12" width="24" height="6" fill="none" stroke="black" stroke-width="1.3"/>
    </svg>`,
    group: 'Basic',
    width: 100,
    height: 100,
    style: {
      shape: 'cross-shape',
      fillColor: 'none',
      strokeColor: '#000000',
    },
  });

  shapeRegistry.register({
    id: 'cylinder',
    type: 'vertex',
    label: 'Cylinder',
    icon: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="16" cy="6" rx="10" ry="4" fill="none" stroke="black" stroke-width="1.3"/>
      <rect x="6" y="6" width="20" height="16" fill="none" stroke="black" stroke-width="1.3"/>
      <ellipse cx="16" cy="22" rx="10" ry="4" fill="none" stroke="black" stroke-width="1.3"/>
    </svg>`,
    group: 'Basic',
    width: 80,
    height: 100,
    style: {
      shape: 'cylinder-shape',
      fillColor: 'none',
      strokeColor: '#000000',
    },
  });

  shapeRegistry.register({
    id: 'oval',
    type: 'vertex',
    label: 'Oval',
    icon: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="16" cy="15" rx="12" ry="9" fill="none" stroke="black" stroke-width="1.3"/>
    </svg>`,
    group: 'Basic',
    width: 100,
    height: 80,
    style: {
      shape: 'oval-shape',
      fillColor: 'none',
      strokeColor: '#000000',
    },
  });

  shapeRegistry.register({
    id: 'double_rectangle',
    type: 'vertex',
    label: 'Double Rectangle',
    icon: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="4" width="28" height="22" fill="none" stroke="black" stroke-width="1.3"/>
      <line x1="16" y1="4" x2="16" y2="26" stroke="black" stroke-width="1.3"/>
    </svg>`,
    group: 'Basic',
    width: 100,
    height: 60,
    style: {
      shape: 'double-rectangle-shape',
      fillColor: 'none',
      strokeColor: '#000000',
    },
  });

  shapeRegistry.register({
    id: 'lozenge',
    type: 'vertex',
    label: 'Lozenge',
    icon: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
      <path d="M 16 2 L 28 15 L 16 28 L 4 15 Z" fill="none" stroke="black" stroke-width="1.3"/>
    </svg>`,
    group: 'Basic',
    width: 80,
    height: 80,
    style: {
      shape: 'lozenge-shape',
      fillColor: 'none',
      strokeColor: '#000000',
    },
  });

  shapeRegistry.register({
    id: 'chevron',
    type: 'vertex',
    label: 'Chevron',
    icon: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
      <path d="M 6 4 L 24 15 L 6 26" fill="none" stroke="black" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    group: 'Basic',
    width: 100,
    height: 60,
    style: {
      shape: 'chevron-shape',
      fillColor: 'none',
      strokeColor: '#000000',
    },
  });

  shapeRegistry.register({
    id: 'right_angle',
    type: 'vertex',
    label: 'Right Angle',
    icon: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
      <path d="M 24 4 L 24 24 L 4 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    group: 'Basic',
    width: 80,
    height: 80,
    style: {
      shape: 'right-angle-shape',
      fillColor: 'none',
      strokeColor: '#000000',
    },
  });

  shapeRegistry.register({
    id: 'line',
    type: 'vertex',
    label: 'Line',
    icon: `<svg viewBox="0 0 32 30" xmlns="http://www.w3.org/2000/svg">
      <line x1="2" y1="15" x2="30" y2="15" stroke="black" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    group: 'Basic',
    width: 100,
    height: 10,
    style: {
      shape: 'line-shape',
      fillColor: 'none',
      strokeColor: '#000000',
    },
  });
}
