/**
 * @file protocol.ts
 * @brief The AI bridge between an MCP server (remote: the Worker's Durable Object; local: the
 *        Node MCP server) and the user's open Railway Drawer tab, over one WebSocket that the
 *        BROWSER opens. MCP tool calls are relayed to the browser, run there by the shared tool core
 *        (tools.ts) on the active tab, and the results go back. Pure (no DOM, no runtime APIs).
 *
 * Pairing token (shown only in the browser, pasted into the MCP client config):
 *   `rdp1.<session>.<secret>` - session = 16 random bytes, secret = 32 random bytes, base64url.
 * The browser sends only SHA-256(secret) (hex) in its hello; the MCP side presents the token and
 * the server compares SHA-256(secret) with the hash the browser registered (constant time). The
 * server never stores the secret itself.
 *
 * Messages (JSON text frames, at most MAX_FRAME_BYTES):
 *   browser -> server: hello {v, auth, ttl}, result {id, ok, summary, result, image?}, ping
 *   server -> browser: welcome {session, expiresAt}, call {id, tool, input}, error {code, message}, pong
 */
import { sha256 } from '../../share/providers/gitlab/pkce';

export const BRIDGE_VERSION = 1;
export const TOKEN_PREFIX = 'rdp1';
/** Longest pairing lifetime (the browser may ask for less). */
export const MAX_PAIRING_TTL_S = 12 * 60 * 60;
/** Largest WebSocket frame either side accepts. */
export const MAX_FRAME_BYTES = 2 * 1024 * 1024;
/** Largest MCP request body the Worker accepts. */
export const MAX_MCP_BODY_BYTES = 512 * 1024;
/** A relayed call waits this long for the browser (confirm mode included). */
export const CALL_TIMEOUT_MS = 180_000;
/** Tool calls per minute per pairing. */
export const MAX_CALLS_PER_MINUTE = 60;

/** WebSocket close codes. */
export const CLOSE_AUTH = 4401;
export const CLOSE_EXPIRED = 4410;
export const CLOSE_REPLACED = 4000;
export const CLOSE_PROTOCOL = 4400;

export interface HelloMessage {
  t: 'hello';
  v: number;
  /** SHA-256 of the pairing secret, lower-case hex. */
  auth: string;
  /** Requested lifetime in seconds (capped at MAX_PAIRING_TTL_S). */
  ttl?: number;
}

export interface ResultMessage {
  t: 'result';
  id: string;
  ok: boolean;
  summary?: string;
  result: unknown;
  image?: { mediaType: 'image/png'; data: string };
}

export type BrowserMessage = HelloMessage | ResultMessage | { t: 'ping' };

export type ServerMessage =
  | { t: 'welcome'; session: string; expiresAt: number; via: 'remote' | 'local' }
  | { t: 'call'; id: string; tool: string; input: unknown }
  | { t: 'error'; code: string; message: string }
  | { t: 'pong' };

export interface PairingToken {
  session: string;
  secret: string;
}

const B64URL = /^[A-Za-z0-9_-]+$/;

export function base64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomBase64Url(bytes: number): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return base64Url(b);
}

/** A new random pairing token. */
export function newPairingToken(): PairingToken {
  return { session: randomBase64Url(16), secret: randomBase64Url(32) };
}

export function formatPairingToken(t: PairingToken): string {
  return `${TOKEN_PREFIX}.${t.session}.${t.secret}`;
}

/** Parses `rdp1.<session>.<secret>` (null when malformed). */
export function parsePairingToken(text: string | null | undefined): PairingToken | null {
  const parts = (text ?? '').trim().split('.');
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) return null;
  const [, session, secret] = parts;
  if (!isSessionId(session) || secret.length !== 43 || !B64URL.test(secret)) return null;
  return { session, secret };
}

export function isSessionId(text: string): boolean {
  return text.length === 22 && B64URL.test(text);
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 of a pairing secret as lower-case hex (pure JS: works on plain-http LAN pages too). */
export function hashSecret(secret: string): string {
  return hex(sha256(new TextEncoder().encode(secret)));
}

/** Constant-time comparison of two hex strings. */
export function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isHashHex(text: unknown): text is string {
  return typeof text === 'string' && /^[0-9a-f]{64}$/.test(text);
}

/** Parses a frame from the browser (null: not a valid message). */
export function parseBrowserMessage(text: string): BrowserMessage | null {
  if (text.length > MAX_FRAME_BYTES) return null;
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (!v || typeof v !== 'object') return null;
  const m = v as Record<string, unknown>;
  if (m.t === 'ping') return { t: 'ping' };
  if (m.t === 'hello' && typeof m.v === 'number' && isHashHex(m.auth)) return { t: 'hello', v: m.v, auth: m.auth, ttl: typeof m.ttl === 'number' ? m.ttl : undefined };
  if (m.t === 'result' && typeof m.id === 'string' && typeof m.ok === 'boolean') {
    const image = m.image as ResultMessage['image'] | undefined;
    return {
      t: 'result',
      id: m.id,
      ok: m.ok,
      summary: typeof m.summary === 'string' ? m.summary : undefined,
      result: m.result,
      image: image && image.mediaType === 'image/png' && typeof image.data === 'string' ? image : undefined,
    };
  }
  return null;
}

/** Parses a frame from the server (browser side). */
export function parseServerMessage(text: string): ServerMessage | null {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  if (!v || typeof v !== 'object') return null;
  const m = v as Record<string, unknown>;
  switch (m.t) {
    case 'welcome':
      return typeof m.session === 'string' && typeof m.expiresAt === 'number' ? { t: 'welcome', session: m.session, expiresAt: m.expiresAt, via: m.via === 'local' ? 'local' : 'remote' } : null;
    case 'call':
      return typeof m.id === 'string' && typeof m.tool === 'string' ? { t: 'call', id: m.id, tool: m.tool, input: m.input ?? {} } : null;
    case 'error':
      return { t: 'error', code: String(m.code ?? 'error'), message: String(m.message ?? '') };
    case 'pong':
      return { t: 'pong' };
    default:
      return null;
  }
}
