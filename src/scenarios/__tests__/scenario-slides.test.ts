/**
 * HTML slideshow export (scenario-slides.ts): structure (title + one slide per step), CSP with the
 * script's real SHA-256, a single constant script, escaping/sanitizing of user content, optional
 * change lists, and the navigation script itself (keys, buttons, hash) run in jsdom.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { buildScenarioSlidesHtml, SLIDES_SCRIPT, slidesScriptHash, scenarioSlidesFileName } from '../scenario-slides';
import type { ScenarioData } from '../scenario-model';

const model = (cells: string): string => `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}</root></mxGraphModel>`;
const vtx = (id: string, label: string, x: number): string =>
  `<mxCell id="${id}" value="${label}" style="" vertex="1" parent="1"><mxGeometry x="${x}" y="10" width="60" height="30" as="geometry"/></mxCell>`;

function scenario(): ScenarioData {
  return {
    id: 's',
    name: 'Entry <b>"RBC"</b>',
    description: 'desc & more',
    steps: [
      { id: 'a', name: 'Start <img src=x onerror=alert(1)>', description: '', xml: model(vtx('t', 'Train', 0)), uml: '', text: '# One\n<script>alert(1)</script>\n[x](javascript:alert(1))' },
      { id: 'b', name: 'Move', description: 'the train moves', xml: model(vtx('t', 'Train', 100) + vtx('s', 'S2', 300)), uml: '@startuml\nA -> B : hi\n@enduml', text: '' },
      { id: 'c', name: 'End', description: '', xml: model(vtx('t', 'Train', 100)), uml: '', text: '- done' },
    ],
  };
}

const deps = {
  renderDrawingSvg: async (xml: string): Promise<string> => `<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><desc>${xml.length}</desc></svg>`,
  now: new Date('2026-10-16T10:00:00Z'),
};

describe('buildScenarioSlidesHtml', () => {
  afterEach(() => {
    document.body.replaceChildren();
    document.documentElement.classList.remove('js');
    history.replaceState(null, '', '/');
  });

  it('title slide + one slide per step, every step drawing, UML and text', async () => {
    const html = await buildScenarioSlidesHtml(scenario(), 'Station', deps);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const slides = doc.querySelectorAll('#deck > section.slide');
    expect(slides).toHaveLength(4);
    expect(doc.querySelectorAll('section.slide.step')).toHaveLength(3);
    expect(Array.from(doc.querySelectorAll('section.step h2')).map((h) => h.textContent)).toEqual(['Start <img src=x onerror=alert(1)>', 'Move', 'End']);
    expect(doc.querySelectorAll('section.step .drawing img[src^="data:image/svg+xml;base64,"]')).toHaveLength(3);
    expect(doc.querySelector('section.step[data-step="2"] .uml svg')).not.toBeNull();
    expect(doc.querySelector('section.step[data-step="1"] .markdown h1')?.textContent).toBe('One');
    expect(doc.querySelector('.title-slide h1')?.textContent).toBe('Entry <b>"RBC"</b>');
    expect(doc.querySelectorAll('.title-slide ol li')).toHaveLength(3);
    expect(doc.title).toBe('Entry <b>"RBC"</b> — Station');
    expect(doc.querySelector('.changes')).toBeNull();
  });

  it('is safe: escaped names, sanitized Markdown, one constant script allowed by its hash', async () => {
    const html = await buildScenarioSlidesHtml(scenario(), 'Station', deps);
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<b>"RBC"</b>');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<script>alert');
    const scripts = html.match(/<script\b[^>]*>/g) ?? [];
    expect(scripts).toEqual(['<script>']);
    expect(html).toContain(`<script>${SLIDES_SCRIPT}</script>`);
    const expected = `'sha256-${createHash('sha256').update(SLIDES_SCRIPT, 'utf8').digest('base64')}'`;
    expect(slidesScriptHash()).toBe(expected);
    const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html)?.[1] ?? '';
    expect(csp).toBe(`default-src 'none'; img-src data: https:; style-src 'unsafe-inline'; script-src ${expected}`);
    expect(scenarioSlidesFileName('D', 'S/1')).toBe('D - S_1 (slides).html');
  });

  it('with changes: highlighted drawings and a change list per step', async () => {
    const seen: string[] = [];
    const html = await buildScenarioSlidesHtml(scenario(), 'Station', { ...deps, renderDrawingSvg: async (xml) => (seen.push(xml), '<svg xmlns="http://www.w3.org/2000/svg"/>') }, { showChanges: true });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(seen[0]).not.toContain('rdDiff');
    expect(seen[1]).toContain('rdDiff=added');
    expect(doc.querySelector('section.step[data-step="1"] .changes')?.textContent).toContain('First step');
    expect(Array.from(doc.querySelectorAll('section.step[data-step="2"] .changes li')).map((li) => [li.getAttribute('data-kind'), li.textContent])).toEqual([
      ['moved', 'Train: moved'],
      ['added', 'S2 added'],
    ]);
    expect(Array.from(doc.querySelectorAll('section.step[data-step="3"] .changes li')).map((li) => li.textContent)).toEqual(['S2 removed']);
  });

  it('the navigation script: keys, buttons, Home/End, hash', async () => {
    const html = await buildScenarioSlidesHtml(scenario(), 'Station', deps);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    document.body.innerHTML = doc.body.innerHTML.replace(/<script>[\s\S]*<\/script>/, '');
    new Function(SLIDES_SCRIPT)();
    const active = (): number => Array.from(document.querySelectorAll('#deck > section.slide')).findIndex((s) => s.classList.contains('active'));
    const counter = document.querySelector('[data-rd="counter"]')!;
    expect(document.documentElement.classList.contains('js')).toBe(true);
    expect(active()).toBe(0);
    expect(counter.textContent).toBe('1 / 4');
    const key = (k: string, shift = false): void => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey: shift, bubbles: true, cancelable: true }));
    };
    key('ArrowRight');
    expect(active()).toBe(1);
    key(' ');
    expect(active()).toBe(2);
    key(' ', true);
    expect(active()).toBe(1);
    key('End');
    expect(active()).toBe(3);
    expect((document.querySelector('[data-rd="next"]') as HTMLButtonElement).disabled).toBe(true);
    key('ArrowRight');
    expect(active()).toBe(3);
    expect(location.hash).toBe('#4');
    (document.querySelector('[data-rd="prev"]') as HTMLButtonElement).click();
    expect(active()).toBe(2);
    key('Home');
    expect(active()).toBe(0);
    expect(counter.textContent).toBe('1 / 4');
  });
});
