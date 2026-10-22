/**
 * @file schema-check.ts
 * @brief Strict validator for AI tool inputs (a JSON Schema draft-07 subset: type, enum, const,
 *        properties, required, additionalProperties false, items, minItems/maxItems, minimum/maximum,
 *        minLength/maxLength, pattern). Pure (no DOM): shared by the app, the Worker MCP endpoint and
 *        the local MCP server, so every tool input is checked against its schema wherever it comes
 *        from (model tool_use blocks, MCP clients, the bridge).
 */

export type ToolSchema = Record<string, unknown>;

export interface InputProblem {
  /** `shapes[2].x` style path ('' = the input itself). */
  path: string;
  message: string;
}

function typeOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

function typeOk(v: unknown, t: string): boolean {
  const actual = typeOf(v);
  return t === 'number' ? actual === 'number' || actual === 'integer' : actual === t;
}

function join(path: string, key: string | number): string {
  return typeof key === 'number' ? `${path}[${key}]` : path ? `${path}.${key}` : key;
}

function check(value: unknown, schema: ToolSchema, path: string, out: InputProblem[]): void {
  if (out.length >= 20) return;
  const fail = (message: string): void => {
    out.push({ path, message });
  };
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? (schema.type as string[]) : [schema.type as string];
    if (!types.some((t) => typeOk(value, t))) {
      fail(`expected ${types.join(' or ')}, got ${typeOf(value)}`);
      return;
    }
  }
  if ('const' in schema && value !== schema.const) fail(`must be ${JSON.stringify(schema.const)}`);
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    fail(`must be one of ${(schema.enum as unknown[]).map((e) => JSON.stringify(e)).join(', ')}`);
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('must be a finite number');
    if (typeof schema.minimum === 'number' && value < schema.minimum) fail(`must be >= ${schema.minimum}`);
    if (typeof schema.maximum === 'number' && value > schema.maximum) fail(`must be <= ${schema.maximum}`);
  }
  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) fail(`must have at least ${schema.minLength} characters`);
    if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) fail(`must have at most ${schema.maxLength} characters`);
    if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern).test(value)) fail(`must match ${schema.pattern}`);
  }
  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) fail(`must have at least ${schema.minItems} items`);
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) {
      fail(`must have at most ${schema.maxItems} items`);
      return;
    }
    const items = schema.items as ToolSchema | undefined;
    if (items) value.forEach((item, i) => check(item, items, join(path, i), out));
  } else if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const props = (schema.properties as Record<string, ToolSchema> | undefined) ?? {};
    for (const key of (schema.required as string[] | undefined) ?? []) {
      if (obj[key] === undefined || obj[key] === null) out.push({ path: join(path, key), message: 'is required' });
    }
    for (const [key, v] of Object.entries(obj)) {
      if (props[key]) {
        if (v !== undefined && v !== null) check(v, props[key], join(path, key), out);
      } else if (schema.additionalProperties === false) {
        out.push({ path: join(path, key), message: 'is not a known parameter' });
      } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        check(v, schema.additionalProperties as ToolSchema, join(path, key), out);
      }
    }
  }
}

/** Problems of `value` against `schema` (empty = valid). At most 20 are reported. */
export function checkInput(value: unknown, schema: ToolSchema): InputProblem[] {
  const out: InputProblem[] = [];
  check(value, schema, '', out);
  return out;
}

/** One line per problem, for tool error results. */
export function describeProblems(problems: InputProblem[]): string {
  return problems.map((p) => `${p.path || 'input'} ${p.message}`).join('; ');
}
