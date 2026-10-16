/**
 * @file scenario-export.ts
 * @brief "Export scenario" as one self-contained HTML file: per step the drawing (SVG via the
 *        draw.io-like image export), the UML diagram (SVG) and the Markdown text (HTML).
 *
 * The file has no scripts and no external resources (except https images the Markdown links to); a
 * Content-Security-Policy meta tag forbids scripts and remote styles/fonts. Drawings are embedded as
 * `data:image/svg+xml` images (isolated from each other: maxGraph SVGs reuse ids); UML diagrams are
 * inline SVG (local renderer output = escaped text; server output sanitized); Markdown goes through
 * the renderer and the allow-list sanitizer. Steps start on a new page when printed (PDF later).
 */
import type { ScenarioData } from './scenario-model';
import { renderStepUml } from './step-uml';
import type { UmlRenderResult } from './step-uml';
import { renderMarkdown, sanitizeHtmlString, escapeHtml } from './markdown';

export interface ScenarioExportDeps {
  /** `<mxGraphModel>` -> standalone SVG document text. */
  renderDrawingSvg(xml: string): Promise<string>;
  renderUml?(source: string): Promise<UmlRenderResult>;
  /** Export timestamp (tests). */
  now?: Date;
}

function toBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

const STYLE = `
:root { color-scheme: light; }
body { margin: 0; padding: 24px; font: 14px/1.5 Helvetica, Arial, sans-serif; color: #222; background: #fff; }
header { border-bottom: 2px solid #f9a825; margin-bottom: 16px; }
h1 { margin: 0 0 4px; font-size: 24px; }
.meta { color: #666; font-size: 12px; margin: 0 0 12px; }
nav ol { margin: 8px 0 16px; }
section.step { border-top: 1px solid #ddd; padding-top: 16px; margin-top: 24px; }
section.step > h2 { margin: 0 0 4px; font-size: 18px; }
.desc { color: #555; margin: 0 0 12px; }
.parts { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 16px; align-items: start; }
.part h3 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #777; }
.drawing img, .uml svg { max-width: 100%; height: auto; border: 1px solid #eee; background: #fff; }
.side { display: flex; flex-direction: column; gap: 16px; }
.missing, .error { color: #888; font-style: italic; }
.error { color: #b71c1c; }
.markdown table { border-collapse: collapse; }
.markdown th, .markdown td { border: 1px solid #ccc; padding: 3px 8px; }
.markdown pre { background: #f5f5f5; padding: 8px; overflow: auto; }
.markdown code { background: #f5f5f5; padding: 0 3px; }
.markdown img { max-width: 100%; }
.rd-md-align-center { text-align: center; } .rd-md-align-right { text-align: right; } .rd-md-align-left { text-align: left; }
.rd-md-task { list-style: none; }
@media (max-width: 800px) { .parts { grid-template-columns: 1fr; } }
@media print { body { padding: 0; } nav { display: none; } section.step { page-break-before: always; border: 0; } }
`;

/** The whole scenario as an HTML document. */
export async function buildScenarioHtml(scenario: ScenarioData, diagramName: string, deps: ScenarioExportDeps): Promise<string> {
  const renderUml = deps.renderUml ?? ((source: string) => renderStepUml(source));
  const now = deps.now ?? new Date();
  const sections: string[] = [];
  for (const [index, step] of scenario.steps.entries()) {
    let drawing: string;
    try {
      const svg = (await deps.renderDrawingSvg(step.xml)).replace(/^<\?xml[^>]*\?>\s*/, '');
      drawing = `<img alt="${escapeHtml(`Drawing of step ${index + 1}: ${step.name}`)}" src="data:image/svg+xml;base64,${toBase64Utf8(svg)}">`;
    } catch (error) {
      drawing = `<p class="error">The drawing could not be rendered: ${escapeHtml(error instanceof Error ? error.message : String(error))}</p>`;
    }
    let uml = '';
    if (step.uml.trim()) {
      const result = await renderUml(step.uml);
      uml =
        result.status === 'ok'
          ? result.svg
          : result.status === 'error'
            ? `<p class="error">${escapeHtml(result.message)}</p><pre>${escapeHtml(step.uml)}</pre>`
            : '';
    }
    const text = step.text.trim() ? sanitizeHtmlString(renderMarkdown(step.text)) : '';
    sections.push(
      `<section class="step" id="step-${index + 1}">` +
        `<h2>${index + 1}. ${escapeHtml(step.name)}</h2>` +
        (step.description ? `<p class="desc">${escapeHtml(step.description)}</p>` : '') +
        `<div class="parts">` +
        `<div class="part drawing"><h3>Drawing</h3>${drawing}</div>` +
        `<div class="side">` +
        `<div class="part uml"><h3>UML</h3>${uml || '<p class="missing">No UML diagram.</p>'}</div>` +
        `<div class="part markdown"><h3>Text</h3>${text || '<p class="missing">No text.</p>'}</div>` +
        `</div></div></section>`
    );
  }
  const title = `${scenario.name} — ${diagramName}`;
  const toc = scenario.steps.map((s, i) => `<li><a href="#step-${i + 1}">${escapeHtml(s.name)}</a></li>`).join('');
  return (
    '<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8">' +
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; style-src 'unsafe-inline'">` +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="generator" content="Railway Drawer">' +
    `<title>${escapeHtml(title)}</title><style>${STYLE}</style></head><body>` +
    `<header><h1>${escapeHtml(scenario.name)}</h1>` +
    (scenario.description ? `<p class="desc">${escapeHtml(scenario.description)}</p>` : '') +
    `<p class="meta">Diagram “${escapeHtml(diagramName)}” · ${scenario.steps.length} step${scenario.steps.length === 1 ? '' : 's'} · exported ${escapeHtml(now.toISOString().slice(0, 16).replace('T', ' '))} UTC</p>` +
    `</header><nav aria-label="Steps"><ol>${toc}</ol></nav>` +
    sections.join('\n') +
    '</body></html>\n'
  );
}

/** File name for the export: "<diagram> - <scenario>.html" without characters file systems reject. */
export function scenarioExportFileName(diagramName: string, scenarioName: string): string {
  // eslint-disable-next-line no-control-regex
  const clean = (s: string): string => s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim();
  return `${clean(diagramName) || 'diagram'} - ${clean(scenarioName) || 'scenario'}.html`;
}
