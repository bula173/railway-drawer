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
}
