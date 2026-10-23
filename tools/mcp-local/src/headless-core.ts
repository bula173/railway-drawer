/**
 * @file headless-core.ts
 * @brief Headless mode of the local MCP server: the shared tool core (src/ai/tools.ts) on a
 *        `.drawio` FILE instead of a browser tab. Imported only after headless.ts has installed the
 *        jsdom globals (maxGraph and the app modules expect a DOM). Reads the first page (plain or
 *        compressed) and its Railway Script (`<diagram rdRailwayScript>`), keeps the other pages
 *        verbatim, and writes the file back (atomically) after every change. Scenarios (step pages +
 *        the main page's index) are read into a ScenarioSet and written back, so the scenario tools work.
 */
import { readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { join } from 'node:path';
import { Graph } from '@maxgraph/core';
import type { RelayCallResult } from '../../../src/ai/bridge/relay';
import type { AiTarget, CatalogShape } from '../../../src/ai/target';
import { getToolDef } from '../../../src/ai/tool-defs';
import { executeAiTool } from '../../../src/ai/tools';
import { parseMxLibrary } from '../../../src/drawio-shapes/engine';
import { PALETTES, loadPalette } from '../../../src/drawio-shapes/palettes';
import { installSnapToTrack } from '../../../src/railway/snap';
import { RAILWAY_SCRIPT_ATTR, RailwayScriptStore, railwayScriptAttributes, readRailwayScriptAttribute } from '../../../src/railway-script/script-store';
import { ScriptSession, setSymbolsLoader } from '../../../src/railway-script/session';
import { GraphCommandService } from '../../../src/services/graph-command-service';
import { applyDrawioDefaultStyles, buildMxfile, emptyDrawioModelXml, exportModelToDrawioXml, importDrawioXmlIntoModel, registerDrawioCodecs } from '../../../src/services/drawio-xml';
import { ertmsElementsPaletteDef } from '../../../src/ui/drawio-palette/ertms-source';
import { splitErtmsLibrary } from '../../../src/ui/templates/ertms-templates';
import { SCENARIO_INDEX_ATTR, assembleScenarios, buildScenarioPages, isScenarioStepPage, scenarioIndexAttributes } from '../../../src/scenarios/scenario-format';
import { ScenarioSet } from '../../../src/scenarios/scenario-model';
import type { ScenarioData } from '../../../src/scenarios/scenario-model';

export interface DrawioFile {
  modelXml: string;
  pageId: string;
  pageName: string;
  pageAttributes: Record<string, string>;
  script: string;
  extraPages: string[];
  /** Scenarios of the first page (its `rdScenarios` index + the step pages). */
  scenarios: ScenarioData[];
}

const PAGE_CORE_ATTRS = new Set(['id', 'name']);

function decodeCompressed(text: string): string {
  return decodeURIComponent(inflateRawSync(Buffer.from(text.trim(), 'base64')).toString('latin1'));
}

/** First page of a draw.io file (or a bare `<mxGraphModel>`), its Railway Script and the other pages. */
export function readDrawioText(text: string, fallbackName: string): DrawioFile {
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  const root = doc.documentElement;
  const serializer = new XMLSerializer();
  if (root.nodeName === 'mxGraphModel') return { modelXml: text, pageId: 'page-1', pageName: fallbackName, pageAttributes: {}, script: '', extraPages: [], scenarios: [] };
  if (root.nodeName !== 'mxfile') throw new Error(`not a draw.io file (<${root.nodeName}>)`);
  const pages = Array.from(root.children).filter((e) => e.nodeName === 'diagram');
  const first = pages[0];
  if (!first) return { modelXml: emptyDrawioModelXml(), pageId: 'page-1', pageName: fallbackName, pageAttributes: {}, script: '', extraPages: [], scenarios: [] };
  const modelEl = Array.from(first.children).find((e) => e.nodeName === 'mxGraphModel');
  const modelXml = modelEl ? serializer.serializeToString(modelEl) : decodeCompressed(first.textContent ?? '');
  const pageAttributes: Record<string, string> = {};
  for (const a of Array.from(first.attributes)) if (!PAGE_CORE_ATTRS.has(a.name) && a.name !== RAILWAY_SCRIPT_ATTR && a.name !== SCENARIO_INDEX_ATTR) pageAttributes[a.name] = a.value;
  const pageModel = (page: Element): string | null => {
    const el = Array.from(page.children).find((e) => e.nodeName === 'mxGraphModel');
    try {
      return el ? serializer.serializeToString(el) : decodeCompressed(page.textContent ?? '');
    } catch {
      return null;
    }
  };
  const stepPages: Array<{ page: Element; xml: string }> = [];
  const extraPages: string[] = [];
  for (const page of pages.slice(1)) {
    const xml = isScenarioStepPage(page) ? pageModel(page) : null;
    if (xml) stepPages.push({ page, xml });
    else extraPages.push(serializer.serializeToString(page));
  }
  return {
    modelXml,
    pageId: first.getAttribute('id') ?? 'page-1',
    pageName: first.getAttribute('name') ?? fallbackName,
    pageAttributes,
    script: readRailwayScriptAttribute(first),
    extraPages,
    scenarios: assembleScenarios(first, stepPages),
  };
}

export interface HeadlessSession {
  execute(tool: string, input: Record<string, unknown>): Promise<RelayCallResult>;
  /** The current file text (what was last written). */
  fileText(): string;
  destroy(): void;
}

export function openDrawioFile(path: string, publicDir: string, log: (m: string) => void = () => undefined): HeadlessSession {
  registerDrawioCodecs();
  const name = path.replace(/^.*[\\/]/, '').replace(/\.drawio$/i, '') || 'Diagram';
  const file: DrawioFile = existsSync(path) ? readDrawioText(readFileSync(path, 'utf8'), name) : { modelXml: emptyDrawioModelXml(), pageId: 'page-1', pageName: name, pageAttributes: {}, script: '', extraPages: [], scenarios: [] };
  const scenarios = new ScenarioSet(file.scenarios);
  const container = document.createElement('div');
  const graph = new Graph(container);
  applyDrawioDefaultStyles(graph.getStylesheet());
  importDrawioXmlIntoModel(file.modelXml, graph.getDataModel());
  const commands = new GraphCommandService(graph);
  const unsnap = installSnapToTrack(graph, () => true);
  const store = new RailwayScriptStore();
  store.set(file.script, 'load');
  let library: ReturnType<typeof parseMxLibrary> | null = null;
  const entries = (): ReturnType<typeof parseMxLibrary> => (library ??= parseMxLibrary(readFileSync(join(publicDir, 'libraries', 'ertms.xml'), 'utf8')));
  setSymbolsLoader(async () => entries());
  const session = new ScriptSession(graph, store, { syncDelay: 0 });
  let lastText = '';

  const save = (): void => {
    const model = new DOMParser().parseFromString(exportModelToDrawioXml(graph.getDataModel()), 'text/xml').documentElement;
    lastText = buildMxfile(
      [{ id: file.pageId, name: file.pageName, model, attributes: { ...file.pageAttributes, ...railwayScriptAttributes(store.get()), ...scenarioIndexAttributes(scenarios.list()) } }],
      [...buildScenarioPages(scenarios.list(), new Set([file.pageId])), ...file.extraPages],
      { host: 'railway-drawer-mcp', modified: new Date().toISOString(), agent: 'Railway Drawer MCP (headless)', version: '1' }
    );
    const tmp = `${path}.tmp-${process.pid}`;
    writeFileSync(tmp, lastText, 'utf8');
    renameSync(tmp, path);
    log(`saved ${path}`);
  };

  const target: AiTarget = {
    graph,
    tabName: () => file.pageName,
    scriptStore: store,
    scriptSession: async () => session,
    undo: () => commands.undo(),
    canUndo: () => commands.canUndo(),
    nextUndoEdit: () => commands.nextUndoEdit(),
    modelXml: () => exportModelToDrawioXml(graph.getDataModel()),
    projectXml: () => lastText || (save(), lastText),
    catalog: {
      all: async () => {
        const out: CatalogShape[] = ertmsElementsPaletteDef(entries()).entries.map((entry) => ({ name: entry.id, title: entry.title, palette: 'ERTMS', entry }));
        for (const meta of PALETTES) {
          for (const entry of (await loadPalette(meta.id)).entries) out.push({ name: entry.id, title: entry.title, palette: meta.title, entry });
        }
        return out;
      },
    },
    templates: async () => splitErtmsLibrary(entries()).templates,
    scenarios: () => scenarios,
    scratchGraph: (model) => new Graph(document.createElement('div'), model, [], graph.getStylesheet()),
  };

  let queue: Promise<unknown> = Promise.resolve();
  return {
    execute(tool, input) {
      const run = async (): Promise<RelayCallResult> => {
        const before = store.get();
        const out = await executeAiTool(target, tool, input);
        if (out.edits.length > 0 || store.get() !== before || (tool === 'undo' && out.ok) || (getToolDef(tool)?.mutating && !existsSync(path))) save();
        return { ok: out.ok, summary: out.summary, result: { ...out.result, ...(out.edits.length > 0 ? { savedTo: path } : {}) }, image: out.image };
      };
      const next = queue.then(run, run);
      queue = next.catch(() => undefined);
      return next;
    },
    fileText: () => lastText,
    destroy: () => {
      session.destroy();
      unsnap();
      commands.destroy();
      graph.destroy();
    },
  };
}
