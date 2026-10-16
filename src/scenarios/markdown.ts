/**
 * @file markdown.ts
 * @brief Small, safe Markdown renderer for the text part of scenario steps (no dependency).
 *
 * Supported (CommonMark/GFM subset): ATX headings, paragraphs, hard line breaks (two trailing
 * spaces or `\`), `*`/`_` emphasis, `**`/`__` strong, `~~` strikethrough, code spans, fenced code
 * blocks, block quotes, nested bullet/ordered lists, task list items, pipe tables (with alignment),
 * horizontal rules, `[text](url "title")` links, `<https://…>` and bare https URLs, images
 * `![alt](src)`. Raw HTML is NOT supported: it is shown as text.
 *
 * Safety: the renderer writes only escaped text and a fixed set of tags; links are only http(s) and
 * mailto (opened with target=_blank rel="noopener noreferrer"), images only https: and base64
 * data:image/(png|jpeg|gif|webp|svg+xml). `sanitizeHtml` (a tag/attribute allow-list over the DOM)
 * runs again before anything is inserted into the page or exported, as defence in depth.
 */

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** Removes whitespace and control characters browsers ignore inside URL schemes (`java\tscript:`). */
function compactUrl(url: string): string {
  // eslint-disable-next-line no-control-regex
  return url.replace(/[\u0000- \u007f-\u009f]+/g, '');
}

/** A link target that is safe to put in `href`, or null. */
export function safeLinkUrl(raw: string): string | null {
  const url = compactUrl(raw);
  if (/^(https?:\/\/|mailto:)/i.test(url)) return url;
  if (/^#[\w-]*$/.test(url)) return url;
  return null;
}

/** An image source that is safe to put in `src`, or null. */
export function safeImageUrl(raw: string): string | null {
  const url = compactUrl(raw);
  if (/^https:\/\//i.test(url)) return url;
  if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[a-z0-9+/]+=*$/i.test(url)) return url;
  return null;
}

// ------------------------------------------------------------------------------------------- inline

const PUNCT = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;

function isSpace(ch: string | undefined): boolean {
  return ch === undefined || /\s/.test(ch);
}

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && /[\p{L}\p{N}]/u.test(ch);
}

/** Index of the `]` matching the `[` at `open`, or -1. */
function matchBracket(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '\\') i++;
    else if (ch === '`') {
      const close = src.indexOf('`', i + 1);
      if (close > 0) i = close;
    } else if (ch === '[') depth++;
    else if (ch === ']' && --depth === 0) return i;
  }
  return -1;
}

/** Parses `(url "title")` at `start`; returns the parts and the index after `)`. */
function parseDestination(src: string, start: number): { url: string; title: string; end: number } | null {
  if (src[start] !== '(') return null;
  let i = start + 1;
  while (src[i] === ' ') i++;
  let url = '';
  if (src[i] === '<') {
    const close = src.indexOf('>', i);
    if (close < 0) return null;
    url = src.slice(i + 1, close);
    i = close + 1;
  } else {
    let depth = 0;
    const from = i;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === ' ') break;
      if (ch === '(') depth++;
      if (ch === ')') {
        if (depth === 0) break;
        depth--;
      }
    }
    url = src.slice(from, i);
  }
  while (src[i] === ' ') i++;
  let title = '';
  if (src[i] === '"' || src[i] === "'") {
    const q = src[i];
    const close = src.indexOf(q, i + 1);
    if (close < 0) return null;
    title = src.slice(i + 1, close);
    i = close + 1;
    while (src[i] === ' ') i++;
  }
  if (src[i] !== ')') return null;
  return { url: url.replace(/\\(.)/g, '$1'), title, end: i + 1 };
}

function linkHtml(href: string, inner: string, title: string): string {
  return `<a href="${escapeHtml(href)}"${title ? ` title="${escapeHtml(title)}"` : ''} target="_blank" rel="noopener noreferrer">${inner}</a>`;
}

/** Renders inline Markdown to HTML (escaped text + a fixed set of tags). */
export function renderInline(src: string, depth = 0): string {
  if (depth > 12) return escapeHtml(src);
  let out = '';
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    // backslash escapes; `\` at the end of a line is a hard break (handled by the paragraph)
    if (ch === '\\' && i + 1 < src.length && PUNCT.test(src[i + 1])) {
      out += escapeHtml(src[i + 1]);
      i += 2;
      continue;
    }
    if (ch === '`') {
      let n = 1;
      while (src[i + n] === '`') n++;
      const fence = '`'.repeat(n);
      let close = src.indexOf(fence, i + n);
      while (close >= 0 && src[close + n] === '`') close = src.indexOf(fence, close + n + 1);
      if (close >= 0) {
        let code = src.slice(i + n, close);
        if (/^ .* $/.test(code) && code.trim()) code = code.slice(1, -1);
        out += `<code>${escapeHtml(code)}</code>`;
        i = close + n;
        continue;
      }
      out += escapeHtml(fence);
      i += n;
      continue;
    }
    if ((ch === '!' && src[i + 1] === '[') || ch === '[') {
      const open = ch === '!' ? i + 1 : i;
      const close = matchBracket(src, open);
      const dest = close > 0 ? parseDestination(src, close + 1) : null;
      if (dest) {
        const text = src.slice(open + 1, close);
        if (ch === '!') {
          const url = safeImageUrl(dest.url);
          const alt = text.replace(/[\\*_`[\]]/g, '');
          out += url
            ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}"${dest.title ? ` title="${escapeHtml(dest.title)}"` : ''} loading="lazy">`
            : `<span class="rd-md-blocked" title="Image not shown: only https and data:image sources are allowed">${escapeHtml(alt || 'image')}</span>`;
        } else {
          const url = safeLinkUrl(dest.url);
          const inner = renderInline(text, depth + 1);
          out += url ? linkHtml(url, inner, dest.title) : inner;
        }
        i = dest.end;
        continue;
      }
    }
    if (ch === '<') {
      const auto = /^<((?:https?:\/\/|mailto:)[^\s<>]+)>/i.exec(src.slice(i));
      if (auto) {
        const url = safeLinkUrl(auto[1]);
        out += url ? linkHtml(url, escapeHtml(auto[1]), '') : escapeHtml(auto[0]);
        i += auto[0].length;
        continue;
      }
    }
    if ((ch === 'h' || ch === 'H') && !isWordChar(src[i - 1])) {
      const bare = /^https?:\/\/[^\s<>]+/i.exec(src.slice(i));
      if (bare) {
        const text = bare[0].replace(/[.,;:!?'")\]]+$/, '');
        const url = safeLinkUrl(text);
        if (url) {
          out += linkHtml(url, escapeHtml(text), '');
          i += text.length;
          continue;
        }
      }
    }
    if (ch === '*' || ch === '_' || ch === '~') {
      let n = 1;
      while (src[i + n] === ch) n++;
      const closing = ch === '~' ? (n === 2 ? findCloser(src, i + n, ch, n) : -1) : n <= 3 ? findCloser(src, i + n, ch, n) : -1;
      const opensOk = !isSpace(src[i + n]) && (ch !== '_' || !isWordChar(src[i - 1]));
      if (closing > 0 && opensOk) {
        const inner = renderInline(src.slice(i + n, closing), depth + 1);
        if (ch === '~') out += `<del>${inner}</del>`;
        else if (n === 1) out += `<em>${inner}</em>`;
        else if (n === 2) out += `<strong>${inner}</strong>`;
        else out += `<strong><em>${inner}</em></strong>`;
        i = closing + n;
        continue;
      }
      out += escapeHtml(ch.repeat(n));
      i += n;
      continue;
    }
    out += escapeHtml(ch);
    i++;
  }
  return out;
}

/** Start of a closing delimiter run of exactly `n` × `ch` after `from`, or -1. */
function findCloser(src: string, from: number, ch: string, n: number): number {
  let j = from;
  while (j < src.length) {
    if (src[j] === '\\') {
      j += 2;
      continue;
    }
    if (src[j] === '`') {
      const close = src.indexOf('`', j + 1);
      j = close > 0 ? close + 1 : j + 1;
      continue;
    }
    if (src[j] === ch) {
      let r = 1;
      while (src[j + r] === ch) r++;
      const after = src[j + r];
      if (r === n && j > from && !isSpace(src[j - 1]) && (ch !== '_' || !isWordChar(after))) return j;
      j += r;
      continue;
    }
    j++;
  }
  return -1;
}

// -------------------------------------------------------------------------------------------- blocks

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})\s*([^`\s]*)[^`]*$/;
const HEADING_RE = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const HR_RE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const QUOTE_RE = /^ {0,3}> ?/;
const LIST_RE = /^( *)([-*+]|\d{1,9}[.)])( +|$)(.*)$/;
const TABLE_SEP_RE = /^ *\|? *:?-+:? *(\| *:?-+:? *)*\|? *$/;

function splitRow(line: string): string[] {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
  const cells: string[] = [];
  let cur = '';
  for (let i = 0; i < row.length; i++) {
    if (row[i] === '\\' && row[i + 1] === '|') {
      cur += '|';
      i++;
    } else if (row[i] === '|') {
      cells.push(cur.trim());
      cur = '';
    } else cur += row[i];
  }
  cells.push(cur.trim());
  return cells;
}

function startsBlock(line: string, next: string | undefined): boolean {
  return (
    FENCE_RE.test(line) ||
    HEADING_RE.test(line) ||
    HR_RE.test(line) ||
    QUOTE_RE.test(line) ||
    (LIST_RE.test(line) && LIST_RE.exec(line)![4].trim() !== '') ||
    (line.includes('|') && next !== undefined && TABLE_SEP_RE.test(next) && next.includes('-'))
  );
}

function paragraph(lines: string[]): string {
  const parts = lines.map((line, k) => {
    const last = k === lines.length - 1;
    const hard = !last && (/ {2,}$/.test(line) || /\\$/.test(line));
    const text = hard ? line.replace(/(\\| +)$/, '') : line.trim();
    return renderInline(text.trim()) + (hard ? '<br>' : '');
  });
  return parts.join('\n');
}

function renderBlocks(lines: string[], depth: number): string {
  if (depth > 8) return `<p>${escapeHtml(lines.join(' '))}</p>`;
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    let m: RegExpExecArray | null;
    if ((m = FENCE_RE.exec(line))) {
      const fence = m[1];
      const lang = m[2].replace(/[^\w+-]/g, '');
      const indent = line.length - line.trimStart().length;
      const body: string[] = [];
      i++;
      while (i < lines.length && !new RegExp(`^ {0,3}${fence[0] === '`' ? '`' : '~'}{${fence.length},}\\s*$`).test(lines[i])) {
        body.push(lines[i].replace(new RegExp(`^ {0,${indent}}`), ''));
        i++;
      }
      i++;
      out.push(`<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ''}>${escapeHtml(body.join('\n'))}</code></pre>`);
      continue;
    }
    if ((m = HEADING_RE.exec(line))) {
      const level = m[1].length;
      out.push(`<h${level}>${renderInline((m[2] ?? '').trim())}</h${level}>`);
      i++;
      continue;
    }
    if (HR_RE.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }
    if (QUOTE_RE.test(line)) {
      const body: string[] = [];
      while (i < lines.length && lines[i].trim() && (QUOTE_RE.test(lines[i]) || body.length > 0)) {
        if (!QUOTE_RE.test(lines[i]) && startsBlock(lines[i], lines[i + 1])) break;
        body.push(lines[i].replace(QUOTE_RE, ''));
        i++;
      }
      out.push(`<blockquote>${renderBlocks(body, depth + 1)}</blockquote>`);
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const head = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map((c) =>
        c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : ''
      );
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      const cell = (tag: 'th' | 'td', text: string, k: number): string =>
        `<${tag}${aligns[k] ? ` class="rd-md-align-${aligns[k]}"` : ''}>${renderInline(text)}</${tag}>`;
      out.push(
        '<table><thead><tr>' +
          head.map((c, k) => cell('th', c, k)).join('') +
          '</tr></thead>' +
          (rows.length
            ? '<tbody>' + rows.map((r) => '<tr>' + head.map((_h, k) => cell('td', r[k] ?? '', k)).join('') + '</tr>').join('') + '</tbody>'
            : '') +
          '</table>'
      );
      continue;
    }
    if ((m = LIST_RE.exec(line))) {
      const baseIndent = m[1].length;
      const ordered = /\d/.test(m[2]);
      const start = ordered ? parseInt(m[2], 10) : 1;
      const items: string[][] = [];
      let loose = false;
      while (i < lines.length) {
        const lm = LIST_RE.exec(lines[i]);
        if (!lm || lm[1].length !== baseIndent || /\d/.test(lm[2]) !== ordered) break;
        const contentIndent = lm[1].length + lm[2].length + Math.min(Math.max(lm[3].length, 1), 4);
        const item = [lm[4]];
        i++;
        while (i < lines.length) {
          const l = lines[i];
          if (!l.trim()) {
            // a blank line continues the item only when indented content follows
            const nextLine = lines[i + 1];
            if (nextLine !== undefined && nextLine.trim() && nextLine.length - nextLine.trimStart().length >= contentIndent) {
              item.push('');
              loose = true;
              i++;
              continue;
            }
            break;
          }
          const indent = l.length - l.trimStart().length;
          if (indent >= contentIndent) item.push(l.slice(contentIndent));
          else if (indent > baseIndent && LIST_RE.test(l)) item.push(l.slice(Math.min(indent, contentIndent)));
          else if (!startsBlock(l, lines[i + 1]) && !LIST_RE.test(l)) item.push(l.trim());
          else break;
          i++;
        }
        items.push(item);
        // blank lines between items
        if (i < lines.length && !lines[i].trim()) {
          let k = i;
          while (k < lines.length && !lines[k].trim()) k++;
          const nm = k < lines.length ? LIST_RE.exec(lines[k]) : null;
          if (nm && nm[1].length === baseIndent && /\d/.test(nm[2]) === ordered) {
            loose = true;
            i = k;
          }
        }
      }
      const tag = ordered ? 'ol' : 'ul';
      const html = items.map((item) => {
        let first = item[0];
        let task = '';
        const tm = /^\[([ xX])\]\s+(.*)$/.exec(first);
        if (tm) {
          task = `<input type="checkbox" disabled${tm[1] !== ' ' ? ' checked' : ''}> `;
          first = tm[2];
        }
        const body = [first, ...item.slice(1)];
        let inner = renderBlocks(body, depth + 1);
        if (!loose) inner = inner.replace(/^<p>([\s\S]*?)<\/p>/, '$1');
        return `<li${task ? ' class="rd-md-task"' : ''}>${task}${inner}</li>`;
      });
      out.push(`<${tag}${ordered && start !== 1 ? ` start="${start}"` : ''}>${html.join('')}</${tag}>`);
      continue;
    }
    // paragraph
    const para: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i], lines[i + 1])) {
      para.push(lines[i]);
      i++;
    }
    out.push(`<p>${paragraph(para)}</p>`);
  }
  return out.join('\n');
}

/** Renders Markdown to HTML (safe by construction; insert via sanitizeHtml / setSafeHtml). */
export function renderMarkdown(source: string): string {
  const lines = source.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
  return renderBlocks(lines, 0);
}

// ----------------------------------------------------------------------------------- DOM sanitizer

const ALLOWED: Record<string, string[]> = {
  h1: [], h2: [], h3: [], h4: [], h5: [], h6: [],
  p: [], br: [], hr: [], strong: [], em: [], del: [], code: ['class'], pre: [], blockquote: [],
  ul: [], ol: ['start'], li: ['class'], table: [], thead: [], tbody: [], tr: [], th: ['class'], td: ['class'],
  a: ['href', 'title', 'target', 'rel'], img: ['src', 'alt', 'title', 'loading'], span: ['class', 'title'],
  input: ['type', 'disabled', 'checked'],
};
const DROP_WITH_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript', 'svg', 'math', 'textarea', 'select', 'form']);

function cleanTree(parent: ParentNode): void {
  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) continue;
    if (node.nodeType !== Node.ELEMENT_NODE) {
      node.parentNode?.removeChild(node);
      continue;
    }
    const el = node as Element;
    const tag = el.localName.toLowerCase();
    if (DROP_WITH_CONTENT.has(tag)) {
      el.remove();
      continue;
    }
    const allowed = ALLOWED[tag];
    if (!allowed) {
      // unknown element: keep its (cleaned) content
      cleanTree(el);
      el.replaceWith(...Array.from(el.childNodes));
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (!allowed.includes(name)) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (name === 'href' && !safeLinkUrl(attr.value)) el.removeAttribute(attr.name);
      else if (name === 'src' && !safeImageUrl(attr.value)) el.removeAttribute(attr.name);
      else if (name === 'class' && !/^(rd-md-[\w-]+|language-[\w+-]+)$/.test(attr.value)) el.removeAttribute(attr.name);
      else if (name === 'start' && !/^\d{1,9}$/.test(attr.value)) el.removeAttribute(attr.name);
    }
    if (tag === 'a') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
    if (tag === 'input') {
      if (el.getAttribute('type') !== 'checkbox') {
        el.remove();
        continue;
      }
      el.setAttribute('disabled', '');
    }
    if (tag === 'img' && !el.hasAttribute('src')) {
      el.replaceWith(document.createTextNode(el.getAttribute('alt') ?? ''));
      continue;
    }
    cleanTree(el);
  }
}

/** Allow-list sanitizer: HTML string -> cleaned fragment (parsed inertly in a `<template>`). */
export function sanitizeHtml(html: string): DocumentFragment {
  const template = document.createElement('template');
  template.innerHTML = html;
  cleanTree(template.content);
  return template.content;
}

/** Sanitized HTML as a string (HTML export). */
export function sanitizeHtmlString(html: string): string {
  const holder = document.createElement('div');
  holder.appendChild(sanitizeHtml(html));
  return holder.innerHTML;
}

/** Renders Markdown into `host` (sanitized); an empty text shows `emptyHint`. */
export function showMarkdown(host: HTMLElement, source: string, emptyHint = 'No text.'): void {
  host.replaceChildren();
  if (!source.trim()) {
    const p = document.createElement('p');
    p.className = 'rd-scn-muted';
    p.textContent = emptyHint;
    host.appendChild(p);
    return;
  }
  host.appendChild(sanitizeHtml(renderMarkdown(source)));
}
