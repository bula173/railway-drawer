/**
 * Arrow shape registry - all arrow shapes registered here
 */

import { shapeRegistry } from '../registry';
import { svgArrows } from './svg-arrows';

const svgToDataUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

export function registerArrowShapes(): void {
  // Simple arrows (basic)
  shapeRegistry.register({
    id: 'arrow_right',
    label: 'Arrow Right',
    icon: '→',
    group: 'Arrows',
    width: 100,
    height: 60,
    style: { shape: 'customArrow', filled: false, strokeColor: '#2c3e50', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'arrow_left',
    label: 'Arrow Left',
    icon: '←',
    group: 'Arrows',
    width: 100,
    height: 60,
    style: { shape: 'customArrow', filled: false, strokeColor: '#2c3e50', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'arrow_up',
    label: 'Arrow Up',
    icon: '↑',
    group: 'Arrows',
    width: 60,
    height: 100,
    style: { shape: 'customArrow', filled: false, strokeColor: '#2c3e50', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'arrow_down',
    label: 'Arrow Down',
    icon: '↓',
    group: 'Arrows',
    width: 60,
    height: 100,
    style: { shape: 'customArrow', filled: false, strokeColor: '#2c3e50', strokeWidth: 2 },
  });

  shapeRegistry.register({
    id: 'double_arrow',
    label: 'Double Arrow',
    icon: '⇄',
    group: 'Arrows',
    width: 120,
    height: 60,
    style: { shape: 'customArrow', filled: false, strokeColor: '#2c3e50', strokeWidth: 2 },
  });

  // Advanced arrow types (SVG-based)
  shapeRegistry.register({
    id: 'wide_arrow',
    label: 'Wide Arrow',
    icon: '▶',
    group: 'Arrows',
    width: 120,
    height: 60,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.wideArrow) },
  });

  shapeRegistry.register({
    id: 'thin_arrow',
    label: 'Thin Arrow',
    icon: '▸',
    group: 'Arrows',
    width: 120,
    height: 40,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.thinArrow) },
  });

  shapeRegistry.register({
    id: 'double_headed_arrow',
    label: 'Double Headed',
    icon: '⟷',
    group: 'Arrows',
    width: 140,
    height: 60,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.doubleArrow) },
  });

  shapeRegistry.register({
    id: 'notched_arrow',
    label: 'Notched Arrow',
    icon: '▷',
    group: 'Arrows',
    width: 120,
    height: 60,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.notchedArrow) },
  });

  shapeRegistry.register({
    id: 'split_arrow',
    label: 'Split Arrow',
    icon: '⊳',
    group: 'Arrows',
    width: 100,
    height: 80,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.splitArrow) },
  });

  shapeRegistry.register({
    id: 'curved_arrow',
    label: 'Curved Arrow',
    icon: '↗',
    group: 'Arrows',
    width: 120,
    height: 60,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.curvedArrow) },
  });

  shapeRegistry.register({
    id: 'loop_arrow',
    label: 'Loop Arrow',
    icon: '↻',
    group: 'Arrows',
    width: 100,
    height: 100,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.loopArrow) },
  });

  shapeRegistry.register({
    id: 'rounded_loop_arrow',
    label: 'Rounded Loop',
    icon: '↺',
    group: 'Arrows',
    width: 100,
    height: 100,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.roundedLoopArrow) },
  });

  shapeRegistry.register({
    id: 'chevron_arrow',
    label: 'Chevron Arrow',
    icon: '◅',
    group: 'Arrows',
    width: 140,
    height: 60,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.chevronArrow) },
  });

  shapeRegistry.register({
    id: 'zigzag_arrow',
    label: 'Zigzag Arrow',
    icon: '↝',
    group: 'Arrows',
    width: 120,
    height: 60,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.zigzagArrow) },
  });

  shapeRegistry.register({
    id: 'hollow_arrow',
    label: 'Hollow Arrow',
    icon: '⊳',
    group: 'Arrows',
    width: 120,
    height: 60,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.hollowArrow) },
  });

  shapeRegistry.register({
    id: 'triangle_arrow',
    label: 'Triangle Arrow',
    icon: '▲',
    group: 'Arrows',
    width: 100,
    height: 100,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.triangleArrow) },
  });

  shapeRegistry.register({
    id: 'left_arrow_svg',
    label: 'Left Arrow',
    icon: '◀',
    group: 'Arrows',
    width: 120,
    height: 60,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.leftArrow) },
  });

  shapeRegistry.register({
    id: 'up_arrow_svg',
    label: 'Up Arrow',
    icon: '▲',
    group: 'Arrows',
    width: 60,
    height: 120,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.upArrow) },
  });

  shapeRegistry.register({
    id: 'down_arrow_svg',
    label: 'Down Arrow',
    icon: '▼',
    group: 'Arrows',
    width: 60,
    height: 120,
    style: { shape: 'image', image: svgToDataUrl(svgArrows.downArrow) },
  });
}
