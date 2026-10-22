/**
 * @file canvas-scroll.ts
 * @brief draw.io-like scrolling canvas of a tab graph.
 *
 * The tab's graph div is the scroll container (style.css `.rd-graph-canvas`: overflow auto), so
 * maxGraph's own scrolling (scrollCellToVisible, autoscroll while dragging, panning) moves it.
 * Like draw.io's infinite canvas (Graph.getPagePadding / EditorUi sizeDidChange /
 * Graph.scrollTileSize, page view off):
 * - the scrollable extent is the content rounded out to 400 px tiles plus almost one visible
 *   container size of padding on every side, so the drawing can always be scrolled some way
 *   beyond its content, also left of and above the origin;
 * - the view translate is set automatically (padding minus the first tile), so content at
 *   negative coordinates is reachable; translate changes are compensated by the scroll position,
 *   so nothing jumps on screen;
 * - zoom keeps the point in focus: buttons, menu, keys and the zoom select zoom around the view
 *   centre (a plain `graph.zoomTo(s)` keeps the top-left corner, maxGraph's default),
 *   Ctrl/Cmd+wheel and trackpad pinch around the pointer; Fit and Actual Size centre the
 *   content; a plain wheel scrolls (native), Shift+wheel scrolls horizontally.
 * The grid (grid-background.ts) follows the zoom and the translate.
 * Nothing here runs when the container does not scroll (unit tests without the stylesheet).
 */
import { Client, InternalEvent, Rectangle } from '@maxgraph/core';
import type { EventSource, Graph } from '@maxgraph/core';
import { setGridView } from './grid-background';

/** draw.io Graph.scrollTileSize (page view off): the extent grows in steps of this many graph units. */
export const SCROLL_TILE = 400;
/** draw.io getPagePadding: the padding is the visible size minus this many px. */
const PADDING_INSET = 34;
/** Zoom range of all zoom commands (10 % .. 500 %). */
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5;
/** Screen px kept between the content and the view edge when the view is reset to the content. */
const VIEW_MARGIN = 20;
/** Zoom per wheel notch (and the most one wheel event zooms), like the zoom buttons. */
const WHEEL_ZOOM_STEP = 1.2;

interface ScrollState {
  autoTranslate: boolean;
  /** The view is reset (resetCanvasScroll) when the container gets a size again. */
  needsReset: boolean;
  /** Last scroll position while shown (a hidden tab's div reads 0). */
  lastLeft: number;
  lastTop: number;
  shown: boolean;
  frame: number;
  cleanups: Array<() => void>;
}

const STATES = new WeakMap<Graph, ScrollState>();

export function clampZoom(scale: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
}

/** Whether `graph`'s container is a scroll container with a size (shown, stylesheet loaded). */
export function isScrollableCanvas(graph: Graph): boolean {
  const c = graph.container;
  if (!c || typeof getComputedStyle !== 'function') return false;
  const overflow = getComputedStyle(c).overflow;
  return overflow.includes('auto') || overflow.includes('scroll');
}

function isShown(c: HTMLElement): boolean {
  return c.clientWidth > 0 && c.clientHeight > 0;
}

/** draw.io Graph.getPagePadding: graph units of space around the content tiles. */
export function getPagePadding(graph: Graph): { x: number; y: number } {
  const c = graph.container;
  const s = graph.view.scale;
  return {
    x: Math.max(0, Math.round((c.clientWidth - PADDING_INSET) / s)),
    y: Math.max(0, Math.round((c.clientHeight - PADDING_INSET) / s)),
  };
}

/** draw.io Graph.getPageLayout: the content's tiles (tile units, graph coordinates). */
export function getPageLayout(graph: Graph): Rectangle {
  const bounds = graph.getGraphBounds();
  if (bounds.width === 0 || bounds.height === 0) return new Rectangle(0, 0, 1, 1);
  const { scale: s, translate: t } = graph.view;
  const x0 = Math.floor(Math.ceil(bounds.x / s - t.x) / SCROLL_TILE);
  const y0 = Math.floor(Math.ceil(bounds.y / s - t.y) / SCROLL_TILE);
  const w0 = Math.ceil((Math.floor((bounds.x + bounds.width) / s) - t.x) / SCROLL_TILE) - x0;
  const h0 = Math.ceil((Math.floor((bounds.y + bounds.height) / s) - t.y) / SCROLL_TILE) - y0;
  return new Rectangle(x0, y0, Math.max(1, w0), Math.max(1, h0));
}

/**
 * Zooms to `scale` keeping the graph point under (`focusX`, `focusY`) (px from the container's
 * top-left, default the view centre) where it is on screen.
 */
export function zoomCanvasAt(graph: Graph, scale: number, focusX?: number, focusY?: number): void {
  const c = graph.container;
  const view = graph.view;
  const next = clampZoom(scale);
  if (next === view.scale) return;
  if (!isScrollableCanvas(graph) || !isShown(c)) {
    view.setScale(next);
    return;
  }
  const fx = focusX ?? c.clientWidth / 2;
  const fy = focusY ?? c.clientHeight / 2;
  const s0 = view.scale;
  const gx = (c.scrollLeft + fx) / s0 - view.translate.x;
  const gy = (c.scrollTop + fy) / s0 - view.translate.y;
  // setScale revalidates and runs sizeDidChange (new extent, maybe a new translate)
  view.setScale(next);
  const t = view.translate;
  c.scrollLeft = Math.round((gx + t.x) * next - fx);
  c.scrollTop = Math.round((gy + t.y) * next - fy);
}

/**
 * Shows the drawing like a freshly opened file: the origin at the top-left corner (as before
 * scrolling existed), or the content's top-left corner (with a margin) when it lies left of or
 * above the origin. A hidden tab is reset when it is shown.
 */
export function resetCanvasScroll(graph: Graph): void {
  const c = graph.container;
  const state = STATES.get(graph);
  if (!state || !isScrollableCanvas(graph)) return;
  if (!isShown(c)) {
    state.needsReset = true;
    return;
  }
  state.needsReset = false;
  graph.sizeDidChange();
  const { scale: s, translate: t } = graph.view;
  const bounds = graph.getGraphBounds();
  let gx = 0;
  let gy = 0;
  if (bounds.width > 0 || bounds.height > 0) {
    gx = Math.min(0, bounds.x / s - t.x - VIEW_MARGIN / s);
    gy = Math.min(0, bounds.y / s - t.y - VIEW_MARGIN / s);
  }
  c.scrollLeft = Math.round((gx + t.x) * s);
  c.scrollTop = Math.round((gy + t.y) * s);
  rememberScroll(graph);
}

/** Centres the content in the view (top-left with a margin along an axis it does not fit). */
export function centerCanvasContent(graph: Graph): void {
  const c = graph.container;
  if (!isScrollableCanvas(graph)) return;
  const bounds = graph.getGraphBounds();
  if (!isShown(c) || (bounds.width === 0 && bounds.height === 0)) {
    resetCanvasScroll(graph);
    return;
  }
  const cw = c.clientWidth;
  const ch = c.clientHeight;
  c.scrollLeft = Math.round(bounds.width <= cw ? bounds.x + bounds.width / 2 - cw / 2 : bounds.x - VIEW_MARGIN);
  c.scrollTop = Math.round(bounds.height <= ch ? bounds.y + bounds.height / 2 - ch / 2 : bounds.y - VIEW_MARGIN);
  rememberScroll(graph);
}

/** Scrolls the selection into view (after an arrow-key nudge moved it to the view's edge). */
export function scrollSelectionIntoView(graph: Graph): void {
  if (!isScrollableCanvas(graph)) return;
  const cells = graph.getSelectionCells();
  if (cells.length === 0) return;
  const bounds = graph.view.getBounds(cells);
  if (!bounds) return;
  const c = graph.container;
  const b = VIEW_MARGIN;
  if (bounds.x < c.scrollLeft + b) c.scrollLeft = Math.floor(bounds.x - b);
  else if (bounds.x + bounds.width > c.scrollLeft + c.clientWidth - b) {
    c.scrollLeft = Math.ceil(Math.min(bounds.x - b, bounds.x + bounds.width + b - c.clientWidth));
  }
  if (bounds.y < c.scrollTop + b) c.scrollTop = Math.floor(bounds.y - b);
  else if (bounds.y + bounds.height > c.scrollTop + c.clientHeight - b) {
    c.scrollTop = Math.ceil(Math.min(bounds.y - b, bounds.y + bounds.height + b - c.clientHeight));
  }
}

function rememberScroll(graph: Graph): void {
  const state = STATES.get(graph);
  const c = graph.container;
  if (!state || !isShown(c)) return;
  state.lastLeft = c.scrollLeft;
  state.lastTop = c.scrollTop;
}

function syncGrid(graph: Graph): void {
  const { scale: s, translate: t } = graph.view;
  setGridView(graph.container, s, t.x * s, t.y * s);
}

/** Wheel delta in px (line and page modes converted). */
function wheelPixels(evt: WheelEvent, delta: number, page: number): number {
  if (evt.deltaMode === 1) return delta * 16;
  if (evt.deltaMode === 2) return delta * page;
  return delta;
}

export function installCanvasScroll(graph: Graph): void {
  if (STATES.has(graph)) return;
  const state: ScrollState = {
    autoTranslate: false, needsReset: true, lastLeft: 0, lastTop: 0, shown: false, frame: 0, cleanups: [],
  };
  STATES.set(graph, state);
  const c = graph.container;
  const view = graph.view;

  // draw.io EditorUi: graph.sizeDidChange keeps padding + content tiles scrollable and the
  // translate in step with them
  const origSizeDidChange = graph.sizeDidChange.bind(graph);
  graph.sizeDidChange = (): void => {
    if (!isScrollableCanvas(graph) || !isShown(c)) {
      origSizeDidChange();
      return;
    }
    const pages = getPageLayout(graph);
    const pad = getPagePadding(graph);
    const minw = Math.ceil(2 * pad.x + pages.width * SCROLL_TILE);
    const minh = Math.ceil(2 * pad.y + pages.height * SCROLL_TILE);
    const min = graph.minimumGraphSize;
    if (!min || min.width !== minw || min.height !== minh) graph.minimumGraphSize = new Rectangle(0, 0, minw, minh);
    const dx = pad.x - pages.x * SCROLL_TILE;
    const dy = pad.y - pages.y * SCROLL_TILE;
    const t = view.translate;
    if (!state.autoTranslate && (t.x !== dx || t.y !== dy)) {
      state.autoTranslate = true;
      const tx = t.x;
      const ty = t.y;
      try {
        // setTranslate revalidates and calls sizeDidChange again (the plain one: autoTranslate)
        view.setTranslate(dx, dy);
        c.scrollLeft += Math.round((dx - tx) * view.scale);
        c.scrollTop += Math.round((dy - ty) * view.scale);
      } finally {
        state.autoTranslate = false;
      }
      return;
    }
    origSizeDidChange();
  };

  // Zoom commands (menu, buttons, keys, zoom select, pinch gesture) keep the view centre
  const origZoom = graph.zoom.bind(graph);
  // maxGraph's contract: zoomIn/zoomOut (center omitted = centerZoom) keep the view centre,
  // zoomTo(scale) (center false) keeps the top-left corner of the view, zoomTo(scale, true) the centre
  graph.zoom = (factor: number, center?: boolean): void => {
    if (!isScrollableCanvas(graph)) {
      origZoom(factor, center);
      return;
    }
    const scale = Math.round(view.scale * factor * 100) / 100;
    if (center ?? graph.centerZoom) zoomCanvasAt(graph, scale);
    else zoomCanvasAt(graph, scale, 0, 0);
  };
  const origZoomActual = graph.zoomActual.bind(graph);
  graph.zoomActual = (): void => {
    if (!isScrollableCanvas(graph)) {
      origZoomActual();
      return;
    }
    if (view.scale !== 1) view.setScale(1);
    centerCanvasContent(graph);
  };
  const origFit = graph.fit.bind(graph);
  graph.fit = (border = graph.getBorder(), keepOrigin = false, margin = 0, enabled = true,
    ignoreWidth = false, ignoreHeight = false, maxHeight: number | null = null): number => {
    if (!isScrollableCanvas(graph) || keepOrigin || !enabled) {
      return origFit(border, keepOrigin, margin, enabled, ignoreWidth, ignoreHeight, maxHeight);
    }
    const bounds = graph.getGraphBounds();
    if (bounds.width > 0 && bounds.height > 0) {
      const scale = clampZoom(origFit(border, false, margin, false, ignoreWidth, ignoreHeight, maxHeight));
      if (scale !== view.scale) view.setScale(scale);
    }
    centerCanvasContent(graph);
    return view.scale;
  };

  // Ctrl/Cmd+wheel and trackpad pinch (a wheel with ctrlKey) zoom around the pointer; Shift+wheel
  // scrolls horizontally; any other wheel scrolls the container natively
  const onWheel = (evt: WheelEvent): void => {
    if (!isScrollableCanvas(graph)) return;
    if (evt.ctrlKey || evt.metaKey) {
      evt.preventDefault();
      const dy = wheelPixels(evt, evt.deltaY, c.clientHeight);
      if (dy === 0) return;
      const factor = Math.min(WHEEL_ZOOM_STEP, Math.max(1 / WHEEL_ZOOM_STEP, Math.exp(-dy / 100)));
      const rect = c.getBoundingClientRect();
      zoomCanvasAt(graph, view.scale * factor, evt.clientX - rect.left - c.clientLeft, evt.clientY - rect.top - c.clientTop);
      return;
    }
    if (evt.shiftKey && evt.deltaX === 0 && evt.deltaY !== 0) {
      evt.preventDefault();
      c.scrollLeft += wheelPixels(evt, evt.deltaY, c.clientWidth);
    }
  };
  c.addEventListener('wheel', onWheel, { passive: false });
  // Safari's trackpad pinch (gesture events instead of ctrl+wheel); on touch devices maxGraph's
  // PanningHandler pinch handles them (graph.zoomTo: around the view centre)
  let gestureScale = 0;
  const onGesture = (evt: Event): void => {
    const e = evt as Event & { scale?: number; clientX?: number; clientY?: number };
    if (Client.IS_TOUCH || !isScrollableCanvas(graph) || typeof e.scale !== 'number') return;
    evt.preventDefault();
    evt.stopPropagation();
    if (evt.type === 'gesturestart') gestureScale = view.scale;
    else if (evt.type === 'gesturechange' && gestureScale > 0) {
      const rect = c.getBoundingClientRect();
      const fx = typeof e.clientX === 'number' ? e.clientX - rect.left : undefined;
      const fy = typeof e.clientY === 'number' ? e.clientY - rect.top : undefined;
      zoomCanvasAt(graph, gestureScale * e.scale, fx, fy);
    } else gestureScale = 0;
  };
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) c.addEventListener(type, onGesture, { passive: false } as AddEventListenerOptions);

  const onScroll = (): void => rememberScroll(graph);
  c.addEventListener('scroll', onScroll, { passive: true });

  // The padding follows the container size (window, side panels); a tab shown again gets its
  // scroll position back (or its first view)
  const onResize = (): void => {
    state.frame = 0;
    const shown = isShown(c);
    const wasShown = state.shown;
    state.shown = shown;
    if (!shown || !isScrollableCanvas(graph)) return;
    if (state.needsReset) {
      resetCanvasScroll(graph);
      return;
    }
    if (!wasShown) {
      c.scrollLeft = state.lastLeft;
      c.scrollTop = state.lastTop;
    }
    graph.sizeDidChange();
    rememberScroll(graph);
  };
  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(() => {
      if (state.frame) return;
      state.frame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(onResize) : (onResize(), 0);
    });
    observer.observe(c);
    state.cleanups.push(() => observer.disconnect());
  }

  const viewSource = view as unknown as EventSource;
  const onView = (): void => syncGrid(graph);
  viewSource.addListener(InternalEvent.SCALE, onView);
  viewSource.addListener(InternalEvent.TRANSLATE, onView);
  viewSource.addListener(InternalEvent.SCALE_AND_TRANSLATE, onView);
  syncGrid(graph);

  state.cleanups.push(() => {
    c.removeEventListener('wheel', onWheel);
    for (const type of ['gesturestart', 'gesturechange', 'gestureend']) c.removeEventListener(type, onGesture);
    c.removeEventListener('scroll', onScroll);
    viewSource.removeListener(onView);
    if (state.frame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(state.frame);
  });

  state.shown = isShown(c);
  resetCanvasScroll(graph);
}

export function uninstallCanvasScroll(graph: Graph): void {
  const state = STATES.get(graph);
  if (!state) return;
  for (const fn of state.cleanups) fn();
  STATES.delete(graph);
}
