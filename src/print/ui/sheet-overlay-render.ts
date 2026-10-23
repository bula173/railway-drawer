/**
 * @file sheet-overlay-render.ts
 * @brief Draws the sheet border overlay (paper edge, frame, title block, revision table, legend)
 *        of a session's shown page; loaded on first use by sheet-overlay.ts so the sheet geometry
 *        and SVG builders stay out of the main editor chunk.
 */
import type { Graph } from '@maxgraph/core';
import type { DiagramSession } from '../../ui/session';
import { buildLegend } from '../legend';
import { getLegendLibrary } from '../sheet-plan';
import { sheetGeometry } from '../sheet-geometry';
import { readSheetSetup } from '../sheet-setup';
import { buildSheetDecorations } from '../sheet-svg';
import { sheetTitleValues } from '../title-block';
import { OVERLAY_CLASS, isSheetBorderShown } from './sheet-overlay';

const SVG_NS = 'http://www.w3.org/2000/svg';

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
