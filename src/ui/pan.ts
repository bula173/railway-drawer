import { Graph, InternalEvent, PanningHandler, type InternalMouseEvent } from '@maxgraph/core';
import { shouldIgnoreGraphShortcut } from './delete';

/**
 * Panning like draw.io: Space+drag (also over shapes) and middle-button drag scroll the canvas.
 * The tab graph div is the scroll container (canvas-scroll.ts), so maxGraph's PanningHandler
 * pans with the scrollbars (`useScrollbarsForPanning`). The press starts panning at once (the
 * handler's "force panning" path) and is consumed, so it neither selects, moves nor starts a
 * rubber band. Right-drag keeps opening the context menu (no popup-trigger panning).
 */
export class PanController {
  private graph: Graph;
  private panningHandler: PanningHandler;
  private isPanMode: boolean = false;

  constructor(graph: Graph) {
    this.graph = graph;
    this.panningHandler = (graph.getPlugin('PanningHandler') as PanningHandler | undefined) ?? new PanningHandler(graph);
    this.panningHandler.usePopupTrigger = false;
    const origForce = this.panningHandler.isForcePanningEvent.bind(this.panningHandler);
    this.panningHandler.isForcePanningEvent = (me: InternalMouseEvent): boolean => {
      const evt = me.getEvent() as MouseEvent;
      if (evt.button === 1) return true;
      if (this.isPanMode && evt.button === 0) return true;
      return origForce(me);
    };
    this.panningHandler.addListener(InternalEvent.PAN_START, () => graph.container.classList.add('rd-panning'));
    this.panningHandler.addListener(InternalEvent.PAN_END, () => graph.container.classList.remove('rd-panning'));
    // Some browsers start their own middle-button autoscroll on the press
    graph.container.addEventListener('mousedown', (e) => {
      if (e.button === 1) e.preventDefault();
    });
    this.setupKeyboardToggle();
  }

  private setupKeyboardToggle() {
    document.addEventListener('keydown', (e) => {
      // Space typed into a text field or label editor is text, not the pan modifier
      if (shouldIgnoreGraphShortcut(e, this.graph)) return;
      if (e.key === ' ' && !this.isPanMode) {
        e.preventDefault();
        this.enablePan();
      }
    });

    // Not guarded: releasing Space must always leave pan mode, even if focus moved meanwhile
    document.addEventListener('keyup', (e) => {
      if (e.key === ' ' && this.isPanMode) {
        this.disablePan();
      }
    });
    // Space released outside the window
    window.addEventListener('blur', () => {
      if (this.isPanMode) this.disablePan();
    });
  }

  enablePan() {
    this.isPanMode = true;
    this.graph.container.classList.add('rd-pan-mode');
  }

  disablePan() {
    this.isPanMode = false;
    this.graph.container.classList.remove('rd-pan-mode');
  }
}
