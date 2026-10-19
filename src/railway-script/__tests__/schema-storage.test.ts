/**
 * The published JSON Schema (public/schemas/railway-script-1.schema.json) = schema.ts, valid
 * draft-07 (ajv), and the app's validator agrees with ajv; the script's storage in .drawio files,
 * share links and the tab cache.
 */
import Ajv from 'ajv';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { ProjectService } from '../../services/project-service';
import { buildShareMxfile, splitSharedFile } from '../../share/share-mxfile';
import { buildRailwayScriptSchema } from '../schema';
import { RAILWAY_SCRIPT_ATTR, RailwayScriptStore, cleanScriptText, railwayScriptAttributes, sanitizeCachedScript } from '../script-store';
import { SCRIPT_TEMPLATES } from '../templates';
import { SchemaValidator } from '../validate';

const SCHEMA_PATH = resolve(__dirname, '../../../public/schemas/railway-script-1.schema.json');

describe('JSON Schema', () => {
  const schema = buildRailwayScriptSchema();

  it('public/schemas/railway-script-1.schema.json is schema.ts (UPDATE_RS_SCHEMA=1 rewrites it)', () => {
    const text = `${JSON.stringify(schema, null, 2)}\n`;
    if (process.env.UPDATE_RS_SCHEMA === '1') writeFileSync(SCHEMA_PATH, text);
    expect(readFileSync(SCHEMA_PATH, 'utf8')).toBe(text);
  });

  // ajv 8 (devDependency, pinned; its default class is draft-07) checks the schema itself (strict
  // mode: unknown keywords are errors) and is the reference validator. The schema uses union types
  // (`type: ['string', 'number']`) and the annotation `x-expected` (validate.ts's message text).
  const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
  ajv.addKeyword({ keyword: 'x-expected', schemaType: 'string' });
  const ajvValidate = ajv.compile(schema);
  const ours = new SchemaValidator(schema);

  const samples: Array<[string, unknown]> = [
    ...SCRIPT_TEMPLATES.map((t): [string, unknown] => [t.id, parseYaml(t.text)]),
    ['minimal', { railwayScript: 1 }],
    ['wrong version', { railwayScript: 2 }],
    ['no version', { tracks: [] }],
    ['metres aliases', { railwayScript: 1, tracks: [{ id: 'T1', StartPos: 0, EndPos: 1000 }] }],
    ['track without end', { railwayScript: 1, tracks: [{ id: 'T1', startKm: 0 }] }],
    ['chainage', { railwayScript: 1, tracks: [{ id: 'T1', startKm: '0+000', endKm: '1+200' }], signals: [{ id: 'S1', track: 'T1', at: '0+500' }] }],
    ['bad chainage', { railwayScript: 1, signals: [{ id: 'S1', track: 'T1', at: '1,5 km' }] }],
    ['enum', { railwayScript: 1, signals: [{ id: 'S1', track: 'T1', at: 1, direction: 'up' }] }],
    ['range', { railwayScript: 1, baliseGroups: [{ id: 'BG1', track: 'T1', at: 1, nidC: 5000 }] }],
    ['signal without track', { railwayScript: 1, signals: [{ id: 'S1', at: 1 }] }],
    ['nested signal', { railwayScript: 1, tracks: [{ id: 'T1', startKm: 0, endKm: 1, signals: [{ id: 'S1', at: 0.5 }] }] }],
    ['unknown keys', { railwayScript: 1, colour: 'red', tracks: [{ id: 'T1', startKm: 0, endKm: 1, gauge: 1435 }] }],
    ['route via', { railwayScript: 1, routes: [{ id: 'R1', from: 'S1', to: 'S2', via: { W1: 'reverse' } }] }],
    ['route bad via', { railwayScript: 1, routes: [{ id: 'R1', from: 'S1', to: 'S2', via: { W1: 'left' } }] }],
    ['route without exit', { railwayScript: 1, routes: [{ id: 'R1', from: 'S1' }] }],
    ['balise count', { railwayScript: 1, baliseGroups: [{ id: 'BG1', track: 'T1', at: 1, balises: 9 }] }],
    ['section from detection points', { railwayScript: 1, sections: [{ id: 'TS1', from: 'AC1', to: 2.5 }] }],
    ['buffer stops', { railwayScript: 1, tracks: [{ id: 'T1', startKm: 0, endKm: 1, bufferStops: ['start', { id: 'BS9', at: 'end' }, 'middle'] }] }],
    ['etcs level number', { railwayScript: 1, trains: [{ id: 'TR1', track: 'T1', at: 1, etcsLevel: 2 }] }],
    ['page', { railwayScript: 1, page: { scale: 0, origin: { x: 'a' } } }],
    ['not a map', ['railwayScript', 1]],
  ];

  for (const [name, data] of samples) {
    it(`agrees with ajv: ${name}`, () => {
      const valid = ajvValidate(data);
      const errors = ours.validate(data).filter((i) => i.severity === 'error');
      expect(errors.length === 0, JSON.stringify({ ajv: ajvValidate.errors, ours: errors })).toBe(valid);
    });
  }

  it('our validator warns about unknown keys (ajv accepts them)', () => {
    const issues = ours.validate({ railwayScript: 1, colour: 'red' });
    expect(issues).toEqual([{ severity: 'warning', path: ['colour'], message: 'unknown key "colour" (kept, not used)', onKey: true }]);
  });
});

describe('storage', () => {
  const text = "railwayScript: 1\n# comment with <xml> & \"quotes\" 'and' Zażółć\nname: 'Station'\ntracks:\n\t- { id: T1, startKm: 0, endKm: 1 }\r\n";

  it('normalizes text for storage (line ends, tabs, control characters)', () => {
    expect(cleanScriptText('a\r\nb\rc\td\u0001')).toBe('a\nb\nc  d');
    expect(sanitizeCachedScript(42)).toBe('');
    expect(railwayScriptAttributes('  \n')).toEqual({});
  });

  it('round trips through the .drawio file (main page <diagram> attribute)', async () => {
    const service = new ProjectService();
    service.setProjectName('P');
    service.railwayScript.set(text);
    const xml = service.generateProjectXml('<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>');
    expect(xml).toMatch(new RegExp(`${RAILWAY_SCRIPT_ATTR}="railwayScript: 1&#x[aA];# comment with &lt;xml&gt; &amp; &quot;quotes&quot;`));
    const parsed = await new ProjectService().parseProjectXml(xml);
    expect(parsed.railwayScript).toBe(cleanScriptText(text));
    // a file without a script has none
    const plain = await new ProjectService().parseProjectXml(new ProjectService().generateProjectXml('<mxGraphModel><root><mxCell id="0"/></root></mxGraphModel>'));
    expect(plain.railwayScript).toBe('');
    expect(new ProjectService().generateProjectXml('<mxGraphModel/>')).not.toContain(RAILWAY_SCRIPT_ATTR);
  });

  it('travels with share links', async () => {
    const mxfile = buildShareMxfile([
      { name: 'A', modelXml: '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>', pageAttributes: railwayScriptAttributes(text) },
      { name: 'B', modelXml: '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>' },
    ]);
    const pages = splitSharedFile(mxfile);
    expect((await new ProjectService().parseProjectXml(pages[0].fileXml)).railwayScript).toBe(cleanScriptText(text));
    expect((await new ProjectService().parseProjectXml(pages[1].fileXml)).railwayScript).toBe('');
  });

  it('the store notifies with the source of a change', () => {
    const store = new RailwayScriptStore();
    const seen: string[] = [];
    store.subscribe((t, source) => seen.push(`${source}:${t}`));
    store.set('a', 'editor');
    store.set('a', 'editor');
    store.set('b', 'drawing');
    expect(seen).toEqual(['editor:a', 'drawing:b']);
    expect(store.has()).toBe(true);
  });
});
