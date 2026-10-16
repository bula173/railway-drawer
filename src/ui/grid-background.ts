/**
 * @file grid-background.ts
 * @brief Theme-aware canvas grid of a tab graph container.
 *
 * The grid is a transparent SVG tile drawn over the container's page color (`--rd-canvas-bg`,
 * style.css). Both tiles (light and dark grid color) are set as custom properties on the
 * container and style.css picks one by `<html data-theme>`, so a theme switch needs no
 * listener (and inactive tabs follow too). Colors as in draw.io: light grid #e0e0e0 (the app's
 * former grid), dark grid #424242 on the #121212 dark page (mxGraphView defaultDarkGridColor).
 */

export const GRID_COLOR_LIGHT = '#e0e0e0';
export const GRID_COLOR_DARK = '#424242';

/** `data:` URL of one grid cell (lines on the top and left edge, transparent elsewhere). */
export function gridTileUrl(color: string, size: number): string {
  const s = Math.max(1, Math.round(size));
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">` +
    `<path d="M ${s} 0 L 0 0 0 ${s}" fill="none" stroke="${color}" stroke-width="0.5"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Shows (or hides) the grid of `container` with cells of `size` px in both themes. */
export function applyGridBackground(container: HTMLElement | null | undefined, size: number, enabled: boolean): void {
  if (!container) return;
  // No inline background-image: it would override the theme's tile (style.css .rd-grid-on)
  container.style.backgroundImage = '';
  container.classList.toggle('rd-grid-on', enabled);
  if (!enabled) return;
  container.style.setProperty('--rd-grid-image-light', `url("${gridTileUrl(GRID_COLOR_LIGHT, size)}")`);
  container.style.setProperty('--rd-grid-image-dark', `url("${gridTileUrl(GRID_COLOR_DARK, size)}")`);
  container.style.backgroundSize = `${size}px ${size}px`;
  container.style.backgroundRepeat = 'repeat';
  container.style.backgroundPosition = '0 0';
}
