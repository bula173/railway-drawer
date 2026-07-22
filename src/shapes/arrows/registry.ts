/**
 * Arrow shapes registry - SVG-based arrow shapes
 *
 * All arrows are type 'svg' - pure SVG definitions rendered as images on canvas
 * Icons use raw SVG for toolbar display
 * Dragged shapes use SVG data URLs for rendering
 */

import { shapeRegistry } from '../registry';
import { svgArrows } from './svg-arrows';

const svgToDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export function registerArrowShapes(): void {
  // Simple arrows (basic) - SVG-based shapes
  shapeRegistry.register({
    id: 'arrow_right',
    type: 'svg',
    label: 'Arrow Right',
    icon: svgArrows.wideArrow,
    group: 'Arrows',
    width: 100,
    height: 60,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.wideArrow) },
  });

  shapeRegistry.register({
    id: 'arrow_left',
    type: 'svg',
    label: 'Arrow Left',
    icon: svgArrows.leftArrow,
    group: 'Arrows',
    width: 100,
    height: 60,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.leftArrow) },
  });

  shapeRegistry.register({
    id: 'arrow_up',
    type: 'svg',
    label: 'Arrow Up',
    icon: svgArrows.upArrow,
    group: 'Arrows',
    width: 60,
    height: 100,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.upArrow) },
  });

  shapeRegistry.register({
    id: 'arrow_down',
    type: 'svg',
    label: 'Arrow Down',
    icon: svgArrows.downArrow,
    group: 'Arrows',
    width: 60,
    height: 100,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.downArrow) },
  });

  shapeRegistry.register({
    id: 'double_arrow',
    type: 'svg',
    label: 'Double Arrow',
    icon: svgArrows.doubleArrow,
    group: 'Arrows',
    width: 120,
    height: 60,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.doubleArrow) },
  });

  // Advanced arrow types (SVG-based shapes)
  shapeRegistry.register({
    id: 'wide_arrow',
    type: 'svg',
    label: 'Wide Arrow',
    icon: svgArrows.wideArrow,
    group: 'Arrows',
    width: 120,
    height: 60,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.wideArrow) },
  });

  shapeRegistry.register({
    id: 'thin_arrow',
    type: 'svg',
    label: 'Thin Arrow',
    icon: svgArrows.thinArrow,
    group: 'Arrows',
    width: 120,
    height: 40,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.thinArrow) },
  });

  shapeRegistry.register({
    id: 'double_headed_arrow',
    type: 'svg',
    label: 'Double Headed',
    icon: svgArrows.doubleArrow,
    group: 'Arrows',
    width: 140,
    height: 60,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.doubleArrow) },
  });

  shapeRegistry.register({
    id: 'notched_arrow',
    type: 'svg',
    label: 'Notched Arrow',
    icon: svgArrows.notchedArrow,
    group: 'Arrows',
    width: 120,
    height: 60,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.notchedArrow) },
  });

  shapeRegistry.register({
    id: 'split_arrow',
    type: 'svg',
    label: 'Split Arrow',
    icon: svgArrows.splitArrow,
    group: 'Arrows',
    width: 100,
    height: 80,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.splitArrow) },
  });

  shapeRegistry.register({
    id: 'curved_arrow',
    type: 'svg',
    label: 'Curved Arrow',
    icon: svgArrows.curvedArrow,
    group: 'Arrows',
    width: 120,
    height: 60,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.curvedArrow) },
  });

  shapeRegistry.register({
    id: 'loop_arrow',
    type: 'svg',
    label: 'Loop Arrow',
    icon: svgArrows.loopArrow,
    group: 'Arrows',
    width: 100,
    height: 100,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.loopArrow) },
  });

  shapeRegistry.register({
    id: 'rounded_loop_arrow',
    type: 'svg',
    label: 'Rounded Loop',
    icon: svgArrows.roundedLoopArrow,
    group: 'Arrows',
    width: 100,
    height: 100,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.roundedLoopArrow) },
  });

  shapeRegistry.register({
    id: 'chevron_arrow',
    type: 'svg',
    label: 'Chevron Arrow',
    icon: svgArrows.chevronArrow,
    group: 'Arrows',
    width: 140,
    height: 60,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.chevronArrow) },
  });

  shapeRegistry.register({
    id: 'zigzag_arrow',
    type: 'svg',
    label: 'Zigzag Arrow',
    icon: svgArrows.zigzagArrow,
    group: 'Arrows',
    width: 120,
    height: 60,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.zigzagArrow) },
  });

  shapeRegistry.register({
    id: 'hollow_arrow',
    type: 'svg',
    label: 'Hollow Arrow',
    icon: svgArrows.hollowArrow,
    group: 'Arrows',
    width: 120,
    height: 60,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.hollowArrow) },
  });

  shapeRegistry.register({
    id: 'triangle_arrow',
    type: 'svg',
    label: 'Triangle Arrow',
    icon: svgArrows.triangleArrow,
    group: 'Arrows',
    width: 100,
    height: 100,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.triangleArrow) },
  });

  shapeRegistry.register({
    id: 'left_arrow_svg',
    type: 'svg',
    label: 'Left Arrow',
    icon: svgArrows.leftArrow,
    group: 'Arrows',
    width: 120,
    height: 60,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.leftArrow) },
  });

  shapeRegistry.register({
    id: 'up_arrow_svg',
    type: 'svg',
    label: 'Up Arrow',
    icon: svgArrows.upArrow,
    group: 'Arrows',
    width: 60,
    height: 120,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.upArrow) },
  });

  shapeRegistry.register({
    id: 'down_arrow_svg',
    type: 'svg',
    label: 'Down Arrow',
    icon: svgArrows.downArrow,
    group: 'Arrows',
    width: 60,
    height: 120,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.downArrow) },
  });
}
