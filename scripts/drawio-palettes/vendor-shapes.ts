/**
 * Vendors draw.io's JS shape libraries (shapes/**.js, plus the Shapes.js shapes the hand port in
 * src/drawio-shapes/js/shapes-core does not cover) as lazily loaded ES modules under
 * src/drawio-shapes/vendor/ (one module per upstream file), pinned to the tag in fetch-sources.ts.
 *
 * Usage (after fetch-sources.ts): node scripts/drawio-palettes/vendor-shapes.ts
 *
 * The upstream code is copied verbatim (it is parsed here, never executed) into
 *   export default function install(mx) { var mxShape = mx.mxShape, ...; <upstream code> }
 * where `mx` is the mxGraph compatibility layer of src/drawio-shapes/vendor-runtime/mx-shim.ts
 * (mxShape, mxActor, mxUtils, mxConstants, mxCellRenderer, Graph.handleFactory, ... mapped onto
 * @maxgraph/core 0.10.3). The free identifiers of each file are checked against the shim (an
 * unknown global fails the run), and identifiers the sloppy-mode code assigns without declaring
 * become module-local `var`s (ES modules are strict). Also writes vendor/index.json: module ->
 * registered shape names, handle factories, stencil libraries (Editor.js
 * mxStencilRegistry.libraries) and the mxConstants values the modules use (mx-constants.json).
 *
 * Portions derived from jgraph/drawio v32.4.1 (Apache-2.0),
 * Copyright (c) 2006-2025, JGraph Holdings Ltd / draw.io AG.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';
import { DRAWIO_COMMIT, DRAWIO_TAG, REPO_ROOT, WEBAPP, listSources, readSource } from './fetch-sources.ts';
import { Interpreter, hostFn, sobj, type SObj } from './safe-js.ts';

const OUT_DIR = path.join(REPO_ROOT, 'src', 'drawio-shapes', 'vendor');
/** Hand-ported files (src/drawio-shapes/js/mx-libs), never vendored. */
const PORTED = new Set(['shapes/mxBasic.js', 'shapes/mxArrows.js', 'shapes/mxFlowchart.js']);
const rel = (p: string): string => (p.startsWith(WEBAPP) ? p.slice(WEBAPP.length) : p);

/** Globals the shim provides (src/drawio-shapes/vendor-runtime/mx-shim.ts). */
export const SHIM_GLOBALS = [
  'mxShape', 'mxActor', 'mxCylinder', 'mxRectangleShape', 'mxEllipse', 'mxRhombus', 'mxTriangle', 'mxHexagon',
  'mxCloud', 'mxLine', 'mxImageShape', 'mxLabel', 'mxSwimlane', 'mxArrow', 'mxArrowConnector', 'mxConnector',
  'mxPolyline', 'mxDoubleEllipse', 'mxText', 'mxMarker', 'mxPoint', 'mxRectangle', 'mxConnectionConstraint',
  'mxPerimeter', 'mxStyleRegistry', 'mxStencilRegistry', 'mxCellRenderer', 'mxUtils', 'mxConstants', 'mxResources',
  'mxEvent', 'mxClient', 'mxEdgeStyle', 'Graph', 'Editor', 'mxGraph', 'mxStencil', 'GRAPH_IMAGE_PATH',
] as const;
/** Browser / language globals the upstream code may use as is. */
const BUILTINS = new Set(['Math', 'parseFloat', 'parseInt', 'isNaN', 'isFinite', 'String', 'Number', 'Array', 'Object',
  'Boolean', 'JSON', 'Date', 'RegExp', 'Error', 'Infinity', 'NaN', 'undefined', 'arguments', 'encodeURIComponent',
  'decodeURIComponent', 'console', 'document', 'window', 'navigator', 'this', 'null', 'true', 'false']);

// ---------- static analysis ----------
interface Analysis { free: Set<string>; implicit: Set<string>; members: Map<string, Set<string>> }

function analyze(nodes: readonly ts.Node[]): Analysis {
  const declared = new Set<string>();
  const referenced = new Set<string>();
  const assigned = new Set<string>();
  const members = new Map<string, Set<string>>();
  const declName = (n: ts.BindingName | undefined): void => { if (n && ts.isIdentifier(n)) declared.add(n.text); };
  const visit = (n: ts.Node): void => {
    if (ts.isVariableDeclaration(n) || ts.isParameter(n)) declName(n.name);
    if ((ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isClassDeclaration(n)) && n.name) declared.add(n.name.text);
    if (ts.isIdentifier(n)) {
      const p = n.parent;
      const isName = (ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isPropertyAssignment(p) && p.name === n) ||
        (ts.isMethodDeclaration(p) && p.name === n) || ts.isLabeledStatement(p) || ts.isBreakOrContinueStatement(p) ||
        ((ts.isVariableDeclaration(p) || ts.isParameter(p) || ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p)) && p.name === n);
      if (!isName) {
        referenced.add(n.text);
        if (ts.isPropertyAccessExpression(p) && p.expression === n) {
          let m = p.name.text;
          if (ts.isPropertyAccessExpression(p.parent) && p.parent.expression === p) m += '.' + p.parent.name.text;
          const set = members.get(n.text) ?? new Set<string>();
          set.add(m);
          members.set(n.text, set);
        }
        if (ts.isBinaryExpression(p) && p.left === n && p.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
          p.operatorToken.kind <= ts.SyntaxKind.LastAssignment) assigned.add(n.text);
        if ((ts.isPrefixUnaryExpression(p) || ts.isPostfixUnaryExpression(p)) &&
          (p.operator === ts.SyntaxKind.PlusPlusToken || p.operator === ts.SyntaxKind.MinusMinusToken)) assigned.add(n.text);
        if (ts.isForInStatement(p) && p.initializer === n) assigned.add(n.text);
      }
    }
    ts.forEachChild(n, visit);
  };
  nodes.forEach(visit);
  const free = new Set([...referenced].filter((x) => !declared.has(x)));
  const implicit = new Set([...assigned].filter((x) => !declared.has(x)));
  return { free, implicit, members };
}

function parse(file: string, text: string): ts.SourceFile {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2020, true, ts.ScriptKind.JS);
  const diags = (sf as unknown as { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics ?? [];
  if (diags.length) throw new Error(`${file}: syntax error ${ts.flattenDiagnosticMessageText(diags[0].messageText, ' ')}`);
  return sf;
}

/** Shape names registered by mxCellRenderer.registerShape(<string or constant>, ...). */
function registrations(sf: ts.SourceFile, root: ts.Node = sf): string[] {
  const consts = new Map<string, string>();
  const names: string[] = [];
  const collect = (n: ts.Node): void => {
    // X.prototype.cst = {K: 'v'} / var C = {K: 'v'}
    if ((ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isObjectLiteralExpression(n.right)) ||
      (ts.isVariableDeclaration(n) && n.initializer && ts.isObjectLiteralExpression(n.initializer))) {
      const left = ts.isBinaryExpression(n) ? n.left.getText(sf) : n.name.getText(sf);
      const obj = (ts.isBinaryExpression(n) ? n.right : n.initializer) as ts.ObjectLiteralExpression;
      for (const p of obj.properties) {
        if (ts.isPropertyAssignment(p) && ts.isStringLiteral(p.initializer)) consts.set(left + '.' + p.name.getText(sf), p.initializer.text);
      }
    }
    ts.forEachChild(n, collect);
  };
  collect(sf);
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && n.expression.getText(sf) === 'mxCellRenderer.registerShape' && n.arguments.length >= 2) {
      const a = n.arguments[0];
      const name = ts.isStringLiteral(a) ? a.text : consts.get(a.getText(sf));
      if (name == null) throw new Error(`${sf.fileName}: unresolved registerShape(${a.getText(sf)})`);
      names.push(name);
    }
    ts.forEachChild(n, visit);
  };
  visit(root);
  return names;
}

/** Keys assigned to Graph.handleFactory (`Graph.handleFactory[NAME] = ...`). */
function handleFactories(sf: ts.SourceFile, regs: string[]): number {
  let n = 0;
  const visit = (x: ts.Node): void => {
    if (ts.isBinaryExpression(x) && x.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      /^Graph\.handleFactory\[/.test(x.left.getText(sf))) n++;
    ts.forEachChild(x, visit);
  };
  visit(sf);
  void regs;
  return n;
}

// ---------- Shapes.js: the shapes the TypeScript port lacks ----------
/** Shapes.js shapes not in src/drawio-shapes/js/shapes-core (registered names). */
export const SHAPES_JS_EXTRA = ['associativeEntity', 'component', 'cylinder2', 'dimension', 'endState', 'folder',
  'gitCherryPick', 'gitMergeCommit', 'ishikawaHead', 'isoCube', 'lollipop', 'mermaidBlockArrow', 'mermaidOdd', 'module',
  'note2', 'parallelMarker', 'pipe', 'plus', 'process2', 'providedRequiredInterface', 'requiredInterface', 'requires',
  'seqActorStick', 'seqBoundary', 'seqCollections', 'seqControl', 'seqDatabase', 'seqEntity', 'seqQueue', 'startState',
  'tableLine', 'transparent', 'umlBoundary', 'umlControl', 'umlDestroy', 'umlEntity', 'umlFrame', 'umlLifeline',
  'umlState', 'wire'];

interface Stmt { node: ts.Statement; defines: Set<string>; refs: Set<string>; registers: string[]; line: number }

function extractShapesJs(): { code: string; registers: string[] } {
  const file = WEBAPP + 'js/grapheditor/Shapes.js';
  const sf = parse(rel(file), readSource(file));
  // statements of the top-level IIFEs
  const stmts: Stmt[] = [];
  for (const top of sf.statements) {
    let body: ts.NodeArray<ts.Statement> | null = null;
    if (ts.isExpressionStatement(top) && ts.isCallExpression(top.expression)) {
      let callee: ts.Expression = top.expression.expression;
      while (ts.isParenthesizedExpression(callee)) callee = callee.expression;
      if (ts.isFunctionExpression(callee)) body = callee.body.statements;
    }
    if (!body) continue;
    for (const st of body) {
      const defines = new Set<string>();
      let registers: string[] = [];
      if (ts.isFunctionDeclaration(st) && st.name) defines.add(st.name.text);
      if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) defines.add(d.name.text);
      if (ts.isExpressionStatement(st)) {
        const e = st.expression;
        if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
          const root = /^([\w$]+)\./.exec(e.left.getText(sf));
          if (root) defines.add(root[1]);
        }
        if (ts.isCallExpression(e)) {
          const callee = e.expression.getText(sf);
          if (callee === 'mxUtils.extend' && ts.isIdentifier(e.arguments[0])) defines.add(e.arguments[0].text);
          if (callee === 'mxCellRenderer.registerShape') registers = registrations(sf, st);
        }
      }
      const a = analyze([st]);
      stmts.push({ node: st, defines, refs: a.free, registers, line: sf.getLineAndCharacterOfPosition(st.getStart(sf)).line + 1 });
    }
  }
  const localDecls = new Set<string>();
  for (const s of stmts) {
    if (ts.isFunctionDeclaration(s.node) || ts.isVariableStatement(s.node)) for (const d of s.defines) localDecls.add(d);
  }
  const byName = new Map<string, Stmt[]>();
  for (const s of stmts) for (const d of s.defines) byName.set(d, [...(byName.get(d) ?? []), s]);
  const take = new Set<Stmt>();
  const want = new Set(SHAPES_JS_EXTRA);
  const need: string[] = [];
  for (const s of stmts) {
    if (s.registers.length && s.registers.every((r) => want.has(r))) {
      take.add(s);
      for (const r of s.refs) need.push(r);
    }
  }
  const done = new Set<string>();
  while (need.length) {
    const n = need.pop() as string;
    if (done.has(n) || !localDecls.has(n)) continue;
    done.add(n);
    for (const s of byName.get(n) ?? []) {
      if (s.registers.length) continue;
      if (!take.has(s)) { take.add(s); for (const r of s.refs) need.push(r); }
    }
  }
  const chosen = stmts.filter((s) => take.has(s));
  const registers = chosen.flatMap((s) => s.registers);
  const missing = SHAPES_JS_EXTRA.filter((n) => !registers.includes(n));
  if (missing.length) throw new Error(`Shapes.js: not found ${missing.join(', ')}`);
  const code = chosen.map((s) => `// js/grapheditor/Shapes.js:${s.line}\n${s.node.getText(sf)}`).join('\n');
  return { code, registers };
}

// ---------- output ----------
interface ModuleInfo { id: string; source: string; shapes: string[]; handles: number; deps: string[]; globals: string[]; stencilNames: string[] }

function moduleId(repoPath: string): string {
  return rel(repoPath).replace(/^shapes\//, '').replace(/\.js$/, '').replace(/[^A-Za-z0-9]+/g, '-');
}

function wrap(id: string, source: string, code: string, a: Analysis, imports: string[], exports: string[]): string {
  const globals = [...a.free].filter((g) => (SHIM_GLOBALS as readonly string[]).includes(g)).sort();
  const locals = [...a.implicit].sort();
  const unknown = [...a.free].filter((g) => !BUILTINS.has(g) && !(SHIM_GLOBALS as readonly string[]).includes(g) &&
    !a.implicit.has(g) && !imports.includes(g));
  if (unknown.length) { if (process.env.VENDOR_DEBUG) fs.writeFileSync(process.env.VENDOR_DEBUG, code); throw new Error(`${source}: unknown globals ${unknown.join(', ')}`); }
  return [
    '/* eslint-disable */',
    '// @ts-nocheck',
    '/**',
    ` * Generated by scripts/drawio-palettes/vendor-shapes.ts. Do not edit.`,
    ` * Source: jgraph/drawio ${DRAWIO_TAG} (${DRAWIO_COMMIT.slice(0, 10)}) src/main/webapp/${source}`,
    ' * Copyright (c) 2006-2026, JGraph Holdings Ltd / draw.io AG. Licensed under the Apache License 2.0 (see NOTICE);',
    ' * shape and stencil libraries: see public/stencils/LICENSE. Upstream code below is unmodified; the wrapper only',
    ' * binds the mxGraph names to the compatibility layer (src/drawio-shapes/vendor-runtime/mx-shim.ts).',
    ' */',
    `export const id = ${JSON.stringify(id)};`,
    'export default function install(mx) {',
    globals.length ? `var ${globals.map((g) => `${g} = mx.${g}`).join(', ')};` : '',
    imports.length ? `// top-level names of other draw.io shape files (loaded first)\nvar ${imports.map((g) => `${g} = mx.lookup(${JSON.stringify(g)})`).join(',\n  ')};` : '',
    locals.length ? `var ${locals.join(', ')}; // assigned without a declaration upstream (sloppy mode)` : '',
    '// ---------- upstream code ----------',
    code.replace(/\r\n/g, '\n'),
    '// ---------- end of upstream code ----------',
    exports.length ? `mx.publish({ ${exports.map((g) => `${g}: ${g}`).join(', ')} });` : '',
    '}',
    '',
  ].filter((l) => l !== '').join('\n') + '\n';
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const modules: ModuleInfo[] = [];
const memberUse = new Map<string, Set<string>>();
const written = new Set<string>();
const files = listSources(WEBAPP + 'shapes/').filter((f) => f.endsWith('.js') && !PORTED.has(rel(f))).sort();
const sources: Array<{ id: string; source: string; code: string; sf: ts.SourceFile }> = [];
for (const f of files) {
  const text = readSource(f);
  sources.push({ id: moduleId(f), source: rel(f), code: text, sf: parse(rel(f), text) });
}
const extra = extractShapesJs();
sources.push({ id: 'Shapes-extra', source: 'js/grapheditor/Shapes.js', code: extra.code, sf: parse('Shapes-extra.js', extra.code) });

/** Top-level function/var names of a file (draw.io scripts share them as globals). */
function topDecls(sf: ts.SourceFile): string[] {
  const out: string[] = [];
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.name) out.push(st.name.text);
    if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) out.push(d.name.text);
  }
  return out;
}
const definedBy = new Map<string, string>();
for (const s of sources) for (const n of topDecls(s.sf)) if (!definedBy.has(n)) definedBy.set(n, s.id);
const analyses = new Map(sources.map((s) => [s.id, analyze([s.sf])]));
const importsOf = new Map<string, string[]>();
const exportsOf = new Map<string, Set<string>>();
const depsOf = new Map<string, string[]>();
for (const s of sources) {
  const a = analyses.get(s.id) as Analysis;
  const imports = [...a.free].filter((g) => !BUILTINS.has(g) && !(SHIM_GLOBALS as readonly string[]).includes(g) &&
    !a.implicit.has(g) && definedBy.has(g) && definedBy.get(g) !== s.id).sort();
  importsOf.set(s.id, imports);
  depsOf.set(s.id, [...new Set(imports.map((g) => definedBy.get(g) as string))].sort());
  for (const g of imports) {
    const owner = definedBy.get(g) as string;
    const set = exportsOf.get(owner) ?? new Set<string>();
    set.add(g);
    exportsOf.set(owner, set);
  }
}
for (const s of sources) {
  const a = analyses.get(s.id) as Analysis;
  for (const [g, ms] of a.members) {
    if (!(SHIM_GLOBALS as readonly string[]).includes(g)) continue;
    const set = memberUse.get(g) ?? new Set<string>();
    for (const m of ms) set.add(m);
    memberUse.set(g, set);
  }
  const out = wrap(s.id, s.source, s.code, a, importsOf.get(s.id) ?? [], [...(exportsOf.get(s.id) ?? [])].sort());
  fs.writeFileSync(path.join(OUT_DIR, `${s.id}.js`), out);
  written.add(`${s.id}.js`);
  const shapes = s.id === 'Shapes-extra' ? extra.registers : registrations(s.sf);
  const stencilNames = [...new Set([...s.code.matchAll(/mxStencilRegistry\.getStencil\(\s*'([^']+)'\s*\)/g)].map((x) => x[1]))].sort();
  modules.push({ id: s.id, source: s.source, shapes, handles: handleFactories(s.sf, shapes), deps: depsOf.get(s.id) ?? [], stencilNames,
    globals: [...a.free].filter((g) => (SHIM_GLOBALS as readonly string[]).includes(g)).sort() });
}
for (const f of fs.readdirSync(OUT_DIR)) if (f.endsWith('.js') && !written.has(f)) fs.unlinkSync(path.join(OUT_DIR, f));

// ---------- stencil libraries (Editor.js mxStencilRegistry.libraries) ----------
const editor = readSource(WEBAPP + 'js/diagramly/Editor.js');
const libs = sobj();
const it = new Interpreter({
  SHAPES_PATH: 'shapes', STENCIL_PATH: 'stencils',
  mxStencilRegistry: sobj({ libraries: libs }),
});
const lineRe = /^\s*mxStencilRegistry\.libraries\[[^\]]+\]\s*=\s*\[[^\]]*\];\s*$/gm;
let m: RegExpExecArray | null;
let libCount = 0;
while ((m = lineRe.exec(editor))) { it.run(m[0], 'js/diagramly/Editor.js'); libCount++; }
const byFile = new Map(modules.map((x) => [x.source, x.id]));
const libraries: Record<string, { stencils: string[]; modules: string[] }> = {};
for (const key of Object.keys(libs).sort()) {
  const list = libs[key] as string[];
  const stencils: string[] = [];
  const mods: string[] = [];
  for (const p of list) {
    if (p.startsWith('stencils/')) {
      // Editor.js lists a few sets js/stencils.min.js does not have (e.g. sap.xml): draw.io's own
      // request 404s, so they are left out here
      const file = p.slice('stencils/'.length);
      if (fs.existsSync(path.join(REPO_ROOT, 'public', 'stencils', file))) stencils.push(file);
      else console.log(`note: Editor.js library ${key} lists ${p}, which is not in the stencil bundle`);
    }
    else if (p.startsWith('shapes/')) {
      if (PORTED.has(p)) continue;
      const id = byFile.get(p);
      if (!id) throw new Error(`Editor.js library ${key}: ${p} not vendored`);
      mods.push(id);
    } else throw new Error(`Editor.js library ${key}: unexpected ${p}`);
  }
  libraries[key] = { stencils, modules: mods };
}
/** Stencil files a module draws itself (literal getStencil names), resolved like mxStencilRegistry. */
function stencilFilesFor(name: string): string[] {
  const parts = name.split('.');
  if (parts[0] !== 'mxgraph' || parts.length < 3) return [];
  const basename = parts.slice(1, -1).join('/');
  return libraries[basename] ? libraries[basename].stencils : [`${basename.replace('_-_', '_')}.xml`];
}
const moduleStencils = new Map(modules.map((x) => [x.id, [...new Set(x.stencilNames.flatMap(stencilFilesFor))].sort()]));
if (libCount !== Object.keys(libs).length) console.log(`note: ${libCount} library lines, ${Object.keys(libs).length} keys`);

// ---------- mxConstants values used by the modules ----------
const constSrc = readSource(WEBAPP + 'mxgraph/src/util/mxConstants.js');
const holder = sobj();
const it2 = new Interpreter({ mxClient: sobj({ IS_IE: false, IS_SVG: true, IS_QUIRKS: false, IS_FF: false, IS_SF: false, IS_GC: true }),
  navigator: sobj({ userAgent: '' }), window: holder,
  mxRectangle: hostFn('mxRectangle', () => sobj(), (a) => sobj({ x: a[0], y: a[1], width: a[2], height: a[3] })) });
it2.run(constSrc + '\nwindow.mxConstants = mxConstants;', 'mxgraph/src/util/mxConstants.js');
const allConsts = holder.mxConstants as SObj;
const usedConsts: Record<string, unknown> = {};
for (const k of [...(memberUse.get('mxConstants') ?? [])].map((x) => x.split('.')[0]).sort()) {
  // undefined upstream too (e.g. STYLE_TEXTCOLOR): stays undefined in the shim, as in draw.io
  if (!(k in allConsts)) { console.log(`note: mxConstants.${k} is undefined upstream`); continue; }
  const v = allConsts[k];
  if (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean' && v !== null) throw new Error(`mxConstants.${k}: not a primitive`);
  usedConsts[k] = v;
}

const index = {
  drawioTag: DRAWIO_TAG,
  modules: modules.map(({ id, source, shapes, handles, deps }) => ({ id, source, deps, stencils: moduleStencils.get(id) ?? [], shapes, handles })),
  libraries,
};
fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify(index, null, 1) + '\n');
fs.writeFileSync(path.join(OUT_DIR, 'mx-constants.json'), JSON.stringify(usedConsts, null, 1) + '\n');
const usage: Record<string, string[]> = {};
for (const [g, set] of [...memberUse].sort()) usage[g] = [...set].sort();
fs.writeFileSync(path.join(OUT_DIR, 'shim-usage.json'), JSON.stringify(usage, null, 1) + '\n');
console.log(`vendored ${modules.length} modules, ${modules.reduce((n, x) => n + x.shapes.length, 0)} shapes, ${Object.keys(libraries).length} stencil libraries`);
