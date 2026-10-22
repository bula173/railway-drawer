/**
 * @file main.ts
 * @brief Railway Drawer local MCP server (stdio), docs/AI.md. Tools are the app's AI tools; each call
 *        goes to the Railway Drawer page connected to the local bridge (ws://127.0.0.1:<port>/bridge),
 *        or, when none is connected and RAILWAY_DRAWER_FILE is set, runs headless on that .drawio
 *        file. stdout carries MCP only; logs go to stderr.
 *
 * Env: RAILWAY_DRAWER_TOKEN (pairing token from the app's AI panel), RAILWAY_DRAWER_PORT (7391),
 *      RAILWAY_DRAWER_FILE (optional), RAILWAY_DRAWER_ORIGINS (comma-separated page origins),
 *      RAILWAY_DRAWER_PUBLIC (the app's public/ folder; default: next to this bundle in the repo).
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { parsePairingToken } from '../../../src/ai/bridge/protocol';
import { createRailwayMcpServer } from '../../../src/ai/mcp/mcp-server';
import type { McpExecutor } from '../../../src/ai/mcp/mcp-server';
import { DEFAULT_ORIGINS, startBridgeServer } from './bridge-server';
import type { BridgeServer } from './bridge-server';
import type { HeadlessSession } from './headless-core';

const VERSION = '1';
const log = (m: string): void => {
  process.stderr.write(`[railway-drawer-mcp] ${m}\n`);
};

async function main(): Promise<void> {
  const env = process.env;
  const token = parsePairingToken(env.RAILWAY_DRAWER_TOKEN);
  const port = Number(env.RAILWAY_DRAWER_PORT ?? 7391);
  const file = env.RAILWAY_DRAWER_FILE ? resolve(env.RAILWAY_DRAWER_FILE) : null;
  const here = dirname(fileURLToPath(import.meta.url));
  const publicDir = resolve(env.RAILWAY_DRAWER_PUBLIC ?? resolve(here, '../../../public'));
  const origins = env.RAILWAY_DRAWER_ORIGINS ? env.RAILWAY_DRAWER_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_ORIGINS;
  if (env.RAILWAY_DRAWER_TOKEN && !token) log('RAILWAY_DRAWER_TOKEN is not a valid pairing token (rdp1.<session>.<secret>): browser bridge off');

  let bridge: BridgeServer | null = null;
  if (token) {
    try {
      bridge = await startBridgeServer({ token, port, origins, log });
    } catch (error) {
      log(`could not listen on 127.0.0.1:${port}: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else if (!file) {
    log('neither RAILWAY_DRAWER_TOKEN nor RAILWAY_DRAWER_FILE is set: every tool call will fail');
  }

  let headless: Promise<HeadlessSession> | null = null;
  const execute: McpExecutor = async (tool, input) => {
    if (bridge?.relay.connected) return bridge.relay.call(bridge.auth, tool, input);
    if (file) {
      headless ??= import('./headless').then((m) => m.openHeadless(file, publicDir, log));
      return (await headless).execute(tool, input);
    }
    throw new Error(
      token
        ? `No Railway Drawer tab is connected: in the app open the AI panel > Connect to AI assistant > Connect local server (port ${port}). Or set RAILWAY_DRAWER_FILE to edit a .drawio file without the browser.`
        : 'Not configured: set RAILWAY_DRAWER_TOKEN (copy the config from the app: AI panel > Connect to AI assistant > Local MCP server) or RAILWAY_DRAWER_FILE.'
    );
  };

  serveStdio(() => createRailwayMcpServer(execute, VERSION), { onerror: (e) => log(`mcp: ${e.message}`) });
  log(`ready (bridge ${bridge ? `ws://127.0.0.1:${bridge.port}/bridge` : 'off'}${file ? `, headless file ${file}` : ''})`);
  const shutdown = (): void => {
    void bridge?.close().finally(() => process.exit(0));
    if (!bridge) process.exit(0);
  };
  process.stdin.on('end', shutdown);
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error: unknown) => {
  log(`fatal: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
  process.exit(1);
});
