/**
 * @file sheet-export.ts
 * @brief File > Export > Sheets…, File > Print… (lazy chunk): one sheet per drawing page (or the
 *        chosen pages) with frame, title block, revision table and legend.
 *
 * - PDF: jsPDF + svg2pdf.js (both pinned, loaded on first use). The composed sheet SVG
 *   (sheet-svg.ts) is drawn as vectors: HTML labels (`<foreignObject>`, which no SVG-to-PDF
 *   converter draws) become SVG text first; a sheet svg2pdf cannot draw is embedded as a 2x
 *   raster image instead. Text uses the embedded DejaVu Sans (scenarios/pdf-fonts.ts), so Polish
 *   letters print; without it the 14 standard fonts.
 * - Print…: the composed sheets (inline SVG, HTML labels as in the editor) in a print-only
 *   container; print-sheets.css hides the app and gives each sheet its own paper size (named
 *   pages); no inline script or style element (CSP).
 * - SVG / PNG: one file per sheet.
 *
 * The drawing of a fixed-scale sheet is the page's region (0, 0) - page size x pageScale in
 * drawing units (draw.io page view); a marker cell at the origin locates it in the rendered SVG.
 * A fitted drawing is scaled into the largest free area beside / above the blocks.
 */
import { renderXmlToSvg, stripModelComments } from '../../ui/diagram-image-export';
import { globalNotificationManager } from '../../ui/notification';
import { openAppModal } from '../../ui/app-dialogs';
import type { DiagramSession } from '../../ui/session';
import { downloadBlob, safeFileName } from '../../share/ui/modal';
import { loadPdfFonts, type PdfFontFiles } from '../../scenarios/pdf-fonts';
import { fitPlacement } from '../sheet-geometry';
import { legendSymbolModelXml } from '../legend';
import { planSheets, type SheetPlan } from '../sheet-plan';
import { composeSheetSvg, prefixSvgIds, SHEET_FONT_FAMILY, type SheetDrawing } from '../sheet-svg';
import { ensureLegendLibrary } from './legend-library';
import './print-sheets.css';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MARKER_COLOR = '#fe01fe';
const PDF_FONT = 'DejaVuSans';

export type SheetOutput = 'pdf' | 'svg' | 'png' | 'print';

interface JsPdfDoc {
  addPage(format: number[], orientation: 'portrait' | 'landscape'): unknown;
  addFileToVFS(name: string, data: string): unknown;
  addFont(file: string, family: string, style: string): unknown;
  setFont(family: string, style?: string): unknown;
  setProperties(props: Record<string, string>): unknown;
  addImage(data: string, format: string, x: number, y: number, w: number, h: number, alias?: string, compression?: string): unknown;
  output(type: 'arraybuffer'): ArrayBuffer;
}
type JsPdfCtor = new (options: Record<string, unknown>) => JsPdfDoc;
type Svg2Pdf = (element: Element, doc: unknown, options: { x: number; y: number; width: number; height: number }) => Promise<unknown>;

// ---- drawing ---------------------------------------------------------------------------------------

function hasCells(modelXml: string): boolean {
  return /\b(vertex|edge)="1"/.test(modelXml);
}

/** The model with a 1x1 marker cell at the drawing origin (fixed-scale sheets). */
function withOriginMarker(modelXml: string): string {
  const marker = `<mxCell id="rd-sheet-origin" value="" style="fillColor=none;strokeColor=${MARKER_COLOR};strokeWidth=1;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="1" height="1" as="geometry"/></mxCell>`;
  return modelXml.replace(/<\/root>/, `${marker}</root>`);
}

/** Translation of `el` within `root` (translate() transforms only, as the SVG export writes them). */
function accumulatedTranslate(el: Element, root: Element): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (let node: Element | null = el.parentElement; node && node !== root; node = node.parentElement) {
    const m = /translate\(\s*([-\d.e]+)[\s,]+([-\d.e]+)?\s*\)/.exec(node.getAttribute('transform') ?? '');
    if (m) {
      x += Number(m[1]) || 0;
      y += Number(m[2] ?? 0) || 0;
    }
  }
  return { x, y };
}

/** The drawing of a sheet: rendered (light, every visible layer) and placed (fixed scale or fit). */
async function renderSheetDrawing(plan: SheetPlan): Promise<SheetDrawing | null> {
  const xml = stripModelComments(plan.modelXml);
  if (!hasCells(xml)) return null;
  const { geometry, setup } = plan;
  if (setup.scaleMode === 'fixed') {
    const svg = await renderXmlToSvg(withOriginMarker(xml), { border: 0 });
    const marker = Array.from(svg.querySelectorAll('[stroke]')).find((n) => n.getAttribute('stroke')?.toLowerCase() === MARKER_COLOR);
    let origin = { x: 0, y: 0 };
    if (marker) {
      const t = accumulatedTranslate(marker, svg);
      const ownX = Number(marker.getAttribute('x') ?? /M\s*([-\d.e]+)/.exec(marker.getAttribute('d') ?? '')?.[1] ?? 0);
      const ownY = Number(marker.getAttribute('y') ?? /M\s*[-\d.e]+[\s,]+([-\d.e]+)/.exec(marker.getAttribute('d') ?? '')?.[1] ?? 0);
      origin = { x: t.x + Math.round(ownX), y: t.y + Math.round(ownY) };
      (marker.closest('g') ?? marker).remove();
    }
    const sheet = geometry.sheetInDrawing;
    return { svg, source: { x: origin.x, y: origin.y, width: sheet.width, height: sheet.height }, target: { x: 0, y: 0, width: geometry.paper.width, height: geometry.paper.height } };
  }
  const svg = await renderXmlToSvg(xml, { border: 0 });
  const width = Math.max(1, parseFloat(svg.getAttribute('width') ?? '1'));
  const height = Math.max(1, parseFloat(svg.getAttribute('height') ?? '1'));
  const placed = fitPlacement(geometry, { width, height });
  return { svg, source: { x: 0, y: 0, width, height }, target: placed.rect };
}

async function renderLegendSymbols(plan: SheetPlan): Promise<Array<SVGSVGElement | null>> {
  return Promise.all(plan.legend.map((entry) => renderXmlToSvg(legendSymbolModelXml(entry), { border: 1 }).catch(() => null)));
}

/** The composed sheet SVG of a plan (paper mm). */
export async function buildSheetSvg(plan: SheetPlan, fontFamily = SHEET_FONT_FAMILY): Promise<SVGSVGElement> {
  const [drawing, legendSymbols] = await Promise.all([renderSheetDrawing(plan), renderLegendSymbols(plan)]);
  return composeSheetSvg(document, { setup: plan.setup, geometry: plan.geometry, values: plan.values, revisions: plan.revisions, legend: plan.legend, legendSymbols, fontFamily, drawing });
}

// ---- foreignObject -> text (svg2pdf) ------------------------------------------------------------------

function cssValue(style: string, name: string): string {
  const m = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, 'i').exec(style);
  return m ? m[1].trim() : '';
}

function px(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/** Text lines of an HTML label (`<br>` and block elements break lines). */
function labelLines(root: Element): string[] {
  const lines: string[] = [''];
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      lines[lines.length - 1] += node.textContent ?? '';
      return;
    }
    if (!(node instanceof Element)) return;
    const tag = node.localName.toLowerCase();
    if (tag === 'br') {
      lines.push('');
      return;
    }
    const block = tag === 'div' || tag === 'p' || tag === 'li';
    if (block && lines[lines.length - 1].trim() !== '') lines.push('');
    node.childNodes.forEach(walk);
    if (block && lines[lines.length - 1].trim() !== '') lines.push('');
  };
  root.childNodes.forEach(walk);
  return lines.map((l) => l.replace(/\s+/g, ' ').trim()).filter((l, i, all) => l !== '' || (i > 0 && i < all.length - 1));
}

/**
 * Replaces the HTML labels (`<foreignObject>` of maxGraph's SVG) by SVG text at the same place
 * (maxGraph's label layout: an outer flex box with margin-left / padding-top / width, the text
 * style on the innermost box). `<switch>` fallbacks are dropped.
 */
export function foreignObjectsToText(svg: Element, fontFamily: string): number {
  let converted = 0;
  for (const sw of Array.from(svg.getElementsByTagNameNS(SVG_NS, 'switch'))) {
    const fo = Array.from(sw.children).find((c) => c.localName === 'foreignObject');
    if (!fo) continue;
    sw.parentNode?.insertBefore(fo, sw);
    sw.remove();
  }
  for (const fo of Array.from(svg.getElementsByTagNameNS(SVG_NS, 'foreignObject'))) {
    const outer = fo.firstElementChild as HTMLElement | null;
    const styled = Array.from(fo.querySelectorAll('[style]')).filter((n) => /font-size\s*:\s*[1-9]/.test(n.getAttribute('style') ?? '')).pop() ?? outer;
    const text = styled ?? outer;
    if (!outer || !text) {
      fo.remove();
      continue;
    }
    const os = outer.getAttribute('style') ?? '';
    const ts = text.getAttribute('style') ?? '';
    const width = px(cssValue(os, 'width'));
    const left = px(cssValue(os, 'margin-left'));
    const top = px(cssValue(os, 'padding-top')) + px(cssValue(os, 'margin-top'));
    const justify = cssValue(os, 'justify-content');
    const align = cssValue(os, 'align-items');
    const size = px(cssValue(ts, 'font-size')) || 12;
    const lineHeight = (parseFloat(cssValue(ts, 'line-height')) || 1.2) * size;
    const lines = labelLines(text);
    if (lines.length === 0) {
      fo.remove();
      continue;
    }
    const anchor = /flex-start|left/.test(justify) ? 'start' : /flex-end|right/.test(justify) ? 'end' : 'middle';
    const x = anchor === 'start' ? left : anchor === 'end' ? left + width : left + width / 2;
    const block = lines.length * lineHeight;
    const y0 = /flex-start/.test(align) ? top : /flex-end/.test(align) ? top - block : top - block / 2;
    const el = svg.ownerDocument.createElementNS(SVG_NS, 'text');
    el.setAttribute('x', String(x));
    el.setAttribute('font-size', String(size));
    el.setAttribute('font-family', fontFamily);
    el.setAttribute('text-anchor', anchor);
    el.setAttribute('fill', cssValue(ts, 'color') || '#000000');
    const weight = cssValue(ts, 'font-weight');
    if (weight === 'bold' || Number(weight) >= 600) el.setAttribute('font-weight', 'bold');
    lines.forEach((line, i) => {
      const span = svg.ownerDocument.createElementNS(SVG_NS, 'tspan');
      span.setAttribute('x', String(x));
      span.setAttribute('y', String(y0 + i * lineHeight + size * 0.85));
      span.textContent = line;
      el.appendChild(span);
    });
    fo.parentNode?.replaceChild(el, fo);
    converted++;
  }
  return converted;
}

// ---- PDF ---------------------------------------------------------------------------------------------

function registerFonts(doc: JsPdfDoc, files: PdfFontFiles): void {
  doc.addFileToVFS('DejaVuSans.ttf', files.sans);
  doc.addFileToVFS('DejaVuSans-Bold.ttf', files.sansBold);
  for (const style of ['normal', 'italic']) doc.addFont('DejaVuSans.ttf', PDF_FONT, style);
  for (const style of ['bold', 'bolditalic']) doc.addFont('DejaVuSans-Bold.ttf', PDF_FONT, style);
}

async function rasterize(svg: SVGSVGElement, widthMm: number, heightMm: number, dpi: number): Promise<string> {
  const pxPerMm = dpi / 25.4;
  const w = Math.max(1, Math.round(widthMm * pxPerMm));
  const h = Math.max(1, Math.round(heightMm * pxPerMm));
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.setAttribute('width', String(w));
  copy.setAttribute('height', String(h));
  const markup = new XMLSerializer().serializeToString(copy);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The sheet could not be rasterized'));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  });
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D canvas context');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/png');
}

/** DPI of raster sheets: lower for the large formats (canvas size limits). */
function rasterDpi(widthMm: number, heightMm: number, wanted: number): number {
  const maxSide = 8000;
  return Math.max(36, Math.min(wanted, (maxSide * 25.4) / Math.max(widthMm, heightMm)));
}

export interface SheetPdfResult {
  bytes: ArrayBuffer;
  pages: number;
  vector: number;
  raster: number;
}

/** The PDF of the planned sheets (one page each, in its paper size). */
export async function buildSheetsPdf(plans: readonly SheetPlan[], title: string): Promise<SheetPdfResult> {
  const [{ jsPDF }, svg2pdfModule, fonts] = await Promise.all([import('jspdf'), import('svg2pdf.js').catch(() => null), loadPdfFonts()]);
  const JsPdf = jsPDF as unknown as JsPdfCtor;
  const svg2pdf = (svg2pdfModule?.svg2pdf ?? null) as unknown as Svg2Pdf | null;
  const fontFamily = fonts ? PDF_FONT : 'helvetica';
  let pdf: JsPdfDoc | null = null;
  let vector = 0;
  let raster = 0;
  for (const plan of plans) {
    const { width, height } = plan.geometry.paper;
    const orientation = width > height ? 'landscape' : 'portrait';
    if (!pdf) {
      pdf = new JsPdf({ unit: 'mm', format: [width, height], orientation, compress: true });
      if (fonts) registerFonts(pdf, fonts);
      pdf.setProperties({ title, creator: 'Railway Drawer', subject: 'Drawing sheets' });
    } else {
      pdf.addPage([width, height], orientation);
    }
    const svg = await buildSheetSvg(plan, fontFamily);
    let drawn = false;
    if (svg2pdf) {
      const vectorSvg = svg.cloneNode(true) as SVGSVGElement;
      foreignObjectsToText(vectorSvg, fontFamily);
      for (const t of Array.from(vectorSvg.getElementsByTagNameNS(SVG_NS, 'text'))) {
        t.setAttribute('font-family', fontFamily);
        (t as SVGElement).style.removeProperty('font-family');
      }
      // svg2pdf reads computed styles: draw from an attached, invisible copy
      const holder = document.createElement('div');
      holder.className = 'rd-print-offscreen';
      holder.style.cssText = 'position:fixed;left:-20000px;top:0;width:0;height:0;overflow:hidden;';
      holder.appendChild(vectorSvg);
      document.body.appendChild(holder);
      try {
        pdf.setFont(fontFamily, 'normal');
        await svg2pdf(vectorSvg, pdf, { x: 0, y: 0, width, height });
        drawn = true;
        vector++;
      } catch (error) {
        console.warn('[Print] Sheet as vector failed, using an image:', error);
      } finally {
        holder.remove();
      }
    }
    if (!drawn) {
      const png = await rasterize(svg, width, height, rasterDpi(width, height, 200));
      pdf.addImage(png, 'PNG', 0, 0, width, height, undefined, 'FAST');
      raster++;
    }
  }
  if (!pdf) throw new Error('No sheet to export');
  return { bytes: pdf.output('arraybuffer'), pages: plans.length, vector, raster };
}

// ---- outputs -----------------------------------------------------------------------------------------

function sheetFileBase(projectName: string, plan: SheetPlan): string {
  return `${safeFileName(projectName)} - ${safeFileName(plan.values.sheetNumber, String(plan.page.index + 1))} ${safeFileName(plan.page.name, 'sheet')}`;
}

async function plansFor(session: DiagramSession, pages: readonly number[] | undefined): Promise<SheetPlan[]> {
  await ensureLegendLibrary();
  return planSheets(session.document, pages);
}

/** Exports the chosen pages of `session` as `output`; returns the number of sheets. */
export async function exportSheets(session: DiagramSession, output: SheetOutput, pages?: readonly number[]): Promise<number> {
  const plans = await plansFor(session, pages);
  if (plans.length === 0) throw new Error('No page to export');
  const name = session.document.getProjectName() || 'diagram';
  if (output === 'pdf') {
    const result = await buildSheetsPdf(plans, name);
    downloadBlob(new Blob([result.bytes], { type: 'application/pdf' }), `${safeFileName(name)} - sheets.pdf`);
    return result.pages;
  }
  if (output === 'print') {
    await printSheets(plans);
    return plans.length;
  }
  for (const plan of plans) {
    const svg = await buildSheetSvg(plan);
    if (output === 'svg') {
      const markup = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg);
      downloadBlob(new Blob([markup], { type: 'image/svg+xml' }), `${sheetFileBase(name, plan)}.svg`);
    } else {
      const { width, height } = plan.geometry.paper;
      const dataUrl = await rasterize(svg, width, height, rasterDpi(width, height, 150));
      downloadBlob(await (await fetch(dataUrl)).blob(), `${sheetFileBase(name, plan)}.png`);
    }
  }
  return plans.length;
}

const PRINT_ROOT_ID = 'rd-print-root';

/** Print…: the sheets in the print-only container, then the browser's print dialog. */
export async function printSheets(plans: readonly SheetPlan[]): Promise<HTMLElement> {
  document.getElementById(PRINT_ROOT_ID)?.remove();
  const root = document.createElement('div');
  root.id = PRINT_ROOT_ID;
  root.setAttribute('aria-hidden', 'true');
  let i = 0;
  for (const plan of plans) {
    const svg = await buildSheetSvg(plan);
    prefixSvgIds(svg, `rd-print-${++i}-`);
    const sheet = document.createElement('div');
    sheet.className = 'rd-print-sheet';
    sheet.dataset.paper = `${plan.setup.format}-${plan.setup.orientation}`;
    sheet.dataset.page = String(plan.page.index);
    sheet.appendChild(svg);
    root.appendChild(sheet);
  }
  document.body.appendChild(root);
  const cleanup = (): void => {
    window.removeEventListener('afterprint', cleanup);
    root.remove();
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
  return root;
}

// ---- dialog ------------------------------------------------------------------------------------------

/** File > Export > Sheets… / File > Print…: which pages, which output. */
export function openExportSheetsDialog(session: DiagramSession, mode: 'export' | 'print'): void {
  const pages = session.document.listPages();
  const title = mode === 'print' ? 'Print Sheets' : 'Export Sheets';
  const modal = openAppModal({ title, testId: 'export-sheets-dialog', className: 'rd-print-dialog', onSubmit: () => void run() });
  const hint = document.createElement('p');
  hint.className = 'rd-print-hint';
  hint.textContent = 'One sheet per drawing page with frame, title block, revision table and legend (File > Page Setup…, Title Block…, Revisions…).';
  modal.body.appendChild(hint);
  const fsPages = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = 'Pages';
  fsPages.appendChild(legend);
  const boxes: HTMLInputElement[] = [];
  for (const page of pages) {
    const row = document.createElement('label');
    row.className = 'rd-print-check';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.name = `page-${page.index}`;
    box.value = String(page.index);
    box.checked = true;
    boxes.push(box);
    row.append(box, document.createTextNode(`${page.index + 1}. ${page.name}${page.shown ? ' (shown)' : ''}`));
    fsPages.appendChild(row);
  }
  modal.body.appendChild(fsPages);
  const outputs: HTMLInputElement[] = [];
  if (mode === 'export') {
    const fsOut = document.createElement('fieldset');
    const legendOut = document.createElement('legend');
    legendOut.textContent = 'Output';
    fsOut.appendChild(legendOut);
    for (const [value, label] of [
      ['pdf', 'PDF (one page per sheet, vector)'],
      ['svg', 'SVG (one file per sheet)'],
      ['png', 'PNG (one file per sheet)'],
    ] as const) {
      const row = document.createElement('label');
      row.className = 'rd-print-check';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'output';
      radio.value = value;
      radio.checked = value === 'pdf';
      outputs.push(radio);
      row.append(radio, document.createTextNode(label));
      fsOut.appendChild(row);
    }
    modal.body.appendChild(fsOut);
  }
  const run = async (): Promise<void> => {
    const chosen = boxes.filter((b) => b.checked).map((b) => Number(b.value));
    if (chosen.length === 0) {
      globalNotificationManager.info('Choose at least one page.');
      return;
    }
    const output: SheetOutput = mode === 'print' ? 'print' : ((outputs.find((r) => r.checked)?.value as SheetOutput | undefined) ?? 'pdf');
    modal.close();
    try {
      const count = await exportSheets(session, output, chosen);
      if (output !== 'print') globalNotificationManager.success(`Exported ${count} sheet${count === 1 ? '' : 's'}`);
    } catch (error) {
      console.error('[Print] Sheet export failed:', error);
      globalNotificationManager.error(`Sheet export failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'rd-tpl-btn';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => modal.close());
  const ok = document.createElement('button');
  ok.type = 'button';
  ok.className = 'rd-tpl-btn rd-tpl-btn-primary';
  ok.textContent = mode === 'print' ? 'Print' : 'Export';
  ok.addEventListener('click', () => void run());
  modal.actions.append(cancel, ok);
  ok.focus();
}

