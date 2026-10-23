import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { Cell, Graph } from '@maxgraph/core';
import {
  GRAPH_INSTALLERS,
  graphInstallerNames,
  graphProfileOf,
  setupGraph,
  teardownGraph,
  type GraphProfile,
} from '../../ui/setup-graph';
import { installDrawioHtmlLabels } from '../../drawio-shapes/engine/html-labels';
import { isInstalled } from '../../core/install-once';
import { createGraphFeature } from '../../core/graph-feature';

const SRC = join(__dirname, '..', '..');
const graphs: Graph[] = [];

function makeGraph(profile: GraphProfile): Graph {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const graph = new Graph(div);
  setupGraph(graph, profile);
  graphs.push(graph);
  return graph;
}

afterEach(() => {
  for (const g of graphs.splice(0)) {
    teardownGraph(g);
    const div = g.container;
    g.destroy();
    div.remove();
  }
});

describe('setupGraph composition', () => {
  const editor = graphInstallerNames('editor');
  const before = (a: string, b: string, names = editor): void => {
    expect(names.indexOf(a), `${a} installed`).toBeGreaterThanOrEqual(0);
    expect(names.indexOf(b), `${b} installed`).toBeGreaterThanOrEqual(0);
    expect(names.indexOf(a), `${a} before ${b}`).toBeLessThan(names.indexOf(b));
  };

  it('has unique installer names', () => {
    const names = GRAPH_INSTALLERS.map((i) => i.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('builds the label chain user-object → drawio-compat (placeholders, light-dark) → html sanitizer', () => {
    for (const profile of ['editor', 'view', 'thumbnail'] as const) {
      const names = graphInstallerNames(profile);
      before('user-object-labels', 'drawio-compat', names);
      before('drawio-compat', 'html-labels', names);
    }
  });

  it('keeps the sanitizing getLabel the OUTERMOST wrapper after the whole editor setup', () => {
    const graph = makeGraph('editor');
    const getLabel = graph.getLabel;
    // installDrawioHtmlLabels only re-wraps when something wrapped getLabel after it
    installDrawioHtmlLabels(graph);
    expect(graph.getLabel).toBe(getLabel);
    const cell = graph.insertVertex(graph.getDefaultParent(), null, '<b>x</b><img src=x onerror=alert(1)>', 0, 0, 10, 10, { html: 1 } as never);
    const label = graph.getLabel(cell) ?? '';
    expect(label).toContain('<b>x</b>');
    expect(label).not.toMatch(/onerror/);
  });

  it('orders the double wraps (inner before outer)', () => {
    // isCellResizable / isValidDropTarget: draw.io behaviour (containers, tables) inside
    before('drawio-behaviour', 'railway-split-rules');
    // createVertexHandler / createEdgeHandler: draw.io handles inside press-to-move / edge ends
    before('drawio-handles', 'press-to-move');
    before('drawio-handles', 'drawio-edge-ends');
    // cell locks wrap the draw.io behaviour predicates
    before('drawio-behaviour', 'cell-lock');
    // hover arrows hook the ConnectionHandler after the draw.io connection start
    before('drawio-connection-start', 'hover-arrow-connection-hooks');
  });

  it('lock predicates win over the behaviour installed before them', () => {
    const graph = makeGraph('editor');
    const parent = graph.getDefaultParent();
    const locked = graph.insertVertex(parent, null, 'a', 0, 0, 40, 40, { locked: 1 } as never) as Cell;
    const free = graph.insertVertex(parent, null, 'b', 100, 0, 40, 40) as Cell;
    expect(graph.isCellLocked(locked)).toBe(true);
    expect(graph.isCellDeletable(locked)).toBe(false);
    expect(graph.isCellMovable(locked)).toBe(false);
    expect(graph.isCellResizable(locked)).toBe(false);
    expect(graph.isCellRotatable(locked)).toBe(false);
    expect(graph.isValidSource(locked)).toBe(false);
    expect(graph.isCellDeletable(free)).toBe(true);
    expect(graph.isCellMovable(free)).toBe(true);
    expect(graph.isCellResizable(free)).toBe(true);
  });

  it('differs per profile', () => {
    const view = graphInstallerNames('view');
    const thumb = graphInstallerNames('thumbnail');
    expect(editor).toEqual(expect.arrayContaining(['editor-defaults', 'cell-lock', 'drawio-handles', 'panning', 'canvas-scroll', 'stencil-autoload']));
    expect(editor).not.toContain('read-only-defaults');
    expect(view).toContain('stencil-autoload');
    expect(thumb).not.toContain('stencil-autoload');
    for (const names of [view, thumb]) {
      expect(names).toContain('read-only-defaults');
      for (const editing of ['editor-defaults', 'cell-lock', 'drawio-behaviour', 'drawio-handles', 'panning', 'canvas-scroll', 'press-to-move']) {
        expect(names).not.toContain(editing);
      }
    }
    const e = makeGraph('editor');
    const v = makeGraph('view');
    const t = makeGraph('thumbnail');
    expect(e.isEnabled()).toBe(true);
    expect(v.isEnabled()).toBe(false);
    expect(t.isEnabled()).toBe(false);
    expect(graphProfileOf(e)).toBe('editor');
    expect(graphProfileOf(v)).toBe('view');
    expect(graphProfileOf(t)).toBe('thumbnail');
    expect(isInstalled(e, 'cell-lock')).toBe(true);
    expect(isInstalled(v, 'cell-lock')).toBe(false);
  });

  it('runs once per graph and profile', () => {
    const graph = makeGraph('editor');
    const getLabel = graph.getLabel;
    const createVertexHandler = graph.createVertexHandler;
    setupGraph(graph, 'editor');
    expect(graph.getLabel).toBe(getLabel);
    expect(graph.createVertexHandler).toBe(createVertexHandler);
  });
});

describe('every graph goes through setupGraph', () => {
  const files = (): string[] => {
    const out: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
          if (name !== '__tests__') walk(path);
        } else if (name.endsWith('.ts')) out.push(path);
      }
    };
    walk(SRC);
    return out;
  };

  it('tabs, the scenario view and the thumbnails call setupGraph with their profile', () => {
    const read = (p: string): string => readFileSync(join(SRC, p), 'utf8');
    expect(read('ui/tabs.ts')).toContain("setupGraph(graph, 'editor')");
    expect(read('scenarios/scenario-view.ts')).toContain("setupGraph(graph, 'view')");
    expect(read('ui/drawio-palette/thumbnail-renderer.ts')).toContain("setupGraph(graph, 'thumbnail')");
  });

  it('every `new Graph(` in src is followed by setupGraph in the same file', () => {
    const offenders = files().filter((f) => {
      const text = readFileSync(f, 'utf8');
      return /new Graph\(/.test(text) && !/setupGraph\(graph, '(editor|view|thumbnail)'\)/.test(text);
    });
    expect(offenders.map((f) => relative(SRC, f))).toEqual([]);
  });

  it('no module outside setup-graph.ts installs the per-graph installers directly', () => {
    const installers = [
      'installCellLocking', 'installDrawioHtmlLabels', 'installUserObjectLabels', 'installDrawioHandles',
      'installDrawioBehaviour', 'installCanvasScroll', 'installRailwaySplitRules', 'installGroupBackgroundHit',
      'installStencilAutoload', 'installDanglingEdgeStyles', 'installInheritStyleValues',
    ];
    const re = new RegExp(`\\b(${installers.join('|')})\\(graph`, 'g');
    const offenders: string[] = [];
    for (const f of files()) {
      const rel = relative(SRC, f).replace(/\\/g, '/');
      if (rel === 'ui/setup-graph.ts') continue;
      // code only (doc comments mention the installers)
      const text = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const m of text.matchAll(re)) {
        // the definition itself
        if (text.slice(Math.max(0, (m.index ?? 0) - 9), m.index).endsWith('function ')) continue;
        offenders.push(`${rel}: ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('createGraphFeature', () => {
  it('installs on new graphs, uninstalls from removed ones and on dispose', () => {
    const a = {} as Graph;
    const b = {} as Graph;
    const log: string[] = [];
    const feature = createGraphFeature('t', (g) => {
      const id = g === a ? 'a' : 'b';
      log.push(`+${id}`);
      return () => log.push(`-${id}`);
    });
    feature.sync([a]);
    feature.sync([a, b]);
    feature.sync([b]);
    expect(feature.has(a)).toBe(false);
    feature.dispose();
    expect(log).toEqual(['+a', '+b', '-a', '-b']);
  });
});
