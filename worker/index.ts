/**
 * @file index.ts
 * @brief The Railway Drawer Worker. The app itself stays static assets (dist/, SPA not-found
 *        handling, served without running this script); `run_worker_first` in wrangler.jsonc sends
 *        only these paths here:
 *        - `/mcp`: remote MCP server (Streamable HTTP, stateless) for Claude Desktop / Code /
 *          claude.ai connectors; authenticated by the pairing token (src/ai/mcp/http.ts);
 *        - `/api/ai-bridge/<session>/ws`: the browser tab's WebSocket to its pairing's Durable
 *          Object (same-origin only).
 *        No Anthropic API key is involved anywhere here.
 */
import { handleMcpRequest } from '../src/ai/mcp/http';
import { isSessionId } from '../src/ai/bridge/protocol';
import { AiBridge } from './ai-bridge';
import type { Env } from './env';

export { AiBridge };

const VERSION = '1';

function bridgeStub(env: Env, session: string): DurableObjectStub<AiBridge> {
  return env.AI_BRIDGE.get(env.AI_BRIDGE.idFromName(session));
}

/** Same-origin WebSocket only: blocks other sites from opening the bridge with the user's cookies. */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return !!origin && origin === new URL(request.url).origin;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/mcp' || url.pathname === '/mcp/') {
      return handleMcpRequest(
        request,
        (session, auth, tool, input) => bridgeStub(env, session).relayCall(session, auth, tool, input),
        VERSION
      );
    }
    const m = /^\/api\/ai-bridge\/([^/]+)\/ws$/.exec(url.pathname);
    if (m) {
      if (!isSessionId(m[1])) return new Response('Bad session', { status: 400 });
      if (!sameOrigin(request)) return new Response('Forbidden origin', { status: 403 });
      return bridgeStub(env, m[1]).fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
