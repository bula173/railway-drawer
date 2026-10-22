/**
 * @file ai.spec.ts
 * @brief AI assistant end to end, offline: the Anthropic Messages API is mocked with page.route
 *        (streamed SSE replies, no real key, no network). Settings: the key is masked, kept only in
 *        localStorage `rd.ai.settings`, never sent anywhere but api.anthropic.com. Chat: a typed
 *        request -> mocked tool calls draw tracks/signals on the canvas -> "Undo AI turn" removes
 *        them; confirm mode shows a Keep/Discard card and Discard undoes the change (the model is
 *        told). Pairing: "Create pairing code" shows the MCP URL / Claude Code command, kept over a
 *        reload. MCP relay: a local bridge server (tools/mcp-local/src/bridge-server.ts, in this
 *        test process) relays a tool call to the page, which draws it and answers. Any port.
 */
import { test, expect } from '@playwright/test';
import type { Page, Request } from '@playwright/test';
import { hashSecret, parsePairingToken } from '../../src/ai/bridge/protocol';
import { sseBody } from '../../src/ai/__tests__/sse';
import type { FakeReply } from '../../src/ai/__tests__/sse';
import { startBridgeServer } from '../../tools/mcp-local/src/bridge-server';

const KEY = 'sk-ant-e2e-fake-key-0123456789abcdef';

const SCRIPT = `railwayScript: 1
name: AI line
tracks:
  - { id: T1, startKm: 0.000, endKm: 2.000 }
signals:
  - { id: S1, track: T1, at: 0.300, direction: nominal, type: main, aspects: 3 }
  - { id: S2, track: T1, at: 1.500, direction: nominal, type: main }
`;

async function railwayObjects(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const registry = await import('/src/services/service-registry.ts' as string);
    const validation = await import('/src/railway/validation.ts' as string);
    const tab = registry.ServiceRegistry.getTabManager().getActiveTab();
    return validation
      .collectObjects(tab.graph.getDataModel())
      .map((o: { kind: { id: string }; id: string }) => `${o.kind.id}:${o.id}`)
      .sort();
  });
}

interface Captured {
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

async function mockAnthropic(page: Page, replies: FakeReply[]): Promise<Captured[]> {
  const captured: Captured[] = [];
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
  await page.route('https://api.anthropic.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    captured.push({ headers: await req.allHeaders(), body: req.postDataJSON() as Record<string, unknown> });
    const reply = replies.shift();
    if (!reply) return route.fulfill({ status: 500, headers: { ...cors, 'content-type': 'application/json' }, body: '{"type":"error","error":{"type":"api_error","message":"no reply scripted"}}' });
    return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream' }, body: sseBody(reply) });
  });
  return captured;
}

/** Shows the AI view (retried: right after a load the panel switch may not be wired yet). */
async function showAi(page: Page): Promise<void> {
  await page.locator('#graph-container').waitFor();
  await expect(async () => {
    await page.locator('[data-right-panel="ai"]').click();
    await expect(page.getByTestId('ai-panel')).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
}

async function openAi(page: Page): Promise<void> {
  await page.goto('/');
  await showAi(page);
}

async function saveKey(page: Page): Promise<void> {
  const settings = page.getByTestId('ai-settings');
  if (!(await settings.evaluate((d) => (d as HTMLDetailsElement).open))) await settings.locator('summary').click();
  await page.getByTestId('ai-key').fill(KEY);
  await page.getByTestId('ai-key-save').click();
  await expect(page.getByTestId('ai-key-status')).toContainText('sk-ant-…cdef');
}

test.describe('AI assistant', () => {
  test('API key: masked, stored only in this browser, removable', async ({ page }) => {
    const leaks: string[] = [];
    page.on('request', (r: Request) => {
      if (r.url().startsWith('https://api.anthropic.com/')) return;
      const text = `${r.url()} ${JSON.stringify(r.headers())} ${r.postData() ?? ''}`;
      if (text.includes(KEY)) leaks.push(r.url());
    });
    await openAi(page);
    await expect(page.getByTestId('ai-key-hint')).toContainText('Add your Anthropic API key');
    await expect(page.getByTestId('ai-send')).toBeDisabled();
    const key = page.getByTestId('ai-key');
    await expect(key).toHaveAttribute('type', 'password');
    await key.fill(KEY);
    await page.getByTestId('ai-key-toggle').click();
    await expect(key).toHaveAttribute('type', 'text');
    await page.getByTestId('ai-key-save').click();
    await expect(key).toHaveValue('');
    await expect(key).toHaveAttribute('type', 'password');
    const status = page.getByTestId('ai-key-status');
    await expect(status).toHaveText('Key saved in this browser: sk-ant-…cdef');
    await expect(page.getByTestId('ai-panel')).not.toContainText(KEY);
    await expect(page.getByTestId('ai-send')).toBeEnabled();
    const stored = await page.evaluate(() => {
      const out: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) out[localStorage.key(i)!] = localStorage.getItem(localStorage.key(i)!) ?? '';
      for (let i = 0; i < sessionStorage.length; i++) out[`session:${sessionStorage.key(i)!}`] = sessionStorage.getItem(sessionStorage.key(i)!) ?? '';
      return out;
    });
    expect(JSON.parse(stored['rd.ai.settings']).apiKey).toBe(KEY);
    expect(Object.entries(stored).filter(([k, v]) => k !== 'rd.ai.settings' && v.includes(KEY))).toEqual([]);
    await page.reload();
    await showAi(page);
    await expect(page.getByTestId('ai-key-status')).toHaveText('Key saved in this browser: sk-ant-…cdef');
    // the diagram cache and a .drawio download never contain the key
    const cache = await page.evaluate(() => localStorage.getItem('railway-drawer-cache') ?? '');
    expect(cache).not.toContain(KEY);
    await page.getByTestId('ai-settings').locator('summary').click();
    await page.getByTestId('ai-key-remove').click();
    await expect(page.getByTestId('ai-key-status')).toHaveText('No key saved.');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('rd.ai.settings') ?? '{}').apiKey)).toBe('');
    expect(leaks).toEqual([]);
  });

  test('a request is drawn by mocked tool calls and undone as one AI turn', async ({ page }) => {
    const replies: FakeReply[] = [
      {
        blocks: [
          { type: 'text', text: 'I will draw a line with two signals.' },
          { type: 'tool_use', id: 'toolu_a', name: 'get_drawing', input: {} },
        ],
      },
      { blocks: [{ type: 'tool_use', id: 'toolu_b', name: 'apply_railway_script', input: { script: SCRIPT } }] },
      { blocks: [{ type: 'tool_use', id: 'toolu_c', name: 'set_states', input: { items: [{ id: 'S1', aspect: 'proceed' }] } }] },
      { blocks: [{ type: 'text', text: 'Done: **T1** with signals S1 and S2.' }] },
    ];
    const captured = await mockAnthropic(page, replies);
    await openAi(page);
    await saveKey(page);
    const input = page.getByTestId('ai-input');
    await input.fill('Draw a 2 km line with two main signals');
    await input.press('Enter');
    const log = page.getByTestId('ai-log');
    await expect(log.locator('.rd-ai-tool[data-tool="apply_railway_script"]')).toHaveText('✓ Applied Railway Script: 1 track, 2 signals');
    await expect(log.locator('.rd-ai-tool[data-tool="set_states"]')).toHaveAttribute('data-status', 'ok');
    await expect(log.locator('.rd-ai-assistant').last()).toHaveText('Done: T1 with signals S1 and S2.');
    await expect(log.locator('.rd-ai-assistant strong')).toHaveText('T1');
    await expect(page.getByTestId('ai-send')).toBeVisible();
    expect(await railwayObjects(page)).toEqual(['signal:S1', 'signal:S2', 'track:T1']);
    // the requests went straight to the API with the user's key and the browser header
    expect(captured).toHaveLength(4);
    expect(captured[0].headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(`${captured[0].headers.authorization ?? ''}${captured[0].headers['x-api-key'] ?? ''}`).toContain(KEY);
    expect(captured[0].body).toMatchObject({ model: 'claude-opus-5-5', stream: true });
    const second = captured[2].body.messages as Array<{ role: string; content: Array<{ type: string; tool_use_id?: string; content?: string }> }>;
    const toolResult = second[second.length - 1].content[0];
    expect(toolResult).toMatchObject({ type: 'tool_result', tool_use_id: 'toolu_b' });
    expect(JSON.parse(toolResult.content!)).toMatchObject({ ok: true, applied: true });
    // one click undoes the whole turn (script apply + state)
    await page.getByTestId('ai-undo-turn').click();
    await expect(log.locator('.rd-ai-status').last()).toHaveText('Undid the AI turn (2 steps).');
    expect(await railwayObjects(page)).toEqual([]);
    await expect(page.getByTestId('ai-undo-turn')).toBeDisabled();
  });

  test('confirm mode: Discard undoes the change and tells the model', async ({ page }) => {
    const replies: FakeReply[] = [
      { blocks: [{ type: 'tool_use', id: 'toolu_x', name: 'apply_railway_script', input: { script: SCRIPT } }] },
      { blocks: [{ type: 'text', text: 'Understood, nothing changed.' }] },
    ];
    const captured = await mockAnthropic(page, replies);
    await openAi(page);
    await saveKey(page);
    await page.getByTestId('ai-confirm').check();
    await page.getByTestId('ai-input').fill('Draw a line');
    await page.getByTestId('ai-send').click();
    const card = page.getByTestId('ai-confirm-card');
    await expect(card).toContainText('Applied Railway Script: 1 track, 2 signals');
    await expect(card).toContainText('added');
    expect(await railwayObjects(page)).toEqual(['signal:S1', 'signal:S2', 'track:T1']);
    await card.getByTestId('ai-discard').click();
    await expect(page.getByTestId('ai-log').locator('.rd-ai-assistant').last()).toHaveText('Understood, nothing changed.');
    expect(await railwayObjects(page)).toEqual([]);
    const msgs = captured[1].body.messages as Array<{ content: Array<{ is_error?: boolean; content?: string }> }>;
    const result = msgs[msgs.length - 1].content[0];
    expect(result.is_error).toBe(true);
    expect(result.content).toContain('discarded');
  });

  test('pairing: the MCP URL and Claude Code command are shown and kept over a reload', async ({ page }) => {
    await openAi(page);
    const connect = page.getByTestId('ai-connect');
    await connect.locator('summary').click();
    await page.getByTestId('ai-pair-create').click();
    const url = await page.getByTestId('ai-pair-url').inputValue();
    expect(url).toMatch(/^http:\/\/localhost:\d+\/mcp\?pair=rdp1\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/);
    const token = await page.getByTestId('ai-pair-token').inputValue();
    expect(parsePairingToken(token)).not.toBeNull();
    await expect(page.getByTestId('ai-pair-cmd')).toHaveValue(`claude mcp add --transport http railway-drawer ${new URL(url).origin}/mcp --header "Authorization: Bearer ${token}"`);
    await expect(page.getByTestId('ai-pair-status')).not.toBeEmpty();
    await page.reload();
    await showAi(page);
    await page.getByTestId('ai-connect').locator('summary').click();
    await expect(page.getByTestId('ai-pair-token')).toHaveValue(token);
    await page.getByTestId('ai-pair-disconnect').click();
    await expect(page.getByTestId('ai-pair-create')).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem('rd.ai.pairing'))).toBeNull();
  });

  test('MCP relay round trip through the local bridge draws in the page', async ({ page }) => {
    await openAi(page);
    await page.getByTestId('ai-connect').locator('summary').click();
    const config = JSON.parse(await page.getByTestId('ai-local-config').inputValue()) as { mcpServers: Record<string, { env: Record<string, string> }> };
    const token = parsePairingToken(config.mcpServers['railway-drawer-local'].env.RAILWAY_DRAWER_TOKEN)!;
    const server = await startBridgeServer({ token, port: 0, callTimeoutMs: 20_000 });
    try {
      await page.getByTestId('ai-local-port').fill(String(server.port));
      await page.getByTestId('ai-local-port').dispatchEvent('change');
      await page.getByTestId('ai-local-connect').click();
      await expect(page.getByTestId('ai-local-status')).toHaveAttribute('data-status', 'connected');
      const result = await server.relay.call(hashSecret(token.secret), 'apply_railway_script', { script: SCRIPT });
      expect(result).toMatchObject({ ok: true, summary: 'Applied Railway Script: 1 track, 2 signals' });
      expect(await railwayObjects(page)).toEqual(['signal:S1', 'signal:S2', 'track:T1']);
      await expect(page.getByTestId('ai-log').locator('.rd-ai-tool[data-source="mcp"]')).toHaveText('MCP · ✓ Applied Railway Script: 1 track, 2 signals');
      const bad = await server.relay.call(hashSecret(token.secret), 'routes', { action: 'find', from: 'S1' });
      expect(bad.ok).toBe(false);
      // a wrong secret never reaches the page
      await expect(server.relay.call(hashSecret('x'.repeat(43)), 'undo', {})).rejects.toThrow('Unknown or expired pairing code');
    } finally {
      await server.close();
    }
  });
});
