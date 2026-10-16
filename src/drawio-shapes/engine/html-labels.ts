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
 * files the user opens, so the HTML is sanitized first (draw.io uses DOMPurify): scripting
 * elements, event handler attributes and `javascript:` / `vbscript:` / non-image `data:` URLs
 * are removed.
 */
import type { Cell, Graph } from '@maxgraph/core';

const REMOVED_ELEMENTS = new Set([
  'script',
  'style',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'link',
  'meta',
  'base',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'template',
  'noscript',
  'title',
]);

const URL_ATTRIBUTES = new Set(['href', 'src', 'xlink:href', 'action', 'formaction', 'background', 'poster', 'srcset']);

const SAFE_DATA_URL = /^data:image\/(png|gif|jpe?g|webp|bmp|svg\+xml)[;,]/;

function isUnsafeUrl(value: string): boolean {
  // Browsers ignore control characters and whitespace inside the scheme
  // eslint-disable-next-line no-control-regex
  const compact = value.replace(/[\u0000- \u007f-\u009f]+/g, '').toLowerCase();
  if (compact.startsWith('javascript:') || compact.startsWith('vbscript:')) return true;
  return compact.startsWith('data:') && !SAFE_DATA_URL.test(compact);
}

function cleanElement(el: Element): void {
  for (const child of Array.from(el.children)) {
    if (REMOVED_ELEMENTS.has(child.localName.toLowerCase())) {
      child.remove();
      continue;
    }
    for (const attr of Array.from(child.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || (URL_ATTRIBUTES.has(name) && isUnsafeUrl(attr.value))) {
        child.removeAttribute(attr.name);
      } else if (name === 'style' && /expression\s*\(|javascript:/i.test(attr.value)) {
        child.removeAttribute(attr.name);
      }
    }
    cleanElement(child);
  }
}

const cache = new Map<string, string>();
const CACHE_LIMIT = 1000;

/** HTML of a draw.io label without scripting (elements, event handlers, script URLs). */
export function sanitizeHtmlLabel(html: string): string {
  if (!/[<&]/.test(html)) return html;
  const hit = cache.get(html);
  if (hit !== undefined) return hit;
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}`, 'text/html');
  cleanElement(doc.body);
  const out = doc.body.innerHTML;
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(html, out);
  return out;
}

const INSTALLED = Symbol('rdDrawioHtmlLabels');

/**
 * Makes `html=1` cells render their label as (sanitized) HTML, as draw.io does. Other cells keep
 * the graph-wide setting. Idempotent per graph.
 */
export function installDrawioHtmlLabels(graph: Graph): void {
  const g = graph as Graph & { [INSTALLED]?: boolean };
  if (g[INSTALLED]) return;
  g[INSTALLED] = true;
  const baseIsHtmlLabel = graph.isHtmlLabel.bind(graph);
  graph.isHtmlLabel = (cell: Cell): boolean => {
    const html = (graph.getCurrentCellStyle(cell) as Record<string, unknown> | undefined)?.html;
    if (html === true || html === 1 || html === '1') return true;
    return baseIsHtmlLabel(cell);
  };
  const baseGetLabel = graph.getLabel.bind(graph);
  graph.getLabel = (cell: Cell): string | null => {
    const label = baseGetLabel(cell);
    return typeof label === 'string' && graph.isHtmlLabel(cell) ? sanitizeHtmlLabel(label) : label;
  };
}
