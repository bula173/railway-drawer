/**
 * @file pdf-layout.ts
 * @brief Text flow for the scenario PDF (scenario-pdf.ts) on a jsPDF document: wrapped styled runs,
 *        page breaks, and the sanitized Markdown HTML (markdown.ts) laid out as PDF text: headings,
 *        paragraphs (bold/italic/code/links/strike), nested and task lists, quotes, code blocks,
 *        pipe tables, rules and data: images.
 *
 * Only a small structural subset of the jsPDF API is used (`PdfDoc`), so tests can run it against
 * the real library in jsdom.
 */

/** The jsPDF methods used by the layout (structural, so the lazily loaded class needs no static import). */
export interface PdfDoc {
  internal: { pageSize: { getWidth(): number; getHeight(): number } };
  addPage(): unknown;
  setPage(n: number): unknown;
  getNumberOfPages(): number;
  setFont(family: string, style?: string): unknown;
  setFontSize(size: number): unknown;
  getTextWidth(text: string): number;
  text(text: string, x: number, y: number, options?: Record<string, unknown>): unknown;
  setTextColor(color: string): unknown;
  setDrawColor(color: string): unknown;
  setFillColor(color: string): unknown;
  setLineWidth(width: number): unknown;
  line(x1: number, y1: number, x2: number, y2: number): unknown;
  rect(x: number, y: number, w: number, h: number, style?: string): unknown;
  link(x: number, y: number, w: number, h: number, options: { url?: string; pageNumber?: number }): unknown;
  addImage(data: string, format: string, x: number, y: number, w: number, h: number, alias?: string, compression?: string): unknown;
  getImageProperties(data: string): { width: number; height: number };
}

/** Font families registered in the document. */
export interface PdfFontSet {
  sans: string;
  mono: string;
  /** True when Unicode TTF fonts are embedded (else the 14 standard fonts: Latin-1 only). */
  unicode: boolean;
  /** The sans family has an italic face. */
  italic: boolean;
}

export interface TextStyle {
  size: number;
  bold?: boolean;
  italic?: boolean;
  mono?: boolean;
  color?: string;
  link?: string;
  strike?: boolean;
}

interface Run {
  text: string;
  style: TextStyle;
}

interface Seg {
  text: string;
  style: TextStyle;
  width: number;
}

const TRANSLIT: Record<string, string> = {
  'ł': 'l', 'Ł': 'L', 'đ': 'd', 'Đ': 'D', 'ı': 'i', 'ß': 'ss', 'ø': 'o', 'Ø': 'O', 'æ': 'ae', 'Æ': 'AE', 'œ': 'oe', 'Œ': 'OE',
  '—': '-', '–': '-', '‐': '-', '−': '-', '“': '"', '”': '"', '„': '"', '‘': "'", '’': "'", '‚': "'", '…': '...', '•': '-',
  '→': '->', '←': '<-', '↔': '<->', '⇒': '=>', '✓': 'v', '✔': 'v', '☐': '[ ]', '☑': '[x]', '☒': '[x]', '€': 'EUR', '™': '(TM)',
  ' ': ' ', ' ': ' ', ' ': ' ',
};

/** Characters the standard PDF fonts (Latin-1 here) cannot show and that have no simple ASCII form. */
export function needsUnicodeFont(text: string): boolean {
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code <= 0xff) continue;
    if (TRANSLIT[ch] !== undefined) continue;
    return true;
  }
  return false;
}

/** Text for the standard fonts: Latin-1 kept, diacritics stripped, a few symbols spelled out, rest '?'. */
export function toLatin1(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code <= 0xff) {
      out += ch;
      continue;
    }
    const mapped = TRANSLIT[ch];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    out += base && [...base].every((c) => c.codePointAt(0)! <= 0xff) ? base : '?';
  }
  return out;
}

export interface FlowOptions {
  margin: number;
  /** Space reserved at the bottom (footer). */
  bottom: number;
  /** Called after a page was added (e.g. a running header). */
  onNewPage?(flow: PdfFlow): void;
}

/** A vertical flow of content over pages: `y` is the cursor, `ensure(h)` breaks the page. */
export class PdfFlow {
  y: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;

  constructor(
    readonly doc: PdfDoc,
    readonly fonts: PdfFontSet,
    private readonly opts: FlowOptions
  ) {
    this.left = opts.margin;
    this.right = this.pageWidth - opts.margin;
    this.top = opts.margin;
    this.y = this.top;
  }

  get pageWidth(): number {
    return this.doc.internal.pageSize.getWidth();
  }

  get pageHeight(): number {
    return this.doc.internal.pageSize.getHeight();
  }

  get width(): number {
    return this.right - this.left;
  }

  /** Lowest y content may reach. */
  get limit(): number {
    return this.pageHeight - this.opts.bottom;
  }

  /** Height of an empty page's content area. */
  get contentHeight(): number {
    return this.limit - this.top;
  }

  get remaining(): number {
    return this.limit - this.y;
  }

  newPage(): void {
    this.doc.addPage();
    this.y = this.top;
    this.opts.onNewPage?.(this);
  }

  /** Breaks the page when `h` does not fit (unless the page is still empty). */
  ensure(h: number): void {
    if (this.y + h > this.limit && this.y > this.top + 0.5) this.newPage();
  }

  space(h: number): void {
    this.y = Math.min(this.y + h, this.limit);
  }

  clean(text: string): string {
    return this.fonts.unicode ? text : toLatin1(text);
  }

  applyFont(style: TextStyle): void {
    const family = style.mono ? this.fonts.mono : this.fonts.sans;
    let face = style.bold ? 'bold' : 'normal';
    if (style.italic && (style.mono ? !this.fonts.unicode : this.fonts.italic)) face = style.bold ? 'bolditalic' : 'italic';
    this.doc.setFont(family, face);
    this.doc.setFontSize(style.size);
  }

  measure(text: string, style: TextStyle): number {
    this.applyFont(style);
    return this.doc.getTextWidth(text);
  }

  /** Breaks runs into lines of at most `maxWidth` (words; over-long words by characters). */
  wrap(runs: Run[], maxWidth: number, preserve = false): Seg[][] {
    const lines: Seg[][] = [];
    let line: Seg[] = [];
    let lineWidth = 0;
    let pendingSpace: TextStyle | null = null;
    const push = (): void => {
      lines.push(line);
      line = [];
      lineWidth = 0;
      pendingSpace = null;
    };
    const add = (text: string, style: TextStyle, width: number): void => {
      const last = line[line.length - 1];
      if (last && sameStyle(last.style, style)) {
        last.text += text;
        last.width += width;
      } else line.push({ text, style, width });
      lineWidth += width;
    };
    for (const run of runs) {
      const text = this.clean(run.text);
      const parts = preserve ? text.split(/(\n)/) : text.split(/(\n|[ \t\r\f]+)/);
      for (const part of parts) {
        if (!part) continue;
        if (part === '\n') {
          push();
          continue;
        }
        if (!preserve && /^[ \t\r\f]+$/.test(part)) {
          if (line.length) pendingSpace = run.style;
          continue;
        }
        let word = part;
        const spaceStyle: TextStyle | null = pendingSpace;
        const spaceW = spaceStyle ? this.measure(' ', spaceStyle) : 0;
        let w = this.measure(word, run.style);
        if (line.length && lineWidth + spaceW + w > maxWidth) {
          push();
        } else if (spaceStyle) {
          add(' ', spaceStyle, spaceW);
        }
        pendingSpace = null;
        // a word longer than the line: split by characters
        while (w > maxWidth && word.length > 1) {
          let n = word.length - 1;
          while (n > 1 && this.measure(word.slice(0, n), run.style) > maxWidth - lineWidth) n--;
          const head = word.slice(0, n);
          add(head, run.style, this.measure(head, run.style));
          push();
          word = word.slice(n);
          w = this.measure(word, run.style);
        }
        add(word, run.style, w);
      }
    }
    if (line.length || lines.length === 0) lines.push(line);
    return lines;
  }

  /** Draws one line of segments with its top at `top`. */
  drawLine(segs: Seg[], x: number, top: number, size: number, lineHeight: number): void {
    const baseline = top + (lineHeight - size) / 2 + size * 0.8;
    let cx = x;
    for (const seg of segs) {
      this.applyFont(seg.style);
      const color = seg.style.color ?? (seg.style.link ? '#1a5fb4' : '#222222');
      this.doc.setTextColor(color);
      if (seg.text.trim()) this.doc.text(seg.text, cx, baseline);
      if (seg.style.link) {
        this.doc.setDrawColor(color);
        this.doc.setLineWidth(0.5);
        this.doc.line(cx, baseline + 1.5, cx + seg.width, baseline + 1.5);
        this.doc.link(cx, top, seg.width, lineHeight, { url: seg.style.link });
      }
      if (seg.style.strike) {
        this.doc.setDrawColor(color);
        this.doc.setLineWidth(0.6);
        this.doc.line(cx, baseline - seg.style.size * 0.3, cx + seg.width, baseline - seg.style.size * 0.3);
      }
      cx += seg.width;
    }
  }

  /**
   * A wrapped paragraph at `indent` (from the left margin). `marker` is drawn left of the first
   * line (list bullets); `decorate(top, height)` runs before each line (quote bars, code shading).
   */
  paragraph(
    runs: Run[],
    opts: {
      size: number;
      indent?: number;
      lineHeight?: number;
      marker?: Run | null;
      preserve?: boolean;
      maxWidth?: number;
      decorate?(top: number, height: number): void;
    }
  ): void {
    const indent = opts.indent ?? 0;
    const lineHeight = opts.lineHeight ?? opts.size * 1.35;
    const maxWidth = opts.maxWidth ?? this.width - indent;
    const lines = this.wrap(runs, Math.max(20, maxWidth), opts.preserve);
    lines.forEach((segs, i) => {
      this.ensure(lineHeight);
      opts.decorate?.(this.y, lineHeight);
      if (i === 0 && opts.marker) {
        const markerText = this.clean(opts.marker.text);
        const w = this.measure(markerText, opts.marker.style);
        this.drawLine([{ text: markerText, style: opts.marker.style, width: w }], this.left + indent - w - 4, this.y, opts.size, lineHeight);
      }
      this.drawLine(segs, this.left + indent, this.y, opts.size, lineHeight);
      this.y += lineHeight;
    });
  }
}

function sameStyle(a: TextStyle, b: TextStyle): boolean {
  return a.size === b.size && !!a.bold === !!b.bold && !!a.italic === !!b.italic && !!a.mono === !!b.mono && a.color === b.color && a.link === b.link && !!a.strike === !!b.strike;
}

// ------------------------------------------------------------------------------------ Markdown

const BODY = 10;
const HEADING_SIZES = [17, 14.5, 12.5, 11.5, 10.5, 10];
const BLOCK_TAGS = new Set(['P', 'UL', 'OL', 'PRE', 'BLOCKQUOTE', 'TABLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR', 'DIV']);

interface BlockCtx {
  indent: number;
  quote: number;
}

/** Inline content of an element as styled runs. */
function inlineRuns(node: Node, base: TextStyle, fonts: PdfFontSet, out: Run[] = []): Run[] {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      out.push({ text: child.textContent ?? '', style: base });
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as Element;
    const tag = el.tagName;
    if (BLOCK_TAGS.has(tag)) continue;
    switch (tag) {
      case 'STRONG':
      case 'B':
        inlineRuns(el, { ...base, bold: true }, fonts, out);
        break;
      case 'EM':
      case 'I':
        inlineRuns(el, { ...base, italic: true }, fonts, out);
        break;
      case 'DEL':
      case 'S':
        inlineRuns(el, { ...base, strike: true }, fonts, out);
        break;
      case 'CODE':
        inlineRuns(el, { ...base, mono: true, size: base.size * 0.92, color: '#7a2e0e' }, fonts, out);
        break;
      case 'A': {
        const href = el.getAttribute('href') ?? '';
        const link = /^(https?:|mailto:)/i.test(href) ? href : undefined;
        inlineRuns(el, { ...base, link }, fonts, out);
        break;
      }
      case 'BR':
        out.push({ text: '\n', style: base });
        break;
      case 'IMG':
        out.push({ text: `[image${el.getAttribute('alt') ? `: ${el.getAttribute('alt')}` : ''}]`, style: { ...base, italic: true, color: '#666666' } });
        break;
      case 'INPUT':
        if (el.getAttribute('type') === 'checkbox') out.push({ text: el.hasAttribute('checked') ? (fonts.unicode ? '☑ ' : '[x] ') : fonts.unicode ? '☐ ' : '[ ] ', style: base });
        break;
      default:
        inlineRuns(el, base, fonts, out);
    }
  }
  return out;
}

function hasText(runs: Run[]): boolean {
  return runs.some((r) => r.text.trim() !== '');
}

/** The only child of a paragraph is a data: PNG/JPEG image -> drawn as an image. */
function blockImage(el: Element): HTMLImageElement | null {
  const kids = Array.from(el.childNodes).filter((n) => !(n.nodeType === Node.TEXT_NODE && !(n.textContent ?? '').trim()));
  const img = kids.length === 1 && kids[0].nodeType === Node.ELEMENT_NODE && (kids[0] as Element).tagName === 'IMG' ? (kids[0] as HTMLImageElement) : null;
  return img && /^data:image\/(png|jpe?g);base64,/i.test(img.getAttribute('src') ?? '') ? img : null;
}

/** Lays out sanitized Markdown HTML (a fragment or element) into the flow. */
export function renderMarkdownBlocks(flow: PdfFlow, root: ParentNode, ctx: BlockCtx = { indent: 0, quote: 0 }): void {
  const quoteBar = (top: number, height: number): void => {
    if (ctx.quote <= 0) return;
    flow.doc.setFillColor('#cfcfcf');
    for (let q = 0; q < ctx.quote; q++) flow.doc.rect(flow.left + ctx.indent - 10 - q * 10, top, 2.2, height, 'F');
  };
  const textColor = ctx.quote > 0 ? '#555555' : undefined;
  let inline: Node[] = [];
  const flushInline = (): void => {
    if (!inline.length) return;
    const holder = document.createElement('span');
    for (const n of inline) holder.appendChild(n.cloneNode(true));
    inline = [];
    const runs = inlineRuns(holder, { size: BODY, color: textColor }, flow.fonts);
    if (!hasText(runs)) return;
    flow.paragraph(runs, { size: BODY, indent: ctx.indent, decorate: quoteBar });
    flow.space(4);
  };
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      if ((node.textContent ?? '').trim()) inline.push(node);
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const el = node as HTMLElement;
    const tag = el.tagName;
    if (!BLOCK_TAGS.has(tag)) {
      inline.push(el);
      continue;
    }
    flushInline();
    if (/^H[1-6]$/.test(tag)) {
      const size = HEADING_SIZES[Number(tag[1]) - 1];
      flow.space(size * 0.35);
      flow.ensure(size * 2.4);
      flow.paragraph(inlineRuns(el, { size, bold: true, color: textColor ?? '#1b1b1b' }, flow.fonts), { size, indent: ctx.indent, decorate: quoteBar });
      if (tag === 'H1' || tag === 'H2') {
        flow.doc.setDrawColor('#dddddd');
        flow.doc.setLineWidth(0.6);
        flow.doc.line(flow.left + ctx.indent, flow.y + 1, flow.right, flow.y + 1);
        flow.space(4);
      }
      flow.space(3);
    } else if (tag === 'P' || tag === 'DIV') {
      const img = tag === 'P' ? blockImage(el) : null;
      if (img) drawDataImage(flow, img.getAttribute('src')!, ctx.indent);
      else if (tag === 'DIV') renderMarkdownBlocks(flow, el, ctx);
      else {
        const runs = inlineRuns(el, { size: BODY, color: textColor }, flow.fonts);
        if (hasText(runs)) {
          flow.paragraph(runs, { size: BODY, indent: ctx.indent, decorate: quoteBar });
          flow.space(4);
        }
      }
    } else if (tag === 'UL' || tag === 'OL') {
      renderList(flow, el, ctx, quoteBar);
      flow.space(3);
    } else if (tag === 'PRE') {
      const size = 8.5;
      const lineHeight = size * 1.35;
      const pad = 4;
      const shade = (top: number, height: number): void => {
        quoteBar(top, height);
        flow.doc.setFillColor('#f3f3f3');
        flow.doc.rect(flow.left + ctx.indent, top, flow.width - ctx.indent, height, 'F');
      };
      flow.space(1);
      flow.paragraph([{ text: (el.textContent ?? '').replace(/\n$/, ''), style: { size, mono: true, color: '#333333' } }], {
        size,
        lineHeight,
        indent: ctx.indent + pad,
        maxWidth: flow.width - ctx.indent - 2 * pad,
        preserve: true,
        decorate: (top, height) => shade(top, height),
      });
      flow.space(6);
    } else if (tag === 'BLOCKQUOTE') {
      renderMarkdownBlocks(flow, el, { indent: ctx.indent + 12, quote: ctx.quote + 1 });
      flow.space(2);
    } else if (tag === 'TABLE') {
      renderTable(flow, el, ctx);
      flow.space(6);
    } else if (tag === 'HR') {
      flow.ensure(10);
      flow.doc.setDrawColor('#bbbbbb');
      flow.doc.setLineWidth(0.8);
      flow.doc.line(flow.left + ctx.indent, flow.y + 5, flow.right, flow.y + 5);
      flow.space(10);
    }
  }
  flushInline();
}

function renderList(flow: PdfFlow, list: Element, ctx: BlockCtx, quoteBar: (top: number, height: number) => void): void {
  const ordered = list.tagName === 'OL';
  let counter = ordered ? Math.max(0, parseInt(list.getAttribute('start') ?? '1', 10) || 1) : 0;
  const indent = ctx.indent + 16;
  const depth = Math.round(ctx.indent / 16);
  const bullet = flow.fonts.unicode ? ['•', '◦', '▪'][depth % 3] : ['•', '-', '·'][depth % 3];
  for (const li of Array.from(list.children)) {
    if (li.tagName !== 'LI') continue;
    const markerText = ordered ? `${counter++}.` : li.classList.contains('rd-md-task') ? '' : bullet;
    let marker: Run | null = markerText ? { text: markerText, style: { size: BODY, color: '#444444' } } : null;
    let inline: Node[] = [];
    const flush = (): void => {
      if (!inline.length) return;
      const holder = document.createElement('span');
      for (const n of inline) holder.appendChild(n.cloneNode(true));
      inline = [];
      const runs = inlineRuns(holder, { size: BODY, color: ctx.quote > 0 ? '#555555' : undefined }, flow.fonts);
      if (!hasText(runs)) return;
      flow.paragraph(runs, { size: BODY, indent, marker, decorate: quoteBar });
      marker = null;
      flow.space(1.5);
    };
    for (const child of Array.from(li.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((child as Element).tagName)) {
        flush();
        const el = child as Element;
        if (el.tagName === 'P' && marker) {
          inline = Array.from(el.childNodes);
          flush();
        } else {
          renderMarkdownBlocks(flow, wrapSingle(el), { indent, quote: ctx.quote });
        }
      } else inline.push(child);
    }
    flush();
  }
}

function wrapSingle(el: Element): ParentNode {
  const holder = document.createElement('div');
  holder.appendChild(el.cloneNode(true));
  return holder;
}

function renderTable(flow: PdfFlow, table: Element, ctx: BlockCtx): void {
  const rows = Array.from(table.querySelectorAll('tr'));
  if (!rows.length) return;
  const size = 9;
  const pad = 3;
  const lineHeight = size * 1.3;
  const grid = rows.map((tr) =>
    Array.from(tr.children)
      .filter((c) => c.tagName === 'TH' || c.tagName === 'TD')
      .map((cell) => ({
        head: cell.tagName === 'TH',
        align: /rd-md-align-(center|right)/.exec(cell.getAttribute('class') ?? '')?.[1] ?? 'left',
        runs: inlineRuns(cell, { size, bold: cell.tagName === 'TH' }, flow.fonts),
      }))
  );
  const cols = Math.max(...grid.map((r) => r.length));
  if (cols === 0) return;
  const available = flow.width - ctx.indent;
  const natural = new Array<number>(cols).fill(24);
  for (const row of grid) {
    row.forEach((cell, i) => {
      const w = cell.runs.reduce((sum, r) => sum + flow.measure(flow.clean(r.text.replace(/\s+/g, ' ')), r.style), 0) + 2 * pad + 1;
      natural[i] = Math.max(natural[i], Math.min(w, available * 0.6));
    });
  }
  const total = natural.reduce((a, b) => a + b, 0);
  const widths = total <= available ? natural : natural.map((w) => Math.max(30, (w / total) * available));
  const scale = widths.reduce((a, b) => a + b, 0) > available ? available / widths.reduce((a, b) => a + b, 0) : 1;
  for (let i = 0; i < widths.length; i++) widths[i] *= scale;
  for (const row of grid) {
    const laid = widths.map((w, i) => (row[i] ? flow.wrap(row[i].runs, Math.max(10, w - 2 * pad)) : [[]]));
    const height = Math.max(...laid.map((l) => l.length)) * lineHeight + 2 * pad;
    flow.ensure(height);
    let x = flow.left + ctx.indent;
    const top = flow.y;
    widths.forEach((w, i) => {
      const cell = row[i];
      if (cell?.head) {
        flow.doc.setFillColor('#f0f0f0');
        flow.doc.rect(x, top, w, height, 'F');
      }
      flow.doc.setDrawColor('#bbbbbb');
      flow.doc.setLineWidth(0.5);
      flow.doc.rect(x, top, w, height, 'S');
      laid[i].forEach((segs, k) => {
        const lineW = segs.reduce((s, g) => s + g.width, 0);
        const dx = cell?.align === 'right' ? w - 2 * pad - lineW : cell?.align === 'center' ? (w - 2 * pad - lineW) / 2 : 0;
        flow.drawLine(segs, x + pad + Math.max(0, dx), top + pad + k * lineHeight, size, lineHeight);
      });
      x += w;
    });
    flow.y = top + height;
  }
}

/** A data: PNG/JPEG image (Markdown) scaled to the column (max 220 pt high). */
export function drawDataImage(flow: PdfFlow, src: string, indent = 0): void {
  try {
    const props = flow.doc.getImageProperties(src);
    const maxW = flow.width - indent;
    const s = Math.min(1, maxW / (props.width * 0.75), 220 / (props.height * 0.75));
    const w = props.width * 0.75 * s;
    const h = props.height * 0.75 * s;
    flow.ensure(h + 4);
    const format = /^data:image\/png/i.test(src) ? 'PNG' : 'JPEG';
    flow.doc.addImage(src, format, flow.left + indent, flow.y, w, h, undefined, 'FAST');
    flow.space(h + 6);
  } catch {
    flow.paragraph([{ text: '[image]', style: { size: BODY, italic: true, color: '#666666' } }], { size: BODY, indent });
  }
}
