/**
 * @file ai-bridge.ts
 * @brief Durable Object `AiBridge`: one instance per pairing session (named by the session id).
 *        The user's browser tab connects a WebSocket (`/api/ai-bridge/<session>/ws`, same origin,
 *        so a Cloudflare Access session cookie applies), the remote MCP endpoint calls
 *        `relayCall()` over RPC, and the shared BridgeRelay (src/ai/bridge/relay.ts) passes the call
 *        to the browser and the result back. Uses the WebSocket Hibernation API: the pairing (secret
 *        hash + expiry) is kept in storage and restored on wake-up; an alarm at the expiry closes
 *        the sockets and deletes it. Nothing about the drawing is stored here.
 */
import { DurableObject } from 'cloudflare:workers';
import { CLOSE_EXPIRED, MAX_FRAME_BYTES, isSessionId } from '../src/ai/bridge/protocol';
import { BridgeRelay } from '../src/ai/bridge/relay';
import type { PairingState, RelayCallResult } from '../src/ai/bridge/relay';
import type { Env } from './env';

const PAIRING_KEY = 'pairing';
const SESSION_KEY = 'session';
/** Browser windows that may hold a socket to one pairing at the same time (abuse cap). */
const MAX_SOCKETS = 4;

export class AiBridge extends DurableObject<Env> {
  private relay: BridgeRelay | null = null;
  private session = '';

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      this.session = (await ctx.storage.get<string>(SESSION_KEY)) ?? '';
      const pairing = await ctx.storage.get<PairingState>(PAIRING_KEY);
      if (this.session && pairing) {
        const relay = this.ensureRelay(this.session);
        // the paired browser socket (tagged by onPairing) survives hibernation
        const paired = ctx.getWebSockets('browser').filter((ws) => (ws.deserializeAttachment() as { paired?: boolean } | null)?.paired);
        relay.restore(paired[paired.length - 1] ?? null, pairing);
      }
    });
  }

  private ensureRelay(session: string): BridgeRelay {
    if (!this.relay) {
      this.session = session;
      this.relay = new BridgeRelay({
        session,
        via: 'remote',
        onPairing: (state, socket) => {
          void this.ctx.storage.put({ [PAIRING_KEY]: state, [SESSION_KEY]: session });
          void this.ctx.storage.setAlarm(state.expiresAt);
          // tags this socket as the paired browser (survives hibernation)
          (socket as WebSocket).serializeAttachment?.({ paired: true });
        },
      });
    }
    return this.relay;
  }

  /** WebSocket upgrade from the browser (the Worker checked path and origin). */
  override async fetch(request: Request): Promise<Response> {
    const session = new URL(request.url).pathname.split('/')[3] ?? '';
    if (!isSessionId(session)) return new Response('Bad session', { status: 400 });
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    if (this.ctx.getWebSockets().length >= MAX_SOCKETS) return new Response('Too many connections', { status: 429 });
    this.ensureRelay(session);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server, ['browser']);
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const relay = this.relay ?? this.ensureRelay(this.session);
    if (typeof message !== 'string' || message.length > MAX_FRAME_BYTES) {
      ws.close(1009, 'Message not accepted');
      return;
    }
    relay.onBrowserMessage(ws, message);
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    this.relay?.onBrowserClose(ws);
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    this.relay?.onBrowserClose(ws);
  }

  override async alarm(): Promise<void> {
    const pairing = await this.ctx.storage.get<PairingState>(PAIRING_KEY);
    if (pairing && pairing.expiresAt > Date.now()) {
      await this.ctx.storage.setAlarm(pairing.expiresAt);
      return;
    }
    for (const ws of this.ctx.getWebSockets()) ws.close(CLOSE_EXPIRED, 'expired');
    await this.ctx.storage.deleteAll();
    this.relay = null;
  }

  /** RPC from the MCP endpoint: relays one validated tool call to the paired browser. */
  async relayCall(session: string, auth: string, tool: string, input: Record<string, unknown>): Promise<RelayCallResult> {
    try {
      if (!isSessionId(session)) throw new Error('Unknown or expired pairing code.');
      const relay = this.relay ?? this.ensureRelay(session);
      return await relay.call(auth, tool, input);
    } catch (error) {
      // an answer, not an exception: refused calls are expected (wrong code, tab closed, timeout)
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, summary: message, result: { error: message } };
    }
  }
}
