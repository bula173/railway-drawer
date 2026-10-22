/**
 * @file relay.ts
 * @brief Server side of the AI bridge for ONE pairing session, independent of the runtime: the
 *        Worker's Durable Object (worker/ai-bridge.ts) and the local Node MCP server
 *        (tools/mcp-local) wrap it around their WebSocket. It authenticates the browser's hello
 *        (registers / checks the secret hash, lifetime), relays MCP tool calls to the browser and
 *        resolves them with the browser's result (timeout, rate limit, frame size limit).
 */
import {
  BRIDGE_VERSION,
  CALL_TIMEOUT_MS,
  CLOSE_AUTH,
  CLOSE_EXPIRED,
  CLOSE_PROTOCOL,
  CLOSE_REPLACED,
  MAX_CALLS_PER_MINUTE,
  MAX_FRAME_BYTES,
  MAX_PAIRING_TTL_S,
  parseBrowserMessage,
  sameHash,
} from './protocol';
import type { ResultMessage, ServerMessage } from './protocol';

export interface RelaySocket {
  send(text: string): void;
  close(code?: number, reason?: string): void;
}

/** What the relay remembers about the pairing (the DO persists it on the socket attachment). */
export interface PairingState {
  auth: string;
  expiresAt: number;
}

export interface RelayCallResult {
  ok: boolean;
  summary?: string;
  result: unknown;
  image?: ResultMessage['image'];
}

export interface RelayOptions {
  /** Session id (shown to the browser in the welcome). */
  session: string;
  via: 'remote' | 'local';
  now?: () => number;
  callTimeoutMs?: number;
  maxCallsPerMinute?: number;
  /** Called when the pairing state changes (claimed), e.g. to persist it. */
  onPairing?(state: PairingState, socket: RelaySocket): void;
}

export class RelayError extends Error {
  constructor(
    readonly code: 'not-connected' | 'unauthorized' | 'expired' | 'rate-limited' | 'timeout' | 'too-large' | 'disconnected',
    message: string
  ) {
    super(message);
  }
}

const NOT_CONNECTED = 'No Railway Drawer tab is connected to this pairing. In the app: AI panel > "Connect to AI assistant", then retry.';

interface Pending {
  resolve(r: RelayCallResult): void;
  reject(e: Error): void;
  timer: ReturnType<typeof setTimeout>;
}

export class BridgeRelay {
  private browser: RelaySocket | null = null;
  private pairing: PairingState | null = null;
  private readonly pending = new Map<string, Pending>();
  private calls: number[] = [];
  private nextId = 1;
  private readonly now: () => number;

  constructor(private readonly options: RelayOptions) {
    this.now = options.now ?? (() => Date.now());
  }

  get connected(): boolean {
    return this.browser !== null && !!this.pairing && this.pairing.expiresAt > this.now();
  }

  /** The pairing as registered by the browser (null: not claimed yet). */
  get state(): PairingState | null {
    return this.pairing;
  }

  /** Restores the pairing (and the browser socket, if one is still open) after a restart (Durable Object hibernation wake-up). */
  restore(socket: RelaySocket | null, state: PairingState): void {
    this.pairing = state;
    this.browser = socket;
  }

  private send(socket: RelaySocket, message: ServerMessage): void {
    try {
      socket.send(JSON.stringify(message));
    } catch {
      // the socket is gone; close handling cleans up
    }
  }

  /** A text frame from a browser socket. */
  onBrowserMessage(socket: RelaySocket, text: string): void {
    if (text.length > MAX_FRAME_BYTES) {
      this.send(socket, { t: 'error', code: 'too-large', message: 'Message too large' });
      if (socket === this.browser) this.failPending(new RelayError('too-large', 'The result was too large to relay.'));
      return;
    }
    const msg = parseBrowserMessage(text);
    if (!msg) {
      this.send(socket, { t: 'error', code: 'protocol', message: 'Invalid message' });
      socket.close(CLOSE_PROTOCOL, 'protocol');
      return;
    }
    if (msg.t === 'ping') {
      this.send(socket, { t: 'pong' });
      return;
    }
    if (msg.t === 'hello') {
      if (msg.v !== BRIDGE_VERSION) {
        this.send(socket, { t: 'error', code: 'version', message: `Unsupported bridge version ${msg.v}` });
        socket.close(CLOSE_PROTOCOL, 'version');
        return;
      }
      const now = this.now();
      if (this.pairing && this.pairing.expiresAt <= now) {
        this.send(socket, { t: 'error', code: 'expired', message: 'This pairing has expired: create a new one.' });
        socket.close(CLOSE_EXPIRED, 'expired');
        return;
      }
      if (this.pairing && !sameHash(this.pairing.auth, msg.auth)) {
        this.send(socket, { t: 'error', code: 'unauthorized', message: 'This pairing belongs to another browser.' });
        socket.close(CLOSE_AUTH, 'unauthorized');
        return;
      }
      if (!this.pairing) {
        const ttl = Math.max(60, Math.min(MAX_PAIRING_TTL_S, Math.floor(msg.ttl ?? MAX_PAIRING_TTL_S)));
        this.pairing = { auth: msg.auth, expiresAt: now + ttl * 1000 };
      }
      if (this.browser && this.browser !== socket) {
        this.send(this.browser, { t: 'error', code: 'replaced', message: 'Connected from another window.' });
        this.browser.close(CLOSE_REPLACED, 'replaced');
        this.failPending(new RelayError('disconnected', 'The browser reconnected; retry the call.'));
      }
      this.browser = socket;
      this.options.onPairing?.(this.pairing, socket);
      this.send(socket, { t: 'welcome', session: this.options.session, expiresAt: this.pairing.expiresAt, via: this.options.via });
      return;
    }
    // result
    if (socket !== this.browser) return;
    const p = this.pending.get(msg.id);
    if (!p) return;
    this.pending.delete(msg.id);
    clearTimeout(p.timer);
    p.resolve({ ok: msg.ok, summary: msg.summary, result: msg.result, image: msg.image });
  }

  /** The browser socket closed. */
  onBrowserClose(socket: RelaySocket): void {
    if (socket !== this.browser) return;
    this.browser = null;
    this.failPending(new RelayError('disconnected', 'The Railway Drawer tab disconnected during the call.'));
  }

  private failPending(error: Error): void {
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer);
      this.pending.delete(id);
      p.reject(error);
    }
  }

  /** Checks an MCP caller's secret hash against the pairing (constant time). */
  authorize(auth: string): void {
    if (!this.pairing || !sameHash(this.pairing.auth, auth)) throw new RelayError('unauthorized', 'Unknown or expired pairing code.');
    if (this.pairing.expiresAt <= this.now()) throw new RelayError('expired', 'This pairing has expired: create a new one in the app (AI panel).');
  }

  /** Relays one tool call to the browser (after `authorize`). */
  call(auth: string, tool: string, input: unknown): Promise<RelayCallResult> {
    try {
      this.authorize(auth);
    } catch (error) {
      return Promise.reject(error as Error);
    }
    const socket = this.browser;
    if (!socket) return Promise.reject(new RelayError('not-connected', NOT_CONNECTED));
    const now = this.now();
    this.calls = this.calls.filter((t) => now - t < 60_000);
    if (this.calls.length >= (this.options.maxCallsPerMinute ?? MAX_CALLS_PER_MINUTE)) {
      return Promise.reject(new RelayError('rate-limited', 'Too many tool calls for this pairing; wait a minute.'));
    }
    this.calls.push(now);
    const frame = { t: 'call' as const, id: `c${this.nextId++}`, tool, input };
    const text = JSON.stringify(frame);
    if (text.length > MAX_FRAME_BYTES) return Promise.reject(new RelayError('too-large', 'The tool input is too large.'));
    return new Promise<RelayCallResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(frame.id);
        reject(new RelayError('timeout', 'The Railway Drawer tab did not answer in time (it may be waiting for the user to confirm a change).'));
      }, this.options.callTimeoutMs ?? CALL_TIMEOUT_MS);
      this.pending.set(frame.id, { resolve, reject, timer });
      try {
        socket.send(text);
      } catch {
        clearTimeout(timer);
        this.pending.delete(frame.id);
        reject(new RelayError('disconnected', NOT_CONNECTED));
      }
    });
  }
}
