/**
 * @file parse.ts
 * @brief Railway Script text -> YAML document (eemeli/yaml: comments and positions kept), schema
 *        validation (validate.ts with schema.ts), the model (model.ts) and diagnostics with
 *        line:column. JSON is YAML too, so `.rdl.json` files go through the same path.
 */
import { isMap, isPair, isScalar, isSeq, parseDocument } from 'yaml';
import type { Document } from 'yaml';
import type { ScriptModel } from './model';
import { readScriptModel } from './model';
import { buildRailwayScriptSchema } from './schema';
import type { JsonPath } from './validate';
import { SchemaValidator, pathText } from './validate';

export interface Diagnostic {
  severity: 'error' | 'warning';
  message: string;
  /** 1-based line and column of the start. */
  line: number;
  col: number;
  /** Offsets of the range in the text. */
  from: number;
  to: number;
  path?: JsonPath;
}

export interface ParsedScript {
  text: string;
  doc: Document;
  /** The model (null when the text has errors before the model could be read). */
  model: ScriptModel | null;
  diagnostics: Diagnostic[];
  /** True when any diagnostic is an error. */
  hasErrors: boolean;
  /** The text is JSON (starts with `{`): drawing -> text updates keep it JSON. */
  json: boolean;
}

let validator: SchemaValidator | null = null;
function getValidator(): SchemaValidator {
  validator ??= new SchemaValidator(buildRailwayScriptSchema());
  return validator;
}

/** Range of the node at `path` (its key when `onKey`); falls back to the nearest existing parent. */
export function rangeOfPath(doc: Document, path: JsonPath, onKey = false): [number, number] | null {
  for (let n = path.length; n >= 0; n--) {
    const p = path.slice(0, n);
    if (onKey && n === path.length && n > 0) {
      const parent = p.length > 1 ? doc.getIn(p.slice(0, -1), true) : doc.contents;
      if (isMap(parent)) {
        const pair = parent.items.find((it) => isPair(it) && isScalar(it.key) && String(it.key.value) === String(p[p.length - 1]));
        const key = pair && isScalar(pair.key) ? pair.key : null;
        if (key?.range) return [key.range[0], key.range[1]];
      }
      continue;
    }
    const node = p.length === 0 ? doc.contents : doc.getIn(p, true);
    const range = (node as { range?: [number, number, number] } | null)?.range;
    if (range) return [range[0], range[1]];
  }
  return null;
}

/** 1-based line and column of an offset. */
export function linePos(text: string, offset: number): { line: number; col: number } {
  const o = Math.max(0, Math.min(offset, text.length));
  let line = 1;
  let start = 0;
  for (let i = text.indexOf('\n'); i !== -1 && i < o; i = text.indexOf('\n', i + 1)) {
    line++;
    start = i + 1;
  }
  return { line, col: o - start + 1 };
}

export function parseScript(text: string): ParsedScript {
  const doc = parseDocument(text, { prettyErrors: false, keepSourceTokens: false, uniqueKeys: true });
  const diagnostics: Diagnostic[] = [];
  const at = (from: number, to: number, severity: Diagnostic['severity'], message: string, path?: JsonPath): void => {
    const pos = linePos(text, from);
    diagnostics.push({ severity, message, line: pos.line, col: pos.col, from, to: Math.max(to, from), path });
  };
  for (const e of doc.errors) at(e.pos[0], e.pos[1], 'error', e.message.split('\n')[0]);
  for (const w of doc.warnings) at(w.pos[0], w.pos[1], 'warning', w.message.split('\n')[0]);
  const json = /^\s*[{[]/.test(text);
  let model: ScriptModel | null = null;
  if (doc.errors.length === 0) {
    const value: unknown = doc.toJS({ maxAliasCount: 100 });
    if (value === null || value === undefined) {
      at(0, 0, 'error', 'The script is empty: start with "railwayScript: 1"');
    } else {
      const issues = getValidator().validate(value);
      for (const i of issues) {
        const r = rangeOfPath(doc, i.path, i.onKey) ?? [0, 0];
        at(r[0], r[1], i.severity, `${pathText(i.path)}: ${i.message}`, i.path);
      }
      if (!issues.some((i) => i.severity === 'error')) {
        const read = readScriptModel(value);
        model = read.model;
        for (const i of read.issues) {
          const r = rangeOfPath(doc, i.path) ?? [0, 0];
          at(r[0], r[1], i.severity, i.message, i.path);
        }
      }
    }
  }
  diagnostics.sort((a, b) => a.from - b.from || (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
  return { text, doc, model, diagnostics, hasErrors: diagnostics.some((d) => d.severity === 'error'), json };
}

/** Adds diagnostics for model-level issues found later (layout, routes) with their positions. */
export function diagnosticsFor(parsed: ParsedScript, issues: Array<{ severity: 'error' | 'warning'; path: JsonPath; message: string }>): Diagnostic[] {
  return issues.map((i) => {
    const r = rangeOfPath(parsed.doc, i.path) ?? [0, 0];
    const pos = linePos(parsed.text, r[0]);
    return { severity: i.severity, message: i.message, line: pos.line, col: pos.col, from: r[0], to: r[1], path: i.path };
  });
}

export function isSeqPath(doc: Document, path: JsonPath): boolean {
  return isSeq(doc.getIn(path, true));
}
