/**
 * Arrow shape registry - all arrow shapes registered here
 */

import { shapeRegistry } from '../registry';
import { svgArrows } from './svg-arrows';

const svgToDataUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

// Create icon from SVG (use raw SVG for toolbar display)
const createSvgIcon = (svg: string): string => {
  // Return the SVG directly - toolbar will scale it
  return svg;
};

export function registerArrowShapes(): void {
  // Simple arrows (basic) - using scaled SVG icons
  const rightArrowIcon = createSvgIcon(svgArrows.wideArrow);
  const leftArrowIcon = createSvgIcon(svgArrows.leftArrow);
  const upArrowIcon = createSvgIcon(svgArrows.upArrow);
  const downArrowIcon = createSvgIcon(svgArrows.downArrow);
  const doubleArrowIcon = createSvgIcon(svgArrows.doubleArrow);

  shapeRegistry.register({
    id: 'arrow_right',
    label: 'Arrow Right',
    icon: rightArrowIcon,
    group: 'Arrows',
    width: 100,
    height: 60,
    style: { shape: 'customArrow', filled: false, strokeColor: '#2c3e50', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'arrow_left',
    label: 'Arrow Left',
    icon: leftArrowIcon,
    group: 'Arrows',
    width: 100,
    height: 60,
    style: { shape: 'customArrow', filled: false, strokeColor: '#2c3e50', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'arrow_up',
    label: 'Arrow Up',
    icon: upArrowIcon,
    group: 'Arrows',
    width: 60,
    height: 100,
    style: { shape: 'customArrow', filled: false, strokeColor: '#2c3e50', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'arrow_down',
    label: 'Arrow Down',
    icon: downArrowIcon,
    group: 'Arrows',
    width: 60,
    height: 100,
    style: { shape: 'customArrow', filled: false, strokeColor: '#2c3e50', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'double_arrow',
    label: 'Double Arrow',
    icon: doubleArrowIcon,
    group: 'Arrows',
    width: 120,
    height: 60,
    style: { shape: 'customArrow', filled: false, strokeColor: '#2c3e50', strokeWidth: 2 },
  });

  // Advanced arrow types (SVG-based) - using scaled SVG icons
  shapeRegistry.register({
    id: 'wide_arrow',
    label: 'Wide Arrow',
    icon: createSvgIcon(svgArrows.wideArrow),
    group: 'Arrows',
    width: 120,
    height: 60,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.wideArrow) },
  });

  shapeRegistry.register({
    id: 'thin_arrow',
    label: 'Thin Arrow',
    icon: createSvgIcon(svgArrows.thinArrow),
    group: 'Arrows',
    width: 120,
    height: 40,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.thinArrow) },
  });

  shapeRegistry.register({
    id: 'double_headed_arrow',
    label: 'Double Headed',
    icon: createSvgIcon(svgArrows.doubleArrow),
    group: 'Arrows',
    width: 140,
    height: 60,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.doubleArrow) },
  });

  shapeRegistry.register({
    id: 'notched_arrow',
    label: 'Notched Arrow',
    icon: createSvgIcon(svgArrows.notchedArrow),
    group: 'Arrows',
    width: 120,
    height: 60,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.notchedArrow) },
  });

  shapeRegistry.register({
    id: 'split_arrow',
    label: 'Split Arrow',
    icon: createSvgIcon(svgArrows.splitArrow),
    group: 'Arrows',
    width: 100,
    height: 80,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.splitArrow) },
  });

  shapeRegistry.register({
    id: 'curved_arrow',
    label: 'Curved Arrow',
    icon: createSvgIcon(svgArrows.curvedArrow),
    group: 'Arrows',
    width: 120,
    height: 60,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.curvedArrow) },
  });

  shapeRegistry.register({
    id: 'loop_arrow',
    label: 'Loop Arrow',
    icon: createSvgIcon(svgArrows.loopArrow),
    group: 'Arrows',
    width: 100,
    height: 100,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.loopArrow) },
  });

  shapeRegistry.register({
    id: 'rounded_loop_arrow',
    label: 'Rounded Loop',
    icon: createSvgIcon(svgArrows.roundedLoopArrow),
    group: 'Arrows',
    width: 100,
    height: 100,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.roundedLoopArrow) },
  });

  shapeRegistry.register({
    id: 'chevron_arrow',
    label: 'Chevron Arrow',
    icon: createSvgIcon(svgArrows.chevronArrow),
    group: 'Arrows',
    width: 140,
    height: 60,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.chevronArrow) },
  });

  shapeRegistry.register({
    id: 'zigzag_arrow',
    label: 'Zigzag Arrow',
    icon: createSvgIcon(svgArrows.zigzagArrow),
    group: 'Arrows',
    width: 120,
    height: 60,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.zigzagArrow) },
  });

  shapeRegistry.register({
    id: 'hollow_arrow',
    label: 'Hollow Arrow',
    icon: createSvgIcon(svgArrows.hollowArrow),
    group: 'Arrows',
    width: 120,
    height: 60,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.hollowArrow) },
  });

  shapeRegistry.register({
    id: 'triangle_arrow',
    label: 'Triangle Arrow',
    icon: createSvgIcon(svgArrows.triangleArrow),
    group: 'Arrows',
    width: 100,
    height: 100,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.triangleArrow) },
  });

  shapeRegistry.register({
    id: 'left_arrow_svg',
    label: 'Left Arrow',
    icon: createSvgIcon(svgArrows.leftArrow),
    group: 'Arrows',
    width: 120,
    height: 60,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.leftArrow) },
  });

  shapeRegistry.register({
    id: 'up_arrow_svg',
    label: 'Up Arrow',
    icon: createSvgIcon(svgArrows.upArrow),
    group: 'Arrows',
    width: 60,
    height: 120,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.upArrow) },
  });

  shapeRegistry.register({
    id: 'down_arrow_svg',
    label: 'Down Arrow',
    icon: createSvgIcon(svgArrows.downArrow),
    group: 'Arrows',
    width: 60,
    height: 120,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.downArrow) },
  });
}
