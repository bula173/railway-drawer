/**
 * @file hover-arrows.ts
 * @brief draw.io's connection arrows ("HoverIcons", jgraph/drawio v32.4.1 Graph.js:17568-18447 and
 *        Graph.connectVertex Graph.js:14940): four arrows around the shape under a resting pointer.
 *
 * - Shown for the cell a click would select (a group before its children, like the selection), when
 *   it is an unlocked vertex (not on a locked layer), connectable or a group, after the pointer rested
 *   on it for ACTIVATION_DELAY; never while a button is down (moves, rubber band, connections),
 *   while text is edited, with the Route tool active or in the scenario view (read-only).
 * - Click: connects to the unlocked cell lying in that direction (within TARGET_TOLERANCE of the
 *   point DEFAULT_EDGE_LENGTH beyond the side), else inserts a clone (same style/size, new ids,
 *   railway IDs renumbered: `prepareClonedCells`) DEFAULT_EDGE_LENGTH away and connects to it; the
 *   new cell is selected. One undo step (the ERTMS snap to track joins it in BEFORE_UNDO).
 *   Ctrl/Cmd: always a new clone; Shift: no clone (target, else a dangling edge); Ctrl+Shift: a
 *   clone without an edge (draw.io connectVertex). Alt hides the arrows (draw.io isResetEvent).
 * - Drag from an arrow: the connection handler starts from the cell (draw.io HoverIcons.drag):
 *   dropping on a cell connects to it (floating, or its connection point), dropping on the blank
 *   canvas inserts a connected clone there.
 * - Hovering an arrow previews the result: the target cell outlined, or a faded box where the clone
 *   will land.
 * - Hidden when the pointer leaves the shape and arrows (bbox + 10 px like draw.io) or the canvas, on
 *   scroll, selection changes, edit start and Escape; repositioned on zoom/pan/model changes. The
 *   arrows keep their screen size at any zoom (DOM elements in the graph container).
 * - View > Connection Arrows (Alt+Shift+A, draw.io's action `connectionArrows`) turns them off;
 *   localStorage `rd.connectionArrows` (default on).
 */
import {
  InternalEvent,
  Point,
  Rectangle,
  eventUtils,
  styleUtils,
  type Cell,
  type CellState,
  type ConnectionHandler,
  type Graph,
  type Geometry,
  type InternalMouseEvent,
} from '@maxgraph/core';
import { isLayer } from './cell-lock';
import { isGroupVertex } from './canvas-interaction';
import { getCellKind, isElementValue, nextFreeId, usedIds } from '../railway/object-data';
import { ID_ATTR, type KindId } from '../railway/catalogue';

export type ArrowDirection = 'north' | 'east' | 'south' | 'west';
export const ARROW_DIRECTIONS: readonly ArrowDirection[] = ['north', 'east', 'south', 'west'];

/** draw.io Graph.defaultEdgeLength: gap between the shape and its clone (graph units). */
export const DEFAULT_EDGE_LENGTH = 80;
/** draw.io connectVertex: a cell within this many (screen) px of the end point becomes the target. */
export const TARGET_TOLERANCE = 40;
/** draw.io HoverIcons.arrowSpacing */
export const ARROW_SPACING = 2;
/** draw.io HoverIcons.activationDelay: pointer rest before the arrows appear (ms). */
export const ACTIVATION_DELAY = 140;
/** draw.io HoverIcons.updateDelay: switch to another cell under the arrows' box (ms). */
export const UPDATE_DELAY = 500;
/** Opacity of an arrow the pointer is not on (draw.io: 15 %; higher here so it reads on both canvases). */
export const INACTIVE_OPACITY = 0.5;

/** Attributes a clone must not inherit: routes start at the original, railML ids are the original's. */
export const CLONE_DROPPED_ATTRS = ['rdRoutes', 'rdRailmlId', 'rdRailmlIlId', 'rdRailmlNetElements'];

// --------------------------------------------------------------------------------------------
// Setting
// --------------------------------------------------------------------------------------------

export const CONNECTION_ARROWS_KEY = 'rd.connectionArrows';
let enabledCache: boolean | null = null;
const enabledListeners = new Set<(on: boolean) => void>();

export function isConnectionArrowsEnabled(): boolean {
  if (enabledCache === null) {
    try {
      enabledCache = localStorage.getItem(CONNECTION_ARROWS_KEY) !== '0';
    } catch {
      enabledCache = true;
    }
  }
  return enabledCache;
}

export function setConnectionArrowsEnabled(on: boolean): void {
  enabledCache = on;
  try {
    localStorage.setItem(CONNECTION_ARROWS_KEY, on ? '1' : '0');
  } catch {
    // storage blocked: the choice applies for this session only
  }
  syncConnectionArrowsMenu();
  enabledListeners.forEach((listener) => listener(on));
}

export function toggleConnectionArrows(): boolean {
  setConnectionArrowsEnabled(!isConnectionArrowsEnabled());
  return isConnectionArrowsEnabled();
}

/** View > Connection Arrows check mark. */
export function syncConnectionArrowsMenu(doc: Document = document): void {
  doc.querySelectorAll('[data-action="toggleConnectionArrows"]')
    .forEach((item) => item.setAttribute('aria-checked', String(isConnectionArrowsEnabled())));
}

/** For tests: forget the cached setting (re-read from localStorage). */
export function resetConnectionArrowsSettingCache(): void {
  enabledCache = null;
}

// --------------------------------------------------------------------------------------------
// Pure placement
// --------------------------------------------------------------------------------------------

interface Box { x: number; y: number; width: number; height: number }

/** The point `length` beyond the middle of the side facing `dir` (draw.io connectVertex `pt`). */
export function connectEndPoint(geo: Box, dir: ArrowDirection, length = DEFAULT_EDGE_LENGTH): { x: number; y: number } {
  switch (dir) {
    case 'north': return { x: geo.x + geo.width / 2, y: geo.y - length };
    case 'south': return { x: geo.x + geo.width / 2, y: geo.y + geo.height + length };
    case 'west': return { x: geo.x - length, y: geo.y + geo.height / 2 };
    default: return { x: geo.x + geo.width + length, y: geo.y + geo.height / 2 };
  }
}

/** Top-left of a same-size clone `length` away from `geo` in `dir` (draw.io connectVertex). */
export function clonePosition(geo: Box, dir: ArrowDirection, length = DEFAULT_EDGE_LENGTH): { x: number; y: number } {
  const pt = connectEndPoint(geo, dir, length);
  if (dir === 'north') pt.y -= geo.height / 2;
  else if (dir === 'south') pt.y += geo.height / 2;
  else if (dir === 'west') pt.x -= geo.width / 2;
  else pt.x += geo.width / 2;
  return { x: pt.x - geo.width / 2, y: pt.y - geo.height / 2 };
}

/** What a click on an arrow does with these modifiers (draw.io connectVertex + isCloneEvent). */
export function connectMode(mods: { ctrl: boolean; shift: boolean }): { clone: boolean; searchTarget: boolean; edge: boolean } {
  const duplicate = !mods.shift || mods.ctrl;
  return { clone: duplicate, searchTarget: !mods.ctrl, edge: !(mods.ctrl && mods.shift) };
}

// --------------------------------------------------------------------------------------------
// Clone data
// --------------------------------------------------------------------------------------------

function subtree(cell: Cell, out: Cell[] = []): Cell[] {
  out.push(cell);
  for (const child of cell.children ?? []) subtree(child, out);
  return out;
}

/**
 * Railway data of fresh clones (not in the model yet): every railway object in them gets the next
 * free generated ID of its kind (`S1`, `S2`, ...) and loses the route list and imported railML ids
 * (CLONE_DROPPED_ATTRS). Other data (kind, direction, aspects, km, track) is kept; the snap to track
 * updates track/km when the clone lands on a track.
 */
export function prepareClonedCells(model: ReturnType<Graph['getDataModel']>, cells: Cell[]): void {
  const taken = new Map<KindId, Set<string>>();
  for (const cell of cells.flatMap((c) => subtree(c))) {
    const kind = getCellKind(cell);
    const value = cell.getValue();
    if (!kind || !isElementValue(value)) continue;
    let set = taken.get(kind);
    if (!set) {
      set = usedIds(model, kind);
      taken.set(kind, set);
    }
    const id = nextFreeId(kind, set);
    set.add(id.toUpperCase());
    const next = value.cloneNode(true) as Element;
    next.setAttribute(ID_ATTR, id);
    for (const attr of CLONE_DROPPED_ATTRS) next.removeAttribute(attr);
    cell.setValue(next);
  }
}

// --------------------------------------------------------------------------------------------
// Which cell gets the arrows
// --------------------------------------------------------------------------------------------

function styleValue(graph: Graph, cell: Cell, key: string): unknown {
  return (graph.getCellStyle(cell) as Record<string, unknown>)[key];
}

/**
 * The cell a click on `cell` selects first (maxGraph SelectionHandler.getInitialCellForEvent: the
 * topmost unselected ancestor below the layer, the cell itself inside a selected group).
 */
export function selectionLevelCell(graph: Graph, cell: Cell | null): Cell | null {
  if (!cell || graph.isCellSelected(cell)) return cell;
  let current = cell;
  for (let parent = current.getParent(); parent && !isLayer(graph, parent) && (parent.isVertex() || parent.isEdge());
    parent = current.getParent()) {
    if (graph.isCellSelected(parent)) break;
    current = parent;
  }
  return current;
}

/**
 * The cell that gets arrows when the pointer is on `cell` (draw.io HoverIcons.getState), or null:
 * vertices only (no edges, edge labels or layers), not locked (cell, group or layer), connectable
 * (`connectable` not 0) or a group, style `allowArrows` not 0.
 */
export function hoverArrowCell(graph: Graph, cell: Cell | null): Cell | null {
  let c: Cell | null = selectionLevelCell(graph, cell);
  if (!c || !c.isVertex() || isLayer(graph, c)) return null;
  // non-connectable parts use their connectable parent vertex
  const group: boolean = isGroupVertex(graph, c);
  if (!c.isConnectable() && !group) {
    const parent: Cell | null = c.getParent();
    if (parent && parent.isVertex() && !isLayer(graph, parent) && parent.isConnectable()) c = parent;
    else return null;
  }
  const geo = c.getGeometry();
  if (!geo || (geo.relative && c.getParent()?.isEdge())) return null;
  if (graph.isCellLocked(c) || !c.isVisible()) return null;
  const allow = styleValue(graph, c, 'allowArrows');
  if (allow === 0 || allow === '0' || allow === false) return null;
  return c;
}

// --------------------------------------------------------------------------------------------
// connectVertex
// --------------------------------------------------------------------------------------------

/** Screen rectangle (view coordinates) of a model-space point of `source`'s parent, grown by tol. */
function searchRect(graph: Graph, source: Cell, pt: { x: number; y: number }): Rectangle {
  const s = graph.view.scale;
  const t = graph.view.translate;
  const parent = source.getParent();
  const parentState = parent && parent.isVertex() ? graph.view.getState(parent) : null;
  const dx = parentState ? parentState.x : t.x * s;
  const dy = parentState ? parentState.y : t.y * s;
  const rect = new Rectangle(dx + pt.x * s, dy + pt.y * s, 0, 0);
  rect.grow(TARGET_TOLERANCE * s);
  return rect;
}

/**
 * The unlocked, connectable cell lying `DEFAULT_EDGE_LENGTH` beyond `source` in `dir` (draw.io
 * connectVertex target search, topmost first), not overlapping the source; null when none.
 */
export function findConnectTarget(graph: Graph, source: Cell, dir: ArrowDirection): Cell | null {
  const geo = source.getGeometry();
  if (!geo) return null;
  const rect = searchRect(graph, source, connectEndPoint(geo, dir));
  const hits = graph.getCells(0, 0, 0, 0, null, [], rect, null, true).reverse();
  const sourceState = graph.view.getState(source);
  for (const hit of hits) {
    const cell = hoverArrowCell(graph, hit);
    if (!cell || cell === source || cell.isAncestor(source) || source.isAncestor(cell)) continue;
    const state = graph.view.getState(cell);
    if (sourceState && state && !intersects(sourceState, state)) return cell;
  }
  return null;
}

function intersects(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** A clone of `source` (with its children), railway data prepared, placed relative to its parent. */
export function cloneForConnect(graph: Graph, source: Cell): Cell {
  const [clone] = graph.cloneCells([source], false);
  prepareClonedCells(graph.getDataModel(), [clone]);
  return clone;
}

export interface ConnectResult {
  edge: Cell | null;
  /** The clone inserted, or the existing cell connected to (null for a dangling edge). */
  target: Cell | null;
  cloned: boolean;
}

/**
 * draw.io Graph.connectVertex for the hover arrows, as one undoable edit: connect `source` to the
 * cell in `dir` or to a new clone there (see connectMode). The edge gets the style a new connection
 * gets from the connection handler (the graph's default edge style).
 */
export function connectVertex(graph: Graph, source: Cell, dir: ArrowDirection,
  mods: { ctrl: boolean; shift: boolean } = { ctrl: false, shift: false }): ConnectResult {
  const geo = source.getGeometry();
  const result: ConnectResult = { edge: null, target: null, cloned: false };
  if (!geo) return result;
  const mode = connectMode(mods);
  const parent = source.getParent() ?? graph.getDefaultParent();
  graph.batchUpdate(() => {
    let target = mode.searchTarget ? findConnectTarget(graph, source, dir) : null;
    if (!target && mode.clone) {
      const clone = cloneForConnect(graph, source);
      const cloneGeo = clone.getGeometry() as Geometry | null;
      if (cloneGeo) {
        const pos = clonePosition(geo, dir);
        cloneGeo.x = pos.x;
        cloneGeo.y = pos.y;
      }
      [target] = graph.addCells([clone], parent, null, null, null);
      result.cloned = true;
    }
    result.target = target ?? null;
    if (mode.edge) {
      const edge = graph.insertEdge(parent, null, '', source, target ?? null);
      if (!target) {
        const edgeGeo = edge.getGeometry()?.clone();
        if (edgeGeo) {
          // draw.io: a dangling edge ends at the point DEFAULT_EDGE_LENGTH beyond the side
          const end = connectEndPoint(geo, dir);
          edgeGeo.setTerminalPoint(new Point(end.x, end.y), false);
          graph.getDataModel().setGeometry(edge, edgeGeo);
        }
      }
      result.edge = edge;
    }
  });
  return result;
}

// --------------------------------------------------------------------------------------------
// Controller
// --------------------------------------------------------------------------------------------

/** Arrow images: draw.io HoverIcons triangleUp/Right/Down/Left (size and path). */
const ARROW_SHAPES: Record<ArrowDirection, { w: number; h: number; d: string }> = {
  north: { w: 18, h: 28, d: 'm 6 26 L 12 26 L 12 12 L 18 12 L 9 1 L 1 12 L 6 12 z' },
  east: { w: 26, h: 18, d: 'm 1 6 L 14 6 L 14 1 L 26 9 L 14 18 L 14 12 L 1 12 z' },
  south: { w: 18, h: 26, d: 'm 6 1 L 6 14 L 1 14 L 9 26 L 18 14 L 12 14 L 12 1 z' },
  west: { w: 28, h: 18, d: 'm 1 9 L 12 1 L 12 6 L 26 6 L 26 12 L 12 12 L 12 18 z' },
};

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface HoverArrowsOptions {
  /** Extra veto (tests, read-only views). */
  isBlocked?: () => boolean;
}

export class HoverArrowsController {
  private readonly graph: Graph;
  private readonly options: HoverArrowsOptions;
  private readonly arrows = new Map<ArrowDirection, HTMLElement>();
  private readonly preview: HTMLElement;
  private current: CellState | null = null;
  private bbox: Rectangle | null = null;
  private activeArrow: ArrowDirection | null = null;
  private pending: Cell | null = null;
  private pendingTimer: ReturnType<typeof setTimeout> | null = null;
  private mouseDownPoint: { x: number; y: number } | null = null;
  private connectionHandlerActive = false;
  /** Source + direction of a connection started by dragging an arrow. */
  private arrowDrag: { source: Cell; dir: ArrowDirection } | null = null;
  private lastPointer: { x: number; y: number } | null = null;
  private readonly cleanups: Array<() => void> = [];

  constructor(graph: Graph, options: HoverArrowsOptions = {}) {
    this.graph = graph;
    this.options = options;
    const container = graph.container;
    if (typeof getComputedStyle === 'function' && getComputedStyle(container).position === 'static') {
      // absolute arrows scroll with the diagram only inside a positioned scroll container
      container.style.position = 'relative';
    }
    for (const dir of ARROW_DIRECTIONS) this.arrows.set(dir, this.createArrow(dir));
    this.preview = document.createElement('div');
    this.preview.className = 'rd-hover-arrow-preview';
    this.preview.setAttribute('aria-hidden', 'true');
    this.install();
  }

  // ---- state queries -------------------------------------------------------------------------

  /** The cell showing arrows (null when hidden). */
  getCurrentCell(): Cell | null {
    return this.current?.cell ?? null;
  }

  isVisible(): boolean {
    return !!this.current && [...this.arrows.values()].some((a) => a.isConnected && a.style.display !== 'none');
  }

  private connectionHandler(): ConnectionHandler | null {
    return (this.graph.getPlugin('ConnectionHandler') as ConnectionHandler | undefined) ?? null;
  }

  private isBlocked(): boolean {
    const graph = this.graph;
    if (!isConnectionArrowsEnabled() || !graph.isEnabled() || graph.isEditing()) return true;
    if (typeof document !== 'undefined' && document.body?.classList.contains('rd-scenario-viewing')) return true;
    if (graph.container.closest('.rd-route-tool-active')) return true;
    return !!this.options.isBlocked?.();
  }

  /** draw.io HoverIcons.isResetEvent */
  private isResetEvent(evt: Event): boolean {
    const e = evt as MouseEvent;
    return !!e && (e.altKey || (this.activeArrow === null && e.shiftKey) || (eventUtils.isPopupTrigger(e) && !isCloneEvent(e)));
  }

  // ---- DOM -----------------------------------------------------------------------------------

  private createArrow(dir: ArrowDirection): HTMLElement {
    const shape = ARROW_SHAPES[dir];
    const el = document.createElement('div');
    el.className = 'rd-hover-arrow';
    el.dataset.direction = dir;
    el.title = 'Click to connect and clone (ctrl+click to clone, shift+click to connect). Drag to connect (ctrl+drag to clone).';
    el.style.width = `${shape.w}px`;
    el.style.height = `${shape.h}px`;
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', String(shape.w));
    svg.setAttribute('height', String(shape.h));
    svg.setAttribute('viewBox', `0 0 ${shape.w} ${shape.h}`);
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', shape.d);
    svg.appendChild(path);
    el.appendChild(svg);

    el.addEventListener('pointerenter', (evt) => {
      if (evt.pointerType !== 'mouse' && evt.pointerType !== 'pen') return;
      this.setActiveArrow(dir);
      this.connectionHandler()?.constraintHandler.reset();
      this.showPreview(dir, evt);
    });
    el.addEventListener('pointerleave', () => {
      if (!this.graph.isMouseDown) this.setActiveArrow(null);
      this.hidePreview();
    });
    el.addEventListener('pointerdown', (evt) => this.onArrowDown(dir, evt));
    // the press is handled here; keep it away from the graph's own gesture handling
    el.addEventListener('mousedown', (evt) => evt.stopPropagation());
    el.addEventListener('contextmenu', (evt) => evt.preventDefault());
    return el;
  }

  private setActiveArrow(dir: ArrowDirection | null): void {
    this.activeArrow = dir;
    this.arrows.forEach((el, d) => {
      el.style.opacity = d === dir ? '1' : String(INACTIVE_OPACITY);
      el.classList.toggle('rd-hover-arrow-active', d === dir);
    });
  }

  private setDisplay(display: '' | 'none'): void {
    this.arrows.forEach((el) => { el.style.display = display; });
    if (display === 'none') this.hidePreview();
  }

  private removeNodes(): void {
    this.arrows.forEach((el) => el.remove());
    this.hidePreview();
  }

  // ---- show / hide ---------------------------------------------------------------------------

  /** draw.io HoverIcons.reset */
  reset(): void {
    this.clearPending();
    this.mouseDownPoint = null;
    this.current = null;
    this.activeArrow = null;
    this.bbox = null;
    this.removeNodes();
  }

  /** Escape: hides the arrows and cancels a connection dragged from an arrow. */
  escape(): void {
    if (this.arrowDrag) {
      const handler = this.connectionHandler();
      this.arrowDrag = null;
      handler?.reset();
      this.graph.isMouseDown = false;
    }
    this.reset();
  }

  private clearPending(): void {
    if (this.pendingTimer) clearTimeout(this.pendingTimer);
    this.pendingTimer = null;
    this.pending = null;
  }

  private show(cell: Cell): void {
    const state = this.graph.view.getState(cell);
    if (!state || this.isBlocked()) {
      this.reset();
      return;
    }
    this.removeNodes();
    this.current = state;
    this.activeArrow = null;
    const container = this.graph.container;
    this.arrows.forEach((el) => {
      el.style.display = '';
      container.appendChild(el);
    });
    this.repaint();
    const handler = this.connectionHandler();
    if (handler && handler.constraintHandler.currentFocus !== state) handler.constraintHandler.reset();
  }

  /** draw.io HoverIcons.repaint: positions the arrows around the current state. */
  repaint(): void {
    this.bbox = null;
    if (!this.current) return;
    const cell = this.current.cell;
    const target = this.graph.getDataModel().contains(cell) ? hoverArrowCell(this.graph, cell) : null;
    const state = target === cell ? this.graph.view.getState(cell) : null;
    if (!state || this.isBlocked()) {
      this.reset();
      return;
    }
    this.current = state;
    const bounds = state.shape?.boundingBox ? Rectangle.fromRectangle(state.shape.boundingBox) : Rectangle.fromRectangle(state);
    bounds.grow(this.graph.tolerance);
    bounds.grow(ARROW_SPACING);
    const cx = state.getCenterX();
    const cy = state.getCenterY();
    const place = (dir: ArrowDirection, x: number, y: number): void => {
      const el = this.arrows.get(dir)!;
      el.style.left = `${Math.round(x)}px`;
      el.style.top = `${Math.round(y)}px`;
    };
    const s = ARROW_SHAPES;
    place('north', cx - s.north.w / 2, bounds.y - s.north.h);
    place('east', bounds.x + bounds.width, cy - s.east.h / 2);
    place('south', cx - s.north.w / 2, bounds.y + bounds.height);
    place('west', bounds.x - s.west.w, cy - s.east.h / 2);
    this.checkCollisions(bounds, state);
    this.setActiveArrow(this.activeArrow);
    // hover box: the cell and its arrows, grown by 10 (draw.io computeBoundingBox)
    const box = Rectangle.fromRectangle(state);
    box.add(new Rectangle(bounds.x - s.west.w, bounds.y - s.north.h, bounds.width + s.west.w + s.east.w,
      bounds.height + s.north.h + s.south.h));
    box.grow(10);
    this.bbox = box;
  }

  /** draw.io checkCollisions: an arrow over another (not much larger) cell or an edge is hidden. */
  private checkCollisions(bounds: Rectangle, state: CellState): void {
    const graph = this.graph;
    const s = ARROW_SHAPES;
    const cx = state.getCenterX();
    const cy = state.getCenterY();
    let hits: Record<ArrowDirection, Cell | null> = {
      east: graph.getCellAt(bounds.x + bounds.width + s.east.w / 2, cy),
      west: graph.getCellAt(bounds.x - s.west.w / 2, cy),
      north: graph.getCellAt(cx, bounds.y - s.north.h / 2),
      south: graph.getCellAt(cx, bounds.y + bounds.height + s.south.h / 2),
    };
    // a large cell behind every side: show all
    if (hits.east && hits.east === hits.west && hits.west === hits.north && hits.north === hits.south) {
      hits = { east: null, west: null, north: null, south: null };
    }
    const currentGeo = state.cell.getGeometry();
    for (const dir of ARROW_DIRECTIONS) {
      const cell = hits[dir];
      const geo = cell?.isVertex() ? cell.getGeometry() : null;
      const collides = !!cell && !cell.isAncestor(state.cell) && !state.cell.isAncestor(cell) && !isLayer(graph, cell) &&
        !graph.isSwimlane(cell) &&
        (!geo || !currentGeo || (geo.height < 3 * currentGeo.height && geo.width < 3 * currentGeo.width));
      this.arrows.get(dir)!.style.visibility = collides ? 'hidden' : 'visible';
    }
  }

  // ---- preview -------------------------------------------------------------------------------

  private showPreview(dir: ArrowDirection, evt: PointerEvent): void {
    this.hidePreview();
    const source = this.current?.cell;
    const sourceState = this.current;
    if (!source || !sourceState) return;
    const mode = connectMode({ ctrl: isCloneEvent(evt), shift: evt.shiftKey });
    const target = mode.searchTarget ? findConnectTarget(this.graph, source, dir) : null;
    const s = this.graph.view.scale;
    let box: Box | null = null;
    if (target) {
      const ts = this.graph.view.getState(target);
      if (ts) box = { x: ts.x - 2, y: ts.y - 2, width: ts.width + 4, height: ts.height + 4 };
      this.preview.dataset.kind = 'target';
    } else if (mode.clone) {
      const geo = source.getGeometry();
      if (!geo) return;
      const pos = clonePosition({ x: 0, y: 0, width: geo.width, height: geo.height }, dir);
      box = { x: sourceState.x + pos.x * s, y: sourceState.y + pos.y * s, width: sourceState.width, height: sourceState.height };
      this.preview.dataset.kind = 'clone';
    }
    if (!box) return;
    Object.assign(this.preview.style, {
      left: `${Math.round(box.x)}px`, top: `${Math.round(box.y)}px`,
      width: `${Math.round(box.width)}px`, height: `${Math.round(box.height)}px`,
    });
    this.graph.container.appendChild(this.preview);
  }

  private hidePreview(): void {
    this.preview.remove();
  }

  // ---- pointer -------------------------------------------------------------------------------

  private onArrowDown(dir: ArrowDirection, evt: PointerEvent): void {
    evt.stopPropagation();
    evt.preventDefault();
    if (evt.button !== 0 || !this.current || this.isResetEvent(evt) || this.isBlocked()) {
      if (this.isResetEvent(evt)) this.reset();
      return;
    }
    const graph = this.graph;
    graph.stopEditing(false);
    const state = this.current;
    const pt = styleUtils.convertPoint(graph.container, evt.clientX, evt.clientY);
    this.mouseDownPoint = { x: pt.x, y: pt.y };
    this.setActiveArrow(dir);
    this.setDisplay('none');
    const handler = this.connectionHandler();
    if (!handler) return;
    // draw.io HoverIcons.drag: the connection handler takes over from here
    this.arrowDrag = { source: state.cell, dir };
    this.connectionHandlerActive = false;
    handler.start(state, pt.x, pt.y);
    graph.isMouseTrigger = eventUtils.isMouseEvent(evt);
    graph.isMouseDown = true;
  }

  private stateUnder(me: InternalMouseEvent): Cell | null {
    let cell = me.getState()?.cell ?? null;
    if (!cell) {
      // a gap inside a transparent group (ERTMS symbols) still counts as the group
      const at = this.graph.getCellAt(me.getGraphX(), me.getGraphY());
      if (at && isGroupVertex(this.graph, at)) cell = at;
    }
    return hoverArrowCell(this.graph, cell);
  }

  private onMouseMove(me: InternalMouseEvent): void {
    const evt = me.getEvent();
    const handler = this.connectionHandler();
    if (handler?.shape) this.connectionHandlerActive = true;
    if (this.graph.isMouseDown) return;
    this.lastPointer = { x: me.getGraphX(), y: me.getGraphY() };
    if (this.isBlocked() || this.isResetEvent(evt) || (evt instanceof PointerEvent && evt.pointerType === 'touch')) {
      if (this.current || this.pending) this.reset();
      return;
    }
    const cell = this.stateUnder(me);
    const x = me.getGraphX();
    const y = me.getGraphY();
    if (this.current) {
      if (cell === this.current.cell) {
        this.clearPending();
        return;
      }
      if (this.bbox && this.bbox.x <= x && x <= this.bbox.x + this.bbox.width && this.bbox.y <= y && y <= this.bbox.y + this.bbox.height) {
        // over the arrows or near the shape: keep them; another cell takes over after a longer rest
        if (this.activeArrow || !cell) this.clearPending();
        else this.schedule(cell, UPDATE_DELAY);
        return;
      }
      this.reset();
    }
    if (cell) this.schedule(cell, ACTIVATION_DELAY);
    else this.clearPending();
  }

  private schedule(cell: Cell, delay: number): void {
    if (this.pending === cell && this.pendingTimer) return;
    this.clearPending();
    this.pending = cell;
    this.pendingTimer = setTimeout(() => {
      this.pendingTimer = null;
      const next = this.pending;
      this.pending = null;
      if (!next || this.graph.isMouseDown || this.isBlocked()) return;
      if (this.activeArrow) return;
      this.show(next);
    }, delay);
  }

  private onMouseUp(me: InternalMouseEvent): void {
    const evt = me.getEvent();
    const wasDrag = this.connectionHandlerActive;
    this.connectionHandlerActive = false;
    if (this.isResetEvent(evt) && !this.mouseDownPoint) {
      this.reset();
      return;
    }
    if (this.current && this.activeArrow && this.mouseDownPoint && !wasDrag) {
      const handler = this.connectionHandler();
      this.arrowDrag = null;
      if (handler?.first) handler.reset();
      this.click(this.current.cell, this.activeArrow, me);
      return;
    }
    if (this.mouseDownPoint) {
      // after a drag from an arrow
      this.reset();
      return;
    }
    if (this.current && this.bbox && contains(this.bbox, me.getGraphX(), me.getGraphY())) {
      this.setDisplay('');
      this.repaint();
    } else if (this.current) {
      this.reset();
    }
  }

  /** draw.io HoverIcons.click + execute + Graph.selectCellsForConnectVertex */
  private click(source: Cell, dir: ArrowDirection, me: InternalMouseEvent): void {
    const evt = me.getEvent() as MouseEvent;
    const graph = this.graph;
    const at = graph.getCellAt(me.getGraphX(), me.getGraphY());
    me.consume();
    if (at && at.isEdge() && !isCloneEvent(evt) && (at.getTerminal(true) === source || at.getTerminal(false) === source)) {
      graph.setSelectionCell(at);
      this.reset();
      return;
    }
    const result = connectVertex(graph, source, dir, { ctrl: isCloneEvent(evt), shift: evt.shiftKey });
    if (result.target) graph.setSelectionCell(result.target);
    else if (result.edge) graph.setSelectionCell(result.edge);
    this.reset();
  }

  // ---- wiring --------------------------------------------------------------------------------

  private install(): void {
    const graph = this.graph;
    const listener = {
      mouseDown: (_sender: unknown, me: InternalMouseEvent) => {
        this.connectionHandlerActive = false;
        if (this.isResetEvent(me.getEvent())) this.reset();
        this.setDisplay('none');
      },
      mouseMove: (_sender: unknown, me: InternalMouseEvent) => this.onMouseMove(me),
      mouseUp: (_sender: unknown, me: InternalMouseEvent) => this.onMouseUp(me),
    };
    graph.addMouseListener(listener);
    this.cleanups.push(() => graph.removeMouseListener(listener));

    const resetHandler = () => this.reset();
    const repaintHandler = () => this.repaint();
    const selection = graph.getSelectionModel();
    selection.addListener(InternalEvent.CHANGE, resetHandler);
    const model = graph.getDataModel();
    model.addListener(InternalEvent.CHANGE, repaintHandler);
    const view = graph.view;
    for (const name of [InternalEvent.SCALE_AND_TRANSLATE, InternalEvent.TRANSLATE, InternalEvent.SCALE,
      InternalEvent.DOWN, InternalEvent.UP]) view.addListener(name, repaintHandler);
    graph.addListener(InternalEvent.ROOT, repaintHandler);
    graph.addListener(InternalEvent.ESCAPE, resetHandler);
    graph.addListener(InternalEvent.START_EDITING, resetHandler);
    this.cleanups.push(() => {
      selection.removeListener(resetHandler);
      model.removeListener(repaintHandler);
      view.removeListener(repaintHandler);
      graph.removeListener(repaintHandler);
      graph.removeListener(resetHandler);
    });

    const container = graph.container;
    const onScroll = () => this.reset();
    const onLeave = (evt: MouseEvent) => {
      if (evt.relatedTarget && container.contains(evt.relatedTarget as Node)) return;
      if (this.graph.isMouseDown) return;
      this.reset();
    };
    container.addEventListener('scroll', onScroll);
    container.addEventListener('mouseleave', onLeave);
    this.cleanups.push(() => {
      container.removeEventListener('scroll', onScroll);
      container.removeEventListener('mouseleave', onLeave);
    });

    const onSetting = (on: boolean) => { if (!on) this.reset(); };
    enabledListeners.add(onSetting);
    this.cleanups.push(() => enabledListeners.delete(onSetting));

    this.installConnectionHooks();
  }

  /** While a connection dragged from an arrow ends on the blank canvas: a connected clone there. */
  private installConnectionHooks(): void {
    const handler = this.connectionHandler();
    if (!handler) return;
    const origCreateTarget = handler.isCreateTarget.bind(handler);
    const origCreateVertex = handler.createTargetVertex.bind(handler);
    const origSelect = handler.selectCells.bind(handler);
    handler.isCreateTarget = (evt: MouseEvent) => (this.arrowDrag ? true : origCreateTarget(evt));
    handler.createTargetVertex = (evt: MouseEvent, source: Cell) => {
      const vertex = origCreateVertex(evt, source);
      if (this.arrowDrag && vertex) prepareClonedCells(this.graph.getDataModel(), [vertex]);
      return vertex;
    };
    handler.selectCells = (edge: Cell, target: Cell | null) => {
      if (this.arrowDrag && target) this.graph.setSelectionCell(target);
      else origSelect(edge, target);
    };
    const onReset = () => { this.arrowDrag = null; };
    handler.addListener(InternalEvent.RESET, onReset);
    this.cleanups.push(() => {
      handler.removeListener(onReset);
      handler.isCreateTarget = origCreateTarget;
      handler.createTargetVertex = origCreateVertex;
      handler.selectCells = origSelect;
    });
  }

  /** Last pointer position in graph coordinates (tests). */
  getLastPointer(): { x: number; y: number } | null {
    return this.lastPointer;
  }

  destroy(): void {
    this.reset();
    this.cleanups.splice(0).forEach((fn) => fn());
  }
}

function contains(r: Rectangle, x: number, y: number): boolean {
  return r.x <= x && x <= r.x + r.width && r.y <= y && y <= r.y + r.height;
}

/** draw.io Graph.isCloneEvent: Ctrl, or Cmd on a Mac (either here). */
export function isCloneEvent(evt: MouseEvent | KeyboardEvent | null | undefined): boolean {
  return !!evt && (evt.ctrlKey || evt.metaKey);
}

const INSTALLED = new WeakMap<Graph, HoverArrowsController>();

/** Installs the hover arrows on a tab graph (once). */
export function installHoverArrows(graph: Graph, options?: HoverArrowsOptions): HoverArrowsController {
  let controller = INSTALLED.get(graph);
  if (!controller) {
    controller = new HoverArrowsController(graph, options);
    INSTALLED.set(graph, controller);
  }
  return controller;
}
