import { afterEach, describe, expect, it } from 'vitest';
import { collectObjects } from '../../railway/validation';
import { ChatSession, apiTools, createBrowserClient, describeApiError } from '../chat/chat-loop';
import type { ToolRunner } from '../chat/chat-loop';
import { DEFAULT_SETTINGS } from '../chat/settings';
import type { AiSettings } from '../chat/settings';
import { buildSystemPrompt, languageReference } from '../system-prompt';
import { AI_TOOLS } from '../tool-defs';
import { executeAiTool } from '../tools';
import type { TestTarget } from './helpers';
import { createTestTarget } from './helpers';
import { fakeMessagesApi } from './sse';

const KEY = 'sk-ant-test-0000000000000000';
const SCRIPT = `railwayScript: 1
tracks:
  - { id: T1, startKm: 0, endKm: 2 }
signals:
  - { id: S1, track: T1, at: 0.5, direction: nominal, type: main }
  - { id: S2, track: T1, at: 1.5, direction: nominal, type: main }
`;

let t: TestTarget | null = null;
afterEach(() => {
  t?.destroy();
  t = null;
});

function session(fetchImpl: typeof fetch, settings: Partial<AiSettings> = {}): ChatSession {
  return new ChatSession(createBrowserClient(KEY, fetchImpl), buildSystemPrompt(), () => ({ ...DEFAULT_SETTINGS, apiKey: KEY, ...settings }));
}

describe('system prompt', () => {
  it('teaches the Railway Script from the catalogue, with examples and conventions', () => {
    const p = buildSystemPrompt();
    expect(p).toBe(buildSystemPrompt());
    expect(p).toContain('railwayScript: 1');
    expect(p).toContain('Nominal direction = increasing km = left to right');
    expect(p).toContain('https://railwaydrawer.mksystemdesign.org/schemas/railway-script-1.schema.json');
    expect(p).toContain('### Station with two points');
    const ref = languageReference();
    expect(ref).toMatch(/^- signals \(signal\): .*type \(main\|shunting\|markerBoard\|etcsStopMarker\)/m);
    expect(ref).toMatch(/^- joints \(/m);
    expect(ref).toMatch(/aspect \(stop\|proceed/);
    expect(ref).toMatch(/^- baliseGroups .*nidC \(int 0\.\.1023\)/m);
    expect(p).not.toMatch(/\d{4}-\d{2}-\d{2}T/); // no timestamps (cache-stable)
  });
});

describe('ChatSession (mocked Messages API)', () => {
  it('streams, runs tool_use blocks on the tab and sends tool_result back in one message', async () => {
    t = createTestTarget();
    const target = t;
    const api = fakeMessagesApi([
      {
        blocks: [
          { type: 'thinking', thinking: 'Plan a line.' },
          { type: 'text', text: 'Drawing a line with two signals.' },
          { type: 'tool_use', id: 'toolu_1', name: 'apply_railway_script', input: { script: SCRIPT } },
          { type: 'tool_use', id: 'toolu_2', name: 'check_drawing', input: {} },
        ],
      },
      { blocks: [{ type: 'text', text: 'Done: T1 with S1 and S2.' }] },
    ]);
    const s = session(api.fetch);
    const texts: string[] = [];
    const thinking: string[] = [];
    const tools: string[] = [];
    const run: ToolRunner = (call) => executeAiTool(target, call.name, call.input);
    const result = await s.send('Draw a line with two signals', run, {
      onText: (d) => texts.push(d),
      onThinking: (d) => thinking.push(d),
      onToolEnd: (call, outcome) => tools.push(`${call.name}:${outcome.summary}`),
    });
    expect(result).toEqual({ end: 'end_turn' });
    expect(texts.join('')).toBe('Drawing a line with two signals.Done: T1 with S1 and S2.');
    expect(texts.length).toBeGreaterThan(2);
    expect(thinking.join('')).toBe('Plan a line.');
    expect(tools[0]).toBe('apply_railway_script:Applied Railway Script: 1 track, 2 signals');
    expect(collectObjects(target.graph.getDataModel())).toHaveLength(3);

    expect(api.requests).toHaveLength(2);
    const first = api.requests[0];
    expect(first.url).toBe('https://api.anthropic.com/v1/messages?beta=true');
    expect(first.headers.authorization ?? first.headers['x-api-key']).toMatch(new RegExp(`(Bearer )?${KEY}$`));
    expect(first.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(first.headers['anthropic-beta']).toContain('server-side-fallback-2026-07-01');
    expect(first.body).toMatchObject({
      model: 'claude-opus-5-5',
      max_tokens: 64000,
      stream: true,
      thinking: { type: 'adaptive', display: 'summarized' },
      output_config: { effort: 'high' },
      cache_control: { type: 'ephemeral' },
      fallbacks: 'default',
    });
    expect((first.body.tools as unknown[]).length).toBe(AI_TOOLS.length);
    expect((first.body.tools as Array<{ eager_input_streaming: boolean }>).every((x) => x.eager_input_streaming)).toBe(true);
    // second request: history = user, assistant (unchanged, thinking kept), user with both tool results
    const msgs = api.requests[1].body.messages as Array<{ role: string; content: unknown }>;
    expect(msgs.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    const assistant = msgs[1].content as Array<{ type: string; signature?: string }>;
    expect(assistant[0]).toMatchObject({ type: 'thinking', signature: 'sig' });
    const results = msgs[2].content as Array<{ type: string; tool_use_id: string; is_error?: boolean; content: string }>;
    expect(results.map((r) => r.tool_use_id)).toEqual(['toolu_1', 'toolu_2']);
    expect(JSON.parse(results[0].content)).toMatchObject({ ok: true, applied: true });
    expect(results[0].is_error).toBeUndefined();
    expect(s.messages).toHaveLength(4);
  });

  it('marks failed tools as is_error and sends images of png exports', async () => {
    t = createTestTarget();
    const target = t;
    const api = fakeMessagesApi([
      {
        blocks: [
          { type: 'tool_use', id: 'a', name: 'apply_railway_script', input: { script: 'railwayScript: 1\ntracks: 5\n' } },
          { type: 'tool_use', id: 'b', name: 'export_drawing', input: { format: 'png' } },
        ],
      },
      { blocks: [{ type: 'text', text: 'ok' }] },
    ]);
    await session(api.fetch).send('x', (call) => executeAiTool(target, call.name, call.input));
    const results = (api.requests[1].body.messages as Array<{ content: unknown }>)[2].content as Array<Record<string, unknown>>;
    expect(results[0].is_error).toBe(true);
    expect(String(results[0].content)).toContain('"line":2');
    expect(results[1].content).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' } },
      { type: 'text', text: JSON.stringify({ format: 'png' }) },
    ]);
  });

  it('models without server-side fallback get no fallbacks parameter', async () => {
    const api = fakeMessagesApi([{ blocks: [{ type: 'text', text: 'hi' }] }]);
    await session(api.fetch, { model: 'claude-haiku-5-5', effort: 'low' }).send('hi', async () => {
      throw new Error('no tools');
    });
    expect(api.requests[0].body.fallbacks).toBeUndefined();
    expect(api.requests[0].headers['anthropic-beta']).toBeUndefined();
    expect(api.requests[0].body).toMatchObject({ model: 'claude-haiku-5-5', output_config: { effort: 'low' } });
  });

  it('stop during a tool answers the remaining tool_use blocks and ends the turn', async () => {
    const api = fakeMessagesApi([
      {
        blocks: [
          { type: 'tool_use', id: 'a', name: 'check_drawing', input: {} },
          { type: 'tool_use', id: 'b', name: 'check_drawing', input: {} },
        ],
      },
    ]);
    const s = session(api.fetch);
    const result = await s.send('x', async () => {
      s.stop();
      return { ok: true, summary: 'done', result: {}, edits: [] };
    });
    expect(result.end).toBe('stopped');
    const last = s.messages[s.messages.length - 1].content as Array<{ tool_use_id: string; is_error?: boolean; content: string }>;
    expect(last.map((r) => r.tool_use_id)).toEqual(['a', 'b']);
    expect(last[1]).toMatchObject({ is_error: true, content: 'Stopped by the user before this tool ran.' });
    expect(s.running).toBe(false);
  });

  it('a refusal ends the turn without keeping the declined message', async () => {
    const api = fakeMessagesApi([{ blocks: [], stop_reason: 'refusal' }]);
    const s = session(api.fetch);
    const result = await s.send('x', async () => ({ ok: true, summary: '', result: {}, edits: [] }));
    expect(result.end).toBe('refusal');
    expect(s.messages.map((m) => m.role)).toEqual(['user']);
  });

  it('API errors are readable and never contain the key', async () => {
    const fetch401 = (async () => new Response(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }), { status: 401, headers: { 'content-type': 'application/json' } })) as typeof fetch;
    const s = session(fetch401);
    let error: unknown = null;
    try {
      await s.send('x', async () => ({ ok: true, summary: '', result: {}, edits: [] }));
    } catch (e) {
      error = e;
    }
    const text = describeApiError(error);
    expect(text).toContain('API key was not accepted');
    expect(text).not.toContain(KEY);
    expect(s.running).toBe(false);
  });

  it('template-first flow: list -> insert -> set states -> build_scenario', async () => {
    t = createTestTarget();
    const target = t;
    const api = fakeMessagesApi([
      { blocks: [{ type: 'tool_use', id: 'toolu_a', name: 'list_templates', input: { query: 'przejście poziomu L1 L2', limit: 3 } }] },
      { blocks: [{ type: 'text', text: 'Using "Level transition L1 → L2".' }, { type: 'tool_use', id: 'toolu_b', name: 'insert_template', input: { id: 'ertms-tpl-22', mode: 'intoTab' } }] },
      { blocks: [{ type: 'tool_use', id: 'toolu_c', name: 'set_states', input: { items: [{ id: 'TC4', state: 'disturbed' }] } }] },
      {
        blocks: [
          {
            type: 'tool_use',
            id: 'toolu_d',
            name: 'build_scenario',
            input: {
              name: 'Wjazd pociągu',
              description: 'Train passes the L1/L2 border',
              steps: [
                { name: 'Initial', text: 'All free' },
                { name: 'Route set', states: [{ id: 'TC2', state: 'reserved' }, { id: 'TC3', state: 'reserved' }, { id: 'S2', aspect: 'proceed' }] },
                { name: 'Train enters TC2', states: [{ id: 'TC2', state: 'occupied' }, { id: 'S2', aspect: 'stop' }], uml: '@startuml\nTrain -> RBC: position report\n@enduml' },
              ],
            },
          },
        ],
      },
      { blocks: [{ type: 'text', text: 'Built the scenario from the template.' }] },
    ]);
    const s = session(api.fetch);
    const log: string[] = [];
    const run: ToolRunner = (call) => executeAiTool(target, call.name, call.input);
    const result = await s.send('Przygotuj scenariusz wjazdu pociągu przez granicę L1/L2', run, { onToolEnd: (call, outcome) => log.push(`${call.name}: ${outcome.summary}`) });
    expect(result).toEqual({ end: 'end_turn' });
    expect(log).toEqual([
      expect.stringMatching(/^list_templates: Found \d+ template\(s\) for "przejście poziomu L1 L2": best "Level transition L1 → L2"$/),
      'insert_template: Inserted template "Level transition L1 → L2" into "Test diagram"',
      'set_states: Set states on 1 object(s)',
      'build_scenario: Built scenario "Wjazd pociągu" with 3 steps',
    ]);
    const scenario = target.scenarioSet.list()[0];
    expect(scenario.name).toBe('Wjazd pociągu');
    expect(scenario.steps.map((x) => x.name)).toEqual(['Initial', 'Route set', 'Train enters TC2']);
    expect(scenario.steps[0].xml).not.toContain('rdState="disturbed"');
    expect(scenario.steps[2].uml).toContain('position report');
    const objects = collectObjects(target.graph.getDataModel());
    expect(objects.find((o) => o.id === 'TC2')!.values).toBeDefined();
    expect(target.modelXml()).toContain('rdState="occupied"');
    // the tool results went back to the model (list result names the template)
    const second = JSON.stringify(api.requests[1].body);
    expect(second).toContain('ertms-tpl-22');
  }, 30_000);

  it('apiTools mirrors the tool definitions', () => {
    expect(apiTools().map((x) => x.name)).toEqual(AI_TOOLS.map((x) => x.name));
  });
});
