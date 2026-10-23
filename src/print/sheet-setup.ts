/**
 * @file sheet-setup.ts
 * @brief Sheet setup of one drawing page: paper format and orientation, scale (fit to the sheet or a
 *        fixed 1:n), margins, frame with filing margin, which blocks are printed, and the page's own
 *        title-block values (sheet title / number, drawing number).
 *
 * Stored draw.io-compatibly per page:
 * - draw.io's own `<mxGraphModel pageWidth pageHeight pageScale>` (File > Page Setup in draw.io):
 *   the format and orientation are read back from the page size (draw.io's px sizes of A0–A4),
 *   the fixed scale 1:n is `pageScale = n` (the page then covers n times as much drawing, as in
 *   draw.io's page view);
 * - attributes of the page's root cell (cell "0", draw.io's Edit Data of the diagram, kept by
 *   draw.io) for the rest: `rdSheetScale` (fit | fixed), `rdSheetMargins` ("top right bottom left"
 *   mm), `rdSheetFiling` (mm), `rdSheetFrame` / `rdSheetTitleBlock` / `rdSheetRevisions` /
 *   `rdSheetLegend` ("0" = off), `rdSheetTitle`, `rdSheetNumber`, `rdDrawingNumber`.
 */
import type { GraphDataModel } from '@maxgraph/core';
import type { PageSettings } from '../format/drawio-xml';
import { isElementValue } from '../railway/object-data';

export type SheetFormatId = 'A0' | 'A1' | 'A2' | 'A3' | 'A4';
export type SheetOrientation = 'portrait' | 'landscape';
export type SheetScaleMode = 'fit' | 'fixed';

/** Portrait sizes: millimetres and draw.io's page format in px (draw.io PageSetupDialog). */
export const SHEET_FORMATS: Readonly<Record<SheetFormatId, { mm: readonly [number, number]; px: readonly [number, number] }>> = {
  A0: { mm: [841, 1189], px: [3300, 4681] },
  A1: { mm: [594, 841], px: [2339, 3300] },
  A2: { mm: [420, 594], px: [1654, 2336] },
  A3: { mm: [297, 420], px: [1169, 1654] },
  A4: { mm: [210, 297], px: [827, 1169] },
};

export const SHEET_FORMAT_IDS = Object.keys(SHEET_FORMATS) as SheetFormatId[];

/** draw.io px per mm (100 dpi). */
export const PX_PER_MM = 100 / 25.4;

export interface SheetMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface SheetSetup {
  /** 'custom': a draw.io page size that is no A format (the paper follows the px size). */
  format: SheetFormatId | 'custom';
  orientation: SheetOrientation;
  /** Paper size in mm (from the format, or the custom page size). */
  paper: { width: number; height: number };
  /** draw.io page size (px) at scale 1. */
  pagePx: { width: number; height: number };
  scaleMode: SheetScaleMode;
  /** n of 1:n (draw.io pageScale); 1 when fitting. */
  scale: number;
  /** Frame distance from the paper edge (mm). */
  margins: SheetMargins;
  /** Filing margin added on the left (mm; 0 = none). */
  filing: number;
  frame: boolean;
  titleBlock: boolean;
  revisions: boolean;
  legend: boolean;
  /** Per-page title-block values ('' = the document's). */
  sheetTitle: string;
  sheetNumber: string;
  drawingNumber: string;
}

export const DEFAULT_MARGINS: Readonly<SheetMargins> = { top: 10, right: 10, bottom: 10, left: 10 };
export const DEFAULT_FILING = 10;

export const SHEET_ATTRS = {
  scale: 'rdSheetScale',
  margins: 'rdSheetMargins',
  filing: 'rdSheetFiling',
  frame: 'rdSheetFrame',
  titleBlock: 'rdSheetTitleBlock',
  revisions: 'rdSheetRevisions',
  legend: 'rdSheetLegend',
  sheetTitle: 'rdSheetTitle',
  sheetNumber: 'rdSheetNumber',
  drawingNumber: 'rdDrawingNumber',
} as const;

/** The paper (mm) and draw.io page (px) of a format in an orientation. */
export function formatSize(format: SheetFormatId, orientation: SheetOrientation): { paper: { width: number; height: number }; pagePx: { width: number; height: number } } {
  const { mm, px } = SHEET_FORMATS[format];
  const landscape = orientation === 'landscape';
  return {
    paper: { width: landscape ? mm[1] : mm[0], height: landscape ? mm[0] : mm[1] },
    pagePx: { width: landscape ? px[1] : px[0], height: landscape ? px[0] : px[1] },
  };
}

/** The A format of a draw.io page size (either orientation, ±3 px), or null. */
export function matchFormat(width: number, height: number): { format: SheetFormatId; orientation: SheetOrientation } | null {
  for (const format of SHEET_FORMAT_IDS) {
    const [w, h] = SHEET_FORMATS[format].px;
    if (Math.abs(width - w) <= 3 && Math.abs(height - h) <= 3) return { format, orientation: 'portrait' };
    if (Math.abs(width - h) <= 3 && Math.abs(height - w) <= 3) return { format, orientation: 'landscape' };
  }
  return null;
}

function rootAttrs(model: GraphDataModel): Element | null {
  const value = model.getRoot()?.getValue() as unknown;
  return isElementValue(value) ? value : null;
}

function num(text: string | null | undefined, fallback: number, min = 0, max = 500): number {
  const n = Number(text);
  return text != null && text.trim() !== '' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function parseMargins(text: string | null): SheetMargins {
  const parts = (text ?? '').trim().split(/[\s,;]+/).filter(Boolean).map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return { ...DEFAULT_MARGINS };
  const [top, right, bottom, left] = parts.map((n) => Math.min(100, Math.max(0, n)));
  return { top, right, bottom, left };
}

/** The sheet setup of a page from its page settings and root-cell attributes. */
export function readSheetSetup(page: PageSettings, model: GraphDataModel | null): SheetSetup {
  const attrs = model ? rootAttrs(model) : null;
  return sheetSetupFrom(page, (name) => (attrs?.hasAttribute(name) ? attrs.getAttribute(name) : null));
}

/** readSheetSetup over an attribute getter (the model, or a root cell parsed from page XML). */
export function sheetSetupFrom(page: PageSettings, attr: (name: string) => string | null): SheetSetup {
  const pageWidth = page.pageWidth && page.pageWidth > 0 ? page.pageWidth : SHEET_FORMATS.A4.px[0];
  const pageHeight = page.pageHeight && page.pageHeight > 0 ? page.pageHeight : SHEET_FORMATS.A4.px[1];
  const matched = matchFormat(pageWidth, pageHeight);
  const size = matched
    ? formatSize(matched.format, matched.orientation)
    : { paper: { width: pageWidth / PX_PER_MM, height: pageHeight / PX_PER_MM }, pagePx: { width: pageWidth, height: pageHeight } };
  const scaleMode: SheetScaleMode = attr(SHEET_ATTRS.scale) === 'fixed' ? 'fixed' : 'fit';
  const on = (name: string): boolean => attr(name) !== '0';
  return {
    format: matched?.format ?? 'custom',
    orientation: matched?.orientation ?? (pageWidth > pageHeight ? 'landscape' : 'portrait'),
    paper: size.paper,
    pagePx: size.pagePx,
    scaleMode,
    scale: scaleMode === 'fixed' ? num(String(page.pageScale ?? 1), 1, 0.01, 10000) : 1,
    margins: parseMargins(attr(SHEET_ATTRS.margins)),
    filing: num(attr(SHEET_ATTRS.filing), DEFAULT_FILING, 0, 100),
    frame: on(SHEET_ATTRS.frame),
    titleBlock: on(SHEET_ATTRS.titleBlock),
    revisions: on(SHEET_ATTRS.revisions),
    legend: on(SHEET_ATTRS.legend),
    sheetTitle: attr(SHEET_ATTRS.sheetTitle) ?? '',
    sheetNumber: attr(SHEET_ATTRS.sheetNumber) ?? '',
    drawingNumber: attr(SHEET_ATTRS.drawingNumber) ?? '',
  };
}

/** What the Sheet Setup dialog edits. */
export interface SheetSetupInput {
  format: SheetFormatId;
  orientation: SheetOrientation;
  scaleMode: SheetScaleMode;
  scale: number;
  margins: SheetMargins;
  filing: number;
  frame: boolean;
  titleBlock: boolean;
  revisions: boolean;
  legend: boolean;
  sheetTitle: string;
  sheetNumber: string;
  drawingNumber: string;
}

/** The draw.io page settings of a setup. */
export function pageSettingsFor(input: Pick<SheetSetupInput, 'format' | 'orientation' | 'scaleMode' | 'scale'>): Pick<PageSettings, 'pageWidth' | 'pageHeight' | 'pageScale'> {
  const { pagePx } = formatSize(input.format, input.orientation);
  return { pageWidth: pagePx.width, pageHeight: pagePx.height, pageScale: input.scaleMode === 'fixed' ? input.scale : 1 };
}

/** The root-cell attributes of a setup (null = removed: the default). */
export function sheetAttributesFor(input: SheetSetupInput): Record<string, string | null> {
  const m = input.margins;
  const defaultMargins = m.top === DEFAULT_MARGINS.top && m.right === DEFAULT_MARGINS.right && m.bottom === DEFAULT_MARGINS.bottom && m.left === DEFAULT_MARGINS.left;
  const flag = (on: boolean): string | null => (on ? null : '0');
  const text = (value: string): string | null => (value.trim() ? value.trim() : null);
  return {
    [SHEET_ATTRS.scale]: input.scaleMode === 'fixed' ? 'fixed' : null,
    [SHEET_ATTRS.margins]: defaultMargins ? null : `${m.top} ${m.right} ${m.bottom} ${m.left}`,
    [SHEET_ATTRS.filing]: input.filing === DEFAULT_FILING ? null : String(input.filing),
    [SHEET_ATTRS.frame]: flag(input.frame),
    [SHEET_ATTRS.titleBlock]: flag(input.titleBlock),
    [SHEET_ATTRS.revisions]: flag(input.revisions),
    [SHEET_ATTRS.legend]: flag(input.legend),
    [SHEET_ATTRS.sheetTitle]: text(input.sheetTitle),
    [SHEET_ATTRS.sheetNumber]: text(input.sheetNumber),
    [SHEET_ATTRS.drawingNumber]: text(input.drawingNumber),
  };
}

/**
 * Writes root-cell attributes (null removes one) in the current model transaction, or its own;
 * returns whether anything changed. The root's value becomes an `<object>` when it was none.
 */
export function writeRootAttributes(model: GraphDataModel, attrs: Record<string, string | null>): boolean {
  const root = model.getRoot();
  if (!root) return false;
  const current = root.getValue() as unknown;
  const element = isElementValue(current)
    ? (current.cloneNode(true) as Element)
    : document.implementation.createDocument(null, null, null).createElement('object');
  if (!isElementValue(current)) element.setAttribute('label', typeof current === 'string' ? current : '');
  let changed = false;
  for (const [name, value] of Object.entries(attrs)) {
    const before = element.hasAttribute(name) ? element.getAttribute(name) : null;
    if (before === value) continue;
    changed = true;
    if (value === null) element.removeAttribute(name);
    else element.setAttribute(name, value);
  }
  if (!changed) return false;
  model.beginUpdate();
  try {
    model.setValue(root, element);
  } finally {
    model.endUpdate();
  }
  return true;
}
