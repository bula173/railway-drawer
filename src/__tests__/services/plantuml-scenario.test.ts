/**
 * PlantUML for scenario steps: the local sequence-diagram renderer, PlantUML's text encoding, the
 * optional server (mocked fetch: URL, sanitizing, offline/HTTP errors) and the "never send unless
 * configured" rule.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { inflateRawSync } from 'node:zlib';
import {
  isSequenceDiagram,
  parseSequenceDiagram,
  renderSequenceSvg,
  plantColor,
  PlantUmlSyntaxError,
} from '../../services/plantuml-sequence-svg';
import {
  decodePlantUmlBase64,
  encodePlantUml,
  encodePlantUmlBase64,
  getPlantUmlServer,
  normalizeServerUrl,
  renderOnPlantUmlServer,
  sanitizeSvgMarkup,
  setPlantUmlServer,
  PLANTUML_SERVER_KEY,
} from '../../services/plantuml-server';
import { renderStepUml, clearUmlCache, showUmlResult } from '../../scenarios/step-uml';

const SEQ = `@startuml
title MA request
autonumber
actor Driver
participant "On-board unit" as Train #lightblue
participant RBC
database IXL
Driver -> Train : start of mission
Train -> RBC ++ : MA Request\\nposition report
RBC -> IXL : route?
IXL --> RBC : route set
alt route free
  RBC --> Train : MA
else occupied
  RBC -->> Train : MA shortened
  loop every 5 s
    Train -> Train : supervise
  end
end
note right of RBC : checks
note over Train, RBC
  two
  lines
end note
== Running ==
... 5 minutes later ...
opt emergency
  RBC ->x Train : stop
end
|||
activate IXL
IXL -> RBC
deactivate IXL
return done
[-> Driver : external
Driver <- Train : back
destroy IXL
@enduml`;

describe('local sequence renderer', () => {
  it('detects sequence diagrams', () => {
    expect(isSequenceDiagram('Train -> RBC : MA Request')).toBe(true);
    expect(isSequenceDiagram(SEQ)).toBe(true);
    expect(isSequenceDiagram('@startuml\nclass Train\n@enduml')).toBe(false);
    expect(isSequenceDiagram('@startuml\n[*] --> Idle\n@enduml')).toBe(false);
    expect(isSequenceDiagram('@startuml\nstart\n:step;\nstop\n@enduml')).toBe(false);
    expect(isSequenceDiagram('@startmindmap\n* a\n@endmindmap')).toBe(false);
  });

  it('parses participants, messages, notes, groups, activations, dividers, delays and return', () => {
    const d = parseSequenceDiagram(SEQ);
    expect(d.warnings).toEqual([]);
    expect(d.title).toEqual(['MA request']);
    expect(d.participants.map((p) => [p.id, p.kind])).toEqual([
      ['[', 'edge'],
      ['Driver', 'actor'],
      ['Train', 'participant'],
      ['RBC', 'participant'],
      ['IXL', 'database'],
    ]);
    expect(d.participants[2]).toMatchObject({ label: ['On-board unit'], color: 'lightblue' });
    const msgs = d.events.filter((e) => e.t === 'msg');
    expect(msgs.map((m) => (m.t === 'msg' ? `${m.number} ${m.from}>${m.to} ${m.dashed ? 'dashed' : 'solid'} ${m.head}` : ''))).toEqual([
      '1 Driver>Train solid closed',
      '2 Train>RBC solid closed',
      '3 RBC>IXL solid closed',
      '4 IXL>RBC dashed closed',
      '5 RBC>Train dashed closed',
      '6 RBC>Train dashed open',
      '7 Train>Train solid closed',
      '8 RBC>Train solid lost',
      '9 IXL>RBC solid closed',
      '10 RBC>Train dashed open',
      '11 [>Driver solid closed',
      '12 Train>Driver solid closed',
    ]);
    const second = msgs[1];
    expect(second.t === 'msg' && second.label).toEqual(['MA Request', 'position report']);
    expect(second.t === 'msg' && second.suffix).toBe('++');
    expect(msgs[9].t === 'msg' && msgs[9].label).toEqual(['done']);
    expect(d.events.filter((e) => e.t === 'groupStart').map((e) => (e.t === 'groupStart' ? `${e.kind}:${e.label}` : ''))).toEqual([
      'alt:route free',
      'loop:every 5 s',
      'opt:emergency',
    ]);
    expect(d.events.filter((e) => e.t === 'groupEnd')).toHaveLength(3);
    expect(d.events.find((e) => e.t === 'else')).toEqual({ t: 'else', label: 'occupied' });
    expect(d.events.filter((e) => e.t === 'note').map((e) => (e.t === 'note' ? [e.pos, e.targets, e.text] : []))).toEqual([
      ['right', ['RBC'], ['checks']],
      ['over', ['Train', 'RBC'], ['two', 'lines']],
    ]);
    expect(d.events.find((e) => e.t === 'divider')).toEqual({ t: 'divider', label: 'Running' });
    expect(d.events.find((e) => e.t === 'delay')).toEqual({ t: 'delay', label: '5 minutes later' });
    expect(d.events.some((e) => e.t === 'activate')).toBe(true);
    expect(d.events.some((e) => e.t === 'destroy')).toBe(true);
  });

  it('renders an SVG with every label, escaped', () => {
    const { svg, width, height, warnings } = renderSequenceSvg(SEQ);
    expect(warnings).toEqual([]);
    expect(width).toBeGreaterThan(300);
    expect(height).toBeGreaterThan(300);
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    const text = doc.documentElement.textContent ?? '';
    for (const label of [
      'MA request',
      'On-board unit',
      'MA Request',
      'position report',
      'route set',
      'alt',
      '[route free]',
      '[occupied]',
      'loop',
      'Running',
      '5 minutes later',
      'checks',
      'two',
      'lines',
      'done',
      'external',
    ]) {
      expect(text).toContain(label);
    }
  });

  it('never emits markup from the text', () => {
    const { svg } = renderSequenceSvg(
      'participant "<script>alert(1)</script>" as A\nA -> B : <img src=x onerror=alert(1)> & "q"\nnote left of A : </text><script>x</script>\nalt <b>\nend\n== <i>x</i> =='
    );
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(doc.getElementsByTagName('script')).toHaveLength(0);
    expect(doc.getElementsByTagName('img')).toHaveLength(0);
    expect(doc.getElementsByTagName('b')).toHaveLength(0);
    expect(doc.documentElement.textContent).toContain('<img src=x onerror=alert(1)> & "q"');
  });

  it('colours are validated', () => {
    expect(plantColor('#red')).toBe('red');
    expect(plantColor('#FF00aa')).toBe('#FF00aa');
    expect(plantColor('#red/blue')).toBe('red');
    expect(plantColor('#"><script>')).toBeUndefined();
  });

  it('reports what it does not understand and fails on empty input', () => {
    const d = parseSequenceDiagram('A -> B : ok\nthis is nonsense\nend');
    expect(d.warnings).toEqual(['line 2: not understood: this is nonsense', 'line 3: end without a group']);
    expect(() => renderSequenceSvg('@startuml\n@enduml')).toThrow(PlantUmlSyntaxError);
  });

  it('handles messages whose participants look like keywords and unicode names', () => {
    const d = parseSequenceDiagram('Pociąg -> Nastawnia : żądanie\nloop -> group : x\nA ->o B\nA -> obj');
    expect(d.participants.map((p) => p.id)).toEqual(['Pociąg', 'Nastawnia', 'loop', 'group', 'A', 'B', 'obj']);
    const heads = d.events.map((e) => (e.t === 'msg' ? e.head : ''));
    expect(heads).toEqual(['closed', 'closed', 'circle', 'closed']);
  });
});

describe('PlantUML text encoding', () => {
  it("matches PlantUML's documented example", () => {
    // plantuml.com/text-encoding: "Bob -> Alice : hello" -> SyfFKj2rKt3CoKnELR1Io4ZDoSa70000
    const bytes = decodePlantUmlBase64('SyfFKj2rKt3CoKnELR1Io4ZDoSa70000');
    expect(inflateRawSync(Buffer.from(bytes)).toString('utf8')).toBe('Bob -> Alice : hello');
  });

  it('round trips UTF-8 text through deflate + PlantUML base64', async () => {
    const text = '@startuml\nPociąg -> RBC : żądanie MA „pilne”\n@enduml';
    const encoded = await encodePlantUml(text);
    expect(encoded).toMatch(/^[0-9A-Za-z\-_]+$/);
    expect(inflateRawSync(Buffer.from(decodePlantUmlBase64(encoded))).toString('utf8')).toBe(text);
    expect(encodePlantUmlBase64(new Uint8Array([0, 0, 0]))).toBe('0000');
    expect(encodePlantUmlBase64(new Uint8Array([255, 255, 255]))).toBe('____');
  });
});

describe('PlantUML server (optional)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearUmlCache();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('has no default server; settings are validated', () => {
    expect(getPlantUmlServer()).toBe('');
    expect(normalizeServerUrl('https://plantuml.example.com/plantuml/ ')).toBe('https://plantuml.example.com/plantuml');
    expect(normalizeServerUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeServerUrl('https://user:pw@x.com')).toBeNull();
    expect(() => setPlantUmlServer('ftp://x')).toThrow();
    expect(setPlantUmlServer('http://192.168.10.22:8080/')).toBe('http://192.168.10.22:8080');
    expect(localStorage.getItem(PLANTUML_SERVER_KEY)).toBe('http://192.168.10.22:8080');
    setPlantUmlServer('');
    expect(localStorage.getItem(PLANTUML_SERVER_KEY)).toBeNull();
  });

  it('sequence diagrams never go to the server, other types only when a server is configured', async () => {
    const fetchImpl = vi.fn(async () => new Response('<svg xmlns="http://www.w3.org/2000/svg"></svg>'));
    const seq = await renderStepUml('Train -> RBC : MA Request', { server: 'https://puml.example', fetchImpl });
    expect(seq.status).toBe('ok');
    expect(seq.status === 'ok' && seq.renderer).toBe('local');
    const cls = await renderStepUml('@startuml\nclass Train\n@enduml', { fetchImpl });
    expect(cls.status).toBe('error');
    expect(cls.status === 'error' && cls.message).toMatch(/Only sequence diagrams are rendered locally/);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect((await renderStepUml('   ')).status).toBe('empty');
  });

  it('requests <server>/svg/<encoded> and sanitizes the answer', async () => {
    const fetchImpl = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        new Response(
          '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" onload="alert(1)">' +
            '<script>alert(2)</script><a xlink:href="javascript:alert(3)"><text>Train</text></a>' +
            '<foreignObject><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>' +
            '<rect style="fill:url(https://evil/x)" onclick="y()"/><use href="#ok"/></svg>',
          { status: 200 }
        )
    );
    const result = await renderStepUml('@startuml\nclass Train\n@enduml', { server: 'https://puml.example/plantuml/', fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const url = String(fetchImpl.mock.calls[0][0]);
    expect(url).toMatch(/^https:\/\/puml\.example\/plantuml\/svg\/[0-9A-Za-z\-_]+$/);
    const encoded = url.split('/svg/')[1];
    expect(inflateRawSync(Buffer.from(decodePlantUmlBase64(encoded))).toString('utf8')).toBe('@startuml\nclass Train\n@enduml');
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer' });
    expect(result.status).toBe('ok');
    const svg = result.status === 'ok' ? result.svg : '';
    expect(svg).toContain('Train');
    expect(svg).not.toMatch(/script|onload|onclick|javascript:|foreignObject|evil/i);
    expect(svg).toContain('href="#ok"');
    // cached: same text, no second request
    await renderStepUml('@startuml\nclass Train\n@enduml', { server: 'https://puml.example/plantuml/', fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('offline and HTTP errors become clear error states; PlantUML error images are shown', async () => {
    const offline = await renderStepUml('@startuml\nclass A\n@enduml', {
      server: 'https://puml.example',
      fetchImpl: vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    });
    expect(offline).toMatchObject({ status: 'error', offline: true });
    const host = document.createElement('div');
    showUmlResult(host, offline);
    expect(host.textContent).toMatch(/^PlantUML server offline — PlantUML server not reachable \(https:\/\/puml\.example\): Failed to fetch/);

    const http = await renderStepUml('@startuml\nclass B\n@enduml', {
      server: 'https://puml.example',
      fetchImpl: vi.fn(async () => new Response('busy', { status: 503 })),
    });
    expect(http).toMatchObject({ status: 'error', offline: false, message: 'PlantUML server answered HTTP 503' });

    const syntax = await renderOnPlantUmlServer('@startuml\nclass\n@enduml', 'https://puml.example', {
      fetchImpl: vi.fn(async () => new Response('<svg xmlns="http://www.w3.org/2000/svg"><text>Syntax Error?</text></svg>', { status: 400 })),
    });
    expect(syntax).toContain('Syntax Error?');

    await expect(
      renderOnPlantUmlServer('x', 'https://puml.example', { fetchImpl: vi.fn(async () => new Response('<html>no</html>')) })
    ).rejects.toThrow(/did not return an SVG/);
  });

  it('sanitizeSvgMarkup rejects non-SVG documents', () => {
    expect(() => sanitizeSvgMarkup('<html xmlns="http://www.w3.org/1999/xhtml"/>')).toThrow();
  });
});
