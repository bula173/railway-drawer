import { CellRenderer } from '@maxgraph/core';
import { HexagonShape, PentagonShape, StarShape, TrapezoidShape, CrossShape, CylinderShape, SimpleArrowShape, OvalShape, DoubleRectangleShape, ParallelogramShape, DelayShape, ChevronShape, RightAngleShape, LozengeShape, RoundedRectangleShape } from './basic/basic-shapes';
import { registerBasicShapes, registerBasicShapeClasses } from './basic';

export function registerShapes() {
  // Register basic vertex-based shapes with CellRenderer
  CellRenderer.registerShape('customHexagon', HexagonShape as any);
  CellRenderer.registerShape('customPentagon', PentagonShape as any);
  CellRenderer.registerShape('customStar', StarShape as any);
  CellRenderer.registerShape('customTrapezoid', TrapezoidShape as any);
  CellRenderer.registerShape('customCross', CrossShape as any);
  CellRenderer.registerShape('customCylinder', CylinderShape as any);
  CellRenderer.registerShape('customSimpleArrow', SimpleArrowShape as any);
  CellRenderer.registerShape('customOval', OvalShape as any);
  CellRenderer.registerShape('customDoubleRectangle', DoubleRectangleShape as any);
  CellRenderer.registerShape('customParallelogram', ParallelogramShape as any);
  CellRenderer.registerShape('customDelay', DelayShape as any);
  CellRenderer.registerShape('customChevron', ChevronShape as any);
  CellRenderer.registerShape('customRightAngle', RightAngleShape as any);
  CellRenderer.registerShape('customLozenge', LozengeShape as any);
  CellRenderer.registerShape('customRoundedRectangle', RoundedRectangleShape as any);

  // Register only Basic shapes via their registry functions
  registerBasicShapeClasses();
  registerBasicShapes();
}

export { shapeRegistry } from './registry';
export type { ShapeConfig } from './registry';
export { ShapeToolbar } from './toolbar';
