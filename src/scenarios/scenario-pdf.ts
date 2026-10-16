/**
 * @file scenario-pdf.ts
 * @brief "Export Scenario (PDF)": a real PDF file (no print dialog) built with jsPDF (+ svg2pdf.js
 *        for the UML diagrams), both pinned and loaded lazily (this module is itself a dynamic
 *        import of install-scenarios.ts), so the main bundle does not grow.
 *
 * Layout (A4 portrait or landscape): a title page (scenario name, description, diagram, date, step
 * list with page numbers), then per step one or more pages: "Step i of n", name, description, the
 * drawing, optionally its changes against the previous step (highlights + list), the UML diagram
 * and the Markdown text (pdf-layout.ts). Every page has a footer with the page number.
 *
 * Drawings are rasterized at 2x (the maxGraph SVG export uses `<foreignObject>` for HTML labels,
 * which no SVG-to-PDF converter renders); UML diagrams (plain SVG text and shapes) are drawn as
 * vectors with svg2pdf.js, falling back to a 2x raster image when that fails. Text uses the 14
 * standard fonts unless it needs other characters (Polish letters, ...): then DejaVu Sans is
 * embedded (pdf-fonts.ts); if that cannot be loaded the text is transliterated.
 */
import type { ScenarioData } from './scenario-model';
import { renderStepUml } from './step-uml';
import type { UmlRenderResult } from './step-uml';
import { renderMarkdown, sanitizeHtml } from './markdown';
import { buildDiffHighlightXml, diffSnapshots, DIFF_COLORS, DIFF_LABELS } from './scenario-diff';
import type { CellChangeKind, SnapshotDiff } from './scenario-diff';
import { PdfFlow, needsUnicodeFont, renderMarkdownBlocks } from './pdf-layout';
import type { PdfDoc, PdfFontSet } from './pdf-layout';
import type { PdfFontFiles } from './pdf-fonts';

/** A raster image: data URL + its size in CSS px at scale 1. */
export interface PdfImage {
  dataUrl: string;
  width: number;
  height: number;
}

export type PdfOrientation = 'portrait' | 'landscape';

export interface ScenarioDocOptions {
  orientation?: PdfOrientation;
  /** Highlight the changes of each step against the previous one (and list them). */
  showChanges?: boolean;
}

/** Minimal jsPDF constructor shape (the class of the lazily loaded module). */
export type JsPdfConstructor = new (options: Record<string, unknown>) => PdfDoc & {
  addFileToVFS(name: string, data: string): unknown;
  addFont(file: string, family: string, style: string): unknown;
  setProperties(props: Record<string, string>): unknown;
  setLineDashPattern(pattern: number[], phase: number): unknown;
  output(type: 'arraybuffer'): ArrayBuffer;
};

export type Svg2Pdf = (element: Element, doc: unknown, options: { x: number; y: number; width: number; height: number }) => Promise<unknown>;

export interface ScenarioPdfDeps {
  /** `<mxGraphModel>` -> PNG (2x) of the drawing. */
  renderDrawingPng(xml: string): Promise<PdfImage>;
  renderUml?(source: string): Promise<UmlRenderResult>;
  /** SVG markup -> PNG (fallback for UML that svg2pdf cannot draw); default: canvas at 2x. */
  rasterizeSvg?(svg: string): Promise<PdfImage>;
  /** Unicode fonts (default: pdf-fonts.ts); null = standard fonts only. */
  loadFonts?(): Promise<PdfFontFiles | null>;
  loadJsPdf?(): Promise<JsPdfConstructor>;
  /** svg2pdf.js (default: dynamic import); null = UML always rasterized. */
  loadSvg2Pdf?: (() => Promise<Svg2Pdf>) | null;
  now?: Date;
}

const MARGIN = 40;
const FOOTER = 34;
const PX = 0.75; // CSS px -> pt

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The SVG could not be loaded as an image'));
    img.src = url;
  });
}

function svgSize(svg: Element): { width: number; height: number } {
  const w = parseFloat(svg.getAttribute('width') ?? '');
  const h = parseFloat(svg.getAttribute('height') ?? '');
  if (w > 0 && h > 0) return { width: w, height: h };
  const vb = (svg.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
  if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) return { width: vb[2], height: vb[3] };
  return { width: 400, height: 300 };
}

/** SVG markup -> PNG data URL at `scale` (canvas; white background). */
export async function rasterizeSvgMarkup(markup: string, scale = 2): Promise<PdfImage> {
  const clean = markup.replace(/^<\?xml[^>]*\?>\s*/, '');
  const doc = new DOMParser().parseFromString(clean, 'image/svg+xml');
  const root = doc.documentElement;
  if (root.tagName.toLowerCase() !== 'svg') throw new Error('Not an SVG image');
  const { width, height } = svgSize(root);
  if (!root.getAttribute('xmlns')) root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  root.setAttribute('width', String(width));
  root.setAttribute('height', String(height));
  const text = new XMLSerializer().serializeToString(root);
  const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width * scale));
  canvas.height = Math.max(1, Math.ceil(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D canvas context');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL('image/png'), width, height };
}

/** Date as "YYYY-MM-DD HH:MM" (local time). */
function formatDate(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

interface StepParts {
  drawing: PdfImage | null;
  drawingError: string;
  uml: UmlRenderResult | null;
  diff: SnapshotDiff | null;
}

function registerFonts(doc: InstanceType<JsPdfConstructor>, files: PdfFontFiles): PdfFontSet {
  doc.addFileToVFS('DejaVuSans.ttf', files.sans);
  doc.addFileToVFS('DejaVuSans-Bold.ttf', files.sansBold);
  doc.addFileToVFS('DejaVuSansMono.ttf', files.mono);
  for (const style of ['normal', 'italic']) doc.addFont('DejaVuSans.ttf', 'DejaVuSans', style);
  for (const style of ['bold', 'bolditalic']) doc.addFont('DejaVuSans-Bold.ttf', 'DejaVuSans', style);
  for (const style of ['normal', 'bold', 'italic', 'bolditalic']) doc.addFont('DejaVuSansMono.ttf', 'DejaVuSansMono', style);
  return { sans: 'DejaVuSans', mono: 'DejaVuSansMono', unicode: true, italic: false };
}

const STANDARD_FONTS: PdfFontSet = { sans: 'helvetica', mono: 'courier', unicode: false, italic: true };

/** Points the UML SVG's fonts at the document's families (svg2pdf only knows registered fonts). */
function prepareUmlSvg(markup: string, fonts: PdfFontSet): Element | null {
  const doc = new DOMParser().parseFromString(markup.replace(/^<\?xml[^>]*\?>\s*/, ''), 'image/svg+xml');
  const root = doc.documentElement;
  if (root.tagName.toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length) return null;
  const all = [root, ...Array.from(root.getElementsByTagName('*'))];
  for (const el of all) {
    const family = el.getAttribute('font-family');
    if (family !== null || el === root) {
      el.setAttribute('font-family', /mono|courier/i.test(family ?? '') ? fonts.mono : fonts.sans);
    }
    const style = el.getAttribute('style');
    if (style && /font-family/i.test(style)) el.setAttribute('style', style.replace(/font-family\s*:[^;]*;?/gi, ''));
  }
  return root;
}

/** Builds the PDF; resolves the file bytes. */
export async function buildScenarioPdf(
  scenario: ScenarioData,
  diagramName: string,
  deps: ScenarioPdfDeps,
  options: ScenarioDocOptions = {}
): Promise<ArrayBuffer> {
  const renderUml = deps.renderUml ?? ((source: string) => renderStepUml(source));
  const rasterize = deps.rasterizeSvg ?? ((svg: string) => rasterizeSvgMarkup(svg, 2));
  const now = deps.now ?? new Date();
  const orientation: PdfOrientation = options.orientation === 'landscape' ? 'landscape' : 'portrait';
  const showChanges = options.showChanges === true;

  // 1. render every part first (async), so the layout below is synchronous
  const parts: StepParts[] = [];
  for (const [index, step] of scenario.steps.entries()) {
    const prev = index > 0 ? scenario.steps[index - 1] : null;
    let diff: SnapshotDiff | null = null;
    let xml = step.xml;
    if (showChanges && prev) {
      try {
        diff = diffSnapshots(prev.xml, step.xml);
        xml = buildDiffHighlightXml(prev.xml, step.xml, diff, { inFirstLayer: true });
      } catch {
        diff = null;
      }
    }
    let drawing: PdfImage | null = null;
    let drawingError = '';
    try {
      drawing = await deps.renderDrawingPng(xml);
    } catch (error) {
      drawingError = error instanceof Error ? error.message : String(error);
    }
    const uml = step.uml.trim() ? await renderUml(step.uml) : null;
    parts.push({ drawing, drawingError, uml, diff });
  }

  // 2. fonts: standard ones unless some text needs more than Latin-1
  const allText = [
    scenario.name,
    scenario.description,
    diagramName,
    ...scenario.steps.flatMap((s) => [s.name, s.description, s.text]),
    ...parts.flatMap((p) => [...(p.diff?.changes.map((c) => c.summary) ?? []), p.uml?.status === 'ok' ? p.uml.svg : '']),
  ].join('\n');
  const loadJsPdf = deps.loadJsPdf ?? (async () => (await import('jspdf')).jsPDF as unknown as JsPdfConstructor);
  const JsPdf = await loadJsPdf();
  const doc = new JsPdf({ orientation, unit: 'pt', format: 'a4', compress: true, putOnlyUsedFonts: true });
  let fonts = STANDARD_FONTS;
  if (needsUnicodeFont(allText)) {
    const loadFonts = deps.loadFonts ?? (async () => (await import('./pdf-fonts')).loadPdfFonts());
    const files = await loadFonts().catch(() => null);
    if (files) fonts = registerFonts(doc, files);
  }
  let svg2pdf: Svg2Pdf | null = null;
  if (parts.some((p) => p.uml?.status === 'ok')) {
    const loader = deps.loadSvg2Pdf === undefined ? async () => (await import('svg2pdf.js')).svg2pdf as unknown as Svg2Pdf : deps.loadSvg2Pdf;
    svg2pdf = loader ? await loader().catch(() => null) : null;
  }
  doc.setProperties({
    title: `${scenario.name} — ${diagramName}`,
    subject: scenario.description || `Scenario of ${diagramName}`,
    creator: 'Railway Drawer',
    keywords: 'scenario, railway, ERTMS',
  });

  const flow = new PdfFlow(doc, fonts, { margin: MARGIN, bottom: FOOTER });
  const para = (text: string, style: Parameters<PdfFlow['paragraph']>[0][number]['style'], indent = 0): void => {
    flow.paragraph([{ text, style }], { size: style.size, indent });
  };

  // 3. title page
  flow.space(flow.contentHeight * 0.12);
  doc.setFillColor('#f9a825');
  doc.rect(flow.left, flow.y, 46, 5, 'F');
  flow.space(18);
  para(scenario.name, { size: 26, bold: true, color: '#1b1b1b' });
  flow.space(6);
  if (scenario.description) {
    para(scenario.description, { size: 12, color: '#444444' });
    flow.space(8);
  }
  const meta: Array<[string, string]> = [
    ['Diagram', diagramName],
    ['Date', formatDate(now)],
    ['Steps', String(scenario.steps.length)],
  ];
  if (showChanges) meta.push(['Changes', 'highlighted against the previous step']);
  for (const [k, v] of meta) {
    flow.paragraph(
      [
        { text: `${k}: `, style: { size: 10.5, bold: true, color: '#555555' } },
        { text: v, style: { size: 10.5, color: '#333333' } },
      ],
      { size: 10.5 }
    );
  }
  flow.space(20);
  para('Steps', { size: 13, bold: true, color: '#1b1b1b' });
  flow.space(4);
  const tocTop = flow.y;
  const tocLine = 15;
  const tocFits = Math.max(1, Math.floor((flow.limit - tocTop) / tocLine));
  const stepPages: number[] = [];

  // 4. steps
  for (const [index, step] of scenario.steps.entries()) {
    const part = parts[index];
    flow.newPage();
    stepPages.push(doc.getNumberOfPages());
    para(`Step ${index + 1} of ${scenario.steps.length}`, { size: 9, color: '#8a6d00', bold: true });
    flow.space(1);
    para(`${index + 1}. ${step.name}`, { size: 16, bold: true, color: '#1b1b1b' });
    if (step.description) {
      flow.space(1);
      para(step.description, { size: 10, color: '#555555' });
    }
    flow.space(4);
    doc.setDrawColor('#f9a825');
    doc.setLineWidth(1.2);
    doc.line(flow.left, flow.y, flow.right, flow.y);
    flow.space(10);

    // drawing
    if (part.drawing) {
      const img = part.drawing;
      const maxH = flow.contentHeight * (orientation === 'landscape' ? 0.62 : 0.5);
      const s = Math.min(flow.width / (img.width * PX), maxH / (img.height * PX), 2);
      const w = img.width * PX * s;
      const h = img.height * PX * s;
      flow.ensure(h + 6);
      const x = flow.left + (flow.width - w) / 2;
      doc.addImage(img.dataUrl, 'PNG', x, flow.y, w, h, undefined, 'FAST');
      doc.setDrawColor('#e3e3e3');
      doc.setLineWidth(0.5);
      doc.rect(x, flow.y, w, h, 'S');
      flow.space(h + 10);
    } else {
      para(`The drawing could not be rendered${part.drawingError ? `: ${part.drawingError}` : '.'}`, { size: 10, italic: true, color: '#b71c1c' });
      flow.space(6);
    }

    // changes
    if (showChanges) renderChangesBlock(flow, index === 0 ? null : part.diff);

    // UML
    if (part.uml && part.uml.status !== 'empty') {
      sectionHeading(flow, 'UML');
      if (part.uml.status === 'ok') {
        await drawUml(flow, part.uml.svg, svg2pdf, rasterize);
      } else {
        para(part.uml.message, { size: 9.5, italic: true, color: '#b71c1c' });
        flow.paragraph([{ text: step.uml, style: { size: 8, mono: true, color: '#333333' } }], { size: 8, preserve: true });
      }
      flow.space(8);
    }

    // Markdown text
    if (step.text.trim()) {
      sectionHeading(flow, 'Text');
      renderMarkdownBlocks(flow, sanitizeHtml(renderMarkdown(step.text)));
    }
  }

  // 5. step list of the title page (page numbers are known now)
  doc.setPage(1);
  scenario.steps.forEach((step, i) => {
    if (i >= tocFits) return;
    const y = tocTop + i * tocLine;
    if (i === tocFits - 1 && scenario.steps.length > tocFits) {
      flow.drawLine([{ text: flow.clean(`… and ${scenario.steps.length - i} more steps`), style: { size: 10, italic: true, color: '#666666' }, width: 0 }], flow.left, y, 10, tocLine);
      return;
    }
    const label = flow.clean(`${i + 1}. ${step.name}`);
    const pageText = String(stepPages[i]);
    const style = { size: 10.5, color: '#222222' };
    const pageW = flow.measure(pageText, style);
    let text = label;
    while (text.length > 4 && flow.measure(text, style) > flow.width - pageW - 30) text = `${text.slice(0, -2)}…`;
    flow.drawLine([{ text, style, width: 0 }], flow.left, y, 10.5, tocLine);
    flow.drawLine([{ text: pageText, style, width: pageW }], flow.right - pageW, y, 10.5, tocLine);
    doc.setDrawColor('#cccccc');
    doc.setLineDashPattern([1, 2], 0);
    doc.setLineWidth(0.5);
    doc.line(flow.left + flow.measure(text, style) + 6, y + tocLine * 0.75, flow.right - pageW - 6, y + tocLine * 0.75);
    doc.setLineDashPattern([], 0);
    doc.link(flow.left, y, flow.width, tocLine, { pageNumber: stepPages[i] });
  });

  // 6. footers
  const total = doc.getNumberOfPages();
  const footerText = flow.clean(`${scenario.name} — ${diagramName}`);
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    const y = flow.pageHeight - FOOTER + 12;
    doc.setDrawColor('#dddddd');
    doc.setLineWidth(0.5);
    doc.line(flow.left, y, flow.right, y);
    const style = { size: 8, color: '#777777' };
    const pageLabel = `Page ${p} of ${total}`;
    const pw = flow.measure(pageLabel, style);
    let left = footerText;
    while (left.length > 4 && flow.measure(left, style) > flow.width - pw - 20) left = `${left.slice(0, -2)}…`;
    flow.drawLine([{ text: left, style, width: 0 }], flow.left, y + 3, 8, 12);
    flow.drawLine([{ text: pageLabel, style, width: pw }], flow.right - pw, y + 3, 8, 12);
  }
  return doc.output('arraybuffer');
}

function sectionHeading(flow: PdfFlow, title: string): void {
  flow.ensure(40);
  flow.paragraph([{ text: title.toUpperCase(), style: { size: 8.5, bold: true, color: '#777777' } }], { size: 8.5 });
  flow.space(3);
}

function renderChangesBlock(flow: PdfFlow, diff: SnapshotDiff | null): void {
  sectionHeading(flow, 'Changes since the previous step');
  if (!diff) {
    flow.paragraph([{ text: 'First step: nothing to compare with.', style: { size: 9.5, italic: true, color: '#666666' } }], { size: 9.5 });
    flow.space(8);
    return;
  }
  // legend
  const kinds: CellChangeKind[] = ['added', 'removed', 'moved', 'changed'];
  flow.ensure(14);
  let x = flow.left;
  for (const kind of kinds) {
    flow.doc.setDrawColor(DIFF_COLORS[kind]);
    flow.doc.setLineWidth(1.6);
    flow.doc.rect(x, flow.y + 3, 10, 7, 'S');
    const label = DIFF_LABELS[kind];
    const style = { size: 8.5, color: '#444444' };
    const w = flow.measure(label, style);
    flow.drawLine([{ text: label, style, width: w }], x + 14, flow.y, 8.5, 13);
    x += 14 + w + 14;
  }
  flow.space(16);
  if (diff.changes.length === 0) {
    flow.paragraph([{ text: 'No changes since the previous step.', style: { size: 9.5, italic: true, color: '#666666' } }], { size: 9.5 });
    flow.space(8);
    return;
  }
  const MAX = 20;
  for (const change of diff.changes.slice(0, MAX)) {
    let first = true;
    flow.paragraph([{ text: change.summary, style: { size: 9.5, color: '#333333' } }], {
      size: 9.5,
      indent: 12,
      decorate: (top, height) => {
        if (!first) return;
        first = false;
        flow.doc.setFillColor(DIFF_COLORS[change.kind]);
        flow.doc.rect(flow.left + 2, top + height / 2 - 3, 6, 6, 'F');
      },
    });
  }
  if (diff.changes.length > MAX) {
    flow.paragraph([{ text: `… and ${diff.changes.length - MAX} more`, style: { size: 9.5, italic: true, color: '#666666' } }], { size: 9.5, indent: 12 });
  }
  flow.space(8);
}

async function drawUml(flow: PdfFlow, markup: string, svg2pdf: Svg2Pdf | null, rasterize: (svg: string) => Promise<PdfImage>): Promise<void> {
  const fit = (width: number, height: number): { w: number; h: number } => {
    const s = Math.min(flow.width / (width * PX), flow.contentHeight / (height * PX), 1.4);
    return { w: width * PX * s, h: height * PX * s };
  };
  if (svg2pdf) {
    const svg = prepareUmlSvg(markup, flow.fonts);
    if (svg) {
      const size = svgSize(svg);
      const { w, h } = fit(size.width, size.height);
      flow.ensure(h);
      // svg2pdf reads computed styles: render from an attached, invisible copy
      const holder = document.createElement('div');
      holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:0;height:0;overflow:hidden;';
      const node = document.importNode(svg, true);
      holder.appendChild(node);
      document.body.appendChild(holder);
      try {
        // svg2pdf only changes the font style where an element's weight differs from its parent's:
        // start from the regular face (the section heading before it is bold)
        flow.applyFont({ size: 10 });
        await svg2pdf(node, flow.doc, { x: flow.left, y: flow.y, width: w, height: h });
        flow.space(h);
        return;
      } catch (error) {
        console.warn('[Scenarios] UML as vector failed, using an image:', error);
      } finally {
        holder.remove();
      }
    }
  }
  try {
    const img = await rasterize(markup);
    const { w, h } = fit(img.width, img.height);
    flow.ensure(h);
    flow.doc.addImage(img.dataUrl, 'PNG', flow.left, flow.y, w, h, undefined, 'FAST');
    flow.space(h);
  } catch (error) {
    flow.paragraph([{ text: `The UML diagram could not be embedded: ${error instanceof Error ? error.message : String(error)}`, style: { size: 9.5, italic: true, color: '#b71c1c' } }], { size: 9.5 });
  }
}

/** File name "<diagram> - <scenario>.pdf". */
export function scenarioPdfFileName(diagramName: string, scenarioName: string): string {
  // eslint-disable-next-line no-control-regex
  const clean = (s: string): string => s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim();
  return `${clean(diagramName) || 'diagram'} - ${clean(scenarioName) || 'scenario'}.pdf`;
}
