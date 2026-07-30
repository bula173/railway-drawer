/**
 * Arrow shapes registry - Vertex-based arrow shapes
 *
 * All arrows are type 'vertex' - native maxGraph shapes rendering using canvas API
 * Icons use SVG for toolbar display (read-only)
 * Dragged shapes use vertex-based rendering for full styling control
 * Custom perimeter functions ensure connectors attach to shape boundaries
 */

import { shapeRegistry } from '../registry';
import { CellRenderer } from '@maxgraph/core';
import { svgArrows } from './svg-arrows';
import {
  WideArrowShape,
  ThinArrowShape,
  DoubleArrowShape,
  NotchedArrowShape,
  SplitArrowShape,
  CurvedArrowShape,
  LoopArrowShape,
  ChevronArrowShape,
  ZigzagArrowShape,
  HollowArrowShape,
} from './arrow-shapes';

// Register arrow shape classes with CellRenderer
export function registerArrowShapeClasses(): void {
  CellRenderer.defaultShapes['wide-arrow-shape'] = WideArrowShape as any;
  CellRenderer.defaultShapes['thin-arrow-shape'] = ThinArrowShape as any;
  CellRenderer.defaultShapes['double-arrow-shape'] = DoubleArrowShape as any;
  CellRenderer.defaultShapes['notched-arrow-shape'] = NotchedArrowShape as any;
  CellRenderer.defaultShapes['split-arrow-shape'] = SplitArrowShape as any;
  CellRenderer.defaultShapes['curved-arrow-shape'] = CurvedArrowShape as any;
  CellRenderer.defaultShapes['loop-arrow-shape'] = LoopArrowShape as any;
  CellRenderer.defaultShapes['chevron-arrow-shape'] = ChevronArrowShape as any;
  CellRenderer.defaultShapes['zigzag-arrow-shape'] = ZigzagArrowShape as any;
  CellRenderer.defaultShapes['hollow-arrow-shape'] = HollowArrowShape as any;
}

export function registerArrowShapes(): void {
  // Directional arrows using vertex-based shapes
  shapeRegistry.register({
    id: 'wide_arrow',
    type: 'vertex',
    label: 'Wide Arrow',
    icon: svgArrows.wideArrow,
    group: 'Arrows',
    width: 120,
    height: 60,
    style: {
      shape: 'wide-arrow-shape',
      fillColor: 'none',
      strokeColor: '#000000',
    },
  });

  shapeRegistry.register({
    id: 'thin_arrow',
    type: 'vertex',
    label: 'Thin Arrow',
    icon: svgArrows.thinArrow,
    group: 'Arrows',
    width: 120,
    height: 60,
    style: {
      shape: 'thin-arrow-shape',
      fillColor: 'none',
      strokeColor: '#000000',
    },
  });

  shapeRegistry.register({
    id: 'double_headed_arrow',
    type: 'vertex',
    label: 'Double Arrow',
    icon: svgArrows.doubleArrow,
    group: 'Arrows',
    width: 120,
    height: 60,
    style: {
      shape: 'double-arrow-shape',
      fillColor: 'none',
      strokeColor: '#000000',
    },
  });

  shapeRegistry.register({
    id: 'notched_arrow',
    type: 'vertex',
    label: 'Notched Arrow',
    icon: svgArrows.notchedArrow,
    group: 'Arrows',
    width: 120,
    height: 60,
    style: {
      shape: 'notched-arrow-shape',
      fillColor: 'none',
      strokeColor: '#000000',
    },
  });

  shapeRegistry.register({
    id: 'split_arrow',
    type: 'vertex',
    label: 'Split Arrow',
    icon: svgArrows.splitArrow,
    group: 'Arrows',
    width: 120,
    height: 80,
    style: {
      shape: 'split-arrow-shape',
      fillColor: 'none',
      strokeColor: '#000000',
    },
  });

  shapeRegistry.register({
    id: 'curved_arrow',
    type: 'vertex',
    label: 'Curved Arrow',
    icon: svgArrows.curvedArrow,
    group: 'Arrows',
    width: 100,
    height: 100,
    style: {
      shape: 'curved-arrow-shape',
      fillColor: 'none',
      strokeColor: '#000000',
    },
  });

  shapeRegistry.register({
    id: 'loop_arrow',
    type: 'vertex',
    label: 'Loop Arrow',
    icon: svgArrows.loopArrow,
    group: 'Arrows',
    width: 100,
    height: 100,
    style: {
      shape: 'loop-arrow-shape',
      fillColor: 'none',
      strokeColor: '#000000',
    },
  });

  shapeRegistry.register({
    id: 'chevron_arrow',
    type: 'vertex',
    label: 'Chevron Arrow',
    icon: svgArrows.chevronArrow,
    group: 'Arrows',
    width: 100,
    height: 100,
    style: {
      shape: 'chevron-arrow-shape',
      fillColor: 'none',
      strokeColor: '#000000',
    },
  });

  shapeRegistry.register({
    id: 'zigzag_arrow',
    type: 'vertex',
    label: 'Zigzag Arrow',
    icon: svgArrows.zigzagArrow,
    group: 'Arrows',
    width: 100,
    height: 100,
    style: {
      shape: 'zigzag-arrow-shape',
      fillColor: 'none',
      strokeColor: '#000000',
    },
  });

  shapeRegistry.register({
    id: 'hollow_arrow',
    type: 'vertex',
    label: 'Hollow Arrow',
    icon: svgArrows.hollowArrow,
    group: 'Arrows',
    width: 120,
    height: 60,
    style: {
      shape: 'hollow-arrow-shape',
      fillColor: 'none',
      strokeColor: '#000000',
    },
  });
}
