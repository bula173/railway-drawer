/**
 * @file etcs-export.ts
 * @brief Exports of the balise groups' ETCS data (lazy chunk; File > Export > Railway Data):
 *        "Balise data" tables (one row per group / packet / variable with the stored physical
 *        value, the encoded value, its bits and its source, plus a summary per group) as CSV and
 *        XLSX, the JSON of all groups, and a printable HTML telegram report (print it to PDF).
 *        Model only (the HTML is a string; every text is escaped).
 */
import { parseNumber } from '../catalogue';
import { readCountryId } from '../project-settings';
import type { CellValue, Table } from '../report';
import type { GraphDataModel } from '@maxgraph/core';
import type { EtcsGroupData, EtcsPacket, EtcsProblem, EtcsValue } from './etcs-data';
import { ETCS_DATA_VERSION, buildTelegrams, encodePacket, formatValue, numericValue, serializeEtcsData, validateEtcsData } from './etcs-data';
import type { EtcsEnv, GroupInfo } from './etcs-compute';
import { getPath } from './etcs-recompute';
import { HEADER_VARS, TELEGRAM_CAPACITY, VARS, getPacketDef } from './etcs-schema';
import { varHelp } from './etcs-help';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const DIR = ['reverse', 'nominal', 'both'];

/** Groups sorted by km (none last), then natural ID. */
export function sortedGroups(env: EtcsEnv): GroupInfo[] {
  return [...env.groups].sort((a, b) => {
    const ka = parseNumber(a.o.values.km, 'km');
    const kb = parseNumber(b.o.values.km, 'km');
    if (ka !== kb) return ka === null ? 1 : kb === null ? -1 : ka - kb;
    return collator.compare(a.o.id, b.o.id);
  });
}

function problemsOf(g: GroupInfo): EtcsProblem[] {
  return [...g.parseProblems, ...(g.data ? validateEtcsData(g.data, g.ctx) : [])];
}

const pigText = (p: EtcsPacket, nTotal: number): string => (p.pig && p.pig.length > 0 ? p.pig.join(' ') : Array.from({ length: nTotal + 1 }, (_, i) => i).join(' '));

export const VARIABLE_COLUMNS = ['Group', 'NID_C', 'NID_BG', 'km', 'Track', 'Packet no.', 'NID_PACKET', 'Packet', 'Q_DIR', 'Balises (N_PIG)', 'Iteration', 'Variable', 'Value', 'Unit', 'Encoded', 'Bits', 'Source'];

/** One row per group / packet / variable (the header first, packets in telegram order). */
export function buildEtcsVariableTable(env: EtcsEnv): Table {
  const rows: CellValue[][] = [];
  for (const g of sortedGroups(env)) {
    if (!g.data) continue;
    const base = (): CellValue[] => [g.o.id, g.ctx.nidC ?? '', g.ctx.nidBg ?? '', g.o.values.km ?? '', g.o.values.trackId ?? ''];
    const telegram = buildTelegrams(g.data, g.ctx)[0];
    for (const f of telegram.header) {
      const source = ['NID_C', 'NID_BG', 'N_TOTAL', 'N_PIG'].includes(f.name) ? 'drawing (group)' : 'header';
      const value = f.name === 'N_PIG' ? '0–' + g.ctx.nTotal : f.raw;
      rows.push([...base(), 0, '', 'Telegram header', '', '', '', f.name, value, VARS[f.name]?.unit ?? '', f.name === 'N_PIG' ? '' : f.raw, f.bits, source]);
    }
    g.data.packets.forEach((p, i) => {
      const def = getPacketDef(p.nid);
      const qDir = def?.qdir ? DIR[numericValue(p.vars.Q_DIR as EtcsValue) ?? 1] ?? '' : '';
      const fields = encodePacket(p);
      for (let k = 0; k < fields.length; k++) {
        const f = fields[k];
        let bits = f.bits;
        let raw: CellValue = f.raw;
        let value: CellValue = f.raw;
        if (f.name === 'X_TEXT') {
          let text = '';
          while (k < fields.length && fields[k].name === 'X_TEXT') {
            text += String.fromCharCode(Number(fields[k].raw));
            k++;
          }
          k--;
          bits = text.length * 8;
          raw = text;
          value = text;
        } else if (f.path && !f.path.endsWith('.N_ITER') && !f.path.endsWith('.L_TEXT')) {
          const stored = getPath(p.vars, f.path);
          if (stored !== undefined) value = typeof stored === 'number' ? stored : stored;
        }
        const parts = f.path.split('.');
        const iteration = parts.length > 1 ? parts.slice(0, -1).join('.') : '';
        const source = p.auto?.includes(f.path) ? 'drawing' : ['NID_PACKET', 'L_PACKET'].includes(f.name) || f.path.endsWith('.N_ITER') || f.name === 'L_TEXT' ? 'derived' : 'manual';
        rows.push([...base(), i + 1, p.nid, def?.name.en ?? '', qDir, pigText(p, g.ctx.nTotal), iteration, f.name, value, VARS[f.name]?.unit ?? '', raw, bits, source]);
      }
    });
    rows.push([...base(), g.data.packets.length + 1, 255, 'End of information', '', '', '', 'NID_PACKET', 255, '', 255, 8, 'derived']);
  }
  return { title: 'Balise data', columns: VARIABLE_COLUMNS, rows };
}

export const SUMMARY_COLUMNS = ['Group', 'NID_C', 'NID_BG', 'km', 'Track', 'Orientation', 'Balises', 'Q_LINK', 'M_VERSION', 'Packets', 'Bits per balise', `Fits ${TELEGRAM_CAPACITY.long} bits`, 'Errors', 'Warnings'];

/** One row per balise group (also those without ETCS data). */
export function buildEtcsSummaryTable(env: EtcsEnv): Table {
  const rows: CellValue[][] = sortedGroups(env).map((g) => {
    const problems = problemsOf(g);
    const tg = g.data ? buildTelegrams(g.data, g.ctx) : [];
    return [
      g.o.id,
      g.ctx.nidC ?? '',
      g.ctx.nidBg ?? '',
      g.o.values.km ?? '',
      g.o.values.trackId ?? '',
      g.orientation ?? '',
      g.ctx.nTotal + 1,
      g.data ? Number(g.data.header.Q_LINK ?? 1) : '',
      g.data ? String(g.data.header.M_VERSION ?? '') : '',
      g.data ? g.data.packets.map((p) => p.nid).concat(255).join(', ') : 'no ETCS data',
      tg.map((t) => t.bits).join(' / '),
      tg.length > 0 ? (tg.every((t) => t.bits <= TELEGRAM_CAPACITY.long) ? 'yes' : 'no') : '',
      problems.filter((p) => p.severity === 'error').length,
      problems.filter((p) => p.severity === 'warning').length,
    ];
  });
  return { title: 'Balise groups', columns: SUMMARY_COLUMNS, rows };
}

/** The JSON export of every group (with the group identity from the drawing). */
export function buildEtcsJson(env: EtcsEnv, model: GraphDataModel, name: string): string {
  return JSON.stringify(
    {
      format: 'railway-drawer-etcs',
      version: ETCS_DATA_VERSION,
      diagram: name,
      defaultNidC: readCountryId(model),
      groups: sortedGroups(env).map((g) => ({
        id: g.o.id,
        nidC: g.ctx.nidC,
        nidBg: g.ctx.nidBg,
        km: g.o.values.km || null,
        track: g.o.values.trackId || null,
        balises: g.ctx.nTotal + 1,
        orientation: g.orientation,
        data: g.data ? (JSON.parse(serializeEtcsData(g.data)) as EtcsGroupData) : null,
      })),
    },
    null,
    2
  );
}

const esc = (s: unknown): string => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A printable HTML report: per group the header, the packets with their values and the telegrams. */
export function buildEtcsHtmlReport(env: EtcsEnv, title: string, date = new Date()): string {
  const parts: string[] = [];
  const groups = sortedGroups(env);
  for (const g of groups) {
    parts.push(`<section class="group"><h2>Balise group ${esc(g.o.id || '(no ID)')}</h2>`);
    parts.push(
      `<p class="meta">NID_C ${esc(g.ctx.nidC ?? '?')} · NID_BG ${esc(g.ctx.nidBg ?? '?')} · ${g.ctx.nTotal + 1} balise(s) · orientation ${esc(g.orientation ?? 'unknown')}${g.o.values.km ? ` · km ${esc(g.o.values.km)}` : ''}${g.o.values.trackId ? ` · track ${esc(g.o.values.trackId)}` : ''}</p>`
    );
    if (!g.data) {
      parts.push('<p class="none">No ETCS data.</p></section>');
      continue;
    }
    const problems = problemsOf(g);
    if (problems.length > 0) parts.push(`<ul class="problems">${problems.map((p) => `<li class="${p.severity}">${esc(p.message)}</li>`).join('')}</ul>`);
    parts.push('<table><thead><tr><th>Header</th><th>Value</th><th>Bits</th></tr></thead><tbody>');
    const tg = buildTelegrams(g.data, g.ctx);
    for (const f of tg[0].header) parts.push(`<tr><td>${esc(f.name)}</td><td>${esc(f.name === 'N_PIG' ? `0–${g.ctx.nTotal}` : formatValue(VARS[f.name], f.raw))}</td><td>${f.bits}</td></tr>`);
    parts.push('</tbody></table>');
    g.data.packets.forEach((p, i) => {
      const def = getPacketDef(p.nid);
      parts.push(`<h3>${i + 1}. Packet ${p.nid} — ${esc(def?.name.en ?? 'unknown')} <span class="pl">${esc(def?.name.pl ?? '')}</span></h3>`);
      parts.push('<table><thead><tr><th>Variable</th><th>Value</th><th>Encoded</th><th>Bits</th><th>Source</th><th>Help</th></tr></thead><tbody>');
      const fields = encodePacket(p);
      for (let k = 0; k < fields.length; k++) {
        const f = fields[k];
        if (f.name === 'X_TEXT') {
          let text = '';
          while (k < fields.length && fields[k].name === 'X_TEXT') text += String.fromCharCode(Number(fields[k++].raw));
          k--;
          parts.push(`<tr><td>X_TEXT</td><td>${esc(text)}</td><td></td><td>${text.length * 8}</td><td>manual</td><td>${esc(varHelp('X_TEXT'))}</td></tr>`);
          continue;
        }
        const stored = f.path && !f.path.endsWith('.N_ITER') ? getPath(p.vars, f.path) : undefined;
        const shown = stored !== undefined && VARS[f.name] ? formatValue(VARS[f.name], stored) : String(f.raw);
        const label = f.path.includes('.') ? f.path : f.name;
        parts.push(`<tr><td>${esc(label)}</td><td>${esc(shown)}</td><td>${esc(f.raw)}</td><td>${f.bits}</td><td>${p.auto?.includes(f.path) ? 'drawing' : ''}</td><td>${esc(varHelp(f.name))}</td></tr>`);
      }
      parts.push('</tbody></table>');
    });
    parts.push('<h3>Telegrams</h3><table><thead><tr><th>Balise</th><th>Packets</th><th>Bits</th><th>User data (hex)</th></tr></thead><tbody>');
    for (const t of tg) {
      parts.push(`<tr><td>N_PIG ${t.pig}</td><td>${esc(t.packets.map((x) => x.packet.nid).concat(255).join(', '))}</td><td>${t.bits} / ${TELEGRAM_CAPACITY.long}</td><td class="hex">${esc(t.hex)}</td></tr>`);
    }
    parts.push('</tbody></table></section>');
  }
  const withData = groups.filter((g) => g.data).length;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — ETCS balise telegrams</title>
<style>
body { font: 12px/1.4 system-ui, sans-serif; color: #111; background: #fff; margin: 24px; }
h1 { font-size: 18px; } h2 { font-size: 15px; margin-top: 24px; border-bottom: 1px solid #999; } h3 { font-size: 13px; }
table { border-collapse: collapse; width: 100%; margin: 6px 0; } th, td { border: 1px solid #bbb; padding: 2px 5px; text-align: left; vertical-align: top; }
th { background: #eee; } .pl { color: #555; font-weight: normal; } .meta, .none { color: #444; }
.hex { font-family: ui-monospace, Menlo, Consolas, monospace; word-break: break-all; } .problems .error { color: #b00020; } .problems .warning { color: #8a5a00; }
.group { break-inside: avoid-page; } @media print { body { margin: 0; } h2 { break-before: auto; } }
</style></head><body>
<h1>${esc(title)} — ETCS balise telegrams</h1>
<p>${groups.length} balise group(s), ${withData} with ETCS data · ${esc(date.toISOString().slice(0, 10))} · values per UNISIG SUBSET-026 v3.6.0 (packet layouts: see the editor's notes) · header ${HEADER_VARS.length} variables / 50 bits.</p>
${parts.join('\n')}
</body></html>
`;
}
