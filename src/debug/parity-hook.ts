/**
 * @file parity-hook.ts
 * @brief `window.__rdParity`: renders a draw.io model to a PNG with the app's renderer, for the
 *        visual parity harness (tests/e2e/drawio-parity.spec.ts).
 *
 * Installed only in dev builds (the Playwright web server) or with `?parity=1`. Rendering uses the
 * palette's hidden maxGraph graph (draw.io default styles, named styles, light-dark compatibility,
 * table support, every registered draw.io shape), the same path as the palette thumbnails.
 */
import { ensureStencilsForXml } from '../drawio-shapes/engine';
import { renderEntryForParity } from '../ui/drawio-palette';
import type { PaletteEntry } from '../ui/drawio-palette';

export interface ParityRenderOptions {
  /** Drawing scale (draw.io export `scale`). */
  scale?: number;
  /** Border in unscaled px around the drawing (draw.io export `border`). */
  border?: number;
  /** Background colour; 'none' or empty = transparent. */
  background?: string;
}

export interface ParityHook {
  render(xml: string, opts?: ParityRenderOptions): Promise<string>;
}

declare global {
  interface Window {
    __rdParity?: ParityHook;
  }
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

/** Renders `<mxGraphModel>` XML to a `data:image/png;base64,...` URI. */
export async function renderXmlToPng(xml: string, opts: ParityRenderOptions = {}): Promise<string> {
  const scale = opts.scale && opts.scale > 0 ? opts.scale : 1;
  const border = Math.max(0, opts.border ?? 0) * scale;
  await ensureStencilsForXml(xml);
  const entry: PaletteEntry = {
    id: `parity-${++counter}`,
    title: '',
    kind: 'cells',
    width: 0,
    height: 0,
    xml,
    shapeNames: [],
    cls: 'd',
    source: 'parity',
  };
  const svg = await renderEntryForParity(entry, scale);
  const w = Math.max(1, parseFloat(svg.getAttribute('width') ?? '1'));
  const h = Math.max(1, parseFloat(svg.getAttribute('height') ?? '1'));
  svg.removeAttribute('class');
  svg.removeAttribute('style');
  const markup = new XMLSerializer().serializeToString(svg);
  const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`);

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w + 2 * border);
  canvas.height = Math.ceil(h + 2 * border);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D canvas context');
  const bg = opts.background;
  if (bg && bg !== 'none' && bg !== 'transparent') {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, border, border, w, h);
  return canvas.toDataURL('image/png');
}

/** Installs `window.__rdParity` in dev builds or when the page URL has `?parity=1`. */
export function installParityHook(): void {
  let enabled = import.meta.env.DEV;
  try {
    enabled ||= new URLSearchParams(window.location.search).get('parity') === '1';
  } catch {
    // no URL: keep the build-time decision
  }
  if (!enabled) return;
  window.__rdParity = { render: renderXmlToPng };
}
