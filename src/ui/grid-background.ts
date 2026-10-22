/**
 * @file grid-background.ts
 * @brief Theme-aware canvas grid of a tab graph container.
 *
 * The grid is a transparent SVG tile drawn over the container's page color (`--rd-canvas-bg`,
 * style.css). Both tiles (light and dark grid color) are set as custom properties on the
 * container and style.css picks one by `<html data-theme>`, so a theme switch needs no
 * listener (and inactive tabs follow too). Colors as in draw.io: light grid #e0e0e0 (the app's
 * former grid), dark grid #424242 on the #121212 dark page (mxGraphView defaultDarkGridColor).
 *
 * The tab graph div is the scroll container (canvas-scroll.ts) and its background scrolls with
 * the content (`background-attachment: local`), so the grid covers the whole scrollable area.
 * canvas-scroll.ts reports the view (setGridView): the cells follow the zoom (doubled while
 * smaller than MIN_GRID_TILE px, like draw.io) and start at the graph origin (the translate).
 * One background tile holds several cells (at least TILE_MIN_PX wide) and its size is a whole
 * number of 1/64 px (Chromium's layout unit): the browser tiles the background from the scroll
 * origin, so the rounding error of one tile adds up over the tiles before the visible area; per
 * cell tiles drifted visibly off the graph's grid (snapped shapes) far from the origin.
 */

export const GRID_COLOR_LIGHT = '#e0e0e0';
export const GRID_COLOR_DARK = '#424242';
/** Smallest grid cell drawn on screen (px): smaller cells are doubled. */
export const MIN_GRID_TILE = 5;
/** Smallest background tile (px): it holds as many grid cells as needed to reach this size. */
const TILE_MIN_PX = 256;
/** Background sizes and positions are whole multiples of this (Chromium's layout unit). */
const LAYOUT_UNIT = 64;

interface GridSettings {
  size: number;
  enabled: boolean;
}

interface GridView {
  scale: number;
  /** Screen px of the graph origin from the container's scroll origin. */
  originX: number;
  originY: number;
}

const SETTINGS = new WeakMap<HTMLElement, GridSettings>();
const VIEWS = new WeakMap<HTMLElement, GridView>();

/**
 * `data:` URL of a grid tile of `size` px holding `cells` x `cells` grid cells (each with lines on
 * its top and left edge, transparent elsewhere).
 */
export function gridTileUrl(color: string, size: number, cells: number = 1): string {
  const s = Math.max(1, Math.round(size * 1000) / 1000);
  const n = Math.max(1, Math.floor(cells));
  let d = '';
  for (let i = 0; i < n; i++) {
    const at = Math.round((s * i / n) * 1000) / 1000;
    d += `M ${at} 0 V ${s} M 0 ${at} H ${s} `;
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">` +
    `<path d="${d.trim()}" fill="none" stroke="${color}" stroke-width="0.5"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Screen size of one grid cell at `scale` (doubled up to MIN_GRID_TILE px). */
export function gridCellSize(size: number, scale: number): number {
  let tile = size * (scale > 0 ? scale : 1);
  if (!(tile > 0)) return size;
  while (tile < MIN_GRID_TILE) tile *= 2;
  return tile;
}

function toLayoutUnit(value: number): number {
  return Math.round(value * LAYOUT_UNIT) / LAYOUT_UNIT;
}

function mod(value: number, m: number): number {
  return toLayoutUnit(((value % m) + m) % m);
}

function paint(container: HTMLElement, size: number): void {
  const view = VIEWS.get(container) ?? { scale: 1, originX: 0, originY: 0 };
  const cell = gridCellSize(size, view.scale);
  const cells = Math.max(1, Math.ceil(TILE_MIN_PX / cell));
  const tile = toLayoutUnit(cell * cells);
  container.style.setProperty('--rd-grid-image-light', `url("${gridTileUrl(GRID_COLOR_LIGHT, tile, cells)}")`);
  container.style.setProperty('--rd-grid-image-dark', `url("${gridTileUrl(GRID_COLOR_DARK, tile, cells)}")`);
  container.style.backgroundSize = `${tile}px ${tile}px`;
  container.style.backgroundRepeat = 'repeat';
  container.style.backgroundPosition = `${mod(view.originX, tile)}px ${mod(view.originY, tile)}px`;
}

/** Shows (or hides) the grid of `container` with cells of `size` graph units in both themes. */
export function applyGridBackground(container: HTMLElement | null | undefined, size: number, enabled: boolean): void {
  if (!container) return;
  // No inline background-image: it would override the theme's tile (style.css .rd-grid-on)
  container.style.backgroundImage = '';
  container.classList.toggle('rd-grid-on', enabled);
  SETTINGS.set(container, { size, enabled });
  if (!enabled) return;
  paint(container, size);
}

/** The view of `container`'s graph changed (zoom, translate): the grid follows it. */
export function setGridView(container: HTMLElement | null | undefined, scale: number, originX: number, originY: number): void {
  if (!container) return;
  const previous = VIEWS.get(container);
  if (previous && previous.scale === scale && previous.originX === originX && previous.originY === originY) return;
  VIEWS.set(container, { scale, originX, originY });
  const settings = SETTINGS.get(container);
  if (settings?.enabled) paint(container, settings.size);
}
