/**
 * Extracts the draw.io sidebar palettes General, Misc, Advanced, Basic, Arrows (arrows2),
 * legacy Arrows (stencils/arrows.xml) and Flowchart, pinned to the tag in fetch-sources.ts,
 * into src/drawio-shapes/palettes/data/<id>.json (schema: src/drawio-shapes/palettes/types.ts).
 *
 * Usage (after fetch-sources.ts and decode-stencils-bundle.ts):
 *   node scripts/drawio-palettes/extract-palettes.ts
 *
 * How: the real palette functions (Sidebar.prototype.addGeneralPalette & co. from
 * js/grapheditor/Sidebar.js and js/diagramly/sidebar/Sidebar-*.js) run unmodified inside a
 * node:vm sandbox against a stub Sidebar whose createVertexTemplateEntry/createEdgeTemplateEntry/
 * addEntry/addDataEntry/addStencilPalette record entries instead of building DOM. Entry order,
 * titles, sizes, styles and values are therefore exactly draw.io's. Compressed data entries are
 * inflated (Graph.decompress semantics) into `xml`; composite cell entries are serialized to
 * mxGraphModel XML in mxCodec form. Classification:
 *   a = maxGraph core shape (@maxgraph/core 0.10.3 register-shapes.js),
 *   b = draw.io stencil (vendored public/stencils/*.xml),
 *   c = JS shape (js/grapheditor/Shapes.js or shapes/mx*.js mxCellRenderer.registerShape),
 *   d = other mechanism (edge, text, image, swimlane/container, composite cells, data).
 * A JS shape wins over a stencil of the same name, as in draw.io's mxStencilRegistry.getStencil.
 *
 * Portions derived from jgraph/drawio v32.4.1 (Apache-2.0),
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';
import * as zlib from 'node:zlib';
import { DRAWIO_TAG, REPO_ROOT, WEBAPP, readSource } from './fetch-sources.ts';

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
const STENCIL_DIR = path.join(REPO_ROOT, 'public', 'stencils');
const SANDBOX_PREFIX = 'drawio:';

// ---------- sources ----------
const F = {
  geSidebar: WEBAPP + 'js/grapheditor/Sidebar.js',
  dySidebar: WEBAPP + 'js/diagramly/sidebar/Sidebar.js',
  basic: WEBAPP + 'js/diagramly/sidebar/Sidebar-Basic.js',
  arrows2: WEBAPP + 'js/diagramly/sidebar/Sidebar-Arrows2.js',
  flowchart: WEBAPP + 'js/diagramly/sidebar/Sidebar-Flowchart.js',
};
const rel = (repoPath: string): string => repoPath.startsWith(WEBAPP) ? repoPath.slice(WEBAPP.length) : repoPath;

function findLine(text: string, needle: string | RegExp, from = 0): number {
  const lines = text.split('\n');
  for (let i = from; i < lines.length; i++) {
    if (typeof needle === 'string' ? lines[i].includes(needle) : needle.test(lines[i])) return i + 1;
  }
  throw new Error(`not found: ${String(needle)}`);
}

// ---------- vendored stencil sets ----------
interface StencilInfo { pkg: string; stencilName: string; w: number; h: number }
function readStencilSet(file: string): StencilInfo[] {
  const xml = fs.readFileSync(path.join(STENCIL_DIR, file), 'utf8');
  const rootName = /^<shapes\b[^>]*\bname="([^"]*)"/.exec(xml)?.[1] ?? '';
  const pkg = rootName ? rootName.toLowerCase() + '.' : '';
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
const STENCIL_SETS: Record<string, StencilInfo[]> = {};
for (const f of ['basic.xml', 'flowchart.xml', 'arrows.xml', 'mscae/enterprise.xml']) STENCIL_SETS[f] = readStencilSet(f);
const STENCIL_NAMES = new Set<string>();
for (const f in STENCIL_SETS) for (const s of STENCIL_SETS[f]) STENCIL_NAMES.add(s.pkg + s.stencilName.toLowerCase());

// ---------- JS shapes registered by draw.io ----------
const JS_SHAPES = new Map<string, string>(); // name -> file:line
function scanShapes(repoPath: string): void {
  const txt = readSource(repoPath);
  const lines = txt.split('\n');
  const cst: Record<string, string> = {};
  const re = /(\w+)\.prototype\.cst\s*=\s*\{([\s\S]*?)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(txt))) {
    const re2 = /(\w+)\s*:\s*'([^']+)'/g;
    let k: RegExpExecArray | null;
    while ((k = re2.exec(m[2]))) cst[m[1] + '.' + k[1]] = k[2];
  }
  lines.forEach((l, i) => {
    const r = /mxCellRenderer\.registerShape\(\s*([^,]+?)\s*,/.exec(l);
    if (!r) return;
    let name: string | undefined = r[1];
    if (/^'.*'$/.test(name)) name = name.slice(1, -1);
    else {
      const c = /(\w+)\.prototype\.cst\.(\w+)/.exec(name);
      name = c ? cst[c[1] + '.' + c[2]] : undefined;
    }
    if (name) JS_SHAPES.set(name, `${rel(repoPath)}:${i + 1}`);
  });
}
for (const f of ['js/grapheditor/Shapes.js', 'shapes/mxBasic.js', 'shapes/mxArrows.js', 'shapes/mxFlowchart.js']) scanShapes(WEBAPP + f);

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

/** Graph.decompress: base64 -> inflateRaw -> bytes as latin1 string -> decodeURIComponent. */
function decompress(data: string): string {
  const raw = zlib.inflateRawSync(Buffer.from(data, 'base64'), { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString('latin1');
  return decodeURIComponent(raw);
}

// ---------- mxGraph stubs used by the palette code ----------
class MxPoint { x: number; y: number; constructor(x = 0, y = 0) { this.x = x; this.y = y; } }
class MxGeometry {
  x: number; y: number; width: number; height: number; relative = false;
  points: MxPoint[] | null = null; sourcePoint: MxPoint | null = null; targetPoint: MxPoint | null = null; offset: MxPoint | null = null;
  constructor(x = 0, y = 0, w = 0, h = 0) { this.x = x; this.y = y; this.width = w; this.height = h; }
  setTerminalPoint(p: MxPoint, isSource: boolean): void { if (isSource) this.sourcePoint = p; else this.targetPoint = p; }
  clone(): MxGeometry {
    const g = new MxGeometry(this.x, this.y, this.width, this.height);
    g.relative = this.relative;
    const cp = (p: MxPoint | null): MxPoint | null => (p ? new MxPoint(p.x, p.y) : null);
    g.sourcePoint = cp(this.sourcePoint); g.targetPoint = cp(this.targetPoint); g.offset = cp(this.offset);
    g.points = this.points ? this.points.map((p) => new MxPoint(p.x, p.y)) : null;
    return g;
  }
}
class MxCell {
  value: unknown; geometry: MxGeometry | null; style: string | null;
  vertex = false; edge = false; connectable = true; children: MxCell[] = [];
  attrs: Array<[string, string]> | null = null;
  constructor(value?: unknown, geometry?: MxGeometry, style?: string) {
    this.value = value; this.geometry = geometry ?? null; this.style = style ?? null;
  }
  insert(c: MxCell): void { this.children.push(c); }
  setConnectable(v: boolean): void { this.connectable = v; }
  clone(): MxCell {
    const c = new MxCell(this.value, this.geometry ? this.geometry.clone() : undefined, this.style ?? undefined);
    c.vertex = this.vertex; c.edge = this.edge; c.connectable = this.connectable;
    c.attrs = this.attrs ? this.attrs.map(([k, v]) => [k, v] as [string, string]) : null;
    c.children = this.children.map((x) => x.clone());
    return c;
  }
}
function setCellAttr(cell: MxCell, key: string, value: string): void {
  // Graph.setAttributeForCell: converts the value to a <UserObject label="..."> element
  if (cell.attrs == null) cell.attrs = [['label', cell.value == null ? '' : String(cell.value)]];
  const i = cell.attrs.findIndex(([k]) => k === key);
  if (i >= 0) cell.attrs[i] = [key, value]; else cell.attrs.push([key, value]);
}

/** Serializes cells as mxCodec would (default 0/false values omitted) inside an mxGraphModel. */
function cellsToModelXml(cells: MxCell[]): string {
  let nextId = 2;
  const pt = (p: MxPoint, as?: string): string => {
    let a = '';
    if (p.x !== 0) a += ` x="${p.x}"`;
    if (p.y !== 0) a += ` y="${p.y}"`;
    if (as) a += ` as="${as}"`;
    return `<mxPoint${a}/>`;
  };
  const geo = (g: MxGeometry): string => {
    let a = '';
    if (g.x !== 0) a += ` x="${g.x}"`;
    if (g.y !== 0) a += ` y="${g.y}"`;
    if (g.width !== 0) a += ` width="${g.width}"`;
    if (g.height !== 0) a += ` height="${g.height}"`;
    if (g.relative) a += ' relative="1"';
    a += ' as="geometry"';
    let inner = '';
    if (g.sourcePoint) inner += pt(g.sourcePoint, 'sourcePoint');
    if (g.targetPoint) inner += pt(g.targetPoint, 'targetPoint');
    if (g.points && g.points.length) inner += `<Array as="points">${g.points.map((p) => pt(p)).join('')}</Array>`;
    if (g.offset) inner += pt(g.offset, 'offset');
    return inner ? `<mxGeometry${a}>${inner}</mxGeometry>` : `<mxGeometry${a}/>`;
  };
  const enc = (c: MxCell, parent: string): string => {
    const id = String(nextId++);
    let cellAttrs = '';
    if (c.attrs == null) cellAttrs += ` id="${id}" value="${escapeXml(c.value == null ? '' : String(c.value))}"`;
    if (c.style != null) cellAttrs += ` style="${escapeXml(c.style)}"`;
    if (c.vertex) cellAttrs += ' vertex="1"';
    if (c.edge) cellAttrs += ' edge="1"';
    if (!c.connectable) cellAttrs += ' connectable="0"';
    cellAttrs += ` parent="${parent}"`;
    const cellXml = `<mxCell${cellAttrs}>${c.geometry ? geo(c.geometry) : ''}</mxCell>`;
    const own = c.attrs == null
      ? cellXml
      : `<UserObject${c.attrs.map(([k, v]) => ` ${k}="${escapeXml(v)}"`).join('')} id="${id}">${cellXml}</UserObject>`;
    return own + c.children.map((ch) => enc(ch, id)).join('');
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
type Thunk = (() => Thunk) & { entry: RawEntry };
const mk = (e: RawEntry): Thunk => { const f = (() => f) as Thunk; f.entry = e; return f; };
const asEntry = (x: unknown): RawEntry => (typeof x === 'function' ? (x as Thunk).entry : (x as RawEntry));

function callerSource(): string | null {
  const stack = new Error().stack?.split('\n') ?? [];
  for (const l of stack) {
    const m = new RegExp(SANDBOX_PREFIX + '([^:()]+):(\\d+):\\d+').exec(l);
    if (m) return `${m[1]}:${m[2]}`;
  }
  return null;
}
function filterTags(tags: string | null): string | null {
  if (tags == null) return null;
  const seen: Record<string, 1> = {};
  const r: string[] = [];
  for (const t of tags.split(' ')) if (!seen[t]) { seen[t] = 1; r.push(t); }
  return r.join(' ');
}

interface RawPalette { id: string; title: string; entries: RawEntry[] }
const palettes: RawPalette[] = [];

const graphStub = {
  vertexFontSize: null, edgeFontSize: null,
  appendFontSize(style: string | null, fs: number | null): string {
    let s = style != null ? style : '';
    if (fs != null) { if (s.length > 0 && s.charAt(s.length - 1) !== ';') s += ';'; s += 'fontSize=' + fs + ';'; }
    return s;
  },
  setLinkForCell(c: MxCell, link: string): void { setCellAttr(c, 'link', link); },
  setAttributeForCell(c: MxCell, k: string, v: string): void { setCellAttr(c, k, v); },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Sidebar = function Sidebar(this: any) { /* stub */ } as unknown as { prototype: Record<string, any>; new(): any };
const P = Sidebar.prototype;
P.editorUi = { editor: { graph: graphStub } };
P.graph = graphStub;
P.initialDefaultVertexStyle = {};
P.gearImage = 'img/clipart/Gear_128x128.png';
P.setCurrentSearchEntryLibrary = function () { /* search index not needed */ };
P.filterTags = filterTags;
P.getTagsForStencil = function (pkgName: string, stencilName: string, more?: string): string[] {
  const tags = pkgName.split('.');
  for (let i = 1; i < tags.length; i++) tags[i] = tags[i].replace(/_/g, ' ');
  tags.push(stencilName.replace(/_/g, ' '));
  if (more != null) tags.push(more);
  return tags.slice(1);
};
P.cloneCell = function (cell: MxCell, value?: unknown): MxCell { const c = cell.clone(); if (value != null) c.value = value; return c; };
P.createVertexTemplateEntry = function (style: string, width: number, height: number, value: unknown, title: string,
  _showLabel?: unknown, _showTitle?: unknown, tags?: string | null): Thunk {
  let t = tags;
  if (t != null && title != null) t += ' ' + title;
  t = t != null && t.length > 0 ? t : title != null ? title.toLowerCase() : '';
  return mk({ kind: 'vertex', style, width, height, value: value == null ? undefined : String(value), title, tags: t, source: callerSource() });
};
P.createEdgeTemplateEntry = function (style: string, width: number, height: number, value: unknown, title: string,
  _showLabel?: unknown, tags?: string | null): Thunk {
  const t = tags != null && tags.length > 0 ? tags : title.toLowerCase();
  return mk({ kind: 'edge', style, width, height, value: value == null ? undefined : String(value), title, tags: t, source: callerSource() });
};
P.createVertexTemplateFromCells = function (cells: MxCell[], width: number, height: number, title: string): RawEntry {
  return { kind: 'cells', xml: cellsToModelXml(cells), width, height, title, source: null };
};
P.createEdgeTemplateFromCells = P.createVertexTemplateFromCells;
P.createVertexTemplateFromData = function (data: string, width: number, height: number, title: string): RawEntry {
  return { kind: 'cells', xml: decompress(data), width, height, title, source: null };
};
P.addEntry = function (tags: string, fn: () => RawEntry): RawEntry {
  const source = callerSource();
  return Object.assign(fn(), { tags, source });
};
P.addDataEntry = function (tags: string | null, width: number, height: number, title: string, data: string): RawEntry {
  const source = callerSource();
  let t = tags == null ? '' : tags;
  if (title != null) t += ' ' + title;
  return Object.assign(this.createVertexTemplateFromData(data, width, height, title) as RawEntry, { tags: t, source });
};
P.addPaletteFunctions = function (id: string, title: string, _expanded: boolean, fns: unknown[]): void {
  palettes.push({ id, title, entries: fns.map(asEntry) });
};
P.addPalette = function (id: string, title: string, _expanded: boolean, onInit: (content: { appendChild(x: unknown): void }) => void): void {
  const entries: RawEntry[] = [];
  onInit.call(this, { appendChild: (x: unknown) => { entries.push(asEntry(x)); } });
  palettes.push({ id, title, entries });
};
P.addStencilPalette = function (id: string, title: string, stencilFile: string, style: string | null, ignore: string[] | null,
  _onInit: unknown, scale: number | null, tags: Record<string, string> | null, customFns: unknown[] | null): void {
  const sc = scale != null ? scale : 1;
  const source = callerSource();
  const entries: RawEntry[] = (customFns || []).map(asEntry);
  const set = STENCIL_SETS[path.basename(stencilFile)];
  if (!set) throw new Error(`stencil set not vendored: ${stencilFile}`);
  for (const s of set) {
    if (ignore != null && ignore.indexOf(s.stencilName) >= 0) continue;
    const tmp = this.getTagsForStencil(s.pkg, s.stencilName) as string[];
    const extra = tags != null ? tags[s.stencilName] : null;
    if (extra != null) tmp.push(extra);
    const e = asEntry(this.createVertexTemplateEntry('shape=' + s.pkg + s.stencilName.toLowerCase() + (style ?? ''),
      Math.round(s.w * sc), Math.round(s.h * sc), '', s.stencilName.replace(/_/g, ' '), null, null, filterTags(tmp.join(' '))));
    e.source = source;
    entries.push(e);
  }
  palettes.push({ id, title, entries });
};

const RESOURCES: Record<string, string> = { general: 'General', misc: 'Misc', advanced: 'Advanced', basic: 'Basic',
  arrows: 'Arrows', flowchart: 'Flowchart', note: 'Note' };
const ctx = vm.createContext({
  Sidebar, mxCell: MxCell, mxGeometry: MxGeometry, mxPoint: MxPoint,
  mxResources: { get: (k: string) => RESOURCES[k] ?? k },
  mxConstants: { STYLE_VERTICAL_LABEL_POSITION: 'verticalLabelPosition', STYLE_VERTICAL_ALIGN: 'verticalAlign', STYLE_STROKEWIDTH: 'strokeWidth' },
  mxUtils: { bind: (s: unknown, f: (...a: unknown[]) => unknown) => f.bind(s), setStyle, indexOf: (a: unknown[], x: unknown) => a.indexOf(x) },
  Editor: { defaultTextStyle: 'text;html=1;whiteSpace=wrap;strokeColor=none;fillColor=none;align=center;verticalAlign=middle;rounded=0;' },
  console,
});
Error.stackTraceLimit = 50;

// grapheditor Sidebar.js: run only addGeneralPalette .. createAdvancedShapes (line numbers are kept)
const geText = readSource(F.geSidebar);
const geStart = findLine(geText, 'Sidebar.prototype.addGeneralPalette = function');
const advStart = findLine(geText, 'Sidebar.prototype.createAdvancedShapes = function');
const geEnd = findLine(geText, /^Sidebar\.prototype\.\w+ = function/, advStart) - 1; // next definition (exclusive)
const geLines = geText.split('\n');
vm.runInContext('\n'.repeat(geStart - 1) + geLines.slice(geStart - 1, geEnd).join('\n'), ctx, { filename: SANDBOX_PREFIX + rel(F.geSidebar) });
for (const f of [F.basic, F.arrows2, F.flowchart]) vm.runInContext(readSource(f), ctx, { filename: SANDBOX_PREFIX + rel(f) });

// Legacy Arrows stencil palette: the call in diagramly Sidebar.init, evaluated with its own line numbers
const dyText = readSource(F.dySidebar);
const arrowsLine = findLine(dyText, "this.addStencilPalette('arrows'");
const dyLines = dyText.split('\n');
let arrowsEnd = arrowsLine - 1;
while (!/\);\s*$/.test(dyLines[arrowsEnd])) arrowsEnd++;
const arrowsCall = dyLines.slice(arrowsLine - 1, arrowsEnd + 1).join('\n');

// Same order as Sidebar.init in js/diagramly/sidebar/Sidebar.js
const initLine = findLine(dyText, 'this.addGeneralPalette(');
vm.runInContext(
  '\n'.repeat(initLine - 1) + '(function(){ var dir = "stencils";\n' +
  'this.addGeneralPalette(true); this.addMiscPalette(false); this.addAdvancedPalette(false); this.addBasicPalette();\n' +
  '}).call(new Sidebar());',
  ctx, { filename: SANDBOX_PREFIX + 'init' });
vm.runInContext('\n'.repeat(arrowsLine - 1) + '(function(){ var dir = "stencils"; ' + arrowsCall + ' }).call(new Sidebar());',
  ctx, { filename: SANDBOX_PREFIX + rel(F.dySidebar) });
vm.runInContext('(function(){ this.addArrows2Palette(); this.addFlowchartPalette(); }).call(new Sidebar());', ctx, { filename: SANDBOX_PREFIX + 'init' });

// ---------- classification & output ----------
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
      if (classifyShape(n) === '?') unknown.push(n);
    }
  }
  if (e.kind !== 'vertex') return { cls: 'd', shapeNames, unknown };
  const { names, kv } = parseStyle(e.style);
  const shape = shapeNames[0] ?? (names.includes('text') ? 'text' : 'rectangle');
  if (shape === 'text') return { cls: 'd', shapeNames, unknown };
  const c = classifyShape(shape);
  if (c === 'c' || c === 'b') return { cls: c, shapeNames, unknown };
  // core shapes used as image/label/swimlane/container are another mechanism
  if (shape === 'image' || shape === 'label' || shape === 'swimlane' || kv.image != null) return { cls: 'd', shapeNames, unknown };
  return { cls: c === '?' ? 'd' : c, shapeNames, unknown };
}
function slug(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'entry';
}

const PALETTE_SOURCES: Record<string, string> = {
  general: `${rel(F.geSidebar)}:${geStart}`,
  misc: `${rel(F.geSidebar)}:${findLine(geText, 'Sidebar.prototype.addMiscPalette = function')}`,
  advanced: `${rel(F.geSidebar)}:${findLine(geText, 'Sidebar.prototype.addAdvancedPalette = function')}`,
  basic: `${rel(F.basic)}:${findLine(readSource(F.basic), 'Sidebar.prototype.addBasicPalette = function')}`,
  arrows: `${rel(F.dySidebar)}:${arrowsLine}`,
  arrows2: `${rel(F.arrows2)}:${findLine(readSource(F.arrows2), 'Sidebar.prototype.addArrows2Palette = function')}`,
  flowchart: `${rel(F.flowchart)}:${findLine(readSource(F.flowchart), 'Sidebar.prototype.addFlowchartPalette = function')}`,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
const unknownAll: string[] = [];
const summary: Record<string, Record<string, number>> = {};
for (const p of palettes) {
  if (!(p.id in PALETTE_SOURCES)) continue;
  const entries: OutEntry[] = p.entries.map((e, i) => {
    const c = classifyEntry(e);
    for (const u of c.unknown) unknownAll.push(`${p.id}:${e.title}:${u}`);
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
      source: e.source ?? PALETTE_SOURCES[p.id],
    };
    return o;
  });
  const counts: Record<string, number> = { total: entries.length, a: 0, b: 0, c: 0, d: 0 };
  for (const e of entries) counts[e.cls]++;
  summary[p.id] = counts;
  const def = { id: p.id, title: p.title, drawioTag: DRAWIO_TAG, source: PALETTE_SOURCES[p.id], entries };
  fs.writeFileSync(path.join(OUT_DIR, `${p.id}.json`), JSON.stringify(def, null, 1) + '\n');
}
console.log(JSON.stringify(summary));
if (unknownAll.length) console.log('unclassified shape names:', unknownAll);
