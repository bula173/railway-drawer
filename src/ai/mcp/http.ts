/**
 * @file http.ts
 * @brief The remote MCP endpoint (Streamable HTTP, stateless; `/mcp` on the Worker) without the
 *        Cloudflare runtime, so it is unit-testable: reads the pairing token (Authorization: Bearer,
 *        or `?pair=` for clients that only take a URL such as claude.ai custom connectors), caps the
 *        body size, and serves the MCP request with a fresh server whose tools relay to the paired
 *        browser through `relay` (the Worker passes its Durable Object).
 *
 *        Prefer the Bearer header: `?pair=` puts the pairing code into the URL, which clients,
 *        proxies and request logs may keep (Cloudflare's own request logs included). It stays for
 *        clients that cannot send headers (claude.ai custom connectors); the app shows the header
 *        variant first, the code expires after at most 12 hours and "New code" revokes it. The
 *        endpoint never logs URLs; anything that does must use `redactUrl` (guard.ts), and the
 *        request handed to the MCP handler no longer carries the code.
 */
import { createMcpHandler } from '@modelcontextprotocol/server';
import { MAX_MCP_BODY_BYTES, hashSecret, parsePairingToken } from '../bridge/protocol';
import type { RelayCallResult } from '../bridge/relay';
import { createRailwayMcpServer } from './mcp-server';
import { API_SECURITY_HEADERS, withApiHeaders } from './guard';

/** Relays a validated tool call to the pairing's browser (throws RelayError-like errors). */
export type RemoteRelay = (session: string, auth: string, tool: string, input: Record<string, unknown>) => Promise<RelayCallResult>;

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...API_SECURITY_HEADERS, ...extra } });
}

/** The pairing token of a request: Bearer header first, then the `pair` query parameter. */
export function tokenOf(request: Request): string | null {
  const header = request.headers.get('authorization') ?? '';
  const m = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (m) return m[1];
  return new URL(request.url).searchParams.get('pair');
}

export async function handleMcpRequest(request: Request, relay: RemoteRelay, version = '1'): Promise<Response> {
  const token = parsePairingToken(tokenOf(request));
  if (!token) {
    return json(
      401,
      { error: 'pairing_required', message: 'Railway Drawer MCP needs a pairing code: open the app, AI panel > "Connect to AI assistant", and use the URL or token shown there.' },
      { 'www-authenticate': 'Bearer realm="railway-drawer"' }
    );
  }
  const length = Number(request.headers.get('content-length') ?? '0');
  if (length > MAX_MCP_BODY_BYTES) return json(413, { error: 'too_large', message: 'Request too large' });
  let body: string | undefined;
  if (request.method === 'POST') {
    body = await request.text();
    if (body.length > MAX_MCP_BODY_BYTES) return json(413, { error: 'too_large', message: 'Request too large' });
  }
  const auth = hashSecret(token.secret);
  const handler = createMcpHandler(() => createRailwayMcpServer((tool, input) => relay(token.session, auth, tool, input), version), {
    maxRequestBodySize: MAX_MCP_BODY_BYTES,
    // no mid-call notifications: one JSON answer per request (the handler is closed right after)
    responseMode: 'json',
  });
  // the body was read for the size check: hand the handler a fresh request, without the pairing
  // code in its URL or headers (nothing downstream needs it; nothing downstream can log it)
  const url = new URL(request.url);
  url.searchParams.delete('pair');
  const headers = new Headers(request.headers);
  headers.delete('authorization');
  const forwarded = new Request(url, { method: request.method, headers, ...(body !== undefined ? { body } : {}) });
  try {
    return withApiHeaders(await handler.fetch(forwarded));
  } finally {
    void handler.close();
  }
}
