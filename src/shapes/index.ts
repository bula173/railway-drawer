import { CellRenderer, Graph } from '@maxgraph/core';
import { HexagonShape, PentagonShape, StarShape, TrapezoidShape, CrossShape, CylinderShape, SimpleArrowShape, OvalShape, DoubleRectangleShape, ParallelogramShape, DelayShape, ChevronShape, RightAngleShape, LozengeShape, RoundedRectangleShape } from './basic/basic-shapes';
import { registerBasicShapes, registerBasicShapeClasses } from './basic';
import { registerErtmsShapeClasses } from './ertms';
import { asShapeConstructor } from './registry';
import { registerDrawioMxArrowsShapeClasses } from './drawio-arrows/registry';
import { registerShapesCorePerimeters, registerShapesCoreShapes } from '../drawio-shapes/js/shapes-core';
import { registerShapesEdgeShapes, registerShapesEdgeStyles } from '../drawio-shapes/js/shapes-edges';
import { registerMxArrows2Shapes, registerMxBasicShapes, registerMxFlowchartShapes } from '../drawio-shapes/js/mx-libs';

/**
 * Registers the draw.io JS shapes (ports of Shapes.js and shapes/mx*.js, jgraph/drawio v32.4.1)
 * under their exact draw.io names. Idempotent. draw.io's `hexagon` replaces maxGraph's core
 * hexagon, as in draw.io; the app's own hexagon is `customHexagon` / `hexagon-shape`, so it is
 * not affected.
 */
export function registerDrawioJsShapes(): void {
  // maxGraph registers its core shapes when the first Graph is created, which would put its own
  // 'hexagon' back over draw.io's: register the core set first (it runs only once).
  (Graph.prototype as unknown as { registerDefaults(): void }).registerDefaults();
  registerShapesCoreShapes();
  registerShapesCorePerimeters();
  registerShapesEdgeShapes();
  registerShapesEdgeStyles();
  registerMxBasicShapes();
  registerMxArrows2Shapes();
  registerMxFlowchartShapes();
  // Old files with shape=mxarrows.Arrows2* (earlier app versions) keep rendering
  registerDrawioMxArrowsShapeClasses();
}

export function registerShapes() {
  // draw.io shapes first; the app's own names below never collide with draw.io names
  registerDrawioJsShapes();

  // Register basic vertex-based shapes with CellRenderer
  CellRenderer.registerShape('customHexagon', asShapeConstructor(HexagonShape));
  CellRenderer.registerShape('customPentagon', asShapeConstructor(PentagonShape));
  CellRenderer.registerShape('customStar', asShapeConstructor(StarShape));
  CellRenderer.registerShape('customTrapezoid', asShapeConstructor(TrapezoidShape));
  CellRenderer.registerShape('customCross', asShapeConstructor(CrossShape));
  CellRenderer.registerShape('customCylinder', asShapeConstructor(CylinderShape));
  CellRenderer.registerShape('customSimpleArrow', asShapeConstructor(SimpleArrowShape));
  CellRenderer.registerShape('customOval', asShapeConstructor(OvalShape));
  CellRenderer.registerShape('customDoubleRectangle', asShapeConstructor(DoubleRectangleShape));
  CellRenderer.registerShape('customParallelogram', asShapeConstructor(ParallelogramShape));
  CellRenderer.registerShape('customDelay', asShapeConstructor(DelayShape));
  CellRenderer.registerShape('customChevron', asShapeConstructor(ChevronShape));
  CellRenderer.registerShape('customRightAngle', asShapeConstructor(RightAngleShape));
  CellRenderer.registerShape('customLozenge', asShapeConstructor(LozengeShape));
  CellRenderer.registerShape('customRoundedRectangle', asShapeConstructor(RoundedRectangleShape));

  // Register only Basic shapes via their registry functions
  registerBasicShapeClasses();
  registerBasicShapes();

  // ERTMS placeholder shapes: renderers only (old files still open). The ERTMS palette is the
  // draw.io library public/libraries/ertms.xml in the draw.io tab of the left panel.
  registerErtmsShapeClasses();
}

export { shapeRegistry } from './registry';
export type { ShapeConfig } from './registry';
export { ShapeToolbar } from './toolbar';
