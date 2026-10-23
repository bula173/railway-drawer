/**
 * @file sheet-svg.ts
 * @brief The sheet as SVG in paper millimetres: the frame (ramka), the title block (tabliczka
 *        rysunkowa, layout of a typical Polish technical drawing block), the revision table
 *        (tabela zmian) and the legend box, plus the composed sheet with the drawing.
 *
 * One builder for every output: the canvas overlay (decorations only, recoloured by CSS through
 * the `rd-sheet-*` classes), Print… (inline SVG), the PDF (svg2pdf.js) and the SVG / PNG sheets.
 * Colours are explicit black on white (paper); text uses `fontFamily` (the PDF: the embedded
 * DejaVu Sans, so Polish letters print).
 */
import { LEGEND, REVISION_ROW, type Rect, type SheetGeometry } from './sheet-geometry';
import type { SheetSetup } from './sheet-setup';
import { LABELS, sheetOfText, type RevisionRow, type SheetTitleValues } from './title-block';
import type { LegendEntry } from './legend';

const SVG_NS = 'http://www.w3.org/2000/svg';
export const SHEET_FONT_FAMILY = "'DejaVu Sans', Arial, Helvetica, sans-serif";

const INK = '#000000';
const PAPER = '#ffffff';
const THICK = 0.5;
const THIN = 0.18;
const LABEL_SIZE = 2;
const VALUE_SIZE = 3.2;

export interface SheetDecorationInput {
  setup: SheetSetup;
  geometry: SheetGeometry;
  values: SheetTitleValues;
  revisions: readonly RevisionRow[];
  legend: readonly LegendEntry[];
  /** Rendered legend symbols (same order as `legend`; null: a placeholder box). */
  legendSymbols?: ReadonlyArray<SVGSVGElement | null>;
  fontFamily?: string;
  /** Also draw the paper edge (canvas overlay). */
  paperEdge?: boolean;
}

type Attrs = Record<string, string | number>;

function svgEl<K extends keyof SVGElementTagNameMap>(doc: Document, tag: K, attrs: Attrs = {}): SVGElementTagNameMap[K] {
  const el = doc.createElementNS(SVG_NS, tag) as SVGElementTagNameMap[K];
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, typeof v === 'number' ? fmt(v) : v);
  return el;
}

function fmt(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

/** Approximate advance width of `text` at `size` (mm): DejaVu Sans averages ~0.56 em (bold 0.62). */
export function approxTextWidth(text: string, size: number, bold = false): number {
  let em = 0;
  for (const ch of text) em += /[iljtf.,:;'!|() ]/.test(ch) ? 0.32 : /[mwMWŚ@%]/.test(ch) ? 0.85 : /[A-ZĄĆĘŁŃÓŚŹŻ0-9]/.test(ch) ? 0.66 : 0.55;
  return em * size * (bold ? 1.1 : 1);
}

/** The text and size that fit `maxWidth`: shrunk down to `minSize`, then cut with an ellipsis. */
export function fitText(text: string, maxWidth: number, size: number, minSize: number, bold = false): { text: string; size: number } {
  let s = size;
  while (s > minSize && approxTextWidth(text, s, bold) > maxWidth) s = Math.max(minSize, s - 0.2);
  if (approxTextWidth(text, s, bold) <= maxWidth) return { text, size: s };
  let cut = text;
  while (cut.length > 1 && approxTextWidth(`${cut}…`, s, bold) > maxWidth) cut = cut.slice(0, -1);
  return { text: `${cut.trimEnd()}…`, size: s };
}

/** Up to `lines` lines of `text` within `maxWidth` (words kept together; the last line is fitted). */
export function wrapText(text: string, maxWidth: number, size: number, lines: number, bold = false): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (approxTextWidth(next, size, bold) <= maxWidth || !line) {
      line = next;
      continue;
    }
    out.push(line);
    line = words[i];
    if (out.length === lines - 1) {
      line = words.slice(i).join(' ');
      break;
    }
  }
  if (line) out.push(line);
  return out.slice(0, lines);
}

class Painter {
  constructor(
    readonly doc: Document,
    readonly group: SVGGElement,
    readonly font: string
  ) {}

  rect(r: Rect, opts: { stroke?: number; fill?: boolean; cls?: string } = {}): void {
    this.group.appendChild(
      svgEl(this.doc, 'rect', {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        fill: opts.fill ? PAPER : 'none',
        stroke: opts.stroke ? INK : 'none',
        'stroke-width': opts.stroke ?? 0,
        class: opts.cls ?? (opts.fill ? 'rd-sheet-fill' : 'rd-sheet-line'),
      })
    );
  }

  line(x1: number, y1: number, x2: number, y2: number, width = THIN): void {
    this.group.appendChild(svgEl(this.doc, 'line', { x1, y1, x2, y2, stroke: INK, 'stroke-width': width, class: 'rd-sheet-line' }));
  }

  /** Text with its baseline at `y`; `anchor` start / middle / end. */
  text(value: string, x: number, y: number, size: number, opts: { bold?: boolean; anchor?: 'start' | 'middle' | 'end'; cls?: string; testId?: string } = {}): void {
    if (!value) return;
    const t = svgEl(this.doc, 'text', {
      x,
      y,
      'font-size': size,
      'font-family': this.font,
      fill: INK,
      class: opts.cls ?? 'rd-sheet-text',
    });
    if (opts.bold) t.setAttribute('font-weight', 'bold');
    if (opts.anchor && opts.anchor !== 'start') t.setAttribute('text-anchor', opts.anchor);
    if (opts.testId) t.setAttribute('data-field', opts.testId);
    t.textContent = value;
    this.group.appendChild(t);
  }

  /** A title-block cell: small label top-left, the value fitted below it. */
  cell(r: Rect, label: string, value: string, opts: { size?: number; bold?: boolean; field?: string; lines?: number } = {}): void {
    this.rect(r, { stroke: THIN });
    this.text(label, r.x + 1, r.y + LABEL_SIZE + 0.6, LABEL_SIZE, { cls: 'rd-sheet-text rd-sheet-label' });
    if (!value) return;
    const size = opts.size ?? VALUE_SIZE;
    const maxWidth = r.width - 2.5;
    const free = r.height - LABEL_SIZE - 1.2;
    if ((opts.lines ?? 1) > 1) {
      const lines = wrapText(value, maxWidth, size, opts.lines ?? 1, opts.bold);
      const lineHeight = size * 1.2;
      let y = r.y + LABEL_SIZE + 1.2 + (free - lines.length * lineHeight) / 2 + size * 0.95;
      lines.forEach((line, i) => {
        const fitted = fitText(line, maxWidth, size, size * 0.6, opts.bold);
        this.text(fitted.text, r.x + 1.5, y, fitted.size, { bold: opts.bold, testId: i === 0 ? opts.field : undefined });
        y += lineHeight;
      });
      return;
    }
    const fitted = fitText(value, maxWidth, size, Math.min(size, 1.8), opts.bold);
    const y = r.y + LABEL_SIZE + 1.2 + (free + fitted.size * 0.72) / 2;
    this.text(fitted.text, r.x + 1.5, y, fitted.size, { bold: opts.bold, testId: opts.field });
  }
}

function drawTitleBlock(p: Painter, tb: Rect, v: SheetTitleValues): void {
  const l = LABELS[v.lang];
  const sx = tb.width / 180;
  const X = (mm: number): number => tb.x + mm * sx;
  const W = (mm: number): number => mm * sx;
  const Y = (mm: number): number => tb.y + mm;
  p.rect(tb, { fill: true });
  // left: company, people, status
  const company: Rect = { x: X(0), y: Y(0), width: W(70), height: 14 };
  p.rect(company, { stroke: THIN });
  p.text(l.company, company.x + 1, company.y + LABEL_SIZE + 0.6, LABEL_SIZE, { cls: 'rd-sheet-text rd-sheet-label' });
  let nameX = company.x + 1.5;
  if (v.logo) {
    const img = svgEl(p.doc, 'image', { x: company.x + 1, y: company.y + 3.2, width: 18, height: 10, preserveAspectRatio: 'xMidYMid meet' });
    img.setAttribute('href', v.logo);
    p.group.appendChild(img);
    nameX = company.x + 21;
  }
  if (v.company) {
    const lines = wrapText(v.company, company.x + company.width - nameX - 1, 3.4, 2, true);
    lines.forEach((line, i) => {
      const fitted = fitText(line, company.x + company.width - nameX - 1, 3.4, 2, true);
      p.text(fitted.text, nameX, company.y + (lines.length === 1 ? 10 : 7.6 + i * 4), fitted.size, { bold: true, testId: i === 0 ? 'company' : undefined });
    });
  }
  const head: Rect = { x: X(0), y: Y(14), width: W(70), height: 5 };
  p.rect(head, { stroke: THIN });
  p.text(l.role, head.x + 1, head.y + 3.5, LABEL_SIZE, { cls: 'rd-sheet-text rd-sheet-label' });
  p.text(l.name, X(26), head.y + 3.5, LABEL_SIZE, { cls: 'rd-sheet-text rd-sheet-label' });
  const people: Array<[string, string, string]> = [
    [l.designed, v.designed, 'designed'],
    [l.checked, v.checked, 'checked'],
    [l.approved, v.approved, 'approved'],
  ];
  people.forEach(([role, name, field], i) => {
    const y = Y(19 + i * 6);
    p.rect({ x: X(0), y, width: W(25), height: 6 }, { stroke: THIN });
    p.rect({ x: X(25), y, width: W(45), height: 6 }, { stroke: THIN });
    p.text(fitText(role, W(25) - 2, 2.6, 1.8).text, X(0) + 1, y + 4.2, 2.6);
    const fitted = fitText(name, W(45) - 2.5, VALUE_SIZE, 1.8);
    p.text(fitted.text, X(25) + 1.5, y + 4.3, fitted.size, { testId: field });
  });
  p.cell({ x: X(0), y: Y(37), width: W(70), height: 13 }, l.status, v.status, { size: 4, bold: true, field: 'status' });
  // right: project, title, numbers
  p.cell({ x: X(70), y: Y(0), width: W(110), height: 14 }, l.project, v.project, { size: 4, bold: true, field: 'project', lines: 2 });
  p.cell({ x: X(70), y: Y(14), width: W(110), height: 16 }, l.title, v.title, { size: 4.6, bold: true, field: 'title', lines: 2 });
  p.cell({ x: X(70), y: Y(30), width: W(75), height: 10 }, l.drawingNumber, v.drawingNumber, { size: 3.8, bold: true, field: 'drawingNumber' });
  p.cell({ x: X(145), y: Y(30), width: W(35), height: 10 }, l.revision, v.revision, { size: 3.8, bold: true, field: 'revision' });
  p.cell({ x: X(70), y: Y(40), width: W(30), height: 10 }, l.scale, v.scale, { field: 'scale' });
  p.cell({ x: X(100), y: Y(40), width: W(40), height: 10 }, l.sheet, sheetOfText(v), { field: 'sheet' });
  p.cell({ x: X(140), y: Y(40), width: W(40), height: 10 }, l.date, v.date, { field: 'date' });
  p.rect(tb, { stroke: THICK, cls: 'rd-sheet-line rd-sheet-strong' });
}

const REVISION_COLUMNS: Array<[keyof RevisionRow, 'revRev' | 'revDate' | 'revDescription' | 'revAuthor' | 'revChecked', number]> = [
  ['rev', 'revRev', 15],
  ['date', 'revDate', 25],
  ['description', 'revDescription', 90],
  ['author', 'revAuthor', 25],
  ['checked', 'revChecked', 25],
];

function drawRevisions(p: Painter, r: Rect, rows: readonly RevisionRow[], v: SheetTitleValues): void {
  const l = LABELS[v.lang];
  const sx = r.width / 180;
  p.rect(r, { fill: true });
  let x = r.x;
  const shown = rows.length > 0 ? rows : [{ rev: '', date: '', description: '', author: '', checked: '' }];
  for (const [key, label, w] of REVISION_COLUMNS) {
    const cw = w * sx;
    p.rect({ x, y: r.y, width: cw, height: REVISION_ROW.header }, { stroke: THIN });
    p.text(fitText(l[label], cw - 2, 2.4, 1.6, true).text, x + 1, r.y + 3.5, 2.4, { bold: true });
    shown.forEach((row, i) => {
      const y = r.y + REVISION_ROW.header + i * REVISION_ROW.row;
      p.rect({ x, y, width: cw, height: REVISION_ROW.row }, { stroke: THIN });
      const fitted = fitText(row[key], cw - 2, 2.8, 1.6);
      p.text(fitted.text, x + 1, y + 3.6, fitted.size, { testId: i === 0 ? `rev-${key}` : undefined });
    });
    x += cw;
  }
  p.rect(r, { stroke: THICK, cls: 'rd-sheet-line rd-sheet-strong' });
}

function drawLegend(p: Painter, r: Rect, entries: readonly LegendEntry[], symbols: ReadonlyArray<SVGSVGElement | null> | undefined, v: SheetTitleValues): void {
  p.rect(r, { fill: true });
  p.rect(r, { stroke: THICK, cls: 'rd-sheet-line rd-sheet-strong' });
  p.text(LABELS[v.lang].legend, r.x + 2, r.y + 4.4, 3.2, { bold: true, testId: 'legend' });
  p.line(r.x, r.y + LEGEND.title, r.x + r.width, r.y + LEGEND.title);
  entries.forEach((entry, i) => {
    const col = Math.floor(i / LEGEND.rows);
    const row = i % LEGEND.rows;
    const cx = r.x + col * LEGEND.column;
    const cy = r.y + LEGEND.title + row * LEGEND.row;
    const box: Rect = { x: cx + 2, y: cy + 0.8, width: 12, height: LEGEND.row - 1.6 };
    const symbol = symbols?.[i] ?? null;
    if (symbol) {
      const vb = (symbol.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
      const sw = vb.length === 4 && vb[2] > 0 ? vb[2] : parseFloat(symbol.getAttribute('width') ?? '') || entry.width;
      const sh = vb.length === 4 && vb[3] > 0 ? vb[3] : parseFloat(symbol.getAttribute('height') ?? '') || entry.height;
      const s = Math.min(box.width / sw, box.height / sh);
      const g = svgEl(p.doc, 'g', {
        transform: `translate(${fmt(box.x + (box.width - sw * s) / 2)} ${fmt(box.y + (box.height - sh * s) / 2)}) scale(${fmt(s)})${vb.length === 4 ? ` translate(${fmt(-vb[0])} ${fmt(-vb[1])})` : ''}`,
        class: 'rd-sheet-symbol',
      });
      for (const child of Array.from(symbol.childNodes)) g.appendChild(p.doc.importNode(child, true));
      p.group.appendChild(g);
    } else {
      p.rect(box, { stroke: THIN, cls: 'rd-sheet-line rd-sheet-placeholder' });
    }
    p.text(fitText(entry.label, LEGEND.column - 18, 2.8, 1.8).text, cx + 16, cy + LEGEND.row / 2 + 1, 2.8);
  });
}

/** The frame, title block, revision table and legend of a sheet (paper mm, a `<g>`). */
export function buildSheetDecorations(doc: Document, input: SheetDecorationInput): SVGGElement {
  const group = svgEl(doc, 'g', { class: 'rd-sheet-decorations' });
  const p = new Painter(doc, group, input.fontFamily ?? SHEET_FONT_FAMILY);
  const g = input.geometry;
  if (input.paperEdge) p.rect({ x: 0, y: 0, width: g.paper.width, height: g.paper.height }, { stroke: THIN, cls: 'rd-sheet-line rd-sheet-paper' });
  if (input.setup.frame) p.rect(g.frame, { stroke: THICK, cls: 'rd-sheet-line rd-sheet-strong rd-sheet-frame' });
  if (g.legend) drawLegend(p, g.legend, input.legend, input.legendSymbols, input.values);
  if (g.revisions) drawRevisions(p, g.revisions, input.revisions, input.values);
  if (g.titleBlock) drawTitleBlock(p, g.titleBlock, input.values);
  return group;
}

/** A rendered drawing and where it goes: `source` (its SVG coordinates) is mapped onto `target` (paper mm). */
export interface SheetDrawing {
  svg: SVGSVGElement;
  source: Rect;
  target: Rect;
}

let idCounter = 0;

/** Gives every id in `root` a unique prefix (several sheets in one HTML page: Print…). */
export function prefixSvgIds(root: Element, prefix: string): void {
  const ids = new Map<string, string>();
  for (const el of Array.from(root.querySelectorAll('[id]'))) {
    const id = el.getAttribute('id')!;
    const next = `${prefix}${id}`;
    ids.set(id, next);
    el.setAttribute('id', next);
  }
  if (ids.size === 0) return;
  const fix = (value: string): string => value.replace(/url\(\s*['"]?#([^'")\s]+)['"]?\s*\)/g, (m, id: string) => (ids.has(id) ? `url(#${ids.get(id)})` : m));
  for (const el of Array.from(root.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name === 'href' || attr.name === 'xlink:href') {
        if (attr.value.startsWith('#') && ids.has(attr.value.slice(1))) el.setAttribute(attr.name, `#${ids.get(attr.value.slice(1))}`);
      } else if (attr.value.includes('url(')) {
        el.setAttribute(attr.name, fix(attr.value));
      }
    }
  }
}

/** The whole sheet: paper, the drawing (clipped to the frame), the decorations; size in mm. */
export function composeSheetSvg(doc: Document, input: SheetDecorationInput & { drawing?: SheetDrawing | null }): SVGSVGElement {
  const { width, height } = input.geometry.paper;
  const svg = svgEl(doc, 'svg', { width: `${fmt(width)}mm`, height: `${fmt(height)}mm`, viewBox: `0 0 ${fmt(width)} ${fmt(height)}` });
  svg.setAttribute('xmlns', SVG_NS);
  svg.appendChild(svgEl(doc, 'rect', { x: 0, y: 0, width, height, fill: PAPER }));
  const drawing = input.drawing;
  if (drawing) {
    const clipId = `rd-sheet-clip-${++idCounter}`;
    const defs = svgEl(doc, 'defs');
    const clip = svgEl(doc, 'clipPath', { id: clipId });
    const f = input.geometry.frame;
    clip.appendChild(svgEl(doc, 'rect', { x: f.x, y: f.y, width: f.width, height: f.height }));
    defs.appendChild(clip);
    svg.appendChild(defs);
    const outer = svgEl(doc, 'g', { 'clip-path': `url(#${clipId})` });
    const sx = drawing.target.width / Math.max(1e-6, drawing.source.width);
    const sy = drawing.target.height / Math.max(1e-6, drawing.source.height);
    const inner = svgEl(doc, 'g', {
      transform: `translate(${fmt(drawing.target.x)} ${fmt(drawing.target.y)}) scale(${sx} ${sy}) translate(${fmt(-drawing.source.x)} ${fmt(-drawing.source.y)})`,
      class: 'rd-sheet-drawing',
    });
    for (const child of Array.from(drawing.svg.childNodes)) inner.appendChild(doc.importNode(child, true));
    outer.appendChild(inner);
    svg.appendChild(outer);
  }
  svg.appendChild(buildSheetDecorations(doc, input));
  return svg;
}
