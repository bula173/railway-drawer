/**
 * Draw.io mxArrows shapes registry
 */

import { CellRenderer } from '@maxgraph/core';
import { shapeRegistry } from '../registry.js';
import {
  Arrows2ArrowShape,
  Arrows2TwoWayArrowShape,
  Arrows2StylisedArrowShape,
  Arrows2SharpArrowShape,
  Arrows2SharpArrow2Shape,
  Arrows2CalloutArrowShape,
  Arrows2BendArrowShape,
  Arrows2BendDoubleArrowShape,
  Arrows2CalloutDoubleArrowShape,
  Arrows2CalloutQuadArrowShape,
  Arrows2CalloutDouble90ArrowShape,
  Arrows2QuadArrowShape,
  Arrows2TriadArrowShape,
  Arrows2TailedArrowShape,
  Arrows2TailedNotchedArrowShape,
  Arrows2StripedArrowShape,
  Arrows2JumpInArrowShape,
  Arrows2UTurnArrowShape,
} from './index.js';

/**
 * Register all draw.io mxArrows shape classes with CellRenderer
 */
export function registerDrawioMxArrowsShapeClasses(): void {
  CellRenderer.defaultShapes['mxarrows.Arrows2Arrow'] = Arrows2ArrowShape as any;
  CellRenderer.defaultShapes['mxarrows.Arrows2TwoWayArrow'] = Arrows2TwoWayArrowShape as any;
  CellRenderer.defaultShapes['mxarrows.Arrows2StylisedArrow'] = Arrows2StylisedArrowShape as any;
  CellRenderer.defaultShapes['mxarrows.Arrows2SharpArrow'] = Arrows2SharpArrowShape as any;
  CellRenderer.defaultShapes['mxarrows.Arrows2SharpArrow2'] = Arrows2SharpArrow2Shape as any;
  CellRenderer.defaultShapes['mxarrows.Arrows2CalloutArrow'] = Arrows2CalloutArrowShape as any;
  CellRenderer.defaultShapes['mxarrows.Arrows2BendArrow'] = Arrows2BendArrowShape as any;
  CellRenderer.defaultShapes['mxarrows.Arrows2BendDoubleArrow'] = Arrows2BendDoubleArrowShape as any;
  CellRenderer.defaultShapes['mxarrows.Arrows2CalloutDoubleArrow'] = Arrows2CalloutDoubleArrowShape as any;
  CellRenderer.defaultShapes['mxarrows.Arrows2CalloutQuadArrow'] = Arrows2CalloutQuadArrowShape as any;
  CellRenderer.defaultShapes['mxarrows.Arrows2CalloutDouble90Arrow'] = Arrows2CalloutDouble90ArrowShape as any;
  CellRenderer.defaultShapes['mxarrows.Arrows2QuadArrow'] = Arrows2QuadArrowShape as any;
  CellRenderer.defaultShapes['mxarrows.Arrows2TriadArrow'] = Arrows2TriadArrowShape as any;
  CellRenderer.defaultShapes['mxarrows.Arrows2TailedArrow'] = Arrows2TailedArrowShape as any;
  CellRenderer.defaultShapes['mxarrows.Arrows2TailedNotchedArrow'] = Arrows2TailedNotchedArrowShape as any;
  CellRenderer.defaultShapes['mxarrows.Arrows2StripedArrow'] = Arrows2StripedArrowShape as any;
  CellRenderer.defaultShapes['mxarrows.Arrows2JumpInArrow'] = Arrows2JumpInArrowShape as any;
  CellRenderer.defaultShapes['mxarrows.Arrows2UTurnArrow'] = Arrows2UTurnArrowShape as any;
}

/**
 * Register draw.io mxArrows shapes with shape registry (for palette/menu)
 */
export function registerDrawioMxArrowsShapes(): void {
  shapeRegistry.register({
    id: 'drawio-mxarrows-arrows2-arrow',
    type: 'vertex',
    label: 'Arrows2 Arrow',
    group: 'Draw.io Arrows',
    icon: '', // Icon will be generated from shape vertex at runtime
    iconGeneratorClass: Arrows2ArrowShape,
    width: 100,
    height: 100,
    style: { shape: 'mxarrows.Arrows2Arrow', fillColor: '#e3f2fd', strokeColor: '#1976d2' },
  });

  shapeRegistry.register({
    id: 'drawio-mxarrows-arrows2-two-way-arrow',
    type: 'vertex',
    label: 'Arrows2 Two Way Arrow',
    group: 'Draw.io Arrows',
    icon: '', // Icon will be generated from shape vertex at runtime
    iconGeneratorClass: Arrows2TwoWayArrowShape,
    width: 100,
    height: 100,
    style: { shape: 'mxarrows.Arrows2TwoWayArrow', fillColor: '#e3f2fd', strokeColor: '#1976d2' },
  });

  shapeRegistry.register({
    id: 'drawio-mxarrows-arrows2-stylised-arrow',
    type: 'vertex',
    label: 'Arrows2 Stylised Arrow',
    group: 'Draw.io Arrows',
    icon: '', // Icon will be generated from shape vertex at runtime
    iconGeneratorClass: Arrows2StylisedArrowShape,
    width: 100,
    height: 100,
    style: { shape: 'mxarrows.Arrows2StylisedArrow', fillColor: '#e3f2fd', strokeColor: '#1976d2' },
  });

  shapeRegistry.register({
    id: 'drawio-mxarrows-arrows2-sharp-arrow',
    type: 'vertex',
    label: 'Arrows2 Sharp Arrow',
    group: 'Draw.io Arrows',
    icon: '', // Icon will be generated from shape vertex at runtime
    iconGeneratorClass: Arrows2SharpArrowShape,
    width: 100,
    height: 100,
    style: { shape: 'mxarrows.Arrows2SharpArrow', fillColor: '#e3f2fd', strokeColor: '#1976d2' },
  });

  shapeRegistry.register({
    id: 'drawio-mxarrows-arrows2-sharp-arrow2',
    type: 'vertex',
    label: 'Arrows2 Sharp Arrow2',
    group: 'Draw.io Arrows',
    icon: '', // Icon will be generated from shape vertex at runtime
    iconGeneratorClass: Arrows2SharpArrow2Shape,
    width: 100,
    height: 100,
    style: { shape: 'mxarrows.Arrows2SharpArrow2', fillColor: '#e3f2fd', strokeColor: '#1976d2' },
  });

  shapeRegistry.register({
    id: 'drawio-mxarrows-arrows2-callout-arrow',
    type: 'vertex',
    label: 'Arrows2 Callout Arrow',
    group: 'Draw.io Arrows',
    icon: '', // Icon will be generated from shape vertex at runtime
    iconGeneratorClass: Arrows2CalloutArrowShape,
    width: 100,
    height: 100,
    style: { shape: 'mxarrows.Arrows2CalloutArrow', fillColor: '#e3f2fd', strokeColor: '#1976d2' },
  });

  shapeRegistry.register({
    id: 'drawio-mxarrows-arrows2-bend-arrow',
    type: 'vertex',
    label: 'Arrows2 Bend Arrow',
    group: 'Draw.io Arrows',
    icon: '', // Icon will be generated from shape vertex at runtime
    iconGeneratorClass: Arrows2BendArrowShape,
    width: 100,
    height: 100,
    style: { shape: 'mxarrows.Arrows2BendArrow', fillColor: '#e3f2fd', strokeColor: '#1976d2' },
  });

  shapeRegistry.register({
    id: 'drawio-mxarrows-arrows2-bend-double-arrow',
    type: 'vertex',
    label: 'Arrows2 Bend Double Arrow',
    group: 'Draw.io Arrows',
    icon: '', // Icon will be generated from shape vertex at runtime
    iconGeneratorClass: Arrows2BendDoubleArrowShape,
    width: 100,
    height: 100,
    style: { shape: 'mxarrows.Arrows2BendDoubleArrow', fillColor: '#e3f2fd', strokeColor: '#1976d2' },
  });

  shapeRegistry.register({
    id: 'drawio-mxarrows-arrows2-callout-double-arrow',
    type: 'vertex',
    label: 'Arrows2 Callout Double Arrow',
    group: 'Draw.io Arrows',
    icon: '', // Icon will be generated from shape vertex at runtime
    iconGeneratorClass: Arrows2CalloutDoubleArrowShape,
    width: 100,
    height: 100,
    style: { shape: 'mxarrows.Arrows2CalloutDoubleArrow', fillColor: '#e3f2fd', strokeColor: '#1976d2' },
  });

  shapeRegistry.register({
    id: 'drawio-mxarrows-arrows2-callout-quad-arrow',
    type: 'vertex',
    label: 'Arrows2 Callout Quad Arrow',
    group: 'Draw.io Arrows',
    icon: '', // Icon will be generated from shape vertex at runtime
    iconGeneratorClass: Arrows2CalloutQuadArrowShape,
    width: 100,
    height: 100,
    style: { shape: 'mxarrows.Arrows2CalloutQuadArrow', fillColor: '#e3f2fd', strokeColor: '#1976d2' },
  });

  shapeRegistry.register({
    id: 'drawio-mxarrows-arrows2-callout-double90-arrow',
    type: 'vertex',
    label: 'Arrows2 Callout Double90 Arrow',
    group: 'Draw.io Arrows',
    icon: '', // Icon will be generated from shape vertex at runtime
    iconGeneratorClass: Arrows2CalloutDouble90ArrowShape,
    width: 100,
    height: 100,
    style: { shape: 'mxarrows.Arrows2CalloutDouble90Arrow', fillColor: '#e3f2fd', strokeColor: '#1976d2' },
  });

  shapeRegistry.register({
    id: 'drawio-mxarrows-arrows2-quad-arrow',
    type: 'vertex',
    label: 'Arrows2 Quad Arrow',
    group: 'Draw.io Arrows',
    icon: '', // Icon will be generated from shape vertex at runtime
    iconGeneratorClass: Arrows2QuadArrowShape,
    width: 100,
    height: 100,
    style: { shape: 'mxarrows.Arrows2QuadArrow', fillColor: '#e3f2fd', strokeColor: '#1976d2' },
  });

  shapeRegistry.register({
    id: 'drawio-mxarrows-arrows2-triad-arrow',
    type: 'vertex',
    label: 'Arrows2 Triad Arrow',
    group: 'Draw.io Arrows',
    icon: '', // Icon will be generated from shape vertex at runtime
    iconGeneratorClass: Arrows2TriadArrowShape,
    width: 100,
    height: 100,
    style: { shape: 'mxarrows.Arrows2TriadArrow', fillColor: '#e3f2fd', strokeColor: '#1976d2' },
  });

  shapeRegistry.register({
    id: 'drawio-mxarrows-arrows2-tailed-arrow',
    type: 'vertex',
    label: 'Arrows2 Tailed Arrow',
    group: 'Draw.io Arrows',
    icon: '', // Icon will be generated from shape vertex at runtime
    iconGeneratorClass: Arrows2TailedArrowShape,
    width: 100,
    height: 100,
    style: { shape: 'mxarrows.Arrows2TailedArrow', fillColor: '#e3f2fd', strokeColor: '#1976d2' },
  });

  shapeRegistry.register({
    id: 'drawio-mxarrows-arrows2-tailed-notched-arrow',
    type: 'vertex',
    label: 'Arrows2 Tailed Notched Arrow',
    group: 'Draw.io Arrows',
    icon: '', // Icon will be generated from shape vertex at runtime
    iconGeneratorClass: Arrows2TailedNotchedArrowShape,
    width: 100,
    height: 100,
    style: { shape: 'mxarrows.Arrows2TailedNotchedArrow', fillColor: '#e3f2fd', strokeColor: '#1976d2' },
  });

  shapeRegistry.register({
    id: 'drawio-mxarrows-arrows2-striped-arrow',
    type: 'vertex',
    label: 'Arrows2 Striped Arrow',
    group: 'Draw.io Arrows',
    icon: '', // Icon will be generated from shape vertex at runtime
    iconGeneratorClass: Arrows2StripedArrowShape,
    width: 100,
    height: 100,
    style: { shape: 'mxarrows.Arrows2StripedArrow', fillColor: '#e3f2fd', strokeColor: '#1976d2' },
  });

  shapeRegistry.register({
    id: 'drawio-mxarrows-arrows2-jump-in-arrow',
    type: 'vertex',
    label: 'Arrows2 Jump In Arrow',
    group: 'Draw.io Arrows',
    icon: '', // Icon will be generated from shape vertex at runtime
    iconGeneratorClass: Arrows2JumpInArrowShape,
    width: 100,
    height: 100,
    style: { shape: 'mxarrows.Arrows2JumpInArrow', fillColor: '#e3f2fd', strokeColor: '#1976d2' },
  });

  shapeRegistry.register({
    id: 'drawio-mxarrows-arrows2-u-turn-arrow',
    type: 'vertex',
    label: 'Arrows2 U Turn Arrow',
    group: 'Draw.io Arrows',
    icon: '', // Icon will be generated from shape vertex at runtime
    iconGeneratorClass: Arrows2UTurnArrowShape,
    width: 100,
    height: 100,
    style: { shape: 'mxarrows.Arrows2UTurnArrow', fillColor: '#e3f2fd', strokeColor: '#1976d2' },
  });
}
