/**
 * The UML (PlantUML) and Markdown parts of scenario steps in the .drawio file (`rdStepUml` /
 * `rdStepText` on the step's <diagram>), the tab cache JSON and share links: multi-line values,
 * quotes, markup characters, Polish characters, CR LF / tabs, and a draw.io-style re-save.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectService } from '../../services/project-service';
import { buildShareMxfile, splitSharedFile } from '../../share/share-mxfile';
import { buildScenarioPages, scenarioIndexAttributes, STEP_TEXT_ATTR, STEP_UML_ATTR } from '../scenario-format';
import { cleanMultiline, sanitizeScenarios, ScenarioSet, MAX_STEP_UML } from '../scenario-model';

const MODEL = (label: string): string =>
  '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
  `<mxCell id="v" value="${label}" vertex="1" parent="1"><mxGeometry x="10" y="20" width="80" height="40" as="geometry"/></mxCell>` +
  '</root></mxGraphModel>';

const UML = `@startuml
title Wjazd pociągu "ICC" <Łódź> & więcej
participant "On-board" as Train
Train -> RBC : MA Request (ąęśćżźół)
alt route free
  RBC --> Train : MA 'full'
else
  RBC --> Train : MA <shortened>
end
note over Train, RBC
  multi-line
    indented note
end note
@enduml`;

const TEXT = `# Krok 1 — sygnał "S1"

- pociąg **ICC** wjeżdża na tor 2 & staje
- [link](https://example.com/?a=1&b=2)

| Obiekt | Stan |
|:--|--:|
| S1 | <zielony> |

\`\`\`
code   with   spaces
\`\`\``;

const parse = (xml: string): Document => new DOMParser().parseFromString(xml, 'text/xml');
const pagesOf = (xml: string): Element[] => Array.from(parse(xml).documentElement.children).filter((e) => e.nodeName === 'diagram');

/** What draw.io v32.4.1 does on save: page node cloned, mxUtils.getXml (XMLSerializer + "\n" -> "&#xa;"). */
function drawioResave(fileXml: string): string {
  const out = document.implementation.createDocument(null, 'mxfile', null);
  for (const page of pagesOf(fileXml)) out.documentElement.appendChild(out.importNode(page.cloneNode(true), true));
  return new XMLSerializer().serializeToString(out).replace(/\n/g, '&#xa;');
}

describe('step UML and text in the file', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  function project(): ProjectService {
    const service = new ProjectService();
    service.setProjectName('Stacja Łódź');
    const s = service.scenarios.create('Wjazd', '');
    service.scenarios.addStep(s.id, { name: 'Krok 1', xml: MODEL('a'), uml: UML, text: TEXT });
    service.scenarios.addStep(s.id, { name: 'Krok 2', xml: MODEL('b') });
    service.scenarios.addStep(s.id, { name: 'Krok 3', xml: MODEL('c'), text: 'only text' });
    return service;
  }

  it('writes rdStepUml / rdStepText with escaped newlines and reads them back unchanged', async () => {
    const service = project();
    const xml = service.generateProjectXml(MODEL('main'));
    // newlines are written as &#xa; (otherwise XML attribute normalization would turn them into spaces)
    const firstStepTag = /<diagram [^>]*rdStepName="Krok 1"[^>]*>/.exec(xml)![0];
    expect(firstStepTag).not.toMatch(/\n/);
    expect(firstStepTag).toMatch(/rdStepUml="@startuml(&#xa;|&#10;|&#xA;)title Wjazd pociągu &quot;ICC&quot; &lt;Łódź&gt; &amp; więcej/);
    const pages = pagesOf(xml);
    expect(pages[1].getAttribute(STEP_UML_ATTR)).toBe(UML);
    expect(pages[1].getAttribute(STEP_TEXT_ATTR)).toBe(TEXT);
    // steps without UML/text get no attributes
    expect(pages[2].hasAttribute(STEP_UML_ATTR)).toBe(false);
    expect(pages[2].hasAttribute(STEP_TEXT_ATTR)).toBe(false);
    expect(pages[3].hasAttribute(STEP_UML_ATTR)).toBe(false);

    const parsed = await new ProjectService().parseProjectXml(xml);
    expect(parsed.scenarios).toEqual(service.scenarios.list());
    const [one, two, three] = parsed.scenarios[0].steps;
    expect(one.uml).toBe(UML);
    expect(one.text).toBe(TEXT);
    expect([two.uml, two.text]).toEqual(['', '']);
    expect([three.uml, three.text]).toEqual(['', 'only text']);
  });

  it('survives a draw.io-style re-save (cloned page nodes, mxUtils.getXml)', async () => {
    const xml = project().generateProjectXml(MODEL('main'));
    const resaved = drawioResave(xml);
    const parsed = await new ProjectService().parseProjectXml(resaved);
    expect(parsed.scenarios[0].steps[0].uml).toBe(UML);
    expect(parsed.scenarios[0].steps[0].text).toBe(TEXT);
    // and again
    const twice = await new ProjectService().parseProjectXml(drawioResave(resaved));
    expect(twice.scenarios[0].steps[0].text).toBe(TEXT);
  });

  it('normalizes CR LF, tabs and characters XML cannot carry', () => {
    expect(cleanMultiline('a\r\nb\rc\td', 1000)).toBe('a\nb\nc    d');
    expect(cleanMultiline('x\u0000y\u0007z\u001b', 1000)).toBe('xyz');
    expect(cleanMultiline('   \n  ', 1000)).toBe('');
    expect(cleanMultiline(42, 1000)).toBe('');
    expect(cleanMultiline('x'.repeat(MAX_STEP_UML + 10), MAX_STEP_UML)).toHaveLength(MAX_STEP_UML);
    const set = new ScenarioSet();
    const s = set.create('S');
    const step = set.addStep(s.id, { name: 'a', xml: MODEL('a'), uml: 'A -> B\r\n\tB --> A', text: 'x\r\ny' });
    expect(step.uml).toBe('A -> B\n    B --> A');
    set.updateStep(s.id, step.id, { text: '' });
    expect(set.get(s.id)!.steps[0].text).toBe('');
  });

  it('cache JSON: round trip, and old caches without the fields still load', () => {
    const list = project().scenarios.list();
    expect(sanitizeScenarios(JSON.parse(JSON.stringify(list)))).toEqual(list);
    const old = sanitizeScenarios([{ id: 's', name: 'S', steps: [{ id: 'x', name: 'x', xml: MODEL('x') }] }]);
    expect(old[0].steps[0]).toMatchObject({ uml: '', text: '' });
    const wrongTypes = sanitizeScenarios([{ id: 's', name: 'S', steps: [{ id: 'x', name: 'x', xml: MODEL('x'), uml: {}, text: [1] }] }]);
    expect(wrongTypes[0].steps[0]).toMatchObject({ uml: '', text: '' });
  });

  it('duplicate step/scenario copies UML and text', () => {
    const service = project();
    const s = service.scenarios.list()[0];
    const copy = service.scenarios.duplicateStep(s.id, s.steps[0].id);
    expect([copy.uml, copy.text]).toEqual([UML, TEXT]);
    const dup = service.scenarios.duplicate(s.id);
    expect(dup.steps[0].uml).toBe(UML);
  });

  it('share links carry them (tab split keeps the step pages)', async () => {
    const scenarios = project().scenarios.list();
    const xml = buildShareMxfile([
      { name: 'Tab 1', modelXml: MODEL('one'), pageAttributes: scenarioIndexAttributes(scenarios), sectionPages: buildScenarioPages(scenarios, new Set()) },
    ]);
    const split = splitSharedFile(xml);
    const parsed = await new ProjectService().parseProjectXml(split[0].fileXml);
    expect(parsed.scenarios).toEqual(scenarios);
  });
});
