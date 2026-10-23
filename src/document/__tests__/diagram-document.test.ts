/**
 * DiagramDocument (document/diagram-document.ts): the per-tab document without UI. Load / save of
 * the model with its project, pages and sections, the view hooks of a load, the project-name
 * listeners, the remote binding slot and the autosave dirty state of the cache entry.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import type { Graph } from '@maxgraph/core';
import { createTestGraph, cleanupTestGraph } from '../../__tests__/setup';
import { DiagramDocument } from '../diagram-document';
import { registerDrawioCodecs } from '../../services/drawio-xml';
import { on } from '../../core/event-bus';

const MODEL =
  '<mxGraphModel grid="0" gridSize="20"><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
  '<mxCell id="2" value="A" style="rounded=1;" vertex="1" parent="1"><mxGeometry x="10" y="20" width="80" height="40" as="geometry"/></mxCell>' +
  '</root></mxGraphModel>';

const FILE =
  '<mxfile host="railway-drawer"><diagram id="main" name="Station">' +
  MODEL +
  '</diagram><diagram id="p2" name="Notes"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>';

describe('DiagramDocument', () => {
  const graphs: Graph[] = [];
  function newDocument(opts: ConstructorParameters<typeof DiagramDocument>[1] = {}): DiagramDocument {
    const graph = createTestGraph();
    graphs.push(graph);
    return new DiagramDocument(graph, opts);
  }

  beforeAll(() => registerDrawioCodecs());
  afterEach(() => {
    graphs.splice(0).forEach(cleanupTestGraph);
    vi.restoreAllMocks();
  });

  it('loads a model through the view hooks, clears the history and serialises it back', () => {
    const applyGrid = vi.fn();
    const resetView = vi.fn();
    const clearHistory = vi.fn();
    const doc = newDocument({ commandService: { clearHistory }, view: { applyGrid, resetView } });
    const gridEvents: Graph[] = [];
    const stop = on('rd-grid-settings', ({ graph }) => gridEvents.push(graph));
    doc.load(MODEL);
    stop();
    expect(applyGrid).toHaveBeenCalledWith(doc.graph, { grid: false, gridSize: 20 });
    expect(resetView).toHaveBeenCalledWith(doc.graph);
    expect(clearHistory).toHaveBeenCalledTimes(1);
    expect(gridEvents).toEqual([doc.graph]);
    expect(doc.graph.getDataModel().getCell('2')?.getValue()).toBe('A');
    expect(doc.serializeToXml()).toContain('value="A"');
    expect(doc.hasUnsavedLoadChanges()).toBe(false);
  });

  it('keeps the current diagram when a load fails', () => {
    const doc = newDocument();
    doc.load(MODEL);
    expect(() => doc.load('<mxGraphModel><root/></mxGraphModel>')).toThrow();
    expect(doc.graph.getDataModel().getCell('2')).toBeTruthy();
  });

  it('opens a project file: name, preserved pages, sections; saves them back', async () => {
    const doc = newDocument();
    const names: string[] = [];
    doc.onProjectNameChange((name) => names.push(name));
    doc.railwayScript.set('tracks: []', 'api');
    doc.applyParsedProject(await doc.parseProjectXml(FILE));
    expect(doc.getProjectName()).toBe('Station');
    expect(names).toEqual(['Station']);
    expect(doc.getPreservedPages()).toEqual({ extraPages: [expect.stringContaining('name="Notes"')], pageId: 'main' });
    // the file has no script: the section is replaced by the file's (empty) value
    expect(doc.railwayScript.get()).toBe('');
    const saved = doc.getProjectXml();
    expect(saved).toContain('<diagram id="main" name="Station"');
    expect(saved).toContain('name="Notes"');
  });

  it('tells the project-name listeners about renames until unsubscribed', () => {
    const doc = newDocument();
    const listener = vi.fn();
    const stop = doc.onProjectNameChange(listener);
    doc.setProjectName('One');
    stop();
    doc.setProjectName('Two');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('One');
    expect(doc.getProjectName()).toBe('Two');
  });

  it('holds the remote binding: save handler and the cached binding (taken once)', () => {
    const doc = newDocument();
    expect(doc.getSaveHandler()).toBeNull();
    const save = vi.fn();
    doc.setSaveHandler(save);
    expect(doc.getSaveHandler()).toBe(save);
    doc.setRestoredRemote({ providerId: 'fake' });
    expect(doc.peekRestoredRemote()).toEqual({ providerId: 'fake' });
    expect(doc.takeRestoredRemote()).toEqual({ providerId: 'fake' });
    expect(doc.takeRestoredRemote()).toBeUndefined();
  });

  it('builds the cache entry incrementally: the model is serialised again only after a change', () => {
    const doc = newDocument();
    doc.load(MODEL);
    doc.setProjectName('Plan');
    const serialize = vi.spyOn(doc, 'serializeToXml');
    const ctx = { id: 't1', name: 'Diagram 1', now: 1000, active: false };
    const first = JSON.parse(doc.cacheEntryJson(ctx, undefined));
    expect(Object.keys(first)).toEqual(['id', 'name', 'projectName', 'graphXml']);
    expect(first).toMatchObject({ id: 't1', name: 'Diagram 1', projectName: 'Plan' });
    doc.cacheEntryJson({ ...ctx, now: 2000 }, undefined);
    expect(serialize).toHaveBeenCalledTimes(1);
    doc.graph.getDataModel().setValue(doc.graph.getDataModel().getCell('2')!, 'B');
    const changed = JSON.parse(doc.cacheEntryJson({ ...ctx, now: 3000 }, { providerId: 'fake' }));
    expect(serialize).toHaveBeenCalledTimes(2);
    expect(changed.graphXml).toContain('value="B"');
    expect(changed.remote).toEqual({ providerId: 'fake' });
  });

  it('writes sections (scenarios, script) into the cache entry and restores them', () => {
    const doc = newDocument();
    doc.load(MODEL);
    doc.scenarios.create('Entry');
    doc.railwayScript.set('tracks: []', 'api');
    const entry = JSON.parse(doc.cacheEntryJson({ id: 't1', name: 'D', now: 1, active: true }, undefined));
    expect(Object.keys(entry)).toEqual(['id', 'name', 'projectName', 'graphXml', 'scenarios', 'railwayScript']);
    const copy = newDocument();
    copy.restoreCacheEntry(entry);
    expect(copy.scenarios.list().map((s) => s.name)).toEqual(['Entry']);
    expect(copy.railwayScript.get()).toBe('tracks: []');
    expect(copy.getProjectName()).toBe('Untitled Diagram');
  });

  it('writes the cached XML of an unrestored tab back until the first edit', () => {
    const doc = newDocument();
    doc.load(MODEL);
    doc.keepUnrestoredXml('<broken/>');
    expect(JSON.parse(doc.cacheEntryJson({ id: 't', name: 'n', now: 1, active: true }, undefined)).graphXml).toBe('<broken/>');
    doc.graph.getDataModel().setValue(doc.graph.getDataModel().getCell('2')!, 'edited');
    expect(JSON.parse(doc.cacheEntryJson({ id: 't', name: 'n', now: 2, active: true }, undefined)).graphXml).toContain('edited');
  });
});
