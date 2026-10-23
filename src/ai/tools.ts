/**
 * @file tools.ts
 * @brief Executors of the AI tools (tool-defs.ts) on an AiTarget (one diagram tab). Every call:
 *        input checked against the tool's JSON Schema, at most ONE undoable edit (the edits a call
 *        made are reported, so the chat can undo a whole AI turn), a compact JSON result for the
 *        model and a one-line summary for the visible log. Nothing here talks to the network.
 */
import { onModelEvent } from '../core/graph-events';
import { InternalEvent } from '@maxgraph/core';
import type { Cell, EventObject, EventSource, Graph } from '@maxgraph/core';
import type { PaletteEntry } from '../drawio-shapes/palettes';
import { getKind, kindForPaletteEntry } from '../railway/catalogue';
import type { KindId } from '../railway/catalogue';
import { applyPresetToNewCells, getCellKind } from '../railway/object-data';
import { ROUTES_LAYER_ID, addRoute } from '../railway/route-store';
import { describePath, detectConflicts, findRoutePaths, routeRecords } from '../railway/routes';
import { buildInterlockingTable, computeInterlocking, conflictMatrix, formatAspect, formatFlank } from '../railway/interlocking';
import { applyObjectStates, resetAllStates, resetObjectStates, runRouteCommand } from '../railway/state-apply';
import { resolveStateItems } from './step-actions';
import { buildTopology } from '../railway/topology';
import { collectObjects, validateModel } from '../railway/validation';
import type { RailObject } from '../railway/validation';
import { generateScript } from '../railway-script/generate';
import { parseScript } from '../railway-script/parse';
import type { Diagnostic } from '../railway-script/parse';
import { exportRailml } from '../railml/export';
import { parseDrawioStyle } from '../services/drawio-xml';
import { cloneWithTerminals, createCellsForEntry } from '../ui/drawio-palette/entry-cells';
import { checkInput, describeProblems } from './schema-check';
import {
  addScenarioStep,
  buildScenario,
  createScenario,
  deleteScenarioStep,
  exportScenario,
  listScenarios,
  reorderScenarioSteps,
  updateScenario,
  updateScenarioStep,
  viewScenario,
} from './scenario-tools';
import { resolveShape, searchShapes } from './shape-search';
import { describeTemplate, insertTemplateTool, listTemplates } from './template-tools';
import type { AiTarget } from './target';
import { ToolError, fail, findObject, ok, validIdsText } from './tool-kit';
import type { Executor, Input, ToolOutcome } from './tool-kit';
import { getToolDef } from './tool-defs';
import type { AiToolName } from './tool-defs';

/** Most characters of text a tool returns (exports, scripts). */
export const MAX_RESULT_TEXT = 100_000;

export type { ToolImage, ToolOutcome } from './tool-kit';

function cut(text: string, max = MAX_RESULT_TEXT): { text: string; truncated?: boolean; length: number } {
  return text.length > max ? { text: text.slice(0, max), truncated: true, length: text.length } : { text, length: text.length };
}

function plainLabel(graph: Graph, cell: Cell): string {
  const raw = graph.getLabel(cell);
  const text = typeof raw === 'string' ? raw : '';
  return text
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function shapeOf(cell: Cell): string {
  const style = cell.getStyle() as Record<string, unknown> | null;
  const shape = style?.shape;
  if (typeof shape === 'string' && shape) return shape.length > 60 ? `${shape.slice(0, 57)}...` : shape;
  return cell.isEdge() ? 'edge' : 'rectangle';
}

const r1 = (n: number | undefined | null): number => Math.round((Number(n) || 0) * 10) / 10;

/** "3 tracks, 2 points, 5 signals" */
export function describeCounts(counts: Partial<Record<string, number | undefined>>): string {
  const parts: string[] = [];
  for (const [kind, n] of Object.entries(counts)) {
    if (!n) continue;
    const def = getKind(kind);
    const label = def ? (n === 1 ? def.label : def.plural).toLowerCase() : kind;
    parts.push(`${n} ${label}`);
  }
  return parts.join(', ') || 'no railway objects';
}

function objectCounts(objects: RailObject[]): Partial<Record<KindId, number>> {
  const out: Partial<Record<KindId, number>> = {};
  for (const o of objects) out[o.kind.id] = (out[o.kind.id] ?? 0) + 1;
  return out;
}

function diagnosticsOut(list: Diagnostic[], severity: 'error' | 'warning', max = 15): Array<{ line: number; col: number; message: string }> {
  return list
    .filter((d) => d.severity === severity)
    .slice(0, max)
    .map((d) => ({ line: d.line, col: d.col, message: d.message }));
}

// ---------------------------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------------------------

const getDrawing: Executor = async (target, input) => {
  const graph = target.graph;
  const model = graph.getDataModel();
  const objects = collectObjects(model);
  const railwayCellIds = new Set<Cell>();
  for (const o of objects) railwayCellIds.add(o.cell);
  const maxCells = typeof input.maxCells === 'number' ? input.maxCells : 80;
  const others: Array<Record<string, unknown>> = [];
  let otherCount = 0;
  const isInsideRailway = (cell: Cell): boolean => {
    for (let p: Cell | null = cell; p; p = p.getParent()) if (railwayCellIds.has(p)) return true;
    return false;
  };
  for (const layer of model.getRoot()?.children ?? []) {
    if (layer.getId() === ROUTES_LAYER_ID) continue;
    for (const cell of layer.children ?? []) {
      if (isInsideRailway(cell)) continue;
      otherCount++;
      if (others.length >= maxCells) continue;
      const geo = cell.getGeometry();
      const item: Record<string, unknown> = { id: cell.getId(), shape: shapeOf(cell) };
      const label = plainLabel(graph, cell);
      if (label) item.label = label;
      if (cell.isEdge()) {
        item.source = cell.getTerminal(true)?.getId() ?? null;
        item.target = cell.getTerminal(false)?.getId() ?? null;
      } else if (geo) {
        Object.assign(item, { x: r1(geo.x), y: r1(geo.y), w: r1(geo.width), h: r1(geo.height) });
      }
      if ((cell.children ?? []).length > 0) item.children = cell.children!.length;
      others.push(item);
    }
  }
  const result: Record<string, unknown> = { tab: target.tabName(), railwayObjects: objectCounts(objects), otherCells: { count: otherCount, items: others } };
  if (input.includeScript !== false) {
    const stored = target.scriptStore.get();
    if (stored.trim()) {
      const session = await target.scriptSession();
      result.railwayScript = { source: 'stored', inSyncWithDrawing: !session.isDirty() && !session.status().conflict, ...cut(stored) };
    } else if (objects.length > 0) {
      result.railwayScript = { source: 'generated from the drawing (the tab has no script yet)', ...cut(generateScript(model, target.tabName()).text) };
    } else {
      result.railwayScript = { source: 'none', text: '' };
    }
  }
  return ok(`Read the drawing: ${describeCounts(objectCounts(objects))}${otherCount ? `, ${otherCount} other cells` : ''}`, result);
};

const applyRailwayScript: Executor = async (target, input) => {
  const script = String(input.script);
  const parsed = parseScript(script);
  if (parsed.hasErrors) {
    return {
      ok: false,
      summary: `Railway Script has ${parsed.diagnostics.filter((d) => d.severity === 'error').length} error(s): nothing changed`,
      result: { ok: false, applied: false, errors: diagnosticsOut(parsed.diagnostics, 'error'), warnings: diagnosticsOut(parsed.diagnostics, 'warning', 5) },
    };
  }
  const store = target.scriptStore;
  const previous = store.get();
  const session = await target.scriptSession();
  store.set(script, 'api');
  const out = await session.apply();
  if (!out.ok) {
    store.set(previous, 'api');
    return {
      ok: false,
      summary: 'Railway Script could not be drawn: nothing changed',
      result: { ok: false, applied: false, errors: diagnosticsOut(out.diagnostics, 'error'), warnings: diagnosticsOut(out.diagnostics, 'warning', 5) },
    };
  }
  const objects = session.status().lastApply?.objects ?? {};
  const counts = out.counts ?? { added: 0, updated: 0, replaced: 0, removed: 0 };
  const changed = counts.added + counts.updated + counts.replaced + counts.removed;
  return ok(changed ? `Applied Railway Script: ${describeCounts(objects)}` : 'Railway Script unchanged (the drawing already matches)', {
    ok: true,
    applied: true,
    objects,
    changes: counts,
    warnings: diagnosticsOut(out.diagnostics, 'warning'),
  });
};

async function catalogShapes(target: AiTarget) {
  return target.catalog ? target.catalog.all() : [];
}

const searchShapesTool: Executor = async (target, input) => {
  const limit = typeof input.limit === 'number' ? input.limit : 12;
  const hits = searchShapes(await catalogShapes(target), String(input.query), limit);
  return ok(`Searched shapes "${String(input.query)}": ${hits.length} found`, {
    results: hits.map((h) => ({ name: h.name, title: h.title, palette: h.palette, width: h.entry.width, height: h.entry.height })),
  });
};

function mergeStyle(base: string, extra: string): string {
  const b = base.trim();
  const e = extra.trim();
  if (!e) return b;
  return `${b}${b && !b.endsWith(';') ? ';' : ''}${e}${e.endsWith(';') ? '' : ';'}`;
}

function cellsForShape(entry: PaletteEntry, label: string | undefined, extraStyle: string | undefined, width?: number, height?: number): Cell[] {
  const single = entry.kind === 'vertex' && !!entry.style;
  if (single) {
    const style = mergeStyle(entry.style ?? '', extraStyle ?? '');
    return createCellsForEntry({ ...entry, style, value: label ?? entry.value, width: width ?? entry.width, height: height ?? entry.height });
  }
  const cells = createCellsForEntry(entry);
  if (cells.length === 1 && label !== undefined && typeof cells[0].getValue() !== 'object') cells[0].setValue(label);
  return cells;
}

const addShapes: Executor = async (target, input) => {
  const graph = target.graph;
  const model = graph.getDataModel();
  const shapes = (input.shapes as Input[] | undefined) ?? [];
  const edges = (input.edges as Input[] | undefined) ?? [];
  if (shapes.length === 0 && edges.length === 0) fail('nothing to add: give shapes and/or edges');
  const catalog = shapes.length > 0 ? await catalogShapes(target) : [];
  const prepared: Array<{ key: string; cells: Cell[]; entry: PaletteEntry }> = [];
  const unknown: string[] = [];
  for (const s of shapes) {
    const entry = resolveShape(catalog, String(s.shape));
    if (!entry) {
      unknown.push(String(s.shape));
      continue;
    }
    const cells = cellsForShape(entry, s.label as string | undefined, s.style as string | undefined, s.width as number | undefined, s.height as number | undefined);
    if (cells.length === 0) {
      unknown.push(String(s.shape));
      continue;
    }
    const clones = cloneWithTerminals(graph, cells);
    const bounds = graph.getBoundingBoxFromGeometry(clones, true);
    for (const c of clones) c.getGeometry()?.translate(Number(s.x) - (bounds?.x ?? 0), Number(s.y) - (bounds?.y ?? 0));
    const preset = kindForPaletteEntry(entry);
    if (preset) applyPresetToNewCells(model, clones.filter((c) => !c.isEdge()), preset);
    prepared.push({ key: String(s.key ?? ''), cells: clones, entry });
  }
  if (unknown.length > 0) fail(`unknown shape(s): ${unknown.slice(0, 5).join(', ')} — use search_shapes, a title like "Rectangle" or a draw.io style "shape=...;"`);
  const byKey = new Map<string, Cell>();
  const objects = collectObjects(model);
  const resolveEnd = (ref: string): Cell | null => {
    const local = byKey.get(ref);
    if (local) return local;
    const cell = model.getCell(ref);
    if (cell && cell !== model.getRoot()) return cell;
    return findObject(objects, ref)[0]?.cell ?? null;
  };
  const added: Array<{ key?: string; id: string | null; kind?: string; objectId?: string }> = [];
  const edgeIds: Array<string | null> = [];
  model.beginUpdate();
  try {
    const parent = graph.getDefaultParent();
    for (const p of prepared) {
      const inserted = graph.addCells(p.cells, parent, null, null, null);
      const top = inserted.find((c) => !c.isEdge()) ?? inserted[0];
      if (p.key && top) byKey.set(p.key, top);
      const kind = top ? getCellKind(top) : null;
      const value = top?.getValue();
      added.push({
        ...(p.key ? { key: p.key } : {}),
        id: top?.getId() ?? null,
        ...(kind ? { kind, objectId: value instanceof Element ? value.getAttribute('rdId') ?? '' : '' } : {}),
      });
    }
    for (const e of edges) {
      const source = resolveEnd(String(e.from));
      const targetCell = resolveEnd(String(e.to));
      if (!source || !targetCell) fail(`edge ${String(e.from)} -> ${String(e.to)}: unknown end ${!source ? String(e.from) : String(e.to)}`);
      const style = parseDrawioStyle(typeof e.style === 'string' && e.style.trim() ? e.style : 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;');
      const edge = graph.insertEdge(parent, null, typeof e.label === 'string' ? e.label : '', source, targetCell, style);
      edgeIds.push(edge.getId());
    }
  } finally {
    model.endUpdate();
  }
  return ok(`Added ${prepared.length} shape(s)${edgeIds.length ? ` and ${edgeIds.length} connector(s)` : ''}`, { added, edges: edgeIds });
};

const deleteCells: Executor = async (target, input) => {
  const graph = target.graph;
  const model = graph.getDataModel();
  if (input.all === true) {
    const cells = (model.getRoot()?.children ?? []).flatMap((layer) => [...(layer.children ?? [])]);
    model.beginUpdate();
    try {
      if (cells.length > 0) graph.removeCells(cells, true);
    } finally {
      model.endUpdate();
    }
    if (target.scriptStore.get().trim()) target.scriptStore.set('', 'load');
    return ok(`Deleted everything (${cells.length} top-level cells)`, { deleted: cells.length, scriptCleared: true });
  }
  const ids = (input.ids as string[] | undefined) ?? [];
  if (ids.length === 0) fail('give ids or all=true');
  const objects = collectObjects(model);
  const cells = new Set<Cell>();
  const missing: string[] = [];
  for (const id of ids) {
    const byObject = findObject(objects, id).map((o) => o.cell);
    const cell = model.getCell(id);
    const layerIds = new Set((model.getRoot()?.children ?? []).map((l) => l.getId()));
    if (byObject.length > 0) byObject.forEach((c) => cells.add(c));
    else if (cell && cell !== model.getRoot() && !layerIds.has(cell.getId())) cells.add(cell);
    else missing.push(id);
  }
  if (cells.size > 0) {
    model.beginUpdate();
    try {
      graph.removeCells([...cells], true);
    } finally {
      model.endUpdate();
    }
  }
  return ok(`Deleted ${cells.size} cell(s)${missing.length ? `; not found: ${missing.join(', ')}` : ''}`, { deleted: cells.size, notFound: missing });
};

const setStates: Executor = async (target, input) => {
  const graph = target.graph;
  const model = graph.getDataModel();
  if (input.resetAll === true) {
    const changed = resetAllStates(graph);
    return ok(`Reset all states (${changed.length} cells)`, { reset: 'all', changedCells: changed.length });
  }
  const items = (input.items as Input[] | undefined) ?? [];
  if (items.length === 0) fail('give items or resetAll=true');
  const objects = collectObjects(model);
  const { stateItems, resetCells, problems, unknown } = resolveStateItems(objects, items);
  let changed = 0;
  model.beginUpdate();
  try {
    if (resetCells.length > 0) changed += resetObjectStates(graph, resetCells).length;
    if (stateItems.length > 0) changed += applyObjectStates(graph, stateItems).length;
  } finally {
    model.endUpdate();
  }
  const okAll = problems.length === 0;
  return {
    ok: okAll || changed > 0,
    summary: `Set states on ${stateItems.length + resetCells.length} object(s)${problems.length ? ` (${problems.length} problem(s))` : ''}`,
    result: { changedCells: changed, problems, ...(unknown.length > 0 ? { validIds: validIdsText(objects) } : {}) },
  };
};

const routesTool: Executor = async (target, input) => {
  const graph = target.graph;
  const model = graph.getDataModel();
  const objects = collectObjects(model);
  const action = String(input.action);
  const signal = (key: string): RailObject => {
    const id = input[key];
    if (typeof id !== 'string' || !id.trim()) return fail(`"${key}" (a signal id) is required for ${action}`);
    return findObject(objects, id, 'signal')[0] ?? fail(`signal ${id} not found`);
  };
  if (action === 'list') {
    const routes = routeRecords(objects);
    const conflicts = detectConflicts(routes);
    return ok(`Listed ${routes.length} route(s)`, {
      routes: routes.map((r) => ({ id: r.id, from: r.entry, to: r.exit, points: r.points.map((p) => `${p.id}:${p.position}`), sections: r.sections, overlap: r.overlap })),
      conflicts: conflicts.slice(0, 50).map((c) => ({ a: c.a.id, b: c.b.id, sharedSections: c.sharedSections, opposingPoints: c.opposingPoints })),
    });
  }
  if (action === 'find' || action === 'add') {
    const entry = signal('from');
    const exit = signal('to');
    const found = findRoutePaths(buildTopology(objects), entry, exit);
    if (action === 'find') {
      return ok(`Found ${found.paths.length} path(s) ${entry.id} → ${exit.id}`, {
        paths: found.paths.map((p, i) => ({ path: i, description: describePath(p), sections: p.sections, points: p.points.map((x) => `${x.id}:${x.position}`), metres: Math.round(p.metres) })),
        ...(found.problem ? { problem: found.problem } : {}),
      });
    }
    const index = typeof input.path === 'number' ? input.path : 0;
    const path = found.paths[index] ?? fail(found.paths.length ? `path ${index} does not exist (0..${found.paths.length - 1})` : `no path from ${entry.id} to ${exit.id}${found.problem ? `: ${found.problem}` : ''}`);
    const wanted = typeof input.id === 'string' ? input.id.trim() : '';
    if (wanted && findObject(objects, wanted, 'route').length > 0) fail(`route ${wanted} exists already`);
    const edge = addRoute(graph, path, entry, exit, wanted || undefined);
    const value = edge.getValue();
    const id = value instanceof Element ? value.getAttribute('rdId') ?? '' : '';
    return ok(`Added route ${id}: ${entry.id} → ${exit.id}`, { id, description: describePath(path) });
  }
  const routeId = typeof input.id === 'string' ? input.id : fail(`"id" (route id) is required for ${action}`);
  const route = findObject(objects, routeId, 'route')[0] ?? fail(`route ${routeId} not found`);
  const res = runRouteCommand(graph, route.cell, action as 'set' | 'occupy' | 'release');
  return ok(`Route ${route.id}: ${action}`, { id: route.id, changedCells: res.changed.length, missing: res.missing });
};

const checkDrawing: Executor = async (target) => {
  const issues = validateModel(target.graph.getDataModel());
  const errors = issues.filter((i) => i.severity === 'error').length;
  return ok(`Checks: ${errors} error(s), ${issues.length - errors} warning(s)`, {
    errors,
    warnings: issues.length - errors,
    issues: issues.slice(0, 60).map((i) => ({ severity: i.severity, rule: i.rule, message: i.message, ...(i.objectId ? { object: i.objectId } : {}) })),
  });
};

function safeFileName(name: string): string {
  return (name || 'diagram').replace(/[\\/:*?"<>|]+/g, '_').trim().slice(0, 80) || 'diagram';
}

const getInterlockingTable: Executor = async (target, input) => {
  const lang = input.lang === 'pl' ? 'pl' : 'en';
  const il = computeInterlocking(collectObjects(target.graph.getDataModel()));
  const table = buildInterlockingTable(il, lang);
  return ok(`Interlocking table: ${il.routes.length} route(s), ${il.conflicts.length} conflicting pair(s)`, {
    columns: table.columns,
    rows: table.rows.slice(0, 200),
    routes: il.routes.slice(0, 200).map((r) => ({
      id: r.id,
      from: r.entry,
      to: r.exit,
      points: r.points.map((p) => ({ id: p.id, position: p.position, role: p.role })),
      sections: r.sections,
      overlap: r.overlap,
      overlapPoints: r.overlapPoints.map((p) => `${p.id}:${p.position}`),
      overlapMetres: r.overlapMetres === null ? null : Math.round(r.overlapMetres),
      flank: formatFlank(r, lang),
      aspect: formatAspect(r.aspect, lang),
      ...(r.problem ? { problem: r.problem } : {}),
    })),
  });
};

const getRouteConflicts: Executor = async (target) => {
  const il = computeInterlocking(collectObjects(target.graph.getDataModel()));
  const m = conflictMatrix(il);
  return ok(`${il.conflicts.length} conflicting route pair(s) among ${il.routes.length} route(s)`, {
    conflicts: il.conflicts.slice(0, 300),
    matrix: { routes: il.routes.map((r) => r.id), cells: il.routes.length <= 60 ? m.map((row) => row.map((c) => (c === null ? null : c.join('')))) : 'too many routes (> 60)' },
  });
};

const exportDrawing: Executor = async (target, input) => {
  const format = String(input.format);
  const base = safeFileName(target.tabName());
  const download = input.download === true && !!target.download;
  const model = target.graph.getDataModel();
  let text: string;
  let mime: string;
  let ext: string;
  if (format === 'png') {
    if (!target.renderPng) fail('PNG export is not available here');
    const data = await target.renderPng!(target.modelXml());
    if (download) target.download!(`${base}.png`, base64ToBlob(data, 'image/png'), 'image/png');
    return ok(`Exported PNG${download ? ' (downloaded)' : ''}`, { format, ...(download ? { downloaded: `${base}.png` } : {}) }, { mediaType: 'image/png', data });
  }
  switch (format) {
    case 'svg':
      if (!target.renderSvg) fail('SVG export is not available here');
      text = await target.renderSvg!(target.modelXml());
      mime = 'image/svg+xml';
      ext = 'svg';
      break;
    case 'drawio':
      text = target.projectXml();
      mime = 'application/vnd.jgraph.mxfile';
      ext = 'drawio';
      break;
    case 'railml':
      text = exportRailml(model, { title: target.tabName() }).xml;
      mime = 'application/xml';
      ext = 'railml';
      break;
    default: {
      const stored = target.scriptStore.get();
      const yaml = stored.trim() ? stored : generateScript(model, target.tabName()).text;
      if (format === 'railway-script-json') {
        const parsed = parseScript(yaml);
        if (parsed.doc.errors.length > 0) fail('the script has YAML errors');
        text = `${JSON.stringify(parsed.doc.toJS(), null, 2)}\n`;
        mime = 'application/json';
        ext = 'rdl.json';
      } else {
        text = yaml;
        mime = 'application/yaml';
        ext = 'rdl.yaml';
      }
    }
  }
  if (download) target.download!(`${base}.${ext}`, text, mime);
  return ok(`Exported ${format}${download ? ` (downloaded ${base}.${ext})` : ''}`, { format, ...cut(text), ...(download ? { downloaded: `${base}.${ext}` } : {}) });
};

function base64ToBlob(data: string, mime: string): Blob {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

const undoTool: Executor = async (target, input) => {
  const steps = typeof input.steps === 'number' ? input.steps : 1;
  let done = 0;
  for (let i = 0; i < steps && target.canUndo(); i++) {
    target.undo();
    done++;
  }
  return ok(`Undid ${done} step(s)`, { undone: done });
};

const setTitleBlock: Executor = async (target, input) => {
  if (!target.setTitleBlock) fail('print sheets are not available here');
  const result = await target.setTitleBlock!(input);
  return ok('Title block set', result as Record<string, unknown>);
};

const exportSheetsTool: Executor = async (target, input) => {
  if (!target.exportSheets) fail('print sheets are not available here');
  const pages = Array.isArray(input.pages) ? (input.pages as number[]) : [];
  const out = await target.exportSheets!(pages);
  return ok(`Exported ${out.sheets} sheet(s) as ${out.fileName}`, out);
};

const EXECUTORS: Record<AiToolName, Executor> = {
  get_drawing: getDrawing,
  apply_railway_script: applyRailwayScript,
  add_shapes: addShapes,
  search_shapes: searchShapesTool,
  delete_cells: deleteCells,
  set_states: setStates,
  routes: routesTool,
  list_templates: listTemplates,
  describe_template: describeTemplate,
  insert_template: insertTemplateTool,
  check_drawing: checkDrawing,
  get_interlocking_table: getInterlockingTable,
  get_route_conflicts: getRouteConflicts,
  export_drawing: exportDrawing,
  undo: undoTool,
  list_scenarios: listScenarios,
  create_scenario: createScenario,
  update_scenario: updateScenario,
  add_scenario_step: addScenarioStep,
  update_scenario_step: updateScenarioStep,
  delete_scenario_step: deleteScenarioStep,
  reorder_scenario_steps: reorderScenarioSteps,
  build_scenario: buildScenario,
  view_scenario: viewScenario,
  export_scenario: exportScenario,
  set_title_block: setTitleBlock,
  export_sheets: exportSheetsTool,
};

/**
 * Runs tool `name` with `input` on `target`. Never throws: unknown tools, invalid input and tool
 * failures come back as `ok: false` with an `error` the model can act on.
 */
export async function executeAiTool(target: AiTarget, name: string, input: unknown): Promise<ToolOutcome> {
  const def = getToolDef(name);
  if (!def) return { ok: false, summary: `Unknown tool ${name}`, result: { error: `unknown tool "${name}"` }, edits: [] };
  const value = input ?? {};
  const problems = checkInput(value, def.input_schema);
  if (problems.length > 0) {
    return { ok: false, summary: `${def.title}: invalid input`, result: { error: `invalid input: ${describeProblems(problems)}` }, edits: [] };
  }
  const edits: object[] = [];
  const onUndo = (_s: EventSource, evt: EventObject): void => {
    const edit = evt.getProperty('edit') as object | undefined;
    if (edit) edits.push(edit);
  };
  const offUndo = name !== 'undo' ? onModelEvent(target.graph, InternalEvent.UNDO, onUndo) : () => undefined;
  try {
    const out = await EXECUTORS[def.name](target, value as Input);
    return { ...out, edits };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!(error instanceof ToolError)) console.error('[AI] tool failed', name, error);
    return { ok: false, summary: `${def.title} failed: ${message}`, result: { error: message }, edits };
  } finally {
    offUndo();
  }
}
