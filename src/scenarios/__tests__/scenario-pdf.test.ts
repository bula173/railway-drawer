/**
 * Scenario PDF (scenario-pdf.ts + pdf-layout.ts) with the real jsPDF in jsdom: header, page count
 * (title + >= 1 per step), page numbers, Markdown text, changes list, Unicode fonts (real DejaVu
 * files) vs. the Latin-1 fallback, UML via svg2pdf or the raster fallback.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { buildScenarioPdf, scenarioPdfFileName } from '../scenario-pdf';
import type { ScenarioPdfDeps } from '../scenario-pdf';
import type { ScenarioData } from '../scenario-model';
import { needsUnicodeFont, toLatin1 } from '../pdf-layout';
import { renderStepUml } from '../step-uml';

const PNG_1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function model(cells: string): string {
  return `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}</root></mxGraphModel>`;
}

const vtx = (id: string, label: string, x: number): string =>
  `<mxCell id="${id}" value="${label}" style="" vertex="1" parent="1"><mxGeometry x="${x}" y="10" width="60" height="30" as="geometry"/></mxCell>`;

const MARKDOWN = `# Heading one
Some **bold**, *italic*, \`code\`, ~~gone~~ and a [link](https://example.com).

## Lists
- first
- second
  - nested
- [x] done task
- [ ] open task

1. one
2. two

> quoted text
> more

\`\`\`
code block line 1
code block line 2
\`\`\`

| Signal | Aspect | km |
|:-------|:------:|---:|
| S1 | green | 12.345 |
| S2 | red | 12.900 |

---
Final paragraph with a very long word Donaudampfschifffahrtsgesellschaftskapitänsmützenabzeichenherstellungsbetrieb end.`;

function scenario(steps = 3): ScenarioData {
  return {
    id: 's',
    name: 'Entry with RBC',
    description: 'Train enters the RBC area',
    steps: Array.from({ length: steps }, (_, i) => ({
      id: `st${i}`,
      name: `Step ${i + 1}`,
      description: i === 0 ? 'start' : '',
      xml: model(vtx('train', 'Train', 10 + i * 50) + (i > 0 ? vtx('s2', 'S2', 300) : '')),
      uml: i === 1 ? '@startuml\nTrain -> RBC : MA Request\nRBC --> Train : MA\n@enduml' : '',
      text: i === 0 ? MARKDOWN : i === 2 ? 'Just *text*.' : '',
    })),
  };
}

/** Raw PDF text + every inflated content stream. */
function pdfText(bytes: ArrayBuffer): { raw: string; streams: string } {
  const raw = Buffer.from(bytes).toString('latin1');
  const parts: string[] = [];
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const start = m.index + m[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) break;
    const chunk = Buffer.from(raw.slice(start, end).replace(/\r?\n$/, ""), "latin1");
    try {
      parts.push(inflateSync(chunk).toString('latin1'));
    } catch {
      parts.push(chunk.toString('latin1'));
    }
    re.lastIndex = end + 'endstream'.length;
  }
  return { raw, streams: parts.join('\n') };
}

function pageCount(raw: string): number {
  return (raw.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

const require = createRequire(import.meta.url);
function fontFile(name: string): string {
  return readFileSync(require.resolve(`dejavu-fonts-ttf/ttf/${name}`)).toString('base64');
}

describe('buildScenarioPdf', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const baseDeps = (over: Partial<ScenarioPdfDeps> = {}): ScenarioPdfDeps => ({
    renderDrawingPng: vi.fn(async () => ({ dataUrl: PNG_1x1, width: 400, height: 200 })),
    rasterizeSvg: vi.fn(async () => ({ dataUrl: PNG_1x1, width: 300, height: 150 })),
    loadSvg2Pdf: null,
    loadFonts: vi.fn(async () => null),
    now: new Date(2026, 9, 16, 9, 5),
    ...over,
  });

  it('writes a PDF with a title page, >= 1 page per step, page numbers and the Markdown text', async () => {
    const deps = baseDeps();
    const bytes = await buildScenarioPdf(scenario(3), 'Station A', deps, { orientation: 'portrait' });
    const { raw, streams } = pdfText(bytes);
    expect(raw.startsWith('%PDF-')).toBe(true);
    const pages = pageCount(raw);
    expect(pages).toBeGreaterThanOrEqual(4);
    expect(streams).toContain(`(Page 1 of ${pages})`);
    expect(streams).toContain(`(Page ${pages} of ${pages})`);
    expect(streams).toContain('(Entry with RBC)');
    expect(streams).toContain('(Diagram: )');
    expect(streams).toContain('(2026-10-16 09:05)');
    expect(streams).toContain('(1. Step 1)');
    expect(streams).toContain('(Heading one)');
    expect(streams).toContain('(bold)');
    expect(streams).toContain('(code block line 1)');
    expect(streams).toContain('(Signal)');
    expect(streams).toContain('(12.345)');
    expect(streams).toContain('(quoted text)');
    expect(streams).toContain('(nested)');
    // links are real link annotations
    expect(raw).toMatch(/\/URI \(https:\/\/example\.com\)/);
    // the standard fonts only, no embedded font program
    expect(raw).toContain('/Helvetica');
    expect(raw).not.toContain('/FontFile2');
    // UML (no svg2pdf) -> raster fallback; drawings -> one PNG per step
    expect(deps.rasterizeSvg).toHaveBeenCalledTimes(1);
    expect(deps.renderDrawingPng).toHaveBeenCalledTimes(3);
    expect(deps.loadFonts).not.toHaveBeenCalled();
    // document properties (the title has an em dash: written as UTF-16)
    expect(raw).toContain('/Creator (Railway Drawer)');
    expect(raw).toMatch(/\/Title \(\xfe\xff\0E\0n\0t\0r\0y/);
  });

  it('landscape A4 pages', async () => {
    const bytes = await buildScenarioPdf(scenario(1), 'D', baseDeps(), { orientation: 'landscape' });
    const { raw } = pdfText(bytes);
    const box = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(raw)!;
    expect(Number(box[1])).toBeGreaterThan(Number(box[2]));
  });

  it('with "highlight changes": highlighted drawings and the change list', async () => {
    const deps = baseDeps();
    const bytes = await buildScenarioPdf(scenario(3), 'D', deps, { showChanges: true });
    const { streams } = pdfText(bytes);
    const xmls = vi.mocked(deps.renderDrawingPng).mock.calls.map((c) => c[0]);
    expect(xmls[0]).not.toContain('rdDiff=');
    expect(xmls[1]).toContain('rdDiff=added');
    expect(xmls[1]).toContain('rdDiff=moved');
    expect(streams).toContain('(S2 added)');
    expect(streams).toContain('(Train: moved)');
    expect(streams).toContain('(First step: nothing to compare with.)');
    expect(streams).toContain('(CHANGES SINCE THE PREVIOUS STEP)');
  });

  it('embeds DejaVu when the text needs it (Polish), and transliterates when the fonts are missing', async () => {
    const s = scenario(1);
    s.name = 'Wjazd pociągu';
    s.steps[0].text = '## Żądanie MA\n- pociąg → RBC';
    const files = { sans: fontFile('DejaVuSans.ttf'), sansBold: fontFile('DejaVuSans-Bold.ttf'), mono: fontFile('DejaVuSansMono.ttf') };
    const withFonts = pdfText(await buildScenarioPdf(s, 'Węzeł', baseDeps({ loadFonts: async () => files })));
    expect(withFonts.raw).toContain('/FontFile2');
    expect(withFonts.raw).toMatch(/\/BaseFont \/DejaVuSans/);
    expect(withFonts.raw).toContain('/ToUnicode');

    const fallback = pdfText(await buildScenarioPdf(s, 'Węzeł', baseDeps({ loadFonts: async () => null })));
    expect(fallback.raw).not.toContain('/FontFile2');
    expect(fallback.streams).toContain('(Wjazd pociagu)');
    expect(fallback.streams).toContain('(Zadanie MA)');
    expect(fallback.streams).toContain('(pociag -> RBC)');
  });

  it('draws UML as vectors with svg2pdf when it works, else rasterizes', async () => {
    const svg2pdf = vi.fn(async () => undefined);
    const deps = baseDeps({ loadSvg2Pdf: async () => svg2pdf, renderUml: (src) => renderStepUml(src) });
    await buildScenarioPdf(scenario(2), 'D', deps);
    expect(svg2pdf).toHaveBeenCalledTimes(1);
    const [node, , box] = svg2pdf.mock.calls[0] as unknown as [Element, unknown, { width: number; height: number }];
    expect(node.tagName.toLowerCase()).toBe('svg');
    expect(node.getAttribute('font-family')).toBe('helvetica');
    expect(box.width).toBeGreaterThan(0);
    expect(deps.rasterizeSvg).not.toHaveBeenCalled();

    const failing = baseDeps({ loadSvg2Pdf: async () => vi.fn(async () => Promise.reject(new Error('no getBBox'))) });
    await buildScenarioPdf(scenario(2), 'D', failing);
    expect(failing.rasterizeSvg).toHaveBeenCalledTimes(1);
  });

  it('reports a drawing that cannot be rendered on its page instead of failing', async () => {
    const deps = baseDeps({ renderDrawingPng: async () => Promise.reject(new Error('boom')) });
    const { streams } = pdfText(await buildScenarioPdf(scenario(1), 'D', deps));
    expect(streams).toContain('(The drawing could not be rendered: boom)');
  });

  it('file name and font helpers', () => {
    expect(scenarioPdfFileName('My: diagram', 'A/B')).toBe('My_ diagram - A_B.pdf');
    expect(needsUnicodeFont('Café — “x” → y')).toBe(false);
    expect(needsUnicodeFont('Łódź')).toBe(true);
    expect(toLatin1('Łódź → ☑')).toBe('Lódz -> [x]');
  });
});
