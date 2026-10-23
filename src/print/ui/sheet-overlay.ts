/**
 * @file sheet-overlay.ts
 * @brief View > Show Sheet Border: the sheet of the shown page (paper edge, frame, title block,
 *        revision table, legend) drawn under the cells in the graph's background pane, like
 *        draw.io's page view. It is not part of the model and never printed from it; the exports
 *        draw the same decorations themselves (sheet-svg.ts). Colours come from the theme
 *        (print-sheets.css), the geometry from the page's sheet setup (draw.io page size / scale).
 *
 * The toggle is draw.io's own `page` attribute of the page (`<mxGraphModel page="1">`), so draw.io
 * opens the file in page view too.
 */
import type { Graph } from '@maxgraph/core';
import { on } from '../../core/event-bus';
import { onModelChange, onViewTransform, type Disposers } from '../../core/graph-events';
import { ActiveSessionBinding, type DiagramSession } from '../../ui/session';
import './print-sheets.css';

export const OVERLAY_CLASS = 'rd-sheet-overlay';

/** Whether the shown page of `session` has its sheet border on (draw.io page view). */
export function isSheetBorderShown(session: Pick<DiagramSession, 'document'> | null): boolean {
  return session?.document.getPageSettings().page === true;
}

/** Turns the sheet border of the shown page on / off (draw.io's page view; not an undoable edit, as in draw.io). */
export function setSheetBorderShown(session: Pick<DiagramSession, 'document'>, shown: boolean): void {
  session.document.replacePageSettings({ ...session.document.getPageSettings(), page: shown });
}

/** Draws (or removes) the overlay of `session`'s shown page; the renderer loads on first use. */
export async function renderSheetOverlay(session: DiagramSession): Promise<void> {
  if (!isSheetBorderShown(session)) {
    (session.graph.view.getBackgroundPane() as SVGGElement | null)?.querySelector(`:scope > g.${OVERLAY_CLASS}`)?.remove();
    return;
  }
  const { renderSheetOverlay: render } = await import('./sheet-overlay-render');
  render(session);
}

/**
 * Keeps the overlay of the active session current: view changes (zoom, scroll) at once, model /
 * title block changes debounced, page and page-setting changes at once.
 */
export function installSheetOverlay(): ActiveSessionBinding {
  return new ActiveSessionBinding<DiagramSession>(
    (session: DiagramSession, disposers: Disposers) => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const draw = (): void => {
        if (timer) clearTimeout(timer);
        timer = null;
        void renderSheetOverlay(session);
      };
      const later = (): void => {
        if (!isSheetBorderShown(session)) return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(draw, 250);
      };
      const transform = (): void => {
        const group = (session.graph.view.getBackgroundPane() as SVGGElement | null)?.querySelector(`:scope > g.${OVERLAY_CLASS}`);
        if (!group) return;
        const { scale, translate } = session.graph.view;
        group.setAttribute('transform', `scale(${scale}) translate(${translate.x} ${translate.y})`);
      };
      disposers.add(onViewTransform(session.graph, transform));
      disposers.add(onModelChange(session.graph, later));
      disposers.add(session.document.titleBlock.subscribe(later));
      const mine = (detail: { graph: Graph }): void => {
        if (detail.graph === session.graph) draw();
      };
      disposers.add(on('rd-page-settings', mine));
      disposers.add(on('rd-pages-changed', mine));
      disposers.add(() => {
        if (timer) clearTimeout(timer);
      });
      draw();
    }
  );
}
