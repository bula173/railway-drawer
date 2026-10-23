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
import { buildLegend } from '../legend';
import { getLegendLibrary } from '../sheet-plan';
import { sheetGeometry } from '../sheet-geometry';
import { readSheetSetup } from '../sheet-setup';
import { buildSheetDecorations } from '../sheet-svg';
import { sheetTitleValues } from '../title-block';
import './print-sheets.css';

const SVG_NS = 'http://www.w3.org/2000/svg';
const OVERLAY_CLASS = 'rd-sheet-overlay';

/** Whether the shown page of `session` has its sheet border on (draw.io page view). */
export function isSheetBorderShown(session: Pick<DiagramSession, 'document'> | null): boolean {
  return session?.document.getPageSettings().page === true;
}

/** Turns the sheet border of the shown page on / off (draw.io's page view; not an undoable edit, as in draw.io). */
export function setSheetBorderShown(session: Pick<DiagramSession, 'document'>, shown: boolean): void {
  session.document.replacePageSettings({ ...session.document.getPageSettings(), page: shown });
}

function overlayGroup(graph: Graph): SVGGElement | null {
  const pane = graph.view.getBackgroundPane() as SVGGElement | null;
  if (!pane) return null;
  let group = pane.querySelector<SVGGElement>(`:scope > g.${OVERLAY_CLASS}`);
  if (!group) {
    group = document.createElementNS(SVG_NS, 'g') as SVGGElement;
    group.setAttribute('class', OVERLAY_CLASS);
    group.setAttribute('data-testid', 'sheet-overlay');
    group.setAttribute('aria-hidden', 'true');
    pane.appendChild(group);
  }
  return group;
}

/** Draws (or removes) the overlay of `session`'s shown page. */
export function renderSheetOverlay(session: DiagramSession): void {
  const { graph, document: doc } = session;
  const pane = graph.view.getBackgroundPane() as SVGGElement | null;
  if (!isSheetBorderShown(session)) {
    pane?.querySelector(`:scope > g.${OVERLAY_CLASS}`)?.remove();
    return;
  }
  const group = overlayGroup(graph);
  if (!group) return;
  const setup = readSheetSetup(doc.getPageSettings(), graph.getDataModel());
  const pages = doc.listPages();
  const store = doc.titleBlock;
  const revisions = store.revisions();
  const legend = setup.legend ? buildLegend(doc.serializeToXml(), getLegendLibrary()) : [];
  const geometry = sheetGeometry(setup, { revisionRows: revisions.length, legendEntries: legend.length });
  const values = sheetTitleValues(store.get(), revisions, setup, doc.shownPageIndex(), pages.length);
  const decorations = buildSheetDecorations(document, { setup, geometry, values, revisions, legend, paperEdge: true });
  const { scale, translate } = graph.view;
  // paper mm -> drawing units (the sheet at the origin) -> screen
  decorations.setAttribute('transform', `scale(${geometry.unitsPerMm.x} ${geometry.unitsPerMm.y})`);
  group.setAttribute('transform', `scale(${scale}) translate(${translate.x} ${translate.y})`);
  group.setAttribute('data-format', `${setup.format} ${setup.orientation}`);
  group.replaceChildren(decorations);
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
        renderSheetOverlay(session);
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
