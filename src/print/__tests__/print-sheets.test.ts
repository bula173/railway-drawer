/**
 * Print sheets (src/print): sheet geometry per format / orientation / scale, the sheet setup and
 * title block persistence with a draw.io round trip, revisions, legend generation, sheet
 * references and the composed sheet SVG.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import type { Graph } from '@maxgraph/core';
import { createTestGraph, cleanupTestGraph } from '../../__tests__/setup';
import { DiagramDocument } from '../../document/diagram-document';
import { registerDrawioCodecs } from '../../services/drawio-xml';
import { formatSize, matchFormat, pageSettingsFor, readSheetSetup, sheetAttributesFor, writeRootAttributes, type SheetSetupInput } from '../sheet-setup';
import { fitPlacement, sheetGeometry, TITLE_BLOCK } from '../sheet-geometry';
import { emptyTitleBlock, sanitizeRevisions, sanitizeTitleBlock, sheetTitleValues, sheetOfText } from '../title-block';
import { buildLegend, libraryTitleIndex, symbolStyleKey } from '../legend';
import { continuationLabel, createSheetRefValue, linkTargetPageId, refreshSheetRefsInModel, refreshSheetRefsInXml, sheetRefTarget } from '../sheet-refs';
import { planSheets, readModelSheetSetup } from '../sheet-plan';
import { composeSheetSvg, fitText, wrapText } from '../sheet-svg';

const INPUT: SheetSetupInput = {
  format: 'A3',
  orientation: 'landscape',
  scaleMode: 'fixed',
  scale: 2,
  margins: { top: 10, right: 10, bottom: 10, left: 10 },
  filing: 10,
  frame: true,
  titleBlock: true,
  revisions: true,
  legend: true,
  sheetTitle: 'Układ torowy — głowica A',
  sheetNumber: '',
  drawingNumber: 'RD-001',
};

describe('sheet setup and geometry', () => {
  it('maps formats and orientations to draw.io page sizes and back', () => {
    expect(formatSize('A3', 'landscape')).toEqual({ paper: { width: 420, height: 297 }, pagePx: { width: 1654, height: 1169 } });
    expect(formatSize('A4', 'portrait').pagePx).toEqual({ width: 827, height: 1169 });
    expect(matchFormat(1654, 1169)).toEqual({ format: 'A3', orientation: 'landscape' });
    expect(matchFormat(3300, 4681)).toEqual({ format: 'A0', orientation: 'portrait' });
    expect(matchFormat(3300, 2339)).toEqual({ format: 'A1', orientation: 'landscape' });
    expect(matchFormat(1000, 1000)).toBeNull();
    expect(pageSettingsFor(INPUT)).toEqual({ pageWidth: 1654, pageHeight: 1169, pageScale: 2 });
    expect(pageSettingsFor({ ...INPUT, scaleMode: 'fit' }).pageScale).toBe(1);
  });

  it('lays out frame, title block, revisions and legend for each format', () => {
    for (const [format, orientation] of [
      ['A4', 'portrait'],
      ['A4', 'landscape'],
      ['A3', 'landscape'],
      ['A1', 'landscape'],
      ['A0', 'portrait'],
    ] as const) {
      const setup = readSheetSetup(pageSettingsFor({ ...INPUT, format, orientation }), null);
      const g = sheetGeometry({ ...setup, titleBlock: true, revisions: true, legend: true }, { revisionRows: 2, legendEntries: 3 });
      const paper = formatSize(format, orientation).paper;
      expect(g.paper).toEqual(paper);
      // frame: 20 mm on the left (10 + filing 10), 10 mm elsewhere
      expect(g.frame).toEqual({ x: 20, y: 10, width: paper.width - 30, height: paper.height - 20 });
      const tb = g.titleBlock!;
      expect(tb.x + tb.width).toBeCloseTo(g.frame.x + g.frame.width);
      expect(tb.y + tb.height).toBeCloseTo(g.frame.y + g.frame.height);
      expect(tb.width).toBe(Math.min(TITLE_BLOCK.width, g.frame.width));
      expect(g.revisions!.y + g.revisions!.height).toBeCloseTo(tb.y);
      expect(g.revisions!.height).toBe(15);
      const legend = g.legend!;
      if (format === 'A4' && orientation === 'portrait') expect(legend.y + legend.height).toBeCloseTo(g.revisions!.y); // no room beside: stacked
      else expect(legend.x + legend.width).toBeCloseTo(tb.x); // beside the title block
    }
  });

  it('converts drawing units per mm with the fixed scale and fits content into the free area', () => {
    const fixed = readSheetSetup({ pageWidth: 1654, pageHeight: 1169, pageScale: 2 }, null);
    expect(fixed.scaleMode).toBe('fit'); // no rdSheetScale attribute: fit
    const setup = { ...fixed, scaleMode: 'fixed' as const, scale: 2 };
    const g = sheetGeometry(setup, { revisionRows: 0, legendEntries: 0 });
    expect(g.unitsPerMm.x).toBeCloseTo((1654 / 420) * 2);
    expect(g.sheetInDrawing).toEqual({ x: 0, y: 0, width: 3308, height: 2338 });
    const fitted = fitPlacement(sheetGeometry(fixed, { revisionRows: 0, legendEntries: 0 }), { width: 2000, height: 200 });
    // a wide drawing goes above the blocks over the full frame width
    expect(fitted.rect.width).toBeCloseTo(380);
    const tall = fitPlacement(sheetGeometry(fixed, { revisionRows: 0, legendEntries: 0 }), { width: 100, height: 1000 });
    expect(tall.rect.height).toBeCloseTo(267); // left of the blocks, full frame height (5 mm padding)
  });

  it('persists the setup on the root cell and the draw.io page settings, undoable, through a save / open', async () => {
    registerDrawioCodecs();
    const graph = createTestGraph();
    try {
      const doc = new DiagramDocument(graph);
      const model = graph.getDataModel();
      model.beginUpdate();
      try {
        doc.setPageSettings(pageSettingsFor(INPUT));
        writeRootAttributes(model, sheetAttributesFor({ ...INPUT, margins: { top: 5, right: 5, bottom: 5, left: 5 }, legend: false }));
      } finally {
        model.endUpdate();
      }
      doc.titleBlock.set({ project: 'Stacja Łódź Kaliska', title: 'Plan schematyczny', designed: 'Józef Żółć', lang: 'pl' });
      doc.titleBlock.setRevisions([{ rev: 'A', date: '2026-10-01', description: 'Pierwsze wydanie', author: 'JŻ', checked: 'MK' }]);
      const xml = doc.getProjectXml();
      // draw.io's own attributes on <mxGraphModel>, ours on the root cell and the <diagram>
      expect(xml).toMatch(/<mxGraphModel[^>]*pageScale="2" pageWidth="1654" pageHeight="1169"/);
      expect(xml).toMatch(/<object [^>]*id="0"|<object [^>]*rdSheetScale="fixed"/);
      expect(xml).toContain('rdSheetMargins="5 5 5 5"');
      expect(xml).toContain('rdSheetLegend="0"');
      expect(xml).toContain('rdTitleBlock=');
      expect(xml).toContain('rdRevisions=');

      const graph2 = createTestGraph();
      try {
        const doc2 = new DiagramDocument(graph2);
        doc2.applyParsedProject(await doc2.parseProjectXml(xml));
        const setup = readSheetSetup(doc2.getPageSettings(), graph2.getDataModel());
        expect(setup).toMatchObject({ format: 'A3', orientation: 'landscape', scaleMode: 'fixed', scale: 2, legend: false, frame: true, sheetTitle: INPUT.sheetTitle, drawingNumber: 'RD-001' });
        expect(setup.margins).toEqual({ top: 5, right: 5, bottom: 5, left: 5 });
        expect(doc2.titleBlock.get()).toMatchObject({ project: 'Stacja Łódź Kaliska', designed: 'Józef Żółć' });
        expect(doc2.titleBlock.revisions()).toEqual([{ rev: 'A', date: '2026-10-01', description: 'Pierwsze wydanie', author: 'JŻ', checked: 'MK' }]);
        // a second save is stable
        expect(doc2.getProjectXml().replace(/modified="[^"]*"/, '')).toBe(xml.replace(/modified="[^"]*"/, ''));
        // the tab cache keeps the title block
        const entry = JSON.parse(doc2.cacheEntryJson({ id: 't', name: 'x', now: 0, active: true }, undefined));
        const graph3 = createTestGraph();
        try {
          const doc3 = new DiagramDocument(graph3);
          doc3.restoreCacheEntry(entry);
          expect(doc3.titleBlock.get().project).toBe('Stacja Łódź Kaliska');
          expect(doc3.titleBlock.revisions()).toHaveLength(1);
        } finally {
          cleanupTestGraph(graph3);
        }
      } finally {
        cleanupTestGraph(graph2);
      }
    } finally {
      cleanupTestGraph(graph);
    }
  });

  it('reads the setup of a page from its model XML (pages that are not shown)', () => {
    const xml =
      '<mxGraphModel pageWidth="2339" pageHeight="3300" pageScale="5"><root><object id="0" rdSheetScale="fixed" rdSheetNumber="7"><mxCell/></object><mxCell id="1" parent="0"/></root></mxGraphModel>';
    expect(readModelSheetSetup(xml)).toMatchObject({ format: 'A1', orientation: 'portrait', scaleMode: 'fixed', scale: 5, sheetNumber: '7' });
    expect(readModelSheetSetup('<mxGraphModel><root><mxCell id="0"/></root></mxGraphModel>')).toMatchObject({ format: 'A4', scaleMode: 'fit' });
  });
});

describe('title block and revisions', () => {
  it('sanitises untrusted values and resolves the values of a sheet', () => {
    const values = sanitizeTitleBlock({ project: 'P', logo: 'javascript:alert(1)', lang: 'xx', status: 42 });
    expect(values.logo).toBe('');
    expect(values.lang).toBe('pl');
    expect(values.status).toBe('');
    expect(sanitizeTitleBlock({ logo: 'data:image/png;base64,iVBORw0KGgo=' }).logo).toBe('data:image/png;base64,iVBORw0KGgo=');
    const rows = sanitizeRevisions([{ rev: 'A', description: 'x' }, { rev: '' }, 'bad', { rev: 'B', date: '2026-10-02' }]);
    expect(rows.map((r) => r.rev)).toEqual(['A', 'B']);
    const setup = readSheetSetup(pageSettingsFor(INPUT), null);
    const sheet = sheetTitleValues({ ...emptyTitleBlock(), title: 'Doc title' }, rows, { ...setup, scaleMode: 'fixed', scale: 2, sheetTitle: 'Page title' }, 2, 5);
    expect(sheet).toMatchObject({ title: 'Page title', scale: '1:2', revision: 'B', sheetNumber: '3', sheetCount: 5 });
    expect(sheetOfText(sheet)).toBe('3 z 5');
    const en = sheetTitleValues({ ...emptyTitleBlock(), lang: 'en' }, [], { ...setup, sheetNumber: '12' }, 0, 1);
    expect(en.scale).toBe('NTS');
    expect(sheetOfText(en)).toBe('12 of 1');
  });

  it('fits and wraps text', () => {
    expect(fitText('Short', 50, 3, 2)).toEqual({ text: 'Short', size: 3 });
    const long = fitText('A very long drawing title that does not fit', 20, 3, 2);
    expect(long.size).toBe(2);
    expect(long.text.endsWith('…')).toBe(true);
    expect(wrapText('one two three four five six', 15, 3, 2)).toHaveLength(2);
  });
});

describe('legend', () => {
  const page = (cells: string): string => `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells}</root></mxGraphModel>`;
  const signal = (id: string, type: string): string =>
    `<object id="${id}" label="${id}" rdKind="signal" rdSignalType="${type}"><mxCell style="shape=mxgraph.ertms.signal;html=1;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="20" height="40" as="geometry"/></mxCell></object>`;

  it('lists railway kinds (signals by type) and titled library symbols once each, in order', () => {
    const library = libraryTitleIndex([
      { title: 'Balise', xml: page('<mxCell id="2" style="shape=triangle;fillColor=#ffcc00;" vertex="1" parent="1"><mxGeometry width="20" height="20" as="geometry"/></mxCell>') },
      { title: 'Two shapes', xml: page('') },
    ]);
    expect(library.get(symbolStyleKey('fillColor=#ffcc00;shape=triangle;html=1;rdShape=x;'))).toBe('Balise');
    const xml = page(
      signal('S1', 'main') +
        signal('S2', 'main') +
        signal('S3', 'shunting') +
        '<mxCell id="b" style="shape=triangle;fillColor=#ffcc00;whiteSpace=wrap;" vertex="1" parent="1"><mxGeometry width="20" height="20" as="geometry"/></mxCell>' +
        '<mxCell id="plain" style="rounded=1;" vertex="1" parent="1"><mxGeometry width="20" height="20" as="geometry"/></mxCell>' +
        '<UserObject id="ref" label="x" link="data:page/id,p2" rdSheetRef="continuation"><mxCell style="shape=triangle;fillColor=#ffcc00;" vertex="1" parent="1"><mxGeometry width="20" height="20" as="geometry"/></mxCell></UserObject>'
    );
    const legend = buildLegend(xml, library);
    expect(legend.map((e) => [e.label, e.count])).toEqual([
      ['Main signal', 2],
      ['Shunting signal', 1],
      ['Balise', 1],
    ]);
  });
});

describe('sheet references', () => {
  const graphs: Graph[] = [];
  beforeAll(() => registerDrawioCodecs());
  afterEach(() => graphs.splice(0).forEach(cleanupTestGraph));

  it('stores draw.io page links and prints the target sheet number', async () => {
    expect(linkTargetPageId('data:page/id,abc')).toBe('abc');
    expect(linkTargetPageId('https://example.com')).toBeNull();
    expect(continuationLabel('3', 'pl')).toBe('ciąg dalszy na arkuszu 3');
    expect(continuationLabel(null, 'en')).toBe('continued on sheet ?');

    const graph = createTestGraph();
    graphs.push(graph);
    const doc = new DiagramDocument(graph);
    const file =
      '<mxfile host="railway-drawer"><diagram id="main" name="A"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram>' +
      '<diagram id="p2" name="B"><mxGraphModel><root><object id="0" rdSheetNumber="12"><mxCell/></object><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>';
    doc.applyParsedProject(await doc.parseProjectXml(file));
    const model = graph.getDataModel();
    let cell = null as ReturnType<Graph['insertVertex']> | null;
    model.beginUpdate();
    try {
      cell = graph.insertVertex(graph.getDefaultParent(), 'ref', createSheetRefValue('p2', 'x'), 10, 10, 170, 40, {} as never);
    } finally {
      model.endUpdate();
    }
    expect(sheetRefTarget(cell)).toBe('p2');
    expect(refreshSheetRefsInModel(model, (id) => (id === 'p2' ? '12' : null), 'pl')).toBe(true);
    expect((cell!.getValue() as Element).getAttribute('label')).toBe('ciąg dalszy na arkuszu 12');
    // the saved file keeps the draw.io link (draw.io follows it to the page)
    expect(doc.getProjectXml()).toMatch(/<UserObject [^>]*link="data:page\/id,p2"/);
    // exports resolve the label from the plan
    const plans = await planSheets(doc);
    expect(plans.map((p) => [p.page.name, p.values.sheetNumber, p.values.sheetCount])).toEqual([
      ['A', '1', 2],
      ['B', '12', 2],
    ]);
    const xml = refreshSheetRefsInXml(plans[0].modelXml.replace('arkuszu 12', 'arkuszu 9'), () => '4', 'en');
    expect(xml).toContain('continued on sheet 4');
  });
});

describe('composed sheet SVG', () => {
  it('draws the frame, title block with Polish text, revisions and legend in mm', () => {
    const setup = { ...readSheetSetup(pageSettingsFor(INPUT), null), scaleMode: 'fixed' as const, scale: 2 };
    const values = sheetTitleValues({ ...emptyTitleBlock(), project: 'Łódź Kaliska', title: 'Plan', company: 'Koleje' }, [{ rev: 'A', date: 'd', description: 'Opis', author: 'a', checked: 'c' }], setup, 0, 2);
    const legend = [{ key: 'k', label: 'Main signal', style: '', width: 10, height: 10, edge: false, count: 1 }];
    const geometry = sheetGeometry(setup, { revisionRows: 1, legendEntries: 1 });
    const drawing = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    drawing.innerHTML = '<rect x="0" y="0" width="100" height="50" fill="#ff0000"/>';
    const svg = composeSheetSvg(document, { setup, geometry, values, revisions: [{ rev: 'A', date: 'd', description: 'Opis', author: 'a', checked: 'c' }], legend, drawing: { svg: drawing, source: { x: 0, y: 0, width: 100, height: 50 }, target: { x: 20, y: 10, width: 50, height: 25 } } });
    expect(svg.getAttribute('width')).toBe('420mm');
    expect(svg.getAttribute('viewBox')).toBe('0 0 420 297');
    expect(svg.querySelector('[data-field="project"]')?.textContent).toBe('Łódź Kaliska');
    expect(svg.querySelector('[data-field="sheet"]')?.textContent).toBe('1 z 2');
    expect(svg.querySelector('[data-field="scale"]')?.textContent).toBe('1:2');
    expect(svg.querySelector('[data-field="rev-description"]')?.textContent).toBe('Opis');
    expect(svg.querySelector('[data-field="legend"]')?.textContent).toBe('Legenda');
    expect(svg.querySelector('.rd-sheet-drawing rect')?.getAttribute('fill')).toBe('#ff0000');
    expect(svg.querySelector('.rd-sheet-frame')).toBeTruthy();
  });
});
