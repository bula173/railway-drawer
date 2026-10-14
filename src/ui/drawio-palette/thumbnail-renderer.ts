/**
 * @file thumbnail-renderer.ts
 * @brief Renders palette entries to SVG with a single hidden maxGraph graph, the way draw.io's
 *        Sidebar.createThumb does: add the cells, fit them into the thumb (minus the border),
 *        clone the SVG, clear the model.
 */
import { Graph, Rectangle } from '@maxgraph/core';
import { installUserObjectLabels, registerDrawioNamedStyles } from '../../services/drawio-xml';
import { installTableSupport } from '../../drawio-shapes/js/shapes-edges';
import { installDrawioHtmlLabels } from '../../drawio-shapes/engine/html-labels';
import { installDanglingEdgeStyles, installInheritStyleValues } from '../../drawio-shapes/engine/view-fixes';
import type { PaletteEngine, PaletteEntry } from './contracts';
import { applyDrawioDefaultStyles, createCellsForEntry, entryStyles } from './entry-cells';

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

export class ThumbnailRenderer {
  private graph: Graph | null = null;
  private host: HTMLElement | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private cache = new Map<string, Promise<SVGSVGElement>>();

  constructor(private engine: PaletteEngine) {}

  setEngine(engine: PaletteEngine): void {
    if (engine === this.engine) return;
    this.engine = engine;
    this.cache.clear();
    this.disposeGraph();
  }

  /** Cached thumbnail (a fresh clone each call), keyed by entry id and size. */
  thumbnail(entry: PaletteEntry, size = THUMB_SIZE): Promise<SVGSVGElement> {
    const key = `${entry.id}@${size}`;
    let pending = this.cache.get(key);
    if (!pending) {
      pending = this.render(entry, { width: size, height: size });
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
    const stylesheet = graph.getStylesheet();
    applyDrawioDefaultStyles(stylesheet);
    registerDrawioNamedStyles(stylesheet);
    installUserObjectLabels(graph);
    this.engine.installDrawioCompat(graph);
    // html=1 labels as (sanitized) HTML, as in draw.io
    installDrawioHtmlLabels(graph);
    installDanglingEdgeStyles(graph);
    installInheritStyleValues(graph);
    // Tables, lists and cross-functional flowcharts (layout, startSize, collapsed rendering)
    installTableSupport(graph);
    this.host = host;
    this.graph = graph;
    return graph;
  }

  private renderNow(entry: PaletteEntry, opts: RenderOptions): SVGSVGElement {
    const graph = this.ensureGraph();
    const model = graph.getDataModel();
    const view = graph.view;
    const border = opts.border ?? THUMB_BORDER;
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
        // Graph.js:28147-28191: w = ceil(bounds.width * s) + 2 * border (s = 1 here), translate
        // floored at the output scale so content moves by whole output pixels.
        const out = opts.exportScale > 0 ? opts.exportScale : 1;
        width = Math.max(1, Math.ceil(bw) + 2 * border);
        height = Math.max(1, Math.ceil(bh) + 2 * border);
        const dx = Math.floor(Math.round((border / out - bounds.x) * out * 1e6) / 1e6) / out;
        const dy = Math.floor(Math.round((border / out - bounds.y) * out * 1e6) / 1e6) / out;
        view.scaleAndTranslate(1, dx, dy);
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
