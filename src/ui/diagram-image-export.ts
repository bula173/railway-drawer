/**
 * @file diagram-image-export.ts
 * @brief PNG/SVG images of a draw.io model, rendered like draw.io's export (Graph.getSvg layout,
 *        Editor.exportToCanvas rasterizing), with the palette's hidden maxGraph graph (draw.io
 *        default styles, named styles, light-dark compatibility, tables, every draw.io shape).
 *
 * Used by File > Export as PNG/SVG (export-image.ts), the Share dialog's "Export PNG/SVG", the
 * scenario exports and the visual parity harness (src/debug/parity-hook.ts). Exports render the
 * light colours on the diagram's background (white unless the model sets one), as draw.io does,
 * also while the app shows the dark theme.
 */
import { ensureStencilsForXml } from '../drawio-shapes/engine';
import { renderEntryForParity } from './drawio-palette';
import type { PaletteEntry } from './drawio-palette';

export interface ImageRenderOptions {
  /** Drawing scale (draw.io export `scale`). */
  scale?: number;
  /** Border in unscaled px around the drawing (draw.io export `border`). */
  border?: number;
  /** Background colour; 'none' or empty = transparent. */
  background?: string;
}

const DEFAULT_BACKGROUND = '#ffffff';

/**
 * The page background of a `<mxGraphModel>` (draw.io's `background` attribute) when it is a colour,
 * else white: draw.io exports without "Transparent background" on the page colour, white by default.
 */
export function modelBackground(modelXml: string): string {
  const tag = /<mxGraphModel\b[^>]*>/.exec(modelXml)?.[0] ?? '';
  const value = /\sbackground="([^"]*)"/.exec(tag)?.[1]?.trim() ?? '';
  if (!value || value === 'none' || value === 'transparent') return DEFAULT_BACKGROUND;
  return /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|rgba?\([\d\s.,%]+\))$/.test(value) ? value : DEFAULT_BACKGROUND;
}

let counter = 0;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The rendered SVG could not be loaded as an image'));
    img.src = url;
  });
}

/** Renders `<mxGraphModel>` XML to the SVG that `renderXmlToPng` rasterizes (draw.io getSvg layout). */
export async function renderXmlToSvg(xml: string, opts: ImageRenderOptions = {}): Promise<SVGSVGElement> {
  const scale = opts.scale && opts.scale > 0 ? opts.scale : 1;
  const border = Math.max(0, opts.border ?? 0);
  await ensureStencilsForXml(xml);
  const entry: PaletteEntry = {
    id: `image-export-${++counter}`,
    title: '',
    kind: 'cells',
    width: 0,
    height: 0,
    xml,
    shapeNames: [],
    cls: 'd',
    source: 'image-export',
  };
  // Same pipeline as draw.io's PNG export (jgraph/drawio v32.4.1 Editor.exportToCanvas +
  // Graph.getSvg): an SVG at scale 1 with the border inside, rasterized with ctx.scale(scale).
  const svg = await renderEntryForParity(entry, scale, { exportLayout: true, border, light: true });
  svg.removeAttribute('class');
  svg.setAttribute('style', '-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;');
  return svg;
}

/** Renders `<mxGraphModel>` XML to a `data:image/png;base64,...` URI. */
export async function renderXmlToPng(xml: string, opts: ImageRenderOptions = {}): Promise<string> {
  const scale = opts.scale && opts.scale > 0 ? opts.scale : 1;
  const svg = await renderXmlToSvg(xml, opts);
  const w = Math.max(1, parseFloat(svg.getAttribute('width') ?? '1'));
  const h = Math.max(1, parseFloat(svg.getAttribute('height') ?? '1'));
  const markup = new XMLSerializer().serializeToString(svg);
  const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`);

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * scale);
  canvas.height = Math.ceil(h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D canvas context');
  const bg = opts.background;
  if (bg && bg !== 'none' && bg !== 'transparent') {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (scale !== 1) ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/png');
}

/** Model XML without the trailing comments (PlantUML metadata) the renderer does not need. */
export function stripModelComments(modelXml: string): string {
  return modelXml.replace(/(\s*<!--[\s\S]*?-->)+\s*$/, '');
}

/** `<mxGraphModel>` XML as a standalone SVG document (on the model's background, white by default; `background: 'none'` = transparent). */
export async function renderXmlToSvgDocument(xml: string, opts: ImageRenderOptions = {}): Promise<string> {
  const svg = await renderXmlToSvg(stripModelComments(xml), { border: 10, ...opts });
  const bg = opts.background ?? modelBackground(xml);
  if (bg && bg !== 'none' && bg !== 'transparent') svg.style.backgroundColor = bg;
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg);
}

/** `<mxGraphModel>` XML as a PNG blob (scale 2, on the model's background, white by default). */
export async function renderXmlToPngBlob(xml: string, opts: ImageRenderOptions = {}): Promise<Blob> {
  const dataUrl = await renderXmlToPng(stripModelComments(xml), { scale: 2, border: 10, background: modelBackground(xml), ...opts });
  const res = await fetch(dataUrl);
  return res.blob();
}
