/**
 * @file thumbnail-renderer.ts
 * @brief Renders palette entries to SVG with a single hidden maxGraph graph, the way draw.io's
 *        Sidebar.createThumb does: add the cells, fit them into the thumb (minus the border),
 *        clone the SVG, clear the model.
 */
import { Graph, Rectangle, Shape } from '@maxgraph/core';
import { configureDiagramRendering } from '../diagram-graph-setup';
import { drawioColorModeKey, setGraphColorMode } from '../../drawio-shapes/engine/graph-compat';
import type { PaletteEngine, PaletteEntry } from './contracts';
import { createCellsForEntry, entryStyles } from './entry-cells';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** draw.io Sidebar.thumbBorder. */
export const THUMB_BORDER = 2;
/** Thumb box (draw.io: thumbWidth/thumbHeight 36 with border 2, i.e. a 32px drawing). */
export const THUMB_SIZE = 36;

export interface RenderOptions {
  /** Fit into this box (keeping aspect), like createThumb. */
  width?: number;
  height?: number;
  /** Fixed scale instead of fitting; the SVG is sized to the drawing plus the border. */
  scale?: number;
  /** Border in px around the drawing (default THUMB_BORDER). */
  border?: number;
  /** Fit, but never enlarge beyond scale 1 (hover previews). */
  maxScale?: number;
  /**
   * draw.io export layout (Graph.getSvg + Editor.exportToCanvas, v32.4.1): render at view scale 1
   * with the translate floored at this output scale; the caller rasterizes the SVG scaled by it.
   */
  exportScale?: number;
  /**
   * Light rendering whatever the app theme (image exports: draw.io exports the light colours
   * unless asked for a dark export); the hidden graph follows the theme again afterwards.
   */
  light?: boolean;
}

/**
 * The live graph references in-document ids through the page URL (maxGraph/draw.io getBaseUrl,
 * e.g. curvedText's `<textPath href="http://host/#ctp-1">`). A standalone copy of the SVG (an
 * `<img>` or a data URI) cannot resolve those, so they become plain `#id` references.
 */
function localizeFragmentRefs(svg: SVGSVGElement): void {
  const XLINK = 'http://www.w3.org/1999/xlink';
  for (const el of Array.from(svg.querySelectorAll('textPath, use, image, a, pattern, linearGradient, radialGradient, filter, mpath'))) {
    for (const [ns, name] of [[null, 'href'], [XLINK, 'href']] as const) {
      const value = ns ? el.getAttributeNS(ns, name) : el.getAttribute(name);
      if (!value || value.startsWith('#') || value.startsWith('data:')) continue;
      const hash = value.indexOf('#');
      if (hash < 0) continue;
      const id = value.substring(hash + 1);
      if (!svg.querySelector(`[id="${id.replace(/["\\]/g, '\\$&')}"]`)) continue;
      if (ns) el.setAttributeNS(ns, 'xlink:href', `#${id}`);
      else el.setAttribute(name, `#${id}`);
    }
  }
}

/**
 * draw.io mxImageExport.getSvgShapeOffset (v32.4.1): the crisp half-pixel offset of a shape in
 * the export. Unlike the screen offset (Shape.getSvgScreenOffset, which treats every shape as
 * at least a 1px stroke), shapes without a stroke (strokeColor=none or strokeWidth=0) get no
 * offset; shape-specific overrides (text, images, ...) are used unchanged.
 * `outputScale` is the canvas scale of the SVG export (1 for PNG export, see exportToCanvas).
 */
export function exportShapeOffset(shape: Shape, outputScale = 1): number {
  if (shape.getSvgScreenOffset !== Shape.prototype.getSvgScreenOffset) return shape.getSvgScreenOffset();
  const stencilSw = shape.stencil?.strokeWidthValue;
  const sw = shape.stencil && stencilSw !== 'inherit' ? Number(stencilSw) : (shape.strokeWidth ?? 0);
  const stroke = shape.stroke as string | null | undefined;
  const hasStroke = stroke != null && stroke !== '' && stroke !== 'none';
  const scale = shape.scale * outputScale;
  return hasStroke && sw > 0 && Math.max(1, Math.round(sw * scale)) % 2 === 1 ? 0.5 : 0;
}

/** Re-applies the shapes' crisp offsets the way draw.io's export paints them (exportShapeOffset). */
export function applyExportShapeOffsets(graph: Graph): void {
  graph.view.states.visit((_key, state) => {
    const shape = state?.shape;
    const node = shape?.node;
    if (!shape || !node) return;
    const off = exportShapeOffset(shape);
    if (off !== 0) node.setAttribute('transform', `translate(${off},${off})`);
    else node.removeAttribute('transform');
  });
}

/**
 * draw.io Graph.getSvg (v32.4.1, Graph.js:28100-28145): the graph bounds extended by each shape's
 * bounding box moved by its export crisp offset (odd stroke widths), so that the export does not
 * clip the right and bottom edge. View scale 1.
 */
export function exportBounds(graph: Graph, bounds: Rectangle): Rectangle {
  let extended: Rectangle | null = null;
  graph.view.states.visit((_key, state) => {
    const shape = state?.shape;
    const bb = shape?.boundingBox;
    if (!shape || !bb) return;
    const off = exportShapeOffset(shape);
    if (off === 0) return;
    extended ??= bounds.clone();
    extended.add(new Rectangle(bb.x + off, bb.y + off, bb.width, bb.height));
  });
  return extended ?? bounds;
}

export class ThumbnailRenderer {
  private graph: Graph | null = null;
  private host: HTMLElement | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private cache = new Map<string, Promise<SVGSVGElement>>();

  constructor(private engine: PaletteEngine) {}

  /** Drops the cached thumbnails of one entry id (e.g. a deleted user template). */
  forget(entryId: string): void {
    for (const key of [...this.cache.keys()]) if (key.startsWith(`${entryId}@`)) this.cache.delete(key);
  }

  setEngine(engine: PaletteEngine): void {
    if (engine === this.engine) return;
    this.engine = engine;
    this.cache.clear();
    this.disposeGraph();
  }

  /**
   * Cached thumbnail (a fresh clone each call), keyed by entry id, box size (default square) and
   * the colour mode: thumbnails follow the app theme like the canvas (dark rendering in dark mode).
   */
  thumbnail(entry: PaletteEntry, size = THUMB_SIZE, height = size): Promise<SVGSVGElement> {
    const mode = drawioColorModeKey();
    const key = (height === size ? `${entry.id}@${size}` : `${entry.id}@${size}x${height}`) + (mode ? `@${mode}` : '');
    let pending = this.cache.get(key);
    if (!pending) {
      pending = this.render(entry, { width: size, height });
      pending.catch(() => this.cache.delete(key));
      this.cache.set(key, pending);
    }
    return pending.then((svg) => svg.cloneNode(true) as SVGSVGElement);
  }

  /** Renders one entry; calls are serialized because they share the hidden graph. */
  render(entry: PaletteEntry, opts: RenderOptions = {}): Promise<SVGSVGElement> {
    const run = async (): Promise<SVGSVGElement> => {
      await this.engine.ensureStencilsForXml(entryStyles(entry));
      return this.renderNow(entry, opts);
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private ensureGraph(): Graph {
    if (this.graph) return this.graph;
    const host = document.createElement('div');
    host.className = 'rd-drawio-palette-offscreen';
    host.setAttribute('aria-hidden', 'true');
    Object.assign(host.style, {
      position: 'absolute',
      left: '-10000px',
      top: '-10000px',
      width: '400px',
      height: '400px',
      overflow: 'hidden',
      visibility: 'hidden',
      pointerEvents: 'none',
    });
    document.body.appendChild(host);
    const graph = new Graph(host);
    graph.setEnabled(false);
    graph.setTooltips(false);
    graph.gridEnabled = false;
    // the same rendering setup as every tab graph (draw.io styles, UserObject labels, light-dark(),
    // sanitized HTML labels as the outermost getLabel wrapper, edge styles, tables)
    configureDiagramRendering(graph);
    this.host = host;
    this.graph = graph;
    return graph;
  }

  private renderNow(entry: PaletteEntry, opts: RenderOptions): SVGSVGElement {
    const graph = this.ensureGraph();
    const model = graph.getDataModel();
    const view = graph.view;
    const border = opts.border ?? THUMB_BORDER;
    if (opts.light) setGraphColorMode(graph, false);
    try {
      view.scaleAndTranslate(opts.scale ?? 1, 0, 0);
      const cells = createCellsForEntry(entry);
      graph.addCells(cells, graph.getDefaultParent(), null, null, null);
      const bounds = graph.getGraphBounds().clone();
      // Union with the geometry: shapes measured via getBBox can report less (e.g. no layout yet)
      const geo = graph.getBoundingBoxFromGeometry(cells, true);
      if (geo) {
        const s0 = view.scale;
        const scaled = new Rectangle(geo.x * s0, geo.y * s0, geo.width * s0, geo.height * s0);
        if (bounds.width > 0 || bounds.height > 0) bounds.add(scaled);
        else bounds.setRect(scaled.x, scaled.y, scaled.width, scaled.height);
      }
      const bw = Math.max(bounds.width, 1);
      const bh = Math.max(bounds.height, 1);

      let width: number;
      let height: number;
      if (opts.exportScale != null) {
        // Editor.exportToCanvas calls Graph.getSvg with scale 1 (the output scale is applied only
        // when rasterizing), so getSvg's translate floor(border / scale - bounds.x) is in whole
        // units: the cells land on integer coordinates and the border is not divided by the
        // output scale. A fractional translate would put foreignObject labels on half pixels,
        // which Chrome snaps to whole CSS pixels (1 output px off at scale 2).
        // Graph.js:28100-28150: bounds extended by the half-pixel crisp offset of odd strokes.
        const ext = exportBounds(graph, bounds);
        width = Math.max(1, Math.ceil(ext.width) + 2 * border);
        height = Math.max(1, Math.ceil(ext.height) + 2 * border);
        const dx = Math.floor(Math.round((border - ext.x) * 1e6) / 1e6);
        const dy = Math.floor(Math.round((border - ext.y) * 1e6) / 1e6);
        view.scaleAndTranslate(1, dx, dy);
        applyExportShapeOffsets(graph);
      } else if (opts.scale != null) {
        const s = opts.scale;
        // bounds are at scale s here; translate is in unscaled units
        width = Math.ceil(bw + 2 * border);
        height = Math.ceil(bh + 2 * border);
        view.scaleAndTranslate(s, border / s - bounds.x / s, border / s - bounds.y / s);
      } else {
        width = opts.width ?? THUMB_SIZE;
        height = opts.height ?? THUMB_SIZE;
        let s = Math.floor(Math.min((width - 2 * border) / bw, (height - 2 * border) / bh) * 100) / 100;
        if (opts.maxScale != null) s = Math.min(s, opts.maxScale);
        if (!(s > 0)) s = 0.01;
        if (opts.maxScale != null) {
          // previews shrink the box to the drawing
          width = Math.ceil(bw * s + 2 * border);
          height = Math.ceil(bh * s + 2 * border);
        }
        view.scaleAndTranslate(s, (width - bw * s) / 2 / s - bounds.x, (height - bh * s) / 2 / s - bounds.y);
      }

      const canvas = view.getCanvas() as SVGElement | HTMLElement | null;
      const source = canvas && 'ownerSVGElement' in canvas ? canvas.ownerSVGElement : null;
      const svg = source ? (source.cloneNode(true) as SVGSVGElement) : (document.createElementNS(SVG_NS, 'svg') as SVGSVGElement);
      svg.removeAttribute('id');
      localizeFragmentRefs(svg);
      svg.setAttribute('xmlns', SVG_NS);
      svg.setAttribute('width', String(width));
      svg.setAttribute('height', String(height));
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      svg.setAttribute('class', 'rd-drawio-thumb-svg');
      svg.style.cssText = `width:${width}px;height:${height}px;overflow:hidden;pointer-events:none;`;
      return svg;
    } finally {
      model.clear();
      view.scaleAndTranslate(1, 0, 0);
      if (opts.light) setGraphColorMode(graph, null);
    }
  }

  private disposeGraph(): void {
    this.graph?.destroy();
    this.host?.remove();
    this.graph = null;
    this.host = null;
  }

  destroy(): void {
    this.disposeGraph();
    this.cache.clear();
  }
}
