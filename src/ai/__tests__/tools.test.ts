import { afterEach, describe, expect, it } from 'vitest';
import { readAttr } from '../../railway/object-data';
import { collectObjects } from '../../railway/validation';
import { SCRIPT_TEMPLATES } from '../../railway-script/templates';
import { catalogueKindIds } from '../system-prompt';
import { AI_KIND_IDS, AI_TOOLS } from '../tool-defs';
import { executeAiTool } from '../tools';
import type { TestTarget } from './helpers';
import { createTestTarget } from './helpers';

const STATION = SCRIPT_TEMPLATES.find((t) => t.id === 'station-two-points')!.text;

const BLOCK = `railwayScript: 1
name: Block
tracks:
  - { id: T1, startKm: 0.000, endKm: 3.000 }
axleCounters:
  - { id: AC1, track: T1, at: 0.100 }
  - { id: AC2, track: T1, at: 1.500 }
  - { id: AC3, track: T1, at: 2.900 }
sections:
  - { id: TS1, track: T1, from: AC1, to: AC2 }
  - { id: TS2, track: T1, from: AC2, to: AC3 }
signals:
  - { id: S1, track: T1, at: 0.200, direction: nominal, type: main, aspects: 3 }
  - { id: S2, track: T1, at: 1.600, direction: nominal, type: main, aspects: 3 }
  - { id: S3, track: T1, at: 2.800, direction: nominal, type: main }
`;

let t: TestTarget;
afterEach(() => t?.destroy());

function counts(target: TestTarget): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of collectObjects(target.graph.getDataModel())) out[o.kind.id] = (out[o.kind.id] ?? 0) + 1;
  return out;
}

describe('AI tool definitions', () => {
  it('every tool has a strict object schema and a unique name', () => {
    const names = new Set(AI_TOOLS.map((d) => d.name));
    expect(names.size).toBe(AI_TOOLS.length);
    for (const d of AI_TOOLS) {
      expect(d.input_schema.type).toBe('object');
      expect(d.input_schema.additionalProperties).toBe(false);
      expect(d.description.length).toBeGreaterThan(40);
    }
  });

  it('lists the catalogue kinds', () => {
    expect([...AI_KIND_IDS].sort()).toEqual(catalogueKindIds().sort());
  });
});

describe('executeAiTool', () => {
  it('rejects unknown tools and invalid input without touching the drawing', async () => {
    t = createTestTarget();
    expect((await executeAiTool(t, 'nope', {})).ok).toBe(false);
    const missing = await executeAiTool(t, 'apply_railway_script', {});
    expect(missing.ok).toBe(false);
    expect(String(missing.result.error)).toContain('script is required');
    const extra = await executeAiTool(t, 'get_drawing', { foo: 1 });
    expect(String(extra.result.error)).toContain('foo is not a known parameter');
    const wrongType = await executeAiTool(t, 'undo', { steps: 'two' });
    expect(String(wrongType.result.error)).toContain('steps expected integer');
    expect(t.canUndo()).toBe(false);
  });

  it('apply_railway_script draws the layout in one undo step', async () => {
    t = createTestTarget();
    const out = await executeAiTool(t, 'apply_railway_script', { script: STATION });
    expect(out.ok).toBe(true);
    expect(out.summary).toBe('Applied Railway Script: 2 tracks, 2 points, 4 signals, 4 routes');
    expect(out.edits).toHaveLength(1);
    expect(counts(t)).toMatchObject({ track: 2, points: 2, signal: 4, route: 4 });
    expect(t.scriptStore.get()).toBe(STATION);
    t.undo();
    expect(counts(t)).toEqual({});
    expect(t.canUndo()).toBe(false);
  });

  it('apply_railway_script returns errors with line:col and changes nothing', async () => {
    t = createTestTarget();
    await executeAiTool(t, 'apply_railway_script', { script: BLOCK });
    const before = t.modelXml();
    const bad = BLOCK.replace('direction: nominal, type: main, aspects: 3 }\n  - { id: S2', 'direction: sideways, type: main, aspects: 3 }\n  - { id: S2');
    const out = await executeAiTool(t, 'apply_railway_script', { script: bad });
    expect(out.ok).toBe(false);
    expect(out.edits).toHaveLength(0);
    const errors = out.result.errors as Array<{ line: number; col: number; message: string }>;
    expect(errors[0].line).toBe(13);
    expect(errors[0].col).toBeGreaterThan(1);
    expect(errors[0].message).toContain('sideways');
    expect(t.modelXml()).toBe(before);
    expect(t.scriptStore.get()).toBe(BLOCK);
  });

  it('get_drawing returns the stored script, counts and other cells', async () => {
    t = createTestTarget();
    await executeAiTool(t, 'apply_railway_script', { script: BLOCK });
    await executeAiTool(t, 'add_shapes', { shapes: [{ shape: 'Rectangle', label: 'RBC <b>room</b>', x: 40, y: 300 }] });
    const out = await executeAiTool(t, 'get_drawing', {});
    expect(out.ok).toBe(true);
    const script = out.result.railwayScript as { source: string; text: string; inSyncWithDrawing: boolean };
    expect(script.source).toBe('stored');
    expect(script.text).toBe(BLOCK);
    expect(script.inSyncWithDrawing).toBe(true);
    expect(out.result.railwayObjects).toMatchObject({ track: 1, signal: 3, axleCounter: 3, trackSection: 2 });
    const other = out.result.otherCells as { count: number; items: Array<Record<string, unknown>> };
    expect(other.count).toBe(1);
    expect(other.items[0]).toMatchObject({ label: 'RBC room', x: 40, y: 300, w: 120, h: 60 });
  });

  it('get_drawing generates a script for a drawing without one', async () => {
    t = createTestTarget();
    await executeAiTool(t, 'apply_railway_script', { script: BLOCK });
    t.scriptStore.set('', 'load');
    const out = await executeAiTool(t, 'get_drawing', { includeScript: true });
    const script = out.result.railwayScript as { source: string; text: string };
    expect(script.source).toContain('generated');
    expect(script.text).toContain('railwayScript: 1');
    expect(script.text).toContain('S2');
  });

  it('add_shapes adds catalogue shapes, styles, ERTMS symbols and connectors in one step', async () => {
    t = createTestTarget();
    const out = await executeAiTool(t, 'add_shapes', {
      shapes: [
        { key: 'a', shape: 'Rectangle', label: 'Interlocking', x: 0, y: 0, width: 160, style: 'fillColor=#dae8fc;' },
        { key: 'db', shape: 'general-5-cylinder', label: 'Data', x: 300, y: 0 },
        { key: 'h', shape: 'shape=hexagon;perimeter=hexagonPerimeter2;', x: 0, y: 200, width: 80, height: 60 },
        { key: 's', shape: 'Signal Right 3', x: 400, y: 200 },
      ],
      edges: [
        { from: 'a', to: 'db', label: 'data' },
        { from: 'a', to: 'h' },
      ],
    });
    expect(out.ok).toBe(true);
    expect(out.edits).toHaveLength(1);
    const added = out.result.added as Array<{ key: string; id: string; kind?: string; objectId?: string }>;
    expect(added).toHaveLength(4);
    const model = t.graph.getDataModel();
    const rect = model.getCell(added[0].id)!;
    expect(rect.getValue()).toBe('Interlocking');
    expect(rect.getGeometry()!.width).toBe(160);
    expect((rect.getStyle() as Record<string, unknown>).fillColor).toBe('#dae8fc');
    expect((model.getCell(added[2].id)!.getStyle() as Record<string, unknown>).shape).toBe('hexagon');
    expect(added[3]).toMatchObject({ kind: 'signal', objectId: 'S1' });
    expect(out.result.edges).toHaveLength(2);
    t.undo();
    expect(model.getCell(added[0].id)).toBeFalsy();
  });

  it('add_shapes reports unknown shapes and edge ends', async () => {
    t = createTestTarget();
    const bad = await executeAiTool(t, 'add_shapes', { shapes: [{ shape: 'zzzqqq', x: 0, y: 0 }] });
    expect(bad.ok).toBe(false);
    expect(String(bad.result.error)).toContain('unknown shape');
    const edge = await executeAiTool(t, 'add_shapes', { shapes: [{ key: 'a', shape: 'Rectangle', x: 0, y: 0 }], edges: [{ from: 'a', to: 'missing' }] });
    expect(edge.ok).toBe(false);
    expect(String(edge.result.error)).toContain('unknown end missing');
  });

  it('search_shapes finds palette and ERTMS entries by words and tags', async () => {
    t = createTestTarget();
    const db = await executeAiTool(t, 'search_shapes', { query: 'database' });
    expect((db.result.results as Array<{ name: string }>)[0].name).toBe('general-5-cylinder');
    const sig = await executeAiTool(t, 'search_shapes', { query: 'signal right', limit: 3 });
    const results = sig.result.results as Array<{ title: string; palette: string }>;
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].palette).toBe('ERTMS');
    expect(results[0].title.toLowerCase()).toContain('signal right');
  });

  it('set_states sets state, aspect and position in one step and reports bad values', async () => {
    t = createTestTarget();
    await executeAiTool(t, 'apply_railway_script', { script: BLOCK });
    const out = await executeAiTool(t, 'set_states', {
      items: [
        { id: 'TS1', state: 'occupied' },
        { id: 's1', aspect: 'proceed' },
        { id: 'S2', aspect: 'purple' },
        { id: 'X9', state: 'free' },
      ],
    });
    expect(out.ok).toBe(true);
    expect(out.edits).toHaveLength(1);
    const objs = new Map(collectObjects(t.graph.getDataModel()).map((o) => [`${o.kind.id}:${o.id}`, o.cell]));
    expect(readAttr(objs.get('trackSection:TS1')!, 'rdState')).toBe('occupied');
    expect(readAttr(objs.get('signal:S1')!, 'rdAspect')).toBe('proceed');
    const problems = out.result.problems as string[];
    expect(problems.some((p) => p.includes('purple'))).toBe(true);
    expect(problems.some((p) => p.includes('X9: not found'))).toBe(true);
    const reset = await executeAiTool(t, 'set_states', { resetAll: true });
    expect(reset.ok).toBe(true);
    expect(readAttr(objs.get('trackSection:TS1')!, 'rdState')).toBe('');
  });

  it('routes: find, add, list and set', async () => {
    t = createTestTarget();
    await executeAiTool(t, 'apply_railway_script', { script: STATION.replace(/routes:[\s\S]*$/, '') });
    const found = await executeAiTool(t, 'routes', { action: 'find', from: 'S1', to: 'S3' });
    const paths = found.result.paths as Array<{ points: string[] }>;
    expect(paths.length).toBeGreaterThan(0);
    expect(paths[0].points).toContain('W1:reverse');
    const added = await executeAiTool(t, 'routes', { action: 'add', from: 'S1', to: 'S3', id: 'R7' });
    expect(added.ok).toBe(true);
    expect(added.edits).toHaveLength(1);
    expect(added.result.id).toBe('R7');
    const listed = await executeAiTool(t, 'routes', { action: 'list' });
    expect((listed.result.routes as Array<{ id: string }>).map((r) => r.id)).toContain('R7');
    const set = await executeAiTool(t, 'routes', { action: 'set', id: 'R7' });
    expect(set.ok).toBe(true);
    const w1 = collectObjects(t.graph.getDataModel()).find((o) => o.id === 'W1')!;
    expect(readAttr(w1.cell, 'rdPosition')).toBe('reverse');
    const missing = await executeAiTool(t, 'routes', { action: 'add', from: 'S1' });
    expect(String(missing.result.error)).toContain('"to"');
  });

  it('delete_cells deletes by object id and everything with all', async () => {
    t = createTestTarget();
    await executeAiTool(t, 'apply_railway_script', { script: BLOCK });
    const out = await executeAiTool(t, 'delete_cells', { ids: ['S3', 'nothing'] });
    expect(out.result).toMatchObject({ deleted: 1, notFound: ['nothing'] });
    expect(counts(t).signal).toBe(2);
    const all = await executeAiTool(t, 'delete_cells', { all: true });
    expect(all.ok).toBe(true);
    expect(counts(t)).toEqual({});
    expect(t.scriptStore.get()).toBe('');
  });

  it('list_templates and insert_template use the ERTMS templates', async () => {
    t = createTestTarget();
    const list = await executeAiTool(t, 'list_templates', { query: 'level transition' });
    const templates = list.result.templates as Array<{ id: string; name: string }>;
    expect(templates.length).toBeGreaterThan(0);
    const ins = await executeAiTool(t, 'insert_template', { id: templates[0].id, mode: 'intoTab', at: { x: 400, y: 300 } });
    expect(ins.ok).toBe(true);
    expect(ins.edits).toHaveLength(1);
    expect(Number(ins.result.insertedCells)).toBeGreaterThan(0);
    const tab = await executeAiTool(t, 'insert_template', { id: templates[0].id, mode: 'newTab' });
    expect(tab.result.tab).toBe(templates[0].name);
    expect((await executeAiTool(t, 'insert_template', { id: 'zzz' })).ok).toBe(false);
  }, 30_000);

  it('check_drawing reports issues', async () => {
    t = createTestTarget();
    await executeAiTool(t, 'add_shapes', { shapes: [{ shape: 'Signal Right 3', x: 0, y: 0 }, { shape: 'Signal Right 3', x: 200, y: 0 }] });
    const objs = collectObjects(t.graph.getDataModel());
    // give both the same id
    const { setRailwayData } = await import('../../railway/object-data');
    setRailwayData(t.graph.getDataModel(), [objs[1].cell], { values: { id: objs[0].id } });
    const out = await executeAiTool(t, 'check_drawing', {});
    expect(Number(out.result.errors)).toBeGreaterThan(0);
    expect((out.result.issues as Array<{ rule: string }>).some((i) => i.rule === 'duplicate-id')).toBe(true);
  });

  it('export_drawing returns text, images and downloads', async () => {
    t = createTestTarget();
    await executeAiTool(t, 'apply_railway_script', { script: BLOCK });
    const railml = await executeAiTool(t, 'export_drawing', { format: 'railml', download: true });
    expect(String(railml.result.text)).toContain('<railML');
    expect(t.downloads[0]).toMatchObject({ name: 'Test diagram.railml', mime: 'application/xml' });
    const yaml = await executeAiTool(t, 'export_drawing', { format: 'railway-script-yaml' });
    expect(yaml.result.text).toBe(BLOCK);
    const json = await executeAiTool(t, 'export_drawing', { format: 'railway-script-json' });
    expect(JSON.parse(String(json.result.text)).railwayScript).toBe(1);
    const drawio = await executeAiTool(t, 'export_drawing', { format: 'drawio' });
    expect(String(drawio.result.text)).toContain('<mxfile>');
    const png = await executeAiTool(t, 'export_drawing', { format: 'png' });
    expect(png.image).toEqual({ mediaType: 'image/png', data: 'iVBORw0KGgo=' });
    expect(png.edits).toHaveLength(0);
  });

  it('undo undoes the given number of steps', async () => {
    t = createTestTarget();
    await executeAiTool(t, 'add_shapes', { shapes: [{ shape: 'Rectangle', x: 0, y: 0 }] });
    await executeAiTool(t, 'add_shapes', { shapes: [{ shape: 'Ellipse', x: 200, y: 0 }] });
    const out = await executeAiTool(t, 'undo', { steps: 5 });
    expect(out.result.undone).toBe(2);
    expect(t.graph.getDataModel().getRoot()!.getChildAt(0).getChildCount()).toBe(0);
  });
});
