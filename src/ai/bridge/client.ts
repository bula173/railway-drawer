/**
 * @file client.ts
 * @brief Browser side of the AI bridge: opens the WebSocket to the relay (remote: the Worker's
 *        Durable Object on this site; local: the Node MCP server on 127.0.0.1), says hello with the
 *        secret's hash, runs relayed tool calls one at a time on the active tab and answers them.
 *        Reconnects with backoff unless the pairing was refused or expired.
 */
import { BRIDGE_VERSION, CLOSE_AUTH, CLOSE_EXPIRED, CLOSE_REPLACED, MAX_FRAME_BYTES, parseServerMessage } from './protocol';
import type { ResultMessage } from './protocol';

export type BridgeStatus = 'connecting' | 'connected' | 'closed' | 'refused';

export interface BridgeCallOutcome {
  ok: boolean;
  summary: string;
  result: Record<string, unknown>;
  image?: ResultMessage['image'];
}

export interface BridgeClientOptions {
  url: string;
  /** SHA-256 (hex) of the pairing secret. */
  auth: string;
  ttlSeconds?: number;
  run(tool: string, input: unknown): Promise<BridgeCallOutcome>;
  onStatus?(status: BridgeStatus, detail?: string, expiresAt?: number): void;
  WebSocketImpl?: typeof WebSocket;
  /** Base reconnect delay (ms). */
  retryMs?: number;
}

export class BridgeClient {
  private ws: WebSocket | null = null;
  private stopped = false;
  private attempts = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private queue: Promise<void> = Promise.resolve();
  status: BridgeStatus = 'closed';

  constructor(private readonly options: BridgeClientOptions) {}

  private setStatus(status: BridgeStatus, detail?: string, expiresAt?: number): void {
    this.status = status;
    this.options.onStatus?.(status, detail, expiresAt);
  }

  connect(): void {
    this.stopped = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const Impl = this.options.WebSocketImpl ?? WebSocket;
    let ws: WebSocket;
    try {
      ws = new Impl(this.options.url);
    } catch (error) {
      this.setStatus('refused', error instanceof Error ? error.message : String(error));
      return;
    }
    this.ws = ws;
    this.setStatus('connecting');
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ t: 'hello', v: BRIDGE_VERSION, auth: this.options.auth, ttl: this.options.ttlSeconds }));
    });
    ws.addEventListener('message', (evt: MessageEvent) => {
      if (typeof evt.data !== 'string') return;
      const msg = parseServerMessage(evt.data);
      if (!msg) return;
      if (msg.t === 'welcome') {
        this.attempts = 0;
        this.setStatus('connected', msg.via, msg.expiresAt);
      } else if (msg.t === 'error') {
        if (msg.code === 'unauthorized' || msg.code === 'expired' || msg.code === 'version' || msg.code === 'replaced') this.stopped = true;
        this.setStatus(msg.code === 'replaced' ? 'closed' : 'refused', msg.message);
      } else if (msg.t === 'call') {
        const { id, tool, input } = msg;
        this.queue = this.queue.then(() => this.answer(ws, id, tool, input));
      }
    });
    ws.addEventListener('close', (evt: CloseEvent) => {
      if (this.ws !== ws) return;
      this.ws = null;
      if ([CLOSE_AUTH, CLOSE_EXPIRED, CLOSE_REPLACED].includes(evt.code)) this.stopped = true;
      if (this.stopped) {
        if (this.status !== 'refused') this.setStatus('closed', evt.reason || undefined);
        return;
      }
      // reconnect (server restart, network): 1 s, 2 s, 4 s ... max 30 s
      const delay = Math.min(30_000, (this.options.retryMs ?? 1000) * 2 ** this.attempts++);
      this.setStatus('connecting', `Reconnecting in ${Math.round(delay / 1000)} s`);
      this.timer = setTimeout(() => this.connect(), delay);
    });
  }

  private async answer(ws: WebSocket, id: string, tool: string, input: unknown): Promise<void> {
    let outcome: BridgeCallOutcome;
    try {
      outcome = await this.options.run(tool, input);
    } catch (error) {
      outcome = { ok: false, summary: 'Failed', result: { error: error instanceof Error ? error.message : String(error) } };
    }
    let text = JSON.stringify({ t: 'result', id, ok: outcome.ok, summary: outcome.summary, result: outcome.result, ...(outcome.image ? { image: outcome.image } : {}) });
    if (text.length > MAX_FRAME_BYTES) text = JSON.stringify({ t: 'result', id, ok: false, summary: 'Too large', result: { error: 'The result is too large to send over the bridge (try svg/drawio with download=true).' } });
    if (ws.readyState === ws.OPEN) ws.send(text);
  }

  close(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const ws = this.ws;
    this.ws = null;
    ws?.close(1000, 'closed by the user');
    this.setStatus('closed');
  }
}
