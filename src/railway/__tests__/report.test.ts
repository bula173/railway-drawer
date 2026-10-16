/**
 * Reports: CSV escaping (commas, quotes, newlines, formulas), UTF-8 BOM, km sorting, columns per
 * report, and the .xlsx package (valid ZIP with correct CRCs, sheets, inline strings, numbers).
 */
import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { Cell, Geometry, GraphDataModel } from '@maxgraph/core';
import type { KindId } from '../catalogue';
import { buildDataValue } from '../object-data';
import { CSV_BOM, REPORTS, buildReportFromModel, csvField, fileBaseName, getReport, tableToCsv } from '../report';
import { buildXlsx, buildZip, columnName, crc32, sheetNames } from '../xlsx';

function model(objects: Array<[KindId, Record<string, string>, string?]>): GraphDataModel {
  const m = new GraphDataModel();
  const layer = m.getRoot()!.getChildAt(0);
  objects.forEach(([kind, values, label], i) => {
    const cell = new Cell(buildDataValue(label ?? '', { kind, values }), new Geometry(i * 10, 0, 10, 10), {});
    cell.setVertex(true);
    cell.setId(`c${i + 1}`);
    m.add(layer, cell);
  });
  return m;
}

/** Reads a stored/deflated ZIP into name -> bytes, checking CRCs. */
function readZip(bytes: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = new Map<string, Uint8Array>();
  let pos = 0;
  while (view.getUint32(pos, true) === 0x04034b50) {
    const method = view.getUint16(pos + 8, true);
    const crc = view.getUint32(pos + 14, true);
    const size = view.getUint32(pos + 18, true);
    const nameLen = view.getUint16(pos + 26, true);
    const extra = view.getUint16(pos + 28, true);
    const name = new TextDecoder().decode(bytes.subarray(pos + 30, pos + 30 + nameLen));
    const start = pos + 30 + nameLen + extra;
    const raw = bytes.subarray(start, start + size);
    const data = method === 0 ? raw : new Uint8Array(inflateRawSync(raw));
    expect(crc32(data), `crc of ${name}`).toBe(crc);
    out.set(name, data);
    pos = start + size;
  }
  // end of central directory: entry count matches
  const eocd = bytes.length - 22;
  expect(view.getUint32(eocd, true)).toBe(0x06054b50);
  expect(view.getUint16(eocd + 10, true)).toBe(out.size);
  return out;
}

describe('CSV', () => {
  it('escapes commas, quotes, newlines and edge spaces; numbers stay plain', () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('line1\nline2')).toBe('"line1\nline2"');
    expect(csvField('cr\r\n')).toBe('"cr\r\n"');
    expect(csvField(' padded')).toBe('" padded"');
    expect(csvField('Łódź Żółć')).toBe('Łódź Żółć');
    expect(csvField(12.345)).toBe('12.345');
    expect(csvField(-0.5)).toBe('-0.5');
    expect(csvField('')).toBe('');
  });

  it('neutralizes spreadsheet formulas but keeps negative numbers', () => {
    expect(csvField('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvField('+1+2')).toBe("'+1+2");
    expect(csvField('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvField('-1.5')).toBe('-1.5');
    expect(csvField('-x')).toBe("'-x");
  });

  it('writes a UTF-8 BOM, CRLF lines, a header row, rows sorted by km', () => {
    const m = model([
      ['signal', { id: 'S10', km: '12.5', direction: 'nominal', notes: 'Uwaga, "ważne"\nlinia 2' }, 'Semafor Łódź'],
      ['signal', { id: 'S2', km: '0+900', direction: 'reverse' }],
      ['signal', { id: 'S1' }],
      ['signal', { id: 'S3', km: '12.5' }],
      ['balise', { id: 'B1', km: '1', groupId: 'BG1' }],
    ]);
    const csv = tableToCsv(buildReportFromModel(m, getReport('signals')!));
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('Signal ID,Type,Direction,km position [km],Track,Aspects,Routes,Remarks,Label,Cell ID');
    expect(lines[1]).toBe('S2,,Reverse,0.9,,,,,,c2');
    expect(lines[2]).toBe('S3,,,12.5,,,,,,c4');
    expect(lines[3]).toBe('S10,,Nominal,12.5,,,,"Uwaga, ""ważne""\nlinia 2",Semafor Łódź,c1');
    // the quoted newline keeps the record together; objects without km come last
    expect(lines[4]).toBe('S1,,,,,,,,,c3');
    expect(lines[5]).toBe('');
    expect(lines).toHaveLength(6);
  });

  it('multi-kind reports have a Kind column and shared columns once', () => {
    const m = model([
      ['balise', { id: 'B1', groupId: 'BG1', position: '1', km: '2' }],
      ['baliseGroup', { id: 'BG1', nidC: '1', nidBg: '200', count: '1', km: '2' }],
      ['track', { id: 'T1', kmStart: '0', kmEnd: '5' }],
    ]);
    const balises = buildReportFromModel(m, getReport('balises')!);
    expect(balises.columns.slice(0, 4)).toEqual(['Kind', 'ID', 'NID_C', 'NID_BG']);
    expect(balises.columns.filter((c) => c === 'km position [km]')).toHaveLength(1);
    // same km: groups before their balises (report kind order)
    expect(balises.rows.map((r) => [r[0], r[1]])).toEqual([['Balise group', 'BG1'], ['Balise', 'B1']]);
    expect(balises.rows[0][3]).toBe(200);
    const tracks = buildReportFromModel(m, getReport('trackSections')!);
    expect(tracks.rows).toHaveLength(1);
    const all = buildReportFromModel(m, getReport('all')!);
    expect(all.rows).toHaveLength(3);
    // tracks sort by km start
    expect(all.rows.map((r) => r[1])).toEqual(['T1', 'B1', 'BG1']); // catalogue kind order at the same km
    expect(REPORTS.map((r) => r.id)).toEqual(['signals', 'balises', 'trackSections', 'points', 'all']);
  });

  it('HTML labels are exported as text; file names are safe', () => {
    const m = model([['points', { id: 'W1' }, '<b>Zwrotnica</b>&nbsp;1<br>lewa']]);
    expect(buildReportFromModel(m, getReport('points')!).rows[0]).toContain('Zwrotnica 1lewa');
    expect(fileBaseName(' Stacja: Łódź/Kaliska? ')).toBe('Stacja_ Łódź_Kaliska_');
    expect(fileBaseName('')).toBe('diagram');
  });
});

describe('xlsx', () => {
  it('crc32 and column names', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect([0, 25, 26, 27, 701, 702].map(columnName)).toEqual(['A', 'Z', 'AA', 'AB', 'ZZ', 'AAA']);
    expect(sheetNames(['Balises & balise groups', 'A/B', 'x'.repeat(40), 'x'.repeat(40)])).toEqual([
      'Balises & balise groups',
      'A B',
      'x'.repeat(31),
      `${'x'.repeat(29)} 2`,
    ]);
    const zip = readZip(buildZip([{ name: 'a.txt', data: new TextEncoder().encode('hello') }]));
    expect(new TextDecoder().decode(zip.get('a.txt'))).toBe('hello');
  });

  it('builds a workbook with one sheet per report', () => {
    const m = model([
      ['signal', { id: 'S1', km: '1.25', notes: 'Żółty & <czerwony>' }],
      ['points', { id: 'W1', hand: 'left' }],
    ]);
    const tables = REPORTS.map((r) => buildReportFromModel(m, r));
    const files = readZip(buildXlsx(tables));
    expect([...files.keys()]).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
      'xl/worksheets/sheet2.xml',
      'xl/worksheets/sheet3.xml',
      'xl/worksheets/sheet4.xml',
      'xl/worksheets/sheet5.xml',
    ]);
    const text = (name: string): string => new TextDecoder().decode(files.get(name));
    for (const name of files.keys()) {
      const doc = new DOMParser().parseFromString(text(name), 'application/xml');
      expect(doc.getElementsByTagName('parsererror'), name).toHaveLength(0);
    }
    expect(text('xl/workbook.xml')).toContain('<sheet name="Balises &amp; balise groups" sheetId="2" r:id="rId2"/>');
    const sheet1 = text('xl/worksheets/sheet1.xml');
    expect(sheet1).toContain('<c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">Signal ID</t></is></c>');
    expect(sheet1).toContain('<c r="D2"><v>1.25</v></c>');
    expect(sheet1).toContain('Żółty &amp; &lt;czerwony&gt;');
    expect(text('xl/worksheets/sheet4.xml')).toContain('>Left<');
  });
});
