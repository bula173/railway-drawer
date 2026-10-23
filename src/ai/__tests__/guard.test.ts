import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HELLO_TIMEOUT_MS,
  MAX_PAIRED_SOCKETS,
  MAX_UNPAIRED_SOCKETS,
  admitBridgeSocket,
  checkMcpRateLimit,
  pairedOverflow,
  redactUrl,
  staleUnpairedSockets,
  withApiHeaders,
} from '../mcp/guard';
import { handleMcpRequest } from '../mcp/http';
import { formatPairingToken, newPairingToken } from '../bridge/protocol';
import { DEFAULT_SETTINGS, readSettings } from '../chat/settings';

describe('redactUrl', () => {
  it('removes the pairing code from URLs', () => {
    expect(redactUrl('https://x.test/mcp?pair=rdp1.abc.def&x=1')).toBe('https://x.test/mcp?pair=REDACTED&x=1');
    expect(redactUrl('https://x.test/mcp')).toBe('https://x.test/mcp');
    expect(redactUrl('not a url?pair=secret')).toBe('not a url?pair=REDACTED');
  });
});

describe('MCP rate limit', () => {
  const request = new Request('https://x.test/mcp', { headers: { 'cf-connecting-ip': '203.0.113.7' } });
  it('passes without bindings and when the limiters allow', async () => {
    expect(await checkMcpRateLimit(request, {})).toBeNull();
    const perIp = { limit: vi.fn(async () => ({ success: true })) };
    const global = { limit: vi.fn(async () => ({ success: true })) };
    expect(await checkMcpRateLimit(request, { perIp, global })).toBeNull();
    expect(perIp.limit).toHaveBeenCalledWith({ key: 'mcp:ip:203.0.113.7' });
    expect(global.limit).toHaveBeenCalledWith({ key: 'mcp:global' });
  });
  it('answers 429 when the per-IP or the global limit is reached', async () => {
    const no = { limit: vi.fn(async () => ({ success: false })) };
    const yes = { limit: vi.fn(async () => ({ success: true })) };
    const a = await checkMcpRateLimit(request, { perIp: no, global: yes });
    expect(a?.status).toBe(429);
    expect(a?.headers.get('retry-after')).toBe('60');
    expect(a?.headers.get('x-content-type-options')).toBe('nosniff');
    expect((await checkMcpRateLimit(request, { perIp: yes, global: no }))?.status).toBe(429);
  });
  it('fails open when the limiter itself fails', async () => {
    const broken = { limit: vi.fn(async () => Promise.reject(new Error('down'))) };
    expect(await checkMcpRateLimit(request, { perIp: broken })).toBeNull();
  });
});

describe('bridge socket limits', () => {
  const now = 1_000_000;
  it('unpaired sockets do not count toward the paired cap and are capped separately', () => {
    const paired = Array.from({ length: MAX_PAIRED_SOCKETS }, () => ({ paired: true, acceptedAt: now - 60_000 }));
    expect(admitBridgeSocket(paired, now)).toBe(true);
    const waiting = Array.from({ length: MAX_UNPAIRED_SOCKETS }, () => ({ paired: false, acceptedAt: now - 1000 }));
    expect(admitBridgeSocket([...paired, ...waiting], now)).toBe(false);
    // past their hello deadline they no longer block (and are closed)
    expect(admitBridgeSocket(waiting.map((s) => ({ ...s, acceptedAt: now - HELLO_TIMEOUT_MS })), now)).toBe(true);
  });
  it('closes sockets without a hello after the timeout, never paired ones', () => {
    const sockets = [
      { paired: false, acceptedAt: now - HELLO_TIMEOUT_MS - 1 },
      { paired: false, acceptedAt: now - 500 },
      { paired: true, acceptedAt: now - HELLO_TIMEOUT_MS * 10 },
      { paired: false, acceptedAt: 0 },
    ];
    expect(staleUnpairedSockets(sockets, now)).toEqual([0, 3]);
  });
  it('closes the oldest paired sockets beyond the cap', () => {
    const sockets = Array.from({ length: MAX_PAIRED_SOCKETS + 2 }, (_, i) => ({ paired: true, acceptedAt: 100 - i }));
    expect(pairedOverflow(sockets).sort()).toEqual([MAX_PAIRED_SOCKETS, MAX_PAIRED_SOCKETS + 1]);
  });
});

describe('MCP endpoint hardening', () => {
  afterEach(() => vi.restoreAllMocks());
  it('answers with API security headers', async () => {
    const res = await handleMcpRequest(new Request('https://x.test/mcp', { method: 'POST', body: '{}' }), vi.fn());
    expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(withApiHeaders(new Response('x', { headers: { 'cache-control': 'max-age=1' } })).headers.get('cache-control')).toBe('max-age=1');
  });
  it('never logs the pairing code and does not pass it on', async () => {
    const token = formatPairingToken(newPairingToken());
    const logs: string[] = [];
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => void logs.push(args.map(String).join(' ')));
    }
    const res = await handleMcpRequest(
      new Request(`https://x.test/mcp?pair=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-06-18' },
        body: '{"jsonrpc":"2.0","id":1,"method":"nope"}',
      }),
      vi.fn()
    );
    expect(await res.text()).not.toContain(token.split('.')[2]);
    expect(logs.join('\n')).not.toContain(token.split('.')[2]);
  });
});

describe('AI settings', () => {
  it('confirms remote MCP changes by default, the chat keeps its own setting', () => {
    localStorage.removeItem('rd.ai.settings');
    expect(DEFAULT_SETTINGS.confirmRemoteChanges).toBe(true);
    expect(DEFAULT_SETTINGS.confirmChanges).toBe(false);
    localStorage.setItem('rd.ai.settings', JSON.stringify({ confirmChanges: true }));
    expect(readSettings()).toMatchObject({ confirmChanges: true, confirmRemoteChanges: true });
    localStorage.setItem('rd.ai.settings', JSON.stringify({ confirmRemoteChanges: false }));
    expect(readSettings()).toMatchObject({ confirmChanges: false, confirmRemoteChanges: false });
    localStorage.removeItem('rd.ai.settings');
  });
});
