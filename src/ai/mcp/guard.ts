/**
 * @file guard.ts
 * @brief Abuse limits of the remote AI endpoints, runtime independent (the Worker applies them;
 *        pure, so unit-testable and bundled by the Worker):
 *        - `redactUrl`: a URL without the `?pair=` pairing code, for anything that logs URLs;
 *        - `checkMcpRateLimit`: per-IP and global request limits on `/mcp` BEFORE a Durable Object is
 *          addressed (each new session id would otherwise create one), with Cloudflare's Workers Rate
 *          Limiting binding (`ratelimits` in wrangler.jsonc; counters are per Cloudflare location and
 *          eventually consistent: a cheap first gate, the relay's per-pairing 60 calls/min stays);
 *        - `admitBridgeSocket` / `staleUnpairedSockets`: browser WebSockets of one pairing: only
 *          sockets that sent a valid hello (paired) count toward MAX_PAIRED_SOCKETS; sockets still
 *          waiting for their hello are capped separately and closed after HELLO_TIMEOUT_MS;
 *        - `API_SECURITY_HEADERS`: headers of the Worker's own (non-asset) responses.
 */

/** A browser socket must send a valid hello within this time. */
export const HELLO_TIMEOUT_MS = 10_000;
/** Paired browser sockets per pairing (the relay keeps one; reconnect races may briefly hold more). */
export const MAX_PAIRED_SOCKETS = 4;
/** Sockets per pairing that have not said hello yet. */
export const MAX_UNPAIRED_SOCKETS = 4;

/** Headers for the Worker's JSON / upgrade answers (the static app gets public/_headers). */
export const API_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cache-control': 'no-store',
};

/** Response with the API security headers added (headers already set win). */
export function withApiHeaders(response: Response): Response {
  // 101 (WebSocket upgrade) responses cannot be re-created; their headers do not matter
  if (response.status === 101 || (response as { webSocket?: unknown }).webSocket) return response;
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(API_SECURITY_HEADERS)) if (!headers.has(name)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/** `url` with the `pair` query parameter (the pairing code) replaced by `REDACTED`. */
export function redactUrl(url: string | URL): string {
  try {
    const u = new URL(String(url));
    if (u.searchParams.has('pair')) u.searchParams.set('pair', 'REDACTED');
    return u.toString();
  } catch {
    return String(url).replace(/([?&]pair=)[^&#]*/gi, '$1REDACTED');
  }
}

export interface RateLimiterLike {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface McpRateLimiters {
  /** Per client IP (`cf-connecting-ip`). */
  perIp?: RateLimiterLike;
  /** All clients together (caps Durable Object creation by random session ids). */
  global?: RateLimiterLike;
}

/** null = allowed, else the 429 answer. A missing binding (local dev, tests) does not limit. */
export async function checkMcpRateLimit(request: Request, limiters: McpRateLimiters): Promise<Response | null> {
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  const checks: Array<[RateLimiterLike | undefined, string]> = [
    [limiters.perIp, `mcp:ip:${ip}`],
    [limiters.global, 'mcp:global'],
  ];
  for (const [limiter, key] of checks) {
    if (!limiter) continue;
    let ok = true;
    try {
      ok = (await limiter.limit({ key })).success;
    } catch {
      ok = true; // the limiter is a guard, not a dependency: fail open on its outage
    }
    if (!ok) {
      return new Response(JSON.stringify({ error: 'rate_limited', message: 'Too many requests; retry in a minute.' }), {
        status: 429,
        headers: { 'content-type': 'application/json', 'retry-after': '60', ...API_SECURITY_HEADERS },
      });
    }
  }
  return null;
}

export interface BridgeSocketInfo {
  /** Sent a valid hello (the relay tagged it). */
  paired: boolean;
  /** ms epoch the socket was accepted (0 = unknown, e.g. sockets from before this field). */
  acceptedAt: number;
}

/** Whether one more browser socket may be accepted (it starts unpaired). */
export function admitBridgeSocket(sockets: readonly BridgeSocketInfo[], now: number): boolean {
  const waiting = sockets.filter((s) => !s.paired && now - s.acceptedAt < HELLO_TIMEOUT_MS).length;
  return waiting < MAX_UNPAIRED_SOCKETS;
}

/** Indexes of unpaired sockets past their hello deadline (to be closed). */
export function staleUnpairedSockets(sockets: readonly BridgeSocketInfo[], now: number): number[] {
  const out: number[] = [];
  sockets.forEach((s, i) => {
    if (!s.paired && now - s.acceptedAt >= HELLO_TIMEOUT_MS) out.push(i);
  });
  return out;
}

/** Whether a paired socket may be kept (more than MAX_PAIRED_SOCKETS paired ones: close the oldest). */
export function pairedOverflow(sockets: readonly BridgeSocketInfo[]): number[] {
  const paired = sockets.map((s, i) => ({ s, i })).filter((x) => x.s.paired).sort((a, b) => a.s.acceptedAt - b.s.acceptedAt);
  return paired.slice(0, Math.max(0, paired.length - MAX_PAIRED_SOCKETS)).map((x) => x.i);
}
