import { describe, expect, it } from 'vitest';
import { ProjectService } from '../../services/project-service';
import { projectSections, registerProjectSection } from '../../services/project-sections';

const MODEL = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>';

describe('project sections (feature parts of the project file)', () => {
  it('has the scenarios and the Railway Script registered, in order', () => {
    expect(projectSections().map((s) => s.key)).toEqual(['scenarios', 'railwayScript']);
    const service = new ProjectService();
    expect(service.scenarios.list()).toEqual([]);
    expect(service.railwayScript.get()).toBe('');
  });

  it('writes and reads a registered section: main page attribute, own pages claimed back', async () => {
    registerProjectSection<{ value: string }, string>({
      key: 'testNote',
      order: 15,
      create: () => ({ value: '' }),
      mainPageAttributes: (s): Record<string, string> => (s.value ? { rdTestNote: s.value } : {}),
      pages: (s, usedIds) => {
        if (!s.value) return [];
        usedIds.add('note-page');
        return [`<diagram id="note-page" name="Note" rdTestNotePage="1">${MODEL}</diagram>`];
      },
      claimsPage: (page) => page.getAttribute('rdTestNotePage') === '1',
      parse: (main, claimed) => `${main?.getAttribute('rdTestNote') ?? ''}|${claimed.length}`,
      empty: () => 'none',
      load: (s, value) => {
        s.value = value;
      },
    });
    expect(projectSections().map((s) => s.key)).toEqual(['scenarios', 'testNote', 'railwayScript']);

    const service = new ProjectService();
    service.section<{ value: string }>('testNote').value = 'hello';
    service.railwayScript.set('track T1', 'editor');
    const xml = service.generateProjectXml(MODEL);
    expect(xml).toContain('rdTestNote="hello"');
    const parsed = (await new ProjectService().parseProjectXml(xml)) as unknown as Record<string, unknown>;
    expect(parsed.testNote).toBe('hello|1');
    expect(parsed.extraPages).toEqual([]); // the section's page is claimed, not kept
    expect(parsed.railwayScript).toBe('track T1');
    const bare = (await new ProjectService().parseProjectXml(MODEL)) as unknown as Record<string, unknown>;
    expect(bare.testNote).toBe('none');
    expect(() => service.section('missing')).toThrow(/not registered/);
  });
});
