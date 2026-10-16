/**
 * @file report.ts
 * @brief Object lists (signals, balises/balise groups, track sections, points, all objects) as
 *        CSV for Excel/LibreOffice, sorted by km.
 *
 * CSV: RFC 4180 (comma separator, CRLF, fields with `,` `"` CR/LF or edge spaces quoted, quotes
 * doubled), UTF-8 with a BOM so Excel detects the encoding (Polish characters). Text that a
 * spreadsheet would run as a formula (`=`, `+`, `-`, `@`, tab, CR at the start) gets a leading
 * apostrophe unless it is a plain number such as `-1.5`.
 */
import type { GraphDataModel } from '@maxgraph/core';
import type { FieldDef, KindDef, KindId } from './catalogue';
import { KINDS, getKind, parseNumber } from './catalogue';
import { valueLabel } from './object-data';
import type { RailObject } from './validation';
import { collectObjects } from './validation';

export type ReportId = 'signals' | 'balises' | 'trackSections' | 'points' | 'all';

export interface ReportDef {
  id: ReportId;
  title: string;
  /** File name part (`<diagram>-<fileSuffix>.csv`). */
  fileSuffix: string;
  kinds: KindId[];
}

export const REPORTS: readonly ReportDef[] = [
  { id: 'signals', title: 'Signals', fileSuffix: 'signals', kinds: ['signal'] },
  { id: 'balises', title: 'Balises & balise groups', fileSuffix: 'balises', kinds: ['baliseGroup', 'balise'] },
  { id: 'trackSections', title: 'Tracks & track sections', fileSuffix: 'track-sections', kinds: ['track', 'trackSection'] },
  { id: 'points', title: 'Points', fileSuffix: 'points', kinds: ['points'] },
  { id: 'all', title: 'All railway objects', fileSuffix: 'railway-objects', kinds: KINDS.map((k) => k.id) },
];

export function getReport(id: string): ReportDef | null {
  return REPORTS.find((r) => r.id === id) ?? null;
}

export type CellValue = string | number;

export interface Table {
  title: string;
  columns: string[];
  rows: CellValue[][];
}

function columnTitle(f: FieldDef): string {
  return f.unit ? `${f.label} [${f.unit}]` : f.label;
}

/** km used for sorting: `km`, else `kmStart` (tracks). */
function sortKm(o: RailObject): number | null {
  return parseNumber(o.values.km, 'km') ?? parseNumber(o.values.kmStart, 'km');
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Objects sorted by km (objects without km last), then by kind order, then ID (natural order). */
export function sortObjects(objects: RailObject[], kinds: KindId[]): RailObject[] {
  const kindOrder = new Map(kinds.map((k, i) => [k, i]));
  return [...objects].sort((a, b) => {
    const ka = sortKm(a);
    const kb = sortKm(b);
    if (ka !== kb) {
      if (ka === null) return 1;
      if (kb === null) return -1;
      return ka - kb;
    }
    const oa = kindOrder.get(a.kind.id) ?? 0;
    const ob = kindOrder.get(b.kind.id) ?? 0;
    if (oa !== ob) return oa - ob;
    return collator.compare(a.id, b.id);
  });
}

function plainLabel(o: RailObject): string {
  const label = valueLabel(o.cell.getValue());
  // HTML labels: text only
  if (!/[<&]/.test(label)) return label.trim();
  const doc = new DOMParser().parseFromString(`<body>${label}</body>`, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function cellValue(f: FieldDef, raw: string): CellValue {
  if (raw === '') return '';
  if (f.type === 'enum') return f.options?.find((o) => o.value === raw)?.label ?? raw;
  if (f.type === 'number' || f.type === 'integer' || f.type === 'km') {
    const n = parseNumber(raw, f.type);
    return n === null ? raw : n;
  }
  return raw;
}

/**
 * The table of a report: one column per field of its kinds (fields shared by key appear once, in
 * first-seen order), a "Kind" column when it lists several kinds, then Label and Cell ID.
 */
export function buildReportTable(objects: RailObject[], report: ReportDef): Table {
  const kinds = report.kinds.map((k) => getKind(k)).filter((k): k is KindDef => !!k);
  const fields: FieldDef[] = [];
  const seen = new Set<string>();
  for (const k of kinds) {
    for (const f of k.fields) {
      // shared keys (id, km, trackId, ...) once; a key with another meaning gets its own column
      const key = `${f.key}|${f.type}|${f.label}`;
      if (f.key === 'id') {
        if (!seen.has('id')) {
          seen.add('id');
          fields.push(kinds.length > 1 ? { ...f, label: 'ID' } : f);
        }
        continue;
      }
      if (seen.has(key)) continue;
      seen.add(key);
      fields.push(f);
    }
  }
  const multi = kinds.length > 1;
  const columns = [...(multi ? ['Kind'] : []), ...fields.map(columnTitle), 'Label', 'Cell ID'];
  const selected = objects.filter((o) => report.kinds.includes(o.kind.id));
  const rows = sortObjects(selected, report.kinds).map((o) => {
    const row: CellValue[] = multi ? [o.kind.label] : [];
    for (const f of fields) {
      const own = o.kind.fields.find((x) => x.key === f.key && (f.key === 'id' || (x.type === f.type && x.label === f.label)));
      row.push(own ? cellValue(own, (o.values[own.key] ?? '').trim()) : '');
    }
    row.push(plainLabel(o), o.cellId);
    return row;
  });
  return { title: report.title, columns, rows };
}

export function buildReportFromModel(model: GraphDataModel, report: ReportDef): Table {
  return buildReportTable(collectObjects(model), report);
}

// ---------------------------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------------------------

export const CSV_BOM = '﻿';

/** One CSV field. */
export function csvField(value: CellValue): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  let text = value;
  // Formula injection: =, +, -, @ (and tab/CR) start a formula in Excel/LibreOffice
  if (/^[=+\-@\t\r]/.test(text) && parseNumber(text) === null) text = `'${text}`;
  if (/[",\r\n]/.test(text) || /^\s|\s$/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** CSV text with a UTF-8 BOM and CRLF line ends. */
export function tableToCsv(table: Table): string {
  const lines = [table.columns, ...table.rows].map((row) => row.map(csvField).join(','));
  return `${CSV_BOM}${lines.join('\r\n')}\r\n`;
}

/** A safe file name part from a diagram name. */
export function fileBaseName(name: string): string {
  // eslint-disable-next-line no-control-regex
  const base = name.trim().replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/\s+/g, ' ');
  return base === '' ? 'diagram' : base.slice(0, 80);
}
