/**
 * @file sheet-refs.ts
 * @brief Sheet references (odnośniki między arkuszami): the continuation marker "ciąg dalszy na
 *        arkuszu 3" / "continued on sheet 3", an arrow shape whose value is a draw.io `<UserObject>`
 *        with draw.io's own page link `link="data:page/id,<diagram id>"` (draw.io follows it to
 *        that page) and `rdSheetRef="continuation"`. The label shows the target page's sheet
 *        number; it is refreshed when a page is shown and in every export.
 */
import { xmlUtils, type Cell, type GraphDataModel } from '@maxgraph/core';
import { isElementValue } from '../railway/object-data';
import type { SheetLang } from './title-block';

export const SHEET_REF_ATTR = 'rdSheetRef';
export const PAGE_LINK_PREFIX = 'data:page/id,';

/** The marker's look: draw.io's arrow shape with the label inside. */
export const CONTINUATION_STYLE =
  'shape=mxgraph.arrows2.arrow;dy=0;dx=14;notch=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#000000;fontColor=#000000;fontSize=11;';
export const CONTINUATION_SIZE = { width: 170, height: 40 } as const;

export function pageLink(pageId: string): string {
  return `${PAGE_LINK_PREFIX}${pageId}`;
}

/** The page id of a draw.io page link, or null. */
export function linkTargetPageId(link: string | null | undefined): string | null {
  if (!link || !link.startsWith(PAGE_LINK_PREFIX)) return null;
  const id = link.slice(PAGE_LINK_PREFIX.length).trim();
  return id || null;
}

export function continuationLabel(sheetNumber: string | null, lang: SheetLang): string {
  const n = sheetNumber ?? '?';
  return lang === 'en' ? `continued on sheet ${n}` : `ciąg dalszy na arkuszu ${n}`;
}

/** The `<UserObject>` value of a new continuation marker to `pageId`. */
export function createSheetRefValue(pageId: string, label: string): Element {
  const value = document.implementation.createDocument(null, null, null).createElement('UserObject');
  value.setAttribute('label', label);
  value.setAttribute('link', pageLink(pageId));
  value.setAttribute(SHEET_REF_ATTR, 'continuation');
  return value;
}

export function isSheetRef(cell: Cell | null | undefined): boolean {
  const value = cell?.getValue() as unknown;
  return isElementValue(value) && value.hasAttribute(SHEET_REF_ATTR);
}

/** The target page id of a continuation marker cell, or null. */
export function sheetRefTarget(cell: Cell | null | undefined): string | null {
  const value = cell?.getValue() as unknown;
  return isElementValue(value) && value.hasAttribute(SHEET_REF_ATTR) ? linkTargetPageId(value.getAttribute('link')) : null;
}

/** Resolves a page id to its sheet number (null: no such page). */
export type SheetNumberOf = (pageId: string) => string | null;

/**
 * Updates the labels of the markers in `model` (one undoable edit when any changed); returns
 * whether something changed.
 */
export function refreshSheetRefsInModel(model: GraphDataModel, sheetNumberOf: SheetNumberOf, lang: SheetLang): boolean {
  const updates: Array<[Cell, Element]> = [];
  for (const cell of Object.values(model.cells ?? {})) {
    const value = cell.getValue() as unknown;
    if (!isElementValue(value) || !value.hasAttribute(SHEET_REF_ATTR)) continue;
    const target = linkTargetPageId(value.getAttribute('link'));
    const label = continuationLabel(target ? sheetNumberOf(target) : null, lang);
    if (value.getAttribute('label') === label) continue;
    const next = value.cloneNode(true) as Element;
    next.setAttribute('label', label);
    updates.push([cell, next]);
  }
  if (updates.length === 0) return false;
  model.beginUpdate();
  try {
    for (const [cell, value] of updates) model.setValue(cell, value);
  } finally {
    model.endUpdate();
  }
  return true;
}

/** `<mxGraphModel>` XML with the marker labels set to the target sheet numbers (exports). */
export function refreshSheetRefsInXml(modelXml: string, sheetNumberOf: SheetNumberOf, lang: SheetLang): string {
  if (!modelXml.includes(SHEET_REF_ATTR)) return modelXml;
  const doc = new DOMParser().parseFromString(modelXml, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return modelXml;
  let changed = false;
  for (const tag of ['UserObject', 'object']) {
    for (const el of Array.from(doc.getElementsByTagName(tag))) {
      if (!el.hasAttribute(SHEET_REF_ATTR)) continue;
      const target = linkTargetPageId(el.getAttribute('link'));
      el.setAttribute('label', continuationLabel(target ? sheetNumberOf(target) : null, lang));
      changed = true;
    }
  }
  if (!changed) return modelXml;
  // keep the trailing comments (PlantUML metadata) next to the model
  return Array.from(doc.childNodes)
    // getXml: newlines in attribute values (multi-line labels) stay escaped
    .map((node) => (node.nodeType === Node.ELEMENT_NODE ? xmlUtils.getXml(node as Element) : new XMLSerializer().serializeToString(node)))
    .join('\n');
}
