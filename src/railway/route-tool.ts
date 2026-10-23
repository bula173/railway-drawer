/**
 * @file route-tool.ts
 * @brief Route drawing mode (toolbar button, Extras > Route Tool): click the start signal, then the
 *        end signal; the paths over the track topology are listed (points positions, sections,
 *        length), the chosen one is highlighted in an overlay, and "Create route" adds the route
 *        object (route-store.ts). Guidance: once the start signal is picked, the signals reachable in its
 *        direction are outlined and the others dimmed, and "No route in the signal direction" shows before
 *        any further click. Esc cancels the picked start signal (a second Esc / the ✕ button leaves the mode).
 *
 * While active, a capture-phase listener on `#graph-container` takes the pointer events away from
 * maxGraph (no selection, no moving), so the drawing cannot change under the tool.
 */
import { styleUtils } from '@maxgraph/core';
import type { Cell, Graph } from '@maxgraph/core';
import { openFloatingPanel } from '../core/modal';
import type { FloatingPanelHandle } from '../core/modal';
import { absoluteBounds, centerOf } from './geometry';
import type { Pt } from './geometry';
import { GraphOverlay, pointsAttr, svgEl } from './graph-overlay';
import type { RoutePath } from './routes';
import { describePath, findRoutePaths } from './routes';
import { addRoute, nextRouteId } from './route-store';
import { buildTopology } from './topology';
import type { RailObject } from './validation';
import { collectObjects } from './validation';

export interface RouteToolNotifier {
  success(message: string): void;
  warning(message: string): void;
}

export interface RouteToolOptions {
  getGraph: () => Graph | null;
  notify: RouteToolNotifier;
  /** Element whose pointer events the tool takes (default `#graph-container`). */
  container?: HTMLElement | null;
  onChange?: (active: boolean) => void;
}

const POINTER_EVENTS = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'touchstart', 'touchend', 'contextmenu'] as const;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Graph coordinates of a client point. */
export function graphPoint(graph: Graph, clientX: number, clientY: number): Pt {
  const p = styleUtils.convertPoint(graph.container, clientX, clientY);
  const s = graph.view.scale;
  const t = graph.view.translate;
  return { x: p.x / s - t.x, y: p.y / s - t.y };
}

/** The signal at a graph point: inside its bounds (+6), else the nearest centre within 25. */
export function signalAt(objects: RailObject[], p: Pt): RailObject | null {
  let best: RailObject | null = null;
  let bestD = 25;
  for (const o of objects) {
    if (o.kind.id !== 'signal') continue;
    const b = absoluteBounds(o.cell);
    const c = centerOf(o.cell);
    if (!b || !c) continue;
    if (p.x >= b.x - 6 && p.x <= b.x + b.width + 6 && p.y >= b.y - 6 && p.y <= b.y + b.height + 6) return o;
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (d < bestD) {
      best = o;
      bestD = d;
    }
  }
  return best;
}

export class RouteTool {
  private active = false;
  private graph: Graph | null = null;
  private entry: RailObject | null = null;
  private exit: RailObject | null = null;
  private paths: RoutePath[] = [];
  private chosen = 0;
  private overlay: GraphOverlay | null = null;
  private panel: HTMLElement | null = null;
  /** The panel as a non-modal floating panel (core/modal.ts): role, label, focus return. */
  private floating: FloatingPanelHandle | null = null;
  /** After the start signal: the signals a route can end at, and the other signals (dimmed). */
  private reachable: RailObject[] = [];
  private unreachable: RailObject[] = [];
  private readonly container: HTMLElement | null;

  constructor(private readonly options: RouteToolOptions) {
    this.container = options.container ?? document.getElementById('graph-container');
  }

  isActive(): boolean {
    return this.active;
  }

  toggle(): void {
    if (this.active) this.deactivate();
    else this.activate();
  }

  activate(): void {
    if (this.active) return;
    const graph = this.options.getGraph();
    if (!graph) return;
    this.active = true;
    this.graph = graph;
    graph.clearSelection();
    this.overlay = new GraphOverlay(graph, 'rd-route-overlay');
    for (const type of POINTER_EVENTS) this.container?.addEventListener(type, this.onPointer, true);
    this.container?.classList.add('rd-route-tool-active');
    this.reset();
    this.options.onChange?.(true);
  }

  deactivate(): void {
    if (!this.active) return;
    this.active = false;
    for (const type of POINTER_EVENTS) this.container?.removeEventListener(type, this.onPointer, true);
    this.container?.classList.remove('rd-route-tool-active');
    this.overlay?.destroy();
    this.overlay = null;
    this.floating?.close();
    this.floating = null;
    this.panel?.remove();
    this.panel = null;
    this.graph = null;
    this.entry = this.exit = null;
    this.paths = [];
    this.reachable = [];
    this.unreachable = [];
    this.options.onChange?.(false);
  }

  /** Start over: pick the start signal. */
  reset(): void {
    this.entry = null;
    this.exit = null;
    this.paths = [];
    this.chosen = 0;
    this.reachable = [];
    this.unreachable = [];
    this.render();
  }

  /** The signals a route from the start signal can end at (after it was picked). */
  getReachableIds(): string[] {
    return this.reachable.map((o) => o.id);
  }

  /** Splits the other signals into reachable exits (a path in the start signal's direction) and the rest. */
  private computeReachable(entry: RailObject): void {
    const objects = this.objects();
    const from = objects.find((o) => o.cell === entry.cell);
    this.reachable = [];
    this.unreachable = [];
    if (!from) return;
    const topo = buildTopology(objects);
    for (const o of objects) {
      if (o.kind.id !== 'signal' || o.cell === entry.cell) continue;
      const ok = findRoutePaths(topo, from, o).paths.length > 0;
      (ok ? this.reachable : this.unreachable).push(o);
    }
  }

  /** The current paths (after both signals were picked). */
  getPaths(): RoutePath[] {
    return this.paths;
  }

  private objects(): RailObject[] {
    return this.graph ? collectObjects(this.graph.getDataModel()) : [];
  }

  /** Picks a signal (by object), as a click on it would. */
  pickSignal(signal: RailObject): void {
    if (!this.active || !this.graph) return;
    if (!this.entry || this.exit) {
      this.entry = signal;
      this.exit = null;
      this.paths = [];
      this.computeReachable(signal);
      this.render();
      return;
    }
    if (signal.cell === this.entry.cell) return;
    this.exit = signal;
    const objects = this.objects();
    const entry = objects.find((o) => o.cell === this.entry!.cell);
    const exit = objects.find((o) => o.cell === signal.cell);
    if (!entry || !exit) {
      this.reset();
      return;
    }
    const result = findRoutePaths(buildTopology(objects), entry, exit);
    this.paths = result.paths;
    this.chosen = 0;
    this.render(result.problem);
  }

  /** Picks the signal with this ID (tests, keyboard users). */
  pickSignalById(id: string): boolean {
    const o = this.objects().find((x) => x.kind.id === 'signal' && x.id.toUpperCase() === id.toUpperCase());
    if (!o) return false;
    this.pickSignal(o);
    return true;
  }

  choosePath(index: number): void {
    if (index < 0 || index >= this.paths.length) return;
    this.chosen = index;
    this.render();
  }

  /** Creates the route for the chosen path; returns the new cell. */
  createRoute(id?: string): Cell | null {
    if (!this.graph || !this.entry || !this.exit) return null;
    const path = this.paths[this.chosen];
    if (!path) return null;
    const objects = this.objects();
    const entry = objects.find((o) => o.cell === this.entry!.cell);
    const exit = objects.find((o) => o.cell === this.exit!.cell);
    if (!entry || !exit) return null;
    const cell = addRoute(this.graph, path, entry, exit, id);
    const routeId = cell.getValue()?.getAttribute?.('rdId') ?? '';
    this.options.notify.success(`Route ${routeId} created: ${entry.id} → ${exit.id}`);
    this.reset();
    return cell;
  }

  private readonly onPointer = (e: Event): void => {
    if (!this.active || !this.graph) return;
    const target = e.target as Node | null;
    if (this.panel && target && this.panel.contains(target)) return;
    e.stopPropagation();
    e.preventDefault();
    if (e.type !== 'pointerdown' && e.type !== 'mousedown') return;
    if (e.type === 'mousedown' && 'PointerEvent' in window) return; // handled as pointerdown
    const me = e as MouseEvent;
    if (me.button !== 0) return;
    const signal = signalAt(this.objects(), graphPoint(this.graph, me.clientX, me.clientY));
    if (signal) this.pickSignal(signal);
    else this.options.notify.warning('Click a signal (railway object of kind Signal).');
  };

  /** Esc (from the floating panel, only while no modal is open): cancels the picked start signal first, then leaves the tool. */
  private readonly onEscape = (): void => {
    if (!this.active) return;
    if (this.entry) this.reset();
    else this.deactivate();
  };

  private render(problem?: string): void {
    if (!this.active || !this.graph) return;
    // Overlay: picked signals and the chosen path
    const children: SVGElement[] = [];
    const path = this.paths[this.chosen];
    if (path) {
      children.push(svgEl('polyline', { points: pointsAttr(path.line), class: 'rd-route-hl-casing' }));
      children.push(svgEl('polyline', { points: pointsAttr(path.line), class: 'rd-route-hl' }));
    }
    if (this.entry && !this.exit) {
      // guidance: reachable exit signals outlined, the others dimmed
      for (const o of this.unreachable) {
        const b = absoluteBounds(o.cell);
        if (b) children.push(svgEl('rect', { x: b.x - 3, y: b.y - 3, width: b.width + 6, height: b.height + 6, class: 'rd-route-dim', 'data-signal': o.id }));
      }
      for (const o of this.reachable) {
        const b = absoluteBounds(o.cell);
        if (b) children.push(svgEl('rect', { x: b.x - 4, y: b.y - 4, width: b.width + 8, height: b.height + 8, rx: 4, class: 'rd-route-hl-target', 'data-signal': o.id }));
      }
    }
    for (const o of [this.entry, this.exit]) {
      const b = o ? absoluteBounds(o.cell) : null;
      if (b) children.push(svgEl('rect', { x: b.x - 4, y: b.y - 4, width: b.width + 8, height: b.height + 8, rx: 4, class: 'rd-route-hl-signal' }));
    }
    this.overlay?.set(children);

    // Panel
    if (!this.panel) {
      this.panel = el('div', 'rd-route-tool');
      this.floating = openFloatingPanel({ element: this.panel, label: 'Route tool', onEscape: this.onEscape });
      const rect = this.container?.getBoundingClientRect();
      if (rect) {
        this.panel.style.top = `${Math.round(rect.top + 8)}px`;
        this.panel.style.left = `${Math.round(rect.left + 8)}px`;
      }
    }
    const head = el('div', 'rd-route-tool-head');
    head.append(el('strong', undefined, 'Route tool'));
    const close = el('button', 'rd-route-btn rd-route-close', '✕');
    close.type = 'button';
    close.title = 'Leave the route tool (Esc)';
    close.addEventListener('click', () => this.deactivate());
    head.append(close);

    const body = el('div', 'rd-route-tool-body');
    const status = el('p', 'rd-route-status');
    if (!this.entry) status.textContent = 'Click the start (entry) signal.';
    else if (!this.exit && this.reachable.length === 0) {
      status.textContent = `Start: ${this.entry.id || 'signal'} — no route in the signal direction. Pick another start signal (Esc).`;
      status.classList.add('rd-route-none');
    } else if (!this.exit) {
      const n = this.reachable.length;
      status.textContent = `Start: ${this.entry.id || 'signal'} — click ${n === 1 ? 'the highlighted exit signal' : `one of the ${n} highlighted exit signals`} (${this.reachable.map((o) => o.id).join(', ')}).`;
    }
    else if (this.paths.length === 0) status.textContent = problem ?? 'No path.';
    else status.textContent = `${this.entry.id} → ${this.exit.id}: ${this.paths.length} path${this.paths.length === 1 ? '' : 's'}`;
    body.append(status);

    if (this.paths.length > 0) {
      const list = el('div', 'rd-route-paths');
      this.paths.forEach((p, i) => {
        const row = el('label', 'rd-route-path');
        const radio = el('input');
        radio.type = 'radio';
        radio.name = 'rd-route-path';
        radio.checked = i === this.chosen;
        radio.addEventListener('change', () => this.choosePath(i));
        row.append(radio, el('span', undefined, describePath(p)));
        list.append(row);
      });
      body.append(list);
      const idRow = el('label', 'rd-route-id');
      idRow.append(el('span', undefined, 'Route ID'));
      const input = el('input', 'rd-route-id-input');
      input.type = 'text';
      input.value = nextRouteId(this.graph.getDataModel());
      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') this.createRoute(input.value);
      });
      idRow.append(input);
      body.append(idRow);
      const create = el('button', 'rd-route-btn rd-route-create', 'Create route');
      create.type = 'button';
      create.addEventListener('click', () => this.createRoute(input.value));
      body.append(create);
    }
    if (this.entry) {
      const again = el('button', 'rd-route-btn rd-route-restart', 'Start over');
      again.type = 'button';
      again.addEventListener('click', () => this.reset());
      body.append(again);
    }
    this.panel.replaceChildren(head, body);
  }
}
