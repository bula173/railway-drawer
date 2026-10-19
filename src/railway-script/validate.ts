/**
 * @file validate.ts
 * @brief A small JSON Schema (draft-07 subset) validator for the Railway Script schema
 *        (schema.ts): type, enum, const, minimum/maximum/exclusiveMinimum, minLength, pattern,
 *        properties, required, additionalProperties, items, allOf/anyOf, local $ref. It interprets
 *        the published schema itself, so the app and editors using the schema agree on what is
 *        valid (a test checks this against ajv). Unknown keys (not in `properties`, no
 *        `additionalProperties`) are warnings, not errors.
 */
import type { JsonSchema } from './schema';

export type JsonPath = Array<string | number>;

export interface SchemaIssue {
  severity: 'error' | 'warning';
  path: JsonPath;
  message: string;
  /** The issue is about the key at `path` (unknown key), not its value. */
  onKey?: boolean;
}

type Json = unknown;

function typeOf(v: Json): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

function typeMatches(v: Json, t: string): boolean {
  const actual = typeOf(v);
  if (t === 'number') return actual === 'number' || actual === 'integer';
  return actual === t;
}

function describeValue(v: Json): string {
  if (typeof v === 'string') return `"${v.length > 40 ? `${v.slice(0, 40)}…` : v}"`;
  if (Array.isArray(v)) return 'a list';
  if (v !== null && typeof v === 'object') return 'a map';
  return String(v);
}

const TYPE_NAMES: Record<string, string> = { object: 'a map', array: 'a list', string: 'text', number: 'a number', integer: 'a whole number', boolean: 'true/false', null: 'null' };

export function pathText(path: JsonPath): string {
  let out = '';
  for (const p of path) out += typeof p === 'number' ? `[${p}]` : out ? `.${p}` : p;
  return out || '(document)';
}

export class SchemaValidator {
  constructor(private readonly root: JsonSchema) {}

  private resolve(schema: JsonSchema): JsonSchema {
    let s = schema;
    for (let i = 0; i < 20 && typeof s.$ref === 'string'; i++) {
      const name = (s.$ref as string).replace(/^#\/definitions\//, '');
      const target = (this.root.definitions as Record<string, JsonSchema> | undefined)?.[name];
      if (!target) throw new Error(`Unknown schema reference ${String(s.$ref)}`);
      const rest = { ...s };
      delete rest.$ref;
      s = { ...target, ...rest };
    }
    return s;
  }

  validate(value: Json): SchemaIssue[] {
    const issues: SchemaIssue[] = [];
    this.check(value, this.root, [], issues, true);
    return issues;
  }

  /** True when `value` has no errors against `schema` (warnings ignored). */
  private ok(value: Json, schema: JsonSchema, path: JsonPath): boolean {
    const tmp: SchemaIssue[] = [];
    this.check(value, schema, path, tmp, false);
    return !tmp.some((i) => i.severity === 'error');
  }

  /** Property names a schema (with its allOf/$ref parts) defines, or null when it defines none. */
  private knownProperties(schema: JsonSchema): Set<string> | null {
    const s = this.resolve(schema);
    let out: Set<string> | null = null;
    if (s.properties && typeof s.properties === 'object') out = new Set(Object.keys(s.properties as object));
    for (const part of (s.allOf as JsonSchema[] | undefined) ?? []) {
      const more = this.knownProperties(part);
      if (more) out = new Set([...(out ?? []), ...more]);
    }
    return out;
  }

  private check(value: Json, schemaIn: JsonSchema, path: JsonPath, issues: SchemaIssue[], warnUnknown: boolean): void {
    const schema = this.resolve(schemaIn);
    const err = (message: string): void => {
      issues.push({ severity: 'error', path, message });
    };
    const expected = typeof schema['x-expected'] === 'string' ? (schema['x-expected'] as string) : null;

    if (schema.type !== undefined) {
      const types = Array.isArray(schema.type) ? (schema.type as string[]) : [schema.type as string];
      if (!types.some((t) => typeMatches(value, t))) {
        err(`expected ${expected ?? types.map((t) => TYPE_NAMES[t] ?? t).join(' or ')}, got ${describeValue(value)}`);
        return;
      }
    }
    if ('const' in schema && value !== schema.const) {
      err(`must be ${JSON.stringify(schema.const)}, got ${describeValue(value)}`);
      return;
    }
    if (Array.isArray(schema.enum) && !(schema.enum as Json[]).includes(value)) {
      err(`${describeValue(value)} is not one of ${(schema.enum as Json[]).map((e) => (typeof e === 'string' ? e : String(e))).join(', ')}`);
      return;
    }
    if (typeof value === 'number') {
      if (typeof schema.minimum === 'number' && value < schema.minimum) err(`${value} is below the minimum ${schema.minimum}`);
      if (typeof schema.maximum === 'number' && value > schema.maximum) err(`${value} is above the maximum ${schema.maximum}`);
      if (typeof schema.exclusiveMinimum === 'number' && value <= schema.exclusiveMinimum) err(`must be greater than ${schema.exclusiveMinimum}`);
    }
    if (typeof value === 'string') {
      if (typeof schema.minLength === 'number' && value.length < schema.minLength) err('must not be empty');
      if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern).test(value)) err(`${describeValue(value)} is not ${expected ?? `in the form ${schema.pattern}`}`);
    }
    for (const part of (schema.allOf as JsonSchema[] | undefined) ?? []) this.check(value, part, path, issues, false);
    if (Array.isArray(schema.anyOf)) {
      const parts = schema.anyOf as JsonSchema[];
      if (!parts.some((p) => this.ok(value, p, path))) {
        // explain with the alternative of the same type, else a summary
        const sameType = parts.filter((p) => {
          const r = this.resolve(p);
          if (r.type === undefined) return false;
          const types = Array.isArray(r.type) ? (r.type as string[]) : [r.type as string];
          return types.some((t) => typeMatches(value, t));
        });
        const structural = value !== null && typeof value === 'object';
        if (sameType.length === 1 && (structural || !expected)) this.check(value, sameType[0], path, issues, warnUnknown);
        else if (parts.every((p) => Array.isArray(this.resolve(p).required) && Object.keys(this.resolve(p)).length === 1)) {
          const keys = parts.map((p) => (this.resolve(p).required as string[])[0]);
          err(`needs one of: ${keys.join(', ')}`);
        } else err(`expected ${expected ?? 'another value'}, got ${describeValue(value)}`);
        return;
      }
    }

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const obj = value as Record<string, Json>;
      for (const key of (schema.required as string[] | undefined) ?? []) {
        if (!(key in obj) || obj[key] === null || obj[key] === undefined) err(`missing required key "${key}"`);
      }
      const props = (schema.properties as Record<string, JsonSchema> | undefined) ?? {};
      for (const [key, v] of Object.entries(obj)) {
        if (props[key]) {
          if (v !== null && v !== undefined) this.check(v, props[key], [...path, key], issues, true);
        } else if (schema.additionalProperties !== undefined && typeof schema.additionalProperties === 'object') {
          this.check(v, schema.additionalProperties as JsonSchema, [...path, key], issues, true);
        }
      }
      if (warnUnknown && schema.additionalProperties === undefined) {
        const known = this.knownProperties(schema);
        if (known) {
          for (const key of Object.keys(obj)) {
            if (!known.has(key)) issues.push({ severity: 'warning', path: [...path, key], message: `unknown key "${key}" (kept, not used)`, onKey: true });
          }
        }
      }
    }
    if (Array.isArray(value) && schema.items && typeof schema.items === 'object') {
      value.forEach((item, i) => this.check(item, schema.items as JsonSchema, [...path, i], issues, true));
    }
  }
}
