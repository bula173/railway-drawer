/**
 * Drawing pages of a DiagramDocument: listing, showing another page (the main page and the edited
 * page are written back in file order), adding / renaming / removing pages, the cache entry while
 * another page is shown, and the undoable page settings change.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { UndoManager, InternalEvent, type Graph } from '@maxgraph/core';
import { createTestGraph, cleanupTestGraph } from '../../__tests__/setup';
import { DiagramDocument } from '../diagram-document';
import { registerDrawioCodecs } from '../../services/drawio-xml';
import { on } from '../../core/event-bus';

const page = (id: string, name: string, cell: string): string =>
  `<diagram id="${id}" name="${name}"><mxGraphModel pageWidth="827" pageHeight="1169"><root><mxCell id="0"/><mxCell id="1" parent="0"/>` +
  `<mxCell id="${cell}" value="${cell}" style="rounded=1;" vertex="1" parent="1"><mxGeometry x="10" y="20" width="80" height="40" as="geometry"/></mxCell>` +
  '</root></mxGraphModel></diagram>';

const FILE = `<mxfile host="railway-drawer">${page('main', 'Station', 'A')}${page('p2', 'Line', 'B')}${page('p3', 'Depot', 'C')}</mxfile>`;

function diagrams(xml: string): Array<{ id: string; name: string; cells: string[] }> {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  return Array.from(doc.getElementsByTagName('diagram')).map((d) => ({
    id: d.getAttribute('id') ?? '',
    name: d.getAttribute('name') ?? '',
    cells: Array.from(d.getElementsByTagName('mxCell'))
      .map((c) => c.getAttribute('value') ?? '')
      .filter(Boolean),
  }));
}

describe('DiagramDocument pages', () => {
  const graphs: Graph[] = [];
  async function openFile(xml = FILE): Promise<DiagramDocument> {
    const graph = createTestGraph();
    graphs.push(graph);
    const doc = new DiagramDocument(graph);
    doc.applyParsedProject(await doc.parseProjectXml(xml));
    return doc;
  }

  beforeAll(() => registerDrawioCodecs());
  afterEach(() => graphs.splice(0).forEach(cleanupTestGraph));

  it('lists the drawing pages and shows another one, writing every page back in order', async () => {
    const doc = await openFile();
    expect(doc.listPages().map((p) => [p.index, p.id, p.name, p.shown])).toEqual([
      [0, 'main', 'Station', true],
      [1, 'p2', 'Line', false],
      [2, 'p3', 'Depot', false],
    ]);
    const events: Graph[] = [];
    const stop = on('rd-pages-changed', ({ graph }) => events.push(graph));
    await doc.showPage(2);
    stop();
    expect(events).toEqual([doc.graph]);
    expect(doc.shownPageIndex()).toBe(2);
    expect(doc.graph.getDataModel().getCell('C')).toBeTruthy();
    // edit page 3, then go to page 2: both edits survive in the saved file
    const model = doc.graph.getDataModel();
    model.beginUpdate();
    try {
      model.setValue(model.getCell('C')!, 'C2');
    } finally {
      model.endUpdate();
    }
    await doc.showPage(1);
    expect(diagrams(doc.getProjectXml())).toEqual([
      { id: 'main', name: 'Station', cells: ['A'] },
      { id: 'p2', name: 'Line', cells: ['B'] },
      { id: 'p3', name: 'Depot', cells: ['C2'] },
    ]);
    // the main page is page 1 of a share / save while page 2 is shown
    expect(doc.getMainPageModelXml()).toContain('value="A"');
    expect(await doc.getPageModelXml(2)).toContain('value="C2"');
    await doc.showPage(0);
    expect(doc.graph.getDataModel().getCell('A')).toBeTruthy();
    expect(diagrams(doc.getProjectXml()).map((d) => d.cells)).toEqual([['A'], ['B'], ['C2']]);
  });

  it('keeps an unedited page byte-identical (compressed pages stay compressed)', async () => {
    const doc = await openFile();
    const before = doc.getPreservedPages().extraPages[0];
    await doc.showPage(1);
    await doc.showPage(0);
    expect(doc.getPreservedPages().extraPages[0]).toBe(before);
  });

  it('adds, renames and removes pages', async () => {
    const doc = await openFile();
    const index = doc.addPage('Sheet 4');
    expect(index).toBe(3);
    doc.renamePage(1, 'Main line');
    await doc.showPage(3);
    expect(doc.graph.getChildVertices(doc.graph.getDefaultParent())).toHaveLength(0);
    await doc.removePage(3);
    expect(doc.shownPageIndex()).toBe(0);
    await doc.removePage(0); // the main page stays
    expect(doc.listPages().map((p) => p.name)).toEqual(['Station', 'Main line', 'Depot']);
    const ids = doc.listPages().map((p) => p.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('caches the main page while another page is shown; a restore shows the main page', async () => {
    const doc = await openFile();
    await doc.showPage(1);
    const entry = JSON.parse(doc.cacheEntryJson({ id: 't', name: 'Station', now: 1, active: true }, undefined));
    expect(entry.graphXml).toContain('value="A"');
    expect(entry.extraPages).toHaveLength(2);
    const graph = createTestGraph();
    graphs.push(graph);
    const restored = new DiagramDocument(graph);
    restored.restoreCacheEntry(entry);
    restored.load(entry.graphXml);
    expect(restored.shownPageIndex()).toBe(0);
    expect(diagrams(restored.getProjectXml()).map((d) => d.cells)).toEqual([['A'], ['B'], ['C']]);
  });

  it('changes the page settings as one undoable edit', async () => {
    const doc = await openFile();
    const undo = new UndoManager();
    const listener = (_s: unknown, evt: { getProperty(n: string): unknown }): void => undo.undoableEditHappened(evt.getProperty('edit') as never);
    doc.graph.getDataModel().addListener(InternalEvent.UNDO, listener as never);
    const events: Graph[] = [];
    const stop = on('rd-page-settings', ({ graph }) => events.push(graph));
    doc.setPageSettings({ pageWidth: 1654, pageHeight: 1169, pageScale: 2 });
    expect(doc.getPageSettings()).toMatchObject({ pageWidth: 1654, pageHeight: 1169, pageScale: 2 });
    expect(doc.serializeToXml()).toMatch(/pageScale="2" pageWidth="1654" pageHeight="1169"/);
    undo.undo();
    expect(doc.getPageSettings()).toMatchObject({ pageWidth: 827, pageHeight: 1169 });
    undo.redo();
    expect(doc.getPageSettings().pageWidth).toBe(1654);
    stop();
    expect(events).toHaveLength(3);
  });
});
