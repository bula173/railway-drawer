/**
 * @file etcs-data.ts
 * @brief ETCS data of a balise group (docs/architecture/etcs-data.md): the JSON stored in the
 *        group cell's `rdEtcs` attribute (draw.io `<object>` data, so .drawio files, the cache,
 *        share links and the railML rd extension keep it), its parsing, validation against the
 *        packet schema (etcs-schema.ts: ranges, required variables, N_ITER consistency, Q_SCALE
 *        limits, telegram size), the physical <-> encoded conversion (Q_SCALE) and the bit
 *        encoding of the telegrams (header + packets + packet 255) per balise. Model only.
 *
 * Stored values are physical (metres, km/h, s, ‰; integers and codes as such; special codes as a
 * keyword, e.g. `"T_LOA":"inf"`). NID_C, NID_BG, N_TOTAL and N_PIG are not stored: they come from
 * the group's own data (NID_C: the diagram default when empty) and its balises.
 */
import type { Cell, GraphDataModel } from '@maxgraph/core';
import { readAttr, setRailwayData } from '../object-data';
import type { HeaderVar, PacketDef, PacketItem, StoredHeaderVar, VarDef } from './etcs-schema';
import { HEADER_VARS, PACKETS, Q_SCALE_RESOLUTION, STORED_HEADER_VARS, TELEGRAM_CAPACITY, VARS, getPacketDef, itemKey } from './etcs-schema';

/** Attribute of the group cell holding the JSON. */
export const ETCS_ATTR = 'rdEtcs';
export const ETCS_DATA_VERSION = 1;

export type EtcsValue = number | string;
export interface EtcsBlock {
  [key: string]: EtcsValue | EtcsBlock[] | undefined;
}

export interface EtcsPacket {
  /** NID_PACKET */
  nid: number;
  /** Variables (Q_DIR, Q_SCALE and the packet's own); iterations as arrays under their key. */
  vars: EtcsBlock;
  /** Paths of values filled from the drawing (and not edited since): `D_LINK`, `links.0.D_LINK`. */
  auto?: string[];
  /** N_PIG of the balises that carry the packet (missing / empty = every balise of the group). */
  pig?: number[];
}

export interface EtcsBaliseHeader {
  pig: number;
  M_DUP?: number;
  M_MCOUNT?: EtcsValue;
}

export interface EtcsGroupData {
  v: number;
  header: Partial<Record<StoredHeaderVar, EtcsValue>>;
  /** Per-balise header values that differ (M_DUP, M_MCOUNT). */
  balises?: EtcsBaliseHeader[];
  packets: EtcsPacket[];
}

export interface EtcsProblem {
  severity: 'error' | 'warning';
  /** `header.M_MCOUNT`, `packets.0.links.1.D_LINK`, `packets.2`, ... */
  path: string;
  message: string;
}

/** Values of the group from the drawing (not stored in the JSON). */
export interface EtcsGroupContext {
  /** NID_C (own or diagram default), null when unknown. */
  nidC: number | null;
  nidBg: number | null;
  /** N_TOTAL = balises in the group - 1. */
  nTotal: number;
}

// ---------------------------------------------------------------------------------------------
// Defaults, parsing, storage
// ---------------------------------------------------------------------------------------------

export function headerDefault(name: StoredHeaderVar): EtcsValue {
  return VARS[name].def ?? 0;
}

export function emptyEtcsData(): EtcsGroupData {
  return { v: ETCS_DATA_VERSION, header: Object.fromEntries(STORED_HEADER_VARS.map((n) => [n, headerDefault(n)])), packets: [] };
}

function defaultsFor(items: PacketItem[], block: EtcsBlock): void {
  for (const it of items) {
    if ('v' in it) {
      const d = VARS[it.v];
      if (d && d.def !== undefined && block[itemKey(it)] === undefined) block[itemKey(it)] = d.def;
    } else if ('iter' in it) {
      if (!Array.isArray(block[it.iter])) block[it.iter] = [];
    } else if (it.in.includes(Number(block[it.if] ?? VARS[it.if]?.def ?? 0))) {
      defaultsFor(it.items, block);
    }
  }
}

/** A new packet with the schema defaults (Q_DIR nominal, Q_SCALE 1 m). */
export function newPacket(nid: number): EtcsPacket {
  const def = getPacketDef(nid);
  const vars: EtcsBlock = {};
  if (def?.qdir) vars.Q_DIR = 1;
  if (def?.scale) vars.Q_SCALE = 1;
  if (def) defaultsFor(def.items, vars);
  return { nid, vars };
}

/** A new iteration entry of `iterKey` with the defaults. */
export function newIterEntry(nid: number, iterKey: string, parentPath: string[] = []): EtcsBlock {
  const def = getPacketDef(nid);
  let items = def?.items ?? [];
  for (const k of [...parentPath, iterKey]) {
    const found = findIter(items, k);
    items = found ? found.items : [];
  }
  const block: EtcsBlock = {};
  defaultsFor(items, block);
  return block;
}

function findIter(items: PacketItem[], key: string): { iter: string; items: PacketItem[] } | null {
  for (const it of items) {
    if ('iter' in it && it.iter === key) return it;
    if ('if' in it) {
      const f = findIter(it.items, key);
      if (f) return f;
    }
  }
  return null;
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

function normalizeBlock(raw: Record<string, unknown>): EtcsBlock {
  const out: EtcsBlock = {};
  for (const [k, val] of Object.entries(raw)) {
    if (Array.isArray(val)) out[k] = val.filter(isObj).map(normalizeBlock);
    else if (typeof val === 'number' || typeof val === 'string') out[k] = val;
  }
  return out;
}

/** Data from the stored JSON (or an AI tool input): unknown fields dropped, structure checked. */
export function normalizeEtcsData(raw: unknown): { data: EtcsGroupData; problems: EtcsProblem[] } {
  const problems: EtcsProblem[] = [];
  const data = emptyEtcsData();
  if (!isObj(raw)) {
    problems.push({ severity: 'error', path: '', message: 'ETCS data is not a JSON object' });
    return { data, problems };
  }
  if (isObj(raw.header)) {
    for (const n of STORED_HEADER_VARS) {
      const val = raw.header[n];
      if (typeof val === 'number' || typeof val === 'string') data.header[n] = val;
    }
  }
  if (Array.isArray(raw.balises)) {
    data.balises = raw.balises.filter(isObj).map((b) => {
      const out: EtcsBaliseHeader = { pig: Number(b.pig) };
      if (b.M_DUP !== undefined) out.M_DUP = Number(b.M_DUP);
      if (typeof b.M_MCOUNT === 'number' || typeof b.M_MCOUNT === 'string') out.M_MCOUNT = b.M_MCOUNT;
      return out;
    });
  }
  if (Array.isArray(raw.packets)) {
    raw.packets.forEach((p, i) => {
      if (!isObj(p) || typeof p.nid !== 'number') {
        problems.push({ severity: 'error', path: `packets.${i}`, message: `Packet ${i + 1}: no NID_PACKET ("nid")` });
        return;
      }
      const packet: EtcsPacket = { nid: p.nid, vars: isObj(p.vars) ? normalizeBlock(p.vars) : {} };
      if (Array.isArray(p.auto)) packet.auto = p.auto.filter((x): x is string => typeof x === 'string');
      if (Array.isArray(p.pig)) packet.pig = p.pig.filter((x): x is number => typeof x === 'number');
      data.packets.push(packet);
    });
  }
  return { data, problems };
}

export function parseEtcsData(text: string | null | undefined): { data: EtcsGroupData | null; problems: EtcsProblem[] } {
  if (!text || !text.trim()) return { data: null, problems: [] };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { data: null, problems: [{ severity: 'error', path: '', message: `ETCS data is not valid JSON: ${e instanceof Error ? e.message : String(e)}` }] };
  }
  return normalizeEtcsData(raw);
}

/** The stored JSON (compact, keys in a stable order; empty `auto` / `pig` / `balises` left out). */
export function serializeEtcsData(data: EtcsGroupData): string {
  const header: Record<string, EtcsValue> = {};
  for (const n of STORED_HEADER_VARS) if (data.header[n] !== undefined) header[n] = data.header[n]!;
  const out: Record<string, unknown> = { v: ETCS_DATA_VERSION, header };
  if (data.balises && data.balises.length > 0) out.balises = data.balises;
  out.packets = data.packets.map((p) => {
    const o: Record<string, unknown> = { nid: p.nid, vars: p.vars };
    if (p.auto && p.auto.length > 0) o.auto = [...new Set(p.auto)].sort();
    if (p.pig && p.pig.length > 0) o.pig = [...new Set(p.pig)].sort((a, b) => a - b);
    return o;
  });
  return JSON.stringify(out);
}

export function readEtcsData(cell: Cell): { data: EtcsGroupData | null; problems: EtcsProblem[] } {
  return parseEtcsData(readAttr(cell, ETCS_ATTR));
}

export function hasEtcsData(cell: Cell): boolean {
  return readAttr(cell, ETCS_ATTR).trim() !== '';
}

/** Stores (or with null removes) the data of the group cells: one undoable edit. */
export function setEtcsData(model: GraphDataModel, cells: Cell[], data: EtcsGroupData | null | ((cell: Cell) => EtcsGroupData | null)): Cell[] {
  return setRailwayData(model, cells, (cell) => {
    const d = typeof data === 'function' ? data(cell) : data;
    return { attrs: { [ETCS_ATTR]: d ? serializeEtcsData(d) : null } };
  });
}

export function cloneEtcsData(data: EtcsGroupData): EtcsGroupData {
  return JSON.parse(JSON.stringify(data)) as EtcsGroupData;
}

// ---------------------------------------------------------------------------------------------
// Values: physical <-> encoded
// ---------------------------------------------------------------------------------------------

/** Metres per distance step of a Q_SCALE (10 cm / 1 m / 10 m). */
export function scaleResolution(qScale: number): number {
  return Q_SCALE_RESOLUTION[qScale] ?? 1;
}

/** Number of a stored value ('' / keywords: null). Accepts a decimal comma. */
export function numericValue(val: EtcsValue | undefined): number | null {
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  if (typeof val !== 'string' || val.trim() === '') return null;
  const n = Number(val.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Largest encoded value of a variable that is not a special code. */
function maxRaw(d: VarDef): number {
  const top = 2 ** d.bits - 1;
  const specials = new Set((d.specials ?? []).map((s) => s.raw));
  let m = top;
  while (specials.has(m)) m--;
  return m;
}

/** The encoded value of a stored value (null: not encodable). Distances use `qScale`. */
export function toRaw(d: VarDef, val: EtcsValue | undefined, qScale = 1): number | null {
  if (typeof val === 'string') {
    const special = d.specials?.find((s) => s.key === val.trim());
    if (special) return special.raw;
  }
  const n = numericValue(val);
  if (n === null) return null;
  switch (d.kind) {
    case 'dist':
      return Math.round(n / scaleResolution(qScale));
    case 'speed':
      return Math.floor(n / 5 + 1e-9);
    default:
      return Math.round(n);
  }
}

/** The stored (physical) value of an encoded one. */
export function fromRaw(d: VarDef, raw: number, qScale = 1): EtcsValue {
  const special = d.specials?.find((s) => s.raw === raw);
  if (special) return special.key;
  switch (d.kind) {
    case 'dist':
      return Math.round(raw * scaleResolution(qScale) * 10) / 10;
    case 'speed':
      return raw * 5;
    default:
      return raw;
  }
}

/** Display text of a stored value: physical value + unit, enum label, special label. */
export function formatValue(d: VarDef, val: EtcsValue | undefined, lang: 'en' | 'pl' = 'en'): string {
  if (val === undefined || val === '') return '';
  if (typeof val === 'string') {
    const special = d.specials?.find((s) => s.key === val);
    if (special) return special.label[lang];
    if (d.kind === 'text' || d.kind === 'bits') return val;
  }
  const n = numericValue(val);
  if (n === null) return String(val);
  if (d.kind === 'enum') {
    const opt = d.options?.find((x) => x.v === n);
    return opt ? `${n} (${opt.label[lang]})` : String(n);
  }
  return d.unit ? `${n} ${d.unit}` : String(n);
}

// ---------------------------------------------------------------------------------------------
// Walking a packet's layout
// ---------------------------------------------------------------------------------------------

export interface LayoutField {
  def: VarDef;
  key: string;
  /** Path below the packet's vars (`links.0.D_LINK`). */
  path: string;
  value: EtcsValue | undefined;
}

export interface LayoutIter {
  key: string;
  path: string;
  entries: EtcsBlock[];
  /** Explicit counter in the data (`N_ITER` or `<key>_N_ITER`), when given. */
  counter: EtcsValue | undefined;
}

/** Visits a block's layout in transmission order (conditions resolved on the block's values). */
export function walkLayout(items: PacketItem[], block: EtcsBlock, prefix: string, visit: { field: (f: LayoutField) => void; iter: (it: LayoutIter, items: PacketItem[]) => void }): void {
  const iterCount = countIters(items);
  for (const it of items) {
    if ('v' in it) {
      const key = itemKey(it);
      visit.field({ def: VARS[it.v], key, path: prefix + key, value: block[key] as EtcsValue | undefined });
    } else if ('iter' in it) {
      const entries = Array.isArray(block[it.iter]) ? (block[it.iter] as EtcsBlock[]) : [];
      const counter = (block[`${it.iter}_N_ITER`] ?? (iterCount === 1 ? block.N_ITER : undefined)) as EtcsValue | undefined;
      visit.iter({ key: it.iter, path: prefix + it.iter, entries, counter }, it.items);
    } else {
      const ctl = numericValue(block[it.if] as EtcsValue | undefined) ?? numericValue(VARS[it.if]?.def);
      if (ctl !== null && it.in.includes(ctl)) walkLayout(it.items, block, prefix, visit);
    }
  }
}

function countIters(items: PacketItem[]): number {
  let n = 0;
  for (const it of items) {
    if ('iter' in it) n++;
    else if ('if' in it) n += countIters(it.items);
  }
  return n;
}

/** Keys a block may hold (its variables, iterations and their counters). */
function knownKeys(items: PacketItem[], out = new Set<string>()): Set<string> {
  for (const it of items) {
    if ('v' in it) out.add(itemKey(it));
    else if ('iter' in it) out.add(it.iter).add(`${it.iter}_N_ITER`).add('N_ITER');
    else {
      out.add(it.if);
      knownKeys(it.items, out);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------------------------

export interface EncodedField {
  name: string;
  /** Packet-relative path ('' for header / packet header variables). */
  path: string;
  bits: number;
  raw: number | string;
}

function encodeValue(d: VarDef, key: string, path: string, val: EtcsValue | undefined, qScale: number, out: EncodedField[]): void {
  if (d.kind === 'text') {
    const text = typeof val === 'string' ? val : val === undefined ? '' : String(val);
    out.push({ name: 'L_TEXT', path: `${path}.L_TEXT`, bits: 8, raw: text.length });
    for (let i = 0; i < text.length; i++) out.push({ name: 'X_TEXT', path, bits: 8, raw: text.charCodeAt(i) & 0xff });
    return;
  }
  if (d.kind === 'bits') {
    const hex = (typeof val === 'string' ? val : '').replace(/\s+/g, '');
    if (hex) out.push({ name: key, path, bits: hex.length * 4, raw: hex.toUpperCase() });
    return;
  }
  out.push({ name: d.name, path, bits: d.bits, raw: toRaw(d, val, qScale) ?? 0 });
}

/** The fields of a packet in transmission order (NID_PACKET, Q_DIR, L_PACKET, ...); L_PACKET filled. */
export function encodePacket(packet: EtcsPacket): EncodedField[] {
  const def = getPacketDef(packet.nid);
  const out: EncodedField[] = [{ name: 'NID_PACKET', path: '', bits: 8, raw: packet.nid }];
  if (!def) return out;
  if (def.nid === 255) return out;
  const qScale = numericValue(packet.vars.Q_SCALE as EtcsValue) ?? 1;
  out.push({ name: 'Q_DIR', path: 'Q_DIR', bits: 2, raw: numericValue(packet.vars.Q_DIR as EtcsValue) ?? 1 });
  const lp: EncodedField = { name: 'L_PACKET', path: '', bits: 13, raw: 0 };
  out.push(lp);
  if (def.scale) out.push({ name: 'Q_SCALE', path: 'Q_SCALE', bits: 2, raw: qScale });
  const visit = (items: PacketItem[], block: EtcsBlock, prefix: string): void =>
    walkLayout(items, block, prefix, {
      field: (f) => f.def && encodeValue(f.def, f.key, f.path, f.value, qScale, out),
      iter: (it, sub) => {
        out.push({ name: 'N_ITER', path: `${it.path}.N_ITER`, bits: 5, raw: it.entries.length });
        it.entries.forEach((e, i) => visit(sub, e, `${it.path}.${i}.`));
      },
    });
  visit(def.items, packet.vars, '');
  lp.raw = out.reduce((s, f) => s + f.bits, 0);
  return out;
}

export function packetLength(packet: EtcsPacket): number {
  return encodePacket(packet).reduce((s, f) => s + f.bits, 0);
}

/** Packets carried by the balise with `pig` (packet 255 not included). */
export function packetsOfBalise(data: EtcsGroupData, pig: number): EtcsPacket[] {
  return data.packets.filter((p) => p.nid !== 255 && (!p.pig || p.pig.length === 0 || p.pig.includes(pig)));
}

/** Header value of a balise (per-balise override, else the group's, else the default). */
export function baliseHeaderValue(data: EtcsGroupData, pig: number, name: StoredHeaderVar): EtcsValue {
  const own = data.balises?.find((b) => b.pig === pig);
  if (own && (name === 'M_DUP' || name === 'M_MCOUNT') && own[name] !== undefined) return own[name]!;
  return data.header[name] ?? headerDefault(name);
}

/** The header fields of the telegram of balise `pig`. */
export function encodeHeader(data: EtcsGroupData, ctx: EtcsGroupContext, pig: number): EncodedField[] {
  const values: Record<HeaderVar, EtcsValue> = {
    Q_UPDOWN: baliseHeaderValue(data, pig, 'Q_UPDOWN'),
    M_VERSION: baliseHeaderValue(data, pig, 'M_VERSION'),
    Q_MEDIA: baliseHeaderValue(data, pig, 'Q_MEDIA'),
    N_PIG: pig,
    N_TOTAL: ctx.nTotal,
    M_DUP: baliseHeaderValue(data, pig, 'M_DUP'),
    M_MCOUNT: baliseHeaderValue(data, pig, 'M_MCOUNT'),
    NID_C: ctx.nidC ?? 0,
    NID_BG: ctx.nidBg ?? 0,
    Q_LINK: baliseHeaderValue(data, pig, 'Q_LINK'),
  };
  return HEADER_VARS.map((n) => ({ name: n, path: `header.${n}`, bits: VARS[n].bits, raw: toRaw(VARS[n], values[n]) ?? 0 }));
}

export interface BaliseTelegram {
  pig: number;
  header: EncodedField[];
  packets: Array<{ packet: EtcsPacket; fields: EncodedField[]; bits: number }>;
  /** User data bits (header + packets + packet 255). */
  bits: number;
  /** User data as hex (bits padded with zeros to a multiple of 4). */
  hex: string;
}

function fieldBits(f: EncodedField): string {
  if (typeof f.raw === 'string') return [...f.raw].map((h) => parseInt(h, 16).toString(2).padStart(4, '0')).join('');
  const raw = Math.max(0, Math.min(2 ** f.bits - 1, Math.trunc(f.raw)));
  return raw.toString(2).padStart(f.bits, '0');
}

export function bitsToHex(bits: string): string {
  const padded = bits.padEnd(Math.ceil(bits.length / 4) * 4, '0');
  let hex = '';
  for (let i = 0; i < padded.length; i += 4) hex += parseInt(padded.slice(i, i + 4), 2).toString(16).toUpperCase();
  return hex;
}

/** The telegram (user data) of each balise of the group: N_PIG 0..N_TOTAL. */
export function buildTelegrams(data: EtcsGroupData, ctx: EtcsGroupContext): BaliseTelegram[] {
  const out: BaliseTelegram[] = [];
  for (let pig = 0; pig <= ctx.nTotal; pig++) {
    const header = encodeHeader(data, ctx, pig);
    const packets = packetsOfBalise(data, pig).map((packet) => {
      const fields = encodePacket(packet);
      return { packet, fields, bits: fields.reduce((s, f) => s + f.bits, 0) };
    });
    const end: EncodedField = { name: 'NID_PACKET', path: '', bits: 8, raw: 255 };
    const all = [...header, ...packets.flatMap((p) => p.fields), end];
    const bitString = all.map(fieldBits).join('');
    out.push({ pig, header, packets, bits: bitString.length, hex: bitsToHex(bitString) });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------------

const LATIN1 = /^[\x20-\x7e\xa0-\xff]*$/;

function checkValue(d: VarDef, val: EtcsValue | undefined, qScale: number, path: string, label: string, out: EtcsProblem[]): void {
  const err = (message: string): void => {
    out.push({ severity: 'error', path, message: `${label}: ${message}` });
  };
  if (val === undefined || val === '') {
    if (d.kind === 'text' || d.kind === 'bits') return;
    err(`${d.name} is required`);
    return;
  }
  if (d.kind === 'text') {
    const text = String(val);
    if (text.length > 255) err('X_TEXT is longer than 255 characters (L_TEXT)');
    if (!LATIN1.test(text)) err('X_TEXT has characters outside ISO 8859-1 (Latin-1)');
    return;
  }
  if (d.kind === 'bits') {
    if (typeof val !== 'string' || !/^[0-9a-fA-F\s]*$/.test(val)) err(`${d.name} must be hex digits`);
    return;
  }
  if (typeof val === 'string' && d.specials?.some((s) => s.key === val.trim())) return;
  const n = numericValue(val);
  if (n === null) {
    const keys = (d.specials ?? []).map((s) => `"${s.key}"`);
    err(`${d.name} "${String(val)}" is not a number${keys.length > 0 ? ` (or ${keys.join(' / ')})` : ''}`);
    return;
  }
  if (d.kind === 'enum') {
    if (!d.options?.some((x) => x.v === n)) err(`${d.name} ${n} is not one of ${(d.options ?? []).map((x) => x.v).join(', ')}`);
    return;
  }
  if ((d.kind === 'int' || d.kind === 'count' || d.kind === 'grad' || d.kind === 'time') && !Number.isInteger(n)) {
    err(`${d.name} must be a whole number`);
    return;
  }
  const unit = d.unit ? ` ${d.unit}` : '';
  if ((d.min !== undefined && n < d.min) || (d.max !== undefined && n > d.max)) {
    err(`${d.name} ${n}${unit} is outside ${d.min ?? '−∞'}–${d.max ?? '∞'}${unit}`);
    return;
  }
  if (d.kind === 'dist') {
    const res = scaleResolution(qScale);
    const raw = n / res;
    if (Math.round(raw) > maxRaw(d)) {
      err(`${d.name} ${n} m does not fit Q_SCALE ${['10 cm', '1 m', '10 m'][qScale] ?? qScale} (max ${Math.floor(maxRaw(d) * res)} m): use a larger Q_SCALE`);
      return;
    }
    if (Math.abs(raw - Math.round(raw)) > 1e-6) out.push({ severity: 'warning', path, message: `${label}: ${d.name} ${n} m is rounded to ${Math.round(raw) * res} m (Q_SCALE resolution ${res} m)` });
  }
  if (d.kind === 'speed' && Math.abs(n / 5 - Math.round(n / 5)) > 1e-9) {
    out.push({ severity: 'warning', path, message: `${label}: ${d.name} ${n} km/h is encoded as ${Math.floor(n / 5) * 5} km/h (5 km/h steps)` });
  }
}

/** Range / required / N_ITER / size checks of the whole group's data. */
export function validateEtcsData(data: EtcsGroupData, ctx: EtcsGroupContext): EtcsProblem[] {
  const out: EtcsProblem[] = [];
  for (const n of STORED_HEADER_VARS) checkValue(VARS[n], data.header[n] ?? headerDefault(n), 1, `header.${n}`, 'Header', out);
  if (ctx.nidC === null) out.push({ severity: 'error', path: 'header.NID_C', message: 'Header: NID_C is unknown (set the group\'s NID_C or the diagram default)' });
  if (ctx.nidBg === null) out.push({ severity: 'error', path: 'header.NID_BG', message: 'Header: NID_BG is unknown (set the group\'s NID_BG in the Data panel)' });
  for (const [i, b] of (data.balises ?? []).entries()) {
    if (!Number.isInteger(b.pig) || b.pig < 0 || b.pig > ctx.nTotal) out.push({ severity: 'error', path: `balises.${i}`, message: `Balise header: N_PIG ${b.pig} is not 0–${ctx.nTotal}` });
    if (b.M_DUP !== undefined) checkValue(VARS.M_DUP, b.M_DUP, 1, `balises.${i}.M_DUP`, `Balise ${b.pig + 1}`, out);
    if (b.M_MCOUNT !== undefined) checkValue(VARS.M_MCOUNT, b.M_MCOUNT, 1, `balises.${i}.M_MCOUNT`, `Balise ${b.pig + 1}`, out);
  }
  data.packets.forEach((p, i) => {
    const def = getPacketDef(p.nid);
    const label = `Packet ${i + 1} (${p.nid}${def ? ` ${def.name.en}` : ''})`;
    if (!def) {
      out.push({ severity: 'error', path: `packets.${i}`, message: `${label}: packet ${p.nid} is not supported` });
      return;
    }
    if (def.nid === 255) {
      out.push({ severity: 'warning', path: `packets.${i}`, message: `${label}: packet 255 ends every telegram automatically (this entry is ignored)` });
      return;
    }
    out.push(...validatePacket(p, def, `packets.${i}`, label));
    for (const pig of p.pig ?? []) {
      if (!Number.isInteger(pig) || pig < 0 || pig > ctx.nTotal) out.push({ severity: 'error', path: `packets.${i}.pig`, message: `${label}: balise N_PIG ${pig} is not in the group (0–${ctx.nTotal})` });
    }
  });
  // the same packet twice for the same direction and balises
  const seen = new Map<string, number>();
  data.packets.forEach((p, i) => {
    if (p.nid === 255 || p.nid === 44 || p.nid === 72 || p.nid === 65 || p.nid === 66) return;
    const key = `${p.nid}|${String(p.vars.Q_DIR ?? '')}|${(p.pig ?? []).join(',')}`;
    if (seen.has(key)) out.push({ severity: 'warning', path: `packets.${i}`, message: `Packet ${i + 1} (${p.nid}): same packet and Q_DIR as packet ${seen.get(key)! + 1}` });
    else seen.set(key, i);
  });
  for (const t of buildTelegrams(data, ctx)) {
    if (t.bits > TELEGRAM_CAPACITY.long) {
      out.push({ severity: 'error', path: 'telegram', message: `Telegram of balise ${t.pig + 1} (N_PIG ${t.pig}) has ${t.bits} bits: more than a long telegram's ${TELEGRAM_CAPACITY.long} user bits` });
    }
  }
  return out;
}

/** Checks of one packet (variables, conditions, iterations, L_PACKET). */
export function validatePacket(p: EtcsPacket, def: PacketDef, base: string, label: string): EtcsProblem[] {
  const out: EtcsProblem[] = [];
  const qScale = numericValue(p.vars.Q_SCALE as EtcsValue) ?? 1;
  if (def.qdir) checkValue(VARS.Q_DIR, p.vars.Q_DIR as EtcsValue, 1, `${base}.Q_DIR`, label, out);
  if (def.scale) checkValue(VARS.Q_SCALE, p.vars.Q_SCALE as EtcsValue, 1, `${base}.Q_SCALE`, label, out);
  const visit = (items: PacketItem[], block: EtcsBlock, prefix: string, where: string): void => {
    const known = knownKeys(items);
    if (prefix === '') known.add('Q_DIR').add('Q_SCALE');
    for (const k of Object.keys(block)) {
      if (!known.has(k)) out.push({ severity: 'warning', path: `${base}.${prefix}${k}`, message: `${where}: ${k} is not a variable of packet ${def.nid} (ignored)` });
    }
    walkLayout(items, block, prefix, {
      field: (f) => f.def && checkValue(f.def, f.value, qScale, `${base}.${f.path}`, where, out),
      iter: (it, sub) => {
        if (it.entries.length > 31) out.push({ severity: 'error', path: `${base}.${it.path}`, message: `${where}: ${it.entries.length} entries in ${it.key}, N_ITER allows 31` });
        if (it.counter !== undefined && numericValue(it.counter) !== it.entries.length) {
          out.push({ severity: 'error', path: `${base}.${it.path}`, message: `${where}: N_ITER = ${String(it.counter)} but ${it.key} has ${it.entries.length} entr${it.entries.length === 1 ? 'y' : 'ies'}` });
        }
        it.entries.forEach((e, i) => visit(sub, e, `${it.path}.${i}.`, `${where}, ${it.key} ${i + 1}`));
      },
    });
  };
  visit(def.items, p.vars, '', label);
  const len = packetLength(p);
  if (len > 8191) out.push({ severity: 'error', path: base, message: `${label}: ${len} bits, more than L_PACKET allows (8191)` });
  return out;
}

/** Every packet number the editor offers (255 is added to each telegram). */
export const EDITABLE_PACKETS: readonly number[] = PACKETS.filter((p) => p.nid !== 255).map((p) => p.nid);
