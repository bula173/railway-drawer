// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  CLOSE_AUTH,
  CLOSE_EXPIRED,
  CLOSE_REPLACED,
  MAX_PAIRING_TTL_S,
  formatPairingToken,
  hashSecret,
  newPairingToken,
  parseBrowserMessage,
  parsePairingToken,
  parseServerMessage,
  sameHash,
} from '../bridge/protocol';
import { BridgeRelay, RelayError } from '../bridge/relay';
import type { RelaySocket } from '../bridge/relay';
import { handleMcpRequest, tokenOf } from '../mcp/http';
import { AI_TOOLS } from '../tool-defs';

class FakeSocket implements RelaySocket {
  sent: Array<Record<string, unknown>> = [];
  closed: { code?: number; reason?: string } | null = null;
  send(text: string): void {
    this.sent.push(JSON.parse(text) as Record<string, unknown>);
  }
  close(code?: number, reason?: string): void {
    this.closed = { code, reason };
  }
  last(): Record<string, unknown> {
    return this.sent[this.sent.length - 1];
  }
}

const hello = (auth: string, ttl?: number): string => JSON.stringify({ t: 'hello', v: 1, auth, ttl });

describe('pairing tokens', () => {
  it('round-trips and rejects malformed tokens', () => {
    const t = newPairingToken();
    const text = formatPairingToken(t);
    expect(text).toMatch(/^rdp1\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/);
    expect(parsePairingToken(text)).toEqual(t);
    expect(parsePairingToken(` ${text} `)).toEqual(t);
    for (const bad of ['', 'rdp1.a.b', text.replace('rdp1', 'rdp2'), `${text}.x`, text.slice(0, -1), text.replace(/.$/, '$')]) expect(parsePairingToken(bad)).toBeNull();
  });

  it('hashes secrets with SHA-256 (hex) and compares in constant time', async () => {
    const { createHash } = await import('node:crypto');
    const secret = newPairingToken().secret;
    expect(hashSecret(secret)).toBe(createHash('sha256').update(secret).digest('hex'));
    expect(sameHash('ab', 'ab')).toBe(true);
    expect(sameHash('ab', 'ac')).toBe(false);
    expect(sameHash('ab', 'abc')).toBe(false);
  });

  it('parses only well-formed frames', () => {
    expect(parseBrowserMessage('nope')).toBeNull();
    expect(parseBrowserMessage(JSON.stringify({ t: 'hello', v: 1, auth: 'short' }))).toBeNull();
    expect(parseBrowserMessage(JSON.stringify({ t: 'result', id: 'c1', ok: true, result: 1, image: { mediaType: 'image/gif', data: 'x' } }))).toEqual({ t: 'result', id: 'c1', ok: true, summary: undefined, result: 1, image: undefined });
    expect(parseServerMessage(JSON.stringify({ t: 'call', id: 'c1', tool: 'undo' }))).toEqual({ t: 'call', id: 'c1', tool: 'undo', input: {} });
  });
});

describe('BridgeRelay', () => {
  const auth = hashSecret('s'.repeat(43));

  function paired(now = () => 1000): { relay: BridgeRelay; browser: FakeSocket } {
    const relay = new BridgeRelay({ session: 'S'.repeat(22), via: 'remote', now, callTimeoutMs: 50 });
    const browser = new FakeSocket();
    relay.onBrowserMessage(browser, hello(auth, 600));
    return { relay, browser };
  }

  it('claims the pairing with the first hello and relays calls both ways', async () => {
    const { relay, browser } = paired();
    expect(browser.last()).toEqual({ t: 'welcome', session: 'S'.repeat(22), expiresAt: 1000 + 600_000, via: 'remote' });
    const pending = relay.call(auth, 'get_drawing', { includeScript: false });
    const call = browser.last();
    expect(call).toMatchObject({ t: 'call', tool: 'get_drawing', input: { includeScript: false } });
    relay.onBrowserMessage(browser, JSON.stringify({ t: 'result', id: call.id, ok: true, summary: 'Read', result: { tab: 'A' } }));
    await expect(pending).resolves.toEqual({ ok: true, summary: 'Read', result: { tab: 'A' }, image: undefined });
  });

  it('refuses other secrets, expired pairings and calls without a browser', async () => {
    let now = 1000;
    const { relay, browser } = paired(() => now);
    await expect(relay.call(hashSecret('x'), 'undo', {})).rejects.toMatchObject({ code: 'unauthorized' });
    const intruder = new FakeSocket();
    relay.onBrowserMessage(intruder, hello(hashSecret('other')));
    expect(intruder.closed?.code).toBe(CLOSE_AUTH);
    relay.onBrowserClose(browser);
    await expect(relay.call(auth, 'undo', {})).rejects.toMatchObject({ code: 'not-connected' });
    now += 601_000;
    await expect(relay.call(auth, 'undo', {})).rejects.toMatchObject({ code: 'expired' });
    const late = new FakeSocket();
    relay.onBrowserMessage(late, hello(auth));
    expect(late.closed?.code).toBe(CLOSE_EXPIRED);
  });

  it('caps the lifetime, replaces an older browser window and fails its pending calls', async () => {
    const relay = new BridgeRelay({ session: 'S'.repeat(22), via: 'local', now: () => 0 });
    const a = new FakeSocket();
    relay.onBrowserMessage(a, hello(auth, 10 ** 9));
    expect(a.last().expiresAt).toBe(MAX_PAIRING_TTL_S * 1000);
    const pending = relay.call(auth, 'undo', {});
    const b = new FakeSocket();
    relay.onBrowserMessage(b, hello(auth));
    expect(a.closed?.code).toBe(CLOSE_REPLACED);
    await expect(pending).rejects.toBeInstanceOf(RelayError);
    expect(b.last()).toMatchObject({ t: 'welcome', via: 'local' });
  });

  it('times out, rate-limits and rejects bad frames', async () => {
    const { relay, browser } = paired();
    await expect(relay.call(auth, 'undo', {})).rejects.toMatchObject({ code: 'timeout' });
    const limited = new BridgeRelay({ session: 'S'.repeat(22), via: 'remote', now: () => 5, maxCallsPerMinute: 2, callTimeoutMs: 10 });
    const s = new FakeSocket();
    limited.onBrowserMessage(s, hello(auth));
    const p1 = limited.call(auth, 'undo', {}).catch(() => 'x');
    const p2 = limited.call(auth, 'undo', {}).catch(() => 'x');
    await expect(limited.call(auth, 'undo', {})).rejects.toMatchObject({ code: 'rate-limited' });
    await Promise.all([p1, p2]);
    relay.onBrowserMessage(browser, '{"t":"bogus"}');
    expect(browser.closed?.code).toBe(4400);
  });
});

describe('remote MCP endpoint (Streamable HTTP)', () => {
  const token = formatPairingToken(newPairingToken());
  const parsed = parsePairingToken(token)!;

  async function rpc(body: unknown, relay = vi.fn(), auth: 'header' | 'query' = 'header'): Promise<{ status: number; json: Record<string, unknown> }> {
    const url = auth === 'query' ? `https://example.test/mcp?pair=${encodeURIComponent(token)}` : 'https://example.test/mcp';
    const res = await handleMcpRequest(
      new Request(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'mcp-protocol-version': '2025-06-18',
          ...(auth === 'header' ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      }),
      relay
    );
    const text = await res.text();
    const data = text.startsWith('{') ? text : (text.split('\n').find((l) => l.startsWith('data: ')) ?? 'data: {}').slice(6);
    return { status: res.status, json: JSON.parse(data) as Record<string, unknown> };
  }

  it('needs a pairing token', async () => {
    const res = await handleMcpRequest(new Request('https://example.test/mcp', { method: 'POST', body: '{}' }), vi.fn());
    expect(res.status).toBe(401);
    expect(await res.text()).toContain('pairing');
    expect(tokenOf(new Request(`https://x/mcp?pair=${token}`))).toBe(token);
  });

  it('initializes and lists the tools with their JSON Schemas', async () => {
    const init = await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } } });
    expect(init.status).toBe(200);
    const result = init.json.result as { serverInfo: { name: string }; instructions?: string };
    expect(result.serverInfo.name).toBe('railway-drawer');
    expect(result.instructions).toContain('Railway Script');
    const list = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, vi.fn(), 'query');
    const tools = (list.json.result as { tools: Array<{ name: string; inputSchema: Record<string, unknown> }> }).tools;
    expect(tools.map((t) => t.name)).toEqual(AI_TOOLS.map((t) => t.name));
    expect(tools.find((t) => t.name === 'apply_railway_script')!.inputSchema).toMatchObject({ type: 'object', required: ['script'] });
  });

  it('validates tool input, then relays it with the session and secret hash', async () => {
    const relay = vi.fn(async () => ({ ok: true, summary: 'ok', result: { applied: true }, image: { mediaType: 'image/png' as const, data: 'AAAA' } }));
    const bad = await rpc({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'apply_railway_script', arguments: { script: 5 } } }, relay);
    const badResult = (bad.json.result ?? bad.json.error) as Record<string, unknown>;
    expect(JSON.stringify(badResult)).toMatch(/script expected string/);
    expect(relay).not.toHaveBeenCalled();
    const good = await rpc({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'apply_railway_script', arguments: { script: 'railwayScript: 1\n' } } }, relay);
    expect(relay).toHaveBeenCalledWith(parsed.session, hashSecret(parsed.secret), 'apply_railway_script', { script: 'railwayScript: 1\n' });
    const content = (good.json.result as { content: Array<Record<string, unknown>>; isError?: boolean }).content;
    expect(content[0]).toEqual({ type: 'text', text: JSON.stringify({ applied: true }) });
    expect(content[1]).toMatchObject({ type: 'image', data: 'AAAA', mimeType: 'image/png' });
  });

  it('relay errors become tool errors the client can show', async () => {
    const relay = vi.fn(async () => {
      throw new RelayError('not-connected', 'No Railway Drawer tab is connected');
    });
    const out = await rpc({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'undo', arguments: {} } }, relay);
    expect(out.json.result).toMatchObject({ isError: true, content: [{ type: 'text', text: 'No Railway Drawer tab is connected' }] });
  });

  it('rejects oversized bodies', async () => {
    const res = await handleMcpRequest(new Request('https://example.test/mcp', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: 'x'.repeat(600_000) }), vi.fn());
    expect(res.status).toBe(413);
  });
});
