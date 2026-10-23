/**
 * @file graph-overlay.ts
 * @brief An SVG group in the graph view's overlay pane drawn in graph coordinates (it follows
 *        zoom and scroll). Not part of the model: nothing is saved or undoable. Used for the
 *        route tool's path highlight and the km ruler.
 */
import { onViewTransform } from '../core/graph-events';
import type { Graph } from '@maxgraph/core';
import type { Pt } from './geometry';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

export function pointsAttr(line: Pt[]): string {
  return line.map((p) => `${Math.round(p.x * 100) / 100},${Math.round(p.y * 100) / 100}`).join(' ');
}

export class GraphOverlay {
  readonly group: SVGGElement;
  private readonly onView = (): void => this.updateTransform();
  private readonly offView: () => void;

  constructor(
    readonly graph: Graph,
    className: string
  ) {
    this.group = svgEl('g', { class: className, 'pointer-events': 'none' });
    const pane = graph.view.getOverlayPane();
    pane?.appendChild(this.group);
    this.offView = onViewTransform(graph, this.onView);
    this.updateTransform();
  }

  updateTransform(): void {
    const s = this.graph.view.scale;
    const t = this.graph.view.translate;
    this.group.setAttribute('transform', `scale(${s}) translate(${t.x} ${t.y})`);
  }

  /** Replaces the content (children in graph coordinates). */
  set(children: SVGElement[]): void {
    this.updateTransform();
    this.group.replaceChildren(...children);
  }

  clear(): void {
    this.group.replaceChildren();
  }

  destroy(): void {
    this.offView();
    this.group.remove();
  }
}
