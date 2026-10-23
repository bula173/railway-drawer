import { Graph, InternalEvent, PanningHandler, type InternalMouseEvent } from '@maxgraph/core';
import { installOnce } from '../core/install-once';

/** Whether `evt` has no modifier key held. */
function noModifiers(evt: MouseEvent): boolean {
  return !evt.shiftKey && !evt.altKey && !evt.ctrlKey && !evt.metaKey;
}

/** Graphs in Space pan mode (PanController): a left press pans from the press on. */
const PAN_MODE = new WeakSet<Graph>();

/** The tab graph's PanningHandler plugin (created when the graph has none). */
function panningHandlerOf(graph: Graph): PanningHandler {
  return (graph.getPlugin('PanningHandler') as PanningHandler | undefined) ?? new PanningHandler(graph);
}

/**
 * The panning rules below on the graph's PanningHandler plugin (setup-graph.ts installer
 * `panning`; idempotent). Space pan mode is toggled by the tab's PanController.
 */
export function installPanning(graph: Graph): void {
  if (!installOnce(graph, 'panning')) return;
  const handler = panningHandlerOf(graph);
  handler.usePopupTrigger = false;
  handler.useLeftButtonForPanning = true;
  handler.panningEnabled = true;
  // Plain left press on the background (no cell state, no modifier): pans once moved beyond the
  // tolerance; the press is consumed, so no rubber band starts
  handler.isPanningTrigger = (me: InternalMouseEvent): boolean => {
    const evt = me.getEvent() as MouseEvent;
    return evt.button === 0 && !me.getState() && noModifiers(evt);
  };
  const origForce = handler.isForcePanningEvent.bind(handler);
  handler.isForcePanningEvent = (me: InternalMouseEvent): boolean => {
    const evt = me.getEvent() as MouseEvent;
    if (evt.button === 1) return true;
    if (PAN_MODE.has(graph) && evt.button === 0) return true;
    return origForce(me);
  };
  // A pan never ends in a click (which would clear the selection), whatever its direction
  const origUp = handler.mouseUp.bind(handler);
  handler.mouseUp = (sender: unknown, me: InternalMouseEvent): void => {
    const panned = handler.active;
    origUp(sender as never, me);
    if (panned) me.consume();
  };
  handler.addListener(InternalEvent.PAN_START, () => graph.container.classList.add('rd-panning'));
  handler.addListener(InternalEvent.PAN_END, () => graph.container.classList.remove('rd-panning'));
  // Some browsers start their own middle-button autoscroll on the press
  graph.container.addEventListener('mousedown', (e) => {
    if (e.button === 1) e.preventDefault();
  });
}

/**
 * Panning (the tab graph div is the scroll container, canvas-scroll.ts, so maxGraph's
 * PanningHandler pans with the scrollbars, `useScrollbarsForPanning`):
 * - a left-button drag on the EMPTY background pans, like a map (default cursor, grabbing while panning);
 *   a press on a shape, an edge, a handle or a group's gap (canvas-interaction.ts gives it the
 *   group) still selects / moves it; a click without a move still clears the selection;
 * - Shift+drag (and Alt+drag, maxGraph's forced rubber band) on the background draws the rubber
 *   band; Ctrl/Cmd+drag keeps it too;
 * - Space+drag (also over shapes) and middle-button drag pan from the press on ("force panning":
 *   the press is consumed, so it neither selects, moves nor starts a rubber band).
 * Right-drag keeps opening the context menu (no popup-trigger panning).
 */
export class PanController {
  private graph: Graph;
  private isPanMode: boolean = false;

  constructor(graph: Graph) {
    this.graph = graph;
    // Normally done by setupGraph(graph, 'editor'); kept for graphs set up without it (tests)
    installPanning(graph);
    this.setupKeyboardToggle();
  }

  /** Space held = pan mode: the `view.panStart` / `view.panEnd` commands (ui/commands/view.ts). */
  private setupKeyboardToggle() {
    // Space released outside the window
    window.addEventListener('blur', () => {
      if (this.isPanMode) this.disablePan();
    });
  }

  /** Whether Space pan mode is on. */
  isPanning(): boolean {
    return this.isPanMode;
  }

  enablePan() {
    this.isPanMode = true;
    PAN_MODE.add(this.graph);
    this.graph.container.classList.add('rd-pan-mode');
  }

  disablePan() {
    this.isPanMode = false;
    PAN_MODE.delete(this.graph);
    this.graph.container.classList.remove('rd-pan-mode');
  }
}
