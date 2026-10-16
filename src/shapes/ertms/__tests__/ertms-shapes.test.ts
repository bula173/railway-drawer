/**
 * ERTMS placeholder renderers: ertms-train draws its "ETCS L2" label with the maxGraph canvas API
 * (it used to call a non-existent drawString and threw while rendering).
 */
import { describe, it, expect } from 'vitest';
import { Graph } from '@maxgraph/core';
import type { AbstractCanvas2D } from '@maxgraph/core';
import { registerErtmsShapeClasses, TrainIconShape } from '../index';

describe('ERTMS placeholder shapes', () => {
  it('TrainIconShape writes its label through canvas.text()', () => {
    const calls: unknown[][] = [];
    const canvas = new Proxy({} as Record<string, unknown>, {
      get: (_t, name: string) => (...args: unknown[]) => calls.push([name, ...args]),
    }) as unknown as AbstractCanvas2D;
    const shape = Object.create(TrainIconShape.prototype) as TrainIconShape;
    shape.paintVertexShape(canvas, 10, 20, 60, 30);
    const text = calls.find((c) => c[0] === 'text');
    expect(text?.slice(1, 8)).toEqual([40, 35, 56, 12, 'ETCS L2', 'center', 'middle']);
    expect(calls.map((c) => c[0])).not.toContain('drawString');
  });

  it('renders an ertms-train cell into the SVG with its label', () => {
    registerErtmsShapeClasses();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const graph = new Graph(container);
    const errors: unknown[] = [];
    const origError = console.error;
    console.error = (...args: unknown[]) => errors.push(args);
    try {
      graph.batchUpdate(() => {
        graph.insertVertex({ parent: graph.getDefaultParent(), position: [10, 10], size: [80, 30], style: { shape: 'ertms-train' } });
      });
    } finally {
      console.error = origError;
    }
    expect(errors).toEqual([]);
    expect(container.textContent).toContain('ETCS L2');
    graph.destroy();
    container.remove();
  });
});
