/**
 * Extracts every draw.io sidebar palette of the pinned release (fetch-sources.ts) into
 * src/drawio-shapes/palettes/data/<id>.json (schema: src/drawio-shapes/palettes/types.ts), plus
 * the catalogue (catalogue.json: libraries, palettes, counts, "More shapes" categories) and the
 * global search index (search-index.json).
 *
 * Usage (after fetch-sources.ts and decode-stencils-bundle.ts):
 *   node scripts/drawio-palettes/extract-palettes.ts
 *
 * How: draw.io's real palette functions (Sidebar.prototype.addGeneralPalette & co. from
 * js/grapheditor/Sidebar.js, every js/diagramly/sidebar/Sidebar-*.js and initPalettes() from
 * js/diagramly/sidebar/Sidebar.js) are evaluated by safe-js.ts, a closed tree-walking interpreter
 * (the downloaded sources are parsed, never executed by a JavaScript engine), against a stub
 * Sidebar whose createVertexTemplateEntry/createEdgeTemplateEntry/addEntry/addDataEntry/
 * addStencilPalette/addImagePalette record entries instead of building DOM. Entry order,
 * titles, sizes, styles and values are therefore exactly draw.io's. Compressed data entries are
 * inflated (Graph.decompress semantics) into `xml`; composite cell entries are serialized to
 * mxGraphModel XML in mxCodec form. Classification:
 *   a = maxGraph core shape (@maxgraph/core 0.10.3 register-shapes.js),
 *   b = draw.io stencil (public/stencils/*.xml),
 *   c = JS shape (js/grapheditor/Shapes.js or shapes/**.js mxCellRenderer.registerShape),
 *   d = other mechanism (edge, text, image, swimlane/container, composite cells, data).
 * A JS shape wins over a stencil of the same name, as in draw.io's mxStencilRegistry.getStencil.
 *
 * Portions derived from jgraph/drawio v32.4.1 (Apache-2.0),
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import ts from 'typescript';
import { DRAWIO_TAG, REPO_ROOT, WEBAPP, cachePath, listSources, readSource } from './fetch-sources.ts';
import { HostFn, Interpreter, hostFn, sobj, toStr, type SObj } from './safe-js.ts';
import { decodeAllStencils } from './decode-stencils-bundle.ts';
import { VENDORS, libraryInfo } from './libraries.ts';
import { DRAWIO_COMMIT } from './fetch-sources.ts';

type Cls = 'a' | 'b' | 'c' | 'd';

interface OutEntry {
  id: string;
  title: string;
  tags?: string;
  kind: 'vertex' | 'edge' | 'cells';
  width: number;
  height: number;
  style?: string;
  value?: string;
  xml?: string;
  shapeNames: string[];
  cls: Cls;
  source: string;
}

const OUT_DIR = path.join(REPO_ROOT, 'src', 'drawio-shapes', 'palettes', 'data');
const PUBLIC_IMG = path.join(REPO_ROOT, 'public');

// ---------- sources ----------
const F = {
  geSidebar: WEBAPP + 'js/grapheditor/Sidebar.js',
  dySidebar: WEBAPP + 'js/diagramly/sidebar/Sidebar.js',
};
const rel = (repoPath: string): string => repoPath.startsWith(WEBAPP) ? repoPath.slice(WEBAPP.length) : repoPath;

function findLine(text: string, needle: string | RegExp, from = 0): number {
  const lines = text.split('\n');
  for (let i = from; i < lines.length; i++) {
    if (typeof needle === 'string' ? lines[i].includes(needle) : needle.test(lines[i])) return i + 1;
  }
  throw new Error(`not found: ${String(needle)}`);
}

// ---------- stencil sets (decoded from js/stencils.min.js) ----------
interface StencilInfo { pkg: string; stencilName: string; w: number; h: number }
const STENCIL_XML = decodeAllStencils();
function readStencilSet(xml: string): StencilInfo[] {
  const rootName = /^<shapes\b[^>]*\bname="([^"]*)"/.exec(xml)?.[1] ?? '';
  const pkg = rootName ? unescapeXml(rootName).toLowerCase() + '.' : '';
  const out: StencilInfo[] = [];
  // Top-level children are indented by exactly two spaces (decode-stencils-bundle.ts output)
  const re = /^ {2}<shape\b([^>]*?)\/?>/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const attrs: Record<string, string> = {};
    m[1].replace(/([\w:-]+)="([^"]*)"/g, (_s, k: string, v: string) => { attrs[k] = unescapeXml(v); return ''; });
    if (attrs.name == null) continue;
    out.push({
      pkg,
      stencilName: attrs.name.replace(/ /g, '_'),
      w: attrs.w == null ? 80 : parseInt(attrs.w, 10),
      h: attrs.h == null ? 80 : parseInt(attrs.h, 10),
    });
  }
  return out;
}
const STENCIL_SETS = new Map<string, StencilInfo[]>();
for (const [file, xml] of STENCIL_XML) STENCIL_SETS.set(file, readStencilSet(xml));
const STENCIL_NAMES = new Set<string>();
for (const set of STENCIL_SETS.values()) for (const s of set) STENCIL_NAMES.add(s.pkg + s.stencilName.toLowerCase());

// ---------- JS shapes registered by draw.io ----------
const JS_SHAPES = new Map<string, string>(); // name -> file:line
/** Shape names registered by a draw.io JS file (static scan of mxCellRenderer.registerShape calls). */
export function scanShapeRegistrations(txt: string): Array<{ name: string; line: number }> {
  const lines = txt.split('\n');
  // string constants: `X.prototype.cst = {K: 'v'}` and `var C = {K: 'v'}` -> 'X.prototype.cst.K' / 'C.K'
  const cst: Record<string, string> = {};
  const re = /([\w$]+(?:\.prototype\.cst)?)\s*=\s*\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(txt))) {
    const re2 = /([\w$]+)\s*:\s*'([^']+)'/g;
    let k: RegExpExecArray | null;
    while ((k = re2.exec(m[2]))) cst[m[1] + '.' + k[1]] = k[2];
  }
  const out: Array<{ name: string; line: number }> = [];
  lines.forEach((l, i) => {
    const r = /mxCellRenderer\.registerShape\(\s*([^,]+?)\s*,/.exec(l);
    if (!r) return;
    const arg = r[1];
    const name = /^'.*'$/.test(arg) ? arg.slice(1, -1) : cst[arg];
    if (name) out.push({ name, line: i + 1 });
    else console.log(`unresolved registerShape(${arg}) at line ${i + 1}`);
  });
  return out;
}
function scanShapes(repoPath: string): void {
  for (const { name, line } of scanShapeRegistrations(readSource(repoPath))) {
    if (!JS_SHAPES.has(name)) JS_SHAPES.set(name, `${rel(repoPath)}:${line}`);
  }
}
scanShapes(WEBAPP + 'js/grapheditor/Shapes.js');
for (const f of listSources(WEBAPP + 'shapes/').filter((p) => p.endsWith('.js'))) scanShapes(f);

/** @maxgraph/core 0.10.3 dist/view/cell/register-shapes.js (CellRenderer default shapes). */
const CORE_SHAPES = new Set(['actor', 'arrow', 'arrowConnector', 'connector', 'cloud', 'cylinder', 'doubleEllipse',
  'ellipse', 'hexagon', 'image', 'label', 'line', 'rectangle', 'rhombus', 'swimlane', 'triangle']);

// ---------- style helpers ----------
function parseStyle(s: string | null | undefined): { names: string[]; kv: Record<string, string> } {
  const names: string[] = [];
  const kv: Record<string, string> = {};
  for (const p of (s || '').split(';')) {
    if (!p) continue;
    const i = p.indexOf('=');
    if (i < 0) names.push(p);
    else kv[p.slice(0, i)] = p.slice(i + 1);
  }
  return { names, kv };
}
function setStyle(style: string | null, key: string, value: string | null): string {
  const parts = (style || '').split(';').filter((x) => x);
  let found = false;
  const r = parts.map((p) => {
    if (p.startsWith(key + '=')) { found = true; return value == null ? null : key + '=' + value; }
    return p;
  }).filter((x): x is string => x != null);
  if (!found && value != null) r.push(key + '=' + value);
  return r.join(';') + ';';
}
/** Named styles of draw.io's default stylesheet that select a shape of the same name. */
const NAMED_SHAPE_STYLES = new Set(['ellipse', 'rhombus', 'triangle', 'swimlane', 'line', 'label', 'image', 'doubleEllipse',
  'cylinder', 'cloud', 'actor', 'hexagon']);
/** Shape names a cell style refers to: shape= plus named styles that select a shape. */
function shapeNamesOf(style: string | null | undefined): string[] {
  const { names, kv } = parseStyle(style);
  if (kv.shape) return [kv.shape];
  const n = names.find((x) => NAMED_SHAPE_STYLES.has(x));
  return n ? [n] : [];
}

function unescapeXml(v: string): string {
  return v.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#10;|&#xa;/gi, '\n')
    .replace(/&#9;|&#x9;/gi, '\t').replace(/&#13;|&#xd;/gi, '\r').replace(/&amp;/g, '&');
}
function escapeXml(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '&#xa;').replace(/\r/g, '&#xd;').replace(/\t/g, '&#x9;');
}

/** Graph.decompress: base64 -> inflateRaw -> bytes as latin1 string -> decodeURIComponent. Plain XML is kept. */
function decompress(data: string): string {
  if (/^\s*</.test(data)) return data;
  const raw = zlib.inflateRawSync(Buffer.from(data, 'base64'), { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString('latin1');
  return decodeURIComponent(raw);
}

// ---------- mxGraph stubs used by the palette code (interpreter values) ----------
const num = (v: unknown, d = 0): number => (v == null ? d : Number(v));
const pointProto = sobj();
function mkPoint(x: unknown, y: unknown): SObj { return sobj({ x: num(x), y: num(y) }, pointProto); }
pointProto.clone = hostFn('mxPoint.clone', (t) => mkPoint((t as SObj).x, (t as SObj).y));
const mxPoint = hostFn('mxPoint', (_t, a) => mkPoint(a[0], a[1]), (a) => mkPoint(a[0], a[1]));
mxPoint.props.prototype = pointProto;

const geoProto = sobj();
function mkGeo(x: unknown, y: unknown, w: unknown, h: unknown): SObj {
  return sobj({ x: num(x), y: num(y), width: num(w), height: num(h), relative: false, points: null,
    sourcePoint: null, targetPoint: null, offset: null }, geoProto);
}
function clonePt(p: unknown): unknown { return p ? mkPoint((p as SObj).x, (p as SObj).y) : null; }
geoProto.setTerminalPoint = hostFn('setTerminalPoint', (t, a) => {
  (t as SObj)[a[1] ? 'sourcePoint' : 'targetPoint'] = a[0];
  return a[0];
});
geoProto.clone = hostFn('mxGeometry.clone', (t) => {
  const g = t as SObj;
  const c = mkGeo(g.x, g.y, g.width, g.height);
  c.relative = g.relative;
  c.sourcePoint = clonePt(g.sourcePoint); c.targetPoint = clonePt(g.targetPoint); c.offset = clonePt(g.offset);
  c.points = Array.isArray(g.points) ? g.points.map(clonePt) : null;
  return c;
});
const mxGeometry = hostFn('mxGeometry', (_t, a) => mkGeo(a[0], a[1], a[2], a[3]), (a) => mkGeo(a[0], a[1], a[2], a[3]));
mxGeometry.props.prototype = geoProto;
const mxRectangle = hostFn('mxRectangle', (_t, a) => mkGeo(a[0], a[1], a[2], a[3]), (a) => mkGeo(a[0], a[1], a[2], a[3]));

/** XML element stub (mxUtils.createXmlDocument().createElement). */
const elemProto = sobj();
elemProto.setAttribute = hostFn('setAttribute', (t, a) => {
  const attrs = (t as SObj).attrs as Array<[string, string]>;
  const k = toStr(a[0]);
  const v = toStr(a[1]);
  const i = attrs.findIndex(([x]) => x === k);
  if (i >= 0) attrs[i] = [k, v]; else attrs.push([k, v]);
});
elemProto.getAttribute = hostFn('getAttribute', (t, a) => {
  const hit = ((t as SObj).attrs as Array<[string, string]>).find(([x]) => x === toStr(a[0]));
  return hit ? hit[1] : null;
});
elemProto.cloneNode = hostFn('cloneNode', (t) => cloneElem(t as SObj));
function mkElem(name: string): SObj { return sobj({ nodeName: name, tagName: name, attrs: [], __elem: true }, elemProto); }
function cloneElem(e: SObj): SObj {
  const c = mkElem(e.nodeName as string);
  c.attrs = (e.attrs as Array<[string, string]>).map(([k, v]) => [k, v]);
  return c;
}
const isElem = (v: unknown): v is SObj => v != null && typeof v === 'object' && (v as SObj).__elem === true;
const xmlDocProto = sobj({ createElement: hostFn('createElement', (_t, a) => mkElem(toStr(a[0]))) });

const cellProto = sobj();
function mkCell(value: unknown, geometry: unknown, style: unknown): SObj {
  return sobj({ value, geometry: geometry ?? null, style: style ?? null, vertex: false, edge: false, connectable: true,
    children: [], parent: null, source: null, target: null }, cellProto);
}
function cloneCell(c: SObj): SObj {
  const value = isElem(c.value) ? cloneElem(c.value) : c.value;
  const g = c.geometry ? (geoProto.clone as HostFn).impl(c.geometry, [], null as unknown as Interpreter) : null;
  const n = mkCell(value, g, c.style);
  n.vertex = c.vertex; n.edge = c.edge; n.connectable = c.connectable;
  n.children = (c.children as SObj[]).map((ch) => { const x = cloneCell(ch); x.parent = n; return x; });
  return n;
}
Object.assign(cellProto, {
  insert: hostFn('insert', (t, a) => {
    const c = a[0] as SObj;
    const kids = (t as SObj).children as SObj[];
    if (a[1] != null) kids.splice(Number(a[1]), 0, c); else kids.push(c);
    c.parent = t;
    return c;
  }),
  insertEdge: hostFn('insertEdge', (t, a) => { (a[0] as SObj)[a[1] ? 'source' : 'target'] = t; return a[0]; }),
  setTerminal: hostFn('setTerminal', (t, a) => { (t as SObj)[a[1] ? 'source' : 'target'] = a[0]; return a[0]; }),
  setConnectable: hostFn('setConnectable', (t, a) => { (t as SObj).connectable = !!a[0]; }),
  setVertex: hostFn('setVertex', (t, a) => { (t as SObj).vertex = !!a[0]; }),
  setEdge: hostFn('setEdge', (t, a) => { (t as SObj).edge = !!a[0]; }),
  setStyle: hostFn('setStyle', (t, a) => { (t as SObj).style = a[0]; }),
  getStyle: hostFn('getStyle', (t) => (t as SObj).style),
  setValue: hostFn('setValue', (t, a) => { (t as SObj).value = a[0]; }),
  getValue: hostFn('getValue', (t) => (t as SObj).value),
  setGeometry: hostFn('setGeometry', (t, a) => { (t as SObj).geometry = a[0]; }),
  getGeometry: hostFn('getGeometry', (t) => (t as SObj).geometry),
  getChildAt: hostFn('getChildAt', (t, a) => ((t as SObj).children as SObj[])[Number(a[0])]),
  getChildCount: hostFn('getChildCount', (t) => ((t as SObj).children as SObj[]).length),
  isVertex: hostFn('isVertex', (t) => !!(t as SObj).vertex),
  isEdge: hostFn('isEdge', (t) => !!(t as SObj).edge),
  clone: hostFn('mxCell.clone', (t) => cloneCell(t as SObj)),
  setId: hostFn('setId', () => undefined),
  // mxCell.setAttribute/getAttribute: only for element values
  setAttribute: hostFn('mxCell.setAttribute', (t, a, it) => {
    const v = (t as SObj).value;
    if (isElem(v)) it.call(elemProto.setAttribute, v, a);
  }),
  getAttribute: hostFn('mxCell.getAttribute', (t, a, it) => {
    const v = (t as SObj).value;
    return isElem(v) ? it.call(elemProto.getAttribute, v, a) : (a[1] ?? null);
  }),
});
const mxCell = hostFn('mxCell', (_t, a) => mkCell(a[0], a[1], a[2]), (a) => mkCell(a[0], a[1], a[2]));
mxCell.props.prototype = cellProto;

function setCellAttr(cell: SObj, key: string, value: string): void {
  // Graph.setAttributeForCell: converts the value to a <UserObject label="..."> element
  if (!isElem(cell.value)) {
    const e = mkElem('UserObject');
    (e.attrs as Array<[string, string]>).push(['label', cell.value == null ? '' : toStr(cell.value)]);
    cell.value = e;
  }
  const attrs = (cell.value as SObj).attrs as Array<[string, string]>;
  const i = attrs.findIndex(([k]) => k === key);
  if (i >= 0) attrs[i] = [key, value]; else attrs.push([key, value]);
}

/** Serializes cells as mxCodec would (default 0/false values omitted) inside an mxGraphModel. */
function cellsToModelXml(cells: SObj[]): string {
  let nextId = 2;
  const ids = new Map<SObj, string>();
  const assign = (c: SObj): void => { ids.set(c, String(nextId++)); (c.children as SObj[]).forEach(assign); };
  cells.forEach(assign);
  const fmt = (n: unknown): string => String(n);
  const pt = (p: SObj, as?: string): string => {
    let a = '';
    if (p.x !== 0) a += ` x="${fmt(p.x)}"`;
    if (p.y !== 0) a += ` y="${fmt(p.y)}"`;
    if (as) a += ` as="${as}"`;
    return `<mxPoint${a}/>`;
  };
  const geo = (g: SObj): string => {
    let a = '';
    if (g.x !== 0) a += ` x="${fmt(g.x)}"`;
    if (g.y !== 0) a += ` y="${fmt(g.y)}"`;
    if (g.width !== 0) a += ` width="${fmt(g.width)}"`;
    if (g.height !== 0) a += ` height="${fmt(g.height)}"`;
    if (g.relative) a += ' relative="1"';
    a += ' as="geometry"';
    let inner = '';
    if (g.sourcePoint) inner += pt(g.sourcePoint as SObj, 'sourcePoint');
    if (g.targetPoint) inner += pt(g.targetPoint as SObj, 'targetPoint');
    if (Array.isArray(g.points) && g.points.length) inner += `<Array as="points">${g.points.map((p) => pt(p as SObj)).join('')}</Array>`;
    if (g.offset) inner += pt(g.offset as SObj, 'offset');
    return inner ? `<mxGeometry${a}>${inner}</mxGeometry>` : `<mxGeometry${a}/>`;
  };
  const enc = (c: SObj, parent: string): string => {
    const id = ids.get(c) as string;
    const elem = isElem(c.value) ? c.value : null;
    let cellAttrs = '';
    if (elem == null) cellAttrs += ` id="${id}" value="${escapeXml(c.value == null ? '' : toStr(c.value))}"`;
    if (c.style != null) cellAttrs += ` style="${escapeXml(toStr(c.style))}"`;
    if (c.vertex) cellAttrs += ' vertex="1"';
    if (c.edge) cellAttrs += ' edge="1"';
    if (!c.connectable) cellAttrs += ' connectable="0"';
    cellAttrs += ` parent="${parent}"`;
    if (c.source && ids.has(c.source as SObj)) cellAttrs += ` source="${ids.get(c.source as SObj)}"`;
    if (c.target && ids.has(c.target as SObj)) cellAttrs += ` target="${ids.get(c.target as SObj)}"`;
    const cellXml = `<mxCell${cellAttrs}>${c.geometry ? geo(c.geometry as SObj) : ''}</mxCell>`;
    const own = elem == null
      ? cellXml
      : `<${elem.nodeName as string}${(elem.attrs as Array<[string, string]>).map(([k, v]) => ` ${k}="${escapeXml(v)}"`).join('')} id="${id}">${cellXml}</${elem.nodeName as string}>`;
    return own + (c.children as SObj[]).map((ch) => enc(ch, id)).join('');
  };
  return `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells.map((c) => enc(c, '1')).join('')}</root></mxGraphModel>`;
}

// ---------- recording Sidebar ----------
interface RawEntry {
  kind: 'vertex' | 'edge' | 'cells';
  title: string;
  tags?: string;
  width: number;
  height: number;
  style?: string;
  value?: string;
  xml?: string;
  source: string | null;
}
/** Entries are functions in draw.io (palette code calls them); each one is a thunk returning itself. */
const ENTRY = new WeakMap<HostFn, RawEntry>();
function mk(e: RawEntry): HostFn {
  const f: HostFn = hostFn('entry', () => f);
  ENTRY.set(f, e);
  return f;
}
function asEntry(x: unknown): RawEntry {
  const e = x instanceof HostFn ? ENTRY.get(x) : undefined;
  if (!e) throw new Error('palette item is not a recorded entry');
  return e;
}

function filterTags(tags: string | null): string | null {
  if (tags == null) return null;
  const seen: Record<string, 1> = {};
  const r: string[] = [];
  for (const t of tags.split(' ')) if (!seen[t]) { seen[t] = 1; r.push(t); }
  return r.join(' ');
}

interface RawPalette { id: string; title: string; entries: RawEntry[]; library: string | null; source: string | null }
const palettes: RawPalette[] = [];
let interp: Interpreter;
let currentLibrary: string | null = null;
let currentPaletteFn: string | null = null;

/** Innermost interpreted call site (the line that called the stub), as file:line. */
function callerSource(): string | null {
  const s = interp.callStack[interp.callStack.length - 1];
  return s ? `${s.file}:${s.line}` : null;
}

const graphStub = sobj({
  vertexFontSize: null, edgeFontSize: null,
  appendFontSize: hostFn('appendFontSize', (_t, a) => {
    let s = a[0] != null ? toStr(a[0]) : '';
    const fs = a[1];
    if (fs != null) { if (s.length > 0 && s.charAt(s.length - 1) !== ';') s += ';'; s += 'fontSize=' + toStr(fs) + ';'; }
    return s;
  }),
  setLinkForCell: hostFn('setLinkForCell', (_t, a) => { setCellAttr(a[0] as SObj, 'link', toStr(a[1])); }),
  setAttributeForCell: hostFn('setAttributeForCell', (_t, a) => { setCellAttr(a[0] as SObj, toStr(a[1]), toStr(a[2])); }),
  cloneCells: hostFn('cloneCells', (_t, a) => (a[0] as SObj[]).map(cloneCell)),
});

const SidebarProto = sobj();
const Sidebar = hostFn('Sidebar', () => undefined, () => sobj(undefined, SidebarProto));
Sidebar.props.prototype = SidebarProto;
const P = SidebarProto;
P.editorUi = sobj({ editor: sobj({ graph: graphStub }) });
P.graph = graphStub;
P.initialDefaultVertexStyle = sobj();
P.gearImage = 'img/clipart/Gear_128x128.png';
P.defaultImageWidth = 80;
P.defaultImageHeight = 80;
P.customEntries = null;
P.appendCustomLibraries = false;
P.createdSearchIndex = null;
P.addSearchPalette = hostFn('addSearchPalette', () => undefined);
P.addCustomEntries = hostFn('addCustomEntries', () => undefined);
P.showEntries = hostFn('showEntries', () => undefined);
P.setCurrentSearchEntryLibrary = hostFn('setCurrentSearchEntryLibrary', (_t, a) => {
  currentLibrary = a[0] == null ? null : toStr(a[0]);
});
P.filterTags = hostFn('filterTags', (_t, a) => filterTags(a[0] == null ? null : toStr(a[0])));
P.getTagsForStencil = hostFn('getTagsForStencil', (_t, a) => {
  const tags = toStr(a[0]).split('.');
  for (let i = 1; i < tags.length; i++) tags[i] = tags[i].replace(/_/g, ' ');
  tags.push(toStr(a[1]).replace(/_/g, ' '));
  if (a[2] != null) tags.push(toStr(a[2]));
  return tags.slice(1);
});
P.cloneCell = hostFn('cloneCell', (_t, a) => { const c = cloneCell(a[0] as SObj); if (a[1] != null) c.value = a[1]; return c; });
const valueStr = (v: unknown): string | undefined => (v == null ? undefined : toStr(v));
P.createVertexTemplateEntry = hostFn('createVertexTemplateEntry', (_t, a) => {
  const [style, width, height, value, title, , , tags] = a;
  let t = tags == null ? null : toStr(tags);
  if (t != null && title != null) t += ' ' + toStr(title);
  t = t != null && t.length > 0 ? t : title != null ? toStr(title).toLowerCase() : '';
  return mk({ kind: 'vertex', style: toStr(style), width: num(width), height: num(height), value: valueStr(value),
    title: title == null ? '' : toStr(title), tags: t, source: callerSource() });
});
P.createEdgeTemplateEntry = hostFn('createEdgeTemplateEntry', (_t, a) => {
  const [style, width, height, value, title, , tags] = a;
  const t = tags != null && toStr(tags).length > 0 ? toStr(tags) : (title == null ? '' : toStr(title)).toLowerCase();
  return mk({ kind: 'edge', style: toStr(style), width: num(width), height: num(height), value: valueStr(value),
    title: title == null ? '' : toStr(title), tags: t, source: callerSource() });
});
const fromCells = hostFn('createVertexTemplateFromCells', (_t, a) => mk({ kind: 'cells', xml: cellsToModelXml(a[0] as SObj[]),
  width: num(a[1]), height: num(a[2]), title: a[3] == null ? '' : toStr(a[3]), source: null }));
P.createVertexTemplateFromCells = fromCells;
P.createEdgeTemplateFromCells = fromCells;
P.createVertexTemplateFromData = hostFn('createVertexTemplateFromData', (_t, a) => mk({ kind: 'cells',
  xml: decompress(toStr(a[0])), width: num(a[1]), height: num(a[2]), title: a[3] == null ? '' : toStr(a[3]), source: null }));
P.addEntry = hostFn('addEntry', (t, a, it) => {
  const source = callerSource();
  const r = it.call(a[1], t, []);
  const e = asEntry(r);
  e.tags = a[0] == null ? undefined : toStr(a[0]);
  e.source = source;
  return r;
});
P.addDataEntry = hostFn('addDataEntry', (t, a, it) => {
  const source = callerSource();
  const [tags, width, height, title, data] = a;
  let tg = tags == null ? '' : toStr(tags);
  if (title != null) tg += ' ' + toStr(title);
  const r = it.call(P.createVertexTemplateFromData, t, [data, width, height, title]);
  const e = asEntry(r);
  e.tags = tg;
  e.source = source;
  return r;
});
function pushPalette(id: unknown, title: unknown, entries: RawEntry[]): void {
  palettes.push({ id: toStr(id), title: toStr(title), entries, library: currentLibrary, source: currentPaletteFn });
}
P.addPaletteFunctions = hostFn('addPaletteFunctions', (_t, a) => {
  pushPalette(a[0], a[1], (a[3] as unknown[]).map(asEntry));
});
P.addPalette = hostFn('addPalette', (t, a, it) => {
  const entries: RawEntry[] = [];
  const content = sobj({ appendChild: hostFn('appendChild', (_t2, b) => { entries.push(asEntry(b[0])); }) });
  if (a[3] != null) it.call(a[3], t, [content]);
  pushPalette(a[0], a[1], entries);
});
P.addImagePalette = hostFn('addImagePalette', (t, a) => {
  // grapheditor Sidebar.js:6317
  const [id, title, prefix, postfix, items, titles, tags] = a as [string, string, string | null, string, string[], string[] | null, SObj | null];
  const source = callerSource();
  const entries: RawEntry[] = [];
  items.forEach((item, i) => {
    const itTitle = titles != null ? titles[i] : null;
    let tmpTags = tags != null ? (tags[item] as string | undefined) ?? null : null;
    if (tmpTags == null && (prefix == null || prefix.substring(0, 17) !== 'img/lib/clip_art/')) {
      const slash = item.lastIndexOf('/');
      const dot = item.lastIndexOf('.');
      tmpTags = item.substring(slash >= 0 ? slash + 1 : 0, dot >= 0 ? dot : item.length).replace(/[-_]/g, ' ');
    }
    const e = asEntry((P.createVertexTemplateEntry as HostFn).impl(t, ['image;html=1;image=' + toStr(prefix) + item + postfix,
      (t as SObj).defaultImageWidth, (t as SObj).defaultImageHeight, '', itTitle, itTitle != null, null, filterTags(tmpTags)], interp));
    e.source = source;
    entries.push(e);
  });
  pushPalette(id, title, entries);
});
P.addStencilPalette = hostFn('addStencilPalette', (t, a) => {
  // grapheditor Sidebar.js:6365 (index variant: entries carry the stencil tags)
  const [id, title, stencilFile, style, ignore, , scale, tags, customFns] = a as
    [string, string, string, string | null, string[] | null, unknown, number | null, SObj | null, unknown[] | null];
  const sc = scale != null ? scale : 1;
  const source = callerSource();
  const entries: RawEntry[] = (customFns || []).map(asEntry);
  const file = stencilFile.replace(/^stencils\//, '');
  const set = STENCIL_SETS.get(file);
  if (!set) throw new Error(`stencil set not in stencils.min.js: ${stencilFile}`);
  usedStencilFiles.add(file);
  for (const s of set) {
    if (ignore != null && ignore.indexOf(s.stencilName) >= 0) continue;
    const tmp = (P.getTagsForStencil as HostFn).impl(t, [s.pkg, s.stencilName], interp) as string[];
    const extra = tags != null ? tags[s.stencilName] : null;
    if (extra != null) tmp.push(toStr(extra));
    const e = asEntry((P.createVertexTemplateEntry as HostFn).impl(t, ['shape=' + s.pkg + s.stencilName.toLowerCase() + (style ?? ''),
      Math.round(s.w * sc), Math.round(s.h * sc), '', s.stencilName.replace(/_/g, ' '), null, null, filterTags(tmp.join(' '))], interp));
    e.source = source;
    entries.push(e);
  }
  pushPalette(id, title, entries);
});
const usedStencilFiles = new Set<string>();

// ---------- resources (mxResources.get, English) ----------
const RESOURCES = new Map<string, string>();
for (const line of readSource(WEBAPP + 'resources/dia.txt').split('\n')) {
  const m = /^([A-Za-z0-9_.-]+)=(.*)$/.exec(line.replace(/\r$/, ''));
  if (m) RESOURCES.set(m[1], m[2]);
}

const xmlDoc = (): SObj => sobj(undefined, xmlDocProto);
interp = new Interpreter({
  Sidebar, mxCell, mxGeometry, mxPoint, mxRectangle,
  mxResources: sobj({ get: hostFn('mxResources.get', (_t, a) => RESOURCES.get(toStr(a[0])) ?? toStr(a[0])) }),
  mxConstants: sobj({
    STYLE_VERTICAL_LABEL_POSITION: 'verticalLabelPosition', STYLE_VERTICAL_ALIGN: 'verticalAlign', STYLE_STROKEWIDTH: 'strokeWidth',
    STYLE_SHAPE: 'shape', STYLE_STROKECOLOR: 'strokeColor', STYLE_FILLCOLOR: 'fillColor', STYLE_DIRECTION: 'direction',
    DIRECTION_NORTH: 'north', DIRECTION_SOUTH: 'south', DIRECTION_EAST: 'east', DIRECTION_WEST: 'west',
    STYLE_LABEL_POSITION: 'labelPosition', STYLE_ALIGN: 'align', STYLE_STARTARROW: 'startArrow', STYLE_ENDARROW: 'endArrow',
    STYLE_FONTSIZE: 'fontSize', STYLE_FONTCOLOR: 'fontColor', STYLE_ROUNDED: 'rounded', STYLE_DASHED: 'dashed',
    NONE: 'none', ALIGN_LEFT: 'left', ALIGN_CENTER: 'center', ALIGN_RIGHT: 'right', ALIGN_TOP: 'top', ALIGN_MIDDLE: 'middle',
    ALIGN_BOTTOM: 'bottom',
  }),
  mxUtils: sobj({
    bind: hostFn('mxUtils.bind', (_t, a, it) => hostFn('bound', (_t2, b) => it.call(a[1], a[0], b))),
    setStyle: hostFn('mxUtils.setStyle', (_t, a) => setStyle(a[0] == null ? null : toStr(a[0]), toStr(a[1]), a[2] == null ? null : toStr(a[2]))),
    indexOf: hostFn('mxUtils.indexOf', (_t, a) => (Array.isArray(a[0]) ? a[0].indexOf(a[1]) : -1)),
    createXmlDocument: hostFn('mxUtils.createXmlDocument', () => xmlDoc()),
  }),
  Editor: sobj({ defaultTextStyle: 'text;html=1;whiteSpace=wrap;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;rounded=0;' }),
  Graph: sobj({ decompress: hostFn('Graph.decompress', (_t, a) => decompress(toStr(a[0]))) }),
  // updateEntries titles 'AWS <year>' with the current year; fixed to the release year for stable output
  Date: hostFn('Date', () => 'Date', () => sobj({ getFullYear: hostFn('getFullYear', () => 2026) })),
  GRAPH_IMAGE_PATH: 'img',
  STENCIL_PATH: 'stencils',
  IMAGE_PATH: 'images',
  urlParams: sobj(),
});

// grapheditor Sidebar.js: addGeneralPalette .. addUmlPalette (line numbers are kept)
const geText = readSource(F.geSidebar);
const geStart = findLine(geText, 'Sidebar.prototype.addGeneralPalette = function');
const umlStart = findLine(geText, 'Sidebar.prototype.addUmlPalette = function');
const geEnd = findLine(geText, /^Sidebar\.prototype\.\w+ = function/, umlStart) - 1; // next definition (exclusive)
interp.run(geText.split('\n').slice(geStart - 1, geEnd).join('\n'), rel(F.geSidebar), geStart - 1);

// every js/diagramly/sidebar/Sidebar-*.js (they only define Sidebar.prototype.add*Palette functions)
// Skipped: Sidebar-Advanced.js only appends draw.io's live layout containers (Menus.layoutContainers,
// ELK layouts run on drop), which this app does not implement.
const SKIPPED_SIDEBAR_FILES = new Set(['Sidebar-Advanced.js']);
const SIDEBAR_FILES = listSources(WEBAPP + 'js/diagramly/sidebar/')
  .filter((f) => /\/Sidebar-[\w]+\.js$/.test(f) && !SKIPPED_SIDEBAR_FILES.has(path.basename(f))).sort();
for (const f of SIDEBAR_FILES) interp.run(readSource(f), rel(f));

// diagramly Sidebar.js: the data members (library lists, configuration) and initPalettes/updateEntries
const dyText = readSource(F.dySidebar);
const dySrc = ts.createSourceFile('Sidebar.js', dyText, ts.ScriptTarget.ES2020, true, ts.ScriptKind.JS);
const KEEP_FNS = new Set(['initPalettes', 'updateEntries']);
const dyStatements: ts.Statement[] = [];
dySrc.forEachChild(function visit(n): void {
  if (ts.isExpressionStatement(n) && ts.isBinaryExpression(n.expression) &&
    n.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    /^Sidebar\.prototype\.\w+$/.test(n.expression.left.getText(dySrc))) {
    const name = n.expression.left.getText(dySrc).split('.')[2];
    const isFnValue = ts.isFunctionExpression(n.expression.right);
    if (!isFnValue ? name !== 'tagIndex' && name !== 'searchIndexData' : KEEP_FNS.has(name)) dyStatements.push(n);
    return;
  }
  n.forEachChild(visit);
});
for (const st of dyStatements) {
  const line = dySrc.getLineAndCharacterOfPosition(st.getStart(dySrc)).line;
  interp.run(st.getText(dySrc), rel(F.dySidebar), line);
}

// Palette functions: remember which add*Palette function created a palette (for `source`)
for (const key of Object.keys(P)) {
  const fn = P[key];
  if (!/^add\w*Palette$/.test(key) || fn instanceof HostFn) continue;
  P[key] = hostFn(key, (t, a, it) => {
    const outer = currentPaletteFn;
    const site = (fn as { node: ts.Node }).node;
    const sf = site.getSourceFile();
    if (outer == null) currentPaletteFn = `${(fn as unknown as { file: string }).file}:${sf.getLineAndCharacterOfPosition(site.getStart(sf)).line + 1}`;
    try { return it.call(fn, t, a); } finally { currentPaletteFn = outer; }
  });
}
const sidebar = interp.construct(Sidebar, []) as SObj;
interp.call(P.initPalettes, sidebar, []);
interp.call(P.updateEntries, sidebar, []);

// ---------- classification ----------
function classifyShape(name: string): Cls | '?' {
  if (JS_SHAPES.has(name)) return 'c';
  if (STENCIL_NAMES.has(name.toLowerCase())) return 'b';
  if (CORE_SHAPES.has(name)) return 'a';
  return '?';
}
function cellStylesInXml(xml: string): Array<{ style: string; edge: boolean }> {
  const out: Array<{ style: string; edge: boolean }> = [];
  const re = /<mxCell\b([^>]*?)\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const style = /\bstyle="([^"]*)"/.exec(m[1]);
    if (style) out.push({ style: unescapeXml(style[1]), edge: /\bedge="1"/.test(m[1]) });
  }
  return out;
}
function classifyEntry(e: RawEntry): { cls: Cls; shapeNames: string[]; unknown: string[] } {
  const styles = e.kind === 'cells' ? cellStylesInXml(e.xml ?? '') : [{ style: e.style ?? '', edge: e.kind === 'edge' }];
  const shapeNames: string[] = [];
  const unknown: string[] = [];
  for (const s of styles) {
    for (const n of shapeNamesOf(s.style)) {
      if (!shapeNames.includes(n)) shapeNames.push(n);
      if (classifyShape(n) === '?' && !n.startsWith('stencil(')) unknown.push(n);
    }
  }
  if (e.kind !== 'vertex') return { cls: 'd', shapeNames, unknown };
  const { names, kv } = parseStyle(e.style);
  const shape = shapeNames[0] ?? (names.includes('text') ? 'text' : 'rectangle');
  if (shape === 'text') return { cls: 'd', shapeNames, unknown };
  if (shape.startsWith('stencil(')) return { cls: 'b', shapeNames, unknown };
  const c = classifyShape(shape);
  if (c === 'c' || c === 'b') return { cls: c, shapeNames, unknown };
  // core shapes used as image/label/swimlane/container are another mechanism
  if (shape === 'image' || shape === 'label' || shape === 'swimlane' || kv.image != null) return { cls: 'd', shapeNames, unknown };
  return { cls: c === '?' ? 'd' : c, shapeNames, unknown };
}
function slug(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'entry';
}
/** File name (without .json) for a palette id: the id itself when it is a plain identifier. */
export function paletteFileName(id: string): string {
  return /^[A-Za-z0-9_-]+$/.test(id) ? id : 'p-' + slug(id);
}

/** Same images referenced by entries: `image=img/...` (vendored under public/img/). */
const IMAGE_RE = /(?:^|;)image=(img\/[^;"&=]+\.(?:svg|png|jpg|jpeg|gif))/gi;
function imagesOf(texts: string[]): string[] {
  const out: string[] = [];
  for (const t of texts) {
    IMAGE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = IMAGE_RE.exec(t))) out.push(m[1]);
  }
  return out;
}

// ---------- output ----------
const LEGACY_SOURCES: Record<string, string> = {
  general: `${rel(F.geSidebar)}:${geStart}`,
  misc: `${rel(F.geSidebar)}:${findLine(geText, 'Sidebar.prototype.addMiscPalette = function')}`,
  advanced: `${rel(F.geSidebar)}:${findLine(geText, 'Sidebar.prototype.addAdvancedPalette = function')}`,
  arrows: `${rel(F.dySidebar)}:${findLine(dyText, "this.addStencilPalette('arrows'")}`,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
const unknownAll = new Map<string, string[]>();
const undefinedStyles: string[] = [];
const summary: Record<string, Record<string, number>> = {};
const seenIds = new Set<string>();
const images = new Set<string>();
interface CatPalette { id: string; file: string; title: string; library: string; count: number; cls: Record<Cls, number>; jsShapes: string[]; stencils: string[] }
const catPalettes: CatPalette[] = [];
const search: Array<[string, string[]]> = [];
const written = new Set<string>();
for (const p of palettes) {
  if (seenIds.has(p.id)) { console.log(`duplicate palette id ${p.id} (kept the first)`); continue; }
  seenIds.add(p.id);
  const entries: OutEntry[] = p.entries.map((e, i) => {
    const c = classifyEntry(e);
    for (const u of c.unknown) {
      const list = unknownAll.get(u) ?? [];
      if (list.length < 3) list.push(`${p.id}:${e.title}`);
      unknownAll.set(u, list);
    }
    const o: OutEntry = {
      id: `${p.id}-${i}-${slug(e.title)}`,
      title: e.title,
      tags: e.tags || undefined,
      kind: e.kind,
      width: e.width,
      height: e.height,
      style: e.kind === 'cells' ? undefined : e.style,
      value: e.value != null && e.value !== '' ? e.value : undefined,
      xml: e.xml,
      shapeNames: c.shapeNames,
      cls: c.cls,
      source: e.source ?? p.source ?? LEGACY_SOURCES[p.id] ?? '',
    };
    if (/(^|;)[^;=]*=undefined(;|$)|undefined;/.test(o.style ?? '')) undefinedStyles.push(`${p.id}:${o.title}`);
    for (const img of imagesOf([o.style ?? '', o.xml ?? ''])) images.add(img);
    return o;
  });
  const counts: Record<Cls, number> = { a: 0, b: 0, c: 0, d: 0 };
  for (const e of entries) counts[e.cls]++;
  summary[p.id] = { total: entries.length, ...counts };
  const source = LEGACY_SOURCES[p.id] ?? p.source ?? '';
  const def = { id: p.id, title: p.title, drawioTag: DRAWIO_TAG, source, entries };
  const file = paletteFileName(p.id);
  if (written.has(file)) throw new Error(`palette file name clash: ${file}`);
  written.add(file);
  fs.writeFileSync(path.join(OUT_DIR, `${file}.json`), JSON.stringify(def, null, 1) + '\n');
  const shapeSet = new Set(entries.flatMap((e) => e.shapeNames));
  catPalettes.push({
    id: p.id, file, title: p.title, library: p.library ?? p.id, count: entries.length, cls: counts,
    jsShapes: [...shapeSet].filter((n) => classifyShape(n) === 'c').sort(),
    stencils: [...new Set([...shapeSet].filter((n) => classifyShape(n) === 'b').map((n) => n.split('.').slice(0, -1).join('.')))].sort(),
  });
  search.push([p.id, entries.map((e) => e.title + '\t' + (e.tags ?? ''))]);
}

// remove palette JSON files that are no longer generated
for (const f of fs.readdirSync(OUT_DIR)) {
  if (!f.endsWith('.json') || f === 'catalogue.json' || f === 'search-index.json') continue;
  if (!written.has(f.slice(0, -5))) fs.unlinkSync(path.join(OUT_DIR, f));
}

// ---------- catalogue: draw.io's "More shapes" entries + configuration ----------
const config = P.configuration as SObj[];
const moreShapes = sidebar.entries as SObj[];
const libraryOfPalette = new Map<string, string>();
for (const c of config) {
  const id = toStr(c.id);
  const libs = c.libs as unknown[] | undefined;
  if (!libs) { libraryOfPalette.set(id, id); continue; }
  for (const l of libs) {
    const pid = (c.prefix != null ? toStr(c.prefix) : '') + toStr(l);
    if (!libraryOfPalette.has(pid)) libraryOfPalette.set(pid, id);
  }
}
for (const p of catPalettes) {
  const lib = libraryOfPalette.get(p.id);
  if (lib) p.library = lib;
}
const categories = moreShapes.map((sec) => ({
  title: toStr(sec.title),
  libraries: (sec.entries as SObj[]).map((e) => ({ id: toStr(e.id), title: toStr(e.title) })),
}));
const knownLibs = new Set(categories.flatMap((c) => c.libraries.map((l) => l.id)));
const orphanLibs = [...new Set(catPalettes.map((p) => p.library))].filter((l) => !knownLibs.has(l));
const libraries = [...new Set(catPalettes.map((p) => p.library))].map((id) => {
  const ps = catPalettes.filter((p) => p.library === id);
  const title = categories.flatMap((c) => c.libraries).find((l) => l.id === id)?.title ?? ps[0].title;
  return { id, title, palettes: ps.map((p) => p.id), count: ps.reduce((n, p) => n + p.count, 0), ...libraryInfo(id) };
});
const catalogue = {
  drawioTag: DRAWIO_TAG,
  categories,
  libraries,
  palettes: catPalettes.map(({ id, file, title, library, count, jsShapes, stencils }) => ({ id, file, title, library, count, jsShapes, stencils })),
};
fs.writeFileSync(path.join(OUT_DIR, 'catalogue.json'), JSON.stringify(catalogue) + '\n');
fs.writeFileSync(path.join(OUT_DIR, 'search-index.json'), JSON.stringify({ drawioTag: DRAWIO_TAG, palettes: search }) + '\n');

// ---------- images referenced by entries -> public/img/... ----------
// every draw.io palette image (img/lib/**, clipart, ...): drawings made in draw.io may reference
// images of palettes this app does not list, so the whole set is vendored
let imageCount = 0;
const missingImages = [...images].filter((img) => !fs.existsSync(cachePath(WEBAPP + img)));
const imgSources = listSources(WEBAPP + 'img/');
// only the directories draw.io's img/ has (public/img may hold other files)
for (const dir of new Set(imgSources.map((p) => rel(p).split('/').slice(0, 2).join('/')).filter((d) => d.split('/').length === 2 && !/\./.test(d)))) {
  fs.rmSync(path.join(PUBLIC_IMG, dir), { recursive: true, force: true });
}
for (const repoPath of imgSources) {
  if (/(^|\/)LICENSE$/.test(repoPath) || !/\.(svg|png|jpe?g|gif)$/i.test(repoPath)) continue;
  const dest = path.join(PUBLIC_IMG, rel(repoPath));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(cachePath(repoPath), dest);
  imageCount++;
}

// ---------- third_party/drawio-libraries: one notice per vendor icon set ----------
const NOTICE_DIR = path.join(REPO_ROOT, 'third_party', 'drawio-libraries');
fs.mkdirSync(NOTICE_DIR, { recursive: true });
const libSources = new Map<string, Set<string>>();
for (const p of palettes) {
  const lib = libraryOfPalette.get(p.id) ?? p.library ?? p.id;
  const set = libSources.get(lib) ?? new Set<string>();
  for (const e of p.entries) {
    for (const img of imagesOf([e.style ?? '', e.xml ?? ''])) set.add(img.split('/').slice(0, 3).join('/') + '/');
    const styles = e.kind === 'cells' ? cellStylesInXml(e.xml ?? '').map((x) => x.style) : [e.style ?? ''];
    for (const st of styles) for (const n of shapeNamesOf(st)) {
      const parts = n.split('.');
      if (parts[0] !== 'mxgraph' || parts.length < 3) continue;
      if (classifyShape(n) === 'b') set.add(`stencils/${parts.slice(1, -1).join('/')}.xml`);
      else if (JS_SHAPES.has(n)) set.add((JS_SHAPES.get(n) as string).split(':')[0]);
    }
  }
  libSources.set(lib, set);
}
const noticeIndex: string[] = [];
for (const v of VENDORS) {
  const libs = libraries.filter((l) => v.libraries.includes(l.id));
  if (libs.length === 0) throw new Error(`vendor ${v.name}: no library ${v.libraries.join(', ')}`);
  const sources = [...new Set(libs.flatMap((l) => [...(libSources.get(l.id) ?? [])]))].sort();
  const lines = [
    `# ${v.name}: draw.io icon libraries`,
    '',
    `Libraries (Shapes tab > More shapes…): ${libs.map((l) => `${l.title} (\`${l.id}\`, ${l.count} shapes)`).join(', ')}.`,
    '',
    v.attribution,
    '',
    `Vendored unmodified from jgraph/drawio ${DRAWIO_TAG} (commit ${DRAWIO_COMMIT}), src/main/webapp/:`,
    '',
    ...sources.map((x) => `- \`${x}\``),
    '',
    'These icons are third-party artwork that draw.io redistributes. draw.io\'s README states: "Some icons are',
    'originally defined by third-party copyright holders; we have verified that all original licenses permit use',
    'in this project." The vendor\'s own terms for its icons apply to their use (typically: depict the vendor\'s',
    `products in diagrams, do not alter the icons)${v.terms ? `; see ${v.terms}` : ''}. Railway Drawer does not`,
    'modify or recolour them (dark mode keeps their colours) and claims no rights in them; all trademarks belong',
    'to their owners. draw.io\'s terms for its icon sets and stencil libraries apply as well (public/stencils/LICENSE:',
    'no use as software assets in, or distribution for use with, Atlassian products or the Atlassian marketplace',
    'without written permission; diagrams created with them are not restricted).',
    '',
  ];
  fs.writeFileSync(path.join(NOTICE_DIR, v.file), lines.join('\n'));
  noticeIndex.push(`| [${v.name}](${v.file}) | ${libs.map((l) => l.title).join(', ')} |`);
}
fs.writeFileSync(path.join(NOTICE_DIR, 'README.md'), [
  '# Vendor icon sets in the draw.io libraries',
  '',
  `Generated by scripts/drawio-palettes/extract-palettes.ts from scripts/drawio-palettes/libraries.ts (draw.io ${DRAWIO_TAG}).`,
  'The other libraries are draw.io\'s own shapes and stencils (Apache-2.0 code, see ../drawio/; stencil terms in',
  'public/stencils/LICENSE). No library was skipped: draw.io marks none of these sets as non-redistributable.',
  '',
  '| Vendor | Libraries |',
  '| --- | --- |',
  ...noticeIndex,
  '',
].join('\n'));

fs.writeFileSync(path.join(OUT_DIR, '..', 'used-stencils.json'), JSON.stringify([...usedStencilFiles].sort()) + '\n');
console.log(`palettes: ${catPalettes.length}, entries: ${catPalettes.reduce((n, p) => n + p.count, 0)}, libraries: ${libraries.length}, images: ${imageCount}`);
console.log(JSON.stringify(summary));
if (orphanLibs.length) console.log('libraries not in More shapes:', orphanLibs.join(', '));
if (missingImages.length) console.log('missing images:', missingImages.length, missingImages.slice(0, 20));
if (undefinedStyles.length) console.log('styles with undefined:', undefinedStyles.slice(0, 20));
if (unknownAll.size) console.log('unclassified shape names:', JSON.stringify([...unknownAll].slice(0, 200)));
