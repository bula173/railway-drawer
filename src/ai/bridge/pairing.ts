/**
 * @file pairing.ts
 * @brief Pairing codes of this browser tab and the MCP client configuration shown to the user.
 *        Remote pairing: per browser tab (sessionStorage `rd.ai.pairing`, survives a reload, gone
 *        with the tab), at most 12 hours. Local bridge (tools/mcp-local): one long-lived token per
 *        browser (localStorage `rd.ai.local`), because it is pasted once into the local MCP server's
 *        config and only accepted on 127.0.0.1.
 */
import { MAX_PAIRING_TTL_S, formatPairingToken, newPairingToken, parsePairingToken } from './protocol';
import type { PairingToken } from './protocol';

export const REMOTE_PAIRING_KEY = 'rd.ai.pairing';
export const LOCAL_BRIDGE_KEY = 'rd.ai.local';
export const DEFAULT_LOCAL_PORT = 7391;

export interface RemotePairing {
  token: PairingToken;
  /** ms epoch (requested; the server confirms it in its welcome). */
  expiresAt: number;
}

export interface LocalBridgeSettings {
  port: number;
  token: PairingToken;
}

function store(kind: 'session' | 'local'): Storage | null {
  try {
    return kind === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

export function readRemotePairing(now = Date.now()): RemotePairing | null {
  try {
    const raw = store('session')?.getItem(REMOTE_PAIRING_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { token?: string; expiresAt?: number };
    const token = parsePairingToken(v.token);
    if (!token || typeof v.expiresAt !== 'number' || v.expiresAt <= now) return null;
    return { token, expiresAt: v.expiresAt };
  } catch {
    return null;
  }
}

export function createRemotePairing(now = Date.now(), ttlSeconds = MAX_PAIRING_TTL_S): RemotePairing {
  const pairing = { token: newPairingToken(), expiresAt: now + ttlSeconds * 1000 };
  try {
    store('session')?.setItem(REMOTE_PAIRING_KEY, JSON.stringify({ token: formatPairingToken(pairing.token), expiresAt: pairing.expiresAt }));
  } catch {
    // kept for this page only
  }
  return pairing;
}

export function clearRemotePairing(): void {
  try {
    store('session')?.removeItem(REMOTE_PAIRING_KEY);
  } catch {
    // nothing stored
  }
}

export function readLocalBridge(): LocalBridgeSettings {
  try {
    const raw = store('local')?.getItem(LOCAL_BRIDGE_KEY);
    if (raw) {
      const v = JSON.parse(raw) as { port?: number; token?: string };
      const token = parsePairingToken(v.token);
      const port = Number(v.port);
      if (token && Number.isInteger(port) && port > 1023 && port < 65536) return { port, token };
    }
  } catch {
    // fall through: new settings
  }
  const fresh = { port: DEFAULT_LOCAL_PORT, token: newPairingToken() };
  writeLocalBridge(fresh);
  return fresh;
}

export function writeLocalBridge(s: LocalBridgeSettings): void {
  try {
    store('local')?.setItem(LOCAL_BRIDGE_KEY, JSON.stringify({ port: s.port, token: formatPairingToken(s.token) }));
  } catch {
    // session only
  }
}

/** Remote MCP URL with the token (for clients that take only a URL, e.g. claude.ai connectors). */
export function remoteMcpUrl(origin: string, token: PairingToken): string {
  return `${origin}/mcp?pair=${formatPairingToken(token)}`;
}

/** Remote MCP URL without the token (for clients that send it as a header). */
export function remoteMcpBaseUrl(origin: string): string {
  return `${origin}/mcp`;
}

/** The browser's WebSocket to the pairing's Durable Object (same origin). */
export function remoteBridgeUrl(origin: string, token: PairingToken): string {
  return `${origin.replace(/^http/, 'ws')}/api/ai-bridge/${token.session}/ws`;
}

export function localBridgeUrl(port: number): string {
  return `ws://127.0.0.1:${port}/bridge`;
}

/** `claude mcp add` command for Claude Code (token as a header, not in the URL). */
export function claudeCodeCommand(origin: string, token: PairingToken): string {
  return `claude mcp add --transport http railway-drawer ${remoteMcpBaseUrl(origin)} --header "Authorization: Bearer ${formatPairingToken(token)}"`;
}

/** Claude Desktop / Claude Code JSON config of the local stdio server. */
export function localServerConfig(s: LocalBridgeSettings, serverPath = '<path to railway-drawer>/tools/mcp-local/dist/railway-drawer-mcp.mjs'): string {
  return JSON.stringify(
    {
      mcpServers: {
        'railway-drawer-local': {
          command: 'node',
          args: [serverPath],
          env: { RAILWAY_DRAWER_TOKEN: formatPairingToken(s.token), RAILWAY_DRAWER_PORT: String(s.port) },
        },
      },
    },
    null,
    2
  );
}
