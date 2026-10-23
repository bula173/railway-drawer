/**
 * @file html-labels.ts
 * @brief draw.io's per-cell HTML labels (`html=1`) for maxGraph graphs, with sanitizing.
 *
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG. Licensed under the Apache
 * License, Version 2.0. Behaviour of jgraph/drawio v32.4.1
 * src/main/webapp/js/grapheditor/Graph.js (Graph.prototype.isHtmlLabel: a label is HTML when the
 * cell's style has `html=1`; Graph.sanitizeHtml before HTML labels are rendered).
 *
 * maxGraph 0.10's Graph.isHtmlLabel only returns the graph-wide `htmlLabels` flag, so draw.io
 * labels such as `<font>S4</font>` or `<div style="...">` showed as markup. Labels come from
 * files the user opens, so the HTML is sanitized first with DOMPurify, like draw.io
 * (`src/security/sanitize.ts`, allow-list: no scripting, handlers, script URLs, SVG/MathML).
 *
 * The sanitizing getLabel wrapper must be the OUTERMOST one: anything wrapping it later
 * (placeholders, light-dark() rewrites, UserObject labels) could put unsanitized HTML back.
 * setupGraph (ui/setup-graph.ts) installs it last; `installDrawioHtmlLabels` re-wraps when called again
 * after another wrapper was added, so calling it last is enough.
 */
import type { Cell, Graph } from '@maxgraph/core';
import { sanitizeHtmlLabel } from '../../security/sanitize';
import { installOnce } from '../../core/install-once';

export { sanitizeHtmlLabel };

/** The sanitizing getLabel installed on each graph (to tell whether it is still the outermost). */
const SANITIZERS = new WeakMap<Graph, (cell: Cell) => string | null>();

/**
 * Makes `html=1` cells render their label as (sanitized) HTML, as draw.io does. Other cells keep
 * the graph-wide setting. Idempotent per graph.
 */
export function installDrawioHtmlLabels(graph: Graph): void {
  // already the outermost wrapper: nothing to do
  const current = SANITIZERS.get(graph);
  if (current && graph.getLabel === current) return;
  if (installOnce(graph, 'drawio.html-labels')) {
    const baseIsHtmlLabel = graph.isHtmlLabel.bind(graph);
    graph.isHtmlLabel = (cell: Cell): boolean => {
      const html = (graph.getCurrentCellStyle(cell) as Record<string, unknown> | undefined)?.html;
      if (html === true || html === 1 || html === '1') return true;
      return baseIsHtmlLabel(cell);
    };
  }
  const baseGetLabel = graph.getLabel.bind(graph);
  const sanitizingGetLabel = (cell: Cell): string | null => {
    const label = baseGetLabel(cell);
    return typeof label === 'string' && graph.isHtmlLabel(cell) ? sanitizeHtmlLabel(label) : label;
  };
  SANITIZERS.set(graph, sanitizingGetLabel);
  graph.getLabel = sanitizingGetLabel;
}
