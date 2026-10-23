/**
 * Scenarios in the .drawio file: one page per step after the main page, metadata as <diagram>
 * attributes, coexistence with preserved pages, and the share-link mxfile.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { deflateRawSync } from 'node:zlib';
import { ProjectService } from '../../services/project-service';
import { buildShareMxfile, splitSharedFile } from '../../share/share-mxfile';
import { buildScenarioPages, scenarioIndexAttributes, scenarioStepPageName } from '../scenario-format';
import type { ScenarioData } from '../scenario-model';

const esc = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '&#xa;');

const MODEL = (label: string): string =>
  '<mxGraphModel dx="800" dy="600" grid="1" gridSize="10"><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
  `<mxCell id="v" value="${esc(label)}" style="rounded=1;" vertex="1" parent="1"><mxGeometry x="10" y="20" width="80" height="40" as="geometry"/></mxCell>` +
  '</root></mxGraphModel>';

const parse = (xml: string): Document => new DOMParser().parseFromString(xml, 'text/xml');
const pagesOf = (xml: string): Element[] => Array.from(parse(xml).documentElement.children).filter((e) => e.nodeName === 'diagram');

function filled(service: ProjectService, names: { scenario: string; desc?: string; steps: Array<[string, string?]> }[]): ScenarioData[] {
  for (const s of names) {
    const scenario = service.scenarios.create(s.scenario, s.desc ?? '');
    s.steps.forEach(([name, description], i) =>
      service.scenarios.addStep(scenario.id, { name, description, xml: MODEL(`${s.scenario} #${i + 1}`) })
    );
  }
  return service.scenarios.list();
}

describe('scenario pages in the project file', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('writes each step as its own page after the main page and reads identical scenarios back', async () => {
    const service = new ProjectService();
    service.setProjectName('Stacja Łódź');
    const written = filled(service, [
      { scenario: 'Wjazd pociągu', desc: 'Pociąg "IC" <wjeżdża> & staje\nna peronie 2', steps: [['Sygnał zezwalający', 'S1 → zielony'], ['Zajęcie odcinka'], ['Zwolnienie']] },
      { scenario: 'Empty one', steps: [] },
      { scenario: "Odjazd / 'ruch' 2.", steps: [['Krok 1. / start', 'a&b <c>']] },
    ]);
    const xml = service.generateProjectXml(MODEL('main'));
    const pages = pagesOf(xml);
    expect(pages.map((p) => p.getAttribute('name'))).toEqual([
      'Stacja Łódź',
      'Wjazd pociągu / 1. Sygnał zezwalający',
      'Wjazd pociągu / 2. Zajęcie odcinka',
      'Wjazd pociągu / 3. Zwolnienie',
      "Odjazd / 'ruch' 2. / 1. Krok 1. / start",
    ]);
    // main page first, with the scenario index (incl. the empty scenario)
    expect(JSON.parse(pages[0].getAttribute('rdScenarios')!).scenarios.map((s: { name: string }) => s.name)).toEqual([
      'Wjazd pociągu',
      'Empty one',
      "Odjazd / 'ruch' 2.",
    ]);
    expect(pages[1].getAttribute('rdStepName')).toBe('Sygnał zezwalający');
    expect(pages[1].getAttribute('rdStepDescription')).toBe('S1 → zielony');
    expect(pages[1].getAttribute('rdScenarioDescription')).toBe('Pociąg "IC" <wjeżdża> & staje\nna peronie 2');
    expect(pages[2].hasAttribute('rdStepDescription')).toBe(false);
    // page ids unique, step pages hold the snapshot
    expect(new Set(pages.map((p) => p.getAttribute('id'))).size).toBe(pages.length);
    expect(pages[3].getElementsByTagName('mxCell')[2].getAttribute('value')).toBe('Wjazd pociągu #3');

    const other = new ProjectService();
    const parsed = await other.parseProjectXml(xml);
    expect(parsed.extraPages).toEqual([]);
    expect(parsed.extraPageNames).toEqual([]);
    expect(parsed.graphXml).toContain('value="main"');
    expect(parsed.scenarios).toEqual(written);

    // and a second save of the reloaded tab writes the same pages
    other.setPageId(parsed.pageId);
    other.setProjectMetadata(parsed.metadata);
    other.scenarios.replaceAll(parsed.scenarios);
    const again = pagesOf(other.generateProjectXml(parsed.graphXml));
    expect(again.map((p) => p.getAttribute('name'))).toEqual(pages.map((p) => p.getAttribute('name')));
    expect(again.map((p) => p.getAttribute('id'))).toEqual(pages.map((p) => p.getAttribute('id')));
  });

  it('writes no scenario metadata when there are none (files stay as before)', () => {
    const service = new ProjectService();
    const xml = service.generateProjectXml(MODEL('x'));
    expect(xml).not.toContain('rdScenario');
    expect(pagesOf(xml)).toHaveLength(1);
  });

  it('keeps preserved (non-scenario) pages: steps after the main page, then the kept pages, round trip', async () => {
    const service = new ProjectService();
    const kept = `<diagram id="keep1" name="Old page">${MODEL('kept')}</diagram>`;
    service.setExtraPages([kept]);
    filled(service, [{ scenario: 'S', steps: [['a'], ['b']] }]);
    const xml = service.generateProjectXml(MODEL('main'));
    expect(pagesOf(xml).map((p) => p.getAttribute('name'))).toEqual(['Untitled Diagram', 'S / 1. a', 'S / 2. b', 'Old page']);
    const parsed = await new ProjectService().parseProjectXml(xml);
    expect(parsed.extraPageNames).toEqual(['Old page']);
    expect(parsed.extraPages).toHaveLength(1);
    expect(parse(parsed.extraPages[0]).documentElement.getAttribute('id')).toBe('keep1');
    expect(parsed.scenarios[0].steps.map((s) => s.name)).toEqual(['a', 'b']);
  });

  it('reads files edited in draw.io: reordered/duplicated step pages, missing index, compressed pages', async () => {
    const service = new ProjectService();
    filled(service, [
      { scenario: 'A', steps: [['one'], ['two']] },
      { scenario: 'B', steps: [['x']] },
    ]);
    const doc = parse(service.generateProjectXml(MODEL('main')));
    const root = doc.documentElement;
    const pages = pagesOf(new XMLSerializer().serializeToString(doc));
    const live = Array.from(root.children);
    // draw.io: the index was lost, "two" was duplicated (same rd attributes, new page id), pages moved,
    // one step page saved compressed, and a normal page was added in between
    live[0].removeAttribute('rdScenarios');
    const dupe = live[2].cloneNode(true) as Element;
    dupe.setAttribute('id', 'drawio-dupe');
    root.appendChild(dupe);
    root.insertBefore(live[3], live[1]); // B/x before A/one
    const userPage = doc.createElement('diagram');
    userPage.setAttribute('id', 'user');
    userPage.setAttribute('name', 'Notes');
    userPage.appendChild(parse(MODEL('notes')).documentElement.cloneNode(true));
    root.insertBefore(doc.importNode(userPage, true), live[2]);
    const compressedTarget = live[1];
    const model = compressedTarget.getElementsByTagName('mxGraphModel')[0];
    const packed = deflateRawSync(Buffer.from(encodeURIComponent(new XMLSerializer().serializeToString(model)))).toString('base64');
    compressedTarget.removeChild(model);
    compressedTarget.textContent = packed;
    expect(pages).toHaveLength(4);

    const parsed = await new ProjectService().parseProjectXml(new XMLSerializer().serializeToString(doc));
    expect(parsed.extraPageNames).toEqual(['Notes']);
    expect(parsed.scenarios.map((s) => s.name)).toEqual(['B', 'A']);
    const a = parsed.scenarios[1];
    expect(a.steps.map((s) => s.name)).toEqual(['one', 'two', 'two']);
    expect(new Set(a.steps.map((s) => s.id)).size).toBe(3);
    expect(a.steps[0].xml).toContain('A #1');
  });

  it('keeps an unreadable step page as a normal page instead of dropping it', async () => {
    const xml =
      `<mxfile><diagram id="m" name="Main">${MODEL('m')}</diagram>` +
      '<diagram id="s" name="S / 1. broken" rdScenarioId="scn-1" rdScenarioName="S" rdStepId="s" rdStepName="broken">not base64 !!</diagram>' +
      '</mxfile>';
    const parsed = await new ProjectService().parseProjectXml(xml);
    expect(parsed.scenarios).toEqual([]);
    expect(parsed.extraPageNames).toEqual(['S / 1. broken']);
  });

  it('handles many steps', async () => {
    const service = new ProjectService();
    const steps: Array<[string]> = Array.from({ length: 60 }, (_, i) => [`Krok ${i + 1} ąę`]);
    filled(service, [{ scenario: 'Long', steps }]);
    const xml = service.generateProjectXml(MODEL('main'));
    expect(pagesOf(xml)).toHaveLength(61);
    const parsed = await new ProjectService().parseProjectXml(xml);
    expect(parsed.scenarios[0].steps).toHaveLength(60);
    expect(parsed.scenarios[0].steps[59].name).toBe('Krok 60 ąę');
    expect(parsed.scenarios[0].steps[59].xml).toContain('Long #60');
  });

  it('page names follow "<Scenario> / <n>. <step>"', () => {
    expect(scenarioStepPageName('Wjazd', 2, 'Zielone')).toBe('Wjazd / 3. Zielone');
  });
});

describe('scenarios in share links', () => {
  it('keeps each tab\'s step pages with it when the shared file is split into tabs', async () => {
    const service = new ProjectService();
    const scenarios = filled(service, [{ scenario: 'Ruch', steps: [['a'], ['b']] }]);
    const xml = buildShareMxfile([
      {
        name: 'Tab 1',
        modelXml: MODEL('one'),
        pageAttributes: scenarioIndexAttributes(scenarios),
        sectionPages: buildScenarioPages(scenarios, new Set()),
        extraPages: [`<diagram id="k" name="Kept">${MODEL('kept')}</diagram>`],
      },
      { name: 'Tab 2', modelXml: MODEL('two') },
    ]);
    expect(pagesOf(xml).map((p) => p.getAttribute('name'))).toEqual(['Tab 1', 'Ruch / 1. a', 'Ruch / 2. b', 'Kept', 'Tab 2']);
    const split = splitSharedFile(xml);
    expect(split.map((p) => p.name)).toEqual(['Tab 1', 'Kept', 'Tab 2']);
    const first = await new ProjectService().parseProjectXml(split[0].fileXml);
    expect(first.scenarios).toEqual(scenarios);
    expect(first.extraPages).toEqual([]);
    const second = await new ProjectService().parseProjectXml(split[1].fileXml);
    expect(second.scenarios).toEqual([]);
  });

  it('counts tabs, not step pages, against the page limit', () => {
    const service = new ProjectService();
    const scenarios = filled(service, [{ scenario: 'S', steps: Array.from({ length: 70 }, (_, i) => [`s${i}`] as [string]) }]);
    const xml = buildShareMxfile([
      { name: 'T', modelXml: MODEL('t'), pageAttributes: scenarioIndexAttributes(scenarios), sectionPages: buildScenarioPages(scenarios, new Set()) },
    ]);
    expect(splitSharedFile(xml)).toHaveLength(1);
  });
});
