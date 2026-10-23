/**
 * @file diagram-graph-setup.ts
 * @brief Styles and draw.io rendering compatibility of a diagram graph: used by every tab graph
 *        (TabManager.createTab) and by the read-only scenario view graph, so both render a model
 *        the same way.
 */
import type { Graph } from '@maxgraph/core';
import {
  wideArrowPerimeter,
  thinArrowPerimeter,
  doubleArrowPerimeter,
  splitArrowPerimeter,
  chevronArrowPerimeter,
  loopArrowPerimeter,
} from '../shapes/arrows/perimeter';
import { applyDrawioDefaultStyles, installUserObjectLabels, registerDrawioNamedStyles } from '../services/drawio-xml';
import {
  installDanglingEdgeStyles,
  installDrawioCompat,
  installDrawioHtmlLabels,
  installInheritStyleValues,
} from '../drawio-shapes/engine';
import { installTableSupport } from '../drawio-shapes/js/shapes-edges';

export function configureDiagramRendering(graph: Graph): void {
  // Register SVG arrow perimeter styles with graph stylesheet
  // This ensures perimeter functions are available for edge routing calculations
  const stylesheet = graph.getStylesheet();
  stylesheet.putCellStyle('wideArrow', { shape: 'image', perimeter: wideArrowPerimeter });
  stylesheet.putCellStyle('thinArrow', { shape: 'image', perimeter: thinArrowPerimeter });
  stylesheet.putCellStyle('doubleArrow', { shape: 'image', perimeter: doubleArrowPerimeter });
  stylesheet.putCellStyle('splitArrow', { shape: 'image', perimeter: splitArrowPerimeter });
  stylesheet.putCellStyle('chevronArrow', { shape: 'image', perimeter: chevronArrowPerimeter });
  stylesheet.putCellStyle('loopArrow', { shape: 'image', perimeter: loopArrowPerimeter });
  // draw.io's default colours, fonts and arrows (styles/default.xml), so draw.io shapes and
  // files look as in draw.io; the export only writes values draw.io would resolve differently
  applyDrawioDefaultStyles(stylesheet);
  // Base style names used in draw.io files (text, ellipse, swimlane, ...)
  registerDrawioNamedStyles(stylesheet);
  // Labels of draw.io UserObject cells (values that are XML elements)
  installUserObjectLabels(graph);
  // light-dark()/default colours (after installUserObjectLabels: it wraps getLabel)
  installDrawioCompat(graph);
  // edge styles (elbow, orthogonal, isometric) also for edges without a source, as in draw.io
  installDanglingEdgeStyles(graph);
  // strokeColor=inherit (tables, lists) takes the parent's value
  installInheritStyleValues(graph);
  // draw.io tables, lists, stack layouts, collapsed tables
  installTableSupport(graph);
  // html=1 labels render as (sanitized) HTML, as in draw.io. LAST: the sanitizing getLabel must be
  // the outermost wrapper, so nothing installed above can put unsanitized HTML back into a label.
  installDrawioHtmlLabels(graph);
}
