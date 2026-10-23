/**
 * @file env.ts
 * @brief Bindings of the Railway Drawer Worker (wrangler.jsonc).
 */
import type { AiBridge } from './ai-bridge';

export interface Env {
  /** The built app (dist/), served as static assets. */
  ASSETS: Fetcher;
  /** One Durable Object per AI pairing session. */
  AI_BRIDGE: DurableObjectNamespace<AiBridge>;
  /** Workers Rate Limiting: `/mcp` requests per client IP (wrangler.jsonc `ratelimits`). */
  MCP_RATE_LIMIT_IP?: RateLimit;
  /** Workers Rate Limiting: `/mcp` requests of all clients together. */
  MCP_RATE_LIMIT_GLOBAL?: RateLimit;
}
