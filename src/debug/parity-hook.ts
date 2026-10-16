/**
 * @file parity-hook.ts
 * @brief `window.__rdParity`: renders a draw.io model to a PNG with the app's renderer, for the
 *        visual parity harness (tests/e2e/drawio-parity.spec.ts).
 *
 * Installed only in dev builds (the Playwright web server) or with `?parity=1`. Rendering uses the
 * palette's hidden maxGraph graph (draw.io default styles, named styles, light-dark compatibility,
 * table support, every registered draw.io shape), the same path as the palette thumbnails.
 */
import { renderXmlToPng, renderXmlToSvg } from '../ui/diagram-image-export';
import type { ImageRenderOptions } from '../ui/diagram-image-export';

export type ParityRenderOptions = ImageRenderOptions;

export interface ParityHook {
  render(xml: string, opts?: ParityRenderOptions): Promise<string>;
  /** Debugging: the serialized SVG that `render` rasterizes. */
  svg(xml: string, opts?: ParityRenderOptions): Promise<string>;
}

declare global {
  interface Window {
    __rdParity?: ParityHook;
  }
}

/** Renders `<mxGraphModel>` XML to a `data:image/png;base64,...` URI. */
export { renderXmlToPng };

/** Installs `window.__rdParity` in dev builds or when the page URL has `?parity=1`. */
export function installParityHook(): void {
  let enabled = import.meta.env.DEV;
  try {
    enabled ||= new URLSearchParams(window.location.search).get('parity') === '1';
  } catch {
    // no URL: keep the build-time decision
  }
  if (!enabled) return;
  window.__rdParity = {
    render: renderXmlToPng,
    svg: async (xml, opts) => new XMLSerializer().serializeToString(await renderXmlToSvg(xml, opts)),
  };
}
