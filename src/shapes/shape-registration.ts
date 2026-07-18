/**
 * Shape Registration
 * Register all native maxGraph shapes with CellRenderer
 */

import {
  CellRenderer,
  RectangleShape,
  EllipseShape,
  RhombusShape,
  TriangleShape,
  CylinderShape,
  CloudShape,
  HexagonShape,
  DoubleEllipseShape,
} from '@maxgraph/core';

/**
 * Register all native maxGraph shapes
 * This ensures shapes render correctly when inserted into the graph
 */
export function registerShapes(): void {
  // Rectangle (default)
  (CellRenderer.defaultShapes as any)['rectangle'] = RectangleShape;

  // Ellipse / Circle
  (CellRenderer.defaultShapes as any)['ellipse'] = EllipseShape;

  // Rhombus / Diamond
  (CellRenderer.defaultShapes as any)['rhombus'] = RhombusShape;
  (CellRenderer.defaultShapes as any)['diamond'] = RhombusShape;

  // Triangle
  (CellRenderer.defaultShapes as any)['triangle'] = TriangleShape;

  // Cylinder
  (CellRenderer.defaultShapes as any)['cylinder'] = CylinderShape;

  // Cloud
  (CellRenderer.defaultShapes as any)['cloud'] = CloudShape;

  // Hexagon
  (CellRenderer.defaultShapes as any)['hexagon'] = HexagonShape;

  // Double Ellipse (UML)
  (CellRenderer.defaultShapes as any)['doubleellipse'] = DoubleEllipseShape;
}
