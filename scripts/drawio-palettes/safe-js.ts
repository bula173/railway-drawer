/**
 * A small, closed JavaScript interpreter for draw.io's palette sources (Sidebar*.js).
 *
 * The downloaded draw.io sources are treated as untrusted data: they are parsed with the
 * TypeScript compiler's parser (syntax tree only) and evaluated by this tree-walking
 * interpreter, never handed to a JavaScript engine (no eval, no node:vm, no Function).
 * Interpreted code can only reach values created by the interpreter or the host stubs given
 * to it explicitly:
 * - objects are prototype-less (`Object.create(null)` roots), so `constructor`/`__proto__`
 *   lead nowhere;
 * - functions are interpreter closures (`Closure`) or explicitly provided host functions
 *   (`HostFn`); a real JavaScript function value is never exposed, and calling anything
 *   else throws;
 * - strings, numbers, arrays and regular expressions only expose an allow-listed set of
 *   pure methods.
 * Errors carry the source file and line. Supports the ES5 subset (plus let/const, arrow
 * functions and template strings) the palette files use.
 */
import ts from 'typescript';

// ---------------------------------------------------------------------------------------
// values
// ---------------------------------------------------------------------------------------

export type SObj = Record<string, unknown>;

/** Creates an interpreter object (prototype-less root, or the given interpreter prototype). */
export function sobj(props?: Record<string, unknown>, proto: SObj | null = null): SObj {
  const o = Object.create(proto) as SObj;
  if (props) for (const k of Object.keys(props)) o[k] = props[k];
  return o;
}

let closureIds = 0;

export class Closure {
  node: ts.FunctionLikeDeclaration;
  env: Env;
  file: string;
  lexicalThis: unknown;
  isArrow: boolean;
  props: SObj;
  id: number;
  constructor(node: ts.FunctionLikeDeclaration, env: Env, file: string, isArrow: boolean, lexicalThis: unknown) {
    this.node = node;
    this.env = env;
    this.file = file;
    this.isArrow = isArrow;
    this.lexicalThis = lexicalThis;
    this.props = sobj();
    this.id = ++closureIds;
  }
}

export type HostImpl = (thisArg: unknown, args: unknown[], it: Interpreter) => unknown;

export class HostFn {
  name: string;
  impl: HostImpl;
  construct: ((args: unknown[], it: Interpreter) => unknown) | null;
  props: SObj;
  constructor(name: string, impl: HostImpl, construct?: (args: unknown[], it: Interpreter) => unknown) {
    this.name = name;
    this.impl = impl;
    this.construct = construct ?? null;
    this.props = sobj();
  }
}

export function hostFn(name: string, impl: HostImpl, construct?: (args: unknown[], it: Interpreter) => unknown): HostFn {
  return new HostFn(name, impl, construct);
}

const isFn = (v: unknown): v is Closure | HostFn => v instanceof Closure || v instanceof HostFn;

export class InterpError extends Error {}

/** A `throw` from interpreted code. */
class ThrowSignal {
  value: unknown;
  constructor(value: unknown) { this.value = value; }
}

// ---------------------------------------------------------------------------------------
// environments
// ---------------------------------------------------------------------------------------

export class Env {
  vars: Map<string, { value: unknown }>;
  parent: Env | null;
  isFunction: boolean;
  thisVal: unknown;
  constructor(parent: Env | null, isFunction: boolean, thisVal?: unknown) {
    this.vars = new Map();
    this.parent = parent;
    this.isFunction = isFunction;
    this.thisVal = thisVal;
  }
  declare(name: string, value: unknown): void {
    const slot = this.vars.get(name);
    if (slot) slot.value = value; else this.vars.set(name, { value });
  }
  lookup(name: string): { value: unknown } | null {
    for (let e: Env | null = this; e; e = e.parent) {
      const s = e.vars.get(name);
      if (s) return s;
    }
    return null;
  }
  functionScope(): Env {
    let e: Env = this;
    while (!e.isFunction && e.parent) e = e.parent;
    return e;
  }
}

type Completion = { type: 'normal' } | { type: 'return'; value: unknown } | { type: 'break'; label?: string } | { type: 'continue'; label?: string };
const NORMAL: Completion = { type: 'normal' };

// ---------------------------------------------------------------------------------------
// built-in methods (pure, allow-listed)
// ---------------------------------------------------------------------------------------

function toStr(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map((x) => (x == null ? '' : toStr(x))).join(',');
  if (v instanceof RegExp) return String(v);
  throw new InterpError(`cannot convert ${describe(v)} to a string`);
}

function toPrim(v: unknown): unknown {
  if (v == null || typeof v !== 'object' || v instanceof RegExp) return v;
  if (Array.isArray(v)) return toStr(v);
  throw new InterpError(`cannot convert ${describe(v)} to a primitive`);
}

function describe(v: unknown): string {
  if (v instanceof Closure) return 'function';
  if (v instanceof HostFn) return `host function ${v.name}`;
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function callbackOf(it: Interpreter, fn: unknown): (...a: unknown[]) => unknown {
  if (!isFn(fn)) throw new InterpError('callback is not a function');
  return (...a: unknown[]) => it.call(fn, undefined, a);
}

/** Prototype-less method table: only its own keys exist (no `constructor`, `__proto__`, ...). */
function methodTable<F>(table: Record<string, F>): Record<string, F> {
  return Object.assign(Object.create(null) as Record<string, F>, table);
}

type StrMethod = (s: string, args: unknown[], it: Interpreter) => unknown;
type ArrMethod = (arr: unknown[], args: unknown[], it: Interpreter) => unknown;
type NumMethod = (n: number, args: unknown[]) => unknown;

const STRING_METHODS = methodTable<StrMethod>({
  charAt: (s, a) => s.charAt(Number(a[0] ?? 0)),
  charCodeAt: (s, a) => s.charCodeAt(Number(a[0] ?? 0)),
  concat: (s, a) => s.concat(...a.map(toStr)),
  endsWith: (s, a) => s.endsWith(toStr(a[0])),
  includes: (s, a) => s.includes(toStr(a[0])),
  indexOf: (s, a) => s.indexOf(toStr(a[0]), a[1] == null ? undefined : Number(a[1])),
  lastIndexOf: (s, a) => s.lastIndexOf(toStr(a[0]), a[1] == null ? undefined : Number(a[1])),
  match: (s, a) => s.match(a[0] instanceof RegExp ? a[0] : toStr(a[0])),
  replace: (s, a, it) => {
    const pat = a[0] instanceof RegExp ? a[0] : toStr(a[0]);
    if (isFn(a[1])) {
      const cb = callbackOf(it, a[1]);
      return s.replace(pat, (...m: unknown[]) => toStr(cb(...m)));
    }
    return s.replace(pat, toStr(a[1]));
  },
  slice: (s, a) => s.slice(a[0] == null ? undefined : Number(a[0]), a[1] == null ? undefined : Number(a[1])),
  split: (s, a) => (a[0] === undefined ? [s] : s.split(a[0] instanceof RegExp ? a[0] : toStr(a[0]), a[1] == null ? undefined : Number(a[1]))),
  startsWith: (s, a) => s.startsWith(toStr(a[0])),
  substr: (s, a) => s.substr(Number(a[0] ?? 0), a[1] == null ? undefined : Number(a[1])),
  substring: (s, a) => s.substring(Number(a[0] ?? 0), a[1] == null ? undefined : Number(a[1])),
  toLowerCase: (s) => s.toLowerCase(),
  toUpperCase: (s) => s.toUpperCase(),
  toString: (s: string) => s,
  trim: (s) => s.trim(),
  valueOf: (s: string) => s,
});

const ARRAY_METHODS = methodTable<ArrMethod>({
  concat: (arr, a) => arr.concat(...a.map((x) => (Array.isArray(x) ? x : [x]))),
  every: (arr, a, it) => { const f = callbackOf(it, a[0]); return arr.every((x, i) => !!f(x, i, arr)); },
  filter: (arr, a, it) => { const f = callbackOf(it, a[0]); return arr.filter((x, i) => !!f(x, i, arr)); },
  forEach: (arr, a, it) => { const f = callbackOf(it, a[0]); arr.forEach((x, i) => { f(x, i, arr); }); return undefined; },
  indexOf: (arr, a) => arr.indexOf(a[0]),
  join: (arr, a) => arr.map((x) => (x == null ? '' : toStr(x))).join(a[0] === undefined ? ',' : toStr(a[0])),
  lastIndexOf: (arr, a) => arr.lastIndexOf(a[0]),
  map: (arr, a, it) => { const f = callbackOf(it, a[0]); return arr.map((x, i) => f(x, i, arr)); },
  pop: (arr) => arr.pop(),
  push: (arr, a) => arr.push(...a),
  reverse: (arr) => arr.reverse(),
  shift: (arr) => arr.shift(),
  slice: (arr, a) => arr.slice(a[0] == null ? undefined : Number(a[0]), a[1] == null ? undefined : Number(a[1])),
  some: (arr, a, it) => { const f = callbackOf(it, a[0]); return arr.some((x, i) => !!f(x, i, arr)); },
  sort: (arr, a, it) => {
    if (a[0] == null) return arr.sort();
    const f = callbackOf(it, a[0]);
    return arr.sort((x, y) => Number(f(x, y)));
  },
  splice: (arr, a) => arr.splice(Number(a[0]), a[1] == null ? arr.length : Number(a[1]), ...a.slice(2)),
  toString: (arr: unknown[]) => toStr(arr),
  unshift: (arr, a) => arr.unshift(...a),
});

const NUMBER_METHODS = methodTable<NumMethod>({
  toFixed: (n, a) => n.toFixed(a[0] == null ? 0 : Number(a[0])),
  toString: (n: number, a: unknown[]) => n.toString(a[0] == null ? undefined : Number(a[0])),
  valueOf: (n: number) => n,
});

// ---------------------------------------------------------------------------------------
// interpreter
// ---------------------------------------------------------------------------------------

interface CallSite { file: string; line: number }

export class Interpreter {
  global: Env;
  /** Interpreted call sites (innermost last), for source references. */
  callStack: CallSite[] = [];
  private files = new Map<ts.SourceFile, string>();
  private steps = 0;
  maxSteps = 2e9;

  constructor(globals: Record<string, unknown>) {
    this.global = new Env(null, true, undefined);
    for (const k of Object.keys(globals)) this.global.declare(k, globals[k]);
    for (const [k, v] of Object.entries(standardGlobals())) if (!this.global.lookup(k)) this.global.declare(k, v);
  }

  /** Parses `code` (attributed to `file`, line numbers offset by `lineOffset`) and runs it. */
  run(code: string, file: string, lineOffset = 0, env?: Env, thisVal?: unknown): unknown {
    const src = ts.createSourceFile(file, '\n'.repeat(lineOffset) + code, ts.ScriptTarget.ES2020, true, ts.ScriptKind.JS);
    const diags = (src as unknown as { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics ?? [];
    if (diags.length) {
      const d = diags[0];
      const { line } = src.getLineAndCharacterOfPosition(d.start ?? 0);
      throw new InterpError(`${file}:${line + 1}: syntax error: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`);
    }
    this.files.set(src, file);
    const scope = env ?? new Env(this.global, true, thisVal);
    this.hoist(src.statements, scope, scope);
    let last: unknown;
    for (const st of src.statements) {
      if (ts.isExpressionStatement(st)) { last = this.evalTop(st.expression, scope); continue; }
      const c = this.exec(st, scope);
      if (c.type !== 'normal') break;
    }
    return last;
  }

  /** Parses an expression and evaluates it. */
  evalExpression(code: string, file: string, env?: Env): unknown {
    return this.run('(' + code + '\n)', file, 0, env);
  }

  private evalTop(e: ts.Expression, env: Env): unknown {
    return this.eval(e, env);
  }

  private loc(node: ts.Node): CallSite {
    const sf = node.getSourceFile();
    const file = this.files.get(sf) ?? sf.fileName;
    return { file, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 };
  }

  private fail(node: ts.Node, msg: string): never {
    const l = this.loc(node);
    throw new InterpError(`${l.file}:${l.line}: ${msg}`);
  }

  // ----- hoisting -----
  private hoist(stmts: readonly ts.Statement[] | ts.NodeArray<ts.Statement>, fnScope: Env, blockScope: Env): void {
    const visitVars = (n: ts.Node): void => {
      if (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isClassDeclaration(n)) return;
      if (ts.isVariableDeclarationList(n) && !(n.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const))) {
        for (const d of n.declarations) this.bindingNames(d.name).forEach((name) => { if (!fnScope.vars.has(name)) fnScope.declare(name, undefined); });
      }
      ts.forEachChild(n, visitVars);
    };
    for (const st of stmts) {
      if (ts.isFunctionDeclaration(st) && st.name && st.body) {
        blockScope.declare(st.name.text, new Closure(st, blockScope, this.files.get(st.getSourceFile()) ?? '', false, undefined));
      } else {
        visitVars(st);
      }
    }
  }

  private bindingNames(name: ts.BindingName): string[] {
    if (ts.isIdentifier(name)) return [name.text];
    throw new InterpError('destructuring is not supported');
  }

  // ----- statements -----
  private execBlock(stmts: ts.NodeArray<ts.Statement>, env: Env): Completion {
    const scope = new Env(env, false);
    for (const st of stmts) {
      if (ts.isFunctionDeclaration(st) && st.name && st.body) {
        scope.declare(st.name.text, new Closure(st, scope, this.files.get(st.getSourceFile()) ?? '', false, undefined));
      }
    }
    for (const st of stmts) {
      const c = this.exec(st, scope);
      if (c.type !== 'normal') return c;
    }
    return NORMAL;
  }

  private tick(node: ts.Node): void {
    if (++this.steps > this.maxSteps) this.fail(node, 'step limit exceeded');
  }

  exec(st: ts.Statement, env: Env): Completion {
    this.tick(st);
    switch (st.kind) {
      case ts.SyntaxKind.ExpressionStatement:
        this.eval((st as ts.ExpressionStatement).expression, env);
        return NORMAL;
      case ts.SyntaxKind.VariableStatement:
        this.declareList((st as ts.VariableStatement).declarationList, env);
        return NORMAL;
      case ts.SyntaxKind.FunctionDeclaration:
      case ts.SyntaxKind.EmptyStatement:
        return NORMAL;
      case ts.SyntaxKind.Block:
        return this.execBlock((st as ts.Block).statements, env);
      case ts.SyntaxKind.IfStatement: {
        const s = st as ts.IfStatement;
        if (truthy(this.eval(s.expression, env))) return this.exec(s.thenStatement, env);
        return s.elseStatement ? this.exec(s.elseStatement, env) : NORMAL;
      }
      case ts.SyntaxKind.ReturnStatement: {
        const s = st as ts.ReturnStatement;
        return { type: 'return', value: s.expression ? this.eval(s.expression, env) : undefined };
      }
      case ts.SyntaxKind.ForStatement: return this.execFor(st as ts.ForStatement, env);
      case ts.SyntaxKind.ForInStatement: return this.execForIn(st as ts.ForInStatement, env);
      case ts.SyntaxKind.ForOfStatement: return this.execForOf(st as ts.ForOfStatement, env);
      case ts.SyntaxKind.WhileStatement: {
        const s = st as ts.WhileStatement;
        while (truthy(this.eval(s.expression, env))) {
          const c = this.exec(s.statement, env);
          if (c.type === 'break' && !c.label) break;
          if (c.type === 'continue' && !c.label) continue;
          if (c.type !== 'normal') return c;
        }
        return NORMAL;
      }
      case ts.SyntaxKind.DoStatement: {
        const s = st as ts.DoStatement;
        do {
          const c = this.exec(s.statement, env);
          if (c.type === 'break' && !c.label) break;
          if (c.type === 'continue' && !c.label) continue;
          if (c.type !== 'normal') return c;
        } while (truthy(this.eval(s.expression, env)));
        return NORMAL;
      }
      case ts.SyntaxKind.BreakStatement: return { type: 'break', label: (st as ts.BreakStatement).label?.text };
      case ts.SyntaxKind.ContinueStatement: return { type: 'continue', label: (st as ts.ContinueStatement).label?.text };
      case ts.SyntaxKind.ThrowStatement: throw new ThrowSignal(this.eval((st as ts.ThrowStatement).expression!, env));
      case ts.SyntaxKind.TryStatement: return this.execTry(st as ts.TryStatement, env);
      case ts.SyntaxKind.SwitchStatement: return this.execSwitch(st as ts.SwitchStatement, env);
      case ts.SyntaxKind.LabeledStatement: {
        const s = st as ts.LabeledStatement;
        const c = this.exec(s.statement, env);
        if ((c.type === 'break' || c.type === 'continue') && c.label === s.label.text) return NORMAL;
        return c;
      }
      default:
        this.fail(st, `unsupported statement ${ts.SyntaxKind[st.kind]}`);
    }
  }

  private declareList(list: ts.VariableDeclarationList, env: Env): void {
    const block = !!(list.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const));
    for (const d of list.declarations) {
      const [name] = this.bindingNames(d.name);
      if (block) {
        env.declare(name, d.initializer ? this.eval(d.initializer, env) : undefined);
      } else if (d.initializer) {
        const v = this.eval(d.initializer, env);
        const slot = env.lookup(name);
        if (slot) slot.value = v; else env.functionScope().declare(name, v);
      } else if (!env.lookup(name)) {
        env.functionScope().declare(name, undefined);
      }
    }
  }

  private loopBody(stmt: ts.Statement, env: Env): Completion | 'break' | 'continue' {
    const c = this.exec(stmt, env);
    if (c.type === 'break' && !c.label) return 'break';
    if (c.type === 'continue' && !c.label) return 'continue';
    return c;
  }

  private execFor(s: ts.ForStatement, env: Env): Completion {
    let scope = new Env(env, false);
    const perIteration = !!(s.initializer && ts.isVariableDeclarationList(s.initializer) &&
      (s.initializer.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const)));
    if (s.initializer) {
      if (ts.isVariableDeclarationList(s.initializer)) this.declareList(s.initializer, scope);
      else this.eval(s.initializer, scope);
    }
    for (;;) {
      if (s.condition && !truthy(this.eval(s.condition, scope))) break;
      const r = this.loopBody(s.statement, scope);
      if (r === 'break') break;
      if (r !== 'continue' && r.type !== 'normal') return r;
      if (perIteration) {
        const next = new Env(env, false);
        for (const [k, v] of scope.vars) next.declare(k, v.value);
        scope = next;
      }
      if (s.incrementor) this.eval(s.incrementor, scope);
    }
    return NORMAL;
  }

  private bindLoopVar(init: ts.ForInitializer, env: Env, value: unknown): Env {
    const scope = new Env(env, false);
    if (ts.isVariableDeclarationList(init)) {
      const [name] = this.bindingNames(init.declarations[0].name);
      if (init.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const)) scope.declare(name, value);
      else this.assignName(name, value, env);
    } else {
      this.assign(init, value, env);
    }
    return scope;
  }

  private execForIn(s: ts.ForInStatement, env: Env): Completion {
    const obj = this.eval(s.expression, env);
    const keys: string[] = [];
    if (Array.isArray(obj)) obj.forEach((_x, i) => keys.push(String(i)));
    else if (obj != null && typeof obj === 'object' && !(obj instanceof RegExp)) for (const k in obj as SObj) keys.push(k);
    else if (obj instanceof Closure || obj instanceof HostFn) for (const k in obj.props) keys.push(k);
    for (const k of keys) {
      const r = this.loopBody(s.statement, this.bindLoopVar(s.initializer, env, k));
      if (r === 'break') break;
      if (r !== 'continue' && r.type !== 'normal') return r;
    }
    return NORMAL;
  }

  private execForOf(s: ts.ForOfStatement, env: Env): Completion {
    const obj = this.eval(s.expression, env);
    if (!Array.isArray(obj)) this.fail(s, 'for-of over a non-array');
    for (const v of obj.slice()) {
      const r = this.loopBody(s.statement, this.bindLoopVar(s.initializer, env, v));
      if (r === 'break') break;
      if (r !== 'continue' && r.type !== 'normal') return r;
    }
    return NORMAL;
  }

  private execTry(s: ts.TryStatement, env: Env): Completion {
    let result: Completion = NORMAL;
    try {
      result = this.execBlock(s.tryBlock.statements, env);
    } catch (e) {
      if (!(e instanceof ThrowSignal) || !s.catchClause) throw e;
      const scope = new Env(env, false);
      const decl = s.catchClause.variableDeclaration;
      if (decl) scope.declare(this.bindingNames(decl.name)[0], e.value);
      result = this.execBlock(s.catchClause.block.statements, scope);
    } finally {
      if (s.finallyBlock) {
        const f = this.execBlock(s.finallyBlock.statements, env);
        if (f.type !== 'normal') result = f;
      }
    }
    return result;
  }

  private execSwitch(s: ts.SwitchStatement, env: Env): Completion {
    const v = this.eval(s.expression, env);
    const scope = new Env(env, false);
    const clauses = s.caseBlock.clauses;
    let start = clauses.findIndex((c) => ts.isCaseClause(c) && this.eval(c.expression, scope) === v);
    if (start < 0) start = clauses.findIndex((c) => ts.isDefaultClause(c));
    if (start < 0) return NORMAL;
    for (let i = start; i < clauses.length; i++) {
      for (const st of clauses[i].statements) {
        const c = this.exec(st, scope);
        if (c.type === 'break' && !c.label) return NORMAL;
        if (c.type !== 'normal') return c;
      }
    }
    return NORMAL;
  }

  // ----- expressions -----
  eval(e: ts.Expression, env: Env): unknown {
    this.tick(e);
    switch (e.kind) {
      case ts.SyntaxKind.NumericLiteral: return Number((e as ts.NumericLiteral).text);
      case ts.SyntaxKind.StringLiteral:
      case ts.SyntaxKind.NoSubstitutionTemplateLiteral: return (e as ts.StringLiteral).text;
      case ts.SyntaxKind.TemplateExpression: {
        const t = e as ts.TemplateExpression;
        let s = t.head.text;
        for (const span of t.templateSpans) s += toStr(toPrim(this.eval(span.expression, env))) + span.literal.text;
        return s;
      }
      case ts.SyntaxKind.RegularExpressionLiteral: {
        const text = (e as ts.RegularExpressionLiteral).text;
        const i = text.lastIndexOf('/');
        return new RegExp(text.slice(1, i), text.slice(i + 1));
      }
      case ts.SyntaxKind.TrueKeyword: return true;
      case ts.SyntaxKind.FalseKeyword: return false;
      case ts.SyntaxKind.NullKeyword: return null;
      case ts.SyntaxKind.ThisKeyword: return this.thisOf(env);
      case ts.SyntaxKind.Identifier: return this.lookupName(e as ts.Identifier, env);
      case ts.SyntaxKind.ParenthesizedExpression: return this.eval((e as ts.ParenthesizedExpression).expression, env);
      case ts.SyntaxKind.ArrayLiteralExpression: {
        const out: unknown[] = [];
        for (const el of (e as ts.ArrayLiteralExpression).elements) {
          if (ts.isSpreadElement(el)) {
            const v = this.eval(el.expression, env);
            if (!Array.isArray(v)) this.fail(el, 'spread of a non-array');
            out.push(...v);
          } else if (el.kind === ts.SyntaxKind.OmittedExpression) {
            out.push(undefined);
          } else out.push(this.eval(el, env));
        }
        return out;
      }
      case ts.SyntaxKind.ObjectLiteralExpression: return this.evalObject(e as ts.ObjectLiteralExpression, env);
      case ts.SyntaxKind.FunctionExpression: {
        const f = e as ts.FunctionExpression;
        let scope = env;
        if (f.name) { scope = new Env(env, false); }
        const c = new Closure(f, scope, this.files.get(f.getSourceFile()) ?? '', false, undefined);
        if (f.name) scope.declare(f.name.text, c);
        return c;
      }
      case ts.SyntaxKind.ArrowFunction:
        return new Closure(e as ts.ArrowFunction, env, this.files.get(e.getSourceFile()) ?? '', true, this.thisOf(env));
      case ts.SyntaxKind.PropertyAccessExpression: {
        const p = e as ts.PropertyAccessExpression;
        const obj = this.eval(p.expression, env);
        if (obj == null && p.questionDotToken) return undefined;
        return this.getProp(obj, p.name.text, p);
      }
      case ts.SyntaxKind.ElementAccessExpression: {
        const p = e as ts.ElementAccessExpression;
        const obj = this.eval(p.expression, env);
        if (obj == null && p.questionDotToken) return undefined;
        return this.getProp(obj, propKey(this.eval(p.argumentExpression, env)), p);
      }
      case ts.SyntaxKind.CallExpression: return this.evalCall(e as ts.CallExpression, env);
      case ts.SyntaxKind.NewExpression: {
        const n = e as ts.NewExpression;
        const ctor = this.eval(n.expression, env);
        const args = this.evalArgs(n.arguments ?? ts.factory.createNodeArray(), env);
        this.callStack.push(this.loc(n));
        try { return this.construct(ctor, args, n); } finally { this.callStack.pop(); }
      }
      case ts.SyntaxKind.ConditionalExpression: {
        const c = e as ts.ConditionalExpression;
        return truthy(this.eval(c.condition, env)) ? this.eval(c.whenTrue, env) : this.eval(c.whenFalse, env);
      }
      case ts.SyntaxKind.PrefixUnaryExpression: return this.evalPrefix(e as ts.PrefixUnaryExpression, env);
      case ts.SyntaxKind.PostfixUnaryExpression: {
        const u = e as ts.PostfixUnaryExpression;
        const old = Number(toPrim(this.eval(u.operand, env)));
        this.assign(u.operand, u.operator === ts.SyntaxKind.PlusPlusToken ? old + 1 : old - 1, env);
        return old;
      }
      case ts.SyntaxKind.TypeOfExpression: {
        const t = e as ts.TypeOfExpression;
        if (ts.isIdentifier(t.expression) && !env.lookup(t.expression.text)) return 'undefined';
        return typeOf(this.eval(t.expression, env));
      }
      case ts.SyntaxKind.VoidExpression: this.eval((e as ts.VoidExpression).expression, env); return undefined;
      case ts.SyntaxKind.DeleteExpression: {
        const d = (e as ts.DeleteExpression).expression;
        if (ts.isPropertyAccessExpression(d) || ts.isElementAccessExpression(d)) {
          const obj = this.eval(d.expression, env);
          const key = ts.isPropertyAccessExpression(d) ? d.name.text : propKey(this.eval(d.argumentExpression, env));
          const target = obj instanceof Closure || obj instanceof HostFn ? obj.props : obj;
          if (target != null && typeof target === 'object') delete (target as SObj)[key];
        }
        return true;
      }
      case ts.SyntaxKind.BinaryExpression: return this.evalBinary(e as ts.BinaryExpression, env);
      default:
        this.fail(e, `unsupported expression ${ts.SyntaxKind[e.kind]}`);
    }
  }

  private thisOf(env: Env): unknown {
    for (let s: Env | null = env; s; s = s.parent) if (s.isFunction) return s.thisVal;
    return undefined;
  }

  private lookupName(id: ts.Identifier, env: Env): unknown {
    const name = id.text;
    if (name === 'undefined') return undefined;
    const slot = env.lookup(name);
    if (!slot) {
      if (name === 'NaN') return NaN;
      if (name === 'Infinity') return Infinity;
      this.fail(id, `${name} is not defined`);
    }
    return slot.value;
  }

  private evalObject(o: ts.ObjectLiteralExpression, env: Env): SObj {
    const out = sobj();
    for (const p of o.properties) {
      if (ts.isPropertyAssignment(p)) {
        out[this.propName(p.name, env)] = this.eval(p.initializer, env);
      } else if (ts.isShorthandPropertyAssignment(p)) {
        out[p.name.text] = this.lookupName(p.name, env);
      } else if (ts.isMethodDeclaration(p)) {
        out[this.propName(p.name, env)] = new Closure(p, env, this.files.get(p.getSourceFile()) ?? '', false, undefined);
      } else if (ts.isSpreadAssignment(p)) {
        const v = this.eval(p.expression, env);
        if (v != null && typeof v === 'object') for (const k of Object.keys(v as SObj)) out[k] = (v as SObj)[k];
      } else {
        this.fail(p, `unsupported object member ${ts.SyntaxKind[p.kind]}`);
      }
    }
    return out;
  }

  private propName(n: ts.PropertyName, env: Env): string {
    if (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n) || ts.isPrivateIdentifier(n)) {
      return ts.isNumericLiteral(n) ? String(Number(n.text)) : n.text;
    }
    if (ts.isComputedPropertyName(n)) return propKey(this.eval(n.expression, env));
    this.fail(n, 'unsupported property name');
  }

  private evalArgs(args: ts.NodeArray<ts.Expression>, env: Env): unknown[] {
    const out: unknown[] = [];
    for (const a of args) {
      if (ts.isSpreadElement(a)) {
        const v = this.eval(a.expression, env);
        if (!Array.isArray(v)) this.fail(a, 'spread of a non-array');
        out.push(...v);
      } else out.push(this.eval(a, env));
    }
    return out;
  }

  private evalCall(c: ts.CallExpression, env: Env): unknown {
    let fn: unknown;
    let thisArg: unknown;
    const callee = c.expression;
    if (ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee)) {
      thisArg = this.eval(callee.expression, env);
      if (thisArg == null && (callee.questionDotToken || c.questionDotToken)) return undefined;
      const key = ts.isPropertyAccessExpression(callee) ? callee.name.text : propKey(this.eval(callee.argumentExpression, env));
      fn = this.getProp(thisArg, key, callee);
    } else {
      fn = this.eval(callee, env);
      thisArg = undefined;
    }
    if (fn == null && c.questionDotToken) return undefined;
    const args = this.evalArgs(c.arguments, env);
    if (!isFn(fn)) this.fail(c, `${callee.getText().slice(0, 60)} is not a function`);
    // V8 reports a member call at the property name; keep that for source references
    const at = ts.isPropertyAccessExpression(callee) ? callee.name : c;
    this.callStack.push(this.loc(at));
    try {
      return this.call(fn, thisArg, args);
    } catch (err) {
      if (err instanceof InterpError && !/^\S+:\d+: /.test(err.message)) this.fail(c, err.message);
      throw err;
    } finally {
      this.callStack.pop();
    }
  }

  /** Calls an interpreter function value. */
  call(fn: unknown, thisArg: unknown, args: unknown[]): unknown {
    if (fn instanceof HostFn) return fn.impl(thisArg, args, this);
    if (!(fn instanceof Closure)) throw new InterpError(`${describe(fn)} is not callable`);
    const node = fn.node;
    const scope = new Env(fn.env, true, fn.isArrow ? fn.lexicalThis : thisArg);
    if (!fn.isArrow) scope.declare('arguments', args.slice());
    node.parameters.forEach((p, i) => {
      const [name] = this.bindingNames(p.name);
      if (p.dotDotDotToken) { scope.declare(name, args.slice(i)); return; }
      let v = args[i];
      if (v === undefined && p.initializer) v = this.eval(p.initializer, scope);
      scope.declare(name, v);
    });
    const body = node.body;
    if (!body) return undefined;
    if (!ts.isBlock(body)) return this.eval(body, scope);
    this.hoist(body.statements, scope, scope);
    for (const st of body.statements) {
      const c = this.exec(st, scope);
      if (c.type === 'return') return c.value;
      if (c.type !== 'normal') break;
    }
    return undefined;
  }

  construct(ctor: unknown, args: unknown[], node?: ts.Node): unknown {
    if (ctor instanceof HostFn) {
      if (!ctor.construct) throw new InterpError(`${ctor.name} is not a constructor`);
      return ctor.construct(args, this);
    }
    if (!(ctor instanceof Closure)) {
      if (node) this.fail(node, 'not a constructor');
      throw new InterpError('not a constructor');
    }
    const proto = this.prototypeOf(ctor);
    const obj = sobj(undefined, proto);
    const r = this.call(ctor, obj, args);
    return r != null && typeof r === 'object' ? r : obj;
  }

  private prototypeOf(fn: Closure | HostFn): SObj {
    let p = fn.props.prototype as SObj | undefined;
    if (p == null || typeof p !== 'object') {
      p = sobj();
      fn.props.prototype = p;
    }
    return p;
  }

  getProp(obj: unknown, key: string, node?: ts.Node): unknown {
    if (obj == null) {
      if (node) this.fail(node, `cannot read property '${key}' of ${obj}`);
      throw new InterpError(`cannot read property '${key}' of ${obj}`);
    }
    if (typeof obj === 'string') {
      if (key === 'length') return obj.length;
      if (/^\d+$/.test(key)) return obj[Number(key)];
      const m = STRING_METHODS[key];
      if (m) return hostFn(key, (_t, a, it) => m(obj, a, it));
      return undefined;
    }
    if (typeof obj === 'number') {
      const m = NUMBER_METHODS[key];
      return m ? hostFn(key, (_t, a) => m(obj, a)) : undefined;
    }
    if (typeof obj === 'boolean') return key === 'toString' ? hostFn(key, () => String(obj)) : undefined;
    if (Array.isArray(obj)) {
      if (key === 'length') return obj.length;
      if (/^\d+$/.test(key)) return obj[Number(key)];
      const m = ARRAY_METHODS[key];
      if (m) return hostFn(key, (_t, a, it) => m(obj, a, it));
      return undefined;
    }
    if (obj instanceof RegExp) {
      if (key === 'test') return hostFn(key, (_t, a) => obj.test(toStr(a[0])));
      if (key === 'exec') return hostFn(key, (_t, a) => obj.exec(toStr(a[0])));
      if (key === 'source' || key === 'global' || key === 'lastIndex') return obj[key];
      return undefined;
    }
    if (obj instanceof Closure || obj instanceof HostFn) {
      if (key === 'prototype') return this.prototypeOf(obj);
      if (key === 'call') return hostFn('call', (_t, a, it) => it.call(obj, a[0], a.slice(1)));
      if (key === 'apply') return hostFn('apply', (_t, a, it) => it.call(obj, a[0], Array.isArray(a[1]) ? a[1] : []));
      if (key === 'bind') return hostFn('bind', (_t, a, it) => hostFn('bound', (_t2, b) => it.call(obj, a[0], a.slice(1).concat(b))));
      if (key === 'length' && obj instanceof Closure) return obj.node.parameters.length;
      if (key === 'name') return obj instanceof HostFn ? obj.name : (obj.node.name?.getText() ?? '');
      return obj.props[key];
    }
    if (typeof obj === 'object') {
      if (Object.getPrototypeOf(obj) !== null && !isSObjChain(obj)) throw new InterpError(`foreign object access '${key}'`);
      return (obj as SObj)[key];
    }
    throw new InterpError(`cannot read '${key}' of ${typeof obj}`);
  }

  setProp(obj: unknown, key: string, value: unknown, node?: ts.Node): void {
    if (Array.isArray(obj)) {
      if (key === 'length') { obj.length = Number(value); return; }
      if (/^\d+$/.test(key)) { obj[Number(key)] = value; return; }
      (obj as unknown as SObj)[key] = value;
      return;
    }
    if (obj instanceof Closure || obj instanceof HostFn) { obj.props[key] = value; return; }
    if (obj != null && typeof obj === 'object' && !(obj instanceof RegExp)) {
      if (!isSObjChain(obj)) throw new InterpError(`foreign object write '${key}'`);
      (obj as SObj)[key] = value;
      return;
    }
    if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') return;
    if (node) this.fail(node, `cannot set property '${key}' of ${obj}`);
    throw new InterpError(`cannot set property '${key}' of ${obj}`);
  }

  private assignName(name: string, value: unknown, env: Env): void {
    const slot = env.lookup(name);
    if (slot) slot.value = value;
    else this.global.declare(name, value); // sloppy-mode implicit global
  }

  private assign(target: ts.Expression, value: unknown, env: Env): void {
    if (ts.isIdentifier(target)) { this.assignName(target.text, value, env); return; }
    if (ts.isParenthesizedExpression(target)) { this.assign(target.expression, value, env); return; }
    if (ts.isPropertyAccessExpression(target)) {
      this.setProp(this.eval(target.expression, env), target.name.text, value, target);
      return;
    }
    if (ts.isElementAccessExpression(target)) {
      const obj = this.eval(target.expression, env);
      this.setProp(obj, propKey(this.eval(target.argumentExpression, env)), value, target);
      return;
    }
    this.fail(target, 'invalid assignment target');
  }

  private evalPrefix(u: ts.PrefixUnaryExpression, env: Env): unknown {
    switch (u.operator) {
      case ts.SyntaxKind.ExclamationToken: return !truthy(this.eval(u.operand, env));
      case ts.SyntaxKind.MinusToken: return -Number(toPrim(this.eval(u.operand, env)));
      case ts.SyntaxKind.PlusToken: return Number(toPrim(this.eval(u.operand, env)));
      case ts.SyntaxKind.TildeToken: return ~Number(toPrim(this.eval(u.operand, env)));
      case ts.SyntaxKind.PlusPlusToken:
      case ts.SyntaxKind.MinusMinusToken: {
        const v = Number(toPrim(this.eval(u.operand, env))) + (u.operator === ts.SyntaxKind.PlusPlusToken ? 1 : -1);
        this.assign(u.operand, v, env);
        return v;
      }
      default: this.fail(u, 'unsupported unary operator');
    }
  }

  private evalBinary(b: ts.BinaryExpression, env: Env): unknown {
    const op = b.operatorToken.kind;
    switch (op) {
      case ts.SyntaxKind.EqualsToken: {
        const v = this.eval(b.right, env);
        this.assign(b.left, v, env);
        return v;
      }
      case ts.SyntaxKind.AmpersandAmpersandToken: { const l = this.eval(b.left, env); return truthy(l) ? this.eval(b.right, env) : l; }
      case ts.SyntaxKind.BarBarToken: { const l = this.eval(b.left, env); return truthy(l) ? l : this.eval(b.right, env); }
      case ts.SyntaxKind.QuestionQuestionToken: { const l = this.eval(b.left, env); return l != null ? l : this.eval(b.right, env); }
      case ts.SyntaxKind.CommaToken: this.eval(b.left, env); return this.eval(b.right, env);
      case ts.SyntaxKind.PlusEqualsToken:
      case ts.SyntaxKind.MinusEqualsToken:
      case ts.SyntaxKind.AsteriskEqualsToken:
      case ts.SyntaxKind.SlashEqualsToken:
      case ts.SyntaxKind.PercentEqualsToken:
      case ts.SyntaxKind.BarEqualsToken:
      case ts.SyntaxKind.AmpersandEqualsToken: {
        const base = {
          [ts.SyntaxKind.PlusEqualsToken]: ts.SyntaxKind.PlusToken,
          [ts.SyntaxKind.MinusEqualsToken]: ts.SyntaxKind.MinusToken,
          [ts.SyntaxKind.AsteriskEqualsToken]: ts.SyntaxKind.AsteriskToken,
          [ts.SyntaxKind.SlashEqualsToken]: ts.SyntaxKind.SlashToken,
          [ts.SyntaxKind.PercentEqualsToken]: ts.SyntaxKind.PercentToken,
          [ts.SyntaxKind.BarEqualsToken]: ts.SyntaxKind.BarToken,
          [ts.SyntaxKind.AmpersandEqualsToken]: ts.SyntaxKind.AmpersandToken,
        }[op] as ts.SyntaxKind;
        const v = binop(base, this.eval(b.left, env), this.eval(b.right, env), b, this);
        this.assign(b.left, v, env);
        return v;
      }
      case ts.SyntaxKind.BarBarEqualsToken: {
        const l = this.eval(b.left, env);
        if (truthy(l)) return l;
        const v = this.eval(b.right, env);
        this.assign(b.left, v, env);
        return v;
      }
      default:
        return binop(op, this.eval(b.left, env), this.eval(b.right, env), b, this);
    }
  }

  failAt(node: ts.Node, msg: string): never { this.fail(node, msg); }
}

function isSObjChain(obj: object): boolean {
  for (let p: object | null = obj; p; p = Object.getPrototypeOf(p)) {
    if (Object.getPrototypeOf(p) === null) return p !== Object.prototype && !(p instanceof Function);
  }
  return true;
}

function propKey(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean' || v == null) return String(v);
  throw new InterpError('unsupported property key');
}

function truthy(v: unknown): boolean {
  return !!v;
}

function typeOf(v: unknown): string {
  if (v instanceof Closure || v instanceof HostFn) return 'function';
  if (v === null || Array.isArray(v) || v instanceof RegExp) return 'object';
  return typeof v;
}

function instanceOf(it: Interpreter, v: unknown, ctor: unknown): boolean {
  if (ctor instanceof HostFn) {
    const check = ctor.props.__isInstance as HostFn | undefined;
    return check ? !!check.impl(undefined, [v], it) : false;
  }
  if (!(ctor instanceof Closure)) throw new InterpError('instanceof: not a function');
  if (v == null || typeof v !== 'object') return false;
  const proto = ctor.props.prototype;
  for (let p = Object.getPrototypeOf(v); p; p = Object.getPrototypeOf(p)) if (p === proto) return true;
  return false;
}

function binop(op: ts.SyntaxKind, l: unknown, r: unknown, node: ts.Node, it: Interpreter): unknown {
  switch (op) {
    case ts.SyntaxKind.EqualsEqualsEqualsToken: return l === r;
    case ts.SyntaxKind.ExclamationEqualsEqualsToken: return l !== r;
    // eslint-disable-next-line eqeqeq
    case ts.SyntaxKind.EqualsEqualsToken: return looseEq(l, r);
    case ts.SyntaxKind.ExclamationEqualsToken: return !looseEq(l, r);
    case ts.SyntaxKind.InstanceOfKeyword: return instanceOf(it, l, r);
    case ts.SyntaxKind.InKeyword: {
      if (Array.isArray(r)) return propKey(l) === 'length' || Number(propKey(l)) < r.length;
      if (r instanceof Closure || r instanceof HostFn) return propKey(l) in r.props;
      if (r != null && typeof r === 'object') return propKey(l) in (r as SObj);
      return it.failAt(node, "'in' on a non-object");
    }
    default: break;
  }
  const a = toPrim(l);
  const b = toPrim(r);
  switch (op) {
    case ts.SyntaxKind.PlusToken:
      if (typeof a === 'string' || typeof b === 'string') return toStr(a) + toStr(b);
      return (a as number) + (b as number);
    case ts.SyntaxKind.MinusToken: return (a as number) - (b as number);
    case ts.SyntaxKind.AsteriskToken: return (a as number) * (b as number);
    case ts.SyntaxKind.SlashToken: return (a as number) / (b as number);
    case ts.SyntaxKind.PercentToken: return (a as number) % (b as number);
    case ts.SyntaxKind.LessThanToken: return (a as number) < (b as number);
    case ts.SyntaxKind.GreaterThanToken: return (a as number) > (b as number);
    case ts.SyntaxKind.LessThanEqualsToken: return (a as number) <= (b as number);
    case ts.SyntaxKind.GreaterThanEqualsToken: return (a as number) >= (b as number);
    case ts.SyntaxKind.AmpersandToken: return (a as number) & (b as number);
    case ts.SyntaxKind.BarToken: return (a as number) | (b as number);
    case ts.SyntaxKind.CaretToken: return (a as number) ^ (b as number);
    case ts.SyntaxKind.LessThanLessThanToken: return (a as number) << (b as number);
    case ts.SyntaxKind.GreaterThanGreaterThanToken: return (a as number) >> (b as number);
    case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken: return (a as number) >>> (b as number);
    default: return it.failAt(node, `unsupported operator ${ts.SyntaxKind[op]}`);
  }
}

function looseEq(l: unknown, r: unknown): boolean {
  if (l == null || r == null) return l == null && r == null;
  if (typeof l === 'object' || typeof r === 'object' || l instanceof Closure || r instanceof Closure) {
    if (typeof l === typeof r) return l === r;
    if (Array.isArray(l) || Array.isArray(r)) return toStr(l) === toStr(r);
    return l === r;
  }
  // primitives: JS loose equality is safe here
  // eslint-disable-next-line eqeqeq
  return l == r;
}

/** Pure globals every interpreted program gets (Math, parseInt, String, ...). */
function standardGlobals(): Record<string, unknown> {
  const math = sobj({ PI: Math.PI, E: Math.E, SQRT2: Math.SQRT2 });
  for (const k of ['abs', 'ceil', 'floor', 'round', 'max', 'min', 'sqrt', 'pow', 'sin', 'cos', 'tan', 'atan', 'atan2', 'asin', 'acos', 'log', 'exp', 'sign', 'trunc'] as const) {
    const f = Math[k] as (...a: number[]) => number;
    math[k] = hostFn(`Math.${k}`, (_t, a) => f(...a.map((x) => Number(toPrim(x)))));
  }
  const arrayCtor = hostFn('Array', (_t, a) => (a.length === 1 && typeof a[0] === 'number' ? new Array(a[0]) : a.slice()),
    (a) => (a.length === 1 && typeof a[0] === 'number' ? new Array(a[0]) : a.slice()));
  arrayCtor.props.isArray = hostFn('Array.isArray', (_t, a) => Array.isArray(a[0]));
  const arrayProto = sobj();
  for (const k of Object.keys(ARRAY_METHODS)) {
    arrayProto[k] = hostFn(`Array.prototype.${k}`, (t, a, it) => {
      if (!Array.isArray(t)) throw new InterpError(`Array.prototype.${k} on a non-array`);
      return ARRAY_METHODS[k](t, a, it);
    });
  }
  arrayCtor.props.prototype = arrayProto;
  const objectCtor = hostFn('Object', () => sobj(), () => sobj());
  objectCtor.props.keys = hostFn('Object.keys', (_t, a) => (a[0] != null && typeof a[0] === 'object' ? Object.keys(a[0] as SObj) : []));
  const json = sobj({
    stringify: hostFn('JSON.stringify', (_t, a) => JSON.stringify(a[0], (_k, v) => (isFn(v) ? undefined : v))),
  });
  const stringCtor = hostFn('String', (_t, a) => (a.length ? toStr(toPrim(a[0])) : ''));
  stringCtor.props.fromCharCode = hostFn('String.fromCharCode', (_t, a) => String.fromCharCode(...a.map((x) => Number(x))));
  return {
    Math: math,
    JSON: json,
    Array: arrayCtor,
    Object: objectCtor,
    parseInt: hostFn('parseInt', (_t, a) => parseInt(toStr(toPrim(a[0])), a[1] == null ? undefined : Number(a[1]))),
    parseFloat: hostFn('parseFloat', (_t, a) => parseFloat(toStr(toPrim(a[0])))),
    isNaN: hostFn('isNaN', (_t, a) => Number.isNaN(Number(toPrim(a[0])))),
    isFinite: hostFn('isFinite', (_t, a) => Number.isFinite(Number(toPrim(a[0])))),
    String: stringCtor,
    Number: hostFn('Number', (_t, a) => (a.length ? Number(toPrim(a[0])) : 0)),
    Boolean: hostFn('Boolean', (_t, a) => !!a[0]),
    encodeURIComponent: hostFn('encodeURIComponent', (_t, a) => encodeURIComponent(toStr(a[0]))),
    decodeURIComponent: hostFn('decodeURIComponent', (_t, a) => decodeURIComponent(toStr(a[0]))),
    console: sobj({ log: hostFn('console.log', () => undefined), warn: hostFn('console.warn', () => undefined) }),
  };
}

export { toStr };
