/**
 * @file bridge-server.ts
 * @brief Local AI bridge (Node): a WebSocket server on 127.0.0.1 that the Railway Drawer page
 *        connects to (AI panel > Connect to AI assistant > Local MCP server). The pairing is fixed
 *        by the token in RAILWAY_DRAWER_TOKEN (the page shows it, the user pastes it into the MCP
 *        client config once), so only the browser that knows the secret can attach; browsers on
 *        other sites are refused by origin. Same relay as the Worker's Durable Object.
 */
import type { IncomingMessage } from 'node:http';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { MAX_FRAME_BYTES, hashSecret } from '../../../src/ai/bridge/protocol';
import type { PairingToken } from '../../../src/ai/bridge/protocol';
import { BridgeRelay } from '../../../src/ai/bridge/relay';

/** Origins allowed by default: the production site, the LAN copy, local dev servers. */
export const DEFAULT_ORIGINS = ['https://railwaydrawer.mksystemdesign.org', 'http://192.168.0.22', 'http://localhost:*', 'http://127.0.0.1:*', 'https://localhost:*'];

export interface BridgeServerOptions {
  token: PairingToken;
  port: number;
  host?: string;
  /** Allowed page origins (`*` matches any port), default DEFAULT_ORIGINS. */
  origins?: string[];
  callTimeoutMs?: number;
  log?(message: string): void;
}

export interface BridgeServer {
  relay: BridgeRelay;
  /** SHA-256 of the token's secret (what MCP calls present to the relay). */
  auth: string;
  port: number;
  close(): Promise<void>;
}

export function originAllowed(origin: string | undefined, patterns: string[]): boolean {
  if (!origin) return false;
  return patterns.some((p) => {
    if (p === origin) return true;
    if (p.endsWith(':*')) {
      const base = p.slice(0, -2);
      return origin === base || (origin.startsWith(`${base}:`) && /^\d+$/.test(origin.slice(base.length + 1)));
    }
    return false;
  });
}

export function startBridgeServer(options: BridgeServerOptions): Promise<BridgeServer> {
  const auth = hashSecret(options.token.secret);
  const relay = new BridgeRelay({ session: options.token.session, via: 'local', callTimeoutMs: options.callTimeoutMs });
  relay.restore(null, { auth, expiresAt: Number.MAX_SAFE_INTEGER });
  const origins = options.origins ?? DEFAULT_ORIGINS;
  const log = options.log ?? (() => undefined);
  return new Promise((resolve, reject) => {
    const wss = new WebSocketServer({
      host: options.host ?? '127.0.0.1',
      port: options.port,
      path: '/bridge',
      maxPayload: MAX_FRAME_BYTES,
      verifyClient: (info: { origin?: string; req: IncomingMessage }) => {
        const ok = originAllowed(info.origin ?? info.req.headers.origin, origins);
        if (!ok) log(`refused a connection from origin ${String(info.origin)}`);
        return ok;
      },
    });
    wss.on('connection', (ws: WebSocket) => {
      log('browser connected');
      ws.on('message', (data, isBinary) => {
        if (isBinary) {
          ws.close(1003, 'text only');
          return;
        }
        relay.onBrowserMessage(ws, data.toString());
      });
      ws.on('close', () => {
        log('browser disconnected');
        relay.onBrowserClose(ws);
      });
      ws.on('error', () => relay.onBrowserClose(ws));
    });
    wss.once('error', reject);
    wss.once('listening', () => {
      const address = wss.address();
      const port = typeof address === 'object' && address ? address.port : options.port;
      log(`bridge listening on ws://${options.host ?? '127.0.0.1'}:${port}/bridge`);
      resolve({
        relay,
        auth,
        port,
        close: () =>
          new Promise<void>((done) => {
            for (const c of wss.clients) c.terminate();
            wss.close(() => done());
          }),
      });
    });
  });
}
