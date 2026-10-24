/**
 * The built-in ERTMS templates mean the same after the symbol size standard (symbol-sizes.json,
 * docs/architecture/symbol-sizes.md) re-laid their signals, joints and trains: per template the
 * railway objects (kind, ID, data, place on the topology), the route paths between every pair of
 * signals, the interlocking table and conflict pairs of those routes, and the rule-check findings
 * equal the snapshot taken from the library before the change (fixtures/template-semantics.json).
 *
 * UPDATE_TEMPLATE_SEMANTICS=1 rewrites the snapshot (only for a deliberate change of meaning).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Graph } from '@maxgraph/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { parseMxLibrary } from '../../drawio-shapes/engine';
import { registerDrawioCodecs } from '../../services/drawio-xml';
import { splitErtmsLibrary } from '../../ui/templates';
import { insertTemplate } from '../../ui/templates/template-actions';
import type { DiagramTemplate } from '../../ui/templates/template-types';
import { cleanupTestGraph, createTestGraph } from '../../__tests__/setup';
import { buildConflictPairsTable, buildInterlockingTable, computeInterlocking } from '../interlocking';
import { addRoute } from '../route-store';
import { describePath, findRoutePaths } from '../routes';
import { buildTopology, locateObject } from '../topology';
import { collectObjects, validateModelReport } from '../validation';

const ROOT = resolve(__dirname, '../../..');
const FIXTURE = resolve(__dirname, 'fixtures/template-semantics.json');
const { templates } = splitErtmsLibrary(parseMxLibrary(readFileSync(resolve(ROOT, 'public/libraries/ertms.xml'), 'utf8')));

beforeAll(() => {
  registerDrawioCodecs();
  const proto = (globalThis as unknown as { SVGElement: { prototype: { getBBox?: () => unknown } } }).SVGElement.prototype;
  if (!proto.getBBox) proto.getBBox = () => ({ x: 0, y: 0, width: 20, height: 10 });
});

let graph: Graph | null = null;
afterEach(() => {
  if (graph) cleanupTestGraph(graph);
  graph = null;
});

const r1 = (n: number): number => Math.round(n * 10) / 10;

interface Semantics {
  objects: string[];
  routes: string[];
  interlocking: string[];
  conflicts: string[];
  findings: string[];
}

function semanticsOf(tpl: DiagramTemplate): Semantics {
  graph = createTestGraph();
  insertTemplate(graph, tpl, { x: 600, y: 300 });
  const model = graph.getDataModel();
  let objects = collectObjects(model);
  const topo = buildTopology(objects);
  const objectLines = objects.map((o) => {
    const loc = o.kind.id === 'track' || o.kind.id === 'trackSection' || o.kind.id === 'points' ? null : locateObject(topo, o);
    const values = Object.entries(o.values).filter(([, v]) => v !== '').sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`);
    return `${o.kind.id}:${o.id} [${values.join('; ')}]${loc ? ` @${loc.piece}+${r1(loc.along)}` : ''}`;
  }).sort();
  const signals = objects.filter((o) => o.kind.id === 'signal').sort((a, b) => a.id.localeCompare(b.id));
  const routes: string[] = [];
  const toAdd: Array<{ path: ReturnType<typeof findRoutePaths>['paths'][number]; a: (typeof signals)[number]; b: (typeof signals)[number] }> = [];
  for (const a of signals) {
    for (const b of signals) {
      if (a === b) continue;
      const found = findRoutePaths(topo, a, b);
      if (found.paths.length === 0) continue;
      routes.push(`${a.id}->${b.id}: ${found.paths.map((p) => `${describePath(p)} (${r1(p.length)})`).join(' | ')}`);
      toAdd.push({ path: found.paths[0], a, b });
    }
  }
  for (const { path, a, b } of toAdd) addRoute(graph, path, a, b);
  objects = collectObjects(model);
  const il = computeInterlocking(objects);
  const rows = (t: { rows: unknown[][] }): string[] => t.rows.map((r) => r.map((c) => String(c ?? '')).join(' | '));
  const report = validateModelReport(model);
  const findings = [...report.issues.map((i) => `${i.severity} ${i.rule} ${i.objectId ?? ''}: ${i.message}`), ...report.notes.map((n) => `note: ${String(n)}`)].sort();
  return { objects: objectLines, routes, interlocking: rows(buildInterlockingTable(il)), conflicts: rows(buildConflictPairsTable(il)), findings };
}

describe('ERTMS templates keep their meaning with the standard symbol sizes', { timeout: 300_000 }, () => {
  it('objects, routes, interlocking and rule checks equal the snapshot', () => {
    const now: Record<string, Semantics> = {};
    for (const tpl of templates) {
      now[tpl.name] = semanticsOf(tpl);
      cleanupTestGraph(graph!);
      graph = null;
    }
    if (process.env.UPDATE_TEMPLATE_SEMANTICS === '1' || !existsSync(FIXTURE)) {
      writeFileSync(FIXTURE, JSON.stringify(now, null, 1) + '\n');
    }
    const before = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Record<string, Semantics>;
    expect(Object.keys(now).sort()).toEqual(Object.keys(before).sort());
    let routes = 0;
    for (const name of Object.keys(before)) {
      expect(now[name], name).toEqual(before[name]);
      routes += before[name].routes.length;
    }
    // the snapshot is not trivially empty
    expect(routes).toBeGreaterThan(20);
  });
});
