/**
 * @file chat-loop.ts
 * @brief The in-app agent loop: the user's message -> Messages API (streaming, the user's own key,
 *        straight from the browser) -> tool_use blocks executed on the active tab -> tool_result
 *        blocks -> ... until the model ends its turn. Manual loop (not the SDK tool runner) because
 *        each tool call may wait for the user (confirm mode), the turn must be stoppable at any
 *        point and every edit is recorded for "Undo AI turn".
 *
 * History is append-only (assistant `content` is sent back unchanged, thinking blocks included),
 * so prompt caching and preserved thinking keep working. Tool inputs stream eagerly and are
 * validated against their schema before running (tools.ts); a refusal or a tool input cut off at
 * max_tokens never runs.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { BetaContentBlock, BetaMessage, BetaMessageParam, BetaTool, BetaToolResultBlockParam, BetaToolUseBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { AI_TOOLS } from '../tool-defs';
import type { ToolOutcome } from '../tools';
import type { AiSettings } from './settings';
import { modelOption } from './settings';

export const MAX_TOOL_ROUNDS = 30;
export const MAX_TOKENS = 64000;
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
}

export interface ChatEvents {
  /** Streamed assistant text. */
  onText?(delta: string): void;
  /** Streamed (summarized) thinking. */
  onThinking?(delta: string): void;
  /** A new assistant message starts streaming. */
  onMessageStart?(): void;
  onToolStart?(call: ToolCall): void;
  onToolEnd?(call: ToolCall, outcome: ToolOutcome): void;
  /** Usage of each request (tokens; cache reads show caching works). */
  onUsage?(usage: BetaMessage['usage']): void;
}

/** Runs one tool call (validation, confirm mode, edit recording are the runner's job). */
export type ToolRunner = (call: ToolCall, signal: AbortSignal) => Promise<ToolOutcome>;

export type TurnEnd = 'end_turn' | 'stopped' | 'refusal' | 'max_tokens' | 'tool_limit' | 'error';

export interface TurnResult {
  end: TurnEnd;
  /** Message for the user when the turn did not end normally. */
  message?: string;
}

/** Anthropic client for the browser with the user's own key. */
export function createBrowserClient(apiKey: string, fetchImpl?: typeof fetch): Anthropic {
  return new Anthropic({
    apiKey,
    // The key belongs to the user and stays in their browser; requests go straight to
    // api.anthropic.com (the SDK sends `anthropic-dangerous-direct-browser-access: true`).
    dangerouslyAllowBrowser: true,
    maxRetries: 2,
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
  });
}

/** Tools as the Messages API wants them (stable order; the last one carries the cache breakpoint). */
export function apiTools(): BetaTool[] {
  return AI_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as BetaTool['input_schema'],
    eager_input_streaming: true,
  }));
}

function toolResultContent(outcome: ToolOutcome): BetaToolResultBlockParam['content'] {
  const text = JSON.stringify(outcome.result);
  if (!outcome.image) return text;
  return [
    { type: 'image', source: { type: 'base64', media_type: outcome.image.mediaType, data: outcome.image.data } },
    { type: 'text', text },
  ];
}

export class ChatSession {
  /** The conversation (append-only). */
  readonly messages: BetaMessageParam[] = [];
  private controller: AbortController | null = null;

  private readonly clientFor: () => Anthropic;

  /** `client`: a client, or a function giving the client for the current key (settings may change). */
  constructor(
    client: Anthropic | (() => Anthropic),
    private readonly system: string,
    private readonly settings: () => AiSettings
  ) {
    this.clientFor = typeof client === 'function' ? client : () => client;
  }

  get running(): boolean {
    return this.controller !== null;
  }

  stop(): void {
    this.controller?.abort();
  }

  reset(): void {
    this.stop();
    this.messages.length = 0;
  }

  private params(): Parameters<Anthropic['beta']['messages']['stream']>[0] {
    const s = this.settings();
    const fallback = modelOption(s.model)?.fallback === true;
    return {
      model: s.model,
      max_tokens: MAX_TOKENS,
      system: [{ type: 'text', text: this.system }],
      tools: apiTools(),
      messages: this.messages,
      thinking: { type: 'adaptive', display: 'summarized' },
      output_config: { effort: s.effort },
      // caches tools + system + the conversation so far
      cache_control: { type: 'ephemeral' },
      ...(fallback ? { betas: [FALLBACK_BETA], fallbacks: 'default' as const } : {}),
    };
  }

  /** Sends `text` and runs the turn to its end. Rejects only on API/network errors. */
  async send(text: string, runTool: ToolRunner, events: ChatEvents = {}): Promise<TurnResult> {
    if (this.controller) throw new Error('A turn is already running');
    const controller = new AbortController();
    this.controller = controller;
    this.messages.push({ role: 'user', content: text });
    let jsonRetries = 0;
    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        if (controller.signal.aborted) return { end: 'stopped' };
        events.onMessageStart?.();
        const stream = this.clientFor().beta.messages.stream(this.params(), { signal: controller.signal });
        stream.on('text', (delta) => events.onText?.(delta));
        stream.on('thinking', (delta) => events.onThinking?.(delta));
        let message: BetaMessage;
        try {
          message = await stream.finalMessage();
          jsonRetries = 0;
        } catch (error) {
          if (controller.signal.aborted || error instanceof Anthropic.APIUserAbortError) return { end: 'stopped' };
          // a tool input that is not even parseable JSON (eager streaming): re-issue the turn
          if (!(error instanceof Anthropic.APIError) && jsonRetries++ < 2) continue;
          throw error;
        }
        events.onUsage?.(message.usage);
        const content = message.content as BetaContentBlock[];
        if (message.stop_reason === 'refusal') {
          // the declined turn is not kept; the conversation stays valid
          return { end: 'refusal', message: 'The model declined this request.' };
        }
        this.messages.push({ role: 'assistant', content });
        if (message.stop_reason === 'pause_turn') continue;
        const toolUses = content.filter((b): b is BetaToolUseBlock => b.type === 'tool_use');
        if (toolUses.length === 0) {
          return message.stop_reason === 'max_tokens' ? { end: 'max_tokens', message: 'The answer was cut off (output limit).' } : { end: 'end_turn' };
        }
        const results: BetaToolResultBlockParam[] = [];
        if (message.stop_reason === 'max_tokens') {
          for (const t of toolUses) results.push({ type: 'tool_result', tool_use_id: t.id, is_error: true, content: 'The tool input was cut off at the output limit; nothing was run. Send smaller pieces.' });
          this.messages.push({ role: 'user', content: results });
          continue;
        }
        for (const t of toolUses) {
          const call: ToolCall = { id: t.id, name: t.name, input: t.input };
          if (controller.signal.aborted) {
            results.push({ type: 'tool_result', tool_use_id: t.id, is_error: true, content: 'Stopped by the user before this tool ran.' });
            continue;
          }
          events.onToolStart?.(call);
          const outcome = await runTool(call, controller.signal);
          events.onToolEnd?.(call, outcome);
          results.push({ type: 'tool_result', tool_use_id: t.id, ...(outcome.ok ? {} : { is_error: true }), content: toolResultContent(outcome) });
        }
        // all results of one assistant message go back in ONE user message
        this.messages.push({ role: 'user', content: results });
        if (controller.signal.aborted) return { end: 'stopped' };
      }
      return { end: 'tool_limit', message: `Stopped after ${MAX_TOOL_ROUNDS} tool rounds.` };
    } finally {
      this.controller = null;
    }
  }
}

/** A readable message for an API / network error (never includes the key). */
export function describeApiError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return 'The API key was not accepted (401). Check it in the AI settings.';
  if (error instanceof Anthropic.PermissionDeniedError) return 'The API key may not use this model (403).';
  if (error instanceof Anthropic.NotFoundError) return 'Unknown model (404). Choose another model in the AI settings.';
  if (error instanceof Anthropic.RateLimitError) return 'Rate limited by the Anthropic API (429). Try again in a moment.';
  if (error instanceof Anthropic.BadRequestError) return `The request was rejected (400): ${error.message}`;
  if (error instanceof Anthropic.APIConnectionError) return 'Could not reach api.anthropic.com (network, firewall or browser extension).';
  if (error instanceof Anthropic.APIError) return `Anthropic API error ${error.status ?? ''}: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}
