/**
 * @file scenario-slides.ts
 * @brief "Export Scenario (Slides)": one self-contained HTML slideshow, a title slide and one slide
 *        per step (drawing, optional change list, UML diagram, Markdown text).
 *
 * Navigation: ←/→, PageUp/PageDown, Space/Shift+Space, Home/End, F = fullscreen, buttons, `#<n>`
 * in the URL. The only script is the constant `SLIDES_SCRIPT` (no data inside it); the CSP allows
 * exactly that script by its SHA-256 hash, no other script, no remote styles or fonts. All content
 * is escaped (names), sanitized (Markdown) or produced by the local UML renderer / SVG sanitizer,
 * and drawings are `data:image/svg+xml` images (no script can run inside an `<img>`). Without
 * JavaScript every slide is shown one below the other; printing puts one slide per page.
 */
import type { ScenarioData } from './scenario-model';
import { renderStepUml } from './step-uml';
import type { UmlRenderResult } from './step-uml';
import { renderMarkdown, sanitizeHtmlString, escapeHtml } from './markdown';
import { buildDiffHighlightXml, diffSnapshots, diffCountsText, DIFF_COLORS, DIFF_LABELS } from './scenario-diff';
import type { CellChangeKind, SnapshotDiff } from './scenario-diff';
import { sha256 } from '../security/sha256';

export interface ScenarioSlidesDeps {
  /** `<mxGraphModel>` -> standalone SVG document text. */
  renderDrawingSvg(xml: string): Promise<string>;
  renderUml?(source: string): Promise<UmlRenderResult>;
  now?: Date;
}

export interface ScenarioSlidesOptions {
  /** Highlight + list the changes of each step against the previous one. */
  showChanges?: boolean;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** The slideshow's only script (constant: allowed by its hash in the CSP). */
export const SLIDES_SCRIPT = `(function () {
  var root = document.documentElement;
  root.classList.add('js');
  var slides = Array.prototype.slice.call(document.querySelectorAll('#deck > section.slide'));
  var counter = document.querySelector('nav.controls > [data-rd="counter"]');
  var prev = document.querySelector('nav.controls > [data-rd="prev"]');
  var next = document.querySelector('nav.controls > [data-rd="next"]');
  var full = document.querySelector('nav.controls > [data-rd="fullscreen"]');
  var current = 0;
  function show(i, fromHash) {
    if (!slides.length) return;
    current = Math.max(0, Math.min(slides.length - 1, i));
    for (var k = 0; k < slides.length; k++) {
      var on = k === current;
      slides[k].classList.toggle('active', on);
      slides[k].setAttribute('aria-hidden', on ? 'false' : 'true');
    }
    counter.textContent = (current + 1) + ' / ' + slides.length;
    prev.disabled = current === 0;
    next.disabled = current === slides.length - 1;
    if (!fromHash && history.replaceState) { try { history.replaceState(null, '', '#' + (current + 1)); } catch (e) { /* opaque origin */ } }
  }
  function toggleFullscreen() {
    if (document.fullscreenElement) { if (document.exitFullscreen) document.exitFullscreen(); }
    else if (root.requestFullscreen) root.requestFullscreen().catch(function () {});
  }
  function fromHash() {
    var n = parseInt(String(location.hash).replace('#', ''), 10);
    show(isNaN(n) ? 0 : n - 1, true);
  }
  prev.addEventListener('click', function () { show(current - 1); });
  next.addEventListener('click', function () { show(current + 1); });
  full.addEventListener('click', toggleFullscreen);
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key;
    if (k === 'ArrowRight' || k === 'PageDown' || (k === ' ' && !e.shiftKey) || k === 'Enter') show(current + 1);
    else if (k === 'ArrowLeft' || k === 'PageUp' || (k === ' ' && e.shiftKey) || k === 'Backspace') show(current - 1);
    else if (k === 'Home') show(0);
    else if (k === 'End') show(slides.length - 1);
    else if (k === 'f' || k === 'F') toggleFullscreen();
    else return;
    e.preventDefault();
  });
  window.addEventListener('hashchange', fromHash);
  fromHash();
})();`;

let scriptHash: string | null = null;

/** CSP source of SLIDES_SCRIPT ('sha256-<base64>'). */
export function slidesScriptHash(): string {
  scriptHash ??= `'sha256-${toBase64(sha256(new TextEncoder().encode(SLIDES_SCRIPT)))}'`;
  return scriptHash;
}

const STYLE = `
:root { color-scheme: light; --accent: #f9a825; }
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body { font: 15px/1.45 Helvetica, Arial, sans-serif; color: #222; background: #fff; }
.slide { display: flex; flex-direction: column; min-height: 100vh; padding: 24px 32px 64px; border-bottom: 1px solid #ddd; }
.js .slide { display: none; height: 100vh; overflow: auto; border: 0; }
.js .slide.active { display: flex; }
.slide > header { flex: 0 0 auto; border-bottom: 3px solid var(--accent); margin-bottom: 12px; padding-bottom: 6px; }
.slide h1 { margin: 0; font-size: 26px; }
.slide h2 { margin: 0; font-size: 22px; }
.kicker { margin: 0 0 2px; font-size: 12px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: #8a6d00; }
.desc { margin: 2px 0 0; color: #555; }
.title-slide { justify-content: center; align-items: flex-start; padding-left: 10vw; }
.title-slide h1 { font-size: 44px; border-top: 6px solid var(--accent); padding-top: 14px; }
.title-slide .meta { color: #666; margin-top: 18px; }
.title-slide ol { margin-top: 18px; columns: 2; column-gap: 40px; }
.content { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: minmax(0, 3fr) minmax(260px, 2fr); gap: 20px; }
.content.no-side { grid-template-columns: 1fr; }
.drawing { min-height: 0; display: flex; align-items: center; justify-content: center; }
.drawing img { width: 100%; max-height: calc(100vh - 170px); height: auto; object-fit: contain; }
.side { min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 14px; }
.part h3 { margin: 0 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #777; }
.uml svg { max-width: 100%; height: auto; }
.error { color: #b71c1c; font-style: italic; }
.changes ul { margin: 4px 0 0; padding: 0; list-style: none; font-size: 13px; }
.changes li { display: flex; gap: 6px; align-items: baseline; }
.dot { flex: 0 0 auto; width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
.legend { display: flex; flex-wrap: wrap; gap: 2px 12px; font-size: 12px; color: #555; }
.legend span.sw { display: inline-block; width: 12px; height: 9px; border: 2px solid; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }
.markdown table { border-collapse: collapse; }
.markdown th, .markdown td { border: 1px solid #ccc; padding: 3px 8px; }
.markdown pre { background: #f5f5f5; padding: 8px; overflow: auto; }
.markdown code { background: #f5f5f5; padding: 0 3px; }
.markdown img { max-width: 100%; }
.rd-md-align-center { text-align: center; } .rd-md-align-right { text-align: right; } .rd-md-align-left { text-align: left; }
.rd-md-task { list-style: none; }
nav.controls { display: none; }
.js nav.controls { display: flex; position: fixed; right: 16px; bottom: 12px; gap: 6px; align-items: center; background: rgba(255,255,255,.92); border: 1px solid #ddd; border-radius: 6px; padding: 4px 6px; font-size: 13px; }
nav.controls button { font: inherit; padding: 3px 10px; border: 1px solid #c8a24a; border-radius: 4px; background: #fff; cursor: pointer; }
nav.controls button:disabled { opacity: .4; cursor: default; }
.hint { color: #888; font-size: 11px; margin-right: 6px; }
:fullscreen nav.controls { opacity: .25; } :fullscreen nav.controls:hover { opacity: 1; }
@media (max-width: 800px) { .content { grid-template-columns: 1fr; } .title-slide ol { columns: 1; } }
@media print {
  .js .slide, .slide { display: flex !important; height: auto; min-height: 0; page-break-after: always; border: 0; }
  nav.controls { display: none !important; }
}
`;

function toBase64Utf8(text: string): string {
  return toBase64(new TextEncoder().encode(text));
}

function changesHtml(diff: SnapshotDiff | null, first: boolean): string {
  const kinds: CellChangeKind[] = ['added', 'removed', 'moved', 'changed'];
  const legend =
    '<div class="legend">' +
    kinds.map((k) => `<span><span class="sw" style="border-color:${DIFF_COLORS[k]}"></span>${escapeHtml(DIFF_LABELS[k])}</span>`).join('') +
    '</div>';
  let body: string;
  if (first) body = '<p class="desc">First step: nothing to compare with.</p>';
  else if (!diff) body = '<p class="error">The steps could not be compared.</p>';
  else if (diff.changes.length === 0) body = '<p class="desc">No changes since the previous step.</p>';
  else
    body =
      `<p class="desc">${escapeHtml(diffCountsText(diff.counts))}</p><ul>` +
      diff.changes
        .map((c) => `<li data-kind="${c.kind}"><span class="dot" style="background:${DIFF_COLORS[c.kind]}"></span>${escapeHtml(c.summary)}</li>`)
        .join('') +
      '</ul>';
  return `<div class="part changes"><h3>Changes</h3>${first ? '' : legend}${body}</div>`;
}

/** The slideshow HTML document. */
export async function buildScenarioSlidesHtml(
  scenario: ScenarioData,
  diagramName: string,
  deps: ScenarioSlidesDeps,
  options: ScenarioSlidesOptions = {}
): Promise<string> {
  const renderUml = deps.renderUml ?? ((source: string) => renderStepUml(source));
  const now = deps.now ?? new Date();
  const showChanges = options.showChanges === true;
  const total = scenario.steps.length;
  const slides: string[] = [];
  slides.push(
    `<section class="slide title-slide" id="slide-1" aria-label="Title">` +
      `<h1>${escapeHtml(scenario.name)}</h1>` +
      (scenario.description ? `<p class="desc">${escapeHtml(scenario.description)}</p>` : '') +
      `<p class="meta">Diagram “${escapeHtml(diagramName)}” · ${total} step${total === 1 ? '' : 's'} · ${escapeHtml(now.toISOString().slice(0, 16).replace('T', ' '))} UTC</p>` +
      `<ol>${scenario.steps.map((s) => `<li>${escapeHtml(s.name)}</li>`).join('')}</ol>` +
      `</section>`
  );
  for (const [index, step] of scenario.steps.entries()) {
    const prev = index > 0 ? scenario.steps[index - 1] : null;
    let diff: SnapshotDiff | null = null;
    let xml = step.xml;
    if (showChanges && prev) {
      try {
        diff = diffSnapshots(prev.xml, step.xml);
        xml = buildDiffHighlightXml(prev.xml, step.xml, diff);
      } catch {
        diff = null;
      }
    }
    let drawing: string;
    try {
      const svg = (await deps.renderDrawingSvg(xml)).replace(/^<\?xml[^>]*\?>\s*/, '');
      drawing = `<img alt="${escapeHtml(`Drawing of step ${index + 1}: ${step.name}`)}" src="data:image/svg+xml;base64,${toBase64Utf8(svg)}">`;
    } catch (error) {
      drawing = `<p class="error">The drawing could not be rendered: ${escapeHtml(error instanceof Error ? error.message : String(error))}</p>`;
    }
    const side: string[] = [];
    if (showChanges) side.push(changesHtml(diff, index === 0));
    if (step.uml.trim()) {
      const result = await renderUml(step.uml);
      if (result.status === 'ok') side.push(`<div class="part uml"><h3>UML</h3>${result.svg}</div>`);
      else if (result.status === 'error') side.push(`<div class="part uml"><h3>UML</h3><p class="error">${escapeHtml(result.message)}</p></div>`);
    }
    if (step.text.trim()) side.push(`<div class="part markdown"><h3>Text</h3>${sanitizeHtmlString(renderMarkdown(step.text))}</div>`);
    slides.push(
      `<section class="slide step" id="slide-${index + 2}" data-step="${index + 1}" aria-label="${escapeHtml(`Step ${index + 1}: ${step.name}`)}">` +
        `<header><p class="kicker">Step ${index + 1} of ${total}</p><h2>${escapeHtml(step.name)}</h2>` +
        (step.description ? `<p class="desc">${escapeHtml(step.description)}</p>` : '') +
        `</header><div class="content${side.length ? '' : ' no-side'}"><div class="drawing">${drawing}</div>` +
        (side.length ? `<div class="side">${side.join('')}</div>` : '') +
        `</div></section>`
    );
  }
  const title = `${scenario.name} — ${diagramName}`;
  return (
    '<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8">' +
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; style-src 'unsafe-inline'; script-src ${slidesScriptHash()}">` +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="generator" content="Railway Drawer">' +
    `<title>${escapeHtml(title)}</title><style>${STYLE}</style></head><body>` +
    `<main id="deck" aria-roledescription="slideshow" aria-label="${escapeHtml(title)}">${slides.join('\n')}</main>` +
    `<nav class="controls" aria-label="Slide controls"><span class="hint">← → Space · F fullscreen</span>` +
    `<button type="button" data-rd="prev" aria-label="Previous slide">←</button><span data-rd="counter" aria-live="polite"></span>` +
    `<button type="button" data-rd="next" aria-label="Next slide">→</button><button type="button" data-rd="fullscreen" aria-label="Fullscreen">⛶</button></nav>` +
    `<script>${SLIDES_SCRIPT}</script>` +
    '</body></html>\n'
  );
}

/** File name "<diagram> - <scenario> (slides).html". */
export function scenarioSlidesFileName(diagramName: string, scenarioName: string): string {
  // eslint-disable-next-line no-control-regex
  const clean = (s: string): string => s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim();
  return `${clean(diagramName) || 'diagram'} - ${clean(scenarioName) || 'scenario'} (slides).html`;
}
