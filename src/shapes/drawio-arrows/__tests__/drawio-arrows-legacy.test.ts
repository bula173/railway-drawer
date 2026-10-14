/**
 * Legacy draw.io arrows2 entry points delegate to the mx-libs port.
 */

import { describe, it, expect } from 'vitest';
import { CellRenderer, Graph } from '@maxgraph/core';
import {
  LEGACY_MXARROWS_ENTRIES,
  LEGACY_MXARROWS_TO_DRAWIO,
  registerDrawioMxArrowsShapeClasses,
  registerDrawioMxArrowsShapes,
} from '../registry';
import { Arrows2ArrowShape, Arrows2UTurnArrowShape } from '../index';
import { shapeRegistry } from '../../registry';
import { mxShapeArrows2Arrow, mxShapeArrows2UTurnArrow } from '../../../drawio-shapes/js/mx-libs/arrows2/index';

describe('drawio-arrows legacy aliases', () => {
  it('keeps the old class names as aliases of the ports', () => {
    expect(Arrows2ArrowShape).toBe(mxShapeArrows2Arrow);
    expect(Arrows2UTurnArrowShape).toBe(mxShapeArrows2UTurnArrow);
  });

  it('registers draw.io names and legacy keys to the same constructors (idempotent)', () => {
    const first = registerDrawioMxArrowsShapeClasses();
    const second = registerDrawioMxArrowsShapeClasses();
    expect(second).toEqual(first);
    expect(LEGACY_MXARROWS_ENTRIES).toHaveLength(18);
    for (const e of LEGACY_MXARROWS_ENTRIES) {
      expect(first).toContain(e.drawioName);
      expect(first).toContain(e.legacyKey);
      expect(CellRenderer.defaultShapes[e.legacyKey]).toBeTypeOf('function');
      expect(CellRenderer.defaultShapes[e.legacyKey]).toBe(CellRenderer.defaultShapes[e.drawioName]);
    }
    expect(LEGACY_MXARROWS_TO_DRAWIO['mxarrows.Arrows2Arrow']).toBe('mxgraph.arrows2.arrow');
  });

  it('ShapeRegistry entries keep their ids and insert the real draw.io name', () => {
    registerDrawioMxArrowsShapes();
    for (const e of LEGACY_MXARROWS_ENTRIES) {
      const cfg = shapeRegistry.getShape(e.id);
      expect(cfg, e.id).toBeTruthy();
      expect(cfg!.style.shape).toBe(e.drawioName);
      expect(cfg!.iconGeneratorClass).toBe(CellRenderer.defaultShapes[e.drawioName]);
    }
  });

  it('an old file using the legacy key still renders with the port', () => {
    registerDrawioMxArrowsShapeClasses();
    const container = document.createElement('div');
    const graph = new Graph(container);
    const cell = graph.insertVertex({
      parent: graph.getDefaultParent(),
      position: [10, 10],
      size: [100, 60],
      style: { shape: 'mxarrows.Arrows2Arrow' } as any,
    });
    const state = graph.getView().getState(cell);
    expect(state?.shape).toBeInstanceOf(mxShapeArrows2Arrow);
    expect(state!.shape!.node.innerHTML).not.toContain('NaN');
    graph.destroy();
  });
});
