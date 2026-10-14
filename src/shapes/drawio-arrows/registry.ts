/**
 * Draw.io mxArrows shapes registry (legacy entry points).
 *
 * Delegates to the port of draw.io shapes/mxArrows.js in
 * src/drawio-shapes/js/mx-libs/arrows2:
 * - the real draw.io names ('mxgraph.arrows2.arrow', ...) are registered,
 * - the legacy keys ('mxarrows.Arrows2Arrow', ...) used by older saved files
 *   stay registered as aliases of the same constructors,
 * - ShapeRegistry entries keep their ids but insert `shape=mxgraph.arrows2.*`,
 *   so new cells open 1:1 in draw.io.
 */

import { CellRenderer, type Shape } from '@maxgraph/core';
import { shapeRegistry } from '../registry.js';
import { MX_ARROWS2_SHAPES, registerMxArrows2Shapes } from '../../drawio-shapes/js/mx-libs/arrows2/index.js';

interface LegacyArrowEntry {
  /** Legacy CellRenderer key (pre draw.io names). */
  legacyKey: string;
  /** Exact draw.io shape name. */
  drawioName: string;
  /** ShapeRegistry id (unchanged). */
  id: string;
  /** ShapeRegistry label (unchanged). */
  label: string;
}

/** Legacy key -> draw.io name for the 18 arrows2 vertex shapes. */
export const LEGACY_MXARROWS_ENTRIES: readonly LegacyArrowEntry[] = [
  { legacyKey: 'mxarrows.Arrows2Arrow', drawioName: 'mxgraph.arrows2.arrow', id: 'drawio-mxarrows-arrows2-arrow', label: 'Arrows2 Arrow' },
  { legacyKey: 'mxarrows.Arrows2TwoWayArrow', drawioName: 'mxgraph.arrows2.twoWayArrow', id: 'drawio-mxarrows-arrows2-two-way-arrow', label: 'Arrows2 Two Way Arrow' },
  { legacyKey: 'mxarrows.Arrows2StylisedArrow', drawioName: 'mxgraph.arrows2.stylisedArrow', id: 'drawio-mxarrows-arrows2-stylised-arrow', label: 'Arrows2 Stylised Arrow' },
  { legacyKey: 'mxarrows.Arrows2SharpArrow', drawioName: 'mxgraph.arrows2.sharpArrow', id: 'drawio-mxarrows-arrows2-sharp-arrow', label: 'Arrows2 Sharp Arrow' },
  { legacyKey: 'mxarrows.Arrows2SharpArrow2', drawioName: 'mxgraph.arrows2.sharpArrow2', id: 'drawio-mxarrows-arrows2-sharp-arrow2', label: 'Arrows2 Sharp Arrow2' },
  { legacyKey: 'mxarrows.Arrows2CalloutArrow', drawioName: 'mxgraph.arrows2.calloutArrow', id: 'drawio-mxarrows-arrows2-callout-arrow', label: 'Arrows2 Callout Arrow' },
  { legacyKey: 'mxarrows.Arrows2BendArrow', drawioName: 'mxgraph.arrows2.bendArrow', id: 'drawio-mxarrows-arrows2-bend-arrow', label: 'Arrows2 Bend Arrow' },
  { legacyKey: 'mxarrows.Arrows2BendDoubleArrow', drawioName: 'mxgraph.arrows2.bendDoubleArrow', id: 'drawio-mxarrows-arrows2-bend-double-arrow', label: 'Arrows2 Bend Double Arrow' },
  { legacyKey: 'mxarrows.Arrows2CalloutDoubleArrow', drawioName: 'mxgraph.arrows2.calloutDoubleArrow', id: 'drawio-mxarrows-arrows2-callout-double-arrow', label: 'Arrows2 Callout Double Arrow' },
  { legacyKey: 'mxarrows.Arrows2CalloutQuadArrow', drawioName: 'mxgraph.arrows2.calloutQuadArrow', id: 'drawio-mxarrows-arrows2-callout-quad-arrow', label: 'Arrows2 Callout Quad Arrow' },
  { legacyKey: 'mxarrows.Arrows2CalloutDouble90Arrow', drawioName: 'mxgraph.arrows2.calloutDouble90Arrow', id: 'drawio-mxarrows-arrows2-callout-double90-arrow', label: 'Arrows2 Callout Double90 Arrow' },
  { legacyKey: 'mxarrows.Arrows2QuadArrow', drawioName: 'mxgraph.arrows2.quadArrow', id: 'drawio-mxarrows-arrows2-quad-arrow', label: 'Arrows2 Quad Arrow' },
  { legacyKey: 'mxarrows.Arrows2TriadArrow', drawioName: 'mxgraph.arrows2.triadArrow', id: 'drawio-mxarrows-arrows2-triad-arrow', label: 'Arrows2 Triad Arrow' },
  { legacyKey: 'mxarrows.Arrows2TailedArrow', drawioName: 'mxgraph.arrows2.tailedArrow', id: 'drawio-mxarrows-arrows2-tailed-arrow', label: 'Arrows2 Tailed Arrow' },
  { legacyKey: 'mxarrows.Arrows2TailedNotchedArrow', drawioName: 'mxgraph.arrows2.tailedNotchedArrow', id: 'drawio-mxarrows-arrows2-tailed-notched-arrow', label: 'Arrows2 Tailed Notched Arrow' },
  { legacyKey: 'mxarrows.Arrows2StripedArrow', drawioName: 'mxgraph.arrows2.stripedArrow', id: 'drawio-mxarrows-arrows2-striped-arrow', label: 'Arrows2 Striped Arrow' },
  { legacyKey: 'mxarrows.Arrows2JumpInArrow', drawioName: 'mxgraph.arrows2.jumpInArrow', id: 'drawio-mxarrows-arrows2-jump-in-arrow', label: 'Arrows2 Jump In Arrow' },
  { legacyKey: 'mxarrows.Arrows2UTurnArrow', drawioName: 'mxgraph.arrows2.uTurnArrow', id: 'drawio-mxarrows-arrows2-u-turn-arrow', label: 'Arrows2 U Turn Arrow' },
];

/** Legacy key -> draw.io name, for loaders that want to normalise old files. */
export const LEGACY_MXARROWS_TO_DRAWIO: Readonly<Record<string, string>> = Object.fromEntries(
  LEGACY_MXARROWS_ENTRIES.map((e) => [e.legacyKey, e.drawioName]),
);

function ctorFor(drawioName: string): typeof Shape {
  const hit = MX_ARROWS2_SHAPES.find(([name]) => name === drawioName);
  if (!hit) throw new Error(`mxArrows port has no shape '${drawioName}'`);
  return hit[1] as unknown as typeof Shape;
}

/**
 * Registers the draw.io arrows2 shapes under their real names and the legacy
 * 'mxarrows.*' keys as aliases of the same constructors. Idempotent.
 * Returns all registered keys (draw.io names first, then legacy aliases).
 */
export function registerDrawioMxArrowsShapeClasses(): string[] {
  const names = registerMxArrows2Shapes();
  for (const e of LEGACY_MXARROWS_ENTRIES) {
    CellRenderer.registerShape(e.legacyKey, ctorFor(e.drawioName));
  }
  return [...names, ...LEGACY_MXARROWS_ENTRIES.map((e) => e.legacyKey)];
}

/**
 * Register draw.io arrows2 shapes with the shape registry (palette/menu).
 * Ids and labels are unchanged; inserted cells use the real draw.io name.
 */
export function registerDrawioMxArrowsShapes(): void {
  for (const e of LEGACY_MXARROWS_ENTRIES) {
    shapeRegistry.register({
      id: e.id,
      type: 'vertex',
      label: e.label,
      group: 'Draw.io Arrows',
      icon: '', // Icon will be generated from shape vertex at runtime
      iconGeneratorClass: ctorFor(e.drawioName),
      width: 100,
      height: 100,
      style: { shape: e.drawioName, fillColor: '#e3f2fd', strokeColor: '#1976d2' },
    });
  }
}
