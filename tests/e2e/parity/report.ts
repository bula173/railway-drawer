/**
 * @file report.ts
 * @brief Writes the draw.io parity report (report.json + index.html) to test-results/drawio-parity/.
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ParityStatus } from './compare';
import { PALETTE_ORDER, REPO_ROOT } from './entries';

export const REPORT_DIR = resolve(REPO_ROOT, 'test-results/drawio-parity');

export interface EntryResult {
  id: string;
  palette: string;
  title: string;
  kind: string;
  cls?: string;
  status: ParityStatus;
  diffRatio: number;
  diffPixels: number;
  contentPixels: number;
  sizeDelta: { width: number; height: number };
  drawioSize: { width: number; height: number };
  appSize: { width: number; height: number };
  blank?: string;
  expectedMismatch?: string;
  error?: string;
  /** Image paths relative to REPORT_DIR. */
  images: { drawio?: string; app?: string; diff?: string };
}

export interface PaletteResult {
  palette: string;
  drawioTag: string;
  generatedAt: string;
  entries: EntryResult[];
}

export interface Summary {
  total: number;
  pass: number;
  warn: number;
  fail: number;
  expected: number;
  error: number;
}

export function summarize(entries: EntryResult[]): Summary {
  const s: Summary = { total: entries.length, pass: 0, warn: 0, fail: 0, expected: 0, error: 0 };
  for (const e of entries) s[e.status]++;
  return s;
}

const SEVERITY: Record<ParityStatus, number> = { error: 0, fail: 1, warn: 2, expected: 3, pass: 4 };

/** Worst first: status severity, then ratio descending. */
export function sortWorstFirst(entries: EntryResult[]): EntryResult[] {
  return [...entries].sort((a, b) => SEVERITY[a.status] - SEVERITY[b.status] || b.diffRatio - a.diffRatio);
}

export function writePaletteResult(result: PaletteResult, dir = REPORT_DIR): void {
  mkdirSync(resolve(dir, 'palettes'), { recursive: true });
  writeFileSync(resolve(dir, 'palettes', `${result.palette}.json`), JSON.stringify(result, null, 2));
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function pct(r: number): string {
  return `${(r * 100).toFixed(2)}%`;
}

/** Merges every palettes/*.json under `dir` into report.json and index.html. */
export function writeReport(dir = REPORT_DIR): { summary: Summary; palettes: PaletteResult[] } {
  const pdir = resolve(dir, 'palettes');
  const palettes: PaletteResult[] = existsSync(pdir)
    ? readdirSync(pdir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => JSON.parse(readFileSync(resolve(pdir, f), 'utf8')) as PaletteResult)
    : [];
  const rank = (id: string): number => {
    const i = PALETTE_ORDER.indexOf(id);
    return i < 0 ? PALETTE_ORDER.length : i;
  };
  palettes.sort((a, b) => rank(a.palette) - rank(b.palette));
  const all = palettes.flatMap((p) => p.entries);
  const summary = summarize(all);
  const report = {
    drawioTag: palettes[0]?.drawioTag ?? 'v32.4.1',
    generatedAt: new Date().toISOString(),
    thresholds: { pass: 0.02, warn: 0.06 },
    summary,
    palettes: palettes.map((p) => ({ ...p, summary: summarize(p.entries), entries: sortWorstFirst(p.entries) })),
  };
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'report.json'), JSON.stringify(report, null, 2));
  writeFileSync(resolve(dir, 'index.html'), renderHtml(report.palettes, summary));
  return { summary, palettes };
}

function img(src: string | undefined, alt: string): string {
  return src ? `<a href="${esc(src)}"><img loading="lazy" src="${esc(src)}" alt="${esc(alt)}"></a>` : '<span class="none">—</span>';
}

function renderHtml(palettes: (PaletteResult & { summary: Summary })[], summary: Summary): string {
  const sections = palettes
    .map((p) => {
      const rows = p.entries
        .map(
          (e) => `<tr class="${e.status}">
<td><b>${esc(e.title)}</b><br><code>${esc(e.id)}</code>${e.expectedMismatch ? `<br><small>expected: ${esc(e.expectedMismatch)}</small>` : ''}${e.error ? `<br><small class="err">${esc(e.error)}</small>` : ''}</td>
<td>${img(e.images.drawio, 'draw.io')}</td><td>${img(e.images.app, 'app')}</td><td>${img(e.images.diff, 'diff')}</td>
<td class="num">${pct(e.diffRatio)}<br><small>${e.diffPixels}/${e.contentPixels}px</small></td>
<td class="num">${e.sizeDelta.width >= 0 ? '+' : ''}${e.sizeDelta.width} × ${e.sizeDelta.height >= 0 ? '+' : ''}${e.sizeDelta.height}</td>
<td><span class="badge ${e.status}">${e.status}</span></td></tr>`
        )
        .join('\n');
      const s = p.summary;
      return `<section><h2>${esc(p.palette)} <small>${s.total} entries · ${s.pass} pass · ${s.warn} warn · ${s.fail} fail · ${s.expected} expected · ${s.error} error</small></h2>
<table><thead><tr><th>Entry</th><th>draw.io</th><th>app</th><th>diff</th><th>ratio</th><th>size Δ</th><th>status</th></tr></thead><tbody>
${rows}
</tbody></table></section>`;
    })
    .join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>draw.io parity</title><style>
:root{--bg:#fff;--fg:#1d1d1f;--muted:#6b6b70;--line:#e3e3e8;--pass:#1a7f37;--warn:#9a6700;--fail:#cf222e;--exp:#6639ba}
body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:14px/1.4 system-ui,sans-serif}
h1{font-size:20px}h2{font-size:16px;margin-top:32px}h2 small,small{color:var(--muted);font-weight:normal}
table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid var(--line);padding:6px;text-align:left;vertical-align:top}
td img{max-width:220px;max-height:160px;background:#fff;border:1px solid var(--line)}
.num{text-align:right;white-space:nowrap}.badge{padding:2px 6px;border-radius:4px;color:#fff;font-size:12px}
.badge.pass{background:var(--pass)}.badge.warn{background:var(--warn)}.badge.fail,.badge.error{background:var(--fail)}.badge.expected{background:var(--exp)}
.err{color:var(--fail)}code{font-size:12px}
</style></head><body>
<h1>draw.io ↔ maxGraph parity <small>(draw.io v32.4.1 · pass ≤ 2% · warn ≤ 6%)</small></h1>
<p>${summary.total} entries · ${summary.pass} pass · ${summary.warn} warn · ${summary.fail} fail · ${summary.expected} expected mismatch · ${summary.error} error</p>
${sections}
</body></html>`;
}
