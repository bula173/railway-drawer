/**
 * @file sanitize.ts
 * @brief The app's one HTML/SVG sanitizer: DOMPurify (allow-list, mXSS-safe) with three profiles.
 *
 * - `sanitizeHtmlLabel`: draw.io HTML labels (`html=1` cells, draw.io JS shapes via the mx shim).
 *   HTML profile only (no SVG / MathML, so `<svg><animate attributeName="href">`, `<set>` and
 *   namespace-confusion tricks cannot pass), what draw.io labels use (font/span/div/b/i/u/br/p/
 *   lists/tables/headings/a/img/...), `style` only with safe CSS, links http(s)/mailto/tel/#/relative,
 *   images https/relative/`data:image/*`. draw.io itself sanitizes labels with DOMPurify
 *   (Graph.sanitizeHtml), so labels from draw.io files render the same.
 * - `sanitizeMarkdownFragment`: the scenario Markdown renderer's fixed tag set (defence in depth: the
 *   renderer already escapes everything) and the AI chat's Markdown.
 * - `sanitizeSvgMarkup`: SVG answers of a user-configured PlantUML server: SVG profile without
 *   scripts, animations (`animate`/`set`/...), `foreignObject`, event handlers, external references.
 *
 * Each profile uses its own DOMPurify instance (hooks are per instance), created on first use for
 * the current `window`. Without a DOM DOMPurify returns its input unchanged, so this module throws
 * instead (fail closed).
 */
import DOMPurify from 'dompurify';
import type { Config, DOMPurify as Purifier } from 'dompurify';

// ------------------------------------------------------------------------------------ helpers

/** Removes whitespace and control characters browsers ignore inside URL schemes (`java\tscript:`). */
function compactUrl(url: string): string {
  // eslint-disable-next-line no-control-regex
  return url.replace(/[\u0000- \u007f-\u009f]+/g, '');
}

const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
const DATA_IMAGE = /^data:image\/(png|gif|jpe?g|webp|bmp|svg\+xml)[;,]/i;
const RASTER_DATA_IMAGE = /^data:image\/(png|gif|jpe?g|webp|bmp)[;,]/i;

/** A link target for HTML labels: http(s), mailto, tel, fragment or relative. */
export function isSafeLabelLink(raw: string): boolean {
  const url = compactUrl(raw).toLowerCase();
  const scheme = SCHEME.exec(url)?.[1];
  return !scheme || scheme === 'http' || scheme === 'https' || scheme === 'mailto' || scheme === 'tel';
}

/** An image source for HTML labels: https, relative or data:image. */
export function isSafeLabelImage(raw: string): boolean {
  const url = compactUrl(raw);
  const scheme = SCHEME.exec(url)?.[1]?.toLowerCase();
  if (!scheme) return true;
  if (scheme === 'https') return true;
  return scheme === 'data' && DATA_IMAGE.test(url);
}

const UNSAFE_CSS = /expression\s*\(|javascript:|vbscript:|-moz-binding|behavior\s*:|@import|position\s*:\s*fixed|\\/i;
const CSS_URL = /url\s*\(\s*(['"]?)([^'")]*)\1\s*\)/gi;

/**
 * CSS (a style attribute or an SVG `<style>`) without script, imports, bindings, escapes (which could
 * spell any of these), fixed positioning (a label covering the app) and `url()` other than `#id`,
 * https and data:image.
 */
export function isSafeCss(css: string, opts: { allowHttpsUrls?: boolean } = {}): boolean {
  // eslint-disable-next-line no-control-regex
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/[\u0000-\u001f\u007f-\u009f]+/g, '');
  if (UNSAFE_CSS.test(text)) return false;
  for (const match of text.matchAll(CSS_URL)) {
    const target = match[2].trim();
    if (target.startsWith('#')) continue;
    if (DATA_IMAGE.test(target)) continue;
    if (opts.allowHttpsUrls !== false && /^https:\/\//i.test(target)) continue;
    return false;
  }
  // an unclosed or unusual url( that the pattern above did not match
  const urls = text.match(/url\s*\(/gi)?.length ?? 0;
  const parsed = Array.from(text.matchAll(CSS_URL)).length;
  return urls === parsed;
}

function createPurifier(): Purifier {
  const win = (globalThis as { window?: Window }).window;
  const purifier = win ? DOMPurify(win as unknown as Parameters<Purifier>[0]) : null;
  if (!purifier?.isSupported) throw new Error('HTML sanitizer unavailable: no DOM');
  return purifier;
}

function lazy(setup: (p: Purifier) => void): () => Purifier {
  let instance: Purifier | null = null;
  let forWindow: unknown = null;
  return () => {
    const win = (globalThis as { window?: Window }).window;
    // a new jsdom window (tests, the local MCP server's headless documents) gets a new instance
    if (!instance || forWindow !== win) {
      instance = createPurifier();
      forWindow = win;
      setup(instance);
    }
    return instance;
  };
}

// ---------------------------------------------------------------------------------- HTML labels

const LABEL_CONFIG: Config = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ['target'],
  FORBID_TAGS: [
    'style', 'form', 'input', 'button', 'textarea', 'select', 'option', 'optgroup', 'datalist', 'template',
    'noscript', 'title', 'meta', 'link', 'base', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet',
    'audio', 'video', 'source', 'track', 'picture', 'dialog', 'details', 'summary', 'slot',
  ],
  FORBID_ATTR: ['srcset', 'action', 'formaction', 'ping', 'background', 'poster', 'xmlns'],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: true,
  ALLOW_UNKNOWN_PROTOCOLS: false,
};

const labelPurifier = lazy((p) => {
  p.addHook('uponSanitizeAttribute', (node, data) => {
    const name = data.attrName;
    if (name === 'style' && !isSafeCss(data.attrValue)) data.keepAttr = false;
    else if (name === 'href' && !isSafeLabelLink(data.attrValue)) data.keepAttr = false;
    else if (name === 'src' && !isSafeLabelImage(data.attrValue)) data.keepAttr = false;
    else if (name === 'target' && node.localName !== 'a') data.keepAttr = false;
  });
  p.addHook('afterSanitizeAttributes', (node) => {
    // draw.io (Graph.sanitizeNode): links opening a new window never get the opener
    if (node.localName === 'a' && node.hasAttribute('target')) node.setAttribute('rel', 'noopener noreferrer');
  });
});

const labelCache = new Map<string, string>();
const LABEL_CACHE_LIMIT = 1000;

/** HTML of a draw.io label, allow-list sanitized (no script, handlers, script URLs, SVG/MathML). */
export function sanitizeHtmlLabel(html: string): string {
  if (!/[<&]/.test(html)) return html;
  const hit = labelCache.get(html);
  if (hit !== undefined) return hit;
  const out = labelPurifier().sanitize(html, LABEL_CONFIG) as unknown as string;
  if (labelCache.size >= LABEL_CACHE_LIMIT) labelCache.clear();
  labelCache.set(html, out);
  return out;
}

// ------------------------------------------------------------------------------------- Markdown

const MD_ATTRS: Record<string, string[]> = {
  h1: [], h2: [], h3: [], h4: [], h5: [], h6: [],
  p: [], br: [], hr: [], strong: [], em: [], del: [], code: ['class'], pre: [], blockquote: [],
  ul: [], ol: ['start'], li: ['class'], table: [], thead: [], tbody: [], tr: [], th: ['class'], td: ['class'],
  a: ['href', 'title', 'target', 'rel'], img: ['src', 'alt', 'title', 'loading'], span: ['class', 'title'],
  input: ['type', 'disabled', 'checked'],
};

const MD_CONFIG: Config = {
  ALLOWED_TAGS: Object.keys(MD_ATTRS),
  ALLOWED_ATTR: Array.from(new Set(Object.values(MD_ATTRS).flat())),
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
  ADD_FORBID_CONTENTS: ['object', 'embed', 'textarea', 'select', 'form', 'button'],
  RETURN_DOM_FRAGMENT: true,
};

export interface MarkdownUrlRules {
  link: (url: string) => string | null;
  image: (url: string) => string | null;
}

let mdRules: MarkdownUrlRules | null = null;

/** The Markdown renderer's URL rules (markdown.ts registers them; one source of truth). */
export function setMarkdownUrlRules(rules: MarkdownUrlRules): void {
  mdRules = rules;
}

const mdPurifier = lazy((p) => {
  p.addHook('uponSanitizeAttribute', (node, data) => {
    const tag = node.localName;
    const name = data.attrName;
    const value = data.attrValue;
    if (!(MD_ATTRS[tag] ?? []).includes(name)) data.keepAttr = false;
    else if (name === 'href' && !mdRules?.link(value)) data.keepAttr = false;
    else if (name === 'src' && !mdRules?.image(value)) data.keepAttr = false;
    else if (name === 'class' && !/^(rd-md-[\w-]+|language-[\w+-]+)$/.test(value)) data.keepAttr = false;
    else if (name === 'start' && !/^\d{1,9}$/.test(value)) data.keepAttr = false;
  });
});

/** Allow-list sanitizer for rendered Markdown: HTML string -> cleaned fragment of `document`. */
export function sanitizeMarkdownFragment(html: string): DocumentFragment {
  const frag = mdPurifier().sanitize(html, MD_CONFIG) as unknown as DocumentFragment;
  for (const a of Array.from(frag.querySelectorAll('a'))) {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  }
  for (const input of Array.from(frag.querySelectorAll('input'))) {
    if (input.getAttribute('type') !== 'checkbox') input.remove();
    else input.setAttribute('disabled', '');
  }
  for (const img of Array.from(frag.querySelectorAll('img'))) {
    if (!img.hasAttribute('src')) img.replaceWith(img.ownerDocument.createTextNode(img.getAttribute('alt') ?? ''));
  }
  return document.importNode(frag, true);
}

// ------------------------------------------------------------------------------------------ SVG

const SVG_NS = 'http://www.w3.org/2000/svg';

const SVG_CONFIG: Config = {
  USE_PROFILES: { svg: true, svgFilters: true },
  FORBID_TAGS: [
    'script', 'foreignObject', 'foreignobject', 'animate', 'animateMotion', 'animateTransform', 'animateColor', 'set',
    'mpath', 'discard', 'handler', 'listener', 'iframe', 'object', 'embed', 'audio', 'video', 'canvas',
  ],
  // `href` (SVG 2 links / images): checked by the hook below like `xlink:href`
  ADD_ATTR: ['href'],
  // `<use>` (DOMPurify drops it by default for external references): only `#id` refs pass the hook
  ADD_TAGS: ['use'],
  FORBID_ATTR: ['attributeName', 'values', 'from', 'to', 'by', 'begin', 'end', 'xmlns:ev'],
  ALLOW_DATA_ATTR: false,
  RETURN_DOM: true,
};

/** `href`/`xlink:href` in a server SVG: only `#id` and raster data:image (no remote fetches). */
function isSafeSvgRef(raw: string): boolean {
  const url = compactUrl(raw);
  return url.startsWith('#') || RASTER_DATA_IMAGE.test(url);
}

const svgPurifier = lazy((p) => {
  p.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName === 'style' && !isSafeCss(node.textContent ?? '', { allowHttpsUrls: false })) {
      node.textContent = '';
    }
  });
  p.addHook('uponSanitizeAttribute', (_node, data) => {
    const name = data.attrName;
    const value = data.attrValue;
    if (name === 'href' || name === 'xlink:href') {
      if (!isSafeSvgRef(value)) data.keepAttr = false;
    } else if (name === 'style' ? !isSafeCss(value, { allowHttpsUrls: false }) : /url\s*\(\s*['"]?(?!#)|javascript:|expression\(/i.test(value)) {
      data.keepAttr = false;
    }
  });
});

export class InvalidSvgError extends Error {}

/** SVG markup (e.g. from a PlantUML server) -> sanitized, XML-serialized `<svg>`; throws if not SVG. */
export function sanitizeSvgMarkup(markup: string): string {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.localName !== 'svg' || root.namespaceURI !== SVG_NS || doc.getElementsByTagName('parsererror').length > 0) {
    throw new InvalidSvgError('not an SVG image');
  }
  const body = svgPurifier().sanitize(new XMLSerializer().serializeToString(root), SVG_CONFIG) as unknown as HTMLElement;
  const svg = Array.from(body.children).find((el) => el.localName === 'svg' && el.namespaceURI === SVG_NS);
  if (!svg) throw new InvalidSvgError('not an SVG image');
  return new XMLSerializer().serializeToString(svg);
}
