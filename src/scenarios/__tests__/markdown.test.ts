import { describe, it, expect } from 'vitest';
import { renderMarkdown, renderInline, sanitizeHtml, sanitizeHtmlString, safeLinkUrl, safeImageUrl, showMarkdown } from '../markdown';

function html(md: string): string {
  return sanitizeHtmlString(renderMarkdown(md));
}

describe('renderMarkdown', () => {
  it('renders headings, paragraphs, emphasis, code and line breaks', () => {
    expect(renderMarkdown('# Tytuł\n## Sub ##')).toBe('<h1>Tytuł</h1>\n<h2>Sub</h2>');
    expect(renderInline('**bold** and *it* and _it2_ and ~~gone~~ and `a*b*`')).toBe(
      '<strong>bold</strong> and <em>it</em> and <em>it2</em> and <del>gone</del> and <code>a*b*</code>'
    );
    expect(renderInline('***both***')).toBe('<strong><em>both</em></strong>');
    expect(renderInline('**bold *nested* text**')).toBe('<strong>bold <em>nested</em> text</strong>');
    expect(renderInline('snake_case_name 2*3*4')).toBe('snake_case_name 2<em>3</em>4');
    expect(renderInline('\\*not em\\*')).toBe('*not em*');
    expect(renderMarkdown('line one  \nline two\\\nline three\nsame')).toBe('<p>line one<br>\nline two<br>\nline three\nsame</p>');
  });

  it('renders lists (nested, ordered with start, tasks)', () => {
    expect(renderMarkdown('- a\n- b\n  - b1\n  - b2\n- c')).toBe('<ul><li>a</li><li>b\n<ul><li>b1</li><li>b2</li></ul></li><li>c</li></ul>');
    expect(renderMarkdown('3. three\n4. four')).toBe('<ol start="3"><li>three</li><li>four</li></ol>');
    expect(renderMarkdown('- [x] done\n- [ ] todo')).toBe(
      '<ul><li class="rd-md-task"><input type="checkbox" disabled checked> done</li><li class="rd-md-task"><input type="checkbox" disabled> todo</li></ul>'
    );
    expect(renderMarkdown('Text\n- item')).toBe('<p>Text</p>\n<ul><li>item</li></ul>');
  });

  it('renders tables, fenced code, quotes and rules', () => {
    expect(renderMarkdown('| A | B |\n|:--|--:|\n| 1 | **2** |')).toBe(
      '<table><thead><tr><th class="rd-md-align-left">A</th><th class="rd-md-align-right">B</th></tr></thead>' +
        '<tbody><tr><td class="rd-md-align-left">1</td><td class="rd-md-align-right"><strong>2</strong></td></tr></tbody></table>'
    );
    expect(renderMarkdown('```js\nif (a < b) { x(); }\n```')).toBe('<pre><code class="language-js">if (a &lt; b) { x(); }</code></pre>');
    expect(renderMarkdown('> quoted *text*\n> more')).toBe('<blockquote><p>quoted <em>text</em>\nmore</p></blockquote>');
    expect(renderMarkdown('---')).toBe('<hr>');
  });

  it('renders links and images with safe URLs only', () => {
    expect(renderInline('[RBC](https://example.com/a_b_c "T")')).toBe(
      '<a href="https://example.com/a_b_c" title="T" target="_blank" rel="noopener noreferrer">RBC</a>'
    );
    expect(renderInline('see https://example.com/x.')).toBe(
      'see <a href="https://example.com/x" target="_blank" rel="noopener noreferrer">https://example.com/x</a>.'
    );
    expect(renderInline('<mailto:a@b.pl>')).toContain('href="mailto:a@b.pl"');
    expect(renderInline('![sig](https://example.com/s.png)')).toBe('<img src="https://example.com/s.png" alt="sig" loading="lazy">');
    expect(renderInline('![x](data:image/png;base64,iVBORw0KGgo=)')).toContain('src="data:image/png;base64,iVBORw0KGgo="');
    expect(renderInline('![x](http://insecure.example/x.png)')).toContain('rd-md-blocked');
  });
});

describe('XSS payloads', () => {
  const payloads = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '[click](javascript:alert(1))',
    '[click](JaVaScRiPt:alert(1))',
    '[click](java\tscript:alert(1))',
    '[click](  javascript:alert(1))',
    '[click](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
    '[click](vbscript:msgbox(1))',
    '![x](javascript:alert(1))',
    '![x](data:text/html,<script>alert(1)</script>)',
    '![x](https://e.com/a.png" onerror="alert(1))',
    '[x](https://e.com/" onmouseover="alert(1))',
    '<a href="javascript:alert(1)">x</a>',
    '<svg onload=alert(1)>',
    '<iframe src="https://evil"></iframe>',
    '`<script>`',
    '```\n<script>alert(1)</script>\n```',
    '**<img src=x onerror=alert(1)>**',
    '| <script>alert(1)</script> | b |\n|---|---|\n| <b onclick=x>c</b> | d |',
    '<style>body{display:none}</style>',
    '[<img src=x onerror=alert(1)>](https://e.com)',
    '<https://e.com/"><script>alert(1)</script>>',
  ];
  for (const payload of payloads) {
    it(`neutralizes ${JSON.stringify(payload)}`, () => {
      const out = html(payload);
      const holder = document.createElement('div');
      holder.innerHTML = out;
      expect(holder.querySelector('script, iframe, svg, style, object, embed')).toBeNull();
      for (const el of Array.from(holder.querySelectorAll('*'))) {
        for (const attr of Array.from(el.attributes)) {
          expect(attr.name.startsWith('on')).toBe(false);
          if (attr.name === 'href') expect(attr.value).toMatch(/^(https?:|mailto:|#)/);
          if (attr.name === 'src') expect(attr.value).toMatch(/^(https:|data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,)/);
        }
      }
      // raw HTML is shown as text: no markup other than the renderer's own tags
      expect(out).not.toMatch(/<(script|svg|iframe|style|b |img [^>]*on)/i);
    });
  }

  it('sanitizeHtml strips raw HTML that did not come from the renderer', () => {
    const frag = sanitizeHtml(
      '<p onclick="x()">ok <a href="javascript:alert(1)">a</a> <img src="x" onerror="y"> <script>z()</script><b>bold</b><input type="text"></p>'
    );
    const div = document.createElement('div');
    div.appendChild(frag);
    expect(div.innerHTML).toBe('<p>ok <a target="_blank" rel="noopener noreferrer">a</a>  bold</p>');
  });

  it('URL guards', () => {
    expect(safeLinkUrl('https://x.pl')).toBe('https://x.pl');
    expect(safeLinkUrl('javascript:alert(1)')).toBeNull();
    expect(safeLinkUrl('\u0001javascript:alert(1)')).toBeNull();
    expect(safeLinkUrl('/relative')).toBeNull();
    expect(safeImageUrl('http://x.pl/a.png')).toBeNull();
    expect(safeImageUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe('data:image/svg+xml;base64,PHN2Zz4=');
  });

  it('showMarkdown inserts the sanitized rendering', () => {
    const host = document.createElement('div');
    showMarkdown(host, '# Krok 1\n- Pociąg „ICC” <b>x</b>');
    expect(host.querySelector('h1')?.textContent).toBe('Krok 1');
    expect(host.querySelector('li')?.textContent).toBe('Pociąg „ICC” <b>x</b>');
    showMarkdown(host, '   ');
    expect(host.textContent).toBe('No text.');
  });
});
